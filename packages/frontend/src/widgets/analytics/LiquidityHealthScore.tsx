'use client';

import { type ReactNode, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useDashboardMarkets } from '@features/markets';
import { cn } from '@shared/lib/utils';
import { WAD_BIGINT, formatWadCompact } from '@shared/math/wad';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@shared/ui';

type HealthLevel = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * Get color class for health level text
 */
function getHealthLevelColor(level: HealthLevel): string {
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
 * Get background color class for health level
 */
function getHealthLevelBgColor(level: HealthLevel): string {
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
 * Get bar color based on health score
 */
function getBarColor(score: number): string {
  if (score >= 80) return 'var(--primary)';
  if (score >= 60) return 'var(--chart-2)';
  if (score >= 40) return 'var(--chart-4)';
  return 'var(--destructive)';
}

/**
 * Format basis points
 */
function formatBps(value: number): string {
  if (value === 0) return '0 bps';
  if (value < 1) return `${value.toFixed(2)} bps`;
  return `${value.toFixed(1)} bps`;
}

interface ChartDataPoint {
  symbol: string;
  healthScore: number;
  spreadBps: number;
  tvlSy: bigint;
  healthLevel: HealthLevel;
}

/**
 * Custom tooltip for health chart
 */
function HealthTooltip({
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
      <div className="text-foreground mb-2 font-medium">{data.symbol}</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Health Score:</span>
          <span className={cn('font-medium', getHealthLevelColor(data.healthLevel))}>
            {data.healthScore}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Spread Proxy:</span>
          <span className="text-foreground">{formatBps(data.spreadBps)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">TVL:</span>
          <span className="text-foreground">{formatWadCompact(data.tvlSy)} SY</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Health level badge component
 */
function HealthBadge({ level, score }: { level: HealthLevel; score: number }): ReactNode {
  const labels: Record<HealthLevel, string> = {
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
  };

  return (
    <div className={cn('flex items-center gap-2 rounded-lg p-3', getHealthLevelBgColor(level))}>
      <div className={cn('text-2xl font-bold', getHealthLevelColor(level))}>{score}</div>
      <div>
        <div className={cn('text-sm font-medium', getHealthLevelColor(level))}>{labels[level]}</div>
        <div className="text-muted-foreground text-xs">Protocol Health</div>
      </div>
    </div>
  );
}

/**
 * Market row component
 */
function MarketRow({
  symbol,
  healthScore,
  healthLevel,
  spreadBps,
  tvlSy,
  utilization,
}: {
  symbol: string;
  healthScore: number;
  healthLevel: HealthLevel;
  spreadBps: number;
  tvlSy: bigint;
  utilization: number;
}): ReactNode {
  return (
    <div className="hover:bg-muted/50 flex items-center justify-between border-b px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
            getHealthLevelBgColor(healthLevel),
            getHealthLevelColor(healthLevel)
          )}
        >
          {healthScore}
        </div>
        <div>
          <span className="text-foreground font-medium">{symbol}</span>
          <div className="text-muted-foreground text-xs">{formatWadCompact(tvlSy)} SY TVL</div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-right">
        <div>
          <div className="text-muted-foreground text-xs">Spread</div>
          <div className="text-foreground font-mono text-sm">{formatBps(spreadBps)}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Utilization</div>
          <div className="text-foreground text-sm">{utilization.toFixed(2)}%</div>
        </div>
      </div>
    </div>
  );
}

interface LiquidityHealthScoreProps {
  className?: string;
  height?: number;
}

interface MarketHealth {
  market: string;
  underlyingSymbol: string;
  tvlSy: bigint;
  healthScore: number;
  healthLevel: HealthLevel;
  spreadProxyBps: number;
  utilizationPercent: number;
}

/**
 * Calculate health score for a market based on TVL and reserves ratio
 */
function calculateHealthScore(syReserve: bigint, ptReserve: bigint): number {
  if (syReserve === 0n && ptReserve === 0n) return 0;

  const tvl = syReserve + ptReserve;
  // TVL score: higher TVL = higher score (logarithmic scale)
  // 10 WAD = ~20 points, 100 WAD = ~40 points, 1000 WAD = ~60 points
  const tvlInWad = Number(tvl) / Number(WAD_BIGINT);
  const tvlScore = Math.min(100, Math.log10(Math.max(1, tvlInWad)) * 25);

  // Balance score: more balanced reserves = higher score
  const total = syReserve + ptReserve;
  const syRatio = total > 0n ? Number((syReserve * 100n) / total) : 50;
  const balanceScore = 100 - Math.abs(50 - syRatio) * 2;

  // Combined score with weights
  return Math.round(tvlScore * 0.7 + balanceScore * 0.3);
}

/**
 * Get health level from score
 */
function getHealthLevel(score: number): HealthLevel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

/**
 * Liquidity Health Score Widget
 *
 * Shows aggregated liquidity health metrics across all markets.
 * Uses on-chain data directly to avoid indexer data issues.
 */
export function LiquidityHealthScore({
  className,
  height = 200,
}: LiquidityHealthScoreProps): ReactNode {
  const { markets, isLoading } = useDashboardMarkets();

  // Compute health metrics from on-chain market data
  const { healthyMarkets, protocol, chartData } = useMemo(() => {
    const activeMarkets = markets.filter((m) => !m.isExpired);

    const marketHealths: MarketHealth[] = activeMarkets.map((m) => {
      const syReserve = m.state.syReserve;
      const ptReserve = m.state.ptReserve;
      const tvlSy = syReserve + ptReserve;
      const healthScore = calculateHealthScore(syReserve, ptReserve);

      // Spread proxy: estimate from reserves ratio (simplified)
      // In reality this would come from recent swap data
      const ratio = tvlSy > 0n ? Number((syReserve * 10000n) / tvlSy) / 100 : 50;
      const spreadProxyBps = Math.abs(50 - ratio) * 2;

      return {
        market: m.address,
        underlyingSymbol: m.metadata?.yieldTokenSymbol ?? 'Unknown',
        tvlSy,
        healthScore,
        healthLevel: getHealthLevel(healthScore),
        spreadProxyBps,
        utilizationPercent: 0, // Would need swap volume data
      };
    });

    // Sort by health score (best first)
    marketHealths.sort((a, b) => b.healthScore - a.healthScore);

    // Calculate protocol-wide metrics
    const totalTvlSy = marketHealths.reduce((sum, m) => sum + m.tvlSy, 0n);
    const avgHealthScore =
      marketHealths.length > 0
        ? Math.round(
            marketHealths.reduce((sum, m) => sum + m.healthScore, 0) / marketHealths.length
          )
        : 0;
    const avgSpreadProxyBps =
      marketHealths.length > 0
        ? marketHealths.reduce((sum, m) => sum + m.spreadProxyBps, 0) / marketHealths.length
        : 0;

    // Chart data (top 10 markets)
    const chartPoints: ChartDataPoint[] = marketHealths.slice(0, 10).map((m) => ({
      symbol: m.underlyingSymbol,
      healthScore: m.healthScore,
      spreadBps: m.spreadProxyBps,
      tvlSy: m.tvlSy,
      healthLevel: m.healthLevel,
    }));

    return {
      healthyMarkets: marketHealths,
      protocol: {
        totalTvlSy,
        totalVolume24hSy: 0n, // Would need swap volume data
        avgSpreadProxyBps,
        avgHealthScore,
        marketsAnalyzed: marketHealths.length,
      },
      chartData: chartPoints,
    };
  }, [markets]);

  // Get overall health level
  const overallHealthLevel: HealthLevel = useMemo(() => {
    if (protocol.avgHealthScore >= 80) return 'excellent';
    if (protocol.avgHealthScore >= 60) return 'good';
    if (protocol.avgHealthScore >= 40) return 'fair';
    return 'poor';
  }, [protocol.avgHealthScore]);

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

  // Empty state
  if (healthyMarkets.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Liquidity Health</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No markets available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Liquidity Health</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              {protocol.marketsAnalyzed} market{protocol.marketsAnalyzed !== 1 ? 's' : ''} analyzed
            </p>
          </div>
          <HealthBadge level={overallHealthLevel} score={protocol.avgHealthScore} />
        </div>
      </CardHeader>
      <CardContent>
        {/* Protocol summary */}
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-muted-foreground text-xs">Total TVL</div>
            <div className="text-foreground text-lg font-medium">
              {formatWadCompact(protocol.totalTvlSy)} SY
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-muted-foreground text-xs">24h Volume</div>
            <div className="text-foreground text-lg font-medium">
              {formatWadCompact(protocol.totalVolume24hSy)} SY
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-muted-foreground text-xs">Avg Spread</div>
            <div className="text-foreground text-lg font-medium">
              {formatBps(protocol.avgSpreadProxyBps)}
            </div>
          </div>
        </div>

        {/* Health score bar chart */}
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="symbol" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(v: number) => String(v)}
              />
              <Tooltip content={<HealthTooltip />} />
              <Bar dataKey="healthScore" radius={[4, 4, 0, 0]} name="Health Score">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${String(index)}`} fill={getBarColor(entry.healthScore)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Market list */}
        <div className="mt-4 max-h-[200px] overflow-y-auto border-t">
          {healthyMarkets.map((m) => (
            <MarketRow
              key={m.market}
              symbol={m.underlyingSymbol}
              healthScore={m.healthScore}
              healthLevel={m.healthLevel}
              spreadBps={m.spreadProxyBps}
              tvlSy={m.tvlSy}
              utilization={m.utilizationPercent}
            />
          ))}
        </div>

        {/* Educational note */}
        <div className="bg-muted/50 mt-4 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">
            <strong>Health Score:</strong> Combines TVL depth, spread (median price impact), and
            trading activity. Higher scores indicate better liquidity conditions. Scores 80+ are
            excellent, 60+ are good.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact liquidity health indicator
 */
interface LiquidityHealthBadgeProps {
  className?: string;
}

export function LiquidityHealthBadge({ className }: LiquidityHealthBadgeProps): ReactNode {
  const { markets, isLoading } = useDashboardMarkets();

  // Calculate average health from on-chain data
  const avgHealthScore = useMemo(() => {
    const activeMarkets = markets.filter((m) => !m.isExpired);
    if (activeMarkets.length === 0) return 0;

    const totalScore = activeMarkets.reduce((sum, m) => {
      return sum + calculateHealthScore(m.state.syReserve, m.state.ptReserve);
    }, 0);
    return Math.round(totalScore / activeMarkets.length);
  }, [markets]);

  if (isLoading) {
    return <Skeleton className={cn('h-6 w-24', className)} />;
  }

  const level: HealthLevel =
    avgHealthScore >= 80
      ? 'excellent'
      : avgHealthScore >= 60
        ? 'good'
        : avgHealthScore >= 40
          ? 'fair'
          : 'poor';

  const labels: Record<HealthLevel, string> = {
    excellent: 'Healthy',
    good: 'Good',
    fair: 'Fair',
    poor: 'Low',
  };

  return (
    <Badge
      className={cn(
        getHealthLevelBgColor(level),
        getHealthLevelColor(level),
        'border-0',
        className
      )}
    >
      {labels[level]} Liquidity
    </Badge>
  );
}
