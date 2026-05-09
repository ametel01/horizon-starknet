'use client';

import {
  serializeTokenInput,
  serializeTokenOutput,
  serializeU256,
} from '@features/swap/lib/calldata';
import type { TokenInput, TokenOutput } from '@features/swap/model/types';
import { useAccount, useStarknet } from '@features/wallet';
import { getAddresses } from '@shared/config/addresses';
import { getDeadline } from '@shared/lib/deadline';
import { getERC20Contract } from '@shared/starknet/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Call, uint256 } from 'starknet';

/**
 * Parameters for adding liquidity with any token via aggregator
 */
interface AddLiquiditySingleTokenParams {
  /** Market address */
  marketAddress: string;
  /** Token input with aggregator swap data */
  input: TokenInput;
  /** Minimum LP tokens to receive (slippage protection) */
  minLpOut: bigint;
}

/**
 * Result from add liquidity single token operation
 * The router returns (lp_out, sy_used, pt_used)
 */
interface AddLiquiditySingleTokenResult {
  transactionHash: string;
  lpOut: bigint;
  syUsed: bigint;
  ptUsed: bigint;
}

interface UseAddLiquiditySingleTokenReturn {
  addLiquidity: (params: AddLiquiditySingleTokenParams) => void;
  addLiquidityAsync: (
    params: AddLiquiditySingleTokenParams
  ) => Promise<AddLiquiditySingleTokenResult>;
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
  previousInputBalance: string | undefined;
  previousLpBalance: string | undefined;
  inputTokenAddress: string;
}

/**
 * Hook for adding liquidity with any token via aggregator.
 *
 * Flow: token_in -> aggregator -> underlying -> SY deposit -> mint PT+YT -> add liquidity
 *
 * Uses the router's `add_liquidity_single_token` function which handles:
 * 1. Transferring input token from user
 * 2. Swapping through aggregator to get underlying
 * 3. Depositing underlying into SY
 * 4. Minting PT+YT from SY
 * 5. Adding PT+SY liquidity to the market
 *
 * @see i_router.cairo lines 565-572
 */
export function useAddLiquiditySingleToken(): UseAddLiquiditySingleTokenReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (
      params: AddLiquiditySingleTokenParams
    ): Promise<AddLiquiditySingleTokenResult> => {
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

      // Build add liquidity call with serialized TokenInput
      // Router function: add_liquidity_single_token(market, receiver, input, min_lp_out, deadline)
      const [minLpOutLow, minLpOutHigh] = serializeU256(params.minLpOut);
      const deadline = getDeadline();

      const addLiquidityCalldata = [
        params.marketAddress, // market
        address, // receiver
        ...serializeTokenInput(params.input), // input: TokenInput
        minLpOutLow, // min_lp_out.low
        minLpOutHigh, // min_lp_out.high
        deadline.toString(), // deadline
      ];

      const addLiquidityCall: Call = {
        contractAddress: routerAddress,
        entrypoint: 'add_liquidity_single_token',
        calldata: addLiquidityCalldata,
      };
      calls.push(addLiquidityCall);

      // Execute multicall
      const result = await account.execute(calls);

      // Return with placeholder values - actual values come from tx receipt
      return {
        transactionHash: result.transaction_hash,
        lpOut: params.minLpOut, // Will be updated after tx confirmation
        syUsed: 0n,
        ptUsed: 0n,
      };
    },

    /**
     * Optimistic UI: Update input token and LP balances immediately
     */
    onMutate: async (params: AddLiquiditySingleTokenParams): Promise<OptimisticContext> => {
      const inputTokenAddress = params.input.token;

      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ['token-balance', inputTokenAddress, address],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.marketAddress, address],
      });

      // Snapshot previous values for rollback
      const previousInputBalance = queryClient.getQueryData<string>([
        'token-balance',
        inputTokenAddress,
        address,
      ]);
      const previousLpBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.marketAddress,
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

      // Optimistically update LP balance (increase by minLpOut)
      if (previousLpBalance !== undefined) {
        const newLpBalance = BigInt(previousLpBalance) + params.minLpOut;
        queryClient.setQueryData(
          ['token-balance', params.marketAddress, address],
          newLpBalance.toString()
        );
      }

      return {
        previousInputBalance,
        previousLpBalance,
        inputTokenAddress,
      };
    },

    /**
     * Rollback optimistic update on error
     */
    onError: (_err, params, context) => {
      if (context) {
        if (context.previousInputBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', context.inputTokenAddress, address],
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
    addLiquidity: mutation.mutate,
    addLiquidityAsync: mutation.mutateAsync,
    isAdding: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
    reset: mutation.reset,
  };
}

/**
 * Build calls for adding liquidity with any token (for gas estimation)
 */
export function buildAddLiquiditySingleTokenCalls(
  routerAddress: string,
  userAddress: string,
  params: AddLiquiditySingleTokenParams
): Call[] {
  const calls: Call[] = [];

  // Approve input token
  const [amountLow, amountHigh] = serializeU256(params.input.amount);
  calls.push({
    contractAddress: params.input.token,
    entrypoint: 'approve',
    calldata: [routerAddress, amountLow, amountHigh],
  });

  // Add liquidity single token
  const [minLpOutLow, minLpOutHigh] = serializeU256(params.minLpOut);
  calls.push({
    contractAddress: routerAddress,
    entrypoint: 'add_liquidity_single_token',
    calldata: [
      params.marketAddress,
      userAddress,
      ...serializeTokenInput(params.input),
      minLpOutLow,
      minLpOutHigh,
      getDeadline().toString(),
    ],
  });

  return calls;
}

/**
 * Parameters for adding liquidity while keeping YT tokens
 */
interface AddLiquiditySingleTokenKeepYtParams {
  /** Market address */
  marketAddress: string;
  /** YT contract address (for optimistic balance update) */
  ytAddress: string;
  /** Token input with aggregator swap data */
  input: TokenInput;
  /** Minimum LP tokens to receive (slippage protection) */
  minLpOut: bigint;
  /** Minimum YT tokens to receive (slippage protection) */
  minYtOut: bigint;
}

/**
 * Result from add liquidity single token keep YT operation
 * The router returns (lp_minted, yt_received)
 */
interface AddLiquiditySingleTokenKeepYtResult {
  transactionHash: string;
  lpMinted: bigint;
  ytReceived: bigint;
}

interface UseAddLiquiditySingleTokenKeepYtReturn {
  addLiquidityKeepYt: (params: AddLiquiditySingleTokenKeepYtParams) => void;
  addLiquidityKeepYtAsync: (
    params: AddLiquiditySingleTokenKeepYtParams
  ) => Promise<AddLiquiditySingleTokenKeepYtResult>;
  isAdding: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

/**
 * Context for optimistic update rollback (keep YT variant)
 */
interface KeepYtOptimisticContext {
  previousInputBalance: string | undefined;
  previousLpBalance: string | undefined;
  previousYtBalance: string | undefined;
  inputTokenAddress: string;
  marketAddress: string;
  ytAddress: string;
}

/**
 * Hook for adding liquidity with any token while keeping minted YT tokens.
 *
 * Flow: token_in -> aggregator -> underlying -> SY deposit -> mint PT+YT -> add liquidity with PT -> keep YT
 *
 * Uses the router's `add_liquidity_single_token_keep_yt` function which handles:
 * 1. Transferring input token from user
 * 2. Swapping through aggregator to get underlying
 * 3. Depositing underlying into SY
 * 4. Minting PT+YT from SY
 * 5. Adding PT+SY liquidity to the market (using only PT)
 * 6. Returning YT tokens to the user
 *
 * @see i_router.cairo lines 574-592
 */
export function useAddLiquiditySingleTokenKeepYt(): UseAddLiquiditySingleTokenKeepYtReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (
      params: AddLiquiditySingleTokenKeepYtParams
    ): Promise<AddLiquiditySingleTokenKeepYtResult> => {
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

      // Build add liquidity keep YT call with serialized TokenInput
      // Router function: add_liquidity_single_token_keep_yt(market, receiver, input, min_lp_out, min_yt_out, deadline)
      const [minLpOutLow, minLpOutHigh] = serializeU256(params.minLpOut);
      const [minYtOutLow, minYtOutHigh] = serializeU256(params.minYtOut);
      const deadline = getDeadline();

      const addLiquidityCalldata = [
        params.marketAddress, // market
        address, // receiver
        ...serializeTokenInput(params.input), // input: TokenInput
        minLpOutLow, // min_lp_out.low
        minLpOutHigh, // min_lp_out.high
        minYtOutLow, // min_yt_out.low
        minYtOutHigh, // min_yt_out.high
        deadline.toString(), // deadline
      ];

      const addLiquidityCall: Call = {
        contractAddress: routerAddress,
        entrypoint: 'add_liquidity_single_token_keep_yt',
        calldata: addLiquidityCalldata,
      };
      calls.push(addLiquidityCall);

      // Execute multicall
      const result = await account.execute(calls);

      // Return with placeholder values - actual values come from tx receipt
      return {
        transactionHash: result.transaction_hash,
        lpMinted: params.minLpOut, // Will be updated after tx confirmation
        ytReceived: params.minYtOut, // Will be updated after tx confirmation
      };
    },

    /**
     * Optimistic UI: Update input token, LP, and YT balances immediately
     */
    onMutate: async (
      params: AddLiquiditySingleTokenKeepYtParams
    ): Promise<KeepYtOptimisticContext> => {
      const inputTokenAddress = params.input.token;
      const { ytAddress } = params;

      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: ['token-balance', inputTokenAddress, address],
        }),
        queryClient.cancelQueries({
          queryKey: ['token-balance', params.marketAddress, address],
        }),
        queryClient.cancelQueries({
          queryKey: ['token-balance', ytAddress, address],
        }),
      ]);

      // Snapshot previous values for rollback
      const previousInputBalance = queryClient.getQueryData<string>([
        'token-balance',
        inputTokenAddress,
        address,
      ]);
      const previousLpBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.marketAddress,
        address,
      ]);
      const previousYtBalance = queryClient.getQueryData<string>([
        'token-balance',
        ytAddress,
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

      // Optimistically update LP balance (increase by minLpOut)
      if (previousLpBalance !== undefined) {
        const newLpBalance = BigInt(previousLpBalance) + params.minLpOut;
        queryClient.setQueryData(
          ['token-balance', params.marketAddress, address],
          newLpBalance.toString()
        );
      }

      // Optimistically update YT balance (increase by minYtOut)
      if (previousYtBalance !== undefined) {
        const newYtBalance = BigInt(previousYtBalance) + params.minYtOut;
        queryClient.setQueryData(['token-balance', ytAddress, address], newYtBalance.toString());
      }

      return {
        previousInputBalance,
        previousLpBalance,
        previousYtBalance,
        inputTokenAddress,
        marketAddress: params.marketAddress,
        ytAddress,
      };
    },

    /**
     * Rollback optimistic update on error
     */
    onError: (_err, _params, context) => {
      if (context) {
        if (context.previousInputBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', context.inputTokenAddress, address],
            context.previousInputBalance
          );
        }
        if (context.previousLpBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', context.marketAddress, address],
            context.previousLpBalance
          );
        }
        if (context.previousYtBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', context.ytAddress, address],
            context.previousYtBalance
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
    addLiquidityKeepYt: mutation.mutate,
    addLiquidityKeepYtAsync: mutation.mutateAsync,
    isAdding: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
    reset: mutation.reset,
  };
}

/**
 * Build calls for adding liquidity while keeping YT (for gas estimation)
 */
export function buildAddLiquiditySingleTokenKeepYtCalls(
  routerAddress: string,
  userAddress: string,
  params: AddLiquiditySingleTokenKeepYtParams
): Call[] {
  const calls: Call[] = [];

  // Approve input token
  const [amountLow, amountHigh] = serializeU256(params.input.amount);
  calls.push({
    contractAddress: params.input.token,
    entrypoint: 'approve',
    calldata: [routerAddress, amountLow, amountHigh],
  });

  // Add liquidity single token keep YT
  const [minLpOutLow, minLpOutHigh] = serializeU256(params.minLpOut);
  const [minYtOutLow, minYtOutHigh] = serializeU256(params.minYtOut);
  calls.push({
    contractAddress: routerAddress,
    entrypoint: 'add_liquidity_single_token_keep_yt',
    calldata: [
      params.marketAddress,
      userAddress,
      ...serializeTokenInput(params.input),
      minLpOutLow,
      minLpOutHigh,
      minYtOutLow,
      minYtOutHigh,
      getDeadline().toString(),
    ],
  });

  return calls;
}

/**
 * Parameters for removing liquidity and receiving any token via aggregator
 */
interface RemoveLiquiditySingleTokenParams {
  /** Market address (also the LP token address) */
  marketAddress: string;
  /** Amount of LP tokens to burn */
  lpToBurn: bigint;
  /** Token output with aggregator swap data and min amount */
  output: TokenOutput;
}

/**
 * Result from remove liquidity single token operation
 * The router returns the amount of output token received
 */
interface RemoveLiquiditySingleTokenResult {
  transactionHash: string;
  amountOut: bigint;
}

interface UseRemoveLiquiditySingleTokenReturn {
  removeLiquidity: (params: RemoveLiquiditySingleTokenParams) => void;
  removeLiquidityAsync: (
    params: RemoveLiquiditySingleTokenParams
  ) => Promise<RemoveLiquiditySingleTokenResult>;
  isRemoving: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionHash: string | undefined;
  reset: () => void;
}

/**
 * Context for optimistic update rollback (remove liquidity)
 */
interface RemoveLiquidityOptimisticContext {
  previousLpBalance: string | undefined;
  previousOutputBalance: string | undefined;
  outputTokenAddress: string;
}

/**
 * Hook for removing liquidity and receiving any token via aggregator.
 *
 * Flow: LP -> burn -> SY + PT -> swap PT for SY -> redeem SY -> underlying -> aggregator -> token_out
 *
 * Uses the router's `remove_liquidity_single_token` function which handles:
 * 1. Burning LP tokens from market
 * 2. Receiving SY and PT from the market
 * 3. Swapping PT for SY
 * 4. Redeeming SY for underlying
 * 5. Swapping underlying through aggregator to output token
 *
 * @see i_router.cairo lines 603-610
 */
export function useRemoveLiquiditySingleToken(): UseRemoveLiquiditySingleTokenReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();
  const addresses = getAddresses(network);

  const mutation = useMutation({
    mutationFn: async (
      params: RemoveLiquiditySingleTokenParams
    ): Promise<RemoveLiquiditySingleTokenResult> => {
      if (!account || !address) {
        throw new Error('Wallet not connected');
      }

      const routerAddress = addresses.router;

      const calls: Call[] = [];

      // Approve LP tokens (market) to router for burning
      const lpContract = getERC20Contract(params.marketAddress, account);
      const approveLpCall = lpContract.populate('approve', [
        routerAddress,
        uint256.bnToUint256(params.lpToBurn),
      ]);
      calls.push(approveLpCall);

      // Build remove liquidity call with serialized TokenOutput
      // Router function: remove_liquidity_single_token(market, receiver, lp_to_burn, output, deadline)
      const [lpToBurnLow, lpToBurnHigh] = serializeU256(params.lpToBurn);
      const deadline = getDeadline();

      const removeLiquidityCalldata = [
        params.marketAddress, // market
        address, // receiver
        lpToBurnLow, // lp_to_burn.low
        lpToBurnHigh, // lp_to_burn.high
        ...serializeTokenOutput(params.output), // output: TokenOutput
        deadline.toString(), // deadline
      ];

      const removeLiquidityCall: Call = {
        contractAddress: routerAddress,
        entrypoint: 'remove_liquidity_single_token',
        calldata: removeLiquidityCalldata,
      };
      calls.push(removeLiquidityCall);

      // Execute multicall
      const result = await account.execute(calls);

      // Return with placeholder values - actual values come from tx receipt
      return {
        transactionHash: result.transaction_hash,
        amountOut: params.output.min_amount, // Will be updated after tx confirmation
      };
    },

    /**
     * Optimistic UI: Update LP and output token balances immediately
     */
    onMutate: async (
      params: RemoveLiquiditySingleTokenParams
    ): Promise<RemoveLiquidityOptimisticContext> => {
      const outputTokenAddress = params.output.token;

      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.marketAddress, address],
      });
      await queryClient.cancelQueries({
        queryKey: ['token-balance', outputTokenAddress, address],
      });

      // Snapshot previous values for rollback
      const previousLpBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.marketAddress,
        address,
      ]);
      const previousOutputBalance = queryClient.getQueryData<string>([
        'token-balance',
        outputTokenAddress,
        address,
      ]);

      // Optimistically update LP balance (decrease)
      if (previousLpBalance !== undefined) {
        const newLpBalance = BigInt(previousLpBalance) - params.lpToBurn;
        queryClient.setQueryData(
          ['token-balance', params.marketAddress, address],
          (newLpBalance > 0n ? newLpBalance : 0n).toString()
        );
      }

      // Optimistically update output token balance (increase by min_amount)
      if (previousOutputBalance !== undefined) {
        const newOutputBalance = BigInt(previousOutputBalance) + params.output.min_amount;
        queryClient.setQueryData(
          ['token-balance', outputTokenAddress, address],
          newOutputBalance.toString()
        );
      }

      return {
        previousLpBalance,
        previousOutputBalance,
        outputTokenAddress,
      };
    },

    /**
     * Rollback optimistic update on error
     */
    onError: (_err, params, context) => {
      if (context) {
        if (context.previousLpBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', params.marketAddress, address],
            context.previousLpBalance
          );
        }
        if (context.previousOutputBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', context.outputTokenAddress, address],
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
      void queryClient.invalidateQueries({ queryKey: ['lp-balance'] });
    },
  });

  return {
    removeLiquidity: mutation.mutate,
    removeLiquidityAsync: mutation.mutateAsync,
    isRemoving: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    transactionHash: mutation.data?.transactionHash,
    reset: mutation.reset,
  };
}

/**
 * Build calls for removing liquidity with any token output (for gas estimation)
 */
export function buildRemoveLiquiditySingleTokenCalls(
  routerAddress: string,
  userAddress: string,
  params: RemoveLiquiditySingleTokenParams
): Call[] {
  const calls: Call[] = [];

  // Approve LP tokens for burning
  const [lpToBurnLow, lpToBurnHigh] = serializeU256(params.lpToBurn);
  calls.push({
    contractAddress: params.marketAddress,
    entrypoint: 'approve',
    calldata: [routerAddress, lpToBurnLow, lpToBurnHigh],
  });

  // Remove liquidity single token
  calls.push({
    contractAddress: routerAddress,
    entrypoint: 'remove_liquidity_single_token',
    calldata: [
      params.marketAddress,
      userAddress,
      lpToBurnLow,
      lpToBurnHigh,
      ...serializeTokenOutput(params.output),
      getDeadline().toString(),
    ],
  });

  return calls;
}
