'use client';

import { useDashboardMarkets } from '@features/markets';
import { type PositionPnlSummary, usePositionPnl } from '@features/portfolio';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import {
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
import { ClientDaysUntilExpiry } from '@shared/ui/client-time';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@shared/ui/recharts';
import { type ReactNode, useMemo, useState } from 'react';

/**
 * Format percentage with sign
 */
function formatPnlPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  ptBalance: number;
  ytBalance: number;
  cumulativeYield: number;
}

/**
 * Custom tooltip for the timeline chart
 */
function TimelineTooltip({
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
          <span className="text-muted-foreground">PT Balance:</span>
          <span className="text-foreground font-medium">{data.ptBalance.toFixed(4)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">YT Balance:</span>
          <span className="text-foreground font-medium">{data.ytBalance.toFixed(4)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Yield Earned:</span>
          <span className="text-primary font-medium">{data.cumulativeYield.toFixed(4)} SY</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Position row component
 */
function PositionRow({
  position,
  ytSymbol,
}: {
  position: PositionPnlSummary;
  ytSymbol: string;
}): ReactNode {
  const ptBalance = Number(fromWad(BigInt(position.currentPtBalance)));
  const ytBalance = Number(fromWad(BigInt(position.currentYtBalance)));
  const yieldClaimed = Number(fromWad(BigInt(position.totalYieldClaimed)));
  const unrealizedPnl = Number(fromWad(BigInt(position.unrealizedPnlSy)));

  return (
    <div className="hover:bg-muted/50 flex items-center justify-between border-b px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-foreground text-sm font-medium">{ytSymbol}</span>
          <span className="text-muted-foreground text-xs" suppressHydrationWarning>
            {position.isExpired ? 'Expired' : <ClientDaysUntilExpiry expiry={position.expiry} />}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-6 text-right">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">PT / YT</span>
          <span className="text-foreground font-mono text-sm">
            {ptBalance.toFixed(2)} / {ytBalance.toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">Yield Earned</span>
          <span className="text-primary text-sm font-medium">{yieldClaimed.toFixed(4)} SY</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">Unrealized P&L</span>
          <span
            className={cn(
              'text-sm font-medium',
              unrealizedPnl >= 0 ? 'text-primary' : 'text-destructive'
            )}
          >
            {formatPnlPercent(position.unrealizedPnlPercent)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface PositionPnlTimelineProps {
  className?: string;
  height?: number;
  days?: number;
}

/**
 * Position P&L Timeline widget
 *
 * Shows historical P&L timeline with position balances and yield earned over time.
 */
export function PositionPnlTimeline({
  className,
  height = 300,
  days = 90,
}: PositionPnlTimelineProps): ReactNode {
  const [activeTab, setActiveTab] = useState('timeline');
  const { positions, timeline, summary, isLoading, isError } = usePositionPnl({ days });
  const { markets } = useDashboardMarkets();

  // Build YT to symbol map
  const ytSymbolMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const market of markets) {
      const symbol = market.metadata?.yieldTokenSymbol ?? 'Token';
      map.set(market.ytAddress.toLowerCase(), `PT/YT-${symbol}`);
    }
    return map;
  }, [markets]);

  // Format timeline data for chart
  const chartData = useMemo((): ChartDataPoint[] => {
    return timeline.map((point) => ({
      date: point.date,
      displayDate: formatDate(point.date),
      ptBalance: Number(fromWad(BigInt(point.ptBalance))),
      ytBalance: Number(fromWad(BigInt(point.ytBalance))),
      cumulativeYield: Number(fromWad(BigInt(point.cumulativeYieldSy))),
    }));
  }, [timeline]);

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
          <p className="text-destructive text-sm">Failed to load P&L timeline</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (positions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Position P&L</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No positions found</p>
        </CardContent>
      </Card>
    );
  }

  const totalYield = Number(fromWad(BigInt(summary.totalYieldClaimedSy)));
  const totalUnrealized = Number(fromWad(BigInt(summary.totalUnrealizedPnlSy)));

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Position P&L Timeline</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              {summary.totalPositions} active position{summary.totalPositions !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-muted-foreground text-xs">Total Yield</div>
              <div className="text-primary font-medium">{totalYield.toFixed(4)} SY</div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground text-xs">Overall P&L</div>
              <div
                className={cn(
                  'font-medium',
                  summary.overallPnlPercent >= 0 ? 'text-primary' : 'text-destructive'
                )}
              >
                {formatPnlPercent(summary.overallPnlPercent)}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pnlYieldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="displayDate" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="balance"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => v.toFixed(1)}
                  />
                  <YAxis
                    yAxisId="yield"
                    orientation="right"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => v.toFixed(2)}
                  />
                  <Tooltip content={<TimelineTooltip />} />
                  <ReferenceLine
                    y={0}
                    yAxisId="balance"
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                  />
                  <Area
                    yAxisId="yield"
                    type="monotone"
                    dataKey="cumulativeYield"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#pnlYieldGradient)"
                    name="Yield"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center" style={{ height }}>
                <p className="text-muted-foreground text-sm">No timeline data available</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="positions">
            <div className="max-h-[300px] overflow-y-auto">
              {positions.map((pos) => {
                const ytSymbol = ytSymbolMap.get(pos.yt.toLowerCase()) ?? 'PT/YT';
                return <PositionRow key={pos.yt} position={pos} ytSymbol={ytSymbol} />;
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Total Minted</div>
            <div className="text-foreground font-medium">
              {positions
                .reduce((sum, p) => sum + Number(fromWad(BigInt(p.totalPtMinted))), 0)
                .toFixed(4)}{' '}
              PT
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Yield Claims</div>
            <div className="text-foreground font-medium">
              {positions.reduce((sum, p) => sum + p.yieldClaimCount, 0)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Unrealized</div>
            <div
              className={cn(
                'font-medium',
                totalUnrealized >= 0 ? 'text-primary' : 'text-destructive'
              )}
            >
              {totalUnrealized >= 0 ? '+' : ''}
              {totalUnrealized.toFixed(4)} SY
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
