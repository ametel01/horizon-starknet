'use client';

import { useCallback, useMemo } from 'react';
import { type Call, uint256 } from 'starknet';

import { toWad } from '@/lib/math/wad';

import { useAccount } from './useAccount';
import { useTokenAllowance, useTokenBalance } from './useTokenBalance';
import { useTransaction } from './useTransaction';

interface UseWrapToSyParams {
  underlyingAddress: string;
  syAddress: string;
}

interface UseWrapToSyReturn {
  // Balances
  underlyingBalance: bigint | undefined;
  underlyingBalanceLoading: boolean;
  syBalance: bigint | undefined;

  // Allowance
  underlyingAllowance: bigint | undefined;
  needsApproval: (amount: bigint) => boolean;

  // Transaction
  wrap: (amount: string) => Promise<void>;
  status: 'idle' | 'signing' | 'pending' | 'success' | 'error';
  txHash: string | null;
  error: Error | null;
  isLoading: boolean;
  reset: () => void;
}

export function useWrapToSy({
  underlyingAddress,
  syAddress,
}: UseWrapToSyParams): UseWrapToSyReturn {
  const { address: userAddress } = useAccount();

  // Fetch underlying balance
  const {
    data: underlyingBalance,
    isLoading: underlyingBalanceLoading,
    refetch: refetchUnderlyingBalance,
  } = useTokenBalance(underlyingAddress);

  // Fetch SY balance for display after wrap
  const { data: syBalance, refetch: refetchSyBalance } = useTokenBalance(syAddress);

  // Fetch underlying allowance for SY contract
  const { data: underlyingAllowance, refetch: refetchAllowance } = useTokenAllowance(
    underlyingAddress,
    syAddress
  );

  // Transaction handling
  const { execute, status, txHash, error, isLoading, reset } = useTransaction();

  // Check if approval is needed
  const needsApproval = useCallback(
    (amount: bigint): boolean => {
      if (underlyingAllowance === undefined) return true;
      return underlyingAllowance < amount;
    },
    [underlyingAllowance]
  );

  // Build wrap calls (approve + deposit in single multicall)
  const buildWrapCalls = useCallback(
    (amountWad: bigint): Call[] => {
      if (!userAddress) {
        throw new Error('Wallet not connected');
      }

      const calls: Call[] = [];

      // Add approval call if needed
      if (needsApproval(amountWad)) {
        const u256Amount = uint256.bnToUint256(amountWad);
        calls.push({
          contractAddress: underlyingAddress,
          entrypoint: 'approve',
          calldata: [syAddress, u256Amount.low, u256Amount.high],
        });
      }

      // Add deposit call to SY contract
      // SY.deposit(receiver, amount_shares_to_deposit) -> amount_sy_minted
      const u256Amount = uint256.bnToUint256(amountWad);
      calls.push({
        contractAddress: syAddress,
        entrypoint: 'deposit',
        calldata: [
          userAddress, // receiver
          u256Amount.low,
          u256Amount.high, // amount_shares_to_deposit
        ],
      });

      return calls;
    },
    [userAddress, underlyingAddress, syAddress, needsApproval]
  );

  // Execute wrap
  const wrap = useCallback(
    async (amount: string): Promise<void> => {
      if (!amount || amount === '0') {
        return;
      }

      // Convert to WAD (18 decimals)
      const amountWad = toWad(amount);

      const calls = buildWrapCalls(amountWad);
      const result = await execute(calls);

      if (result) {
        // Refetch balances after successful wrap
        await Promise.all([refetchUnderlyingBalance(), refetchSyBalance(), refetchAllowance()]);
      }
    },
    [buildWrapCalls, execute, refetchUnderlyingBalance, refetchSyBalance, refetchAllowance]
  );

  return useMemo(
    () => ({
      underlyingBalance,
      underlyingBalanceLoading,
      syBalance,
      underlyingAllowance,
      needsApproval,
      wrap,
      status,
      txHash,
      error,
      isLoading,
      reset,
    }),
    [
      underlyingBalance,
      underlyingBalanceLoading,
      syBalance,
      underlyingAllowance,
      needsApproval,
      wrap,
      status,
      txHash,
      error,
      isLoading,
      reset,
    ]
  );
}
