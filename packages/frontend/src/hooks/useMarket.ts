'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import type { Contract } from 'starknet';

import { daysToExpiry, lnRateToApy } from '@/lib/math/yield';
import { getMarketContract } from '@/lib/starknet/contracts';
import type { MarketData, MarketInfo, MarketState } from '@/types/market';

import { useStarknet } from './useStarknet';

interface UseMarketOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

// Helper to call contract methods with proper typing
async function callContract<T>(contract: Contract, method: string): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const result = (await contract[method]()) as T;
  return result;
}

// Type for tuple return from Cairo contracts
interface TupleResult {
  '0': bigint;
  '1': bigint;
}

export function useMarket(
  marketAddress: string | null,
  options: UseMarketOptions = {}
): UseQueryResult<MarketData> {
  const { provider } = useStarknet();
  const { enabled = true, refetchInterval = 30000 } = options;

  return useQuery({
    queryKey: ['market', marketAddress],
    queryFn: async (): Promise<MarketData> => {
      if (!marketAddress) {
        throw new Error('Market address is required');
      }

      const market = getMarketContract(marketAddress, provider);

      // Fetch all market data in parallel
      const [
        syAddress,
        ptAddress,
        ytAddress,
        expiry,
        isExpiredVal,
        reserves,
        totalLpSupply,
        lnRate,
      ] = await Promise.all([
        callContract<bigint>(market, 'sy'),
        callContract<bigint>(market, 'pt'),
        callContract<bigint>(market, 'yt'),
        callContract<bigint>(market, 'expiry'),
        callContract<boolean>(market, 'is_expired'),
        callContract<TupleResult>(market, 'get_reserves'),
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

      // Reserves are returned as a tuple { '0': sy_reserve, '1': pt_reserve }
      const state: MarketState = {
        syReserve: reserves['0'],
        ptReserve: reserves['1'],
        totalLpSupply,
        lnImpliedRate: lnRate,
      };

      // Compute derived values
      const impliedApy = lnRateToApy(lnRate);
      const days = daysToExpiry(info.expiry);

      // TVL = SY reserve (PT is also valued in SY terms)
      const tvlSy = state.syReserve + state.ptReserve;

      return {
        ...info,
        state,
        impliedApy,
        tvlSy,
        daysToExpiry: days,
      };
    },
    enabled: enabled && !!marketAddress,
    refetchInterval,
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

export function useMarketInfo(marketAddress: string | null): UseQueryResult<MarketInfo> {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['market-info', marketAddress],
    queryFn: async (): Promise<MarketInfo> => {
      if (!marketAddress) {
        throw new Error('Market address is required');
      }

      const market = getMarketContract(marketAddress, provider);

      const [syAddress, ptAddress, ytAddress, expiry, isExpiredVal] = await Promise.all([
        callContract<bigint>(market, 'sy'),
        callContract<bigint>(market, 'pt'),
        callContract<bigint>(market, 'yt'),
        callContract<bigint>(market, 'expiry'),
        callContract<boolean>(market, 'is_expired'),
      ]);

      return {
        address: marketAddress,
        syAddress: '0x' + syAddress.toString(16),
        ptAddress: '0x' + ptAddress.toString(16),
        ytAddress: '0x' + ytAddress.toString(16),
        expiry: Number(expiry),
        isExpired: isExpiredVal,
      };
    },
    enabled: !!marketAddress,
    staleTime: 60000, // Info rarely changes, cache for 1 minute
  });
}

export function useMarketState(
  marketAddress: string | null
): UseQueryResult<MarketState & { impliedApy: BigNumber }> {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['market-state', marketAddress],
    queryFn: async (): Promise<MarketState & { impliedApy: BigNumber }> => {
      if (!marketAddress) {
        throw new Error('Market address is required');
      }

      const market = getMarketContract(marketAddress, provider);

      const [reserves, totalLpSupply, lnRate] = await Promise.all([
        callContract<TupleResult>(market, 'get_reserves'),
        callContract<bigint>(market, 'total_lp_supply'),
        callContract<bigint>(market, 'get_ln_implied_rate'),
      ]);

      return {
        syReserve: reserves['0'],
        ptReserve: reserves['1'],
        totalLpSupply,
        lnImpliedRate: lnRate,
        impliedApy: lnRateToApy(lnRate),
      };
    },
    enabled: !!marketAddress,
    refetchInterval: 15000, // State changes more frequently
    staleTime: 5000,
  });
}
