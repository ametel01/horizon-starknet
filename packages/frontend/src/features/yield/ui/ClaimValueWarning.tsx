'use client';

import { AlertTriangleIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@shared/lib/utils';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Skeleton } from '@shared/ui/Skeleton';

import { useClaimGasCheck } from '../model/useClaimGasCheck';

interface ClaimValueWarningProps {
  /** YT contract address for gas estimation */
  ytAddress: string;
  /** USD value of claimable yield */
  claimableUsd: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Formats a USD value for display.
 */
function formatUsd(value: number): string {
  if (value < 0.01) {
    return '< $0.01';
  }
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Warning component shown when claim amount is too small relative to gas costs.
 *
 * Implements SPEC.md Section 7.2:
 * > "Frontend shows warning if claim amount is too small relative to gas."
 *
 * Features:
 * - Shows warning when claimable value < 2x gas cost
 * - Displays both claimable value and estimated gas in USD
 * - Loading skeleton while gas is being estimated
 * - Hidden when claim is worthwhile or gas estimation fails gracefully
 *
 * @example
 * ```tsx
 * <ClaimValueWarning
 *   ytAddress={market.ytAddress}
 *   claimableUsd={yieldData.claimableUsd}
 * />
 * ```
 */
export function ClaimValueWarning({
  ytAddress,
  claimableUsd,
  className,
}: ClaimValueWarningProps): ReactNode {
  const gasCheck = useClaimGasCheck(ytAddress, claimableUsd);

  // Don't show while loading (async, non-blocking)
  if (gasCheck.isLoading) {
    return (
      <div className={cn('mt-2', className)}>
        <Skeleton className="h-4 w-32" aria-label="Estimating gas cost" />
      </div>
    );
  }

  // Don't show if estimation failed (fail gracefully)
  if (gasCheck.error) {
    return null;
  }

  // Don't show if claim is worthwhile
  if (gasCheck.isWorthClaiming) {
    return null;
  }

  // Don't show if we don't have a valid gas estimate
  if (gasCheck.estimatedGasUsd === 0) {
    return null;
  }

  return (
    <Alert variant="warning" className={cn('mt-3', className)}>
      <AlertTriangleIcon className="size-4" />
      <AlertDescription className="text-sm">
        This claim costs ~{formatUsd(gasCheck.estimatedGasUsd)} in gas for {formatUsd(claimableUsd)}{' '}
        in yield. Consider waiting for more yield to accumulate.
      </AlertDescription>
    </Alert>
  );
}

export type { ClaimValueWarningProps };
