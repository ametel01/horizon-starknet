'use client';

import { useAccount, useStarknet } from '@features/wallet';
import { serializeApproxParams, serializeU256 } from '@features/swap/lib/calldata';
import {
  type ApproxParams,
  DEFAULT_APPROX_PARAMS,
} from '@features/swap/model/types';
import { getAddresses } from '@shared/config/addresses';
import { getDeadline } from '@shared/lib/deadline';
import { getERC20Contract } from '@shared/starknet/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Call, uint256 } from 'starknet';

/**
 * Parameters for adding single-sided SY liquidity with ApproxParams
 */
interface AddLiquiditySingleSyWithApproxParams {
  /** Market address for PT/SY AMM */
  marketAddress: string;
  /** SY contract address (for approval) */
  syAddress: string;
  /** Amount of SY to deposit */
  syAmount: bigint;
  /** Minimum LP tokens to receive (slippage protection) */
  minLpOut: bigint;
  /** Optional approximation parameters for binary search optimization */
  approxParams?: ApproxParams;
}

interface AddLiquiditySingleSyWithApproxResult {
  transactionHash: string;
  syUsed: bigint;
  ptUsed: bigint;
  lpMinted: bigint;
}

interface UseAddLiquiditySingleSyWithApproxReturn {
  addLiquiditySingleSyWithApprox: (params: AddLiquiditySingleSyWithApproxParams) => void;
  addLiquiditySingleSyWithApproxAsync: (
    params: AddLiquiditySingleSyWithApproxParams
  ) => Promise<AddLiquiditySingleSyWithApproxResult>;
  isAdding: boolean;
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
  previousLpBalance: string | undefined;
}

/**
 * Hook for adding single-sided SY liquidity with custom ApproxParams.
 *
 * This variant allows callers to provide binary search hints for optimized convergence:
 * - guess_min/guess_max: Bounds for binary search (0 = use defaults)
 * - guess_offchain: Off-chain computed guess for faster convergence
 * - max_iteration: Maximum binary search iterations
 * - eps: Precision threshold in WAD (e.g., 1e15 = 0.1% precision)
 *
 * Uses the router's `add_liquidity_single_sy_with_approx` function.
 *
 * @returns (sy_used, pt_used, lp_minted) - Actual amounts used and LP received
 * @see i_router.cairo lines 191-209
 */
export function useAddLiquiditySingleSyWithApprox(): UseAddLiquiditySingleSyWithApproxReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (
      params: AddLiquiditySingleSyWithApproxParams
    ): Promise<AddLiquiditySingleSyWithApproxResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      const routerAddress = addresses.router;

      const calls: Call[] = [];

      // Approve SY to router
      const syContract = getERC20Contract(params.syAddress, account);
      const approveCall = syContract.populate('approve', [
        routerAddress,
        uint256.bnToUint256(params.syAmount),
      ]);
      calls.push(approveCall);

      // Use provided approx params or defaults
      const approxParams = params.approxParams ?? DEFAULT_APPROX_PARAMS;

      // Build add liquidity call with serialized ApproxParams
      // Router function: add_liquidity_single_sy_with_approx(market, receiver, amount_sy_in, min_lp_out, approx, deadline)
      const [syAmountLow, syAmountHigh] = serializeU256(params.syAmount);
      const [minLpOutLow, minLpOutHigh] = serializeU256(params.minLpOut);
      const deadline = getDeadline();

      const addLiquidityCalldata = [
        params.marketAddress, // market
        address, // receiver
        syAmountLow, // amount_sy_in.low
        syAmountHigh, // amount_sy_in.high
        minLpOutLow, // min_lp_out.low
        minLpOutHigh, // min_lp_out.high
        ...serializeApproxParams(approxParams), // approx: ApproxParams (10 felts)
        deadline.toString(), // deadline
      ];

      const addLiquidityCall: Call = {
        contractAddress: routerAddress,
        entrypoint: 'add_liquidity_single_sy_with_approx',
        calldata: addLiquidityCalldata,
      };
      calls.push(addLiquidityCall);

      // Execute multicall
      const result = await account.execute(calls);

      return {
        transactionHash: result.transaction_hash,
        // These values will be updated after tx confirmation from events
        syUsed: params.syAmount,
        ptUsed: 0n,
        lpMinted: params.minLpOut,
      };
    },

    /**
     * Optimistic UI: Update SY and LP balances immediately
     */
    onMutate: async (
      params: AddLiquiditySingleSyWithApproxParams
    ): Promise<OptimisticContext> => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.syAddress, address],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.marketAddress, address],
      });

      // Snapshot previous values for rollback
      const previousSyBalance = queryClient.getQueryData<string>([
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
      if (previousSyBalance !== undefined) {
        const newBalance = BigInt(previousSyBalance) - params.syAmount;
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

      return { previousSyBalance, previousLpBalance };
    },

    /**
     * Rollback optimistic update on error
     */
    onError: (_err, params, context) => {
      if (context) {
        // Restore previous SY balance
        if (context.previousSyBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.syAddress, address],
            context.previousSyBalance
          );
        }
        // Restore previous LP balance
        if (context.previousLpBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.marketAddress, address],
            context.previousLpBalance
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
      void queryClient.invalidateQueries({ queryKey: ['lp-balance'] });
    },
  });

  return {
    addLiquiditySingleSyWithApprox: mutation.mutate,
    addLiquiditySingleSyWithApproxAsync: mutation.mutateAsync,
    isAdding: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
    reset: mutation.reset,
  };
}

/**
 * Build calls for adding single-sided SY liquidity with ApproxParams (for gas estimation)
 */
export function buildAddLiquiditySingleSyWithApproxCalls(
  routerAddress: string,
  userAddress: string,
  params: AddLiquiditySingleSyWithApproxParams
): Call[] {
  const calls: Call[] = [];

  // Approve SY
  const [syLow, syHigh] = serializeU256(params.syAmount);
  calls.push({
    contractAddress: params.syAddress,
    entrypoint: 'approve',
    calldata: [routerAddress, syLow, syHigh],
  });

  // Use provided approx params or defaults
  const approxParams = params.approxParams ?? DEFAULT_APPROX_PARAMS;

  // Add liquidity single SY with approx
  const [minLpOutLow, minLpOutHigh] = serializeU256(params.minLpOut);
  calls.push({
    contractAddress: routerAddress,
    entrypoint: 'add_liquidity_single_sy_with_approx',
    calldata: [
      params.marketAddress,
      userAddress,
      syLow,
      syHigh,
      minLpOutLow,
      minLpOutHigh,
      ...serializeApproxParams(approxParams),
      getDeadline().toString(),
    ],
  });

  return calls;
}
