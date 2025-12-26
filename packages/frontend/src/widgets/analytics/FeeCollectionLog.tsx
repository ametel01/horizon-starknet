'use client';

import { type ReactNode, useMemo } from 'react';

import { useProtocolFees } from '@features/analytics';
import { useDashboardMarkets } from '@features/markets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@features/price';
import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { Badge } from '@shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';

/**
 * Format USD value with compact notation
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
 * Format timestamp as relative time
 */
function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${String(Math.floor(seconds / 60))}m ago`;
  if (seconds < 86400) return `${String(Math.floor(seconds / 3600))}h ago`;
  if (seconds < 604800) return `${String(Math.floor(seconds / 86400))}d ago`;
  return date.toLocaleDateString();
}

/**
 * Truncate address for display
 */
function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface FeeCollectionLogProps {
  className?: string;
  /** Maximum number of items to show (default: 10) */
  limit?: number;
  /** Show card wrapper */
  showCard?: boolean;
}

interface CollectionRowProps {
  collection: {
    market: string;
    collector: string;
    receiver: string;
    amount: string;
    timestamp: string;
    transactionHash: string;
  };
  marketSymbol: string | undefined;
  amountUsd: number;
}

function CollectionRow({ collection, marketSymbol, amountUsd }: CollectionRowProps): ReactNode {
  const voyagerBaseUrl = 'https://voyager.online';

  return (
    <div className="hover:bg-muted/50 grid grid-cols-[1fr_1fr_100px_80px] items-center gap-4 border-b px-4 py-3 text-sm last:border-b-0">
      <div className="flex flex-col">
        <Badge variant="secondary" className="w-fit font-normal">
          {marketSymbol ?? truncateAddress(collection.market)}
        </Badge>
        <a
          href={`${voyagerBaseUrl}/tx/${collection.transactionHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground mt-1 text-xs transition-colors"
        >
          View tx
        </a>
      </div>
      <div className="flex flex-col">
        <span className="text-muted-foreground text-xs">Receiver</span>
        <a
          href={`${voyagerBaseUrl}/contract/${collection.receiver}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground hover:text-primary font-medium transition-colors"
        >
          {truncateAddress(collection.receiver)}
        </a>
      </div>
      <div className="flex flex-col text-right">
        <span className="text-foreground font-medium">{formatUsdCompact(amountUsd)}</span>
        <span className="text-muted-foreground text-xs">Amount</span>
      </div>
      <div className="flex flex-col text-right">
        <span className="text-muted-foreground text-xs">{formatTimeAgo(collection.timestamp)}</span>
      </div>
    </div>
  );
}

function TableHeader(): ReactNode {
  return (
    <div className="text-muted-foreground bg-muted/30 grid grid-cols-[1fr_1fr_100px_80px] items-center gap-4 border-b px-4 py-2 text-xs font-medium tracking-wider uppercase">
      <span>Market</span>
      <span>Receiver</span>
      <span className="text-right">Amount</span>
      <span className="text-right">Time</span>
    </div>
  );
}

function LoadingRows(): ReactNode {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_1fr_100px_80px] items-center gap-4 border-b px-4 py-3 last:border-b-0"
        >
          <div className="flex flex-col gap-1">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-10" />
          </div>
          <div className="flex flex-col items-end">
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Component that displays recent fee collection events.
 * Shows market, receiver, amount, and timestamp for each collection.
 */
export function FeeCollectionLog({
  className,
  limit = 10,
  showCard = true,
}: FeeCollectionLogProps): ReactNode {
  const { recentCollections, isLoading, isError } = useProtocolFees({ days: 30 });
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

  // Get average price for conversion
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

  // Limit the collections shown
  const displayedCollections = useMemo(() => {
    return recentCollections.slice(0, limit);
  }, [recentCollections, limit]);

  const content = (
    <div className="max-h-[400px] overflow-y-auto">
      <TableHeader />
      {isLoading || pricesLoading ? (
        <LoadingRows />
      ) : isError ? (
        <div className="text-destructive px-4 py-8 text-center text-sm">
          Failed to load fee collections
        </div>
      ) : displayedCollections.length === 0 ? (
        <div className="text-muted-foreground px-4 py-8 text-center text-sm">
          No fee collections yet
        </div>
      ) : (
        displayedCollections.map((collection, index) => {
          const amountNum = Number(fromWad(BigInt(collection.amount)));
          const amountUsd = amountNum * avgPrice;

          return (
            <CollectionRow
              key={`${collection.transactionHash}-${String(index)}`}
              collection={collection}
              marketSymbol={marketSymbols.get(collection.market)}
              amountUsd={amountUsd}
            />
          );
        })
      )}
    </div>
  );

  if (!showCard) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recent Fee Collections</CardTitle>
        <p className="text-muted-foreground text-sm">
          Admin withdrawals of accumulated protocol fees
        </p>
      </CardHeader>
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  );
}

/**
 * Compact inline version for embedding in other components
 */
interface FeeCollectionInlineProps {
  className?: string;
  limit?: number;
}

export function FeeCollectionInline({ className, limit = 3 }: FeeCollectionInlineProps): ReactNode {
  const { recentCollections, isLoading, isError } = useProtocolFees({ days: 30 });
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

  const marketSymbols = useMemo(() => {
    const map = new Map<string, string>();
    for (const market of markets) {
      if (market.metadata?.yieldTokenSymbol) {
        map.set(market.address, market.metadata.yieldTokenSymbol);
      }
    }
    return map;
  }, [markets]);

  const displayedCollections = recentCollections.slice(0, limit);

  if (isLoading || pricesLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: limit }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (isError || displayedCollections.length === 0) {
    return (
      <div className={cn('text-muted-foreground text-sm', className)}>No recent collections</div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {displayedCollections.map((collection, index) => {
        const amountNum = Number(fromWad(BigInt(collection.amount)));
        const amountUsd = amountNum * avgPrice;
        const symbol = marketSymbols.get(collection.market) ?? truncateAddress(collection.market);

        return (
          <div
            key={`${collection.transactionHash}-${String(index)}`}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {symbol}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {formatTimeAgo(collection.timestamp)}
              </span>
            </div>
            <span className="font-medium">{formatUsdCompact(amountUsd)}</span>
          </div>
        );
      })}
    </div>
  );
}
