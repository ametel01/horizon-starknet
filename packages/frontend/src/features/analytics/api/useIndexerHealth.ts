'use client';

import { api } from '@shared/api';
import type { HealthResponse, PoolMode } from '@shared/api/types';
import { useQuery } from '@tanstack/react-query';

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
  /** Indexer lag in blocks, or null if unknown */
  lagBlocks: number | null;
  /** Whether using a connection pooler */
  usePooler: boolean;
  /** Connection pool mode (transaction, session, statement) */
  poolMode: PoolMode | null;
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
    queryFn: () => api.get<HealthResponse>('/health'),
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
    lagBlocks: data?.indexer.lagBlocks ?? null,
    usePooler: data?.database.usePooler ?? false,
    poolMode: data?.database.poolMode ?? null,
  };
}
