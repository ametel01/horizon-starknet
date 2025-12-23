'use client';

import { type ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useProtocolStats } from '@/hooks/api';
import { formatWadCompact } from '@/lib/math/wad';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  isLoading?: boolean;
  className?: string;
}

function StatCard({ label, value, subValue, isLoading, className }: StatCardProps): ReactNode {
  return (
    <Card size="sm" className={cn('min-w-[140px]', className)}>
      <CardContent className="pt-4">
        <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          {label}
        </div>
        {isLoading ? (
          <Skeleton className="mt-2 h-8 w-20" />
        ) : (
          <div className="mt-1">
            <div className="text-2xl font-bold">{value}</div>
            {subValue && <div className="text-muted-foreground text-xs">{subValue}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ProtocolStatsProps {
  className?: string;
}

/**
 * Component that displays protocol-wide statistics.
 * Shows TVL, volume, fees, and trading activity metrics.
 */
export function ProtocolStats({ className }: ProtocolStatsProps): ReactNode {
  const { stats, isLoading, isError } = useProtocolStats();

  if (isError) {
    return (
      <div
        className={cn('bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm', className)}
      >
        Failed to load protocol statistics
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6', className)}>
      <StatCard
        label="Total TVL"
        value={formatWadCompact(stats.tvl)}
        subValue={String(stats.marketCount) + ' markets'}
        isLoading={isLoading}
      />
      <StatCard
        label="24h Volume"
        value={formatWadCompact(stats.volume24h)}
        isLoading={isLoading}
      />
      <StatCard label="24h Swaps" value={stats.swaps24h.toLocaleString()} isLoading={isLoading} />
      <StatCard label="24h Fees" value={formatWadCompact(stats.fees24h)} isLoading={isLoading} />
      <StatCard
        label="Unique Traders"
        value={stats.uniqueTraders24h.toLocaleString()}
        subValue="last 24h"
        isLoading={isLoading}
      />
      <StatCard label="Active Markets" value={stats.marketCount.toString()} isLoading={isLoading} />
    </div>
  );
}

/**
 * Compact version showing only key metrics (TVL, Volume, Fees)
 */
export function ProtocolStatsCompact({ className }: ProtocolStatsProps): ReactNode {
  const { stats, isLoading, isError } = useProtocolStats();

  if (isError) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-6 text-sm', className)}>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">TVL:</span>
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <span className="font-medium">{formatWadCompact(stats.tvl)}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">24h Vol:</span>
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <span className="font-medium">{formatWadCompact(stats.volume24h)}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">24h Fees:</span>
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <span className="font-medium">{formatWadCompact(stats.fees24h)}</span>
        )}
      </div>
    </div>
  );
}
