'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useAccount } from '../useAccount';

import { apiFetch } from './fetcher';
import type {
  HistoryEvent,
  HistoryResponse,
  LpPosition,
  PositionsResponse,
  PyPosition,
  YieldResponse,
  YieldSummary,
} from './types';

// ============================================================================
// User Transaction History Hook
// ============================================================================

type EventType =
  | 'swap'
  | 'swap_yt'
  | 'add_liquidity'
  | 'remove_liquidity'
  | 'mint_py'
  | 'redeem_py';

interface UseUserHistoryOptions {
  /** Filter by event types */
  types?: EventType[];
  /** Max results per page (default: 50, max: 100) */
  limit?: number;
  /** Refetch interval in milliseconds (default: 30000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface UseUserHistoryReturn {
  events: HistoryEvent[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  hasMore: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
}

/**
 * Hook to fetch paginated transaction history for the connected user
 *
 * @example
 * ```tsx
 * const { events, hasMore, fetchNextPage } = useUserHistory();
 * // Or filter by type:
 * const { events } = useUserHistory({ types: ['swap', 'swap_yt'] });
 * ```
 */
export function useUserHistory(options: UseUserHistoryOptions = {}): UseUserHistoryReturn {
  const { address } = useAccount();
  const { types, limit = 50, refetchInterval = 30000, enabled = true } = options;

  const typeParam = types?.join(',');

  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['indexer', 'user', address, 'history', { types: typeParam, limit }],
      queryFn: async ({ pageParam }) => {
        if (!address) throw new Error('Address is required');
        return apiFetch<HistoryResponse>(`/api/users/${address}/history`, {
          type: typeParam,
          limit,
          offset: pageParam,
        });
      },
      getNextPageParam: (lastPage, allPages) => {
        if (!lastPage.hasMore) return undefined;
        return allPages.reduce((sum, page) => sum + page.events.length, 0);
      },
      initialPageParam: 0,
      refetchInterval,
      enabled: enabled && !!address,
      staleTime: 10000,
    });

  // Flatten all pages into a single array
  const events = data?.pages.flatMap((page) => page.events) ?? [];

  return {
    events,
    isLoading,
    isError,
    error,
    hasMore: hasNextPage,
    fetchNextPage: () => void fetchNextPage(),
    isFetchingNextPage,
  };
}

// ============================================================================
// User Indexed Positions Hook
// ============================================================================

interface UseUserIndexedPositionsOptions {
  /** Refetch interval in milliseconds (default: 30000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface UseUserIndexedPositionsReturn {
  pyPositions: PyPosition[];
  lpPositions: LpPosition[];
  summary: {
    totalPyPositions: number;
    totalLpPositions: number;
    activePyPositions: number;
    activeLpPositions: number;
  };
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Hook to fetch aggregated position data for the connected user from the indexer
 *
 * This provides historical position data computed from all past transactions,
 * including average entry prices and P&L tracking data.
 *
 * @example
 * ```tsx
 * const { pyPositions, lpPositions, summary } = useUserIndexedPositions();
 * ```
 */
export function useUserIndexedPositions(
  options: UseUserIndexedPositionsOptions = {}
): UseUserIndexedPositionsReturn {
  const { address } = useAccount();
  const { refetchInterval = 30000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'user', address, 'positions'],
    queryFn: () => {
      if (!address) throw new Error('Address is required');
      return apiFetch<PositionsResponse>(`/api/users/${address}/positions`);
    },
    refetchInterval,
    enabled: enabled && !!address,
    staleTime: 10000,
  });

  return {
    pyPositions: data?.pyPositions ?? [],
    lpPositions: data?.lpPositions ?? [],
    summary: data?.summary ?? {
      totalPyPositions: 0,
      totalLpPositions: 0,
      activePyPositions: 0,
      activeLpPositions: 0,
    },
    isLoading,
    isError,
    error,
  };
}

// ============================================================================
// User Yield Hook
// ============================================================================

interface UseUserYieldOptions {
  /** Number of days of history (omit for all time) */
  days?: number;
  /** Max claim events to return (default: 100, max: 500) */
  limit?: number;
  /** Refetch interval in milliseconds (default: 30000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface UseUserYieldReturn {
  totalYieldClaimed: bigint;
  claimHistory: YieldResponse['claimHistory'];
  summaryByPosition: YieldSummary[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Hook to fetch yield earned/claimed for the connected user
 *
 * @example
 * ```tsx
 * const { totalYieldClaimed, claimHistory, summaryByPosition } = useUserYield();
 * // Or limit to last 30 days:
 * const { totalYieldClaimed } = useUserYield({ days: 30 });
 * ```
 */
export function useUserYield(options: UseUserYieldOptions = {}): UseUserYieldReturn {
  const { address } = useAccount();
  const { days, limit = 100, refetchInterval = 30000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'user', address, 'yield', { days, limit }],
    queryFn: () => {
      if (!address) throw new Error('Address is required');
      return apiFetch<YieldResponse>(`/api/users/${address}/yield`, {
        days,
        limit,
      });
    },
    refetchInterval,
    enabled: enabled && !!address,
    staleTime: 10000,
  });

  return {
    totalYieldClaimed: BigInt(data?.totalYieldClaimed ?? '0'),
    claimHistory: data?.claimHistory ?? [],
    summaryByPosition: data?.summaryByPosition ?? [],
    isLoading,
    isError,
    error,
  };
}

/**
 * Hook to fetch user data for a specific address (not necessarily the connected user)
 *
 * @example
 * ```tsx
 * const { pyPositions, lpPositions } = useUserPositionsByAddress('0x123...');
 * ```
 */
export function useUserPositionsByAddress(
  address: string | undefined,
  options: Omit<UseUserIndexedPositionsOptions, 'enabled'> & { enabled?: boolean } = {}
): UseUserIndexedPositionsReturn {
  const { refetchInterval = 30000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'user', address, 'positions'],
    queryFn: () => {
      if (!address) throw new Error('Address is required');
      return apiFetch<PositionsResponse>(`/api/users/${address}/positions`);
    },
    refetchInterval,
    enabled: enabled && !!address,
    staleTime: 10000,
  });

  return {
    pyPositions: data?.pyPositions ?? [],
    lpPositions: data?.lpPositions ?? [],
    summary: data?.summary ?? {
      totalPyPositions: 0,
      totalLpPositions: 0,
      activePyPositions: 0,
      activeLpPositions: 0,
    },
    isLoading,
    isError,
    error,
  };
}
