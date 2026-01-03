/**
 * Utils Unit Tests
 *
 * Tests shared utility functions
 */

import { describe, expect, it } from "vitest";

import { ParseError } from "../src/lib/errors";
import {
  decodeByteArray,
  decodeByteArrayWithOffset,
  matchSelector,
  readI256,
  readU256,
} from "../src/lib/utils";

describe("matchSelector", () => {
  it("should match identical selectors", () => {
    expect(matchSelector("0x123", "0x123")).toBe(true);
  });

  it("should match selectors with different padding", () => {
    // DNA stream may return "0xe316f" while getSelector returns "0x00e316f"
    expect(matchSelector("0xe316f", "0x00e316f")).toBe(true);
    expect(matchSelector("0x00e316f", "0xe316f")).toBe(true);
  });

  it("should return false for different selectors", () => {
    expect(matchSelector("0x123", "0x456")).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(matchSelector(undefined, "0x123")).toBe(false);
  });

  it("should return false for invalid hex", () => {
    expect(matchSelector("invalid", "0x123")).toBe(false);
  });
});

describe("readU256", () => {
  it("should read u256 with zero high", () => {
    const data = ["0xde0b6b3a7640000", "0x0"]; // 1e18
    expect(readU256(data, 0)).toBe("1000000000000000000");
  });

  it("should read u256 with non-zero high", () => {
    // high = 1, low = 0 means value = 2^128
    const data = ["0x0", "0x1"];
    expect(readU256(data, 0)).toBe("340282366920938463463374607431768211456");
  });

  it("should throw ParseError for missing data", () => {
    const data: string[] = [];
    expect(() => readU256(data, 0)).toThrow(ParseError);
  });

  it("should read from correct index", () => {
    const data = ["0x1", "0x0", "0xde0b6b3a7640000", "0x0"];
    expect(readU256(data, 2)).toBe("1000000000000000000");
  });
});

describe("readI256", () => {
  it("should read positive i256", () => {
    const data = ["0xde0b6b3a7640000", "0x0"]; // 1e18
    expect(readI256(data, 0)).toBe("1000000000000000000");
  });

  it("should read negative i256", () => {
    // high bit set indicates negative
    // high = 0x80000000000000000000000000000001 means negative with magnitude 1
    const data = ["0x1", "0x80000000000000000000000000000000"];
    expect(readI256(data, 0)).toBe("-1");
  });

  it("should throw ParseError for missing data", () => {
    const data: string[] = [];
    expect(() => readI256(data, 0)).toThrow(ParseError);
  });
});

describe("decodeByteArray", () => {
  // Cairo ByteArray format: [array_len, ...chunks, pending_word, pending_word_len]

  it("should decode short string (3 chars)", () => {
    // "ETH" = 0x455448, length = 3
    const data = ["0x0", "0x455448", "0x3"];
    expect(decodeByteArray(data, 0)).toBe("ETH");
  });

  it("should decode short string (4 chars)", () => {
    // "STRK" = 0x5354524b, length = 4
    const data = ["0x0", "0x5354524b", "0x4"];
    expect(decodeByteArray(data, 0)).toBe("STRK");
  });

  it("should decode 10-char string", () => {
    // "SY-hrzSTRK" = 0x53592d68727a5354524b, length = 10
    const data = ["0x0", "0x53592d68727a5354524b", "0xa"];
    expect(decodeByteArray(data, 0)).toBe("SY-hrzSTRK");
  });

  it("should return empty for zero-length pending_word", () => {
    const data = ["0x0", "0x0", "0x0"];
    expect(decodeByteArray(data, 0)).toBe("");
  });

  it("should throw ParseError for missing data", () => {
    const data: string[] = [];
    expect(() => decodeByteArray(data, 0)).toThrow(ParseError);
  });

  it("should decode from non-zero startIndex", () => {
    // Some prefix data, then ByteArray at index 2
    const data = ["0xabc", "0xdef", "0x0", "0x455448", "0x3"];
    expect(decodeByteArray(data, 2)).toBe("ETH");
  });

  it("should handle 2-char string", () => {
    // "AB" = 0x4142, length = 2
    const data = ["0x0", "0x4142", "0x2"];
    expect(decodeByteArray(data, 0)).toBe("AB");
  });

  it("should decode 29-char string (max pending_word size)", () => {
    // "SY-hrzSTRK-symbol,for-TESTING" = 29 chars (fits in single pending_word < 31 bytes)
    // - array_len = 0x00 (no full chunks)
    // - pending_word = 0x53592d68727a5354524b2d73796d626f6c2c666f722d54455354494e47
    // - pending_word_len = 0x1d (29 bytes)
    const data = [
      "0x0",
      "0x53592d68727a5354524b2d73796d626f6c2c666f722d54455354494e47",
      "0x1d",
    ];
    expect(decodeByteArray(data, 0)).toBe("SY-hrzSTRK-symbol,for-TESTING");
  });
});

describe("decodeByteArrayWithOffset", () => {
  // Tests for variable-length ByteArray decoding with next index tracking
  // Critical for parsing events where fields follow a ByteArray

  it("should return nextIndex=3 for short string (arrayLen=0)", () => {
    // "ETH" uses 3 felts: [arrayLen=0, pending_word, pending_word_len]
    const data = ["0x0", "0x455448", "0x3"];
    const result = decodeByteArrayWithOffset(data, 0);
    expect(result.value).toBe("ETH");
    expect(result.nextIndex).toBe(3); // 0 + 3 + 0 = 3
  });

  it("should return nextIndex=4 for string with 1 full chunk (arrayLen=1)", () => {
    // "This-is-a-32-characters-string!!" = 33 chars
    // Uses 4 felts: [arrayLen=1, chunk1 (31 bytes), pending_word (2 bytes), pending_word_len=2]
    // First 31 bytes: "This-is-a-32-characters-string!"
    // Last 2 bytes: "!!"
    const data = [
      "0x1", // arrayLen = 1
      "0x546869732d69732d612d33322d636861726163746572732d737472696e6721", // 31 bytes
      "0x2121", // pending_word = "!!" (2 bytes)
      "0x2", // pending_word_len = 2
    ];
    const result = decodeByteArrayWithOffset(data, 0);
    expect(result.value).toBe("This-is-a-32-characters-string!!!");
    expect(result.nextIndex).toBe(4); // 0 + 3 + 1 = 4
  });

  it("should correctly parse fields after ByteArray (short symbol)", () => {
    // Simulates MarketCreated data structure with short symbol
    // data[0-11]: fixed fields, data[12-14]: ByteArray, data[15]: next field
    const prefix = Array(12).fill("0xabc"); // 12 placeholder fields
    const byteArrayData = ["0x0", "0x455448", "0x3"]; // "ETH" (3 felts)
    const suffix = ["0xdeadbeef"]; // Field after ByteArray
    const data = [...prefix, ...byteArrayData, ...suffix];

    const result = decodeByteArrayWithOffset(data, 12);
    expect(result.value).toBe("ETH");
    expect(result.nextIndex).toBe(15); // 12 + 3 = 15

    // Can read field immediately after ByteArray
    expect(data[result.nextIndex]).toBe("0xdeadbeef");
  });

  it("should correctly parse fields after ByteArray (long symbol)", () => {
    // Simulates MarketCreated data structure with long symbol (>31 chars)
    const prefix = Array(12).fill("0xabc"); // 12 placeholder fields
    // 33-char symbol uses 4 felts
    const byteArrayData = [
      "0x1", // arrayLen = 1
      "0x546869732d69732d612d33322d636861726163746572732d737472696e6721", // 31-byte chunk
      "0x2121", // pending_word = "!!" (2 bytes)
      "0x2", // pending_word_len = 2
    ];
    const suffix = ["0xdeadbeef"]; // Field after ByteArray
    const data = [...prefix, ...byteArrayData, ...suffix];

    const result = decodeByteArrayWithOffset(data, 12);
    expect(result.value).toBe("This-is-a-32-characters-string!!!");
    expect(result.nextIndex).toBe(16); // 12 + 4 = 16 (not 15!)

    // Can read field immediately after ByteArray at the correct offset
    expect(data[result.nextIndex]).toBe("0xdeadbeef");
  });

  it("should throw ParseError for missing data", () => {
    const data: string[] = [];
    expect(() => decodeByteArrayWithOffset(data, 0)).toThrow(ParseError);
  });

  it("should throw ParseError for insufficient data with arrayLen", () => {
    // Claims to have 1 chunk but doesn't provide enough data
    const data = ["0x1", "0x455448", "0x3"]; // Missing pending_word_len
    expect(() => decodeByteArrayWithOffset(data, 0)).toThrow(ParseError);
  });
});
