'use client';

import { daysToExpiry, isExpired } from '@shared/math/yield';
import { useMemo } from 'react';

/**
 * Severity levels for expiry warnings
 * - none: More than 7 days to expiry (or already expired)
 * - info: 3-7 days to expiry
 * - warning: 1-3 days to expiry
 * - critical: Less than 1 day to expiry
 *
 * Note: This includes 'none' unlike the UI component's Severity type,
 * because the hook needs to indicate when no warning is needed.
 */
type ExpirySeverity = 'none' | 'info' | 'warning' | 'critical';

/**
 * Expiry status result with computed values
 */
export interface ExpiryStatus {
  /** Whether the market/token has expired */
  isExpired: boolean;
  /** Days remaining until expiry (0 if expired) */
  daysRemaining: number;
  /** Whether expiry is approaching (within threshold) */
  isNearExpiry: boolean;
  /** Severity level for UI warnings */
  severity: ExpirySeverity;
}

/** Default thresholds in days for each severity level */
const DEFAULT_THRESHOLDS = {
  info: 7, // 3-7 days
  warning: 3, // 1-3 days
  critical: 1, // <1 day
} as const;

/**
 * Determines the severity level based on days remaining
 */
function getSeverity(days: number, expired: boolean): ExpirySeverity {
  if (expired) return 'none'; // Expired markets don't show warnings
  if (days <= DEFAULT_THRESHOLDS.critical) return 'critical';
  if (days <= DEFAULT_THRESHOLDS.warning) return 'warning';
  if (days <= DEFAULT_THRESHOLDS.info) return 'info';
  return 'none';
}

/**
 * Hook to compute expiry status for a market or position.
 *
 * Provides a single source of truth for expiry-related logic across
 * all components, including:
 * - Whether the asset has expired
 * - Days remaining until expiry
 * - Whether expiry is near (within 7 days)
 * - Severity level for warning UI
 *
 * @param expiryTimestamp - Unix timestamp when the market/token expires
 * @returns ExpiryStatus object with computed values
 *
 * @example
 * ```tsx
 * const { isNearExpiry, severity } = useExpiryStatus(market.expiry);
 *
 * if (isNearExpiry && severity === 'critical') {
 *   // Show urgent warning
 * }
 * ```
 */
export function useExpiryStatus(expiryTimestamp: number): ExpiryStatus {
  return useMemo(() => {
    const expired = isExpired(expiryTimestamp);
    const days = daysToExpiry(expiryTimestamp);
    const severity = getSeverity(days, expired);

    return {
      isExpired: expired,
      daysRemaining: days,
      isNearExpiry: !expired && days <= DEFAULT_THRESHOLDS.info,
      severity,
    };
  }, [expiryTimestamp]);
}
