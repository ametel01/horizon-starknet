/**
 * Convert address value (bigint or string) to hex string.
 *
 * Starknet addresses may be returned as bigints from typed contracts.
 * This normalizes them to 0x-prefixed hex strings padded to 64 characters.
 *
 * @param value - The address value (bigint, string, or other)
 * @returns 0x-prefixed hex string
 *
 * @example
 * ```ts
 * const syAddress = await market.sy();
 * const hexAddress = toHexAddress(syAddress);
 * // "0x0123...abc"
 * ```
 */
export function toHexAddress(value: unknown): string {
  if (typeof value === 'bigint') {
    return `0x${value.toString(16).padStart(64, '0')}`;
  }
  return String(value);
}
