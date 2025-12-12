/// Market Math Library
/// Implements the time-aware AMM curve mathematics for PT/SY trading.
/// Key concepts:
/// - PT price naturally converges to 1 SY as expiry approaches
/// - Uses a modified curve that accounts for time decay
/// - Implied rate can be derived from current market state

use yield_tokenization::libraries::errors::Errors;
use yield_tokenization::libraries::math::{
    HALF_WAD, WAD, exp_neg_wad, exp_wad, ln_wad, max, min, wad_div, wad_mul,
};

/// Market state containing reserves and parameters
#[derive(Drop, Copy, Serde)]
pub struct MarketState {
    pub sy_reserve: u256,
    pub pt_reserve: u256,
    pub total_lp: u256,
    pub scalar_root: u256, // Controls rate sensitivity (in WAD)
    pub initial_anchor: u256, // Initial ln(implied rate) (in WAD)
    pub fee_rate: u256, // Fee rate in WAD (e.g., 0.01 WAD = 1%)
    pub expiry: u64,
    pub last_ln_implied_rate: u256 // Cached ln(implied rate)
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
/// As time passes, the rate becomes less sensitive to price changes
/// rate_scalar = scalar_root / time_to_expiry_years
/// @param scalar_root Base scalar value in WAD
/// @param time_to_expiry Time to expiry in seconds
/// @return Adjusted rate scalar in WAD
pub fn get_rate_scalar(scalar_root: u256, time_to_expiry: u64) -> u256 {
    let time_in_years = wad_div(time_to_expiry.into() * WAD, SECONDS_PER_YEAR * WAD);
    if time_in_years == 0 {
        return scalar_root * 1000; // Very large scalar near expiry
    }
    wad_div(scalar_root, time_in_years)
}

/// Calculate the rate anchor adjusted for time passage
/// The anchor increases as we approach expiry to keep the rate stable
/// @param state Current market state
/// @param time_to_expiry Time to expiry in seconds
/// @param initial_time_to_expiry Initial time to expiry when market was created
/// @return Adjusted anchor in WAD
pub fn get_rate_anchor(
    state: @MarketState, time_to_expiry: u64, initial_time_to_expiry: u64,
) -> u256 {
    let initial_anchor = *state.initial_anchor;
    let rate_scalar = get_rate_scalar(*state.scalar_root, time_to_expiry);

    // Time proportion remaining: time_to_expiry / initial_time_to_expiry
    let time_ratio = wad_div(time_to_expiry.into() * WAD, initial_time_to_expiry.into() * WAD);

    // Anchor adjustment = rate_scalar * (1 - time_ratio)
    let adjustment = wad_mul(rate_scalar, WAD - time_ratio);

    initial_anchor + adjustment
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

    if is_negative {
        // ln_odds is negative, so -rate_scalar * ln_odds = +scaled_ln_odds
        *state.initial_anchor + scaled_ln_odds
    } else if scaled_ln_odds >= *state.initial_anchor {
        // ln_odds is positive and large enough to drive rate negative - floor at 0
        0
    } else {
        // ln_odds is positive, so -rate_scalar * ln_odds = -scaled_ln_odds
        *state.initial_anchor - scaled_ln_odds
    }
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
/// Uses the AMM curve to determine output amount
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

    // Get current implied rate
    let ln_rate = get_ln_implied_rate(state, time_to_expiry);
    let pt_price = get_pt_price(ln_rate, time_to_expiry);

    // Basic swap: sy_out = pt_in * pt_price (before fees and slippage)
    let gross_sy_out = wad_mul(exact_pt_in, pt_price);

    // Apply price impact (simplified constant product style)
    // In a real implementation, this would use the full curve equation
    let new_pt_reserve = *state.pt_reserve + exact_pt_in;
    let k = wad_mul(*state.pt_reserve, *state.sy_reserve);
    let new_sy_reserve = wad_div(k, new_pt_reserve);

    let sy_out_with_impact = if new_sy_reserve < *state.sy_reserve {
        *state.sy_reserve - new_sy_reserve
    } else {
        0
    };

    // Use the minimum of gross and impact-adjusted
    let sy_out_before_fee = min(gross_sy_out, sy_out_with_impact);

    // Calculate fee
    let fee = wad_mul(sy_out_before_fee, *state.fee_rate);
    let sy_out = sy_out_before_fee - fee;

    (sy_out, fee)
}

/// Calculate PT output for exact SY input (sell SY for PT)
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

    // Apply fee first (fee is taken from input)
    let fee = wad_mul(exact_sy_in, *state.fee_rate);
    let sy_in_after_fee = exact_sy_in - fee;

    // Get current implied rate
    let ln_rate = get_ln_implied_rate(state, time_to_expiry);
    let pt_price = get_pt_price(ln_rate, time_to_expiry);

    // Basic swap: pt_out = sy_in / pt_price (PT is cheaper than SY before expiry)
    let gross_pt_out = wad_div(sy_in_after_fee, pt_price);

    // Apply price impact
    let new_sy_reserve = *state.sy_reserve + sy_in_after_fee;
    let k = wad_mul(*state.pt_reserve, *state.sy_reserve);
    let new_pt_reserve = wad_div(k, new_sy_reserve);

    let pt_out_with_impact = if new_pt_reserve < *state.pt_reserve {
        *state.pt_reserve - new_pt_reserve
    } else {
        0
    };

    // Use the minimum of gross and impact-adjusted
    let pt_out = min(gross_pt_out, pt_out_with_impact);

    (pt_out, fee)
}

/// Calculate SY input required for exact PT output (buy PT with SY)
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

    // Calculate required SY using constant product
    let new_pt_reserve = *state.pt_reserve - exact_pt_out;
    let k = wad_mul(*state.pt_reserve, *state.sy_reserve);
    let new_sy_reserve = wad_div(k, new_pt_reserve);

    let sy_in_before_fee = new_sy_reserve - *state.sy_reserve;

    // Add fee (fee is on top of required amount)
    // sy_in_before_fee = sy_in_after_fee, so sy_in = sy_in_before_fee / (1 - fee_rate)
    let sy_in = wad_div(sy_in_before_fee, WAD - *state.fee_rate);
    let fee = sy_in - sy_in_before_fee;

    (sy_in, fee)
}

/// Calculate PT input required for exact SY output (buy SY with PT)
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

    // Add fee to output (user receives less, so we need to account for fee in output)
    // If user wants exact_sy_out, pool needs to give out more before fee
    let sy_out_before_fee = wad_div(exact_sy_out, WAD - *state.fee_rate);
    let fee = sy_out_before_fee - exact_sy_out;

    // Calculate required PT using constant product
    let new_sy_reserve = *state.sy_reserve - sy_out_before_fee;
    let k = wad_mul(*state.pt_reserve, *state.sy_reserve);
    let new_pt_reserve = wad_div(k, new_sy_reserve);

    let pt_in = new_pt_reserve - *state.pt_reserve;

    (pt_in, fee)
}

/// Calculate LP tokens to mint for given liquidity addition
/// @param state Current market state
/// @param sy_amount Amount of SY to add
/// @param pt_amount Amount of PT to add
/// @return (lp_to_mint, sy_used, pt_used)
pub fn calc_mint_lp(state: @MarketState, sy_amount: u256, pt_amount: u256) -> (u256, u256, u256) {
    if *state.total_lp == 0 {
        // First liquidity provider - use geometric mean
        let lp = sqrt_u256(wad_mul(sy_amount, pt_amount));
        return (lp, sy_amount, pt_amount);
    }

    // Calculate the amount of each token to use based on current ratio
    let sy_ratio = wad_div(sy_amount, *state.sy_reserve);
    let pt_ratio = wad_div(pt_amount, *state.pt_reserve);

    // Use the smaller ratio to maintain pool balance
    let ratio = min(sy_ratio, pt_ratio);

    let sy_used = wad_mul(ratio, *state.sy_reserve);
    let pt_used = wad_mul(ratio, *state.pt_reserve);
    let lp_to_mint = wad_mul(ratio, *state.total_lp);

    (lp_to_mint, sy_used, pt_used)
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
