'use client';

import { useQuery, useQueries } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import { uint256, type ProviderInterface } from 'starknet';

import { getMarketInfoByAddress, getMarketInfos } from '@/lib/constants/addresses';
import { daysToExpiry, lnRateToApy } from '@/lib/math/yield';
import { getMarketContract, getMarketFactoryContract } from '@/lib/starknet/contracts';
import type { NetworkId } from '@/lib/starknet/provider';
import type { MarketData, MarketInfo, MarketState } from '@/types/market';

import { useStarknet } from './useStarknet';

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
    return '0x' + value.toString(16).padStart(64, '0');
  }
  return String(value);
}

async function fetchMarketData(
  marketAddress: string,
  provider: ProviderInterface,
  network: NetworkId
): Promise<MarketData> {
  const market = getMarketContract(marketAddress, provider);

  try {
    // Fetch all market data in parallel using typed contract calls
    const [syAddress, ptAddress, ytAddress, expiry, isExpiredVal, reserves, totalLpSupply, lnRate] =
      await Promise.all([
        market.sy(),
        market.pt(),
        market.yt(),
        market.expiry(),
        market.is_expired(),
        market.get_reserves(),
        market.total_lp_supply(),
        market.get_ln_implied_rate(),
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
    const state: MarketState = {
      syReserve: toBigInt(reservesArr[0] as bigint | { low: bigint; high: bigint }),
      ptReserve: toBigInt(reservesArr[1] as bigint | { low: bigint; high: bigint }),
      totalLpSupply: toBigInt(totalLpSupply as bigint | { low: bigint; high: bigint }),
      lnImpliedRate: toBigInt(lnRate as bigint | { low: bigint; high: bigint }),
    };

    const impliedApy = lnRateToApy(state.lnImpliedRate);
    const days = daysToExpiry(info.expiry);
    const tvlSy = state.syReserve + state.ptReserve;

    // Get token metadata from static config if available
    const staticInfo = getMarketInfoByAddress(network, marketAddress);

    const baseData = {
      ...info,
      state,
      impliedApy,
      tvlSy,
      daysToExpiry: days,
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
    console.error('[fetchMarketData] Error for market:', marketAddress, error);
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

/**
 * Hook to fetch all market addresses from the MarketFactory on-chain
 * Falls back to static addresses from config if on-chain call fails or returns empty
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
    queryKey: ['marketFactory', 'allMarkets', network],
    queryFn: async () => {
      try {
        const marketFactory = getMarketFactoryContract(provider, network);
        const result = await marketFactory.get_all_markets();

        // The result is an array of market addresses
        let addresses: string[];
        if (Array.isArray(result)) {
          addresses = result
            .map((addr: unknown) => {
              // Handle both string and bigint addresses
              if (typeof addr === 'bigint') {
                return '0x' + addr.toString(16).padStart(64, '0');
              }
              return String(addr);
            })
            .filter(
              (addr) =>
                addr !== '0x0' &&
                addr !== '0x0000000000000000000000000000000000000000000000000000000000000000'
            );
        } else {
          addresses = [];
        }

        // If on-chain returns empty, use static addresses as fallback
        if (addresses.length === 0 && staticAddresses.length > 0) {
          console.warn(
            '[useMarketAddresses] On-chain returned empty, using static addresses:',
            staticAddresses
          );
          return staticAddresses;
        }

        return addresses;
      } catch (error) {
        console.error('[useMarketAddresses] Error fetching from chain:', error);
        // Return static addresses on error
        if (staticAddresses.length > 0) {
          console.warn('[useMarketAddresses] Using static addresses as fallback:', staticAddresses);
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
