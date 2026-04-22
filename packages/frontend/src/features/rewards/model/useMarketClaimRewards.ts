'use client';

import { useAccount } from '@features/wallet';
import { useTransaction } from '@shared/hooks/useTransaction';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { Call } from 'starknet';

interface UseMarketClaimRewardsReturn {
  claim: () => Promise<void>;
  status: 'idle' | 'signing' | 'pending' | 'success' | 'error';
  txHash: string | null;
  error: Error | null;
  isLoading: boolean;
  reset: () => void;
  buildClaimCall: () => Call | null;
}

/**
 * Hook to claim accrued rewards from a Market LP position.
 *
 * The claim_rewards function transfers all pending reward tokens to the user
 * and resets their accrued amounts. The function is permissionless - anyone
 * can call it on behalf of any user (rewards go to the specified user address).
 *
 * @param marketAddress - The Market contract address
 * @returns Claim mutation state and methods
 */
export function useMarketClaimRewards(
  marketAddress: string | undefined
): UseMarketClaimRewardsReturn {
  const { address: userAddress } = useAccount();
  const { execute, status, txHash, error, isLoading, reset } = useTransaction();
  const queryClient = useQueryClient();

  // Build the claim call for gas estimation or direct execution
  const buildClaimCall = useCallback((): Call | null => {
    if (!marketAddress || !userAddress) return null;

    return {
      contractAddress: marketAddress,
      entrypoint: 'claim_rewards',
      calldata: [userAddress],
    };
  }, [marketAddress, userAddress]);

  // Execute the claim transaction
  const claim = useCallback(async (): Promise<void> => {
    const call = buildClaimCall();
    if (!call) {
      return;
    }

    const result = await execute([call]);

    if (result) {
      // Invalidate rewards queries to refetch updated state
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['market-rewards', 'accrued', marketAddress] }),
        queryClient.invalidateQueries({ queryKey: ['token-balance'] }), // Reward token balances changed
      ]);
    }
  }, [buildClaimCall, execute, queryClient, marketAddress]);

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
 * Hook to claim rewards from multiple Market LP positions in a single multicall.
 *
 * Useful when a user has LP positions in multiple markets and wants
 * to claim all rewards at once to save on transaction fees.
 *
 * @param marketAddresses - Array of Market contract addresses
 * @returns Claim all mutation state and methods
 */
export function useClaimAllMarketRewards(marketAddresses: string[]): UseMarketClaimRewardsReturn {
  const { address: userAddress } = useAccount();
  const { execute, status, txHash, error, isLoading, reset } = useTransaction();
  const queryClient = useQueryClient();

  // Build claim calls for all Market addresses
  const buildClaimCall = useCallback((): Call | null => {
    // Return first call for interface compatibility (buildClaimCall signature)
    const firstAddress = marketAddresses[0];
    if (!userAddress || !firstAddress) return null;

    return {
      contractAddress: firstAddress,
      entrypoint: 'claim_rewards',
      calldata: [userAddress],
    };
  }, [marketAddresses, userAddress]);

  // Build all claim calls for multicall execution
  const buildAllClaimCalls = useCallback((): Call[] => {
    if (!userAddress || marketAddresses.length === 0) return [];

    return marketAddresses.map((marketAddress) => ({
      contractAddress: marketAddress,
      entrypoint: 'claim_rewards',
      calldata: [userAddress],
    }));
  }, [marketAddresses, userAddress]);

  // Execute all claims in a single multicall
  const claim = useCallback(async (): Promise<void> => {
    const calls = buildAllClaimCalls();
    if (calls.length === 0) {
      return;
    }

    const result = await execute(calls);

    if (result) {
      // Invalidate all market rewards queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['market-rewards', 'accrued'] }),
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
