'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useAccount } from '@features/wallet';

/**
 * Yield claim event from the API
 */
export interface YieldClaimEvent {
  id: string;
  yt: string;
  sy: string;
  expiry: number;
  amountSy: string;
  ytBalance: string;
  pyIndexAtClaim: string;
  exchangeRate: string;
  blockTimestamp: string;
  transactionHash: string;
}

/**
 * Yield summary by position from the API
 */
export interface YieldSummary {
  yt: string;
  sy: string;
  totalClaimed: string;
  claimCount: number;
  lastClaim: string | null;
  currentYtBalance: string;
}

/**
 * Response from /api/users/[address]/yield
 */
export interface YieldResponse {
  address: string;
  totalYieldClaimed: string;
  claimHistory: YieldClaimEvent[];
  summaryByPosition: YieldSummary[];
}

/**
 * Processed yield data for display
 */
export interface ProcessedYieldData {
  address: string;
  totalYieldClaimed: bigint;
  claimHistory: YieldClaimEvent[];
  summaryByPosition: {
    yt: string;
    sy: string;
    totalClaimed: bigint;
    claimCount: number;
    lastClaim: Date | null;
    currentYtBalance: bigint;
  }[];
}

/**
 * Fetch yield data from the API
 */
async function fetchYieldData(address: string, days?: number): Promise<YieldResponse> {
  const params = new URLSearchParams();
  if (days !== undefined) {
    params.set('days', String(days));
  }

  const url = `/api/users/${address}/yield${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch yield data: ${String(response.status)}`);
  }

  return response.json() as Promise<YieldResponse>;
}

/**
 * Process raw yield response into usable format
 */
function processYieldData(data: YieldResponse): ProcessedYieldData {
  return {
    address: data.address,
    totalYieldClaimed: BigInt(data.totalYieldClaimed),
    claimHistory: data.claimHistory,
    summaryByPosition: data.summaryByPosition.map((s) => ({
      yt: s.yt,
      sy: s.sy,
      totalClaimed: BigInt(s.totalClaimed),
      claimCount: s.claimCount,
      lastClaim: s.lastClaim ? new Date(s.lastClaim) : null,
      currentYtBalance: BigInt(s.currentYtBalance),
    })),
  };
}

interface UseUserYieldOptions {
  days?: number | undefined;
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Hook to fetch user's yield claim history and totals
 *
 * @param options - Query options
 * @returns Processed yield data with totals and history
 */
export function useUserYield(
  options: UseUserYieldOptions = {}
): UseQueryResult<ProcessedYieldData> & { address: string | null } {
  const { address } = useAccount();
  const { days, enabled = true, refetchInterval = 60000 } = options;

  const query = useQuery({
    queryKey: ['user-yield', address, days],
    queryFn: async () => {
      if (!address) throw new Error('No address');
      const data = await fetchYieldData(address, days);
      return processYieldData(data);
    },
    enabled: enabled && !!address,
    staleTime: 30000,
    refetchInterval,
    retry: 2,
    retryDelay: 5000,
  });

  return { ...query, address };
}
