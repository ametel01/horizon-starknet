/**
 * Shared utility functions for indexers
 *
 * Uses starknet.js utilities where available for robust Cairo type handling.
 */

import { uint256, byteArray, num } from "starknet";

/**
 * Compare selectors numerically (handles padding differences)
 * DNA stream may return "0x0e316f..." while getSelector returns "0x00e316f..."
 *
 * Uses starknet.js num.toBigInt for consistent hex parsing.
 */
export function matchSelector(a: string | undefined, b: string): boolean {
  if (!a) return false;
  try {
    return num.toBigInt(a) === num.toBigInt(b);
  } catch {
    return false;
  }
}

/**
 * Read u256 (2 felts: low, high) from event data
 *
 * Uses starknet.js uint256.uint256ToBN for proper u256 handling.
 */
export function readU256(data: string[], index: number): string {
  const low = data[index] ?? "0";
  const high = data[index + 1] ?? "0";
  const result = uint256.uint256ToBN({ low, high });
  return result.toString();
}

/**
 * Read signed i256 (2 felts: low, high with sign in high bit)
 *
 * Note: starknet.js does not have i256 support (max signed is i128).
 * This is a custom implementation for Cairo's signed 256-bit integers.
 */
export function readI256(data: string[], index: number): string {
  const low = num.toBigInt(data[index] ?? "0");
  const high = num.toBigInt(data[index + 1] ?? "0");
  const isNegative = high >> 127n === 1n;
  const magnitude = isNegative
    ? ((high & ((1n << 127n) - 1n)) << 128n) + low
    : (high << 128n) + low;
  return isNegative ? (-magnitude).toString() : magnitude.toString();
}

/**
 * Decode Cairo ByteArray struct from felt252 array
 *
 * Uses starknet.js byteArray.stringFromByteArray for robust decoding.
 *
 * Cairo ByteArray serialization format:
 * - data[startIndex]: array length (number of full 31-byte chunks)
 * - data[startIndex + 1 ... startIndex + arrayLen]: full 31-byte chunks
 * - data[startIndex + 1 + arrayLen]: pending_word (remaining bytes < 31)
 * - data[startIndex + 2 + arrayLen]: pending_word_len (byte count)
 */
export function decodeByteArray(data: string[], startIndex: number): string {
  const arrayLenHex = data[startIndex];
  if (arrayLenHex === undefined) return "";

  try {
    const arrayLen = Number(BigInt(arrayLenHex));

    // Extract full 31-byte chunks
    const chunks: bigint[] = [];
    for (let i = 0; i < arrayLen; i++) {
      const chunk = data[startIndex + 1 + i];
      if (chunk) {
        chunks.push(BigInt(chunk));
      }
    }

    // Extract pending_word and pending_word_len
    const pendingWordHex = data[startIndex + 1 + arrayLen];
    const pendingWordLenHex = data[startIndex + 2 + arrayLen];

    const pendingWord = pendingWordHex ? BigInt(pendingWordHex) : 0n;
    const pendingWordLen = pendingWordLenHex
      ? Number(BigInt(pendingWordLenHex))
      : 0;

    // Use starknet.js for decoding
    return byteArray.stringFromByteArray({
      data: chunks,
      pending_word: pendingWord,
      pending_word_len: pendingWordLen,
    });
  } catch {
    return "";
  }
}
