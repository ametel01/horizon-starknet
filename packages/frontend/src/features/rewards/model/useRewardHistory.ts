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
 * Response from the reward summary API endpoint.
 */
export interface RewardSummary {
  sy: string;
  rewardToken: string;
  totalClaimed: string;
  claimCount: number;
  lastClaimTimestamp: string | null;
}

export interface RewardsSummaryResponse {
  user: string;
  totalTokensClaimed: string;
  positionCount: number;
  positions: RewardSummary[];
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
 * Fetch aggregated reward summary for a user from the indexed API.
 */
async function fetchRewardSummary(userAddress: string): Promise<RewardsSummaryResponse> {
  const response = await fetch(`/api/rewards/${userAddress}/summary`);
  if (!response.ok) {
    throw new Error('Failed to fetch reward summary');
  }
  return response.json() as Promise<RewardsSummaryResponse>;
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

/**
 * Hook to fetch aggregated reward summary for a user.
 *
 * Provides totals per SY/reward token pair from the materialized view.
 * Faster than computing totals client-side from full history.
 *
 * @param userAddress - The user's Starknet address
 * @returns Query result with aggregated reward summary
 *
 * @example
 * ```typescript
 * const { data, isLoading } = useRewardSummary(address);
 *
 * // Total tokens claimed across all positions
 * console.log(data?.totalTokensClaimed);
 *
 * // Per-position breakdown
 * data?.positions.map(pos => (
 *   <div key={`${pos.sy}-${pos.rewardToken}`}>
 *     {pos.totalClaimed} claimed from {pos.claimCount} claims
 *   </div>
 * ));
 * ```
 */
export function useRewardSummary(
  userAddress: string | undefined
): UseQueryResult<RewardsSummaryResponse> {
  return useQuery({
    queryKey: ['rewards', 'summary', userAddress],
    queryFn: async () => {
      if (!userAddress) throw new Error('userAddress is required');
      return fetchRewardSummary(userAddress);
    },
    enabled: !!userAddress,
    staleTime: 60_000, // 1 minute
  });
}
