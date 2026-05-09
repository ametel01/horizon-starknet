'use client';

import { useStarknet } from '@features/wallet';
import { toBigInt, toHexAddress } from '@shared/lib';
import { formatWad, formatWadPercent } from '@shared/math';
import { getYTContract } from '@shared/starknet/contracts';
import { useQueries } from '@tanstack/react-query';

import type { InterestFeeInfo } from './useInterestFee';
import type { PostExpiryInfo } from './usePostExpiryStatus';

const WAD = 10n ** 18n;

/**
 * Parse a Cairo boolean variant to a JavaScript boolean.
 */
function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value !== null && typeof value === 'object') {
    if ('True' in value || 'activeVariant' in value) {
      const obj = value as { activeVariant?: string };
      return obj.activeVariant === 'True' || 'True' in value;
    }
  }
  return false;
}

/**
 * Treasury yield summary for a single YT contract
 */
export interface YTTreasurySummary {
  /** YT contract address */
  ytAddress: string;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Current interest fee rate info */
  feeInfo: InterestFeeInfo | null;
  /** Post-expiry status info (null if not expired) */
  postExpiryInfo: PostExpiryInfo | null;
  /** Total pending treasury interest (claimable by admin) */
  pendingTreasuryInterest: bigint;
  /** Formatted pending interest */
  pendingTreasuryInterestFormatted: string;
  /** Whether there's yield to claim */
  hasYieldToClaim: boolean;
}

/**
 * Aggregated treasury yield across all YT contracts
 */
export interface AggregatedTreasuryYield {
  /** Per-YT breakdown */
  ytSummaries: YTTreasurySummary[];
  /** Total pending treasury interest across all YTs */
  totalPendingInterest: bigint;
  /** Formatted total pending interest */
  totalPendingInterestFormatted: string;
  /** Number of YTs with claimable yield */
  ytWithYieldCount: number;
  /** Whether any data is loading */
  isLoading: boolean;
  /** Whether any queries errored */
  isError: boolean;
}

/**
 * Hook to check if the connected wallet is an admin (owner of any YT contract).
 *
 * This is a simple check that verifies if the wallet address matches
 * the treasury address configured in any YT contract.
 *
 * @param ytAddresses - Array of YT contract addresses to check
 * @returns Whether the connected wallet is an admin
 *
 * @example
 * ```typescript
 * const isAdmin = useIsAdmin(ytAddresses);
 *
 * if (!isAdmin) {
 *   return <NotAuthorized />;
 * }
 * ```
 */
export function useIsAdmin(ytAddresses: string[]): {
  isAdmin: boolean;
  isLoading: boolean;
  treasury: string | null;
} {
  const { provider, address: walletAddress } = useStarknet();

  // Fetch owner for each YT contract in parallel
  const ownerQueries = useQueries({
    queries: ytAddresses.map((ytAddress) => ({
      queryKey: ['yt', 'owner', ytAddress],
      queryFn: async (): Promise<string> => {
        const yt = getYTContract(ytAddress, provider);
        const owner: unknown = await yt.owner();
        // Convert to hex string
        if (typeof owner === 'bigint') {
          return `0x${owner.toString(16)}`;
        }
        return String(owner);
      },
      enabled: ytAddress !== '' && ytAddress !== '0x0',
      staleTime: 300_000, // 5 minutes - owner changes rarely
    })),
  });

  const isLoading = ownerQueries.some((q) => q.isLoading);
  const owners: string[] = [];
  for (const query of ownerQueries) {
    if (query.data !== undefined) {
      owners.push(query.data);
    }
  }

  // Check if connected wallet matches any owner
  const normalizedWallet = walletAddress?.toLowerCase() ?? '';
  const matchingOwner = owners.find((owner) => owner.toLowerCase() === normalizedWallet);
  const isAdmin = matchingOwner !== undefined;

  return {
    isAdmin: normalizedWallet !== '' && isAdmin,
    isLoading,
    treasury: matchingOwner ?? null,
  };
}

/**
 * Combined treasury data for a single YT
 */
interface YTTreasuryData {
  feeInfo: InterestFeeInfo | null;
  postExpiryInfo: PostExpiryInfo | null;
}

/**
 * Hook to aggregate treasury yield data across multiple YT contracts.
 *
 * Fetches fee info and post-expiry status for each YT, then aggregates
 * the pending treasury interest for the admin dashboard.
 *
 * @param ytAddresses - Array of YT contract addresses
 * @returns Aggregated treasury yield data
 *
 * @example
 * ```typescript
 * const { totalPendingInterest, ytSummaries, isLoading } = useTreasuryYield(ytAddresses);
 *
 * return (
 *   <div>
 *     <h2>Total Pending: {formatWad(totalPendingInterest)}</h2>
 *     {ytSummaries.map((yt) => (
 *       <YTCard key={yt.ytAddress} data={yt} />
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useTreasuryYield(ytAddresses: string[]): AggregatedTreasuryYield {
  const { provider } = useStarknet();

  // Fetch combined fee and post-expiry data for all YTs in parallel
  const queries = useQueries({
    queries: ytAddresses.map((ytAddress) => ({
      queryKey: ['yt', 'treasury-data', ytAddress],
      queryFn: async (): Promise<YTTreasuryData> => {
        const yt = getYTContract(ytAddress, provider);

        // Fetch fee rate, treasury, and post-expiry data in parallel
        const [rawFeeRate, rawTreasury, postExpiryData, pendingInterest] = await Promise.all([
          yt.interest_fee_rate(),
          yt.treasury(),
          yt.get_post_expiry_data(),
          yt.get_post_expiry_treasury_interest(),
        ]);

        // Parse fee info
        const feeRate = toBigInt(rawFeeRate);
        const treasury = toHexAddress(rawTreasury);
        const feeRateDecimal = Number(feeRate) / Number(WAD);
        const feeRatePercent = formatWadPercent(feeRate);
        const feeInfo: InterestFeeInfo = {
          feeRate,
          feeRatePercent,
          feeRateDecimal,
          treasury,
          hasFee: feeRate > 0n,
        };

        // Parse post-expiry info
        const dataArray = postExpiryData as unknown[];
        const firstPyIndex = toBigInt(dataArray[0]);
        const totalTreasuryInterest = toBigInt(dataArray[1]);
        const isInitialized = toBool(dataArray[2]);
        const pendingTreasuryInterest = toBigInt(pendingInterest);

        const postExpiryInfo: PostExpiryInfo = {
          firstPyIndex,
          totalTreasuryInterest,
          totalTreasuryInterestFormatted: formatWad(totalTreasuryInterest),
          isInitialized,
          pendingTreasuryInterest,
          pendingTreasuryInterestFormatted: formatWad(pendingTreasuryInterest),
        };

        return { feeInfo, postExpiryInfo };
      },
      enabled: ytAddress !== '' && ytAddress !== '0x0',
      staleTime: 120_000, // 2 minutes
      refetchInterval: 300_000, // 5 minutes
    })),
  });

  // Build per-YT summaries
  const ytSummaries: YTTreasurySummary[] = ytAddresses.map((ytAddress, idx) => {
    const query = queries[idx];
    const data = query?.data;
    const feeInfo = data?.feeInfo ?? null;
    const postExpiryInfo = data?.postExpiryInfo ?? null;

    const pendingTreasuryInterest = postExpiryInfo?.pendingTreasuryInterest ?? 0n;
    const hasYieldToClaim = pendingTreasuryInterest > 0n;

    return {
      ytAddress,
      isLoading: query?.isLoading ?? true,
      feeInfo,
      postExpiryInfo,
      pendingTreasuryInterest,
      pendingTreasuryInterestFormatted: formatWad(pendingTreasuryInterest),
      hasYieldToClaim,
    };
  });

  // Aggregate totals
  const totalPendingInterest = ytSummaries.reduce(
    (sum, yt) => sum + yt.pendingTreasuryInterest,
    0n
  );
  const ytWithYieldCount = ytSummaries.filter((yt) => yt.hasYieldToClaim).length;
  const isLoading = ytSummaries.some((yt) => yt.isLoading);
  const isError = queries.some((q) => q.isError);

  return {
    ytSummaries,
    totalPendingInterest,
    totalPendingInterestFormatted: formatWad(totalPendingInterest),
    ytWithYieldCount,
    isLoading,
    isError,
  };
}

/**
 * Hook to claim treasury interest from a specific YT contract.
 *
 * Only callable by the YT owner (admin). Claims post-expiry yield
 * that has accumulated for the treasury.
 *
 * @returns Mutation function for claiming treasury interest
 */
export { usePendingTreasuryInterest } from './usePostExpiryStatus';
