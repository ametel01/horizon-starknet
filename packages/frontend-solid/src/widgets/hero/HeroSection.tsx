import { cn } from '@shared/lib/utils';
import { fromWad } from '@shared/math/wad';
import { AnimatedNumber } from '@shared/ui/AnimatedNumber';
import { Button } from '@shared/ui/Button';
import { Skeleton } from '@shared/ui/Skeleton';
import { A } from '@solidjs/router';
import { createMemo, createSignal, type JSX, onMount, Show } from 'solid-js';
import { useDashboardMarkets } from '@/features/markets';
import { useUIMode } from '@/providers/UIModeProvider';

/**
 * HeroSection - Immersive landing hero with animated gradient horizon
 *
 * Features:
 * - Radial gradient "horizon" glow at bottom
 * - Subtle noise texture overlay
 * - Floating stat orbs with live protocol data
 * - Staggered fade-in animations
 * - Responsive layout for mobile
 */
export function HeroSection(): JSX.Element {
  const { isSimple } = useUIMode();
  const [mounted, setMounted] = createSignal(false);

  onMount(() => {
    setMounted(true);
  });

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
            mounted() ? 'animate-fade-up' : 'translate-y-4 opacity-0'
          )}
        >
          {isSimple() ? 'Earn Fixed Yield' : 'Split Your Yield'}
        </h1>

        {/* Subheadline */}
        <p
          class={cn(
            'text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl',
            mounted() ? 'animate-fade-up' : 'translate-y-4 opacity-0'
          )}
          style={{ 'animation-delay': '100ms' }}
        >
          {isSimple()
            ? 'Deposit your tokens and lock in guaranteed returns until maturity. No trading required.'
            : 'Tokenize yield-bearing assets into Principal and Yield tokens. Lock in fixed returns or speculate on variable rates.'}
        </p>

        {/* CTA Buttons */}
        <div
          class={cn(
            'mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row',
            mounted() ? 'animate-fade-up' : 'translate-y-4 opacity-0'
          )}
          style={{ 'animation-delay': '200ms' }}
        >
          <Button as={A} href="/mint" size="lg" class="min-w-40">
            {isSimple() ? 'Start Earning' : 'Mint PT + YT'}
          </Button>
          <Button as={A} href="/trade" size="lg" variant="outline" class="min-w-40">
            {isSimple() ? 'View Markets' : 'Trade'}
          </Button>
        </div>

        {/* Floating Stats */}
        <div
          class={cn(
            'mt-16 flex flex-wrap justify-center gap-8 sm:gap-12',
            mounted() ? 'animate-fade-up' : 'translate-y-4 opacity-0'
          )}
          style={{ 'animation-delay': '300ms' }}
        >
          <HeroStats />
        </div>
      </div>
    </section>
  );
}

/**
 * Animated background with horizon gradient and noise
 */
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

/**
 * Hero stats with live protocol data
 */
function HeroStats(): JSX.Element {
  const { markets, avgApy, isLoading } = useDashboardMarkets();

  // Calculate TVL in SY (no USD pricing for now - simplified version)
  const tvlSy = createMemo(() => {
    const data = markets();
    let total = 0;
    for (const market of data) {
      const syReserve = Number(fromWad(market.state.syReserve));
      const ptReserve = Number(fromWad(market.state.ptReserve));
      total += syReserve + ptReserve;
    }
    return total;
  });

  const apyPercent = createMemo(() => avgApy().multipliedBy(100).toNumber());

  return (
    <Show
      when={!isLoading()}
      fallback={
        <>
          <StatOrbSkeleton />
          <StatOrbSkeleton />
          <StatOrbSkeleton />
        </>
      }
    >
      <StatOrb label="Total Value Locked" value={tvlSy()} formatter={formatCompact} />
      <StatOrb
        label="Avg. Implied APY"
        value={apyPercent()}
        formatter={(v) => `${v.toFixed(2)}%`}
        highlight
      />
      <StatOrb
        label="Active Markets"
        value={markets().length}
        formatter={(v) => String(Math.round(v))}
      />
    </Show>
  );
}

interface StatOrbProps {
  label: string;
  value: number;
  formatter: (value: number) => string;
  highlight?: boolean | undefined;
}

/**
 * StatOrb - Floating stat display with glass morphism effect
 */
function StatOrb(props: StatOrbProps): JSX.Element {
  const highlight = () => props.highlight ?? false;

  return (
    <div class="group flex flex-col items-center">
      {/* Value container with glass effect */}
      <div
        class={cn(
          'relative flex h-20 w-20 items-center justify-center rounded-full sm:h-24 sm:w-24',
          'border transition-all duration-300',
          highlight()
            ? 'border-primary/30 bg-primary/5 group-hover:border-primary/50 group-hover:bg-primary/10'
            : 'border-border/50 bg-card/50 group-hover:border-border group-hover:bg-card/80'
        )}
      >
        {/* Inner glow for highlighted orb */}
        <Show when={highlight()}>
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
            highlight() ? 'text-primary' : 'text-foreground'
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

/**
 * Format value with compact notation
 */
function formatCompact(value: number): string {
  if (value === 0) return '0';
  if (value < 0.01) return '<0.01';
  if (value < 1000) return value.toFixed(0);
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}K`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  return `${(value / 1_000_000_000).toFixed(2)}B`;
}
