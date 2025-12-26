'use client';

import { useCallback, useMemo } from 'react';
import { type Call, uint256 } from 'starknet';

import { useTokenBalance } from '@features/portfolio';
import { useAccount } from '@features/wallet';
import { useTransaction } from '@shared/hooks/useTransaction';
import { toWad } from '@shared/math/wad';

interface UseUnwrapSyParams {
  underlyingAddress: string;
  syAddress: string;
}

interface UseUnwrapSyReturn {
  // Balances
  underlyingBalance: bigint | undefined;
  syBalance: bigint | undefined;
  syBalanceLoading: boolean;

  // Transaction
  unwrap: (amount: string) => Promise<void>;
  status: 'idle' | 'signing' | 'pending' | 'success' | 'error';
  txHash: string | null;
  error: Error | null;
  isLoading: boolean;
  reset: () => void;
}

export function useUnwrapSy({
  underlyingAddress,
  syAddress,
}: UseUnwrapSyParams): UseUnwrapSyReturn {
  const { address: userAddress } = useAccount();

  // Fetch SY balance
  const {
    data: syBalance,
    isLoading: syBalanceLoading,
    refetch: refetchSyBalance,
  } = useTokenBalance(syAddress);

  // Fetch underlying balance for display after unwrap
  const { data: underlyingBalance, refetch: refetchUnderlyingBalance } =
    useTokenBalance(underlyingAddress);

  // Transaction handling
  const { execute, status, txHash, error, isLoading, reset } = useTransaction();

  // Build unwrap call
  const buildUnwrapCalls = useCallback(
    (amountWad: bigint): Call[] => {
      if (!userAddress) {
        throw new Error('Wallet not connected');
      }

      const calls: Call[] = [];

      // SY.redeem(receiver, amount_sy_to_redeem) -> amount_redeemed
      const u256Amount = uint256.bnToUint256(amountWad);
      calls.push({
        contractAddress: syAddress,
        entrypoint: 'redeem',
        calldata: [
          userAddress, // receiver
          u256Amount.low,
          u256Amount.high, // amount_sy_to_redeem
        ],
      });

      return calls;
    },
    [userAddress, syAddress]
  );

  // Execute unwrap
  const unwrap = useCallback(
    async (amount: string): Promise<void> => {
      if (!amount || amount === '0') {
        return;
      }

      // Convert to WAD (18 decimals)
      const amountWad = toWad(amount);

      const calls = buildUnwrapCalls(amountWad);
      const result = await execute(calls);

      if (result) {
        // Refetch balances after successful unwrap
        await Promise.all([refetchSyBalance(), refetchUnderlyingBalance()]);
      }
    },
    [buildUnwrapCalls, execute, refetchSyBalance, refetchUnderlyingBalance]
  );

  return useMemo(
    () => ({
      underlyingBalance,
      syBalance,
      syBalanceLoading,
      unwrap,
      status,
      txHash,
      error,
      isLoading,
      reset,
    }),
    [
      underlyingBalance,
      syBalance,
      syBalanceLoading,
      unwrap,
      status,
      txHash,
      error,
      isLoading,
      reset,
    ]
  );
}
