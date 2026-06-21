'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';

/**
 * A single reward claim event from the indexed database.
 */
export interface RewardClaimEvent {
  id: string;
  sy: string;
  rewardToken: string;
  amount: string;
  eventTimestamp: number;
  blockTimestamp: string;
  transactionHash: string;
}

/**
 * Response from the reward history API endpoint.
 */
export interface RewardsHistoryResponse {
  user: string;
  totalClaims: number;
  claims: RewardClaimEvent[];
}

/**
 * Fetch reward claim history for a user from the indexed API.
 */
async function fetchRewardHistory(
  userAddress: string,
  limit = 100,
  offset = 0
): Promise<RewardsHistoryResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`/api/rewards/${userAddress}?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch reward history');
  }
  return response.json() as Promise<RewardsHistoryResponse>;
}

/**
 * Hook to fetch a user's reward claim history from the indexed database.
 *
 * Uses the indexed API for fast loading without RPC calls.
 * Provides paginated list of all reward claim events.
 *
 * @param userAddress - The user's Starknet address
 * @param options - Pagination options
 * @returns Query result with reward claim events
 *
 * @example
 * ```typescript
 * const { data, isLoading } = useRewardHistory(address);
 *
 * data?.claims.map(claim => (
 *   <div key={claim.id}>
 *     {claim.amount} claimed on {claim.blockTimestamp}
 *   </div>
 * ));
 * ```
 */
export function useRewardHistory(
  userAddress: string | undefined,
  options?: { limit?: number; offset?: number }
): UseQueryResult<RewardsHistoryResponse> {
  return useQuery({
    queryKey: ['rewards', 'history', userAddress, options?.limit, options?.offset],
    queryFn: async () => {
      if (!userAddress) throw new Error('userAddress is required');
      return fetchRewardHistory(userAddress, options?.limit, options?.offset);
    },
    enabled: !!userAddress,
    staleTime: 60_000, // 1 minute - historical data doesn't change often
  });
}
