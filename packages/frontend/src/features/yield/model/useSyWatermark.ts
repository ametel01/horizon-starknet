'use client';

import { useStarknet } from '@features/wallet';
import { getSYContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { uint256 } from 'starknet';

export interface SyWatermarkInfo {
  /** Highest exchange rate ever seen (WAD) */
  watermark: bigint;
  /** Current exchange rate (WAD) */
  currentRate: bigint;
  /** Whether current rate is below watermark (negative yield detected) */
  hasNegativeYield: boolean;
  /** Drop from watermark in basis points (0 if no drop) */
  rateDropBps: number;
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
 * Hook to monitor SY exchange rate watermark for negative yield detection.
 *
 * The SY contract tracks a "watermark" - the highest exchange rate ever seen.
 * When the current rate drops below this watermark, it indicates negative yield
 * (the underlying asset lost value).
 *
 * This is useful for:
 * - Warning users about underperforming yield sources
 * - Monitoring asset health in dashboards
 * - Triggering alerts when yield goes negative
 *
 * @param syAddress - The SY contract address
 * @returns Query result with watermark info
 *
 * @example
 * ```typescript
 * const { data: watermarkInfo } = useSyWatermark(syAddress);
 *
 * if (watermarkInfo?.hasNegativeYield) {
 *   console.warn(`Negative yield detected! Drop: ${watermarkInfo.rateDropBps} bps`);
 * }
 * ```
 */
export function useSyWatermark(
  syAddress: string | undefined
): UseQueryResult<SyWatermarkInfo | null> {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['sy', 'watermark', syAddress],
    queryFn: async (): Promise<SyWatermarkInfo | null> => {
      if (syAddress === undefined) {
        return null;
      }

      const sy = getSYContract(syAddress, provider);
      const [rawWatermark, rawCurrentRate] = await Promise.all([
        sy.get_exchange_rate_watermark(),
        sy.exchange_rate(),
      ]);

      const watermark = toBigInt(rawWatermark);
      const currentRate = toBigInt(rawCurrentRate);

      const hasNegativeYield = currentRate < watermark;
      let rateDropBps = 0;

      if (hasNegativeYield && watermark > 0n) {
        // Calculate drop in basis points: (watermark - current) * 10000 / watermark
        rateDropBps = Number(((watermark - currentRate) * 10000n) / watermark);
      }

      return {
        watermark,
        currentRate,
        hasNegativeYield,
        rateDropBps,
      };
    },
    enabled: syAddress !== undefined,
    staleTime: 60_000, // 1 minute - rates change slowly
    refetchInterval: 300_000, // Refetch every 5 minutes for monitoring
  });
}

/**
 * Convenience hook to check if negative yield is detected.
 *
 * @param syAddress - The SY contract address
 * @returns Whether negative yield is detected (false if unknown)
 */
export function useHasNegativeYield(syAddress: string | undefined): boolean {
  const { data } = useSyWatermark(syAddress);
  return data?.hasNegativeYield ?? false;
}

/**
 * Convenience hook to get the rate drop in basis points.
 *
 * @param syAddress - The SY contract address
 * @returns Drop from watermark in basis points (0 if no drop or unknown)
 */
export function useSyRateDropBps(syAddress: string | undefined): number {
  const { data } = useSyWatermark(syAddress);
  return data?.rateDropBps ?? 0;
}
