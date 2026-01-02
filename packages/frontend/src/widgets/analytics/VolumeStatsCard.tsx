'use client';

import { useDashboardMarkets } from '@features/markets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@features/price';
import { useProtocolVolume } from '@features/protocol-status';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
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

interface VolumeStatsCardProps {
  className?: string;
}

/**
 * Summary card showing 24h, 7d, and 30d volume statistics.
 * Displays volume in USD using token prices.
 */
export function VolumeStatsCard({ className }: VolumeStatsCardProps): ReactNode {
  const { data: volumeData, isLoading: volumeLoading, isError } = useProtocolVolume({ days: 30 });
  const { markets } = useDashboardMarkets();

  // Get token addresses for pricing (use first market's underlying as proxy)
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

  // Get average price for volume conversion (simplified - assumes single underlying)
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

  // Calculate USD volumes
  const volumes = useMemo(() => {
    if (!volumeData) return null;

    const volume24hNum = Number(fromWad(volumeData.total24h.totalVolume));
    const volume7dNum = Number(fromWad(volumeData.total7d.totalVolume));
    const volume30dNum = Number(fromWad(volumeData.total30d.totalVolume));

    return {
      volume24hUsd: volume24hNum * avgPrice,
      volume7dUsd: volume7dNum * avgPrice,
      volume30dUsd: volume30dNum * avgPrice,
      swapCount24h: volumeData.total24h.swapCount,
      swapCount7d: volumeData.total7d.swapCount,
      swapCount30d: volumeData.total30d.swapCount,
      uniqueTraders24h: volumeData.total24h.uniqueSwappers,
    };
  }, [volumeData, avgPrice]);

  // Loading state
  if (volumeLoading || pricesLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
          <div className="mt-4 grid grid-cols-3 gap-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="py-6 text-center">
          <p className="text-destructive text-sm">Failed to load volume data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!volumes) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            Trading Volume
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <p className="text-muted-foreground text-sm">No volume data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">Trading Volume</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 24h Volume (primary) */}
        <div>
          <div className="text-foreground text-3xl font-bold">
            {formatUsdCompact(volumes.volume24hUsd)}
          </div>
          <div className="text-muted-foreground mt-1 text-sm">
            {volumes.swapCount24h} swaps{' '}
            {volumes.uniqueTraders24h > 0 && (
              <span className="text-muted-foreground/70">
                by {volumes.uniqueTraders24h} traders
              </span>
            )}
          </div>
        </div>

        {/* 7d and 30d breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4">
          <div>
            <div className="text-muted-foreground text-xs">7D Volume</div>
            <div className="text-foreground font-medium">
              {formatUsdCompact(volumes.volume7dUsd)}
            </div>
            <div className="text-muted-foreground text-xs">{volumes.swapCount7d} swaps</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">30D Volume</div>
            <div className="text-foreground font-medium">
              {formatUsdCompact(volumes.volume30dUsd)}
            </div>
            <div className="text-muted-foreground text-xs">{volumes.swapCount30d} swaps</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Minimal inline version for display in other components
 */
interface VolumeInlineProps {
  className?: string;
}

export function VolumeInline({ className }: VolumeInlineProps): ReactNode {
  const { data: volumeData, isLoading } = useProtocolVolume({ days: 1 });
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

  const volume24hUsd = useMemo(() => {
    if (!volumeData || !prices || tokenAddresses.length === 0) return 0;
    let avgPrice = 0;
    let count = 0;
    for (const addr of tokenAddresses) {
      const price = getTokenPrice(addr, prices);
      if (price > 0) {
        avgPrice += price;
        count++;
      }
    }
    if (count > 0) avgPrice /= count;
    const volume24hNum = Number(fromWad(volumeData.total24h.totalVolume));
    return volume24hNum * avgPrice;
  }, [volumeData, prices, tokenAddresses]);

  if (isLoading || pricesLoading) {
    return <Skeleton className={cn('h-6 w-20', className)} />;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-muted-foreground text-sm">24h Vol:</span>
      <span className="text-foreground font-medium">{formatUsdCompact(volume24hUsd)}</span>
    </div>
  );
}
