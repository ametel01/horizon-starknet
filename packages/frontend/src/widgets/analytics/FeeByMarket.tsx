'use client';

import { useProtocolFees } from '@features/analytics';
import { useDashboardMarkets } from '@features/markets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@features/price';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from '@shared/ui/recharts';
import { Skeleton } from '@shared/ui/Skeleton';
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

/**
 * Truncate address for display
 */
function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface FeeByMarketProps {
  className?: string;
  height?: number;
  /** Number of days of data to include (default: 30) */
  days?: number;
}

interface MarketFeeData {
  name: string;
  value: number;
  valueUsd: number;
  feesBigInt: bigint;
  swapCount: number;
  avgFeeUsd: number;
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
 * Pie chart showing fee breakdown by market.
 * Uses semantic chart colors that adapt to light/dark mode.
 */
export function FeeByMarket({ className, height = 300, days = 30 }: FeeByMarketProps): ReactNode {
  const { byMarket, total30d, isLoading, isError } = useProtocolFees({ days });
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

  // Create a map from market address to symbol
  const marketSymbols = useMemo(() => {
    const map = new Map<string, string>();
    for (const market of markets) {
      if (market.metadata?.yieldTokenSymbol) {
        map.set(market.address, market.metadata.yieldTokenSymbol);
      }
    }
    return map;
  }, [markets]);

  // Format data for the pie chart with USD values
  const chartData = useMemo((): MarketFeeData[] => {
    if (byMarket.length === 0) return [];

    const data: MarketFeeData[] = [];
    for (const market of byMarket) {
      if (market.totalFees <= 0n) {
        continue;
      }

      const feesNum = Number(fromWad(market.totalFees));
      const feesUsd = feesNum * avgPrice;
      const avgFeeNum = Number(fromWad(market.avgFeePerSwap));
      const avgFeeUsd = avgFeeNum * avgPrice;
      const index = data.length;

      // Try to get symbol from marketSymbols map, fallback to truncated address
      const symbol = marketSymbols.get(market.market) ?? truncateAddress(market.market);

      data.push({
        name: symbol,
        value: feesUsd,
        valueUsd: feesUsd,
        feesBigInt: market.totalFees,
        swapCount: market.swapCount,
        avgFeeUsd,
        address: market.market,
        color: CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0] ?? '',
      });
    }

    return data.sort((a, b) => b.value - a.value); // Sort by fees descending
  }, [byMarket, avgPrice, marketSymbols]);

  // Calculate total fees in USD
  const totalFeesUsd = useMemo(() => {
    return Number(fromWad(total30d)) * avgPrice;
  }, [total30d, avgPrice]);

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
          <CardTitle>Fees by Market</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No fee data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Fees by Market</CardTitle>
        <p className="text-muted-foreground text-sm">
          {days}d Total:{' '}
          <span className="text-foreground font-medium">{formatUsdCompact(totalFeesUsd)}</span>
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
              formatter={(_value: unknown, name: unknown) => {
                const tooltipName = typeof name === 'string' ? name : String(name ?? '');
                const market = chartData.find((d) => d.name === tooltipName);
                if (!market) return [formatUsdCompact(0), tooltipName];
                return [
                  `${formatUsdCompact(market.valueUsd)} (${String(market.swapCount)} swaps)`,
                  tooltipName,
                ];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              formatter={(value: string) => (
                <span style={{ color: 'var(--foreground)' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Market list with fee values */}
        <div className="mt-4 space-y-2">
          {chartData.map((market) => (
            <div key={market.address} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full" style={{ backgroundColor: market.color }} />
                <span className="text-foreground">{market.name}</span>
                <span className="text-muted-foreground text-xs">({market.swapCount} swaps)</span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground font-mono">
                  {formatUsdCompact(market.valueUsd)}
                </span>
              </div>
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
export function FeeByMarketCompact({
  className,
  height = 200,
  days = 30,
}: FeeByMarketProps): ReactNode {
  const { byMarket, isLoading, isError } = useProtocolFees({ days });
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

  const marketSymbols = useMemo(() => {
    const map = new Map<string, string>();
    for (const market of markets) {
      if (market.metadata?.yieldTokenSymbol) {
        map.set(market.address, market.metadata.yieldTokenSymbol);
      }
    }
    return map;
  }, [markets]);

  const chartData = useMemo((): MarketFeeData[] => {
    if (byMarket.length === 0) return [];

    const data: MarketFeeData[] = [];
    for (const market of byMarket) {
      if (market.totalFees <= 0n) {
        continue;
      }

      const feesNum = Number(fromWad(market.totalFees));
      const feesUsd = feesNum * avgPrice;
      const avgFeeNum = Number(fromWad(market.avgFeePerSwap));
      const avgFeeUsd = avgFeeNum * avgPrice;
      const symbol = marketSymbols.get(market.market) ?? truncateAddress(market.market);
      const index = data.length;

      data.push({
        name: symbol,
        value: feesUsd,
        valueUsd: feesUsd,
        feesBigInt: market.totalFees,
        swapCount: market.swapCount,
        avgFeeUsd,
        address: market.market,
        color: CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0] ?? '',
      });
    }

    return data.sort((a, b) => b.value - a.value);
  }, [byMarket, avgPrice, marketSymbols]);

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
            formatter={(_value: unknown, name: unknown) => {
              const tooltipName = typeof name === 'string' ? name : String(name ?? '');
              const market = chartData.find((d) => d.name === tooltipName);
              return [formatUsdCompact(market?.valueUsd ?? 0), tooltipName];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
