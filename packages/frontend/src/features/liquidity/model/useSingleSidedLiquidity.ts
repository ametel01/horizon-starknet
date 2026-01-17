'use client';

import { useAccount, useStarknet } from '@features/wallet';
import { getAddresses } from '@shared/config/addresses';
import { getDeadline } from '@shared/lib/deadline';
import { getERC20Contract, getRouterContract } from '@shared/starknet/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Call, uint256 } from 'starknet';

interface AddLiquiditySingleSyParams {
  marketAddress: string;
  syAddress: string;
  syAmount: bigint;
  minLpOut: bigint;
}

interface AddLiquiditySinglePtParams {
  marketAddress: string;
  ptAddress: string;
  ptAmount: bigint;
  minLpOut: bigint;
}

interface RemoveLiquiditySingleSyParams {
  marketAddress: string;
  syAddress: string;
  lpAmount: bigint;
  minSyOut: bigint;
}

interface LiquidityResult {
  transactionHash: string;
}

interface SingleSidedOptimisticContext {
  previousInputBalance: string | undefined;
  previousLpBalance: string | undefined;
}

interface UseAddLiquiditySingleSyReturn {
  addLiquiditySingleSy: (params: AddLiquiditySingleSyParams) => void;
  addLiquiditySingleSyAsync: (params: AddLiquiditySingleSyParams) => Promise<LiquidityResult>;
  isAdding: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

interface UseAddLiquiditySinglePtReturn {
  addLiquiditySinglePt: (params: AddLiquiditySinglePtParams) => void;
  addLiquiditySinglePtAsync: (params: AddLiquiditySinglePtParams) => Promise<LiquidityResult>;
  isAdding: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

interface UseRemoveLiquiditySingleSyReturn {
  removeLiquiditySingleSy: (params: RemoveLiquiditySingleSyParams) => void;
  removeLiquiditySingleSyAsync: (params: RemoveLiquiditySingleSyParams) => Promise<LiquidityResult>;
  isRemoving: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

export function useAddLiquiditySingleSy(): UseAddLiquiditySingleSyReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (params: AddLiquiditySingleSyParams): Promise<LiquidityResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      const routerAddress = addresses.router;
      const router = getRouterContract(account, network);

      const calls: Call[] = [];

      // Approve SY to router
      const syContract = getERC20Contract(params.syAddress, account);
      const approveSyCall = syContract.populate('approve', [
        routerAddress,
        uint256.bnToUint256(params.syAmount),
      ]);
      calls.push(approveSyCall);

      // Add liquidity single SY call
      const addLiquidityCall = router.populate('add_liquidity_single_sy', [
        params.marketAddress,
        address,
        uint256.bnToUint256(params.syAmount),
        uint256.bnToUint256(params.minLpOut),
        getDeadline(),
      ]);
      calls.push(addLiquidityCall);

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
      };
    },

    onMutate: async (params: AddLiquiditySingleSyParams): Promise<SingleSidedOptimisticContext> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.syAddress, address],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.marketAddress, address],
      });

      // Snapshot previous values
      const previousInputBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.syAddress,
        address,
      ]);
      const previousLpBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.marketAddress,
        address,
      ]);

      // Optimistically decrease SY balance
      if (previousInputBalance !== undefined) {
        const newBalance = BigInt(previousInputBalance) - params.syAmount;
        queryClient.setQueryData(
          ['token-balance', params.syAddress, address],
          (newBalance > 0n ? newBalance : 0n).toString()
        );
      }

      // Optimistically increase LP balance
      if (previousLpBalance !== undefined) {
        const newBalance = BigInt(previousLpBalance) + params.minLpOut;
        queryClient.setQueryData(
          ['token-balance', params.marketAddress, address],
          newBalance.toString()
        );
      }

      return { previousInputBalance, previousLpBalance };
    },

    onError: (_err, params, context) => {
      if (context) {
        if (context.previousInputBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.syAddress, address],
            context.previousInputBalance
          );
        }
        if (context.previousLpBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.marketAddress, address],
            context.previousLpBalance
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
    addLiquiditySingleSy: mutation.mutate,
    addLiquiditySingleSyAsync: mutation.mutateAsync,
    isAdding: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
    reset: mutation.reset,
  };
}

export function useAddLiquiditySinglePt(): UseAddLiquiditySinglePtReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (params: AddLiquiditySinglePtParams): Promise<LiquidityResult> => {
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
        uint256.bnToUint256(params.ptAmount),
      ]);
      calls.push(approvePtCall);

      // Add liquidity single PT call
      const addLiquidityCall = router.populate('add_liquidity_single_pt', [
        params.marketAddress,
        address,
        uint256.bnToUint256(params.ptAmount),
        uint256.bnToUint256(params.minLpOut),
        getDeadline(),
      ]);
      calls.push(addLiquidityCall);

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
      };
    },

    onMutate: async (params: AddLiquiditySinglePtParams): Promise<SingleSidedOptimisticContext> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.ptAddress, address],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.marketAddress, address],
      });

      // Snapshot previous values
      const previousInputBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.ptAddress,
        address,
      ]);
      const previousLpBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.marketAddress,
        address,
      ]);

      // Optimistically decrease PT balance
      if (previousInputBalance !== undefined) {
        const newBalance = BigInt(previousInputBalance) - params.ptAmount;
        queryClient.setQueryData(
          ['token-balance', params.ptAddress, address],
          (newBalance > 0n ? newBalance : 0n).toString()
        );
      }

      // Optimistically increase LP balance
      if (previousLpBalance !== undefined) {
        const newBalance = BigInt(previousLpBalance) + params.minLpOut;
        queryClient.setQueryData(
          ['token-balance', params.marketAddress, address],
          newBalance.toString()
        );
      }

      return { previousInputBalance, previousLpBalance };
    },

    onError: (_err, params, context) => {
      if (context) {
        if (context.previousInputBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.ptAddress, address],
            context.previousInputBalance
          );
        }
        if (context.previousLpBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.marketAddress, address],
            context.previousLpBalance
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
    addLiquiditySinglePt: mutation.mutate,
    addLiquiditySinglePtAsync: mutation.mutateAsync,
    isAdding: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
    reset: mutation.reset,
  };
}

/**
 * Build calls for adding single-sided SY liquidity (for gas estimation)
 */
export function buildAddLiquiditySingleSyCalls(
  routerAddress: string,
  userAddress: string,
  params: AddLiquiditySingleSyParams
): Call[] {
  const calls: Call[] = [];

  // Approve SY
  const u256Sy = uint256.bnToUint256(params.syAmount);
  calls.push({
    contractAddress: params.syAddress,
    entrypoint: 'approve',
    calldata: [routerAddress, u256Sy.low, u256Sy.high],
  });

  // Add liquidity single SY
  const u256MinLp = uint256.bnToUint256(params.minLpOut);
  calls.push({
    contractAddress: routerAddress,
    entrypoint: 'add_liquidity_single_sy',
    calldata: [
      params.marketAddress,
      userAddress,
      u256Sy.low,
      u256Sy.high,
      u256MinLp.low,
      u256MinLp.high,
      getDeadline().toString(),
    ],
  });

  return calls;
}

/**
 * Build calls for adding single-sided PT liquidity (for gas estimation)
 */
export function buildAddLiquiditySinglePtCalls(
  routerAddress: string,
  userAddress: string,
  params: AddLiquiditySinglePtParams
): Call[] {
  const calls: Call[] = [];

  // Approve PT
  const u256Pt = uint256.bnToUint256(params.ptAmount);
  calls.push({
    contractAddress: params.ptAddress,
    entrypoint: 'approve',
    calldata: [routerAddress, u256Pt.low, u256Pt.high],
  });

  // Add liquidity single PT
  const u256MinLp = uint256.bnToUint256(params.minLpOut);
  calls.push({
    contractAddress: routerAddress,
    entrypoint: 'add_liquidity_single_pt',
    calldata: [
      params.marketAddress,
      userAddress,
      u256Pt.low,
      u256Pt.high,
      u256MinLp.low,
      u256MinLp.high,
      getDeadline().toString(),
    ],
  });

  return calls;
}

export function useRemoveLiquiditySingleSy(): UseRemoveLiquiditySingleSyReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (params: RemoveLiquiditySingleSyParams): Promise<LiquidityResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      const routerAddress = addresses.router;
      const router = getRouterContract(account, network);

      const calls: Call[] = [];

      // Approve LP tokens (market) to router for burning
      const lpContract = getERC20Contract(params.marketAddress, account);
      const approveLpCall = lpContract.populate('approve', [
        routerAddress,
        uint256.bnToUint256(params.lpAmount),
      ]);
      calls.push(approveLpCall);

      // Remove liquidity single SY call
      const removeLiquidityCall = router.populate('remove_liquidity_single_sy', [
        params.marketAddress,
        address,
        uint256.bnToUint256(params.lpAmount),
        uint256.bnToUint256(params.minSyOut),
        getDeadline(),
      ]);
      calls.push(removeLiquidityCall);

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
      };
    },

    onMutate: async (
      params: RemoveLiquiditySingleSyParams
    ): Promise<SingleSidedOptimisticContext> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.marketAddress, address],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.syAddress, address],
      });

      // Snapshot previous values
      const previousLpBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.marketAddress,
        address,
      ]);
      const previousInputBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.syAddress,
        address,
      ]);

      // Optimistically decrease LP balance
      if (previousLpBalance !== undefined) {
        const newBalance = BigInt(previousLpBalance) - params.lpAmount;
        queryClient.setQueryData(
          ['token-balance', params.marketAddress, address],
          (newBalance > 0n ? newBalance : 0n).toString()
        );
      }

      // Optimistically increase SY balance
      if (previousInputBalance !== undefined) {
        const newBalance = BigInt(previousInputBalance) + params.minSyOut;
        queryClient.setQueryData(
          ['token-balance', params.syAddress, address],
          newBalance.toString()
        );
      }

      return { previousInputBalance, previousLpBalance };
    },

    onError: (_err, params, context) => {
      if (context) {
        if (context.previousLpBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.marketAddress, address],
            context.previousLpBalance
          );
        }
        if (context.previousInputBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.syAddress, address],
            context.previousInputBalance
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
    removeLiquiditySingleSy: mutation.mutate,
    removeLiquiditySingleSyAsync: mutation.mutateAsync,
    isRemoving: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
    reset: mutation.reset,
  };
}

/**
 * Build calls for removing single-sided SY liquidity (for gas estimation)
 */
export function buildRemoveLiquiditySingleSyCalls(
  routerAddress: string,
  userAddress: string,
  params: RemoveLiquiditySingleSyParams
): Call[] {
  const calls: Call[] = [];

  // Approve LP tokens for burning
  const u256Lp = uint256.bnToUint256(params.lpAmount);
  calls.push({
    contractAddress: params.marketAddress,
    entrypoint: 'approve',
    calldata: [routerAddress, u256Lp.low, u256Lp.high],
  });

  // Remove liquidity single SY
  const u256MinSy = uint256.bnToUint256(params.minSyOut);
  calls.push({
    contractAddress: routerAddress,
    entrypoint: 'remove_liquidity_single_sy',
    calldata: [
      params.marketAddress,
      userAddress,
      u256Lp.low,
      u256Lp.high,
      u256MinSy.low,
      u256MinSy.high,
      getDeadline().toString(),
    ],
  });

  return calls;
}
