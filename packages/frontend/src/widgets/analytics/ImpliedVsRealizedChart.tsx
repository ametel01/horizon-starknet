'use client';

import { type ReactNode, useMemo, useState } from 'react';
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts';

import { useImpliedVsRealized } from '@features/analytics';
import { useDashboardMarkets } from '@features/markets';
import { cn } from '@shared/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';

/**
 * Format APY percentage with appropriate precision
 */
function formatApy(value: number): string {
  if (value === 0) return '0%';
  if (Math.abs(value) < 0.01) return '<0.01%';
  if (Math.abs(value) < 1) return `${value.toFixed(2)}%`;
  return `${value.toFixed(1)}%`;
}

interface ImpliedVsRealizedChartProps {
  marketAddress: string;
  className?: string;
  height?: number;
  showControls?: boolean;
  defaultDays?: number;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  implied: number;
  realized: number;
  spread: number;
}

/**
 * Custom tooltip for implied vs realized chart
 */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartDataPoint; name: string; color: string }[];
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <div className="text-muted-foreground mb-2 text-xs">{data.displayDate}</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Implied APY:</span>
          <span className="text-primary font-medium">{formatApy(data.implied)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Realized APY:</span>
          <span style={{ color: 'var(--chart-2)' }} className="font-medium">
            {formatApy(data.realized)}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t pt-1">
          <span className="text-muted-foreground">Spread:</span>
          <span
            className={cn('font-medium', data.spread >= 0 ? 'text-primary' : 'text-destructive')}
          >
            {data.spread >= 0 ? '+' : ''}
            {formatApy(data.spread)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Implied vs Realized APY Chart
 *
 * Compares the market's implied APY (from PT pricing) against the
 * actual realized yield from the underlying asset. The spread shows
 * whether the market is pricing in higher or lower yields than reality.
 */
export function ImpliedVsRealizedChart({
  marketAddress,
  className,
  height = 300,
  showControls = true,
  defaultDays = 30,
}: ImpliedVsRealizedChartProps): ReactNode {
  const [days, setDays] = useState(defaultDays);

  const { dataPoints, summary, underlyingSymbol, isLoading, isError } = useImpliedVsRealized({
    market: marketAddress,
    days,
  });

  // Get proper symbol from dashboard markets if API returns Unknown
  const { markets: dashboardMarkets } = useDashboardMarkets();
  const resolvedSymbol = useMemo(() => {
    if (underlyingSymbol && underlyingSymbol !== 'Unknown') {
      return underlyingSymbol;
    }
    const market = dashboardMarkets.find(
      (m) => m.address.toLowerCase() === marketAddress.toLowerCase()
    );
    return market?.metadata?.yieldTokenSymbol ?? underlyingSymbol;
  }, [underlyingSymbol, dashboardMarkets, marketAddress]);

  // Format data for the chart
  const chartData = useMemo((): ChartDataPoint[] => {
    return dataPoints.map((point) => ({
      date: point.date,
      displayDate: new Date(point.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      implied: point.impliedApyPercent,
      realized: point.realizedApyPercent,
      spread: point.spreadPercent,
    }));
  }, [dataPoints]);

  // Calculate Y-axis domain
  const { minY, maxY } = useMemo(() => {
    if (chartData.length === 0) return { minY: 0, maxY: 10 };
    const allValues = chartData.flatMap((d) => [d.implied, d.realized]);
    const min = Math.min(...allValues, 0);
    const max = Math.max(...allValues);
    const padding = (max - min) * 0.1;
    return {
      minY: Math.floor(min - padding),
      maxY: Math.ceil(max + padding),
    };
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
          <p className="text-destructive text-sm">Failed to load APY comparison data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Implied vs Realized APY</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No APY data available for this market</p>
        </CardContent>
      </Card>
    );
  }

  // Determine spread interpretation
  const spreadInterpretation =
    summary.avgSpread > 0.5
      ? 'Market expects higher yields than realized'
      : summary.avgSpread < -0.5
        ? 'Market expects lower yields than realized'
        : 'Market is fairly priced vs realized yields';

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Implied vs Realized APY</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            {resolvedSymbol && `${resolvedSymbol} market`}
          </p>
        </div>

        {showControls && (
          <div className="flex items-center gap-2">
            <Select
              value={String(days)}
              onValueChange={(value) => {
                setDays(Number(value));
              }}
            >
              <SelectTrigger size="sm" className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7D</SelectItem>
                <SelectItem value="30">30D</SelectItem>
                <SelectItem value="90">90D</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* Custom legend with clear visual distinction */}
        <div className="mb-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="bg-primary h-0.5 w-6" />
            <span className="text-muted-foreground">Implied APY</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-0.5 w-6"
              style={{
                background:
                  'repeating-linear-gradient(to right, var(--chart-2), var(--chart-2) 4px, transparent 4px, transparent 8px)',
              }}
            />
            <span className="text-muted-foreground">Realized APY</span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="spreadGradientPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="spreadGradientNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="displayDate" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              domain={[minY, maxY]}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Reference line at 0% */}
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />

            {/* Spread area between the two lines */}
            <Area
              type="monotone"
              dataKey="implied"
              stroke="transparent"
              fill={
                summary.avgSpread >= 0
                  ? 'url(#spreadGradientPositive)'
                  : 'url(#spreadGradientNegative)'
              }
              name="Spread Area"
              legendType="none"
            />

            {/* Implied APY line */}
            <Line
              type="monotone"
              dataKey="implied"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
              name="Implied APY"
              legendType="none"
            />

            {/* Realized APY line */}
            <Line
              type="monotone"
              dataKey="realized"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
              name="Realized APY"
              strokeDasharray="4 4"
              legendType="none"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-4 gap-4 border-t pt-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Avg Implied</div>
            <div className="text-primary font-medium">{formatApy(summary.avgImpliedApy)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Avg Realized</div>
            <div className="font-medium" style={{ color: 'var(--chart-2)' }}>
              {formatApy(summary.avgRealizedApy)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Avg Spread</div>
            <div
              className={cn(
                'font-medium',
                summary.avgSpread >= 0 ? 'text-primary' : 'text-destructive'
              )}
            >
              {summary.avgSpread >= 0 ? '+' : ''}
              {formatApy(summary.avgSpread)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Current</div>
            <div className="text-foreground font-medium">
              {formatApy(summary.currentImpliedApy)}
            </div>
          </div>
        </div>

        {/* Interpretation note */}
        <div className="bg-muted/50 mt-4 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">
            <strong>Spread Analysis:</strong> {spreadInterpretation}. Positive spread means traders
            expect future yields to exceed what the underlying has recently delivered.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact spread indicator showing current implied vs realized
 */
interface SpreadIndicatorProps {
  marketAddress: string;
  className?: string;
}

export function SpreadIndicator({ marketAddress, className }: SpreadIndicatorProps): ReactNode {
  const { summary, isLoading } = useImpliedVsRealized({
    market: marketAddress,
    days: 30,
  });

  if (isLoading) {
    return <Skeleton className={cn('h-10 w-32', className)} />;
  }

  const spread = summary.avgSpread;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
          spread >= 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
        )}
      >
        {spread >= 0 ? (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
        {spread >= 0 ? '+' : ''}
        {formatApy(spread)} spread
      </div>
    </div>
  );
}
