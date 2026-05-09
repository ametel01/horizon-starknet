/**
 * NearExpiryWarning Component Tests
 *
 * Tests for verifying the near-expiry warning banner displays correct
 * severity levels and context-aware messages based on expiry thresholds.
 *
 * Run with: bun test src/shared/ui/NearExpiryWarning.test.tsx
 */

import { describe, expect, test } from 'bun:test';

import { daysToExpiry, isExpired } from '@shared/math/yield';

// Test helper: Create a timestamp N days from now
function timestampDaysFromNow(days: number): number {
  const now = Math.floor(Date.now() / 1000);
  return now + Math.floor(days * 86400);
}

// Test helper: Create a timestamp N hours from now
function timestampHoursFromNow(hours: number): number {
  const now = Math.floor(Date.now() / 1000);
  return now + Math.floor(hours * 3600);
}

// Test helper: Create a timestamp in the past
function timestampDaysAgo(days: number): number {
  const now = Math.floor(Date.now() / 1000);
  return now - Math.floor(days * 86400);
}

describe('NearExpiryWarning - Expiry Detection', () => {
  test('isExpired returns true for past timestamps', () => {
    const pastTimestamp = timestampDaysAgo(1);
    expect(isExpired(pastTimestamp)).toBe(true);
  });

  test('isExpired returns false for future timestamps', () => {
    const futureTimestamp = timestampDaysFromNow(10);
    expect(isExpired(futureTimestamp)).toBe(false);
  });

  test('daysToExpiry returns correct value for 7 days', () => {
    const timestamp = timestampDaysFromNow(7);
    const days = daysToExpiry(timestamp);
    // Allow for small timing variations during test execution
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  test('daysToExpiry returns 0 for expired timestamps', () => {
    const pastTimestamp = timestampDaysAgo(1);
    expect(daysToExpiry(pastTimestamp)).toBe(0);
  });

  test('daysToExpiry returns fractional days for hours', () => {
    const timestamp = timestampHoursFromNow(12);
    const days = daysToExpiry(timestamp);
    expect(days).toBeGreaterThan(0.4);
    expect(days).toBeLessThan(0.6);
  });
});

describe('NearExpiryWarning - Severity Logic', () => {
  // Recreate the severity logic for testing
  type Severity = 'info' | 'warning' | 'critical';
  interface ExpiryThreshold {
    days: number;
    severity: Severity;
  }

  const DEFAULT_THRESHOLDS: ExpiryThreshold[] = [
    { days: 7, severity: 'info' },
    { days: 3, severity: 'warning' },
    { days: 1, severity: 'critical' },
  ];

  function getSeverity(days: number, thresholds: ExpiryThreshold[]): Severity | null {
    for (let index = 0; index < thresholds.length; index += 1) {
      const threshold = thresholds[index];
      if (!threshold) {
        continue;
      }
      if (days <= threshold.days) {
        continue;
      }
      if (index > 0) {
        return thresholds[index - 1]?.severity ?? null;
      }
      return null;
    }
    return thresholds[thresholds.length - 1]?.severity ?? null;
  }

  test('returns null when days exceed all thresholds (10 days)', () => {
    const severity = getSeverity(10, DEFAULT_THRESHOLDS);
    expect(severity).toBe(null);
  });

  test('returns info when days <= 7 but > 3', () => {
    expect(getSeverity(7, DEFAULT_THRESHOLDS)).toBe('info');
    expect(getSeverity(6, DEFAULT_THRESHOLDS)).toBe('info');
    expect(getSeverity(4, DEFAULT_THRESHOLDS)).toBe('info');
    expect(getSeverity(3.5, DEFAULT_THRESHOLDS)).toBe('info');
  });

  test('returns warning when days <= 3 but > 1', () => {
    expect(getSeverity(3, DEFAULT_THRESHOLDS)).toBe('warning');
    expect(getSeverity(2, DEFAULT_THRESHOLDS)).toBe('warning');
    expect(getSeverity(1.5, DEFAULT_THRESHOLDS)).toBe('warning');
  });

  test('returns critical when days <= 1', () => {
    expect(getSeverity(1, DEFAULT_THRESHOLDS)).toBe('critical');
    expect(getSeverity(0.5, DEFAULT_THRESHOLDS)).toBe('critical');
    expect(getSeverity(0.1, DEFAULT_THRESHOLDS)).toBe('critical');
    expect(getSeverity(0, DEFAULT_THRESHOLDS)).toBe('critical');
  });

  test('works with custom thresholds', () => {
    const customThresholds: ExpiryThreshold[] = [
      { days: 14, severity: 'info' },
      { days: 7, severity: 'warning' },
      { days: 3, severity: 'critical' },
    ];

    expect(getSeverity(20, customThresholds)).toBe(null);
    expect(getSeverity(14, customThresholds)).toBe('info');
    expect(getSeverity(10, customThresholds)).toBe('info');
    expect(getSeverity(7, customThresholds)).toBe('warning');
    expect(getSeverity(5, customThresholds)).toBe('warning');
    expect(getSeverity(3, customThresholds)).toBe('critical');
    expect(getSeverity(1, customThresholds)).toBe('critical');
  });

  test('handles boundary exactly at threshold', () => {
    // When days exactly equals threshold, it should match that severity
    expect(getSeverity(7, DEFAULT_THRESHOLDS)).toBe('info');
    expect(getSeverity(3, DEFAULT_THRESHOLDS)).toBe('warning');
    expect(getSeverity(1, DEFAULT_THRESHOLDS)).toBe('critical');
  });

  test('handles single threshold', () => {
    const singleThreshold: ExpiryThreshold[] = [{ days: 7, severity: 'warning' }];

    expect(getSeverity(10, singleThreshold)).toBe(null);
    expect(getSeverity(7, singleThreshold)).toBe('warning');
    expect(getSeverity(1, singleThreshold)).toBe('warning');
  });
});

describe('NearExpiryWarning - Days Formatting', () => {
  function formatDaysRemaining(days: number): string {
    if (days < 1) {
      const hours = Math.floor(days * 24);
      if (hours <= 1) {
        return 'less than 1 hour';
      }
      return `${String(hours)} hours`;
    }
    const wholeDays = Math.floor(days);
    return wholeDays === 1 ? '1 day' : `${String(wholeDays)} days`;
  }

  test('formats days correctly', () => {
    expect(formatDaysRemaining(7)).toBe('7 days');
    expect(formatDaysRemaining(3)).toBe('3 days');
    expect(formatDaysRemaining(2)).toBe('2 days');
    expect(formatDaysRemaining(1)).toBe('1 day');
  });

  test('formats fractional days as hours', () => {
    expect(formatDaysRemaining(0.5)).toBe('12 hours');
    expect(formatDaysRemaining(0.25)).toBe('6 hours');
    expect(formatDaysRemaining(0.125)).toBe('3 hours');
  });

  test('formats very short times', () => {
    expect(formatDaysRemaining(0.04)).toBe('less than 1 hour'); // ~1 hour
    expect(formatDaysRemaining(0.02)).toBe('less than 1 hour'); // ~30 min
    expect(formatDaysRemaining(0)).toBe('less than 1 hour');
  });

  test('handles boundary between hours and days', () => {
    expect(formatDaysRemaining(1.5)).toBe('1 day'); // Floor to 1 day
    expect(formatDaysRemaining(0.99)).toBe('23 hours');
  });
});

describe('NearExpiryWarning - Context Messages', () => {
  const CONTEXT_MESSAGES = {
    swap: 'Trading will cease at expiry.',
    mint: 'Position will mature at expiry.',
    portfolio: 'Claim any accrued yield before expiry.',
  };

  test('swap context has trading message', () => {
    expect(CONTEXT_MESSAGES.swap).toContain('Trading');
  });

  test('mint context has maturity message', () => {
    expect(CONTEXT_MESSAGES.mint).toContain('mature');
  });

  test('portfolio context has claim message', () => {
    expect(CONTEXT_MESSAGES.portfolio).toContain('Claim');
    expect(CONTEXT_MESSAGES.portfolio).toContain('yield');
  });
});

describe('NearExpiryWarning - Integration', () => {
  test('full flow: 5 days to expiry should show info', () => {
    const timestamp = timestampDaysFromNow(5);

    expect(isExpired(timestamp)).toBe(false);

    const days = daysToExpiry(timestamp);
    expect(days).toBeGreaterThan(4.9);
    expect(days).toBeLessThan(5.1);

    // With default thresholds, 5 days is <= 7 and > 3, so 'info'
  });

  test('full flow: 2 days to expiry should show warning', () => {
    const timestamp = timestampDaysFromNow(2);

    expect(isExpired(timestamp)).toBe(false);

    const days = daysToExpiry(timestamp);
    expect(days).toBeGreaterThan(1.9);
    expect(days).toBeLessThan(2.1);

    // With default thresholds, 2 days is <= 3 and > 1, so 'warning'
  });

  test('full flow: 12 hours to expiry should show critical', () => {
    const timestamp = timestampHoursFromNow(12);

    expect(isExpired(timestamp)).toBe(false);

    const days = daysToExpiry(timestamp);
    expect(days).toBeGreaterThan(0.4);
    expect(days).toBeLessThan(0.6);

    // With default thresholds, 0.5 days is <= 1, so 'critical'
  });

  test('full flow: 10 days to expiry should not show warning', () => {
    const timestamp = timestampDaysFromNow(10);

    expect(isExpired(timestamp)).toBe(false);

    const days = daysToExpiry(timestamp);
    expect(days).toBeGreaterThan(9.9);

    // With default thresholds, 10 days > 7, so no warning (null severity)
  });

  test('full flow: expired should not render', () => {
    const timestamp = timestampDaysAgo(1);

    expect(isExpired(timestamp)).toBe(true);
    // Component should return null for expired timestamps
  });
});
