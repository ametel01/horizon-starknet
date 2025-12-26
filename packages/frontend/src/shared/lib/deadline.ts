/**
 * Transaction deadline utilities
 *
 * Provides deadline calculation for Router transactions to protect
 * against stale transactions executing at unfavorable prices.
 *
 * @see Security Audit M-06 - Router Deadline Protection
 */

/** Default deadline duration in seconds (20 minutes) */
export const DEFAULT_DEADLINE_SECONDS = 20 * 60;

/**
 * Calculate a deadline timestamp for transaction execution
 *
 * @param customSeconds - Optional custom deadline duration in seconds
 * @returns Unix timestamp as bigint for when the transaction expires
 *
 * @example
 * ```ts
 * // Default 20 minute deadline
 * const deadline = getDeadline();
 *
 * // Custom 5 minute deadline
 * const shortDeadline = getDeadline(5 * 60);
 * ```
 */
export function getDeadline(customSeconds?: number): bigint {
  const seconds = customSeconds ?? DEFAULT_DEADLINE_SECONDS;
  return BigInt(Math.floor(Date.now() / 1000) + seconds);
}

/**
 * Check if a deadline has expired
 *
 * @param deadline - The deadline timestamp to check
 * @returns true if the deadline has passed
 */
export function isDeadlineExpired(deadline: bigint): boolean {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return now > deadline;
}

/**
 * Get remaining time until deadline expires
 *
 * @param deadline - The deadline timestamp
 * @returns Remaining seconds, or 0 if expired
 */
export function getDeadlineRemainingSeconds(deadline: bigint): number {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now >= deadline) {
    return 0;
  }
  return Number(deadline - now);
}
