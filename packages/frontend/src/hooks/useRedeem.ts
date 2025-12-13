'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Call, uint256 } from 'starknet';

import { getAddresses } from '@/lib/constants/addresses';
import { getERC20Contract, getRouterContract } from '@/lib/starknet/contracts';

import { useAccount } from './useAccount';
import { useStarknet } from './useStarknet';

interface RedeemPyToSyParams {
  ytAddress: string;
  ptAddress: string;
  amount: bigint;
  minSyOut: bigint;
}

interface RedeemPtPostExpiryParams {
  ytAddress: string;
  ptAddress: string;
  amount: bigint;
  minSyOut: bigint;
}

interface RedeemResult {
  transactionHash: string;
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
      // Router.redeem_py_to_sy(yt, receiver, amount_py_in, min_sy_out)
      const redeemCall = router.populate('redeem_py_to_sy', [
        params.ytAddress,
        address,
        uint256.bnToUint256(params.amount),
        uint256.bnToUint256(params.minSyOut),
      ]);
      calls.push(redeemCall);

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
      };
    },
    onSuccess: () => {
      // Invalidate relevant queries
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
      // Router.redeem_pt_post_expiry(yt, receiver, amount_pt_in, min_sy_out)
      const redeemCall = router.populate('redeem_pt_post_expiry', [
        params.ytAddress,
        address,
        uint256.bnToUint256(params.amount),
        uint256.bnToUint256(params.minSyOut),
      ]);
      calls.push(redeemCall);

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
      };
    },
    onSuccess: () => {
      // Invalidate relevant queries
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
