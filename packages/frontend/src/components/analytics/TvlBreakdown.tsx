'use client';

import { type ReactNode, useMemo } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDashboardMarkets } from '@/hooks/useMarkets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@/hooks/usePrices';
import { fromWad } from '@/lib/math/wad';
import { cn } from '@/lib/utils';

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

interface TvlBreakdownProps {
  className?: string;
  height?: number;
}

interface MarketTvlData {
  name: string;
  value: number;
  valueUsd: number;
  tvlBigInt: bigint;
  address: string;
  color: string;
  [key: string]: string | number | bigint; // Index signature for Recharts compatibility
}

// Chart colors using CSS variables that adapt to theme
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

/**
 * Pie chart showing TVL breakdown by market.
 * Uses semantic chart colors that adapt to light/dark mode.
 */
export function TvlBreakdown({ className, height = 300 }: TvlBreakdownProps): ReactNode {
  const { markets, isLoading, isError } = useDashboardMarkets();

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

  // Format data for the pie chart with USD values
  const chartData = useMemo((): MarketTvlData[] => {
    if (markets.length === 0) return [];

    return markets
      .filter((market) => market.tvlSy > 0n)
      .map((market, index) => {
        const symbol = market.metadata?.yieldTokenSymbol;
        const priceAddr = getTokenAddressForPricing(symbol) ?? market.metadata?.underlyingAddress;
        const price = getTokenPrice(priceAddr, prices);
        const tvlNum = Number(fromWad(market.tvlSy));
        return {
          name: symbol ?? `Market ${String(index + 1)}`,
          value: tvlNum * price, // Use USD for chart segments
          valueUsd: tvlNum * price,
          tvlBigInt: market.tvlSy,
          address: market.address,
          color: CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0] ?? '',
        };
      })
      .sort((a, b) => b.value - a.value); // Sort by TVL descending
  }, [markets, prices]);

  // Calculate total TVL in USD
  const totalTvlUsd = useMemo(() => {
    return chartData.reduce((sum, m) => sum + m.valueUsd, 0);
  }, [chartData]);

  // Loading state
  if (isLoading || pricesLoading) {
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
          <p className="text-destructive text-sm">Failed to load market data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>TVL by Market</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No markets with TVL</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>TVL by Market</CardTitle>
        <p className="text-muted-foreground text-sm">
          Total:{' '}
          <span className="text-foreground font-medium">{formatUsdCompact(totalTvlUsd)}</span>
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
                <Cell key={`cell-${entry.address}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: '8px' }}
              formatter={(_value: number | undefined, name: string | undefined) => [
                formatUsdCompact(chartData.find((d) => d.name === name)?.valueUsd ?? 0),
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

        {/* Market list with TVL values */}
        <div className="mt-4 space-y-2">
          {chartData.map((market) => (
            <div key={market.address} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: market.color }} />
                <span className="text-foreground">{market.name}</span>
              </div>
              <span className="text-muted-foreground font-mono">
                {formatUsdCompact(market.valueUsd)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact version without the detailed list
 */
export function TvlBreakdownCompact({ className, height = 200 }: TvlBreakdownProps): ReactNode {
  const { markets, isLoading, isError } = useDashboardMarkets();

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

  const chartData = useMemo((): MarketTvlData[] => {
    if (markets.length === 0) return [];

    return markets
      .filter((market) => market.tvlSy > 0n)
      .map((market, index) => {
        const symbol = market.metadata?.yieldTokenSymbol;
        const priceAddr = getTokenAddressForPricing(symbol) ?? market.metadata?.underlyingAddress;
        const price = getTokenPrice(priceAddr, prices);
        const tvlNum = Number(fromWad(market.tvlSy));
        return {
          name: symbol ?? `Market ${String(index + 1)}`,
          value: tvlNum * price,
          valueUsd: tvlNum * price,
          tvlBigInt: market.tvlSy,
          address: market.address,
          color: CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0] ?? '',
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [markets, prices]);

  if (isLoading || pricesLoading) {
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
              <Cell key={`cell-${entry.address}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: '8px' }}
            formatter={(_value: number | undefined, name: string | undefined) => [
              formatUsdCompact(chartData.find((d) => d.name === name)?.valueUsd ?? 0),
              name ?? '',
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
