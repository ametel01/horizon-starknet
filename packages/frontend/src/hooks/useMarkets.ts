'use client';

import { useQueries } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import type { Contract, ProviderInterface } from 'starknet';

import { getTestSetup } from '@/lib/constants/addresses';
import { daysToExpiry, lnRateToApy } from '@/lib/math/yield';
import { getMarketContract } from '@/lib/starknet/contracts';
import type { MarketData, MarketInfo, MarketState } from '@/types/market';

import { useStarknet } from './useStarknet';

// Helper to call contract methods with proper typing
async function callContract<T>(contract: Contract, method: string): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const result = (await contract[method]()) as T;
  return result;
}

async function fetchMarketData(
  marketAddress: string,
  provider: ProviderInterface
): Promise<MarketData> {
  const market = getMarketContract(marketAddress, provider);

  // Fetch all market data in parallel
  const [syAddress, ptAddress, ytAddress, expiry, isExpiredVal, reserves, totalLpSupply, lnRate] =
    await Promise.all([
      callContract<bigint>(market, 'sy'),
      callContract<bigint>(market, 'pt'),
      callContract<bigint>(market, 'yt'),
      callContract<bigint>(market, 'expiry'),
      callContract<boolean>(market, 'is_expired'),
      callContract<{ sy_reserve: bigint; pt_reserve: bigint }>(market, 'get_reserves'),
      callContract<bigint>(market, 'total_lp_supply'),
      callContract<bigint>(market, 'get_ln_implied_rate'),
    ]);

  const info: MarketInfo = {
    address: marketAddress,
    syAddress: '0x' + syAddress.toString(16),
    ptAddress: '0x' + ptAddress.toString(16),
    ytAddress: '0x' + ytAddress.toString(16),
    expiry: Number(expiry),
    isExpired: isExpiredVal,
  };

  const state: MarketState = {
    syReserve: reserves.sy_reserve,
    ptReserve: reserves.pt_reserve,
    totalLpSupply,
    lnImpliedRate: lnRate,
  };

  const impliedApy = lnRateToApy(lnRate);
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

  const queries = useQueries({
    queries: marketAddresses.map((address) => ({
      queryKey: ['market', address],
      queryFn: () => fetchMarketData(address, provider),
      refetchInterval,
      staleTime: 10000,
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
