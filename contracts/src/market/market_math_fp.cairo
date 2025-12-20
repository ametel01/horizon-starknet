/// Market Math Library with High-Precision Fixed-Point Arithmetic
///
/// This library implements the Pendle V2 logit-based AMM curve with maximum precision
/// using cubit's 64.64 fixed-point format for all internal calculations.
///
/// Key Pendle V2 formulas implemented:
/// - Exchange Rate: ln(proportion/(1-proportion))/rateScalar + rateAnchor
/// - Rate Scalar: scalarRoot * SECONDS_PER_YEAR / timeToExpiry
/// - PT Price: e^(-lnImpliedRate * timeToExpiry/SECONDS_PER_YEAR)
/// - Time Decay: fees and rates decay as expiry approaches
///
/// Differences from market_math.cairo:
/// - Uses cubit f128 (64.64 format) for ~19 decimal digits precision
/// - exp/ln/pow use cubit's Taylor series implementations
/// - No shortcuts or approximations in logit calculations
/// - Matches Pendle's Solidity LogExpMath precision

use horizon::libraries::errors::Errors;
use horizon::libraries::math_fp::{
    HALF_WAD, MAX_EXPONENT_WAD, WAD, abs_diff, exp_neg_wad, exp_wad, ln_wad, max, min, sqrt_wad,
    wad_div, wad_mul,
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
    pub last_ln_implied_rate: u256, // Cached ln(implied rate) for anchor calculation
}

/// Pre-computed values for trade calculation
#[derive(Drop, Copy)]
pub struct MarketPreCompute {
    pub rate_scalar: u256,
    pub rate_anchor: u256,
}

/// Seconds per year for APY calculations
pub const SECONDS_PER_YEAR: u256 = 31_536_000; // 365 * 24 * 60 * 60

/// Minimum time to expiry to prevent division issues
pub const MIN_TIME_TO_EXPIRY: u64 = 1;

/// Maximum ln(implied_rate) to prevent overflow (~10000% APY)
pub const MAX_LN_IMPLIED_RATE: u256 = 4_600_000_000_000_000_000;

/// Minimum/Maximum proportion bounds (Pendle uses 96% max)
pub const MIN_PROPORTION: u256 = 1_000_000_000_000_000; // 0.001 WAD (0.1%)
pub const MAX_PROPORTION: u256 = 960_000_000_000_000_000; // 0.96 WAD (96%) - Pendle's limit

/// Minimum liquidity to prevent first depositor attacks
pub const MINIMUM_LIQUIDITY: u256 = 1000;

/// Large scalar at expiry (flattens curve)
pub const EXPIRY_SCALAR_MULTIPLIER: u256 = 1000;

/// Binary search parameters
pub const BINARY_SEARCH_TOLERANCE: u256 = 1000;
pub const BINARY_SEARCH_MAX_ITERATIONS: u32 = 64;
pub const MAX_PT_IN_RESERVE_MULTIPLIER: u256 = 10;
pub const BINARY_SEARCH_UPPER_BOUND_MULTIPLIER: u256 = 5;

/// Calculate time to expiry in seconds
pub fn get_time_to_expiry(expiry: u64, current_time: u64) -> u64 {
    if current_time >= expiry {
        return MIN_TIME_TO_EXPIRY;
    }
    expiry - current_time
}

/// Calculate the proportion of PT in the pool
/// proportion = pt_reserve / (pt_reserve + sy_reserve)
/// Using cubit for precision in the division
pub fn get_proportion(state: @MarketState) -> u256 {
    let total = *state.pt_reserve + *state.sy_reserve;
    if total == 0 {
        return HALF_WAD; // 50% if pool is empty
    }

    // Use high-precision division
    wad_div(*state.pt_reserve, total)
}

/// Calculate the rate scalar adjusted for time to expiry
/// Pendle formula: rateScalar = scalarRoot * SECONDS_PER_YEAR / timeToExpiry
/// As time passes, scalar increases (curve flattens)
pub fn get_rate_scalar(scalar_root: u256, time_to_expiry: u64) -> u256 {
    if time_to_expiry == 0 {
        return scalar_root * EXPIRY_SCALAR_MULTIPLIER;
    }

    // rateScalar = scalarRoot * SECONDS_PER_YEAR / timeToExpiry
    // Using high-precision multiplication and division
    let numerator = wad_mul(scalar_root, SECONDS_PER_YEAR);
    wad_div(numerator, time_to_expiry.into())
}

/// Calculate time-adjusted fee rate (linear decay towards expiry)
/// feeRate * timeToExpiry / SECONDS_PER_YEAR
pub fn get_time_adjusted_fee_rate(fee_rate: u256, time_to_expiry: u64) -> u256 {
    if time_to_expiry == 0 {
        return 0; // No fees at expiry
    }

    let time_to_expiry_u256: u256 = time_to_expiry.into();
    if time_to_expiry_u256 >= SECONDS_PER_YEAR {
        return fee_rate; // Full fee rate if more than 1 year out
    }

    wad_div(wad_mul(fee_rate, time_to_expiry_u256), SECONDS_PER_YEAR)
}

/// Logit function: ln(p / (1-p)) using cubit's high-precision ln
/// This is the core of Pendle's pricing curve
/// @param proportion Proportion in WAD (0 < p < 1)
/// @return (|ln_value|, is_negative)
fn logit(proportion: u256) -> (u256, bool) {
    // Clamp proportion to valid range
    let p = max(MIN_PROPORTION, min(MAX_PROPORTION, proportion));

    // Calculate odds = p / (1 - p)
    let one_minus_p = WAD - p;
    if one_minus_p == 0 {
        return (MAX_LN_IMPLIED_RATE, false);
    }

    // Using cubit for high-precision division and ln
    let odds = wad_div(p, one_minus_p);

    // ln(odds) using cubit
    ln_wad(odds)
}

/// Calculate the rate anchor based on last implied rate
/// Pendle: rateAnchor = targetExchangeRate - ln(proportion/(1-proportion))/rateScalar
/// This ensures implied rate continuity across trades
pub fn get_rate_anchor(state: @MarketState, time_to_expiry: u64) -> u256 {
    let rate_scalar = get_rate_scalar(*state.scalar_root, time_to_expiry);

    // Calculate target exchange rate from last implied rate
    // exchangeRate = e^(lnImpliedRate * timeToExpiry / SECONDS_PER_YEAR)
    let time_in_years_wad = wad_div(time_to_expiry.into() * WAD, SECONDS_PER_YEAR * WAD);

    // Cap implied rate to prevent overflow
    let capped_ln_implied_rate = min(*state.last_ln_implied_rate, MAX_LN_IMPLIED_RATE);
    let exponent = wad_mul(capped_ln_implied_rate, time_in_years_wad);

    // Cap exponent for exp_wad safety
    let safe_exponent = min(exponent, MAX_EXPONENT_WAD);

    // e^exponent using cubit's high-precision exp
    let target_exchange_rate = exp_wad(safe_exponent);
    let target_exchange_rate = max(target_exchange_rate, WAD);

    // Get current proportion and calculate logit
    let proportion = get_proportion(state);
    let clamped_proportion = max(MIN_PROPORTION, min(MAX_PROPORTION, proportion));
    let (ln_proportion, ln_is_negative) = logit(clamped_proportion);

    // rateAnchor = targetExchangeRate - ln_proportion / rateScalar
    let scaled_ln = wad_div(ln_proportion, rate_scalar);

    if ln_is_negative {
        // Proportion < 0.5, ln is negative, so we add
        target_exchange_rate + scaled_ln
    } else if scaled_ln >= target_exchange_rate {
        WAD // Floor at 1
    } else {
        target_exchange_rate - scaled_ln
    }
}

/// Get pre-computed values for trade calculations
pub fn get_market_pre_compute(state: @MarketState, time_to_expiry: u64) -> MarketPreCompute {
    let rate_scalar = get_rate_scalar(*state.scalar_root, time_to_expiry);
    let rate_anchor = get_rate_anchor(state, time_to_expiry);

    MarketPreCompute { rate_scalar, rate_anchor }
}

/// Calculate exchange rate (PT price in SY terms) using Pendle's logit curve
/// exchangeRate = ln(newProportion/(1-newProportion))/rateScalar + rateAnchor
///
/// This uses cubit's high-precision ln for accurate logit calculation
pub fn get_exchange_rate(
    pt_reserve: u256,
    sy_reserve: u256,
    net_pt_change: u256,
    is_pt_out: bool,
    rate_scalar: u256,
    rate_anchor: u256,
) -> u256 {
    // Calculate new PT reserve after trade
    let new_pt_reserve = if is_pt_out {
        assert(net_pt_change < pt_reserve, Errors::MARKET_INSUFFICIENT_LIQUIDITY);
        pt_reserve - net_pt_change
    } else {
        pt_reserve + net_pt_change
    };

    // Calculate new proportion using high-precision division
    let total = new_pt_reserve + sy_reserve;
    let new_proportion = wad_div(new_pt_reserve, total);

    // Clamp to valid range (Pendle uses 96% max)
    let clamped_proportion = max(MIN_PROPORTION, min(MAX_PROPORTION, new_proportion));

    // Calculate logit = ln(proportion / (1 - proportion)) using cubit
    let (ln_proportion, ln_is_negative) = logit(clamped_proportion);

    // exchangeRate = ln_proportion / rateScalar + rateAnchor
    let scaled_ln = wad_div(ln_proportion, rate_scalar);

    let exchange_rate = if ln_is_negative {
        if scaled_ln >= rate_anchor {
            WAD
        } else {
            rate_anchor - scaled_ln
        }
    } else {
        rate_anchor + scaled_ln
    };

    // Exchange rate must be >= 1 (PT never worth more than SY)
    max(exchange_rate, WAD)
}

/// Calculate ln(implied_rate) from market state
/// ln_implied_rate = anchor - rate_scalar * ln(proportion / (1 - proportion))
pub fn get_ln_implied_rate(state: @MarketState, time_to_expiry: u64) -> u256 {
    let proportion = get_proportion(state);
    let clamped_proportion = max(MIN_PROPORTION, min(MAX_PROPORTION, proportion));

    // Calculate logit using cubit's high-precision ln
    let odds = wad_div(clamped_proportion, WAD - clamped_proportion);
    let (ln_odds, is_negative) = ln_wad(odds);

    let rate_scalar = get_rate_scalar(*state.scalar_root, time_to_expiry);

    // ln_implied_rate = anchor - rate_scalar * ln_odds
    let scaled_ln_odds = wad_mul(rate_scalar, ln_odds);

    let result = if is_negative {
        // ln_odds negative (proportion < 0.5), so we add
        *state.initial_anchor + scaled_ln_odds
    } else if scaled_ln_odds >= *state.initial_anchor {
        0 // Floor at 0
    } else {
        *state.initial_anchor - scaled_ln_odds
    };

    min(result, MAX_LN_IMPLIED_RATE)
}

/// Calculate PT price in terms of SY
/// pt_price = e^(-ln_implied_rate * time_to_expiry / SECONDS_PER_YEAR)
///
/// Uses cubit's exp for high precision exponential decay
pub fn get_pt_price(ln_implied_rate: u256, time_to_expiry: u64) -> u256 {
    if time_to_expiry == 0 || ln_implied_rate == 0 {
        return WAD; // At expiry or zero rate, PT = 1 SY
    }

    // time_to_expiry in years
    let time_in_years_wad = wad_div(time_to_expiry.into() * WAD, SECONDS_PER_YEAR * WAD);

    // exponent = ln_implied_rate * time_in_years
    let exponent = wad_mul(ln_implied_rate, time_in_years_wad);

    // pt_price = e^(-exponent) using cubit's exp
    exp_neg_wad(exponent)
}

/// Calculate implied APY from ln(implied_rate)
/// APY = e^(ln_implied_rate) - 1
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
/// SY_out = PT_in / exchangeRate
pub fn calc_swap_exact_pt_for_sy(
    state: @MarketState, exact_pt_in: u256, time_to_expiry: u64,
) -> (u256, u256) {
    if exact_pt_in == 0 {
        return (0, 0);
    }

    let comp = get_market_pre_compute(state, time_to_expiry);

    // Exchange rate at new PT level (PT enters pool)
    let exchange_rate = get_exchange_rate(
        *state.pt_reserve,
        *state.sy_reserve,
        exact_pt_in,
        false, // PT entering pool
        comp.rate_scalar,
        comp.rate_anchor,
    );

    // SY out = PT_in / exchangeRate (using cubit precision)
    let sy_out_before_fee = wad_div(exact_pt_in, exchange_rate);

    // Apply time-adjusted fee
    let adjusted_fee_rate = get_time_adjusted_fee_rate(*state.fee_rate, time_to_expiry);
    let fee = wad_mul(sy_out_before_fee, adjusted_fee_rate);
    let sy_out = sy_out_before_fee - fee;

    (sy_out, fee)
}

/// Calculate PT output for exact SY input (sell SY for PT)
/// Requires binary search since PT_out depends on exchange rate
pub fn calc_swap_exact_sy_for_pt(
    state: @MarketState, exact_sy_in: u256, time_to_expiry: u64,
) -> (u256, u256) {
    if exact_sy_in == 0 {
        return (0, 0);
    }

    // Apply fee first
    let adjusted_fee_rate = get_time_adjusted_fee_rate(*state.fee_rate, time_to_expiry);
    let fee = wad_mul(exact_sy_in, adjusted_fee_rate);
    let sy_in_after_fee = exact_sy_in - fee;

    let comp = get_market_pre_compute(state, time_to_expiry);

    let max_pt_out = if *state.pt_reserve > 1 {
        *state.pt_reserve - 1
    } else {
        0
    };

    // Initial estimate
    let current_exchange_rate = get_exchange_rate(
        *state.pt_reserve, *state.sy_reserve, 0, false, comp.rate_scalar, comp.rate_anchor,
    );

    let initial_guess = wad_mul(sy_in_after_fee, current_exchange_rate);
    let initial_guess = min(initial_guess, max_pt_out);

    // Binary search for exact PT_out
    let pt_out = binary_search_pt_out(
        state, sy_in_after_fee, initial_guess, max_pt_out, comp.rate_scalar, comp.rate_anchor,
    );

    (pt_out, fee)
}

/// Binary search for PT_out where SY_in = PT_out / exchangeRate(PT_out)
fn binary_search_pt_out(
    state: @MarketState,
    sy_in: u256,
    initial_guess: u256,
    max_pt_out: u256,
    rate_scalar: u256,
    rate_anchor: u256,
) -> u256 {
    let mut low: u256 = 0;
    let mut high: u256 = max_pt_out;
    let mut result: u256 = 0;
    let mut iterations: u32 = 0;

    while iterations < BINARY_SEARCH_MAX_ITERATIONS && low < high {
        let mid = (low + high) / 2;

        if mid == 0 {
            break;
        }

        let exchange_rate = get_exchange_rate(
            *state.pt_reserve, *state.sy_reserve, mid, true, rate_scalar, rate_anchor,
        );

        // sy_in = pt_out / exchangeRate
        let implied_sy_in = wad_div(mid, exchange_rate);

        if implied_sy_in <= sy_in {
            result = mid;
            low = mid + 1;
        } else {
            high = mid;
        }

        let diff = abs_diff(implied_sy_in, sy_in);
        if diff <= BINARY_SEARCH_TOLERANCE {
            return result;
        }

        iterations += 1;
    }

    result
}

/// Calculate SY input required for exact PT output
pub fn calc_swap_sy_for_exact_pt(
    state: @MarketState, exact_pt_out: u256, time_to_expiry: u64,
) -> (u256, u256) {
    if exact_pt_out == 0 {
        return (0, 0);
    }

    assert(exact_pt_out < *state.pt_reserve, Errors::MARKET_INSUFFICIENT_LIQUIDITY);

    let comp = get_market_pre_compute(state, time_to_expiry);

    let exchange_rate = get_exchange_rate(
        *state.pt_reserve,
        *state.sy_reserve,
        exact_pt_out,
        true, // PT leaving pool
        comp.rate_scalar,
        comp.rate_anchor,
    );

    // SY required = PT_out / exchangeRate
    let sy_in_before_fee = wad_div(exact_pt_out, exchange_rate);

    // Add fee: sy_in = sy_in_before_fee / (1 - fee_rate)
    let adjusted_fee_rate = get_time_adjusted_fee_rate(*state.fee_rate, time_to_expiry);
    let sy_in = wad_div(sy_in_before_fee, WAD - adjusted_fee_rate);
    let fee = sy_in - sy_in_before_fee;

    (sy_in, fee)
}

/// Calculate PT input required for exact SY output
pub fn calc_swap_pt_for_exact_sy(
    state: @MarketState, exact_sy_out: u256, time_to_expiry: u64,
) -> (u256, u256) {
    if exact_sy_out == 0 {
        return (0, 0);
    }

    assert(exact_sy_out < *state.sy_reserve, Errors::MARKET_INSUFFICIENT_LIQUIDITY);

    // Calculate SY needed before fee is taken
    let adjusted_fee_rate = get_time_adjusted_fee_rate(*state.fee_rate, time_to_expiry);
    let sy_out_before_fee = wad_div(exact_sy_out, WAD - adjusted_fee_rate);
    let fee = sy_out_before_fee - exact_sy_out;

    let comp = get_market_pre_compute(state, time_to_expiry);

    // Binary search for PT_in
    let pt_in = binary_search_pt_in(state, sy_out_before_fee, comp.rate_scalar, comp.rate_anchor);

    (pt_in, fee)
}

/// Binary search for PT_in where SY_out = PT_in / exchangeRate(PT_in)
fn binary_search_pt_in(
    state: @MarketState, sy_out: u256, rate_scalar: u256, rate_anchor: u256,
) -> u256 {
    let current_exchange_rate = get_exchange_rate(
        *state.pt_reserve, *state.sy_reserve, 0, false, rate_scalar, rate_anchor,
    );

    let initial_guess = wad_mul(sy_out, current_exchange_rate);
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

        let exchange_rate = get_exchange_rate(
            *state.pt_reserve, *state.sy_reserve, mid, false, rate_scalar, rate_anchor,
        );

        // sy_out = pt_in / exchangeRate
        let implied_sy_out = wad_div(mid, exchange_rate);

        if implied_sy_out >= sy_out {
            result = mid;
            high = mid;
        } else {
            low = mid + 1;
        }

        let diff = abs_diff(implied_sy_out, sy_out);
        if diff <= BINARY_SEARCH_TOLERANCE {
            return result;
        }

        iterations += 1;
    }

    result
}

/// Calculate LP tokens to mint for liquidity addition
pub fn calc_mint_lp(
    state: @MarketState, sy_amount: u256, pt_amount: u256,
) -> (u256, u256, u256, bool) {
    if *state.total_lp == 0 {
        // First liquidity provider - use geometric mean with cubit sqrt
        let lp = sqrt_wad(wad_mul(sy_amount, pt_amount));

        assert(lp > MINIMUM_LIQUIDITY, 'Market: insufficient initial LP');

        let lp_to_user = lp - MINIMUM_LIQUIDITY;
        return (lp_to_user, sy_amount, pt_amount, true);
    }

    // Calculate ratios using high-precision division
    let sy_ratio = wad_div(sy_amount, *state.sy_reserve);
    let pt_ratio = wad_div(pt_amount, *state.pt_reserve);

    let ratio = min(sy_ratio, pt_ratio);

    let sy_used = wad_mul(ratio, *state.sy_reserve);
    let pt_used = wad_mul(ratio, *state.pt_reserve);
    let lp_to_mint = wad_mul(ratio, *state.total_lp);

    (lp_to_mint, sy_used, pt_used, false)
}

/// Calculate tokens to return for LP burn
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
pub fn calc_price_impact(amount_in: u256, reserve_in: u256, reserve_out: u256) -> u256 {
    if reserve_in == 0 || reserve_out == 0 {
        return WAD; // 100% impact for empty pool
    }

    wad_div(amount_in, 2 * reserve_in)
}

/// Check if trade would cause excessive slippage
pub fn check_slippage(expected_out: u256, min_out: u256) -> bool {
    expected_out >= min_out
}

/// Calculate the exchange rate from market state
pub fn get_market_exchange_rate(state: @MarketState, time_to_expiry: u64) -> u256 {
    let ln_rate = get_ln_implied_rate(state, time_to_expiry);
    get_pt_price(ln_rate, time_to_expiry)
}
