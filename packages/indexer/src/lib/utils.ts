/**
 * Shared utility functions for indexers
 *
 * Uses starknet.js utilities where available for robust Cairo type handling.
 * Includes bounds checking to catch malformed events early.
 */

import { byteArray, num, uint256 } from "starknet";

import { ParseError } from "./errors";

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
 * Read u256 (2 felts: low, high) from event data with bounds checking
 *
 * Uses starknet.js uint256.uint256ToBN for proper u256 handling.
 *
 * @param data - Array of hex strings from event data
 * @param index - Starting index for the u256 (reads index and index+1)
 * @param field - Optional field name for error context
 * @throws ParseError if data is insufficient
 */
export function readU256(
  data: string[],
  index: number,
  field?: string
): string {
  if (index < 0 || index + 1 >= data.length) {
    throw new ParseError(
      `Insufficient data for u256 at index ${String(index)}`,
      {
        index,
        dataLength: data.length,
        field: field ?? "u256",
      }
    );
  }

  const low = data[index];
  const high = data[index + 1];

  if (low === undefined || high === undefined) {
    throw new ParseError(`Missing u256 data at index ${String(index)}`, {
      index,
      dataLength: data.length,
      field: field ?? "u256",
    });
  }

  const result = uint256.uint256ToBN({ low, high });
  return result.toString();
}

/**
 * Read u256 with fallback to "0" if data is insufficient (legacy behavior)
 *
 * Use readU256 for strict parsing, this for backwards compatibility.
 *
 * @deprecated Use readU256 for new code - this silently masks errors
 */
export function readU256Safe(data: string[], index: number): string {
  const low = data[index] ?? "0";
  const high = data[index + 1] ?? "0";
  const result = uint256.uint256ToBN({ low, high });
  return result.toString();
}

/**
 * Read signed i256 (2 felts: low, high with sign in high bit) with bounds checking
 *
 * Note: starknet.js does not have i256 support (max signed is i128).
 * This is a custom implementation for Cairo's signed 256-bit integers.
 *
 * @param data - Array of hex strings from event data
 * @param index - Starting index for the i256 (reads index and index+1)
 * @param field - Optional field name for error context
 * @throws ParseError if data is insufficient
 */
export function readI256(
  data: string[],
  index: number,
  field?: string
): string {
  if (index < 0 || index + 1 >= data.length) {
    throw new ParseError(
      `Insufficient data for i256 at index ${String(index)}`,
      {
        index,
        dataLength: data.length,
        field: field ?? "i256",
      }
    );
  }

  const lowStr = data[index];
  const highStr = data[index + 1];

  if (lowStr === undefined || highStr === undefined) {
    throw new ParseError(`Missing i256 data at index ${String(index)}`, {
      index,
      dataLength: data.length,
      field: field ?? "i256",
    });
  }

  const low = num.toBigInt(lowStr);
  const high = num.toBigInt(highStr);
  const isNegative = high >> 127n === 1n;
  const magnitude = isNegative
    ? ((high & ((1n << 127n) - 1n)) << 128n) + low
    : (high << 128n) + low;
  return isNegative ? (-magnitude).toString() : magnitude.toString();
}

/**
 * Read a single felt from event data with bounds checking
 *
 * @param data - Array of hex strings from event data
 * @param index - Index to read from
 * @param field - Optional field name for error context
 * @throws ParseError if index is out of bounds
 */
export function readFelt(
  data: string[],
  index: number,
  field?: string
): string {
  if (index < 0 || index >= data.length) {
    throw new ParseError(`Index ${String(index)} out of bounds`, {
      index,
      dataLength: data.length,
      field: field ?? "felt",
    });
  }

  const value = data[index];
  if (value === undefined) {
    throw new ParseError(`Missing felt at index ${String(index)}`, {
      index,
      dataLength: data.length,
      field: field ?? "felt",
    });
  }

  return value;
}

/**
 * Read a felt as a number (for expiry, timestamps, etc.) with bounds checking
 *
 * @param data - Array of hex strings from event data
 * @param index - Index to read from
 * @param field - Optional field name for error context
 * @throws ParseError if index is out of bounds
 */
export function readFeltAsNumber(
  data: string[],
  index: number,
  field?: string
): number {
  const value = readFelt(data, index, field);
  return Number(BigInt(value));
}

/** Create a ParseError for ByteArray operations */
function byteArrayError(
  message: string,
  startIndex: number,
  dataLength: number,
  field?: string
): ParseError {
  return new ParseError(message, {
    index: startIndex,
    dataLength,
    field: field ?? "ByteArray",
  });
}

/** Extract chunks from ByteArray data */
function extractByteArrayChunks(
  data: string[],
  startIndex: number,
  arrayLen: number
): bigint[] {
  const chunks: bigint[] = [];
  for (let i = 0; i < arrayLen; i++) {
    const chunk = data[startIndex + 1 + i];
    if (chunk) {
      chunks.push(BigInt(chunk));
    }
  }
  return chunks;
}

/**
 * Result of decoding a ByteArray, including the next data index
 */
export interface ByteArrayResult {
  /** The decoded string */
  value: string;
  /** The index immediately after the ByteArray (for reading subsequent fields) */
  nextIndex: number;
}

/**
 * Decode Cairo ByteArray struct from felt252 array with bounds checking
 * Returns both the decoded string and the next index for subsequent field parsing.
 *
 * Uses starknet.js byteArray.stringFromByteArray for robust decoding.
 *
 * Cairo ByteArray serialization format:
 * - data[startIndex]: array length (number of full 31-byte chunks)
 * - data[startIndex + 1 ... startIndex + arrayLen]: full 31-byte chunks
 * - data[startIndex + 1 + arrayLen]: pending_word (remaining bytes < 31)
 * - data[startIndex + 2 + arrayLen]: pending_word_len (byte count)
 *
 * Total felts consumed = 3 + arrayLen
 *
 * @param data - Array of hex strings from event data
 * @param startIndex - Starting index for the ByteArray
 * @param field - Optional field name for error context
 * @returns ByteArrayResult with decoded value and nextIndex
 * @throws ParseError if data is insufficient
 */
export function decodeByteArrayWithOffset(
  data: string[],
  startIndex: number,
  field?: string
): ByteArrayResult {
  // Guard: validate start index bounds
  if (startIndex < 0 || startIndex >= data.length) {
    throw byteArrayError(
      `ByteArray start index ${String(startIndex)} out of bounds`,
      startIndex,
      data.length,
      field
    );
  }

  const arrayLenHex = data[startIndex];
  if (arrayLenHex === undefined) {
    throw byteArrayError(
      `Missing ByteArray length at index ${String(startIndex)}`,
      startIndex,
      data.length,
      field
    );
  }

  try {
    const arrayLen = Number(BigInt(arrayLenHex));
    const requiredLength = startIndex + 1 + arrayLen + 2;

    // Guard: validate sufficient data for all ByteArray components
    if (requiredLength > data.length) {
      throw byteArrayError(
        `Insufficient data for ByteArray: need ${String(requiredLength)}, have ${String(data.length)}`,
        startIndex,
        data.length,
        field
      );
    }

    const chunks = extractByteArrayChunks(data, startIndex, arrayLen);
    const pendingWordHex = data[startIndex + 1 + arrayLen];
    const pendingWordLenHex = data[startIndex + 2 + arrayLen];

    const value = byteArray.stringFromByteArray({
      data: chunks,
      pending_word: pendingWordHex ? BigInt(pendingWordHex) : 0n,
      pending_word_len: pendingWordLenHex
        ? Number(BigInt(pendingWordLenHex))
        : 0,
    });

    // Next index is after: arrayLen (1) + chunks (arrayLen) + pending_word (1) + pending_word_len (1)
    const nextIndex = startIndex + 3 + arrayLen;

    return { value, nextIndex };
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw byteArrayError(
      `Failed to decode ByteArray: ${err instanceof Error ? err.message : String(err)}`,
      startIndex,
      data.length,
      field
    );
  }
}

/**
 * Decode Cairo ByteArray struct from felt252 array with bounds checking
 *
 * Uses starknet.js byteArray.stringFromByteArray for robust decoding.
 *
 * Cairo ByteArray serialization format:
 * - data[startIndex]: array length (number of full 31-byte chunks)
 * - data[startIndex + 1 ... startIndex + arrayLen]: full 31-byte chunks
 * - data[startIndex + 1 + arrayLen]: pending_word (remaining bytes < 31)
 * - data[startIndex + 2 + arrayLen]: pending_word_len (byte count)
 *
 * @param data - Array of hex strings from event data
 * @param startIndex - Starting index for the ByteArray
 * @param field - Optional field name for error context
 * @throws ParseError if data is insufficient
 * @deprecated Use decodeByteArrayWithOffset when you need to read fields after the ByteArray
 */
export function decodeByteArray(
  data: string[],
  startIndex: number,
  field?: string
): string {
  return decodeByteArrayWithOffset(data, startIndex, field).value;
}

/**
 * Decode ByteArray with fallback to empty string (legacy behavior)
 *
 * @deprecated Use decodeByteArray for new code - this silently masks errors
 */
export function decodeByteArraySafe(
  data: string[],
  startIndex: number
): string {
  try {
    return decodeByteArray(data, startIndex);
  } catch {
    return "";
  }
}
