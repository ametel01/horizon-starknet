'use client';

import { useAccount } from '@features/wallet';
import { useTransaction } from '@shared/hooks/useTransaction';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { Call } from 'starknet';

interface UseYTClaimRewardsReturn {
  claim: () => Promise<void>;
  status: 'idle' | 'signing' | 'pending' | 'success' | 'error';
  txHash: string | null;
  error: Error | null;
  isLoading: boolean;
  reset: () => void;
  buildClaimCall: () => Call | null;
}

/**
 * Hook to claim rewards from multiple YT contracts in a single multicall.
 *
 * Useful when a user has positions in multiple YT tokens and wants
 * to claim all rewards at once to save on transaction fees.
 *
 * @param ytAddresses - Array of YT contract addresses
 * @returns Claim all mutation state and methods
 */
export function useClaimAllYTRewards(ytAddresses: string[]): UseYTClaimRewardsReturn {
  const { address: userAddress } = useAccount();
  const { execute, status, txHash, error, isLoading, reset } = useTransaction();
  const queryClient = useQueryClient();

  // Build claim calls for all YT addresses
  const buildClaimCall = useCallback((): Call | null => {
    // Return first call for interface compatibility (buildClaimCall signature)
    const firstAddress = ytAddresses[0];
    if (!userAddress || !firstAddress) return null;

    return {
      contractAddress: firstAddress,
      entrypoint: 'claim_rewards',
      calldata: [userAddress],
    };
  }, [ytAddresses, userAddress]);

  // Build all claim calls for multicall execution
  const buildAllClaimCalls = useCallback((): Call[] => {
    if (!userAddress || ytAddresses.length === 0) return [];

    return ytAddresses.map((ytAddress) => ({
      contractAddress: ytAddress,
      entrypoint: 'claim_rewards',
      calldata: [userAddress],
    }));
  }, [ytAddresses, userAddress]);

  // Execute all claims in a single multicall
  const claim = useCallback(async (): Promise<void> => {
    const calls = buildAllClaimCalls();
    if (calls.length === 0) {
      return;
    }

    const result = await execute(calls);

    if (result) {
      // Invalidate all YT rewards queries
      await Promise.all([
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
