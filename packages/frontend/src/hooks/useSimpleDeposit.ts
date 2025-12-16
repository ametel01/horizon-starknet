'use client';

import { useCallback, useMemo } from 'react';
import { type Call, uint256 } from 'starknet';

import { getAddresses } from '@/lib/constants/addresses';
import { toWad } from '@/lib/math/wad';

import { useAccount } from './useAccount';
import { useStarknet } from './useStarknet';
import { useTokenAllowance, useTokenBalance } from './useTokenBalance';
import { useTransaction } from './useTransaction';

interface UseSimpleDepositParams {
  underlyingAddress: string;
  syAddress: string;
  ytAddress: string;
}

interface UseSimpleDepositReturn {
  // Balances
  underlyingBalance: bigint | undefined;
  underlyingBalanceLoading: boolean;

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

  // Check if underlying approval is needed for SY
  const needsUnderlyingApproval = useCallback(
    (amount: bigint): boolean => {
      if (underlyingAllowance === undefined) return true;
      return underlyingAllowance < amount;
    },
    [underlyingAllowance]
  );

  // Check if SY approval is needed for router
  const needsSyApproval = useCallback(
    (amount: bigint): boolean => {
      if (syAllowance === undefined) return true;
      return syAllowance < amount;
    },
    [syAllowance]
  );

  // Build combined deposit calls (approve underlying + wrap + approve SY + mint)
  const buildDepositCalls = useCallback(
    (amountWad: bigint): Call[] => {
      if (!userAddress) {
        throw new Error('Wallet not connected');
      }

      const calls: Call[] = [];
      const u256Amount = uint256.bnToUint256(amountWad);

      // Step 1: Approve underlying → SY (if needed)
      if (needsUnderlyingApproval(amountWad)) {
        calls.push({
          contractAddress: underlyingAddress,
          entrypoint: 'approve',
          calldata: [syAddress, u256Amount.low, u256Amount.high],
        });
      }

      // Step 2: Wrap underlying → SY
      // SY.deposit(receiver, amount_shares_to_deposit) -> amount_sy_minted
      calls.push({
        contractAddress: syAddress,
        entrypoint: 'deposit',
        calldata: [userAddress, u256Amount.low, u256Amount.high],
      });

      // Step 3: Approve SY → Router (if needed)
      // Note: After wrap, we'll have amountWad of SY (1:1 ratio)
      if (needsSyApproval(amountWad)) {
        calls.push({
          contractAddress: syAddress,
          entrypoint: 'approve',
          calldata: [routerAddress, u256Amount.low, u256Amount.high],
        });
      }

      // Step 4: Mint PT + YT from SY
      // router.mint_py_from_sy(yt, receiver, amount_sy_in, min_py_out)
      // Default slippage: 0.5% (min_py_out = amount * 0.995)
      const minPyOut = (amountWad * BigInt(995)) / BigInt(1000);
      const u256MinPy = uint256.bnToUint256(minPyOut);

      calls.push({
        contractAddress: routerAddress,
        entrypoint: 'mint_py_from_sy',
        calldata: [
          ytAddress,
          userAddress,
          u256Amount.low,
          u256Amount.high,
          u256MinPy.low,
          u256MinPy.high,
        ],
      });

      return calls;
    },
    [
      userAddress,
      underlyingAddress,
      syAddress,
      ytAddress,
      routerAddress,
      needsUnderlyingApproval,
      needsSyApproval,
    ]
  );

  // Execute combined deposit
  const deposit = useCallback(
    async (amount: string): Promise<void> => {
      if (!amount || amount === '0') {
        return;
      }

      const amountWad = toWad(amount);
      const calls = buildDepositCalls(amountWad);
      const result = await execute(calls);

      if (result) {
        // Refetch balances after successful deposit
        await Promise.all([
          refetchUnderlyingBalance(),
          refetchUnderlyingAllowance(),
          refetchSyAllowance(),
        ]);
      }
    },
    [
      buildDepositCalls,
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
      deposit,
      status,
      txHash,
      error,
      isLoading,
      reset,
    }),
    [underlyingBalance, underlyingBalanceLoading, deposit, status, txHash, error, isLoading, reset]
  );
}
