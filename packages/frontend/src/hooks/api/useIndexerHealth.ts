'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from './fetcher';
import type { HealthResponse } from './types';

interface UseIndexerHealthOptions {
  /** Refetch interval in milliseconds (default: 30000) */
  refetchInterval?: number;
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
}

interface UseIndexerHealthReturn {
  data: HealthResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  /** Whether the indexer is healthy (connected and not lagging) */
  isHealthy: boolean;
  /** Whether the indexer is degraded (connected but lagging) */
  isDegraded: boolean;
  /** Indexer lag in seconds, or null if unknown */
  lagSeconds: number | null;
}

/**
 * Hook to monitor indexer health status
 *
 * @example
 * ```tsx
 * const { isHealthy, lagSeconds } = useIndexerHealth();
 * if (!isHealthy) {
 *   return <Banner>Data may be stale</Banner>;
 * }
 * ```
 */
export function useIndexerHealth(options: UseIndexerHealthOptions = {}): UseIndexerHealthReturn {
  const { refetchInterval = 30000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'health'],
    queryFn: () => apiFetch<HealthResponse>('/api/health'),
    refetchInterval,
    enabled,
    staleTime: 10000,
  });

  return {
    data,
    isLoading,
    isError,
    error,
    isHealthy: data?.status === 'healthy',
    isDegraded: data?.status === 'degraded',
    lagSeconds: data?.indexer.lagSeconds ?? null,
  };
}
