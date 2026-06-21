import { cn } from '@shared/lib/utils';
import type { ReactNode } from 'react';

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
