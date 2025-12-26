'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { useDashboardMarkets } from '@/hooks/useMarkets';
import { cn } from '@shared/lib/utils';
import { formatWadCompact } from '@shared/math/wad';
import { Card, CardContent } from '@shared/ui/Card';
import { Skeleton } from '@shared/ui/Skeleton';

export function StatsOverview(): ReactNode {
  const { markets, totalTvl, avgApy, isLoading } = useDashboardMarkets();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show skeleton on server and during initial client render to prevent hydration mismatch
  if (!mounted || isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Total Markets" value={String(markets.length)} />
      <StatCard label="Total TVL" value={`${formatWadCompact(totalTvl)} SY`} />
      <StatCard
        label="Avg. Implied APY"
        value={`${avgApy.multipliedBy(100).toFixed(2)}%`}
        valueClassName="text-primary"
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  valueClassName?: string;
}

function StatCard({ label, value, valueClassName }: StatCardProps): ReactNode {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className={cn('text-foreground mt-1 text-2xl font-semibold', valueClassName)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton(): ReactNode {
  return (
    <Card>
      <CardContent className="pt-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-2 h-8 w-32" />
      </CardContent>
    </Card>
  );
}
