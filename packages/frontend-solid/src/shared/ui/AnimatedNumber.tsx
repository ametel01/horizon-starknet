import { cn } from '@shared/lib/utils';
import { type Accessor, createEffect, createMemo, createSignal, on, onCleanup, type JSX } from 'solid-js';

export interface UseAnimatedNumberOptions {
  /** Duration of animation in ms */
  duration?: number | undefined;
  /** Easing function */
  easing?: ((t: number) => number) | undefined;
  /** Delay before animation starts in ms */
  delay?: number | undefined;
  /** Decimal places to round to during animation */
  decimals?: number | undefined;
}

/**
 * Easing functions for number animations
 */
export const easings = {
  linear: (t: number) => t,
  easeOut: (t: number) => 1 - (1 - t) ** 3,
  easeInOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  spring: (t: number) => 1 - Math.cos(t * Math.PI * 0.5) ** 3,
} as const;

/**
 * Creates an animated number that smoothly transitions between values
 *
 * Uses SolidJS reactivity with createEffect to track value changes
 * and requestAnimationFrame for smooth animations.
 *
 * @example
 * const animatedTvl = createAnimatedNumber(() => totalTvl(), { duration: 800 });
 */
export function createAnimatedNumber(
  value: Accessor<number>,
  options: UseAnimatedNumberOptions = {}
): Accessor<number> {
  const duration = () => options.duration ?? 600;
  const easing = () => options.easing ?? easings.easeOut;
  const delay = () => options.delay ?? 0;
  const decimals = () => options.decimals ?? 2;

  const [displayValue, setDisplayValue] = createSignal(value());
  let previousValue = value();
  let animationId: number | null = null;
  let startTime: number | null = null;

  createEffect(
    on(value, (newValue) => {
      // Cancel any ongoing animation
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }

      const startValue = previousValue;
      const endValue = newValue;
      const delta = endValue - startValue;

      // Skip animation if no change or very small change
      if (Math.abs(delta) < 0.0001) {
        setDisplayValue(newValue);
        previousValue = newValue;
        return;
      }

      startTime = null;

      const animate = (timestamp: number): void => {
        startTime ??= timestamp + delay();

        const elapsed = timestamp - startTime;

        // Still in delay period
        if (elapsed < 0) {
          animationId = requestAnimationFrame(animate);
          return;
        }

        const progress = Math.min(elapsed / duration(), 1);
        const easedProgress = easing()(progress);
        const currentValue = startValue + delta * easedProgress;

        // Round to specified decimals during animation for smoother display
        const roundedValue = Math.round(currentValue * 10 ** decimals()) / 10 ** decimals();
        setDisplayValue(roundedValue);

        if (progress < 1) {
          animationId = requestAnimationFrame(animate);
        } else {
          // Ensure we end exactly on the target value
          setDisplayValue(endValue);
          previousValue = endValue;
          startTime = null;
          animationId = null;
        }
      };

      animationId = requestAnimationFrame(animate);
    })
  );

  onCleanup(() => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
    }
  });

  return displayValue;
}

export interface AnimatedNumberProps {
  /** The numeric value to display */
  value: number;
  /** Formatter function to convert number to display string */
  formatter?: ((value: number) => string) | undefined;
  /** Animation duration in ms */
  duration?: number | undefined;
  /** Animation delay in ms */
  delay?: number | undefined;
  /** Easing function */
  easing?: ((t: number) => number) | undefined;
  /** Additional CSS classes */
  class?: string | undefined;
  /** Show visual feedback on value change */
  highlightChange?: boolean | undefined;
}

/**
 * AnimatedNumber - Smoothly animates between numeric values
 *
 * Features:
 * - Smooth interpolation between values
 * - Configurable easing and duration
 * - Optional highlight flash on change
 * - Respects prefers-reduced-motion
 *
 * @example
 * <AnimatedNumber
 *   value={tvl()}
 *   formatter={(v) => `$${v.toLocaleString()}`}
 *   duration={800}
 *   highlightChange
 * />
 */
export function AnimatedNumber(props: AnimatedNumberProps): JSX.Element {
  const formatter = () => props.formatter ?? ((v: number) => v.toLocaleString());
  const duration = () => props.duration ?? 600;
  const delay = () => props.delay ?? 0;
  const easing = () => props.easing ?? easings.easeOut;
  const highlightChange = () => props.highlightChange ?? false;

  const animatedValue = createAnimatedNumber(
    () => props.value,
    {
      get duration() { return duration(); },
      get delay() { return delay(); },
      get easing() { return easing(); },
    }
  );

  const [isChanging, setIsChanging] = createSignal(false);
  const [changeDirection, setChangeDirection] = createSignal<'up' | 'down' | null>(null);
  let previousValue = props.value;

  // Track value changes for highlight effect
  let highlightTimer: ReturnType<typeof setTimeout> | null = null;

  createEffect(
    on(
      () => props.value,
      (newValue) => {
        if (highlightChange() && newValue !== previousValue) {
          setChangeDirection(newValue > previousValue ? 'up' : 'down');
          setIsChanging(true);
          previousValue = newValue;

          // Clear any existing timer
          if (highlightTimer !== null) {
            clearTimeout(highlightTimer);
          }

          highlightTimer = setTimeout(() => {
            setIsChanging(false);
            highlightTimer = null;
          }, duration());
        }
      }
    )
  );

  onCleanup(() => {
    if (highlightTimer !== null) {
      clearTimeout(highlightTimer);
    }
  });

  return (
    <span
      class={cn(
        'tabular-nums transition-colors duration-300',
        // Highlight effect
        isChanging() && changeDirection() === 'up' && 'text-green-500',
        isChanging() && changeDirection() === 'down' && 'text-red-500',
        // Reduced motion: skip animation
        'motion-reduce:transition-none',
        props.class
      )}
      // Accessibility: announce value changes to screen readers
      aria-live="polite"
      aria-atomic="true"
    >
      {formatter()(animatedValue())}
    </span>
  );
}

export interface AnimatedCurrencyProps {
  /** Value in base units (e.g., cents, wei) or decimal */
  value: number;
  /** Currency symbol */
  currency?: string | undefined;
  /** Number of decimal places */
  decimals?: number | undefined;
  /** Use compact notation for large numbers */
  compact?: boolean | undefined;
  /** Animation duration in ms */
  duration?: number | undefined;
  /** Additional CSS classes */
  class?: string | undefined;
}

/**
 * AnimatedCurrency - Specialized animated number for currency values
 *
 * @example
 * <AnimatedCurrency value={1234567.89} currency="$" compact />
 * // Displays "$1.23M" with smooth animation
 */
export function AnimatedCurrency(props: AnimatedCurrencyProps): JSX.Element {
  const currency = () => props.currency ?? '$';
  const decimalPlaces = () => props.decimals ?? 2;
  const compact = () => props.compact ?? false;
  const duration = () => props.duration ?? 600;

  const formatter = createMemo(() => {
    return (v: number): string => {
      if (compact()) {
        if (v >= 1_000_000_000) {
          return `${currency()}${(v / 1_000_000_000).toFixed(2)}B`;
        }
        if (v >= 1_000_000) {
          return `${currency()}${(v / 1_000_000).toFixed(2)}M`;
        }
        if (v >= 1_000) {
          return `${currency()}${(v / 1_000).toFixed(2)}K`;
        }
      }
      return `${currency()}${v.toFixed(decimalPlaces())}`;
    };
  });

  return (
    <AnimatedNumber
      value={props.value}
      formatter={formatter()}
      duration={duration()}
      class={props.class}
    />
  );
}

export interface AnimatedPercentProps {
  /** Value as decimal (0.15 = 15%) or percentage (15 = 15%) */
  value: number;
  /** Whether value is already a percentage (true) or decimal (false) */
  isPercentage?: boolean | undefined;
  /** Number of decimal places */
  decimals?: number | undefined;
  /** Show + prefix for positive values */
  showSign?: boolean | undefined;
  /** Animation duration in ms */
  duration?: number | undefined;
  /** Additional CSS classes */
  class?: string | undefined;
}

/**
 * AnimatedPercent - Specialized animated number for percentage values
 *
 * @example
 * <AnimatedPercent value={0.0842} decimals={2} />
 * // Displays "8.42%" with smooth animation
 */
export function AnimatedPercent(props: AnimatedPercentProps): JSX.Element {
  const isPercentage = () => props.isPercentage ?? false;
  const decimalPlaces = () => props.decimals ?? 2;
  const showSign = () => props.showSign ?? false;
  const duration = () => props.duration ?? 600;

  const percentValue = createMemo(() => {
    return isPercentage() ? props.value : props.value * 100;
  });

  const formatter = createMemo(() => {
    return (v: number): string => {
      const sign = showSign() && v > 0 ? '+' : '';
      return `${sign}${v.toFixed(decimalPlaces())}%`;
    };
  });

  return (
    <AnimatedNumber
      value={percentValue()}
      formatter={formatter()}
      duration={duration()}
      class={props.class}
      highlightChange={showSign()}
    />
  );
}
