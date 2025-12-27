'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@shared/api';

// ============================================================================
// Yield Curve Hook
// ============================================================================

/**
 * Market data point for yield curve visualization
 */
export interface YieldCurveMarket {
  address: string;
  underlyingSymbol: string;
  expiry: number;
  timeToExpiryYears: number;
  timeToExpiryDays: number;
  impliedApyPercent: number;
  ptPriceInSy: number;
  syReserve: bigint;
  ptReserve: bigint;
  tvlSy: bigint;
  isExpired: boolean;
}

interface YieldCurveApiResponse {
  markets: {
    address: string;
    underlyingSymbol: string;
    expiry: number;
    timeToExpiryYears: number;
    timeToExpiryDays: number;
    impliedApyPercent: number;
    ptPriceInSy: number;
    syReserve: string;
    ptReserve: string;
    tvlSy: string;
    isExpired: boolean;
  }[];
  timestamp: string;
}

interface UseYieldCurveOptions {
  /** Refetch interval in milliseconds (default: 60000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface UseYieldCurveReturn {
  /** Markets sorted by time to expiry (shortest first) */
  markets: YieldCurveMarket[];
  /** Active (non-expired) markets only */
  activeMarkets: YieldCurveMarket[];
  /** Group markets by underlying symbol */
  marketsByUnderlying: Map<string, YieldCurveMarket[]>;
  timestamp: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Hook to fetch yield curve data for all markets.
 * Returns markets sorted by time to expiry for term structure visualization.
 *
 * @example
 * ```tsx
 * const { activeMarkets } = useYieldCurve();
 * // Plot: X = timeToExpiryYears, Y = impliedApyPercent
 * ```
 */
export function useYieldCurve(options: UseYieldCurveOptions = {}): UseYieldCurveReturn {
  const { refetchInterval = 60000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['analytics', 'yield-curve'],
    queryFn: () => api.get<YieldCurveApiResponse>('/analytics/yield-curve'),
    refetchInterval,
    enabled,
    staleTime: 30000,
  });

  // Convert string values to bigint
  const markets: YieldCurveMarket[] =
    data?.markets.map((m) => ({
      ...m,
      syReserve: BigInt(m.syReserve),
      ptReserve: BigInt(m.ptReserve),
      tvlSy: BigInt(m.tvlSy),
    })) ?? [];

  const activeMarkets = markets.filter((m) => !m.isExpired);

  // Group by underlying symbol
  const marketsByUnderlying = new Map<string, YieldCurveMarket[]>();
  for (const market of markets) {
    const existing = marketsByUnderlying.get(market.underlyingSymbol) ?? [];
    existing.push(market);
    marketsByUnderlying.set(market.underlyingSymbol, existing);
  }

  return {
    markets,
    activeMarkets,
    marketsByUnderlying,
    timestamp: data?.timestamp ?? '',
    isLoading,
    isError,
    error,
  };
}

// ============================================================================
// Implied vs Realized APY Hook
// ============================================================================

export interface ImpliedVsRealizedDataPoint {
  date: string;
  impliedApyPercent: number;
  realizedApyPercent: number;
  spreadPercent: number;
  exchangeRate: bigint;
}

interface ImpliedVsRealizedApiResponse {
  market: string;
  underlyingSymbol: string;
  dataPoints: {
    date: string;
    impliedApyPercent: number;
    realizedApyPercent: number;
    spreadPercent: number;
    exchangeRate: string;
  }[];
  summary: {
    avgImpliedApy: number;
    avgRealizedApy: number;
    avgSpread: number;
    currentImpliedApy: number;
    currentExchangeRate: string;
  };
}

interface UseImpliedVsRealizedOptions {
  /** Market address */
  market: string | undefined;
  /** Days of history (default: 30) */
  days?: number;
  /** Refetch interval in milliseconds (default: 60000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface UseImpliedVsRealizedReturn {
  market: string;
  underlyingSymbol: string;
  dataPoints: ImpliedVsRealizedDataPoint[];
  summary: {
    avgImpliedApy: number;
    avgRealizedApy: number;
    avgSpread: number;
    currentImpliedApy: number;
    currentExchangeRate: bigint;
  };
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Hook to fetch implied vs realized APY comparison for a market.
 *
 * @example
 * ```tsx
 * const { dataPoints, summary } = useImpliedVsRealized({ market: address });
 * // Plot: Two lines showing implied and realized APY over time
 * ```
 */
export function useImpliedVsRealized(
  options: UseImpliedVsRealizedOptions
): UseImpliedVsRealizedReturn {
  const { market, days = 30, refetchInterval = 60000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['analytics', 'implied-vs-realized', market, days],
    queryFn: () =>
      api.get<ImpliedVsRealizedApiResponse>('/analytics/implied-vs-realized', { market, days }),
    refetchInterval,
    enabled: enabled && !!market,
    staleTime: 30000,
  });

  const dataPoints: ImpliedVsRealizedDataPoint[] =
    data?.dataPoints.map((p) => ({
      ...p,
      exchangeRate: BigInt(p.exchangeRate),
    })) ?? [];

  return {
    market: data?.market ?? '',
    underlyingSymbol: data?.underlyingSymbol ?? '',
    dataPoints,
    summary: {
      avgImpliedApy: data?.summary.avgImpliedApy ?? 0,
      avgRealizedApy: data?.summary.avgRealizedApy ?? 0,
      avgSpread: data?.summary.avgSpread ?? 0,
      currentImpliedApy: data?.summary.currentImpliedApy ?? 0,
      currentExchangeRate: BigInt(data?.summary.currentExchangeRate ?? '0'),
    },
    isLoading,
    isError,
    error,
  };
}

// ============================================================================
// Execution Quality Hook
// ============================================================================

export interface ImpactDistributionBucket {
  minBps: number;
  maxBps: number;
  count: number;
  label: string;
}

export interface DailyImpactStats {
  date: string;
  medianBps: number;
  p95Bps: number;
  avgBps: number;
  swapCount: number;
}

export interface RecentSwap {
  timestamp: string;
  impactBps: number;
  tradeSizeSy: bigint;
  direction: 'buy_pt' | 'sell_pt';
  txHash: string;
}

interface ExecutionQualityApiResponse {
  market: string;
  underlyingSymbol: string;
  period: { start: string; end: string };
  summary: {
    totalSwaps: number;
    medianImpactBps: number;
    p95ImpactBps: number;
    avgImpactBps: number;
    maxImpactBps: number;
    avgTradeSizeSy: string;
  };
  distribution: ImpactDistributionBucket[];
  timeSeries: DailyImpactStats[];
  recentSwaps: {
    timestamp: string;
    impactBps: number;
    tradeSizeSy: string;
    direction: 'buy_pt' | 'sell_pt';
    txHash: string;
  }[];
}

interface UseExecutionQualityOptions {
  /** Market address */
  market: string | undefined;
  /** Days of history (default: 30, max: 90) */
  days?: number;
  /** Refetch interval in milliseconds (default: 60000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface UseExecutionQualityReturn {
  market: string;
  underlyingSymbol: string;
  period: { start: string; end: string };
  summary: {
    totalSwaps: number;
    medianImpactBps: number;
    p95ImpactBps: number;
    avgImpactBps: number;
    maxImpactBps: number;
    avgTradeSizeSy: bigint;
  };
  distribution: ImpactDistributionBucket[];
  timeSeries: DailyImpactStats[];
  recentSwaps: RecentSwap[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Hook to fetch execution quality metrics for a market.
 * Includes price impact distribution, statistics, and time series.
 *
 * @example
 * ```tsx
 * const { summary, distribution } = useExecutionQuality({ market: address });
 * // Display: Median impact, p95, histogram distribution
 * ```
 */
export function useExecutionQuality(
  options: UseExecutionQualityOptions
): UseExecutionQualityReturn {
  const { market, days = 30, refetchInterval = 60000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['analytics', 'execution-quality', market, days],
    queryFn: () =>
      api.get<ExecutionQualityApiResponse>('/analytics/execution-quality', { market, days }),
    refetchInterval,
    enabled: enabled && !!market,
    staleTime: 30000,
  });

  const recentSwaps: RecentSwap[] =
    data?.recentSwaps.map((s) => ({
      ...s,
      tradeSizeSy: BigInt(s.tradeSizeSy),
    })) ?? [];

  return {
    market: data?.market ?? '',
    underlyingSymbol: data?.underlyingSymbol ?? '',
    period: data?.period ?? { start: '', end: '' },
    summary: {
      totalSwaps: data?.summary.totalSwaps ?? 0,
      medianImpactBps: data?.summary.medianImpactBps ?? 0,
      p95ImpactBps: data?.summary.p95ImpactBps ?? 0,
      avgImpactBps: data?.summary.avgImpactBps ?? 0,
      maxImpactBps: data?.summary.maxImpactBps ?? 0,
      avgTradeSizeSy: BigInt(data?.summary.avgTradeSizeSy ?? '0'),
    },
    distribution: data?.distribution ?? [],
    timeSeries: data?.timeSeries ?? [],
    recentSwaps,
    isLoading,
    isError,
    error,
  };
}

// ============================================================================
// PT Price History Hook
// ============================================================================

export interface PtPriceDataPoint {
  date: string;
  ptPriceInSy: number;
  impliedApyPercent: number;
  timeToExpiryDays: number;
  exchangeRate: bigint;
}

interface PtPriceApiResponse {
  market: string;
  underlyingSymbol: string;
  expiry: number;
  isExpired: boolean;
  currentPtPrice: number;
  currentImpliedApy: number;
  daysToExpiry: number;
  dataPoints: {
    date: string;
    ptPriceInSy: number;
    impliedApyPercent: number;
    timeToExpiryDays: number;
    exchangeRate: string;
  }[];
}

interface UsePtPriceHistoryOptions {
  /** Market address */
  market: string | undefined;
  /** Days of history (default: 90) */
  days?: number;
  /** Refetch interval in milliseconds (default: 60000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface UsePtPriceHistoryReturn {
  market: string;
  underlyingSymbol: string;
  expiry: number;
  isExpired: boolean;
  currentPtPrice: number;
  currentImpliedApy: number;
  daysToExpiry: number;
  dataPoints: PtPriceDataPoint[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Hook to fetch PT price history for a market.
 * Use for visualizing PT's convergence to par (1.0) as maturity approaches.
 *
 * @example
 * ```tsx
 * const { dataPoints, currentPtPrice } = usePtPriceHistory({ market: address });
 * // Plot: X = date, Y = ptPriceInSy, with horizontal line at Y = 1.0 (par)
 * ```
 */
export function usePtPriceHistory(options: UsePtPriceHistoryOptions): UsePtPriceHistoryReturn {
  const { market, days = 90, refetchInterval = 60000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['markets', market, 'pt-price', days],
    queryFn: () => api.get<PtPriceApiResponse>(`/markets/${market ?? ''}/pt-price`, { days }),
    refetchInterval,
    enabled: enabled && !!market,
    staleTime: 30000,
  });

  const dataPoints: PtPriceDataPoint[] =
    data?.dataPoints.map((p) => ({
      ...p,
      exchangeRate: BigInt(p.exchangeRate),
    })) ?? [];

  return {
    market: data?.market ?? '',
    underlyingSymbol: data?.underlyingSymbol ?? '',
    expiry: data?.expiry ?? 0,
    isExpired: data?.isExpired ?? true,
    currentPtPrice: data?.currentPtPrice ?? 1,
    currentImpliedApy: data?.currentImpliedApy ?? 0,
    daysToExpiry: data?.daysToExpiry ?? 0,
    dataPoints,
    isLoading,
    isError,
    error,
  };
}
