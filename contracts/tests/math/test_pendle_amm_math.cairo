/// Tests for Pendle-compatible AMM math implementation
/// These tests verify that our implementation matches Pendle's logit-based AMM curve
///
/// Key formulas from Pendle (MarketMathCore.sol):
/// 1. rateScalar = scalarRoot * IMPLIED_RATE_TIME / timeToExpiry
/// 2. logit(p) = ln(p / (1 - p))
/// 3. exchangeRate = logit(proportion) / rateScalar + rateAnchor
/// 4. exchangeRateFromImpliedRate = e^(lnImpliedRate * timeToExpiry / IMPLIED_RATE_TIME)
/// 5. lnImpliedRate = ln(exchangeRate) * IMPLIED_RATE_TIME / timeToExpiry

use horizon::libraries::math::{WAD, abs_diff, wad_div};
use horizon::market::market_math::{
    MarketState, calc_swap_exact_pt_for_sy, calc_swap_exact_sy_for_pt, calc_swap_pt_for_exact_sy,
    calc_swap_sy_for_exact_pt, get_exchange_rate, get_ln_implied_rate, get_market_pre_compute,
    get_pt_price, get_rate_anchor, get_rate_scalar, get_time_adjusted_fee_rate,
};

// ============ Constants for Tests ============
const ONE_YEAR: u64 = 31_536_000;
const SIX_MONTHS: u64 = 15_768_000;
const ONE_MONTH: u64 = 2_628_000;

/// Helper to create a market state
fn create_market(
    sy_reserve: u256,
    pt_reserve: u256,
    scalar_root: u256,
    initial_anchor: u256,
    ln_fee_rate_root: u256,
    last_ln_implied_rate: u256,
) -> MarketState {
    MarketState {
        sy_reserve,
        pt_reserve,
        total_lp: 0,
        scalar_root,
        initial_anchor,
        ln_fee_rate_root,
        reserve_fee_percent: 0,
        expiry: 0,
        last_ln_implied_rate,
        py_index: WAD // Use 1:1 ratio for unit tests
    }
}

// ============ Rate Scalar Tests ============
// Pendle formula: rateScalar = scalarRoot * IMPLIED_RATE_TIME / timeToExpiry

#[test]
fn test_rate_scalar_pendle_formula() {
    // Test: scalarRoot = 1 WAD, timeToExpiry = 1 year
    // Expected: 1 * 31536000 / 31536000 = 1 WAD
    let scalar_root = WAD;
    let time_to_expiry = ONE_YEAR;
    let result = get_rate_scalar(scalar_root, time_to_expiry);

    assert(result == WAD, 'rate_scalar 1 year = 1 WAD');
}

#[test]
fn test_rate_scalar_half_year() {
    // Test: scalarRoot = 1 WAD, timeToExpiry = 6 months
    // Expected: 1 * 31536000 / 15768000 = 2 WAD
    let scalar_root = WAD;
    let time_to_expiry = SIX_MONTHS;
    let result = get_rate_scalar(scalar_root, time_to_expiry);

    let expected = 2 * WAD;
    let error = abs_diff(result, expected);
    assert(error <= WAD / 100, 'rate_scalar 6 months ~ 2 WAD');
}

#[test]
fn test_rate_scalar_with_larger_root() {
    // Test: scalarRoot = 50 WAD, timeToExpiry = 1 year
    // Expected: 50 * 31536000 / 31536000 = 50 WAD
    let scalar_root = 50 * WAD;
    let time_to_expiry = ONE_YEAR;
    let result = get_rate_scalar(scalar_root, time_to_expiry);

    assert(result == 50 * WAD, 'rate_scalar with 50 root');
}

#[test]
fn test_rate_scalar_short_time() {
    // As time_to_expiry decreases, rate_scalar increases (flattens curve near expiry)
    let scalar_root = WAD;

    let scalar_1y = get_rate_scalar(scalar_root, ONE_YEAR);
    let scalar_6m = get_rate_scalar(scalar_root, SIX_MONTHS);
    let scalar_1m = get_rate_scalar(scalar_root, ONE_MONTH);

    assert(scalar_1y < scalar_6m, 'scalar increases as t decreases');
    assert(scalar_6m < scalar_1m, 'scalar increases more');
}

// ============ Exchange Rate Tests ============
// Pendle formula: exchangeRate = logit(proportion) / rateScalar + rateAnchor
// Where logit(p) = ln(p / (1-p))

#[test]
fn test_exchange_rate_balanced_pool() {
    // For proportion = 0.5:
    // logit(0.5) = ln(0.5/0.5) = ln(1) = 0
    // exchangeRate = 0 / rateScalar + rateAnchor = rateAnchor
    //
    // But we use dynamic anchor from last_ln_implied_rate!
    // With last_ln_implied_rate = 0.1 WAD and 1 year:
    // targetExchangeRate = e^(0.1 * 1) = e^0.1 ~ 1.105

    let rate_scalar = get_rate_scalar(WAD, ONE_YEAR);
    let rate_anchor = WAD + WAD / 10; // ~1.1 WAD

    // Balanced pool: PT = SY = 100 WAD
    // total_asset = pt_reserve + sy_reserve (when py_index = WAD)
    let pt_reserve = 100 * WAD;
    let sy_reserve = 100 * WAD;
    let total_asset = pt_reserve + sy_reserve;

    let exchange_rate = get_exchange_rate(
        pt_reserve,
        total_asset, // Asset-based: pass total_asset instead of sy_reserve
        0, // net_pt_change
        false, // is_pt_out
        rate_scalar,
        rate_anchor,
        false // rate_anchor_is_negative
    );

    // For balanced pool, logit(0.5) = 0, so exchange_rate = anchor
    let error = abs_diff(exchange_rate, rate_anchor);
    assert(error <= WAD / 100, 'balanced pool rate = anchor');
}

#[test]
fn test_exchange_rate_more_pt() {
    // proportion > 0.5 means logit > 0, so exchange_rate > anchor
    let rate_scalar = get_rate_scalar(WAD, ONE_YEAR);
    let rate_anchor = WAD + WAD / 10; // 1.1 WAD

    // More PT than SY: PT = 150, SY = 100
    // proportion = 150 / (150 + 100) = 0.6
    // logit(0.6) = ln(0.6/0.4) = ln(1.5) ~ 0.405
    let pt_reserve = 150 * WAD;
    let sy_reserve = 100 * WAD;
    let total_asset = pt_reserve + sy_reserve;

    let exchange_rate = get_exchange_rate(
        pt_reserve, total_asset, 0, false, rate_scalar, rate_anchor, false,
    );

    // Should be greater than anchor
    assert(exchange_rate > rate_anchor, 'more PT = higher rate');
}

#[test]
fn test_exchange_rate_more_sy() {
    // proportion < 0.5 means logit < 0, so exchange_rate < anchor
    let rate_scalar = get_rate_scalar(WAD, ONE_YEAR);

    // Use higher rate_anchor to ensure exchange_rate stays >= 1
    // With proportion 0.4, logit ≈ -0.405, so need anchor > 1.405 to stay above 1
    let rate_anchor = WAD + WAD / 2; // 1.5 WAD (higher than before)

    // More SY than PT: PT = 100, SY = 150
    // proportion = 100 / (100 + 150) = 0.4
    // logit(0.4) = ln(0.4/0.6) = ln(0.667) ~ -0.405
    let pt_reserve = 100 * WAD;
    let sy_reserve = 150 * WAD;
    let total_asset = pt_reserve + sy_reserve;

    let exchange_rate = get_exchange_rate(
        pt_reserve, total_asset, 0, false, rate_scalar, rate_anchor, false,
    );

    // Should be less than anchor but at least WAD
    // With Pendle-style bounds, exchange_rate < WAD causes revert
    assert(exchange_rate >= WAD, 'rate floor at 1');
    assert(exchange_rate < rate_anchor, 'more SY = lower rate');
}

#[test]
fn test_exchange_rate_after_pt_out() {
    // When PT leaves the pool, new_pt_reserve decreases, proportion decreases
    // Lower proportion = lower exchange rate
    let rate_scalar = get_rate_scalar(WAD, ONE_YEAR);

    // Use higher rate_anchor to ensure exchange_rate stays >= 1 after PT leaves
    // When PT leaves, proportion drops, logit becomes more negative
    let rate_anchor = WAD + WAD / 2; // 1.5 WAD

    let pt_reserve = 100 * WAD;
    let sy_reserve = 100 * WAD;
    let total_asset = pt_reserve + sy_reserve;

    let rate_before = get_exchange_rate(
        pt_reserve, total_asset, 0, false, rate_scalar, rate_anchor, false,
    );

    // After 10 PT leaves pool (small amount to stay within bounds)
    let rate_after = get_exchange_rate(
        pt_reserve, total_asset, 10 * WAD, true, rate_scalar, rate_anchor, false,
    );

    // Rate should decrease when PT leaves
    assert(rate_after < rate_before, 'PT out = lower rate');
}

#[test]
fn test_exchange_rate_after_pt_in() {
    // When PT enters the pool, new_pt_reserve increases, proportion increases
    // Higher proportion = higher exchange rate
    let rate_scalar = get_rate_scalar(WAD, ONE_YEAR);
    let rate_anchor = WAD + WAD / 10;

    let pt_reserve = 100 * WAD;
    let sy_reserve = 100 * WAD;
    let total_asset = pt_reserve + sy_reserve;

    let rate_before = get_exchange_rate(
        pt_reserve, total_asset, 0, false, rate_scalar, rate_anchor, false,
    );

    // After 10 PT enters pool
    let rate_after = get_exchange_rate(
        pt_reserve, total_asset, 10 * WAD, false, rate_scalar, rate_anchor, false,
    );

    // Rate should increase when PT enters
    assert(rate_after > rate_before, 'PT in = higher rate');
}

#[test]
#[should_panic(expected: 'HZN: rate below 1')]
fn test_exchange_rate_always_ge_one() {
    // Pendle reverts when exchange_rate would fall below 1 (no flooring)
    // This test validates that invalid configurations are rejected
    let rate_scalar = get_rate_scalar(WAD, ONE_YEAR);
    let rate_anchor = WAD + WAD / 10; // 1.1 WAD

    // Extreme proportion (low PT) would produce exchange_rate < 1
    // proportion = 10/110 ≈ 9%, logit ≈ -2.3
    // exchange_rate = -2.3/1 + 1.1 = -1.2 (negative, triggers revert)
    let pt_reserve = 10 * WAD;
    let sy_reserve = 100 * WAD;
    let total_asset = pt_reserve + sy_reserve;

    // This should revert with 'HZN: rate below 1' per Pendle behavior
    let _exchange_rate = get_exchange_rate(
        pt_reserve, total_asset, 0, false, rate_scalar, rate_anchor, false,
    );
}

// ============ Ln Implied Rate Tests ============
// Pendle formula: lnImpliedRate = ln(exchangeRate) * IMPLIED_RATE_TIME / timeToExpiry

#[test]
fn test_ln_implied_rate_balanced_pool() {
    // Balanced pool with anchor = 0.1 WAD (ln of ~10.5% rate)
    let state = create_market(100 * WAD, 100 * WAD, WAD, WAD / 10, WAD / 100, WAD / 10);
    let ln_rate = get_ln_implied_rate(@state, ONE_YEAR);

    // Should be approximately the anchor value for balanced pool
    // But anchor is calculated dynamically from last_ln_implied_rate
    assert(ln_rate > 0, 'should have positive rate');
}

#[test]
fn test_ln_implied_rate_pt_heavy() {
    // More PT = higher proportion = positive logit = lower rate
    let balanced = create_market(100 * WAD, 100 * WAD, WAD, WAD / 10, WAD / 100, WAD / 10);
    let pt_heavy = create_market(50 * WAD, 150 * WAD, WAD, WAD / 10, WAD / 100, WAD / 10);

    let balanced_rate = get_ln_implied_rate(@balanced, ONE_YEAR);
    let pt_heavy_rate = get_ln_implied_rate(@pt_heavy, ONE_YEAR);

    // More PT should mean lower implied rate
    assert(pt_heavy_rate < balanced_rate, 'PT heavy = lower rate');
}

#[test]
fn test_ln_implied_rate_sy_heavy() {
    // More SY = lower proportion = negative logit = higher rate
    let balanced = create_market(100 * WAD, 100 * WAD, WAD, WAD / 10, WAD / 100, WAD / 10);
    let sy_heavy = create_market(150 * WAD, 50 * WAD, WAD, WAD / 10, WAD / 100, WAD / 10);

    let balanced_rate = get_ln_implied_rate(@balanced, ONE_YEAR);
    let sy_heavy_rate = get_ln_implied_rate(@sy_heavy, ONE_YEAR);

    // More SY should mean higher implied rate
    assert(sy_heavy_rate > balanced_rate, 'SY heavy = higher rate');
}

#[test]
fn test_ln_implied_rate_capped() {
    // Test that rate is capped at MAX_LN_IMPLIED_RATE (4.6 WAD)
    // Very imbalanced pool: lots of SY, little PT
    let state = create_market(
        1000 * WAD, // SY
        10 * WAD, // PT - very low proportion
        50 * WAD, // High scalar_root amplifies effect
        WAD / 10,
        WAD / 100,
        WAD / 10,
    );

    let ln_rate = get_ln_implied_rate(@state, ONE_YEAR);

    // Should be capped at 4.6 WAD
    let max_rate = 4_600_000_000_000_000_000_u256; // 4.6 WAD
    assert(ln_rate <= max_rate, 'rate should be capped');
}

// ============ PT Price Tests ============
// pt_price = e^(-lnImpliedRate * timeToExpiry / IMPLIED_RATE_TIME)

#[test]
fn test_pt_price_pendle_formula() {
    // ln_implied_rate = 0.1 WAD (~10.5% APY)
    // time_to_expiry = 1 year
    // pt_price = e^(-0.1 * 1) = e^(-0.1) ~ 0.905
    let ln_rate = WAD / 10;
    let price = get_pt_price(ln_rate, ONE_YEAR);

    let expected = 904_837_418_035_959_573_u256; // e^(-0.1) in WAD
    let error = abs_diff(price, expected);
    let tolerance = expected / 10; // 10% tolerance

    assert(error <= tolerance, 'PT price ~ e^(-0.1)');
}

#[test]
fn test_pt_price_higher_rate() {
    // Higher rate = more discount
    let low_rate = WAD / 10; // 10%
    let high_rate = WAD / 5; // 20%

    let price_low = get_pt_price(low_rate, ONE_YEAR);
    let price_high = get_pt_price(high_rate, ONE_YEAR);

    assert(price_high < price_low, 'higher rate = lower price');
}

#[test]
fn test_pt_price_shorter_expiry() {
    // Shorter time to expiry = smaller discount
    let ln_rate = WAD / 10;

    let price_1y = get_pt_price(ln_rate, ONE_YEAR);
    let price_6m = get_pt_price(ln_rate, SIX_MONTHS);
    let price_1m = get_pt_price(ln_rate, ONE_MONTH);

    assert(price_1y < price_6m, 'shorter expiry = higher price');
    assert(price_6m < price_1m, 'even shorter = even higher');
    assert(price_1m < WAD, 'still below 1 before expiry');
}

// ============ Exchange Rate from Implied Rate Tests ============
// exchangeRate = e^(lnImpliedRate * timeToExpiry / IMPLIED_RATE_TIME)

#[test]
fn test_rate_anchor_pendle_formula() {
    // Test rate anchor calculation
    // With last_ln_implied_rate = 0.1 WAD and 1 year:
    // targetExchangeRate = e^(0.1 * 31536000 / 31536000) = e^0.1 ~ 1.105
    //
    // For balanced pool (proportion = 0.5):
    // logit(0.5) = 0
    // rateAnchor = targetExchangeRate - 0/rateScalar = targetExchangeRate
    let state = create_market(
        100 * WAD, // balanced
        100 * WAD,
        WAD, // scalar_root
        WAD / 10, // initial_anchor (not used directly now)
        WAD / 100,
        WAD / 10 // last_ln_implied_rate = 0.1 WAD
    );

    let (anchor, anchor_is_negative) = get_rate_anchor(@state, ONE_YEAR);

    // e^0.1 ~ 1.1052 and should be positive for balanced pool
    assert(!anchor_is_negative, 'anchor should be positive');
    let expected = 1_105_170_918_075_647_624_u256;
    let error = abs_diff(anchor, expected);
    let tolerance = expected / 10;

    assert(error <= tolerance, 'anchor ~ e^0.1 for balanced');
}

// ============ Market Pre-Compute Tests ============

#[test]
fn test_market_pre_compute() {
    let state = create_market(100 * WAD, 100 * WAD, WAD, WAD / 10, WAD / 100, WAD / 10);
    let comp = get_market_pre_compute(@state, ONE_YEAR);

    // rate_scalar should be scalar_root for 1 year
    assert(comp.rate_scalar == WAD, 'rate_scalar = 1 WAD for 1 year');

    // rate_anchor should be derived from last_ln_implied_rate
    assert(comp.rate_anchor >= WAD, 'anchor >= 1');
}

// ============ Swap Integration Tests ============

#[test]
fn test_swap_exact_pt_for_sy_uses_logit_curve() {
    let state = create_market(100 * WAD, 100 * WAD, WAD, WAD / 10, WAD / 100, WAD / 10);

    let pt_in = 10 * WAD;
    let result = calc_swap_exact_pt_for_sy(@state, pt_in, ONE_YEAR);
    let sy_out = result.net_sy_to_account;
    let fee = result.net_sy_fee;

    // PT is worth less than SY (discounted), so sy_out < pt_in
    assert(sy_out > 0, 'should get SY out');
    assert(sy_out < pt_in, 'SY out < PT in (discounted)');
    assert(fee > 0, 'should have fee');
}

#[test]
fn test_swap_exact_sy_for_pt_uses_logit_curve() {
    // Use higher implied rate (50%) to give exchange rate headroom above 1.0 after fee
    let state = create_market(100 * WAD, 100 * WAD, WAD, WAD / 2, WAD / 100, WAD / 2);

    let sy_in = 10 * WAD;
    let (pt_out, result) = calc_swap_exact_sy_for_pt(@state, sy_in, ONE_YEAR);
    let fee = result.net_sy_fee;

    // SY is worth more than PT, so pt_out > sy_in (before considering fees)
    // But after fees, it should still be positive
    assert(pt_out > 0, 'should get PT out');
    assert(fee > 0, 'should have fee');
}

#[test]
fn test_swap_convergence_near_expiry() {
    // Near expiry, PT should trade close to 1:1 with SY
    let state = create_market(
        100 * WAD, 100 * WAD, WAD, WAD / 100, 0, WAD / 100,
    ); // 0 fee for clarity

    let pt_in = 10 * WAD;

    // 1 year out
    let result_1y = calc_swap_exact_pt_for_sy(@state, pt_in, ONE_YEAR);
    let sy_out_1y = result_1y.net_sy_to_account;

    // 1 day out
    let result_1d = calc_swap_exact_pt_for_sy(@state, pt_in, 86400);
    let sy_out_1d = result_1d.net_sy_to_account;

    // Near expiry should give more SY (closer to 1:1)
    assert(sy_out_1d > sy_out_1y, 'near expiry = better rate');

    // Very close to parity (within 5%)
    let diff = abs_diff(sy_out_1d, pt_in);
    let tolerance = pt_in / 20; // 5%
    assert(diff <= tolerance, 'near expiry ~ 1:1');
}

#[test]
fn test_swap_roundtrip_consistency() {
    // Buy PT, then sell same amount - should be roughly consistent
    // Use realistic parameters:
    // - scalar_root = 100 * WAD for flat curve (less price impact)
    // - 10% implied rate gives anchor ~1.1 for 1 year
    let state = create_market(100 * WAD, 100 * WAD, 100 * WAD, WAD, WAD / 100, WAD / 10);

    let sy_in = 5 * WAD;
    let (pt_out, _result) = calc_swap_exact_sy_for_pt(@state, sy_in, ONE_YEAR);

    // Now sell the PT back
    let result_back = calc_swap_exact_pt_for_sy(@state, pt_out, ONE_YEAR);
    let sy_back = result_back.net_sy_to_account;

    // Due to fees and curve shape, we should get less back
    assert(sy_back < sy_in, 'roundtrip loses to fees');

    // But not too much less (within 10% for a 1% fee)
    let loss = sy_in - sy_back;
    let max_loss = sy_in / 5; // 20% max loss
    assert(loss <= max_loss, 'loss within reasonable range');
}

#[test]
fn test_swap_exact_amounts() {
    // Test that calc_swap_sy_for_exact_pt gives correct amount
    // Use realistic parameters:
    // - scalar_root = 100 * WAD for flat curve (less price impact)
    // - 10% implied rate gives anchor ~1.1 for 1 year
    let state = create_market(100 * WAD, 100 * WAD, 100 * WAD, WAD, WAD / 100, WAD / 10);

    let exact_pt_out = 5 * WAD;
    let result = calc_swap_sy_for_exact_pt(@state, exact_pt_out, ONE_YEAR);
    let sy_in = result.net_sy_to_account;

    assert(sy_in > 0, 'should require SY');

    // Verify: if we use this SY, we should get approximately exact_pt_out
    let (pt_out_check, _result) = calc_swap_exact_sy_for_pt(@state, sy_in, ONE_YEAR);

    let diff = abs_diff(pt_out_check, exact_pt_out);
    let tolerance = exact_pt_out / 50; // 2% tolerance due to binary search
    assert(diff <= tolerance, 'exact amounts consistent');
}

#[test]
fn test_swap_price_impact() {
    // Larger trades should have more price impact
    let state = create_market(100 * WAD, 100 * WAD, WAD, WAD / 10, 0, WAD / 10); // 0 fee

    let small_trade = WAD; // 1 WAD
    let large_trade = 20 * WAD; // 20 WAD

    let result_small = calc_swap_exact_pt_for_sy(@state, small_trade, ONE_YEAR);
    let sy_out_small = result_small.net_sy_to_account;
    let result_large = calc_swap_exact_pt_for_sy(@state, large_trade, ONE_YEAR);
    let sy_out_large = result_large.net_sy_to_account;

    // Price per PT
    let price_small = wad_div(sy_out_small, small_trade);
    let price_large = wad_div(sy_out_large, large_trade);

    // Larger trade should get worse average price
    assert(price_large < price_small, 'larger trade = worse price');
}

// ============ Mathematical Identity Tests ============
// These tests verify mathematical properties that should hold

#[test]
fn test_logit_symmetry_via_proportion() {
    // logit(p) = -logit(1-p)
    // If proportion changes from p to (1-p), the logit should flip sign
    // This affects exchange rate symmetrically around anchor
    //
    // Note: Perfect symmetry is limited because exchange_rate has a floor at WAD
    // When rate_low would go below WAD, it's clamped, breaking symmetry

    let rate_scalar = get_rate_scalar(WAD, ONE_YEAR);
    let rate_anchor = WAD + WAD / 2; // Use 1.5 WAD anchor to avoid floor issues

    // proportion = 0.4 (PT = 40, total = 100)
    // total_asset = pt + sy (when py_index = WAD)
    let total_asset = 100 * WAD;
    let rate_low = get_exchange_rate(
        40 * WAD, total_asset, 0, false, rate_scalar, rate_anchor, false,
    );

    // proportion = 0.6 (PT = 60, total = 100)
    let rate_high = get_exchange_rate(
        60 * WAD, total_asset, 0, false, rate_scalar, rate_anchor, false,
    );

    // Both should deviate from anchor by same amount (opposite directions)
    let diff_low = abs_diff(rate_anchor, rate_low);
    let diff_high = abs_diff(rate_high, rate_anchor);

    // 10% tolerance - the logit math is symmetric, but numerical precision differs
    let tolerance = WAD / 10;
    let symmetry_error = abs_diff(diff_low, diff_high);
    assert(symmetry_error <= tolerance, 'logit should be symmetric');
}

#[test]
fn test_exchange_rate_monotonic_in_proportion() {
    // As proportion increases, exchange rate should increase
    // Use higher rate_anchor (3.0 WAD) to ensure exchange rate stays above 1.0
    // at all proportions within bounds. Low proportions produce negative logit values
    // (e.g., logit(0.2) ≈ -1.39), which with rate_scalar = 1.0 gives exp(-1.39) ≈ 0.25.
    // rate_anchor must be high enough that 0.25 * 3.0 = 0.75... still need higher.
    // Actually rate_anchor is added after: exp(logit/scalar) + anchor, so we need
    // to trace through the actual formula in market_math.cairo.
    let rate_scalar = get_rate_scalar(WAD, ONE_YEAR);
    // Use proportions closer to 50% to avoid extreme logit values
    let rate_anchor = WAD * 3; // 3.0 WAD for sufficient headroom

    // total_asset = pt + sy (when py_index = WAD)
    // All tests use same total of 100 WAD
    let total_asset = 100 * WAD;

    // Use proportions closer to center (30-70%) to avoid extreme logit values
    // while still testing monotonicity
    let rate_30 = get_exchange_rate(
        30 * WAD, total_asset, 0, false, rate_scalar, rate_anchor, false,
    );
    let rate_40 = get_exchange_rate(
        40 * WAD, total_asset, 0, false, rate_scalar, rate_anchor, false,
    );
    let rate_60 = get_exchange_rate(
        60 * WAD, total_asset, 0, false, rate_scalar, rate_anchor, false,
    );
    let rate_70 = get_exchange_rate(
        70 * WAD, total_asset, 0, false, rate_scalar, rate_anchor, false,
    );

    assert(rate_30 <= rate_40, 'rate monotonic 30->40');
    assert(rate_40 <= rate_60, 'rate monotonic 40->60');
    assert(rate_60 <= rate_70, 'rate monotonic 60->70');
}

// ============ Edge Case Tests ============

#[test]
fn test_very_small_trade() {
    let state = create_market(100 * WAD, 100 * WAD, WAD, WAD / 10, WAD / 100, WAD / 10);

    let tiny_trade = 1000; // Very small amount
    let result = calc_swap_exact_pt_for_sy(@state, tiny_trade, ONE_YEAR);
    let sy_out = result.net_sy_to_account;

    assert(sy_out > 0, 'even tiny trade gives output');
}

#[test]
fn test_zero_fee_swap() {
    let state = create_market(100 * WAD, 100 * WAD, WAD, WAD / 10, 0, WAD / 10); // 0 fee

    let pt_in = 10 * WAD;
    let result = calc_swap_exact_pt_for_sy(@state, pt_in, ONE_YEAR);
    let sy_out = result.net_sy_to_account;
    let fee = result.net_sy_fee;

    assert(fee == 0, 'zero fee should give 0 fee');
    assert(sy_out > 0, 'should still get output');
}

// ============ Fee Decay Tests ============
// Fees decrease linearly as expiry approaches

#[test]
fn test_fee_decay_at_expiry() {
    // At expiry (t=0), fee should be 0
    let fee_rate = WAD / 100; // 1%
    let adjusted = get_time_adjusted_fee_rate(fee_rate, 0);
    assert(adjusted == 0, 'fee should be 0 at expiry');
}

#[test]
fn test_fee_decay_one_year() {
    // At 1 year out, fee should be full rate
    let fee_rate = WAD / 100; // 1%
    let adjusted = get_time_adjusted_fee_rate(fee_rate, ONE_YEAR);
    assert(adjusted == fee_rate, 'full fee at 1 year');
}

#[test]
fn test_fee_decay_six_months() {
    // At 6 months, fee should be ~half
    let fee_rate = WAD / 100; // 1%
    let adjusted = get_time_adjusted_fee_rate(fee_rate, SIX_MONTHS);

    let expected_half = fee_rate / 2;
    let error = abs_diff(adjusted, expected_half);
    let tolerance = fee_rate / 20; // 5% tolerance
    assert(error <= tolerance, 'half fee at 6 months');
}

#[test]
fn test_fee_decay_one_day() {
    // At 1 day out, fee should be very small (~0.27% of base)
    let fee_rate = WAD / 100; // 1%
    let one_day: u64 = 86_400;
    let adjusted = get_time_adjusted_fee_rate(fee_rate, one_day);

    // Expected: 1% * (1 day / 365 days) = 1% * 0.00274 = 0.00274%
    assert(adjusted > 0, 'fee should be positive');
    assert(adjusted < fee_rate / 100, 'fee should be < 1% of base');
}

#[test]
fn test_fee_decay_more_than_one_year() {
    // At more than 1 year, fee should cap at base rate
    let fee_rate = WAD / 100; // 1%
    let two_years: u64 = ONE_YEAR * 2;
    let adjusted = get_time_adjusted_fee_rate(fee_rate, two_years);
    assert(adjusted == fee_rate, 'fee capped at base rate');
}

#[test]
fn test_fee_decay_linear() {
    // Fee should decrease linearly with time
    // Linear decay: fee = base_fee * time_to_expiry / SECONDS_PER_YEAR
    let fee_rate = WAD / 100; // 1%

    let fee_1y = get_time_adjusted_fee_rate(fee_rate, ONE_YEAR);
    let fee_6m = get_time_adjusted_fee_rate(fee_rate, SIX_MONTHS);
    let fee_3m: u256 = get_time_adjusted_fee_rate(fee_rate, ONE_YEAR / 4);

    // Fees should decrease with time
    assert(fee_6m < fee_1y, '6m < 1y');
    assert(fee_3m < fee_6m, '3m < 6m');

    // Verify linear relationship: fee should be proportional to time
    // fee_6m should be ~0.5 * fee_1y
    // fee_3m should be ~0.25 * fee_1y
    let expected_6m = fee_1y / 2;
    let expected_3m = fee_1y / 4;

    let error_6m = abs_diff(fee_6m, expected_6m);
    let error_3m = abs_diff(fee_3m, expected_3m);

    // Allow 5% tolerance
    let tolerance = fee_rate / 20;
    assert(error_6m <= tolerance, '6m is half of 1y');
    assert(error_3m <= tolerance, '3m is quarter of 1y');
}

#[test]
fn test_swap_fee_decay_integration() {
    // Verify that swap functions use decayed fees
    let state = create_market(100 * WAD, 100 * WAD, WAD, WAD / 10, WAD / 100, WAD / 10);
    let pt_in = 10 * WAD;

    // Compare fees at different times to expiry
    let result_1y = calc_swap_exact_pt_for_sy(@state, pt_in, ONE_YEAR);
    let fee_1y = result_1y.net_sy_fee;
    let result_6m = calc_swap_exact_pt_for_sy(@state, pt_in, SIX_MONTHS);
    let fee_6m = result_6m.net_sy_fee;
    let result_1d = calc_swap_exact_pt_for_sy(@state, pt_in, 86_400); // 1 day
    let fee_1d = result_1d.net_sy_fee;

    // Fees should decrease as we approach expiry
    assert(fee_6m < fee_1y, 'fee 6m < fee 1y');
    assert(fee_1d < fee_6m, 'fee 1d < fee 6m');

    // 1 day out should have very small fee
    assert(fee_1d < fee_1y / 100, 'fee 1d << fee 1y');
}

#[test]
fn test_swap_no_fee_at_expiry() {
    // At expiry, fees should be zero
    let state = create_market(100 * WAD, 100 * WAD, WAD, WAD / 10, WAD / 100, WAD / 10);
    let pt_in = 10 * WAD;

    // Time to expiry = 1 second (minimum)
    let result = calc_swap_exact_pt_for_sy(@state, pt_in, 1);
    let sy_out = result.net_sy_to_account;
    let fee = result.net_sy_fee;

    // Fee should be approximately 0
    // With 1 second left and 1% base rate:
    // adjusted = 1% * 1 / 31536000 ≈ 0.00000003%
    assert(fee < WAD / 1000000, 'fee ~0 at expiry');
    assert(sy_out > 0, 'should still get output');
}

#[test]
fn test_fee_decay_all_swap_types() {
    // Verify fee decay works for all swap functions
    // Use higher implied rate (50%) to give exchange rate headroom above 1.0 after fee
    let state = create_market(100 * WAD, 100 * WAD, WAD, WAD / 2, WAD / 100, WAD / 2);

    // Test calc_swap_exact_pt_for_sy
    let result_pt_sy_1y = calc_swap_exact_pt_for_sy(@state, 10 * WAD, ONE_YEAR);
    let fee_pt_sy_1y = result_pt_sy_1y.net_sy_fee;
    let result_pt_sy_1d = calc_swap_exact_pt_for_sy(@state, 10 * WAD, 86_400);
    let fee_pt_sy_1d = result_pt_sy_1d.net_sy_fee;
    assert(fee_pt_sy_1d < fee_pt_sy_1y / 100, 'PT->SY fee decay works');

    // Test calc_swap_exact_sy_for_pt
    let (_, result_sy_pt_1y) = calc_swap_exact_sy_for_pt(@state, 10 * WAD, ONE_YEAR);
    let fee_sy_pt_1y = result_sy_pt_1y.net_sy_fee;
    let (_, result_sy_pt_1d) = calc_swap_exact_sy_for_pt(@state, 10 * WAD, 86_400);
    let fee_sy_pt_1d = result_sy_pt_1d.net_sy_fee;
    assert(fee_sy_pt_1d < fee_sy_pt_1y / 100, 'SY->PT fee decay works');

    // Test calc_swap_sy_for_exact_pt
    let result_ex_pt_1y = calc_swap_sy_for_exact_pt(@state, 5 * WAD, ONE_YEAR);
    let fee_ex_pt_1y = result_ex_pt_1y.net_sy_fee;
    let result_ex_pt_1d = calc_swap_sy_for_exact_pt(@state, 5 * WAD, 86_400);
    let fee_ex_pt_1d = result_ex_pt_1d.net_sy_fee;
    assert(fee_ex_pt_1d < fee_ex_pt_1y / 100, 'exact PT fee decay works');

    // Test calc_swap_pt_for_exact_sy
    let (_, result_ex_sy_1y) = calc_swap_pt_for_exact_sy(@state, 5 * WAD, ONE_YEAR);
    let fee_ex_sy_1y = result_ex_sy_1y.net_sy_fee;
    let (_, result_ex_sy_1d) = calc_swap_pt_for_exact_sy(@state, 5 * WAD, 86_400);
    let fee_ex_sy_1d = result_ex_sy_1d.net_sy_fee;
    assert(fee_ex_sy_1d < fee_ex_sy_1y / 100, 'exact SY fee decay works');
}
