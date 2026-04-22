'use client';

import { useTokenInfo } from '@features/portfolio';
import {
  type AccruedReward,
  type PortfolioRewards,
  type PortfolioYTRewards,
  useClaimAllRewards,
  useClaimAllYTRewards,
  usePortfolioRewards,
  usePortfolioYTRewards,
  type YTAccruedReward,
} from '@features/rewards';
import { useAccount } from '@features/wallet';
import { useEstimateFee } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { formatWad } from '@shared/math/wad';
import { AnimatedNumber } from '@shared/ui/AnimatedNumber';
import { BentoCard } from '@shared/ui/BentoCard';
import { Button } from '@shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { GasEstimate } from '@shared/ui/GasEstimate';
import { Skeleton } from '@shared/ui/Skeleton';
import { TxStatus } from '@widgets/display/TxStatus';
import { GiftIcon } from 'lucide-react';
import { type ReactNode, useCallback, useMemo } from 'react';

interface PortfolioRewardsCardProps {
  /** SY addresses from user's positions */
  syAddresses: string[];
  /** YT addresses from user's positions */
  ytAddresses?: string[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Display a single reward token with its accrued amount
 */
function RewardTokenDisplay({ reward }: { reward: AccruedReward | YTAccruedReward }): ReactNode {
  const { data: tokenInfo, isLoading } = useTokenInfo(reward.tokenAddress);

  if (isLoading) {
    return (
      <div className="flex items-center justify-between py-1.5">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }

  const symbol = tokenInfo?.symbol ?? 'TOKEN';
  const decimals = tokenInfo?.decimals ?? 18;
  const displayDecimals = Math.min(decimals, 4);

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-muted-foreground text-sm">{symbol}</span>
      <span className="font-mono text-sm">{formatWad(reward.amount, displayDecimals)}</span>
    </div>
  );
}

/**
 * Inner content component that uses rewards data
 */
function RewardsCardContent({
  rewards,
  className,
}: {
  rewards: PortfolioRewards;
  className?: string | undefined;
}): ReactNode {
  const { isConnected } = useAccount();

  // Claim hook for all rewards
  const {
    claim,
    status,
    txHash,
    error,
    isLoading: claimLoading,
    reset,
    buildClaimCall,
  } = useClaimAllRewards(rewards.claimableSyAddresses);

  // Build call for gas estimation
  const claimCall = useMemo(() => {
    if (!rewards.hasAnyRewards) return null;
    const call = buildClaimCall();
    return call ? [call] : null;
  }, [buildClaimCall, rewards.hasAnyRewards]);

  // Estimate gas
  const {
    formattedFee,
    formattedFeeUsd,
    isLoading: gasLoading,
    error: gasError,
  } = useEstimateFee(rewards.hasAnyRewards ? claimCall : null);

  const handleClaim = useCallback(async () => {
    await claim();
  }, [claim]);

  const handleDone = useCallback(() => {
    reset();
  }, [reset]);

  // Button state - computed before any early returns
  const buttonDisabled = !isConnected || !rewards.hasAnyRewards || claimLoading;
  const buttonText = useMemo(() => {
    if (!isConnected) return 'Connect Wallet';
    if (claimLoading) return 'Claiming...';
    return `Claim All (${String(rewards.claimableSyAddresses.length)})`;
  }, [isConnected, claimLoading, rewards.claimableSyAddresses.length]);

  // No rewards state
  if (!rewards.hasAnyRewards) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GiftIcon className="text-muted-foreground h-4 w-4" />
            External Rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="bg-muted-foreground/20 mb-3 flex h-10 w-10 items-center justify-center rounded-full">
              <GiftIcon className="text-muted-foreground h-5 w-5" />
            </div>
            <p className="text-muted-foreground text-sm">No external rewards available</p>
            <p className="text-muted-foreground/70 mt-1 text-xs">
              Rewards from incentivized pools will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-success/20', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <GiftIcon className="text-success h-4 w-4" />
            External Rewards
          </CardTitle>
          <span className="bg-success/20 text-success rounded-full px-2 py-0.5 text-xs font-medium">
            {rewards.distinctTokenCount} {rewards.distinctTokenCount === 1 ? 'token' : 'tokens'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rewards List */}
        <div className="bg-muted rounded-lg p-3">
          <div className="divide-border divide-y">
            {rewards.allRewards.map((reward) => (
              <RewardTokenDisplay key={reward.tokenAddress} reward={reward} />
            ))}
          </div>
        </div>

        {/* Source info */}
        <p className="text-muted-foreground text-xs">
          From {rewards.claimableSyAddresses.length} reward-bearing{' '}
          {rewards.claimableSyAddresses.length === 1 ? 'position' : 'positions'}
        </p>

        {/* Gas Estimate */}
        {status === 'idle' && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Estimated Gas</span>
            <GasEstimate
              formattedFee={formattedFee}
              formattedFeeUsd={formattedFeeUsd}
              isLoading={gasLoading}
              error={gasError}
            />
          </div>
        )}

        {/* Transaction Status */}
        {status !== 'idle' && (
          <TxStatus
            status={status}
            txHash={txHash}
            error={error}
            showNextSteps={false}
            {...(status === 'signing' && {
              gasEstimate: {
                formattedFee,
                formattedFeeUsd,
                isLoading: gasLoading,
                error: gasError,
              },
            })}
          />
        )}

        {/* Action Button */}
        {status === 'success' ? (
          <Button onClick={handleDone} className="w-full">
            Done
          </Button>
        ) : (
          <Button
            onClick={handleClaim}
            disabled={buttonDisabled}
            className="bg-success hover:bg-success/90 w-full"
          >
            {buttonText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Inner content component for YT rewards data
 */
function YTRewardsCardContent({
  rewards,
  className,
}: {
  rewards: PortfolioYTRewards;
  className?: string | undefined;
}): ReactNode {
  const { isConnected } = useAccount();

  // Claim hook for all YT rewards
  const {
    claim,
    status,
    txHash,
    error,
    isLoading: claimLoading,
    reset,
    buildClaimCall,
  } = useClaimAllYTRewards(rewards.claimableYtAddresses);

  // Build call for gas estimation
  const claimCall = useMemo(() => {
    if (!rewards.hasAnyRewards) return null;
    const call = buildClaimCall();
    return call ? [call] : null;
  }, [buildClaimCall, rewards.hasAnyRewards]);

  // Estimate gas
  const {
    formattedFee,
    formattedFeeUsd,
    isLoading: gasLoading,
    error: gasError,
  } = useEstimateFee(rewards.hasAnyRewards ? claimCall : null);

  const handleClaim = useCallback(async () => {
    await claim();
  }, [claim]);

  const handleDone = useCallback(() => {
    reset();
  }, [reset]);

  // Button state
  const buttonDisabled = !isConnected || !rewards.hasAnyRewards || claimLoading;
  const buttonText = useMemo(() => {
    if (!isConnected) return 'Connect Wallet';
    if (claimLoading) return 'Claiming...';
    return `Claim All (${String(rewards.claimableYtAddresses.length)})`;
  }, [isConnected, claimLoading, rewards.claimableYtAddresses.length]);

  // No rewards state
  if (!rewards.hasAnyRewards) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GiftIcon className="text-muted-foreground h-4 w-4" />
            YT Rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="bg-muted-foreground/20 mb-3 flex h-10 w-10 items-center justify-center rounded-full">
              <GiftIcon className="text-muted-foreground h-5 w-5" />
            </div>
            <p className="text-muted-foreground text-sm">No YT rewards available</p>
            <p className="text-muted-foreground/70 mt-1 text-xs">
              Rewards from your Yield Tokens will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-primary/20', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <GiftIcon className="text-primary h-4 w-4" />
            YT Rewards
          </CardTitle>
          <span className="bg-primary/20 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
            {rewards.distinctTokenCount} {rewards.distinctTokenCount === 1 ? 'token' : 'tokens'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rewards List */}
        <div className="bg-muted rounded-lg p-3">
          <div className="divide-border divide-y">
            {rewards.allRewards.map((reward) => (
              <RewardTokenDisplay key={reward.tokenAddress} reward={reward} />
            ))}
          </div>
        </div>

        {/* Source info */}
        <p className="text-muted-foreground text-xs">
          From {rewards.claimableYtAddresses.length} YT{' '}
          {rewards.claimableYtAddresses.length === 1 ? 'position' : 'positions'}
        </p>

        {/* Gas Estimate */}
        {status === 'idle' && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Estimated Gas</span>
            <GasEstimate
              formattedFee={formattedFee}
              formattedFeeUsd={formattedFeeUsd}
              isLoading={gasLoading}
              error={gasError}
            />
          </div>
        )}

        {/* Transaction Status */}
        {status !== 'idle' && (
          <TxStatus
            status={status}
            txHash={txHash}
            error={error}
            showNextSteps={false}
            {...(status === 'signing' && {
              gasEstimate: {
                formattedFee,
                formattedFeeUsd,
                isLoading: gasLoading,
                error: gasError,
              },
            })}
          />
        )}

        {/* Action Button */}
        {status === 'success' ? (
          <Button onClick={handleDone} className="w-full">
            Done
          </Button>
        ) : (
          <Button
            onClick={handleClaim}
            disabled={buttonDisabled}
            className="bg-primary hover:bg-primary/90 w-full"
          >
            {buttonText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * PortfolioRewardsCard - Displays accrued rewards across all positions.
 *
 * This component aggregates rewards from both:
 * - SYWithRewards contracts (external incentives like governance tokens)
 * - YT contracts (yield token rewards)
 *
 * Each reward type has its own section with a separate "Claim All" button.
 *
 * @example
 * ```tsx
 * // Get SY and YT addresses from portfolio positions
 * const syAddresses = positions.map(p => p.market.syAddress);
 * const ytAddresses = positions.map(p => p.market.ytAddress);
 * <PortfolioRewardsCard syAddresses={syAddresses} ytAddresses={ytAddresses} />
 * ```
 */
export function PortfolioRewardsCard({
  syAddresses,
  ytAddresses = [],
  className,
}: PortfolioRewardsCardProps): ReactNode {
  const {
    data: syRewards,
    isLoading: syLoading,
    isError: syError,
  } = usePortfolioRewards(syAddresses);
  const {
    data: ytRewards,
    isLoading: ytLoading,
    isError: ytError,
  } = usePortfolioYTRewards(ytAddresses);

  const isLoading = syLoading || ytLoading;
  const hasSyRewards = !syError && syRewards && syAddresses.length > 0;
  const hasYtRewards = !ytError && ytRewards && ytAddresses.length > 0;

  // Loading state - show skeletons for each section that could potentially have rewards
  if (isLoading) {
    const showSySkeleton = syAddresses.length > 0;
    const showYtSkeleton = ytAddresses.length > 0;

    if (!showSySkeleton && !showYtSkeleton) {
      return null;
    }

    return (
      <div className={cn('space-y-4', className)}>
        {showSySkeleton && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GiftIcon className="text-muted-foreground h-4 w-4" />
                External Rewards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        )}
        {showYtSkeleton && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GiftIcon className="text-muted-foreground h-4 w-4" />
                YT Rewards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // No rewards available from either source
  if (!hasSyRewards && !hasYtRewards) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      {hasSyRewards && <RewardsCardContent rewards={syRewards} />}
      {hasYtRewards && <YTRewardsCardContent rewards={ytRewards} />}
    </div>
  );
}

/**
 * Compact version for BentoGrid display showing total rewards count.
 * Aggregates both SY and YT rewards into a single summary card.
 */
export function PortfolioRewardsBento({
  syAddresses,
  ytAddresses = [],
  className,
}: PortfolioRewardsCardProps): ReactNode {
  const { data: syRewards, isLoading: syLoading } = usePortfolioRewards(syAddresses);
  const { data: ytRewards, isLoading: ytLoading } = usePortfolioYTRewards(ytAddresses);

  const isLoading = syLoading || ytLoading;

  if (isLoading) {
    return (
      <BentoCard colSpan={{ default: 6, lg: 4 }} rowSpan={1} className={className}>
        <div className="flex h-full flex-col justify-center p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-8 w-16" />
        </div>
      </BentoCard>
    );
  }

  const hasSyRewards = syRewards?.hasAnyRewards ?? false;
  const hasYtRewards = ytRewards?.hasAnyRewards ?? false;

  if (!hasSyRewards && !hasYtRewards) {
    return null;
  }

  // Aggregate counts from both sources
  const totalTokenCount =
    (syRewards?.distinctTokenCount ?? 0) + (ytRewards?.distinctTokenCount ?? 0);
  const totalPositions =
    (syRewards?.claimableSyAddresses.length ?? 0) + (ytRewards?.claimableYtAddresses.length ?? 0);

  return (
    <BentoCard colSpan={{ default: 6, lg: 4 }} rowSpan={1} className={className}>
      <div className="flex h-full flex-col justify-center p-4">
        <div className="flex items-center gap-2">
          <GiftIcon className="text-success h-4 w-4" />
          <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Claimable Rewards
          </span>
        </div>
        <span className="text-success mt-2 font-mono text-2xl font-semibold">
          <AnimatedNumber
            value={totalTokenCount}
            formatter={(v) => `${String(v)} ${v === 1 ? 'token' : 'tokens'}`}
            duration={400}
          />
        </span>
        <span className="text-muted-foreground mt-1 text-sm">
          from {String(totalPositions)} {totalPositions === 1 ? 'position' : 'positions'}
        </span>
      </div>
    </BentoCard>
  );
}
