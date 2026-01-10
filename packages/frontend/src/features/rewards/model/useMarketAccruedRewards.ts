'use client';

import { useAccount, useStarknet } from '@features/wallet';
import { getMarketContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { uint256 } from 'starknet';

export interface MarketAccruedReward {
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
 * Hook to fetch accrued (pending) rewards for the connected user's Market LP position.
 *
 * Returns an array of { tokenAddress, amount } pairs, matching the order
 * returned by get_reward_tokens(). Amounts are in the respective token's
 * native decimals (typically 18 for most reward tokens).
 *
 * @param marketAddress - The Market contract address
 * @returns Query result with array of accrued rewards
 */
export function useMarketAccruedRewards(
  marketAddress: string | undefined
): UseQueryResult<MarketAccruedReward[]> {
  const { provider } = useStarknet();
  const { address: userAddress } = useAccount();

  return useQuery({
    queryKey: ['market-rewards', 'accrued', marketAddress, userAddress],
    queryFn: async (): Promise<MarketAccruedReward[]> => {
      if (!marketAddress || !userAddress) return [];

      const market = getMarketContract(marketAddress, provider);

      // Fetch both reward tokens and accrued amounts in parallel
      const [tokens, amounts] = await Promise.all([
        market.get_reward_tokens(),
        market.accrued_rewards(userAddress),
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
    enabled: !!marketAddress && !!userAddress,
    staleTime: 30_000, // 30 seconds - rewards accrue over time
    refetchInterval: 60_000, // Refetch every minute to show accumulating rewards
  });
}

/**
 * Hook to check if user has any claimable Market LP rewards.
 *
 * @param marketAddress - The Market contract address
 * @returns Whether user has any non-zero accrued rewards
 */
export function useHasClaimableMarketRewards(marketAddress: string | undefined): boolean {
  const { data: rewards } = useMarketAccruedRewards(marketAddress);

  if (!rewards || rewards.length === 0) return false;

  return rewards.some((r) => r.amount > 0n);
}

/**
 * Hook to get total value of all accrued Market LP rewards (for display purposes).
 * Returns the sum of all reward amounts (assumes same decimals, typically 18).
 *
 * @param marketAddress - The Market contract address
 * @returns Total accrued rewards amount
 */
export function useTotalMarketAccruedRewards(marketAddress: string | undefined): bigint {
  const { data: rewards } = useMarketAccruedRewards(marketAddress);

  if (!rewards || rewards.length === 0) return 0n;

  return rewards.reduce((sum, r) => sum + r.amount, 0n);
}
