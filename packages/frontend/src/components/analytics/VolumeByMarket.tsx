'use client';

import { type ReactNode, useMemo } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

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

// Chart colors using CSS variables that adapt to theme
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

interface VolumeByMarketProps {
  className?: string;
  height?: number;
}

interface VolumeBreakdownData {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

/**
 * Pie chart showing volume breakdown by token type (SY vs PT).
 * Note: Per-market breakdown requires additional indexer support.
 */
export function VolumeByMarket({ className, height = 300 }: VolumeByMarketProps): ReactNode {
  const { data: volumeData, isLoading: volumeLoading, isError } = useProtocolVolume({ days: 7 });
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

  // Format data for the pie chart - SY vs PT breakdown
  const chartData = useMemo((): VolumeBreakdownData[] => {
    if (!volumeData) return [];

    const syVolume7dNum = Number(fromWad(volumeData.total7d.syVolume));
    const ptVolume7dNum = Number(fromWad(volumeData.total7d.ptVolume));

    const syVolumeUsd = syVolume7dNum * avgPrice;
    const ptVolumeUsd = ptVolume7dNum * avgPrice;

    if (syVolumeUsd === 0 && ptVolumeUsd === 0) return [];

    return [
      {
        name: 'SY Volume',
        value: syVolumeUsd,
        color: CHART_COLORS[0] ?? '',
      },
      {
        name: 'PT Volume',
        value: ptVolumeUsd,
        color: CHART_COLORS[2] ?? '',
      },
    ].filter((d) => d.value > 0);
  }, [volumeData, avgPrice]);

  // Calculate total for display
  const totalVolumeUsd = useMemo(() => {
    return chartData.reduce((sum, d) => sum + d.value, 0);
  }, [chartData]);

  // Loading state
  if (volumeLoading || pricesLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="mx-auto rounded-full" style={{ width: height, height }} />
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
          <CardTitle>Volume Breakdown</CardTitle>
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
        <CardTitle>7D Volume Breakdown</CardTitle>
        <p className="text-muted-foreground text-sm">
          Total:{' '}
          <span className="text-foreground font-medium">{formatUsdCompact(totalVolumeUsd)}</span>
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }: { name?: string; percent?: number }) =>
                `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`
              }
              labelLine={{ stroke: 'var(--muted-foreground)' }}
            >
              {chartData.map((entry) => (
                <Cell key={`cell-${entry.name}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: '8px' }}
              formatter={(_value: number | undefined, name: string | undefined) => [
                formatUsdCompact(chartData.find((d) => d.name === name)?.value ?? 0),
                name ?? '',
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              formatter={(value: string) => (
                <span style={{ color: 'var(--foreground)' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Volume breakdown list */}
        <div className="mt-4 space-y-2">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-foreground">{item.name}</span>
              </div>
              <span className="text-muted-foreground font-mono">
                {formatUsdCompact(item.value)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact version showing just the percentages
 */
export function VolumeBreakdownCompact({
  className,
  height = 200,
}: VolumeByMarketProps): ReactNode {
  const { data: volumeData, isLoading: volumeLoading, isError } = useProtocolVolume({ days: 7 });
  const { markets } = useDashboardMarkets();

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

  const chartData = useMemo((): VolumeBreakdownData[] => {
    if (!volumeData) return [];

    const syVolume7dNum = Number(fromWad(volumeData.total7d.syVolume));
    const ptVolume7dNum = Number(fromWad(volumeData.total7d.ptVolume));

    const syVolumeUsd = syVolume7dNum * avgPrice;
    const ptVolumeUsd = ptVolume7dNum * avgPrice;

    if (syVolumeUsd === 0 && ptVolumeUsd === 0) return [];

    return [
      { name: 'SY', value: syVolumeUsd, color: CHART_COLORS[0] ?? '' },
      { name: 'PT', value: ptVolumeUsd, color: CHART_COLORS[2] ?? '' },
    ].filter((d) => d.value > 0);
  }, [volumeData, avgPrice]);

  if (volumeLoading || pricesLoading) {
    return <Skeleton className={cn('rounded-full', className)} style={{ width: height, height }} />;
  }

  if (isError || chartData.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: '8px' }}
            formatter={(_value: number | undefined, name: string | undefined) => [
              formatUsdCompact(chartData.find((d) => d.name === name)?.value ?? 0),
              name ?? '',
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
