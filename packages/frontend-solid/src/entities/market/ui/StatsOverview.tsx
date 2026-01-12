import { useDashboardMarkets } from '@features/markets';
import { formatWadCompact, fromWad } from '@shared/math/wad';
import { StatCardSkeleton } from '@shared/ui/Skeleton';
import { StatCard, StatCardGrid } from '@shared/ui/StatCard';
import { createMemo, createSignal, type JSX, onMount, Show } from 'solid-js';

/** Layers icon for market count */
function LayersIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

/** Vault icon for TVL */
function VaultIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
      <path d="m7.9 7.9 2.7 2.7" />
      <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
      <path d="m13.4 10.6 2.7-2.7" />
      <circle cx="7.5" cy="16.5" r=".5" fill="currentColor" />
      <path d="m7.9 16.1 2.7-2.7" />
      <circle cx="16.5" cy="16.5" r=".5" fill="currentColor" />
      <path d="m13.4 13.4 2.7 2.7" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

/** Percent icon for APY */
function PercentIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      {...props}
    >
      <line x1="19" x2="5" y1="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

interface StatsOverviewProps {
  class?: string;
}

/**
 * StatsOverview - Dashboard statistics summary with animated values
 *
 * Features:
 * - Total markets count
 * - Total TVL across all markets
 * - Average implied APY
 * - Animated number transitions
 * - Loading skeletons
 */
export function StatsOverview(props: StatsOverviewProps): JSX.Element {
  const { markets, totalTvl, avgApy, isLoading } = useDashboardMarkets();
  const [mounted, setMounted] = createSignal(false);

  onMount(() => {
    setMounted(true);
  });

  // Show skeleton during initial load
  const showSkeleton = createMemo(() => !mounted() || isLoading());

  // Convert WAD bigint to number for animation
  const tvlNumber = createMemo(() => Number(fromWad(totalTvl())));
  const apyNumber = createMemo(() => avgApy().multipliedBy(100).toNumber());

  return (
    <Show
      when={!showSkeleton()}
      fallback={
        <StatCardGrid columns={{ default: 1, sm: 3 }} class={props.class}>
          <StatCardSkeleton />
          <StatCardSkeleton delay={50} />
          <StatCardSkeleton delay={100} />
        </StatCardGrid>
      }
    >
      <StatCardGrid columns={{ default: 1, sm: 3 }} class={props.class}>
        <StatCard
          label="Total Markets"
          numericValue={markets().length}
          valueFormatter={(v) => String(Math.round(v))}
          icon={<LayersIcon class="h-4 w-4" />}
          animationDelay={0}
        />
        <StatCard
          label="Total TVL"
          numericValue={tvlNumber()}
          valueFormatter={(v) => `${formatWadCompact(BigInt(Math.round(v * 1e18)))} SY`}
          icon={<VaultIcon class="h-4 w-4" />}
          animationDelay={50}
        />
        <StatCard
          label="Avg. Implied APY"
          numericValue={apyNumber()}
          valueFormatter={(v) => `${v.toFixed(2)}%`}
          trend="up"
          icon={<PercentIcon class="h-4 w-4" />}
          animationDelay={100}
        />
      </StatCardGrid>
    </Show>
  );
}
