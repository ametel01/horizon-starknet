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
 */

import BigNumber from 'bignumber.js';

import { WAD_BIGINT, fromWad, toWad, wadDiv, wadMul } from './wad';

// Configure BigNumber for high precision calculations
BigNumber.config({
  DECIMAL_PLACES: 36,
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
  EXPONENTIAL_AT: [-50, 50],
});

// ============================================================================
// Constants (matching market_math.cairo)
// ============================================================================

/** Seconds per year for APY calculations */
export const SECONDS_PER_YEAR = 31_536_000n;
export const SECONDS_PER_YEAR_BN = new BigNumber(31_536_000);

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
// Math Helpers (exp/ln using BigNumber.js)
// ============================================================================

/**
 * Natural logarithm using Taylor series
 * ln(x) = 2 * sum((((x-1)/(x+1))^(2n+1)) / (2n+1)) for x > 0
 */
export function lnBigNumber(x: BigNumber): BigNumber {
  if (x.lte(0)) {
    throw new Error('ln undefined for x <= 0');
  }

  // For x close to 1, use direct Taylor series
  // For x far from 1, use ln(x) = ln(x/e^k) + k where e^k is chosen to bring x close to 1

  // Normalize x to be close to 1 by dividing by powers of e
  const E = new BigNumber('2.718281828459045235360287471352662497757');
  let normalized = x;
  let adjustment = new BigNumber(0);

  // Bring x into range [0.5, 2] for better convergence
  while (normalized.gt(2)) {
    normalized = normalized.div(E);
    adjustment = adjustment.plus(1);
  }
  while (normalized.lt(0.5)) {
    normalized = normalized.times(E);
    adjustment = adjustment.minus(1);
  }

  // Taylor series: ln(x) = 2 * sum((z^(2n+1))/(2n+1)) where z = (x-1)/(x+1)
  const z = normalized.minus(1).div(normalized.plus(1));
  let result = new BigNumber(0);
  let zPower = z;
  const zSquared = z.times(z);

  for (let n = 0; n < 100; n++) {
    const term = zPower.div(2 * n + 1);
    result = result.plus(term);

    if (term.abs().lt(1e-36)) break;

    zPower = zPower.times(zSquared);
  }

  return result.times(2).plus(adjustment);
}

/**
 * Exponential function using Taylor series
 * e^x = sum(x^n / n!)
 */
export function expBigNumber(x: BigNumber): BigNumber {
  // Handle large negative exponents
  if (x.lt(-40)) {
    return new BigNumber(0);
  }

  // Handle large positive exponents (cap at reasonable value)
  if (x.gt(40)) {
    return new BigNumber('2.35385266837019985e17'); // e^40
  }

  let result = new BigNumber(1);
  let term = new BigNumber(1);

  for (let n = 1; n < 200; n++) {
    term = term.times(x).div(n);
    result = result.plus(term);

    if (term.abs().lt(1e-36)) break;
  }

  return result;
}

/**
 * Natural log for WAD bigint values
 * Returns (|ln(x)|, isNegative) to match Cairo implementation
 */
export function lnWad(x: bigint): { value: bigint; isNegative: boolean } {
  if (x <= 0n) {
    throw new Error('ln undefined for x <= 0');
  }

  const xBn = fromWad(x);
  const lnValue = lnBigNumber(xBn);
  const isNegative = lnValue.lt(0);

  return {
    value: toWad(lnValue.abs()),
    isNegative,
  };
}

/**
 * Exponential for WAD bigint values
 * e^x where x is in WAD
 */
export function expWad(x: bigint): bigint {
  const xBn = fromWad(x);
  const result = expBigNumber(xBn);
  return toWad(result);
}

/**
 * Exponential of negative value for WAD bigint
 * e^(-x) where x is in WAD
 */
export function expNegWad(x: bigint): bigint {
  const xBn = fromWad(x).negated();
  const result = expBigNumber(xBn);
  return toWad(result);
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
 * As time passes, the rate becomes less sensitive to price changes
 * rate_scalar = scalar_root / time_to_expiry_years
 * @param scalarRoot Base scalar value in WAD
 * @param timeToExpiry Time to expiry in seconds
 * @returns Adjusted rate scalar in WAD
 */
export function getRateScalar(scalarRoot: bigint, timeToExpiry: bigint): bigint {
  const timeInYears = wadDiv(timeToExpiry * WAD_BIGINT, SECONDS_PER_YEAR * WAD_BIGINT);

  if (timeInYears === 0n) {
    return scalarRoot * 1000n; // Very large scalar near expiry
  }

  return wadDiv(scalarRoot, timeInYears);
}

/**
 * Calculate ln(implied_rate) from market state
 * ln_implied_rate = anchor - rate_scalar * ln(proportion / (1 - proportion))
 * @param state Current market state
 * @param timeToExpiry Time to expiry in seconds
 * @returns ln(implied_rate) in WAD, always non-negative
 */
export function getLnImpliedRate(state: MarketState, timeToExpiry: bigint): bigint {
  const proportion = getProportion(state);

  // Clamp proportion to valid range
  const clampedProportion =
    proportion < MIN_PROPORTION
      ? MIN_PROPORTION
      : proportion > MAX_PROPORTION
        ? MAX_PROPORTION
        : proportion;

  // Calculate ln(proportion / (1 - proportion)) - the logit function
  const odds = wadDiv(clampedProportion, WAD_BIGINT - clampedProportion);
  const { value: lnOdds, isNegative } = lnWad(odds);

  const rateScalar = getRateScalar(state.scalarRoot, timeToExpiry);

  // ln_implied_rate = anchor - rate_scalar * ln_odds
  // If proportion > 0.5: ln_odds > 0, so we subtract
  // If proportion < 0.5: ln_odds < 0 (isNegative=true), so we add
  const scaledLnOdds = wadMul(rateScalar, lnOdds);

  if (isNegative) {
    // ln_odds is negative, so -rate_scalar * ln_odds = +scaled_ln_odds
    return state.initialAnchor + scaledLnOdds;
  } else if (scaledLnOdds >= state.initialAnchor) {
    // ln_odds is positive and large enough to drive rate negative - floor at 0
    return 0n;
  } else {
    // ln_odds is positive, so -rate_scalar * ln_odds = -scaled_ln_odds
    return state.initialAnchor - scaledLnOdds;
  }
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
 * Matches on-chain calc_swap_exact_sy_for_pt
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

  // Get current implied rate and PT price (spot price)
  const lnRateBefore = getLnImpliedRate(state, timeToExpiry);
  const spotPrice = getPtPrice(lnRateBefore, timeToExpiry);

  // Apply fee first (fee is taken from input)
  const fee = wadMul(exactSyIn, state.feeRate);
  const syInAfterFee = exactSyIn - fee;

  // Basic swap: pt_out = sy_in / pt_price (PT is cheaper than SY before expiry)
  const grossPtOut = wadDiv(syInAfterFee, spotPrice);

  // Apply price impact using constant product
  const newSyReserve = state.syReserve + syInAfterFee;
  const k = wadMul(state.ptReserve, state.syReserve);
  const newPtReserve = wadDiv(k, newSyReserve);

  const ptOutWithImpact = newPtReserve < state.ptReserve ? state.ptReserve - newPtReserve : 0n;

  // Use the minimum of gross and impact-adjusted
  const ptOut = grossPtOut < ptOutWithImpact ? grossPtOut : ptOutWithImpact;

  // Calculate new state for implied rate after swap
  const newState: MarketState = {
    ...state,
    syReserve: newSyReserve,
    ptReserve: state.ptReserve - ptOut,
  };
  const newLnImpliedRate = getLnImpliedRate(newState, timeToExpiry);

  // Calculate price impact as percentage
  const priceImpact = grossPtOut > 0n ? Number(grossPtOut - ptOut) / Number(grossPtOut) : 0;

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
 * Matches on-chain calc_swap_exact_pt_for_sy
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

  // Get current implied rate and PT price (spot price)
  const lnRateBefore = getLnImpliedRate(state, timeToExpiry);
  const spotPrice = getPtPrice(lnRateBefore, timeToExpiry);

  // Basic swap: sy_out = pt_in * pt_price (before fees and slippage)
  const grossSyOut = wadMul(exactPtIn, spotPrice);

  // Apply price impact using constant product
  const newPtReserve = state.ptReserve + exactPtIn;
  const k = wadMul(state.ptReserve, state.syReserve);
  const newSyReserve = wadDiv(k, newPtReserve);

  const syOutWithImpact = newSyReserve < state.syReserve ? state.syReserve - newSyReserve : 0n;

  // Use the minimum of gross and impact-adjusted
  const syOutBeforeFee = grossSyOut < syOutWithImpact ? grossSyOut : syOutWithImpact;

  // Calculate fee from output
  const fee = wadMul(syOutBeforeFee, state.feeRate);
  const syOut = syOutBeforeFee - fee;

  // Calculate new state for implied rate after swap
  const newState: MarketState = {
    ...state,
    syReserve: state.syReserve - syOutBeforeFee,
    ptReserve: newPtReserve,
  };
  const newLnImpliedRate = getLnImpliedRate(newState, timeToExpiry);

  // Calculate price impact as percentage
  const priceImpact =
    grossSyOut > 0n ? Number(grossSyOut - syOutBeforeFee) / Number(grossSyOut) : 0;

  // Effective price = PT spent / SY received (inverted from buy side)
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
 * Matches on-chain calc_swap_sy_for_exact_pt
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
  const lnRateBefore = getLnImpliedRate(state, timeToExpiry);
  const spotPrice = getPtPrice(lnRateBefore, timeToExpiry);

  // Calculate required SY using constant product
  const newPtReserve = state.ptReserve - exactPtOut;
  const k = wadMul(state.ptReserve, state.syReserve);
  const newSyReserve = wadDiv(k, newPtReserve);

  const syInBeforeFee = newSyReserve - state.syReserve;

  // Add fee (fee is on top of required amount)
  // sy_in = sy_in_before_fee / (1 - fee_rate)
  const syIn = wadDiv(syInBeforeFee, WAD_BIGINT - state.feeRate);
  const fee = syIn - syInBeforeFee;

  // Calculate new implied rate
  const newState: MarketState = {
    ...state,
    syReserve: newSyReserve,
    ptReserve: newPtReserve,
  };
  const newLnImpliedRate = getLnImpliedRate(newState, timeToExpiry);

  // Price impact: compare actual price to spot price
  const effectivePrice = wadDiv(syIn, exactPtOut);
  const priceImpact = spotPrice > 0n ? Number(effectivePrice - spotPrice) / Number(spotPrice) : 0;

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
 * Matches on-chain calc_swap_pt_for_exact_sy
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
  const lnRateBefore = getLnImpliedRate(state, timeToExpiry);
  const spotPrice = getPtPrice(lnRateBefore, timeToExpiry);

  // Add fee to output (pool needs to give out more before fee)
  const syOutBeforeFee = wadDiv(exactSyOut, WAD_BIGINT - state.feeRate);
  const fee = syOutBeforeFee - exactSyOut;

  // Calculate required PT using constant product
  const newSyReserve = state.syReserve - syOutBeforeFee;
  const k = wadMul(state.ptReserve, state.syReserve);
  const newPtReserve = wadDiv(k, newSyReserve);

  const ptIn = newPtReserve - state.ptReserve;

  // Calculate new implied rate
  const newState: MarketState = {
    ...state,
    syReserve: newSyReserve,
    ptReserve: newPtReserve,
  };
  const newLnImpliedRate = getLnImpliedRate(newState, timeToExpiry);

  // Effective price = PT spent / SY received
  const effectivePrice = wadDiv(ptIn, exactSyOut);
  const priceImpact = spotPrice > 0n ? Number(effectivePrice - spotPrice) / Number(spotPrice) : 0;

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
