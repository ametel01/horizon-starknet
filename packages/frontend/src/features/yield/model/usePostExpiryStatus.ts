'use client';

import { useStarknet } from '@features/wallet';
import { formatWad } from '@shared/math';
import { getYTContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { uint256 } from 'starknet';

/**
 * Post-expiry status information for a YT token
 */
export interface PostExpiryInfo {
  /** PY index captured at first post-expiry action (0 if not yet initialized) */
  firstPyIndex: bigint;
  /** Total SY interest accumulated for treasury since expiry */
  totalTreasuryInterest: bigint;
  /** Total treasury interest formatted for display */
  totalTreasuryInterestFormatted: string;
  /** Whether post-expiry data has been initialized (first redemption occurred) */
  isInitialized: boolean;
  /** Pending treasury interest that can be claimed (from current state) */
  pendingTreasuryInterest: bigint;
  /** Pending treasury interest formatted for display */
  pendingTreasuryInterestFormatted: string;
}

/**
 * Convert various numeric return types to bigint.
 * Handles: bigint, number, Uint256 struct
 */
function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(value);
  }
  // Handle Uint256 struct with BigNumberish properties
  if (value !== null && typeof value === 'object' && 'low' in value && 'high' in value) {
    return uint256.uint256ToBN(value as { low: bigint; high: bigint });
  }
  // Fallback for string representation
  if (typeof value === 'string') {
    return BigInt(value);
  }
  return 0n;
}

/**
 * Parse a Cairo boolean variant to a JavaScript boolean.
 * Cairo bools are returned as objects like { True: () } or { False: () }
 */
function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  // Handle Cairo variant enum format
  if (value !== null && typeof value === 'object') {
    if ('True' in value || 'activeVariant' in value) {
      const obj = value as { activeVariant?: string };
      return obj.activeVariant === 'True' || 'True' in value;
    }
  }
  return false;
}

/**
 * Hook to fetch post-expiry status for a YT token.
 *
 * After a YT expires, the protocol captures the PY index at the first post-expiry
 * action (redemption). Any yield that accrues after expiry is redirected to the
 * treasury rather than YT holders.
 *
 * This is useful for:
 * - Displaying post-expiry state to users
 * - Showing treasury yield accumulation for admins
 * - Determining if post-expiry has been initialized
 *
 * @param ytAddress - The YT contract address
 * @returns Query result with post-expiry status info
 *
 * @example
 * ```typescript
 * const { data: postExpiry } = usePostExpiryStatus(ytAddress);
 *
 * if (postExpiry?.isInitialized) {
 *   console.log(`First PY index: ${postExpiry.firstPyIndex}`);
 *   console.log(`Treasury yield: ${postExpiry.totalTreasuryInterestFormatted}`);
 * }
 * ```
 */
export function usePostExpiryStatus(
  ytAddress: string | undefined
): UseQueryResult<PostExpiryInfo | null> {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['yt', 'post-expiry', ytAddress],
    queryFn: async (): Promise<PostExpiryInfo | null> => {
      if (ytAddress === undefined) {
        return null;
      }

      const yt = getYTContract(ytAddress, provider);

      // Fetch post-expiry data and pending treasury interest in parallel
      const [postExpiryData, pendingInterest] = await Promise.all([
        yt.get_post_expiry_data(),
        yt.get_post_expiry_treasury_interest(),
      ]);

      // get_post_expiry_data returns (u256, u256, bool) as a tuple/array
      // Index 0: first_py_index
      // Index 1: total_sy_interest_for_treasury
      // Index 2: is_post_expiry_initialized
      const dataArray = postExpiryData as unknown[];
      const firstPyIndex = toBigInt(dataArray[0]);
      const totalTreasuryInterest = toBigInt(dataArray[1]);
      const isInitialized = toBool(dataArray[2]);

      const pendingTreasuryInterest = toBigInt(pendingInterest);

      return {
        firstPyIndex,
        totalTreasuryInterest,
        totalTreasuryInterestFormatted: formatWad(totalTreasuryInterest),
        isInitialized,
        pendingTreasuryInterest,
        pendingTreasuryInterestFormatted: formatWad(pendingTreasuryInterest),
      };
    },
    enabled: ytAddress !== undefined,
    staleTime: 120_000, // 2 minutes - post-expiry data is relatively stable
    refetchInterval: 300_000, // Refetch every 5 minutes
  });
}

/**
 * Convenience hook to check if post-expiry has been initialized.
 *
 * @param ytAddress - The YT contract address
 * @returns Whether post-expiry is initialized (false if unknown or not expired)
 */
export function useIsPostExpiryInitialized(ytAddress: string | undefined): boolean {
  const { data } = usePostExpiryStatus(ytAddress);
  return data?.isInitialized ?? false;
}

/**
 * Convenience hook to get pending treasury interest.
 *
 * @param ytAddress - The YT contract address
 * @returns Pending treasury interest as bigint (0n if unknown)
 */
export function usePendingTreasuryInterest(ytAddress: string | undefined): bigint {
  const { data } = usePostExpiryStatus(ytAddress);
  return data?.pendingTreasuryInterest ?? 0n;
}
