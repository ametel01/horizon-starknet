'use client';

import { memo, type ReactNode } from 'react';

import { AnimatedNumber } from './AnimatedNumber';

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
  className?: string | undefined;
}

/**
 * AnimatedCurrency - Specialized animated number for currency values
 * Memoized to prevent unnecessary re-renders
 *
 * @example
 * <AnimatedCurrency value={1234567.89} currency="$" compact />
 * // Displays "$1.23M" with smooth animation
 */
export const AnimatedCurrency = memo(function AnimatedCurrency({
  value,
  currency = '$',
  decimals = 2,
  compact = false,
  duration = 600,
  className,
}: AnimatedCurrencyProps): ReactNode {
  const formatter = (v: number): string => {
    if (compact) {
      if (v >= 1_000_000_000) {
        return `${currency}${(v / 1_000_000_000).toFixed(2)}B`;
      }
      if (v >= 1_000_000) {
        return `${currency}${(v / 1_000_000).toFixed(2)}M`;
      }
      if (v >= 1_000) {
        return `${currency}${(v / 1_000).toFixed(2)}K`;
      }
    }
    return `${currency}${v.toFixed(decimals)}`;
  };

  return (
    <AnimatedNumber value={value} formatter={formatter} duration={duration} className={className} />
  );
});
