'use client';

import { type ReactNode, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useDashboardMarkets } from '@/hooks/useMarkets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@/hooks/usePrices';
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

interface TvlChartProps {
  className?: string;
  height?: number;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  tvl: number;
  syReserve: number;
  ptReserve: number;
}

/**
 * Line chart showing TVL over time.
 * Uses on-chain data from market contracts for accurate reserves.
 * Note: Historical data requires indexer; currently shows current state only.
 */
export function TvlChart({ className, height = 300 }: TvlChartProps): ReactNode {
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

  // Calculate totals from on-chain market data with USD conversion
  const current = useMemo(() => {
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

  // Format data for the chart (single point with current data)
  const chartData = useMemo((): ChartDataPoint[] => {
    if (current.totalTvlUsd > 0) {
      const today = new Date();
      return [
        {
          date: today.toISOString().split('T')[0] ?? '',
          displayDate: today.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          tvl: current.totalTvlUsd,
          syReserve: current.totalSyReserveUsd,
          ptReserve: current.totalPtReserveUsd,
        },
      ];
    }
    return [];
  }, [current]);

  // Loading state
  if (isLoading || pricesLoading) {
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
          <p className="text-destructive text-sm">Failed to load TVL data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Total Value Locked</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No TVL data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Total Value Locked</CardTitle>
          <p className="text-muted-foreground text-sm">
            Current:{' '}
            <span className="text-foreground font-medium">
              {formatUsdCompact(current.totalTvlUsd)}
            </span>
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              formatter={(value: number | undefined) => [
                `$${(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                'TVL',
              ]}
              labelFormatter={(label: string) => label}
            />
            <Area
              type="monotone"
              dataKey="tvl"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#tvlGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
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
