'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';

/**
 * Volume data point from the API
 */
export interface VolumeDataPoint {
  date: string;
  syVolume: string;
  ptVolume: string;
  swapCount: number;
  uniqueSwappers: number;
}

/**
 * Response from /api/analytics/volume
 */
export interface VolumeResponse {
  total24h: {
    syVolume: string;
    ptVolume: string;
    swapCount: number;
    uniqueSwappers: number;
  };
  total7d: {
    syVolume: string;
    ptVolume: string;
    swapCount: number;
  };
  history: VolumeDataPoint[];
}

/**
 * Processed volume data for display
 */
export interface ProcessedVolumeData {
  total24h: {
    syVolume: bigint;
    ptVolume: bigint;
    totalVolume: bigint;
    swapCount: number;
    uniqueSwappers: number;
  };
  total7d: {
    syVolume: bigint;
    ptVolume: bigint;
    totalVolume: bigint;
    swapCount: number;
  };
  total30d: {
    syVolume: bigint;
    ptVolume: bigint;
    totalVolume: bigint;
    swapCount: number;
  };
  history: {
    date: string;
    displayDate: string;
    syVolume: bigint;
    ptVolume: bigint;
    totalVolume: bigint;
    swapCount: number;
    uniqueSwappers: number;
  }[];
}

/**
 * Fetch volume data from the API
 */
async function fetchVolumeData(days: number): Promise<VolumeResponse> {
  const response = await fetch(`/api/analytics/volume?days=${String(days)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch volume data: ${String(response.status)}`);
  }

  return response.json() as Promise<VolumeResponse>;
}

/**
 * Process raw volume response into usable format
 */
function processVolumeData(data: VolumeResponse): ProcessedVolumeData {
  // Calculate 30d totals from history
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let syVolume30d = BigInt(0);
  let ptVolume30d = BigInt(0);
  let swapCount30d = 0;

  const processedHistory = data.history.map((point) => {
    const date = new Date(point.date);
    const syVol = BigInt(point.syVolume);
    const ptVol = BigInt(point.ptVolume);

    // Accumulate 30d totals
    if (date >= thirtyDaysAgo) {
      syVolume30d += syVol;
      ptVolume30d += ptVol;
      swapCount30d += point.swapCount;
    }

    return {
      date: point.date,
      displayDate: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      syVolume: syVol,
      ptVolume: ptVol,
      totalVolume: syVol + ptVol,
      swapCount: point.swapCount,
      uniqueSwappers: point.uniqueSwappers,
    };
  });

  const syVolume24h = BigInt(data.total24h.syVolume);
  const ptVolume24h = BigInt(data.total24h.ptVolume);
  const syVolume7d = BigInt(data.total7d.syVolume);
  const ptVolume7d = BigInt(data.total7d.ptVolume);

  return {
    total24h: {
      syVolume: syVolume24h,
      ptVolume: ptVolume24h,
      totalVolume: syVolume24h + ptVolume24h,
      swapCount: data.total24h.swapCount,
      uniqueSwappers: data.total24h.uniqueSwappers,
    },
    total7d: {
      syVolume: syVolume7d,
      ptVolume: ptVolume7d,
      totalVolume: syVolume7d + ptVolume7d,
      swapCount: data.total7d.swapCount,
    },
    total30d: {
      syVolume: syVolume30d,
      ptVolume: ptVolume30d,
      totalVolume: syVolume30d + ptVolume30d,
      swapCount: swapCount30d,
    },
    history: processedHistory,
  };
}

interface UseProtocolVolumeOptions {
  days?: number;
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Hook to fetch protocol volume metrics
 *
 * @param options - Query options
 * @returns Processed volume data with totals and history
 */
export function useProtocolVolume(
  options: UseProtocolVolumeOptions = {}
): UseQueryResult<ProcessedVolumeData> {
  const { days = 30, enabled = true, refetchInterval = 60000 } = options;

  return useQuery({
    queryKey: ['protocol-volume', days],
    queryFn: async () => {
      const data = await fetchVolumeData(days);
      return processVolumeData(data);
    },
    enabled,
    staleTime: 30000,
    refetchInterval,
    retry: 2,
    retryDelay: 5000,
  });
}
