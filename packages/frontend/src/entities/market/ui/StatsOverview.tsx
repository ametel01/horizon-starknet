'use client';

import { useDashboardMarkets } from '@features/markets';
import { useHydrated } from '@shared/hooks';
import { formatWadCompact, fromWad } from '@shared/math/wad';
import { StatCard, StatCardGrid, StatCardSkeleton } from '@shared/ui/StatCard';
import { Layers, Percent, Vault } from 'lucide-react';
import type { ReactNode } from 'react';

export function StatsOverview(): ReactNode {
  const { markets, totalTvl, avgApy, isLoading } = useDashboardMarkets();
  const mounted = useHydrated();

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

  // Convert WAD bigint to number for animation
  const tvlNumber = Number(fromWad(totalTvl));
  const apyNumber = avgApy.multipliedBy(100).toNumber();

  return (
    <StatCardGrid columns={{ default: 1, sm: 3 }}>
      <StatCard
        label="Total Markets"
        numericValue={markets.length}
        valueFormatter={(v) => String(Math.round(v))}
        icon={<Layers className="size-4" />}
        animationDelay={0}
      />
      <StatCard
        label="Total TVL"
        numericValue={tvlNumber}
        valueFormatter={(v) => `${formatWadCompact(BigInt(Math.round(v * 1e18)))} SY`}
        icon={<Vault className="size-4" />}
        animationDelay={50}
      />
      <StatCard
        label="Avg. Implied APY"
        numericValue={apyNumber}
        valueFormatter={(v) => `${v.toFixed(2)}%`}
        trend="up"
        icon={<Percent className="size-4" />}
        animationDelay={100}
      />
    </StatCardGrid>
  );
}
