'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { uint256 } from 'starknet';

import { useStarknet } from '@features/wallet';
import { formatWadPercent } from '@shared/math';
import { getYTContract } from '@shared/starknet/contracts';

/**
 * Interest fee configuration for a YT token
 */
export interface InterestFeeInfo {
  /** Current interest fee rate (WAD-scaled, e.g., 0.03e18 = 3%) */
  feeRate: bigint;
  /** Fee rate formatted as percentage string (e.g., "3.00%") */
  feeRatePercent: string;
  /** Fee rate as a decimal (e.g., 0.03) */
  feeRateDecimal: number;
  /** Treasury address that receives protocol fees */
  treasury: string;
  /** Whether a fee is currently being charged (feeRate > 0) */
  hasFee: boolean;
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
 * Convert a contract address to a hex string.
 * Handles: string, bigint, number
 */
function toHexAddress(value: unknown): string {
  if (typeof value === 'string') {
    return value.startsWith('0x') ? value : `0x${value}`;
  }
  if (typeof value === 'bigint') {
    return `0x${value.toString(16)}`;
  }
  if (typeof value === 'number') {
    return `0x${value.toString(16)}`;
  }
  return '0x0';
}

const WAD = 10n ** 18n;

/**
 * Hook to fetch the current interest fee rate and treasury address for a YT token.
 *
 * The interest fee is a protocol fee charged on yield claims. When users claim
 * interest from their YT positions, a percentage is redirected to the treasury.
 *
 * @param ytAddress - The YT contract address
 * @returns Query result with fee rate and treasury info
 *
 * @example
 * ```typescript
 * const { data: feeInfo } = useInterestFee(ytAddress);
 *
 * if (feeInfo?.hasFee) {
 *   console.log(`Protocol fee: ${feeInfo.feeRatePercent}`);
 *   console.log(`Treasury: ${feeInfo.treasury}`);
 * }
 * ```
 */
export function useInterestFee(
  ytAddress: string | undefined
): UseQueryResult<InterestFeeInfo | null> {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['yt', 'interest-fee', ytAddress],
    queryFn: async (): Promise<InterestFeeInfo | null> => {
      if (ytAddress === undefined) {
        return null;
      }

      const yt = getYTContract(ytAddress, provider);

      // Fetch fee rate and treasury in parallel
      const [rawFeeRate, rawTreasury] = await Promise.all([yt.interest_fee_rate(), yt.treasury()]);

      const feeRate = toBigInt(rawFeeRate);
      // Treasury returns a felt252/ContractAddress, convert to hex string
      const treasury = toHexAddress(rawTreasury);

      // Calculate decimal and percentage
      const feeRateDecimal = Number(feeRate) / Number(WAD);
      const feeRatePercent = formatWadPercent(feeRate);

      return {
        feeRate,
        feeRatePercent,
        feeRateDecimal,
        treasury,
        hasFee: feeRate > 0n,
      };
    },
    enabled: ytAddress !== undefined,
    staleTime: 60_000, // 1 minute - fee rate changes infrequently
    refetchInterval: 300_000, // Refetch every 5 minutes
  });
}

/**
 * Convenience hook to check if a fee is being charged.
 *
 * @param ytAddress - The YT contract address
 * @returns Whether a fee is charged (false if unknown)
 */
export function useHasInterestFee(ytAddress: string | undefined): boolean {
  const { data } = useInterestFee(ytAddress);
  return data?.hasFee ?? false;
}

/**
 * Convenience hook to get the fee rate as a decimal.
 *
 * @param ytAddress - The YT contract address
 * @returns Fee rate as decimal (e.g., 0.03 for 3%), 0 if unknown
 */
export function useInterestFeeRate(ytAddress: string | undefined): number {
  const { data } = useInterestFee(ytAddress);
  return data?.feeRateDecimal ?? 0;
}
