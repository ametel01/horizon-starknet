'use client';

import { type ReactNode, useCallback, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useUserHistory } from '@/hooks/api';
import type { HistoryEvent } from '@/hooks/api/types';
import { formatWadCompact } from '@/lib/math/wad';
import { cn } from '@/lib/utils';

interface TransactionHistoryProps {
  /** Filter by event types */
  types?: ('swap' | 'swap_yt' | 'add_liquidity' | 'remove_liquidity' | 'mint_py' | 'redeem_py')[];
  /** Max items per page */
  limit?: number;
  /** Show card wrapper */
  showCard?: boolean;
  className?: string;
}

const EVENT_TYPE_LABELS: Record<HistoryEvent['type'], string> = {
  swap: 'Swap',
  swap_yt: 'YT Swap',
  add_liquidity: 'Add Liquidity',
  remove_liquidity: 'Remove Liquidity',
  mint_py: 'Mint PT/YT',
  redeem_py: 'Redeem PT/YT',
};

const EVENT_TYPE_COLORS: Record<HistoryEvent['type'], string> = {
  swap: 'bg-primary/10 text-primary',
  swap_yt: 'bg-chart-3/10 text-chart-3',
  add_liquidity: 'bg-chart-2/10 text-chart-2',
  remove_liquidity: 'bg-chart-1/10 text-chart-1',
  mint_py: 'bg-chart-4/10 text-chart-4',
  redeem_py: 'bg-destructive/10 text-destructive',
};

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

function TransactionRow({ event }: { event: HistoryEvent }): ReactNode {
  // Format the amounts based on event type
  const getAmountDisplay = (): string => {
    const amounts = event.amounts;
    switch (event.type) {
      case 'swap':
      case 'swap_yt': {
        const inAmount = amounts.ptIn ?? amounts.syIn ?? amounts.ytIn;
        const outAmount = amounts.ptOut ?? amounts.syOut ?? amounts.ytOut;
        if (inAmount && outAmount) {
          return `${formatWadCompact(inAmount)} -> ${formatWadCompact(outAmount)}`;
        }
        return '-';
      }
      case 'add_liquidity':
        return `+${formatWadCompact(amounts.lpMinted ?? '0')} LP`;
      case 'remove_liquidity':
        return `-${formatWadCompact(amounts.lpBurned ?? '0')} LP`;
      case 'mint_py':
        return `${formatWadCompact(amounts.amountPy ?? '0')} PT/YT`;
      case 'redeem_py':
        return `${formatWadCompact(amounts.amountPy ?? '0')} -> ${formatWadCompact(amounts.amountSy ?? '0')} SY`;
      default:
        return '-';
    }
  };

  return (
    <div className="hover:bg-muted/50 flex items-center justify-between border-b px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className={cn('font-normal', EVENT_TYPE_COLORS[event.type])}>
          {EVENT_TYPE_LABELS[event.type]}
        </Badge>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{getAmountDisplay()}</span>
          {event.underlyingSymbol && (
            <span className="text-muted-foreground text-xs">{event.underlyingSymbol}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-right">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs">
            {formatTimeAgo(event.blockTimestamp)}
          </span>
          <a
            href={`https://starkscan.co/tx/${event.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            {truncateHash(event.transactionHash)}
          </a>
        </div>
      </div>
    </div>
  );
}

function LoadingRows(): ReactNode {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
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
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Component that displays user transaction history with infinite scroll.
 * Shows swap, liquidity, and mint/redeem events for the connected wallet.
 */
export function TransactionHistory({
  types,
  limit = 20,
  showCard = true,
  className,
}: TransactionHistoryProps): ReactNode {
  const { events, isLoading, isError, hasMore, fetchNextPage, isFetchingNextPage } = useUserHistory(
    {
      types,
      limit,
    }
  );

  const observer = useRef<IntersectionObserver | null>(null);
  const lastEventRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading || isFetchingNextPage) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasMore) {
          fetchNextPage();
        }
      });
      if (node) observer.current.observe(node);
    },
    [isLoading, isFetchingNextPage, hasMore, fetchNextPage]
  );

  const content = (
    <div className="max-h-[500px] overflow-y-auto">
      {isLoading ? (
        <LoadingRows />
      ) : isError ? (
        <div className="text-destructive px-4 py-8 text-center text-sm">
          Failed to load transaction history
        </div>
      ) : events.length === 0 ? (
        <div className="text-muted-foreground px-4 py-8 text-center text-sm">
          No transactions yet
        </div>
      ) : (
        <>
          {events.map((event, index) => (
            <div key={event.id} ref={index === events.length - 1 ? lastEventRef : undefined}>
              <TransactionRow event={event} />
            </div>
          ))}
          {isFetchingNextPage && <LoadingRows />}
        </>
      )}
    </div>
  );

  if (!showCard) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
      </CardHeader>
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  );
}
