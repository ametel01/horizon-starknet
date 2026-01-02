'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';

/**
 * APY data for a single reward token.
 */
export interface RewardApyData {
  rewardToken: string;
  rewardsLast7Days: string;
  avgTotalSupply: string;
  updateCount: number;
  /** Annualized APY as a decimal string (e.g., "0.05" for 5%) */
  estimatedApy: string;
}

/**
 * Response from the reward APY API endpoint.
 */
export interface RewardApyResponse {
  sy: string;
  rewardTokens: RewardApyData[];
}

/**
 * Fetch reward APY data for an SY contract from the indexed API.
 */
async function fetchRewardApy(syAddress: string): Promise<RewardApyResponse> {
  const response = await fetch(`/api/sy/${syAddress}/reward-apy`);
  if (!response.ok) {
    throw new Error('Failed to fetch reward APY');
  }
  return response.json() as Promise<RewardApyResponse>;
}

/**
 * Hook to fetch reward APY for an SYWithRewards contract.
 *
 * Uses the 7-day rolling window from indexed data to calculate
 * estimated annual reward rates. More stable than real-time
 * calculations and accounts for reward distribution patterns.
 *
 * @param syAddress - The SYWithRewards contract address
 * @returns Query result with APY data per reward token
 *
 * @example
 * ```typescript
 * const { data, isLoading } = useRewardApy(syAddress);
 *
 * data?.rewardTokens.map(token => (
 *   <div key={token.rewardToken}>
 *     {parseFloat(token.estimatedApy) * 100}% APY
 *   </div>
 * ));
 * ```
 */
export function useRewardApy(syAddress: string | undefined): UseQueryResult<RewardApyResponse> {
  return useQuery({
    queryKey: ['sy', 'reward-apy', syAddress],
    queryFn: async () => {
      if (!syAddress) throw new Error('syAddress is required');
      return fetchRewardApy(syAddress);
    },
    enabled: !!syAddress,
    staleTime: 300_000, // 5 minutes - APY doesn't change frequently
  });
}

/**
 * Get total combined APY across all reward tokens.
 * Returns 0 if no data or no rewards.
 *
 * @param syAddress - The SYWithRewards contract address
 * @returns Combined APY as a decimal (e.g., 0.05 for 5%)
 */
export function useTotalRewardApy(syAddress: string | undefined): number {
  const { data } = useRewardApy(syAddress);

  if (!data?.rewardTokens || data.rewardTokens.length === 0) {
    return 0;
  }

  return data.rewardTokens.reduce((sum, token) => sum + Number.parseFloat(token.estimatedApy), 0);
}
