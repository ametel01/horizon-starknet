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
    HALF_WAD, MAX_EXPONENT_WAD, WAD, abs_diff, asset_to_sy, asset_to_sy_up, div_up, exp_neg_wad,
    exp_wad, ln_wad, max, min, sqrt_wad, sy_to_asset, wad_div, wad_mul,
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
    pub py_index: u256, // SY -> asset index from YT (fetched per-call)
    pub rate_impact_sensitivity: u256 // Sensitivity factor for dynamic fee (in WAD, from factory)
}

/// Pre-computed values for trade calculation
/// Mirrors Pendle's MarketPreCompute with asset-based calculations
#[derive(Drop, Copy)]
pub struct MarketPreCompute {
    pub rate_scalar: u256,
    pub total_asset: u256, // Total assets in pool: sy_to_asset(sy_reserve, py_index) + pt_reserve
    pub rate_anchor: u256,
    pub rate_anchor_is_negative: bool, // Rate anchor can be negative at extreme proportions
    pub fee_rate: u256 // Computed from ln_fee_rate_root using Pendle's exp formula
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

/// Maximum fee multiplier for rate-impact (2x = 200% of base fee)
/// Prevents excessive fees even for very large rate impacts
pub const MAX_FEE_MULTIPLIER: u256 = 2_000_000_000_000_000_000; // 2.0 WAD

/// Large scalar at expiry (flattens curve)
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

/// Calculate the proportion of PT in the pool (asset-based)
/// proportion = pt_reserve / total_asset
/// where total_asset = pt_reserve + sy_to_asset(sy_reserve, py_index)
///
/// This is Pendle's asset-based curve: PT is valued at 1 asset each,
/// and SY's value in assets depends on py_index.
/// Using cubit for precision in the division
pub fn get_proportion(state: @MarketState) -> u256 {
    // Convert SY to asset value
    let sy_in_assets = sy_to_asset(*state.sy_reserve, *state.py_index);
    let total_asset = *state.pt_reserve + sy_in_assets;

    if total_asset == 0 {
        return HALF_WAD; // 50% if pool is empty
    }

    // Use high-precision division
    // proportion = pt_reserve / total_asset
    wad_div(*state.pt_reserve, total_asset)
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
/// Note: Caller must validate proportion is within bounds before calling
fn logit(proportion: u256) -> (u256, bool) {
    // Caller is responsible for bounds checking - we only clamp to MIN for safety
    let p = max(MIN_PROPORTION, proportion);

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
/// Returns (magnitude, is_negative) to handle signed arithmetic properly
pub fn get_rate_anchor(state: @MarketState, time_to_expiry: u64) -> (u256, bool) {
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

    // Get current proportion and validate bounds (Pendle reverts on > 96%)
    let proportion = get_proportion(state);
    assert(proportion <= MAX_PROPORTION, Errors::MARKET_PROPORTION_TOO_HIGH);

    // Clamp to MIN for safety (MIN is soft bound, MAX is hard bound)
    let clamped_proportion = max(MIN_PROPORTION, proportion);
    let (ln_proportion, ln_is_negative) = logit(clamped_proportion);

    // rateAnchor = targetExchangeRate - ln_proportion / rateScalar
    // Handle signed arithmetic properly to preserve the invariant that
    // exchange_rate = target_exchange_rate when querying at current proportion
    let scaled_ln = wad_div(ln_proportion, rate_scalar);

    if ln_is_negative {
        // Proportion < 0.5, ln is negative, so rateAnchor = target + |scaled_ln|
        (target_exchange_rate + scaled_ln, false)
    } else if scaled_ln >= target_exchange_rate {
        // rateAnchor is negative: target - scaled_ln < 0
        (scaled_ln - target_exchange_rate, true)
    } else {
        // rateAnchor is positive: target - scaled_ln > 0
        (target_exchange_rate - scaled_ln, false)
    }
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
    let (rate_anchor, rate_anchor_is_negative) = get_rate_anchor(state, time_to_expiry);
    let fee_rate = get_fee_rate(*state.ln_fee_rate_root, time_to_expiry);

    MarketPreCompute { rate_scalar, total_asset, rate_anchor, rate_anchor_is_negative, fee_rate }
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
/// Additionally applies rate-impact fee multiplier for large trades:
/// - Calculates exchange rate before and after the trade
/// - Applies multiplier = 1 + sensitivity × |rate_change| / rate_before
/// - This protects LPs from adverse selection on large trades
///
/// @param state Current market state (includes rate_impact_sensitivity from factory)
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

    // ============ RATE-IMPACT FEE CALCULATION ============
    // Calculate exchange rate BEFORE the trade (at current reserve state)
    // This is the baseline rate used to measure rate impact
    let rate_before_trade = get_exchange_rate(
        *state.pt_reserve,
        *comp.total_asset,
        0, // No change yet - current state
        false,
        *comp.rate_scalar,
        *comp.rate_anchor,
        *comp.rate_anchor_is_negative,
    );

    // Calculate exchange rate AFTER the trade (at new PT level)
    // Uses asset-based curve: pass total_asset instead of sy_reserve
    let rate_after_trade = get_exchange_rate(
        *state.pt_reserve,
        *comp.total_asset, // Asset-based: pt_reserve + sy_to_asset(sy_reserve, py_index)
        net_pt_to_account.mag,
        is_buying_pt, // PT leaving pool if buying
        *comp.rate_scalar,
        *comp.rate_anchor,
        *comp.rate_anchor_is_negative,
    );

    // Calculate rate-impact multiplier based on how much the trade moves the rate
    // multiplier = 1 + sensitivity × |rate_after - rate_before| / rate_before
    // Capped at MAX_FEE_MULTIPLIER (2x) to prevent excessive fees
    let rate_impact_multiplier = calc_rate_impact_multiplier(
        rate_before_trade, rate_after_trade, *state.rate_impact_sensitivity,
    );

    // Apply rate-impact multiplier to the base fee_rate
    // effective_fee_rate = base_fee_rate × multiplier
    // This increases fees for trades that cause larger rate movements
    let effective_fee_rate = wad_mul(*comp.fee_rate, rate_impact_multiplier);

    // ============ STANDARD TRADE CALCULATION ============
    // (Using effective_fee_rate instead of comp.fee_rate)

    // Calculate pre-fee asset amount
    // pre_fee_asset_to_account = net_pt_to_account / rate_after_trade
    // This is the asset equivalent of the PT being traded
    let pre_fee_asset_magnitude = wad_div(net_pt_to_account.mag, rate_after_trade);

    // Apply asymmetric fee based on direction (Pendle's formula)
    let (net_asset_to_account_mag, net_asset_is_negative, fee_in_asset) = if is_buying_pt {
        // User is BUYING PT (net_pt_to_account > 0)
        // User pays SY to receive PT
        // post_fee_exchange_rate = pre_fee_exchange_rate / effective_fee_rate
        // This makes PT more expensive when buying
        let post_fee_exchange_rate = wad_div(rate_after_trade, effective_fee_rate);

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
        // fee = pre_fee_asset * (effective_fee_rate - WAD) / effective_fee_rate
        let fee_rate_minus_one = if effective_fee_rate > WAD {
            effective_fee_rate - WAD
        } else {
            0
        };
        let fee = wad_div(wad_mul(pre_fee_asset_magnitude, fee_rate_minus_one), effective_fee_rate);

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

/// Calculate exchange rate (PT price in asset terms) using Pendle's logit curve
/// exchangeRate = ln(newProportion/(1-newProportion))/rateScalar + rateAnchor
///
/// This is the asset-based curve: proportion = pt_reserve / total_asset
/// where total_asset = pt_reserve + sy_to_asset(sy_reserve, py_index)
///
/// This uses cubit's high-precision ln for accurate logit calculation
/// Handles signed arithmetic to preserve the invariant that at current proportion,
/// exchange_rate = target_exchange_rate (the logit terms cancel out)
///
/// @param pt_reserve Current PT reserve
/// @param total_asset Pre-computed total assets (pt + sy_in_assets) from MarketPreCompute
/// @param net_pt_change Absolute PT amount being traded
/// @param is_pt_out True if PT is leaving pool (user buying PT)
/// @param rate_scalar Time-adjusted rate scalar
/// @param rate_anchor Computed anchor for rate continuity
/// @param rate_anchor_is_negative True if rate_anchor is negative
/// @return Exchange rate in WAD (assets per PT)
pub fn get_exchange_rate(
    pt_reserve: u256,
    total_asset: u256,
    net_pt_change: u256,
    is_pt_out: bool,
    rate_scalar: u256,
    rate_anchor: u256,
    rate_anchor_is_negative: bool,
) -> u256 {
    // Calculate new PT reserve after trade
    let new_pt_reserve = if is_pt_out {
        assert(net_pt_change < pt_reserve, Errors::MARKET_INSUFFICIENT_LIQUIDITY);
        pt_reserve - net_pt_change
    } else {
        pt_reserve + net_pt_change
    };

    // Calculate new proportion using asset-based formula
    // proportion = new_pt_reserve / total_asset
    // Note: total_asset is pre-trade value (the invariant for rate calculation)
    let new_proportion = wad_div(new_pt_reserve, total_asset);

    // Pendle reverts on proportion > 96% (no clamping)
    assert(new_proportion <= MAX_PROPORTION, Errors::MARKET_PROPORTION_TOO_HIGH);

    // Clamp to MIN for safety (MIN is soft bound, MAX is hard bound)
    let clamped_proportion = max(MIN_PROPORTION, new_proportion);

    // Calculate logit = ln(proportion / (1 - proportion)) using cubit
    let (ln_proportion, ln_is_negative) = logit(clamped_proportion);

    // exchangeRate = ln_proportion / rateScalar + rateAnchor
    // Handle signed arithmetic properly:
    // - ln_proportion can be positive (proportion > 0.5) or negative (proportion < 0.5)
    // - rate_anchor can be positive or negative
    let scaled_ln = wad_div(ln_proportion, rate_scalar);

    // Compute: scaled_ln (with sign ln_is_negative) + rate_anchor (with sign
    // rate_anchor_is_negative)
    let exchange_rate = if ln_is_negative && rate_anchor_is_negative {
        // Both negative: -|scaled_ln| + (-|rate_anchor|) = -(|scaled_ln| + |rate_anchor|)
        // Exchange rate would be negative, this is an error condition
        0_u256 // Will trigger revert below
    } else if ln_is_negative && !rate_anchor_is_negative {
        // -|scaled_ln| + |rate_anchor|
        if rate_anchor >= scaled_ln {
            rate_anchor - scaled_ln
        } else {
            0_u256 // Would be negative, will trigger revert below
        }
    } else if !ln_is_negative && rate_anchor_is_negative {
        // |scaled_ln| + (-|rate_anchor|) = |scaled_ln| - |rate_anchor|
        if scaled_ln >= rate_anchor {
            scaled_ln - rate_anchor
        } else {
            0_u256 // Would be negative, will trigger revert below
        }
    } else {
        // Both positive: |scaled_ln| + |rate_anchor|
        scaled_ln + rate_anchor
    };

    // Pendle reverts if exchange_rate < 1 (no flooring)
    assert(exchange_rate >= WAD, Errors::MARKET_RATE_BELOW_ONE);

    exchange_rate
}

/// Calculate ln(implied_rate) from market state
/// ln_implied_rate = anchor - rate_scalar * ln(proportion / (1 - proportion))
pub fn get_ln_implied_rate(state: @MarketState, time_to_expiry: u64) -> u256 {
    let proportion = get_proportion(state);

    // Pendle reverts on proportion > 96% (no clamping)
    assert(proportion <= MAX_PROPORTION, Errors::MARKET_PROPORTION_TOO_HIGH);

    // Clamp to MIN for safety (MIN is soft bound, MAX is hard bound)
    let clamped_proportion = max(MIN_PROPORTION, proportion);

    // Calculate logit using cubit's high-precision ln
    let odds = wad_div(clamped_proportion, WAD - clamped_proportion);
    let (ln_odds, is_negative) = ln_wad(odds);

    let rate_scalar = get_rate_scalar(*state.scalar_root, time_to_expiry);

    // ln_implied_rate = anchor - ln_odds / rate_scalar
    // (consistent with how exchange_rate uses logit / rate_scalar)
    let scaled_ln_odds = wad_div(ln_odds, rate_scalar);

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
/// Uses Pendle's calcTrade with asymmetric fee handling
/// net_pt_to_account = -exact_pt_in (user is selling PT)
/// Returns full TradeResult for Pendle-style fee handling (LP fee vs reserve fee split)
pub fn calc_swap_exact_pt_for_sy(
    state: @MarketState, exact_pt_in: u256, time_to_expiry: u64,
) -> TradeResult {
    if exact_pt_in == 0 {
        return TradeResult {
            net_sy_to_account: 0,
            net_sy_to_account_is_negative: false,
            net_sy_fee: 0,
            net_sy_to_reserve: 0,
        };
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

    result
}

/// Calculate PT output for exact SY input (sell SY for PT)
/// Uses binary search with Pendle's calcTrade for asymmetric fee handling
/// net_pt_to_account = +pt_out (user is buying PT)
/// Returns (pt_out, TradeResult) for Pendle-style fee handling
pub fn calc_swap_exact_sy_for_pt(
    state: @MarketState, exact_sy_in: u256, time_to_expiry: u64,
) -> (u256, TradeResult) {
    if exact_sy_in == 0 {
        return (
            0,
            TradeResult {
                net_sy_to_account: 0,
                net_sy_to_account_is_negative: false,
                net_sy_fee: 0,
                net_sy_to_reserve: 0,
            },
        );
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

    (pt_out, result)
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

            let diff = abs_diff(implied_sy_in, sy_in_target);
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
/// Returns full TradeResult for Pendle-style fee handling (LP fee vs reserve fee split)
pub fn calc_swap_sy_for_exact_pt(
    state: @MarketState, exact_pt_out: u256, time_to_expiry: u64,
) -> TradeResult {
    if exact_pt_out == 0 {
        return TradeResult {
            net_sy_to_account: 0,
            net_sy_to_account_is_negative: false,
            net_sy_fee: 0,
            net_sy_to_reserve: 0,
        };
    }

    assert(exact_pt_out < *state.pt_reserve, Errors::MARKET_INSUFFICIENT_LIQUIDITY);

    let comp = get_market_pre_compute(state, time_to_expiry);

    // User is buying PT, so net_pt_to_account is positive
    let net_pt_to_account = signed_pos(exact_pt_out);

    // Use core trade calculation
    let result = calc_trade(state, net_pt_to_account, @comp);

    // User pays SY (net_sy_to_account should be negative)
    assert(result.net_sy_to_account_is_negative, Errors::MARKET_INVALID_TRADE);

    result
}

/// Calculate PT input required for exact SY output
/// Uses binary search with Pendle's calcTrade for asymmetric fee handling
/// net_pt_to_account = -pt_in (user is selling PT)
/// Returns (pt_in, TradeResult) for Pendle-style fee handling
pub fn calc_swap_pt_for_exact_sy(
    state: @MarketState, exact_sy_out: u256, time_to_expiry: u64,
) -> (u256, TradeResult) {
    if exact_sy_out == 0 {
        return (
            0,
            TradeResult {
                net_sy_to_account: 0,
                net_sy_to_account_is_negative: false,
                net_sy_fee: 0,
                net_sy_to_reserve: 0,
            },
        );
    }

    assert(exact_sy_out < *state.sy_reserve, Errors::MARKET_INSUFFICIENT_LIQUIDITY);

    let comp = get_market_pre_compute(state, time_to_expiry);

    // Binary search to find PT_in where calc_trade gives net_sy_to_account = exact_sy_out
    // (with user receiving SY)
    // Constrain max_pt_in to respect the 96% proportion limit:
    // proportion = new_pt / total_asset <= MAX_PROPORTION
    // new_pt = pt_reserve + pt_in <= MAX_PROPORTION * total_asset
    // pt_in <= MAX_PROPORTION * total_asset - pt_reserve
    let proportion_limit_pt = wad_mul(MAX_PROPORTION, comp.total_asset);
    let max_from_proportion = if proportion_limit_pt > *state.pt_reserve {
        proportion_limit_pt - *state.pt_reserve
    } else {
        0
    };
    let unconstrained_max = *state.pt_reserve * MAX_PT_IN_RESERVE_MULTIPLIER;
    let max_pt_in = if max_from_proportion < unconstrained_max {
        max_from_proportion
    } else {
        unconstrained_max
    };

    // If max_pt_in is 0, the trade is infeasible (proportion limit reached)
    assert(max_pt_in > 0, Errors::MARKET_INFEASIBLE_TRADE);

    let pt_in = binary_search_pt_in_with_trade(state, exact_sy_out, max_pt_in, @comp);

    // Calculate actual fee by calling calc_trade with the found pt_in
    let net_pt_to_account = signed_neg(pt_in);
    let result = calc_trade(state, net_pt_to_account, @comp);

    // Validate that the binary search found a valid solution
    // The trade must produce at least exact_sy_out (user receives SY, not negative)
    assert(!result.net_sy_to_account_is_negative, Errors::MARKET_INFEASIBLE_TRADE);
    assert(result.net_sy_to_account >= exact_sy_out, Errors::MARKET_INFEASIBLE_TRADE);

    (pt_in, result)
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

            let diff = abs_diff(implied_sy_out, sy_out_target);
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

    // Calculate LP that would be minted for each token's desired amount
    // Using Pendle's approach: netLp = (desired * totalLp) / reserve
    let lp_by_sy = (sy_amount * *state.total_lp) / *state.sy_reserve;
    let lp_by_pt = (pt_amount * *state.total_lp) / *state.pt_reserve;

    // Determine which token is limiting and use rawDivUp for the "other side"
    // to protect the pool from receiving insufficient counterpart tokens
    if lp_by_sy <= lp_by_pt {
        // SY is limiting factor
        let lp_to_mint = lp_by_sy;
        let sy_used = sy_amount;
        // Round UP for PT: pt_used = (pt_reserve * lp_to_mint) / total_lp, ceiling
        let pt_used = div_up(*state.pt_reserve * lp_to_mint, *state.total_lp);

        (lp_to_mint, sy_used, pt_used, false)
    } else {
        // PT is limiting factor
        let lp_to_mint = lp_by_pt;
        let pt_used = pt_amount;
        // Round UP for SY: sy_used = (sy_reserve * lp_to_mint) / total_lp, ceiling
        let sy_used = div_up(*state.sy_reserve * lp_to_mint, *state.total_lp);

        (lp_to_mint, sy_used, pt_used, false)
    }
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
    // Pendle reverts on proportion > 96% (no clamping)
    let proportion = get_proportion(state);
    assert(proportion <= MAX_PROPORTION, Errors::MARKET_PROPORTION_TOO_HIGH);

    // Clamp to MIN for safety (MIN is soft bound, MAX is hard bound)
    let clamped_proportion = max(MIN_PROPORTION, proportion);

    // Step 4: Compute logit and exchange_rate = logit / rate_scalar + rate_anchor
    let (ln_proportion, ln_is_negative) = logit(clamped_proportion);
    let scaled_ln = wad_div(ln_proportion, rate_scalar);

    let exchange_rate = if ln_is_negative {
        // Proportion < 0.5, logit is negative: exchange_rate = rate_anchor - |scaled_ln|
        if scaled_ln >= rate_anchor {
            0_u256 // Will trigger revert below
        } else {
            rate_anchor - scaled_ln
        }
    } else {
        // Proportion >= 0.5, logit is positive: exchange_rate = rate_anchor + scaled_ln
        rate_anchor + scaled_ln
    };

    // Pendle reverts if exchange_rate < 1 (no flooring)
    assert(exchange_rate >= WAD, Errors::MARKET_RATE_BELOW_ONE);

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

/// Calculate fee multiplier based on rate impact
///
/// This function implements a dynamic fee mechanism that increases fees based on
/// how much a trade moves the exchange rate. Larger trades that cause more rate
/// impact pay proportionally higher fees, protecting LPs from adverse selection.
///
/// Formula: multiplier = 1 + sensitivity × |rate_after - rate_before| / rate_before
///
/// The multiplier is capped at MAX_FEE_MULTIPLIER (2x) to prevent excessive fees
/// even for very large trades.
///
/// @param rate_before Exchange rate before the trade (in WAD)
/// @param rate_after Exchange rate after the trade (in WAD)
/// @param sensitivity Sensitivity factor (in WAD). E.g., 0.1e18 = 10% sensitivity means
///                    a 10% rate change results in ~1% additional fee multiplier
/// @return Multiplier in WAD (1e18 = 1x, 1.5e18 = 1.5x, max 2e18 = 2x)
///
/// ## Failure Modes
/// - Returns WAD (1.0) if rate_before is 0 (prevents division by zero)
/// - Handles overflow by using safe WAD arithmetic
/// - Handles underflow by using abs_diff for rate changes
pub fn calc_rate_impact_multiplier(
    rate_before: u256, rate_after: u256, sensitivity: u256,
) -> u256 {
    // Guard against division by zero - if rate_before is 0, return no multiplier
    if rate_before == 0 {
        return WAD;
    }

    // If no rate change, return base multiplier (1.0)
    if rate_before == rate_after {
        return WAD;
    }

    // Calculate absolute rate change: |rate_after - rate_before|
    let rate_change = abs_diff(rate_after, rate_before);

    // Calculate rate change as a percentage of rate_before
    // rate_change_percent = rate_change / rate_before (in WAD)
    let rate_change_percent = wad_div(rate_change, rate_before);

    // Calculate the impact component: sensitivity × rate_change_percent
    // This gives us the additional multiplier above 1.0
    let impact_component = wad_mul(sensitivity, rate_change_percent);

    // Final multiplier = 1.0 + impact_component
    let multiplier = WAD + impact_component;

    // Cap at MAX_FEE_MULTIPLIER to prevent excessive fees
    min(multiplier, MAX_FEE_MULTIPLIER)
}
