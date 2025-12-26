'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '@shared/api';
import type {
  HistoryEvent,
  HistoryResponse,
  LpPosition,
  PositionsResponse,
  PortfolioHistoryResponse,
  PortfolioSnapshot,
  PortfolioValueEvent,
  PyPosition,
  YieldResponse,
  YieldSummary,
} from '@shared/api/types';

import { useAccount } from '../useAccount';

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
  types?: EventType[] | undefined;
  /** Max results per page (default: 50, max: 100) */
  limit?: number | undefined;
  /** Refetch interval in milliseconds (default: 30000) */
  refetchInterval?: number | undefined;
  /** Whether to enable the query */
  enabled?: boolean | undefined;
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
        return api.get<HistoryResponse>(`/users/${address}/history`, {
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
      return api.get<PositionsResponse>(`/users/${address}/positions`);
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
      return api.get<YieldResponse>(`/users/${address}/yield`, {
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
      return api.get<PositionsResponse>(`/users/${address}/positions`);
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
// User Portfolio History Hook
// ============================================================================

interface UsePortfolioHistoryOptions {
  /** Number of days of history (default: 90) */
  days?: number;
  /** Max events to return (default: 500) */
  limit?: number;
  /** Refetch interval in milliseconds (default: 60000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface UsePortfolioHistoryReturn {
  events: PortfolioValueEvent[];
  snapshots: PortfolioSnapshot[];
  summary: PortfolioHistoryResponse['summary'];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Hook to fetch portfolio value history for the connected user
 *
 * Returns historical events and daily snapshots of portfolio value,
 * which can be used to render value-over-time charts and P&L breakdowns.
 *
 * @example
 * ```tsx
 * const { snapshots, summary } = usePortfolioHistory({ days: 30 });
 * // Use snapshots for charting portfolio value over time
 * ```
 */
export function usePortfolioHistory(
  options: UsePortfolioHistoryOptions = {}
): UsePortfolioHistoryReturn {
  const { address } = useAccount();
  const { days = 90, limit = 500, refetchInterval = 60000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'user', address, 'portfolio-history', { days, limit }],
    queryFn: () => {
      if (!address) throw new Error('Address is required');
      return api.get<PortfolioHistoryResponse>(`/users/${address}/portfolio-history`, {
        days,
        limit,
      });
    },
    refetchInterval,
    enabled: enabled && !!address,
    staleTime: 30000,
  });

  return {
    events: data?.events ?? [],
    snapshots: data?.snapshots ?? [],
    summary: data?.summary ?? {
      totalDeposited: '0',
      totalWithdrawn: '0',
      realizedPnl: '0',
      firstActivity: null,
      lastActivity: null,
      eventCount: 0,
    },
    isLoading,
    isError,
    error,
  };
}
