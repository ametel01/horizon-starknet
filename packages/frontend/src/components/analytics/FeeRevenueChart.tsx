'use client';

import { type ReactNode, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useProtocolFees } from '@/hooks/api';
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

type TimeRange = '7d' | '30d' | '90d';

interface FeeRevenueChartProps {
  className?: string;
  height?: number;
  defaultRange?: TimeRange;
  /** Show time range controls */
  showControls?: boolean;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  feesUsd: number;
  swapCount: number;
  avgFeeUsd: number;
}

/**
 * Bar/Area chart showing daily fee revenue over time.
 * Displays fees in USD using token prices.
 */
export function FeeRevenueChart({
  className,
  height = 300,
  defaultRange = '30d',
  showControls = true,
}: FeeRevenueChartProps): ReactNode {
  const [range, setRange] = useState<TimeRange>(defaultRange);

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;

  const { history, total24h, total7d, total30d, isLoading, isError } = useProtocolFees({ days });
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

  // Get average price for fee conversion
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
    if (history.length === 0) return [];

    const data = history.map((point) => {
      const feesNum = Number(fromWad(point.totalFees));
      const feesUsd = feesNum * avgPrice;
      const avgFeeUsd = point.swapCount > 0 ? feesUsd / point.swapCount : 0;

      // Parse date and format for display
      const dateObj = new Date(point.date);
      const displayDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      return {
        date: point.date,
        displayDate,
        feesUsd,
        swapCount: point.swapCount,
        avgFeeUsd,
      };
    });

    // If we have a single data point, add padding days around it for better visualization
    if (data.length === 1 && data[0]) {
      const singlePoint = data[0];
      const dateObj = new Date(singlePoint.date);

      // Add a day before with zero
      const dayBefore = new Date(dateObj);
      dayBefore.setDate(dayBefore.getDate() - 1);

      // Add a day after with zero
      const dayAfter = new Date(dateObj);
      dayAfter.setDate(dayAfter.getDate() + 1);

      return [
        {
          date: dayBefore.toISOString().split('T')[0] ?? '',
          displayDate: dayBefore.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          feesUsd: 0,
          swapCount: 0,
          avgFeeUsd: 0,
        },
        singlePoint,
        {
          date: dayAfter.toISOString().split('T')[0] ?? '',
          displayDate: dayAfter.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          feesUsd: 0,
          swapCount: 0,
          avgFeeUsd: 0,
        },
      ];
    }

    return data;
  }, [history, avgPrice]);

  // Calculate current period fees for display
  const currentFees = useMemo(() => {
    const fees24h = Number(fromWad(total24h)) * avgPrice;
    const fees7d = Number(fromWad(total7d)) * avgPrice;
    const fees30d = Number(fromWad(total30d)) * avgPrice;

    return { fees24h, fees7d, fees30d };
  }, [total24h, total7d, total30d, avgPrice]);

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
          <p className="text-destructive text-sm">Failed to load fee data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Fee Revenue</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No fee data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Fee Revenue</CardTitle>
          <div className="text-muted-foreground flex gap-4 text-sm">
            <span>
              24h:{' '}
              <span className="text-foreground font-medium">
                {formatUsdCompact(currentFees.fees24h)}
              </span>
            </span>
            <span>
              7d:{' '}
              <span className="text-foreground font-medium">
                {formatUsdCompact(currentFees.fees7d)}
              </span>
            </span>
            <span>
              30d:{' '}
              <span className="text-foreground font-medium">
                {formatUsdCompact(currentFees.fees30d)}
              </span>
            </span>
          </div>
        </div>
        {showControls && (
          <ToggleGroup>
            <ToggleGroupItem
              pressed={range === '7d'}
              onPressedChange={() => {
                setRange('7d');
              }}
            >
              7D
            </ToggleGroupItem>
            <ToggleGroupItem
              pressed={range === '30d'}
              onPressedChange={() => {
                setRange('30d');
              }}
            >
              30D
            </ToggleGroupItem>
            <ToggleGroupItem
              pressed={range === '90d'}
              onPressedChange={() => {
                setRange('90d');
              }}
            >
              90D
            </ToggleGroupItem>
          </ToggleGroup>
        )}
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
                if (name === 'feesUsd') {
                  return [
                    `$${(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                    'Fees',
                  ];
                }
                return [value, name];
              }}
              labelFormatter={(label: string) => label}
            />
            <Bar dataKey="feesUsd" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Compact fee stats card with sparkline
 */
interface FeeStatsCardProps {
  className?: string;
}

export function FeeStatsCard({ className }: FeeStatsCardProps): ReactNode {
  const { history, total24h, total7d, isLoading, isError } = useProtocolFees({ days: 7 });
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
    const data = history.map((point) => {
      const dateObj = new Date(point.date);
      return {
        fees: Number(fromWad(point.totalFees)) * avgPrice,
        displayDate: dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      };
    });

    // If we have less than 2 points, pad with zeros to make a visible chart
    if (data.length === 0) {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return [
        {
          fees: 0,
          displayDate: yesterday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        },
        {
          fees: 0,
          displayDate: today.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        },
      ];
    }
    if (data.length === 1 && data[0]) {
      // Add a day before with zero
      const dateObj = new Date(history[0]?.date ?? '');
      const dayBefore = new Date(dateObj);
      dayBefore.setDate(dayBefore.getDate() - 1);
      return [
        {
          fees: 0,
          displayDate: dayBefore.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        },
        data[0],
      ];
    }
    return data;
  }, [history, avgPrice]);

  const fees24hUsd = Number(fromWad(total24h)) * avgPrice;
  const fees7dUsd = Number(fromWad(total7d)) * avgPrice;

  if (isLoading || pricesLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="p-4 text-center">
          <p className="text-destructive text-sm">Failed to load fees</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardContent className="flex flex-1 flex-col p-4">
        <div className="mb-4">
          <p className="text-muted-foreground text-sm">Fee Revenue</p>
          <p className="text-2xl font-bold">{formatUsdCompact(fees24hUsd)}</p>
          <p className="text-muted-foreground text-xs">7d: {formatUsdCompact(fees7dUsd)}</p>
        </div>
        <div className="min-h-[120px] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="feeSparklineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="displayDate"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--muted-foreground)' }}
              />
              <Area
                type="monotone"
                dataKey="fees"
                stroke="var(--chart-2)"
                strokeWidth={2}
                fill="url(#feeSparklineGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
