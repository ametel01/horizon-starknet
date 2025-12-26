'use client';

import { type ReactNode, useMemo } from 'react';

import { useProtocolStats } from '@/hooks/api';
import { useDashboardMarkets } from '@features/markets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@features/price';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { Card, CardContent } from '@shared/ui/Card';
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

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  isLoading?: boolean;
  className?: string;
}

function StatCard({ label, value, subValue, isLoading, className }: StatCardProps): ReactNode {
  return (
    <Card size="sm" className={cn('min-w-[140px]', className)}>
      <CardContent className="pt-4">
        <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          {label}
        </div>
        {isLoading ? (
          <Skeleton className="mt-2 h-8 w-20" />
        ) : (
          <div className="mt-1">
            <div className="text-2xl font-bold">{value}</div>
            {subValue && <div className="text-muted-foreground text-xs">{subValue}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ProtocolStatsProps {
  className?: string;
}

/**
 * Component that displays protocol-wide statistics.
 * Shows TVL, volume, fees, and trading activity metrics.
 */
export function ProtocolStats({ className }: ProtocolStatsProps): ReactNode {
  const { stats, isLoading, isError } = useProtocolStats();
  const { markets } = useDashboardMarkets();

  // Get token addresses for pricing (use first market's token as representative)
  const tokenAddresses = useMemo(() => {
    const addresses = new Set<string>();
    for (const market of markets) {
      const symbol = market.metadata?.yieldTokenSymbol;
      const priceAddr = getTokenAddressForPricing(symbol) ?? market.metadata?.underlyingAddress;
      if (priceAddr) addresses.add(priceAddr);
    }
    return Array.from(addresses);
  }, [markets]);

  const { data: prices } = usePrices(tokenAddresses);

  // Get average price across all markets (for multi-asset protocols)
  // For now, use the first market's price since most volume is in one asset
  const avgPrice = useMemo(() => {
    if (!prices || markets.length === 0) return 0;
    const symbol = markets[0]?.metadata?.yieldTokenSymbol;
    const priceAddr = getTokenAddressForPricing(symbol) ?? markets[0]?.metadata?.underlyingAddress;
    return getTokenPrice(priceAddr, prices);
  }, [markets, prices]);

  // Convert values to USD
  const tvlUsd = useMemo(() => {
    let total = 0;
    for (const market of markets) {
      const symbol = market.metadata?.yieldTokenSymbol;
      const priceAddr = getTokenAddressForPricing(symbol) ?? market.metadata?.underlyingAddress;
      const price = getTokenPrice(priceAddr, prices);
      const syReserveNum = Number(fromWad(market.state.syReserve));
      const ptReserveNum = Number(fromWad(market.state.ptReserve));
      total += (syReserveNum + ptReserveNum) * price;
    }
    return total;
  }, [markets, prices]);

  const volumeUsd = Number(fromWad(stats.volume24h)) * avgPrice;
  const feesUsd = Number(fromWad(stats.fees24h)) * avgPrice;

  if (isError) {
    return (
      <div
        className={cn('bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm', className)}
      >
        Failed to load protocol statistics
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6', className)}>
      <StatCard
        label="Total TVL"
        value={formatUsdCompact(tvlUsd)}
        subValue={String(stats.marketCount) + ' markets'}
        isLoading={isLoading}
      />
      <StatCard label="24h Volume" value={formatUsdCompact(volumeUsd)} isLoading={isLoading} />
      <StatCard label="24h Swaps" value={stats.swaps24h.toLocaleString()} isLoading={isLoading} />
      <StatCard label="24h Fees" value={formatUsdCompact(feesUsd)} isLoading={isLoading} />
      <StatCard
        label="Unique Users"
        value={stats.uniqueUsers24h.toLocaleString()}
        subValue="last 24h"
        isLoading={isLoading}
      />
      <StatCard label="Active Markets" value={stats.marketCount.toString()} isLoading={isLoading} />
    </div>
  );
}

/**
 * Compact version showing only key metrics (TVL, Volume, Fees)
 */
export function ProtocolStatsCompact({ className }: ProtocolStatsProps): ReactNode {
  const { stats, isLoading, isError } = useProtocolStats();
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

  const { data: prices } = usePrices(tokenAddresses);

  // Get price for USD conversion
  const avgPrice = useMemo(() => {
    if (!prices || markets.length === 0) return 0;
    const symbol = markets[0]?.metadata?.yieldTokenSymbol;
    const priceAddr = getTokenAddressForPricing(symbol) ?? markets[0]?.metadata?.underlyingAddress;
    return getTokenPrice(priceAddr, prices);
  }, [markets, prices]);

  // Calculate USD values
  const tvlUsd = useMemo(() => {
    let total = 0;
    for (const market of markets) {
      const symbol = market.metadata?.yieldTokenSymbol;
      const priceAddr = getTokenAddressForPricing(symbol) ?? market.metadata?.underlyingAddress;
      const price = getTokenPrice(priceAddr, prices);
      const syReserveNum = Number(fromWad(market.state.syReserve));
      const ptReserveNum = Number(fromWad(market.state.ptReserve));
      total += (syReserveNum + ptReserveNum) * price;
    }
    return total;
  }, [markets, prices]);

  const volumeUsd = Number(fromWad(stats.volume24h)) * avgPrice;
  const feesUsd = Number(fromWad(stats.fees24h)) * avgPrice;

  if (isError) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-6 text-sm', className)}>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">TVL:</span>
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <span className="font-medium">{formatUsdCompact(tvlUsd)}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">24h Vol:</span>
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <span className="font-medium">{formatUsdCompact(volumeUsd)}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">24h Fees:</span>
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <span className="font-medium">{formatUsdCompact(feesUsd)}</span>
        )}
      </div>
    </div>
  );
}
