'use client';

import { useAccount, useStarknet } from '@features/wallet';
import { toHexAddress } from '@shared/lib/abi-helpers';
import { toBigInt } from '@shared/lib/uint256';
import { getYTContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ProviderInterface } from 'starknet';

import type { YTAccruedReward } from './useYTAccruedRewards';

/**
 * Represents rewards from a single YT contract
 */
export interface YTRewards {
  /** YT contract address */
  ytAddress: string;
  /** Array of reward tokens with accrued amounts */
  rewards: YTAccruedReward[];
  /** Whether this YT has any claimable rewards */
  hasRewards: boolean;
  /** Total reward count (tokens with amount > 0) */
  claimableCount: number;
}

/**
 * Aggregated portfolio rewards across all YT contracts
 */
export interface PortfolioYTRewards {
  /** Rewards breakdown by YT contract */
  byYt: YTRewards[];
  /** All reward tokens with amounts aggregated */
  allRewards: YTAccruedReward[];
  /** YT addresses that have claimable rewards */
  claimableYtAddresses: string[];
  /** Whether any rewards are claimable */
  hasAnyRewards: boolean;
  /** Total count of distinct reward tokens */
  distinctTokenCount: number;
}

/**
 * Fetch rewards for a single YT contract.
 * Returns null if the contract doesn't support rewards or has no reward tokens.
 */
async function fetchYtRewards(
  ytAddress: string,
  userAddress: string,
  provider: ProviderInterface
): Promise<YTRewards | null> {
  try {
    const yt = getYTContract(ytAddress, provider);

    // Fetch reward tokens first
    const tokens = await yt.get_reward_tokens();

    // If no reward tokens configured, skip this YT
    if (tokens.length === 0) {
      return null;
    }

    // Parse token addresses
    const tokenAddresses = (tokens as (string | bigint)[]).map(toHexAddress);

    // Attempt to fetch accrued amounts via raw call.
    // NOTE: The YT contract's IYT interface currently does NOT expose accrued_rewards,
    // so this call may fail. The catch block returns zeros as a fallback.
    let rewardAmounts: bigint[];
    try {
      const amounts = await yt.call('accrued_rewards', [userAddress]);
      rewardAmounts = Array.isArray(amounts) ? amounts.map(toBigInt) : [];
    } catch {
      // accrued_rewards is not exposed in the current YT contract interface.
      // Return zeros for all tokens - the reward token list is still valid.
      rewardAmounts = tokenAddresses.map(() => 0n);
    }

    // Build rewards array
    const rewards: YTAccruedReward[] = tokenAddresses.map((tokenAddress, i) => ({
      tokenAddress,
      amount: rewardAmounts[i] ?? 0n,
    }));

    const claimableRewards = rewards.filter((r) => r.amount > 0n);

    return {
      ytAddress,
      rewards,
      hasRewards: claimableRewards.length > 0,
      claimableCount: claimableRewards.length,
    };
  } catch {
    // Contract doesn't support rewards or call failed
    return null;
  }
}

/**
 * Hook to fetch accrued YT rewards across multiple YT addresses.
 *
 * This hook queries each YT contract to check if it supports rewards
 * (via get_reward_tokens) and fetches accrued amounts for the connected user.
 * YT contracts that don't support rewards are silently skipped.
 *
 * IMPORTANT: The current YT contract interface (IYT) does not expose `accrued_rewards`.
 * This hook will return zeros for all reward tokens until the contract interface is updated.
 * The reward tokens list is still fetched correctly via `get_reward_tokens()`.
 *
 * @param ytAddresses - Array of YT contract addresses to check for rewards
 * @returns Query result with aggregated portfolio YT rewards
 *
 * @example
 * ```typescript
 * // Get all YT addresses from user's positions
 * const ytAddresses = positions.map(p => p.market.ytAddress);
 * const { data: rewards, isLoading } = usePortfolioYTRewards(ytAddresses);
 *
 * if (rewards?.hasAnyRewards) {
 *   console.log(`Claimable rewards from ${rewards.claimableYtAddresses.length} positions`);
 * }
 * ```
 */
export function usePortfolioYTRewards(ytAddresses: string[]): {
  data: PortfolioYTRewards | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const { provider } = useStarknet();
  const { address: userAddress } = useAccount();

  // Deduplicate YT addresses and remove empty strings
  const uniqueAddresses = useMemo(
    () => [...new Set(ytAddresses.filter((addr) => addr !== ''))],
    [ytAddresses]
  );

  // Query rewards for each YT in parallel
  const queries = useQueries({
    queries: uniqueAddresses.map((ytAddress) => ({
      queryKey: ['yt-rewards', 'portfolio', ytAddress, userAddress],
      queryFn: async (): Promise<YTRewards | null> => {
        if (!userAddress) return null;
        return fetchYtRewards(ytAddress, userAddress, provider);
      },
      enabled: !!userAddress && !!ytAddress,
      staleTime: 30_000,
      refetchInterval: 60_000,
    })),
  });

  // Check if any query is loading
  const isLoading = queries.some((q: UseQueryResult<YTRewards | null>) => q.isLoading);
  const isError = queries.every(
    (q: UseQueryResult<YTRewards | null>) => q.isError || q.data === null
  );

  // Aggregate results
  const data = useMemo((): PortfolioYTRewards | undefined => {
    if (isLoading) return undefined;

    // Filter out null results (non-reward YT contracts)
    const validResults = queries
      .map((q: UseQueryResult<YTRewards | null>) => q.data)
      .filter((r): r is YTRewards => r !== null && r !== undefined);

    // Collect all rewards and aggregate by token
    const rewardsByToken = new Map<string, bigint>();
    const claimableYtAddresses: string[] = [];

    for (const ytRewards of validResults) {
      if (ytRewards.hasRewards) {
        claimableYtAddresses.push(ytRewards.ytAddress);
      }

      for (const reward of ytRewards.rewards) {
        if (reward.amount > 0n) {
          const current = rewardsByToken.get(reward.tokenAddress) ?? 0n;
          rewardsByToken.set(reward.tokenAddress, current + reward.amount);
        }
      }
    }

    // Convert map to array
    const allRewards: YTAccruedReward[] = Array.from(rewardsByToken.entries()).map(
      ([tokenAddress, amount]) => ({ tokenAddress, amount })
    );

    return {
      byYt: validResults,
      allRewards,
      claimableYtAddresses,
      hasAnyRewards: claimableYtAddresses.length > 0,
      distinctTokenCount: allRewards.length,
    };
  }, [queries, isLoading]);

  return {
    data,
    isLoading,
    isError,
  };
}
