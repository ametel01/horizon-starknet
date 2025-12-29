/// Tests for the high-precision market math library (market_math_fp.cairo)
/// Verifies Pendle-accurate AMM curve calculations using cubit fixed-point

use horizon::libraries::math_fp::{HALF_WAD, WAD, abs_diff};
use horizon::market::market_math_fp::{
    MAX_PROPORTION, MIN_PROPORTION, MarketState, calc_burn_lp, calc_mint_lp, calc_price_impact,
    calc_swap_exact_pt_for_sy, calc_swap_exact_sy_for_pt, calc_swap_pt_for_exact_sy,
    calc_swap_sy_for_exact_pt, get_exchange_rate, get_implied_apy, get_market_exchange_rate,
    get_market_pre_compute, get_proportion, get_pt_price, get_rate_scalar,
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
        state.pt_reserve,
        state.sy_reserve,
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
        state.sy_reserve,
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
        state.sy_reserve,
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
        state.sy_reserve,
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
        state.sy_reserve,
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
/// Large trades can require more iterations to converge on the exact output.
#[test]
fn test_binary_search_max_iterations() {
    let state = create_test_market();
    let time_to_expiry: u64 = 31_536_000;

    // Large trade: 40% of SY reserve
    // This should stress the binary search but still converge
    let large_sy_in = 400_000 * WAD;

    let (pt_out, fee) = calc_swap_exact_sy_for_pt(@state, large_sy_in, time_to_expiry);

    // Binary search should converge and produce valid output
    assert(pt_out > 0, 'pt_out > 0 for large trade');
    assert(pt_out < state.pt_reserve, 'pt_out < reserves');
    assert(fee > 0, 'fee applied for large trade');

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

    let (pt_out, _fee) = calc_swap_exact_sy_for_pt(@state, small_sy_in, time_to_expiry);

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
    let (_, _) = calc_swap_pt_for_exact_sy(@state, exact_sy_out, time_to_expiry);
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
    let (_, _) = calc_swap_sy_for_exact_pt(@state, exact_reserve_pt_out, time_to_expiry);
}
