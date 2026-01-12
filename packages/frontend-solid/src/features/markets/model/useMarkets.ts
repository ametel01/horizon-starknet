import {
  getAddresses,
  getMarketInfoByAddress,
  getMarketInfos,
  type MarketInfo as ConfigMarketInfo,
} from '@shared/config/addresses';
import { TWAP_DEFAULT_DURATION, TWAP_DURATIONS } from '@shared/config/twap';
import { calculateAnnualFeeRate } from '@shared/lib/fees';
import { daysToExpiry, lnRateToApy } from '@shared/math/yield';
import { logError, logWarn } from '@shared/server/logger';
import {
  getMarketContract,
  getMarketFactoryContract,
  getPyLpOracleContract,
} from '@shared/starknet/contracts';
import type { NetworkId } from '@shared/starknet/provider';
import { createQuery } from '@tanstack/solid-query';
import BigNumber from 'bignumber.js';
import { createMemo, type Accessor } from 'solid-js';
import { type ProviderInterface, uint256 } from 'starknet';

import { useStarknet } from '@/features/wallet';

/**
 * Page size for paginated market fetching
 * @see Security Audit L-04 - Gas Exhaustion Prevention
 */
const MARKETS_PAGE_SIZE = 20;

// Helper to convert Uint256 or bigint to bigint
function toBigInt(value: bigint | { low: bigint; high: bigint }): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  // Handle Uint256 struct
  return uint256.uint256ToBN(value);
}

// Helper to convert address (bigint or string) to hex string
function toHexAddress(value: unknown): string {
  if (typeof value === 'bigint') {
    return `0x${value.toString(16).padStart(64, '0')}`;
  }
  return String(value);
}

export interface MarketInfo {
  address: string;
  syAddress: string;
  ptAddress: string;
  ytAddress: string;
  expiry: number;
  isExpired: boolean;
}

export interface MarketState {
  syReserve: bigint;
  ptReserve: bigint;
  totalLpSupply: bigint;
  lnImpliedRate: bigint;
  /** Total protocol fees collected (in SY) @see Security Audit I-07 */
  feesCollected: bigint;
  /** Natural log of fee rate root in WAD (10^18). Use calculateAnnualFeeRate() to convert. */
  lnFeeRateRoot: bigint;
  /** Percentage (0-100) of fees going to protocol treasury. Remainder goes to LPs. */
  reserveFeePercent: number;
}

// Token metadata for display
export interface MarketTokenMetadata {
  key: string;
  underlyingAddress: string;
  yieldTokenName: string;
  yieldTokenSymbol: string;
  isERC4626: boolean;
  initialAnchor?: bigint;
}

export interface MarketData extends MarketInfo {
  state: MarketState;
  // Computed values
  impliedApy: BigNumber;
  tvlSy: bigint;
  daysToExpiry: number;
  /** Annual fee rate as a decimal (e.g., 0.01 = 1%). Computed from lnFeeRateRoot. */
  annualFeeRate: number;
  // Token metadata (optional, may not be available for unknown markets)
  metadata?: MarketTokenMetadata;
  // TWAP oracle fields
  /** TWAP-based implied APY (primary display), falls back to spot if unavailable */
  twapImpliedApy: BigNumber;
  /** Spot implied APY (secondary display, always available) */
  spotImpliedApy: BigNumber;
  /** Oracle status for this market */
  oracleState: 'ready' | 'partial' | 'spot-only';
  /** TWAP duration used (seconds), 0 if spot-only */
  twapDuration: number;
}

async function fetchMarketData(
  marketAddress: string,
  provider: ProviderInterface,
  network: NetworkId
): Promise<MarketData> {
  const market = getMarketContract(marketAddress, provider);
  const addresses = getAddresses(network);

  try {
    // Fetch all market data in parallel using typed contract calls
    const [
      syAddress,
      ptAddress,
      ytAddress,
      expiry,
      isExpiredVal,
      reserves,
      totalLpSupply,
      lnRate,
      feesCollected,
      lnFeeRateRoot,
      reserveFeePercent,
    ] = await Promise.all([
      market.sy(),
      market.pt(),
      market.yt(),
      market.expiry(),
      market.is_expired(),
      market.get_reserves(),
      market.total_lp_supply(),
      market.get_ln_implied_rate(),
      market.get_total_fees_collected(),
      market.get_ln_fee_rate_root(),
      market.get_reserve_fee_percent(),
    ]);

    const info: MarketInfo = {
      address: marketAddress,
      syAddress: toHexAddress(syAddress),
      ptAddress: toHexAddress(ptAddress),
      ytAddress: toHexAddress(ytAddress),
      expiry: Number(expiry),
      isExpired: isExpiredVal,
    };

    // Reserves are returned as a tuple [sy_reserve, pt_reserve]
    const reservesArr = reserves as unknown[];
    const lnFeeRateRootValue = toBigInt(lnFeeRateRoot as bigint | { low: bigint; high: bigint });
    const state: MarketState = {
      syReserve: toBigInt(reservesArr[0] as bigint | { low: bigint; high: bigint }),
      ptReserve: toBigInt(reservesArr[1] as bigint | { low: bigint; high: bigint }),
      totalLpSupply: toBigInt(totalLpSupply as bigint | { low: bigint; high: bigint }),
      lnImpliedRate: toBigInt(lnRate as bigint | { low: bigint; high: bigint }),
      feesCollected: toBigInt(feesCollected as bigint | { low: bigint; high: bigint }),
      lnFeeRateRoot: lnFeeRateRootValue,
      reserveFeePercent: Number(reserveFeePercent),
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

export interface UseMarketsOptions {
  refetchInterval?: number;
}

export interface UseMarketsReturn {
  markets: Accessor<MarketData[]>;
  isLoading: Accessor<boolean>;
  isError: Accessor<boolean>;
  totalTvl: Accessor<bigint>;
  avgApy: Accessor<BigNumber>;
}

/**
 * Query key factory for market queries - ensures reactive updates
 */
export const marketKeys = {
  all: ['markets'] as const,
  list: (network: NetworkId) => [...marketKeys.all, 'list', network] as const,
  detail: (address: string, network: NetworkId) =>
    [...marketKeys.all, 'detail', address, network] as const,
  addresses: (network: NetworkId) => [...marketKeys.all, 'addresses', network] as const,
  activeAddresses: (network: NetworkId) =>
    [...marketKeys.all, 'activeAddresses', network] as const,
  count: (network: NetworkId) => [...marketKeys.all, 'count', network] as const,
};

/**
 * Hook to fetch market data for a list of addresses.
 * Uses @tanstack/solid-query for caching and background updates.
 */
export function useMarkets(
  marketAddresses: Accessor<string[]>,
  options: UseMarketsOptions = {}
): UseMarketsReturn {
  const { provider, network } = useStarknet();
  const { refetchInterval = 30000 } = options;

  // Create a single query that fetches all markets in parallel
  const query = createQuery(() => ({
    queryKey: marketKeys.list(network),
    queryFn: async () => {
      const addresses = marketAddresses();
      if (addresses.length === 0) {
        return [];
      }

      // Fetch all markets in parallel
      const results = await Promise.allSettled(
        addresses
          .filter((addr) => addr !== '0x0')
          .map((address) => fetchMarketData(address, provider, network))
      );

      // Filter successful results
      return results
        .filter((r): r is PromiseFulfilledResult<MarketData> => r.status === 'fulfilled')
        .map((r) => r.value);
    },
    refetchInterval,
    staleTime: 10000,
    enabled: marketAddresses().length > 0,
    // Disable structural sharing to prevent BigInt serialization issues
    structuralSharing: false,
  }));

  const markets = createMemo(() => query.data ?? []);
  const isLoading = createMemo(() => query.isLoading);
  const isError = createMemo(() => query.isError);

  // Calculate totals
  const totalTvl = createMemo(() => {
    const data = markets();
    return data.reduce((sum, m) => sum + m.tvlSy, BigInt(0));
  });

  const avgApy = createMemo(() => {
    const data = markets();
    if (data.length === 0) {
      return new BigNumber(0);
    }
    return data.reduce((sum, m) => sum.plus(m.impliedApy), new BigNumber(0)).dividedBy(data.length);
  });

  return {
    markets,
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
 * Convert address value to hex string
 */
function addressToHex(addr: unknown): string {
  if (typeof addr === 'bigint') {
    return `0x${addr.toString(16).padStart(64, '0')}`;
  }
  if (typeof addr === 'string') {
    return addr;
  }
  return String(addr);
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
      .map(addressToHex)
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
  addresses: Accessor<string[]>;
  isLoading: Accessor<boolean>;
  isError: Accessor<boolean>;
} {
  const { provider, network } = useStarknet();

  // Get static addresses as fallback - reactive to network changes
  const staticAddresses = createMemo(() => getStaticMarketAddresses(network));

  const query = createQuery(() => ({
    queryKey: marketKeys.activeAddresses(network),
    queryFn: async () => {
      try {
        const addresses = await fetchActiveMarketsPaginated(provider, network);

        // If on-chain returns empty, use static addresses as fallback
        if (addresses.length === 0 && staticAddresses().length > 0) {
          logWarn('On-chain returned empty, using static addresses', {
            module: 'useMarkets',
            staticCount: staticAddresses().length,
          });
          return staticAddresses();
        }

        return addresses;
      } catch (error) {
        logError(error, { module: 'useMarkets', action: 'useMarketAddresses' });
        // Return static addresses on error
        if (staticAddresses().length > 0) {
          logWarn('Using static addresses as fallback', {
            module: 'useMarkets',
            staticCount: staticAddresses().length,
          });
          return staticAddresses();
        }
        throw error;
      }
    },
    staleTime: 60000,
    retry: 2,
  }));

  // Final fallback: if query failed and we have static addresses, use them
  const addresses = createMemo(() => query.data ?? (query.isError ? staticAddresses() : []));

  return {
    addresses,
    isLoading: createMemo(() => query.isLoading),
    isError: createMemo(() => query.isError && staticAddresses().length === 0),
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
      .map(addressToHex)
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
  addresses: Accessor<string[]>;
  isLoading: Accessor<boolean>;
  isError: Accessor<boolean>;
} {
  const { provider, network } = useStarknet();

  const staticAddresses = createMemo(() => getStaticMarketAddresses(network));

  const query = createQuery(() => ({
    queryKey: marketKeys.addresses(network),
    queryFn: async () => {
      try {
        const addresses = await fetchAllMarketsPaginated(provider, network);

        if (addresses.length === 0 && staticAddresses().length > 0) {
          return staticAddresses();
        }

        return addresses;
      } catch (error) {
        logError(error, { module: 'useMarkets', action: 'useAllMarketAddresses' });
        if (staticAddresses().length > 0) {
          return staticAddresses();
        }
        throw error;
      }
    },
    staleTime: 60000,
    retry: 2,
  }));

  const addresses = createMemo(() => query.data ?? (query.isError ? staticAddresses() : []));

  return {
    addresses,
    isLoading: createMemo(() => query.isLoading),
    isError: createMemo(() => query.isError && staticAddresses().length === 0),
  };
}

/**
 * Hook to get market count from MarketFactory
 */
export function useMarketCount(): {
  count: Accessor<number>;
  isLoading: Accessor<boolean>;
  isError: Accessor<boolean>;
} {
  const { provider, network } = useStarknet();

  const query = createQuery(() => ({
    queryKey: marketKeys.count(network),
    queryFn: async () => {
      const marketFactory = getMarketFactoryContract(provider, network);
      const count = await marketFactory.get_market_count();
      return Number(count);
    },
    staleTime: 60000,
  }));

  return {
    count: createMemo(() => query.data ?? 0),
    isLoading: createMemo(() => query.isLoading),
    isError: createMemo(() => query.isError),
  };
}

/**
 * Hook to get known market addresses for the current network
 * Uses MarketFactory on-chain data, falls back to static config
 */
export function useKnownMarkets(): Accessor<string[]> {
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
