/**
 * Fee Utilities
 *
 * Utility functions for working with the new fee structure:
 * - ln_fee_rate_root: Natural log of fee rate, stored in WAD (10^18)
 * - reserve_fee_percent: Percentage (0-100) of fees going to treasury
 *
 * The fee model uses time-decay:
 * - adjustedFeeRate = exp(ln_fee_rate_root) - 1
 * - Time decay: fees scale linearly with time to expiry
 *
 * Fee split:
 * - totalFee = lpFee + reserveFee
 * - reserveFee = totalFee * reserve_fee_percent / 100
 * - lpFee = totalFee - reserveFee (retained by LPs)
 */

import { expWad } from '../math/amm';
import { formatWad, WAD_BIGINT } from '../math/wad';

/**
 * Convert ln_fee_rate_root to the annual fee rate as a decimal.
 *
 * The on-chain ln_fee_rate_root is stored in WAD (10^18) fixed-point.
 * Fee rate = exp(ln_fee_rate_root) - 1
 *
 * @param lnFeeRateRoot - Natural log of fee rate root in WAD (string or bigint)
 * @returns Annual fee rate as a decimal (e.g., 0.01 = 1%)
 *
 * @example
 * // For ln_fee_rate_root = 9950330853168082n (ln(1.01) in WAD)
 * calculateAnnualFeeRate('9950330853168082') // returns ~0.01
 */
export function calculateAnnualFeeRate(lnFeeRateRoot: string | bigint): number {
  const lnRate = typeof lnFeeRateRoot === 'string' ? BigInt(lnFeeRateRoot) : lnFeeRateRoot;

  if (lnRate === 0n) {
    return 0;
  }

  // exp(ln_fee_rate_root) - 1
  const feeRateWad = expWad(lnRate) - WAD_BIGINT;

  // Convert from WAD to decimal
  return Number(feeRateWad) / Number(WAD_BIGINT);
}

/**
 * Format annual fee rate as a percentage string.
 *
 * @param lnFeeRateRoot - Natural log of fee rate root in WAD
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string (e.g., "1.00%")
 */
export function formatFeeRate(lnFeeRateRoot: string | bigint, decimals = 2): string {
  const rate = calculateAnnualFeeRate(lnFeeRateRoot);
  return `${(rate * 100).toFixed(decimals)}%`;
}

/**
 * Format a fee breakdown showing LP and treasury splits.
 *
 * @param totalFee - Total fee in WAD (string or bigint)
 * @param lpFee - LP fee portion in WAD (string or bigint)
 * @param reserveFee - Treasury/reserve fee portion in WAD (string or bigint)
 * @param sySymbol - Symbol of the SY token for display
 * @returns Formatted string like "0.001234 xSTRK (80% LP / 20% Treasury)"
 */
export function formatFeeBreakdown(
  totalFee: string | bigint,
  lpFee: string | bigint,
  reserveFee: string | bigint,
  sySymbol: string
): string {
  const total = typeof totalFee === 'string' ? BigInt(totalFee) : totalFee;
  const lp = typeof lpFee === 'string' ? BigInt(lpFee) : lpFee;
  const reserve = typeof reserveFee === 'string' ? BigInt(reserveFee) : reserveFee;

  if (total === 0n) {
    return `0 ${sySymbol}`;
  }

  const lpPercent = ((Number(lp) / Number(total)) * 100).toFixed(1);
  const reservePercent = ((Number(reserve) / Number(total)) * 100).toFixed(1);

  return `${formatWad(total, 6)} ${sySymbol} (${lpPercent}% LP / ${reservePercent}% Treasury)`;
}

/**
 * Calculate the LP fee percentage from reserve fee percent.
 *
 * @param reserveFeePercent - Reserve fee percentage (0-100)
 * @returns LP fee percentage (0-100)
 */
export function getLpFeePercent(reserveFeePercent: number): number {
  return 100 - reserveFeePercent;
}

/**
 * Calculate fee split from total fee and reserve fee percent.
 *
 * @param totalFee - Total fee amount in WAD
 * @param reserveFeePercent - Reserve fee percentage (0-100)
 * @returns Object with lpFee and reserveFee in WAD
 */
export function calculateFeeSplit(
  totalFee: bigint,
  reserveFeePercent: number
): { lpFee: bigint; reserveFee: bigint } {
  if (totalFee === 0n || reserveFeePercent <= 0) {
    return { lpFee: totalFee, reserveFee: 0n };
  }

  if (reserveFeePercent >= 100) {
    return { lpFee: 0n, reserveFee: totalFee };
  }

  const reserveFee = (totalFee * BigInt(reserveFeePercent)) / 100n;
  const lpFee = totalFee - reserveFee;

  return { lpFee, reserveFee };
}

/**
 * Format reserve fee percent for display.
 *
 * @param reserveFeePercent - Reserve fee percentage (0-100)
 * @returns Formatted string like "20%" or "0%"
 */
export function formatReserveFeePercent(reserveFeePercent: number): string {
  return `${reserveFeePercent}%`;
}
