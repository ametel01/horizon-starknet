import BigNumber from 'bignumber.js';

import { fromWad } from './wad';

/**
 * Convert ln(implied_rate) from the AMM to APY percentage
 * The market stores rates as ln(1 + rate) in WAD
 */
export function lnRateToApy(lnRate: bigint | string): BigNumber {
  const rate = fromWad(lnRate);
  // APY = e^(ln_rate) - 1
  const apy = Math.exp(rate.toNumber()) - 1;
  return new BigNumber(apy);
}

/**
 * Calculate days until expiry
 */
export function daysToExpiry(expiryTimestamp: number): number {
  const now = Math.floor(Date.now() / 1000);
  const seconds = expiryTimestamp - now;
  return Math.max(0, seconds / 86400);
}

/**
 * Check if a market/token has expired
 */
export function isExpired(expiryTimestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now >= expiryTimestamp;
}

/**
 * Format expiry timestamp as human-readable string
 */
export function formatExpiry(expiryTimestamp: number): string {
  const date = new Date(expiryTimestamp * 1000);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time remaining until expiry
 */
export function formatTimeToExpiry(expiryTimestamp: number): string {
  const days = daysToExpiry(expiryTimestamp);

  if (days <= 0) {
    return 'Expired';
  }

  if (days < 1) {
    const hours = Math.floor(days * 24);
    return `${String(hours)}h remaining`;
  }

  if (days < 7) {
    return `${String(Math.floor(days))}d remaining`;
  }

  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${String(weeks)}w remaining`;
  }

  const months = Math.floor(days / 30);
  return `${String(months)}mo remaining`;
}
