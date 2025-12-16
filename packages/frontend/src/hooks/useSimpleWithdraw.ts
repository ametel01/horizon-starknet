'use client';

import { useCallback, useMemo } from 'react';
import { type Call, uint256 } from 'starknet';

import { getAddresses } from '@/lib/constants/addresses';

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

  // Check if approval is needed
  const needsPtApproval = useCallback(
    (amount: bigint): boolean => {
      if (ptAllowance === undefined) return true;
      return ptAllowance < amount;
    },
    [ptAllowance]
  );

  const needsYtApproval = useCallback(
    (amount: bigint): boolean => {
      if (ytAllowance === undefined) return true;
      return ytAllowance < amount;
    },
    [ytAllowance]
  );

  // Build withdraw calls
  const buildWithdrawCalls = useCallback(
    (amount: bigint): Call[] => {
      if (!userAddress) {
        throw new Error('Wallet not connected');
      }

      const calls: Call[] = [];
      const u256Amount = uint256.bnToUint256(amount);

      // Default slippage: 0.5%
      const minSyOut = (amount * BigInt(995)) / BigInt(1000);
      const u256MinSy = uint256.bnToUint256(minSyOut);

      if (isExpired) {
        // Post-expiry: Only need PT approval and redeem
        if (needsPtApproval(amount)) {
          calls.push({
            contractAddress: ptAddress,
            entrypoint: 'approve',
            calldata: [routerAddress, u256Amount.low, u256Amount.high],
          });
        }

        // Redeem PT post expiry → SY
        calls.push({
          contractAddress: routerAddress,
          entrypoint: 'redeem_pt_post_expiry',
          calldata: [
            ytAddress,
            userAddress,
            u256Amount.low,
            u256Amount.high,
            u256MinSy.low,
            u256MinSy.high,
          ],
        });
      } else {
        // Pre-expiry: Need both PT and YT approval and redeem
        if (needsPtApproval(amount)) {
          calls.push({
            contractAddress: ptAddress,
            entrypoint: 'approve',
            calldata: [routerAddress, u256Amount.low, u256Amount.high],
          });
        }

        if (needsYtApproval(amount)) {
          calls.push({
            contractAddress: ytAddress,
            entrypoint: 'approve',
            calldata: [routerAddress, u256Amount.low, u256Amount.high],
          });
        }

        // Redeem PT + YT → SY
        calls.push({
          contractAddress: routerAddress,
          entrypoint: 'redeem_py_to_sy',
          calldata: [
            ytAddress,
            userAddress,
            u256Amount.low,
            u256Amount.high,
            u256MinSy.low,
            u256MinSy.high,
          ],
        });
      }

      // Unwrap SY → underlying
      // After redeem, we expect ~amount of SY (with slippage already accounted for above)
      calls.push({
        contractAddress: syAddress,
        entrypoint: 'redeem',
        calldata: [userAddress, u256MinSy.low, u256MinSy.high],
      });

      return calls;
    },
    [
      userAddress,
      isExpired,
      ptAddress,
      ytAddress,
      syAddress,
      routerAddress,
      needsPtApproval,
      needsYtApproval,
    ]
  );

  // Execute withdraw
  const withdraw = useCallback(
    async (amount: bigint): Promise<void> => {
      if (amount === BigInt(0)) {
        return;
      }

      const calls = buildWithdrawCalls(amount);
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
      buildWithdrawCalls,
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
