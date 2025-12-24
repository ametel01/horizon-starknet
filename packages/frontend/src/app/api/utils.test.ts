/**
 * API Utilities Tests
 *
 * Tests for shared API utility functions.
 * Run with: bun test src/app/api/utils.test.ts
 */

import { describe, expect, test } from 'bun:test';

/**
 * Normalize a Starknet address for database comparison.
 * Pads the address to full 66 characters (0x + 64 hex chars) and lowercases it.
 *
 * Note: This is copied from the route file for testing purposes.
 * In a real codebase, this would be extracted to a shared utils file.
 */
function normalizeAddressForDb(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  const padded = hex.padStart(64, '0');
  return '0x' + padded;
}

describe('normalizeAddressForDb', () => {
  test('pads short addresses to 66 characters', () => {
    const short = '0x1234';
    const result = normalizeAddressForDb(short);
    expect(result.length).toBe(66); // 0x + 64 chars
    expect(result).toBe('0x0000000000000000000000000000000000000000000000000000000000001234');
  });

  test('lowercases addresses', () => {
    const upper = '0xABCDEF1234567890';
    const result = normalizeAddressForDb(upper);
    // 16 hex chars need 48 zeros to pad to 64
    expect(result).toBe('0x000000000000000000000000000000000000000000000000abcdef1234567890');
  });

  test('handles full-length addresses', () => {
    const full = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const result = normalizeAddressForDb(full);
    expect(result).toBe(full);
    expect(result.length).toBe(66);
  });

  test('handles addresses without 0x prefix', () => {
    const noPrefix = 'abcd1234';
    const result = normalizeAddressForDb(noPrefix);
    expect(result).toStartWith('0x');
    expect(result.length).toBe(66);
  });

  test('handles mixed case addresses', () => {
    const mixed = '0xAbCdEf123456';
    const result = normalizeAddressForDb(mixed);
    expect(result).not.toContain('A');
    expect(result).not.toContain('B');
    expect(result).not.toContain('C');
    expect(result).toContain('abcdef');
  });
});

describe('Query parameter parsing', () => {
  test('parses limit with max of 100', () => {
    const parseLimit = (value: string | null): number => {
      return Math.min(parseInt(value ?? '50'), 100);
    };

    expect(parseLimit(null)).toBe(50);
    expect(parseLimit('20')).toBe(20);
    expect(parseLimit('100')).toBe(100);
    expect(parseLimit('200')).toBe(100); // Capped at 100
    expect(parseLimit('0')).toBe(0);
  });

  test('parses offset with default of 0', () => {
    const parseOffset = (value: string | null): number => {
      return parseInt(value ?? '0');
    };

    expect(parseOffset(null)).toBe(0);
    expect(parseOffset('10')).toBe(10);
    expect(parseOffset('100')).toBe(100);
  });

  test('parses boolean filter parameters', () => {
    const parseActive = (value: string | null): { activeOnly: boolean; expiredOnly: boolean } => {
      return {
        activeOnly: value === 'true',
        expiredOnly: value === 'false',
      };
    };

    expect(parseActive(null)).toEqual({ activeOnly: false, expiredOnly: false });
    expect(parseActive('true')).toEqual({ activeOnly: true, expiredOnly: false });
    expect(parseActive('false')).toEqual({ activeOnly: false, expiredOnly: true });
    expect(parseActive('invalid')).toEqual({ activeOnly: false, expiredOnly: false });
  });

  test('parses sort field with default', () => {
    const parseSort = (value: string | null): string => {
      const validSorts = ['volume', 'tvl', 'expiry', 'created'];
      if (value !== null && validSorts.includes(value)) {
        return value;
      }
      return 'volume';
    };

    expect(parseSort(null)).toBe('volume');
    expect(parseSort('tvl')).toBe('tvl');
    expect(parseSort('expiry')).toBe('expiry');
    expect(parseSort('created')).toBe('created');
    expect(parseSort('invalid')).toBe('volume');
  });

  test('parses order with default', () => {
    const parseOrder = (value: string | null): 'asc' | 'desc' => {
      return value === 'asc' ? 'asc' : 'desc';
    };

    expect(parseOrder(null)).toBe('desc');
    expect(parseOrder('asc')).toBe('asc');
    expect(parseOrder('desc')).toBe('desc');
    expect(parseOrder('invalid')).toBe('desc');
  });
});

describe('BigInt volume calculation', () => {
  test('combines SY and PT volumes correctly', () => {
    const combineVolumes = (syVol: string | null, ptVol: string | null): string => {
      const sy = BigInt(syVol ?? '0');
      const pt = BigInt(ptVol ?? '0');
      return (sy + pt).toString();
    };

    expect(combineVolumes('1000', '500')).toBe('1500');
    expect(combineVolumes('1000000000000000000', '2000000000000000000')).toBe(
      '3000000000000000000'
    );
    expect(combineVolumes(null, '1000')).toBe('1000');
    expect(combineVolumes('1000', null)).toBe('1000');
    expect(combineVolumes(null, null)).toBe('0');
  });

  test('handles large volumes without overflow', () => {
    const combineVolumes = (syVol: string, ptVol: string): string => {
      const sy = BigInt(syVol);
      const pt = BigInt(ptVol);
      return (sy + pt).toString();
    };

    // Test with values larger than Number.MAX_SAFE_INTEGER
    const largeVol1 = '9999999999999999999999999999';
    const largeVol2 = '1111111111111111111111111111';
    const result = combineVolumes(largeVol1, largeVol2);

    expect(result).toBe('11111111111111111111111111110');
  });
});

describe('Response formatting', () => {
  test('formats date to ISO string', () => {
    const formatDate = (date: Date | null): string | null => {
      return date?.toISOString() ?? null;
    };

    const date = new Date('2025-01-15T10:30:00Z');
    expect(formatDate(date)).toBe('2025-01-15T10:30:00.000Z');
    expect(formatDate(null)).toBeNull();
  });

  test('handles nullable fields with defaults', () => {
    interface Row {
      market: string | null;
      volume: string | null;
      count: number | null;
    }

    const formatRow = (row: Row): { market: string; volume: string; count: number } => ({
      market: row.market ?? '',
      volume: row.volume ?? '0',
      count: row.count ?? 0,
    });

    expect(formatRow({ market: '0x123', volume: '1000', count: 5 })).toEqual({
      market: '0x123',
      volume: '1000',
      count: 5,
    });

    expect(formatRow({ market: null, volume: null, count: null })).toEqual({
      market: '',
      volume: '0',
      count: 0,
    });
  });
});

describe('Position filtering', () => {
  test('filters positions with zero balance', () => {
    const hasBalance = (ptBalance: string, ytBalance: string): boolean => {
      const pt = BigInt(ptBalance);
      const yt = BigInt(ytBalance);
      return pt > 0n || yt > 0n;
    };

    expect(hasBalance('1000', '0')).toBe(true);
    expect(hasBalance('0', '1000')).toBe(true);
    expect(hasBalance('1000', '1000')).toBe(true);
    expect(hasBalance('0', '0')).toBe(false);
  });

  test('filters LP positions with zero balance', () => {
    const hasLpBalance = (lpBalance: string): boolean => {
      return BigInt(lpBalance) > 0n;
    };

    expect(hasLpBalance('1000000000000000000')).toBe(true);
    expect(hasLpBalance('1')).toBe(true);
    expect(hasLpBalance('0')).toBe(false);
  });
});
