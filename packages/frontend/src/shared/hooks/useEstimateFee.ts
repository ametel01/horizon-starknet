'use client';

import { getTokenPrice, usePrices } from '@features/price';
import { useAccount } from '@features/wallet';
import { fromWad } from '@shared/math/wad';
import { useEffect, useMemo, useState } from 'react';
import type { Call } from 'starknet';

/**
 * STRK native token address for gas price conversion
 */
const STRK_TOKEN_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

/**
 * Fee estimate result with formatted values
 */
export interface FeeEstimate {
  /** Total fee in wei (bigint) */
  totalFee: bigint;
  /** Total fee as a formatted string (e.g., "0.0001 STRK") */
  formattedFee: string;
  /** Total fee in USD (e.g., "$0.02") */
  formattedFeeUsd: string;
  /** Whether the estimate is loading */
  isLoading: boolean;
  /** Error if estimation failed */
  error: Error | null;
}

/**
 * Hook to estimate transaction fees for a set of calls
 *
 * Implements Jakob's Law by showing gas estimates like other DeFi apps.
 * Uses debouncing to avoid excessive API calls during input changes.
 *
 * @param calls - Array of calls to estimate, or null to skip estimation
 * @param debounceMs - Debounce delay in milliseconds (default: 500)
 */
/**
 * Internal state for the fee estimate (without USD)
 */
interface FeeEstimateState {
  totalFee: bigint;
  formattedFee: string;
  isLoading: boolean;
  error: Error | null;
}

export function useEstimateFee(calls: Call[] | null, debounceMs = 500): FeeEstimate {
  const { account } = useAccount();
  const [estimate, setEstimate] = useState<FeeEstimateState>({
    totalFee: BigInt(0),
    formattedFee: '',
    isLoading: false,
    error: null,
  });

  // Fetch STRK price for USD conversion
  const { data: prices } = usePrices([STRK_TOKEN_ADDRESS], {
    enabled: estimate.totalFee > 0n,
    refetchInterval: 60000,
  });

  useEffect(() => {
    // Skip if no calls or no account
    if (!calls || calls.length === 0 || !account) {
      setEstimate({
        totalFee: BigInt(0),
        formattedFee: '',
        isLoading: false,
        error: null,
      });
      return;
    }

    // Start loading
    setEstimate((prev) => ({ ...prev, isLoading: true, error: null }));

    // Debounce the estimation
    const timeoutId = setTimeout(() => {
      void (async () => {
        try {
          // Estimate fee using Starknet account
          const feeEstimate = await account.estimateInvokeFee(calls);

          // The overall_fee includes gas + data availability costs
          const totalFee = feeEstimate.overall_fee;

          // Format the fee (Starknet fees are in wei, 18 decimals)
          const feeNumber = fromWad(totalFee).toNumber();
          const formattedFee =
            feeNumber < 0.0001 ? '< 0.0001 STRK' : `~${feeNumber.toFixed(4)} STRK`;

          setEstimate({
            totalFee,
            formattedFee,
            isLoading: false,
            error: null,
          });
        } catch (err) {
          setEstimate({
            totalFee: BigInt(0),
            formattedFee: '',
            isLoading: false,
            error: err instanceof Error ? err : new Error('Failed to estimate fee'),
          });
        }
      })();
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [calls, account, debounceMs]);

  // Calculate USD value from STRK price
  const formattedFeeUsd = useMemo(() => {
    if (estimate.totalFee === 0n || !prices) {
      return '';
    }

    const strkPrice = getTokenPrice(STRK_TOKEN_ADDRESS, prices);
    if (strkPrice === 0) {
      return '';
    }

    const feeInStrk = fromWad(estimate.totalFee).toNumber();
    const feeInUsd = feeInStrk * strkPrice;

    if (feeInUsd < 0.01) {
      return '< $0.01';
    }

    return `$${feeInUsd.toFixed(2)}`;
  }, [estimate.totalFee, prices]);

  return {
    ...estimate,
    formattedFeeUsd,
  };
}
