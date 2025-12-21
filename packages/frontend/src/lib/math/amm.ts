/**
 * AMM Math Library
 *
 * Ports the on-chain market_math.cairo logic to TypeScript for accurate
 * price impact calculation and swap quotes.
 *
 * Key concepts:
 * - PT price naturally converges to 1 SY as expiry approaches
 * - Uses a modified curve that accounts for time decay
 * - Implied rate derived from market state using logit function
 *
 * Uses cairo-fp library for exp/ln calculations to match on-chain precision.
 * @see Security Audit I-08 - Fixed-Point Library Integration
 */

import { expWad as fpExpWad, expNegWad as fpExpNegWad, lnWad as fpLnWad } from './fp';
import { WAD_BIGINT, wadDiv, wadMul } from './wad';

// ============================================================================
// Constants (matching market_math.cairo)
// ============================================================================

/** Seconds per year for APY calculations */
export const SECONDS_PER_YEAR = 31_536_000n;

/** Minimum time to expiry to prevent division issues (1 second) */
export const MIN_TIME_TO_EXPIRY = 1n;

/** Maximum ln(implied_rate) ~4.6 WAD corresponds to ~10000% APY */
export const MAX_LN_IMPLIED_RATE = 4_600_000_000_000_000_000n;

/** Minimum proportion of assets (prevents extreme imbalance) */
export const MIN_PROPORTION = 1_000_000_000_000_000n; // 0.001 WAD (0.1%)
export const MAX_PROPORTION = 999_000_000_000_000_000n; // 0.999 WAD (99.9%)

/** Half WAD for default proportions */
export const HALF_WAD = WAD_BIGINT / 2n;

// ============================================================================
// Types
// ============================================================================

/** Market state containing reserves and parameters */
export interface MarketState {
  syReserve: bigint;
  ptReserve: bigint;
  totalLp: bigint;
  scalarRoot: bigint; // Controls rate sensitivity (in WAD)
  initialAnchor: bigint; // Initial ln(implied rate) (in WAD)
  feeRate: bigint; // Fee rate in WAD (e.g., 0.01 WAD = 1%)
  expiry: bigint; // Expiry timestamp
  lastLnImpliedRate: bigint; // Cached ln(implied rate)
}

/** Result of a swap calculation */
export interface SwapResult {
  amountOut: bigint;
  fee: bigint;
  newLnImpliedRate: bigint;
  priceImpact: number; // As decimal (0.01 = 1%)
  effectivePrice: bigint; // WAD - actual price paid
  spotPrice: bigint; // WAD - price before impact
}

/** Result of a liquidity calculation */
export interface LiquidityResult {
  lpOut: bigint;
  syUsed: bigint;
  ptUsed: bigint;
}

// ============================================================================
// Math Helpers (exp/ln using cairo-fp for on-chain precision matching)
// ============================================================================

/**
 * Natural log for WAD bigint values
 * Returns (|ln(x)|, isNegative) to match Cairo implementation
 * Uses cairo-fp for precision matching with on-chain calculations
 */
export function lnWad(x: bigint): { value: bigint; isNegative: boolean } {
  return fpLnWad(x);
}

/**
 * Exponential for WAD bigint values
 * e^x where x is in WAD
 * Uses cairo-fp for precision matching with on-chain calculations
 */
export function expWad(x: bigint): bigint {
  return fpExpWad(x);
}

/**
 * Exponential of negative value for WAD bigint
 * e^(-x) where x is in WAD
 * Uses cairo-fp for precision matching with on-chain calculations
 */
export function expNegWad(x: bigint): bigint {
  return fpExpNegWad(x);
}

// ============================================================================
// Core AMM Functions (ported from market_math.cairo)
// ============================================================================

/**
 * Calculate time to expiry in seconds
 * @param expiry The expiry timestamp
 * @param currentTime Current timestamp (defaults to now)
 * @returns Time to expiry in seconds (minimum MIN_TIME_TO_EXPIRY)
 */
export function getTimeToExpiry(expiry: bigint, currentTime?: bigint): bigint {
  const now = currentTime ?? BigInt(Math.floor(Date.now() / 1000));

  if (now >= expiry) {
    return MIN_TIME_TO_EXPIRY;
  }

  return expiry - now;
}

/**
 * Calculate the proportion of PT in the pool
 * proportion = pt_reserve / (pt_reserve + sy_reserve)
 * @param state Current market state
 * @returns Proportion in WAD format
 */
export function getProportion(state: MarketState): bigint {
  const total = state.ptReserve + state.syReserve;

  if (total === 0n) {
    return HALF_WAD; // 50% if pool is empty
  }

  return wadDiv(state.ptReserve, total);
}

/**
 * Calculate the rate scalar adjusted for time to expiry
 * As time passes, the rate becomes MORE sensitive to price changes
 * rate_scalar = scalar_root * SECONDS_PER_YEAR / time_to_expiry
 * @param scalarRoot Base scalar value in WAD
 * @param timeToExpiry Time to expiry in seconds
 * @returns Adjusted rate scalar in WAD
 */
export function getRateScalar(scalarRoot: bigint, timeToExpiry: bigint): bigint {
  if (timeToExpiry === 0n) {
    return scalarRoot * 1000n * WAD_BIGINT; // Very large scalar near expiry
  }

  // rateScalar = scalarRoot * SECONDS_PER_YEAR / timeToExpiry
  return wadDiv(wadMul(scalarRoot, SECONDS_PER_YEAR * WAD_BIGINT), timeToExpiry * WAD_BIGINT);
}

/**
 * Calculate the logit function: ln(p / (1-p))
 * Returns (|logit(p)|, isNegative)
 * @param proportion Proportion in WAD (between 0 and 1)
 * @returns Logit value and sign
 */
export function getLogit(proportion: bigint): { value: bigint; isNegative: boolean } {
  // Clamp proportion to valid range
  const clampedProportion =
    proportion < MIN_PROPORTION
      ? MIN_PROPORTION
      : proportion > MAX_PROPORTION
        ? MAX_PROPORTION
        : proportion;

  // odds = p / (1 - p)
  const odds = wadDiv(clampedProportion, WAD_BIGINT - clampedProportion);

  // logit(p) = ln(odds)
  return lnWad(odds);
}

/**
 * Calculate the exchange rate from implied rate
 * exchangeRate = e^(lnImpliedRate * timeToExpiry / SECONDS_PER_YEAR)
 * @param lnImpliedRate The ln of implied rate in WAD
 * @param timeToExpiry Time to expiry in seconds
 * @returns Exchange rate in WAD (PT value in terms of SY)
 */
export function getExchangeRateFromImpliedRate(
  lnImpliedRate: bigint,
  timeToExpiry: bigint
): bigint {
  if (timeToExpiry === 0n || lnImpliedRate === 0n) {
    return WAD_BIGINT; // At expiry, exchange rate = 1
  }

  // Cap lnImpliedRate to prevent overflow
  const cappedLnRate = lnImpliedRate > MAX_LN_IMPLIED_RATE ? MAX_LN_IMPLIED_RATE : lnImpliedRate;

  // exponent = lnImpliedRate * timeToExpiry / SECONDS_PER_YEAR
  const exponent = wadDiv(
    wadMul(cappedLnRate, timeToExpiry * WAD_BIGINT),
    SECONDS_PER_YEAR * WAD_BIGINT
  );

  // Cap exponent to prevent overflow in exp
  const cappedExponent = exponent > 135n * WAD_BIGINT ? 135n * WAD_BIGINT : exponent;

  return expWad(cappedExponent);
}

/**
 * Calculate the rate anchor from current market state
 * rateAnchor = exchangeRate - logit(proportion) / rateScalar
 * @param state Current market state
 * @param timeToExpiry Time to expiry in seconds
 * @returns Rate anchor in WAD
 */
export function getRateAnchor(state: MarketState, timeToExpiry: bigint): bigint {
  const proportion = getProportion(state);
  const rateScalar = getRateScalar(state.scalarRoot, timeToExpiry);

  // Get exchange rate from cached implied rate
  const exchangeRate = getExchangeRateFromImpliedRate(state.lastLnImpliedRate, timeToExpiry);

  // Get logit of current proportion
  const { value: logitValue, isNegative } = getLogit(proportion);

  // scaledLogit = logit / rateScalar
  const scaledLogit = wadDiv(logitValue, rateScalar);

  // rateAnchor = exchangeRate - scaledLogit (with sign handling)
  if (isNegative) {
    // logit is negative, so -logit/rateScalar = +scaledLogit
    return exchangeRate + scaledLogit;
  } else {
    // logit is positive
    if (scaledLogit >= exchangeRate) {
      return WAD_BIGINT; // Floor at 1.0
    }
    return exchangeRate - scaledLogit;
  }
}

/**
 * Calculate the exchange rate at a given proportion
 * exchangeRate = logit(proportion) / rateScalar + rateAnchor
 * @param proportion PT proportion of pool in WAD
 * @param rateScalar Rate scalar in WAD
 * @param rateAnchor Rate anchor in WAD
 * @returns Exchange rate in WAD
 */
export function getExchangeRate(
  proportion: bigint,
  rateScalar: bigint,
  rateAnchor: bigint
): bigint {
  const { value: logitValue, isNegative } = getLogit(proportion);

  // scaledLogit = logit / rateScalar
  const scaledLogit = wadDiv(logitValue, rateScalar);

  // exchangeRate = scaledLogit + rateAnchor (with sign handling)
  let exchangeRate: bigint;
  if (isNegative) {
    // logit is negative, so logit/rateScalar is negative
    if (scaledLogit >= rateAnchor) {
      exchangeRate = WAD_BIGINT; // Floor at 1.0
    } else {
      exchangeRate = rateAnchor - scaledLogit;
    }
  } else {
    // logit is positive
    exchangeRate = rateAnchor + scaledLogit;
  }

  // Exchange rate must be at least 1.0 WAD
  return exchangeRate < WAD_BIGINT ? WAD_BIGINT : exchangeRate;
}

/**
 * Calculate time-adjusted fee rate (linear decay toward expiry)
 * adjustedFeeRate = baseFeeRate * timeToExpiry / SECONDS_PER_YEAR
 * @param feeRate Base fee rate in WAD
 * @param timeToExpiry Time to expiry in seconds
 * @returns Adjusted fee rate in WAD
 */
export function getTimeAdjustedFeeRate(feeRate: bigint, timeToExpiry: bigint): bigint {
  if (timeToExpiry === 0n) {
    return 0n; // No fees at expiry
  }

  if (timeToExpiry >= SECONDS_PER_YEAR) {
    return feeRate; // Full fee rate if more than 1 year out
  }

  return wadDiv(wadMul(feeRate, timeToExpiry * WAD_BIGINT), SECONDS_PER_YEAR * WAD_BIGINT);
}

/**
 * Calculate ln(implied_rate) from exchange rate
 * lnImpliedRate = ln(exchangeRate) * SECONDS_PER_YEAR / timeToExpiry
 * @param exchangeRate Exchange rate in WAD
 * @param timeToExpiry Time to expiry in seconds
 * @returns ln(implied_rate) in WAD, capped at MAX_LN_IMPLIED_RATE
 */
export function getLnImpliedRateFromExchangeRate(
  exchangeRate: bigint,
  timeToExpiry: bigint
): bigint {
  if (timeToExpiry === 0n || exchangeRate <= WAD_BIGINT) {
    return 0n;
  }

  // lnExchangeRate = ln(exchangeRate)
  const { value: lnExchangeRate, isNegative } = lnWad(exchangeRate);

  if (isNegative) {
    return 0n; // Exchange rate < 1 means 0 implied rate
  }

  // lnImpliedRate = lnExchangeRate * SECONDS_PER_YEAR / timeToExpiry
  const result = wadDiv(
    wadMul(lnExchangeRate, SECONDS_PER_YEAR * WAD_BIGINT),
    timeToExpiry * WAD_BIGINT
  );

  // Cap at MAX_LN_IMPLIED_RATE to prevent overflow
  return result > MAX_LN_IMPLIED_RATE ? MAX_LN_IMPLIED_RATE : result;
}

/**
 * Calculate ln(implied_rate) from market state using exchange rate formula
 * @param state Current market state
 * @param timeToExpiry Time to expiry in seconds
 * @returns ln(implied_rate) in WAD, always non-negative
 */
export function getLnImpliedRate(state: MarketState, timeToExpiry: bigint): bigint {
  const proportion = getProportion(state);
  const rateScalar = getRateScalar(state.scalarRoot, timeToExpiry);
  const rateAnchor = getRateAnchor(state, timeToExpiry);

  // Get exchange rate at current proportion
  const exchangeRate = getExchangeRate(proportion, rateScalar, rateAnchor);

  // Calculate ln(implied_rate) from exchange rate
  return getLnImpliedRateFromExchangeRate(exchangeRate, timeToExpiry);
}

/**
 * Calculate PT price in terms of SY (how much SY per PT)
 * pt_price = e^(-ln_implied_rate * time_to_expiry_years)
 * @param lnImpliedRate The ln of implied rate in WAD
 * @param timeToExpiry Time to expiry in seconds
 * @returns PT price in WAD (always <= 1)
 */
export function getPtPrice(lnImpliedRate: bigint, timeToExpiry: bigint): bigint {
  if (timeToExpiry === 0n || lnImpliedRate === 0n) {
    return WAD_BIGINT; // At expiry or zero rate, PT = 1 SY
  }

  // time_to_expiry in years
  const timeInYears = wadDiv(timeToExpiry * WAD_BIGINT, SECONDS_PER_YEAR * WAD_BIGINT);

  // exponent = ln_implied_rate * time_in_years
  const exponent = wadMul(lnImpliedRate, timeInYears);

  // pt_price = e^(-exponent)
  return expNegWad(exponent);
}

/**
 * Calculate the implied APY from ln(implied_rate)
 * APY = e^(ln_implied_rate) - 1
 * @param lnImpliedRate The ln of implied rate in WAD
 * @returns APY as a number (0.05 = 5%)
 */
export function getImpliedApy(lnImpliedRate: bigint): number {
  if (lnImpliedRate === 0n) {
    return 0;
  }

  const expRate = expWad(lnImpliedRate);

  if (expRate <= WAD_BIGINT) {
    return 0;
  }

  return Number(expRate - WAD_BIGINT) / Number(WAD_BIGINT);
}

// ============================================================================
// Swap Calculations
// ============================================================================

/**
 * Calculate PT output for exact SY input (buy PT with SY)
 * Uses logit-based exchange rate curve matching on-chain calc_swap_exact_sy_for_pt
 * @param state Current market state
 * @param exactSyIn Amount of SY to sell
 * @param currentTime Current timestamp (optional, defaults to now)
 * @returns SwapResult with output amount, fees, and price impact
 */
export function calcSwapExactSyForPt(
  state: MarketState,
  exactSyIn: bigint,
  currentTime?: bigint
): SwapResult {
  if (exactSyIn === 0n) {
    return {
      amountOut: 0n,
      fee: 0n,
      newLnImpliedRate: state.lastLnImpliedRate,
      priceImpact: 0,
      effectivePrice: WAD_BIGINT,
      spotPrice: WAD_BIGINT,
    };
  }

  const timeToExpiry = getTimeToExpiry(state.expiry, currentTime);

  // Calculate precomputed values
  const rateScalar = getRateScalar(state.scalarRoot, timeToExpiry);
  const rateAnchor = getRateAnchor(state, timeToExpiry);
  const adjustedFeeRate = getTimeAdjustedFeeRate(state.feeRate, timeToExpiry);

  // Get current proportion and exchange rate (spot)
  const currentProportion = getProportion(state);
  const spotExchangeRate = getExchangeRate(currentProportion, rateScalar, rateAnchor);
  const spotPrice = wadDiv(WAD_BIGINT, spotExchangeRate); // PT price = 1/exchangeRate

  // Apply fee first (fee is taken from input)
  const fee = wadMul(exactSyIn, adjustedFeeRate);
  const syInAfterFee = exactSyIn - fee;

  // Binary search to find PT output
  // We need to find ptOut such that the exchange rate at new proportion gives us the right price
  let low = 0n;
  let high = state.ptReserve - WAD_BIGINT; // Can't take all PT
  let ptOut = 0n;

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2n;
    if (mid === 0n) break;

    // New state after taking mid PT
    const newPtReserve = state.ptReserve - mid;
    const newSyReserve = state.syReserve + syInAfterFee;
    const newProportion = wadDiv(newPtReserve, newPtReserve + newSyReserve);

    // Exchange rate at new proportion
    const newExchangeRate = getExchangeRate(newProportion, rateScalar, rateAnchor);

    // PT value we should get: syInAfterFee * exchangeRate (since exchangeRate is PT/SY)
    const expectedPtOut = wadMul(syInAfterFee, newExchangeRate);

    if (mid < expectedPtOut) {
      low = mid + 1n;
    } else if (mid > expectedPtOut) {
      high = mid - 1n;
    } else {
      ptOut = mid;
      break;
    }

    // Use the lower bound as our estimate
    ptOut = low;
  }

  // Ensure we don't exceed reserves
  if (ptOut >= state.ptReserve) {
    ptOut = state.ptReserve - WAD_BIGINT;
  }

  // Calculate new state for implied rate after swap
  const newSyReserve = state.syReserve + syInAfterFee;
  const newPtReserve = state.ptReserve - ptOut;
  const newProportion = wadDiv(newPtReserve, newPtReserve + newSyReserve);
  const newExchangeRate = getExchangeRate(newProportion, rateScalar, rateAnchor);
  const newLnImpliedRate = getLnImpliedRateFromExchangeRate(newExchangeRate, timeToExpiry);

  // Calculate price impact as percentage difference from spot
  const effectiveExchangeRate = ptOut > 0n ? wadDiv(ptOut, syInAfterFee) : WAD_BIGINT;
  const priceImpact =
    spotExchangeRate > 0n
      ? Math.abs(Number(effectiveExchangeRate - spotExchangeRate)) / Number(spotExchangeRate)
      : 0;

  // Effective price = SY spent / PT received
  const effectivePrice = ptOut > 0n ? wadDiv(exactSyIn, ptOut) : WAD_BIGINT;

  return {
    amountOut: ptOut,
    fee,
    newLnImpliedRate,
    priceImpact,
    effectivePrice,
    spotPrice,
  };
}

/**
 * Calculate SY output for exact PT input (sell PT for SY)
 * Uses logit-based exchange rate curve matching on-chain calc_swap_exact_pt_for_sy
 * @param state Current market state
 * @param exactPtIn Amount of PT to sell
 * @param currentTime Current timestamp (optional, defaults to now)
 * @returns SwapResult with output amount, fees, and price impact
 */
export function calcSwapExactPtForSy(
  state: MarketState,
  exactPtIn: bigint,
  currentTime?: bigint
): SwapResult {
  if (exactPtIn === 0n) {
    return {
      amountOut: 0n,
      fee: 0n,
      newLnImpliedRate: state.lastLnImpliedRate,
      priceImpact: 0,
      effectivePrice: WAD_BIGINT,
      spotPrice: WAD_BIGINT,
    };
  }

  const timeToExpiry = getTimeToExpiry(state.expiry, currentTime);

  // Calculate precomputed values
  const rateScalar = getRateScalar(state.scalarRoot, timeToExpiry);
  const rateAnchor = getRateAnchor(state, timeToExpiry);
  const adjustedFeeRate = getTimeAdjustedFeeRate(state.feeRate, timeToExpiry);

  // Get current proportion and exchange rate (spot)
  const currentProportion = getProportion(state);
  const spotExchangeRate = getExchangeRate(currentProportion, rateScalar, rateAnchor);
  const spotPrice = wadDiv(WAD_BIGINT, spotExchangeRate); // PT price = 1/exchangeRate

  // Calculate new proportion after adding PT
  const newPtReserve = state.ptReserve + exactPtIn;

  // Binary search to find SY output
  let low = 0n;
  let high = state.syReserve - WAD_BIGINT; // Can't take all SY
  let syOutBeforeFee = 0n;

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2n;
    if (mid === 0n) break;

    // New state after taking mid SY
    const newSyReserve = state.syReserve - mid;
    const newProportion = wadDiv(newPtReserve, newPtReserve + newSyReserve);

    // Exchange rate at new proportion
    const newExchangeRate = getExchangeRate(newProportion, rateScalar, rateAnchor);

    // SY value we should get: exactPtIn / exchangeRate (since exchangeRate is PT/SY)
    const expectedSyOut = wadDiv(exactPtIn, newExchangeRate);

    if (mid < expectedSyOut) {
      low = mid + 1n;
    } else if (mid > expectedSyOut) {
      high = mid - 1n;
    } else {
      syOutBeforeFee = mid;
      break;
    }

    // Use the lower bound as our estimate
    syOutBeforeFee = low;
  }

  // Ensure we don't exceed reserves
  if (syOutBeforeFee >= state.syReserve) {
    syOutBeforeFee = state.syReserve - WAD_BIGINT;
  }

  // Apply fee on output
  const fee = wadMul(syOutBeforeFee, adjustedFeeRate);
  const syOut = syOutBeforeFee - fee;

  // Calculate new state for implied rate after swap
  const newSyReserve = state.syReserve - syOutBeforeFee;
  const newProportion = wadDiv(newPtReserve, newPtReserve + newSyReserve);
  const newExchangeRate = getExchangeRate(newProportion, rateScalar, rateAnchor);
  const newLnImpliedRate = getLnImpliedRateFromExchangeRate(newExchangeRate, timeToExpiry);

  // Calculate price impact as percentage difference from spot
  const effectiveExchangeRate =
    syOutBeforeFee > 0n ? wadDiv(exactPtIn, syOutBeforeFee) : WAD_BIGINT;
  const priceImpact =
    spotExchangeRate > 0n
      ? Math.abs(Number(effectiveExchangeRate - spotExchangeRate)) / Number(spotExchangeRate)
      : 0;

  // Effective price = PT spent / SY received
  const effectivePrice = syOut > 0n ? wadDiv(exactPtIn, syOut) : WAD_BIGINT;

  return {
    amountOut: syOut,
    fee,
    newLnImpliedRate,
    priceImpact,
    effectivePrice,
    spotPrice,
  };
}

/**
 * Calculate SY input required for exact PT output (buy exact PT)
 * Uses logit-based exchange rate curve matching on-chain calc_swap_sy_for_exact_pt
 * @param state Current market state
 * @param exactPtOut Amount of PT to buy
 * @param currentTime Current timestamp (optional, defaults to now)
 * @returns SwapResult with input amount required
 */
export function calcSwapSyForExactPt(
  state: MarketState,
  exactPtOut: bigint,
  currentTime?: bigint
): SwapResult {
  if (exactPtOut === 0n) {
    return {
      amountOut: 0n,
      fee: 0n,
      newLnImpliedRate: state.lastLnImpliedRate,
      priceImpact: 0,
      effectivePrice: WAD_BIGINT,
      spotPrice: WAD_BIGINT,
    };
  }

  if (exactPtOut >= state.ptReserve) {
    throw new Error('Insufficient liquidity');
  }

  const timeToExpiry = getTimeToExpiry(state.expiry, currentTime);

  // Calculate precomputed values
  const rateScalar = getRateScalar(state.scalarRoot, timeToExpiry);
  const rateAnchor = getRateAnchor(state, timeToExpiry);
  const adjustedFeeRate = getTimeAdjustedFeeRate(state.feeRate, timeToExpiry);

  // Get current proportion and exchange rate (spot)
  const currentProportion = getProportion(state);
  const spotExchangeRate = getExchangeRate(currentProportion, rateScalar, rateAnchor);
  const spotPrice = wadDiv(WAD_BIGINT, spotExchangeRate); // PT price = 1/exchangeRate

  // Calculate new PT reserve after taking exactPtOut
  const newPtReserve = state.ptReserve - exactPtOut;

  // Binary search to find SY input required
  let low = 0n;
  let high = state.syReserve * 10n; // Upper bound for SY input
  let syInBeforeFee = 0n;

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2n;
    if (mid === 0n) break;

    // New state after adding mid SY
    const newSyReserve = state.syReserve + mid;
    const newProportion = wadDiv(newPtReserve, newPtReserve + newSyReserve);

    // Exchange rate at new proportion
    const newExchangeRate = getExchangeRate(newProportion, rateScalar, rateAnchor);

    // PT we would get for mid SY: mid * exchangeRate
    const ptOut = wadMul(mid, newExchangeRate);

    if (ptOut < exactPtOut) {
      low = mid + 1n;
    } else if (ptOut > exactPtOut) {
      high = mid - 1n;
    } else {
      syInBeforeFee = mid;
      break;
    }

    // Use the higher bound as our estimate (need at least this much)
    syInBeforeFee = high;
  }

  // Add fee (fee is on top of required amount)
  // syIn = syInBeforeFee / (1 - feeRate)
  const syIn = wadDiv(syInBeforeFee, WAD_BIGINT - adjustedFeeRate);
  const fee = syIn - syInBeforeFee;

  // Calculate new implied rate
  const newSyReserve = state.syReserve + syInBeforeFee;
  const newProportion = wadDiv(newPtReserve, newPtReserve + newSyReserve);
  const newExchangeRate = getExchangeRate(newProportion, rateScalar, rateAnchor);
  const newLnImpliedRate = getLnImpliedRateFromExchangeRate(newExchangeRate, timeToExpiry);

  // Price impact: compare actual price to spot price
  const effectivePrice = wadDiv(syIn, exactPtOut);
  const priceImpact =
    spotPrice > 0n ? Math.abs(Number(effectivePrice - spotPrice)) / Number(spotPrice) : 0;

  return {
    amountOut: syIn, // Note: for exact output, this is the input required
    fee,
    newLnImpliedRate,
    priceImpact,
    effectivePrice,
    spotPrice,
  };
}

/**
 * Calculate PT input required for exact SY output (sell PT for exact SY)
 * Uses logit-based exchange rate curve matching on-chain calc_swap_pt_for_exact_sy
 * @param state Current market state
 * @param exactSyOut Amount of SY to receive
 * @param currentTime Current timestamp (optional, defaults to now)
 * @returns SwapResult with input amount required
 */
export function calcSwapPtForExactSy(
  state: MarketState,
  exactSyOut: bigint,
  currentTime?: bigint
): SwapResult {
  if (exactSyOut === 0n) {
    return {
      amountOut: 0n,
      fee: 0n,
      newLnImpliedRate: state.lastLnImpliedRate,
      priceImpact: 0,
      effectivePrice: WAD_BIGINT,
      spotPrice: WAD_BIGINT,
    };
  }

  if (exactSyOut >= state.syReserve) {
    throw new Error('Insufficient liquidity');
  }

  const timeToExpiry = getTimeToExpiry(state.expiry, currentTime);

  // Calculate precomputed values
  const rateScalar = getRateScalar(state.scalarRoot, timeToExpiry);
  const rateAnchor = getRateAnchor(state, timeToExpiry);
  const adjustedFeeRate = getTimeAdjustedFeeRate(state.feeRate, timeToExpiry);

  // Get current proportion and exchange rate (spot)
  const currentProportion = getProportion(state);
  const spotExchangeRate = getExchangeRate(currentProportion, rateScalar, rateAnchor);
  const spotPrice = wadDiv(WAD_BIGINT, spotExchangeRate); // PT price = 1/exchangeRate

  // Add fee to output (pool needs to give out more before fee)
  // syOutBeforeFee = exactSyOut / (1 - feeRate)
  const syOutBeforeFee = wadDiv(exactSyOut, WAD_BIGINT - adjustedFeeRate);
  const fee = syOutBeforeFee - exactSyOut;

  // Calculate new SY reserve
  const newSyReserve = state.syReserve - syOutBeforeFee;

  // Binary search to find PT input required
  let low = 0n;
  let high = state.ptReserve * 10n; // Upper bound for PT input
  let ptIn = 0n;

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2n;
    if (mid === 0n) break;

    // New state after adding mid PT
    const newPtReserve = state.ptReserve + mid;
    const newProportion = wadDiv(newPtReserve, newPtReserve + newSyReserve);

    // Exchange rate at new proportion
    const newExchangeRate = getExchangeRate(newProportion, rateScalar, rateAnchor);

    // SY we would get for mid PT: mid / exchangeRate
    const syOut = wadDiv(mid, newExchangeRate);

    if (syOut < syOutBeforeFee) {
      low = mid + 1n;
    } else if (syOut > syOutBeforeFee) {
      high = mid - 1n;
    } else {
      ptIn = mid;
      break;
    }

    // Use the higher bound as our estimate (need at least this much)
    ptIn = high;
  }

  // Calculate new implied rate
  const newPtReserve = state.ptReserve + ptIn;
  const newProportion = wadDiv(newPtReserve, newPtReserve + newSyReserve);
  const newExchangeRate = getExchangeRate(newProportion, rateScalar, rateAnchor);
  const newLnImpliedRate = getLnImpliedRateFromExchangeRate(newExchangeRate, timeToExpiry);

  // Effective price = PT spent / SY received
  const effectivePrice = wadDiv(ptIn, exactSyOut);
  const priceImpact =
    spotPrice > 0n ? Math.abs(Number(effectivePrice - spotPrice)) / Number(spotPrice) : 0;

  return {
    amountOut: ptIn, // Note: for exact output, this is the input required
    fee,
    newLnImpliedRate,
    priceImpact,
    effectivePrice,
    spotPrice,
  };
}

// ============================================================================
// Liquidity Calculations
// ============================================================================

/**
 * Calculate LP tokens to mint for given liquidity addition
 * @param state Current market state
 * @param syAmount Amount of SY to add
 * @param ptAmount Amount of PT to add
 * @returns LiquidityResult with LP to mint and amounts used
 */
export function calcMintLp(
  state: MarketState,
  syAmount: bigint,
  ptAmount: bigint
): LiquidityResult {
  if (state.totalLp === 0n) {
    // First liquidity provider - use geometric mean
    const product = wadMul(syAmount, ptAmount);
    const lpOut = sqrtBigInt(product);
    return { lpOut, syUsed: syAmount, ptUsed: ptAmount };
  }

  // Calculate the amount of each token to use based on current ratio
  const syRatio = wadDiv(syAmount, state.syReserve);
  const ptRatio = wadDiv(ptAmount, state.ptReserve);

  // Use the smaller ratio to maintain pool balance
  const ratio = syRatio < ptRatio ? syRatio : ptRatio;

  const syUsed = wadMul(ratio, state.syReserve);
  const ptUsed = wadMul(ratio, state.ptReserve);
  const lpOut = wadMul(ratio, state.totalLp);

  return { lpOut, syUsed, ptUsed };
}

/**
 * Calculate tokens to return for LP burn
 * @param state Current market state
 * @param lpToBurn Amount of LP to burn
 * @returns Amounts of SY and PT to return
 */
export function calcBurnLp(state: MarketState, lpToBurn: bigint): { syOut: bigint; ptOut: bigint } {
  if (state.totalLp === 0n || lpToBurn === 0n) {
    return { syOut: 0n, ptOut: 0n };
  }

  const ratio = wadDiv(lpToBurn, state.totalLp);
  const syOut = wadMul(ratio, state.syReserve);
  const ptOut = wadMul(ratio, state.ptReserve);

  return { syOut, ptOut };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Integer square root (Babylonian method)
 */
function sqrtBigInt(x: bigint): bigint {
  if (x === 0n) return 0n;
  if (x <= 3n) return 1n;

  let z = x;
  let y = (x + 1n) / 2n;

  while (y < z) {
    z = y;
    y = (x / y + y) / 2n;
  }

  return z;
}

/**
 * Calculate slippage-adjusted minimum output
 * @param expectedOut Expected output amount
 * @param slippageBps Slippage tolerance in basis points (50 = 0.5%)
 * @returns Minimum acceptable output
 */
export function calculateMinOutput(expectedOut: bigint, slippageBps: number): bigint {
  const slippageMultiplier = BigInt(10000 - slippageBps);
  return (expectedOut * slippageMultiplier) / 10000n;
}

/**
 * Format price impact for display
 * @param priceImpact Price impact as decimal
 * @returns Formatted string with % sign
 */
export function formatPriceImpact(priceImpact: number): string {
  const percent = priceImpact * 100;

  if (percent < 0.01) {
    return '< 0.01%';
  }

  return `${percent.toFixed(2)}%`;
}

/** Price impact severity levels for UI styling */
export type PriceImpactSeverity = 'low' | 'medium' | 'high' | 'very-high';

/**
 * Get price impact severity level
 * @param priceImpact Price impact as decimal
 * @returns Severity level for UI styling
 */
export function getPriceImpactSeverity(priceImpact: number): PriceImpactSeverity {
  if (priceImpact < 0.01) return 'low'; // < 1%
  if (priceImpact < 0.03) return 'medium'; // 1-3%
  if (priceImpact < 0.05) return 'high'; // 3-5%
  return 'very-high'; // > 5%
}
