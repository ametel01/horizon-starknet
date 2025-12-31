'use client';

import { GiftIcon } from 'lucide-react';
import { type ReactNode, useCallback, useMemo } from 'react';

import { useTokenInfo } from '@features/portfolio';
import {
  type AccruedReward,
  type PortfolioRewards,
  useClaimAllRewards,
  usePortfolioRewards,
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

interface PortfolioRewardsCardProps {
  /** SY addresses from user's positions */
  syAddresses: string[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Display a single reward token with its accrued amount
 */
function RewardTokenDisplay({ reward }: { reward: AccruedReward }): ReactNode {
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
 * PortfolioRewardsCard - Displays accrued external rewards across all positions.
 *
 * This component aggregates rewards from SYWithRewards contracts (external incentives
 * like governance tokens) and provides a single "Claim All" action to collect them.
 *
 * This is separate from YT yield (interest from yield-bearing assets) - external
 * rewards come from protocol incentive programs.
 *
 * @example
 * ```tsx
 * // Get SY addresses from portfolio positions
 * const syAddresses = positions.map(p => p.market.syAddress);
 * <PortfolioRewardsCard syAddresses={syAddresses} />
 * ```
 */
export function PortfolioRewardsCard({
  syAddresses,
  className,
}: PortfolioRewardsCardProps): ReactNode {
  const { data: rewards, isLoading, isError } = usePortfolioRewards(syAddresses);

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
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
    );
  }

  // Error or no SY addresses
  if (isError || !rewards || syAddresses.length === 0) {
    return null; // Silently hide if no rewards available
  }

  return <RewardsCardContent rewards={rewards} className={className} />;
}

/**
 * Compact version for BentoGrid display showing total rewards count
 */
export function PortfolioRewardsBento({
  syAddresses,
  className,
}: PortfolioRewardsCardProps): ReactNode {
  const { data: rewards, isLoading } = usePortfolioRewards(syAddresses);

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

  if (!rewards?.hasAnyRewards) {
    return null;
  }

  return (
    <BentoCard colSpan={{ default: 6, lg: 4 }} rowSpan={1} className={className}>
      <div className="flex h-full flex-col justify-center p-4">
        <div className="flex items-center gap-2">
          <GiftIcon className="text-success h-4 w-4" />
          <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            External Rewards
          </span>
        </div>
        <span className="text-success mt-2 font-mono text-2xl font-semibold">
          <AnimatedNumber
            value={rewards.distinctTokenCount}
            formatter={(v) => `${String(v)} ${v === 1 ? 'token' : 'tokens'}`}
            duration={400}
          />
        </span>
        <span className="text-muted-foreground mt-1 text-sm">
          from {String(rewards.claimableSyAddresses.length)}{' '}
          {rewards.claimableSyAddresses.length === 1 ? 'position' : 'positions'}
        </span>
      </div>
    </BentoCard>
  );
}
