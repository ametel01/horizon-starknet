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
    HALF_WAD, WAD, asset_to_sy, asset_to_sy_up, exp_neg_wad, exp_wad, ln_wad, max, min, sy_to_asset,
    wad_div, wad_mul,
};

/// Market state containing reserves and parameters
/// Note: py_index is populated per-call from YT, not stored in market contract
#[derive(Drop, Copy, Serde)]
pub struct MarketState {
    pub sy_reserve: u256,
    pub pt_reserve: u256,
    pub total_lp: u256,
    pub scalar_root: u256, // Controls rate sensitivity (in WAD)
    pub initial_anchor: u256, // Initial anchor for exchange rate (in WAD)
    pub ln_fee_rate_root: u256, // Log fee rate root (Pendle-style), replaces fee_rate
    pub reserve_fee_percent: u8, // Reserve fee in base-100 (0-100), sent to treasury
    pub expiry: u64,
    pub last_ln_implied_rate: u256, // Cached ln(implied rate) for anchor calculation
    pub py_index: u256 // SY -> asset index from YT (fetched per-call)
}

/// Pre-computed values for trade calculation (avoids redundant computation)
/// Mirrors Pendle's MarketPreCompute with asset-based calculations
#[derive(Drop, Copy)]
pub struct MarketPreCompute {
    pub rate_scalar: u256,
    pub total_asset: u256, // Total assets in pool: sy_to_asset(sy_reserve, py_index) + pt_reserve
    pub rate_anchor: u256,
    pub fee_rate: u256 // Computed from ln_fee_rate_root using Pendle's exp formula
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

// ============ Signed Value Helper ============
// Pendle's trade calculations require signed arithmetic for net_pt_to_account
// and net_asset_to_account. This struct represents a signed value as (magnitude, sign).

/// Represents a signed value as (magnitude, is_negative)
/// Used for Pendle-style trade calculations where values can be positive or negative
#[derive(Drop, Copy)]
pub struct SignedValue {
    pub mag: u256, // Absolute value
    pub is_negative: bool // true if value is negative
}

/// Create a positive SignedValue
pub fn signed_pos(value: u256) -> SignedValue {
    SignedValue { mag: value, is_negative: false }
}

/// Create a negative SignedValue
pub fn signed_neg(value: u256) -> SignedValue {
    SignedValue { mag: value, is_negative: true }
}

/// Check if a SignedValue is positive (> 0)
pub fn is_positive(v: @SignedValue) -> bool {
    *v.mag > 0 && !*v.is_negative
}

/// Check if a SignedValue is negative (< 0)
pub fn is_negative_val(v: @SignedValue) -> bool {
    *v.mag > 0 && *v.is_negative
}

/// Negate a SignedValue
pub fn negate(v: SignedValue) -> SignedValue {
    if v.mag == 0 {
        return v;
    }
    SignedValue { mag: v.mag, is_negative: !v.is_negative }
}

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

/// Calculate Pendle-style fee rate from ln_fee_rate_root
/// fee_rate = exp(ln_fee_rate_root * timeToExpiry / SECONDS_PER_YEAR)
/// Note: Pendle does NOT subtract 1 from exp result
pub fn get_fee_rate(ln_fee_rate_root: u256, time_to_expiry: u64) -> u256 {
    if time_to_expiry == 0 || ln_fee_rate_root == 0 {
        return WAD; // Fee rate of 1.0 at expiry or zero fee root
    }

    // exponent = ln_fee_rate_root * timeToExpiry / SECONDS_PER_YEAR
    let time_to_expiry_wad: u256 = time_to_expiry.into() * WAD;
    let exponent = wad_div(wad_mul(ln_fee_rate_root, time_to_expiry_wad), SECONDS_PER_YEAR * WAD);

    // fee_rate = exp(exponent)
    // Cap exponent to prevent overflow
    let safe_exponent = min(exponent, MAX_EXPONENT_WAD);
    exp_wad(safe_exponent)
}

/// Get pre-computed values for trade calculations
/// Pendle-style: validates reserves and computes asset-based totals
/// @param state Current market state
/// @param time_to_expiry Time to expiry in seconds
/// @return MarketPreCompute struct with rate_scalar, total_asset, rate_anchor, and fee_rate
pub fn get_market_pre_compute(state: @MarketState, time_to_expiry: u64) -> MarketPreCompute {
    // Validate reserves (Pendle reverts if either is zero)
    assert(*state.pt_reserve > 0, Errors::MARKET_INSUFFICIENT_LIQUIDITY);

    // Calculate total assets in pool
    // total_asset = sy_to_asset(sy_reserve, py_index) + pt_reserve
    // PT is valued at 1 asset each (redeemable 1:1 at expiry)
    let sy_in_assets = sy_to_asset(*state.sy_reserve, *state.py_index);
    let total_asset = sy_in_assets + *state.pt_reserve;

    // Validate total assets
    assert(total_asset > 0, Errors::MARKET_INSUFFICIENT_LIQUIDITY);

    let rate_scalar = get_rate_scalar(*state.scalar_root, time_to_expiry);
    let rate_anchor = get_rate_anchor(state, time_to_expiry);
    let fee_rate = get_fee_rate(*state.ln_fee_rate_root, time_to_expiry);

    MarketPreCompute { rate_scalar, total_asset, rate_anchor, fee_rate }
}

// ============ Trade Result ============
// Result of a trade calculation including all fee splits

/// Result of a trade calculation with Pendle-style fee handling
/// All values are in SY terms for final token transfers
#[derive(Drop, Copy)]
pub struct TradeResult {
    pub net_sy_to_account: u256, // SY amount to/from user (magnitude)
    pub net_sy_to_account_is_negative: bool, // true if user pays SY (buy PT), false if receives
    pub net_sy_fee: u256, // Total fee in SY terms
    pub net_sy_to_reserve: u256 // Reserve fee portion (treasury)
}

/// Core trade calculation mirroring Pendle's calcTrade
/// Implements asymmetric fee handling based on trade direction:
/// - Buying PT (net_pt_to_account > 0): post_fee_rate = pre_fee_rate / fee_rate
/// - Selling PT (net_pt_to_account < 0): different fee formula
///
/// @param state Current market state
/// @param net_pt_to_account Signed PT amount: positive = user buys PT, negative = user sells PT
/// @param comp Pre-computed market values
/// @return TradeResult with net_sy_to_account, fees, and reserve split
pub fn calc_trade(
    state: @MarketState, net_pt_to_account: SignedValue, comp: @MarketPreCompute,
) -> TradeResult {
    // Handle zero trade
    if net_pt_to_account.mag == 0 {
        return TradeResult {
            net_sy_to_account: 0,
            net_sy_to_account_is_negative: false,
            net_sy_fee: 0,
            net_sy_to_reserve: 0,
        };
    }

    // Determine if user is buying or selling PT
    let is_buying_pt = is_positive(@net_pt_to_account);

    // Calculate pre-fee exchange rate at the new PT level
    let pre_fee_exchange_rate = get_exchange_rate(
        *state.pt_reserve,
        *state.sy_reserve,
        net_pt_to_account.mag,
        is_buying_pt, // PT leaving pool if buying
        *comp.rate_scalar,
        *comp.rate_anchor,
    );

    // Calculate pre-fee asset amount
    // pre_fee_asset_to_account = net_pt_to_account / pre_fee_exchange_rate
    // This is the asset equivalent of the PT being traded
    let pre_fee_asset_magnitude = wad_div(net_pt_to_account.mag, pre_fee_exchange_rate);

    // Apply asymmetric fee based on direction (Pendle's formula)
    let (net_asset_to_account_mag, net_asset_is_negative, fee_in_asset) = if is_buying_pt {
        // User is BUYING PT (net_pt_to_account > 0)
        // User pays SY to receive PT
        // post_fee_exchange_rate = pre_fee_exchange_rate / fee_rate
        // This makes PT more expensive when buying
        let post_fee_exchange_rate = wad_div(pre_fee_exchange_rate, *comp.fee_rate);

        // Pendle requires: post_fee_exchange_rate >= WAD (1.0)
        // If not, the trade would allow buying PT above par value
        assert(post_fee_exchange_rate >= WAD, Errors::MARKET_RATE_BELOW_ONE);

        // Calculate what user actually pays
        // net_asset_to_account = net_pt_to_account / post_fee_exchange_rate
        let net_asset_paid = wad_div(net_pt_to_account.mag, post_fee_exchange_rate);

        // Fee is the difference between what user pays and what goes to reserves
        // fee = net_asset_paid - pre_fee_asset (user pays more than pre-fee amount)
        let fee = if net_asset_paid > pre_fee_asset_magnitude {
            net_asset_paid - pre_fee_asset_magnitude
        } else {
            0
        };

        // User is paying, so net_asset_to_account is negative
        (net_asset_paid, true, fee)
    } else {
        // User is SELLING PT (net_pt_to_account < 0)
        // User receives SY for their PT
        // fee = pre_fee_asset * (fee_rate - WAD) / fee_rate
        let fee_rate_minus_one = if *comp.fee_rate > WAD {
            *comp.fee_rate - WAD
        } else {
            0
        };
        let fee = wad_div(wad_mul(pre_fee_asset_magnitude, fee_rate_minus_one), *comp.fee_rate);

        // User receives less due to fee
        let net_asset_received = if pre_fee_asset_magnitude > fee {
            pre_fee_asset_magnitude - fee
        } else {
            0
        };

        // User is receiving, so net_asset_to_account is positive
        (net_asset_received, false, fee)
    };

    // Calculate reserve fee (portion that goes to treasury)
    // reserve_fee = fee * reserve_fee_percent / 100
    let reserve_fee_in_asset = (fee_in_asset * (*state.reserve_fee_percent).into()) / 100;

    // Convert asset amounts to SY using py_index
    // Use round-up for amounts user pays (negative flows to account)
    let (net_sy_to_account, net_sy_is_negative) = if net_asset_is_negative {
        // User pays - round UP to ensure protocol is not undercharged
        (asset_to_sy_up(net_asset_to_account_mag, *state.py_index), true)
    } else {
        // User receives - round DOWN to ensure protocol is not over-paying
        (asset_to_sy(net_asset_to_account_mag, *state.py_index), false)
    };

    // Convert fees to SY (always round down for fee conversion)
    let net_sy_fee = asset_to_sy(fee_in_asset, *state.py_index);
    let net_sy_to_reserve = asset_to_sy(reserve_fee_in_asset, *state.py_index);

    TradeResult {
        net_sy_to_account,
        net_sy_to_account_is_negative: net_sy_is_negative,
        net_sy_fee,
        net_sy_to_reserve,
    }
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
/// Uses Pendle's calcTrade with asymmetric fee handling
/// net_pt_to_account = -exact_pt_in (user is selling PT)
pub fn calc_swap_exact_pt_for_sy(
    state: @MarketState, exact_pt_in: u256, time_to_expiry: u64,
) -> (u256, u256) {
    if exact_pt_in == 0 {
        return (0, 0);
    }

    let comp = get_market_pre_compute(state, time_to_expiry);

    // User is selling PT, so net_pt_to_account is negative
    let net_pt_to_account = signed_neg(exact_pt_in);

    // Use core trade calculation
    let result = calc_trade(state, net_pt_to_account, @comp);

    // Ensure output doesn't exceed available reserves
    assert(result.net_sy_to_account < *state.sy_reserve, Errors::MARKET_INSUFFICIENT_LIQUIDITY);

    // User receives SY (net_sy_to_account should be positive)
    assert(!result.net_sy_to_account_is_negative, Errors::MARKET_INVALID_TRADE);

    (result.net_sy_to_account, result.net_sy_fee)
}

/// Calculate PT output for exact SY input (sell SY for PT)
/// Uses binary search with Pendle's calcTrade for asymmetric fee handling
/// net_pt_to_account = +pt_out (user is buying PT)
pub fn calc_swap_exact_sy_for_pt(
    state: @MarketState, exact_sy_in: u256, time_to_expiry: u64,
) -> (u256, u256) {
    if exact_sy_in == 0 {
        return (0, 0);
    }

    let comp = get_market_pre_compute(state, time_to_expiry);

    // Calculate a reasonable upper bound for PT_out
    // PT trades at discount to SY, so PT_out < SY_in * rate_anchor
    // Use rate_anchor as estimate (max exchange rate), multiply by 2 for safety margin
    let estimated_pt_out = wad_mul(exact_sy_in, comp.rate_anchor * 2);

    // Cap at available PT (reserve - 1)
    let max_pt_out = if *state.pt_reserve > 1 {
        min(*state.pt_reserve - 1, estimated_pt_out)
    } else {
        0
    };

    // Binary search to find PT_out where calc_trade gives us net_sy_to_account = exact_sy_in
    // (with user paying SY)
    let pt_out = binary_search_pt_out_with_trade(state, exact_sy_in, max_pt_out, @comp);

    // Calculate actual fee by calling calc_trade with the found pt_out
    let net_pt_to_account = signed_pos(pt_out);
    let result = calc_trade(state, net_pt_to_account, @comp);

    (pt_out, result.net_sy_fee)
}

/// Binary search for PT_out using calc_trade for accurate fee-aware pricing
/// Finds PT_out such that calc_trade gives net_sy_to_account = sy_in_target
fn binary_search_pt_out_with_trade(
    state: @MarketState, sy_in_target: u256, max_pt_out: u256, comp: @MarketPreCompute,
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

        // User is buying PT, so net_pt_to_account is positive
        let net_pt_to_account = signed_pos(mid);
        let trade_result = calc_trade(state, net_pt_to_account, comp);

        // When buying PT, user pays SY (net_sy_to_account_is_negative = true)
        // We want to find PT amount where user pays exactly sy_in_target
        if trade_result.net_sy_to_account_is_negative {
            let implied_sy_in = trade_result.net_sy_to_account;

            if implied_sy_in <= sy_in_target {
                // Can afford this much PT, try higher
                result = mid;
                low = mid + 1;
            } else {
                // Too expensive, try lower
                high = mid;
            }

            let diff = if implied_sy_in > sy_in_target {
                implied_sy_in - sy_in_target
            } else {
                sy_in_target - implied_sy_in
            };
            if diff <= BINARY_SEARCH_TOLERANCE {
                return result;
            }
        } else {
            // Trade direction is wrong, try lower PT amount
            high = mid;
        }

        iterations += 1;
    }

    result
}

/// Calculate SY input required for exact PT output
/// Uses Pendle's calcTrade with asymmetric fee handling
/// net_pt_to_account = +exact_pt_out (user is buying PT)
pub fn calc_swap_sy_for_exact_pt(
    state: @MarketState, exact_pt_out: u256, time_to_expiry: u64,
) -> (u256, u256) {
    if exact_pt_out == 0 {
        return (0, 0);
    }

    assert(exact_pt_out < *state.pt_reserve, Errors::MARKET_INSUFFICIENT_LIQUIDITY);

    let comp = get_market_pre_compute(state, time_to_expiry);

    // User is buying PT, so net_pt_to_account is positive
    let net_pt_to_account = signed_pos(exact_pt_out);

    // Use core trade calculation
    let result = calc_trade(state, net_pt_to_account, @comp);

    // User pays SY (net_sy_to_account should be negative)
    assert(result.net_sy_to_account_is_negative, Errors::MARKET_INVALID_TRADE);

    (result.net_sy_to_account, result.net_sy_fee)
}

/// Calculate PT input required for exact SY output
/// Uses binary search with Pendle's calcTrade for asymmetric fee handling
/// net_pt_to_account = -pt_in (user is selling PT)
pub fn calc_swap_pt_for_exact_sy(
    state: @MarketState, exact_sy_out: u256, time_to_expiry: u64,
) -> (u256, u256) {
    if exact_sy_out == 0 {
        return (0, 0);
    }

    assert(exact_sy_out < *state.sy_reserve, Errors::MARKET_INSUFFICIENT_LIQUIDITY);

    let comp = get_market_pre_compute(state, time_to_expiry);

    // Binary search to find PT_in where calc_trade gives net_sy_to_account = exact_sy_out
    // (with user receiving SY)
    let max_pt_in = *state.pt_reserve * MAX_PT_IN_RESERVE_MULTIPLIER;
    let pt_in = binary_search_pt_in_with_trade(state, exact_sy_out, max_pt_in, @comp);

    // Calculate actual fee by calling calc_trade with the found pt_in
    let net_pt_to_account = signed_neg(pt_in);
    let result = calc_trade(state, net_pt_to_account, @comp);

    (pt_in, result.net_sy_fee)
}

/// Binary search for PT_in using calc_trade for accurate fee-aware pricing
/// Finds PT_in such that calc_trade gives net_sy_to_account = sy_out_target
fn binary_search_pt_in_with_trade(
    state: @MarketState, sy_out_target: u256, max_pt_in: u256, comp: @MarketPreCompute,
) -> u256 {
    let mut low: u256 = 1;
    let mut high: u256 = max_pt_in;
    let mut result: u256 = 1;
    let mut iterations: u32 = 0;

    while iterations < BINARY_SEARCH_MAX_ITERATIONS && low < high {
        let mid = (low + high) / 2;

        if mid == 0 {
            break;
        }

        // User is selling PT, so net_pt_to_account is negative
        let net_pt_to_account = signed_neg(mid);
        let trade_result = calc_trade(state, net_pt_to_account, comp);

        // When selling PT, user receives SY (net_sy_to_account_is_negative = false)
        if !trade_result.net_sy_to_account_is_negative {
            let implied_sy_out = trade_result.net_sy_to_account;

            if implied_sy_out >= sy_out_target {
                // This PT amount gives enough SY, try lower
                result = mid;
                high = mid;
            } else {
                // Not enough SY, need more PT
                low = mid + 1;
            }

            let diff = if implied_sy_out > sy_out_target {
                implied_sy_out - sy_out_target
            } else {
                sy_out_target - implied_sy_out
            };
            if diff <= BINARY_SEARCH_TOLERANCE {
                return result;
            }
        } else {
            // Trade direction is wrong, need more PT
            low = mid + 1;
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

/// Set the initial ln(implied rate) for a newly created market
/// This must be called AFTER the first liquidity is added (first mint).
///
/// Implements Pendle's setInitialLnImpliedRate formula:
/// 1. Convert initial_anchor (ln_implied_rate) to rate_anchor (exchange rate)
/// 2. Compute proportion using py_index to convert SY to assets
/// 3. Calculate exchange_rate = logit(proportion) / rate_scalar + rate_anchor
/// 4. Derive ln_implied_rate = ln(exchange_rate) * SECONDS_PER_YEAR / time_to_expiry
///
/// This ensures the first stored rate properly incorporates PYIndex and matches
/// Pendle's implementation.
///
/// @param state Market state with reserves and py_index populated from first mint
/// @param time_to_expiry Time to expiry in seconds
/// @return The computed initial ln_implied_rate
pub fn set_initial_ln_implied_rate(state: @MarketState, time_to_expiry: u64) -> u256 {
    // Validate reserves exist (should be called after first mint)
    assert(*state.pt_reserve > 0, Errors::MARKET_INSUFFICIENT_LIQUIDITY);
    assert(*state.sy_reserve > 0, Errors::MARKET_INSUFFICIENT_LIQUIDITY);

    // Handle expiry edge case
    if time_to_expiry == 0 {
        return 0;
    }

    // Step 1: Convert initial_anchor (ln_implied_rate) to rate_anchor (exchange rate)
    // rate_anchor = e^(initial_anchor * time_to_expiry / SECONDS_PER_YEAR)
    let time_in_years_wad = wad_div(time_to_expiry.into() * WAD, SECONDS_PER_YEAR * WAD);
    let capped_ln_implied_rate = min(*state.initial_anchor, MAX_LN_IMPLIED_RATE);
    let exponent = wad_mul(capped_ln_implied_rate, time_in_years_wad);
    let safe_exponent = min(exponent, MAX_EXPONENT_WAD);
    let rate_anchor = max(exp_wad(safe_exponent), WAD);

    // Step 2: Get rate scalar
    let rate_scalar = get_rate_scalar(*state.scalar_root, time_to_expiry);

    // Step 3: Compute proportion using py_index (via get_proportion)
    let proportion = get_proportion(state);
    let clamped_proportion = max(MIN_PROPORTION, min(MAX_PROPORTION, proportion));

    // Step 4: Compute logit and exchange_rate = logit / rate_scalar + rate_anchor
    let (ln_proportion, ln_is_negative) = logit(clamped_proportion);
    let scaled_ln = wad_div(ln_proportion, rate_scalar);

    let exchange_rate = if ln_is_negative {
        // Proportion < 0.5, logit is negative: exchange_rate = rate_anchor - |scaled_ln|
        if scaled_ln >= rate_anchor {
            WAD // Floor at 1.0 if would go negative
        } else {
            rate_anchor - scaled_ln
        }
    } else {
        // Proportion >= 0.5, logit is positive: exchange_rate = rate_anchor + scaled_ln
        rate_anchor + scaled_ln
    };

    // Ensure exchange rate is at least 1.0
    let exchange_rate = max(exchange_rate, WAD);

    // Step 5: Compute ln_implied_rate = ln(exchange_rate) * SECONDS_PER_YEAR / time_to_expiry
    let (ln_exchange_rate, ln_is_neg) = ln_wad(exchange_rate);

    // ln(exchange_rate) should always be >= 0 since exchange_rate >= 1.0
    // But handle defensive case
    if ln_is_neg {
        return 0;
    }

    // ln_implied_rate = ln(exchange_rate) * SECONDS_PER_YEAR / time_to_expiry
    let ln_implied_rate = wad_div(
        wad_mul(ln_exchange_rate, SECONDS_PER_YEAR * WAD), time_to_expiry.into() * WAD,
    );

    min(ln_implied_rate, MAX_LN_IMPLIED_RATE)
}
