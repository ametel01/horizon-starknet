import { getAddresses } from '@shared/config/addresses';
import { getDeadline } from '@shared/lib/deadline';
import { getERC20Contract, getRouterContract } from '@shared/starknet/contracts';
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { type Accessor, createMemo } from 'solid-js';
import { type Call, uint256 } from 'starknet';

import { useAccount, useStarknet } from '@/features/wallet';

export type SwapDirection = 'buy_pt' | 'sell_pt' | 'buy_yt' | 'sell_yt';

/**
 * Resolve input/output token addresses from swap direction.
 * Uses decision table pattern instead of nested ternaries.
 */
function resolveSwapTokens(
  direction: SwapDirection,
  syAddress: string,
  ptAddress: string,
  ytAddress: string
): { inputTokenAddress: string; outputTokenAddress: string } {
  const tokenMap: Record<SwapDirection, { input: string; output: string }> = {
    buy_pt: { input: syAddress, output: ptAddress },
    sell_pt: { input: ptAddress, output: syAddress },
    buy_yt: { input: syAddress, output: ytAddress },
    sell_yt: { input: ytAddress, output: syAddress },
  };
  return {
    inputTokenAddress: tokenMap[direction].input,
    outputTokenAddress: tokenMap[direction].output,
  };
}

export interface SwapParams {
  marketAddress: string;
  syAddress: string;
  ptAddress: string;
  ytAddress: string;
  direction: SwapDirection;
  amountIn: bigint;
  minAmountOut: bigint;
}

export interface SwapResult {
  transactionHash: string;
  amountOut: bigint;
}

export interface UseSwapReturn {
  swap: (params: SwapParams) => void;
  swapAsync: (params: SwapParams) => Promise<SwapResult>;
  isSwapping: Accessor<boolean>;
  isSuccess: Accessor<boolean>;
  isError: Accessor<boolean>;
  error: Accessor<Error | null>;
  transactionHash: Accessor<string | undefined>;
  reset: () => void;
}

/**
 * Context for optimistic update rollback
 */
interface OptimisticContext {
  previousInputBalance: string | undefined;
  previousOutputBalance: string | undefined;
  inputTokenAddress: string;
  outputTokenAddress: string;
}

/**
 * Hook for executing token swaps on Horizon Protocol.
 * Supports PT/SY and YT/SY swaps with optimistic UI updates.
 *
 * Uses @tanstack/solid-query createMutation with:
 * - Optimistic balance updates for instant perceived response
 * - Automatic rollback on error
 * - Cache invalidation on settlement
 *
 * @returns Object with reactive accessors for swap state and mutation functions
 */
export function useSwap(): UseSwapReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();

  const mutation = createMutation(() => ({
    mutationFn: async (params: SwapParams): Promise<SwapResult> => {
      const currentAccount = account();
      const currentAddress = address();

      if (!currentAccount || !currentAddress) {
        throw new Error('Wallet not connected');
      }

      const addresses = getAddresses(network);
      const routerAddress = addresses.router;
      const router = getRouterContract(currentAccount, network);

      const calls: Call[] = [];

      if (params.direction === 'buy_pt') {
        // Swap SY for PT: approve SY, then swap
        const syContract = getERC20Contract(params.syAddress, currentAccount);

        // Add approval call for SY
        const approveCall = syContract.populate('approve', [
          routerAddress,
          uint256.bnToUint256(params.amountIn),
        ]);
        calls.push(approveCall);

        // Add swap call
        const swapCall = router.populate('swap_exact_sy_for_pt', [
          params.marketAddress,
          currentAddress,
          uint256.bnToUint256(params.amountIn),
          uint256.bnToUint256(params.minAmountOut),
          getDeadline(),
        ]);
        calls.push(swapCall);
      } else if (params.direction === 'sell_pt') {
        // Swap PT for SY: approve PT, then swap
        const ptContract = getERC20Contract(params.ptAddress, currentAccount);

        // Add approval call for PT
        const approveCall = ptContract.populate('approve', [
          routerAddress,
          uint256.bnToUint256(params.amountIn),
        ]);
        calls.push(approveCall);

        // Add swap call
        const swapCall = router.populate('swap_exact_pt_for_sy', [
          params.marketAddress,
          currentAddress,
          uint256.bnToUint256(params.amountIn),
          uint256.bnToUint256(params.minAmountOut),
          getDeadline(),
        ]);
        calls.push(swapCall);
      } else if (params.direction === 'buy_yt') {
        // Swap SY for YT via flash swap: approve SY, then swap
        const syContract = getERC20Contract(params.syAddress, currentAccount);

        // Add approval call for SY
        const approveCall = syContract.populate('approve', [
          routerAddress,
          uint256.bnToUint256(params.amountIn),
        ]);
        calls.push(approveCall);

        // Add swap call - swap_exact_sy_for_yt(yt, market, receiver, exact_sy_in, min_yt_out, deadline)
        const swapCall = router.populate('swap_exact_sy_for_yt', [
          params.ytAddress,
          params.marketAddress,
          currentAddress,
          uint256.bnToUint256(params.amountIn),
          uint256.bnToUint256(params.minAmountOut),
          getDeadline(),
        ]);
        calls.push(swapCall);
      } else {
        // direction === 'sell_yt'
        // Swap YT for SY via flash swap: approve YT and SY (for collateral), then swap
        const ytContract = getERC20Contract(params.ytAddress, currentAccount);
        const syContract = getERC20Contract(params.syAddress, currentAccount);

        // The router needs YT approval for the YT being sold
        const approveYtCall = ytContract.populate('approve', [
          routerAddress,
          uint256.bnToUint256(params.amountIn),
        ]);
        calls.push(approveYtCall);

        // The router also needs SY approval for collateral (4x the YT amount for safety margin)
        // This collateral is refunded after the flash swap
        const collateralAmount = params.amountIn * BigInt(4);
        const approveSyCall = syContract.populate('approve', [
          routerAddress,
          uint256.bnToUint256(collateralAmount),
        ]);
        calls.push(approveSyCall);

        // Add swap call - swap_exact_yt_for_sy(yt, market, receiver, exact_yt_in, max_sy_collateral, min_sy_out, deadline)
        const swapCall = router.populate('swap_exact_yt_for_sy', [
          params.ytAddress,
          params.marketAddress,
          currentAddress,
          uint256.bnToUint256(params.amountIn),
          uint256.bnToUint256(collateralAmount), // max_sy_collateral
          uint256.bnToUint256(params.minAmountOut),
          getDeadline(),
        ]);
        calls.push(swapCall);
      }

      // Execute multicall
      const result = await currentAccount.execute(calls);

      return {
        transactionHash: result.transaction_hash,
        amountOut: params.minAmountOut, // Will be updated after tx confirmation
      };
    },

    /**
     * Optimistic UI: Update balances immediately for perceived speed (Doherty Threshold)
     * This creates the illusion of instant response while the blockchain confirms
     */
    onMutate: async (params: SwapParams): Promise<OptimisticContext> => {
      const currentAddress = address();

      // Resolve token addresses using decision table
      const { inputTokenAddress, outputTokenAddress } = resolveSwapTokens(
        params.direction,
        params.syAddress,
        params.ptAddress,
        params.ytAddress
      );

      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ['token-balance', inputTokenAddress, currentAddress],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', outputTokenAddress, currentAddress],
      });

      // Snapshot previous values for rollback
      const previousInputBalance = queryClient.getQueryData<string>([
        'token-balance',
        inputTokenAddress,
        currentAddress,
      ]);
      const previousOutputBalance = queryClient.getQueryData<string>([
        'token-balance',
        outputTokenAddress,
        currentAddress,
      ]);

      // Optimistically update input balance (decrease)
      if (previousInputBalance !== undefined) {
        const newInputBalance = BigInt(previousInputBalance) - params.amountIn;
        queryClient.setQueryData(
          ['token-balance', inputTokenAddress, currentAddress],
          (newInputBalance > 0n ? newInputBalance : 0n).toString()
        );
      }

      // Optimistically update output balance (increase)
      if (previousOutputBalance !== undefined) {
        const newOutputBalance = BigInt(previousOutputBalance) + params.minAmountOut;
        queryClient.setQueryData(
          ['token-balance', outputTokenAddress, currentAddress],
          newOutputBalance.toString()
        );
      }

      // Return context for rollback
      return {
        previousInputBalance,
        previousOutputBalance,
        inputTokenAddress,
        outputTokenAddress,
      };
    },

    /**
     * Rollback optimistic update on error
     */
    onError: (_err: Error, _params: SwapParams, context: OptimisticContext | undefined) => {
      const currentAddress = address();

      if (context) {
        // Restore previous input balance
        if (context.previousInputBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', context.inputTokenAddress, currentAddress],
            context.previousInputBalance
          );
        }
        // Restore previous output balance
        if (context.previousOutputBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', context.outputTokenAddress, currentAddress],
            context.previousOutputBalance
          );
        }
      }
    },

    /**
     * Always refetch after mutation settles to get actual blockchain state
     */
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['market'] });
      void queryClient.invalidateQueries({ queryKey: ['token-balance'] });
      void queryClient.invalidateQueries({ queryKey: ['token-allowance'] });
    },
  }));

  return {
    swap: mutation.mutate,
    swapAsync: mutation.mutateAsync,
    isSwapping: createMemo(() => mutation.isPending),
    isSuccess: createMemo(() => mutation.isSuccess),
    isError: createMemo(() => mutation.isError),
    error: createMemo(() => mutation.error),
    transactionHash: createMemo(() => mutation.data?.transactionHash),
    reset: mutation.reset,
  };
}

/**
 * Calculate the minimum output amount with slippage protection
 * @param expectedOutput - Expected output amount
 * @param slippageBps - Slippage tolerance in basis points (e.g., 50 = 0.5%)
 * @returns Minimum output amount after slippage
 */
export function calculateMinOutput(expectedOutput: bigint, slippageBps: number): bigint {
  const slippageMultiplier = BigInt(10000 - slippageBps);
  return (expectedOutput * slippageMultiplier) / BigInt(10000);
}

/**
 * Calculate the maximum input amount with slippage protection
 * @param expectedInput - Expected input amount
 * @param slippageBps - Slippage tolerance in basis points (e.g., 50 = 0.5%)
 * @returns Maximum input amount after slippage
 */
export function calculateMaxInput(expectedInput: bigint, slippageBps: number): bigint {
  const slippageMultiplier = BigInt(10000 + slippageBps);
  return (expectedInput * slippageMultiplier) / BigInt(10000);
}
