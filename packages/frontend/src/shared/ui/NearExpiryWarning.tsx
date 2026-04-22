import { daysToExpiry, formatExpiry, isExpired } from '@shared/math/yield';
import { AlertTriangleIcon, ClockIcon, InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from './alert';

type Severity = 'info' | 'warning' | 'critical';

interface ExpiryThreshold {
  days: number;
  severity: Severity;
}

interface NearExpiryWarningProps {
  /** Unix timestamp of expiry (in seconds) */
  expiryTimestamp: number;
  /** Custom thresholds for severity levels. Must be sorted descending by days. */
  thresholds?: ExpiryThreshold[];
  /** Context determines the warning message content */
  context?: 'swap' | 'mint' | 'portfolio';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Default expiry warning thresholds.
 * - 7 days: Info level (blue)
 * - 3 days: Warning level (amber)
 * - 1 day: Critical level (red)
 */
const DEFAULT_THRESHOLDS: ExpiryThreshold[] = [
  { days: 7, severity: 'info' },
  { days: 3, severity: 'warning' },
  { days: 1, severity: 'critical' },
];

/**
 * Context-aware messages for near-expiry warnings.
 */
const CONTEXT_MESSAGES: Record<NonNullable<NearExpiryWarningProps['context']>, string> = {
  swap: 'Trading will cease at expiry.',
  mint: 'Position will mature at expiry.',
  portfolio: 'Claim any accrued yield before expiry.',
};

/**
 * Maps severity levels to Alert variants.
 */
const SEVERITY_TO_VARIANT: Record<Severity, 'info' | 'warning' | 'destructive'> = {
  info: 'info',
  warning: 'warning',
  critical: 'destructive',
};

/**
 * Maps severity levels to icons.
 */
const SEVERITY_ICONS: Record<Severity, typeof InfoIcon> = {
  info: InfoIcon,
  warning: ClockIcon,
  critical: AlertTriangleIcon,
};

/**
 * Determines the severity level based on days remaining until expiry.
 * Returns null if the position is not near expiry (beyond all thresholds).
 */
function getSeverity(days: number, thresholds: ExpiryThreshold[]): Severity | null {
  // Find the most severe applicable threshold
  // Thresholds should be sorted descending by days (7, 3, 1)
  for (const threshold of thresholds) {
    if (days <= threshold.days) {
      // Continue checking for more severe thresholds
      continue;
    }
    // Found the first threshold that days exceed - return the previous severity
    const index = thresholds.indexOf(threshold);
    if (index > 0) {
      return thresholds[index - 1]?.severity ?? null;
    }
    return null;
  }
  // Days is less than or equal to all thresholds - return the most severe
  return thresholds[thresholds.length - 1]?.severity ?? null;
}

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
 * Displays a warning banner when a market/position is approaching expiry.
 *
 * Features:
 * - Threshold-based severity levels (info/warning/critical)
 * - Context-aware messaging (swap/mint/portfolio)
 * - Does not render for expired markets or when not near expiry
 *
 * @example
 * ```tsx
 * // In SwapForm
 * <NearExpiryWarning expiryTimestamp={market.expiry} context="swap" />
 *
 * // With custom thresholds
 * <NearExpiryWarning
 *   expiryTimestamp={market.expiry}
 *   thresholds={[
 *     { days: 14, severity: 'info' },
 *     { days: 7, severity: 'warning' },
 *     { days: 3, severity: 'critical' },
 *   ]}
 *   context="portfolio"
 * />
 * ```
 */
export function NearExpiryWarning({
  expiryTimestamp,
  thresholds = DEFAULT_THRESHOLDS,
  context = 'swap',
  className,
}: NearExpiryWarningProps): ReactNode {
  // Don't show warning for already expired positions
  if (isExpired(expiryTimestamp)) {
    return null;
  }

  const days = daysToExpiry(expiryTimestamp);
  const severity = getSeverity(days, thresholds);

  // Don't show if not near expiry (beyond all thresholds)
  if (severity === null) {
    return null;
  }

  const variant = SEVERITY_TO_VARIANT[severity];
  const Icon = SEVERITY_ICONS[severity];
  const contextMessage = CONTEXT_MESSAGES[context];
  const expiryDate = formatExpiry(expiryTimestamp);
  const timeRemaining = formatDaysRemaining(days);

  const title = severity === 'critical' ? 'Expiring very soon' : `Expires in ${timeRemaining}`;

  return (
    <Alert
      variant={variant}
      className={className}
      aria-live={severity === 'critical' ? 'assertive' : 'polite'}
    >
      <Icon className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {contextMessage} Expiry date: {expiryDate}.
      </AlertDescription>
    </Alert>
  );
}

export type { ExpiryThreshold, NearExpiryWarningProps, Severity };
