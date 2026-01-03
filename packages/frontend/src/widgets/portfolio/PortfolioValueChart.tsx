'use client';

import { useDashboardMarkets } from '@features/markets';
import { usePortfolioHistory } from '@features/portfolio';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@features/price';
import { useStarknet } from '@features/wallet';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';
import { type ReactNode, useMemo, useState } from 'react';
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
 * Tooltip name display mapping for portfolio chart.
 */
const PORTFOLIO_CHART_LABELS: Record<string, string> = {
  totalValueUsd: 'Total',
  syBalanceUsd: 'SY',
  ptBalanceUsd: 'PT',
  ytBalanceUsd: 'YT',
  lpBalanceUsd: 'LP',
};

function getChartDisplayName(name: string | undefined): string {
  if (!name) return 'Unknown';
  return PORTFOLIO_CHART_LABELS[name] ?? name;
}

/**
 * Format USD value with compact notation for large numbers
 */
function formatUsdCompact(value: number): string {
  if (value === 0) return '$0';
  if (Math.abs(value) < 0.01) return value < 0 ? '-<$0.01' : '<$0.01';
  if (Math.abs(value) < 1000) return `$${value.toFixed(2)}`;
  if (Math.abs(value) < 1_000_000) return `$${(value / 1000).toFixed(2)}K`;
  if (Math.abs(value) < 1_000_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${(value / 1_000_000_000).toFixed(2)}B`;
}

type TimeRange = '7d' | '30d' | '90d';

interface PortfolioValueChartProps {
  className?: string;
  height?: number;
  defaultRange?: TimeRange;
  showControls?: boolean;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  totalValueUsd: number;
  syBalanceUsd: number;
  ptBalanceUsd: number;
  ytBalanceUsd: number;
  lpBalanceUsd: number;
}

/**
 * Line chart showing portfolio value over time.
 * Uses historical snapshots from indexer data combined with live prices.
 */
export function PortfolioValueChart({
  className,
  height = 300,
  defaultRange = '30d',
  showControls = true,
}: PortfolioValueChartProps): ReactNode {
  const { isConnected } = useStarknet();
  const [range, setRange] = useState<TimeRange>(defaultRange);

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;

  const { snapshots, summary, isLoading, isError } = usePortfolioHistory({ days });
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

  // Get average price for conversion (simplified - all markets use similar underlying)
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
    if (snapshots.length === 0) return [];

    return snapshots.map((snapshot) => {
      const syBalance = Number(fromWad(BigInt(snapshot.syBalance)));
      const ptBalance = Number(fromWad(BigInt(snapshot.ptBalance)));
      const ytBalance = Number(fromWad(BigInt(snapshot.ytBalance)));
      const lpBalance = Number(fromWad(BigInt(snapshot.lpBalance)));

      // Convert to USD
      // SY and PT are valued at ~1:1 with underlying
      // LP tokens represent shares of both SY and PT reserves, so ~2x value
      // YT is a fraction of SY value (yield component only)
      const syBalanceUsd = syBalance * avgPrice;
      const ptBalanceUsd = ptBalance * avgPrice;
      const ytBalanceUsd = ytBalance * avgPrice * 0.1;
      const lpBalanceUsd = lpBalance * avgPrice * 2; // LP = share of SY + PT pool

      const totalValueUsd = syBalanceUsd + ptBalanceUsd + ytBalanceUsd + lpBalanceUsd;

      // Parse date and format for display using user's locale
      const dateObj = new Date(snapshot.date);
      const displayDate = dateObj.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      return {
        date: snapshot.date,
        displayDate,
        totalValueUsd,
        syBalanceUsd,
        ptBalanceUsd,
        ytBalanceUsd,
        lpBalanceUsd,
      };
    });
  }, [snapshots, avgPrice]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const deposited = Number(fromWad(BigInt(summary.totalDeposited))) * avgPrice;
    const withdrawn = Number(fromWad(BigInt(summary.totalWithdrawn))) * avgPrice;
    const realized = Number(fromWad(BigInt(summary.realizedPnl))) * avgPrice;

    const currentValue =
      chartData.length > 0 ? (chartData[chartData.length - 1]?.totalValueUsd ?? 0) : 0;
    const unrealized = currentValue - deposited + withdrawn;

    return {
      deposited,
      withdrawn,
      realized,
      currentValue,
      unrealized,
    };
  }, [summary, chartData, avgPrice]);

  // Not connected state
  if (!isConnected) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Portfolio Value</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">Connect wallet to view portfolio history</p>
        </CardContent>
      </Card>
    );
  }

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
          <p className="text-destructive text-sm">Failed to load portfolio history</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Portfolio Value</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No portfolio history available</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Start trading to see your portfolio value over time
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Portfolio Value</CardTitle>
          <div className="text-muted-foreground flex gap-4 text-sm">
            <span>
              Current:{' '}
              <span className="text-foreground font-medium">
                {formatUsdCompact(stats.currentValue)}
              </span>
            </span>
            <span>
              P&L:{' '}
              <span
                className={cn(
                  'font-medium',
                  stats.unrealized >= 0 ? 'text-primary' : 'text-destructive'
                )}
              >
                {stats.unrealized >= 0 ? '+' : ''}
                {formatUsdCompact(stats.unrealized)}
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
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
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
              formatter={(value: number | undefined, name: string | undefined) => [
                `$${(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                getChartDisplayName(name),
              ]}
              labelFormatter={(label: string) => label}
            />
            <Area
              type="monotone"
              dataKey="totalValueUsd"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#portfolioGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Compact sparkline version for embedding in other components
 */
interface PortfolioSparklineProps {
  className?: string;
  height?: number;
  days?: number;
}

export function PortfolioSparkline({
  className,
  height = 60,
  days = 7,
}: PortfolioSparklineProps): ReactNode {
  const { isConnected } = useStarknet();
  const { snapshots, isLoading } = usePortfolioHistory({ days });
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

  const chartData = useMemo(() => {
    return snapshots.map((snapshot) => {
      const totalValueSy = Number(fromWad(BigInt(snapshot.totalValueSy)));
      return { value: totalValueSy * avgPrice };
    });
  }, [snapshots, avgPrice]);

  if (!isConnected || isLoading || pricesLoading || chartData.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioSparklineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={1.5}
            fill="url(#portfolioSparklineGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
