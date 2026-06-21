'use client';

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
