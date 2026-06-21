'use client';

import { api } from '@shared/api';
import type { SwapEvent, SwapsResponse } from '@shared/api/types';
import { useInfiniteQuery } from '@tanstack/react-query';

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
