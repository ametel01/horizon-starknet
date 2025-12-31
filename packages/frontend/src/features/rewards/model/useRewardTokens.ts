'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useStarknet } from '@features/wallet';
import { getSYWithRewardsContract } from '@shared/starknet/contracts';

/**
 * Hook to fetch reward tokens for an SYWithRewards contract.
 *
 * SYWithRewards contracts can distribute multiple reward tokens (e.g., governance tokens,
 * fee-sharing tokens). This hook retrieves the list of all configured reward token addresses.
 *
 * @param syAddress - The SYWithRewards contract address
 * @returns Query result with array of reward token addresses (hex strings)
 */
export function useRewardTokens(syAddress: string | undefined): UseQueryResult<string[]> {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['sy-rewards', 'tokens', syAddress],
    queryFn: async (): Promise<string[]> => {
      if (!syAddress) return [];

      const sy = getSYWithRewardsContract(syAddress, provider);
      const tokens = await sy.get_reward_tokens();

      // starknet.js typed contracts return addresses as hex strings
      // Handle both string[] and bigint[] for robustness
      return (tokens as (string | bigint)[]).map((addr) => {
        if (typeof addr === 'string') {
          return addr;
        }
        // Fallback: convert bigint to hex string
        return '0x' + addr.toString(16).padStart(64, '0');
      });
    },
    enabled: !!syAddress,
    staleTime: 600_000, // 10 min - reward tokens rarely change after deployment
  });
}
