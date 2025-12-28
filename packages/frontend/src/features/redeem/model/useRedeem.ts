'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Call, uint256 } from 'starknet';

import { useAccount, useStarknet } from '@features/wallet';
import { getAddresses } from '@shared/config/addresses';
import { getDeadline } from '@shared/lib/deadline';
import { getERC20Contract, getRouterContract } from '@shared/starknet/contracts';

interface RedeemPyToSyParams {
  ytAddress: string;
  ptAddress: string;
  /** SY address for optimistic UI updates */
  syAddress: string;
  amount: bigint;
  minSyOut: bigint;
}

interface RedeemPtPostExpiryParams {
  ytAddress: string;
  ptAddress: string;
  /** SY address for optimistic UI updates */
  syAddress: string;
  amount: bigint;
  minSyOut: bigint;
}

interface RedeemResult {
  transactionHash: string;
}

/**
 * Context for optimistic update rollback
 */
interface RedeemOptimisticContext {
  previousPtBalance: string | undefined;
  previousYtBalance: string | undefined;
  previousSyBalance: string | undefined;
}

interface UseRedeemPyReturn {
  redeemPy: (params: RedeemPyToSyParams) => void;
  redeemPyAsync: (params: RedeemPyToSyParams) => Promise<RedeemResult>;
  isRedeeming: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

/**
 * Hook to redeem PT + YT back to SY (before expiry)
 */
export function useRedeemPy(): UseRedeemPyReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (params: RedeemPyToSyParams): Promise<RedeemResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      const routerAddress = addresses.router;
      const router = getRouterContract(account, network);

      const calls: Call[] = [];

      // Approve PT to router
      const ptContract = getERC20Contract(params.ptAddress, account);
      const approvePtCall = ptContract.populate('approve', [
        routerAddress,
        uint256.bnToUint256(params.amount),
      ]);
      calls.push(approvePtCall);

      // Approve YT to router (same amount as PT)
      const ytContract = getERC20Contract(params.ytAddress, account);
      const approveYtCall = ytContract.populate('approve', [
        routerAddress,
        uint256.bnToUint256(params.amount),
      ]);
      calls.push(approveYtCall);

      // Redeem PT + YT to SY
      // Router.redeem_py_to_sy(yt, receiver, amount_py_in, min_sy_out, deadline)
      const redeemCall = router.populate('redeem_py_to_sy', [
        params.ytAddress,
        address,
        uint256.bnToUint256(params.amount),
        uint256.bnToUint256(params.minSyOut),
        getDeadline(),
      ]);
      calls.push(redeemCall);

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
      };
    },

    /**
     * Optimistic UI: Update balances immediately (Doherty Threshold)
     */
    onMutate: async (params: RedeemPyToSyParams): Promise<RedeemOptimisticContext> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.ptAddress, address],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.ytAddress, address],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.syAddress, address],
      });

      // Snapshot previous values
      const previousPtBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.ptAddress,
        address,
      ]);
      const previousYtBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.ytAddress,
        address,
      ]);
      const previousSyBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.syAddress,
        address,
      ]);

      // Optimistically decrease PT balance
      if (previousPtBalance !== undefined) {
        const newBalance = BigInt(previousPtBalance) - params.amount;
        queryClient.setQueryData(
          ['token-balance', params.ptAddress, address],
          (newBalance > 0n ? newBalance : 0n).toString()
        );
      }

      // Optimistically decrease YT balance
      if (previousYtBalance !== undefined) {
        const newBalance = BigInt(previousYtBalance) - params.amount;
        queryClient.setQueryData(
          ['token-balance', params.ytAddress, address],
          (newBalance > 0n ? newBalance : 0n).toString()
        );
      }

      // Optimistically increase SY balance
      if (previousSyBalance !== undefined) {
        const newBalance = BigInt(previousSyBalance) + params.minSyOut;
        queryClient.setQueryData(
          ['token-balance', params.syAddress, address],
          newBalance.toString()
        );
      }

      return { previousPtBalance, previousYtBalance, previousSyBalance };
    },

    /**
     * Rollback on error
     */
    onError: (_err, params, context) => {
      if (context) {
        if (context.previousPtBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.ptAddress, address],
            context.previousPtBalance
          );
        }
        if (context.previousYtBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.ytAddress, address],
            context.previousYtBalance
          );
        }
        if (context.previousSyBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.syAddress, address],
            context.previousSyBalance
          );
        }
      }
    },

    /**
     * Always refetch to get actual blockchain state
     */
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['positions'] });
      void queryClient.invalidateQueries({ queryKey: ['token-balance'] });
      void queryClient.invalidateQueries({ queryKey: ['market'] });
    },
  });

  return {
    redeemPy: mutation.mutate,
    redeemPyAsync: mutation.mutateAsync,
    isRedeeming: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
    reset: mutation.reset,
  };
}

interface UseRedeemPtPostExpiryReturn {
  redeemPtPostExpiry: (params: RedeemPtPostExpiryParams) => void;
  redeemPtPostExpiryAsync: (params: RedeemPtPostExpiryParams) => Promise<RedeemResult>;
  isRedeeming: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

/**
 * Hook to redeem PT to underlying asset after expiry
 */
export function useRedeemPtPostExpiry(): UseRedeemPtPostExpiryReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (params: RedeemPtPostExpiryParams): Promise<RedeemResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      const routerAddress = addresses.router;
      const router = getRouterContract(account, network);

      const calls: Call[] = [];

      // Approve PT to router
      const ptContract = getERC20Contract(params.ptAddress, account);
      const approvePtCall = ptContract.populate('approve', [
        routerAddress,
        uint256.bnToUint256(params.amount),
      ]);
      calls.push(approvePtCall);

      // Redeem PT post expiry
      // Router.redeem_pt_post_expiry(yt, receiver, amount_pt_in, min_sy_out, deadline)
      const redeemCall = router.populate('redeem_pt_post_expiry', [
        params.ytAddress,
        address,
        uint256.bnToUint256(params.amount),
        uint256.bnToUint256(params.minSyOut),
        getDeadline(),
      ]);
      calls.push(redeemCall);

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
      };
    },

    /**
     * Optimistic UI: Update balances immediately (Doherty Threshold)
     * Post-expiry redemption only burns PT (YT is worthless after expiry)
     */
    onMutate: async (params: RedeemPtPostExpiryParams): Promise<RedeemOptimisticContext> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.ptAddress, address],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.syAddress, address],
      });

      // Snapshot previous values
      const previousPtBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.ptAddress,
        address,
      ]);
      const previousSyBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.syAddress,
        address,
      ]);

      // Optimistically decrease PT balance
      if (previousPtBalance !== undefined) {
        const newBalance = BigInt(previousPtBalance) - params.amount;
        queryClient.setQueryData(
          ['token-balance', params.ptAddress, address],
          (newBalance > 0n ? newBalance : 0n).toString()
        );
      }

      // Optimistically increase SY balance
      if (previousSyBalance !== undefined) {
        const newBalance = BigInt(previousSyBalance) + params.minSyOut;
        queryClient.setQueryData(
          ['token-balance', params.syAddress, address],
          newBalance.toString()
        );
      }

      // YT balance unchanged (already worthless post-expiry)
      return {
        previousPtBalance,
        previousYtBalance: undefined,
        previousSyBalance,
      };
    },

    /**
     * Rollback on error
     */
    onError: (_err, params, context) => {
      if (context) {
        if (context.previousPtBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.ptAddress, address],
            context.previousPtBalance
          );
        }
        if (context.previousSyBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.syAddress, address],
            context.previousSyBalance
          );
        }
      }
    },

    /**
     * Always refetch to get actual blockchain state
     */
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['positions'] });
      void queryClient.invalidateQueries({ queryKey: ['token-balance'] });
      void queryClient.invalidateQueries({ queryKey: ['market'] });
    },
  });

  return {
    redeemPtPostExpiry: mutation.mutate,
    redeemPtPostExpiryAsync: mutation.mutateAsync,
    isRedeeming: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
    reset: mutation.reset,
  };
}

/**
 * Calculate minimum SY output with slippage protection for redemption
 * For PT redemption, 1 PT should equal approximately 1 SY at the current exchange rate
 */
export function calculateMinSyOut(amount: bigint, slippageBps: number): bigint {
  // Apply slippage to expected 1:1 redemption
  const slippageMultiplier = BigInt(10000 - slippageBps);
  return (amount * slippageMultiplier) / BigInt(10000);
}
