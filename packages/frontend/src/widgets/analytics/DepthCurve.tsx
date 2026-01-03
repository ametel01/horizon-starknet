'use client';

import { useDashboardMarkets } from '@features/markets';
import { cn } from '@shared/lib/utils';
import { calcSwapExactPtForSy, calcSwapExactSyForPt, type MarketState } from '@shared/math/amm';
import { formatWadCompact, WAD_BIGINT } from '@shared/math/wad';
import { ChartSkeleton, Skeleton } from '@shared/ui/Skeleton';
import { Activity, Gauge, Info, Layers, TrendingUp } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Format basis points
 */
function formatBps(value: number): string {
  if (value === 0) return '0 bps';
  if (value < 1) return `${value.toFixed(2)} bps`;
  if (value < 10) return `${value.toFixed(1)} bps`;
  return `${String(Math.round(value))} bps`;
}

interface ChartDataPoint {
  percent: number;
  buyImpact: number | null;
  sellImpact: number | null;
}

/**
 * Custom tooltip for depth curve with modern styling
 */
function DepthTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartDataPoint; dataKey: string; value: number; stroke: string }[];
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-popover/95 text-popover-foreground rounded-xl border p-3 shadow-lg backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <Gauge className="text-muted-foreground h-4 w-4" />
        <span className="text-foreground font-medium">{data.percent.toFixed(1)}% of TVL</span>
      </div>
      <div className="space-y-1.5 text-sm">
        {data.buyImpact !== null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span className="bg-primary h-2 w-2 rounded-full" />
              Buy PT
            </span>
            <span className="text-primary font-mono font-medium">{formatBps(data.buyImpact)}</span>
          </div>
        )}
        {data.sellImpact !== null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span className="bg-chart-2 h-2 w-2 rounded-full" />
              Sell PT
            </span>
            <span className="text-chart-2 font-mono font-medium">{formatBps(data.sellImpact)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface DepthCurveProps {
  marketAddress: string;
  className?: string;
  height?: number;
  /** Number of curve points (default: 20) */
  points?: number;
  /** Max trade size as % of TVL (default: 10) */
  maxPercent?: number;
}

/**
 * Build MarketState from on-chain market data
 */
function buildMarketState(market: {
  state: {
    syReserve: bigint;
    ptReserve: bigint;
    totalLpSupply: bigint;
    lnImpliedRate: bigint;
  };
  expiry: number;
  metadata?: { initialAnchor?: bigint };
}): MarketState {
  // Default AMM parameters if not available from metadata
  const defaultScalarRoot = (WAD_BIGINT * 26n) / 1000n; // 0.026 WAD
  const defaultFeeRate = (WAD_BIGINT * 1n) / 1000n; // 0.1% = 0.001 WAD

  return {
    syReserve: market.state.syReserve,
    ptReserve: market.state.ptReserve,
    totalLp: market.state.totalLpSupply,
    scalarRoot: defaultScalarRoot,
    initialAnchor: market.metadata?.initialAnchor ?? WAD_BIGINT,
    feeRate: defaultFeeRate,
    expiry: BigInt(market.expiry),
    lastLnImpliedRate: market.state.lnImpliedRate,
  };
}

/**
 * Calculate depth curve points for a given direction
 */
function calculateDepthCurve(
  state: MarketState,
  tvlSy: bigint,
  isBuyPt: boolean,
  numPoints: number,
  maxPercent: number
): { percent: number; impactBps: number }[] {
  const points: { percent: number; impactBps: number }[] = [];

  for (let i = 1; i <= numPoints; i++) {
    const percent = (maxPercent * i) / numPoints;
    const tradeSizeSy = (tvlSy * BigInt(Math.round(percent * 100))) / 10000n;

    if (tradeSizeSy === 0n) continue;

    try {
      if (isBuyPt) {
        const result = calcSwapExactSyForPt(state, tradeSizeSy);
        points.push({ percent, impactBps: result.priceImpact * 10000 });
      } else {
        // For sell, estimate PT amount from trade size
        const ptAmount = tradeSizeSy; // Simplified: assume 1:1 for estimation
        if (ptAmount >= state.ptReserve) continue;
        const result = calcSwapExactPtForSy(state, ptAmount);
        points.push({ percent, impactBps: result.priceImpact * 10000 });
      }
    } catch {
      // Silently skip points that fail calculation (e.g., trade exceeds reserves)
    }
  }

  return points;
}

/**
 * Find trade size that causes a specific slippage level
 */
function findSlippageSize(
  curve: { percent: number; impactBps: number }[],
  targetBps: number
): number {
  for (const point of curve) {
    if (point.impactBps >= targetBps) {
      return point.percent;
    }
  }
  return curve.length > 0 ? (curve[curve.length - 1]?.percent ?? 0) : 0;
}

/**
 * Merge buy and sell curves into chart data points.
 * Extracted to reduce complexity.
 */
function mergeCurvesToChartData(
  buyPtCurve: { percent: number; impactBps: number }[],
  sellPtCurve: { percent: number; impactBps: number }[]
): ChartDataPoint[] {
  const percentMap = new Map<number, ChartDataPoint>();

  for (const point of buyPtCurve) {
    const p = Math.round(point.percent * 10) / 10;
    if (!percentMap.has(p)) {
      percentMap.set(p, { percent: p, buyImpact: null, sellImpact: null });
    }
    const entry = percentMap.get(p);
    if (entry) entry.buyImpact = point.impactBps;
  }

  for (const point of sellPtCurve) {
    const p = Math.round(point.percent * 10) / 10;
    if (!percentMap.has(p)) {
      percentMap.set(p, { percent: p, buyImpact: null, sellImpact: null });
    }
    const entry = percentMap.get(p);
    if (entry) entry.sellImpact = point.impactBps;
  }

  return Array.from(percentMap.values()).sort((a, b) => a.percent - b.percent);
}

/**
 * Depth Curve Widget
 *
 * Visualizes price impact at different trade sizes for both buy and sell directions.
 * Helps traders understand liquidity depth and expected slippage.
 * Uses on-chain data for accurate market state.
 */
export function DepthCurve({
  marketAddress,
  className,
  height = 250,
  points = 20,
  maxPercent = 10,
}: DepthCurveProps): ReactNode {
  const [mounted, setMounted] = useState(false);
  const { markets, isLoading } = useDashboardMarkets();

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Find the market by address
  const market = useMemo(() => {
    return markets.find((m) => m.address.toLowerCase() === marketAddress.toLowerCase());
  }, [markets, marketAddress]);

  // Calculate depth curves from on-chain data
  const { chartData, summary, tvlSy, underlyingSymbol } = useMemo(() => {
    if (!market) {
      return {
        chartData: [] as ChartDataPoint[],
        summary: { slippage50bpsSize: 0, slippage100bpsSize: 0 },
        tvlSy: 0n,
        underlyingSymbol: '',
      };
    }

    const state = buildMarketState(market);
    const tvl = state.syReserve + state.ptReserve;
    const symbol = market.metadata?.yieldTokenSymbol ?? 'Unknown';

    const buyPtCurve = calculateDepthCurve(state, tvl, true, points, maxPercent);
    const sellPtCurve = calculateDepthCurve(state, tvl, false, points, maxPercent);

    return {
      chartData: mergeCurvesToChartData(buyPtCurve, sellPtCurve),
      summary: {
        slippage50bpsSize: Math.min(
          findSlippageSize(buyPtCurve, 50),
          findSlippageSize(sellPtCurve, 50)
        ),
        slippage100bpsSize: Math.min(
          findSlippageSize(buyPtCurve, 100),
          findSlippageSize(sellPtCurve, 100)
        ),
      },
      tvlSy: tvl,
      underlyingSymbol: symbol,
    };
  }, [market, points, maxPercent]);

  // Loading state
  if (isLoading) {
    return (
      <ChartSkeleton
        className={className}
        height={height}
        chartType="area"
        showHeader
        showFooter={false}
      />
    );
  }

  // Not found state
  if (!market) {
    return (
      <div
        className={cn(
          'border-destructive/50 bg-card overflow-hidden rounded-xl border',
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          'transition-all duration-500',
          className
        )}
      >
        <div className="py-8 text-center">
          <p className="text-destructive text-sm">Market not found</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <div
        className={cn(
          'border-border/50 bg-card overflow-hidden rounded-xl border',
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          'transition-all duration-500',
          className
        )}
      >
        <div className="flex items-center gap-2 border-b p-4">
          <Layers className="text-primary h-5 w-5" />
          <span className="font-medium">Depth Curve</span>
        </div>
        <div className="py-8 text-center">
          <Activity className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">No liquidity data available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border-border/50 bg-card overflow-hidden rounded-xl border',
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        'transition-all duration-500',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Layers className="text-primary h-5 w-5" />
          <div>
            <span className="font-medium">Depth Curve</span>
            <p className="text-muted-foreground text-xs">
              {underlyingSymbol && `${underlyingSymbol} market`} - Price impact vs trade size
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground text-xs">TVL</div>
          <div className="text-foreground font-mono font-medium">{formatWadCompact(tvlSy)} SY</div>
        </div>
      </div>

      <div className="p-4">
        {/* Key metrics */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <TrendingUp className="text-primary h-3.5 w-3.5" />
              <span className="text-muted-foreground text-xs">50 bps slippage at</span>
            </div>
            <div className="text-primary font-mono text-lg font-semibold">
              {summary.slippage50bpsSize > 0 ? `${summary.slippage50bpsSize.toFixed(1)}%` : '>10%'}{' '}
              TVL
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <Activity className="text-chart-2 h-3.5 w-3.5" />
              <span className="text-muted-foreground text-xs">100 bps slippage at</span>
            </div>
            <div className="text-chart-2 font-mono text-lg font-semibold">
              {summary.slippage100bpsSize > 0
                ? `${summary.slippage100bpsSize.toFixed(1)}%`
                : '>10%'}{' '}
              TVL
            </div>
          </div>
        </div>

        {/* Chart with gradient fills */}
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="buyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="sellGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="percent"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${String(v)}%`}
              label={{
                value: 'Trade Size (% of TVL)',
                position: 'insideBottom',
                offset: -5,
                style: { fontSize: 10, fill: 'var(--muted-foreground)' },
              }}
            />
            <YAxis
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${String(v)}bps`}
              label={{
                value: 'Price Impact',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 10, fill: 'var(--muted-foreground)' },
              }}
            />
            <Tooltip content={<DepthTooltip />} />
            <Legend
              verticalAlign="top"
              height={30}
              formatter={(value: string) => (
                <span className="text-foreground text-xs">{value}</span>
              )}
            />

            {/* Reference lines */}
            <ReferenceLine
              y={50}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              label={{
                value: '50 bps',
                position: 'right',
                style: { fill: 'var(--muted-foreground)', fontSize: 9 },
              }}
            />
            <ReferenceLine
              y={100}
              stroke="var(--chart-4)"
              strokeDasharray="3 3"
              label={{
                value: '100 bps',
                position: 'right',
                style: { fill: 'var(--chart-4)', fontSize: 9 },
              }}
            />

            <Area
              type="monotone"
              dataKey="buyImpact"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#buyGradient)"
              name="Buy PT"
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="sellImpact"
              stroke="var(--chart-2)"
              strokeWidth={2}
              fill="url(#sellGradient)"
              name="Sell PT"
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Educational note */}
        <div className="bg-muted/50 mt-4 flex items-start gap-2 rounded-lg p-3">
          <Info className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-muted-foreground text-xs">
            <strong>Depth Curve:</strong> Shows how price impact increases with trade size. Lower
            curves indicate deeper liquidity. Use this to plan trade sizing and expected slippage.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact depth indicator badge
 */
interface DepthIndicatorProps {
  marketAddress: string;
  className?: string;
}

export function DepthIndicator({ marketAddress, className }: DepthIndicatorProps): ReactNode {
  const { markets, isLoading } = useDashboardMarkets();

  const market = useMemo(() => {
    return markets.find((m) => m.address.toLowerCase() === marketAddress.toLowerCase());
  }, [markets, marketAddress]);

  const slippage50bpsSize = useMemo(() => {
    if (!market) return 0;
    const state = buildMarketState(market);
    const tvl = state.syReserve + state.ptReserve;
    const buyPtCurve = calculateDepthCurve(state, tvl, true, 10, 10);
    return findSlippageSize(buyPtCurve, 50);
  }, [market]);

  if (isLoading) {
    return <Skeleton className={cn('h-6 w-24', className)} />;
  }

  const depth =
    slippage50bpsSize >= 5
      ? { label: 'Deep', color: 'bg-primary/10 text-primary', icon: <Layers className="h-3 w-3" /> }
      : slippage50bpsSize >= 2
        ? {
            label: 'Medium',
            color: 'bg-chart-2/10 text-chart-2',
            icon: <Activity className="h-3 w-3" />,
          }
        : {
            label: 'Shallow',
            color: 'bg-destructive/10 text-destructive',
            icon: <TrendingUp className="h-3 w-3" />,
          };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        depth.color,
        className
      )}
    >
      {depth.icon}
      {depth.label} Liquidity
    </span>
  );
}
