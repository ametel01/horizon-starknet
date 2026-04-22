'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';

/**
 * A single negative yield detection event.
 */
export interface NegativeYieldEvent {
  id: string;
  sy: string;
  underlying: string;
  watermarkRate: string;
  currentRate: string;
  rateDropBps: string;
  eventTimestamp: number;
  blockTimestamp: string;
  transactionHash: string;
}

/**
 * Aggregated negative yield alert summary.
 */
export interface NegativeYieldSummary {
  sy: string;
  underlying: string;
  eventCount: number;
  maxDropBps: string;
  lastDetectedAt: string;
}

/**
 * Response from the negative yield API endpoint.
 */
export interface NegativeYieldResponse {
  sy: string;
  summary: NegativeYieldSummary | null;
  events: NegativeYieldEvent[];
}

/**
 * Fetch negative yield events for an SY contract from the indexed API.
 */
async function fetchNegativeYield(syAddress: string): Promise<NegativeYieldResponse> {
  const response = await fetch(`/api/sy/${syAddress}/negative-yield`);
  if (!response.ok) {
    throw new Error('Failed to fetch negative yield data');
  }
  return response.json() as Promise<NegativeYieldResponse>;
}

/**
 * Hook to fetch negative yield alerts for an SY contract from indexed data.
 *
 * Negative yield occurs when the underlying asset's exchange rate drops
 * below its historical watermark (highest rate ever seen). This indicates
 * the yield-bearing asset has experienced a loss.
 *
 * The indexed data provides historical events plus an aggregated summary
 * with the maximum drop observed and total event count.
 *
 * @param syAddress - The SY contract address
 * @returns Query result with negative yield events and summary
 *
 * @example
 * ```typescript
 * const { data, isLoading } = useNegativeYieldAlerts(syAddress);
 *
 * if (data?.summary) {
 *   console.log(`${data.summary.eventCount} negative yield events detected`);
 *   console.log(`Max drop: ${data.summary.maxDropBps} bps`);
 * }
 * ```
 */
export function useNegativeYieldAlerts(
  syAddress: string | undefined
): UseQueryResult<NegativeYieldResponse> {
  return useQuery({
    queryKey: ['sy', 'negative-yield', syAddress],
    queryFn: async () => {
      if (!syAddress) throw new Error('syAddress is required');
      return fetchNegativeYield(syAddress);
    },
    enabled: !!syAddress,
    staleTime: 60_000, // 1 minute - event data is historical
  });
}

/**
 * Convenience hook to check if an SY has any negative yield history.
 *
 * @param syAddress - The SY contract address
 * @returns Whether negative yield has been detected (false if unknown)
 */
export function useHasNegativeYieldHistory(syAddress: string | undefined): boolean {
  const { data } = useNegativeYieldAlerts(syAddress);
  return data?.summary !== null && (data?.summary?.eventCount ?? 0) > 0;
}
