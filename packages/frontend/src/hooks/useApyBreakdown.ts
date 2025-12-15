'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { uint256 } from 'starknet';

import { calculateApyBreakdown } from '@/lib/math/apy-breakdown';
import { WAD_BIGINT } from '@/lib/math/wad';
import { getSYContract } from '@/lib/starknet/contracts';
import type { MarketApyBreakdown, SyRateData } from '@/types/apy';
import type { MarketData } from '@/types/market';

import { useStarknet } from './useStarknet';

// Helper to convert Uint256 or bigint to bigint
function toBigInt(value: bigint | { low: bigint; high: bigint }): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  return uint256.uint256ToBN(value);
}

interface UseApyBreakdownOptions {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Refetch interval in ms */
  refetchInterval?: number;
}

/**
 * Hook to fetch SY exchange rate data for underlying yield calculation
 */
export function useSyRateData(
  syAddress: string | null,
  options: UseApyBreakdownOptions = {}
): UseQueryResult<SyRateData> {
  const { provider } = useStarknet();
  const { enabled = true, refetchInterval = 60000 } = options;

  return useQuery({
    queryKey: ['sy-rate', syAddress],
    queryFn: async (): Promise<SyRateData> => {
      if (!syAddress) {
        throw new Error('SY address is required');
      }

      const sy = getSYContract(syAddress, provider);

      // Get current exchange rate
      const exchangeRate = await sy.exchange_rate();
      const currentRate = toBigInt(exchangeRate as bigint | { low: bigint; high: bigint });

      // For now, we estimate previous rate
      // In a full implementation, this would come from:
      // 1. On-chain oracle/TWAP
      // 2. Indexer/subgraph historical data
      // 3. Cached previous readings
      //
      // We use a conservative estimate: assume ~5% APY underlying
      // This means rate increased by ~0.014% per day
      const estimatedDailyGrowth = WAD_BIGINT / 7300n; // ~0.0137% daily for 5% APY
      const previousRate = (currentRate * WAD_BIGINT) / (WAD_BIGINT + estimatedDailyGrowth);

      return {
        currentRate,
        previousRate,
        timeDelta: 86400, // 1 day
        timestamp: Math.floor(Date.now() / 1000),
      };
    },
    enabled: enabled && !!syAddress,
    refetchInterval,
    staleTime: 30000,
    structuralSharing: false,
  });
}

/**
 * Hook to calculate APY breakdown for a market
 *
 * Combines market state with underlying yield data to provide
 * comprehensive APY breakdown for PT, YT, and LP positions.
 */
export function useApyBreakdown(
  market: MarketData | null | undefined,
  options: UseApyBreakdownOptions = {}
): {
  data: MarketApyBreakdown | null;
  isLoading: boolean;
  isError: boolean;
} {
  const { enabled = true } = options;

  // Fetch SY rate data for underlying yield calculation
  const {
    data: syRateData,
    isLoading: isLoadingSyRate,
    isError: isErrorSyRate,
  } = useSyRateData(market?.syAddress ?? null, {
    ...options,
    enabled: enabled && !!market,
  });

  // Calculate APY breakdown when we have all data
  const breakdown = useMemo((): MarketApyBreakdown | null => {
    if (!market) {
      return null;
    }

    // Use fetched SY rate data or defaults
    const currentRate = syRateData?.currentRate ?? WAD_BIGINT;
    const previousRate = syRateData?.previousRate ?? WAD_BIGINT;
    const rateTimeDelta = syRateData?.timeDelta ?? 86400;

    // For volume, we'd need an indexer or subgraph
    // For now, estimate based on reserves (placeholder)
    // Assume ~0.5% daily volume relative to TVL
    const estimatedDailyVolume = (market.state.syReserve + market.state.ptReserve) / 200n;

    // Get fee rate (default to 0.3% if not available)
    const feeRate = 3_000_000_000_000_000n; // 0.3% in WAD

    return calculateApyBreakdown({
      syReserve: market.state.syReserve,
      ptReserve: market.state.ptReserve,
      lnImpliedRate: market.state.lnImpliedRate,
      expiry: BigInt(market.expiry),
      syExchangeRate: currentRate,
      previousExchangeRate: previousRate,
      rateTimeDelta,
      swapVolume24h: estimatedDailyVolume,
      feeRate,
      lpFeeShare: 0.2, // 20% of fees to LPs
    });
  }, [market, syRateData]);

  return {
    data: breakdown,
    isLoading: isLoadingSyRate,
    isError: isErrorSyRate,
  };
}

/**
 * Hook to get APY breakdown for multiple markets
 */
export function useMarketsApyBreakdown(
  markets: MarketData[],
  _options: UseApyBreakdownOptions = {}
): Map<string, MarketApyBreakdown> {
  // For now, calculate breakdown synchronously for each market
  // In the future, this could batch SY rate fetches

  return useMemo(() => {
    const breakdowns = new Map<string, MarketApyBreakdown>();

    for (const market of markets) {
      const breakdown = calculateApyBreakdown({
        syReserve: market.state.syReserve,
        ptReserve: market.state.ptReserve,
        lnImpliedRate: market.state.lnImpliedRate,
        expiry: BigInt(market.expiry),
        // Use defaults for now - full implementation would batch fetch rates
        syExchangeRate: WAD_BIGINT,
        previousExchangeRate: WAD_BIGINT,
        rateTimeDelta: 86400,
        swapVolume24h: (market.state.syReserve + market.state.ptReserve) / 200n,
        feeRate: 3_000_000_000_000_000n,
        lpFeeShare: 0.2,
      });

      breakdowns.set(market.address, breakdown);
    }

    return breakdowns;
  }, [markets]);
}
