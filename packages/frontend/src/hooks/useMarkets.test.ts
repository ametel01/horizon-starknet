/**
 * useMarkets Hook Utility Tests
 *
 * Tests for utility functions used by the useMarkets hook.
 * Run with: bun test src/hooks/useMarkets.test.ts
 */

import { describe, expect, test } from 'bun:test';

/**
 * Convert address value (bigint or string) to hex string
 * Padded to 66 characters (0x + 64 hex chars)
 */
function toHexAddress(value: unknown): string {
  if (typeof value === 'bigint') {
    return '0x' + value.toString(16).padStart(64, '0');
  }
  return String(value);
}

/**
 * Parse paginated result from contract call
 * Handles different return formats from starknet.js
 */
function parsePaginatedResult(result: unknown): { addresses: unknown[]; hasMore: boolean } {
  // Handle array tuple format: [addresses[], hasMore]
  if (Array.isArray(result) && result.length === 2) {
    const first: unknown = result[0];
    const second: unknown = result[1];
    if (Array.isArray(first) && typeof second === 'boolean') {
      return { addresses: first, hasMore: second };
    }
  }

  // Handle object format: { 0: addresses[], 1: hasMore } or named properties
  if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>;

    // Try numeric keys
    if ('0' in obj && '1' in obj) {
      const addresses = obj['0'];
      const hasMore = obj['1'];
      if (Array.isArray(addresses)) {
        return { addresses, hasMore: Boolean(hasMore) };
      }
    }

    // Try named keys (some typed contracts return named tuples)
    if ('addresses' in obj || 'active_markets' in obj) {
      const addresses = (obj.addresses ?? obj.active_markets ?? obj.markets) as unknown[];
      const hasMore = Boolean(obj.has_more ?? obj.hasMore ?? false);
      return { addresses: Array.isArray(addresses) ? addresses : [], hasMore };
    }
  }

  return { addresses: [], hasMore: false };
}

/**
 * Convert address value to hex string (simplified version)
 */
function addressToHex(addr: unknown): string {
  if (typeof addr === 'bigint') {
    return '0x' + addr.toString(16).padStart(64, '0');
  }
  if (typeof addr === 'string') {
    return addr;
  }
  return String(addr);
}

describe('toHexAddress', () => {
  test('converts bigint to padded hex string', () => {
    const addr = 0x1234n;
    const result = toHexAddress(addr);
    expect(result).toBe('0x0000000000000000000000000000000000000000000000000000000000001234');
    expect(result.length).toBe(66);
  });

  test('handles large bigint addresses', () => {
    const addr = 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7n;
    const result = toHexAddress(addr);
    expect(result).toBe('0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7');
    expect(result.length).toBe(66);
  });

  test('passes through string addresses', () => {
    const addr = '0x1234567890abcdef';
    const result = toHexAddress(addr);
    expect(result).toBe(addr);
  });

  test('converts other types to string', () => {
    expect(toHexAddress(123)).toBe('123');
    expect(toHexAddress(null)).toBe('null');
    expect(toHexAddress(undefined)).toBe('undefined');
  });
});

describe('addressToHex', () => {
  test('converts bigint to padded hex string', () => {
    const addr = 0xabcdef123456n;
    const result = addressToHex(addr);
    expect(result.startsWith('0x')).toBe(true);
    expect(result.length).toBe(66);
    expect(result).toContain('abcdef123456');
  });

  test('returns string addresses unchanged', () => {
    const addr = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
    const result = addressToHex(addr);
    expect(result).toBe(addr);
  });

  test('converts number to string', () => {
    const result = addressToHex(42);
    expect(result).toBe('42');
  });
});

describe('parsePaginatedResult', () => {
  describe('array tuple format [addresses[], hasMore]', () => {
    test('parses valid array tuple', () => {
      const result = parsePaginatedResult([['0x123', '0x456'], true]);
      expect(result.addresses).toEqual(['0x123', '0x456']);
      expect(result.hasMore).toBe(true);
    });

    test('handles empty addresses array', () => {
      const result = parsePaginatedResult([[], false]);
      expect(result.addresses).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    test('handles hasMore = false', () => {
      const result = parsePaginatedResult([['0x789'], false]);
      expect(result.addresses).toEqual(['0x789']);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('object with numeric keys { 0: addresses[], 1: hasMore }', () => {
    test('parses object with numeric keys', () => {
      const result = parsePaginatedResult({ 0: ['0xabc', '0xdef'], 1: true });
      expect(result.addresses).toEqual(['0xabc', '0xdef']);
      expect(result.hasMore).toBe(true);
    });

    test('handles truthy value for hasMore', () => {
      const result = parsePaginatedResult({ 0: ['0x111'], 1: 1 });
      expect(result.hasMore).toBe(true);
    });

    test('handles falsy value for hasMore', () => {
      const result = parsePaginatedResult({ 0: ['0x222'], 1: 0 });
      expect(result.hasMore).toBe(false);
    });
  });

  describe('object with named keys', () => {
    test('parses object with "addresses" key', () => {
      const result = parsePaginatedResult({ addresses: ['0xa1', '0xb2'], has_more: true });
      expect(result.addresses).toEqual(['0xa1', '0xb2']);
      expect(result.hasMore).toBe(true);
    });

    test('parses object with "active_markets" key', () => {
      const result = parsePaginatedResult({ active_markets: ['0xc3'], hasMore: false });
      expect(result.addresses).toEqual(['0xc3']);
      expect(result.hasMore).toBe(false);
    });

    test('handles missing has_more (defaults to false)', () => {
      const result = parsePaginatedResult({ addresses: ['0xd4'] });
      expect(result.addresses).toEqual(['0xd4']);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('returns empty for null', () => {
      const result = parsePaginatedResult(null);
      expect(result.addresses).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    test('returns empty for undefined', () => {
      const result = parsePaginatedResult(undefined);
      expect(result.addresses).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    test('returns empty for invalid array format', () => {
      const result = parsePaginatedResult(['not an array', true]);
      expect(result.addresses).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    test('returns empty for empty object', () => {
      const result = parsePaginatedResult({});
      expect(result.addresses).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    test('returns empty for primitive values', () => {
      expect(parsePaginatedResult(123).addresses).toEqual([]);
      expect(parsePaginatedResult('string').addresses).toEqual([]);
      expect(parsePaginatedResult(true).addresses).toEqual([]);
    });
  });
});

describe('Address filtering', () => {
  test('filters out zero addresses', () => {
    const addresses = [
      '0x0',
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
      '0x0',
    ];

    const filtered = addresses.filter(
      (addr) =>
        addr !== '0x0' &&
        addr !== '0x0000000000000000000000000000000000000000000000000000000000000000'
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toBe('0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7');
  });
});

describe('Market statistics', () => {
  test('calculates total TVL correctly', () => {
    const markets = [{ tvlSy: 1000n }, { tvlSy: 2000n }, { tvlSy: 3000n }];
    const totalTvl = markets.reduce((sum, m) => sum + m.tvlSy, 0n);
    expect(totalTvl).toBe(6000n);
  });

  test('handles empty markets array', () => {
    const markets: { tvlSy: bigint }[] = [];
    const totalTvl = markets.reduce((sum, m) => sum + m.tvlSy, 0n);
    expect(totalTvl).toBe(0n);
  });

  test('handles large TVL values', () => {
    const WAD = 10n ** 18n;
    const markets = [
      { tvlSy: 1000000n * WAD }, // 1M tokens
      { tvlSy: 2000000n * WAD }, // 2M tokens
    ];
    const totalTvl = markets.reduce((sum, m) => sum + m.tvlSy, 0n);
    expect(totalTvl).toBe(3000000n * WAD);
  });
});
