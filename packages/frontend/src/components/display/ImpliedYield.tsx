import BigNumber from 'bignumber.js';
import { type ReactNode } from 'react';

import { lnRateToApy } from '@/lib/math/yield';
import { cn } from '@/lib/utils';

interface ImpliedYieldProps {
  /** The ln(implied_rate) from the AMM in WAD format */
  lnRate: bigint | string;
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

export function ImpliedYield({
  lnRate,
  decimals = 2,
  className,
  showSign = false,
  size = 'md',
}: ImpliedYieldProps): ReactNode {
  const apy = lnRateToApy(lnRate);
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
    const annualizedReturn = Math.pow(priceRatio.toNumber(), exponent) - 1;
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

interface YieldComparisonProps {
  /** Current APY as percentage (e.g., 5.5 for 5.5%) */
  currentApy: number;
  /** New APY as percentage */
  newApy: number;
  /** Number of decimal places */
  decimals?: number;
  /** Additional CSS classes */
  className?: string;
}

export function YieldComparison({
  currentApy,
  newApy,
  decimals = 2,
  className,
}: YieldComparisonProps): ReactNode {
  const change = newApy - currentApy;
  const isIncrease = change >= 0;

  return (
    <div className={cn('flex items-center gap-2 font-mono text-sm', className)}>
      <span className={currentApy >= 0 ? 'text-primary' : 'text-destructive'}>
        {currentApy.toFixed(decimals)}%
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground"
      >
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
      <span className={newApy >= 0 ? 'text-primary' : 'text-destructive'}>
        {newApy.toFixed(decimals)}%
      </span>
      <span className={cn('ml-1 text-xs', isIncrease ? 'text-primary' : 'text-destructive')}>
        ({isIncrease ? '+' : ''}
        {change.toFixed(decimals)}%)
      </span>
    </div>
  );
}
