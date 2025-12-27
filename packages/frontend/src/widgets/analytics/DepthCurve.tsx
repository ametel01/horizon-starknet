'use client';

import { type ReactNode, useMemo } from 'react';
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ReferenceLine,
} from 'recharts';

import { useDashboardMarkets } from '@features/markets';
import { cn } from '@shared/lib/utils';
import { calcSwapExactPtForSy, calcSwapExactSyForPt, type MarketState } from '@shared/math/amm';
import { formatWadCompact, WAD_BIGINT } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@shared/ui';

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
 * Custom tooltip for depth curve
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
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <div className="text-foreground mb-2 font-medium">{data.percent.toFixed(1)}% of TVL</div>
      <div className="space-y-1 text-sm">
        {data.buyImpact !== null && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Buy PT Impact:</span>
            <span className="text-primary font-medium">{formatBps(data.buyImpact)}</span>
          </div>
        )}
        {data.sellImpact !== null && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Sell PT Impact:</span>
            <span className="text-chart-2 font-medium">{formatBps(data.sellImpact)}</span>
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
      continue;
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
  const { markets, isLoading } = useDashboardMarkets();

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

    // Merge curves into chart data
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

    const data = Array.from(percentMap.values()).sort((a, b) => a.percent - b.percent);

    return {
      chartData: data,
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
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full" style={{ height }} />
        </CardContent>
      </Card>
    );
  }

  // Not found state
  if (!market) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="py-8 text-center">
          <p className="text-destructive text-sm">Market not found</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Depth Curve</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No liquidity data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Depth Curve</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              {underlyingSymbol && `${underlyingSymbol} market`} - Price impact vs trade size
            </p>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-xs">TVL</div>
            <div className="text-foreground font-medium">{formatWadCompact(tvlSy)} SY</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Key metrics */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-muted-foreground text-xs">50 bps slippage at</div>
            <div className="text-primary text-lg font-medium">
              {summary.slippage50bpsSize > 0 ? `${summary.slippage50bpsSize.toFixed(1)}%` : '>10%'}{' '}
              TVL
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-muted-foreground text-xs">100 bps slippage at</div>
            <div className="text-chart-2 text-lg font-medium">
              {summary.slippage100bpsSize > 0
                ? `${summary.slippage100bpsSize.toFixed(1)}%`
                : '>10%'}{' '}
              TVL
            </div>
          </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="percent"
              fontSize={12}
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
              fontSize={12}
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

            <Line
              type="monotone"
              dataKey="buyImpact"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
              name="Buy PT"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="sellImpact"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
              name="Sell PT"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Educational note */}
        <div className="bg-muted/50 mt-4 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">
            <strong>Depth Curve:</strong> Shows how price impact increases with trade size. Lower
            curves indicate deeper liquidity. Use this to plan trade sizing and expected slippage.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact depth indicator
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
      ? { label: 'Deep', color: 'bg-primary/10 text-primary' }
      : slippage50bpsSize >= 2
        ? { label: 'Medium', color: 'bg-chart-2/10 text-chart-2' }
        : { label: 'Shallow', color: 'bg-destructive/10 text-destructive' };

  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', depth.color, className)}>
      {depth.label} Liquidity
    </span>
  );
}
