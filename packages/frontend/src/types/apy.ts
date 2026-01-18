/**
 * APY Breakdown Types
 *
 * Types for displaying comprehensive APY information for PT, YT, and LP positions.
 */

/**
 * Underlying yield components
 */
export interface UnderlyingYield {
  /** Interest APY from SY appreciation (e.g., staking rewards) */
  interestApy: number;
  /** Additional rewards APR from external sources (future) */
  rewardsApr: number;
  /** Total underlying APY */
  totalApy: number;
}

/**
 * Complete APY breakdown for a market
 */
export interface MarketApyBreakdown {
  /**
   * For PT holders - the implied APY (fixed yield locked in at purchase)
   */
  ptFixedApy: number;

  /**
   * Underlying asset yield components
   */
  underlying: UnderlyingYield;

  /**
   * For LP holders - breakdown of yield sources
   */
  lpApy: {
    /** Yield from PT portion of LP position */
    ptYield: number;
    /** Yield from SY portion (underlying appreciation) */
    syYield: number;
    /** Yield from swap fees collected */
    swapFees: number;
    /** Protocol incentive rewards (future) */
    rewards: number;
    /** Total LP APY */
    total: number;
  };

  /**
   * For YT holders - leverage yield exposure
   */
  ytApy: {
    /** Effective APY if underlying yield exceeds implied rate */
    longYieldApy: number;
    /** Underlying APY needed to break even on YT purchase */
    breakEvenApy: number;
    /** Leverage multiplier from YT price */
    leverage: number;
  };
}

/**
 * Parameters for APY calculation
 */
export interface ApyCalculationParams {
  // Market state
  syReserve: bigint;
  ptReserve: bigint;
  lnImpliedRate: bigint;
  expiry: bigint;

  // Underlying token data
  syExchangeRate: bigint;
  previousExchangeRate: bigint;
  /** Seconds between rate snapshots */
  rateTimeDelta: number;

  // Fee data
  /** 24h trading volume in SY terms */
  swapVolume24h: bigint;
  feeRate: bigint;
  /** LP share of fees (0.2 = 20%) */
  lpFeeShare?: number;

  /** Reward APR from external sources (e.g., YT accrued rewards) */
  rewardApr?: number;
}

/**
 * SY exchange rate data for underlying yield calculation
 */
export interface SyRateData {
  currentRate: bigint;
  previousRate: bigint;
  /** Seconds between snapshots */
  timeDelta: number;
  /** Timestamp of current rate */
  timestamp: number;
}
