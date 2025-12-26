'use client';

import { type ReactNode, useMemo } from 'react';

import { useDashboardMarkets } from '@/hooks/useMarkets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@/hooks/usePrices';
import { useUserYield } from '@/hooks/useUserYield';
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

/**
 * Format token amount with compact notation
 */
function formatAmountCompact(value: bigint): string {
  const num = Number(fromWad(value));
  if (num === 0) return '0';
  if (num < 0.001) return '<0.001';
  if (num < 1000) return num.toFixed(4);
  if (num < 1_000_000) return `${(num / 1000).toFixed(2)}K`;
  return `${(num / 1_000_000).toFixed(2)}M`;
}

interface YieldEarnedCardProps {
  className?: string;
}

/**
 * Card showing total yield earned by the user (all time).
 * Displays yield in SY tokens and USD value.
 */
export function YieldEarnedCard({ className }: YieldEarnedCardProps): ReactNode {
  const { data: yieldData, isLoading: yieldLoading, isError, address } = useUserYield();
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

  // Get average price for yield conversion (simplified - assumes single underlying)
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

  // Calculate stats
  const stats = useMemo(() => {
    if (!yieldData) return null;

    const totalClaimedNum = Number(fromWad(yieldData.totalYieldClaimed));
    const totalClaimedUsd = totalClaimedNum * avgPrice;
    const totalClaims = yieldData.claimHistory.length;
    const activePositions = yieldData.summaryByPosition.filter(
      (p) => p.currentYtBalance > 0n
    ).length;

    return {
      totalClaimedUsd,
      totalClaimed: yieldData.totalYieldClaimed,
      totalClaims,
      activePositions,
    };
  }, [yieldData, avgPrice]);

  // Not connected state
  if (!address) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">Yield Earned</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <p className="text-muted-foreground text-sm">Connect wallet to view yield</p>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (yieldLoading || pricesLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32" />
          <div className="mt-4 grid grid-cols-2 gap-4">
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
          <p className="text-destructive text-sm">Failed to load yield data</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!stats || stats.totalClaimed === 0n) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">Yield Earned</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-foreground text-3xl font-bold">$0</div>
          <div className="text-muted-foreground mt-1 text-sm">No yield claimed yet</div>
          <div className="text-muted-foreground mt-4 text-xs">
            Hold YT tokens to earn yield from the underlying asset
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          Total Yield Earned
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Total yield (primary) */}
        <div>
          <div className="text-primary text-3xl font-bold">
            {formatUsdCompact(stats.totalClaimedUsd)}
          </div>
          <div className="text-muted-foreground mt-1 text-sm">
            {formatAmountCompact(stats.totalClaimed)} SY claimed
          </div>
        </div>

        {/* Stats breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4">
          <div>
            <div className="text-muted-foreground text-xs">Total Claims</div>
            <div className="text-foreground font-medium">{stats.totalClaims}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">YT Positions</div>
            <div className="text-foreground font-medium">{stats.activePositions}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Inline version for compact display
 */
interface YieldEarnedInlineProps {
  className?: string;
}

export function YieldEarnedInline({ className }: YieldEarnedInlineProps): ReactNode {
  const { data: yieldData, isLoading, address } = useUserYield();
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

  const totalYieldUsd = useMemo(() => {
    if (!yieldData || !prices || tokenAddresses.length === 0) return 0;
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
    const totalNum = Number(fromWad(yieldData.totalYieldClaimed));
    return totalNum * avgPrice;
  }, [yieldData, prices, tokenAddresses]);

  if (!address || isLoading || pricesLoading) {
    return <Skeleton className={cn('h-6 w-20', className)} />;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-muted-foreground text-sm">Yield Earned:</span>
      <span className="text-primary font-medium">{formatUsdCompact(totalYieldUsd)}</span>
    </div>
  );
}
