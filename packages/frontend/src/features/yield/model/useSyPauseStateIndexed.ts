'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';

/**
 * Response from the indexed pause state API endpoint.
 */
export interface PauseStateResponse {
  sy: string;
  isPaused: boolean;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
}

/**
 * Fetch pause state for an SY contract from the indexed API.
 */
async function fetchPauseState(syAddress: string): Promise<PauseStateResponse> {
  const response = await fetch(`/api/sy/${syAddress}/pause-state`);
  if (!response.ok) {
    throw new Error('Failed to fetch pause state');
  }
  return response.json() as Promise<PauseStateResponse>;
}

/**
 * Hook to check if an SY contract is paused using indexed data.
 *
 * Unlike `useSyPauseState` which makes an RPC call to the contract,
 * this hook uses the indexed API for faster loading. The indexed data
 * also provides additional metadata like when it was last updated.
 *
 * When an SY contract is paused:
 * - Deposits (mints) are BLOCKED
 * - Transfers are BLOCKED
 * - Redemptions (burns) are ALLOWED (users can always exit)
 *
 * @param syAddress - The SY contract address
 * @returns Query result with pause state and metadata
 *
 * @example
 * ```typescript
 * const { data, isLoading } = useSyPauseStateIndexed(syAddress);
 *
 * if (data?.isPaused) {
 *   console.log(`Paused at ${data.lastUpdatedAt} by ${data.lastUpdatedBy}`);
 * }
 * ```
 */
export function useSyPauseStateIndexed(
  syAddress: string | undefined
): UseQueryResult<PauseStateResponse> {
  return useQuery({
    queryKey: ['sy', 'pause-state', 'indexed', syAddress],
    queryFn: async () => {
      if (!syAddress) throw new Error('syAddress is required');
      return fetchPauseState(syAddress);
    },
    enabled: !!syAddress,
    staleTime: 30_000, // 30 seconds - pause state can change
    refetchOnWindowFocus: true, // Important to catch pause state changes
  });
}

/**
 * Convenience hook to get just the pause state boolean from indexed data.
 * Returns false if loading or address not provided.
 *
 * @param syAddress - The SY contract address
 * @returns Whether the contract is paused (false if unknown)
 */
export function useIsSyPausedIndexed(syAddress: string | undefined): boolean {
  const { data } = useSyPauseStateIndexed(syAddress);
  return data?.isPaused ?? false;
}
