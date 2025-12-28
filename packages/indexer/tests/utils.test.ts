/**
 * Utils Unit Tests
 *
 * Tests shared utility functions
 */

import { describe, expect, it } from "vitest";

import { ParseError } from "../src/lib/errors";
import {
  matchSelector,
  readU256,
  readI256,
  decodeByteArray,
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
