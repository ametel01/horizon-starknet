'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDashboardMarkets } from '@/hooks/useMarkets';
import { formatWad } from '@/lib/math/wad';

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
      <StatCard label="Total TVL" value={`${formatWad(totalTvl, 2)} SY`} />
      <StatCard
        label="Avg. Implied APY"
        value={`${avgApy.multipliedBy(100).toFixed(2)}%`}
        valueClassName="text-green-500"
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
        <p className="text-sm text-neutral-400">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${valueClassName ?? 'text-neutral-100'}`}>
          {value}
        </p>
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
