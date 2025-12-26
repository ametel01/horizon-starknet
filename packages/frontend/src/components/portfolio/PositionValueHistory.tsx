'use client';

import { type ReactNode, useMemo } from 'react';

import { usePortfolioHistory, type PortfolioValueEvent } from '@/hooks/api';
import { useDashboardMarkets } from '@/hooks/useMarkets';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@/hooks/usePrices';
import { useStarknet } from '@/hooks/useStarknet';
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
  if (Math.abs(value) < 0.01) return value < 0 ? '-<$0.01' : '<$0.01';
  if (Math.abs(value) < 1000) return `$${value.toFixed(2)}`;
  if (Math.abs(value) < 1_000_000) return `$${(value / 1000).toFixed(2)}K`;
  if (Math.abs(value) < 1_000_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${(value / 1_000_000_000).toFixed(2)}B`;
}

/**
 * Format token amount with appropriate decimals
 */
function formatAmount(value: bigint): string {
  const num = Number(fromWad(value));
  if (Math.abs(num) < 0.0001) return '0';
  if (Math.abs(num) < 1) return num.toFixed(4);
  if (Math.abs(num) < 1000) return num.toFixed(2);
  if (Math.abs(num) < 1_000_000) return `${(num / 1000).toFixed(2)}K`;
  return `${(num / 1_000_000).toFixed(2)}M`;
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
function truncateHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

/**
 * Get event type display info
 */
function getEventTypeInfo(type: PortfolioValueEvent['type']): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  switch (type) {
    case 'deposit':
      return { label: 'Deposit', variant: 'default' };
    case 'withdraw':
      return { label: 'Withdraw', variant: 'secondary' };
    case 'mint_py':
      return { label: 'Mint', variant: 'default' };
    case 'redeem_py':
      return { label: 'Redeem', variant: 'secondary' };
    case 'swap':
      return { label: 'Swap', variant: 'outline' };
    case 'swap_yt':
      return { label: 'YT Swap', variant: 'outline' };
    case 'add_liquidity':
      return { label: 'Add LP', variant: 'default' };
    case 'remove_liquidity':
      return { label: 'Remove LP', variant: 'secondary' };
    default:
      return { label: type, variant: 'outline' };
  }
}

interface PositionValueHistoryProps {
  className?: string;
  /** Maximum number of events to show (default: 10) */
  limit?: number;
  /** Number of days of history (default: 30) */
  days?: number;
  /** Show card wrapper */
  showCard?: boolean;
}

interface EventRowProps {
  event: PortfolioValueEvent;
  price: number;
}

function EventRow({ event, price }: EventRowProps): ReactNode {
  const voyagerBaseUrl = 'https://voyager.online';
  const typeInfo = getEventTypeInfo(event.type);

  // Calculate value changes
  const syDelta = BigInt(event.syDelta);
  const ptDelta = BigInt(event.ptDelta);
  const ytDelta = BigInt(event.ytDelta);
  const lpDelta = BigInt(event.lpDelta);

  // Net value change (simplified)
  // SY and PT are valued at ~1:1 with underlying
  // LP tokens represent shares of both SY and PT reserves, so ~2x value
  // YT is a fraction of SY value (yield component only)
  const syValue = Number(fromWad(syDelta)) * price;
  const ptValue = Number(fromWad(ptDelta)) * price;
  const ytValue = Number(fromWad(ytDelta)) * price * 0.1;
  const lpValue = Number(fromWad(lpDelta)) * price * 2; // LP = share of SY + PT pool
  const netValueChange = syValue + ptValue + ytValue + lpValue;

  return (
    <div className="hover:bg-muted/50 grid grid-cols-[80px_1fr_100px_100px_80px] items-center gap-4 border-b px-4 py-3 text-sm last:border-b-0">
      <div>
        <Badge variant={typeInfo.variant} className="text-xs">
          {typeInfo.label}
        </Badge>
      </div>
      <div className="flex flex-col">
        <div className="text-foreground flex items-center gap-2">
          {syDelta !== 0n && (
            <span className={cn(syDelta > 0n ? 'text-primary' : 'text-destructive')}>
              {syDelta > 0n ? '+' : ''}
              {formatAmount(syDelta)} SY
            </span>
          )}
          {ptDelta !== 0n && (
            <span className={cn(ptDelta > 0n ? 'text-primary' : 'text-destructive')}>
              {ptDelta > 0n ? '+' : ''}
              {formatAmount(ptDelta)} PT
            </span>
          )}
          {ytDelta !== 0n && (
            <span className={cn(ytDelta > 0n ? 'text-primary' : 'text-destructive')}>
              {ytDelta > 0n ? '+' : ''}
              {formatAmount(ytDelta)} YT
            </span>
          )}
          {lpDelta !== 0n && (
            <span className={cn(lpDelta > 0n ? 'text-primary' : 'text-destructive')}>
              {lpDelta > 0n ? '+' : ''}
              {formatAmount(lpDelta)} LP
            </span>
          )}
        </div>
        {event.underlyingSymbol && (
          <span className="text-muted-foreground text-xs">{event.underlyingSymbol}</span>
        )}
      </div>
      <div className="text-right">
        <span
          className={cn(
            'font-medium',
            netValueChange > 0 ? 'text-primary' : netValueChange < 0 ? 'text-destructive' : ''
          )}
        >
          {netValueChange !== 0 && (netValueChange > 0 ? '+' : '')}
          {formatUsdCompact(netValueChange)}
        </span>
      </div>
      <div className="text-right">
        <a
          href={`${voyagerBaseUrl}/tx/${event.transactionHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
        >
          {truncateHash(event.transactionHash)}
        </a>
      </div>
      <div className="text-right">
        <span className="text-muted-foreground text-xs">{formatTimeAgo(event.timestamp)}</span>
      </div>
    </div>
  );
}

function TableHeader(): ReactNode {
  return (
    <div className="text-muted-foreground bg-muted/30 grid grid-cols-[80px_1fr_100px_100px_80px] items-center gap-4 border-b px-4 py-2 text-xs font-medium tracking-wider uppercase">
      <span>Type</span>
      <span>Changes</span>
      <span className="text-right">Value</span>
      <span className="text-right">Tx</span>
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
          className="grid grid-cols-[80px_1fr_100px_100px_80px] items-center gap-4 border-b px-4 py-3 last:border-b-0"
        >
          <Skeleton className="h-6 w-16" />
          <div className="flex gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="ml-auto h-4 w-20" />
          <Skeleton className="ml-auto h-4 w-12" />
        </div>
      ))}
    </>
  );
}

/**
 * Component that displays individual position value changes over time.
 * Shows a table of events with their value impact.
 */
export function PositionValueHistory({
  className,
  limit = 10,
  days = 30,
  showCard = true,
}: PositionValueHistoryProps): ReactNode {
  const { isConnected } = useStarknet();
  const { events, isLoading, isError } = usePortfolioHistory({ days, limit: limit * 2 });
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

  const displayedEvents = useMemo(() => {
    return events.slice(0, limit);
  }, [events, limit]);

  const content = (
    <div className="max-h-[400px] overflow-y-auto">
      <TableHeader />
      {isLoading || pricesLoading ? (
        <LoadingRows />
      ) : isError ? (
        <div className="text-destructive px-4 py-8 text-center text-sm">
          Failed to load position history
        </div>
      ) : !isConnected ? (
        <div className="text-muted-foreground px-4 py-8 text-center text-sm">
          Connect wallet to view history
        </div>
      ) : displayedEvents.length === 0 ? (
        <div className="text-muted-foreground px-4 py-8 text-center text-sm">
          No position changes yet
        </div>
      ) : (
        displayedEvents.map((event, index) => (
          <EventRow
            key={`${event.transactionHash}-${String(index)}`}
            event={event}
            price={avgPrice}
          />
        ))
      )}
    </div>
  );

  if (!showCard) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Position Changes</CardTitle>
        <p className="text-muted-foreground text-sm">
          Recent transactions affecting your portfolio
        </p>
      </CardHeader>
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  );
}

/**
 * Compact inline version showing recent events
 */
interface PositionValueInlineProps {
  className?: string;
  limit?: number;
}

export function PositionValueInline({ className, limit = 3 }: PositionValueInlineProps): ReactNode {
  const { isConnected } = useStarknet();
  const { events, isLoading, isError } = usePortfolioHistory({ days: 7, limit });
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

  if (!isConnected || isLoading || pricesLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: limit }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (isError || events.length === 0) {
    return <div className={cn('text-muted-foreground text-sm', className)}>No recent activity</div>;
  }

  return (
    <div className={cn('space-y-2', className)}>
      {events.slice(0, limit).map((event, index) => {
        const typeInfo = getEventTypeInfo(event.type);
        const syDelta = BigInt(event.syDelta);
        const ptDelta = BigInt(event.ptDelta);
        const ytDelta = BigInt(event.ytDelta);
        const lpDelta = BigInt(event.lpDelta);
        const syValue = Number(fromWad(syDelta)) * avgPrice;
        const ptValue = Number(fromWad(ptDelta)) * avgPrice;
        const ytValue = Number(fromWad(ytDelta)) * avgPrice * 0.1;
        const lpValue = Number(fromWad(lpDelta)) * avgPrice * 2;
        const netValue = syValue + ptValue + ytValue + lpValue;

        return (
          <div
            key={`${event.transactionHash}-${String(index)}`}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <Badge variant={typeInfo.variant} className="text-xs">
                {typeInfo.label}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {formatTimeAgo(event.timestamp)}
              </span>
            </div>
            <span
              className={cn(
                'font-medium',
                netValue > 0 ? 'text-primary' : netValue < 0 ? 'text-destructive' : ''
              )}
            >
              {netValue !== 0 && (netValue > 0 ? '+' : '')}
              {formatUsdCompact(netValue)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
