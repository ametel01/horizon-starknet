import BigNumber from 'bignumber.js';

// WAD = 10^18 (standard for fixed-point math)
export const WAD = new BigNumber(10).pow(18);
export const WAD_BIGINT = 10n ** 18n;

// Configure BigNumber for high precision
BigNumber.config({
  DECIMAL_PLACES: 36,
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
});

/**
 * Convert a WAD value (bigint or string) to a BigNumber
 */
export function fromWad(value: bigint | string | number): BigNumber {
  return new BigNumber(value.toString()).dividedBy(WAD);
}

/**
 * Convert a number to WAD representation (bigint)
 */
export function toWad(value: number | string | BigNumber): bigint {
  const bn = value instanceof BigNumber ? value : new BigNumber(value);
  return BigInt(bn.multipliedBy(WAD).toFixed(0));
}

/**
 * Format a WAD value for display
 */
export function formatWad(value: bigint | string, decimals = 4): string {
  return fromWad(value).toFixed(decimals);
}

/**
 * Format a WAD value for display with smart formatting
 * - Shows "0" for zero values
 * - Uses compact notation for large numbers (1.2K, 5.5M)
 * - Reduces decimals for larger numbers
 * - Shows "< 0.01" for very small non-zero numbers
 */
export function formatWadCompact(value: bigint | string): string {
  const num = fromWad(value);

  // Zero or effectively zero
  if (num.isZero() || num.abs().lt(0.000001)) {
    return '0';
  }

  const absNum = num.abs();

  // Very large numbers (millions)
  if (absNum.gte(1_000_000)) {
    return `${num.dividedBy(1_000_000).toFixed(2)}M`;
  }

  // Large numbers (thousands)
  if (absNum.gte(1_000)) {
    return `${num.dividedBy(1_000).toFixed(2)}K`;
  }

  // Medium numbers (>= 1)
  if (absNum.gte(1)) {
    return num.toFixed(2);
  }

  // Small numbers (>= 0.01)
  if (absNum.gte(0.01)) {
    return num.toFixed(4);
  }

  // Very small numbers - show "< 0.01" instead of confusing decimals
  return '< 0.01';
}

/**
 * Format a WAD value as a percentage
 */
export function formatWadPercent(value: bigint | string, decimals = 2): string {
  return `${fromWad(value).multipliedBy(100).toFixed(decimals)}%`;
}

/**
 * Multiply two WAD values
 */
export function wadMul(a: bigint, b: bigint): bigint {
  return (a * b) / WAD_BIGINT;
}

/**
 * Divide two WAD values
 */
export function wadDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error('Division by zero');
  return (a * WAD_BIGINT) / b;
}

/**
 * Parse a user input string to WAD bigint
 */
export function parseWad(input: string): bigint {
  try {
    const bn = new BigNumber(input);
    if (bn.isNaN() || !bn.isFinite()) {
      return 0n;
    }
    return toWad(bn);
  } catch {
    return 0n;
  }
}

/**
 * Format token amount with proper decimals
 */
export function formatTokenAmount(
  amount: bigint | string,
  decimals = 18,
  displayDecimals = 4
): string {
  const divisor = new BigNumber(10).pow(decimals);
  const value = new BigNumber(amount.toString()).dividedBy(divisor);
  return value.toFixed(displayDecimals);
}

/**
 * Parse token amount from string to bigint
 */
export function parseTokenAmount(input: string, decimals = 18): bigint {
  try {
    const bn = new BigNumber(input);
    if (bn.isNaN() || !bn.isFinite()) {
      return 0n;
    }
    const multiplier = new BigNumber(10).pow(decimals);
    return BigInt(bn.multipliedBy(multiplier).toFixed(0));
  } catch {
    return 0n;
  }
}
