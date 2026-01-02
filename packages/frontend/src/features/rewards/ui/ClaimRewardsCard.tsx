'use client';

import { useTokenInfo } from '@features/portfolio';
import { useAccount } from '@features/wallet';
import { useEstimateFee } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { formatWad } from '@shared/math/wad';
import { Button } from '@shared/ui/Button';
import { Card, CardContent } from '@shared/ui/Card';
import { FormActions, FormHeader, FormLayout } from '@shared/ui/FormLayout';
import { GasEstimate } from '@shared/ui/GasEstimate';
import { Skeleton } from '@shared/ui/Skeleton';
import { TxStatus } from '@widgets/display/TxStatus';
import { GiftIcon } from 'lucide-react';
import { type ReactNode, useCallback, useMemo } from 'react';

import { type AccruedReward, useAccruedRewards, useClaimRewards } from '../model';

interface ClaimRewardsCardProps {
  /** SYWithRewards contract address */
  syAddress: string;
  /** Optional title override */
  title?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Display a single reward token row with amount and symbol.
 */
function RewardTokenRow({ reward }: { reward: AccruedReward }): ReactNode {
  const { data: tokenInfo, isLoading } = useTokenInfo(reward.tokenAddress);

  if (isLoading) {
    return (
      <div className="flex items-center justify-between py-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  const symbol = tokenInfo?.symbol ?? 'TOKEN';
  const decimals = tokenInfo?.decimals ?? 18;
  // Format with appropriate decimals (use 4 for display)
  const displayDecimals = Math.min(decimals, 4);

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-muted-foreground text-sm">{symbol}</span>
      <span className="font-mono text-sm">
        {formatWad(reward.amount, displayDecimals)}
        <span className="text-muted-foreground ml-1">{symbol}</span>
      </span>
    </div>
  );
}

/**
 * ClaimRewardsCard - UI component for claiming rewards from SYWithRewards contracts.
 *
 * Features:
 * - Displays all pending reward tokens with amounts
 * - One-click claim button with gas estimation
 * - Transaction status feedback (signing, pending, success, error)
 * - Loading and empty states handled gracefully
 * - Uses success gradient to indicate positive action
 *
 * @example
 * ```tsx
 * <ClaimRewardsCard syAddress={market.syAddress} />
 * ```
 */
export function ClaimRewardsCard({
  syAddress,
  title = 'Claimable Rewards',
  className,
}: ClaimRewardsCardProps): ReactNode {
  const { isConnected } = useAccount();
  const { data: rewards, isLoading: rewardsLoading } = useAccruedRewards(syAddress);
  const {
    claim,
    status,
    txHash,
    error,
    isLoading: claimLoading,
    reset,
    buildClaimCall,
  } = useClaimRewards(syAddress);

  // Check if there are any claimable rewards
  const hasRewards = useMemo(() => {
    if (!rewards || rewards.length === 0) return false;
    return rewards.some((r) => r.amount > 0n);
  }, [rewards]);

  // Filter to only non-zero rewards for display
  const claimableRewards = useMemo(() => {
    if (!rewards) return [];
    return rewards.filter((r) => r.amount > 0n);
  }, [rewards]);

  // Build call for gas estimation
  const claimCall = useMemo(() => {
    const call = buildClaimCall();
    return call ? [call] : null;
  }, [buildClaimCall]);

  // Estimate gas for claim transaction
  const {
    formattedFee,
    formattedFeeUsd,
    isLoading: gasLoading,
    error: gasError,
  } = useEstimateFee(hasRewards ? claimCall : null);

  // Handle claim button click
  const handleClaim = useCallback(async () => {
    await claim();
  }, [claim]);

  // Handle reset after success
  const handleClaimMore = useCallback(() => {
    reset();
  }, [reset]);

  // Button state logic
  const buttonDisabled = !isConnected || !hasRewards || claimLoading;

  const buttonText = useMemo(() => {
    if (!isConnected) return 'Connect Wallet';
    if (claimLoading) return 'Claiming...';
    if (!hasRewards) return 'No Rewards';
    return 'Claim Rewards';
  }, [isConnected, claimLoading, hasRewards]);

  // Empty state when no rewards
  if (!rewardsLoading && !hasRewards && status === 'idle') {
    return (
      <FormLayout gradient="none" className={className}>
        <FormHeader title={title} description="Your pending rewards will appear here" />
        <Card size="sm" className="bg-muted">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-8">
            <div className="bg-muted-foreground/20 flex h-12 w-12 items-center justify-center rounded-full">
              <GiftIcon className="text-muted-foreground h-6 w-6" />
            </div>
            <p className="text-muted-foreground text-center text-sm">
              No rewards available to claim
            </p>
          </CardContent>
        </Card>
      </FormLayout>
    );
  }

  return (
    <FormLayout gradient={hasRewards ? 'success' : 'none'} className={className}>
      <FormHeader
        title={title}
        description={hasRewards ? 'Claim your earned rewards' : 'Your pending rewards'}
      />

      {/* Rewards List */}
      <Card size="sm" className="bg-muted">
        <CardContent className="p-4">
          {rewardsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : claimableRewards.length > 0 ? (
            <div className="divide-border divide-y">
              {claimableRewards.map((reward) => (
                <RewardTokenRow key={reward.tokenAddress} reward={reward} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-2 text-center text-sm">No pending rewards</p>
          )}
        </CardContent>
      </Card>

      {/* Gas Estimate */}
      {hasRewards && status === 'idle' && (
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
            gasEstimate: { formattedFee, formattedFeeUsd, isLoading: gasLoading, error: gasError },
          })}
        />
      )}

      {/* Actions */}
      <FormActions>
        {status === 'success' ? (
          <Button onClick={handleClaimMore} className="h-12 w-full text-base font-medium">
            Done
          </Button>
        ) : (
          <Button
            onClick={handleClaim}
            disabled={buttonDisabled}
            className={cn(
              'h-12 w-full text-base font-medium',
              hasRewards && 'bg-success hover:bg-success/90'
            )}
          >
            {buttonText}
          </Button>
        )}
      </FormActions>
    </FormLayout>
  );
}

export type { ClaimRewardsCardProps };
