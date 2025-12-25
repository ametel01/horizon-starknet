/**
 * Shared utility functions for indexers
 */

import { uint256 } from "starknet";

/**
 * Compare selectors numerically (handles padding differences)
 * DNA stream may return "0x0e316f..." while getSelector returns "0x00e316f..."
 */
export function matchSelector(a: string | undefined, b: string): boolean {
  if (!a) return false;
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return false;
  }
}

/**
 * Read u256 (2 felts: low, high) from event data
 */
export function readU256(data: string[], index: number): string {
  const low = data[index] ?? "0";
  const high = data[index + 1] ?? "0";
  const result = uint256.uint256ToBN({ low, high });
  return result.toString();
}

/**
 * Read signed i256 (2 felts: low, high with sign in high bit)
 */
export function readI256(data: string[], index: number): string {
  const low = BigInt(data[index] ?? "0");
  const high = BigInt(data[index + 1] ?? "0");
  const isNegative = high >> 127n === 1n;
  const magnitude = isNegative
    ? ((high & ((1n << 127n) - 1n)) << 128n) + low
    : (high << 128n) + low;
  return isNegative ? (-magnitude).toString() : magnitude.toString();
}

/**
 * Decode ByteArray from felt252 array (short string encoding)
 */
export function decodeByteArray(data: string[], startIndex: number): string {
  const pendingWord = data[startIndex];
  if (!pendingWord || pendingWord === "0x0") return "";

  try {
    const hex = pendingWord.replace("0x", "");
    let str = "";
    for (let i = 0; i < hex.length; i += 2) {
      const charCode = parseInt(hex.substr(i, 2), 16);
      if (charCode === 0) break;
      str += String.fromCharCode(charCode);
    }
    return str;
  } catch {
    return pendingWord;
  }
}
