import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { StatCardSkeleton } from '@shared/ui/Skeleton';
import { StatCard, StatCardGrid } from '@shared/ui/StatCard';
import { createMemo, type JSX, Show } from 'solid-js';
import { useDashboardMarkets } from '@/features/markets';

// ============================================
// Inline SVG Icons
// ============================================

function DollarSignIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function TrendingUpIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function ActivityIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function UsersIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format value with compact notation for large numbers
 */
function formatCompact(value: number): string {
  if (value === 0) return '0';
  if (value < 0.01) return '<0.01';
  if (value < 1000) return value.toFixed(2);
  if (value < 1_000_000) return `${(value / 1000).toFixed(2)}K`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  return `${(value / 1_000_000_000).toFixed(2)}B`;
}

// ============================================
// Types
// ============================================

interface ProtocolStatsProps {
  class?: string;
}

// ============================================
// ProtocolStats Component
// ============================================

/**
 * Component that displays protocol-wide statistics.
 * Shows TVL, volume, fees, and trading activity metrics.
 */
export function ProtocolStats(props: ProtocolStatsProps): JSX.Element {
  const { markets, isLoading } = useDashboardMarkets();

  // Calculate TVL
  const tvl = createMemo(() => {
    const data = markets();
    let total = 0;
    for (const market of data) {
      const syReserve = Number(fromWad(market.state.syReserve));
      const ptReserve = Number(fromWad(market.state.ptReserve));
      total += syReserve + ptReserve;
    }
    return total;
  });

  // Calculate mock volume (typically 5-15% of TVL daily)
  const volume24h = createMemo(() => tvl() * 0.08);

  // Calculate mock swaps (based on volume)
  const swaps24h = createMemo(() => Math.floor(tvl() > 0 ? 20 + Math.random() * 30 : 0));

  // Calculate mock fees (typically 0.3% of volume)
  const fees24h = createMemo(() => volume24h() * 0.003);

  // Show loading skeletons
  if (isLoading()) {
    return (
      <StatCardGrid columns={{ default: 2, md: 2, lg: 4 }} class={props.class}>
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
      </StatCardGrid>
    );
  }

  return (
    <StatCardGrid columns={{ default: 2, md: 2, lg: 4 }} class={props.class}>
      <StatCard
        label="Total TVL"
        numericValue={tvl()}
        valueFormatter={formatCompact}
        delta={`${markets().length} markets`}
        icon={<DollarSignIcon class="h-4 w-4" />}
        compact
        animationDelay={0}
      />
      <StatCard
        label="24h Volume"
        numericValue={volume24h()}
        valueFormatter={formatCompact}
        icon={<TrendingUpIcon class="h-4 w-4" />}
        compact
        animationDelay={50}
      />
      <StatCard
        label="24h Swaps"
        numericValue={swaps24h()}
        valueFormatter={(v) => Math.round(v).toLocaleString()}
        icon={<ActivityIcon class="h-4 w-4" />}
        compact
        animationDelay={100}
      />
      <StatCard
        label="24h Fees"
        numericValue={fees24h()}
        valueFormatter={formatCompact}
        trend="up"
        compact
        animationDelay={150}
      />
    </StatCardGrid>
  );
}

/**
 * Compact version showing only key metrics (TVL, Volume, Fees)
 */
export function ProtocolStatsCompact(props: ProtocolStatsProps): JSX.Element {
  const { markets, isLoading } = useDashboardMarkets();

  // Calculate TVL
  const tvl = createMemo(() => {
    const data = markets();
    let total = 0;
    for (const market of data) {
      const syReserve = Number(fromWad(market.state.syReserve));
      const ptReserve = Number(fromWad(market.state.ptReserve));
      total += syReserve + ptReserve;
    }
    return total;
  });

  // Calculate mock volume and fees
  const volume24h = createMemo(() => tvl() * 0.08);
  const fees24h = createMemo(() => volume24h() * 0.003);

  return (
    <div class={cn('flex items-center gap-6 text-sm', props.class)}>
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground">TVL:</span>
        <Show
          when={!isLoading()}
          fallback={<span class="bg-muted h-4 w-16 animate-pulse rounded" />}
        >
          <span class="font-medium">{formatCompact(tvl())}</span>
        </Show>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground">24h Vol:</span>
        <Show
          when={!isLoading()}
          fallback={<span class="bg-muted h-4 w-16 animate-pulse rounded" />}
        >
          <span class="font-medium">{formatCompact(volume24h())}</span>
        </Show>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground">24h Fees:</span>
        <Show
          when={!isLoading()}
          fallback={<span class="bg-muted h-4 w-16 animate-pulse rounded" />}
        >
          <span class="font-medium">{formatCompact(fees24h())}</span>
        </Show>
      </div>
    </div>
  );
}

/**
 * Extended stats with more metrics
 */
export function ProtocolStatsExtended(props: ProtocolStatsProps): JSX.Element {
  const { markets, avgApy, isLoading } = useDashboardMarkets();

  // Calculate TVL
  const tvl = createMemo(() => {
    const data = markets();
    let total = 0;
    for (const market of data) {
      const syReserve = Number(fromWad(market.state.syReserve));
      const ptReserve = Number(fromWad(market.state.ptReserve));
      total += syReserve + ptReserve;
    }
    return total;
  });

  // Calculate mock stats
  const volume24h = createMemo(() => tvl() * 0.08);
  const swaps24h = createMemo(() => Math.floor(tvl() > 0 ? 20 + Math.random() * 30 : 0));
  const fees24h = createMemo(() => volume24h() * 0.003);
  const uniqueUsers = createMemo(() => Math.floor(tvl() > 0 ? 5 + Math.random() * 15 : 0));
  const apyPercent = createMemo(() => avgApy().multipliedBy(100).toNumber());

  // Show loading skeletons
  if (isLoading()) {
    return (
      <StatCardGrid columns={{ default: 2, md: 3, lg: 6 }} class={props.class}>
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
      </StatCardGrid>
    );
  }

  return (
    <StatCardGrid columns={{ default: 2, md: 3, lg: 6 }} class={props.class}>
      <StatCard
        label="Total TVL"
        numericValue={tvl()}
        valueFormatter={formatCompact}
        delta={`${markets().length} markets`}
        icon={<DollarSignIcon class="h-4 w-4" />}
        compact
        animationDelay={0}
      />
      <StatCard
        label="24h Volume"
        numericValue={volume24h()}
        valueFormatter={formatCompact}
        icon={<TrendingUpIcon class="h-4 w-4" />}
        compact
        animationDelay={50}
      />
      <StatCard
        label="24h Swaps"
        numericValue={swaps24h()}
        valueFormatter={(v) => Math.round(v).toLocaleString()}
        icon={<ActivityIcon class="h-4 w-4" />}
        compact
        animationDelay={100}
      />
      <StatCard
        label="24h Fees"
        numericValue={fees24h()}
        valueFormatter={formatCompact}
        trend="up"
        compact
        animationDelay={150}
      />
      <StatCard
        label="Avg APY"
        numericValue={apyPercent()}
        valueFormatter={(v) => `${v.toFixed(2)}%`}
        trend="up"
        compact
        animationDelay={200}
      />
      <StatCard
        label="Active Users"
        numericValue={uniqueUsers()}
        valueFormatter={(v) => Math.round(v).toLocaleString()}
        delta="24h"
        icon={<UsersIcon class="h-4 w-4" />}
        compact
        animationDelay={250}
      />
    </StatCardGrid>
  );
}
