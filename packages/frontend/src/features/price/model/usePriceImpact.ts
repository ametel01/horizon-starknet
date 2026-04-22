'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';

/**
 * Impact statistics by trade size bucket
 */
export interface ImpactBucket {
  range: string;
  minSize: string;
  maxSize: string;
  count: number;
  avgImpact: number;
  minImpact: number;
  maxImpact: number;
}

/**
 * Impact distribution for histogram
 */
export interface ImpactDistribution {
  bucket: string;
  count: number;
  percentage: number;
}

/**
 * Recent swap with impact data
 */
export interface RecentImpact {
  timestamp: string;
  impact: number;
  tradeSize: string;
  direction: 'buy_pt' | 'sell_pt';
}

/**
 * Price impact response from API
 */
export interface PriceImpactData {
  market: string;
  totalSwaps: number;
  avgImpact: number;
  medianImpact: number;
  maxImpact: number;
  impactBySize: ImpactBucket[];
  impactDistribution: ImpactDistribution[];
  recentImpacts: RecentImpact[];
}

/**
 * Fetch price impact data from API
 */
async function fetchPriceImpact(marketAddress: string, days: number): Promise<PriceImpactData> {
  const params = new URLSearchParams({
    days: String(days),
  });

  const response = await fetch(`/api/markets/${marketAddress}/price-impact?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch price impact: ${String(response.status)}`);
  }

  return response.json() as Promise<PriceImpactData>;
}

interface UsePriceImpactOptions {
  /** Lookback period in days (default: 30) */
  days?: number | undefined;
  /** Whether to enable the query */
  enabled?: boolean | undefined;
  /** Refetch interval in milliseconds */
  refetchInterval?: number | undefined;
}

/**
 * Hook to fetch price impact statistics for a market
 *
 * @param marketAddress - The market contract address
 * @param options - Query options
 * @returns Price impact statistics
 *
 * @example
 * ```tsx
 * const { data, isLoading } = usePriceImpact(marketAddress, { days: 30 });
 * console.log(data?.avgImpact); // Average price impact %
 * ```
 */
export function usePriceImpact(
  marketAddress: string | undefined,
  options: UsePriceImpactOptions = {}
): UseQueryResult<PriceImpactData> {
  const { days = 30, enabled = true, refetchInterval = 60000 } = options;

  return useQuery({
    queryKey: ['price-impact', marketAddress, days],
    queryFn: () => {
      if (!marketAddress) throw new Error('Market address required');
      return fetchPriceImpact(marketAddress, days);
    },
    enabled: enabled && !!marketAddress,
    staleTime: 30000,
    refetchInterval,
    retry: 2,
    retryDelay: 5000,
  });
}

/**
 * Helper to estimate impact for a given trade size based on historical data
 */
export function estimateImpact(tradeSize: bigint, impactBySize: ImpactBucket[]): number | null {
  for (const bucket of impactBySize) {
    const min = BigInt(bucket.minSize);
    const max = BigInt(bucket.maxSize);

    if (tradeSize >= min && tradeSize < max && bucket.count > 0) {
      return bucket.avgImpact;
    }
  }

  return null;
}
