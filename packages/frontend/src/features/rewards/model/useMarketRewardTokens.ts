'use client';

import { useStarknet } from '@features/wallet';
import { getMarketContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';

/**
 * Hook to fetch reward tokens for a Market LP contract.
 *
 * Market contracts can distribute rewards to LP token holders. This hook retrieves
 * the list of all configured reward token addresses for a specific market.
 *
 * @param marketAddress - The Market contract address
 * @returns Query result with array of reward token addresses (hex strings)
 */
export function useMarketRewardTokens(marketAddress: string | undefined): UseQueryResult<string[]> {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['market-rewards', 'tokens', marketAddress],
    queryFn: async (): Promise<string[]> => {
      if (!marketAddress) return [];

      const market = getMarketContract(marketAddress, provider);
      const tokens = await market.get_reward_tokens();

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
    enabled: !!marketAddress,
    staleTime: 600_000, // 10 min - reward tokens rarely change after deployment
  });
}
