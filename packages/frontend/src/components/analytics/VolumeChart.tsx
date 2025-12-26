'use client';

import { type ReactNode, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useDashboardMarkets } from '@/hooks/useMarkets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@/hooks/usePrices';
import { useProtocolVolume } from '@/hooks/useProtocolVolume';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';

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
 * Bar chart showing daily trading volume over time.
 * Displays volume in USD using token prices.
 */
export function VolumeChart({ className, height = 300, days = 30 }: VolumeChartProps): ReactNode {
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

  // Calculate current volume for display
  const currentVolume = useMemo(() => {
    if (!volumeData) return 0;
    const vol24h = Number(fromWad(volumeData.total24h.totalVolume));
    return vol24h * avgPrice;
  }, [volumeData, avgPrice]);

  // Loading state
  if (volumeLoading || pricesLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
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
          <p className="text-destructive text-sm">Failed to load volume data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Trading Volume</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No volume data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Trading Volume</CardTitle>
          <p className="text-muted-foreground text-sm">
            24h:{' '}
            <span className="text-foreground font-medium">{formatUsdCompact(currentVolume)}</span>
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
            <Tooltip
              contentStyle={{ borderRadius: '8px' }}
              cursor={false}
              formatter={(value: number | undefined) => [
                `$${(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                'Volume',
              ]}
              labelFormatter={(label: string) => label}
            />
            <Bar dataKey="volumeUsd" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
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

  if (volumeLoading || pricesLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full" style={{ height }} />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="py-8 text-center">
          <p className="text-destructive text-sm">Failed to load volume data</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Volume by Token Type</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No volume data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Volume by Token Type</CardTitle>
        <p className="text-muted-foreground text-sm">SY and PT trading volume breakdown</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
            <Tooltip
              contentStyle={{ borderRadius: '8px' }}
              cursor={false}
              formatter={(value: number | undefined, name: string | undefined) => {
                const label = name === 'syVolumeUsd' ? 'SY Volume' : 'PT Volume';
                return [
                  `$${(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                  label,
                ];
              }}
              labelFormatter={(label: string) => label}
            />
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

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--chart-1)' }} />
            <span className="text-muted-foreground">SY Volume</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--chart-3)' }} />
            <span className="text-muted-foreground">PT Volume</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
