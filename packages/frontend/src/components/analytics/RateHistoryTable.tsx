'use client';

import { type ReactNode, useMemo, useState } from 'react';

import { useMarketRates } from '@features/markets';
import { cn } from '@shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';

/**
 * Format percentage with appropriate precision
 */
function formatPercent(value: number): string {
  if (value === 0) return '0%';
  if (Math.abs(value) < 0.01) return '<0.01%';
  if (Math.abs(value) < 1) return `${value.toFixed(2)}%`;
  return `${value.toFixed(2)}%`;
}

/**
 * Format exchange rate
 */
function formatExchangeRate(value: number): string {
  return value.toFixed(6);
}

interface RateHistoryTableProps {
  marketAddress: string;
  className?: string;
  limit?: number;
  showExchangeRate?: boolean;
}

interface TableRow {
  date: string;
  displayDate: string;
  impliedRatePercent: number;
  exchangeRateNum: number;
  change: number;
  ohlc?:
    | {
        open: number;
        high: number;
        low: number;
        close: number;
      }
    | undefined;
}

/**
 * Tabular display of rate history for a market.
 * Shows date, implied rate, change, and optionally exchange rate.
 */
export function RateHistoryTable({
  marketAddress,
  className,
  limit = 10,
  showExchangeRate = false,
}: RateHistoryTableProps): ReactNode {
  const [page, setPage] = useState(0);

  const {
    data: ratesData,
    isLoading,
    isError,
  } = useMarketRates(marketAddress, {
    resolution: 'daily',
    days: 90,
  });

  // Process data for the table
  const tableData = useMemo((): TableRow[] => {
    if (!ratesData) return [];

    const points = ratesData.dataPoints;

    // Process in reverse order (most recent first)
    return [...points].reverse().map((point, idx) => {
      // prevPoint is the next in reverse order (which is previous in original order)
      const originalIdx = points.length - 1 - idx;
      const prevPoint = originalIdx > 0 ? points[originalIdx - 1] : undefined;

      const change = prevPoint ? point.impliedRatePercent - prevPoint.impliedRatePercent : 0;

      return {
        date: point.timestamp.toISOString(),
        displayDate: point.timestamp.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        impliedRatePercent: point.impliedRatePercent,
        exchangeRateNum: point.exchangeRateNum,
        change,
        ohlc: point.ohlc,
      };
    });
  }, [ratesData]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const start = page * limit;
    return tableData.slice(start, start + limit);
  }, [tableData, page, limit]);

  const totalPages = Math.ceil(tableData.length / limit);

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
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
          <p className="text-destructive text-sm">Failed to load rate history</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (tableData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Rate History</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">No rate history available</p>
        </CardContent>
      </Card>
    );
  }

  const hasOhlcData = tableData.some((d) => d.ohlc !== undefined);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Rate History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-muted-foreground px-2 py-2 text-left font-medium">Date</th>
                <th className="text-muted-foreground px-2 py-2 text-right font-medium">
                  Rate (APY)
                </th>
                <th className="text-muted-foreground px-2 py-2 text-right font-medium">Change</th>
                {hasOhlcData && (
                  <>
                    <th className="text-muted-foreground px-2 py-2 text-right font-medium">High</th>
                    <th className="text-muted-foreground px-2 py-2 text-right font-medium">Low</th>
                  </>
                )}
                {showExchangeRate && (
                  <th className="text-muted-foreground px-2 py-2 text-right font-medium">
                    Exchange Rate
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row) => (
                <tr key={row.date} className="hover:bg-muted/50 border-b transition-colors">
                  <td className="text-foreground px-2 py-2">{row.displayDate}</td>
                  <td className="text-foreground px-2 py-2 text-right font-medium">
                    {formatPercent(row.impliedRatePercent)}
                  </td>
                  <td
                    className={cn(
                      'px-2 py-2 text-right font-medium',
                      row.change > 0
                        ? 'text-primary'
                        : row.change < 0
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    )}
                  >
                    {row.change > 0 ? '+' : ''}
                    {formatPercent(row.change)}
                  </td>
                  {hasOhlcData && (
                    <>
                      <td className="text-foreground px-2 py-2 text-right">
                        {row.ohlc ? formatPercent(row.ohlc.high) : '-'}
                      </td>
                      <td className="text-foreground px-2 py-2 text-right">
                        {row.ohlc ? formatPercent(row.ohlc.low) : '-'}
                      </td>
                    </>
                  )}
                  {showExchangeRate && (
                    <td className="text-muted-foreground px-2 py-2 text-right">
                      {formatExchangeRate(row.exchangeRateNum)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              Showing {page * limit + 1}-{Math.min((page + 1) * limit, tableData.length)} of{' '}
              {tableData.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPage((p) => Math.max(0, p - 1));
                }}
                disabled={page === 0}
                className="text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 text-sm disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => {
                  setPage((p) => Math.min(totalPages - 1, p + 1));
                }}
                disabled={page >= totalPages - 1}
                className="text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 text-sm disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact inline rate history (for embedding in other components)
 */
interface RateHistoryInlineProps {
  marketAddress: string;
  limit?: number;
  className?: string;
}

export function RateHistoryInline({
  marketAddress,
  limit = 5,
  className,
}: RateHistoryInlineProps): ReactNode {
  const { data: ratesData, isLoading } = useMarketRates(marketAddress, {
    resolution: 'daily',
    days: 30,
  });

  if (isLoading) {
    return (
      <div className={cn('space-y-1', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  if (!ratesData || ratesData.dataPoints.length === 0) {
    return null;
  }

  // Get last N points in reverse order
  const points = ratesData.dataPoints.slice(-limit).reverse();

  return (
    <div className={cn('space-y-1 text-sm', className)}>
      {points.map((point, i) => {
        const prevPoint = i < points.length - 1 ? points[i + 1] : null;
        const change = prevPoint ? point.impliedRatePercent - prevPoint.impliedRatePercent : 0;

        return (
          <div key={point.timestamp.toISOString()} className="flex justify-between">
            <span className="text-muted-foreground">{point.displayDate}</span>
            <div className="flex gap-2">
              <span className="text-foreground font-medium">
                {formatPercent(point.impliedRatePercent)}
              </span>
              <span
                className={cn(
                  'text-xs',
                  change > 0
                    ? 'text-primary'
                    : change < 0
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                )}
              >
                {change > 0 ? '+' : ''}
                {formatPercent(change)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
