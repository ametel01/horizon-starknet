'use client';

import { getTokenPrice, usePrices } from '@features/price';
import { useAccount } from '@features/wallet';
import { useEstimateFee } from '@shared/hooks/useEstimateFee';
import { fromWad } from '@shared/math/wad';
import { getYTContract } from '@shared/starknet/contracts';
import { useMemo } from 'react';
import type { Call } from 'starknet';

/**
 * STRK native token address for gas price conversion
 * @see https://starkscan.co/token/0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
 */
const STRK_TOKEN_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

/**
 * Result of the claim gas check
 */
export interface ClaimGasCheck {
  /** Whether the claim is worth the gas cost (ratio > 2.0) */
  isWorthClaiming: boolean;
  /** USD value of claimable yield */
  claimableUsd: number;
  /** Estimated gas cost in USD */
  estimatedGasUsd: number;
  /** Ratio of claimable to gas cost */
  ratio: number;
  /** Formatted gas estimate string (e.g., "~0.0001 STRK") */
  formattedGas: string;
  /** Whether the estimate is loading */
  isLoading: boolean;
  /** Error if estimation failed */
  error: Error | null;
}

/**
 * Minimum ratio of claimable value to gas cost for a claim to be "worth it"
 * A ratio of 2.0 means the claim should be worth at least 2x the gas cost
 */
const MIN_WORTHWHILE_RATIO = 2.0;

/**
 * Hook to check if claiming yield is economically worthwhile.
 *
 * Compares the USD value of claimable yield against the estimated gas cost
 * in USD. Uses the STRK token price to convert gas costs.
 *
 * @param ytAddress - YT contract address
 * @param claimableUsd - USD value of claimable yield
 * @param enabled - Whether to run the estimation (default: true)
 *
 * @example
 * ```tsx
 * const gasCheck = useClaimGasCheck(
 *   market.ytAddress,
 *   yieldData.claimableUsd
 * );
 *
 * if (!gasCheck.isWorthClaiming) {
 *   // Show warning about gas costs
 * }
 * ```
 */
export function useClaimGasCheck(
  ytAddress: string,
  claimableUsd: number,
  enabled = true
): ClaimGasCheck {
  const { account, address } = useAccount();

  // Build the claim call for fee estimation
  const claimCall = useMemo((): Call[] | null => {
    if (!account || !address || !ytAddress || !enabled) {
      return null;
    }

    try {
      const ytContract = getYTContract(ytAddress, account);
      const call = ytContract.populate('redeem_due_interest', [address]);
      return [call];
    } catch {
      return null;
    }
  }, [account, address, ytAddress, enabled]);

  // Estimate the gas fee
  const feeEstimate = useEstimateFee(claimCall);

  // Fetch STRK price for USD conversion
  const { data: prices } = usePrices([STRK_TOKEN_ADDRESS], {
    enabled: enabled && feeEstimate.totalFee > 0n,
  });

  // Calculate the gas cost in USD
  const estimatedGasUsd = useMemo(() => {
    if (!prices || feeEstimate.totalFee === 0n) {
      return 0;
    }

    const strkPrice = getTokenPrice(STRK_TOKEN_ADDRESS, prices);
    const feeInStrk = fromWad(feeEstimate.totalFee).toNumber();

    return feeInStrk * strkPrice;
  }, [prices, feeEstimate.totalFee]);

  // Calculate the worthiness ratio
  const ratio = useMemo(() => {
    if (estimatedGasUsd === 0) {
      // If we can't estimate gas, assume it's worth claiming
      return Number.POSITIVE_INFINITY;
    }
    return claimableUsd / estimatedGasUsd;
  }, [claimableUsd, estimatedGasUsd]);

  const isWorthClaiming = ratio >= MIN_WORTHWHILE_RATIO;

  return {
    isWorthClaiming,
    claimableUsd,
    estimatedGasUsd,
    ratio,
    formattedGas: feeEstimate.formattedFee,
    isLoading: feeEstimate.isLoading,
    error: feeEstimate.error,
  };
}
