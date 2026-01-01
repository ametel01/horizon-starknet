'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useAccount, useStarknet } from '@features/wallet';
import { getYTContract } from '@shared/starknet/contracts';

/**
 * Yield claim event from the API
 */
export interface YieldClaimEvent {
  id: string;
  yt: string;
  sy: string;
  expiry: number;
  /** Net amount received after fee deduction (WAD) */
  amountSy: string;
  ytBalance: string;
  pyIndexAtClaim: string;
  exchangeRate: string;
  blockTimestamp: string;
  transactionHash: string;
  /** Fee amount deducted (WAD) - optional, added when API supports it */
  feeAmount?: string;
  /** Gross amount before fee (WAD) - optional, added when API supports it */
  grossAmount?: string;
  /** Fee rate at time of claim (WAD) - optional, added when API supports it */
  feeRateAtClaim?: string;
}

/**
 * Yield summary by position from the API
 */
export interface YieldSummary {
  yt: string;
  sy: string;
  /** Total net yield claimed after fees */
  totalClaimed: string;
  claimCount: number;
  lastClaim: string | null;
  currentYtBalance: string;
  /** Total fees paid to treasury - optional, added when API supports it */
  totalFeesPaid?: string;
  /** Total gross yield before fees - optional, added when API supports it */
  totalGrossYield?: string;
}

/**
 * Response from /api/users/[address]/yield
 */
export interface YieldResponse {
  address: string;
  totalYieldClaimed: string;
  claimHistory: YieldClaimEvent[];
  summaryByPosition: YieldSummary[];
  /** Total fees paid across all positions - optional, added when API supports it */
  totalFeesPaid?: string;
}

/**
 * Processed yield data for display
 */
export interface ProcessedYieldData {
  address: string;
  /** Total net yield claimed (after fees) */
  totalYieldClaimed: bigint;
  claimHistory: YieldClaimEvent[];
  summaryByPosition: {
    yt: string;
    sy: string;
    /** Total net yield claimed (after fees) */
    totalClaimed: bigint;
    claimCount: number;
    lastClaim: Date | null;
    currentYtBalance: bigint;
    /** Total fees paid to treasury */
    totalFeesPaid: bigint;
    /** Total gross yield before fees */
    totalGrossYield: bigint;
  }[];
  /** Total fees paid across all positions */
  totalFeesPaid: bigint;
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
      // Fee fields default to 0 until API is updated
      totalFeesPaid: s.totalFeesPaid ? BigInt(s.totalFeesPaid) : 0n,
      totalGrossYield: s.totalGrossYield ? BigInt(s.totalGrossYield) : BigInt(s.totalClaimed),
    })),
    // Total fees default to 0 until API is updated
    totalFeesPaid: data.totalFeesPaid ? BigInt(data.totalFeesPaid) : 0n,
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

/**
 * Convert various numeric return types to bigint.
 */
function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (value !== null && typeof value === 'object' && 'low' in value && 'high' in value) {
    const { low, high } = value as { low: bigint; high: bigint };
    return low + (high << 128n);
  }
  if (typeof value === 'string') return BigInt(value);
  return 0n;
}

const WAD = 10n ** 18n;

/**
 * Yield claim preview with fee breakdown
 */
export interface YieldClaimPreview {
  /** Gross yield before fee deduction (WAD) */
  grossYield: bigint;
  /** Fee amount that will be deducted (WAD) */
  feeAmount: bigint;
  /** Net yield after fee deduction (WAD) */
  netYield: bigint;
  /** Fee rate as percentage string */
  feeRatePercent: string;
  /** Whether user has yield to claim */
  hasYieldToClaim: boolean;
}

/**
 * Hook to preview a yield claim with fee breakdown.
 *
 * Fetches the user's pending interest and the current fee rate to show
 * what they will receive after fees are deducted.
 *
 * @param ytAddress - The YT contract address
 * @returns Query result with gross/net yield and fee breakdown
 *
 * @example
 * ```typescript
 * const { data: preview } = useYieldClaimPreview(ytAddress);
 *
 * if (preview?.hasYieldToClaim) {
 *   console.log(`Gross: ${formatWad(preview.grossYield)}`);
 *   console.log(`Fee (${preview.feeRatePercent}): ${formatWad(preview.feeAmount)}`);
 *   console.log(`Net: ${formatWad(preview.netYield)}`);
 * }
 * ```
 */
export function useYieldClaimPreview(
  ytAddress: string | undefined
): UseQueryResult<YieldClaimPreview | null> & { address: string | null } {
  const { provider } = useStarknet();
  const { address } = useAccount();

  const query = useQuery({
    queryKey: ['yield-claim-preview', ytAddress, address],
    queryFn: async (): Promise<YieldClaimPreview | null> => {
      if (ytAddress === undefined || !address) {
        return null;
      }

      const yt = getYTContract(ytAddress, provider);

      // Fetch pending interest and fee rate in parallel
      const [rawPendingInterest, rawFeeRate] = await Promise.all([
        yt.get_user_interest(address),
        yt.interest_fee_rate(),
      ]);

      const grossYield = toBigInt(rawPendingInterest);
      const feeRate = toBigInt(rawFeeRate);

      // Calculate fee: gross * feeRate / WAD
      const feeAmount = (grossYield * feeRate) / WAD;
      const netYield = grossYield - feeAmount;

      // Format fee rate as percentage
      const feeRateDecimal = Number(feeRate) / Number(WAD);
      const feeRatePercent = `${(feeRateDecimal * 100).toFixed(2)}%`;

      return {
        grossYield,
        feeAmount,
        netYield,
        feeRatePercent,
        hasYieldToClaim: grossYield > 0n,
      };
    },
    enabled: ytAddress !== undefined && !!address,
    staleTime: 30_000, // 30 seconds - pending interest changes with block
    refetchInterval: 60_000, // Refetch every minute
  });

  return { ...query, address };
}
