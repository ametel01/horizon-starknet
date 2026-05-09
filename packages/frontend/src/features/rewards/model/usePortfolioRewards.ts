'use client';

import { useAccount, useStarknet } from '@features/wallet';
import { toBigInt } from '@shared/lib';
import { getSYWithRewardsContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ProviderInterface } from 'starknet';

import type { AccruedReward } from './useAccruedRewards';

/**
 * Represents rewards from a single SY contract
 */
export interface SyRewards {
  /** SY contract address */
  syAddress: string;
  /** Array of reward tokens with accrued amounts */
  rewards: AccruedReward[];
  /** Whether this SY has any claimable rewards */
  hasRewards: boolean;
  /** Total reward count (tokens with amount > 0) */
  claimableCount: number;
}

/**
 * Aggregated portfolio rewards across all SY contracts
 */
export interface PortfolioRewards {
  /** Rewards breakdown by SY contract */
  bySy: SyRewards[];
  /** All reward tokens with amounts aggregated */
  allRewards: AccruedReward[];
  /** SY addresses that have claimable rewards */
  claimableSyAddresses: string[];
  /** Whether any rewards are claimable */
  hasAnyRewards: boolean;
  /** Total count of distinct reward tokens */
  distinctTokenCount: number;
}

type SyRewardsQueryResult = UseQueryResult<SyRewards | null>;

// Convert address to hex string
function toAddressString(address: unknown): string {
  if (typeof address === 'string') {
    return address.startsWith('0x') ? address : `0x${address}`;
  }
  if (typeof address === 'bigint') {
    return `0x${address.toString(16).padStart(64, '0')}`;
  }
  return '0x0';
}

/**
 * Fetch rewards for a single SY contract.
 * Returns null if the contract doesn't support rewards.
 */
async function fetchSyRewards(
  syAddress: string,
  userAddress: string,
  provider: ProviderInterface
): Promise<SyRewards | null> {
  try {
    const sy = getSYWithRewardsContract(syAddress, provider);

    // Try to fetch reward tokens - if this fails, the contract doesn't support rewards
    const tokens = await sy.get_reward_tokens();

    // If no reward tokens configured, skip this SY
    if (tokens.length === 0) {
      return null;
    }

    // Fetch accrued rewards for the user
    const amounts = await sy.accrued_rewards(userAddress);

    // Parse token addresses
    const tokenAddresses = (tokens as (string | bigint)[]).map(toAddressString);

    // Parse reward amounts
    const rewardAmounts = (amounts as (bigint | { low: bigint; high: bigint })[]).map(toBigInt);

    // Build rewards array
    const rewards: AccruedReward[] = tokenAddresses.map((tokenAddress, i) => ({
      tokenAddress,
      amount: rewardAmounts[i] ?? 0n,
    }));

    const claimableRewards = rewards.filter((r) => r.amount > 0n);

    return {
      syAddress,
      rewards,
      hasRewards: claimableRewards.length > 0,
      claimableCount: claimableRewards.length,
    };
  } catch {
    // Contract doesn't support rewards or call failed
    return null;
  }
}

function getValidSyResults(queries: readonly SyRewardsQueryResult[]): SyRewards[] {
  const validResults: SyRewards[] = [];
  for (const query of queries) {
    if (query.data !== null && query.data !== undefined) {
      validResults.push(query.data);
    }
  }
  return validResults;
}

function aggregateRewardsByToken(results: readonly SyRewards[]): AccruedReward[] {
  const rewardsByToken = new Map<string, bigint>();

  for (const syRewards of results) {
    for (const reward of syRewards.rewards) {
      if (reward.amount > 0n) {
        const current = rewardsByToken.get(reward.tokenAddress) ?? 0n;
        rewardsByToken.set(reward.tokenAddress, current + reward.amount);
      }
    }
  }

  return Array.from(rewardsByToken.entries()).map(([tokenAddress, amount]) => ({
    tokenAddress,
    amount,
  }));
}

function getClaimableSyAddresses(results: readonly SyRewards[]): string[] {
  const addresses: string[] = [];
  for (const syRewards of results) {
    if (syRewards.hasRewards) addresses.push(syRewards.syAddress);
  }
  return addresses;
}

function aggregatePortfolioRewards(results: readonly SyRewards[]): PortfolioRewards {
  const allRewards = aggregateRewardsByToken(results);
  const claimableSyAddresses = getClaimableSyAddresses(results);

  return {
    bySy: [...results],
    allRewards,
    claimableSyAddresses,
    hasAnyRewards: claimableSyAddresses.length > 0,
    distinctTokenCount: allRewards.length,
  };
}

/**
 * Hook to fetch accrued rewards across multiple SY addresses.
 *
 * This hook queries each SY contract to check if it supports rewards
 * (via get_reward_tokens) and fetches accrued amounts for the connected user.
 * SY contracts that don't support rewards are silently skipped.
 *
 * @param syAddresses - Array of SY contract addresses to check for rewards
 * @returns Query result with aggregated portfolio rewards
 *
 * @example
 * ```typescript
 * // Get all SY addresses from user's positions
 * const syAddresses = positions.map(p => p.market.syAddress);
 * const { data: rewards, isLoading } = usePortfolioRewards(syAddresses);
 *
 * if (rewards?.hasAnyRewards) {
 *   console.log(`Claimable rewards from ${rewards.claimableSyAddresses.length} positions`);
 * }
 * ```
 */
export function usePortfolioRewards(syAddresses: string[]): {
  data: PortfolioRewards | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const { provider } = useStarknet();
  const { address: userAddress } = useAccount();

  // Deduplicate SY addresses and remove empty strings
  const uniqueAddresses = useMemo(
    () => [...new Set(syAddresses.filter((addr) => addr !== ''))],
    [syAddresses]
  );

  // Query rewards for each SY in parallel
  const queries = useQueries({
    queries: uniqueAddresses.map((syAddress) => ({
      queryKey: ['sy-rewards', 'portfolio', syAddress, userAddress],
      queryFn: async (): Promise<SyRewards | null> => {
        if (!userAddress) return null;
        return fetchSyRewards(syAddress, userAddress, provider);
      },
      enabled: !!userAddress && !!syAddress,
      staleTime: 30_000,
      refetchInterval: 60_000,
    })),
  });

  // Check if any query is loading
  const isLoading = queries.some((q: SyRewardsQueryResult) => q.isLoading);
  const isError = queries.every((q: SyRewardsQueryResult) => q.isError || q.data === null);

  // Aggregate results
  const data = useMemo((): PortfolioRewards | undefined => {
    if (isLoading) return undefined;
    return aggregatePortfolioRewards(getValidSyResults(queries));
  }, [queries, isLoading]);

  return {
    data,
    isLoading,
    isError,
  };
}
