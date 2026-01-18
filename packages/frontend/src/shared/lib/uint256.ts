import { uint256 } from 'starknet';

/**
 * Type alias for Uint256-like values from contracts.
 * Starknet.js typed contracts may return either a bigint or Uint256 struct { low, high }.
 */
export type Uint256Like = bigint | { low: bigint; high: bigint };

/**
 * Convert Uint256 or bigint to bigint.
 *
 * Handles the following input types:
 * - bigint: returned as-is
 * - Uint256 struct { low, high }: converted using starknet.js uint256ToBN
 * - number: converted to bigint
 * - string: parsed as bigint
 * - unknown object with low/high: safely converted
 * - null/undefined/other: returns 0n
 *
 * @param value - The value to convert
 * @returns The value as a bigint
 */
export function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return 0n;
    }
    return BigInt(value);
  }

  if (typeof value === 'string') {
    if (value === '') {
      return 0n;
    }
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }

  if (value !== null && typeof value === 'object' && 'low' in value && 'high' in value) {
    // Use starknet.js for proper Uint256 conversion
    return uint256.uint256ToBN(value as { low: bigint; high: bigint });
  }

  return 0n;
}
