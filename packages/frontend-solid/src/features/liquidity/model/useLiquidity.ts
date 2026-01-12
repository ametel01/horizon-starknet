import { getAddresses } from '@shared/config/addresses';
import { getDeadline } from '@shared/lib/deadline';
import { getERC20Contract, getMarketContract, getRouterContract } from '@shared/starknet/contracts';
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { createMemo, type Accessor } from 'solid-js';
import { type Call, uint256 } from 'starknet';

import { useAccount, useStarknet } from '@/features/wallet';

// ==================== Types ====================

export interface AddLiquidityParams {
  marketAddress: string;
  syAddress: string;
  ptAddress: string;
  syAmount: bigint;
  ptAmount: bigint;
  minLpOut: bigint;
}

export interface RemoveLiquidityParams {
  marketAddress: string;
  /** SY token address (for optimistic UI updates) */
  syAddress: string;
  /** PT token address (for optimistic UI updates) */
  ptAddress: string;
  lpAmount: bigint;
  minSyOut: bigint;
  minPtOut: bigint;
}

export interface LiquidityResult {
  transactionHash: string;
}

interface AddLiquidityOptimisticContext {
  previousSyBalance: string | undefined;
  previousPtBalance: string | undefined;
  previousLpBalance: string | undefined;
}

interface RemoveLiquidityOptimisticContext {
  previousSyBalance: string | undefined;
  previousPtBalance: string | undefined;
  previousLpBalance: string | undefined;
}

export interface UseAddLiquidityReturn {
  addLiquidity: (params: AddLiquidityParams) => void;
  addLiquidityAsync: (params: AddLiquidityParams) => Promise<LiquidityResult>;
  isAdding: Accessor<boolean>;
  isSuccess: Accessor<boolean>;
  isError: Accessor<boolean>;
  error: Accessor<Error | null>;
  transactionHash: Accessor<string | undefined>;
  reset: () => void;
  buildAddLiquidityCalls: (params: AddLiquidityParams) => Call[];
}

export interface UseRemoveLiquidityReturn {
  removeLiquidity: (params: RemoveLiquidityParams) => void;
  removeLiquidityAsync: (params: RemoveLiquidityParams) => Promise<LiquidityResult>;
  isRemoving: Accessor<boolean>;
  isSuccess: Accessor<boolean>;
  isError: Accessor<boolean>;
  error: Accessor<Error | null>;
  transactionHash: Accessor<string | undefined>;
  reset: () => void;
  buildRemoveLiquidityCalls: (params: RemoveLiquidityParams) => Call[];
}

// ==================== useAddLiquidity Hook ====================

/**
 * Hook for adding liquidity to a Horizon Protocol market.
 * Deposits SY and PT tokens to receive LP tokens.
 *
 * Uses @tanstack/solid-query createMutation with:
 * - Optimistic balance updates for instant perceived response
 * - Automatic rollback on error
 * - Cache invalidation on settlement
 *
 * @returns Object with reactive accessors for add liquidity state and mutation functions
 */
export function useAddLiquidity(): UseAddLiquidityReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();

  /**
   * Build the calls array for adding liquidity
   * Can be used for gas estimation before executing
   */
  const buildAddLiquidityCalls = (params: AddLiquidityParams): Call[] => {
    const currentAccount = account();
    const currentAddress = address();

    if (!currentAccount || !currentAddress) {
      throw new Error('Wallet not connected');
    }

    const addresses = getAddresses(network);
    const routerAddress = addresses.router;
    const router = getRouterContract(currentAccount, network);

    const calls: Call[] = [];

    // Approve SY to router
    const syContract = getERC20Contract(params.syAddress, currentAccount);
    const approveSyCall = syContract.populate('approve', [
      routerAddress,
      uint256.bnToUint256(params.syAmount),
    ]);
    calls.push(approveSyCall);

    // Approve PT to router
    const ptContract = getERC20Contract(params.ptAddress, currentAccount);
    const approvePtCall = ptContract.populate('approve', [
      routerAddress,
      uint256.bnToUint256(params.ptAmount),
    ]);
    calls.push(approvePtCall);

    // Add liquidity call
    const addLiquidityCall = router.populate('add_liquidity', [
      params.marketAddress,
      currentAddress,
      uint256.bnToUint256(params.syAmount),
      uint256.bnToUint256(params.ptAmount),
      uint256.bnToUint256(params.minLpOut),
      getDeadline(),
    ]);
    calls.push(addLiquidityCall);

    return calls;
  };

  const mutation = createMutation(() => ({
    mutationFn: async (params: AddLiquidityParams): Promise<LiquidityResult> => {
      const currentAccount = account();

      if (!currentAccount) {
        throw new Error('Wallet not connected');
      }

      const calls = buildAddLiquidityCalls(params);

      // Execute multicall
      const result = await currentAccount.execute(calls);

      return {
        transactionHash: result.transaction_hash,
      };
    },

    /**
     * Optimistic UI: Update balances immediately (Doherty Threshold)
     */
    onMutate: async (params: AddLiquidityParams): Promise<AddLiquidityOptimisticContext> => {
      const currentAddress = address();

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.syAddress, currentAddress],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.ptAddress, currentAddress],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.marketAddress, currentAddress],
      });

      // Snapshot previous values
      const previousSyBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.syAddress,
        currentAddress,
      ]);
      const previousPtBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.ptAddress,
        currentAddress,
      ]);
      const previousLpBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.marketAddress,
        currentAddress,
      ]);

      // Optimistically decrease SY balance
      if (previousSyBalance !== undefined) {
        const newBalance = BigInt(previousSyBalance) - params.syAmount;
        queryClient.setQueryData(
          ['token-balance', params.syAddress, currentAddress],
          (newBalance > 0n ? newBalance : 0n).toString()
        );
      }

      // Optimistically decrease PT balance
      if (previousPtBalance !== undefined) {
        const newBalance = BigInt(previousPtBalance) - params.ptAmount;
        queryClient.setQueryData(
          ['token-balance', params.ptAddress, currentAddress],
          (newBalance > 0n ? newBalance : 0n).toString()
        );
      }

      // Optimistically increase LP balance
      if (previousLpBalance !== undefined) {
        const newBalance = BigInt(previousLpBalance) + params.minLpOut;
        queryClient.setQueryData(
          ['token-balance', params.marketAddress, currentAddress],
          newBalance.toString()
        );
      }

      return { previousSyBalance, previousPtBalance, previousLpBalance };
    },

    /**
     * Rollback on error
     */
    onError: (
      _err: Error,
      params: AddLiquidityParams,
      context: AddLiquidityOptimisticContext | undefined
    ) => {
      const currentAddress = address();

      if (context) {
        if (context.previousSyBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.syAddress, currentAddress],
            context.previousSyBalance
          );
        }
        if (context.previousPtBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.ptAddress, currentAddress],
            context.previousPtBalance
          );
        }
        if (context.previousLpBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.marketAddress, currentAddress],
            context.previousLpBalance
          );
        }
      }
    },

    /**
     * Always refetch to get actual blockchain state
     */
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['market'] });
      void queryClient.invalidateQueries({ queryKey: ['token-balance'] });
      void queryClient.invalidateQueries({ queryKey: ['token-allowance'] });
      void queryClient.invalidateQueries({ queryKey: ['lp-balance'] });
    },
  }));

  return {
    addLiquidity: mutation.mutate,
    addLiquidityAsync: mutation.mutateAsync,
    isAdding: createMemo(() => mutation.isPending),
    isSuccess: createMemo(() => mutation.isSuccess),
    isError: createMemo(() => mutation.isError),
    error: createMemo(() => mutation.error),
    transactionHash: createMemo(() => mutation.data?.transactionHash),
    reset: mutation.reset,
    buildAddLiquidityCalls,
  };
}

// ==================== useRemoveLiquidity Hook ====================

/**
 * Hook for removing liquidity from a Horizon Protocol market.
 * Burns LP tokens to receive SY and PT tokens.
 *
 * Uses @tanstack/solid-query createMutation with:
 * - Optimistic balance updates for instant perceived response
 * - Automatic rollback on error
 * - Cache invalidation on settlement
 *
 * @returns Object with reactive accessors for remove liquidity state and mutation functions
 */
export function useRemoveLiquidity(): UseRemoveLiquidityReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();

  /**
   * Build the calls array for removing liquidity
   * Can be used for gas estimation before executing
   */
  const buildRemoveLiquidityCalls = (params: RemoveLiquidityParams): Call[] => {
    const currentAccount = account();
    const currentAddress = address();

    if (!currentAccount || !currentAddress) {
      throw new Error('Wallet not connected');
    }

    const addresses = getAddresses(network);
    const routerAddress = addresses.router;
    const router = getRouterContract(currentAccount, network);

    const calls: Call[] = [];

    // Approve LP tokens (market is the LP token) to router
    const marketContract = getMarketContract(params.marketAddress, currentAccount);
    const approveLpCall = marketContract.populate('approve', [
      routerAddress,
      uint256.bnToUint256(params.lpAmount),
    ]);
    calls.push(approveLpCall);

    // Remove liquidity call
    const removeLiquidityCall = router.populate('remove_liquidity', [
      params.marketAddress,
      currentAddress,
      uint256.bnToUint256(params.lpAmount),
      uint256.bnToUint256(params.minSyOut),
      uint256.bnToUint256(params.minPtOut),
      getDeadline(),
    ]);
    calls.push(removeLiquidityCall);

    return calls;
  };

  const mutation = createMutation(() => ({
    mutationFn: async (params: RemoveLiquidityParams): Promise<LiquidityResult> => {
      const currentAccount = account();

      if (!currentAccount) {
        throw new Error('Wallet not connected');
      }

      const calls = buildRemoveLiquidityCalls(params);

      // Execute multicall
      const result = await currentAccount.execute(calls);

      return {
        transactionHash: result.transaction_hash,
      };
    },

    /**
     * Optimistic UI: Update balances immediately (Doherty Threshold)
     */
    onMutate: async (params: RemoveLiquidityParams): Promise<RemoveLiquidityOptimisticContext> => {
      const currentAddress = address();

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.syAddress, currentAddress],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.ptAddress, currentAddress],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.marketAddress, currentAddress],
      });

      // Snapshot previous values
      const previousSyBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.syAddress,
        currentAddress,
      ]);
      const previousPtBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.ptAddress,
        currentAddress,
      ]);
      const previousLpBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.marketAddress,
        currentAddress,
      ]);

      // Optimistically increase SY balance
      if (previousSyBalance !== undefined) {
        const newBalance = BigInt(previousSyBalance) + params.minSyOut;
        queryClient.setQueryData(
          ['token-balance', params.syAddress, currentAddress],
          newBalance.toString()
        );
      }

      // Optimistically increase PT balance
      if (previousPtBalance !== undefined) {
        const newBalance = BigInt(previousPtBalance) + params.minPtOut;
        queryClient.setQueryData(
          ['token-balance', params.ptAddress, currentAddress],
          newBalance.toString()
        );
      }

      // Optimistically decrease LP balance
      if (previousLpBalance !== undefined) {
        const newBalance = BigInt(previousLpBalance) - params.lpAmount;
        queryClient.setQueryData(
          ['token-balance', params.marketAddress, currentAddress],
          (newBalance > 0n ? newBalance : 0n).toString()
        );
      }

      return { previousSyBalance, previousPtBalance, previousLpBalance };
    },

    /**
     * Rollback on error
     */
    onError: (
      _err: Error,
      params: RemoveLiquidityParams,
      context: RemoveLiquidityOptimisticContext | undefined
    ) => {
      const currentAddress = address();

      if (context) {
        if (context.previousSyBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.syAddress, currentAddress],
            context.previousSyBalance
          );
        }
        if (context.previousPtBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.ptAddress, currentAddress],
            context.previousPtBalance
          );
        }
        if (context.previousLpBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.marketAddress, currentAddress],
            context.previousLpBalance
          );
        }
      }
    },

    /**
     * Always refetch to get actual blockchain state
     */
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['market'] });
      void queryClient.invalidateQueries({ queryKey: ['token-balance'] });
      void queryClient.invalidateQueries({ queryKey: ['token-allowance'] });
      void queryClient.invalidateQueries({ queryKey: ['lp-balance'] });
    },
  }));

  return {
    removeLiquidity: mutation.mutate,
    removeLiquidityAsync: mutation.mutateAsync,
    isRemoving: createMemo(() => mutation.isPending),
    isSuccess: createMemo(() => mutation.isSuccess),
    isError: createMemo(() => mutation.isError),
    error: createMemo(() => mutation.error),
    transactionHash: createMemo(() => mutation.data?.transactionHash),
    reset: mutation.reset,
    buildRemoveLiquidityCalls,
  };
}

// ==================== Helper Functions ====================

/**
 * Calculate minimum LP output with slippage protection
 * For simplicity, we estimate LP based on the smaller proportion of the deposit
 */
export function calculateMinLpOut(
  syAmount: bigint,
  ptAmount: bigint,
  syReserve: bigint,
  ptReserve: bigint,
  totalLpSupply: bigint,
  slippageBps: number
): bigint {
  // Validate slippage is within bounds (0-10000 bps = 0-100%)
  const safeSlippage = Math.max(0, Math.min(slippageBps, 10000));

  if (syReserve === 0n || ptReserve === 0n || totalLpSupply === 0n) {
    // Initial liquidity - use the smaller amount as a conservative estimate
    const minAmount = syAmount < ptAmount ? syAmount : ptAmount;
    const slippageMultiplier = BigInt(10000 - safeSlippage);
    return (minAmount * slippageMultiplier) / 10000n;
  }

  // Calculate LP based on proportional contribution
  const lpFromSy = (syAmount * totalLpSupply) / syReserve;
  const lpFromPt = (ptAmount * totalLpSupply) / ptReserve;

  // Take the smaller to ensure we don't over-promise
  const expectedLp = lpFromSy < lpFromPt ? lpFromSy : lpFromPt;

  // Apply slippage
  const slippageMultiplier = BigInt(10000 - safeSlippage);
  return (expectedLp * slippageMultiplier) / 10000n;
}

/**
 * Calculate minimum SY and PT output when removing liquidity
 */
export function calculateMinOutputs(
  lpAmount: bigint,
  syReserve: bigint,
  ptReserve: bigint,
  totalLpSupply: bigint,
  slippageBps: number
): { minSyOut: bigint; minPtOut: bigint } {
  if (totalLpSupply === 0n) {
    return { minSyOut: 0n, minPtOut: 0n };
  }

  // Validate slippage is within bounds (0-10000 bps = 0-100%)
  const safeSlippage = Math.max(0, Math.min(slippageBps, 10000));

  // Calculate proportional share
  const expectedSy = (lpAmount * syReserve) / totalLpSupply;
  const expectedPt = (lpAmount * ptReserve) / totalLpSupply;

  // Apply slippage
  const slippageMultiplier = BigInt(10000 - safeSlippage);
  const minSyOut = (expectedSy * slippageMultiplier) / 10000n;
  const minPtOut = (expectedPt * slippageMultiplier) / 10000n;

  return { minSyOut, minPtOut };
}

/**
 * Calculate balanced deposit amounts based on current pool ratio
 */
export function calculateBalancedAmounts(
  inputAmount: bigint,
  inputIsSy: boolean,
  syReserve: bigint,
  ptReserve: bigint
): { syAmount: bigint; ptAmount: bigint } {
  if (syReserve === 0n || ptReserve === 0n) {
    // No existing ratio, use 1:1
    return { syAmount: inputAmount, ptAmount: inputAmount };
  }

  if (inputIsSy) {
    // Calculate PT needed for given SY
    const ptAmount = (inputAmount * ptReserve) / syReserve;
    return { syAmount: inputAmount, ptAmount };
  } else {
    // Calculate SY needed for given PT
    const syAmount = (inputAmount * syReserve) / ptReserve;
    return { syAmount, ptAmount: inputAmount };
  }
}
