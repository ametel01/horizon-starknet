'use client';

import { useCallback, useMemo } from 'react';

import { getAddresses } from '@/lib/constants/addresses';
import { buildWithdrawCalls } from '@/lib/transaction-builder';

import { useAccount } from './useAccount';
import { useStarknet } from './useStarknet';
import { useTokenAllowance, useTokenBalance } from './useTokenBalance';
import { useTransaction } from './useTransaction';

interface UseSimpleWithdrawParams {
  underlyingAddress: string;
  syAddress: string;
  ptAddress: string;
  ytAddress: string;
  isExpired: boolean;
}

interface UseSimpleWithdrawReturn {
  // Balances
  ptBalance: bigint | undefined;
  ytBalance: bigint | undefined;
  balancesLoading: boolean;

  // Transaction
  withdraw: (amount: bigint) => Promise<void>;
  status: 'idle' | 'signing' | 'pending' | 'success' | 'error';
  txHash: string | null;
  error: Error | null;
  isLoading: boolean;
  reset: () => void;
}

/**
 * Combined hook for simple mode withdraw flow.
 * Pre-expiry: Redeem PT + YT → SY → underlying (requires equal PT and YT)
 * Post-expiry: Redeem PT → SY → underlying (PT only)
 */
export function useSimpleWithdraw({
  underlyingAddress,
  syAddress,
  ptAddress,
  ytAddress,
  isExpired,
}: UseSimpleWithdrawParams): UseSimpleWithdrawReturn {
  const { network } = useStarknet();
  const { address: userAddress } = useAccount();
  const addresses = getAddresses(network);
  const routerAddress = addresses.router;

  // Fetch PT balance
  const {
    data: ptBalance,
    isLoading: ptLoading,
    refetch: refetchPtBalance,
  } = useTokenBalance(ptAddress);

  // Fetch YT balance
  const {
    data: ytBalance,
    isLoading: ytLoading,
    refetch: refetchYtBalance,
  } = useTokenBalance(ytAddress);

  // Fetch underlying balance (for refresh after withdraw)
  const { refetch: refetchUnderlyingBalance } = useTokenBalance(underlyingAddress);

  // Fetch allowances
  const { data: ptAllowance, refetch: refetchPtAllowance } = useTokenAllowance(
    ptAddress,
    routerAddress
  );
  const { data: ytAllowance, refetch: refetchYtAllowance } = useTokenAllowance(
    ytAddress,
    routerAddress
  );

  // Transaction handling
  const { execute, status, txHash, error, isLoading, reset } = useTransaction();

  const balancesLoading = ptLoading || ytLoading;

  // Execute withdraw
  const withdraw = useCallback(
    async (amount: bigint): Promise<void> => {
      if (amount === BigInt(0) || !userAddress) {
        return;
      }

      // Use transaction builder to create calls
      const calls = buildWithdrawCalls({
        userAddress,
        underlyingAddress,
        syAddress,
        ptAddress,
        ytAddress,
        routerAddress,
        amount,
        isExpired,
        ptAllowance,
        ytAllowance,
      });

      const result = await execute(calls);

      if (result) {
        // Refetch balances after successful withdraw
        await Promise.all([
          refetchPtBalance(),
          refetchYtBalance(),
          refetchUnderlyingBalance(),
          refetchPtAllowance(),
          refetchYtAllowance(),
        ]);
      }
    },
    [
      userAddress,
      underlyingAddress,
      syAddress,
      ptAddress,
      ytAddress,
      routerAddress,
      isExpired,
      ptAllowance,
      ytAllowance,
      execute,
      refetchPtBalance,
      refetchYtBalance,
      refetchUnderlyingBalance,
      refetchPtAllowance,
      refetchYtAllowance,
    ]
  );

  return useMemo(
    () => ({
      ptBalance,
      ytBalance,
      balancesLoading,
      withdraw,
      status,
      txHash,
      error,
      isLoading,
      reset,
    }),
    [ptBalance, ytBalance, balancesLoading, withdraw, status, txHash, error, isLoading, reset]
  );
}
