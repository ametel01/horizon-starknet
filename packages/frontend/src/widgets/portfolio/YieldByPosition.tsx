'use client';

import { useDashboardMarkets } from '@features/markets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@features/price';
import { useUserYield } from '@features/yield';
import { cn } from '@shared/lib/utils';
import { formatWadCompact, fromWad } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';
import { type ReactNode, useMemo } from 'react';

/**
 * Format USD value with compact notation
 */
function formatUsdCompact(value: number): string {
  if (value === 0) return '$0';
  if (value < 0.01) return '<$0.01';
  if (value < 1000) return `$${value.toFixed(2)}`;
  if (value < 1_000_000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

function formatTimeAgo(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${String(Math.floor(seconds / 60))}m ago`;
  if (seconds < 86400) return `${String(Math.floor(seconds / 3600))}h ago`;
  if (seconds < 604800) return `${String(Math.floor(seconds / 86400))}d ago`;
  return date.toLocaleDateString();
}

interface YieldByPositionProps {
  className?: string;
}

interface PositionRowProps {
  ytSymbol: string;
  totalClaimed: bigint;
  totalClaimedUsd: number;
  claimCount: number;
  lastClaim: Date | null;
  currentYtBalance: bigint;
  isActive: boolean;
}

function PositionRow({
  ytSymbol,
  totalClaimed,
  totalClaimedUsd,
  claimCount,
  lastClaim,
  currentYtBalance,
  isActive,
}: PositionRowProps): ReactNode {
  return (
    <div className="hover:bg-muted/50 flex items-center justify-between border-b px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full text-xs font-medium',
            isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}
        >
          {ytSymbol.replace('YT-', '').slice(0, 3)}
        </div>
        <div className="flex flex-col">
          <span className="text-foreground text-sm font-medium">{ytSymbol}</span>
          <span className="text-muted-foreground text-xs">
            {isActive ? `${formatWadCompact(currentYtBalance)} held` : 'No balance'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="text-primary text-sm font-medium">
            {formatUsdCompact(totalClaimedUsd)}
          </div>
          <div className="text-muted-foreground text-xs">{formatWadCompact(totalClaimed)} SY</div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground text-xs">{claimCount} claims</div>
          <div className="text-muted-foreground text-xs">Last: {formatTimeAgo(lastClaim)}</div>
        </div>
      </div>
    </div>
  );
}

function LoadingRows(): ReactNode {
  return (
    <>
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between border-b px-4 py-3 last:border-b-0"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end gap-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="flex flex-col items-end gap-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Component that displays yield breakdown by YT position.
 * Shows total yield earned per position with claim statistics.
 */
export function YieldByPosition({ className }: YieldByPositionProps): ReactNode {
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

  // Get average price
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

  // Build a map of YT address to symbol
  const ytSymbolMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const market of markets) {
      const symbol = market.metadata?.yieldTokenSymbol ?? 'Token';
      map.set(market.ytAddress.toLowerCase(), `YT-${symbol}`);
    }
    return map;
  }, [markets]);

  // Process positions with USD values and sort by total claimed
  const positions = useMemo(() => {
    if (!yieldData) return [];

    return yieldData.summaryByPosition
      .map((p) => {
        const totalClaimedNum = Number(fromWad(p.totalClaimed));
        return {
          yt: p.yt,
          ytSymbol: ytSymbolMap.get(p.yt.toLowerCase()) ?? 'YT',
          totalClaimed: p.totalClaimed,
          totalClaimedUsd: totalClaimedNum * avgPrice,
          claimCount: p.claimCount,
          lastClaim: p.lastClaim,
          currentYtBalance: p.currentYtBalance,
          isActive: p.currentYtBalance > 0n,
        };
      })
      .sort((a, b) => {
        // Sort by active first, then by total claimed descending
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return b.totalClaimedUsd - a.totalClaimedUsd;
      });
  }, [yieldData, avgPrice, ytSymbolMap]);

  // Calculate total
  const totalYieldUsd = useMemo(() => {
    return positions.reduce((sum, p) => sum + p.totalClaimedUsd, 0);
  }, [positions]);

  const isLoading = yieldLoading || pricesLoading;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Yield by Position</CardTitle>
        {positions.length > 0 && (
          <p className="text-muted-foreground text-sm">
            Total:{' '}
            <span className="text-primary font-medium">{formatUsdCompact(totalYieldUsd)}</span>
          </p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-y-auto">
          {!address ? (
            <div className="text-muted-foreground px-4 py-8 text-center text-sm">
              Connect wallet to view yield breakdown
            </div>
          ) : isLoading ? (
            <LoadingRows />
          ) : isError ? (
            <div className="text-destructive px-4 py-8 text-center text-sm">
              Failed to load yield data
            </div>
          ) : positions.length === 0 ? (
            <div className="text-muted-foreground px-4 py-8 text-center text-sm">
              No yield positions yet
            </div>
          ) : (
            positions.map((position) => (
              <PositionRow
                key={position.yt}
                ytSymbol={position.ytSymbol}
                totalClaimed={position.totalClaimed}
                totalClaimedUsd={position.totalClaimedUsd}
                claimCount={position.claimCount}
                lastClaim={position.lastClaim}
                currentYtBalance={position.currentYtBalance}
                isActive={position.isActive}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact card showing summary of yield positions
 */
interface YieldPositionsSummaryProps {
  className?: string;
}

export function YieldPositionsSummary({ className }: YieldPositionsSummaryProps): ReactNode {
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

  const stats = useMemo(() => {
    if (!yieldData || !prices) return null;

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

    const totalClaimedNum = Number(fromWad(yieldData.totalYieldClaimed));
    const activePositions = yieldData.summaryByPosition.filter(
      (p) => p.currentYtBalance > 0n
    ).length;
    const totalPositions = yieldData.summaryByPosition.length;

    return {
      totalYieldUsd: totalClaimedNum * avgPrice,
      activePositions,
      totalPositions,
    };
  }, [yieldData, prices, tokenAddresses]);

  if (!address || isLoading || pricesLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-muted-foreground text-sm">Total Yield Earned</div>
            <div className="text-primary text-2xl font-semibold">
              {formatUsdCompact(stats.totalYieldUsd)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-sm">YT Positions</div>
            <div className="text-foreground text-lg font-medium">
              {stats.activePositions}
              {stats.totalPositions > stats.activePositions && (
                <span className="text-muted-foreground text-sm">/{stats.totalPositions}</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
