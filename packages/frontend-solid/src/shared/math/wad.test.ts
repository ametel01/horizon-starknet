import BigNumber from 'bignumber.js';
import { describe, expect, it } from 'vitest';
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

describe('WAD constants', () => {
  it('WAD should be 10^18', () => {
    expect(WAD.toString()).toBe('1000000000000000000');
  });

  it('WAD_BIGINT should be 10^18n', () => {
    expect(WAD_BIGINT).toBe(10n ** 18n);
  });
});

describe('fromWad', () => {
  it('converts WAD bigint to BigNumber', () => {
    const result = fromWad(WAD_BIGINT);
    expect(result.toString()).toBe('1');
  });

  it('converts 0 correctly', () => {
    expect(fromWad(0n).toString()).toBe('0');
  });

  it('converts decimal WAD values correctly', () => {
    const halfWad = WAD_BIGINT / 2n;
    const result = fromWad(halfWad);
    expect(result.toString()).toBe('0.5');
  });

  it('handles string input', () => {
    const result = fromWad('1000000000000000000');
    expect(result.toString()).toBe('1');
  });

  it('handles number input', () => {
    const result = fromWad(1000000000000000000);
    expect(result.toString()).toBe('1');
  });
});

describe('toWad', () => {
  it('converts number to WAD bigint', () => {
    expect(toWad(1)).toBe(WAD_BIGINT);
  });

  it('converts 0 correctly', () => {
    expect(toWad(0)).toBe(0n);
  });

  it('converts decimal to WAD correctly', () => {
    expect(toWad(0.5)).toBe(WAD_BIGINT / 2n);
  });

  it('handles string input', () => {
    expect(toWad('1')).toBe(WAD_BIGINT);
  });

  it('handles BigNumber input', () => {
    expect(toWad(new BigNumber(1))).toBe(WAD_BIGINT);
  });

  it('handles small decimals', () => {
    const result = toWad(0.001);
    expect(result).toBe(1000000000000000n);
  });
});

describe('formatWad', () => {
  it('formats WAD value with default decimals', () => {
    expect(formatWad(WAD_BIGINT)).toBe('1.0000');
  });

  it('formats WAD value with custom decimals', () => {
    expect(formatWad(WAD_BIGINT, 2)).toBe('1.00');
  });

  it('formats zero correctly', () => {
    expect(formatWad(0n)).toBe('0.0000');
  });

  it('handles string input', () => {
    expect(formatWad('1000000000000000000', 2)).toBe('1.00');
  });

  it('formats decimal values correctly', () => {
    const value = (WAD_BIGINT * 15n) / 10n; // 1.5
    expect(formatWad(value, 1)).toBe('1.5');
  });
});

describe('formatWadCompact', () => {
  it("formats zero as '0'", () => {
    expect(formatWadCompact(0n)).toBe('0');
  });

  it("formats very small values as '0'", () => {
    expect(formatWadCompact(1n)).toBe('0');
  });

  it('formats millions with M suffix', () => {
    const fiveMillion = toWad(5_000_000);
    expect(formatWadCompact(fiveMillion)).toBe('5.00M');
  });

  it('formats thousands with K suffix', () => {
    const fiveThousand = toWad(5_000);
    expect(formatWadCompact(fiveThousand)).toBe('5.00K');
  });

  it('formats medium numbers with 2 decimals', () => {
    const fifty = toWad(50.5);
    expect(formatWadCompact(fifty)).toBe('50.50');
  });

  it('formats small numbers with 4 decimals', () => {
    const small = toWad(0.0123);
    expect(formatWadCompact(small)).toBe('0.0123');
  });

  it("formats very small non-zero as '< 0.01'", () => {
    const verySmall = toWad(0.001);
    expect(formatWadCompact(verySmall)).toBe('< 0.01');
  });

  it('handles string input', () => {
    const value = (WAD_BIGINT * 100n).toString();
    expect(formatWadCompact(value)).toBe('100.00');
  });
});

describe('formatWadPercent', () => {
  it('formats 1 WAD as 100%', () => {
    expect(formatWadPercent(WAD_BIGINT)).toBe('100.00%');
  });

  it('formats 0.5 WAD as 50%', () => {
    expect(formatWadPercent(WAD_BIGINT / 2n)).toBe('50.00%');
  });

  it('formats with custom decimals', () => {
    expect(formatWadPercent(WAD_BIGINT, 0)).toBe('100%');
  });

  it('handles small percentages', () => {
    const onePercent = WAD_BIGINT / 100n;
    expect(formatWadPercent(onePercent)).toBe('1.00%');
  });
});

describe('wadMul', () => {
  it('multiplies two WAD values correctly', () => {
    const result = wadMul(WAD_BIGINT, WAD_BIGINT);
    expect(result).toBe(WAD_BIGINT);
  });

  it('multiplies 2 * 3 in WAD', () => {
    const two = WAD_BIGINT * 2n;
    const three = WAD_BIGINT * 3n;
    const result = wadMul(two, three);
    expect(result).toBe(WAD_BIGINT * 6n);
  });

  it('handles zero', () => {
    expect(wadMul(0n, WAD_BIGINT)).toBe(0n);
    expect(wadMul(WAD_BIGINT, 0n)).toBe(0n);
  });

  it('handles decimals correctly', () => {
    const half = WAD_BIGINT / 2n;
    const result = wadMul(half, half);
    expect(result).toBe(WAD_BIGINT / 4n);
  });
});

describe('wadDiv', () => {
  it('divides two WAD values correctly', () => {
    const result = wadDiv(WAD_BIGINT, WAD_BIGINT);
    expect(result).toBe(WAD_BIGINT);
  });

  it('divides 6 / 2 in WAD', () => {
    const six = WAD_BIGINT * 6n;
    const two = WAD_BIGINT * 2n;
    const result = wadDiv(six, two);
    expect(result).toBe(WAD_BIGINT * 3n);
  });

  it('throws on division by zero', () => {
    expect(() => wadDiv(WAD_BIGINT, 0n)).toThrow('Division by zero');
  });

  it('handles decimal results', () => {
    const one = WAD_BIGINT;
    const two = WAD_BIGINT * 2n;
    const result = wadDiv(one, two);
    expect(result).toBe(WAD_BIGINT / 2n);
  });
});

describe('parseWad', () => {
  it('parses valid number string', () => {
    expect(parseWad('1')).toBe(WAD_BIGINT);
  });

  it('parses decimal string', () => {
    expect(parseWad('0.5')).toBe(WAD_BIGINT / 2n);
  });

  it('returns 0 for invalid input', () => {
    expect(parseWad('invalid')).toBe(0n);
  });

  it('returns 0 for empty string', () => {
    expect(parseWad('')).toBe(0n);
  });

  it('returns 0 for NaN', () => {
    expect(parseWad('NaN')).toBe(0n);
  });

  it('returns 0 for Infinity', () => {
    expect(parseWad('Infinity')).toBe(0n);
  });

  it('parses negative numbers', () => {
    const result = parseWad('-1');
    expect(result).toBe(-WAD_BIGINT);
  });
});

describe('formatTokenAmount', () => {
  it('formats with default 18 decimals', () => {
    expect(formatTokenAmount(WAD_BIGINT)).toBe('1.0000');
  });

  it('formats with custom token decimals', () => {
    const amount = 1000000n; // 1 USDC (6 decimals)
    expect(formatTokenAmount(amount, 6, 2)).toBe('1.00');
  });

  it('formats zero correctly', () => {
    expect(formatTokenAmount(0n)).toBe('0.0000');
  });

  it('handles string input', () => {
    expect(formatTokenAmount('1000000000000000000', 18, 2)).toBe('1.00');
  });

  it('formats large amounts', () => {
    const largeAmount = WAD_BIGINT * 1000000n;
    expect(formatTokenAmount(largeAmount, 18, 0)).toBe('1000000');
  });
});

describe('parseTokenAmount', () => {
  it('parses with default 18 decimals', () => {
    expect(parseTokenAmount('1')).toBe(WAD_BIGINT);
  });

  it('parses with custom token decimals', () => {
    expect(parseTokenAmount('1', 6)).toBe(1000000n);
  });

  it('returns 0 for invalid input', () => {
    expect(parseTokenAmount('invalid')).toBe(0n);
  });

  it('parses decimal values', () => {
    expect(parseTokenAmount('0.5')).toBe(WAD_BIGINT / 2n);
  });

  it('parses with 8 decimals (BTC-style)', () => {
    expect(parseTokenAmount('1', 8)).toBe(100000000n);
  });

  it('returns 0 for empty string', () => {
    expect(parseTokenAmount('')).toBe(0n);
  });
});
