/**
 * TWAP Oracle Configuration
 *
 * Duration values in seconds. Starknet block time ~10s means:
 * - 15 min = ~90 observations needed
 * - 30 min = ~180 observations needed
 */
export const TWAP_DURATIONS = {
  /** Default TWAP window - balances responsiveness vs. manipulation resistance */
  DEFAULT: 900, // 15 minutes
  /** Conservative option for higher-value operations */
  CONSERVATIVE: 1800, // 30 minutes
  /** Minimum viable TWAP window */
  MINIMUM: 300, // 5 minutes
} as const;

export const TWAP_DEFAULT_DURATION = TWAP_DURATIONS.DEFAULT;

/** Stale time for TWAP rate queries (ms) */
export const TWAP_STALE_TIME = 30_000;

/** Refetch interval for TWAP rates (ms) */
export const TWAP_REFETCH_INTERVAL = 30_000;
