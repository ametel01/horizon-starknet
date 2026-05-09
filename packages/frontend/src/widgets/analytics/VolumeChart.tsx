'use client';

import { useDashboardMarkets } from '@features/markets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@features/price';
import { useProtocolVolume } from '@features/protocol-status';
import { useHydrated } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@shared/ui/recharts';
import { ChartSkeleton } from '@shared/ui/Skeleton';
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Calendar,
  Layers,
  TrendingUp,
  Users,
} from 'lucide-react';
import { type ReactNode, useMemo } from 'react';

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

interface VolumeChartProps {
  className?: string;
  height?: number;
  days?: number;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  volumeUsd: number;
  syVolumeUsd: number;
  ptVolumeUsd: number;
  swapCount: number;
}

/**
 * Custom tooltip for volume chart
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
        <Calendar className="size-3" />
        {data.displayDate}
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <BarChart3 className="size-3" />
            Volume
          </span>
          <span className="text-primary font-mono font-medium">
            {formatUsdCompact(data.volumeUsd)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <ArrowLeftRight className="size-3" />
            Swaps
          </span>
          <span className="font-mono">{data.swapCount}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Custom tooltip for stacked volume chart
 */
function StackedTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: { displayDate: string; syVolumeUsd: number; ptVolumeUsd: number; swapCount: number };
  }[];
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-popover/95 text-popover-foreground rounded-xl border p-3 shadow-lg backdrop-blur-sm">
      <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
        <Calendar className="size-3" />
        {data.displayDate}
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: 'var(--chart-1)' }} />
            <span className="text-muted-foreground">SY Volume</span>
          </span>
          <span className="font-mono">{formatUsdCompact(data.syVolumeUsd)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: 'var(--chart-3)' }} />
            <span className="text-muted-foreground">PT Volume</span>
          </span>
          <span className="font-mono">{formatUsdCompact(data.ptVolumeUsd)}</span>
        </div>
        <div className="border-border/50 flex items-center justify-between gap-4 border-t pt-1.5">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <ArrowLeftRight className="size-3" />
            Swaps
          </span>
          <span className="font-mono">{data.swapCount}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Bar chart showing daily trading volume over time.
 * Displays volume in USD using token prices.
 */
export function VolumeChart({ className, height = 300, days = 30 }: VolumeChartProps): ReactNode {
  const mounted = useHydrated();
  const { data: volumeData, isLoading: volumeLoading, isError } = useProtocolVolume({ days });
  const { markets } = useDashboardMarkets();

  // Get token addresses for pricing
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

  // Get average price for volume conversion
  const avgPrice = useMemo(() => {
    if (!prices || tokenAddresses.length === 0) return 1;
    let totalPrice = 0;
    let count = 0;
    for (const addr of tokenAddresses) {
      const price = getTokenPrice(addr, prices);
      if (price > 0) {
        totalPrice += price;
        count++;
      }
    }
    return count > 0 ? totalPrice / count : 1;
  }, [prices, tokenAddresses]);

  // Format data for the chart
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!volumeData) return [];

    const data = volumeData.history.map((point) => {
      const syVolNum = Number(fromWad(point.syVolume));
      const ptVolNum = Number(fromWad(point.ptVolume));
      const totalVolNum = Number(fromWad(point.totalVolume));

      return {
        date: point.date,
        displayDate: point.displayDate,
        volumeUsd: totalVolNum * avgPrice,
        syVolumeUsd: syVolNum * avgPrice,
        ptVolumeUsd: ptVolNum * avgPrice,
        swapCount: point.swapCount,
      };
    });

    // If we have a single data point, add padding days around it for better visualization
    if (data.length === 1 && data[0]) {
      const singlePoint = data[0];
      const dateObj = new Date(singlePoint.date);

      const dayBefore = new Date(dateObj);
      dayBefore.setDate(dayBefore.getDate() - 1);

      const dayAfter = new Date(dateObj);
      dayAfter.setDate(dayAfter.getDate() + 1);

      return [
        {
          date: dayBefore.toISOString().split('T')[0] ?? '',
          displayDate: dayBefore.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          volumeUsd: 0,
          syVolumeUsd: 0,
          ptVolumeUsd: 0,
          swapCount: 0,
        },
        singlePoint,
        {
          date: dayAfter.toISOString().split('T')[0] ?? '',
          displayDate: dayAfter.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          volumeUsd: 0,
          syVolumeUsd: 0,
          ptVolumeUsd: 0,
          swapCount: 0,
        },
      ];
    }

    return data;
  }, [volumeData, avgPrice]);

  // Calculate stats for display
  const stats = useMemo(() => {
    if (!volumeData) {
      return { vol24h: 0, vol7d: 0, swaps24h: 0, uniqueUsers: 0 };
    }
    return {
      vol24h: Number(fromWad(volumeData.total24h.totalVolume)) * avgPrice,
      vol7d: Number(fromWad(volumeData.total7d.totalVolume)) * avgPrice,
      swaps24h: volumeData.total24h.swapCount,
      uniqueUsers: volumeData.total24h.uniqueSwappers,
    };
  }, [volumeData, avgPrice]);

  const isLoading = volumeLoading || pricesLoading;

  // Loading state
  if (isLoading) {
    return (
      <ChartSkeleton className={className} height={height} chartType="bar" showHeader showFooter />
    );
  }

  // Error state
  if (isError) {
    return (
      <div
        className={cn('border-destructive/50 bg-card overflow-hidden rounded-xl border', className)}
      >
        <div className="py-8 text-center">
          <BarChart3 className="text-destructive mx-auto mb-2 size-8 opacity-50" />
          <p className="text-destructive text-sm">Failed to load volume data</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <div className={cn('border-border/50 bg-card overflow-hidden rounded-xl border', className)}>
        <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
          <BarChart3 className="text-primary size-4" />
          <h3 className="text-foreground text-sm font-semibold">Trading Volume</h3>
        </div>
        <div className="py-8 text-center">
          <Activity className="text-muted-foreground mx-auto mb-2 size-8 opacity-50" />
          <p className="text-muted-foreground text-sm">No volume data available</p>
        </div>
      </div>
    );
  }

  const maxVolume = Math.max(...chartData.map((d) => d.volumeUsd));

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
          <BarChart3 className="text-primary size-4" />
          <h3 className="text-foreground text-sm font-semibold">Trading Volume</h3>
        </div>
        <div className="text-primary font-mono text-sm font-semibold">
          {formatUsdCompact(stats.vol24h)}
          <span className="text-muted-foreground ml-1 font-normal">24h</span>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="displayDate" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={[0, maxVolume * 1.1]}
              tickFormatter={(value: number) => {
                if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
                return `$${value.toFixed(0)}`;
              }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} />
            <Bar dataKey="volumeUsd" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>

        {/* Summary stats */}
        <div className="border-border/50 mt-4 grid grid-cols-4 gap-4 border-t pt-4">
          <div className="text-center">
            <div className="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <TrendingUp className="size-3" />
              24h Vol
            </div>
            <div className="text-foreground font-mono text-sm font-semibold">
              {formatUsdCompact(stats.vol24h)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <BarChart3 className="size-3" />
              7d Vol
            </div>
            <div className="text-foreground font-mono text-sm font-semibold">
              {formatUsdCompact(stats.vol7d)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <ArrowLeftRight className="size-3" />
              24h Swaps
            </div>
            <div className="text-foreground font-mono text-sm font-semibold">{stats.swaps24h}</div>
          </div>
          <div className="text-center">
            <div className="text-muted-foreground mb-1 flex items-center justify-center gap-1 text-xs">
              <Users className="size-3" />
              Traders
            </div>
            <div className="text-foreground font-mono text-sm font-semibold">
              {stats.uniqueUsers}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Stacked bar chart showing SY vs PT volume breakdown
 */
interface VolumeStackedChartProps {
  className?: string;
  height?: number;
  days?: number;
}

export function VolumeStackedChart({
  className,
  height = 300,
  days = 30,
}: VolumeStackedChartProps): ReactNode {
  const mounted = useHydrated();
  const { data: volumeData, isLoading: volumeLoading, isError } = useProtocolVolume({ days });
  const { markets } = useDashboardMarkets();

  // Get token addresses for pricing
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

  const avgPrice = useMemo(() => {
    if (!prices || tokenAddresses.length === 0) return 1;
    let totalPrice = 0;
    let count = 0;
    for (const addr of tokenAddresses) {
      const price = getTokenPrice(addr, prices);
      if (price > 0) {
        totalPrice += price;
        count++;
      }
    }
    return count > 0 ? totalPrice / count : 1;
  }, [prices, tokenAddresses]);

  const chartData = useMemo(() => {
    if (!volumeData) return [];

    return volumeData.history.map((point) => {
      const syVolNum = Number(fromWad(point.syVolume));
      const ptVolNum = Number(fromWad(point.ptVolume));

      return {
        date: point.date,
        displayDate: point.displayDate,
        syVolumeUsd: syVolNum * avgPrice,
        ptVolumeUsd: ptVolNum * avgPrice,
        swapCount: point.swapCount,
      };
    });
  }, [volumeData, avgPrice]);

  // Calculate totals for stats
  const totals = useMemo(() => {
    if (!volumeData) return { syTotal: 0, ptTotal: 0 };
    const sy = Number(fromWad(volumeData.total7d.syVolume)) * avgPrice;
    const pt = Number(fromWad(volumeData.total7d.ptVolume)) * avgPrice;
    return { syTotal: sy, ptTotal: pt };
  }, [volumeData, avgPrice]);

  const isLoading = volumeLoading || pricesLoading;

  if (isLoading) {
    return (
      <ChartSkeleton
        className={className}
        height={height}
        chartType="bar"
        showHeader
        showFooter={false}
      />
    );
  }

  if (isError) {
    return (
      <div
        className={cn('border-destructive/50 bg-card overflow-hidden rounded-xl border', className)}
      >
        <div className="py-8 text-center">
          <BarChart3 className="text-destructive mx-auto mb-2 size-8 opacity-50" />
          <p className="text-destructive text-sm">Failed to load volume data</p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className={cn('border-border/50 bg-card overflow-hidden rounded-xl border', className)}>
        <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
          <Layers className="text-primary size-4" />
          <h3 className="text-foreground text-sm font-semibold">Volume by Token Type</h3>
        </div>
        <div className="py-8 text-center">
          <Activity className="text-muted-foreground mx-auto mb-2 size-8 opacity-50" />
          <p className="text-muted-foreground text-sm">No volume data available</p>
        </div>
      </div>
    );
  }

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
          <Layers className="text-primary size-4" />
          <h3 className="text-foreground text-sm font-semibold">Volume by Token Type</h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm" style={{ backgroundColor: 'var(--chart-1)' }} />
            SY
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm" style={{ backgroundColor: 'var(--chart-3)' }} />
            PT
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="displayDate" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => {
                if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
                return `$${value.toFixed(0)}`;
              }}
            />
            <Tooltip content={<StackedTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} />
            <Bar
              dataKey="syVolumeUsd"
              stackId="volume"
              fill="var(--chart-1)"
              radius={[0, 0, 0, 0]}
              maxBarSize={40}
              name="SY Volume"
            />
            <Bar
              dataKey="ptVolumeUsd"
              stackId="volume"
              fill="var(--chart-3)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
              name="PT Volume"
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Summary stats */}
        <div className="border-border/50 mt-4 grid grid-cols-2 gap-4 border-t pt-4">
          <div className="text-center">
            <div className="mb-1 flex items-center justify-center gap-1 text-xs">
              <span className="size-2 rounded-sm" style={{ backgroundColor: 'var(--chart-1)' }} />
              <span className="text-muted-foreground">SY Volume (7d)</span>
            </div>
            <div className="text-foreground font-mono text-lg font-semibold">
              {formatUsdCompact(totals.syTotal)}
            </div>
          </div>
          <div className="text-center">
            <div className="mb-1 flex items-center justify-center gap-1 text-xs">
              <span className="size-2 rounded-sm" style={{ backgroundColor: 'var(--chart-3)' }} />
              <span className="text-muted-foreground">PT Volume (7d)</span>
            </div>
            <div className="text-foreground font-mono text-lg font-semibold">
              {formatUsdCompact(totals.ptTotal)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
