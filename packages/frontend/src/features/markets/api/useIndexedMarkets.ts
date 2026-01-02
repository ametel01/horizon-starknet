'use client';

import { api } from '@shared/api';
import type { IndexedMarket, MarketDetailResponse, MarketsResponse } from '@shared/api/types';
import { useQuery } from '@tanstack/react-query';

interface UseIndexedMarketsOptions {
  /** Only return active (non-expired) markets (default: true) */
  activeOnly?: boolean;
  /** Refetch interval in milliseconds (default: 30000) */
  refetchInterval?: number;
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
}

interface UseIndexedMarketsReturn {
  markets: IndexedMarket[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Hook to fetch all markets from the indexer
 *
 * @example
 * ```tsx
 * const { markets, isLoading } = useIndexedMarkets();
 * ```
 */
export function useIndexedMarkets(options: UseIndexedMarketsOptions = {}): UseIndexedMarketsReturn {
  const { activeOnly = true, refetchInterval = 30000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'markets', { activeOnly }],
    queryFn: () =>
      api.get<MarketsResponse>('/markets', {
        active_only: activeOnly ? 'true' : 'false',
      }),
    refetchInterval,
    enabled,
    staleTime: 10000,
  });

  return {
    markets: data?.markets ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError,
    error,
  };
}

interface UseIndexedMarketOptions {
  /** Refetch interval in milliseconds (default: 30000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface UseIndexedMarketReturn {
  data: MarketDetailResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  isNotFound: boolean;
  error: unknown;
}

/**
 * Hook to fetch detailed market data from the indexer
 *
 * @example
 * ```tsx
 * const { data, isLoading, isNotFound } = useIndexedMarket(marketAddress);
 * ```
 */
export function useIndexedMarket(
  address: string | undefined,
  options: UseIndexedMarketOptions = {}
): UseIndexedMarketReturn {
  const { refetchInterval = 30000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'market', address],
    queryFn: () => {
      if (!address) throw new Error('Address is required');
      return api.get<MarketDetailResponse>(`/markets/${address}`);
    },
    refetchInterval,
    enabled: enabled && !!address,
    staleTime: 10000,
  });

  // Check if error is a 404
  const apiError = error as { status?: number } | null;
  const isNotFound = isError && apiError?.status === 404;

  return {
    data,
    isLoading,
    isError: isError && !isNotFound,
    isNotFound,
    error,
  };
}
