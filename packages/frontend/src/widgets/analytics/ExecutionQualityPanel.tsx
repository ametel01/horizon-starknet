'use client';

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  Gauge,
  Info,
  Layers,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
  Skeleton,
  StatCardSkeleton,
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
    <div className="bg-popover/95 text-popover-foreground rounded-xl border p-3 shadow-lg backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <BarChart3 className="text-primary h-4 w-4" />
        <span className="text-foreground font-medium">{data.label}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-muted-foreground">Swaps</span>
        <span className="text-primary font-mono font-medium">{data.count}</span>
      </div>
    </div>
  );
}

/**
 * Custom tooltip for time series chart
 */
function TimeSeriesTooltiop({
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
    <div className="bg-popover/95 text-popover-foreground rounded-xl border p-3 shadow-lg backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <Calendar className="text-muted-foreground h-4 w-4" />
        <span className="text-foreground font-medium">{data.displayDate}</span>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span className="bg-primary h-2 w-2 rounded-full" />
            Median
          </span>
          <span className="text-primary font-mono font-medium">{formatBps(data.medianBps)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span className="bg-destructive h-2 w-2 rounded-full" />
            95th %ile
          </span>
          <span className="text-destructive font-mono font-medium">{formatBps(data.p95Bps)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Swaps</span>
          <span className="font-mono">{data.swapCount}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Quality grade configuration
 */
function getQualityGrade(medianImpactBps: number): {
  label: string;
  color: string;
  bgColor: string;
  icon: ReactNode;
} {
  if (medianImpactBps < 5) {
    return {
      label: 'Excellent',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      icon: <CheckCircle className="h-4 w-4" />,
    };
  }
  if (medianImpactBps < 15) {
    return {
      label: 'Good',
      color: 'text-chart-2',
      bgColor: 'bg-chart-2/10',
      icon: <TrendingUp className="h-4 w-4" />,
    };
  }
  if (medianImpactBps < 30) {
    return {
      label: 'Fair',
      color: 'text-chart-4',
      bgColor: 'bg-chart-4/10',
      icon: <Activity className="h-4 w-4" />,
    };
  }
  return {
    label: 'Poor',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    icon: <AlertTriangle className="h-4 w-4" />,
  };
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
  const [mounted, setMounted] = useState(false);
  const [days, setDays] = useState(defaultDays);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    return () => {
      clearTimeout(timer);
    };
  }, []);

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
      <div className={cn('border-border/50 bg-card overflow-hidden rounded-xl border', className)}>
        {/* Header skeleton */}
        <div className="border-border/50 flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" variant="shimmer" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-36" variant="shimmer" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-20 rounded-full" variant="shimmer" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        </div>

        <div className="p-4">
          {/* Stats grid skeleton */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCardSkeleton compact delay={0} />
            <StatCardSkeleton compact delay={50} />
            <StatCardSkeleton compact delay={100} />
            <StatCardSkeleton compact delay={150} />
          </div>

          {/* Tabs skeleton */}
          <div className="mb-4 flex gap-2">
            <Skeleton className="h-9 w-28 rounded-md" variant="shimmer" />
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>

          {/* Chart area skeleton */}
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div
        className={cn(
          'border-destructive/50 bg-card overflow-hidden rounded-xl border',
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          'transition-all duration-500',
          className
        )}
      >
        <div className="flex items-center gap-2 border-b p-4">
          <Gauge className="text-destructive h-5 w-5" />
          <span className="font-medium">Execution Quality</span>
        </div>
        <div className="py-8 text-center">
          <AlertTriangle className="text-destructive mx-auto mb-2 h-8 w-8" />
          <p className="text-destructive text-sm">Failed to load execution quality data</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (summary.totalSwaps === 0) {
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
          <Gauge className="text-primary h-5 w-5" />
          <span className="font-medium">Execution Quality</span>
        </div>
        <div className="py-8 text-center">
          <Activity className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">No swap data available for this market</p>
        </div>
      </div>
    );
  }

  const qualityGrade = getQualityGrade(summary.medianImpactBps);

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
          <Gauge className="text-primary h-5 w-5" />
          <div>
            <span className="font-medium">Execution Quality</span>
            <p className="text-muted-foreground text-xs">
              {resolvedSymbol && `${resolvedSymbol} market`} · {summary.totalSwaps.toLocaleString()}{' '}
              swaps
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quality badge */}
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
              qualityGrade.bgColor,
              qualityGrade.color
            )}
          >
            {qualityGrade.icon}
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
      </div>

      <div className="p-4">
        {/* Key metrics */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <TrendingUp className="text-primary h-3.5 w-3.5" />
              <span className="text-muted-foreground text-xs">Median Impact</span>
            </div>
            <div className="text-primary font-mono text-lg font-semibold">
              {formatBps(summary.medianImpactBps)}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <AlertTriangle className="text-destructive h-3.5 w-3.5" />
              <span className="text-muted-foreground text-xs">95th Percentile</span>
            </div>
            <div className="text-destructive font-mono text-lg font-semibold">
              {formatBps(summary.p95ImpactBps)}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <Layers className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-muted-foreground text-xs">Avg Trade Size</span>
            </div>
            <div className="text-foreground font-mono text-lg font-semibold">
              {formatWadCompact(summary.avgTradeSizeSy)} SY
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <Zap className="text-chart-4 h-3.5 w-3.5" />
              <span className="text-muted-foreground text-xs">Max Impact</span>
            </div>
            <div className="text-chart-4 font-mono text-lg font-semibold">
              {formatBps(summary.maxImpactBps)}
            </div>
          </div>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="distribution">
          <TabsList className="mb-4">
            <TabsTrigger value="distribution" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Distribution
            </TabsTrigger>
            <TabsTrigger value="timeseries" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Trend
            </TabsTrigger>
            <TabsTrigger value="recent" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Recent
            </TabsTrigger>
          </TabsList>

          {/* Distribution histogram */}
          <TabsContent value="distribution">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<DistributionTooltip />} />
                <Bar dataKey="count" fill="url(#barGradient)" radius={[4, 4, 0, 0]} name="Swaps" />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-muted-foreground mt-2 text-center text-xs">
              Distribution of price impacts across all swaps
            </p>
          </TabsContent>

          {/* Time series with area chart */}
          <TabsContent value="timeseries">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="medianGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="displayDate" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v.toFixed(0)}bps`}
                />
                <Tooltip content={<TimeSeriesTooltiop />} />

                {/* Reference line at 10 bps (good threshold) */}
                <ReferenceLine
                  y={10}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 3"
                  label={{
                    value: '10 bps',
                    position: 'right',
                    style: { fill: 'var(--muted-foreground)', fontSize: 9 },
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="medianBps"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#medianGradient)"
                  name="Median"
                />
                <Area
                  type="monotone"
                  dataKey="p95Bps"
                  stroke="var(--destructive)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  fill="none"
                  name="P95"
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-muted-foreground mt-2 text-center text-xs">
              Daily median and 95th percentile impact over time
            </p>
          </TabsContent>

          {/* Recent swaps table with enhanced styling */}
          <TabsContent value="recent">
            <div className="max-h-[200px] overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">
                      Time
                    </th>
                    <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">
                      Direction
                    </th>
                    <th className="text-muted-foreground px-3 py-2 text-right text-xs font-medium">
                      Size
                    </th>
                    <th className="text-muted-foreground px-3 py-2 text-right text-xs font-medium">
                      Impact
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentSwaps.slice(0, 10).map((swap, i) => (
                    <tr
                      key={i}
                      className="hover:bg-muted/30 border-b transition-colors last:border-0"
                    >
                      <td className="text-muted-foreground px-3 py-2 text-xs">
                        {new Date(swap.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                            swap.direction === 'buy_pt'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-chart-2/10 text-chart-2'
                          )}
                        >
                          {swap.direction === 'buy_pt' ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {swap.direction === 'buy_pt' ? 'Buy PT' : 'Sell PT'}
                        </span>
                      </td>
                      <td className="text-foreground px-3 py-2 text-right font-mono text-xs">
                        {formatWadCompact(swap.tradeSizeSy)}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right font-mono font-medium',
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
        <div className="bg-muted/50 mt-4 flex items-start gap-2 rounded-lg p-3">
          <Info className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-muted-foreground text-xs">
            <strong>Execution Quality:</strong> Lower impact is better. Median under 10 bps is
            excellent. High impact on large trades may indicate thin liquidity depth.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact execution quality indicator badge
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
      ? {
          label: 'Low Impact',
          color: 'bg-primary/10 text-primary',
          icon: <CheckCircle className="h-3 w-3" />,
        }
      : summary.medianImpactBps < 15
        ? {
            label: 'Medium',
            color: 'bg-chart-2/10 text-chart-2',
            icon: <Activity className="h-3 w-3" />,
          }
        : {
            label: 'High Impact',
            color: 'bg-destructive/10 text-destructive',
            icon: <AlertTriangle className="h-3 w-3" />,
          };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        quality.color,
        className
      )}
    >
      {quality.icon}
      {quality.label}
    </span>
  );
}
