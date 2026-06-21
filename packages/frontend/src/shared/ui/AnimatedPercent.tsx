'use client';

import { memo, type ReactNode } from 'react';

import { AnimatedNumber } from './AnimatedNumber';

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
  className?: string | undefined;
}

/**
 * AnimatedPercent - Specialized animated number for percentage values
 * Memoized to prevent unnecessary re-renders
 *
 * @example
 * <AnimatedPercent value={0.0842} decimals={2} />
 * // Displays "8.42%" with smooth animation
 */
export const AnimatedPercent = memo(function AnimatedPercent({
  value,
  isPercentage = false,
  decimals = 2,
  showSign = false,
  duration = 600,
  className,
}: AnimatedPercentProps): ReactNode {
  const percentValue = isPercentage ? value : value * 100;

  const formatter = (v: number): string => {
    const sign = showSign && v > 0 ? '+' : '';
    return `${sign}${v.toFixed(decimals)}%`;
  };

  return (
    <AnimatedNumber
      value={percentValue}
      formatter={formatter}
      duration={duration}
      className={className}
      highlightChange={showSign}
    />
  );
});
