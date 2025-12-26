'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Call, uint256 } from 'starknet';

import { getAddresses } from '@shared/config/addresses';
import { getDeadline } from '@shared/lib/deadline';
import { getERC20Contract, getRouterContract } from '@shared/starknet/contracts';

import { useAccount } from './useAccount';
import { useStarknet } from './useStarknet';

export type SwapDirection = 'buy_pt' | 'sell_pt' | 'buy_yt' | 'sell_yt';

interface SwapParams {
  marketAddress: string;
  syAddress: string;
  ptAddress: string;
  ytAddress: string;
  direction: SwapDirection;
  amountIn: bigint;
  minAmountOut: bigint;
}

interface SwapResult {
  transactionHash: string;
  amountOut: bigint;
}

interface UseSwapReturn {
  swap: (params: SwapParams) => void;
  swapAsync: (params: SwapParams) => Promise<SwapResult>;
  isSwapping: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

export function useSwap(): UseSwapReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (params: SwapParams): Promise<SwapResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      const routerAddress = addresses.router;
      const router = getRouterContract(account, network);

      const calls: Call[] = [];

      if (params.direction === 'buy_pt') {
        // Swap SY for PT: approve SY, then swap
        const syContract = getERC20Contract(params.syAddress, account);

        // Add approval call for SY
        const approveCall = syContract.populate('approve', [
          routerAddress,
          uint256.bnToUint256(params.amountIn),
        ]);
        calls.push(approveCall);

        // Add swap call
        const swapCall = router.populate('swap_exact_sy_for_pt', [
          params.marketAddress,
          address,
          uint256.bnToUint256(params.amountIn),
          uint256.bnToUint256(params.minAmountOut),
          getDeadline(),
        ]);
        calls.push(swapCall);
      } else if (params.direction === 'sell_pt') {
        // Swap PT for SY: approve PT, then swap
        const ptContract = getERC20Contract(params.ptAddress, account);

        // Add approval call for PT
        const approveCall = ptContract.populate('approve', [
          routerAddress,
          uint256.bnToUint256(params.amountIn),
        ]);
        calls.push(approveCall);

        // Add swap call
        const swapCall = router.populate('swap_exact_pt_for_sy', [
          params.marketAddress,
          address,
          uint256.bnToUint256(params.amountIn),
          uint256.bnToUint256(params.minAmountOut),
          getDeadline(),
        ]);
        calls.push(swapCall);
      } else if (params.direction === 'buy_yt') {
        // Swap SY for YT via flash swap: approve SY, then swap
        const syContract = getERC20Contract(params.syAddress, account);

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
          address,
          uint256.bnToUint256(params.amountIn),
          uint256.bnToUint256(params.minAmountOut),
          getDeadline(),
        ]);
        calls.push(swapCall);
      } else {
        // direction === 'sell_yt'
        // Swap YT for SY via flash swap: approve YT and SY (for collateral), then swap
        const ytContract = getERC20Contract(params.ytAddress, account);
        const syContract = getERC20Contract(params.syAddress, account);

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
          address,
          uint256.bnToUint256(params.amountIn),
          uint256.bnToUint256(collateralAmount), // max_sy_collateral
          uint256.bnToUint256(params.minAmountOut),
          getDeadline(),
        ]);
        calls.push(swapCall);
      }

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
        amountOut: params.minAmountOut, // Will be updated after tx confirmation
      };
    },
    onSuccess: () => {
      // Invalidate relevant queries
      void queryClient.invalidateQueries({ queryKey: ['market'] });
      void queryClient.invalidateQueries({ queryKey: ['token-balance'] });
      void queryClient.invalidateQueries({ queryKey: ['token-allowance'] });
    },
  });

  return {
    swap: mutation.mutate,
    swapAsync: mutation.mutateAsync,
    isSwapping: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
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
