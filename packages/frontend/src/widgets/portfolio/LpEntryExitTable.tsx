'use client';

import { useUserHistory } from '@features/portfolio';
import type { HistoryEvent } from '@shared/api/types';
import { cn } from '@shared/lib/utils';
import { formatWadCompact } from '@shared/math/wad';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';
import { type ReactNode, useMemo } from 'react';

interface LpEvent {
  id: string;
  type: 'add' | 'remove';
  timestamp: Date;
  transactionHash: string;
  market: string;
  syAmount: bigint;
  ptAmount: bigint;
  lpAmount: bigint;
  exchangeRate: bigint | null;
  impliedRate: bigint | null;
}

/**
 * Parse a history event into an LP event
 */
function parseHistoryEvent(event: HistoryEvent): LpEvent | null {
  if (event.type !== 'add_liquidity' && event.type !== 'remove_liquidity') {
    return null;
  }

  const isAdd = event.type === 'add_liquidity';
  const amounts = event.amounts;

  return {
    id: event.id,
    type: isAdd ? 'add' : 'remove',
    timestamp: new Date(event.blockTimestamp),
    transactionHash: event.transactionHash,
    market: event.market ?? '',
    syAmount: BigInt(isAdd ? (amounts['sy_used'] ?? '0') : (amounts['sy_out'] ?? '0')),
    ptAmount: BigInt(isAdd ? (amounts['pt_used'] ?? '0') : (amounts['pt_out'] ?? '0')),
    lpAmount: BigInt(isAdd ? (amounts['lp_out'] ?? '0') : (amounts['lp_in'] ?? '0')),
    exchangeRate: event.exchangeRate ? BigInt(event.exchangeRate) : null,
    impliedRate: event.impliedRate ? BigInt(event.impliedRate) : null,
  };
}

function collectLpEvents(
  events: HistoryEvent[],
  marketAddress: string | undefined,
  limit: number
): LpEvent[] {
  const result: LpEvent[] = [];
  const marketFilter = marketAddress?.toLowerCase();

  for (const event of events) {
    const parsed = parseHistoryEvent(event);
    if (parsed === null) {
      continue;
    }
    if (marketFilter !== undefined && parsed.market.toLowerCase() !== marketFilter) {
      continue;
    }

    result.push(parsed);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

interface LpEntryExitTableProps {
  /** Filter to specific market address */
  marketAddress?: string;
  className?: string;
  /** Maximum number of events to display */
  limit?: number;
}

/**
 * Table showing LP entry and exit history
 */
export function LpEntryExitTable({
  marketAddress,
  className,
  limit = 20,
}: LpEntryExitTableProps): ReactNode {
  const { events, isLoading, isError, hasMore, fetchNextPage, isFetchingNextPage } = useUserHistory(
    {
      types: ['add_liquidity', 'remove_liquidity'],
      limit: 50,
    }
  );

  const lpEvents = useMemo(() => {
    return collectLpEvents(events, marketAddress, limit);
  }, [events, marketAddress, limit]);

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="py-8 text-center">
          <p className="text-destructive text-sm">Failed to load LP history</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (lpEvents.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">LP History</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No liquidity events found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">LP Entry/Exit History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-muted-foreground p-2 text-right font-medium">Tx</th>
                <th className="text-muted-foreground p- text-left font-medium">Date</th>
                <th className="text-muted-foreground p- text-right font-medium">LP</th>
                <th className="text-muted-foreground p- text-right font-medium">SY</th>
                <th className="text-muted-foreground p- text-right font-medium">PT</th>
                <th className="text-muted-foreground p- text-right font-medium">Tx</th>
              </tr>
            </thead>
            <tbody>
              {lpEvents.map((event) => (
                <tr key={event.id} className="hover:bg-muted/50 border-b transition-colors">
                  <td className="p-2">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        event.type === 'add'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-destructive/10 text-destructive'
                      )}
                    >
                      {event.type === 'add' ? 'Add' : 'Remove'}
                    </span>
                  </td>
                  <td className="text-foreground p-2">
                    {event.timestamp.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: '2-digit',
                    })}
                    <span className="text-muted-foreground ml-1 text-xs">
                      {event.timestamp.toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </td>
                  <td className="text-foreground p-2 text-right font-mono">
                    {event.type === 'add' ? '+' : '-'}
                    {formatWadCompact(event.lpAmount)}
                  </td>
                  <td className="text-foreground p-2 text-right font-mono">
                    {formatWadCompact(event.syAmount)}
                  </td>
                  <td className="text-foreground p-2 text-right font-mono">
                    {formatWadCompact(event.ptAmount)}
                  </td>
                  <td className="p-2 text-right">
                    <a
                      href={`https://starkscan.co/tx/${event.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 text-xs"
                    >
                      {event.transactionHash.slice(0, 6)}...
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {hasMore && lpEvents.length >= limit && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                fetchNextPage();
              }}
              disabled={isFetchingNextPage}
              className="text-primary hover:text-primary/80 text-sm font-medium disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Loading\u2026' : 'Load more'}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact inline version for embedding in position cards
 */
interface LpRecentActivityProps {
  marketAddress?: string;
  limit?: number;
  className?: string;
}

export function LpRecentActivity({
  marketAddress,
  limit = 3,
  className,
}: LpRecentActivityProps): ReactNode {
  const { events, isLoading } = useUserHistory({
    types: ['add_liquidity', 'remove_liquidity'],
    limit: 20,
  });

  const lpEvents = useMemo(() => {
    return collectLpEvents(events, marketAddress, limit);
  }, [events, marketAddress, limit]);

  if (isLoading) {
    return (
      <div className={cn('space-y-1', className)}>
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  if (lpEvents.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-1 text-sm', className)}>
      <div className="text-muted-foreground text-xs font-medium">Recent Activity</div>
      {lpEvents.map((event) => (
        <div key={event.id} className="flex items-center justify-between">
          <span
            className={cn('text-xs', event.type === 'add' ? 'text-primary' : 'text-destructive')}
          >
            {event.type === 'add' ? '+' : '-'}
            {formatWadCompact(event.lpAmount)} LP
          </span>
          <span className="text-muted-foreground text-xs">
            {event.timestamp.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
