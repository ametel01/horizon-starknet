'use client';

import { type ReactNode, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDashboardMarkets } from '@/hooks/useMarkets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@/hooks/usePrices';
import { useUserYield, type YieldClaimEvent } from '@/hooks/useUserYield';
import { formatWadCompact, fromWad } from '@/lib/math/wad';
import { cn } from '@/lib/utils';

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

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return String(Math.floor(seconds / 60)) + 'm ago';
  if (seconds < 86400) return String(Math.floor(seconds / 3600)) + 'h ago';
  if (seconds < 604800) return String(Math.floor(seconds / 86400)) + 'd ago';
  return date.toLocaleDateString();
}

function truncateHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
}

interface YieldHistoryProps {
  /** Max items to show */
  limit?: number;
  /** Days of history to fetch */
  days?: number;
  /** Show card wrapper */
  showCard?: boolean;
  className?: string;
}

interface ClaimRowProps {
  claim: YieldClaimEvent;
  price: number;
  ytSymbol: string;
}

function ClaimRow({ claim, price, ytSymbol }: ClaimRowProps): ReactNode {
  const amountNum = Number(fromWad(BigInt(claim.amountSy)));
  const valueUsd = amountNum * price;

  return (
    <div className="hover:bg-muted/50 flex items-center justify-between border-b px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="bg-primary/10 text-primary font-normal">
          Yield Claim
        </Badge>
        <div className="flex flex-col">
          <span className="text-foreground text-sm font-medium">
            +{formatWadCompact(claim.amountSy)} SY
          </span>
          <span className="text-muted-foreground text-xs">
            {ytSymbol !== 'YT' ? ytSymbol : truncateAddress(claim.yt)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-right">
        <div className="flex flex-col">
          <span className="text-primary text-sm font-medium">{formatUsdCompact(valueUsd)}</span>
          <span className="text-muted-foreground text-xs">
            {formatTimeAgo(claim.blockTimestamp)}
          </span>
          <a
            href={`https://voyager.online/tx/${claim.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            {truncateHash(claim.transactionHash)}
          </a>
        </div>
      </div>
    </div>
  );
}

function LoadingRows(): ReactNode {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between border-b px-4 py-3 last:border-b-0"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-20" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Component that displays user yield claim history.
 * Shows all yield claims with amounts and timestamps.
 */
export function YieldHistory({
  limit = 10,
  days,
  showCard = true,
  className,
}: YieldHistoryProps): ReactNode {
  const { data: yieldData, isLoading: yieldLoading, isError, address } = useUserYield({ days });
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

  // Get limited claims
  const claims = useMemo(() => {
    if (!yieldData) return [];
    return yieldData.claimHistory.slice(0, limit);
  }, [yieldData, limit]);

  const isLoading = yieldLoading || pricesLoading;

  const content = (
    <div className="max-h-[400px] overflow-y-auto">
      {!address ? (
        <div className="text-muted-foreground px-4 py-8 text-center text-sm">
          Connect wallet to view yield history
        </div>
      ) : isLoading ? (
        <LoadingRows />
      ) : isError ? (
        <div className="text-destructive px-4 py-8 text-center text-sm">
          Failed to load yield history
        </div>
      ) : claims.length === 0 ? (
        <div className="text-muted-foreground px-4 py-8 text-center text-sm">
          No yield claimed yet
        </div>
      ) : (
        claims.map((claim) => {
          const ytSymbol = ytSymbolMap.get(claim.yt.toLowerCase()) ?? 'YT';
          return <ClaimRow key={claim.id} claim={claim} price={avgPrice} ytSymbol={ytSymbol} />;
        })
      )}
    </div>
  );

  if (!showCard) {
    return <div className={cn(className)}>{content}</div>;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Yield Claim History</CardTitle>
      </CardHeader>
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  );
}
