/**
 * YieldExpiryAlert Component Tests
 *
 * Tests for verifying the YT expiry alert displays correct severity levels,
 * handles edge cases, and shows appropriate messages for claimable yield.
 *
 * Run with: bun test src/features/portfolio/ui/YieldExpiryAlert.test.tsx
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

// Component's threshold constants
const ALERT_THRESHOLD_DAYS = 7;
const CRITICAL_THRESHOLD_DAYS = 1;

// Replicate the component's render conditions for testing
function shouldRenderAlert(
  expiryTimestamp: number,
  claimableAmount: bigint
): { shouldRender: boolean; isCritical: boolean } {
  // Don't show for expired positions
  if (isExpired(expiryTimestamp)) {
    return { shouldRender: false, isCritical: false };
  }

  const days = daysToExpiry(expiryTimestamp);

  // Only show alert for near-expiry positions (within threshold)
  if (days > ALERT_THRESHOLD_DAYS) {
    return { shouldRender: false, isCritical: false };
  }

  // Only show if there's actually something to claim
  if (claimableAmount <= 0n) {
    return { shouldRender: false, isCritical: false };
  }

  const isCritical = days <= CRITICAL_THRESHOLD_DAYS;
  return { shouldRender: true, isCritical };
}

describe('YieldExpiryAlert - Render Conditions', () => {
  const SAMPLE_CLAIMABLE = 1000000000000000000n; // 1 WAD

  test('renders when within 7 days AND has claimable amount', () => {
    const timestamp = timestampDaysFromNow(5);
    const result = shouldRenderAlert(timestamp, SAMPLE_CLAIMABLE);
    expect(result.shouldRender).toBe(true);
  });

  test('does not render when beyond 7 days threshold', () => {
    const timestamp = timestampDaysFromNow(10);
    const result = shouldRenderAlert(timestamp, SAMPLE_CLAIMABLE);
    expect(result.shouldRender).toBe(false);
  });

  test('does not render when claimable is zero', () => {
    const timestamp = timestampDaysFromNow(5);
    const result = shouldRenderAlert(timestamp, 0n);
    expect(result.shouldRender).toBe(false);
  });

  test('does not render when position is expired', () => {
    const timestamp = timestampDaysAgo(1);
    const result = shouldRenderAlert(timestamp, SAMPLE_CLAIMABLE);
    expect(result.shouldRender).toBe(false);
  });

  test('does not render when both conditions fail (expired AND zero claimable)', () => {
    const timestamp = timestampDaysAgo(1);
    const result = shouldRenderAlert(timestamp, 0n);
    expect(result.shouldRender).toBe(false);
  });

  test('renders at exactly 7 day boundary', () => {
    const timestamp = timestampDaysFromNow(7);
    const result = shouldRenderAlert(timestamp, SAMPLE_CLAIMABLE);
    // daysToExpiry returns fractional - at exactly 7 days it should still show
    expect(result.shouldRender).toBe(true);
  });
});

describe('YieldExpiryAlert - Critical Severity', () => {
  const SAMPLE_CLAIMABLE = 1000000000000000000n; // 1 WAD

  test('is critical when less than 1 day to expiry', () => {
    const timestamp = timestampHoursFromNow(12);
    const result = shouldRenderAlert(timestamp, SAMPLE_CLAIMABLE);
    expect(result.shouldRender).toBe(true);
    expect(result.isCritical).toBe(true);
  });

  test('is critical at exactly 1 day to expiry', () => {
    const timestamp = timestampDaysFromNow(1);
    const result = shouldRenderAlert(timestamp, SAMPLE_CLAIMABLE);
    expect(result.shouldRender).toBe(true);
    expect(result.isCritical).toBe(true);
  });

  test('is not critical when more than 1 day to expiry', () => {
    const timestamp = timestampDaysFromNow(2);
    const result = shouldRenderAlert(timestamp, SAMPLE_CLAIMABLE);
    expect(result.shouldRender).toBe(true);
    expect(result.isCritical).toBe(false);
  });

  test('is not critical at 5 days to expiry', () => {
    const timestamp = timestampDaysFromNow(5);
    const result = shouldRenderAlert(timestamp, SAMPLE_CLAIMABLE);
    expect(result.shouldRender).toBe(true);
    expect(result.isCritical).toBe(false);
  });
});

describe('YieldExpiryAlert - Days Formatting', () => {
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

  test('formats multiple days correctly', () => {
    expect(formatDaysRemaining(7)).toBe('7 days');
    expect(formatDaysRemaining(5)).toBe('5 days');
    expect(formatDaysRemaining(3)).toBe('3 days');
    expect(formatDaysRemaining(2)).toBe('2 days');
  });

  test('formats exactly 1 day correctly (singular)', () => {
    expect(formatDaysRemaining(1)).toBe('1 day');
  });

  test('formats fractional days as hours', () => {
    expect(formatDaysRemaining(0.5)).toBe('12 hours');
    expect(formatDaysRemaining(0.25)).toBe('6 hours');
    expect(formatDaysRemaining(0.125)).toBe('3 hours');
  });

  test('formats very short times as "less than 1 hour"', () => {
    expect(formatDaysRemaining(0.04)).toBe('less than 1 hour');
    expect(formatDaysRemaining(0.02)).toBe('less than 1 hour');
    expect(formatDaysRemaining(0)).toBe('less than 1 hour');
  });
});

describe('YieldExpiryAlert - USD Formatting', () => {
  function formatUsdValue(value: number): string {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  test('formats positive values correctly', () => {
    expect(formatUsdValue(100)).toBe('$100.00');
    expect(formatUsdValue(1234.56)).toBe('$1,234.56');
    expect(formatUsdValue(0.01)).toBe('$0.01');
  });

  test('formats zero correctly', () => {
    expect(formatUsdValue(0)).toBe('$0.00');
  });

  test('rounds to 2 decimal places', () => {
    expect(formatUsdValue(99.999)).toBe('$100.00');
    expect(formatUsdValue(0.001)).toBe('$0.00');
    expect(formatUsdValue(0.005)).toBe('$0.01');
  });
});

describe('YieldExpiryAlert - Integration Scenarios', () => {
  const SAMPLE_CLAIMABLE = 5000000000000000000n; // 5 WAD

  test('scenario: 5 days to expiry with claimable yield - shows warning (not critical)', () => {
    const timestamp = timestampDaysFromNow(5);

    expect(isExpired(timestamp)).toBe(false);

    const days = daysToExpiry(timestamp);
    expect(days).toBeGreaterThan(4.9);
    expect(days).toBeLessThan(5.1);

    const result = shouldRenderAlert(timestamp, SAMPLE_CLAIMABLE);
    expect(result.shouldRender).toBe(true);
    expect(result.isCritical).toBe(false);
  });

  test('scenario: 12 hours to expiry with claimable yield - shows critical', () => {
    const timestamp = timestampHoursFromNow(12);

    expect(isExpired(timestamp)).toBe(false);

    const days = daysToExpiry(timestamp);
    expect(days).toBeGreaterThan(0.4);
    expect(days).toBeLessThan(0.6);

    const result = shouldRenderAlert(timestamp, SAMPLE_CLAIMABLE);
    expect(result.shouldRender).toBe(true);
    expect(result.isCritical).toBe(true);
  });

  test('scenario: 10 days to expiry - does not render (beyond threshold)', () => {
    const timestamp = timestampDaysFromNow(10);

    expect(isExpired(timestamp)).toBe(false);

    const days = daysToExpiry(timestamp);
    expect(days).toBeGreaterThan(9.9);

    const result = shouldRenderAlert(timestamp, SAMPLE_CLAIMABLE);
    expect(result.shouldRender).toBe(false);
  });

  test('scenario: 5 days to expiry but no claimable - does not render', () => {
    const timestamp = timestampDaysFromNow(5);

    expect(isExpired(timestamp)).toBe(false);

    const result = shouldRenderAlert(timestamp, 0n);
    expect(result.shouldRender).toBe(false);
  });

  test('scenario: just expired with claimable - does not render', () => {
    const timestamp = timestampHoursFromNow(-1); // 1 hour ago

    expect(isExpired(timestamp)).toBe(true);

    const result = shouldRenderAlert(timestamp, SAMPLE_CLAIMABLE);
    expect(result.shouldRender).toBe(false);
  });
});

describe('YieldExpiryAlert - Edge Cases', () => {
  test('handles very large claimable amounts', () => {
    const timestamp = timestampDaysFromNow(3);
    const largeAmount = 1000000000000000000000000n; // 1M WAD
    const result = shouldRenderAlert(timestamp, largeAmount);
    expect(result.shouldRender).toBe(true);
  });

  test('handles minimum claimable amount (1 wei)', () => {
    const timestamp = timestampDaysFromNow(3);
    const result = shouldRenderAlert(timestamp, 1n);
    expect(result.shouldRender).toBe(true);
  });

  test('handles timestamp at current time (0 days)', () => {
    const now = Math.floor(Date.now() / 1000);
    // At exactly current time, daysToExpiry returns 0, which is <= 7 threshold
    // but isExpired also returns true for now >= timestamp, so it won't render
    const days = daysToExpiry(now);
    expect(days).toBe(0);

    const result = shouldRenderAlert(now, 1000n);
    // Won't render because isExpired(now) is true (now >= now)
    expect(result.shouldRender).toBe(false);
  });

  test('handles negative claimable (should not render)', () => {
    const timestamp = timestampDaysFromNow(3);
    // TypeScript wouldn't allow negative bigint in production, but testing the guard
    const result = shouldRenderAlert(timestamp, -1n);
    expect(result.shouldRender).toBe(false);
  });
});
