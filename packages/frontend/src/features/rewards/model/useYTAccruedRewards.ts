'use client';

import { useAccount, useStarknet } from '@features/wallet';
import { toHexAddress } from '@shared/lib/abi-helpers';
import { toBigInt } from '@shared/lib/uint256';
import { getYTContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';

export interface YTAccruedReward {
  tokenAddress: string;
  amount: bigint;
}

/**
 * Hook to fetch accrued (pending) rewards for the connected user's YT position.
 *
 * Returns an array of { tokenAddress, amount } pairs, matching the order
 * returned by get_reward_tokens(). Amounts are in the respective token's
 * native decimals (typically 18 for most reward tokens).
 *
 * IMPORTANT: The current YT contract interface (IYT) does not expose `accrued_rewards`.
 * This hook will return zeros for all reward tokens until the contract interface is updated.
 * The reward tokens list is still fetched correctly via `get_reward_tokens()`.
 *
 * TODO: Update IYT interface in contracts/src/interfaces/i_yt.cairo to expose accrued_rewards,
 * then regenerate ABIs with `bun run codegen`.
 *
 * @param ytAddress - The YT contract address
 * @returns Query result with array of accrued rewards (currently always zero amounts)
 */
export function useYTAccruedRewards(
  ytAddress: string | undefined
): UseQueryResult<YTAccruedReward[]> {
  const { provider } = useStarknet();
  const { address: userAddress } = useAccount();

  return useQuery({
    queryKey: ['yt-rewards', 'accrued', ytAddress, userAddress],
    queryFn: async (): Promise<YTAccruedReward[]> => {
      if (!ytAddress || !userAddress) return [];

      const yt = getYTContract(ytAddress, provider);

      // Fetch reward tokens first
      const tokens = await yt.get_reward_tokens();

      // starknet.js typed contracts return addresses as hex strings
      // Handle both string[] and bigint[] for robustness
      const tokenAddresses = (tokens as (string | bigint)[]).map(toHexAddress);

      // If no reward tokens, return empty array
      if (tokenAddresses.length === 0) {
        return [];
      }

      // Attempt to fetch accrued amounts via raw call.
      // NOTE: The YT contract's IYT interface currently does NOT expose accrued_rewards,
      // so this call will fail. The catch block returns zeros as a fallback.
      // When IYT is updated to include accrued_rewards, this will work correctly.
      try {
        const amounts = await yt.call('accrued_rewards', [userAddress]);

        // Handle both bigint and Uint256 struct returns
        const rewardAmounts = Array.isArray(amounts) ? amounts.map(toBigInt) : [];

        // Pair tokens with their accrued amounts
        // Note: Amount array ordering should match token array ordering
        return tokenAddresses.map((tokenAddress, i) => ({
          tokenAddress,
          amount: rewardAmounts[i] ?? 0n,
        }));
      } catch {
        // accrued_rewards is not exposed in the current YT contract interface.
        // Return zeros for all tokens - the reward token list is still valid.
        return tokenAddresses.map((tokenAddress) => ({
          tokenAddress,
          amount: 0n,
        }));
      }
    },
    enabled: !!ytAddress && !!userAddress,
    staleTime: 30_000, // 30 seconds - rewards accrue over time
    refetchInterval: 60_000, // Refetch every minute to show accumulating rewards
  });
}

/**
 * Hook to check if user has any claimable YT rewards.
 *
 * NOTE: Currently always returns false because useYTAccruedRewards returns zeros.
 * See useYTAccruedRewards for details on the contract interface limitation.
 *
 * @param ytAddress - The YT contract address
 * @returns Whether user has any non-zero accrued rewards (currently always false)
 */
export function useHasClaimableYTRewards(ytAddress: string | undefined): boolean {
  const { data: rewards } = useYTAccruedRewards(ytAddress);

  if (!rewards || rewards.length === 0) return false;

  return rewards.some((r) => r.amount > 0n);
}

/**
 * Hook to get total value of all accrued YT rewards (for display purposes).
 * Returns the sum of all reward amounts (assumes same decimals, typically 18).
 *
 * NOTE: Currently always returns 0n because useYTAccruedRewards returns zeros.
 * See useYTAccruedRewards for details on the contract interface limitation.
 *
 * @param ytAddress - The YT contract address
 * @returns Total accrued rewards amount (currently always 0n)
 */
export function useTotalYTAccruedRewards(ytAddress: string | undefined): bigint {
  const { data: rewards } = useYTAccruedRewards(ytAddress);

  if (!rewards || rewards.length === 0) return 0n;

  return rewards.reduce((sum, r) => sum + r.amount, 0n);
}
