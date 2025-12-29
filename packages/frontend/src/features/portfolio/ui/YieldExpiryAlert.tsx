'use client';

import { AlertTriangleIcon, ClockIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@shared/lib/utils';
import { formatWadCompact } from '@shared/math/wad';
import { daysToExpiry, formatExpiry, isExpired } from '@shared/math/yield';
import { Alert, AlertDescription, AlertTitle } from '@shared/ui/alert';
import { Button } from '@shared/ui/Button';

interface YieldExpiryAlertProps {
  /** Unix timestamp of expiry (in seconds) */
  expiryTimestamp: number;
  /** Amount of claimable yield in WAD (10^18) */
  claimableAmount: bigint;
  /** USD value of claimable yield */
  claimableUsd: number;
  /** Token symbol for display */
  tokenSymbol?: string;
  /** Callback when user clicks "Claim Now" */
  onClaim: () => void;
  /** Whether a claim transaction is in progress */
  isClaiming: boolean;
  /** Additional CSS classes */
  className?: string;
}

/** Threshold in days below which this alert is shown */
const ALERT_THRESHOLD_DAYS = 7;

/** Threshold in days below which the alert becomes critical (red) */
const CRITICAL_THRESHOLD_DAYS = 1;

/**
 * Formats the days remaining into a human-readable string.
 */
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

/**
 * Formats USD value for display.
 */
function formatUsdValue(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Alert banner for YT positions with claimable yield approaching expiry.
 *
 * Displays a prominent warning when:
 * - Position is within 7 days of expiry AND
 * - Has unclaimed yield (claimableAmount > 0)
 *
 * Features:
 * - Critical (red) styling when ≤1 day to expiry
 * - Warning (amber) styling when ≤7 days to expiry
 * - Inline "Claim Now" action button
 * - Accessible: Uses ARIA live regions for screen reader announcements
 *
 * @example
 * ```tsx
 * <YieldExpiryAlert
 *   expiryTimestamp={market.expiry}
 *   claimableAmount={yieldData.claimable}
 *   claimableUsd={yieldData.claimableUsd ?? 0}
 *   tokenSymbol="stETH"
 *   onClaim={handleClaim}
 *   isClaiming={isClaiming}
 * />
 * ```
 */
export function YieldExpiryAlert({
  expiryTimestamp,
  claimableAmount,
  claimableUsd,
  tokenSymbol,
  onClaim,
  isClaiming,
  className,
}: YieldExpiryAlertProps): ReactNode {
  // Don't show for expired positions - they need different handling
  if (isExpired(expiryTimestamp)) {
    return null;
  }

  const days = daysToExpiry(expiryTimestamp);

  // Only show alert for near-expiry positions (within threshold)
  if (days > ALERT_THRESHOLD_DAYS) {
    return null;
  }

  // Only show if there's actually something to claim
  if (claimableAmount <= 0n) {
    return null;
  }

  const isCritical = days <= CRITICAL_THRESHOLD_DAYS;
  const variant = isCritical ? 'destructive' : 'warning';
  const Icon = isCritical ? AlertTriangleIcon : ClockIcon;
  const expiryDate = formatExpiry(expiryTimestamp);
  const timeRemaining = formatDaysRemaining(days);

  const title = isCritical ? 'Yield expiring very soon!' : `Yield expires in ${timeRemaining}`;

  const formattedClaimable = tokenSymbol
    ? `${formatWadCompact(claimableAmount)} ${tokenSymbol}`
    : formatUsdValue(claimableUsd);

  return (
    <Alert
      variant={variant}
      className={cn('mb-4', className)}
      role="alert"
      aria-live={isCritical ? 'assertive' : 'polite'}
    >
      <Icon className="size-4" />
      <AlertTitle className="flex items-center justify-between gap-2">
        <span>{title}</span>
        <Button
          size="xs"
          variant={isCritical ? 'destructive' : 'default'}
          onClick={onClaim}
          disabled={isClaiming}
          loading={isClaiming}
          loadingText="Claiming..."
          className="shrink-0"
        >
          Claim Now
        </Button>
      </AlertTitle>
      <AlertDescription>
        You have {formattedClaimable} in unclaimed yield. Claim before {expiryDate} or it will be
        lost.
      </AlertDescription>
    </Alert>
  );
}

export type { YieldExpiryAlertProps };
