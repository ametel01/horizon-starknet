'use client';

import { type ReactNode, useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { usePortfolioHistory } from '@/hooks/api';
import { useDashboardMarkets } from '@features/markets';
import { useEnhancedPositions } from '@features/portfolio';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@features/price';
import { useStarknet } from '@features/wallet';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';

/**
 * Format USD value with compact notation
 */
function formatUsdCompact(value: number): string {
  if (value === 0) return '$0';
  if (Math.abs(value) < 0.01) return value < 0 ? '-<$0.01' : '<$0.01';
  if (Math.abs(value) < 1000) return `$${value.toFixed(2)}`;
  if (Math.abs(value) < 1_000_000) return `$${(value / 1000).toFixed(2)}K`;
  if (Math.abs(value) < 1_000_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${(value / 1_000_000_000).toFixed(2)}B`;
}

/**
 * Format percentage
 */
function formatPercent(value: number): string {
  if (Math.abs(value) < 0.01) return '0%';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

// Chart colors using CSS variables
const CHART_COLORS = {
  deposited: 'var(--chart-3)',
  withdrawn: 'var(--chart-2)',
  realized: 'var(--chart-1)',
  unrealized: 'var(--primary)',
};

interface PnlBreakdownProps {
  className?: string;
  /** Show pie chart visualization */
  showChart?: boolean;
  /** Chart height (default: 200) */
  chartHeight?: number;
}

/**
 * Component that displays P&L breakdown showing realized vs unrealized gains/losses.
 * Combines historical data with current position values.
 */
export function PnlBreakdown({
  className,
  showChart = true,
  chartHeight = 200,
}: PnlBreakdownProps): ReactNode {
  const { isConnected } = useStarknet();
  const { summary, isLoading: historyLoading, isError } = usePortfolioHistory({ days: 365 });
  const { markets, isLoading: marketsLoading } = useDashboardMarkets();
  const { data: portfolio, isLoading: portfolioLoading } = useEnhancedPositions(markets);

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

  const isLoading = historyLoading || marketsLoading || portfolioLoading || pricesLoading;

  // Calculate P&L breakdown
  const pnlData = useMemo(() => {
    // Historical totals from indexer
    const deposited = Number(fromWad(BigInt(summary.totalDeposited))) * avgPrice;
    const withdrawn = Number(fromWad(BigInt(summary.totalWithdrawn))) * avgPrice;

    // Current portfolio value from enhanced positions
    const currentValue = portfolio?.totalValueUsd ?? 0;

    // Cost basis = what's still invested in the protocol
    const costBasis = deposited - withdrawn;

    // Unrealized P&L = current value - cost basis
    // This represents gain/loss on open positions
    const unrealizedPnl = currentValue - costBasis;

    // Realized P&L = profit from closed positions
    // Without per-position cost basis tracking, we approximate:
    // If withdrawn > 0, realized = withdrawn - (portion of deposits that was withdrawn)
    // For simplicity, if withdrawn > 0 and currentValue ≈ 0, user closed all positions
    // Otherwise, realized is 0 (positions still open)
    const realizedPnl = withdrawn > 0 && currentValue < 100 ? withdrawn - deposited : 0;

    // Total P&L
    const totalPnl = realizedPnl + unrealizedPnl;

    // P&L percentage
    const totalInvested = deposited > 0 ? deposited : 1;
    const pnlPercent = (totalPnl / totalInvested) * 100;

    return {
      deposited,
      withdrawn,
      currentValue,
      realizedPnl,
      unrealizedPnl,
      totalPnl,
      pnlPercent,
      costBasis: Math.max(0, costBasis),
    };
  }, [summary, portfolio, avgPrice]);

  // Chart data for pie chart
  const chartData = useMemo(() => {
    const data = [];

    if (pnlData.realizedPnl !== 0) {
      data.push({
        name: 'Realized P&L',
        value: Math.abs(pnlData.realizedPnl),
        isNegative: pnlData.realizedPnl < 0,
        color: pnlData.realizedPnl >= 0 ? CHART_COLORS.realized : 'var(--destructive)',
      });
    }

    if (pnlData.unrealizedPnl !== 0) {
      data.push({
        name: 'Unrealized P&L',
        value: Math.abs(pnlData.unrealizedPnl),
        isNegative: pnlData.unrealizedPnl < 0,
        color: pnlData.unrealizedPnl >= 0 ? CHART_COLORS.unrealized : 'var(--destructive)',
      });
    }

    // If no P&L, show cost basis
    if (data.length === 0 && pnlData.costBasis > 0) {
      data.push({
        name: 'Cost Basis',
        value: pnlData.costBasis,
        isNegative: false,
        color: CHART_COLORS.deposited,
      });
    }

    return data;
  }, [pnlData]);

  // Not connected state
  if (!isConnected) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>P&L Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">Connect wallet to view P&L</p>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="py-8 text-center">
          <p className="text-destructive text-sm">Failed to load P&L data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (pnlData.deposited === 0 && pnlData.currentValue === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>P&L Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No P&L data yet</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Start trading to track your profit and loss
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>P&L Breakdown</CardTitle>
        <div className="text-muted-foreground flex gap-4 text-sm">
          <span>
            Total:{' '}
            <span
              className={cn(
                'font-medium',
                pnlData.totalPnl >= 0 ? 'text-primary' : 'text-destructive'
              )}
            >
              {pnlData.totalPnl >= 0 ? '+' : ''}
              {formatUsdCompact(pnlData.totalPnl)}
            </span>
          </span>
          <span>
            <span
              className={cn(
                'font-medium',
                pnlData.pnlPercent >= 0 ? 'text-primary' : 'text-destructive'
              )}
            >
              {formatPercent(pnlData.pnlPercent)}
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-2">
          {/* P&L Stats */}
          <div className="space-y-4">
            {/* Realized P&L */}
            <div className="bg-muted/50 overflow-hidden rounded-lg p-4">
              <div className="text-muted-foreground mb-1 text-sm">Realized P&L</div>
              <div
                className={cn(
                  'truncate text-xl font-bold sm:text-2xl',
                  pnlData.realizedPnl >= 0 ? 'text-primary' : 'text-destructive'
                )}
              >
                {pnlData.realizedPnl >= 0 ? '+' : ''}
                {formatUsdCompact(pnlData.realizedPnl)}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">From redeemed positions</div>
            </div>

            {/* Unrealized P&L */}
            <div className="bg-muted/50 overflow-hidden rounded-lg p-4">
              <div className="text-muted-foreground mb-1 text-sm">Unrealized P&L</div>
              <div
                className={cn(
                  'truncate text-xl font-bold sm:text-2xl',
                  pnlData.unrealizedPnl >= 0 ? 'text-primary' : 'text-destructive'
                )}
              >
                {pnlData.unrealizedPnl >= 0 ? '+' : ''}
                {formatUsdCompact(pnlData.unrealizedPnl)}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">From open positions</div>
            </div>
          </div>

          {/* Chart or Additional Stats */}
          {showChart && chartData.length > 0 ? (
            <div className="flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${String(index)}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '8px' }}
                    formatter={(value: number | undefined, name: string | undefined) => {
                      const entry = chartData.find((d) => d.name === name);
                      const prefix = entry?.isNegative ? '-' : '';
                      return [`${prefix}${formatUsdCompact(value ?? 0)}`, name ?? ''];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs">
                {chartData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Deposited */}
              <div className="bg-muted/50 overflow-hidden rounded-lg p-4">
                <div className="text-muted-foreground mb-1 text-sm">Total Deposited</div>
                <div className="text-foreground truncate text-xl font-bold">
                  {formatUsdCompact(pnlData.deposited)}
                </div>
              </div>

              {/* Current Value */}
              <div className="bg-muted/50 overflow-hidden rounded-lg p-4">
                <div className="text-muted-foreground mb-1 text-sm">Current Value</div>
                <div className="text-foreground truncate text-xl font-bold">
                  {formatUsdCompact(pnlData.currentValue)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary Stats Row */}
        <div className="border-border mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center sm:gap-4">
          <div className="min-w-0">
            <div className="text-muted-foreground text-xs">Deposited</div>
            <div className="text-foreground truncate text-sm font-medium sm:text-base">
              {formatUsdCompact(pnlData.deposited)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-muted-foreground text-xs">Withdrawn</div>
            <div className="text-foreground truncate text-sm font-medium sm:text-base">
              {formatUsdCompact(pnlData.withdrawn)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-muted-foreground text-xs">Current Value</div>
            <div className="text-foreground truncate text-sm font-medium sm:text-base">
              {formatUsdCompact(pnlData.currentValue)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact P&L summary for embedding in other components
 */
interface PnlSummaryCompactProps {
  className?: string;
}

export function PnlSummaryCompact({ className }: PnlSummaryCompactProps): ReactNode {
  const { isConnected } = useStarknet();
  const { summary, isLoading: historyLoading } = usePortfolioHistory({ days: 365 });
  const { markets, isLoading: marketsLoading } = useDashboardMarkets();
  const { data: portfolio, isLoading: portfolioLoading } = useEnhancedPositions(markets);

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

  const isLoading = historyLoading || marketsLoading || portfolioLoading || pricesLoading;

  const pnlData = useMemo(() => {
    const deposited = Number(fromWad(BigInt(summary.totalDeposited))) * avgPrice;
    const withdrawn = Number(fromWad(BigInt(summary.totalWithdrawn))) * avgPrice;
    const currentValue = portfolio?.totalValueUsd ?? 0;
    const costBasis = deposited - withdrawn;
    const unrealizedPnl = currentValue - costBasis;
    // Realized P&L only when positions are closed (withdrawn with ~0 current value)
    const realizedPnl = withdrawn > 0 && currentValue < 100 ? withdrawn - deposited : 0;
    const totalPnl = realizedPnl + unrealizedPnl;

    return { totalPnl, realizedPnl, unrealizedPnl };
  }, [summary, portfolio, avgPrice]);

  if (!isConnected || isLoading) {
    return (
      <div className={cn('flex items-center gap-4', className)}>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-4 text-sm', className)}>
      <div>
        <span className="text-muted-foreground">Realized: </span>
        <span
          className={cn(
            'font-medium',
            pnlData.realizedPnl >= 0 ? 'text-primary' : 'text-destructive'
          )}
        >
          {pnlData.realizedPnl >= 0 ? '+' : ''}
          {formatUsdCompact(pnlData.realizedPnl)}
        </span>
      </div>
      <div>
        <span className="text-muted-foreground">Unrealized: </span>
        <span
          className={cn(
            'font-medium',
            pnlData.unrealizedPnl >= 0 ? 'text-primary' : 'text-destructive'
          )}
        >
          {pnlData.unrealizedPnl >= 0 ? '+' : ''}
          {formatUsdCompact(pnlData.unrealizedPnl)}
        </span>
      </div>
    </div>
  );
}
