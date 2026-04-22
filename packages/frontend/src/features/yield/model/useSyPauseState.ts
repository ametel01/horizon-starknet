'use client';

import { useStarknet } from '@features/wallet';
import { getSYContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';

/**
 * Hook to check if an SY contract is paused.
 *
 * When an SY contract is paused:
 * - Deposits (mints) are BLOCKED
 * - Transfers are BLOCKED
 * - Redemptions (burns) are ALLOWED (users can always exit)
 *
 * This hook is useful for providing better UX by checking pause state
 * before allowing users to attempt operations that will fail.
 *
 * @param syAddress - The SY contract address
 * @returns Query result with pause state boolean
 *
 * @example
 * ```typescript
 * const { data: isPaused } = useSyPauseState(syAddress);
 *
 * if (isPaused) {
 *   // Show warning that deposits are disabled
 *   // But redemptions are still allowed
 * }
 * ```
 */
export function useSyPauseState(syAddress: string | undefined): UseQueryResult<boolean> {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['sy', 'paused', syAddress],
    queryFn: async (): Promise<boolean> => {
      if (syAddress === undefined) {
        return false;
      }

      const sy = getSYContract(syAddress, provider);
      return await sy.is_paused();
    },
    enabled: syAddress !== undefined,
    staleTime: 30_000, // 30 seconds - pause state can change
    refetchOnWindowFocus: true, // Important to catch pause state changes
  });
}

/**
 * Convenience hook to get just the pause state boolean.
 * Returns false if loading or address not provided.
 *
 * @param syAddress - The SY contract address
 * @returns Whether the contract is paused (false if unknown)
 */
export function useIsSyPaused(syAddress: string | undefined): boolean {
  const { data } = useSyPauseState(syAddress);
  return data ?? false;
}
