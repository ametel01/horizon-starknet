'use client';

import { useStarknet } from '@features/wallet';
import { getYTContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';

/**
 * Hook to fetch reward tokens for a YT contract.
 *
 * YT contracts can distribute reward tokens to holders. This hook retrieves
 * the list of all configured reward token addresses from the YT contract.
 *
 * @param ytAddress - The YT contract address
 * @returns Query result with array of reward token addresses (hex strings)
 */
export function useYTRewardTokens(ytAddress: string | undefined): UseQueryResult<string[]> {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['yt-rewards', 'tokens', ytAddress],
    queryFn: async (): Promise<string[]> => {
      if (!ytAddress) return [];

      const yt = getYTContract(ytAddress, provider);
      const tokens = await yt.get_reward_tokens();

      // starknet.js typed contracts return addresses as hex strings
      // Handle both string[] and bigint[] for robustness
      return (tokens as (string | bigint)[]).map((addr) => {
        if (typeof addr === 'string') {
          return addr;
        }
        // Fallback: convert bigint to hex string
        return `0x${addr.toString(16).padStart(64, '0')}`;
      });
    },
    enabled: !!ytAddress,
    staleTime: 600_000, // 10 min - reward tokens rarely change after deployment
  });
}
