'use client';

import { api } from '@shared/api';
import { useQuery } from '@tanstack/react-query';
import type { DepthCurveResponse } from '@/app/api/analytics/depth-curve/route';
import type { ExecutionQualityResponse } from '@/app/api/analytics/execution-quality/route';
import type { LiquidityHealthResponse } from '@/app/api/analytics/liquidity-health/route';

// ============================================================================
// Execution Quality Hook
// ============================================================================

interface UseExecutionStatsOptions {
  /** Market address to analyze */
  market: string;
  /** Number of days of history (default: 30, max: 90) */
  days?: number;
  /** Refetch interval in milliseconds (default: 120000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface ImpactDistributionBucket {
  minBps: number;
  maxBps: number;
  count: number;
  label: string;
}

interface DailyImpactStats {
  date: string;
  medianBps: number;
  p95Bps: number;
  avgBps: number;
  swapCount: number;
}

interface RecentSwap {
  timestamp: string;
  impactBps: number;
  tradeSizeSy: bigint;
  direction: 'buy_pt' | 'sell_pt';
  txHash: string;
}

interface UseExecutionStatsReturn {
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
  error: Error | null;
}

/**
 * Hook to fetch execution quality metrics for a market
 *
 * @example
 * ```tsx
 * const { summary, distribution } = useExecutionStats({ market: '0x...' });
 * console.log(`Median impact: ${summary.medianImpactBps} bps`);
 * ```
 */
export function useExecutionStats(options: UseExecutionStatsOptions): UseExecutionStatsReturn {
  const { market, days = 30, refetchInterval = 120000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'analytics', 'execution-quality', { market, days }],
    queryFn: () =>
      api.get<ExecutionQualityResponse>('/analytics/execution-quality', { market, days }),
    refetchInterval,
    enabled: enabled && Boolean(market),
    staleTime: 60000,
  });

  const emptyReturn: UseExecutionStatsReturn = {
    market,
    underlyingSymbol: '',
    period: { start: '', end: '' },
    summary: {
      totalSwaps: 0,
      medianImpactBps: 0,
      p95ImpactBps: 0,
      avgImpactBps: 0,
      maxImpactBps: 0,
      avgTradeSizeSy: 0n,
    },
    distribution: [],
    timeSeries: [],
    recentSwaps: [],
    isLoading,
    isError,
    error: error instanceof Error ? error : null,
  };

  if (!data) return emptyReturn;

  return {
    market: data.market,
    underlyingSymbol: data.underlyingSymbol,
    period: data.period,
    summary: {
      totalSwaps: data.summary.totalSwaps,
      medianImpactBps: data.summary.medianImpactBps,
      p95ImpactBps: data.summary.p95ImpactBps,
      avgImpactBps: data.summary.avgImpactBps,
      maxImpactBps: data.summary.maxImpactBps,
      avgTradeSizeSy: BigInt(data.summary.avgTradeSizeSy),
    },
    distribution: data.distribution,
    timeSeries: data.timeSeries,
    recentSwaps: data.recentSwaps.map((s) => ({
      ...s,
      tradeSizeSy: BigInt(s.tradeSizeSy),
    })),
    isLoading,
    isError,
    error: error instanceof Error ? error : null,
  };
}

// ============================================================================
// Depth Curve Hook
// ============================================================================

interface UseDepthCurveOptions {
  /** Market address to analyze */
  market: string;
  /** Number of curve points (default: 20, max: 50) */
  points?: number;
  /** Max trade size as % of TVL (default: 10, max: 50) */
  maxPercent?: number;
  /** Refetch interval in milliseconds (default: 120000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface DepthPoint {
  tradeSizeSy: bigint;
  tradeSizePercent: number;
  impactBps: number;
  effectivePrice: bigint;
  outputAmount: bigint;
}

interface UseDepthCurveReturn {
  market: string;
  underlyingSymbol: string;
  timestamp: string;
  state: {
    syReserve: bigint;
    ptReserve: bigint;
    totalLp: bigint;
    lnImpliedRate: bigint;
    spotPricePtSy: bigint;
    tvlSy: bigint;
  };
  buyPtCurve: DepthPoint[];
  sellPtCurve: DepthPoint[];
  summary: {
    slippage50bpsSize: number;
    slippage100bpsSize: number;
    maxTradeSize: bigint;
  };
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Hook to fetch depth curve data for a market
 *
 * @example
 * ```tsx
 * const { buyPtCurve, sellPtCurve, summary } = useDepthCurve({ market: '0x...' });
 * console.log(`50bps slippage at ${summary.slippage50bpsSize}% TVL`);
 * ```
 */
export function useDepthCurve(options: UseDepthCurveOptions): UseDepthCurveReturn {
  const {
    market,
    points = 20,
    maxPercent = 10,
    refetchInterval = 120000,
    enabled = true,
  } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'analytics', 'depth-curve', { market, points, maxPercent }],
    queryFn: () =>
      api.get<DepthCurveResponse>('/analytics/depth-curve', { market, points, maxPercent }),
    refetchInterval,
    enabled: enabled && Boolean(market),
    staleTime: 60000,
  });

  const emptyReturn: UseDepthCurveReturn = {
    market,
    underlyingSymbol: '',
    timestamp: '',
    state: {
      syReserve: 0n,
      ptReserve: 0n,
      totalLp: 0n,
      lnImpliedRate: 0n,
      spotPricePtSy: 0n,
      tvlSy: 0n,
    },
    buyPtCurve: [],
    sellPtCurve: [],
    summary: {
      slippage50bpsSize: 0,
      slippage100bpsSize: 0,
      maxTradeSize: 0n,
    },
    isLoading,
    isError,
    error: error instanceof Error ? error : null,
  };

  if (!data) return emptyReturn;

  const convertPoints = (points: DepthCurveResponse['buyPtCurve']): DepthPoint[] =>
    points.map((p) => ({
      tradeSizeSy: BigInt(p.tradeSizeSy),
      tradeSizePercent: p.tradeSizePercent,
      impactBps: p.impactBps,
      effectivePrice: BigInt(p.effectivePrice),
      outputAmount: BigInt(p.outputAmount),
    }));

  return {
    market: data.market,
    underlyingSymbol: data.underlyingSymbol,
    timestamp: data.timestamp,
    state: {
      syReserve: BigInt(data.state.syReserve),
      ptReserve: BigInt(data.state.ptReserve),
      totalLp: BigInt(data.state.totalLp),
      lnImpliedRate: BigInt(data.state.lnImpliedRate),
      spotPricePtSy: BigInt(data.state.spotPricePtSy),
      tvlSy: BigInt(data.state.tvlSy),
    },
    buyPtCurve: convertPoints(data.buyPtCurve),
    sellPtCurve: convertPoints(data.sellPtCurve),
    summary: {
      slippage50bpsSize: data.summary.slippage50bpsSize,
      slippage100bpsSize: data.summary.slippage100bpsSize,
      maxTradeSize: BigInt(data.summary.maxTradeSize),
    },
    isLoading,
    isError,
    error: error instanceof Error ? error : null,
  };
}

// ============================================================================
// Liquidity Health Hook
// ============================================================================

interface UseLiquidityHealthOptions {
  /** Number of days to analyze (default: 7, max: 30) */
  days?: number;
  /** Refetch interval in milliseconds (default: 120000) */
  refetchInterval?: number;
  /** Whether to enable the query */
  enabled?: boolean;
}

type HealthLevel = 'excellent' | 'good' | 'fair' | 'poor';

interface MarketLiquidityHealth {
  market: string;
  underlyingSymbol: string;
  isExpired: boolean;
  tvlSy: bigint;
  volume24hSy: bigint;
  utilizationPercent: number;
  spreadProxyBps: number;
  depthScore: number;
  healthScore: number;
  healthLevel: HealthLevel;
  swapCount: number;
  maxTrade50bps: bigint;
}

interface UseLiquidityHealthReturn {
  timestamp: string;
  period: { start: string; end: string };
  protocol: {
    totalTvlSy: bigint;
    totalVolume24hSy: bigint;
    avgSpreadProxyBps: number;
    avgHealthScore: number;
    marketsAnalyzed: number;
  };
  markets: MarketLiquidityHealth[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Get color for health level
 */
export function getHealthLevelColor(level: HealthLevel): string {
  switch (level) {
    case 'excellent':
      return 'text-primary';
    case 'good':
      return 'text-chart-2';
    case 'fair':
      return 'text-chart-4';
    case 'poor':
      return 'text-destructive';
  }
}

/**
 * Get background color for health level
 */
export function getHealthLevelBgColor(level: HealthLevel): string {
  switch (level) {
    case 'excellent':
      return 'bg-primary/10';
    case 'good':
      return 'bg-chart-2/10';
    case 'fair':
      return 'bg-chart-4/10';
    case 'poor':
      return 'bg-destructive/10';
  }
}

/**
 * Hook to fetch liquidity health metrics across all markets
 *
 * @example
 * ```tsx
 * const { protocol, markets } = useLiquidityHealth();
 * console.log(`Avg health: ${protocol.avgHealthScore}`);
 * ```
 */
export function useLiquidityHealth(
  options: UseLiquidityHealthOptions = {}
): UseLiquidityHealthReturn {
  const { days = 7, refetchInterval = 120000, enabled = true } = options;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['indexer', 'analytics', 'liquidity-health', { days }],
    queryFn: () => api.get<LiquidityHealthResponse>('/analytics/liquidity-health', { days }),
    refetchInterval,
    enabled,
    staleTime: 60000,
  });

  const emptyReturn: UseLiquidityHealthReturn = {
    timestamp: '',
    period: { start: '', end: '' },
    protocol: {
      totalTvlSy: 0n,
      totalVolume24hSy: 0n,
      avgSpreadProxyBps: 0,
      avgHealthScore: 0,
      marketsAnalyzed: 0,
    },
    markets: [],
    isLoading,
    isError,
    error: error instanceof Error ? error : null,
  };

  if (!data) return emptyReturn;

  return {
    timestamp: data.timestamp,
    period: data.period,
    protocol: {
      totalTvlSy: BigInt(data.protocol.totalTvlSy),
      totalVolume24hSy: BigInt(data.protocol.totalVolume24hSy),
      avgSpreadProxyBps: data.protocol.avgSpreadProxyBps,
      avgHealthScore: data.protocol.avgHealthScore,
      marketsAnalyzed: data.protocol.marketsAnalyzed,
    },
    markets: data.markets.map((m) => ({
      market: m.market,
      underlyingSymbol: m.underlyingSymbol,
      isExpired: m.isExpired,
      tvlSy: BigInt(m.tvlSy),
      volume24hSy: BigInt(m.volume24hSy),
      utilizationPercent: m.utilizationPercent,
      spreadProxyBps: m.spreadProxyBps,
      depthScore: m.depthScore,
      healthScore: m.healthScore,
      healthLevel: m.healthLevel,
      swapCount: m.swapCount,
      maxTrade50bps: BigInt(m.maxTrade50bps),
    })),
    isLoading,
    isError,
    error: error instanceof Error ? error : null,
  };
}
