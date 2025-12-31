'use client';

import { TrendingDownIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@shared/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@shared/ui/alert';
import { Badge } from '@shared/ui/badge';
import { Skeleton } from '@shared/ui/Skeleton';

import { useSyWatermark } from '../model/useSyWatermark';

interface NegativeYieldWarningProps {
  /** SY contract address to check yield status */
  syAddress: string | undefined;
  /**
   * Display variant for different contexts.
   * - 'banner': Full alert banner for forms (default)
   * - 'badge': Compact badge for market cards
   */
  variant?: 'banner' | 'badge';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format basis points as percentage string.
 */
function formatBpsAsPercent(bps: number): string {
  const percent = bps / 100;
  if (percent < 0.01) {
    return '< 0.01%';
  }
  return `${percent.toFixed(2)}%`;
}

/**
 * Warning indicator shown when negative yield is detected.
 *
 * Negative yield occurs when the underlying asset's exchange rate drops
 * below its historical watermark (highest rate ever seen). This indicates
 * the yield-bearing asset has lost value.
 *
 * This component provides two display variants:
 * - 'banner': Full alert with explanation for forms
 * - 'badge': Compact indicator for market cards
 *
 * @example
 * ```tsx
 * // In a form (full banner)
 * <NegativeYieldWarning syAddress={syAddress} variant="banner" />
 *
 * // In a market card (compact badge)
 * <NegativeYieldWarning syAddress={syAddress} variant="badge" />
 * ```
 */
export function NegativeYieldWarning({
  syAddress,
  variant = 'banner',
  className,
}: NegativeYieldWarningProps): ReactNode {
  const { data: watermarkInfo, isLoading } = useSyWatermark(syAddress);

  // Show skeleton only for badge variant while loading
  if (isLoading && variant === 'badge') {
    return (
      <Skeleton
        className={cn('h-5 w-16 rounded-full', className)}
        aria-label="Checking yield status"
      />
    );
  }

  // Don't render if no negative yield or data not available
  if (!watermarkInfo?.hasNegativeYield) {
    return null;
  }

  const dropPercent = formatBpsAsPercent(watermarkInfo.rateDropBps);

  // Compact badge variant for market cards
  if (variant === 'badge') {
    return (
      <Badge
        variant="outline"
        className={cn('border-destructive/50 bg-destructive/10 text-destructive gap-1', className)}
      >
        <TrendingDownIcon className="h-3 w-3" aria-hidden="true" />
        <span>-{dropPercent}</span>
      </Badge>
    );
  }

  // Full banner variant for forms
  return (
    <Alert variant="destructive" className={cn(className)}>
      <TrendingDownIcon className="size-4" />
      <AlertTitle>Negative Yield Detected</AlertTitle>
      <AlertDescription>
        This asset&apos;s exchange rate has dropped {dropPercent} from its peak. The underlying
        yield source may be experiencing losses. Consider the risks before proceeding.
      </AlertDescription>
    </Alert>
  );
}

export type { NegativeYieldWarningProps };
