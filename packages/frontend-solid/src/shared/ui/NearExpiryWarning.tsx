import { daysToExpiry, formatExpiry, isExpired } from '@shared/math/yield';
import { type JSX, Show } from 'solid-js';

import { Alert, AlertDescription, AlertTitle } from './Alert';

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
  class?: string;
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
 * Severity-specific icons
 */
const SEVERITY_ICONS: Record<Severity, JSX.Element> = {
  info: (
    <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  warning: (
    <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  critical: (
    <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
};

/**
 * Determines the severity level based on days remaining until expiry.
 * Returns null if the position is not near expiry (beyond all thresholds).
 *
 * Thresholds must be sorted descending by days (e.g., [7, 3, 1]).
 * Returns the most severe applicable threshold (smallest days value that is >= days remaining).
 *
 * Examples with default thresholds [7, 3, 1]:
 * - days = 10 → null (not near expiry)
 * - days = 5  → 'info' (within 7 days but not 3)
 * - days = 2  → 'warning' (within 3 days but not 1)
 * - days = 0.5 → 'critical' (within 1 day)
 */
function getSeverity(days: number, thresholds: ExpiryThreshold[]): Severity | null {
  let matchedSeverity: Severity | null = null;

  // Iterate through thresholds (sorted descending by days)
  // Keep updating matchedSeverity as we find smaller thresholds that still apply
  for (const threshold of thresholds) {
    if (days <= threshold.days) {
      matchedSeverity = threshold.severity;
    }
  }

  return matchedSeverity;
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
function NearExpiryWarning(props: NearExpiryWarningProps): JSX.Element {
  const thresholds = () => props.thresholds ?? DEFAULT_THRESHOLDS;
  const context = () => props.context ?? 'swap';

  const days = () => daysToExpiry(props.expiryTimestamp);
  const severity = () => getSeverity(days(), thresholds());
  const expired = () => isExpired(props.expiryTimestamp);

  const shouldShow = () => !expired() && severity() !== null;

  const variant = () => {
    const s = severity();
    return s !== null ? SEVERITY_TO_VARIANT[s] : 'info';
  };
  const icon = () => {
    const s = severity();
    return s !== null ? SEVERITY_ICONS[s] : SEVERITY_ICONS.info;
  };
  const contextMessage = () => CONTEXT_MESSAGES[context()];
  const expiryDate = () => formatExpiry(props.expiryTimestamp);
  const timeRemaining = () => formatDaysRemaining(days());

  const title = () =>
    severity() === 'critical' ? 'Expiring very soon' : `Expires in ${timeRemaining()}`;

  return (
    <Show when={shouldShow()}>
      <Alert
        variant={variant()}
        class={props.class}
        aria-live={severity() === 'critical' ? 'assertive' : 'polite'}
      >
        {icon()}
        <AlertTitle>{title()}</AlertTitle>
        <AlertDescription>
          {contextMessage()} Expiry date: {expiryDate()}.
        </AlertDescription>
      </Alert>
    </Show>
  );
}

export { NearExpiryWarning };
export type { ExpiryThreshold, NearExpiryWarningProps, Severity };
