/**
 * Utils Unit Tests
 *
 * Tests shared utility functions
 */

import { describe, expect, it } from "vitest";
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

  it("should handle missing data", () => {
    const data: string[] = [];
    expect(readU256(data, 0)).toBe("0");
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

  it("should handle missing data", () => {
    const data: string[] = [];
    expect(readI256(data, 0)).toBe("0");
  });
});

describe("decodeByteArray", () => {
  it("should decode short string", () => {
    // "ETH" = 0x455448
    const data = ["0x455448"];
    expect(decodeByteArray(data, 0)).toBe("ETH");
  });

  it("should decode longer string", () => {
    // "STRK" = 0x5354524b
    const data = ["0x5354524b"];
    expect(decodeByteArray(data, 0)).toBe("STRK");
  });

  it("should return empty for 0x0", () => {
    const data = ["0x0"];
    expect(decodeByteArray(data, 0)).toBe("");
  });

  it("should return empty for missing data", () => {
    const data: string[] = [];
    expect(decodeByteArray(data, 0)).toBe("");
  });

  it("should handle null bytes", () => {
    // "AB" followed by null = 0x414200
    const data = ["0x414200"];
    expect(decodeByteArray(data, 0)).toBe("AB");
  });
});
