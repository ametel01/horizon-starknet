'use client';

import { useProtocolTvl } from '@features/analytics';
import { useDashboardMarkets } from '@features/markets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@features/price';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { ChartSkeleton, Skeleton } from '@shared/ui/Skeleton';
import { Calendar, CircleDot, DollarSign, Layers, Lock, TrendingUp } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Format USD value with compact notation for large numbers
 */
function formatUsdCompact(value: number): string {
  if (value === 0) return '$0';
  if (value < 0.01) return '<$0.01';
  if (value < 1000) return `$${value.toFixed(2)}`;
  if (value < 1_000_000) return `$${(value / 1000).toFixed(2)}K`;
  if (value < 1_000_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${(value / 1_000_000_000).toFixed(2)}B`;
}

interface TvlChartProps {
  className?: string;
  height?: number;
  /** Number of days of history (default: 30) */
  days?: number;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  tvl: number;
  syReserve: number;
  ptReserve: number;
  marketCount: number;
}

/**
 * Custom tooltip for TVL chart
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

  return (
    <div className="bg-popover/95 text-popover-foreground rounded-xl border p-3 shadow-lg backdrop-blur-sm">
      <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
        <Calendar className="h-3 w-3" />
        {data.displayDate}
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Total TVL
          </span>
          <span className="text-primary font-mono font-medium">{formatUsdCompact(data.tvl)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3 w-3" />
            SY Reserve
          </span>
          <span className="font-mono">{formatUsdCompact(data.syReserve)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <CircleDot className="h-3 w-3" />
            PT Reserve
          </span>
          <span className="font-mono">{formatUsdCompact(data.ptReserve)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * TVL Chart showing historical TVL over time.
 * Uses indexer data for historical time series.
 * Falls back to on-chain data with USD conversion when indexer unavailable.
 */
export function TvlChart({ className, height = 300, days = 30 }: TvlChartProps): ReactNode {
  const [mounted, setMounted] = useState(false);

  // Try to get historical data from indexer
  const { current: indexerCurrent, history, isLoading: indexerLoading } = useProtocolTvl({ days });

  // Fallback: get current on-chain data with USD pricing
  const { markets, isLoading: marketsLoading } = useDashboardMarkets();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get token addresses for pricing (for fallback mode)
  const tokenAddresses = useMemo(() => {
    const addresses = new Set<string>();
    for (const market of markets) {
      const symbol = market.metadata?.yieldTokenSymbol;
      const priceAddr = getTokenAddressForPricing(symbol) ?? market.metadata?.underlyingAddress;
      if (priceAddr) addresses.add(priceAddr);
    }
    return Array.from(addresses);
  }, [markets]);

  const { data: prices, isLoading: pricesLoading } = usePrices(tokenAddresses);

  // Calculate USD values for on-chain fallback
  const onChainCurrent = useMemo(() => {
    let totalSyReserveUsd = 0;
    let totalPtReserveUsd = 0;

    for (const market of markets) {
      const symbol = market.metadata?.yieldTokenSymbol;
      const priceAddr = getTokenAddressForPricing(symbol) ?? market.metadata?.underlyingAddress;
      const price = getTokenPrice(priceAddr, prices);
      const syReserveNum = Number(fromWad(market.state.syReserve));
      const ptReserveNum = Number(fromWad(market.state.ptReserve));

      totalSyReserveUsd += syReserveNum * price;
      totalPtReserveUsd += ptReserveNum * price;
    }

    return {
      totalTvlUsd: totalSyReserveUsd + totalPtReserveUsd,
      totalSyReserveUsd,
      totalPtReserveUsd,
      marketCount: markets.length,
    };
  }, [markets, prices]);

  // Use indexer history if available, otherwise show single current point
  const hasHistory = history.length > 1;

  // Format chart data
  const chartData = useMemo((): ChartDataPoint[] => {
    if (hasHistory) {
      // Use indexer historical data (values are in WAD, need to convert to USD)
      // For now, use raw token values (not USD) since we don't have historical prices
      return history.map((point) => ({
        date: point.date,
        displayDate: new Date(point.date).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        tvl: Number(fromWad(point.totalTvl)),
        syReserve: Number(fromWad(point.totalSyReserve)),
        ptReserve: Number(fromWad(point.totalPtReserve)),
        marketCount: point.marketCount,
      }));
    }

    // Fallback: single point with USD values
    if (onChainCurrent.totalTvlUsd > 0) {
      const today = new Date();
      return [
        {
          date: today.toISOString().split('T')[0] ?? '',
          displayDate: today.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          tvl: onChainCurrent.totalTvlUsd,
          syReserve: onChainCurrent.totalSyReserveUsd,
          ptReserve: onChainCurrent.totalPtReserveUsd,
          marketCount: onChainCurrent.marketCount,
        },
      ];
    }
    return [];
  }, [hasHistory, history, onChainCurrent]);

  // Current values for display
  const current = hasHistory
    ? {
        totalTvlUsd: Number(fromWad(indexerCurrent.totalTvl)),
        totalSyReserveUsd: Number(fromWad(indexerCurrent.totalSyReserve)),
        totalPtReserveUsd: Number(fromWad(indexerCurrent.totalPtReserve)),
        marketCount: indexerCurrent.marketCount,
      }
    : onChainCurrent;

  const isLoading = indexerLoading || marketsLoading || pricesLoading;

  // Loading state
  if (isLoading) {
    return (
      <ChartSkeleton className={className} height={height} chartType="area" showHeader showFooter />
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <div className={cn('border-border/50 bg-card overflow-hidden rounded-xl border', className)}>
        <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
          <Lock className="text-primary h-4 w-4" />
          <h3 className="text-foreground text-sm font-semibold">Total Value Locked</h3>
        </div>
        <div className="py-8 text-center">
          <DollarSign className="text-muted-foreground mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-muted-foreground text-sm">No TVL data available</p>
        </div>
      </div>
    );
  }

  // Single data point - show stats card instead of useless chart
  if (chartData.length === 1) {
    return (
      <div
        className={cn(
          'border-border/50 bg-card overflow-hidden rounded-xl border',
          'translate-y-2 opacity-0',
          mounted && 'translate-y-0 opacity-100',
          'transition-all duration-500',
          className
        )}
      >
        {/* Header */}
        <div className="border-border/50 flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Lock className="text-primary h-4 w-4" />
            <h3 className="text-foreground text-sm font-semibold">Total Value Locked</h3>
          </div>
        </div>

        {/* Stats-focused view for single data point */}
        <div className="p-6">
          <div className="mb-6 text-center">
            <div className="text-primary font-mono text-4xl font-bold">
              {formatUsdCompact(current.totalTvlUsd)}
            </div>
            <p className="text-muted-foreground mt-1 text-sm">Current Protocol TVL</p>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <div className="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
                <Layers className="h-3 w-3" />
                SY Reserve
              </div>
              <div className="text-foreground font-mono text-lg font-semibold">
                {formatUsdCompact(current.totalSyReserveUsd)}
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <div className="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
                <CircleDot className="h-3 w-3" />
                PT Reserve
              </div>
              <div className="text-foreground font-mono text-lg font-semibold">
                {formatUsdCompact(current.totalPtReserveUsd)}
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <div className="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
                <TrendingUp className="h-3 w-3" />
                Markets
              </div>
              <div className="text-foreground font-mono text-lg font-semibold">
                {current.marketCount}
              </div>
            </div>
          </div>

          {/* Info note */}
          <div className="bg-muted/30 mt-4 flex items-start gap-2 rounded-lg p-3">
            <Calendar className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="text-muted-foreground text-xs">
              Historical TVL chart will appear once more data points are available from the indexer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Full time series chart
  const maxTvl = Math.max(...chartData.map((d) => d.tvl));

  return (
    <div
      className={cn(
        'border-border/50 bg-card overflow-hidden rounded-xl border',
        'translate-y-2 opacity-0',
        mounted && 'translate-y-0 opacity-100',
        'transition-all duration-500',
        className
      )}
    >
      {/* Header */}
      <div className="border-border/50 flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Lock className="text-primary h-4 w-4" />
          <h3 className="text-foreground text-sm font-semibold">Total Value Locked</h3>
        </div>
        <div className="text-primary font-mono text-sm font-semibold">
          {formatUsdCompact(current.totalTvlUsd)}
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="displayDate" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={[0, maxTvl * 1.1]}
              tickFormatter={(value: number) => {
                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                return value.toFixed(0);
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="tvl"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#tvlGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Summary stats */}
        <div className="border-border/50 mt-4 grid grid-cols-3 gap-4 border-t pt-4">
          <div className="text-center">
            <div className="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <Layers className="h-3 w-3" />
              SY Reserve
            </div>
            <div className="text-foreground font-mono text-sm font-semibold">
              {formatUsdCompact(current.totalSyReserveUsd)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <CircleDot className="h-3 w-3" />
              PT Reserve
            </div>
            <div className="text-foreground font-mono text-sm font-semibold">
              {formatUsdCompact(current.totalPtReserveUsd)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <TrendingUp className="h-3 w-3" />
              Markets
            </div>
            <div className="text-foreground font-mono text-sm font-semibold">
              {current.marketCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact sparkline version of TVL chart for cards
 */
interface TvlSparklineProps {
  className?: string;
  height?: number;
}

export function TvlSparkline({ className, height = 60 }: TvlSparklineProps): ReactNode {
  const { markets, totalTvl, isLoading } = useDashboardMarkets();

  const chartData = useMemo(() => {
    if (totalTvl > 0n) {
      return [{ tvl: Number(fromWad(totalTvl)) }];
    }
    return [];
  }, [totalTvl]);

  if (isLoading) {
    return <Skeleton className={cn('w-full', className)} style={{ height }} />;
  }

  if (chartData.length === 0 || markets.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="tvl"
            stroke="var(--primary)"
            strokeWidth={1.5}
            fill="url(#sparklineGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
