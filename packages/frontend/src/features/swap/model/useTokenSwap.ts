'use client';

import { useAccount, useStarknet } from '@features/wallet';
import { getAddresses } from '@shared/config/addresses';
import { getDeadline } from '@shared/lib/deadline';
import { getERC20Contract } from '@shared/starknet/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Call, uint256 } from 'starknet';

import { serializeTokenInput, serializeTokenOutput, serializeU256 } from '../lib/calldata';
import type { TokenInput, TokenOutput } from './types';

/**
 * Parameters for swapping any token to PT via aggregator
 */
interface SwapTokenForPtParams {
  /** Market address for PT/SY swaps */
  marketAddress: string;
  /** Token input with aggregator swap data */
  input: TokenInput;
  /** Minimum PT to receive (slippage protection) */
  minPtOut: bigint;
}

interface SwapTokenForPtResult {
  transactionHash: string;
  amountOut: bigint;
}

interface UseSwapTokenForPtReturn {
  swap: (params: SwapTokenForPtParams) => void;
  swapAsync: (params: SwapTokenForPtParams) => Promise<SwapTokenForPtResult>;
  isSwapping: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

/**
 * Context for optimistic update rollback
 */
interface OptimisticContext {
  previousInputBalance: string | undefined;
  inputTokenAddress: string;
}

/**
 * Hook for swapping any token to PT via aggregator.
 *
 * Flow: token_in -> aggregator -> underlying -> SY deposit -> market swap -> PT
 *
 * Uses the router's `swap_exact_token_for_pt` function which handles:
 * 1. Transferring input token from user
 * 2. Swapping through aggregator to get underlying
 * 3. Depositing underlying into SY
 * 4. Swapping SY for PT in the market
 *
 * @see i_router.cairo lines 480-495
 */
export function useSwapTokenForPt(): UseSwapTokenForPtReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (params: SwapTokenForPtParams): Promise<SwapTokenForPtResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      const routerAddress = addresses.router;

      const calls: Call[] = [];

      // Approve input token to router (router will transfer it to aggregator)
      const inputTokenContract = getERC20Contract(params.input.token, account);
      const approveCall = inputTokenContract.populate('approve', [
        routerAddress,
        uint256.bnToUint256(params.input.amount),
      ]);
      calls.push(approveCall);

      // Build swap call with serialized TokenInput
      // Router function: swap_exact_token_for_pt(market, receiver, input, min_pt_out, deadline)
      const [minPtOutLow, minPtOutHigh] = serializeU256(params.minPtOut);
      const deadline = getDeadline();

      const swapCalldata = [
        params.marketAddress, // market
        address, // receiver
        ...serializeTokenInput(params.input), // input: TokenInput
        minPtOutLow, // min_pt_out.low
        minPtOutHigh, // min_pt_out.high
        deadline.toString(), // deadline
      ];

      const swapCall: Call = {
        contractAddress: routerAddress,
        entrypoint: 'swap_exact_token_for_pt',
        calldata: swapCalldata,
      };
      calls.push(swapCall);

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
        amountOut: params.minPtOut, // Will be updated after tx confirmation
      };
    },

    /**
     * Optimistic UI: Update input token balance immediately
     */
    onMutate: async (params: SwapTokenForPtParams): Promise<OptimisticContext> => {
      const inputTokenAddress = params.input.token;

      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ['token-balance', inputTokenAddress, address],
      });

      // Snapshot previous value for rollback
      const previousInputBalance = queryClient.getQueryData<string>([
        'token-balance',
        inputTokenAddress,
        address,
      ]);

      // Optimistically update input balance (decrease)
      if (previousInputBalance !== undefined) {
        const newInputBalance = BigInt(previousInputBalance) - params.input.amount;
        queryClient.setQueryData(
          ['token-balance', inputTokenAddress, address],
          (newInputBalance > 0n ? newInputBalance : 0n).toString()
        );
      }

      return {
        previousInputBalance,
        inputTokenAddress,
      };
    },

    /**
     * Rollback optimistic update on error
     */
    onError: (_err, _params, context) => {
      if (context?.previousInputBalance !== undefined) {
        queryClient.setQueryData(
          ['token-balance', context.inputTokenAddress, address],
          context.previousInputBalance
        );
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
 * Parameters for swapping PT to any token via aggregator
 */
interface SwapPtForTokenParams {
  /** Market address for PT/SY swaps */
  marketAddress: string;
  /** PT contract address (for approval) */
  ptAddress: string;
  /** Exact amount of PT to sell */
  exactPtIn: bigint;
  /** Token output with aggregator swap data and min amount */
  output: TokenOutput;
}

interface SwapPtForTokenResult {
  transactionHash: string;
  amountOut: bigint;
}

interface UseSwapPtForTokenReturn {
  swap: (params: SwapPtForTokenParams) => void;
  swapAsync: (params: SwapPtForTokenParams) => Promise<SwapPtForTokenResult>;
  isSwapping: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

/**
 * Context for optimistic update rollback
 */
interface SwapPtForTokenOptimisticContext {
  previousPtBalance: string | undefined;
  ptAddress: string;
}

/**
 * Hook for swapping PT to any token via aggregator.
 *
 * Flow: PT -> market swap -> SY -> SY redeem -> underlying -> aggregator -> token_out
 *
 * Uses the router's `swap_exact_pt_for_token` function which handles:
 * 1. Transferring PT from user
 * 2. Swapping PT for SY in the market
 * 3. Redeeming SY for underlying
 * 4. Swapping underlying through aggregator to get output token
 *
 * @see i_router.cairo lines 505-512
 */
export function useSwapPtForToken(): UseSwapPtForTokenReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (params: SwapPtForTokenParams): Promise<SwapPtForTokenResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      const routerAddress = addresses.router;

      const calls: Call[] = [];

      // Approve PT to router (router will transfer it to market)
      const ptContract = getERC20Contract(params.ptAddress, account);
      const approveCall = ptContract.populate('approve', [
        routerAddress,
        uint256.bnToUint256(params.exactPtIn),
      ]);
      calls.push(approveCall);

      // Build swap call with serialized TokenOutput
      // Router function: swap_exact_pt_for_token(market, receiver, exact_pt_in, output, deadline)
      const [exactPtInLow, exactPtInHigh] = serializeU256(params.exactPtIn);
      const deadline = getDeadline();

      const swapCalldata = [
        params.marketAddress, // market
        address, // receiver
        exactPtInLow, // exact_pt_in.low
        exactPtInHigh, // exact_pt_in.high
        ...serializeTokenOutput(params.output), // output: TokenOutput
        deadline.toString(), // deadline
      ];

      const swapCall: Call = {
        contractAddress: routerAddress,
        entrypoint: 'swap_exact_pt_for_token',
        calldata: swapCalldata,
      };
      calls.push(swapCall);

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
        amountOut: params.output.min_amount, // Will be updated after tx confirmation
      };
    },

    /**
     * Optimistic UI: Update PT balance immediately
     */
    onMutate: async (params: SwapPtForTokenParams): Promise<SwapPtForTokenOptimisticContext> => {
      const { ptAddress } = params;

      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ['token-balance', ptAddress, address],
      });

      // Snapshot previous value for rollback
      const previousPtBalance = queryClient.getQueryData<string>([
        'token-balance',
        ptAddress,
        address,
      ]);

      // Optimistically update PT balance (decrease)
      if (previousPtBalance !== undefined) {
        const newPtBalance = BigInt(previousPtBalance) - params.exactPtIn;
        queryClient.setQueryData(
          ['token-balance', ptAddress, address],
          (newPtBalance > 0n ? newPtBalance : 0n).toString()
        );
      }

      return {
        previousPtBalance,
        ptAddress,
      };
    },

    /**
     * Rollback optimistic update on error
     */
    onError: (_err, _params, context) => {
      if (context?.previousPtBalance !== undefined) {
        queryClient.setQueryData(
          ['token-balance', context.ptAddress, address],
          context.previousPtBalance
        );
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
