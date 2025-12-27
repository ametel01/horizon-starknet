'use client';

import { useEffect, useState } from 'react';
import type { Call } from 'starknet';

import { useAccount } from '@features/wallet';
import { fromWad } from '@shared/math/wad';

/**
 * Fee estimate result with formatted values
 */
export interface FeeEstimate {
  /** Total fee in wei (bigint) */
  totalFee: bigint;
  /** Total fee as a formatted string (e.g., "0.0001 STRK") */
  formattedFee: string;
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
export function useEstimateFee(calls: Call[] | null, debounceMs = 500): FeeEstimate {
  const { account } = useAccount();
  const [estimate, setEstimate] = useState<FeeEstimate>({
    totalFee: BigInt(0),
    formattedFee: '',
    isLoading: false,
    error: null,
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

  return estimate;
}
