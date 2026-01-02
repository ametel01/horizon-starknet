'use client';

import type { MarketData, MarketInfo, MarketState } from '@entities/market';
import { useStarknet } from '@features/wallet';
import { daysToExpiry, lnRateToApy } from '@shared/math/yield';
import { getMarketContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type BigNumber from 'bignumber.js';
import { uint256 } from 'starknet';

interface UseMarketOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

// Helper to convert Uint256 or bigint to bigint
function toBigInt(value: bigint | { low: bigint; high: bigint }): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  // Handle Uint256 struct
  return uint256.uint256ToBN(value);
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
      // Handle both array and Uint256 return types
      const reservesArr = reserves as unknown[];
      const state: MarketState = {
        syReserve: toBigInt(reservesArr[0] as bigint | { low: bigint; high: bigint }),
        ptReserve: toBigInt(reservesArr[1] as bigint | { low: bigint; high: bigint }),
        totalLpSupply: toBigInt(totalLpSupply as bigint | { low: bigint; high: bigint }),
        lnImpliedRate: toBigInt(lnRate as bigint | { low: bigint; high: bigint }),
        feesCollected: toBigInt(feesCollected as bigint | { low: bigint; high: bigint }),
      };

      // Compute derived values
      const impliedApy = lnRateToApy(state.lnImpliedRate);
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
    // Disable structural sharing to prevent BigInt serialization issues
    structuralSharing: false,
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
        market.sy(),
        market.pt(),
        market.yt(),
        market.expiry(),
        market.is_expired(),
      ]);

      return {
        address: marketAddress,
        syAddress,
        ptAddress,
        ytAddress,
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

      const [reserves, totalLpSupply, lnRate, feesCollected] = await Promise.all([
        market.get_reserves(),
        market.total_lp_supply(),
        market.get_ln_implied_rate(),
        market.get_total_fees_collected(),
      ]);

      const reservesArr = reserves as unknown[];
      const lnImpliedRate = toBigInt(lnRate as bigint | { low: bigint; high: bigint });

      return {
        syReserve: toBigInt(reservesArr[0] as bigint | { low: bigint; high: bigint }),
        ptReserve: toBigInt(reservesArr[1] as bigint | { low: bigint; high: bigint }),
        totalLpSupply: toBigInt(totalLpSupply as bigint | { low: bigint; high: bigint }),
        lnImpliedRate,
        feesCollected: toBigInt(feesCollected as bigint | { low: bigint; high: bigint }),
        impliedApy: lnRateToApy(lnImpliedRate),
      };
    },
    enabled: !!marketAddress,
    refetchInterval: 15000, // State changes more frequently
    staleTime: 5000,
    // Disable structural sharing to prevent BigInt serialization issues
    structuralSharing: false,
  });
}
