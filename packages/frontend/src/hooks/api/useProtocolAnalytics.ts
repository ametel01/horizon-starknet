'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from './fetcher';
import type {
  FeesResponse,
  ProtocolStatsResponse,
  ProtocolTvlResponse,
  VolumeResponse,
} from './types';

// ============================================================================
// Protocol TVL Hook
// ============================================================================

interface UseProtocolTvlOptions {
  /** Number of days of history (default: 30, max: 365) */
  days?: number;
  /** Refetch interval in milliseconds (default: 60000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface TvlDataPoint {
  date: string;
  totalSyReserve: bigint;
  totalPtReserve: bigint;
  totalTvl: bigint;
  marketCount: number;
}

interface UseProtocolTvlReturn {
  current: {
    totalSyReserve: bigint;
    totalPtReserve: bigint;
    totalTvl: bigint;
    marketCount: number;
  };
  history: TvlDataPoint[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Hook to fetch protocol-wide TVL metrics
 *
 * @example
 * ```tsx
 * const { current, history } = useProtocolTvl({ days: 30 });
 * console.log(`Total TVL: ${formatWad(current.totalTvl)}`);
 * ```
 */
export function useProtocolTvl(options: UseProtocolTvlOptions = {}): UseProtocolTvlReturn {
  const { days = 30, refetchInterval = 60000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'analytics', 'tvl', { days }],
    queryFn: () => apiFetch<ProtocolTvlResponse>('/api/analytics/tvl', { days }),
    refetchInterval,
    enabled,
    staleTime: 30000,
  });

  // Convert string values to bigint
  const current = data?.current
    ? {
        totalSyReserve: BigInt(data.current.totalSyReserve),
        totalPtReserve: BigInt(data.current.totalPtReserve),
        totalTvl: BigInt(data.current.totalSyReserve) + BigInt(data.current.totalPtReserve),
        marketCount: data.current.marketCount,
      }
    : {
        totalSyReserve: 0n,
        totalPtReserve: 0n,
        totalTvl: 0n,
        marketCount: 0,
      };

  const history: TvlDataPoint[] =
    data?.history.map((point) => ({
      date: point.date,
      totalSyReserve: BigInt(point.totalSyReserve),
      totalPtReserve: BigInt(point.totalPtReserve),
      totalTvl: BigInt(point.totalSyReserve) + BigInt(point.totalPtReserve),
      marketCount: point.marketCount,
    })) ?? [];

  return {
    current,
    history,
    isLoading,
    isError,
    error,
  };
}

// ============================================================================
// Protocol Volume Hook
// ============================================================================

interface UseProtocolVolumeOptions {
  /** Number of days of history (default: 30, max: 365) */
  days?: number;
  /** Refetch interval in milliseconds (default: 60000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface VolumeDataPoint {
  date: string;
  syVolume: bigint;
  ptVolume: bigint;
  totalVolume: bigint;
  swapCount: number;
  uniqueSwappers: number;
}

interface UseProtocolVolumeReturn {
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
  history: VolumeDataPoint[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Hook to fetch protocol-wide volume metrics
 *
 * @example
 * ```tsx
 * const { total24h, total7d, history } = useProtocolVolume({ days: 7 });
 * console.log(`24h Volume: ${formatWad(total24h.totalVolume)}`);
 * ```
 */
export function useProtocolVolume(options: UseProtocolVolumeOptions = {}): UseProtocolVolumeReturn {
  const { days = 30, refetchInterval = 60000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'analytics', 'volume', { days }],
    queryFn: () => apiFetch<VolumeResponse>('/api/analytics/volume', { days }),
    refetchInterval,
    enabled,
    staleTime: 30000,
  });

  // Convert string values to bigint
  const total24h = data?.total24h
    ? {
        syVolume: BigInt(data.total24h.syVolume),
        ptVolume: BigInt(data.total24h.ptVolume),
        totalVolume: BigInt(data.total24h.syVolume) + BigInt(data.total24h.ptVolume),
        swapCount: data.total24h.swapCount,
        uniqueSwappers: data.total24h.uniqueSwappers,
      }
    : {
        syVolume: 0n,
        ptVolume: 0n,
        totalVolume: 0n,
        swapCount: 0,
        uniqueSwappers: 0,
      };

  const total7d = data?.total7d
    ? {
        syVolume: BigInt(data.total7d.syVolume),
        ptVolume: BigInt(data.total7d.ptVolume),
        totalVolume: BigInt(data.total7d.syVolume) + BigInt(data.total7d.ptVolume),
        swapCount: data.total7d.swapCount,
      }
    : {
        syVolume: 0n,
        ptVolume: 0n,
        totalVolume: 0n,
        swapCount: 0,
      };

  const history: VolumeDataPoint[] =
    data?.history.map((point) => ({
      date: point.date,
      syVolume: BigInt(point.syVolume),
      ptVolume: BigInt(point.ptVolume),
      totalVolume: BigInt(point.syVolume) + BigInt(point.ptVolume),
      swapCount: point.swapCount,
      uniqueSwappers: point.uniqueSwappers,
    })) ?? [];

  return {
    total24h,
    total7d,
    history,
    isLoading,
    isError,
    error,
  };
}

// ============================================================================
// Protocol Fees Hook
// ============================================================================

interface UseProtocolFeesOptions {
  /** Number of days of history (default: 30, max: 365) */
  days?: number;
  /** Refetch interval in milliseconds (default: 60000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface FeesDataPoint {
  date: string;
  totalFees: bigint;
  swapCount: number;
}

interface MarketFeeBreakdown {
  market: string;
  underlyingSymbol: string;
  totalFees: bigint;
  swapCount: number;
  avgFeePerSwap: bigint;
}

interface UseProtocolFeesReturn {
  total24h: bigint;
  total7d: bigint;
  total30d: bigint;
  history: FeesDataPoint[];
  byMarket: MarketFeeBreakdown[];
  recentCollections: FeesResponse['recentCollections'];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Hook to fetch protocol-wide fee metrics
 *
 * @example
 * ```tsx
 * const { total24h, total7d, byMarket } = useProtocolFees({ days: 30 });
 * console.log(`24h Fees: ${formatWad(total24h)}`);
 * ```
 */
export function useProtocolFees(options: UseProtocolFeesOptions = {}): UseProtocolFeesReturn {
  const { days = 30, refetchInterval = 60000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'analytics', 'fees', { days }],
    queryFn: () => apiFetch<FeesResponse>('/api/analytics/fees', { days }),
    refetchInterval,
    enabled,
    staleTime: 30000,
  });

  // Convert string values to bigint
  const history: FeesDataPoint[] =
    data?.history.map((point) => ({
      date: point.date,
      totalFees: BigInt(point.totalFees),
      swapCount: point.swapCount,
    })) ?? [];

  const byMarket: MarketFeeBreakdown[] =
    data?.byMarket.map((market) => ({
      market: market.market,
      underlyingSymbol: market.underlyingSymbol,
      totalFees: BigInt(market.totalFees),
      swapCount: market.swapCount,
      avgFeePerSwap: BigInt(market.avgFeePerSwap),
    })) ?? [];

  return {
    total24h: BigInt(data?.total24h ?? '0'),
    total7d: BigInt(data?.total7d ?? '0'),
    total30d: BigInt(data?.total30d ?? '0'),
    history,
    byMarket,
    recentCollections: data?.recentCollections ?? [],
    isLoading,
    isError,
    error,
  };
}

// ============================================================================
// Combined Analytics Hook (single API call - optimized)
// ============================================================================

interface UseProtocolStatsOptions {
  /** Refetch interval in milliseconds (default: 60000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface ProtocolStats {
  tvl: bigint;
  marketCount: number;
  volume24h: bigint;
  swaps24h: number;
  fees24h: bigint;
  uniqueTraders24h: number;
}

interface UseProtocolStatsReturn {
  stats: ProtocolStats;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Hook to fetch combined protocol stats for dashboards.
 * Uses a single optimized API call instead of 3 separate calls.
 *
 * @example
 * ```tsx
 * const { stats, isLoading } = useProtocolStats();
 * ```
 */
export function useProtocolStats(options: UseProtocolStatsOptions = {}): UseProtocolStatsReturn {
  const { refetchInterval = 60000, enabled = true } = options;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['indexer', 'analytics', 'stats'],
    queryFn: () => apiFetch<ProtocolStatsResponse>('/api/analytics/stats'),
    refetchInterval,
    enabled,
    staleTime: 30000,
  });

  const stats: ProtocolStats = data
    ? {
        tvl: BigInt(data.tvl.totalSyReserve) + BigInt(data.tvl.totalPtReserve),
        marketCount: data.tvl.marketCount,
        volume24h: BigInt(data.volume24h.syVolume) + BigInt(data.volume24h.ptVolume),
        swaps24h: data.volume24h.swapCount,
        fees24h: BigInt(data.fees24h),
        uniqueTraders24h: data.volume24h.uniqueSwappers,
      }
    : {
        tvl: 0n,
        marketCount: 0,
        volume24h: 0n,
        swaps24h: 0,
        fees24h: 0n,
        uniqueTraders24h: 0,
      };

  return {
    stats,
    isLoading,
    isError,
  };
}
