'use client';

import { useQuery } from '@tanstack/react-query';

import { useStarknet } from '@features/wallet';
import { getSYContract } from '@shared/starknet/contracts';

/**
 * Hook to fetch the underlying token address from an SY contract
 */
export function useUnderlyingAddress(syAddress: string | undefined): {
  underlyingAddress: string | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const { provider } = useStarknet();
  const isClient = typeof window !== 'undefined';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sy', 'underlying', syAddress],
    queryFn: async () => {
      if (!syAddress) return undefined;
      const sy = getSYContract(syAddress, provider);
      const underlying: unknown = await sy.underlying_asset();
      // Convert bigint to hex string
      if (typeof underlying === 'bigint') {
        return '0x' + underlying.toString(16).padStart(64, '0');
      }
      return String(underlying);
    },
    enabled: isClient && !!syAddress && syAddress !== '0x0',
    staleTime: 300000, // 5 minutes - underlying doesn't change
  });

  return {
    underlyingAddress: data,
    isLoading,
    isError,
  };
}
