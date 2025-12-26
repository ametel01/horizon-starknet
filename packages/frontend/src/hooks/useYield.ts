'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Call } from 'starknet';

import { getYTContract } from '@shared/starknet/contracts';

import { useAccount } from './useAccount';

interface ClaimYieldParams {
  ytAddress: string;
}

interface ClaimYieldResult {
  transactionHash: string;
}

interface UseClaimYieldReturn {
  claimYield: (params: ClaimYieldParams) => void;
  claimYieldAsync: (params: ClaimYieldParams) => Promise<ClaimYieldResult>;
  isClaiming: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

export function useClaimYield(): UseClaimYieldReturn {
  const { account, address } = useAccount();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: ClaimYieldParams): Promise<ClaimYieldResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      const ytContract = getYTContract(params.ytAddress, account);

      // Call redeem_due_interest on the YT contract
      const claimCall = ytContract.populate('redeem_due_interest', [address]);

      const calls: Call[] = [claimCall];

      // Execute the call
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
      };
    },
    onSuccess: () => {
      // Invalidate relevant queries
      void queryClient.invalidateQueries({ queryKey: ['positions'] });
      void queryClient.invalidateQueries({ queryKey: ['token-balance'] });
    },
  });

  return {
    claimYield: mutation.mutate,
    claimYieldAsync: mutation.mutateAsync,
    isClaiming: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
    reset: mutation.reset,
  };
}

interface ClaimAllYieldParams {
  ytAddresses: string[];
}

interface UseClaimAllYieldReturn {
  claimAllYield: (params: ClaimAllYieldParams) => void;
  claimAllYieldAsync: (params: ClaimAllYieldParams) => Promise<ClaimYieldResult>;
  isClaiming: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

/**
 * Hook to claim yield from multiple YT tokens in a single multicall
 */
export function useClaimAllYield(): UseClaimAllYieldReturn {
  const { account, address } = useAccount();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: ClaimAllYieldParams): Promise<ClaimYieldResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      if (params.ytAddresses.length === 0) {
        throw new Error('No YT addresses provided');
      }

      // Build claim calls for each YT
      const calls: Call[] = params.ytAddresses.map((ytAddress) => {
        const ytContract = getYTContract(ytAddress, account);
        return ytContract.populate('redeem_due_interest', [address]);
      });

      // Execute all claims in a single multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
      };
    },
    onSuccess: () => {
      // Invalidate relevant queries
      void queryClient.invalidateQueries({ queryKey: ['positions'] });
      void queryClient.invalidateQueries({ queryKey: ['token-balance'] });
    },
  });

  return {
    claimAllYield: mutation.mutate,
    claimAllYieldAsync: mutation.mutateAsync,
    isClaiming: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
    reset: mutation.reset,
  };
}
