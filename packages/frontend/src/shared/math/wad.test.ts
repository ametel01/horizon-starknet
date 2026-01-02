/**
 * WAD Fixed-Point Math Tests
 *
 * Tests for verifying WAD (10^18) fixed-point math utilities.
 * Run with: bun test src/lib/math/wad.test.ts
 */

import { describe, expect, test } from 'bun:test';
import BigNumber from 'bignumber.js';

import {
  formatTokenAmount,
  formatWad,
  formatWadCompact,
  formatWadPercent,
  fromWad,
  parseTokenAmount,
  parseWad,
  toWad,
  WAD,
  WAD_BIGINT,
  wadDiv,
  wadMul,
} from './wad';

describe('WAD Constants', () => {
  test('WAD equals 10^18', () => {
    expect(WAD.toString()).toBe('1000000000000000000');
    expect(WAD_BIGINT).toBe(10n ** 18n);
  });

  test('WAD and WAD_BIGINT represent the same value', () => {
    expect(WAD.toString()).toBe(WAD_BIGINT.toString());
  });
});

describe('fromWad', () => {
  test('converts WAD bigint to 1.0', () => {
    const result = fromWad(WAD_BIGINT);
    expect(result.toNumber()).toBe(1);
  });

  test('converts 2 WAD to 2.0', () => {
    const result = fromWad(2n * WAD_BIGINT);
    expect(result.toNumber()).toBe(2);
  });

  test('converts half WAD to 0.5', () => {
    const result = fromWad(WAD_BIGINT / 2n);
    expect(result.toNumber()).toBe(0.5);
  });

  test('converts zero to 0', () => {
    const result = fromWad(0n);
    expect(result.toNumber()).toBe(0);
  });

  test('handles string input', () => {
    const result = fromWad('1000000000000000000');
    expect(result.toNumber()).toBe(1);
  });

  test('handles large values', () => {
    const largeValue = 1_000_000n * WAD_BIGINT; // 1 million
    const result = fromWad(largeValue);
    expect(result.toNumber()).toBe(1_000_000);
  });
});

describe('toWad', () => {
  test('converts 1.0 to WAD', () => {
    const result = toWad(1);
    expect(result).toBe(WAD_BIGINT);
  });

  test('converts 0.5 to half WAD', () => {
    const result = toWad(0.5);
    expect(result).toBe(WAD_BIGINT / 2n);
  });

  test('converts string input', () => {
    const result = toWad('2.5');
    expect(result).toBe((5n * WAD_BIGINT) / 2n);
  });

  test('converts BigNumber input', () => {
    const bn = new BigNumber(Math.PI);
    const result = toWad(bn);
    expect(fromWad(result).toFixed(5)).toBe('3.14159');
  });

  test('converts zero', () => {
    const result = toWad(0);
    expect(result).toBe(0n);
  });

  test('rounds down fractional results', () => {
    // 1/3 = 0.333... should round down due to integer truncation
    const result = toWad(1 / 3);
    const backToNumber = fromWad(result).toNumber();
    // The result should be very close to 1/3 (within BigNumber precision)
    expect(Math.abs(backToNumber - 1 / 3)).toBeLessThan(0.0000001);
  });
});

describe('formatWad', () => {
  test('formats 1 WAD with default decimals', () => {
    const result = formatWad(WAD_BIGINT);
    expect(result).toBe('1.0000');
  });

  test('formats with custom decimals', () => {
    const result = formatWad(WAD_BIGINT, 2);
    expect(result).toBe('1.00');
  });

  test('formats fractional values', () => {
    const halfWad = WAD_BIGINT / 2n;
    const result = formatWad(halfWad, 4);
    expect(result).toBe('0.5000');
  });

  test('formats zero', () => {
    const result = formatWad(0n, 4);
    expect(result).toBe('0.0000');
  });

  test('handles string input', () => {
    const result = formatWad('1500000000000000000', 2);
    expect(result).toBe('1.50');
  });
});

describe('formatWadCompact', () => {
  test('returns "0" for zero', () => {
    expect(formatWadCompact(0n)).toBe('0');
  });

  test('returns "0" for very small values', () => {
    expect(formatWadCompact(100n)).toBe('0'); // 0.0000000000000001
  });

  test('formats millions with M suffix', () => {
    const million = 1_000_000n * WAD_BIGINT;
    expect(formatWadCompact(million)).toBe('1.00M');
  });

  test('formats 5.5 million correctly', () => {
    const value = 55n * WAD_BIGINT * 100_000n;
    expect(formatWadCompact(value)).toBe('5.50M');
  });

  test('formats thousands with K suffix', () => {
    const thousand = 1_000n * WAD_BIGINT;
    expect(formatWadCompact(thousand)).toBe('1.00K');
  });

  test('formats numbers >= 1 with 2 decimals', () => {
    const value = (15n * WAD_BIGINT) / 10n; // 1.5
    expect(formatWadCompact(value)).toBe('1.50');
  });

  test('formats small numbers >= 0.01 with 4 decimals', () => {
    const value = WAD_BIGINT / 20n; // 0.05
    expect(formatWadCompact(value)).toBe('0.0500');
  });

  test('returns "< 0.01" for very small positive numbers', () => {
    const value = WAD_BIGINT / 200n; // 0.005
    expect(formatWadCompact(value)).toBe('< 0.01');
  });
});

describe('formatWadPercent', () => {
  test('formats 0.5 WAD as 50%', () => {
    const halfWad = WAD_BIGINT / 2n;
    expect(formatWadPercent(halfWad)).toBe('50.00%');
  });

  test('formats 1 WAD as 100%', () => {
    expect(formatWadPercent(WAD_BIGINT)).toBe('100.00%');
  });

  test('formats with custom decimals', () => {
    const value = WAD_BIGINT / 3n; // ~33.33%
    expect(formatWadPercent(value, 1)).toBe('33.3%');
  });

  test('formats zero as 0%', () => {
    expect(formatWadPercent(0n)).toBe('0.00%');
  });
});

describe('wadMul', () => {
  test('multiplies 1 * 1 = 1', () => {
    const result = wadMul(WAD_BIGINT, WAD_BIGINT);
    expect(result).toBe(WAD_BIGINT);
  });

  test('multiplies 2 * 3 = 6', () => {
    const two = 2n * WAD_BIGINT;
    const three = 3n * WAD_BIGINT;
    const result = wadMul(two, three);
    expect(result).toBe(6n * WAD_BIGINT);
  });

  test('multiplies 0.5 * 0.5 = 0.25', () => {
    const half = WAD_BIGINT / 2n;
    const result = wadMul(half, half);
    expect(result).toBe(WAD_BIGINT / 4n);
  });

  test('multiplies by zero returns zero', () => {
    const result = wadMul(WAD_BIGINT, 0n);
    expect(result).toBe(0n);
  });

  test('handles large numbers', () => {
    const million = 1_000_000n * WAD_BIGINT;
    const thousand = 1_000n * WAD_BIGINT;
    const result = wadMul(million, thousand);
    expect(result).toBe(1_000_000_000n * WAD_BIGINT);
  });
});

describe('wadDiv', () => {
  test('divides 1 / 1 = 1', () => {
    const result = wadDiv(WAD_BIGINT, WAD_BIGINT);
    expect(result).toBe(WAD_BIGINT);
  });

  test('divides 6 / 2 = 3', () => {
    const six = 6n * WAD_BIGINT;
    const two = 2n * WAD_BIGINT;
    const result = wadDiv(six, two);
    expect(result).toBe(3n * WAD_BIGINT);
  });

  test('divides 1 / 2 = 0.5', () => {
    const result = wadDiv(WAD_BIGINT, 2n * WAD_BIGINT);
    expect(result).toBe(WAD_BIGINT / 2n);
  });

  test('throws on division by zero', () => {
    expect(() => wadDiv(WAD_BIGINT, 0n)).toThrow('Division by zero');
  });

  test('handles fractional results', () => {
    // 1 / 3 should give approximately 0.333...
    const result = wadDiv(WAD_BIGINT, 3n * WAD_BIGINT);
    const expected = WAD_BIGINT / 3n;
    expect(result).toBe(expected);
  });
});

describe('parseWad', () => {
  test('parses "1" to WAD', () => {
    expect(parseWad('1')).toBe(WAD_BIGINT);
  });

  test('parses "0.5" to half WAD', () => {
    expect(parseWad('0.5')).toBe(WAD_BIGINT / 2n);
  });

  test('parses "100.25" correctly', () => {
    const result = parseWad('100.25');
    expect(fromWad(result).toNumber()).toBe(100.25);
  });

  test('returns 0 for empty string', () => {
    expect(parseWad('')).toBe(0n);
  });

  test('returns 0 for invalid input', () => {
    expect(parseWad('abc')).toBe(0n);
    expect(parseWad('NaN')).toBe(0n);
    expect(parseWad('Infinity')).toBe(0n);
  });

  test('returns 0 for negative infinity', () => {
    expect(parseWad('-Infinity')).toBe(0n);
  });

  test('handles negative numbers', () => {
    const result = parseWad('-1.5');
    expect(fromWad(result).toNumber()).toBe(-1.5);
  });
});

describe('formatTokenAmount', () => {
  test('formats with 18 decimals (default)', () => {
    const amount = WAD_BIGINT;
    expect(formatTokenAmount(amount)).toBe('1.0000');
  });

  test('formats with 6 decimals (USDC-like)', () => {
    const amount = 1_000_000n; // 1 USDC
    expect(formatTokenAmount(amount, 6, 2)).toBe('1.00');
  });

  test('formats with 8 decimals (BTC-like)', () => {
    const amount = 100_000_000n; // 1 BTC
    expect(formatTokenAmount(amount, 8, 4)).toBe('1.0000');
  });

  test('formats zero', () => {
    expect(formatTokenAmount(0n, 18, 4)).toBe('0.0000');
  });

  test('handles string input', () => {
    expect(formatTokenAmount('1000000000000000000', 18, 2)).toBe('1.00');
  });
});

describe('parseTokenAmount', () => {
  test('parses with 18 decimals (default)', () => {
    expect(parseTokenAmount('1')).toBe(WAD_BIGINT);
  });

  test('parses with 6 decimals (USDC-like)', () => {
    expect(parseTokenAmount('1', 6)).toBe(1_000_000n);
  });

  test('parses with 8 decimals (BTC-like)', () => {
    expect(parseTokenAmount('1', 8)).toBe(100_000_000n);
  });

  test('returns 0 for invalid input', () => {
    expect(parseTokenAmount('abc')).toBe(0n);
    expect(parseTokenAmount('NaN')).toBe(0n);
  });

  test('returns 0 for Infinity', () => {
    expect(parseTokenAmount('Infinity')).toBe(0n);
  });

  test('parses fractional amounts', () => {
    expect(parseTokenAmount('0.5', 18)).toBe(WAD_BIGINT / 2n);
  });
});

describe('Round-trip conversions', () => {
  test('toWad -> fromWad preserves value', () => {
    const original = 123.456789;
    const wad = toWad(original);
    const result = fromWad(wad).toNumber();
    // Allow small precision loss
    expect(Math.abs(result - original)).toBeLessThan(0.000001);
  });

  test('parseWad -> formatWad preserves value', () => {
    const original = '99.1234';
    const wad = parseWad(original);
    const result = formatWad(wad, 4);
    expect(result).toBe('99.1234');
  });

  test('parseTokenAmount -> formatTokenAmount preserves value', () => {
    const original = '1.5';
    const amount = parseTokenAmount(original, 6);
    const result = formatTokenAmount(amount, 6, 1);
    expect(result).toBe('1.5');
  });
});
