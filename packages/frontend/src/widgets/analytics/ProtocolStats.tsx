'use client';

import { Activity, DollarSign, TrendingUp, Users } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';

import { useProtocolStats } from '@features/analytics';
import { useDashboardMarkets } from '@features/markets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@features/price';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { Skeleton } from '@shared/ui/Skeleton';
import { StatCard, StatCardGrid, StatCardSkeleton } from '@shared/ui/StatCard';

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

  // Show loading skeletons
  if (isLoading) {
    return (
      <StatCardGrid columns={{ default: 2, md: 2, lg: 4 }} className={className}>
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
      </StatCardGrid>
    );
  }

  // Dynamic grid: 5 columns if showing unique users, 4 columns otherwise
  const showUniqueUsers = stats.uniqueUsers24h > 10;

  return (
    <StatCardGrid
      columns={{ default: 2, md: showUniqueUsers ? 3 : 2, lg: showUniqueUsers ? 5 : 4 }}
      className={className}
    >
      <StatCard
        label="Total TVL"
        value={formatUsdCompact(tvlUsd)}
        delta={`${String(stats.marketCount)} markets`}
        icon={<DollarSign className="h-4 w-4" />}
        compact
        animationDelay={0}
      />
      <StatCard
        label="24h Volume"
        value={formatUsdCompact(volumeUsd)}
        icon={<TrendingUp className="h-4 w-4" />}
        compact
        animationDelay={50}
      />
      <StatCard
        label="24h Swaps"
        value={stats.swaps24h.toLocaleString()}
        icon={<Activity className="h-4 w-4" />}
        compact
        animationDelay={100}
      />
      <StatCard
        label="24h Fees"
        value={formatUsdCompact(feesUsd)}
        trend="up"
        compact
        animationDelay={150}
      />
      {/* Only show unique users once there's meaningful user activity (>10) */}
      {showUniqueUsers && (
        <StatCard
          label="Unique Users"
          value={stats.uniqueUsers24h.toLocaleString()}
          delta="24h"
          icon={<Users className="h-4 w-4" />}
          compact
          animationDelay={200}
        />
      )}
    </StatCardGrid>
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
