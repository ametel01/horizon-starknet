'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '@shared/api';
import type { RatesResponse, SwapEvent, SwapsResponse, TvlResponse } from '@shared/api/types';

// ============================================================================
// Market Swaps Hook
// ============================================================================

interface UseMarketSwapsOptions {
  /** Max results per page (default: 50, max: 100) */
  limit?: number;
  /** Filter swaps after this date (ISO string) */
  since?: string;
  /** Refetch interval in milliseconds (default: 30000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface UseMarketSwapsReturn {
  swaps: SwapEvent[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  hasMore: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
}

/**
 * Hook to fetch paginated swap history for a market
 *
 * @example
 * ```tsx
 * const { swaps, hasMore, fetchNextPage } = useMarketSwaps(marketAddress);
 * ```
 */
export function useMarketSwaps(
  marketAddress: string | undefined,
  options: UseMarketSwapsOptions = {}
): UseMarketSwapsReturn {
  const { limit = 50, since, refetchInterval = 30000, enabled = true } = options;

  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['indexer', 'market', marketAddress, 'swaps', { limit, since }],
      queryFn: async ({ pageParam }) => {
        if (!marketAddress) throw new Error('Market address is required');
        return api.get<SwapsResponse>(`/markets/${marketAddress}/swaps`, {
          limit,
          offset: pageParam,
          since,
        });
      },
      getNextPageParam: (lastPage, allPages) => {
        if (!lastPage.hasMore) return undefined;
        return allPages.reduce((sum, page) => sum + page.swaps.length, 0);
      },
      initialPageParam: 0,
      refetchInterval,
      enabled: enabled && !!marketAddress,
      staleTime: 10000,
    });

  // Flatten all pages into a single array
  const swaps = data?.pages.flatMap((page) => page.swaps) ?? [];

  return {
    swaps,
    isLoading,
    isError,
    error,
    hasMore: hasNextPage,
    fetchNextPage: () => void fetchNextPage(),
    isFetchingNextPage,
  };
}

// ============================================================================
// Market TVL History Hook
// ============================================================================

interface UseMarketTvlHistoryOptions {
  /** Number of days of history (default: 30, max: 365) */
  days?: number;
  /** Refetch interval in milliseconds (default: 60000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface TvlDataPoint {
  date: string;
  syReserve: bigint;
  ptReserve: bigint;
  totalTvl: bigint;
}

interface UseMarketTvlHistoryReturn {
  history: TvlDataPoint[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Hook to fetch TVL history for a market
 *
 * @example
 * ```tsx
 * const { history, isLoading } = useMarketTvlHistory(marketAddress, { days: 7 });
 * ```
 */
export function useMarketTvlHistory(
  marketAddress: string | undefined,
  options: UseMarketTvlHistoryOptions = {}
): UseMarketTvlHistoryReturn {
  const { days = 30, refetchInterval = 60000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'market', marketAddress, 'tvl', { days }],
    queryFn: () => {
      if (!marketAddress) throw new Error('Market address is required');
      return api.get<TvlResponse>(`/markets/${marketAddress}/tvl`, { days });
    },
    refetchInterval,
    enabled: enabled && !!marketAddress,
    staleTime: 30000,
  });

  // Convert string values to bigint
  const history: TvlDataPoint[] =
    data?.history.map((point) => ({
      date: point.date,
      syReserve: BigInt(point.syReserve),
      ptReserve: BigInt(point.ptReserve),
      totalTvl: BigInt(point.syReserve) + BigInt(point.ptReserve),
    })) ?? [];

  return {
    history,
    isLoading,
    isError,
    error,
  };
}

// ============================================================================
// Market Rate History Hook
// ============================================================================

interface UseMarketRateHistoryOptions {
  /** Number of days of history (default: 30, max: 365) */
  days?: number;
  /** Refetch interval in milliseconds (default: 60000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface RateDataPoint {
  date: string;
  impliedRate: bigint;
  exchangeRate: bigint;
  lnImpliedRate: bigint;
}

interface UseMarketRateHistoryReturn {
  history: RateDataPoint[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Hook to fetch implied rate and exchange rate history for a market
 *
 * @example
 * ```tsx
 * const { history, isLoading } = useMarketRateHistory(marketAddress, { days: 7 });
 * ```
 */
export function useMarketRateHistory(
  marketAddress: string | undefined,
  options: UseMarketRateHistoryOptions = {}
): UseMarketRateHistoryReturn {
  const { days = 30, refetchInterval = 60000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'market', marketAddress, 'rates', { days }],
    queryFn: () => {
      if (!marketAddress) throw new Error('Market address is required');
      return api.get<RatesResponse>(`/markets/${marketAddress}/rates`, { days });
    },
    refetchInterval,
    enabled: enabled && !!marketAddress,
    staleTime: 30000,
  });

  // Convert string values to bigint
  const history: RateDataPoint[] =
    data?.history.map((point) => ({
      date: point.date,
      impliedRate: BigInt(point.impliedRate),
      exchangeRate: BigInt(point.exchangeRate),
      lnImpliedRate: BigInt(point.lnImpliedRate),
    })) ?? [];

  return {
    history,
    isLoading,
    isError,
    error,
  };
}
