'use client';

import { Layers, Percent, Vault } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import { useDashboardMarkets } from '@features/markets';
import { formatWadCompact } from '@shared/math/wad';
import { StatCard, StatCardGrid, StatCardSkeleton } from '@shared/ui/StatCard';

export function StatsOverview(): ReactNode {
  const { markets, totalTvl, avgApy, isLoading } = useDashboardMarkets();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show skeleton on server and during initial client render to prevent hydration mismatch
  if (!mounted || isLoading) {
    return (
      <StatCardGrid columns={{ default: 1, sm: 3 }}>
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </StatCardGrid>
    );
  }

  return (
    <StatCardGrid columns={{ default: 1, sm: 3 }}>
      <StatCard
        label="Total Markets"
        value={String(markets.length)}
        icon={<Layers className="h-4 w-4" />}
        animationDelay={0}
      />
      <StatCard
        label="Total TVL"
        value={`${formatWadCompact(totalTvl)} SY`}
        icon={<Vault className="h-4 w-4" />}
        animationDelay={50}
      />
      <StatCard
        label="Avg. Implied APY"
        value={`${avgApy.multipliedBy(100).toFixed(2)}%`}
        trend="up"
        icon={<Percent className="h-4 w-4" />}
        animationDelay={100}
      />
    </StatCardGrid>
  );
}
