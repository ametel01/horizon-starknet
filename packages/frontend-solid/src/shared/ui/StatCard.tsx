import { cn } from '@shared/lib/utils';
import {
  type ComponentProps,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
} from 'solid-js';

import { AnimatedNumber } from './AnimatedNumber';
import { Card, CardContent } from './Card';
import { Skeleton } from './Skeleton';

/**
 * Trend display configuration using decision table pattern.
 */
type TrendDirection = 'up' | 'down' | 'neutral';

const TREND_ICONS: Record<TrendDirection, JSX.Element> = {
  up: (
    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M5 15l7-7 7 7" />
    </svg>
  ),
  down: (
    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  neutral: (
    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M20 12H4" />
    </svg>
  ),
};

const TREND_CLASSES: Record<TrendDirection, string> = {
  up: 'text-green-500',
  down: 'text-red-500',
  neutral: 'text-muted-foreground',
};

export interface StatCardProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Label text displayed above the value */
  label: string;
  /** Main value to display (string, or use numericValue for animation) */
  value?: string | undefined;
  /** Numeric value for animated display */
  numericValue?: number | undefined;
  /** Formatter for numeric value */
  valueFormatter?: ((value: number) => string) | undefined;
  /** Optional delta change (e.g., "+12.4%", "-5%") */
  delta?: string | undefined;
  /** Trend direction for coloring the delta */
  trend?: TrendDirection | undefined;
  /** Optional icon to display in the top-right */
  icon?: JSX.Element | undefined;
  /** Use compact padding and smaller text */
  compact?: boolean | undefined;
  /** Loading state */
  isLoading?: boolean | undefined;
  /** Animation delay in ms for staggered reveals */
  animationDelay?: number | undefined;
}

/**
 * StatCard - Enhanced stat display with motion and visual feedback
 *
 * Features:
 * - Subtle hover glow effect
 * - Trend indicators with color coding
 * - Staggered fade-in animation
 * - Respects prefers-reduced-motion
 * - Compact variant for dense layouts
 */
function StatCard(props: StatCardProps): JSX.Element {
  const [local, others] = splitProps(props, [
    'class',
    'label',
    'value',
    'numericValue',
    'valueFormatter',
    'delta',
    'trend',
    'icon',
    'compact',
    'isLoading',
    'animationDelay',
  ]);

  const compact = () => local.compact ?? false;
  const isLoading = () => local.isLoading ?? false;
  const animationDelay = () => local.animationDelay ?? 0;

  const [isVisible, setIsVisible] = createSignal(false);

  // Trigger animation after mount with optional delay
  createEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, animationDelay());

    onCleanup(() => {
      clearTimeout(timer);
    });
  });

  return (
    <Card
      class={cn(
        'group relative overflow-hidden transition-all duration-300',
        // Fade-in animation
        'translate-y-2 opacity-0',
        isVisible() && 'translate-y-0 opacity-100',
        // Motion preference
        'motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none',
        local.class
      )}
      style={{
        'transition-delay': `${String(animationDelay())}ms`,
      }}
      {...others}
    >
      {/* Subtle glow on hover */}
      <div
        class="from-primary/0 to-primary/0 group-hover:from-primary/5 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent transition-all duration-500 group-hover:to-transparent"
        aria-hidden="true"
      />

      <CardContent class={cn('relative', compact() ? 'p-4' : 'p-5')}>
        {/* Header with label and optional icon */}
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {local.label}
          </span>
          <Show when={local.icon !== undefined}>
            <div class="text-primary/50">{local.icon}</div>
          </Show>
        </div>

        {/* Value and delta */}
        <Show
          when={!isLoading()}
          fallback={
            <div class="mt-2">
              <Skeleton class={cn('w-24', compact() ? 'h-7' : 'h-9')} />
            </div>
          }
        >
          <div class="mt-2 flex items-baseline gap-2">
            <span
              class={cn('font-mono font-semibold tracking-tight', compact() ? 'text-xl' : 'text-2xl')}
            >
              <Show
                when={local.numericValue}
                fallback={local.value}
                keyed
              >
                {(numericValue) => (
                  <AnimatedNumber
                    value={numericValue}
                    formatter={local.valueFormatter ?? ((v) => v.toLocaleString())}
                    duration={600}
                    delay={animationDelay()}
                  />
                )}
              </Show>
            </span>

            <Show when={local.delta !== undefined}>
              <span
                class={cn(
                  'flex items-center gap-0.5 text-sm font-medium',
                  local.trend ? TREND_CLASSES[local.trend] : 'text-muted-foreground'
                )}
              >
                <Show when={local.trend} keyed>
                  {(trend) => TREND_ICONS[trend]}
                </Show>
                {local.delta}
              </span>
            </Show>
          </div>
        </Show>
      </CardContent>
    </Card>
  );
}

export interface StatCardGridProps extends ComponentProps<'div'> {
  /** Number of columns on different breakpoints */
  columns?: {
    default?: number | undefined;
    sm?: number | undefined;
    md?: number | undefined;
    lg?: number | undefined;
  };
  /** Stagger delay between cards in ms */
  staggerDelay?: number | undefined;
}

/**
 * StatCardGrid - Container for stat cards with staggered animations
 *
 * Automatically applies animation delays to child StatCards
 */
function StatCardGrid(props: StatCardGridProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'columns', 'staggerDelay', 'children']);
  const columns = () => local.columns ?? { default: 1, sm: 2, lg: 4 };

  return (
    <div
      class={cn(
        'grid gap-4',
        columns().default === 1 && 'grid-cols-1',
        columns().default === 2 && 'grid-cols-2',
        columns().default === 3 && 'grid-cols-3',
        columns().default === 4 && 'grid-cols-4',
        columns().sm === 2 && 'sm:grid-cols-2',
        columns().sm === 3 && 'sm:grid-cols-3',
        columns().sm === 4 && 'sm:grid-cols-4',
        columns().md === 2 && 'md:grid-cols-2',
        columns().md === 3 && 'md:grid-cols-3',
        columns().md === 4 && 'md:grid-cols-4',
        columns().lg === 2 && 'lg:grid-cols-2',
        columns().lg === 3 && 'lg:grid-cols-3',
        columns().lg === 4 && 'lg:grid-cols-4',
        columns().lg === 5 && 'lg:grid-cols-5',
        local.class
      )}
      {...others}
    >
      {local.children}
    </div>
  );
}

export { StatCard, StatCardGrid };
