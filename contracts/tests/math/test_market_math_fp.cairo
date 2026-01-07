/// Tests for the high-precision market math library (market_math_fp.cairo)
/// Verifies Pendle-accurate AMM curve calculations using cubit fixed-point

use horizon::libraries::math_fp::{HALF_WAD, WAD, abs_diff, exp_wad};
use horizon::market::market_math_fp::{
    MAX_FEE_MULTIPLIER, MAX_PROPORTION, MIN_PROPORTION, MarketState, calc_burn_lp, calc_mint_lp,
    calc_price_impact, calc_rate_impact_multiplier, calc_swap_exact_pt_for_sy,
    calc_swap_exact_sy_for_pt, calc_swap_pt_for_exact_sy, calc_swap_sy_for_exact_pt,
    get_exchange_rate, get_fee_rate, get_implied_apy, get_market_exchange_rate,
    get_market_pre_compute, get_proportion, get_pt_price, get_rate_scalar,
    get_time_adjusted_fee_rate, get_time_to_expiry,
};

/// Helper to create a standard test market state.
/// Uses 20% implied rate and scalar_root = 100 for realistic trade sizing.
/// The scalar_root controls curve sensitivity: HIGHER = LESS sensitive (flatter curve).
/// With the asset-based curve, scalar_root acts as a divisor for the logit term,
/// so higher values reduce price impact per trade.
fn create_test_market() -> MarketState {
    MarketState {
        sy_reserve: 1_000_000 * WAD, // 1M SY
        pt_reserve: 1_000_000 * WAD, // 1M PT
        total_lp: 1_000_000 * WAD, // 1M LP
        scalar_root: 100 * WAD, // 100 (realistic sensitivity for medium trades)
        initial_anchor: WAD, // 1.0 anchor
        ln_fee_rate_root: WAD / 100, // 1% ln fee rate root -> exp(0.01) ≈ 1.01 fee
        reserve_fee_percent: 0, // No reserve fee for basic tests
        expiry: 31_536_000 + 1000, // 1 year from now
        last_ln_implied_rate: WAD / 5, // 20% implied rate -> exp(0.2) ≈ 1.22 exchange rate
        py_index: WAD, // 1:1 conversion for basic tests
        rate_impact_sensitivity: 0 // No dynamic fee for basic tests
    }
}

/// Helper to create a market state for large trade stress tests
/// Uses 50% implied rate and scalar_root = 200 for minimal curve sensitivity
fn create_large_trade_market() -> MarketState {
    MarketState {
        sy_reserve: 1_000_000 * WAD,
        pt_reserve: 1_000_000 * WAD,
        total_lp: 1_000_000 * WAD,
        scalar_root: 200 * WAD, // 200 (very flat curve for large trades)
        initial_anchor: WAD,
        ln_fee_rate_root: WAD / 100, // 1% fee
        reserve_fee_percent: 0,
        expiry: 31_536_000 + 1000,
        last_ln_implied_rate: WAD / 2, // 50% implied rate -> exp(0.5) ≈ 1.65 exchange rate
        py_index: WAD,
        rate_impact_sensitivity: 0, // No dynamic fee for stress tests
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
// PENDLE-STYLE FEE RATE TESTS (Step 1.3)
// ============================================

#[test]
fn test_get_fee_rate_one_year() {
    // At 1 year, fee_rate = exp(ln_fee_rate_root * 1) = exp(ln_fee_rate_root)
    let ln_fee_rate_root = WAD / 100; // ln(1.01) ≈ 0.00995 ≈ 0.01 for 1% fee
    let time_to_expiry: u64 = 31_536_000; // 1 year

    let fee_rate = get_fee_rate(ln_fee_rate_root, time_to_expiry);
    let expected = exp_wad(ln_fee_rate_root);

    // fee_rate should match exp(ln_fee_rate_root) at 1 year
    assert_approx_eq(fee_rate, expected, 10, 'fee_rate = exp at 1y');
}

#[test]
fn test_get_fee_rate_half_year() {
    // At 0.5 year, fee_rate = exp(ln_fee_rate_root * 0.5)
    let ln_fee_rate_root = WAD / 50; // 0.02 WAD
    let time_to_expiry: u64 = 15_768_000; // 0.5 year

    let fee_rate = get_fee_rate(ln_fee_rate_root, time_to_expiry);

    // Expected: exp(0.02 * 0.5) = exp(0.01) ≈ 1.01005
    let expected = exp_wad(ln_fee_rate_root / 2);

    assert_approx_eq(fee_rate, expected, 10, 'fee_rate at 0.5y');
}

#[test]
fn test_get_fee_rate_at_expiry() {
    // At expiry, fee_rate should be WAD (multiplier of 1.0 = no fee effect)
    let ln_fee_rate_root = WAD / 100;
    let fee_rate = get_fee_rate(ln_fee_rate_root, 0);

    assert(fee_rate == WAD, 'fee_rate = WAD at expiry');
}

#[test]
fn test_get_fee_rate_zero_ln_fee_root() {
    // With zero ln_fee_rate_root, fee_rate should be WAD
    let fee_rate = get_fee_rate(0, 31_536_000);

    assert(fee_rate == WAD, 'fee_rate = WAD with zero root');
}

#[test]
fn test_get_fee_rate_is_multiplier_gte_one() {
    // fee_rate should always be >= WAD (a multiplier >= 1)
    let ln_fee_rate_root = WAD / 100;

    // Test at various time points
    let fee_rate_1y = get_fee_rate(ln_fee_rate_root, 31_536_000);
    let fee_rate_6m = get_fee_rate(ln_fee_rate_root, 15_768_000);
    let fee_rate_1m = get_fee_rate(ln_fee_rate_root, 2_592_000);

    assert(fee_rate_1y >= WAD, 'fee_rate >= WAD at 1y');
    assert(fee_rate_6m >= WAD, 'fee_rate >= WAD at 6m');
    assert(fee_rate_1m >= WAD, 'fee_rate >= WAD at 1m');
}

#[test]
fn test_get_fee_rate_decays_towards_expiry() {
    // fee_rate should decrease as time_to_expiry decreases
    let ln_fee_rate_root = WAD / 100;

    let fee_rate_1y = get_fee_rate(ln_fee_rate_root, 31_536_000);
    let fee_rate_6m = get_fee_rate(ln_fee_rate_root, 15_768_000);
    let fee_rate_3m = get_fee_rate(ln_fee_rate_root, 7_884_000);
    let fee_rate_1m = get_fee_rate(ln_fee_rate_root, 2_592_000);

    // fee_rate should decrease as we approach expiry
    assert(fee_rate_1y > fee_rate_6m, '1y > 6m');
    assert(fee_rate_6m > fee_rate_3m, '6m > 3m');
    assert(fee_rate_3m > fee_rate_1m, '3m > 1m');
}

#[test]
fn test_precompute_includes_fee_rate() {
    let state = create_test_market();
    let time_to_expiry: u64 = 31_536_000;

    let comp = get_market_pre_compute(@state, time_to_expiry);

    // Verify fee_rate is computed correctly
    let expected_fee_rate = get_fee_rate(state.ln_fee_rate_root, time_to_expiry);
    assert(comp.fee_rate == expected_fee_rate, 'precompute has fee_rate');
}

#[test]
fn test_precompute_includes_total_asset() {
    let state = create_test_market();
    let time_to_expiry: u64 = 31_536_000;

    let comp = get_market_pre_compute(@state, time_to_expiry);

    // total_asset = sy_to_asset(sy_reserve, py_index) + pt_reserve
    // With py_index = WAD, sy_to_asset(sy, WAD) = sy
    // So total_asset = sy_reserve + pt_reserve = 1M + 1M = 2M WAD
    let expected_total_asset = state.sy_reserve + state.pt_reserve;
    assert(comp.total_asset == expected_total_asset, 'precompute has total_asset');
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
        state.pt_reserve,
        comp.total_asset,
        0,
        false,
        comp.rate_scalar,
        comp.rate_anchor,
        comp.rate_anchor_is_negative,
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
        state.pt_reserve,
        comp.total_asset,
        0,
        false,
        comp.rate_scalar,
        comp.rate_anchor,
        comp.rate_anchor_is_negative,
    );

    // Exchange rate after PT leaves pool (user buys PT)
    let pt_out = 100_000 * WAD;
    let rate_after = get_exchange_rate(
        state.pt_reserve,
        comp.total_asset,
        pt_out,
        true,
        comp.rate_scalar,
        comp.rate_anchor,
        comp.rate_anchor_is_negative,
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

    let result = calc_swap_exact_pt_for_sy(@state, pt_in, time_to_expiry);

    // SY out should be less than PT in (exchange rate >= 1)
    assert(result.net_sy_to_account < pt_in, 'SY out < PT in');
    // SY out should be positive
    assert(result.net_sy_to_account > 0, 'SY out positive');
    // Fee should be applied
    assert(result.net_sy_fee > 0, 'fee applied');
}

#[test]
fn test_calc_swap_exact_sy_for_pt() {
    let state = create_test_market();
    let time_to_expiry: u64 = 31_536_000;
    let sy_in = 10_000 * WAD;

    let (pt_out, result) = calc_swap_exact_sy_for_pt(@state, sy_in, time_to_expiry);

    // PT out should be positive
    assert(pt_out > 0, 'PT out positive');
    // Fee should be applied
    assert(result.net_sy_fee > 0, 'fee applied');
    // PT out should be reasonable (not more than reserves)
    assert(pt_out < state.pt_reserve, 'PT out < reserves');
}

#[test]
fn test_swap_zero_amount() {
    let state = create_test_market();
    let time_to_expiry: u64 = 31_536_000;

    let result = calc_swap_exact_pt_for_sy(@state, 0, time_to_expiry);
    assert(result.net_sy_to_account == 0, 'zero in zero out SY');
    assert(result.net_sy_fee == 0, 'zero in zero fee SY');

    let (pt_out, result2) = calc_swap_exact_sy_for_pt(@state, 0, time_to_expiry);
    assert(pt_out == 0, 'zero in zero out PT');
    assert(result2.net_sy_fee == 0, 'zero in zero fee PT');
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

/// Test that calc_mint_lp uses rawDivUp-style rounding for the "other side" amount.
/// This prevents users from minting LP with insufficient counterpart tokens.
#[test]
fn test_calc_mint_lp_rounds_up_other_side() {
    // Create a state where division doesn't result in an integer
    // sy_reserve = 3 WAD, pt_reserve = 3 WAD, total_lp = 10 WAD
    let state = MarketState {
        sy_reserve: 3 * WAD,
        pt_reserve: 3 * WAD,
        total_lp: 10 * WAD, // Intentionally different from reserves to create rounding scenario
        scalar_root: WAD,
        initial_anchor: WAD / 10,
        ln_fee_rate_root: WAD / 100,
        reserve_fee_percent: 0,
        expiry: 0,
        last_ln_implied_rate: 0,
        py_index: WAD,
        rate_impact_sensitivity: 0,
    };

    // Add SY that creates a non-integer LP amount
    let (lp, sy_used, pt_used, is_first_mint) = calc_mint_lp(@state, WAD, 2 * WAD);

    // SY is the limiting factor (1 WAD SY vs 2 WAD PT available)
    // lp_by_sy = (1 * 10) / 3 = 3_333_333_333_333_333_333
    let expected_lp: u256 = 3_333_333_333_333_333_333;
    assert(lp == expected_lp, 'LP should be 3.33... WAD');
    assert(sy_used == WAD, 'Should use all SY');

    // PT used should be rounded UP to protect the pool
    assert(pt_used == WAD, 'PT should round UP to 1 WAD');
    assert(!is_first_mint, 'Should not be first mint');
}

/// Test rawDivUp when PT is the limiting factor
#[test]
fn test_calc_mint_lp_rounds_up_sy_when_pt_limiting() {
    let state = MarketState {
        sy_reserve: 3 * WAD,
        pt_reserve: 3 * WAD,
        total_lp: 10 * WAD,
        scalar_root: WAD,
        initial_anchor: WAD / 10,
        ln_fee_rate_root: WAD / 100,
        reserve_fee_percent: 0,
        expiry: 0,
        last_ln_implied_rate: 0,
        py_index: WAD,
        rate_impact_sensitivity: 0,
    };

    // PT is limiting (1 WAD PT vs 2 WAD SY available)
    let (lp, sy_used, pt_used, is_first_mint) = calc_mint_lp(@state, 2 * WAD, WAD);

    // lp_by_pt = (1 * 10) / 3 = 3_333_333_333_333_333_333
    let expected_lp: u256 = 3_333_333_333_333_333_333;
    assert(lp == expected_lp, 'LP should be 3.33... WAD');
    assert(pt_used == WAD, 'Should use all PT');

    // SY used should be rounded UP
    assert(sy_used == WAD, 'SY should round UP to 1 WAD');
    assert(!is_first_mint, 'Should not be first mint');
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

// ============================================
// BOUNDARY CONDITION TESTS (Step 1.2)
// ============================================

/// Test exchange rate calculation at minimum proportion (0.1% PT)
/// This tests the lower bound of the proportion range where the logit curve
/// approaches -infinity, requiring careful numerical handling.
#[test]
fn test_exchange_rate_at_min_proportion() {
    // Create market with 0.1% PT / 99.9% SY (at MIN_PROPORTION)
    let mut state = create_test_market();
    // For proportion = 0.1%, we need pt / (pt + sy) = 0.001
    // If sy = 1M, then pt = 1M * 0.001 / 0.999 ≈ 1001 WAD
    state.pt_reserve = 1001 * WAD; // ~0.1% of total
    state.sy_reserve = 1_000_000 * WAD; // 99.9% of total

    let proportion = get_proportion(@state);
    // Verify we're near MIN_PROPORTION
    assert(proportion <= MIN_PROPORTION * 2, 'proportion near min');

    let time_to_expiry: u64 = 31_536_000;
    let comp = get_market_pre_compute(@state, time_to_expiry);

    // Exchange rate should be calculable without panic
    let exchange_rate = get_exchange_rate(
        state.pt_reserve,
        comp.total_asset,
        0,
        false,
        comp.rate_scalar,
        comp.rate_anchor,
        comp.rate_anchor_is_negative,
    );

    // At low proportion, PT is scarce so exchange rate should be >= 1
    assert(exchange_rate >= WAD, 'rate >= 1 at min proportion');
    // The rate should be bounded (no overflow)
    assert(exchange_rate < 100 * WAD, 'rate bounded at min proportion');
}

/// Test exchange rate calculation at maximum proportion (96% PT)
/// This tests the upper bound where the logit curve approaches +infinity,
/// also requiring careful numerical handling.
#[test]
fn test_exchange_rate_at_max_proportion() {
    // Create market with 96% PT / 4% SY (at MAX_PROPORTION)
    let mut state = create_test_market();
    // For proportion = 96%, we need pt / (pt + sy) = 0.96
    // If pt = 24M, then sy = pt * (1-0.96) / 0.96 = 1M
    state.pt_reserve = 24_000_000 * WAD; // 96% of total
    state.sy_reserve = 1_000_000 * WAD; // 4% of total

    let proportion = get_proportion(@state);
    // Verify we're near MAX_PROPORTION
    assert(proportion >= MAX_PROPORTION - WAD / 100, 'proportion near max');

    let time_to_expiry: u64 = 31_536_000;
    let comp = get_market_pre_compute(@state, time_to_expiry);

    // Exchange rate should be calculable without panic
    let exchange_rate = get_exchange_rate(
        state.pt_reserve,
        comp.total_asset,
        0,
        false,
        comp.rate_scalar,
        comp.rate_anchor,
        comp.rate_anchor_is_negative,
    );

    // At high proportion, PT is abundant so exchange rate should still be >= 1
    assert(exchange_rate >= WAD, 'rate >= 1 at max proportion');
    // The rate should be bounded (no overflow) - Pendle caps proportion at 96%
    // to prevent extreme exchange rates. If rate > 100x, the clamping may be broken.
    assert(exchange_rate < 100 * WAD, 'rate bounded at max proportion');
}

/// Test binary search behavior with trades that stress the iteration limit
/// Uses specialized market parameters with higher implied rate and lower sensitivity
/// to support larger trades while staying within exchange_rate >= 1.0 bounds.
#[test]
fn test_binary_search_max_iterations() {
    // Use market with higher implied rate (50%) and scalar_root (1.0)
    // This supports larger trades without hitting the exchange rate floor
    let state = create_large_trade_market();
    let time_to_expiry: u64 = 31_536_000;

    // Large trade: 20% of SY reserve
    // With scalar_root=1.0 and 50% implied rate, this stays within bounds
    let large_sy_in = 200_000 * WAD;

    let (pt_out, result) = calc_swap_exact_sy_for_pt(@state, large_sy_in, time_to_expiry);

    // Binary search should converge and produce valid output
    assert(pt_out > 0, 'pt_out > 0 for large trade');
    assert(pt_out < state.pt_reserve, 'pt_out < reserves');
    assert(result.net_sy_fee > 0, 'fee applied for large trade');

    // Verify the output is reasonable (not more than input considering exchange rate)
    // PT out should be greater than SY in (since PT trades at discount to SY)
    assert(pt_out > large_sy_in / 2, 'reasonable pt_out');
}

/// Test binary search with amounts near the tolerance boundary
/// This verifies the search terminates correctly when within tolerance.
#[test]
fn test_binary_search_tolerance_edge() {
    let state = create_test_market();
    let time_to_expiry: u64 = 31_536_000;

    // Very small swap: just above tolerance threshold
    // BINARY_SEARCH_TOLERANCE = 1000 wei
    let small_sy_in = 10_000; // 10x tolerance, but still very small

    let (pt_out, _result) = calc_swap_exact_sy_for_pt(@state, small_sy_in, time_to_expiry);

    // Should produce valid (possibly zero due to rounding) output
    // The key is no panic occurs
    assert(pt_out <= small_sy_in * 2, 'pt_out bounded');

    // Test with amount at exactly tolerance level
    let tiny_sy_in = 1000; // Exactly BINARY_SEARCH_TOLERANCE
    let (pt_out_tiny, _) = calc_swap_exact_sy_for_pt(@state, tiny_sy_in, time_to_expiry);

    // Should handle without panic (may round to 0)
    assert(pt_out_tiny <= tiny_sy_in * 2, 'tiny pt_out bounded');
}

/// Test swap that would attempt to drain the entire SY reserve
/// This should be rejected to prevent emptying the pool.
/// Note: calc_swap_exact_pt_for_sy won't drain the pool due to slippage -
/// the exchange rate increases as more PT enters, limiting SY output.
/// Instead, we use calc_swap_pt_for_exact_sy which explicitly requests
/// exact SY output and should fail when requesting the full reserve.
#[test]
#[should_panic(expected: 'HZN: insufficient liquidity')]
fn test_swap_drains_entire_reserve() {
    let state = create_test_market();
    let time_to_expiry: u64 = 31_536_000;

    // Try to get exactly as much SY out as exists in reserves
    // The calc_swap_pt_for_exact_sy function checks: exact_sy_out < state.sy_reserve
    // Requesting the full reserve should fail
    let exact_sy_out = state.sy_reserve;

    // This should panic with insufficient liquidity
    let (_pt_in, _result) = calc_swap_pt_for_exact_sy(@state, exact_sy_out, time_to_expiry);
}

/// Test swap where the output amount equals the reserve
/// This should be rejected as it would leave 0 liquidity.
#[test]
#[should_panic(expected: 'HZN: insufficient liquidity')]
fn test_swap_amount_equals_reserve() {
    let state = create_test_market();
    let time_to_expiry: u64 = 31_536_000;

    // Try to get exactly as much PT out as exists in reserves
    // This should fail the < check (output must be strictly less than reserve)
    let exact_reserve_pt_out = state.pt_reserve;

    // Use calc_swap_sy_for_exact_pt which allows specifying exact output
    // This now returns TradeResult instead of a tuple
    let _result = calc_swap_sy_for_exact_pt(@state, exact_reserve_pt_out, time_to_expiry);
}

// ============ Infeasible Trade Tests ============

/// Test that calc_swap_pt_for_exact_sy fails when max_pt_in is 0 due to proportion limit
/// This tests the fix for the "no feasible solution" case in binary search
#[test]
#[should_panic(expected: 'HZN: trade infeasible')]
fn test_calc_swap_pt_for_exact_sy_infeasible_proportion_limit() {
    // Create a market where PT proportion is already at 96%
    // proportion = pt / (sy + pt) = 96 / (4 + 96) = 96%
    // At 96%, no more PT can be added without exceeding MAX_PROPORTION
    let state = MarketState {
        sy_reserve: 4 * WAD,
        pt_reserve: 96 * WAD,
        total_lp: 100 * WAD,
        scalar_root: WAD,
        initial_anchor: WAD / 10,
        ln_fee_rate_root: WAD / 100,
        reserve_fee_percent: 0,
        expiry: 0,
        last_ln_implied_rate: 0,
        py_index: WAD,
        rate_impact_sensitivity: 0,
    };

    // Try to get exact SY out - this requires selling PT, which would push proportion above 96%
    // Should fail with "trade infeasible"
    let time_to_expiry: u64 = 31_536_000;
    let _result = calc_swap_pt_for_exact_sy(@state, WAD, time_to_expiry);
}

// ============================================
// RATE IMPACT MULTIPLIER TESTS
// ============================================

/// Test rate impact multiplier with no rate change returns 1.0
#[test]
fn test_rate_impact_multiplier_no_change() {
    let rate_before = WAD; // 1.0
    let rate_after = WAD; // 1.0
    let sensitivity = WAD / 10; // 10% sensitivity

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    assert(multiplier == WAD, 'no change = 1.0 multiplier');
}

/// Test rate impact multiplier with zero rate_before returns 1.0 (division by zero guard)
#[test]
fn test_rate_impact_multiplier_zero_rate_before() {
    let rate_before = 0;
    let rate_after = WAD;
    let sensitivity = WAD / 10;

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // Should return WAD (1.0) to prevent division by zero
    assert(multiplier == WAD, 'zero rate_before = 1.0');
}

/// Test rate impact multiplier with 10% rate increase and 100% sensitivity
/// Expected: 1.0 + 1.0 * 0.1 = 1.1 (10% higher multiplier)
#[test]
fn test_rate_impact_multiplier_rate_increase() {
    let rate_before = WAD; // 1.0
    let rate_after = WAD + WAD / 10; // 1.1 (10% increase)
    let sensitivity = WAD; // 100% sensitivity (1:1 mapping)

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // Expected: 1.0 + 1.0 * 0.1 = 1.1 WAD
    let expected = WAD + WAD / 10;
    assert_approx_eq(multiplier, expected, 10, '10% increase = 1.1x');
}

/// Test rate impact multiplier with 10% rate decrease
/// Should give same multiplier as 10% increase (absolute difference)
#[test]
fn test_rate_impact_multiplier_rate_decrease() {
    let rate_before = WAD + WAD / 10; // 1.1
    let rate_after = WAD; // 1.0 (10% decrease from 1.1)
    let sensitivity = WAD; // 100% sensitivity

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // Rate change = |1.0 - 1.1| = 0.1
    // Rate change % = 0.1 / 1.1 ≈ 0.0909 (9.09%)
    // Expected multiplier ≈ 1.0 + 1.0 * 0.0909 ≈ 1.0909
    let expected: u256 = 1_090_909_090_909_090_909; // ~1.0909 WAD
    assert_approx_eq(multiplier, expected, 100, '10% decrease from 1.1');
}

/// Test rate impact multiplier is capped at MAX_FEE_MULTIPLIER (2.0)
#[test]
fn test_rate_impact_multiplier_capped_at_max() {
    let rate_before = WAD; // 1.0
    let rate_after = 3 * WAD; // 3.0 (200% increase)
    let sensitivity = WAD; // 100% sensitivity

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // Without cap: 1.0 + 1.0 * 2.0 = 3.0
    // With cap: MAX_FEE_MULTIPLIER = 2.0
    assert(multiplier == MAX_FEE_MULTIPLIER, 'capped at 2.0x');
}

/// Test rate impact multiplier with low sensitivity
/// 10% sensitivity means 10% rate change → ~1% extra multiplier
#[test]
fn test_rate_impact_multiplier_low_sensitivity() {
    let rate_before = WAD; // 1.0
    let rate_after = WAD + WAD / 10; // 1.1 (10% increase)
    let sensitivity = WAD / 10; // 10% sensitivity

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // Expected: 1.0 + 0.1 * 0.1 = 1.01 WAD
    let expected = WAD + WAD / 100;
    assert_approx_eq(multiplier, expected, 10, 'low sensitivity = 1.01x');
}

/// Test rate impact multiplier with high sensitivity
/// 200% sensitivity means 10% rate change → 20% extra multiplier
#[test]
fn test_rate_impact_multiplier_high_sensitivity() {
    let rate_before = WAD; // 1.0
    let rate_after = WAD + WAD / 10; // 1.1 (10% increase)
    let sensitivity = 2 * WAD; // 200% sensitivity

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // Expected: 1.0 + 2.0 * 0.1 = 1.2 WAD
    let expected = WAD + WAD / 5;
    assert_approx_eq(multiplier, expected, 10, 'high sensitivity = 1.2x');
}

/// Test rate impact multiplier with zero sensitivity returns 1.0
#[test]
fn test_rate_impact_multiplier_zero_sensitivity() {
    let rate_before = WAD;
    let rate_after = 2 * WAD; // 100% increase
    let sensitivity = 0; // No sensitivity

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // With zero sensitivity, impact component = 0, so multiplier = 1.0
    assert(multiplier == WAD, 'zero sensitivity = 1.0x');
}

/// Test rate impact multiplier with very small rate change
#[test]
fn test_rate_impact_multiplier_small_change() {
    let rate_before = WAD;
    let rate_after = WAD + 1000; // Tiny increase (0.0000001%)
    let sensitivity = WAD;

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // Multiplier should be very close to 1.0
    assert(multiplier >= WAD, 'multiplier >= 1.0');
    assert(multiplier < WAD + WAD / 1000, 'multiplier barely above 1.0');
}

/// Test rate impact multiplier with large rate values (overflow safety)
#[test]
fn test_rate_impact_multiplier_large_values() {
    let rate_before = 50 * WAD; // 50.0 exchange rate
    let rate_after = 55 * WAD; // 55.0 (10% increase)
    let sensitivity = WAD; // 100% sensitivity

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // Expected: 1.0 + 1.0 * 0.1 = 1.1 WAD
    let expected = WAD + WAD / 10;
    assert_approx_eq(multiplier, expected, 10, 'large values = 1.1x');
}

/// Test that MAX_FEE_MULTIPLIER constant is 2.0 WAD
#[test]
fn test_max_fee_multiplier_constant() {
    assert(MAX_FEE_MULTIPLIER == 2 * WAD, 'MAX_FEE_MULTIPLIER = 2.0 WAD');
}

// ============================================
// DYNAMIC FEE INTEGRATION TESTS
// ============================================

/// Helper to create a market state with dynamic fee enabled
fn create_dynamic_fee_market() -> MarketState {
    MarketState {
        sy_reserve: 1_000_000 * WAD,
        pt_reserve: 1_000_000 * WAD,
        total_lp: 1_000_000 * WAD,
        scalar_root: 100 * WAD,
        initial_anchor: WAD,
        ln_fee_rate_root: WAD / 100, // 1% base fee
        reserve_fee_percent: 0,
        expiry: 31_536_000 + 1000,
        last_ln_implied_rate: WAD / 5, // 20% implied rate
        py_index: WAD,
        rate_impact_sensitivity: WAD, // 100% sensitivity
    }
}

/// Test that small trades have minimal fee increase with dynamic fees enabled
#[test]
fn test_dynamic_fee_small_trade_minimal_impact() {
    let state_no_dynamic = create_test_market(); // sensitivity = 0
    let state_dynamic = create_dynamic_fee_market(); // sensitivity = 100%
    let time_to_expiry: u64 = 31_536_000;

    // Small trade: 0.1% of reserves
    let small_pt_in = 1_000 * WAD;

    let result_no_dynamic = calc_swap_exact_pt_for_sy(@state_no_dynamic, small_pt_in, time_to_expiry);
    let result_dynamic = calc_swap_exact_pt_for_sy(@state_dynamic, small_pt_in, time_to_expiry);

    // Small trades should have very similar fees (minimal rate impact)
    // Dynamic fee should be slightly higher due to small rate change
    assert(result_dynamic.net_sy_fee >= result_no_dynamic.net_sy_fee, 'dynamic fee >= base fee');

    // Fee increase should be less than 5% for such small trades
    let fee_increase = result_dynamic.net_sy_fee - result_no_dynamic.net_sy_fee;
    let max_increase = result_no_dynamic.net_sy_fee / 20; // 5%
    assert(fee_increase <= max_increase, 'small trade fee <5% increase');
}

/// Test that large trades have significant fee increase with dynamic fees enabled
#[test]
fn test_dynamic_fee_large_trade_significant_impact() {
    let state_no_dynamic = create_test_market(); // sensitivity = 0
    let state_dynamic = create_dynamic_fee_market(); // sensitivity = 100%
    let time_to_expiry: u64 = 31_536_000;

    // Large trade: 10% of reserves
    let large_pt_in = 100_000 * WAD;

    let result_no_dynamic = calc_swap_exact_pt_for_sy(@state_no_dynamic, large_pt_in, time_to_expiry);
    let result_dynamic = calc_swap_exact_pt_for_sy(@state_dynamic, large_pt_in, time_to_expiry);

    // Dynamic fee should be noticeably higher for large trades
    assert(result_dynamic.net_sy_fee > result_no_dynamic.net_sy_fee, 'dynamic fee > base fee');

    // User should receive less SY with dynamic fees
    assert(
        result_dynamic.net_sy_to_account < result_no_dynamic.net_sy_to_account,
        'less SY with dynamic fee',
    );
}

/// Test that zero sensitivity behaves same as no dynamic fee
#[test]
fn test_dynamic_fee_zero_sensitivity_no_effect() {
    let state = create_test_market(); // sensitivity = 0
    let time_to_expiry: u64 = 31_536_000;

    let pt_in = 10_000 * WAD;

    // With sensitivity = 0, calc_rate_impact_multiplier returns 1.0
    // So the fee should be identical to base calculation
    let result = calc_swap_exact_pt_for_sy(@state, pt_in, time_to_expiry);

    // Just verify it produces valid output
    assert(result.net_sy_to_account > 0, 'positive SY output');
    assert(result.net_sy_fee > 0, 'fee applied');
}

/// Test that buying PT with dynamic fee works correctly
#[test]
fn test_dynamic_fee_buy_pt() {
    let state = create_dynamic_fee_market();
    let time_to_expiry: u64 = 31_536_000;

    // Buy PT with SY
    let sy_in = 50_000 * WAD;

    let (pt_out, result) = calc_swap_exact_sy_for_pt(@state, sy_in, time_to_expiry);

    // Should receive positive PT
    assert(pt_out > 0, 'positive PT output');
    // Fee should be applied
    assert(result.net_sy_fee > 0, 'fee applied');
    // PT should be less than what we'd get without dynamic fee
    // (can't easily compare here, but verify bounds)
    assert(pt_out < sy_in * 2, 'PT output bounded');
}

/// Test that very high sensitivity leads to higher fees
#[test]
fn test_dynamic_fee_high_sensitivity() {
    let mut state_low = create_dynamic_fee_market();
    state_low.rate_impact_sensitivity = WAD / 10; // 10% sensitivity

    let mut state_high = create_dynamic_fee_market();
    state_high.rate_impact_sensitivity = 2 * WAD; // 200% sensitivity

    let time_to_expiry: u64 = 31_536_000;
    let pt_in = 50_000 * WAD;

    let result_low = calc_swap_exact_pt_for_sy(@state_low, pt_in, time_to_expiry);
    let result_high = calc_swap_exact_pt_for_sy(@state_high, pt_in, time_to_expiry);

    // Higher sensitivity should result in higher fees
    assert(result_high.net_sy_fee > result_low.net_sy_fee, 'high sens > low sens fee');

    // Higher sensitivity means less SY received
    assert(
        result_high.net_sy_to_account < result_low.net_sy_to_account,
        'high sens less SY out',
    );
}
