'use client';

import { cn } from '@shared/lib/utils';
import { memo, type ReactNode, useEffect, useReducer, useRef } from 'react';

import { easings } from './AnimatedNumber.easings';

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
 * Hook to animate a number from one value to another
 *
 * @example
 * const displayValue = useAnimatedNumber(totalTvl, { duration: 800 });
 */
export function useAnimatedNumber(value: number, options: UseAnimatedNumberOptions = {}): number {
  const { duration = 600, easing = easings.easeOut, delay = 0, decimals = 2 } = options;

  const [displayValue, dispatchDisplayValue] = useReducer(
    (_current: number, next: number) => next,
    value
  );
  const previousValue = useRef(value);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Cancel any ongoing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    const startValue = previousValue.current;
    const endValue = value;
    const delta = endValue - startValue;

    // Skip animation if no change or very small change
    if (Math.abs(delta) < 0.0001) {
      dispatchDisplayValue(value);
      previousValue.current = value;
      return;
    }

    const animate = (timestamp: number): void => {
      startTimeRef.current ??= timestamp + delay;

      const elapsed = timestamp - startTimeRef.current;

      // Still in delay period
      if (elapsed < 0) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      const currentValue = startValue + delta * easedProgress;

      // Round to specified decimals during animation for smoother display
      const roundedValue = Math.round(currentValue * 10 ** decimals) / 10 ** decimals;
      dispatchDisplayValue(roundedValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure we end exactly on the target value
        dispatchDisplayValue(endValue);
        previousValue.current = endValue;
        startTimeRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, easing, delay, decimals]);

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
  className?: string | undefined;
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
 * Memoized to prevent unnecessary re-renders in lists
 *
 * @example
 * <AnimatedNumber
 *   value={tvl}
 *   formatter={(v) => `$${v.toLocaleString()}`}
 *   duration={800}
 *   highlightChange
 * />
 */
export const AnimatedNumber = memo(function AnimatedNumber({
  value,
  formatter = (v) => v.toLocaleString(),
  duration = 600,
  delay = 0,
  easing = easings.easeOut,
  className,
  highlightChange = false,
}: AnimatedNumberProps): ReactNode {
  const animatedValue = useAnimatedNumber(value, { duration, delay, easing });
  const [isChanging, dispatchIsChanging] = useReducer(
    (_current: boolean, next: boolean) => next,
    false
  );
  const previousValue = useRef(value);
  const changeDirection = useRef<'up' | 'down' | null>(null);

  // Track value changes for highlight effect
  useEffect(() => {
    if (highlightChange && value !== previousValue.current) {
      changeDirection.current = value > previousValue.current ? 'up' : 'down';
      dispatchIsChanging(true);
      previousValue.current = value;

      const timer = setTimeout(() => {
        dispatchIsChanging(false);
      }, duration);

      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [value, highlightChange, duration]);

  return (
    <span
      className={cn(
        'tabular-nums transition-colors duration-300',
        // Highlight effect
        isChanging && changeDirection.current === 'up' && 'text-green-500',
        isChanging && changeDirection.current === 'down' && 'text-red-500',
        // Reduced motion: skip animation
        'motion-reduce:transition-none',
        className
      )}
      // Accessibility: announce value changes to screen readers
      aria-live="polite"
      aria-atomic="true"
    >
      {formatter(animatedValue)}
    </span>
  );
});
