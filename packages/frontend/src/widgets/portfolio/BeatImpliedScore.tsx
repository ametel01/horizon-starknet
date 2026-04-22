'use client';

import { useDashboardMarkets } from '@features/markets';
import {
  type BeatImpliedPosition,
  getScoreBgColor,
  getScoreColor,
  useBeatImplied,
} from '@features/portfolio';
import { cn } from '@shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@shared/ui';
import { type ReactNode, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Format APY percentage
 */
function formatApy(value: number): string {
  if (value === 0) return '0%';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Get bar color based on beat implied value
 */
function getBarColor(beatImplied: number): string {
  if (beatImplied > 2) return 'var(--primary)';
  if (beatImplied > 0) return 'var(--chart-2)';
  if (beatImplied > -2) return 'var(--muted-foreground)';
  return 'var(--destructive)';
}

interface ChartDataPoint {
  name: string;
  entryApy: number;
  realizedApy: number;
  beatImplied: number;
  position: BeatImpliedPosition;
}

/**
 * Custom tooltip for beat implied chart
 */
function BeatTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartDataPoint }[];
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const { position } = data;

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <div className="text-foreground mb-2 font-medium">{data.name}</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Entry APY:</span>
          <span className="text-foreground">{formatApy(position.entryImpliedApy)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Realized APY:</span>
          <span className="text-foreground">{formatApy(position.realizedApy)}</span>
        </div>
        <div className="flex justify-between gap-4 border-t pt-1">
          <span className="text-muted-foreground">Beat Implied:</span>
          <span
            className={cn(
              'font-medium',
              position.beatImplied >= 0 ? 'text-primary' : 'text-destructive'
            )}
          >
            {formatApy(position.beatImplied)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Holding:</span>
          <span className="text-muted-foreground">{Math.round(position.holdingDays)} days</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Score badge component
 */
function ScoreBadge({
  score,
  value,
  size = 'default',
}: {
  score: 'excellent' | 'good' | 'neutral' | 'poor';
  value: number;
  size?: 'default' | 'large';
}): ReactNode {
  const labels = {
    excellent: 'Excellent',
    good: 'Good',
    neutral: 'Neutral',
    poor: 'Poor',
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg p-3',
        getScoreBgColor(score),
        size === 'large' && 'p-4'
      )}
    >
      <span
        className={cn('font-bold', getScoreColor(score), size === 'large' ? 'text-3xl' : 'text-xl')}
      >
        {formatApy(value)}
      </span>
      <span
        className={cn(
          'font-medium',
          getScoreColor(score),
          size === 'large' ? 'text-sm' : 'text-xs'
        )}
      >
        {labels[score]}
      </span>
    </div>
  );
}

interface BeatImpliedScoreProps {
  className?: string;
  height?: number;
}

/**
 * Beat Implied Score widget
 *
 * Shows how user's positions are performing relative to the implied APY
 * at the time of entry. Positive "beat" means outperforming expectations.
 */
export function BeatImpliedScore({ className, height = 200 }: BeatImpliedScoreProps): ReactNode {
  const { positions, summary, isLoading, isError } = useBeatImplied();
  const { markets } = useDashboardMarkets();

  // Build YT to symbol map
  const ytSymbolMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const market of markets) {
      const symbol = market.metadata?.yieldTokenSymbol ?? 'Token';
      map.set(market.ytAddress.toLowerCase(), symbol);
    }
    return map;
  }, [markets]);

  // Format chart data
  const chartData = useMemo((): ChartDataPoint[] => {
    return positions.map((pos) => {
      const symbol = ytSymbolMap.get(pos.yt.toLowerCase()) ?? 'Unknown';
      return {
        name: `PT-${symbol}`,
        entryApy: pos.entryImpliedApy,
        realizedApy: pos.realizedApy,
        beatImplied: pos.beatImplied,
        position: pos,
      };
    });
  }, [positions, ytSymbolMap]);

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
          <p className="text-destructive text-sm">Failed to load beat implied data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (positions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Beat Implied Score</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No active positions to analyze</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Beat Implied Score</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">Are you outperforming the market?</p>
          </div>
          <ScoreBadge score={summary.overallScore} value={summary.avgBeatImplied} size="large" />
        </div>
      </CardHeader>
      <CardContent>
        {/* Chart */}
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${String(v)}%`}
            />
            <Tooltip content={<BeatTooltip />} />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
            <Bar dataKey="beatImplied" radius={[4, 4, 0, 0]} name="Beat Implied">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${String(index)}`} fill={getBarColor(entry.beatImplied)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-4 gap-4 border-t pt-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Avg Entry APY</div>
            <div className="text-foreground font-medium">{summary.avgEntryApy.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Avg Realized</div>
            <div className="text-foreground font-medium">{summary.avgRealizedApy.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Beating</div>
            <div className="text-primary font-medium">{summary.positionsBeating}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Lagging</div>
            <div className="text-destructive font-medium">{summary.positionsLagging}</div>
          </div>
        </div>

        {/* Interpretation note */}
        <div className="bg-muted/50 mt-4 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">
            <strong>Beat Implied:</strong> Compares your realized returns against the implied APY at
            entry. Positive score means you&apos;re earning more than the market expected. Consider
            entry timing and market conditions when evaluating performance.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact beat implied indicator
 */
interface BeatImpliedBadgeProps {
  className?: string;
}

export function BeatImpliedBadge({ className }: BeatImpliedBadgeProps): ReactNode {
  const { summary, isLoading } = useBeatImplied();

  if (isLoading) {
    return <Skeleton className={cn('h-6 w-20', className)} />;
  }

  if (summary.totalPositions === 0) {
    return null;
  }

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        getScoreColor(summary.overallScore),
        getScoreBgColor(summary.overallScore),
        className
      )}
    >
      {formatApy(summary.avgBeatImplied)} vs implied
    </span>
  );
}
