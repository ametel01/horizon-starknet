'use client';

import { useAccount, useStarknet } from '@features/wallet';
import { getAddresses } from '@shared/config/addresses';
import { getDeadline } from '@shared/lib/deadline';
import { getERC20Contract } from '@shared/starknet/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Call, uint256 } from 'starknet';

import { serializeApproxParams, serializeU256 } from '../lib/calldata';
import { type ApproxParams, DEFAULT_APPROX_PARAMS } from './types';

/**
 * Parameters for swapping SY for PT with ApproxParams
 */
interface SwapSyForPtWithApproxParams {
  /** Market address for PT/SY swaps */
  marketAddress: string;
  /** SY contract address (for approval) */
  syAddress: string;
  /** PT contract address (for optimistic balance updates) */
  ptAddress: string;
  /** Exact amount of SY to swap */
  exactSyIn: bigint;
  /** Minimum PT to receive (slippage protection) */
  minPtOut: bigint;
  /** Optional approximation parameters for binary search optimization */
  approxParams?: ApproxParams;
}

interface SwapSyForPtWithApproxResult {
  transactionHash: string;
  amountOut: bigint;
}

interface UseSwapSyForPtWithApproxReturn {
  swap: (params: SwapSyForPtWithApproxParams) => void;
  swapAsync: (params: SwapSyForPtWithApproxParams) => Promise<SwapSyForPtWithApproxResult>;
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
  previousSyBalance: string | undefined;
  previousPtBalance: string | undefined;
  syAddress: string;
  ptAddress: string;
}

/**
 * Hook for swapping SY for PT with custom ApproxParams for optimized binary search.
 *
 * This variant allows callers to provide:
 * - guess_min/guess_max: Bounds for binary search (0 = use defaults)
 * - guess_offchain: Off-chain computed guess for faster convergence
 * - max_iteration: Maximum binary search iterations
 * - eps: Precision threshold in WAD (e.g., 1e15 = 0.1% precision)
 *
 * Uses the router's `swap_exact_sy_for_pt_with_approx` function.
 *
 * @see i_router.cairo lines 287-295
 */
export function useSwapSyForPtWithApprox(): UseSwapSyForPtWithApproxReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (
      params: SwapSyForPtWithApproxParams
    ): Promise<SwapSyForPtWithApproxResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      const routerAddress = addresses.router;

      const calls: Call[] = [];

      // Approve SY to router
      const syContract = getERC20Contract(params.syAddress, account);
      const approveCall = syContract.populate('approve', [
        routerAddress,
        uint256.bnToUint256(params.exactSyIn),
      ]);
      calls.push(approveCall);

      // Use provided approx params or defaults
      const approxParams = params.approxParams ?? DEFAULT_APPROX_PARAMS;

      // Build swap call with serialized ApproxParams
      // Router function: swap_exact_sy_for_pt_with_approx(market, receiver, exact_sy_in, min_pt_out, approx, deadline)
      const [exactSyInLow, exactSyInHigh] = serializeU256(params.exactSyIn);
      const [minPtOutLow, minPtOutHigh] = serializeU256(params.minPtOut);
      const deadline = getDeadline();

      const swapCalldata = [
        params.marketAddress, // market
        address, // receiver
        exactSyInLow, // exact_sy_in.low
        exactSyInHigh, // exact_sy_in.high
        minPtOutLow, // min_pt_out.low
        minPtOutHigh, // min_pt_out.high
        ...serializeApproxParams(approxParams), // approx: ApproxParams (10 felts)
        deadline.toString(), // deadline
      ];

      const swapCall: Call = {
        contractAddress: routerAddress,
        entrypoint: 'swap_exact_sy_for_pt_with_approx',
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
     * Optimistic UI: Update SY and PT balances immediately
     */
    onMutate: async (params: SwapSyForPtWithApproxParams): Promise<OptimisticContext> => {
      const { syAddress, ptAddress } = params;

      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ['token-balance', syAddress, address],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', ptAddress, address],
      });

      // Snapshot previous values for rollback
      const previousSyBalance = queryClient.getQueryData<string>([
        'token-balance',
        syAddress,
        address,
      ]);
      const previousPtBalance = queryClient.getQueryData<string>([
        'token-balance',
        ptAddress,
        address,
      ]);

      // Optimistically update SY balance (decrease)
      if (previousSyBalance !== undefined) {
        const newSyBalance = BigInt(previousSyBalance) - params.exactSyIn;
        queryClient.setQueryData(
          ['token-balance', syAddress, address],
          (newSyBalance > 0n ? newSyBalance : 0n).toString()
        );
      }

      // Optimistically update PT balance (increase)
      if (previousPtBalance !== undefined) {
        const newPtBalance = BigInt(previousPtBalance) + params.minPtOut;
        queryClient.setQueryData(['token-balance', ptAddress, address], newPtBalance.toString());
      }

      return {
        previousSyBalance,
        previousPtBalance,
        syAddress,
        ptAddress,
      };
    },

    /**
     * Rollback optimistic update on error
     */
    onError: (_err, _params, context) => {
      if (context) {
        // Restore previous SY balance
        if (context.previousSyBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', context.syAddress, address],
            context.previousSyBalance
          );
        }
        // Restore previous PT balance
        if (context.previousPtBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', context.ptAddress, address],
            context.previousPtBalance
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
