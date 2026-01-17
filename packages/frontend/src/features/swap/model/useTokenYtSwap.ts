'use client';

import { useAccount, useStarknet } from '@features/wallet';
import { getAddresses } from '@shared/config/addresses';
import { getDeadline } from '@shared/lib/deadline';
import { getERC20Contract } from '@shared/starknet/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Call, uint256 } from 'starknet';

import { serializeTokenInput, serializeU256 } from '../lib/calldata';
import type { TokenInput } from './types';

/**
 * Parameters for swapping any token to YT via aggregator
 */
interface SwapTokenForYtParams {
  /** YT contract address (required for mint PT+YT operation) */
  ytAddress: string;
  /** Market address for PT/SY swaps */
  marketAddress: string;
  /** Token input with aggregator swap data */
  input: TokenInput;
  /** Minimum YT to receive (slippage protection) */
  minYtOut: bigint;
}

interface SwapTokenForYtResult {
  transactionHash: string;
  amountOut: bigint;
}

interface UseSwapTokenForYtReturn {
  swap: (params: SwapTokenForYtParams) => void;
  swapAsync: (params: SwapTokenForYtParams) => Promise<SwapTokenForYtResult>;
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
 * Hook for swapping any token to YT via aggregator.
 *
 * Flow: token_in -> aggregator -> underlying -> SY deposit -> mint PT+YT -> sell PT -> YT
 *
 * This uses a flash swap mechanism where:
 * 1. Input token is transferred from user
 * 2. Swapped through aggregator to get underlying
 * 3. Underlying is deposited into SY
 * 4. SY is used to mint PT+YT pair
 * 5. PT is immediately sold to market for more SY
 * 6. Process repeats until convergence, user receives YT
 *
 * Note: Unlike PT swaps, YT swaps require the YT address parameter because
 * the mint operation must be called on the specific YT contract.
 *
 * @see i_router.cairo lines 523-531
 */
export function useSwapTokenForYt(): UseSwapTokenForYtReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (params: SwapTokenForYtParams): Promise<SwapTokenForYtResult> => {
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
      // Router function: swap_exact_token_for_yt(yt, market, receiver, input, min_yt_out, deadline)
      const [minYtOutLow, minYtOutHigh] = serializeU256(params.minYtOut);
      const deadline = getDeadline();

      const swapCalldata = [
        params.ytAddress, // yt
        params.marketAddress, // market
        address, // receiver
        ...serializeTokenInput(params.input), // input: TokenInput
        minYtOutLow, // min_yt_out.low
        minYtOutHigh, // min_yt_out.high
        deadline.toString(), // deadline
      ];

      const swapCall: Call = {
        contractAddress: routerAddress,
        entrypoint: 'swap_exact_token_for_yt',
        calldata: swapCalldata,
      };
      calls.push(swapCall);

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
        amountOut: params.minYtOut, // Will be updated after tx confirmation
      };
    },

    /**
     * Optimistic UI: Update input token balance immediately
     *
     * Note: We only update the input token balance here. The YT balance
     * cannot be reliably predicted due to the flash swap mechanism which
     * involves iterative minting and selling. The actual YT amount depends
     * on market conditions and convergence of the flash swap.
     */
    onMutate: async (params: SwapTokenForYtParams): Promise<OptimisticContext> => {
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
