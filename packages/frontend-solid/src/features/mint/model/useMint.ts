import { getAddresses } from '@shared/config/addresses';
import { getDeadline } from '@shared/lib/deadline';
import { getERC20Contract, getRouterContract } from '@shared/starknet/contracts';
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { createMemo, type Accessor } from 'solid-js';
import { type Call, uint256 } from 'starknet';

import { useAccount, useStarknet } from '@/features/wallet';

export interface MintParams {
  syAddress: string;
  ytAddress: string;
  amountSy: bigint;
  minPyOut: bigint;
}

export interface MintResult {
  transactionHash: string;
  amountPtOut: bigint;
  amountYtOut: bigint;
}

export interface UseMintReturn {
  mint: (params: MintParams) => void;
  mintAsync: (params: MintParams) => Promise<MintResult>;
  isMinting: Accessor<boolean>;
  isSuccess: Accessor<boolean>;
  isError: Accessor<boolean>;
  error: Accessor<Error | null>;
  transactionHash: Accessor<string | undefined>;
  reset: () => void;
  buildMintCalls: (params: MintParams) => Call[];
}

/**
 * Context for optimistic update rollback
 */
interface OptimisticContext {
  previousSyBalance: string | undefined;
  previousPtBalance: string | undefined;
  previousYtBalance: string | undefined;
  syAddress: string;
  ptAddress: string;
  ytAddress: string;
}

/**
 * Hook for minting PT + YT tokens from SY on Horizon Protocol.
 * Splits SY tokens into equal amounts of Principal Token (PT) and Yield Token (YT).
 *
 * Uses @tanstack/solid-query createMutation with:
 * - Optimistic balance updates for instant perceived response
 * - Automatic rollback on error
 * - Cache invalidation on settlement
 *
 * @returns Object with reactive accessors for mint state and mutation functions
 */
export function useMint(): UseMintReturn {
  const { network } = useStarknet();
  const { account, address } = useAccount();
  const queryClient = useQueryClient();

  /**
   * Build the calls array for minting PT + YT
   * Can be used for gas estimation before executing
   */
  const buildMintCalls = (params: MintParams): Call[] => {
    const currentAccount = account();
    const currentAddress = address();

    if (!currentAccount || !currentAddress) {
      throw new Error('Wallet not connected');
    }

    const addresses = getAddresses(network);
    const routerAddress = addresses.router;

    const calls: Call[] = [];

    // Get SY contract for approval
    const syContract = getERC20Contract(params.syAddress, currentAccount);

    // Add approval call for SY
    const approveCall = syContract.populate('approve', [
      routerAddress,
      uint256.bnToUint256(params.amountSy),
    ]);
    calls.push(approveCall);

    // Get router contract for mint
    const router = getRouterContract(currentAccount, network);

    // Add mint call - mint_py_from_sy(yt, receiver, amount_sy_in, min_py_out, deadline)
    const mintCall = router.populate('mint_py_from_sy', [
      params.ytAddress,
      currentAddress,
      uint256.bnToUint256(params.amountSy),
      uint256.bnToUint256(params.minPyOut),
      getDeadline(),
    ]);
    calls.push(mintCall);

    return calls;
  };

  const mutation = createMutation(() => ({
    mutationFn: async (params: MintParams): Promise<MintResult> => {
      const currentAccount = account();

      if (!currentAccount) {
        throw new Error('Wallet not connected');
      }

      const calls = buildMintCalls(params);

      // Execute multicall
      const result = await currentAccount.execute(calls);

      // Minting produces equal PT and YT amounts (1:1 ratio)
      return {
        transactionHash: result.transaction_hash,
        amountPtOut: params.minPyOut, // Will be updated after tx confirmation
        amountYtOut: params.minPyOut, // PT and YT are minted in equal amounts
      };
    },

    /**
     * Optimistic UI: Update balances immediately for perceived speed (Doherty Threshold)
     * This creates the illusion of instant response while the blockchain confirms
     */
    onMutate: async (params: MintParams): Promise<OptimisticContext> => {
      const currentAddress = address();

      // We need to know PT address - derive it from YT contract relationship
      // For now, we'll just invalidate all token balances on settlement
      const ptAddress = ''; // Would need to fetch from YT contract

      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: ['token-balance', params.syAddress, currentAddress],
      });

      // Snapshot previous values for rollback
      const previousSyBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.syAddress,
        currentAddress,
      ]);
      const previousPtBalance = queryClient.getQueryData<string>([
        'token-balance',
        ptAddress,
        currentAddress,
      ]);
      const previousYtBalance = queryClient.getQueryData<string>([
        'token-balance',
        params.ytAddress,
        currentAddress,
      ]);

      // Optimistically update SY balance (decrease)
      if (previousSyBalance !== undefined) {
        const newSyBalance = BigInt(previousSyBalance) - params.amountSy;
        queryClient.setQueryData(
          ['token-balance', params.syAddress, currentAddress],
          (newSyBalance > 0n ? newSyBalance : 0n).toString()
        );
      }

      // Optimistically update PT and YT balances (increase by minPyOut)
      if (previousPtBalance !== undefined && ptAddress) {
        const newPtBalance = BigInt(previousPtBalance) + params.minPyOut;
        queryClient.setQueryData(
          ['token-balance', ptAddress, currentAddress],
          newPtBalance.toString()
        );
      }
      if (previousYtBalance !== undefined) {
        const newYtBalance = BigInt(previousYtBalance) + params.minPyOut;
        queryClient.setQueryData(
          ['token-balance', params.ytAddress, currentAddress],
          newYtBalance.toString()
        );
      }

      // Return context for rollback
      return {
        previousSyBalance,
        previousPtBalance,
        previousYtBalance,
        syAddress: params.syAddress,
        ptAddress,
        ytAddress: params.ytAddress,
      };
    },

    /**
     * Rollback optimistic update on error
     */
    onError: (_err: Error, _params: MintParams, context: OptimisticContext | undefined) => {
      const currentAddress = address();

      if (context) {
        // Restore previous SY balance
        if (context.previousSyBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', context.syAddress, currentAddress],
            context.previousSyBalance
          );
        }
        // Restore previous PT balance
        if (context.previousPtBalance !== undefined && context.ptAddress) {
          queryClient.setQueryData(
            ['token-balance', context.ptAddress, currentAddress],
            context.previousPtBalance
          );
        }
        // Restore previous YT balance
        if (context.previousYtBalance !== undefined) {
          queryClient.setQueryData(
            ['token-balance', context.ytAddress, currentAddress],
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
    },
  }));

  return {
    mint: mutation.mutate,
    mintAsync: mutation.mutateAsync,
    isMinting: createMemo(() => mutation.isPending),
    isSuccess: createMemo(() => mutation.isSuccess),
    isError: createMemo(() => mutation.isError),
    error: createMemo(() => mutation.error),
    transactionHash: createMemo(() => mutation.data?.transactionHash),
    reset: mutation.reset,
    buildMintCalls,
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
