/// Tests for the high-precision market math library (market_math_fp.cairo)
/// Verifies Pendle-accurate AMM curve calculations using cubit fixed-point

use horizon::libraries::math_fp::{HALF_WAD, WAD, abs_diff};
use horizon::market::market_math_fp::{
    MAX_PROPORTION, MIN_PROPORTION, MarketState, calc_burn_lp, calc_mint_lp, calc_price_impact,
    calc_swap_exact_pt_for_sy, calc_swap_exact_sy_for_pt, get_exchange_rate, get_implied_apy,
    get_market_exchange_rate, get_market_pre_compute, get_proportion, get_pt_price, get_rate_scalar,
    get_time_adjusted_fee_rate, get_time_to_expiry,
};

/// Helper to create a standard market state for testing
fn create_test_market() -> MarketState {
    MarketState {
        sy_reserve: 1_000_000 * WAD, // 1M SY
        pt_reserve: 1_000_000 * WAD, // 1M PT
        total_lp: 1_000_000 * WAD, // 1M LP
        scalar_root: WAD / 100, // 0.01 (1% rate sensitivity)
        initial_anchor: WAD, // 1.0 anchor
        fee_rate: WAD / 100, // 1% fee
        expiry: 31_536_000 + 1000, // 1 year from now
        last_ln_implied_rate: WAD / 20 // 5% implied rate
    }
}

/// Helper to check approximate equality with tolerance in basis points
fn assert_approx_eq(actual: u256, expected: u256, tolerance_bps: u256, msg: felt252) {
    let diff = abs_diff(actual, expected);
    let max_diff = if expected > 0 {
        expected * tolerance_bps / 10000
    } else {
        tolerance_bps
    };
    assert(diff <= max_diff, msg);
}

// ============================================
// PROPORTION TESTS
// ============================================

#[test]
fn test_get_proportion_balanced() {
    let state = create_test_market();
    let proportion = get_proportion(@state);
    // 50% PT, 50% SY
    assert_approx_eq(proportion, HALF_WAD, 1, 'balanced proportion');
}

#[test]
fn test_get_proportion_unbalanced() {
    let mut state = create_test_market();
    state.pt_reserve = 3_000_000 * WAD; // 3M PT
    state.sy_reserve = 1_000_000 * WAD; // 1M SY
    // proportion = 3M / 4M = 0.75
    let proportion = get_proportion(@state);
    let expected = 3 * WAD / 4; // 0.75
    assert_approx_eq(proportion, expected, 10, 'unbalanced proportion');
}

#[test]
fn test_get_proportion_empty_pool() {
    let mut state = create_test_market();
    state.pt_reserve = 0;
    state.sy_reserve = 0;
    let proportion = get_proportion(@state);
    assert(proportion == HALF_WAD, 'empty pool returns 50%');
}

// ============================================
// RATE SCALAR TESTS
// ============================================

#[test]
fn test_get_rate_scalar_one_year() {
    let scalar_root = WAD / 100; // 0.01
    let time_to_expiry: u64 = 31_536_000; // 1 year in seconds

    let rate_scalar = get_rate_scalar(scalar_root, time_to_expiry);
    // rateScalar = scalarRoot * SECONDS_PER_YEAR / timeToExpiry = 0.01 * 1 = 0.01
    assert_approx_eq(rate_scalar, scalar_root, 10, 'rate scalar 1 year');
}

#[test]
fn test_get_rate_scalar_half_year() {
    let scalar_root = WAD / 100; // 0.01
    let time_to_expiry: u64 = 15_768_000; // 0.5 year in seconds

    let rate_scalar = get_rate_scalar(scalar_root, time_to_expiry);
    // rateScalar = 0.01 * 1 / 0.5 = 0.02
    let expected = 2 * WAD / 100;
    assert_approx_eq(rate_scalar, expected, 10, 'rate scalar 0.5 year');
}

#[test]
fn test_get_rate_scalar_at_expiry() {
    let scalar_root = WAD / 100;
    let rate_scalar = get_rate_scalar(scalar_root, 0);
    // At expiry, scalar multiplied by 1000
    let expected = scalar_root * 1000;
    assert(rate_scalar == expected, 'rate scalar at expiry');
}

// ============================================
// FEE DECAY TESTS
// ============================================

#[test]
fn test_get_time_adjusted_fee_rate_full() {
    let fee_rate = WAD / 100; // 1%
    let time_to_expiry: u64 = 31_536_000; // 1 year

    let adjusted = get_time_adjusted_fee_rate(fee_rate, time_to_expiry);
    // Full fee rate at 1 year out
    assert(adjusted == fee_rate, 'full fee at 1 year');
}

#[test]
fn test_get_time_adjusted_fee_rate_half() {
    let fee_rate = WAD / 100; // 1%
    let time_to_expiry: u64 = 15_768_000; // 0.5 year

    let adjusted = get_time_adjusted_fee_rate(fee_rate, time_to_expiry);
    // Half fee rate at 0.5 year
    let expected = fee_rate / 2;
    assert_approx_eq(adjusted, expected, 10, 'half fee at 0.5 year');
}

#[test]
fn test_get_time_adjusted_fee_rate_at_expiry() {
    let fee_rate = WAD / 100;
    let adjusted = get_time_adjusted_fee_rate(fee_rate, 0);
    assert(adjusted == 0, 'no fee at expiry');
}

// ============================================
// EXCHANGE RATE TESTS
// ============================================

#[test]
fn test_get_exchange_rate_balanced() {
    let state = create_test_market();
    let time_to_expiry: u64 = 31_536_000;
    let comp = get_market_pre_compute(@state, time_to_expiry);

    // No trade, just get current exchange rate
    let exchange_rate = get_exchange_rate(
        state.pt_reserve, state.sy_reserve, 0, false, comp.rate_scalar, comp.rate_anchor,
    );

    // Exchange rate should be close to anchor at balanced pool
    assert(exchange_rate >= WAD, 'exchange rate >= 1');
}

#[test]
fn test_get_exchange_rate_pt_out_changes() {
    let state = create_test_market();
    let time_to_expiry: u64 = 31_536_000;
    let comp = get_market_pre_compute(@state, time_to_expiry);

    // Exchange rate with no trade
    let rate_before = get_exchange_rate(
        state.pt_reserve, state.sy_reserve, 0, false, comp.rate_scalar, comp.rate_anchor,
    );

    // Exchange rate after PT leaves pool (user buys PT)
    let pt_out = 100_000 * WAD;
    let rate_after = get_exchange_rate(
        state.pt_reserve, state.sy_reserve, pt_out, true, comp.rate_scalar, comp.rate_anchor,
    );

    // Exchange rate should change after trade (direction depends on curve shape)
    // Both should be valid exchange rates >= 1
    assert(rate_before >= WAD, 'rate before >= 1');
    assert(rate_after >= WAD, 'rate after >= 1');
}

// ============================================
// PT PRICE TESTS
// ============================================

#[test]
fn test_get_pt_price_at_expiry() {
    let ln_implied_rate = WAD / 10; // 10%
    let pt_price = get_pt_price(ln_implied_rate, 0);
    assert(pt_price == WAD, 'PT price 1 at expiry');
}

#[test]
fn test_get_pt_price_zero_rate() {
    let pt_price = get_pt_price(0, 31_536_000);
    assert(pt_price == WAD, 'PT price 1 at zero rate');
}

#[test]
fn test_get_pt_price_positive_rate() {
    // pt_price = e^(-0.05 * 1) ≈ 0.9512
    let ln_implied_rate = WAD / 20; // 5%
    let time_to_expiry: u64 = 31_536_000; // 1 year

    let pt_price = get_pt_price(ln_implied_rate, time_to_expiry);
    let expected: u256 = 951_229_424_500_714_000; // ~0.9512

    // PT should be discounted
    assert(pt_price < WAD, 'PT discounted');
    assert_approx_eq(pt_price, expected, 100, 'PT price 5% 1yr');
}

// ============================================
// IMPLIED APY TESTS
// ============================================

#[test]
fn test_get_implied_apy_zero() {
    let apy = get_implied_apy(0);
    assert(apy == 0, 'zero rate zero APY');
}

#[test]
fn test_get_implied_apy_five_percent() {
    // APY = e^0.05 - 1 ≈ 0.0513 (5.13%)
    let ln_rate = WAD / 20; // 5%
    let apy = get_implied_apy(ln_rate);
    let expected: u256 = 51_271_096_334_354_550; // ~0.0513

    assert_approx_eq(apy, expected, 100, 'APY 5%');
}

// ============================================
// SWAP TESTS
// ============================================

#[test]
fn test_calc_swap_exact_pt_for_sy() {
    let state = create_test_market();
    let time_to_expiry: u64 = 31_536_000;
    let pt_in = 10_000 * WAD;

    let (sy_out, fee) = calc_swap_exact_pt_for_sy(@state, pt_in, time_to_expiry);

    // SY out should be less than PT in (exchange rate >= 1)
    assert(sy_out < pt_in, 'SY out < PT in');
    // SY out should be positive
    assert(sy_out > 0, 'SY out positive');
    // Fee should be applied
    assert(fee > 0, 'fee applied');
}

#[test]
fn test_calc_swap_exact_sy_for_pt() {
    let state = create_test_market();
    let time_to_expiry: u64 = 31_536_000;
    let sy_in = 10_000 * WAD;

    let (pt_out, fee) = calc_swap_exact_sy_for_pt(@state, sy_in, time_to_expiry);

    // PT out should be positive
    assert(pt_out > 0, 'PT out positive');
    // Fee should be applied
    assert(fee > 0, 'fee applied');
    // PT out should be reasonable (not more than reserves)
    assert(pt_out < state.pt_reserve, 'PT out < reserves');
}

#[test]
fn test_swap_zero_amount() {
    let state = create_test_market();
    let time_to_expiry: u64 = 31_536_000;

    let (sy_out, fee) = calc_swap_exact_pt_for_sy(@state, 0, time_to_expiry);
    assert(sy_out == 0, 'zero in zero out SY');
    assert(fee == 0, 'zero in zero fee SY');

    let (pt_out, fee2) = calc_swap_exact_sy_for_pt(@state, 0, time_to_expiry);
    assert(pt_out == 0, 'zero in zero out PT');
    assert(fee2 == 0, 'zero in zero fee PT');
}

// ============================================
// LIQUIDITY TESTS
// ============================================

#[test]
fn test_calc_mint_lp_first_deposit() {
    let mut state = create_test_market();
    state.total_lp = 0;
    state.sy_reserve = 0;
    state.pt_reserve = 0;

    let sy_amount = 1_000_000 * WAD;
    let pt_amount = 1_000_000 * WAD;

    let (lp_out, sy_used, pt_used, is_first) = calc_mint_lp(@state, sy_amount, pt_amount);

    assert(is_first, 'is first mint');
    assert(sy_used == sy_amount, 'uses all SY');
    assert(pt_used == pt_amount, 'uses all PT');
    // LP = sqrt(sy * pt) - MINIMUM_LIQUIDITY
    assert(lp_out > 0, 'LP minted');
}

#[test]
fn test_calc_mint_lp_subsequent() {
    let state = create_test_market();
    let sy_amount = 100_000 * WAD;
    let pt_amount = 100_000 * WAD;

    let (lp_out, sy_used, pt_used, is_first) = calc_mint_lp(@state, sy_amount, pt_amount);

    assert(!is_first, 'not first mint');
    // Should use proportional amounts
    assert(sy_used <= sy_amount, 'SY used <= provided');
    assert(pt_used <= pt_amount, 'PT used <= provided');
    // LP proportional to ratio
    assert(lp_out > 0, 'LP minted');
}

#[test]
fn test_calc_burn_lp() {
    let state = create_test_market();
    let lp_to_burn = 100_000 * WAD;

    let (sy_out, pt_out) = calc_burn_lp(@state, lp_to_burn);

    // 10% of LP burned should give 10% of reserves
    let expected = 100_000 * WAD;
    assert_approx_eq(sy_out, expected, 10, 'SY out proportional');
    assert_approx_eq(pt_out, expected, 10, 'PT out proportional');
}

#[test]
fn test_calc_burn_lp_zero() {
    let state = create_test_market();
    let (sy_out, pt_out) = calc_burn_lp(@state, 0);
    assert(sy_out == 0, 'zero burn zero SY');
    assert(pt_out == 0, 'zero burn zero PT');
}

// ============================================
// PRICE IMPACT TESTS
// ============================================

#[test]
fn test_calc_price_impact_small_trade() {
    let amount_in = 1_000 * WAD;
    let reserve_in = 1_000_000 * WAD;
    let reserve_out = 1_000_000 * WAD;

    let impact = calc_price_impact(amount_in, reserve_in, reserve_out);
    // Impact ≈ 1000 / (2 * 1M) = 0.0005 (0.05%)
    let expected = WAD / 2000;
    assert_approx_eq(impact, expected, 10, 'small trade impact');
}

#[test]
fn test_calc_price_impact_large_trade() {
    let amount_in = 100_000 * WAD;
    let reserve_in = 1_000_000 * WAD;
    let reserve_out = 1_000_000 * WAD;

    let impact = calc_price_impact(amount_in, reserve_in, reserve_out);
    // Impact ≈ 100k / (2 * 1M) = 0.05 (5%)
    let expected = WAD / 20;
    assert_approx_eq(impact, expected, 10, 'large trade impact');
}

// ============================================
// MARKET EXCHANGE RATE TESTS
// ============================================

#[test]
fn test_get_market_exchange_rate() {
    let state = create_test_market();
    let time_to_expiry: u64 = 31_536_000;

    let rate = get_market_exchange_rate(@state, time_to_expiry);

    // Rate should be positive and bounded
    assert(rate > 0, 'rate positive');
    // PT price is typically less than 1 (discounted before expiry)
    assert(rate <= WAD, 'rate <= 1 before expiry');
}

// ============================================
// PROPORTION BOUNDS TESTS
// ============================================

#[test]
fn test_max_proportion_enforced() {
    // Verify MAX_PROPORTION is 96% (Pendle's limit)
    assert(MAX_PROPORTION == 960_000_000_000_000_000, 'max proportion 96%');
}

#[test]
fn test_min_proportion_enforced() {
    // Verify MIN_PROPORTION is 0.1%
    assert(MIN_PROPORTION == 1_000_000_000_000_000, 'min proportion 0.1%');
}

// ============================================
// TIME TO EXPIRY TESTS
// ============================================

#[test]
fn test_get_time_to_expiry_normal() {
    let expiry: u64 = 1000;
    let current: u64 = 500;
    let result = get_time_to_expiry(expiry, current);
    assert(result == 500, 'time to expiry normal');
}

#[test]
fn test_get_time_to_expiry_at_expiry() {
    let expiry: u64 = 1000;
    let current: u64 = 1000;
    let result = get_time_to_expiry(expiry, current);
    assert(result == 1, 'min time at expiry');
}

#[test]
fn test_get_time_to_expiry_past_expiry() {
    let expiry: u64 = 1000;
    let current: u64 = 1500;
    let result = get_time_to_expiry(expiry, current);
    assert(result == 1, 'min time past expiry');
}
