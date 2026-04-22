'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';

/**
 * Reward stats for a single reward token.
 */
export interface RewardApyData {
  rewardToken: string;
  rewardsLast7Days: string;
  avgTotalSupply: string;
  updateCount: number;
  /**
   * Raw annualized reward ratio: (rewards / supply) * (365/7)
   *
   * WARNING: This is NOT a true APY! It divides reward tokens by SY tokens
   * without price conversion. To convert to actual APY:
   * actualApy = rawRewardRatio * (rewardTokenPrice / syTokenPrice)
   *            * (10^syDecimals / 10^rewardDecimals)
   */
  rawRewardRatio: string;
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
 * Hook to fetch reward stats for an SYWithRewards contract.
 *
 * Uses the 7-day rolling window from indexed data to provide
 * reward statistics. More stable than real-time calculations.
 *
 * WARNING: rawRewardRatio is NOT a true APY - it requires price data
 * to convert to actual APY. See RewardApyData.rawRewardRatio docs.
 *
 * @param syAddress - The SYWithRewards contract address
 * @returns Query result with reward stats per reward token
 *
 * @example
 * ```typescript
 * const { data, isLoading } = useRewardApy(syAddress);
 *
 * // To display, you need price data for accurate APY:
 * // actualApy = rawRewardRatio * (rewardPrice / syPrice)
 * data?.rewardTokens.map(token => (
 *   <div key={token.rewardToken}>
 *     Raw ratio: {parseFloat(token.rawRewardRatio)}
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
 * Get total combined raw reward ratio across all reward tokens.
 * Returns 0 if no data or no rewards.
 *
 * WARNING: This returns the raw ratio sum, NOT actual APY.
 * To get true APY, each token's ratio must be price-adjusted first.
 *
 * @param syAddress - The SYWithRewards contract address
 * @returns Combined raw ratio as a decimal (NOT a true APY)
 */
export function useTotalRewardApy(syAddress: string | undefined): number {
  const { data } = useRewardApy(syAddress);

  if (!data?.rewardTokens || data.rewardTokens.length === 0) {
    return 0;
  }

  return data.rewardTokens.reduce((sum, token) => sum + Number.parseFloat(token.rawRewardRatio), 0);
}
