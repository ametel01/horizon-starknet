'use client';

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
