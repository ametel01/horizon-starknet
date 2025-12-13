'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { SkeletonCard } from '@/components/ui/Skeleton';
import { useDashboardMarkets } from '@/hooks/useMarkets';

import { MarketCard } from './MarketCard';

interface MarketListProps {
  className?: string;
}

export function MarketList({ className }: MarketListProps): ReactNode {
  const { markets, isLoading, isError } = useDashboardMarkets();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show skeleton on server and during initial client render to prevent hydration mismatch
  if (!mounted || isLoading) {
    return (
      <div className={className}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-center">
          <p className="text-red-500">Failed to load markets. Please try again.</p>
        </div>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
          <p className="text-neutral-400">No markets available.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Markets will appear here once they are created.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {markets.map((market) => (
          <MarketCard key={market.address} market={market} />
        ))}
      </div>
    </div>
  );
}
