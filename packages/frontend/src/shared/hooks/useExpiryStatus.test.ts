/**
 * useExpiryStatus Hook Tests
 *
 * Tests for expiry status calculation and severity determination.
 * Since the hook wraps pure functions, we test the logic directly.
 * Run with: bun test src/shared/hooks/useExpiryStatus.test.ts
 */

import { describe, expect, test } from 'bun:test';

import { daysToExpiry, isExpired } from '@shared/math/yield';

// Recreate the hook logic for testing without React
const DEFAULT_THRESHOLDS = {
  info: 7,
  warning: 3,
  critical: 1,
} as const;

type ExpirySeverity = 'none' | 'info' | 'warning' | 'critical';

function getSeverity(days: number, expired: boolean): ExpirySeverity {
  if (expired) return 'none';
  if (days <= DEFAULT_THRESHOLDS.critical) return 'critical';
  if (days <= DEFAULT_THRESHOLDS.warning) return 'warning';
  if (days <= DEFAULT_THRESHOLDS.info) return 'info';
  return 'none';
}

function getExpiryStatus(expiryTimestamp: number) {
  const expired = isExpired(expiryTimestamp);
  const days = daysToExpiry(expiryTimestamp);
  const severity = getSeverity(days, expired);

  return {
    isExpired: expired,
    daysRemaining: days,
    isNearExpiry: !expired && days <= DEFAULT_THRESHOLDS.info,
    severity,
  };
}

// Helper to create a timestamp N days in the future
function daysFromNow(days: number): number {
  return Math.floor(Date.now() / 1000) + days * 86400;
}

// Helper to create a timestamp N hours in the future
function hoursFromNow(hours: number): number {
  return Math.floor(Date.now() / 1000) + hours * 3600;
}

// Helper to create a timestamp in the past
function daysAgo(days: number): number {
  return Math.floor(Date.now() / 1000) - days * 86400;
}

describe('useExpiryStatus', () => {
  describe('severity levels', () => {
    test('returns "none" for more than 7 days remaining', () => {
      const result = getExpiryStatus(daysFromNow(10));

      expect(result.severity).toBe('none');
      expect(result.isNearExpiry).toBe(false);
    });

    test('returns "info" for 3-7 days remaining', () => {
      const result = getExpiryStatus(daysFromNow(5));

      expect(result.severity).toBe('info');
      expect(result.isNearExpiry).toBe(true);
    });

    test('returns "warning" for 1-3 days remaining', () => {
      const result = getExpiryStatus(daysFromNow(2));

      expect(result.severity).toBe('warning');
      expect(result.isNearExpiry).toBe(true);
    });

    test('returns "critical" for less than 1 day remaining', () => {
      const result = getExpiryStatus(hoursFromNow(12));

      expect(result.severity).toBe('critical');
      expect(result.isNearExpiry).toBe(true);
    });

    test('returns "none" for expired timestamps', () => {
      const result = getExpiryStatus(daysAgo(1));

      expect(result.severity).toBe('none');
      expect(result.isNearExpiry).toBe(false);
      expect(result.isExpired).toBe(true);
    });
  });

  describe('threshold boundaries', () => {
    test('exactly 7 days returns "info"', () => {
      const result = getExpiryStatus(daysFromNow(7));
      expect(result.severity).toBe('info');
    });

    test('7 days + 1 hour returns "none"', () => {
      const expiry = daysFromNow(7) + 3600; // 7 days + 1 hour
      const result = getExpiryStatus(expiry);
      expect(result.severity).toBe('none');
    });

    test('exactly 3 days returns "warning"', () => {
      const result = getExpiryStatus(daysFromNow(3));
      expect(result.severity).toBe('warning');
    });

    test('exactly 1 day returns "critical"', () => {
      const result = getExpiryStatus(daysFromNow(1));
      expect(result.severity).toBe('critical');
    });
  });

  describe('isExpired', () => {
    test('returns false for future timestamp', () => {
      const result = getExpiryStatus(daysFromNow(30));
      expect(result.isExpired).toBe(false);
    });

    test('returns true for past timestamp', () => {
      const result = getExpiryStatus(daysAgo(1));
      expect(result.isExpired).toBe(true);
    });
  });

  describe('daysRemaining', () => {
    test('returns approximately correct days for future timestamp', () => {
      const result = getExpiryStatus(daysFromNow(10));

      // Allow small tolerance for test execution time
      expect(result.daysRemaining).toBeGreaterThan(9.9);
      expect(result.daysRemaining).toBeLessThanOrEqual(10.1);
    });

    test('returns 0 for expired timestamp', () => {
      const result = getExpiryStatus(daysAgo(5));
      expect(result.daysRemaining).toBe(0);
    });

    test('returns fractional days for hours remaining', () => {
      const result = getExpiryStatus(hoursFromNow(12));

      // 12 hours = 0.5 days
      expect(result.daysRemaining).toBeGreaterThan(0.4);
      expect(result.daysRemaining).toBeLessThan(0.6);
    });
  });

  describe('isNearExpiry', () => {
    test('returns false when more than 7 days remaining', () => {
      const result = getExpiryStatus(daysFromNow(30));
      expect(result.isNearExpiry).toBe(false);
    });

    test('returns true when 7 days or less remaining', () => {
      const result = getExpiryStatus(daysFromNow(7));
      expect(result.isNearExpiry).toBe(true);
    });

    test('returns false when expired', () => {
      const result = getExpiryStatus(daysAgo(1));
      expect(result.isNearExpiry).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('handles expiry at midnight correctly', () => {
      // Create a timestamp at exactly midnight tomorrow
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      const expiry = Math.floor(tomorrow.getTime() / 1000);
      const result = getExpiryStatus(expiry);

      // Should not be expired
      expect(result.isExpired).toBe(false);
      // Should have less than 1 day remaining
      expect(result.daysRemaining).toBeLessThan(1);
      expect(result.daysRemaining).toBeGreaterThan(0);
    });

    test('handles very far future expiry', () => {
      const result = getExpiryStatus(daysFromNow(365)); // 1 year

      expect(result.isExpired).toBe(false);
      expect(result.isNearExpiry).toBe(false);
      expect(result.severity).toBe('none');
      expect(result.daysRemaining).toBeGreaterThan(364);
    });

    test('handles very recently expired', () => {
      // Expired 1 second ago
      const expiry = Math.floor(Date.now() / 1000) - 1;
      const result = getExpiryStatus(expiry);

      expect(result.isExpired).toBe(true);
      expect(result.daysRemaining).toBe(0);
      expect(result.severity).toBe('none');
    });
  });
});
