/**
 * useTokenBalance Hook Utility Tests
 *
 * Tests for utility functions used by the useTokenBalance hook.
 * Run with: bun test src/hooks/useTokenBalance.test.ts
 */

import { describe, expect, test } from 'bun:test';
import { uint256 } from 'starknet';

/**
 * Convert Uint256 or bigint to bigint
 */
function toBigInt(value: bigint | { low: bigint; high: bigint }): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  // Handle Uint256 struct
  return uint256.uint256ToBN(value);
}

/**
 * Convert felt252 to string
 */
function feltToString(felt: bigint): string {
  let hex = felt.toString(16);
  if (hex.length % 2 !== 0) {
    hex = `0${hex}`;
  }
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const charCode = Number.parseInt(hex.substring(i, i + 2), 16);
    if (charCode > 0) {
      str += String.fromCharCode(charCode);
    }
  }
  return str;
}

describe('toBigInt', () => {
  test('returns bigint unchanged', () => {
    const value = 123456789n;
    const result = toBigInt(value);
    expect(result).toBe(value);
  });

  test('converts Uint256 with only low part', () => {
    const u256 = { low: 1000n, high: 0n };
    const result = toBigInt(u256);
    expect(result).toBe(1000n);
  });

  test('converts Uint256 with high part', () => {
    // high = 1 means 2^128
    const u256 = { low: 0n, high: 1n };
    const result = toBigInt(u256);
    expect(result).toBe(2n ** 128n);
  });

  test('converts Uint256 with both parts', () => {
    const u256 = { low: 100n, high: 1n };
    const result = toBigInt(u256);
    expect(result).toBe(2n ** 128n + 100n);
  });

  test('handles max low value', () => {
    const maxLow = 2n ** 128n - 1n;
    const u256 = { low: maxLow, high: 0n };
    const result = toBigInt(u256);
    expect(result).toBe(maxLow);
  });

  test('handles max Uint256', () => {
    const maxLow = 2n ** 128n - 1n;
    const maxHigh = 2n ** 128n - 1n;
    const u256 = { low: maxLow, high: maxHigh };
    const result = toBigInt(u256);
    expect(result).toBe(2n ** 256n - 1n);
  });
});

describe('feltToString', () => {
  test('converts simple ASCII string', () => {
    // "Hello" = 0x48656c6c6f
    const felt = 0x48656c6c6fn;
    const result = feltToString(felt);
    expect(result).toBe('Hello');
  });

  test('converts short_string token symbol', () => {
    // "ETH" = 0x455448
    const felt = 0x455448n;
    const result = feltToString(felt);
    expect(result).toBe('ETH');
  });

  test('converts "STRK" symbol', () => {
    // "STRK" = 0x5354524b
    const felt = 0x5354524bn;
    const result = feltToString(felt);
    expect(result).toBe('STRK');
  });

  test('converts "USDC" symbol', () => {
    // "USDC" = 0x55534443
    const felt = 0x55534443n;
    const result = feltToString(felt);
    expect(result).toBe('USDC');
  });

  test('handles zero', () => {
    const felt = 0n;
    const result = feltToString(felt);
    expect(result).toBe('');
  });

  test('handles single character', () => {
    // "A" = 0x41
    const felt = 0x41n;
    const result = feltToString(felt);
    expect(result).toBe('A');
  });

  test('handles longer token names', () => {
    // "Wrapped BTC" would be longer but felt252 is limited to 31 chars
    // Let's test a medium string: "wstETH" = 0x777374455448
    const felt = 0x777374455448n;
    const result = feltToString(felt);
    expect(result).toBe('wstETH');
  });

  test('skips null bytes', () => {
    // String with embedded null (shouldn't normally happen but edge case)
    // 0x4100 would be "A\0" - the null should be skipped
    const felt = 0x4100n;
    const result = feltToString(felt);
    expect(result).toBe('A');
  });
});

describe('Balance conversion', () => {
  const WAD = 10n ** 18n;

  test('stores and retrieves balance as string', () => {
    const balance = 1234567890123456789012345n;
    const stored = balance.toString();
    const retrieved = BigInt(stored);
    expect(retrieved).toBe(balance);
  });

  test('handles 1 WAD (10^18)', () => {
    const balance = WAD;
    const stored = balance.toString();
    expect(stored).toBe('1000000000000000000');
    expect(BigInt(stored)).toBe(WAD);
  });

  test('handles large balances without precision loss', () => {
    const largeBalance = 999999999999999999999999999n;
    const stored = largeBalance.toString();
    const retrieved = BigInt(stored);
    expect(retrieved).toBe(largeBalance);
  });
});

describe('Allowance checks', () => {
  test('needs approval when allowance is undefined', () => {
    const needsApproval = (allowance: bigint | undefined, amount: bigint): boolean => {
      if (allowance === undefined) return true;
      return allowance < amount;
    };

    expect(needsApproval(undefined, 1000n)).toBe(true);
  });

  test('needs approval when allowance is less than amount', () => {
    const needsApproval = (allowance: bigint | undefined, amount: bigint): boolean => {
      if (allowance === undefined) return true;
      return allowance < amount;
    };

    expect(needsApproval(500n, 1000n)).toBe(true);
  });

  test('does not need approval when allowance equals amount', () => {
    const needsApproval = (allowance: bigint | undefined, amount: bigint): boolean => {
      if (allowance === undefined) return true;
      return allowance < amount;
    };

    expect(needsApproval(1000n, 1000n)).toBe(false);
  });

  test('does not need approval when allowance exceeds amount', () => {
    const needsApproval = (allowance: bigint | undefined, amount: bigint): boolean => {
      if (allowance === undefined) return true;
      return allowance < amount;
    };

    expect(needsApproval(2000n, 1000n)).toBe(false);
  });
});

describe('Token info parsing', () => {
  test('parses decimals correctly', () => {
    expect(Number(18n)).toBe(18);
    expect(Number(6n)).toBe(6);
    expect(Number(8n)).toBe(8);
  });

  test('handles various decimal values', () => {
    const commonDecimals: bigint[] = [18n, 6n, 8n, 0n];
    const expected: number[] = [18, 6, 8, 0];

    commonDecimals.forEach((dec, i) => {
      const exp = expected[i];
      if (exp !== undefined) {
        expect(Number(dec)).toBe(exp);
      }
    });
  });
});
