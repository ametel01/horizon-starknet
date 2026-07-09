/**
 * API Utilities Tests
 *
 * Tests for shared API validation utilities.
 * Run with: bun test src/app/api/utils.test.ts
 */

import { describe, expect, test } from 'bun:test';
import {
  marketsQuerySchema,
  normalizeStarknetAddress,
  paginationSchema,
  validateQuery,
} from '@shared/server/validations/api';
import { NextResponse } from 'next/server';

describe('normalizeStarknetAddress', () => {
  test('pads short addresses to 66 characters', () => {
    const result = normalizeStarknetAddress('0x1234');

    expect(result.length).toBe(66);
    expect(result).toBe('0x0000000000000000000000000000000000000000000000000000000000001234');
  });

  test('lowercases addresses', () => {
    expect(normalizeStarknetAddress('0xABCDEF1234567890')).toBe(
      '0x000000000000000000000000000000000000000000000000abcdef1234567890'
    );
  });

  test('keeps full-length addresses stable', () => {
    const full = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    expect(normalizeStarknetAddress(full)).toBe(full);
  });

  test('adds the 0x prefix when missing', () => {
    const result = normalizeStarknetAddress('abcd1234');

    expect(result).toStartWith('0x');
    expect(result.length).toBe(66);
  });
});

describe('paginationSchema', () => {
  test('applies default pagination', () => {
    expect(paginationSchema.parse({})).toEqual({ limit: 50, offset: 0 });
  });

  test('accepts the maximum page size', () => {
    expect(paginationSchema.parse({ limit: '100', offset: '10' })).toEqual({
      limit: 100,
      offset: 10,
    });
  });

  test('rejects invalid limits', () => {
    expect(() => paginationSchema.parse({ limit: '0' })).toThrow();
    expect(() => paginationSchema.parse({ limit: '101' })).toThrow();
  });
});

describe('marketsQuerySchema', () => {
  test('applies default sort and order', () => {
    expect(marketsQuerySchema.parse({})).toMatchObject({
      sort: 'volume',
      order: 'desc',
      limit: 50,
      offset: 0,
    });
  });

  test('accepts supported sort fields and order', () => {
    expect(marketsQuerySchema.parse({ sort: 'tvl', order: 'asc' })).toMatchObject({
      sort: 'tvl',
      order: 'asc',
    });
  });

  test('rejects unsupported sort fields', () => {
    expect(() => marketsQuerySchema.parse({ sort: 'invalid' })).toThrow();
  });
});

describe('validateQuery', () => {
  test('returns parsed params for valid query strings', () => {
    const params = new URLSearchParams({ limit: '20', offset: '5' });

    expect(validateQuery(params, paginationSchema)).toEqual({ limit: 20, offset: 5 });
  });

  test('returns a 400 response for invalid query params', async () => {
    const response = validateQuery(new URLSearchParams({ limit: '0' }), paginationSchema);

    expect(response).toBeInstanceOf(NextResponse);
    if (!(response instanceof NextResponse)) {
      throw new Error('Expected validateQuery to return a NextResponse for invalid params');
    }
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Validation Error',
      details: [{ path: 'limit' }],
    });
  });
});
