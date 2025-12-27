'use client';

import type { ReactNode } from 'react';

import { cn } from '@shared/lib/utils';

import { Skeleton } from './Skeleton';

interface GasEstimateProps {
  /** Formatted fee string (e.g., "~0.0001 STRK") */
  formattedFee: string;
  /** Whether the estimate is loading */
  isLoading?: boolean;
  /** Error if estimation failed */
  error?: Error | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * GasEstimate - Displays estimated transaction fee
 *
 * Implements Jakob's Law: users expect to see gas estimates
 * like other DeFi applications (Uniswap, Aave, etc.)
 *
 * Features:
 * - Compact inline display
 * - Loading skeleton
 * - Graceful error handling (hides on error)
 */
export function GasEstimate({
  formattedFee,
  isLoading = false,
  error,
  className,
}: GasEstimateProps): ReactNode {
  // Hide component if no fee to show or on error
  if (!formattedFee && !isLoading) {
    return null;
  }

  // Hide on error - don't block the user
  if (error) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-1.5 text-xs', className)}>
      <svg
        className="text-muted-foreground h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
      {isLoading ? (
        <Skeleton className="h-3 w-16" aria-label="Estimating gas" />
      ) : (
        <span className="text-muted-foreground">{formattedFee}</span>
      )}
    </div>
  );
}
