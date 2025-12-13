'use client';

import { useQueries } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import { uint256, type ProviderInterface } from 'starknet';

import { getTestSetup } from '@/lib/constants/addresses';
import { daysToExpiry, lnRateToApy } from '@/lib/math/yield';
import { getMarketContract } from '@/lib/starknet/contracts';
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

async function fetchMarketData(
  marketAddress: string,
  provider: ProviderInterface
): Promise<MarketData> {
  const market = getMarketContract(marketAddress, provider);

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
    syAddress,
    ptAddress,
    ytAddress,
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

  return {
    ...info,
    state,
    impliedApy,
    tvlSy,
    daysToExpiry: days,
  };
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
  const { provider } = useStarknet();
  const { refetchInterval = 30000 } = options;

  // Only run queries on client side to avoid SSR issues with localhost RPC
  const isClient = typeof window !== 'undefined';

  const queries = useQueries({
    queries: marketAddresses.map((address) => ({
      queryKey: ['market', address],
      queryFn: () => fetchMarketData(address, provider),
      refetchInterval,
      staleTime: 10000,
      enabled: isClient,
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
 * Hook to get known market addresses for the current network
 * For katana, returns the test market; for other networks, returns empty array
 */
export function useKnownMarkets(): string[] {
  const { network } = useStarknet();

  const testSetup = getTestSetup(network);

  if (testSetup) {
    return [testSetup.market];
  }

  // TODO: For mainnet/sepolia, fetch from indexer or registry
  return [];
}

/**
 * Combined hook for dashboard that uses known markets
 */
export function useDashboardMarkets(options: UseMarketsOptions = {}): UseMarketsReturn {
  const marketAddresses = useKnownMarkets();
  return useMarkets(marketAddresses, options);
}
