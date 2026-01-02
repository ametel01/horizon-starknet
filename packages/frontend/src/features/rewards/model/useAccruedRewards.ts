'use client';

import { useAccount, useStarknet } from '@features/wallet';
import { getSYWithRewardsContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { uint256 } from 'starknet';

export interface AccruedReward {
  tokenAddress: string;
  amount: bigint;
}

// Helper to convert Uint256 or bigint to bigint
function toBigInt(value: bigint | { low: bigint; high: bigint }): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  // Handle Uint256 struct
  return uint256.uint256ToBN(value);
}

/**
 * Hook to fetch accrued (pending) rewards for the connected user.
 *
 * Returns an array of { tokenAddress, amount } pairs, matching the order
 * returned by get_reward_tokens(). Amounts are in the respective token's
 * native decimals (typically 18 for most reward tokens).
 *
 * @param syAddress - The SYWithRewards contract address
 * @returns Query result with array of accrued rewards
 */
export function useAccruedRewards(syAddress: string | undefined): UseQueryResult<AccruedReward[]> {
  const { provider } = useStarknet();
  const { address: userAddress } = useAccount();

  return useQuery({
    queryKey: ['sy-rewards', 'accrued', syAddress, userAddress],
    queryFn: async (): Promise<AccruedReward[]> => {
      if (!syAddress || !userAddress) return [];

      const sy = getSYWithRewardsContract(syAddress, provider);

      // Fetch both reward tokens and accrued amounts in parallel
      const [tokens, amounts] = await Promise.all([
        sy.get_reward_tokens(),
        sy.accrued_rewards(userAddress),
      ]);

      // starknet.js typed contracts return addresses as hex strings
      // Handle both string[] and bigint[] for robustness
      const tokenAddresses = (tokens as (string | bigint)[]).map((addr) => {
        if (typeof addr === 'string') {
          return addr;
        }
        return `0x${addr.toString(16).padStart(64, '0')}`;
      });

      // Handle both bigint and Uint256 struct returns
      const rewardAmounts = (amounts as (bigint | { low: bigint; high: bigint })[]).map(toBigInt);

      // Pair tokens with their accrued amounts
      return tokenAddresses.map((tokenAddress, i) => ({
        tokenAddress,
        amount: rewardAmounts[i] ?? 0n,
      }));
    },
    enabled: !!syAddress && !!userAddress,
    staleTime: 30_000, // 30 seconds - rewards accrue over time
    refetchInterval: 60_000, // Refetch every minute to show accumulating rewards
  });
}

/**
 * Hook to check if user has any claimable rewards.
 *
 * @param syAddress - The SYWithRewards contract address
 * @returns Whether user has any non-zero accrued rewards
 */
export function useHasClaimableRewards(syAddress: string | undefined): boolean {
  const { data: rewards } = useAccruedRewards(syAddress);

  if (!rewards || rewards.length === 0) return false;

  return rewards.some((r) => r.amount > 0n);
}

/**
 * Hook to get total value of all accrued rewards (for display purposes).
 * Returns the sum of all reward amounts (assumes same decimals, typically 18).
 *
 * @param syAddress - The SYWithRewards contract address
 * @returns Total accrued rewards amount
 */
export function useTotalAccruedRewards(syAddress: string | undefined): bigint {
  const { data: rewards } = useAccruedRewards(syAddress);

  if (!rewards || rewards.length === 0) return 0n;

  return rewards.reduce((sum, r) => sum + r.amount, 0n);
}
