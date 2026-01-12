import { A } from '@solidjs/router';
import { createMemo, createSignal, For, onMount, Show, type JSX } from 'solid-js';

import { useDashboardMarkets, type MarketData } from '@/features/markets';
import { useUIMode } from '@/providers/UIModeProvider';
import { cn } from '@/shared/lib/utils';
import { fromWad } from '@/shared/math/wad';
import { AnimatedNumber } from '@/shared/ui/AnimatedNumber';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Skeleton } from '@/shared/ui/Skeleton';

export default function Home(): JSX.Element {
  const { isSimple } = useUIMode();
  const [mounted, setMounted] = createSignal(false);

  onMount(() => {
    setMounted(true);
  });

  return (
    <div>
      {/* Hero Section - Immersive gradient with stats */}
      <HeroSection mounted={mounted()} isSimple={isSimple()} />

      {/* Content sections with container */}
      <div class="mx-auto max-w-7xl px-4 py-16">
        {/* Markets Section */}
        <section>
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-foreground">
              {isSimple() ? 'Earning Opportunities' : 'Active Markets'}
            </h2>
            <A
              href="/analytics"
              class="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
            >
              View Analytics →
            </A>
          </div>
          <MarketList isSimple={isSimple()} />
        </section>

        {/* Features - Mode aware */}
        <section class="mt-20">
          <h2 class="text-foreground mb-8">What you can do</h2>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Show
              when={isSimple()}
              fallback={
                <>
                  <FeatureCard
                    title="Mint PT + YT"
                    description="Deposit yield-bearing assets to receive Principal and Yield Tokens"
                    href="/mint"
                  />
                  <FeatureCard
                    title="Trade"
                    description="Buy or sell Principal Tokens to lock in fixed yields or speculate"
                    href="/trade"
                  />
                  <FeatureCard
                    title="Provide Liquidity"
                    description="Add liquidity to PT/SY pools and earn trading fees"
                    href="/pools"
                  />
                  <FeatureCard
                    title="Manage Portfolio"
                    description="View your positions, claim yield, and redeem tokens"
                    href="/portfolio"
                  />
                  <FeatureCard
                    title="Analytics"
                    description="View protocol metrics, TVL charts, and market statistics"
                    href="/analytics"
                  />
                </>
              }
            >
              <FeatureCard
                title="Earn Fixed Yield"
                description="Deposit tokens and earn a guaranteed fixed rate until maturity"
                href="/mint"
              />
              <FeatureCard
                title="Manage Portfolio"
                description="View your positions and withdraw your earnings"
                href="/portfolio"
              />
            </Show>
          </div>
        </section>
      </div>
    </div>
  );
}

// ============================================================================
// Hero Section
// ============================================================================

interface HeroSectionProps {
  mounted: boolean;
  isSimple: boolean;
}

function HeroSection(props: HeroSectionProps): JSX.Element {
  return (
    <section class="relative flex min-h-[70vh] items-center justify-center overflow-hidden">
      {/* Background layers */}
      <HeroBackground />

      {/* Content */}
      <div class="relative z-10 mx-auto max-w-5xl px-4 py-16 text-center">
        {/* Headline */}
        <h1
          class={cn(
            'font-display text-4xl font-normal tracking-tight sm:text-5xl md:text-6xl lg:text-7xl',
            props.mounted ? 'animate-fade-up' : 'translate-y-4 opacity-0'
          )}
        >
          {props.isSimple ? 'Earn Fixed Yield' : 'Split Your Yield'}
        </h1>

        {/* Subheadline */}
        <p
          class={cn(
            'text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl',
            props.mounted ? 'animate-fade-up' : 'translate-y-4 opacity-0'
          )}
          style={{ 'animation-delay': '100ms' }}
        >
          {props.isSimple
            ? 'Deposit your tokens and lock in guaranteed returns until maturity. No trading required.'
            : 'Tokenize yield-bearing assets into Principal and Yield tokens. Lock in fixed returns or speculate on variable rates.'}
        </p>

        {/* CTA Buttons */}
        <div
          class={cn(
            'mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row',
            props.mounted ? 'animate-fade-up' : 'translate-y-4 opacity-0'
          )}
          style={{ 'animation-delay': '200ms' }}
        >
          <Button as={A} href="/mint" size="lg" class="min-w-40">
            {props.isSimple ? 'Start Earning' : 'Mint PT + YT'}
          </Button>
          <Button as={A} href="/trade" size="lg" variant="outline" class="min-w-40">
            {props.isSimple ? 'View Markets' : 'Trade'}
          </Button>
        </div>

        {/* Floating Stats */}
        <div
          class={cn(
            'mt-16 flex flex-wrap justify-center gap-8 sm:gap-12',
            props.mounted ? 'animate-fade-up' : 'translate-y-4 opacity-0'
          )}
          style={{ 'animation-delay': '300ms' }}
        >
          <HeroStats />
        </div>
      </div>
    </section>
  );
}

function HeroBackground(): JSX.Element {
  return (
    <>
      {/* Base gradient - dark to slightly lighter */}
      <div class="from-background via-background to-surface-sunken absolute inset-0 bg-linear-to-b" />

      {/* Horizon glow - animated pulse */}
      <div
        class="animate-glow-pulse absolute bottom-0 left-1/2 h-[60%] w-[200%] -translate-x-1/2"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 100%, oklch(0.705 0.213 47.604 / 12%), transparent 60%)',
        }}
        aria-hidden="true"
      />

      {/* Secondary accent glow */}
      <div
        class="animate-glow-pulse absolute bottom-0 left-1/2 h-[40%] w-[150%] -translate-x-1/2"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 100%, oklch(0.837 0.128 66.29 / 8%), transparent 50%)',
          'animation-delay': '2s',
        }}
        aria-hidden="true"
      />

      {/* Noise texture overlay - CSS generated */}
      <div
        class="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          'background-image': `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />
    </>
  );
}

function HeroStats(): JSX.Element {
  const { markets, avgApy, isLoading, isError } = useDashboardMarkets();

  // Calculate TVL (simplified - without USD pricing for now)
  const totalTvl = createMemo(() => {
    const data = markets();
    let tvl = 0;
    for (const market of data) {
      const syReserve = Number(fromWad(market.state.syReserve));
      const ptReserve = Number(fromWad(market.state.ptReserve));
      tvl += syReserve + ptReserve;
    }
    return tvl;
  });

  const apyPercent = createMemo(() => {
    const apy = avgApy();
    const value = apy.multipliedBy(100).toNumber();
    return Number.isFinite(value) ? value : 0;
  });
  const marketCount = createMemo(() => markets().length);

  // Show skeleton while loading or if there's an error
  const showSkeleton = createMemo(() => isLoading() || isError());

  return (
    <Show
      when={!showSkeleton()}
      fallback={
        <>
          <StatOrbSkeleton />
          <StatOrbSkeleton />
          <StatOrbSkeleton />
        </>
      }
    >
      <StatOrb label="Total Value Locked" value={totalTvl()} formatter={formatCompact} />
      <StatOrb
        label="Avg. Implied APY"
        value={apyPercent()}
        formatter={(v) => `${v.toFixed(2)}%`}
        highlight
      />
      <StatOrb
        label="Active Markets"
        value={marketCount()}
        formatter={(v) => String(Math.round(v))}
      />
    </Show>
  );
}

interface StatOrbProps {
  label: string;
  value: number;
  formatter: (value: number) => string;
  highlight?: boolean;
}

function StatOrb(props: StatOrbProps): JSX.Element {
  return (
    <div class="group flex flex-col items-center">
      {/* Value container with glass effect */}
      <div
        class={cn(
          'relative flex h-20 w-20 items-center justify-center rounded-full sm:h-24 sm:w-24',
          'border transition-all duration-300',
          props.highlight
            ? 'border-primary/30 bg-primary/5 group-hover:border-primary/50 group-hover:bg-primary/10'
            : 'border-border/50 bg-card/50 group-hover:border-border group-hover:bg-card/80'
        )}
      >
        {/* Inner glow for highlighted orb */}
        <Show when={props.highlight}>
          <div
            class="absolute inset-2 rounded-full opacity-50"
            style={{
              background:
                'radial-gradient(circle, oklch(0.705 0.213 47.604 / 15%), transparent 70%)',
            }}
            aria-hidden="true"
          />
        </Show>

        {/* Value */}
        <span
          class={cn(
            'relative z-10 font-mono text-lg font-semibold sm:text-xl',
            props.highlight ? 'text-primary' : 'text-foreground'
          )}
        >
          <AnimatedNumber value={props.value} formatter={props.formatter} duration={800} />
        </span>
      </div>

      {/* Label */}
      <span class="text-muted-foreground mt-3 text-xs font-medium tracking-wider uppercase">
        {props.label}
      </span>
    </div>
  );
}

function StatOrbSkeleton(): JSX.Element {
  return (
    <div class="flex flex-col items-center">
      <Skeleton class="h-20 w-20 rounded-full sm:h-24 sm:w-24" />
      <Skeleton class="mt-3 h-3 w-16" />
    </div>
  );
}

function formatCompact(value: number): string {
  if (value === 0) return '0';
  if (value < 0) return `-${formatCompact(-value)}`;
  if (value < 0.01) return '<0.01';
  if (value < 1000) return value.toFixed(0);
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}K`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  return `${(value / 1_000_000_000).toFixed(2)}B`;
}

// ============================================================================
// Market List
// ============================================================================

interface MarketListProps {
  isSimple: boolean;
}

function MarketList(props: MarketListProps): JSX.Element {
  const { markets, isLoading, isError } = useDashboardMarkets();

  return (
    <Show
      when={!isLoading()}
      fallback={
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MarketCardSkeleton />
          <MarketCardSkeleton />
          <MarketCardSkeleton />
        </div>
      }
    >
      <Show
        when={!isError()}
        fallback={
          <div class="text-muted-foreground py-8 text-center">
            Failed to load markets. Please try again later.
          </div>
        }
      >
        <Show
          when={markets().length > 0}
          fallback={
            <div class="text-muted-foreground py-8 text-center">
              No active markets found.
            </div>
          }
        >
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <For each={markets()}>
              {(market) => <MarketCard market={market} isSimple={props.isSimple} />}
            </For>
          </div>
        </Show>
      </Show>
    </Show>
  );
}

interface MarketCardProps {
  market: MarketData;
  isSimple: boolean;
}

function MarketCard(props: MarketCardProps): JSX.Element {
  const apyPercent = createMemo(() => props.market.impliedApy.multipliedBy(100).toNumber());
  const tvl = createMemo(() => Number(fromWad(props.market.tvlSy)));

  const symbol = createMemo(() => props.market.metadata?.yieldTokenSymbol ?? 'Unknown');
  const daysLeft = createMemo(() => props.market.daysToExpiry);

  return (
    <A href={`/trade?market=${props.market.address}`}>
      <Card class="group hover:border-primary/50 transition-all hover:shadow-lg">
        <CardHeader class="pb-2">
          <div class="flex items-center justify-between">
            <CardTitle class="text-lg">{symbol()}</CardTitle>
            <Show when={props.market.isExpired}>
              <Badge variant="secondary">Expired</Badge>
            </Show>
            <Show when={!props.market.isExpired && daysLeft() <= 7}>
              <Badge variant="warning">Expiring Soon</Badge>
            </Show>
          </div>
        </CardHeader>
        <CardContent>
          <div class="space-y-3">
            {/* APY */}
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground text-sm">
                {props.isSimple ? 'Fixed Yield' : 'Implied APY'}
              </span>
              <span class="text-primary font-mono font-semibold">
                {apyPercent().toFixed(2)}%
              </span>
            </div>

            {/* TVL */}
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground text-sm">TVL</span>
              <span class="font-mono">{formatCompact(tvl())}</span>
            </div>

            {/* Days to Expiry */}
            <Show when={!props.market.isExpired}>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground text-sm">
                  {props.isSimple ? 'Duration' : 'Days to Expiry'}
                </span>
                <span class="font-mono">{daysLeft()} {daysLeft() === 1 ? 'day' : 'days'}</span>
              </div>
            </Show>
          </div>
        </CardContent>
      </Card>
    </A>
  );
}

function MarketCardSkeleton(): JSX.Element {
  return (
    <Card>
      <CardHeader class="pb-2">
        <Skeleton class="h-6 w-24" />
      </CardHeader>
      <CardContent>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <Skeleton class="h-4 w-20" />
            <Skeleton class="h-5 w-16" />
          </div>
          <div class="flex items-center justify-between">
            <Skeleton class="h-4 w-12" />
            <Skeleton class="h-5 w-20" />
          </div>
          <div class="flex items-center justify-between">
            <Skeleton class="h-4 w-24" />
            <Skeleton class="h-5 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Feature Card
// ============================================================================

interface FeatureCardProps {
  title: string;
  description: string;
  href: string;
}

function FeatureCard(props: FeatureCardProps): JSX.Element {
  return (
    <A
      href={props.href}
      class="group border-border bg-card hover:border-primary/50 hover:shadow-primary/5 rounded-lg border p-6 transition-all hover:shadow-lg"
    >
      <h4 class="text-foreground group-hover:text-primary transition-colors">{props.title}</h4>
      <p class="text-muted-foreground mt-2 text-sm leading-relaxed">{props.description}</p>
    </A>
  );
}
