/**
 * Deadline Utility Tests
 *
 * Tests for transaction deadline calculation and validation.
 * Run with: bun test src/lib/deadline.test.ts
 */

import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_DEADLINE_SECONDS,
  getDeadline,
  getDeadlineRemainingSeconds,
  isDeadlineExpired,
} from './deadline';

describe('DEFAULT_DEADLINE_SECONDS', () => {
  test('equals 20 minutes in seconds', () => {
    expect(DEFAULT_DEADLINE_SECONDS).toBe(20 * 60);
    expect(DEFAULT_DEADLINE_SECONDS).toBe(1200);
  });
});

describe('getDeadline', () => {
  test('returns timestamp in the future', () => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const deadline = getDeadline();
    expect(deadline).toBeGreaterThan(now);
  });

  test('uses default 20 minutes when no argument provided', () => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const deadline = getDeadline();
    const diff = Number(deadline - now);
    // Allow 1 second tolerance for test execution time
    expect(diff).toBeGreaterThanOrEqual(DEFAULT_DEADLINE_SECONDS - 1);
    expect(diff).toBeLessThanOrEqual(DEFAULT_DEADLINE_SECONDS + 1);
  });

  test('uses custom seconds when provided', () => {
    const customSeconds = 60; // 1 minute
    const now = BigInt(Math.floor(Date.now() / 1000));
    const deadline = getDeadline(customSeconds);
    const diff = Number(deadline - now);
    expect(diff).toBeGreaterThanOrEqual(customSeconds - 1);
    expect(diff).toBeLessThanOrEqual(customSeconds + 1);
  });

  test('returns bigint type', () => {
    const deadline = getDeadline();
    expect(typeof deadline).toBe('bigint');
  });

  test('handles 5 minute deadline', () => {
    const fiveMinutes = 5 * 60;
    const now = BigInt(Math.floor(Date.now() / 1000));
    const deadline = getDeadline(fiveMinutes);
    const diff = Number(deadline - now);
    expect(diff).toBeGreaterThanOrEqual(fiveMinutes - 1);
    expect(diff).toBeLessThanOrEqual(fiveMinutes + 1);
  });

  test('handles 1 hour deadline', () => {
    const oneHour = 60 * 60;
    const now = BigInt(Math.floor(Date.now() / 1000));
    const deadline = getDeadline(oneHour);
    const diff = Number(deadline - now);
    expect(diff).toBeGreaterThanOrEqual(oneHour - 1);
    expect(diff).toBeLessThanOrEqual(oneHour + 1);
  });
});

describe('isDeadlineExpired', () => {
  test('returns false for future deadline', () => {
    const futureDeadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    expect(isDeadlineExpired(futureDeadline)).toBe(false);
  });

  test('returns true for past deadline', () => {
    const pastDeadline = BigInt(Math.floor(Date.now() / 1000) - 3600);
    expect(isDeadlineExpired(pastDeadline)).toBe(true);
  });

  test('returns false for current time (edge case)', () => {
    // Equal time should not be expired (now > deadline, not now >= deadline)
    const nowDeadline = BigInt(Math.floor(Date.now() / 1000));
    expect(isDeadlineExpired(nowDeadline)).toBe(false);
  });

  test('works with getDeadline result', () => {
    const deadline = getDeadline();
    expect(isDeadlineExpired(deadline)).toBe(false);
  });

  test('returns true for deadline 1 second ago', () => {
    const justExpired = BigInt(Math.floor(Date.now() / 1000) - 1);
    expect(isDeadlineExpired(justExpired)).toBe(true);
  });
});

describe('getDeadlineRemainingSeconds', () => {
  test('returns positive number for future deadline', () => {
    const futureDeadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const remaining = getDeadlineRemainingSeconds(futureDeadline);
    expect(remaining).toBeGreaterThan(0);
    // Should be approximately 3600 seconds
    expect(remaining).toBeGreaterThanOrEqual(3599);
    expect(remaining).toBeLessThanOrEqual(3601);
  });

  test('returns 0 for expired deadline', () => {
    const pastDeadline = BigInt(Math.floor(Date.now() / 1000) - 3600);
    expect(getDeadlineRemainingSeconds(pastDeadline)).toBe(0);
  });

  test('returns 0 for current time', () => {
    const nowDeadline = BigInt(Math.floor(Date.now() / 1000));
    expect(getDeadlineRemainingSeconds(nowDeadline)).toBe(0);
  });

  test('returns correct value for getDeadline result', () => {
    const deadline = getDeadline();
    const remaining = getDeadlineRemainingSeconds(deadline);
    // Should be approximately DEFAULT_DEADLINE_SECONDS
    expect(remaining).toBeGreaterThanOrEqual(DEFAULT_DEADLINE_SECONDS - 2);
    expect(remaining).toBeLessThanOrEqual(DEFAULT_DEADLINE_SECONDS);
  });

  test('returns number type', () => {
    const deadline = getDeadline();
    const remaining = getDeadlineRemainingSeconds(deadline);
    expect(typeof remaining).toBe('number');
  });

  test('works with custom deadline', () => {
    const customSeconds = 300; // 5 minutes
    const deadline = getDeadline(customSeconds);
    const remaining = getDeadlineRemainingSeconds(deadline);
    expect(remaining).toBeGreaterThanOrEqual(customSeconds - 2);
    expect(remaining).toBeLessThanOrEqual(customSeconds);
  });
});

describe('Integration scenarios', () => {
  test('deadline workflow: create, check not expired, get remaining', () => {
    // Create a deadline
    const deadline = getDeadline(60); // 1 minute

    // Should not be expired
    expect(isDeadlineExpired(deadline)).toBe(false);

    // Should have remaining time
    const remaining = getDeadlineRemainingSeconds(deadline);
    expect(remaining).toBeGreaterThan(55); // At least 55 seconds left
  });

  test('custom deadline scenarios for different transaction types', () => {
    // Quick swap: 2 minutes
    const quickDeadline = getDeadline(2 * 60);
    expect(getDeadlineRemainingSeconds(quickDeadline)).toBeGreaterThan(115);

    // Standard operation: 10 minutes
    const standardDeadline = getDeadline(10 * 60);
    expect(getDeadlineRemainingSeconds(standardDeadline)).toBeGreaterThan(595);

    // Complex operation: 30 minutes
    const longDeadline = getDeadline(30 * 60);
    expect(getDeadlineRemainingSeconds(longDeadline)).toBeGreaterThan(1795);
  });
});
