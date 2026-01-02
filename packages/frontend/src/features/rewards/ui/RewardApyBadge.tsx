'use client';

import { cn } from '@shared/lib/utils';
import { Badge } from '@shared/ui/badge';
import { Skeleton } from '@shared/ui/Skeleton';
import { GiftIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { useRewardApy, useTotalRewardApy } from '../model';

interface RewardApyBadgeProps {
  /** SYWithRewards contract address */
  syAddress: string | undefined;
  /**
   * Display variant.
   * - 'badge': Compact badge with icon (default)
   * - 'text': Plain text without badge styling
   */
  variant?: 'badge' | 'text';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format APY as percentage string.
 * Input is decimal (e.g., 0.05 = 5%)
 */
function formatApyPercent(apy: number): string {
  const percent = apy * 100;

  if (percent === 0) {
    return '0%';
  }

  if (percent < 0.01) {
    return '< 0.01%';
  }

  if (percent < 1) {
    return `${percent.toFixed(2)}%`;
  }

  if (percent < 10) {
    return `${percent.toFixed(1)}%`;
  }

  return `${String(Math.round(percent))}%`;
}

/**
 * Badge showing reward APY for an SYWithRewards contract.
 *
 * Uses the 7-day rolling window from indexed data to display
 * estimated annual reward rates. Shows combined APY across all
 * reward tokens.
 *
 * Returns null if no rewards are configured or APY is zero.
 *
 * @example
 * ```tsx
 * // In a market card header
 * <RewardApyBadge syAddress={market.syAddress} />
 *
 * // Plain text variant
 * <RewardApyBadge syAddress={market.syAddress} variant="text" />
 * ```
 */
export function RewardApyBadge({
  syAddress,
  variant = 'badge',
  className,
}: RewardApyBadgeProps): ReactNode {
  const { isLoading, data } = useRewardApy(syAddress);
  const totalApy = useTotalRewardApy(syAddress);

  // Show skeleton while loading (only for badge variant)
  if (isLoading && variant === 'badge') {
    return (
      <Skeleton
        className={cn('h-5 w-14 rounded-full', className)}
        aria-label="Loading reward APY"
      />
    );
  }

  // Don't render if no rewards or zero APY
  if (!data?.rewardTokens || data.rewardTokens.length === 0 || totalApy === 0) {
    return null;
  }

  const formattedApy = formatApyPercent(totalApy);

  // Plain text variant
  if (variant === 'text') {
    return (
      <span className={cn('text-success font-medium', className)}>+{formattedApy} rewards</span>
    );
  }

  // Badge variant (default)
  return (
    <Badge
      variant="outline"
      className={cn('border-success/50 bg-success/10 text-success gap-1', className)}
    >
      <GiftIcon className="h-3 w-3" aria-hidden="true" />
      <span>+{formattedApy}</span>
    </Badge>
  );
}

export type { RewardApyBadgeProps };
