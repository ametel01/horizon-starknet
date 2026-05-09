'use client';

import { useDashboardMarkets } from '@features/markets';
import { useHydrated } from '@shared/hooks';
import { StaggeredList } from '@shared/ui/animations';
import { Card, CardContent } from '@shared/ui/Card';
import { SkeletonCard } from '@shared/ui/Skeleton';
import { type ReactNode, useMemo } from 'react';

import { MarketCard } from './MarketCard';

interface MarketListProps {
  className?: string;
}

export function MarketList({ className }: MarketListProps): ReactNode {
  const { markets, isLoading, isError } = useDashboardMarkets();
  const mounted = useHydrated();

  // Determine the recommended market (Paradox of Choice mitigation)
  // Criteria: Highest APY among non-expired markets with reasonable TVL
  // Note: Must be called before any early returns (React hooks rules)
  const recommendedMarketAddress = useMemo(() => {
    if (markets.length === 0) return null;

    // Filter to non-expired markets
    const activeMarkets = markets.filter((m) => !m.isExpired);
    if (activeMarkets.length === 0) return null;

    // Find the market with the highest APY
    const best = activeMarkets.reduce((prev, curr) => {
      const prevApy = prev.impliedApy.toNumber();
      const currApy = curr.impliedApy.toNumber();
      return currApy > prevApy ? curr : prev;
    });

    return best.address;
  }, [markets]);

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
        <Card className="border-destructive/20 bg-destructive/10">
          <CardContent className="p-4 text-center">
            <p className="text-destructive">Failed to load markets. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No markets available.</p>
            <p className="text-muted-foreground mt-2 text-sm">
              Markets will appear here once they are created.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      <StaggeredList
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        initialDelay={100}
        staggerDelay={50}
      >
        {markets.map((market) => (
          <MarketCard
            key={market.address}
            market={market}
            isRecommended={market.address === recommendedMarketAddress}
          />
        ))}
      </StaggeredList>
    </div>
  );
}
