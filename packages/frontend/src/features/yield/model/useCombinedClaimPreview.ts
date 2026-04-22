'use client';

import { useYTAccruedRewards, type YTAccruedReward } from '@features/rewards';
import { useAccount } from '@features/wallet';
import { useEstimateFee } from '@shared/hooks/useEstimateFee';
import { getYTContract } from '@shared/starknet/contracts';
import { useMemo } from 'react';
import type { Call } from 'starknet';
import { useInterestFee } from './useInterestFee';
import { useYieldClaimPreview } from './useUserYield';

/**
 * Combined preview of claimable interest and rewards
 */
export interface CombinedClaimPreview {
  // Interest breakdown
  /** Gross interest before fee deduction (WAD) */
  grossInterest: bigint;
  /** Interest fee amount that will be deducted (WAD) */
  interestFeeAmount: bigint;
  /** Net interest after fee deduction (WAD) */
  netInterest: bigint;
  /** Interest fee rate as percentage string (e.g., "3.00%") */
  interestFeeRatePercent: string;
  /** Whether user has interest to claim */
  hasInterestToClaim: boolean;

  // Rewards breakdown
  /** Array of accrued rewards by token */
  accruedRewards: YTAccruedReward[];
  /** Number of reward tokens with non-zero claimable amounts */
  claimableRewardTokenCount: number;
  /** Whether user has any rewards to claim */
  hasRewardsToClaim: boolean;

  // Combined summary
  /** Whether there is anything to claim (interest or rewards) */
  hasAnythingToClaim: boolean;

  // Gas estimation
  /** Estimated gas fee in STRK (bigint, WAD-scaled) */
  estimatedGasFee: bigint;
  /** Formatted gas estimate string (e.g., "~0.0001 STRK") */
  formattedGasFee: string;
  /** Gas fee in USD (e.g., "$0.02") */
  formattedGasFeeUsd: string;

  // Loading and error states
  /** Whether any data is still loading */
  isLoading: boolean;
  /** Whether interest data is loading */
  isInterestLoading: boolean;
  /** Whether rewards data is loading */
  isRewardsLoading: boolean;
  /** Whether gas estimation is loading */
  isGasLoading: boolean;
  /** Combined error from any source */
  error: Error | null;
}

/**
 * Hook to preview a combined claim of interest and rewards with gas estimation.
 *
 * Fetches interest preview, rewards preview, and estimates gas for the combined
 * redeem_due_interest_and_rewards call. Useful for showing users exactly what
 * they will receive and what it will cost before claiming.
 *
 * @param ytAddress - The YT contract address
 * @param options - Optional configuration
 * @returns Combined claim preview with breakdowns and gas estimate
 *
 * @example
 * ```tsx
 * const preview = useCombinedClaimPreview(ytAddress);
 *
 * if (preview.isLoading) return <Skeleton />;
 *
 * if (preview.hasAnythingToClaim) {
 *   return (
 *     <div>
 *       {preview.hasInterestToClaim && (
 *         <div>
 *           Interest: {formatWad(preview.netInterest)} SY
 *           (fee: {preview.interestFeeRatePercent})
 *         </div>
 *       )}
 *       {preview.hasRewardsToClaim && (
 *         <div>Rewards: {preview.claimableRewardTokenCount} tokens</div>
 *       )}
 *       <div>Gas: {preview.formattedGasFee} ({preview.formattedGasFeeUsd})</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCombinedClaimPreview(
  ytAddress: string | undefined,
  options: { enabled?: boolean } = {}
): CombinedClaimPreview {
  const { enabled = true } = options;
  const { account, address: userAddress } = useAccount();

  // Fetch interest preview (includes gross/net/fee breakdown)
  const interestQuery = useYieldClaimPreview(enabled ? ytAddress : undefined);

  // Fetch accrued rewards
  const rewardsQuery = useYTAccruedRewards(enabled ? ytAddress : undefined);

  // Fetch interest fee info (for display purposes)
  const feeQuery = useInterestFee(enabled ? ytAddress : undefined);

  // Build the combined claim call for gas estimation
  const claimCall = useMemo((): Call[] | null => {
    if (!account || !userAddress || !ytAddress || !enabled) {
      return null;
    }

    // Only estimate if there's something to claim
    const hasInterest = interestQuery.data?.hasYieldToClaim ?? false;
    const hasRewards = (rewardsQuery.data ?? []).some((r) => r.amount > 0n);

    if (!hasInterest && !hasRewards) {
      return null;
    }

    try {
      const ytContract = getYTContract(ytAddress, account);
      const call = ytContract.populate('redeem_due_interest_and_rewards', [
        userAddress,
        true, // doInterest
        true, // doRewards
      ]);
      return [call];
    } catch {
      return null;
    }
  }, [account, userAddress, ytAddress, enabled, interestQuery.data, rewardsQuery.data]);

  // Estimate gas for the combined claim (includes USD formatting)
  const gasEstimate = useEstimateFee(claimCall);

  // Derive combined state
  const accruedRewards = rewardsQuery.data ?? [];
  const hasInterestToClaim = interestQuery.data?.hasYieldToClaim ?? false;
  const hasRewardsToClaim = accruedRewards.some((r) => r.amount > 0n);
  const hasAnythingToClaim = hasInterestToClaim || hasRewardsToClaim;

  // Combine errors
  const error = interestQuery.error ?? rewardsQuery.error ?? gasEstimate.error ?? null;

  return {
    // Interest breakdown
    grossInterest: interestQuery.data?.grossYield ?? 0n,
    interestFeeAmount: interestQuery.data?.feeAmount ?? 0n,
    netInterest: interestQuery.data?.netYield ?? 0n,
    interestFeeRatePercent: feeQuery.data?.feeRatePercent ?? '0.00%',
    hasInterestToClaim,

    // Rewards breakdown
    accruedRewards,
    claimableRewardTokenCount: accruedRewards.filter((r) => r.amount > 0n).length,
    hasRewardsToClaim,

    // Combined summary
    hasAnythingToClaim,

    // Gas estimation
    estimatedGasFee: gasEstimate.totalFee,
    formattedGasFee: gasEstimate.formattedFee,
    formattedGasFeeUsd: gasEstimate.formattedFeeUsd,

    // Loading states
    isLoading: interestQuery.isLoading || rewardsQuery.isLoading || gasEstimate.isLoading,
    isInterestLoading: interestQuery.isLoading,
    isRewardsLoading: rewardsQuery.isLoading,
    isGasLoading: gasEstimate.isLoading,
    error,
  };
}
