import { useDashboardMarkets } from '@features/markets';
import { Card, CardContent } from '@shared/ui/Card';
import { MarketCardSkeleton, SkeletonGrid } from '@shared/ui/Skeleton';
import { createMemo, For, type JSX, Show, createSignal, onMount } from 'solid-js';

import { MarketCard } from './MarketCard';

interface MarketListProps {
  class?: string;
  /** Called when trade button is clicked on a market card */
  onTrade?: (marketAddress: string) => void;
  /** Called when pool button is clicked on a market card */
  onPool?: (marketAddress: string) => void;
}

/**
 * MarketList - Displays a grid of market cards with loading and error states
 *
 * Features:
 * - Automatic market fetching via useDashboardMarkets
 * - Staggered entrance animations
 * - Recommended market highlighting (highest APY)
 * - Loading skeleton grid
 * - Error handling
 */
export function MarketList(props: MarketListProps): JSX.Element {
  const { markets, isLoading, isError } = useDashboardMarkets();
  const [mounted, setMounted] = createSignal(false);

  onMount(() => {
    setMounted(true);
  });

  // Determine the recommended market (Paradox of Choice mitigation)
  // Criteria: Highest APY among non-expired markets with reasonable TVL
  const recommendedMarketAddress = createMemo(() => {
    const marketList = markets();
    if (marketList.length === 0) return null;

    // Filter to non-expired markets
    const activeMarkets = marketList.filter((m) => !m.isExpired);
    if (activeMarkets.length === 0) return null;

    // Find the market with the highest APY
    const best = activeMarkets.reduce((prev, curr) => {
      const prevApy = prev.impliedApy.toNumber();
      const currApy = curr.impliedApy.toNumber();
      return currApy > prevApy ? curr : prev;
    });

    return best.address;
  });

  // Show skeleton during initial load
  const showSkeleton = createMemo(() => !mounted() || isLoading());

  return (
    <div class={props.class}>
      {/* Loading state */}
      <Show when={showSkeleton()}>
        <SkeletonGrid
          count={3}
          skeleton={MarketCardSkeleton}
          columns={{ default: 1, sm: 2, lg: 3 }}
          staggerDelay={75}
        />
      </Show>

      {/* Error state */}
      <Show when={!showSkeleton() && isError()}>
        <Card class="border-destructive/20 bg-destructive/10">
          <CardContent class="p-4 text-center">
            <p class="text-destructive">Failed to load markets. Please try again.</p>
          </CardContent>
        </Card>
      </Show>

      {/* Empty state */}
      <Show when={!showSkeleton() && !isError() && markets().length === 0}>
        <Card>
          <CardContent class="p-8 text-center">
            <p class="text-muted-foreground">No markets available.</p>
            <p class="text-muted-foreground mt-2 text-sm">
              Markets will appear here once they are created.
            </p>
          </CardContent>
        </Card>
      </Show>

      {/* Market list */}
      <Show when={!showSkeleton() && !isError() && markets().length > 0}>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <For each={markets()}>
            {(market, index) => (
              <div
                class="animate-fade-up opacity-0"
                style={{ 'animation-delay': `${100 + index() * 50}ms`, 'animation-fill-mode': 'forwards' }}
              >
                <MarketCard
                  market={market}
                  isRecommended={market.address === recommendedMarketAddress()}
                  onTrade={props.onTrade}
                  onPool={props.onPool}
                />
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
