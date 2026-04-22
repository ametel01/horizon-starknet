'use client';

import { useAccount } from '@features/wallet';
import { useTransaction } from '@shared/hooks/useTransaction';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { Call } from 'starknet';

interface UseClaimInterestAndRewardsReturn {
  claim: () => Promise<void>;
  status: 'idle' | 'signing' | 'pending' | 'success' | 'error';
  txHash: string | null;
  error: Error | null;
  isLoading: boolean;
  reset: () => void;
  buildClaimCall: () => Call | null;
}

interface UseClaimInterestAndRewardsOptions {
  /** Whether to claim interest (default: true) */
  doInterest?: boolean;
  /** Whether to claim rewards (default: true) */
  doRewards?: boolean;
}

/**
 * Hook to claim both interest and rewards from a YT contract in a single transaction.
 *
 * The redeem_due_interest_and_rewards function combines interest redemption
 * and reward claiming into one call, saving gas compared to calling them separately.
 *
 * @param ytAddress - The YT contract address
 * @param options - Optional flags to control what gets claimed
 * @returns Claim mutation state and methods
 */
export function useClaimInterestAndRewards(
  ytAddress: string | undefined,
  options: UseClaimInterestAndRewardsOptions = {}
): UseClaimInterestAndRewardsReturn {
  const { doInterest = true, doRewards = true } = options;
  const { address: userAddress } = useAccount();
  const { execute, status, txHash, error, isLoading, reset } = useTransaction();
  const queryClient = useQueryClient();

  // Build the combined claim call for gas estimation or direct execution
  const buildClaimCall = useCallback((): Call | null => {
    if (!ytAddress || !userAddress) return null;

    return {
      contractAddress: ytAddress,
      entrypoint: 'redeem_due_interest_and_rewards',
      calldata: [userAddress, doInterest, doRewards],
    };
  }, [ytAddress, userAddress, doInterest, doRewards]);

  // Execute the combined claim transaction
  const claim = useCallback(async (): Promise<void> => {
    const call = buildClaimCall();
    if (!call) {
      return;
    }

    const result = await execute([call]);

    if (result) {
      // Invalidate all relevant queries to refetch updated state
      await Promise.all([
        // Interest-related queries
        queryClient.invalidateQueries({ queryKey: ['positions'] }),
        queryClient.invalidateQueries({ queryKey: ['user-yield'] }),
        // Rewards-related queries
        queryClient.invalidateQueries({ queryKey: ['yt-rewards', 'accrued', ytAddress] }),
        // Token balances (both interest and reward tokens may have changed)
        queryClient.invalidateQueries({ queryKey: ['token-balance'] }),
      ]);
    }
  }, [buildClaimCall, execute, queryClient, ytAddress]);

  return useMemo(
    () => ({
      claim,
      status,
      txHash,
      error,
      isLoading,
      reset,
      buildClaimCall,
    }),
    [claim, status, txHash, error, isLoading, reset, buildClaimCall]
  );
}

/**
 * Hook to claim interest and rewards from multiple YT contracts in a single multicall.
 *
 * Useful when a user has positions in multiple YT tokens and wants to claim
 * all interest and rewards at once to save on transaction fees.
 *
 * @param ytAddresses - Array of YT contract addresses
 * @param options - Optional flags to control what gets claimed
 * @returns Claim all mutation state and methods
 */
export function useClaimAllInterestAndRewards(
  ytAddresses: string[],
  options: UseClaimInterestAndRewardsOptions = {}
): UseClaimInterestAndRewardsReturn {
  const { doInterest = true, doRewards = true } = options;
  const { address: userAddress } = useAccount();
  const { execute, status, txHash, error, isLoading, reset } = useTransaction();
  const queryClient = useQueryClient();

  // Build the first claim call for interface compatibility
  const buildClaimCall = useCallback((): Call | null => {
    const firstAddress = ytAddresses[0];
    if (!userAddress || !firstAddress) return null;

    return {
      contractAddress: firstAddress,
      entrypoint: 'redeem_due_interest_and_rewards',
      calldata: [userAddress, doInterest, doRewards],
    };
  }, [ytAddresses, userAddress, doInterest, doRewards]);

  // Build all claim calls for multicall execution
  const buildAllClaimCalls = useCallback((): Call[] => {
    if (!userAddress || ytAddresses.length === 0) return [];

    return ytAddresses.map((ytAddress) => ({
      contractAddress: ytAddress,
      entrypoint: 'redeem_due_interest_and_rewards',
      calldata: [userAddress, doInterest, doRewards],
    }));
  }, [ytAddresses, userAddress, doInterest, doRewards]);

  // Execute all claims in a single multicall
  const claim = useCallback(async (): Promise<void> => {
    const calls = buildAllClaimCalls();
    if (calls.length === 0) {
      return;
    }

    const result = await execute(calls);

    if (result) {
      // Invalidate all relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['positions'] }),
        queryClient.invalidateQueries({ queryKey: ['user-yield'] }),
        queryClient.invalidateQueries({ queryKey: ['yt-rewards', 'accrued'] }),
        queryClient.invalidateQueries({ queryKey: ['token-balance'] }),
      ]);
    }
  }, [buildAllClaimCalls, execute, queryClient]);

  return useMemo(
    () => ({
      claim,
      status,
      txHash,
      error,
      isLoading,
      reset,
      buildClaimCall,
    }),
    [claim, status, txHash, error, isLoading, reset, buildClaimCall]
  );
}
