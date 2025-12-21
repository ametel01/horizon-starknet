/// Market Math Library
/// Implements the Pendle-style logit-based AMM curve mathematics for PT/SY trading.
///
/// Key concepts from Pendle V2:
/// - Uses logit function: exchangeRate = ln(p/(1-p))/rateScalar + rateAnchor
/// - PT price naturally converges to 1 SY as expiry approaches
/// - Rate scalar increases as expiry approaches, flattening the curve
/// - Anchor is recalculated after each trade to maintain implied rate continuity
///
/// Reference: https://github.com/pendle-finance/pendle-core-v2-public

use horizon::libraries::errors::Errors;
use horizon::libraries::math::{
    HALF_WAD, WAD, exp_neg_wad, exp_wad, ln_wad, max, min, wad_div, wad_mul,
};

/// Market state containing reserves and parameters
#[derive(Drop, Copy, Serde)]
pub struct MarketState {
    pub sy_reserve: u256,
    pub pt_reserve: u256,
    pub total_lp: u256,
    pub scalar_root: u256, // Controls rate sensitivity (in WAD)
    pub initial_anchor: u256, // Initial anchor for exchange rate (in WAD)
    pub fee_rate: u256, // Fee rate in WAD (e.g., 0.01 WAD = 1%)
    pub expiry: u64,
    pub last_ln_implied_rate: u256 // Cached ln(implied rate) for anchor calculation
}

/// Pre-computed values for trade calculation (avoids redundant computation)
#[derive(Drop, Copy)]
pub struct MarketPreCompute {
    pub rate_scalar: u256,
    pub rate_anchor: u256,
}

/// Seconds per year for APY calculations
pub const SECONDS_PER_YEAR: u256 = 31_536_000; // 365 * 24 * 60 * 60

/// Minimum time to expiry to prevent division issues (1 second)
pub const MIN_TIME_TO_EXPIRY: u64 = 1;

/// Maximum ln(implied_rate) to prevent overflow (corresponds to ~10000% APY)
pub const MAX_LN_IMPLIED_RATE: u256 = 4_600_000_000_000_000_000; // ~4.6 WAD

/// Minimum proportion of assets (prevents extreme imbalance)
pub const MIN_PROPORTION: u256 = 1_000_000_000_000_000; // 0.001 WAD (0.1%)
pub const MAX_PROPORTION: u256 = 999_000_000_000_000_000; // 0.999 WAD (99.9%)

/// Minimum liquidity permanently locked on first deposit (prevents first depositor attacks)
/// This amount is minted to the zero address and can never be redeemed
pub const MINIMUM_LIQUIDITY: u256 = 1000;

/// Maximum safe exponent for exp_wad (e^135 is roughly max for u256 before overflow)
pub const MAX_EXPONENT_WAD: u256 = 135_000_000_000_000_000_000; // 135 WAD

/// Large scalar multiplier at expiry (flattens the curve when time_to_expiry = 0)
pub const EXPIRY_SCALAR_MULTIPLIER: u256 = 1000;

/// Binary search tolerance in wei (acceptable precision for swap calculations)
pub const BINARY_SEARCH_TOLERANCE: u256 = 1000;

/// Maximum iterations for binary search (2^64 provides sufficient precision)
pub const BINARY_SEARCH_MAX_ITERATIONS: u32 = 64;

/// Maximum PT input multiplier relative to reserve (prevents unreasonable inputs)
pub const MAX_PT_IN_RESERVE_MULTIPLIER: u256 = 10;

/// Upper bound multiplier for initial guess in binary search
pub const BINARY_SEARCH_UPPER_BOUND_MULTIPLIER: u256 = 5;

/// Calculate time to expiry in seconds
/// @param expiry The expiry timestamp
/// @param current_time Current block timestamp
/// @return Time to expiry in seconds (minimum MIN_TIME_TO_EXPIRY)
pub fn get_time_to_expiry(expiry: u64, current_time: u64) -> u64 {
    if current_time >= expiry {
        return MIN_TIME_TO_EXPIRY;
    }
    expiry - current_time
}

/// Calculate the proportion of PT in the pool
/// proportion = pt_reserve / (pt_reserve + sy_reserve)
/// @param state Current market state
/// @return Proportion in WAD format
pub fn get_proportion(state: @MarketState) -> u256 {
    let total = *state.pt_reserve + *state.sy_reserve;
    if total == 0 {
        return HALF_WAD; // 50% if pool is empty
    }
    wad_div(*state.pt_reserve, total)
}

/// Calculate the rate scalar adjusted for time to expiry
/// As time passes, the scalar increases, making the curve flatter.
/// Pendle formula: rateScalar = scalarRoot * IMPLIED_RATE_TIME / timeToExpiry
/// @param scalar_root Base scalar value in WAD
/// @param time_to_expiry Time to expiry in seconds
/// @return Adjusted rate scalar in WAD
pub fn get_rate_scalar(scalar_root: u256, time_to_expiry: u64) -> u256 {
    if time_to_expiry == 0 {
        // Very large scalar at expiry (flattens curve)
        return scalar_root * EXPIRY_SCALAR_MULTIPLIER;
    }
    // rateScalar = scalarRoot * SECONDS_PER_YEAR / timeToExpiry
    wad_div(wad_mul(scalar_root, SECONDS_PER_YEAR), time_to_expiry.into())
}

/// Calculate the time-adjusted fee rate (fee decay towards expiry)
/// Fees decrease linearly as expiry approaches:
/// timeAdjustedFeeRate = feeRate * timeToExpiry / SECONDS_PER_YEAR
///
/// This ensures:
/// - At expiry (t=0): fee = 0 (no fees at maturity)
/// - At 1 year out: fee = feeRate (full fee)
/// - At 6 months out: fee = feeRate / 2 (half fee)
///
/// @param fee_rate Base fee rate in WAD (e.g., 0.01 WAD = 1%)
/// @param time_to_expiry Time to expiry in seconds
/// @return Time-adjusted fee rate in WAD
pub fn get_time_adjusted_fee_rate(fee_rate: u256, time_to_expiry: u64) -> u256 {
    if time_to_expiry == 0 {
        return 0; // No fees at expiry
    }

    // Linear decay: feeRate * timeToExpiry / SECONDS_PER_YEAR
    // Cap at 1 year to avoid fees higher than base rate
    let time_to_expiry_u256: u256 = time_to_expiry.into();
    if time_to_expiry_u256 >= SECONDS_PER_YEAR {
        return fee_rate; // Full fee rate if more than 1 year out
    }

    wad_div(wad_mul(fee_rate, time_to_expiry_u256), SECONDS_PER_YEAR)
}

/// Calculate the rate anchor based on the last implied rate
/// Pendle formula: rateAnchor = newExchangeRate - ln(proportion / (1-proportion)) / rateScalar
/// This ensures continuity of the implied rate across trades
/// @param state Current market state
/// @param time_to_expiry Time to expiry in seconds
/// @return Adjusted anchor in WAD
pub fn get_rate_anchor(state: @MarketState, time_to_expiry: u64) -> u256 {
    let rate_scalar = get_rate_scalar(*state.scalar_root, time_to_expiry);

    // Get the target exchange rate from the last implied rate
    // exchangeRate = e^(lnImpliedRate * timeToExpiry / SECONDS_PER_YEAR)
    let time_in_years = wad_div(time_to_expiry.into() * WAD, SECONDS_PER_YEAR * WAD);

    // Cap implied rate to prevent overflow
    let capped_ln_implied_rate = min(*state.last_ln_implied_rate, MAX_LN_IMPLIED_RATE);
    let exponent = wad_mul(capped_ln_implied_rate, time_in_years);

    // Cap exponent to prevent exp_wad overflow
    let safe_exponent = min(exponent, MAX_EXPONENT_WAD);
    let target_exchange_rate = exp_wad(safe_exponent);

    // Ensure exchange rate is at least 1 (PT never worth more than SY)
    let target_exchange_rate = max(target_exchange_rate, WAD);

    // Get current proportion
    let proportion = get_proportion(state);
    let clamped_proportion = max(MIN_PROPORTION, min(MAX_PROPORTION, proportion));

    // Calculate logit = ln(proportion / (1 - proportion))
    let (ln_proportion, ln_is_negative) = logit(clamped_proportion);

    // rateAnchor = targetExchangeRate - ln_proportion / rateScalar
    let scaled_ln = wad_div(ln_proportion, rate_scalar);

    if ln_is_negative {
        // ln_proportion is negative (proportion < 0.5), so we add
        target_exchange_rate + scaled_ln
    } else if scaled_ln >= target_exchange_rate {
        // ln_proportion is positive and would drive rate below 1
        WAD // Floor at 1 to prevent negative exchange rates
    } else {
        // ln_proportion is positive (proportion > 0.5), so we subtract
        target_exchange_rate - scaled_ln
    }
}

/// Logit function: ln(p / (1-p))
/// Returns (|value|, is_negative)
/// @param proportion Proportion in WAD (0 < p < 1)
/// @return (ln_value, is_negative) where result = is_negative ? -ln_value : ln_value
fn logit(proportion: u256) -> (u256, bool) {
    // Calculate odds = p / (1 - p)
    let one_minus_p = WAD - proportion;
    if one_minus_p == 0 {
        // Proportion is 1, odds is infinite - should be caught by MAX_PROPORTION
        return (MAX_LN_IMPLIED_RATE, false);
    }
    let odds = wad_div(proportion, one_minus_p);

    // ln(odds)
    ln_wad(odds)
}

/// Get pre-computed values for trade calculations
/// @param state Current market state
/// @param time_to_expiry Time to expiry in seconds
/// @return MarketPreCompute struct with rate_scalar and rate_anchor
pub fn get_market_pre_compute(state: @MarketState, time_to_expiry: u64) -> MarketPreCompute {
    let rate_scalar = get_rate_scalar(*state.scalar_root, time_to_expiry);
    let rate_anchor = get_rate_anchor(state, time_to_expiry);

    MarketPreCompute { rate_scalar, rate_anchor }
}

/// Calculate the exchange rate (PT price in SY terms) using the logit curve
/// Pendle formula: exchangeRate = ln(newProportion / (1-newProportion)) / rateScalar + rateAnchor
/// @param pt_reserve Current PT reserve
/// @param sy_reserve Current SY reserve
/// @param net_pt_change Amount of PT being added (negative) or removed (positive) from pool
/// @param rate_scalar Time-adjusted rate scalar
/// @param rate_anchor Rate anchor for this trade
/// @return Exchange rate in WAD (always >= 1)
pub fn get_exchange_rate(
    pt_reserve: u256,
    sy_reserve: u256,
    net_pt_change: u256, // PT being removed from pool (user buying) - positive value
    is_pt_out: bool, // true if PT is going OUT of pool (user buying PT)
    rate_scalar: u256,
    rate_anchor: u256,
) -> u256 {
    // Calculate new PT reserve after trade
    let new_pt_reserve = if is_pt_out {
        // User buying PT (PT leaves pool)
        assert(net_pt_change < pt_reserve, Errors::MARKET_INSUFFICIENT_LIQUIDITY);
        pt_reserve - net_pt_change
    } else {
        // User selling PT (PT enters pool)
        pt_reserve + net_pt_change
    };

    // Calculate new proportion
    let total = new_pt_reserve + sy_reserve;
    let new_proportion = wad_div(new_pt_reserve, total);

    // Check bounds
    let clamped_proportion = max(MIN_PROPORTION, min(MAX_PROPORTION, new_proportion));

    // Calculate logit = ln(proportion / (1 - proportion))
    let (ln_proportion, ln_is_negative) = logit(clamped_proportion);

    // exchangeRate = ln_proportion / rateScalar + rateAnchor
    let scaled_ln = wad_div(ln_proportion, rate_scalar);

    let exchange_rate = if ln_is_negative {
        // ln_proportion is negative, so ln_proportion/rateScalar is negative
        if scaled_ln >= rate_anchor {
            WAD // Floor at 1
        } else {
            rate_anchor - scaled_ln
        }
    } else {
        // ln_proportion is positive
        rate_anchor + scaled_ln
    };

    // Exchange rate must be at least 1 (PT never worth more than SY)
    max(exchange_rate, WAD)
}

/// Calculate ln(implied_rate) from market state
/// ln_implied_rate = rate_anchor - rate_scalar * ln(proportion / (1 - proportion))
/// @param state Current market state
/// @param time_to_expiry Time to expiry in seconds
/// @return ln(implied_rate) in WAD, always non-negative
pub fn get_ln_implied_rate(state: @MarketState, time_to_expiry: u64) -> u256 {
    let proportion = get_proportion(state);

    // Clamp proportion to valid range
    let clamped_proportion = max(MIN_PROPORTION, min(MAX_PROPORTION, proportion));

    // Calculate ln(proportion / (1 - proportion))
    // This is the logit function
    let odds = wad_div(clamped_proportion, WAD - clamped_proportion);
    let (ln_odds, is_negative) = ln_wad(odds);

    let rate_scalar = get_rate_scalar(*state.scalar_root, time_to_expiry);

    // ln_implied_rate = anchor - rate_scalar * ln_odds
    // If proportion > 0.5: ln_odds > 0, so we subtract
    // If proportion < 0.5: ln_odds < 0 (is_negative=true), so we add
    let scaled_ln_odds = wad_mul(rate_scalar, ln_odds);

    let result = if is_negative {
        // ln_odds is negative, so -rate_scalar * ln_odds = +scaled_ln_odds
        *state.initial_anchor + scaled_ln_odds
    } else if scaled_ln_odds >= *state.initial_anchor {
        // ln_odds is positive and large enough to drive rate negative - floor at 0
        0
    } else {
        // ln_odds is positive, so -rate_scalar * ln_odds = -scaled_ln_odds
        *state.initial_anchor - scaled_ln_odds
    };

    // Cap at MAX_LN_IMPLIED_RATE to prevent overflow in exp_wad
    min(result, MAX_LN_IMPLIED_RATE)
}

/// Calculate PT price in terms of SY (how much SY per PT)
/// pt_price = e^(-ln_implied_rate * time_to_expiry)
/// @param ln_implied_rate The ln of implied rate in WAD
/// @param time_to_expiry Time to expiry in seconds
/// @return PT price in WAD (always <= 1)
pub fn get_pt_price(ln_implied_rate: u256, time_to_expiry: u64) -> u256 {
    if time_to_expiry == 0 || ln_implied_rate == 0 {
        return WAD; // At expiry or zero rate, PT = 1 SY
    }

    // time_to_expiry in years
    let time_in_years = wad_div(time_to_expiry.into() * WAD, SECONDS_PER_YEAR * WAD);

    // exponent = ln_implied_rate * time_in_years
    let exponent = wad_mul(ln_implied_rate, time_in_years);

    // pt_price = e^(-exponent)
    exp_neg_wad(exponent)
}

/// Calculate the implied APY from ln(implied_rate)
/// APY = e^(ln_implied_rate) - 1
/// @param ln_implied_rate The ln of implied rate in WAD
/// @return APY in WAD (e.g., 0.05 WAD = 5% APY)
pub fn get_implied_apy(ln_implied_rate: u256) -> u256 {
    if ln_implied_rate == 0 {
        return 0;
    }

    let exp_rate = exp_wad(ln_implied_rate);
    if exp_rate <= WAD {
        return 0;
    }

    exp_rate - WAD
}

/// Calculate SY output for exact PT input (sell PT for SY)
/// Uses the Pendle logit-based AMM curve to determine output amount
/// Formula: SY_out = PT_in / exchangeRate (where exchangeRate >= 1)
/// @param state Current market state
/// @param exact_pt_in Amount of PT to sell
/// @param time_to_expiry Time to expiry in seconds
/// @return (sy_out, fee_amount)
pub fn calc_swap_exact_pt_for_sy(
    state: @MarketState, exact_pt_in: u256, time_to_expiry: u64,
) -> (u256, u256) {
    if exact_pt_in == 0 {
        return (0, 0);
    }

    // Get pre-computed values (rate_scalar, rate_anchor)
    let comp = get_market_pre_compute(state, time_to_expiry);

    // Calculate exchange rate at the new PT level (PT enters pool, so is_pt_out = false)
    let exchange_rate = get_exchange_rate(
        *state.pt_reserve,
        *state.sy_reserve,
        exact_pt_in,
        false, // PT entering pool
        comp.rate_scalar,
        comp.rate_anchor,
    );

    // SY out (before fee) = PT_in / exchangeRate
    // Since exchangeRate >= 1, SY_out <= PT_in
    let sy_out_before_fee = wad_div(exact_pt_in, exchange_rate);

    // Apply time-adjusted fee (fee decays towards expiry)
    let adjusted_fee_rate = get_time_adjusted_fee_rate(*state.fee_rate, time_to_expiry);
    let fee = wad_mul(sy_out_before_fee, adjusted_fee_rate);
    let sy_out = sy_out_before_fee - fee;

    (sy_out, fee)
}

/// Calculate PT output for exact SY input (sell SY for PT)
/// Uses the Pendle logit-based AMM curve to determine output amount
/// This requires iterative solving since PT_out depends on exchangeRate which depends on PT_out
/// We use binary search to find the correct PT_out
/// @param state Current market state
/// @param exact_sy_in Amount of SY to sell
/// @param time_to_expiry Time to expiry in seconds
/// @return (pt_out, fee_amount)
pub fn calc_swap_exact_sy_for_pt(
    state: @MarketState, exact_sy_in: u256, time_to_expiry: u64,
) -> (u256, u256) {
    if exact_sy_in == 0 {
        return (0, 0);
    }

    // Apply time-adjusted fee first (fee decays towards expiry)
    let adjusted_fee_rate = get_time_adjusted_fee_rate(*state.fee_rate, time_to_expiry);
    let fee = wad_mul(exact_sy_in, adjusted_fee_rate);
    let sy_in_after_fee = exact_sy_in - fee;

    // Get pre-computed values
    let comp = get_market_pre_compute(state, time_to_expiry);

    // Binary search for PT out
    // Lower bound: 0
    // Upper bound: PT reserve - 1 (can't drain the pool)
    let max_pt_out = if *state.pt_reserve > 1 {
        *state.pt_reserve - 1
    } else {
        0
    };

    // Start with an estimate based on exchange rate at current state
    let current_exchange_rate = get_exchange_rate(
        *state.pt_reserve, *state.sy_reserve, 0, false, comp.rate_scalar, comp.rate_anchor,
    );

    // Initial guess: PT_out = SY_in * exchangeRate
    let initial_guess = wad_mul(sy_in_after_fee, current_exchange_rate);
    let initial_guess = min(initial_guess, max_pt_out);

    // Binary search to find exact PT_out
    let pt_out = binary_search_pt_out(
        state, sy_in_after_fee, initial_guess, max_pt_out, comp.rate_scalar, comp.rate_anchor,
    );

    (pt_out, fee)
}

/// Binary search to find PT_out such that SY_in = PT_out / exchangeRate(PT_out)
fn binary_search_pt_out(
    state: @MarketState,
    sy_in: u256,
    initial_guess: u256,
    max_pt_out: u256,
    rate_scalar: u256,
    rate_anchor: u256,
) -> u256 {
    // For precision, we need sy_in = pt_out / exchangeRate
    // Rearranging: pt_out * WAD / exchangeRate = sy_in * WAD

    let mut low: u256 = 0;
    let mut high: u256 = max_pt_out;
    let mut result: u256 = 0;

    let mut iterations: u32 = 0;

    while iterations < BINARY_SEARCH_MAX_ITERATIONS && low < high {
        let mid = (low + high) / 2;

        if mid == 0 {
            break;
        }

        // Calculate exchange rate at this PT_out level
        let exchange_rate = get_exchange_rate(
            *state.pt_reserve,
            *state.sy_reserve,
            mid,
            true, // PT leaving pool
            rate_scalar,
            rate_anchor,
        );

        // Calculate implied SY_in for this PT_out
        // sy_in = pt_out / exchangeRate
        let implied_sy_in = wad_div(mid, exchange_rate);

        if implied_sy_in <= sy_in {
            // We can afford this much PT, try higher
            result = mid;
            low = mid + 1;
        } else {
            // Too expensive, try lower
            high = mid;
        }

        // Check if we're within tolerance
        let diff = if implied_sy_in > sy_in {
            implied_sy_in - sy_in
        } else {
            sy_in - implied_sy_in
        };

        if diff <= BINARY_SEARCH_TOLERANCE {
            return result;
        }

        iterations += 1;
    }

    result
}

/// Calculate SY input required for exact PT output (buy PT with SY)
/// Uses the Pendle logit-based AMM curve
/// SY_in = PT_out / exchangeRate (then add fee)
/// @param state Current market state
/// @param exact_pt_out Amount of PT to buy
/// @param time_to_expiry Time to expiry in seconds
/// @return (sy_in, fee_amount)
pub fn calc_swap_sy_for_exact_pt(
    state: @MarketState, exact_pt_out: u256, time_to_expiry: u64,
) -> (u256, u256) {
    if exact_pt_out == 0 {
        return (0, 0);
    }

    assert(exact_pt_out < *state.pt_reserve, Errors::MARKET_INSUFFICIENT_LIQUIDITY);

    // Get pre-computed values
    let comp = get_market_pre_compute(state, time_to_expiry);

    // Calculate exchange rate at the new PT level (PT leaves pool)
    let exchange_rate = get_exchange_rate(
        *state.pt_reserve,
        *state.sy_reserve,
        exact_pt_out,
        true, // PT leaving pool
        comp.rate_scalar,
        comp.rate_anchor,
    );

    // SY required (before fee) = PT_out / exchangeRate
    let sy_in_before_fee = wad_div(exact_pt_out, exchange_rate);

    // Add time-adjusted fee (fee decays towards expiry)
    // sy_in_after_fee = sy_in_before_fee, so sy_in = sy_in_before_fee / (1 - adjusted_fee_rate)
    let adjusted_fee_rate = get_time_adjusted_fee_rate(*state.fee_rate, time_to_expiry);
    let sy_in = wad_div(sy_in_before_fee, WAD - adjusted_fee_rate);
    let fee = sy_in - sy_in_before_fee;

    (sy_in, fee)
}

/// Calculate PT input required for exact SY output (buy SY with PT)
/// Uses the Pendle logit-based AMM curve
/// This requires binary search since PT_in depends on exchangeRate which depends on PT_in
/// @param state Current market state
/// @param exact_sy_out Amount of SY to buy
/// @param time_to_expiry Time to expiry in seconds
/// @return (pt_in, fee_amount)
pub fn calc_swap_pt_for_exact_sy(
    state: @MarketState, exact_sy_out: u256, time_to_expiry: u64,
) -> (u256, u256) {
    if exact_sy_out == 0 {
        return (0, 0);
    }

    assert(exact_sy_out < *state.sy_reserve, Errors::MARKET_INSUFFICIENT_LIQUIDITY);

    // Add time-adjusted fee to output (fee decays towards expiry)
    // If user wants exact_sy_out, pool needs to give out more before fee
    let adjusted_fee_rate = get_time_adjusted_fee_rate(*state.fee_rate, time_to_expiry);
    let sy_out_before_fee = wad_div(exact_sy_out, WAD - adjusted_fee_rate);
    let fee = sy_out_before_fee - exact_sy_out;

    // Get pre-computed values
    let comp = get_market_pre_compute(state, time_to_expiry);

    // Binary search for PT in
    // PT_in = SY_out * exchangeRate
    // But exchangeRate depends on new PT level, so we need to search
    let pt_in = binary_search_pt_in(state, sy_out_before_fee, comp.rate_scalar, comp.rate_anchor);

    (pt_in, fee)
}

/// Binary search to find PT_in such that SY_out = PT_in / exchangeRate(PT_in)
fn binary_search_pt_in(
    state: @MarketState, sy_out: u256, rate_scalar: u256, rate_anchor: u256,
) -> u256 {
    // We need to find PT_in such that:
    // sy_out = pt_in / exchangeRate(new_pt_reserve)
    // where new_pt_reserve = pt_reserve + pt_in

    // Get current exchange rate for initial estimate
    let current_exchange_rate = get_exchange_rate(
        *state.pt_reserve, *state.sy_reserve, 0, false, rate_scalar, rate_anchor,
    );

    // Initial guess: PT_in = SY_out * exchangeRate
    let initial_guess = wad_mul(sy_out, current_exchange_rate);

    // Upper bound: use a safe multiple of the initial guess
    // Avoid overflow by checking before multiplication
    let max_reasonable = *state.pt_reserve * MAX_PT_IN_RESERVE_MULTIPLIER;
    let max_pt_in = if initial_guess > max_reasonable / BINARY_SEARCH_UPPER_BOUND_MULTIPLIER {
        max_reasonable
    } else {
        min(initial_guess * BINARY_SEARCH_UPPER_BOUND_MULTIPLIER + WAD, max_reasonable)
    };

    let mut low: u256 = 1;
    let mut high: u256 = max_pt_in;
    let mut result: u256 = min(initial_guess, max_pt_in);

    let mut iterations: u32 = 0;

    while iterations < BINARY_SEARCH_MAX_ITERATIONS && low < high {
        let mid = (low + high) / 2;

        if mid == 0 {
            break;
        }

        // Calculate exchange rate at this PT_in level
        let exchange_rate = get_exchange_rate(
            *state.pt_reserve,
            *state.sy_reserve,
            mid,
            false, // PT entering pool
            rate_scalar,
            rate_anchor,
        );

        // Calculate implied SY_out for this PT_in
        // sy_out = pt_in / exchangeRate
        let implied_sy_out = wad_div(mid, exchange_rate);

        if implied_sy_out >= sy_out {
            // This PT_in gives enough SY, try lower
            result = mid;
            high = mid;
        } else {
            // Not enough SY, need more PT
            low = mid + 1;
        }

        // Check if we're within tolerance
        let diff = if implied_sy_out > sy_out {
            implied_sy_out - sy_out
        } else {
            sy_out - implied_sy_out
        };

        if diff <= BINARY_SEARCH_TOLERANCE {
            return result;
        }

        iterations += 1;
    }

    result
}

/// Calculate LP tokens to mint for given liquidity addition
/// @param state Current market state
/// @param sy_amount Amount of SY to add
/// @param pt_amount Amount of PT to add
/// @return (lp_to_mint, sy_used, pt_used, is_first_mint)
/// Note: For first mint, MINIMUM_LIQUIDITY is subtracted from lp_to_mint
/// and must be minted to zero address by the caller
pub fn calc_mint_lp(
    state: @MarketState, sy_amount: u256, pt_amount: u256,
) -> (u256, u256, u256, bool) {
    if *state.total_lp == 0 {
        // First liquidity provider - use geometric mean
        let lp = sqrt_u256(wad_mul(sy_amount, pt_amount));

        // Require minimum liquidity to prevent first depositor attacks
        // MINIMUM_LIQUIDITY is permanently locked (minted to zero address by AMM)
        assert(lp > MINIMUM_LIQUIDITY, 'Market: insufficient initial LP');

        // Subtract MINIMUM_LIQUIDITY from what the user receives
        let lp_to_user = lp - MINIMUM_LIQUIDITY;

        return (lp_to_user, sy_amount, pt_amount, true);
    }

    // Calculate the amount of each token to use based on current ratio
    let sy_ratio = wad_div(sy_amount, *state.sy_reserve);
    let pt_ratio = wad_div(pt_amount, *state.pt_reserve);

    // Use the smaller ratio to maintain pool balance
    let ratio = min(sy_ratio, pt_ratio);

    let sy_used = wad_mul(ratio, *state.sy_reserve);
    let pt_used = wad_mul(ratio, *state.pt_reserve);
    let lp_to_mint = wad_mul(ratio, *state.total_lp);

    (lp_to_mint, sy_used, pt_used, false)
}

/// Calculate tokens to return for LP burn
/// @param state Current market state
/// @param lp_to_burn Amount of LP to burn
/// @return (sy_out, pt_out)
pub fn calc_burn_lp(state: @MarketState, lp_to_burn: u256) -> (u256, u256) {
    if *state.total_lp == 0 || lp_to_burn == 0 {
        return (0, 0);
    }

    let ratio = wad_div(lp_to_burn, *state.total_lp);
    let sy_out = wad_mul(ratio, *state.sy_reserve);
    let pt_out = wad_mul(ratio, *state.pt_reserve);

    (sy_out, pt_out)
}

/// Calculate price impact of a trade
/// @param amount_in Input amount
/// @param reserve_in Reserve of input token
/// @param reserve_out Reserve of output token
/// @return Price impact in WAD (0.01 WAD = 1% impact)
pub fn calc_price_impact(amount_in: u256, reserve_in: u256, reserve_out: u256) -> u256 {
    if reserve_in == 0 || reserve_out == 0 {
        return WAD; // 100% impact for empty pool
    }

    // Impact ≈ amount_in / (2 * reserve_in) for small trades
    // This is a simplified approximation
    wad_div(amount_in, 2 * reserve_in)
}

/// Integer square root (Babylonian method)
fn sqrt_u256(x: u256) -> u256 {
    if x == 0 {
        return 0;
    }
    if x <= 3 {
        return 1;
    }

    let mut z = x;
    let mut y = (x + 1) / 2;

    while y < z {
        z = y;
        y = (x / y + y) / 2;
    }

    z
}

/// Check if trade would cause excessive slippage
/// @param expected_out Expected output amount
/// @param min_out Minimum acceptable output
/// @return true if slippage is acceptable
pub fn check_slippage(expected_out: u256, min_out: u256) -> bool {
    expected_out >= min_out
}

/// Calculate the exchange rate from market state
/// This is the instantaneous rate of PT to SY
/// @param state Current market state
/// @param time_to_expiry Time to expiry in seconds
/// @return Exchange rate in WAD
pub fn get_market_exchange_rate(state: @MarketState, time_to_expiry: u64) -> u256 {
    let ln_rate = get_ln_implied_rate(state, time_to_expiry);
    get_pt_price(ln_rate, time_to_expiry)
}
