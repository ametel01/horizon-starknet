/**
 * Format APY for display with oracle status context.
 *
 * @param apy - APY as decimal (e.g., 0.0824)
 * @param decimals - Number of decimal places (default: 2)
 */
export function formatApyWithStatus(apy: number, decimals = 2): string {
  return `${(apy * 100).toFixed(decimals)}%`;
}
