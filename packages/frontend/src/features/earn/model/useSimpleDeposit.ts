'use client';

import { useTokenAllowance, useTokenBalance } from '@features/portfolio';
import { useAccount, useStarknet } from '@features/wallet';
import { getAddresses } from '@shared/config/addresses';
import { useTransaction } from '@shared/hooks/useTransaction';
import { toWad } from '@shared/math/wad';
import { buildDepositAndEarnCalls } from '@shared/starknet';
import { useCallback, useMemo } from 'react';

interface UseSimpleDepositParams {
  underlyingAddress: string;
  syAddress: string;
  ytAddress: string;
}

interface UseSimpleDepositReturn {
  // Balances
  underlyingBalance: bigint | undefined;
  underlyingBalanceLoading: boolean;

  // Allowances (for gas estimation)
  underlyingAllowance: bigint | undefined;
  syAllowance: bigint | undefined;

  // Transaction
  deposit: (amount: string) => Promise<void>;
  status: 'idle' | 'signing' | 'pending' | 'success' | 'error';
  txHash: string | null;
  error: Error | null;
  isLoading: boolean;
  reset: () => void;
}

/**
 * Combined hook for simple mode deposit flow.
 * Executes wrap (underlying → SY) + mint (SY → PT + YT) in a single multicall transaction.
 */
export function useSimpleDeposit({
  underlyingAddress,
  syAddress,
  ytAddress,
}: UseSimpleDepositParams): UseSimpleDepositReturn {
  const { network } = useStarknet();
  const { address: userAddress } = useAccount();
  const addresses = getAddresses(network);
  const routerAddress = addresses.router;

  // Fetch underlying balance
  const {
    data: underlyingBalance,
    isLoading: underlyingBalanceLoading,
    refetch: refetchUnderlyingBalance,
  } = useTokenBalance(underlyingAddress);

  // Fetch underlying allowance for SY contract (for wrap step)
  const { data: underlyingAllowance, refetch: refetchUnderlyingAllowance } = useTokenAllowance(
    underlyingAddress,
    syAddress
  );

  // Fetch SY allowance for router (for mint step)
  const { data: syAllowance, refetch: refetchSyAllowance } = useTokenAllowance(
    syAddress,
    routerAddress
  );

  // Transaction handling
  const { execute, status, txHash, error, isLoading, reset } = useTransaction();

  // Execute combined deposit
  const deposit = useCallback(
    async (amount: string): Promise<void> => {
      if (!amount || amount === '0' || !userAddress) {
        return;
      }

      let amountWad: bigint;
      try {
        amountWad = toWad(amount);
      } catch {
        // Invalid amount format
        return;
      }

      // Use transaction builder to create calls
      const calls = buildDepositAndEarnCalls({
        userAddress,
        underlyingAddress,
        syAddress,
        ytAddress,
        routerAddress,
        amount: amountWad,
        underlyingAllowance,
        syAllowance,
      });

      const result = await execute(calls);

      if (result) {
        // Refetch balances after successful deposit (use allSettled to ensure all refetches are attempted)
        await Promise.allSettled([
          refetchUnderlyingBalance(),
          refetchUnderlyingAllowance(),
          refetchSyAllowance(),
        ]);
      }
    },
    [
      userAddress,
      underlyingAddress,
      syAddress,
      ytAddress,
      routerAddress,
      underlyingAllowance,
      syAllowance,
      execute,
      refetchUnderlyingBalance,
      refetchUnderlyingAllowance,
      refetchSyAllowance,
    ]
  );

  return useMemo(
    () => ({
      underlyingBalance,
      underlyingBalanceLoading,
      underlyingAllowance,
      syAllowance,
      deposit,
      status,
      txHash,
      error,
      isLoading,
      reset,
    }),
    [
      underlyingBalance,
      underlyingBalanceLoading,
      underlyingAllowance,
      syAllowance,
      deposit,
      status,
      txHash,
      error,
      isLoading,
      reset,
    ]
  );
}
