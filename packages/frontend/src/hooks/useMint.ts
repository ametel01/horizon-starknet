'use client';

import { useCallback, useMemo } from 'react';
import { type Call, uint256 } from 'starknet';

import { getAddresses } from '@/lib/constants/addresses';
import { getDeadline } from '@/lib/deadline';
import { toWad } from '@/lib/math/wad';

import { useAccount } from './useAccount';
import { useStarknet } from './useStarknet';
import { useTokenAllowance, useTokenBalance } from './useTokenBalance';
import { useTransaction } from './useTransaction';

interface UseMintParams {
  syAddress: string;
  ytAddress: string;
}

interface UseMintReturn {
  // Balances
  syBalance: bigint | undefined;
  syBalanceLoading: boolean;

  // Allowance
  syAllowance: bigint | undefined;
  needsApproval: (amount: bigint) => boolean;

  // Transaction
  mint: (amountSy: string, minPyOut?: bigint) => Promise<void>;
  status: 'idle' | 'signing' | 'pending' | 'success' | 'error';
  txHash: string | null;
  error: Error | null;
  isLoading: boolean;
  reset: () => void;
}

export function useMint({ syAddress, ytAddress }: UseMintParams): UseMintReturn {
  const { network } = useStarknet();
  const { address: userAddress } = useAccount();
  const addresses = getAddresses(network);
  const routerAddress = addresses.router;

  // Fetch SY balance
  const {
    data: syBalance,
    isLoading: syBalanceLoading,
    refetch: refetchBalance,
  } = useTokenBalance(syAddress);

  // Fetch SY allowance for router
  const { data: syAllowance, refetch: refetchAllowance } = useTokenAllowance(
    syAddress,
    routerAddress
  );

  // Transaction handling
  const { execute, status, txHash, error, isLoading, reset } = useTransaction();

  // Check if approval is needed
  const needsApproval = useCallback(
    (amount: bigint): boolean => {
      if (syAllowance === undefined) return true;
      return syAllowance < amount;
    },
    [syAllowance]
  );

  // Build mint calls (with optional approval)
  const buildMintCalls = useCallback(
    (amountSyWad: bigint, minPyOut: bigint): Call[] => {
      if (!userAddress) {
        throw new Error('Wallet not connected');
      }

      const calls: Call[] = [];

      // Add approval call if needed
      if (needsApproval(amountSyWad)) {
        const u256Amount = uint256.bnToUint256(amountSyWad);
        calls.push({
          contractAddress: syAddress,
          entrypoint: 'approve',
          calldata: [routerAddress, u256Amount.low, u256Amount.high],
        });
      }

      // Add mint call
      const u256AmountSy = uint256.bnToUint256(amountSyWad);
      const u256MinPy = uint256.bnToUint256(minPyOut);
      const deadline = getDeadline();
      calls.push({
        contractAddress: routerAddress,
        entrypoint: 'mint_py_from_sy',
        calldata: [
          ytAddress, // yt address
          userAddress, // receiver
          u256AmountSy.low,
          u256AmountSy.high, // amount_sy_in
          u256MinPy.low,
          u256MinPy.high, // min_py_out
          deadline.toString(), // deadline
        ],
      });

      return calls;
    },
    [userAddress, syAddress, ytAddress, routerAddress, needsApproval]
  );

  // Execute mint
  const mint = useCallback(
    async (amountSy: string, minPyOut?: bigint): Promise<void> => {
      if (!amountSy || amountSy === '0') {
        return;
      }

      // Convert to WAD
      const amountSyWad = toWad(amountSy);

      // Default slippage: 0.5% (minPyOut = amountSy * 0.995)
      const defaultMinPy = (amountSyWad * BigInt(995)) / BigInt(1000);
      const minPy = minPyOut ?? defaultMinPy;

      const calls = buildMintCalls(amountSyWad, minPy);
      const result = await execute(calls);

      if (result) {
        // Refetch balances after successful mint
        await Promise.all([refetchBalance(), refetchAllowance()]);
      }
    },
    [buildMintCalls, execute, refetchBalance, refetchAllowance]
  );

  return useMemo(
    () => ({
      syBalance,
      syBalanceLoading,
      syAllowance,
      needsApproval,
      mint,
      status,
      txHash,
      error,
      isLoading,
      reset,
    }),
    [
      syBalance,
      syBalanceLoading,
      syAllowance,
      needsApproval,
      mint,
      status,
      txHash,
      error,
      isLoading,
      reset,
    ]
  );
}
