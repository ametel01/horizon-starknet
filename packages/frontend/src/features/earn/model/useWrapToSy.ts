'use client';

import { useCallback, useMemo } from 'react';
import { type Call, uint256 } from 'starknet';

import { useTokenAllowance, useTokenBalance } from '@features/portfolio';
import { useTransactionSettings } from '@features/tx-settings';
import { useAccount } from '@features/wallet';
import { useTransaction } from '@shared/hooks/useTransaction';
import { toWad } from '@shared/math/wad';
import { calculateMinOutput } from '@shared/starknet/transaction-builder';

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

  // For gas estimation
  buildWrapCalls: (amountWad: bigint) => Call[];
}

export function useWrapToSy({
  underlyingAddress,
  syAddress,
}: UseWrapToSyParams): UseWrapToSyReturn {
  const { address: userAddress } = useAccount();
  const { slippageBps } = useTransactionSettings();

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
      // SY.deposit(receiver, amount, min_shares_out) -> amount_sy_minted
      const u256Amount = uint256.bnToUint256(amountWad);
      const minSharesOut = calculateMinOutput(amountWad, slippageBps);
      const u256MinSharesOut = uint256.bnToUint256(minSharesOut);
      calls.push({
        contractAddress: syAddress,
        entrypoint: 'deposit',
        calldata: [
          userAddress, // receiver
          u256Amount.low,
          u256Amount.high, // amount
          u256MinSharesOut.low,
          u256MinSharesOut.high, // min_shares_out
        ],
      });

      return calls;
    },
    [userAddress, underlyingAddress, syAddress, needsApproval, slippageBps]
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
      buildWrapCalls,
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
      buildWrapCalls,
    ]
  );
}
