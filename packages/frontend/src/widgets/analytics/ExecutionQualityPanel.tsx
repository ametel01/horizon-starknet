'use client';

import { type ReactNode, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  ComposedChart,
  ReferenceLine,
} from 'recharts';

import {
  useExecutionQuality,
  type ImpactDistributionBucket,
  type DailyImpactStats,
} from '@features/analytics';
import { useDashboardMarkets } from '@features/markets';
import { cn } from '@shared/lib/utils';
import { formatWadCompact } from '@shared/math/wad';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@shared/ui';

/**
 * Format basis points with appropriate precision
 */
function formatBps(value: number): string {
  if (value === 0) return '0 bps';
  if (value < 1) return `${value.toFixed(2)} bps`;
  if (value < 10) return `${value.toFixed(1)} bps`;
  return `${String(Math.round(value))} bps`;
}

interface ExecutionQualityPanelProps {
  marketAddress: string;
  className?: string;
  defaultDays?: number;
}

/**
 * Custom tooltip for distribution chart
 */
function DistributionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ImpactDistributionBucket }[];
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <div className="text-foreground mb-1 font-medium">{data.label}</div>
      <div className="text-sm">
        <span className="text-muted-foreground">Swaps: </span>
        <span className="text-primary font-medium">{data.count}</span>
      </div>
    </div>
  );
}

/**
 * Custom tooltip for time series chart
 */
function TimeSeriestooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DailyImpactStats & { displayDate: string } }[];
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <div className="text-muted-foreground mb-2 text-xs">{data.displayDate}</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Median Impact:</span>
          <span className="text-primary font-medium">{formatBps(data.medianBps)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">95th Percentile:</span>
          <span className="text-destructive font-medium">{formatBps(data.p95Bps)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Swaps:</span>
          <span>{data.swapCount}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Execution Quality Panel
 *
 * Shows price impact distribution, statistics, and trends for a market.
 * This helps traders understand execution quality and liquidity depth.
 */
export function ExecutionQualityPanel({
  marketAddress,
  className,
  defaultDays = 30,
}: ExecutionQualityPanelProps): ReactNode {
  const [days, setDays] = useState(defaultDays);

  const { summary, distribution, timeSeries, recentSwaps, underlyingSymbol, isLoading, isError } =
    useExecutionQuality({ market: marketAddress, days });

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

  // Format time series data
  const timeSeriesData = useMemo(() => {
    return timeSeries.map((d) => ({
      ...d,
      displayDate: new Date(d.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [timeSeries]);

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="py-8 text-center">
          <p className="text-destructive text-sm">Failed to load execution quality data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (summary.totalSwaps === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Execution Quality</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No swap data available for this market</p>
        </CardContent>
      </Card>
    );
  }

  // Determine quality grade
  const qualityGrade =
    summary.medianImpactBps < 5
      ? { label: 'Excellent', color: 'text-primary' }
      : summary.medianImpactBps < 15
        ? { label: 'Good', color: 'text-chart-2' }
        : summary.medianImpactBps < 30
          ? { label: 'Fair', color: 'text-chart-4' }
          : { label: 'Poor', color: 'text-destructive' };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Execution Quality</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            {resolvedSymbol && `${resolvedSymbol} market`} - {summary.totalSwaps} swaps
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Quality badge */}
          <div
            className={cn(
              'rounded-full px-3 py-1 text-sm font-medium',
              qualityGrade.color,
              qualityGrade.label === 'Excellent'
                ? 'bg-primary/10'
                : qualityGrade.label === 'Good'
                  ? 'bg-chart-2/10'
                  : qualityGrade.label === 'Fair'
                    ? 'bg-chart-4/10'
                    : 'bg-destructive/10'
            )}
          >
            {qualityGrade.label}
          </div>

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
      </CardHeader>
      <CardContent>
        {/* Key metrics */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-muted-foreground text-xs">Median Impact</div>
            <div className="text-primary text-lg font-medium">
              {formatBps(summary.medianImpactBps)}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-muted-foreground text-xs">95th Percentile</div>
            <div className="text-destructive text-lg font-medium">
              {formatBps(summary.p95ImpactBps)}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-muted-foreground text-xs">Avg Trade Size</div>
            <div className="text-foreground text-lg font-medium">
              {formatWadCompact(summary.avgTradeSizeSy)} SY
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-muted-foreground text-xs">Max Impact</div>
            <div className="text-muted-foreground text-lg font-medium">
              {formatBps(summary.maxImpactBps)}
            </div>
          </div>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="distribution">
          <TabsList className="mb-4">
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="timeseries">Trend</TabsTrigger>
            <TabsTrigger value="recent">Recent Swaps</TabsTrigger>
          </TabsList>

          {/* Distribution histogram */}
          <TabsContent value="distribution">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<DistributionTooltip />} />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Swaps" />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-muted-foreground mt-2 text-center text-xs">
              Distribution of price impacts across all swaps
            </p>
          </TabsContent>

          {/* Time series */}
          <TabsContent value="timeseries">
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart
                data={timeSeriesData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="displayDate" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => v.toFixed(0)}
                />
                <Tooltip content={<TimeSeriestooltip />} />

                {/* Reference line at 10 bps (good threshold) */}
                <ReferenceLine
                  y={10}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 3"
                  label={{
                    value: '10 bps',
                    position: 'right',
                    style: { fill: 'var(--muted-foreground)', fontSize: 10 },
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="medianBps"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                  name="Median"
                />
                <Line
                  type="monotone"
                  dataKey="p95Bps"
                  stroke="var(--destructive)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                  name="P95"
                />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-muted-foreground mt-2 text-center text-xs">
              Daily median and 95th percentile impact over time
            </p>
          </TabsContent>

          {/* Recent swaps table */}
          <TabsContent value="recent">
            <div className="max-h-[200px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-muted-foreground px-2 py-2 text-left font-medium">Time</th>
                    <th className="text-muted-foreground px-2 py-2 text-left font-medium">
                      Direction
                    </th>
                    <th className="text-muted-foreground px-2 py-2 text-right font-medium">Size</th>
                    <th className="text-muted-foreground px-2 py-2 text-right font-medium">
                      Impact
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentSwaps.slice(0, 10).map((swap, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="text-muted-foreground px-2 py-2 text-xs">
                        {new Date(swap.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-xs',
                            swap.direction === 'buy_pt'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-chart-2/10 text-chart-2'
                          )}
                        >
                          {swap.direction === 'buy_pt' ? 'Buy PT' : 'Sell PT'}
                        </span>
                      </td>
                      <td className="text-foreground px-2 py-2 text-right font-mono text-xs">
                        {formatWadCompact(swap.tradeSizeSy)}
                      </td>
                      <td
                        className={cn(
                          'px-2 py-2 text-right font-medium',
                          swap.impactBps < 10
                            ? 'text-primary'
                            : swap.impactBps < 30
                              ? 'text-chart-4'
                              : 'text-destructive'
                        )}
                      >
                        {formatBps(swap.impactBps)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Interpretation note */}
        <div className="bg-muted/50 mt-4 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">
            <strong>Execution Quality:</strong> Lower impact is better. Median under 10 bps is
            excellent. High impact on large trades may indicate thin liquidity depth.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact execution quality indicator
 */
interface ExecutionQualityBadgeProps {
  marketAddress: string;
  className?: string;
}

export function ExecutionQualityBadge({
  marketAddress,
  className,
}: ExecutionQualityBadgeProps): ReactNode {
  const { summary, isLoading } = useExecutionQuality({ market: marketAddress, days: 30 });

  if (isLoading) {
    return <Skeleton className={cn('h-6 w-20', className)} />;
  }

  if (summary.totalSwaps === 0) {
    return null;
  }

  const quality =
    summary.medianImpactBps < 5
      ? { label: 'Low Impact', color: 'bg-primary/10 text-primary' }
      : summary.medianImpactBps < 15
        ? { label: 'Medium', color: 'bg-chart-2/10 text-chart-2' }
        : { label: 'High Impact', color: 'bg-destructive/10 text-destructive' };

  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', quality.color, className)}>
      {quality.label}
    </span>
  );
}
