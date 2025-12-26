'use client';

import { type ReactNode, useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useDashboardMarkets } from '@features/markets';
import { usePositionPnl } from '@features/portfolio';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@shared/ui';

/**
 * Format date for grouping (YYYY-MM-DD)
 */
function formatDateKey(dateStr: string): string {
  return new Date(dateStr).toISOString().split('T')[0] ?? dateStr;
}

/**
 * Format date for display
 */
function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  dailyYield: number;
  cumulativeYield: number;
  claimCount: number;
}

/**
 * Custom tooltip for yield chart
 */
function YieldTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartDataPoint }[];
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <div className="text-muted-foreground mb-2 text-xs">{data.displayDate}</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Daily Yield:</span>
          <span className="text-primary font-medium">+{data.dailyYield.toFixed(6)} SY</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Cumulative:</span>
          <span className="text-foreground font-medium">{data.cumulativeYield.toFixed(6)} SY</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Claims:</span>
          <span className="text-muted-foreground">{data.claimCount}</span>
        </div>
      </div>
    </div>
  );
}

interface YtCashflowChartProps {
  className?: string;
  height?: number;
  days?: number;
  /** Filter to specific YT address */
  ytAddress?: string;
}

/**
 * YT Cashflow Chart
 *
 * Visualizes cumulative YT yield claims over time.
 * Shows daily yield bars and cumulative yield line.
 */
export function YtCashflowChart({
  className,
  height = 250,
  days = 90,
  ytAddress,
}: YtCashflowChartProps): ReactNode {
  const { yieldClaimHistory, isLoading, isError } = usePositionPnl({ days });
  const { markets } = useDashboardMarkets();

  // Get YT symbol for title
  const ytSymbol = useMemo(() => {
    if (!ytAddress) return null;
    const market = markets.find((m) => m.ytAddress.toLowerCase() === ytAddress.toLowerCase());
    return market?.metadata?.yieldTokenSymbol ?? null;
  }, [markets, ytAddress]);

  // Filter claims if ytAddress is specified
  const filteredClaims = useMemo(() => {
    if (!ytAddress) return yieldClaimHistory;
    return yieldClaimHistory.filter((c) => c.yt.toLowerCase() === ytAddress.toLowerCase());
  }, [yieldClaimHistory, ytAddress]);

  // Aggregate claims by day
  const chartData = useMemo((): ChartDataPoint[] => {
    if (filteredClaims.length === 0) return [];

    // Group by date
    const byDate = new Map<string, { total: bigint; count: number }>();

    for (const claim of filteredClaims) {
      const dateKey = formatDateKey(claim.timestamp);
      const existing = byDate.get(dateKey) ?? { total: 0n, count: 0 };
      existing.total += BigInt(claim.amountSy);
      existing.count += 1;
      byDate.set(dateKey, existing);
    }

    // Sort by date and calculate cumulative
    const sortedDates = Array.from(byDate.keys()).sort();
    let cumulative = 0n;
    const result: ChartDataPoint[] = [];

    for (const date of sortedDates) {
      const dayData = byDate.get(date);
      if (!dayData) continue;

      cumulative += dayData.total;

      result.push({
        date,
        displayDate: formatDisplayDate(date),
        dailyYield: Number(fromWad(dayData.total)),
        cumulativeYield: Number(fromWad(cumulative)),
        claimCount: dayData.count,
      });
    }

    return result;
  }, [filteredClaims]);

  // Calculate totals
  const { totalYield, totalClaims, avgDailyYield } = useMemo(() => {
    if (chartData.length === 0) {
      return { totalYield: 0, totalClaims: 0, avgDailyYield: 0 };
    }

    const lastPoint = chartData[chartData.length - 1];
    const total = lastPoint?.cumulativeYield ?? 0;
    const claims = chartData.reduce((sum, d) => sum + d.claimCount, 0);
    const avg = total / chartData.length;

    return { totalYield: total, totalClaims: claims, avgDailyYield: avg };
  }, [chartData]);

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
          <p className="text-destructive text-sm">Failed to load yield data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{ytSymbol ? `YT-${ytSymbol} Cashflow` : 'YT Cashflow'}</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No yield claims yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{ytSymbol ? `YT-${ytSymbol} Cashflow` : 'YT Yield Cashflow'}</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">Cumulative yield earned over time</p>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-xs">Total Earned</div>
            <div className="text-primary text-lg font-medium">{totalYield.toFixed(4)} SY</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="displayDate" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              yAxisId="daily"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v.toFixed(3)}
            />
            <YAxis
              yAxisId="cumulative"
              orientation="right"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v.toFixed(2)}
            />
            <Tooltip content={<YieldTooltip />} />
            <Bar
              yAxisId="daily"
              dataKey="dailyYield"
              fill="var(--primary)"
              opacity={0.6}
              radius={[2, 2, 0, 0]}
              name="Daily"
            />
            <Line
              yAxisId="cumulative"
              type="monotone"
              dataKey="cumulativeYield"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
              name="Cumulative"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Total Claims</div>
            <div className="text-foreground font-medium">{totalClaims}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Avg Daily</div>
            <div className="text-foreground font-medium">{avgDailyYield.toFixed(6)} SY</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Period</div>
            <div className="text-foreground font-medium">{chartData.length} days</div>
          </div>
        </div>

        {/* Educational note */}
        <div className="bg-muted/50 mt-4 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">
            <strong>YT Cashflow:</strong> Yield Tokens (YT) accumulate interest from the underlying
            yield-bearing asset. This chart shows your claimed yield over time. Regular claiming
            helps compound your returns.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact YT yield indicator
 */
interface YtYieldCompactProps {
  ytAddress?: string;
  className?: string;
}

export function YtYieldCompact({ ytAddress, className }: YtYieldCompactProps): ReactNode {
  const { yieldClaimHistory, isLoading } = usePositionPnl({ days: 30 });

  const totalYield = useMemo(() => {
    const claims = ytAddress
      ? yieldClaimHistory.filter((c) => c.yt.toLowerCase() === ytAddress.toLowerCase())
      : yieldClaimHistory;

    return claims.reduce((sum, c) => sum + Number(fromWad(BigInt(c.amountSy))), 0);
  }, [yieldClaimHistory, ytAddress]);

  if (isLoading) {
    return <Skeleton className={cn('h-10 w-24', className)} />;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
        +{totalYield.toFixed(4)} SY
      </div>
      <span className="text-muted-foreground text-xs">30d yield</span>
    </div>
  );
}
