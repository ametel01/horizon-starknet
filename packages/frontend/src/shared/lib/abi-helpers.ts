import { toBigInt } from './uint256';

/**
 * Type for reserve values that may be bigint or Uint256 struct.
 */
export type ReserveLike = bigint | { low: bigint; high: bigint };

/**
 * Parsed reserves from market contract.
 */
export interface ParsedReserves {
  syReserve: bigint;
  ptReserve: bigint;
}

/**
 * Parse reserves tuple from market contract's get_reserves() call.
 *
 * The contract returns (sy_reserve: u256, pt_reserve: u256) which starknet.js
 * may represent as an array of bigints or Uint256 structs depending on ABI version.
 *
 * @param reserves - The raw reserves value from contract call
 * @returns Parsed reserves with syReserve and ptReserve as bigints
 *
 * @example
 * ```ts
 * const reserves = await market.get_reserves();
 * const { syReserve, ptReserve } = parseReserves(reserves);
 * ```
 */
export function parseReserves(reserves: unknown): ParsedReserves {
  if (!Array.isArray(reserves) || reserves.length < 2) {
    return { syReserve: 0n, ptReserve: 0n };
  }
  return {
    syReserve: toBigInt(reserves[0]),
    ptReserve: toBigInt(reserves[1]),
  };
}

/**
 * Parse an array of Uint256 values from contract calls.
 *
 * Handles arrays where each element may be a bigint or Uint256 struct.
 * Useful for parsing multi-value returns like post-expiry data.
 *
 * @param values - The raw array from contract call
 * @returns Array of bigints
 *
 * @example
 * ```ts
 * const postExpiryData = await yt.get_post_expiry_data(userAddress);
 * const [firstPyIndex, totalTreasuryInterest] = parseUint256Array(postExpiryData);
 * ```
 */
export function parseUint256Array(values: unknown): bigint[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map((v) => toBigInt(v));
}

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
