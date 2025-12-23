'use client';

import { type ReactNode, useCallback, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMarketSwaps } from '@/hooks/api';
import type { SwapEvent } from '@/hooks/api/types';
import { formatWadCompact, formatWadPercent } from '@/lib/math/wad';
import { cn } from '@/lib/utils';

interface SwapHistoryTableProps {
  /** Market address to fetch swaps for */
  marketAddress: string | undefined;
  /** Max items per page */
  limit?: number;
  /** Show card wrapper */
  showCard?: boolean;
  className?: string;
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

function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function SwapRow({ swap }: { swap: SwapEvent }): ReactNode {
  // Determine swap type and direction
  const isYtSwap = swap.type === 'yt';

  let direction: string;
  let directionColor: string;
  let inAmount: string;
  let outAmount: string;

  if (isYtSwap) {
    // YT swap: check if YT is going in or out
    const isYtIn = BigInt(swap.ytIn ?? '0') > 0n;
    direction = isYtIn ? 'YT -> SY' : 'SY -> YT';
    directionColor = 'bg-chart-3/10 text-chart-3';
    inAmount = isYtIn ? (swap.ytIn ?? '0') : swap.syIn;
    outAmount = isYtIn ? swap.syOut : (swap.ytOut ?? '0');
  } else {
    // PT swap
    const isPtIn = BigInt(swap.ptIn) > 0n;
    direction = isPtIn ? 'PT -> SY' : 'SY -> PT';
    directionColor = isPtIn ? 'bg-chart-1/10 text-chart-1' : 'bg-primary/10 text-primary';
    inAmount = isPtIn ? swap.ptIn : swap.syIn;
    outAmount = isPtIn ? swap.syOut : swap.ptOut;
  }

  // Calculate rate change (may not be available for router swaps)
  const hasRateData = swap.impliedRateBefore && swap.impliedRateAfter;
  let rateChangeDisplay: ReactNode = <span className="text-muted-foreground text-xs">-</span>;

  if (hasRateData && swap.impliedRateBefore && swap.impliedRateAfter) {
    const rateBefore = BigInt(swap.impliedRateBefore);
    const rateAfter = BigInt(swap.impliedRateAfter);
    const rateChange = rateAfter - rateBefore;
    const rateChangePositive = rateChange > 0n;
    rateChangeDisplay = (
      <span className={cn('text-xs', rateChangePositive ? 'text-chart-2' : 'text-destructive')}>
        {rateChangePositive ? '+' : ''}
        {formatWadPercent(rateChange.toString())}
      </span>
    );
  }

  return (
    <div className="hover:bg-muted/50 grid grid-cols-[80px_1fr_1fr_100px_80px] items-center gap-4 border-b px-4 py-3 text-sm last:border-b-0">
      <Badge variant="secondary" className={cn('justify-center font-normal', directionColor)}>
        {direction}
      </Badge>
      <div className="flex flex-col">
        <span className="font-medium">{formatWadCompact(inAmount)}</span>
        <span className="text-muted-foreground text-xs">In</span>
      </div>
      <div className="flex flex-col">
        <span className="font-medium">{formatWadCompact(outAmount)}</span>
        <span className="text-muted-foreground text-xs">Out</span>
      </div>
      <div className="flex flex-col text-right">
        {rateChangeDisplay}
        <span className="text-muted-foreground text-xs">Rate Δ</span>
      </div>
      <div className="flex flex-col text-right">
        <span className="text-muted-foreground text-xs">{formatTimeAgo(swap.blockTimestamp)}</span>
        <a
          href={`https://voyager.online/contract/${swap.sender}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
        >
          {truncateAddress(swap.sender)}
        </a>
      </div>
    </div>
  );
}

function TableHeader(): ReactNode {
  return (
    <div className="text-muted-foreground bg-muted/30 grid grid-cols-[80px_1fr_1fr_100px_80px] items-center gap-4 border-b px-4 py-2 text-xs font-medium tracking-wider uppercase">
      <span>Type</span>
      <span>Amount In</span>
      <span>Amount Out</span>
      <span className="text-right">Impact</span>
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
          className="grid grid-cols-[80px_1fr_1fr_100px_80px] items-center gap-4 border-b px-4 py-3 last:border-b-0"
        >
          <Skeleton className="h-6 w-16" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-8" />
          </div>
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-8" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-8" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Component that displays market swap history in a table format.
 * Shows swap direction, amounts, rate impact, and trader info.
 */
export function SwapHistoryTable({
  marketAddress,
  limit = 20,
  showCard = true,
  className,
}: SwapHistoryTableProps): ReactNode {
  const { swaps, isLoading, isError, hasMore, fetchNextPage, isFetchingNextPage } = useMarketSwaps(
    marketAddress,
    { limit }
  );

  const observer = useRef<IntersectionObserver | null>(null);
  const lastSwapRef = useCallback(
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

  if (!marketAddress) {
    return (
      <div className={cn('text-muted-foreground py-8 text-center text-sm', className)}>
        Select a market to view swap history
      </div>
    );
  }

  const content = (
    <div className="max-h-[500px] overflow-y-auto">
      <TableHeader />
      {isLoading ? (
        <LoadingRows />
      ) : isError ? (
        <div className="text-destructive px-4 py-8 text-center text-sm">
          Failed to load swap history
        </div>
      ) : swaps.length === 0 ? (
        <div className="text-muted-foreground px-4 py-8 text-center text-sm">
          No swaps yet for this market
        </div>
      ) : (
        <>
          {swaps.map((swap, index) => (
            <div key={swap.id} ref={index === swaps.length - 1 ? lastSwapRef : undefined}>
              <SwapRow swap={swap} />
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
        <CardTitle>Recent Swaps</CardTitle>
      </CardHeader>
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  );
}
