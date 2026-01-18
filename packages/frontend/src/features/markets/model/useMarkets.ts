'use client';

import type { MarketData, MarketInfo, MarketState } from '@entities/market';
import { useStarknet } from '@features/wallet';
import { getAddresses, getMarketInfoByAddress, getMarketInfos } from '@shared/config/addresses';
import { TWAP_DEFAULT_DURATION, TWAP_DURATIONS } from '@shared/config/twap';
import { toHexAddress } from '@shared/lib/abi-helpers';
import { calculateAnnualFeeRate } from '@shared/lib/fees';
import { toBigInt } from '@shared/lib/uint256';
import { daysToExpiry, lnRateToApy } from '@shared/math/yield';
import { logError, logWarn } from '@shared/server/logger';
import {
  getMarketContract,
  getMarketFactoryContract,
  getPyLpOracleContract,
} from '@shared/starknet/contracts';
import type { NetworkId } from '@shared/starknet/provider';
import { useQueries, useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import type { ProviderInterface } from 'starknet';

/**
 * Page size for paginated market fetching
 * @see Security Audit L-04 - Gas Exhaustion Prevention
 */
const MARKETS_PAGE_SIZE = 20;

// Contract MarketState struct shape from get_market_state()
// Must match contracts/src/interfaces/i_market.cairo MarketState struct
interface ContractMarketState {
  sy_reserve: bigint | { low: bigint; high: bigint };
  pt_reserve: bigint | { low: bigint; high: bigint };
  total_lp: bigint | { low: bigint; high: bigint };
  scalar_root: bigint | { low: bigint; high: bigint };
  initial_anchor: bigint | { low: bigint; high: bigint };
  ln_fee_rate_root: bigint | { low: bigint; high: bigint };
  reserve_fee_percent: number | bigint;
  expiry: number | bigint;
  last_ln_implied_rate: bigint | { low: bigint; high: bigint };
  py_index: bigint | { low: bigint; high: bigint };
}

async function fetchMarketData(
  marketAddress: string,
  provider: ProviderInterface,
  network: NetworkId
): Promise<MarketData> {
  const market = getMarketContract(marketAddress, provider);
  const addresses = getAddresses(network);

  try {
    // Use get_market_state() to reduce RPC calls from 11 to 6
    // get_market_state() returns: sy_reserve, pt_reserve, total_lp, scalar_root,
    // initial_anchor, ln_fee_rate_root, reserve_fee_percent, expiry, last_ln_implied_rate, py_index
    const [syAddress, ptAddress, ytAddress, isExpiredVal, contractState, feesCollected] =
      await Promise.all([
        market.sy(),
        market.pt(),
        market.yt(),
        market.is_expired(),
        market.get_market_state() as Promise<ContractMarketState>,
        market.get_total_fees_collected(),
      ]);

    const info: MarketInfo = {
      address: marketAddress,
      syAddress: toHexAddress(syAddress),
      ptAddress: toHexAddress(ptAddress),
      ytAddress: toHexAddress(ytAddress),
      expiry: Number(contractState.expiry),
      isExpired: Boolean(isExpiredVal),
    };

    const lnFeeRateRootValue = toBigInt(contractState.ln_fee_rate_root);
    const state: MarketState = {
      syReserve: toBigInt(contractState.sy_reserve),
      ptReserve: toBigInt(contractState.pt_reserve),
      totalLpSupply: toBigInt(contractState.total_lp),
      lnImpliedRate: toBigInt(contractState.last_ln_implied_rate),
      feesCollected: toBigInt(feesCollected as bigint | { low: bigint; high: bigint }),
      lnFeeRateRoot: lnFeeRateRootValue,
      reserveFeePercent: Number(contractState.reserve_fee_percent),
    };

    // Spot rate (always available)
    const spotRate = state.lnImpliedRate;
    const spotApy = lnRateToApy(spotRate);

    // TWAP rate with graceful fallback
    let twapRate = spotRate;
    let twapDuration = 0;
    let oracleState: 'ready' | 'partial' | 'spot-only' = 'spot-only';

    // Only attempt TWAP if PyLpOracle is configured
    if (addresses.pyLpOracle && addresses.pyLpOracle !== '0x0') {
      try {
        const pyLpOracle = getPyLpOracleContract(addresses.pyLpOracle, provider);

        // Check if full TWAP is available
        const readiness = await pyLpOracle.check_oracle_state(marketAddress, TWAP_DEFAULT_DURATION);

        if (readiness.oldest_observation_satisfied) {
          const rawRate = await pyLpOracle.get_ln_implied_rate_twap(
            marketAddress,
            TWAP_DEFAULT_DURATION
          );
          twapRate = toBigInt(rawRate as bigint | { low: bigint; high: bigint });
          twapDuration = TWAP_DEFAULT_DURATION;
          oracleState = 'ready';
        } else {
          // Try shorter duration (minimum 5 min)
          const shortDuration = TWAP_DURATIONS.MINIMUM;
          const shortReadiness = await pyLpOracle.check_oracle_state(marketAddress, shortDuration);
          if (shortReadiness.oldest_observation_satisfied) {
            const rawRate = await pyLpOracle.get_ln_implied_rate_twap(marketAddress, shortDuration);
            twapRate = toBigInt(rawRate as bigint | { low: bigint; high: bigint });
            twapDuration = shortDuration;
            oracleState = 'partial';
          }
        }
      } catch (twapError) {
        // Log TWAP error but continue with spot rate
        logWarn('TWAP fetch failed, using spot rate', {
          module: 'useMarkets',
          marketAddress,
          error: String(twapError),
        });
      }
    }

    const twapApy = lnRateToApy(twapRate);
    const days = daysToExpiry(info.expiry);
    const tvlSy = state.syReserve + state.ptReserve;
    const annualFeeRate = calculateAnnualFeeRate(lnFeeRateRootValue);

    // Get token metadata from static config if available
    const staticInfo = getMarketInfoByAddress(network, marketAddress);

    const baseData = {
      ...info,
      state,
      // Primary display now uses TWAP (falls back to spot)
      impliedApy: twapApy,
      tvlSy,
      daysToExpiry: days,
      annualFeeRate,
      // TWAP-specific fields
      twapImpliedApy: twapApy,
      spotImpliedApy: spotApy,
      oracleState,
      twapDuration,
    };

    if (staticInfo) {
      return {
        ...baseData,
        metadata: {
          key: staticInfo.key,
          underlyingAddress: staticInfo.underlyingAddress,
          yieldTokenName: staticInfo.yieldTokenName,
          yieldTokenSymbol: staticInfo.yieldTokenSymbol,
          isERC4626: staticInfo.isERC4626,
          ...(staticInfo.initialAnchor !== undefined && {
            initialAnchor: staticInfo.initialAnchor,
          }),
        },
      };
    }

    return baseData;
  } catch (error) {
    logError(error, { module: 'useMarkets', action: 'fetchMarketData', marketAddress });
    throw error;
  }
}

interface UseMarketsOptions {
  refetchInterval?: number;
}

interface UseMarketsReturn {
  markets: MarketData[];
  isLoading: boolean;
  isError: boolean;
  totalTvl: bigint;
  avgApy: BigNumber;
}

export function useMarkets(
  marketAddresses: string[],
  options: UseMarketsOptions = {}
): UseMarketsReturn {
  const { provider, network } = useStarknet();
  const { refetchInterval = 30000 } = options;

  // Only run queries on client side to avoid SSR issues with localhost RPC
  const isClient = typeof window !== 'undefined';

  const queries = useQueries({
    queries: marketAddresses.map((address) => ({
      queryKey: ['market', address, network],
      queryFn: () => fetchMarketData(address, provider, network),
      refetchInterval,
      staleTime: 10000,
      enabled: isClient && address !== '0x0',
      // Disable structural sharing to prevent BigInt serialization issues
      structuralSharing: false,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const data = queries.map((q) => q.data).filter((d): d is MarketData => d !== undefined);

  // Calculate totals
  const totalTvl = data.reduce((sum, m) => sum + m.tvlSy, BigInt(0));
  const avgApy =
    data.length > 0
      ? data.reduce((sum, m) => sum.plus(m.impliedApy), new BigNumber(0)).dividedBy(data.length)
      : new BigNumber(0);

  return {
    markets: data,
    isLoading,
    isError,
    totalTvl,
    avgApy,
  };
}

/**
 * Get static market addresses from config as fallback
 */
function getStaticMarketAddresses(network: NetworkId): string[] {
  const marketInfos = getMarketInfos(network);
  return marketInfos.map((m) => m.marketAddress).filter((addr) => addr !== '' && addr !== '0x0');
}

/** Result type for paginated contract calls */
type PaginatedResult = { addresses: unknown[]; hasMore: boolean };

/** Default empty result */
const EMPTY_PAGINATED_RESULT: PaginatedResult = { addresses: [], hasMore: false };

/**
 * Try parsing array tuple format: [addresses[], hasMore]
 * Returns null if format doesn't match
 */
function tryParseArrayTuple(result: unknown): PaginatedResult | null {
  if (!Array.isArray(result) || result.length !== 2) return null;

  const [first, second] = result;
  if (!Array.isArray(first) || typeof second !== 'boolean') return null;

  return { addresses: first, hasMore: second };
}

/**
 * Try parsing object with numeric keys: { 0: addresses[], 1: hasMore }
 * Returns null if format doesn't match
 */
function tryParseNumericKeys(obj: Record<string, unknown>): PaginatedResult | null {
  if (!('0' in obj) || !('1' in obj)) return null;

  const addresses = obj['0'];
  if (!Array.isArray(addresses)) return null;

  return { addresses, hasMore: Boolean(obj['1']) };
}

/**
 * Try parsing object with named keys: { addresses: [], has_more: boolean }
 * Handles variations: addresses/active_markets, has_more/hasMore
 * Returns null if format doesn't match
 */
function tryParseNamedKeys(obj: Record<string, unknown>): PaginatedResult | null {
  if (!('addresses' in obj) && !('active_markets' in obj)) return null;

  const addresses = (obj['addresses'] ?? obj['active_markets'] ?? obj['markets']) as unknown[];
  const hasMore = Boolean(obj['has_more'] ?? obj['hasMore'] ?? false);

  return { addresses: Array.isArray(addresses) ? addresses : [], hasMore };
}

/**
 * Parse paginated result from contract call
 * Handles different return formats from starknet.js
 */
function parsePaginatedResult(result: unknown): PaginatedResult {
  // Try array tuple format first
  const arrayResult = tryParseArrayTuple(result);
  if (arrayResult) return arrayResult;

  // Try object formats
  if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    return tryParseNumericKeys(obj) ?? tryParseNamedKeys(obj) ?? EMPTY_PAGINATED_RESULT;
  }

  logWarn('Unexpected result format in parsePaginatedResult', { module: 'useMarkets' });
  return EMPTY_PAGINATED_RESULT;
}

/**
 * Fetch all active market addresses using pagination
 * @see Security Audit L-04 - Gas Exhaustion Prevention
 */
async function fetchActiveMarketsPaginated(
  provider: ProviderInterface,
  network: NetworkId
): Promise<string[]> {
  const marketFactory = getMarketFactoryContract(provider, network);
  const allAddresses: string[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // Fetch a page of active markets
    const result = await marketFactory.get_active_markets_paginated(offset, MARKETS_PAGE_SIZE);

    // Parse the result (handles different starknet.js return formats)
    const parsed = parsePaginatedResult(result);

    const pageAddresses = parsed.addresses
      .map(toHexAddress)
      .filter(
        (addr) =>
          addr !== '0x0' &&
          addr !== '0x0000000000000000000000000000000000000000000000000000000000000000'
      );

    allAddresses.push(...pageAddresses);

    hasMore = parsed.hasMore;
    offset += MARKETS_PAGE_SIZE;

    // Safety limit to prevent infinite loops
    if (offset > 1000) {
      logWarn('Reached safety limit of 1000 markets', { module: 'useMarkets', offset });
      break;
    }
  }

  return allAddresses;
}

/**
 * Hook to fetch all active market addresses from the MarketFactory on-chain
 * Uses paginated fetching to prevent gas exhaustion with many markets
 * Falls back to static addresses from config if on-chain call fails or returns empty
 * @see Security Audit L-04 - Gas Exhaustion Prevention
 */
export function useMarketAddresses(): {
  addresses: string[];
  isLoading: boolean;
  isError: boolean;
} {
  const { provider, network } = useStarknet();
  const isClient = typeof window !== 'undefined';

  // Get static addresses as fallback
  const staticAddresses = getStaticMarketAddresses(network);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['marketFactory', 'activeMarketsPaginated', network],
    queryFn: async () => {
      try {
        const addresses = await fetchActiveMarketsPaginated(provider, network);

        // If on-chain returns empty, use static addresses as fallback
        if (addresses.length === 0 && staticAddresses.length > 0) {
          logWarn('On-chain returned empty, using static addresses', {
            module: 'useMarkets',
            staticCount: staticAddresses.length,
          });
          return staticAddresses;
        }

        return addresses;
      } catch (error) {
        logError(error, { module: 'useMarkets', action: 'useMarketAddresses' });
        // Return static addresses on error
        if (staticAddresses.length > 0) {
          logWarn('Using static addresses as fallback', {
            module: 'useMarkets',
            staticCount: staticAddresses.length,
          });
          return staticAddresses;
        }
        throw error;
      }
    },
    enabled: isClient,
    staleTime: 60000,
    retry: 2,
  });

  // Final fallback: if query failed and we have static addresses, use them
  const addresses = data ?? (isError ? staticAddresses : []);

  return {
    addresses,
    isLoading,
    isError: isError && staticAddresses.length === 0,
  };
}

/**
 * Fetch all market addresses (including expired) using pagination
 * @see Security Audit L-04 - Gas Exhaustion Prevention
 */
async function fetchAllMarketsPaginated(
  provider: ProviderInterface,
  network: NetworkId
): Promise<string[]> {
  const marketFactory = getMarketFactoryContract(provider, network);
  const allAddresses: string[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await marketFactory.get_markets_paginated(offset, MARKETS_PAGE_SIZE);

    // Parse the result (handles different starknet.js return formats)
    const parsed = parsePaginatedResult(result);

    const pageAddresses = parsed.addresses
      .map(toHexAddress)
      .filter(
        (addr) =>
          addr !== '0x0' &&
          addr !== '0x0000000000000000000000000000000000000000000000000000000000000000'
      );

    allAddresses.push(...pageAddresses);

    hasMore = parsed.hasMore;
    offset += MARKETS_PAGE_SIZE;

    if (offset > 1000) {
      logWarn('Reached safety limit of 1000 markets (all)', { module: 'useMarkets', offset });
      break;
    }
  }

  return allAddresses;
}

/**
 * Hook to fetch all market addresses (including expired) from MarketFactory
 * Uses paginated fetching to prevent gas exhaustion
 * @see Security Audit L-04 - Gas Exhaustion Prevention
 */
export function useAllMarketAddresses(): {
  addresses: string[];
  isLoading: boolean;
  isError: boolean;
} {
  const { provider, network } = useStarknet();
  const isClient = typeof window !== 'undefined';

  const staticAddresses = getStaticMarketAddresses(network);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['marketFactory', 'allMarketsPaginated', network],
    queryFn: async () => {
      try {
        const addresses = await fetchAllMarketsPaginated(provider, network);

        if (addresses.length === 0 && staticAddresses.length > 0) {
          return staticAddresses;
        }

        return addresses;
      } catch (error) {
        logError(error, { module: 'useMarkets', action: 'useAllMarketAddresses' });
        if (staticAddresses.length > 0) {
          return staticAddresses;
        }
        throw error;
      }
    },
    enabled: isClient,
    staleTime: 60000,
    retry: 2,
  });

  const addresses = data ?? (isError ? staticAddresses : []);

  return {
    addresses,
    isLoading,
    isError: isError && staticAddresses.length === 0,
  };
}

/**
 * Hook to get market count from MarketFactory
 */
export function useMarketCount(): {
  count: number;
  isLoading: boolean;
  isError: boolean;
} {
  const { provider, network } = useStarknet();
  const isClient = typeof window !== 'undefined';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['marketFactory', 'marketCount', network],
    queryFn: async () => {
      const marketFactory = getMarketFactoryContract(provider, network);
      const count = await marketFactory.get_market_count();
      return Number(count);
    },
    enabled: isClient,
    staleTime: 60000,
  });

  return {
    count: data ?? 0,
    isLoading,
    isError,
  };
}

/**
 * Hook to get known market addresses for the current network
 * Uses MarketFactory on-chain data, falls back to static config
 */
export function useKnownMarkets(): string[] {
  const { addresses } = useMarketAddresses();
  return addresses;
}

/**
 * Combined hook for dashboard that uses known markets from MarketFactory
 */
export function useDashboardMarkets(options: UseMarketsOptions = {}): UseMarketsReturn {
  const marketAddresses = useKnownMarkets();
  return useMarkets(marketAddresses, options);
}
