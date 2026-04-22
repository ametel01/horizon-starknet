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
 * Check if there are active rewards being distributed.
 * Uses rawRewardRatio > 0 as indicator (actual APY requires price data).
 */
function hasActiveRewards(ratio: number): boolean {
  return ratio > 0;
}

/**
 * Badge indicating active rewards for an SYWithRewards contract.
 *
 * Shows a "Rewards" indicator when the SY contract has active reward
 * distributions. Does NOT display APY percentage because accurate APY
 * calculation requires token price data that isn't available here.
 *
 * Returns null if no rewards are being distributed.
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
  const totalRatio = useTotalRewardApy(syAddress);

  // Show skeleton while loading (only for badge variant)
  if (isLoading && variant === 'badge') {
    return (
      <Skeleton
        className={cn('h-5 w-14 rounded-full', className)}
        aria-label="Loading rewards status"
      />
    );
  }

  // Don't render if no rewards or no active distributions
  if (!data?.rewardTokens || data.rewardTokens.length === 0 || !hasActiveRewards(totalRatio)) {
    return null;
  }

  // Plain text variant
  if (variant === 'text') {
    return <span className={cn('text-success font-medium', className)}>Rewards</span>;
  }

  // Badge variant (default) - shows indicator without misleading APY percentage
  return (
    <Badge
      variant="outline"
      className={cn('border-success/50 bg-success/10 text-success gap-1', className)}
    >
      <GiftIcon className="h-3 w-3" aria-hidden="true" />
      <span>Rewards</span>
    </Badge>
  );
}

export type { RewardApyBadgeProps };
