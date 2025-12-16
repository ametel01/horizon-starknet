/**
 * APY Breakdown Calculation Functions
 *
 * Calculates comprehensive APY breakdowns for PT, YT, and LP positions.
 */

import type { ApyCalculationParams, MarketApyBreakdown } from '@/types/apy';

import { WAD_BIGINT, fromWad } from './wad';

const SECONDS_PER_DAY = 86400;
const SECONDS_PER_YEAR = 31_536_000;

/**
 * Calculate complete APY breakdown for a market
 */
export function calculateApyBreakdown(params: ApyCalculationParams): MarketApyBreakdown {
  const {
    syReserve,
    ptReserve,
    lnImpliedRate,
    expiry,
    syExchangeRate,
    previousExchangeRate,
    rateTimeDelta,
    swapVolume24h,
    feeRate,
    lpFeeShare = 0.2, // Default: 20% of fees go to LPs
  } = params;

  const now = BigInt(Math.floor(Date.now() / 1000));
  const timeToExpiry = expiry > now ? expiry - now : 1n;
  const yearsToExpiry = Number(timeToExpiry) / SECONDS_PER_YEAR;

  // 1. PT Fixed APY (implied rate from market)
  const ptFixedApy = calculatePtFixedApy(lnImpliedRate);

  // 2. Underlying Interest APY
  const interestApy = calculateUnderlyingApy(syExchangeRate, previousExchangeRate, rateTimeDelta);

  // 3. Swap Fee APY for LPs
  const swapFeeApy = calculateSwapFeeApy(swapVolume24h, syReserve, ptReserve, feeRate, lpFeeShare);

  // 4. LP APY Components
  const ptPortion = calculatePtPortion(ptReserve, syReserve);
  const syPortion = 1 - ptPortion;

  const lpPtYield = ptFixedApy * ptPortion;
  const lpSyYield = interestApy * syPortion;
  const lpRewards = 0; // TODO: Add when gauge/rewards implemented
  const lpTotalApy = lpPtYield + lpSyYield + swapFeeApy + lpRewards;

  // 5. YT Long Yield APY
  const ytMetrics = calculateYtMetrics(ptFixedApy, interestApy, yearsToExpiry);

  return {
    ptFixedApy,
    underlying: {
      interestApy,
      rewardsApr: 0, // TODO: Add reward tracking
      totalApy: interestApy,
    },
    lpApy: {
      ptYield: lpPtYield,
      syYield: lpSyYield,
      swapFees: swapFeeApy,
      rewards: lpRewards,
      total: lpTotalApy,
    },
    ytApy: ytMetrics,
  };
}

/**
 * Calculate PT fixed APY from ln(implied_rate)
 * APY = e^(ln_implied_rate) - 1
 */
export function calculatePtFixedApy(lnImpliedRate: bigint): number {
  if (lnImpliedRate === 0n) {
    return 0;
  }

  const rate = fromWad(lnImpliedRate).toNumber();
  return Math.exp(rate) - 1;
}

/**
 * Calculate underlying APY from exchange rate changes
 * APY = (current_rate / previous_rate)^(365/days) - 1
 */
export function calculateUnderlyingApy(
  currentRate: bigint,
  previousRate: bigint,
  timeDeltaSeconds: number
): number {
  if (previousRate === 0n || timeDeltaSeconds <= 0) {
    return 0;
  }

  const current = fromWad(currentRate).toNumber();
  const previous = fromWad(previousRate).toNumber();

  if (previous <= 0 || current <= previous) {
    return 0;
  }

  const daysDelta = timeDeltaSeconds / SECONDS_PER_DAY;

  if (daysDelta <= 0) {
    return 0;
  }

  // APY = (current/previous)^(365/days) - 1
  const rateRatio = current / previous;
  const annualized = Math.pow(rateRatio, 365 / daysDelta) - 1;

  // Cap at reasonable value (1000% APY)
  return Math.min(annualized, 10);
}

/**
 * Calculate swap fee APY for LPs
 * fee_apy = (daily_fees / tvl) * 365
 */
export function calculateSwapFeeApy(
  volume24h: bigint,
  syReserve: bigint,
  ptReserve: bigint,
  feeRate: bigint,
  lpFeeShare: number
): number {
  const totalReserves = syReserve + ptReserve;

  if (totalReserves === 0n || volume24h === 0n) {
    return 0;
  }

  const volumeNum = fromWad(volume24h).toNumber();
  const tvlNum = fromWad(totalReserves).toNumber();
  const feeRateNum = fromWad(feeRate).toNumber();

  if (tvlNum <= 0) {
    return 0;
  }

  // Daily fees = volume * fee_rate * lp_share
  const dailyFees = volumeNum * feeRateNum * lpFeeShare;

  // Annualize
  const apy = (dailyFees / tvlNum) * 365;

  // Cap at reasonable value
  return Math.min(apy, 10);
}

/**
 * Calculate PT portion of pool
 */
function calculatePtPortion(ptReserve: bigint, syReserve: bigint): number {
  const total = ptReserve + syReserve;

  if (total === 0n) {
    return 0.5;
  }

  return fromWad((ptReserve * WAD_BIGINT) / total).toNumber();
}

/**
 * Calculate YT metrics (leverage, break-even, effective APY)
 */
function calculateYtMetrics(
  ptFixedApy: number,
  underlyingApy: number,
  yearsToExpiry: number
): { longYieldApy: number; breakEvenApy: number; leverage: number } {
  // YT price ≈ 1 - PT price
  // PT price ≈ 1 / (1 + implied_apy)^years_to_expiry
  const ptPrice = 1 / Math.pow(1 + ptFixedApy, yearsToExpiry);
  const ytPrice = Math.max(1 - ptPrice, 0.001); // Floor to prevent division issues

  // Leverage = 1 / YT_price (how much yield exposure per dollar)
  const leverage = 1 / ytPrice;

  // Break-even: need underlying to match implied rate
  const breakEvenApy = ptFixedApy;

  // Long Yield APY: profit/loss from yield differential * leverage
  // If underlying > implied: profit
  // If underlying < implied: loss
  const yieldDifferential = underlyingApy - ptFixedApy;
  const longYieldApy = yieldDifferential * leverage;

  return {
    longYieldApy,
    breakEvenApy,
    leverage,
  };
}

/**
 * Format APY as percentage string
 */
export function formatApyPercent(apy: number, decimals = 2): string {
  const percent = apy * 100;

  if (Math.abs(percent) < 0.01 && percent !== 0) {
    return percent > 0 ? '< 0.01%' : '> -0.01%';
  }

  return `${percent.toFixed(decimals)}%`;
}

/**
 * Get APY display color class based on value
 */
export function getApyColorClass(apy: number): string {
  if (apy > 0) {
    return 'text-primary';
  }
  if (apy < 0) {
    return 'text-destructive';
  }
  return 'text-foreground';
}
