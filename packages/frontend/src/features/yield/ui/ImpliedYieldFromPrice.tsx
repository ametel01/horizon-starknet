import { cn } from '@shared/lib/utils';
import BigNumber from 'bignumber.js';
import type { ReactNode } from 'react';

interface ImpliedYieldFromPriceProps {
  /** PT price as a BigNumber (fraction of SY, e.g., 0.95 means 1 PT = 0.95 SY) */
  ptPrice: BigNumber;
  /** Days remaining until expiry */
  daysRemaining: number;
  /** Number of decimal places to display */
  decimals?: number;
  /** Additional CSS classes */
  className?: string;
  /** Show + sign for positive yields */
  showSign?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl font-semibold',
};

export function ImpliedYieldFromPrice({
  ptPrice,
  daysRemaining,
  decimals = 2,
  className,
  showSign = false,
  size = 'md',
}: ImpliedYieldFromPriceProps): ReactNode {
  // Calculate implied yield from PT price
  // Implied APY = ((1/ptPrice)^(365/daysToExpiry) - 1)
  let apy: BigNumber;
  if (daysRemaining <= 0 || ptPrice.isZero()) {
    apy = new BigNumber(0);
  } else {
    const priceRatio = new BigNumber(1).dividedBy(ptPrice);
    const exponent = 365 / daysRemaining;
    const annualizedReturn = priceRatio.toNumber() ** exponent - 1;
    apy = new BigNumber(annualizedReturn);
  }

  const apyPercent = apy.multipliedBy(100);
  const isPositive = apy.isGreaterThanOrEqualTo(0);

  const formatted = apyPercent.toFixed(decimals);
  const sign = showSign && isPositive ? '+' : '';

  return (
    <span
      className={cn(
        'font-mono',
        sizeClasses[size],
        isPositive ? 'text-primary' : 'text-destructive',
        className
      )}
    >
      {sign}
      {formatted}%
    </span>
  );
}
