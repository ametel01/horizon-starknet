'use client';

import { type ReactNode, useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';

import { useYieldCurve, type YieldCurveMarket } from '@features/analytics';
import { cn } from '@shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';

/**
 * Color palette for different underlying assets
 */
const UNDERLYING_COLORS: Record<string, string> = {
  ETH: 'var(--chart-1)',
  WETH: 'var(--chart-1)',
  STRK: 'var(--chart-2)',
  USDC: 'var(--chart-3)',
  USDT: 'var(--chart-4)',
  DAI: 'var(--chart-5)',
};

function getUnderlyingColor(symbol: string): string {
  return UNDERLYING_COLORS[symbol.toUpperCase()] ?? 'var(--primary)';
}

/**
 * Format APY percentage with appropriate precision
 */
function formatApy(value: number): string {
  if (value === 0) return '0%';
  if (Math.abs(value) < 0.01) return '<0.01%';
  if (Math.abs(value) < 1) return `${value.toFixed(2)}%`;
  return `${value.toFixed(1)}%`;
}

/**
 * Format time to expiry
 */
function formatTimeToExpiry(years: number): string {
  if (years < 0.0833) {
    // Less than 1 month
    const days = Math.round(years * 365);
    return `${String(days)}d`;
  }
  if (years < 1) {
    const months = Math.round(years * 12);
    return `${String(months)}mo`;
  }
  return `${years.toFixed(1)}y`;
}

interface YieldCurveChartProps {
  className?: string;
  height?: number;
  /** Filter to specific underlying symbols */
  underlyings?: string[];
  /** Show expired markets (default: false) */
  showExpired?: boolean;
}

interface ChartDataPoint {
  x: number; // timeToExpiryYears
  y: number; // impliedApyPercent
  market: YieldCurveMarket;
}

/**
 * Custom tooltip for yield curve chart
 */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartDataPoint }[];
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const { market } = data;

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <div className="mb-2 font-medium">{market.underlyingSymbol} Market</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Implied APY:</span>
          <span className="text-primary font-medium">{formatApy(market.impliedApyPercent)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Time to Expiry:</span>
          <span>{formatTimeToExpiry(market.timeToExpiryYears)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Days Left:</span>
          <span>{Math.round(market.timeToExpiryDays)} days</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">PT Price:</span>
          <span>{market.ptPriceInSy.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Yield Curve (Term Structure) Chart
 *
 * Visualizes the relationship between time to maturity and implied APY
 * across all active markets. This is the primary yield-derivatives-native
 * analytics view, showing term structure at a glance.
 */
export function YieldCurveChart({
  className,
  height = 350,
  underlyings,
  showExpired = false,
}: YieldCurveChartProps): ReactNode {
  const { markets, activeMarkets, isLoading, isError } = useYieldCurve();

  // Prepare chart data grouped by underlying
  const { chartDataByUnderlying, allUnderlyings, maxY, maxX } = useMemo(() => {
    const sourceMarkets = showExpired ? markets : activeMarkets;
    const filtered = underlyings
      ? sourceMarkets.filter((m) =>
          underlyings.map((u) => u.toUpperCase()).includes(m.underlyingSymbol.toUpperCase())
        )
      : sourceMarkets;

    const byUnderlying = new Map<string, ChartDataPoint[]>();
    let maxApyValue = 0;
    let maxTimeValue = 0;

    for (const market of filtered) {
      const symbol = market.underlyingSymbol;
      if (!byUnderlying.has(symbol)) {
        byUnderlying.set(symbol, []);
      }
      byUnderlying.get(symbol)?.push({
        x: market.timeToExpiryYears,
        y: market.impliedApyPercent,
        market,
      });
      maxApyValue = Math.max(maxApyValue, market.impliedApyPercent);
      maxTimeValue = Math.max(maxTimeValue, market.timeToExpiryYears);
    }

    return {
      chartDataByUnderlying: byUnderlying,
      allUnderlyings: Array.from(byUnderlying.keys()),
      maxY: Math.ceil(maxApyValue * 1.1), // Add 10% headroom
      maxX: Math.ceil(maxTimeValue * 1.1),
    };
  }, [markets, activeMarkets, underlyings, showExpired]);

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

  // Error state
  if (isError) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="py-8 text-center">
          <p className="text-destructive text-sm">Failed to load yield curve data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (allUnderlyings.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Yield Curve</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No active markets available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Term Structure</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Implied APY vs time to maturity across all markets
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey="x"
              name="Time to Expiry"
              domain={[0, maxX || 1]}
              tickFormatter={(v: number) => formatTimeToExpiry(v)}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              label={{
                value: 'Time to Maturity',
                position: 'bottom',
                offset: 0,
                style: { fill: 'var(--muted-foreground)', fontSize: 12 },
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Implied APY"
              domain={[0, maxY || 10]}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              label={{
                value: 'Implied APY',
                angle: -90,
                position: 'insideLeft',
                style: { fill: 'var(--muted-foreground)', fontSize: 12 },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 16 }}
              formatter={(value: string) => (
                <span className="text-foreground text-sm">{value}</span>
              )}
            />

            {/* Reference line at 0% APY */}
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />

            {/* Scatter plots for each underlying */}
            {allUnderlyings.map((symbol) => (
              <Scatter
                key={symbol}
                name={symbol}
                data={chartDataByUnderlying.get(symbol) ?? []}
                fill={getUnderlyingColor(symbol)}
                shape="circle"
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Active Markets</div>
            <div className="text-foreground font-medium">{activeMarkets.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Underlyings</div>
            <div className="text-foreground font-medium">{allUnderlyings.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Avg APY</div>
            <div className="text-primary font-medium">
              {formatApy(
                activeMarkets.length > 0
                  ? activeMarkets.reduce((sum, m) => sum + m.impliedApyPercent, 0) /
                      activeMarkets.length
                  : 0
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact yield curve showing just the curve line without detailed info
 */
export function YieldCurveCompact({ className }: { className?: string }): ReactNode {
  const { activeMarkets, isLoading } = useYieldCurve();

  if (isLoading) {
    return <Skeleton className={cn('h-24 w-full', className)} />;
  }

  if (activeMarkets.length === 0) {
    return null;
  }

  // Sort by time to expiry and prepare data
  const sortedMarkets = [...activeMarkets].sort(
    (a, b) => a.timeToExpiryYears - b.timeToExpiryYears
  );

  const chartData = sortedMarkets.map((m) => ({
    x: m.timeToExpiryYears,
    y: m.impliedApyPercent,
  }));

  return (
    <div className={cn('h-24', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <XAxis type="number" dataKey="x" hide domain={[0, 'dataMax']} />
          <YAxis type="number" dataKey="y" hide domain={[0, 'dataMax']} />
          <Scatter data={chartData} fill="var(--primary)" shape="circle" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
