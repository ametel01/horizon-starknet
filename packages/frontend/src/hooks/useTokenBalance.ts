'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Contract } from 'starknet';

import { getERC20Contract } from '@/lib/starknet/contracts';

import { useAccount } from './useAccount';
import { useStarknet } from './useStarknet';

// Helper to call contract methods with proper typing
async function callContract<T>(contract: Contract, method: string, args?: unknown[]): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const result = (await contract[method](...(args ?? []))) as T;
  return result;
}

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
}

export function useTokenBalance(
  tokenAddress: string | null,
  options: { enabled?: boolean; refetchInterval?: number } = {}
): UseQueryResult<bigint> {
  const { provider } = useStarknet();
  const { address } = useAccount();
  const { enabled = true, refetchInterval = 15000 } = options;

  return useQuery({
    queryKey: ['token-balance', tokenAddress, address],
    queryFn: async (): Promise<bigint> => {
      if (!tokenAddress || !address) {
        throw new Error('Token address and user address required');
      }

      const token = getERC20Contract(tokenAddress, provider);
      const balance = await callContract<bigint>(token, 'balanceOf', [address]);
      return balance;
    },
    enabled: enabled && !!tokenAddress && !!address,
    refetchInterval,
    staleTime: 5000,
  });
}

export function useTokenAllowance(
  tokenAddress: string | null,
  spenderAddress: string | null,
  options: { enabled?: boolean; refetchInterval?: number } = {}
): UseQueryResult<bigint> {
  const { provider } = useStarknet();
  const { address } = useAccount();
  const { enabled = true, refetchInterval = 15000 } = options;

  return useQuery({
    queryKey: ['token-allowance', tokenAddress, address, spenderAddress],
    queryFn: async (): Promise<bigint> => {
      if (!tokenAddress || !address || !spenderAddress) {
        throw new Error('Token, user, and spender addresses required');
      }

      const token = getERC20Contract(tokenAddress, provider);
      const allowance = await callContract<bigint>(token, 'allowance', [address, spenderAddress]);
      return allowance;
    },
    enabled: enabled && !!tokenAddress && !!address && !!spenderAddress,
    refetchInterval,
    staleTime: 5000,
  });
}

export function useTokenInfo(
  tokenAddress: string | null,
  options: { enabled?: boolean } = {}
): UseQueryResult<TokenInfo> {
  const { provider } = useStarknet();
  const { enabled = true } = options;

  return useQuery({
    queryKey: ['token-info', tokenAddress],
    queryFn: async (): Promise<TokenInfo> => {
      if (!tokenAddress) {
        throw new Error('Token address required');
      }

      const token = getERC20Contract(tokenAddress, provider);

      const [name, symbol, decimals] = await Promise.all([
        callContract<bigint>(token, 'name'),
        callContract<bigint>(token, 'symbol'),
        callContract<number>(token, 'decimals'),
      ]);

      // Convert felt252 to string
      const nameStr = feltToString(name);
      const symbolStr = feltToString(symbol);

      return {
        name: nameStr,
        symbol: symbolStr,
        decimals,
      };
    },
    enabled: enabled && !!tokenAddress,
    staleTime: Infinity, // Token info doesn't change
  });
}

// Helper to convert felt252 to string
function feltToString(felt: bigint): string {
  let hex = felt.toString(16);
  if (hex.length % 2 !== 0) {
    hex = '0' + hex;
  }
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const charCode = parseInt(hex.substring(i, i + 2), 16);
    if (charCode > 0) {
      str += String.fromCharCode(charCode);
    }
  }
  return str;
}
