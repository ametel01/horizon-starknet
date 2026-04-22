'use client';

import { useAccount, useStarknet } from '@features/wallet';
import { getDeadline } from '@shared/lib/deadline';
import { getMarketContract, getRouterContract } from '@shared/starknet/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Call, uint256 } from 'starknet';

interface RolloverLpParams {
  marketOldAddress: string;
  marketNewAddress: string;
  lpToRollover: bigint;
  minLpOut: bigint;
}

interface RolloverLpResult {
  transactionHash: string;
}

interface RolloverLpOptimisticContext {
  previousOldLpBalance: string | undefined;
  previousNewLpBalance: string | undefined;
}

interface UseRolloverLpReturn {
  rolloverLp: (params: RolloverLpParams) => void;
  rolloverLpAsync: (params: RolloverLpParams) => Promise<RolloverLpResult>;
  isRollingOver: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

export function useRolloverLp(): UseRolloverLpReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: RolloverLpParams): Promise<RolloverLpResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      const router = getRouterContract(account, network);

      const calls: Call[] = [];

      // Approve old market LP tokens to router
      const oldMarketContract = getMarketContract(params.marketOldAddress, account);
      const approveLpCall = oldMarketContract.populate('approve', [
        router.address,
        uint256.bnToUint256(params.lpToRollover),
      ]);
      calls.push(approveLpCall);

      // Rollover LP call
      const rolloverLpCall = router.populate('rollover_lp', [
        params.marketOldAddress,
        params.marketNewAddress,
        uint256.bnToUint256(params.lpToRollover),
        uint256.bnToUint256(params.minLpOut),
        getDeadline(),
      ]);
      calls.push(rolloverLpCall);

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
      };
    },

    onMutate: async (params: RolloverLpParams): Promise<RolloverLpOptimisticContext> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.marketOldAddress, address],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.marketNewAddress, address],
      });

      // Snapshot previous values
      const previousOldLpBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.marketOldAddress,
        address,
      ]);
      const previousNewLpBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.marketNewAddress,
        address,
      ]);

      // Optimistically decrease old market LP balance
      if (previousOldLpBalance !== undefined) {
        const newBalance = BigInt(previousOldLpBalance) - params.lpToRollover;
        queryClient.setQueryData(
          ['token-balance', params.marketOldAddress, address],
          (newBalance > 0n ? newBalance : 0n).toString()
        );
      }

      // Optimistically increase new market LP balance
      if (previousNewLpBalance !== undefined) {
        const newBalance = BigInt(previousNewLpBalance) + params.minLpOut;
        queryClient.setQueryData(
          ['token-balance', params.marketNewAddress, address],
          newBalance.toString()
        );
      }

      return { previousOldLpBalance, previousNewLpBalance };
    },

    onError: (_err, params, context) => {
      if (context) {
        if (context.previousOldLpBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.marketOldAddress, address],
            context.previousOldLpBalance
          );
        }
        if (context.previousNewLpBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.marketNewAddress, address],
            context.previousNewLpBalance
          );
        }
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['market'] });
      void queryClient.invalidateQueries({ queryKey: ['token-balance'] });
      void queryClient.invalidateQueries({ queryKey: ['token-allowance'] });
      void queryClient.invalidateQueries({ queryKey: ['lp-balance'] });
    },
  });

  return {
    rolloverLp: mutation.mutate,
    rolloverLpAsync: mutation.mutateAsync,
    isRollingOver: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
    reset: mutation.reset,
  };
}

/**
 * Build calls for rolling over LP (for gas estimation)
 */
export function buildRolloverLpCalls(routerAddress: string, params: RolloverLpParams): Call[] {
  const calls: Call[] = [];

  // Approve old market LP tokens
  const u256Lp = uint256.bnToUint256(params.lpToRollover);
  calls.push({
    contractAddress: params.marketOldAddress,
    entrypoint: 'approve',
    calldata: [routerAddress, u256Lp.low, u256Lp.high],
  });

  // Rollover LP
  const u256MinLp = uint256.bnToUint256(params.minLpOut);
  calls.push({
    contractAddress: routerAddress,
    entrypoint: 'rollover_lp',
    calldata: [
      params.marketOldAddress,
      params.marketNewAddress,
      u256Lp.low,
      u256Lp.high,
      u256MinLp.low,
      u256MinLp.high,
      getDeadline().toString(),
    ],
  });

  return calls;
}
