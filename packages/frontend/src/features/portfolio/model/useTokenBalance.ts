'use client';

import { useAccount, useStarknet } from '@features/wallet';
import { toBigInt } from '@shared/lib';
import { getERC20Contract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
}

// Return type for balance hooks - stores as string to avoid BigInt serialization issues
interface BalanceResult {
  data: bigint | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

export function useTokenBalance(
  tokenAddress: string | null,
  options: { enabled?: boolean; refetchInterval?: number } = {}
): BalanceResult {
  const { provider } = useStarknet();
  const { address } = useAccount();
  const { enabled = true, refetchInterval = 15000 } = options;

  // Store as string internally to avoid BigInt serialization issues
  const query = useQuery({
    queryKey: ['token-balance', tokenAddress, address],
    queryFn: async (): Promise<string> => {
      if (!tokenAddress || !address) {
        throw new Error('Token address and user address required');
      }

      const token = getERC20Contract(tokenAddress, provider);
      const balance = await token.balance_of(address);
      return toBigInt(balance).toString();
    },
    enabled: enabled && !!tokenAddress && !!address,
    refetchInterval,
    staleTime: 5000,
  });

  return {
    data: query.data !== undefined ? BigInt(query.data) : undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useTokenAllowance(
  tokenAddress: string | null,
  spenderAddress: string | null,
  options: { enabled?: boolean; refetchInterval?: number } = {}
): BalanceResult {
  const { provider } = useStarknet();
  const { address } = useAccount();
  const { enabled = true, refetchInterval = 15000 } = options;

  // Store as string internally to avoid BigInt serialization issues
  const query = useQuery({
    queryKey: ['token-allowance', tokenAddress, address, spenderAddress],
    queryFn: async (): Promise<string> => {
      if (!tokenAddress || !address || !spenderAddress) {
        throw new Error('Token, user, and spender addresses required');
      }

      const token = getERC20Contract(tokenAddress, provider);
      const allowance = await token.allowance(address, spenderAddress);
      return toBigInt(allowance).toString();
    },
    enabled: enabled && !!tokenAddress && !!address && !!spenderAddress,
    refetchInterval,
    staleTime: 5000,
  });

  return {
    data: query.data !== undefined ? BigInt(query.data) : undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
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
        token.name(),
        token.symbol(),
        token.decimals(),
      ]);

      // Name and symbol may be returned as felt252 (bigint) or ByteArray (string)
      const nameStr = typeof name === 'string' ? name : feltToString(name as unknown as bigint);
      const symbolStr =
        typeof symbol === 'string' ? symbol : feltToString(symbol as unknown as bigint);

      return {
        name: nameStr,
        symbol: symbolStr,
        decimals: Number(decimals),
      };
    },
    enabled: enabled && !!tokenAddress,
    staleTime: Number.POSITIVE_INFINITY, // Token info doesn't change
  });
}

// Helper to convert felt252 to string
function feltToString(felt: bigint): string {
  let hex = felt.toString(16);
  if (hex.length % 2 !== 0) {
    hex = `0${hex}`;
  }
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const charCode = Number.parseInt(hex.substring(i, i + 2), 16);
    if (charCode > 0) {
      str += String.fromCharCode(charCode);
    }
  }
  return str;
}
