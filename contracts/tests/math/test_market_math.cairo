use horizon::libraries::math::{WAD, abs_diff, exp_wad};
use horizon::market::market_math::{
    MIN_TIME_TO_EXPIRY, MarketState, calc_burn_lp, calc_mint_lp, calc_price_impact,
    calc_swap_exact_pt_for_sy, calc_swap_exact_sy_for_pt, calc_swap_pt_for_exact_sy,
    calc_swap_sy_for_exact_pt, check_slippage, get_fee_rate, get_implied_apy, get_ln_implied_rate,
    get_market_exchange_rate, get_market_pre_compute, get_proportion, get_pt_price, get_rate_scalar,
    get_time_to_expiry,
};

// Helper to create a balanced market state
fn create_market_state(
    sy_reserve: u256,
    pt_reserve: u256,
    ln_fee_rate_root: u256,
    initial_anchor: u256,
    scalar_root: u256,
) -> MarketState {
    MarketState {
        sy_reserve,
        pt_reserve,
        total_lp: 0,
        scalar_root,
        initial_anchor,
        ln_fee_rate_root,
        reserve_fee_percent: 0, // No reserve fee for basic tests
        expiry: 0, // Not used directly in math functions
        last_ln_implied_rate: 0,
        py_index: WAD // 1:1 conversion for basic tests
    }
}

// Helper to create a market state with a positive implied rate (for buy tests)
// This ensures exchange_rate > 1 + fee_rate, which is required for Pendle's fee model
fn create_market_with_implied_rate(
    sy_reserve: u256,
    pt_reserve: u256,
    ln_fee_rate_root: u256,
    initial_anchor: u256,
    scalar_root: u256,
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
        py_index: WAD,
    }
}

// Default market with 50/50 balance
fn default_market() -> MarketState {
    create_market_state(
        100 * WAD, // 100 SY
        100 * WAD, // 100 PT
        WAD / 100, // 1% ln fee rate root
        WAD / 10, // 10% initial anchor (ln of implied rate)
        WAD // scalar root
    )
}

// Default market with positive implied rate (suitable for buy tests)
// Uses large reserves (1M) to minimize trade's impact on proportion.
// Key: With large reserves, small trades don't push exchange_rate below fee_rate.
fn default_market_for_buy() -> MarketState {
    create_market_with_implied_rate(
        1_000_000 * WAD, // 1M SY (large reserves for stable pricing)
        1_000_000 * WAD, // 1M PT
        WAD / 100, // 1% ln fee rate root
        WAD, // 1.0 initial anchor (ln(1) = 0)
        WAD / 100, // 0.01 scalar root
        WAD / 20 // 5% ln implied rate
    )
}

// Constants for tests
const ONE_YEAR: u64 = 31_536_000;
const SIX_MONTHS: u64 = 15_768_000;
const ONE_MONTH: u64 = 2_628_000;
const ONE_DAY: u64 = 86_400;

// ============ Time to Expiry Tests ============

#[test]
fn test_get_time_to_expiry_future() {
    let expiry: u64 = 1000000;
    let current: u64 = 500000;
    let result = get_time_to_expiry(expiry, current);
    assert(result == 500000, 'Should return difference');
}

#[test]
fn test_get_time_to_expiry_past() {
    let expiry: u64 = 500000;
    let current: u64 = 1000000;
    let result = get_time_to_expiry(expiry, current);
    assert(result == MIN_TIME_TO_EXPIRY, 'Should return minimum');
}

#[test]
fn test_get_time_to_expiry_equal() {
    let expiry: u64 = 1000000;
    let current: u64 = 1000000;
    let result = get_time_to_expiry(expiry, current);
    assert(result == MIN_TIME_TO_EXPIRY, 'Should return minimum at expiry');
}

// ============ Proportion Tests ============

#[test]
fn test_get_proportion_balanced() {
    let state = create_market_state(100 * WAD, 100 * WAD, 0, 0, WAD);
    let proportion = get_proportion(@state);
    // 100 / (100 + 100) = 0.5
    assert(proportion == WAD / 2, 'Should be 50%');
}

#[test]
fn test_get_proportion_more_pt() {
    let state = create_market_state(100 * WAD, 300 * WAD, 0, 0, WAD);
    let proportion = get_proportion(@state);
    // 300 / (100 + 300) = 0.75
    assert(proportion == 3 * WAD / 4, 'Should be 75%');
}

#[test]
fn test_get_proportion_more_sy() {
    let state = create_market_state(300 * WAD, 100 * WAD, 0, 0, WAD);
    let proportion = get_proportion(@state);
    // 100 / (300 + 100) = 0.25
    assert(proportion == WAD / 4, 'Should be 25%');
}

#[test]
fn test_get_proportion_empty_pool() {
    let state = create_market_state(0, 0, 0, 0, WAD);
    let proportion = get_proportion(@state);
    // Should return 50% for empty pool
    assert(proportion == WAD / 2, 'Empty pool should be 50%');
}

// ============ Rate Scalar Tests ============

#[test]
fn test_get_rate_scalar_one_year() {
    let scalar_root = WAD; // 1.0
    let time_to_expiry = ONE_YEAR;
    let result = get_rate_scalar(scalar_root, time_to_expiry);
    // scalar_root / 1 year = 1.0
    assert(result == WAD, 'Should be 1.0 for one year');
}

#[test]
fn test_get_rate_scalar_six_months() {
    let scalar_root = WAD;
    let time_to_expiry = SIX_MONTHS;
    let result = get_rate_scalar(scalar_root, time_to_expiry);
    // scalar_root / 0.5 years = 2.0
    assert(result > WAD, 'Should be > 1 for half year');
    assert(result < 3 * WAD, 'Should be < 3');
}

#[test]
fn test_get_rate_scalar_short_time() {
    let scalar_root = WAD;
    let time_to_expiry = ONE_DAY;
    let result = get_rate_scalar(scalar_root, time_to_expiry);
    // Should be large for short time
    assert(result > 100 * WAD, 'Should be large for short time');
}

// ============ PT Price Tests ============

#[test]
fn test_get_pt_price_zero_rate() {
    let ln_rate = 0;
    let time_to_expiry = ONE_YEAR;
    let price = get_pt_price(ln_rate, time_to_expiry);
    assert(price == WAD, 'Zero rate should give price 1');
}

#[test]
fn test_get_pt_price_at_expiry() {
    let ln_rate = WAD / 10; // 10% ln(rate)
    let time_to_expiry: u64 = 0;
    let price = get_pt_price(ln_rate, time_to_expiry);
    assert(price == WAD, 'At expiry PT = 1 SY');
}

#[test]
fn test_get_pt_price_positive_rate() {
    let ln_rate = WAD / 10; // ~10% ln(rate)
    let time_to_expiry = ONE_YEAR;
    let price = get_pt_price(ln_rate, time_to_expiry);
    // Price should be less than 1 (discounted)
    assert(price < WAD, 'PT price should be < 1');
    assert(price > WAD / 2, 'PT price should be > 0.5');
}

#[test]
fn test_get_pt_price_converges_to_one() {
    let ln_rate = WAD / 10;

    let price_1y = get_pt_price(ln_rate, ONE_YEAR);
    let price_6m = get_pt_price(ln_rate, SIX_MONTHS);
    let price_1m = get_pt_price(ln_rate, ONE_MONTH);
    let price_1d = get_pt_price(ln_rate, ONE_DAY);

    // Price should increase as we approach expiry
    assert(price_1y < price_6m, 'Price should increase over time');
    assert(price_6m < price_1m, 'Price should increase');
    assert(price_1m < price_1d, 'Price approaches 1');
    assert(price_1d < WAD, 'Still less than 1');
}

// ============ Implied APY Tests ============

#[test]
fn test_get_implied_apy_zero() {
    let apy = get_implied_apy(0);
    assert(apy == 0, 'Zero ln_rate should give 0 APY');
}

#[test]
fn test_get_implied_apy_positive() {
    // ln(1.05) ≈ 0.0488 for 5% APY
    let ln_rate = 48_790_000_000_000_000; // ~0.0488 WAD
    let apy = get_implied_apy(ln_rate);
    // Should be approximately 5%
    assert(apy > 4 * WAD / 100, 'APY should be > 4%');
    assert(apy < 6 * WAD / 100, 'APY should be < 6%');
}

#[test]
fn test_get_implied_apy_higher() {
    // ln(1.20) ≈ 0.182 for 20% APY
    let ln_rate = 182_000_000_000_000_000; // ~0.182 WAD
    let apy = get_implied_apy(ln_rate);
    // Should be approximately 20%
    assert(apy > 18 * WAD / 100, 'APY should be > 18%');
    assert(apy < 22 * WAD / 100, 'APY should be < 22%');
}

// ============ Swap Calculation Tests ============

#[test]
fn test_calc_swap_exact_pt_for_sy_zero() {
    let state = default_market();
    let result = calc_swap_exact_pt_for_sy(@state, 0, ONE_YEAR);
    let sy_out = result.net_sy_to_account;
    let fee = result.net_sy_fee;
    assert(sy_out == 0, 'Zero in should give zero out');
    assert(fee == 0, 'Zero in should give zero fee');
}

#[test]
fn test_calc_swap_exact_pt_for_sy_basic() {
    let state = default_market();
    let pt_in = 10 * WAD;
    let result = calc_swap_exact_pt_for_sy(@state, pt_in, ONE_YEAR);
    let sy_out = result.net_sy_to_account;
    let fee = result.net_sy_fee;

    // Output should be less than input (PT < SY before expiry + fees)
    assert(sy_out > 0, 'Should have output');
    assert(sy_out < pt_in, 'SY out should be < PT in');
    assert(fee > 0, 'Should have fee');
}

#[test]
fn test_calc_swap_exact_sy_for_pt_zero() {
    let state = default_market();
    let (pt_out, result) = calc_swap_exact_sy_for_pt(@state, 0, ONE_YEAR);
    let fee = result.net_sy_fee;
    assert(pt_out == 0, 'Zero in should give zero out');
    assert(fee == 0, 'Zero in should give zero fee');
}

#[test]
fn test_calc_swap_exact_sy_for_pt_basic() {
    // Use market with positive implied rate to satisfy exchange_rate > fee_rate
    let state = default_market_for_buy();
    let sy_in = 10 * WAD;
    let (pt_out, result) = calc_swap_exact_sy_for_pt(@state, sy_in, ONE_YEAR);
    let fee = result.net_sy_fee;

    // Can get more PT than SY input (PT is discounted)
    assert(pt_out > 0, 'Should have output');
    assert(fee > 0, 'Should have fee');
}

#[test]
fn test_calc_swap_sy_for_exact_pt_basic() {
    // Use market with positive implied rate to satisfy exchange_rate > fee_rate
    let state = default_market_for_buy();
    let pt_out = 10 * WAD;
    let result = calc_swap_sy_for_exact_pt(@state, pt_out, ONE_YEAR);
    let sy_in = result.net_sy_to_account;
    let fee = result.net_sy_fee;

    assert(sy_in > 0, 'Should require SY input');
    assert(fee > 0, 'Should have fee');
}

#[test]
fn test_calc_swap_pt_for_exact_sy_basic() {
    // Use larger pool to avoid hitting proportion bounds during binary search
    // With Pendle's 96% max proportion, smaller pools can hit the bound
    let state = create_market_state(500 * WAD, 500 * WAD, WAD / 100, WAD / 10, WAD);
    let sy_out = 10 * WAD;
    let (pt_in, result) = calc_swap_pt_for_exact_sy(@state, sy_out, ONE_YEAR);
    let fee = result.net_sy_fee;

    assert(pt_in > 0, 'Should require PT input');
    assert(fee > 0, 'Should have fee');
}

// ============ LP Calculation Tests ============

#[test]
fn test_calc_mint_lp_first_provider() {
    let state = create_market_state(0, 0, 0, 0, WAD);
    let state_with_zero_lp = MarketState { total_lp: 0, ..state };

    let (lp, sy_used, pt_used, is_first_mint) = calc_mint_lp(
        @state_with_zero_lp, 100 * WAD, 100 * WAD,
    );

    // First provider gets sqrt(wad_mul(sy, pt)) - MINIMUM_LIQUIDITY
    // wad_mul(100 WAD, 100 WAD) = 10000 * WAD = 10^22
    // sqrt(10^22) = 10^11 = 100_000_000_000
    // After subtracting MINIMUM_LIQUIDITY (1000): 100_000_000_000 - 1000 = 99_999_999_000
    let expected_lp: u256 = 100_000_000_000 - 1000; // sqrt(10^22) - 1000
    assert(lp > 0, 'Should mint LP');
    assert(lp == expected_lp, 'LP should be sqrt - 1000');
    assert(sy_used == 100 * WAD, 'Should use all SY');
    assert(pt_used == 100 * WAD, 'Should use all PT');
    assert(is_first_mint, 'Should be first mint');
}

#[test]
fn test_calc_mint_lp_subsequent() {
    // Pool with existing liquidity
    let state = MarketState {
        sy_reserve: 100 * WAD,
        pt_reserve: 100 * WAD,
        total_lp: 100 * WAD, // sqrt(100*100) = 100
        scalar_root: WAD,
        initial_anchor: WAD / 10,
        ln_fee_rate_root: WAD / 100,
        reserve_fee_percent: 0,
        expiry: 0,
        last_ln_implied_rate: 0,
        py_index: WAD,
    };

    // Add proportional liquidity
    let (lp, sy_used, pt_used, is_first_mint) = calc_mint_lp(@state, 50 * WAD, 50 * WAD);

    // Should get 50% more LP
    assert(lp == 50 * WAD, 'Should mint 50 LP');
    assert(sy_used == 50 * WAD, 'Should use 50 SY');
    assert(pt_used == 50 * WAD, 'Should use 50 PT');
    assert(!is_first_mint, 'Should not be first mint');
}

#[test]
fn test_calc_mint_lp_unbalanced() {
    let state = MarketState {
        sy_reserve: 100 * WAD,
        pt_reserve: 100 * WAD,
        total_lp: 100 * WAD,
        scalar_root: WAD,
        initial_anchor: WAD / 10,
        ln_fee_rate_root: WAD / 100,
        reserve_fee_percent: 0,
        expiry: 0,
        last_ln_implied_rate: 0,
        py_index: WAD,
    };

    // Try to add unbalanced (more SY than PT)
    let (lp, sy_used, pt_used, is_first_mint) = calc_mint_lp(@state, 100 * WAD, 50 * WAD);

    // Should only use 50 of each (limited by PT)
    assert(lp == 50 * WAD, 'Should mint 50 LP');
    assert(sy_used == 50 * WAD, 'Should use only 50 SY');
    assert(pt_used == 50 * WAD, 'Should use 50 PT');
    assert(!is_first_mint, 'Should not be first mint');
}

/// Test that calc_mint_lp uses rawDivUp-style rounding for the "other side" amount.
/// This prevents users from minting LP with insufficient counterpart tokens.
#[test]
fn test_calc_mint_lp_rounds_up_other_side() {
    // Create a state where division doesn't result in an integer
    // sy_reserve = 3 WAD, pt_reserve = 3 WAD, total_lp = 10 WAD
    // When adding 1 WAD SY (limiting factor):
    // lp_to_mint = (1 * 10) / 3 = 3.333... WAD (floored to 3_333_333_333_333_333_333)
    // pt_used without rounding = (3 * lp) / 10 = 999_999_999_999_999_999 (just under 1 WAD)
    // pt_used with rawDivUp = 1_000_000_000_000_000_000 (exactly 1 WAD)
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
    };

    // Add SY that creates a non-integer LP amount
    let (lp, sy_used, pt_used, is_first_mint) = calc_mint_lp(@state, WAD, 2 * WAD);

    // SY is the limiting factor (1 WAD SY vs 2 WAD PT available)
    // lp_by_sy = (1 * 10) / 3 = 3_333_333_333_333_333_333
    let expected_lp: u256 = 3_333_333_333_333_333_333;
    assert(lp == expected_lp, 'LP should be 3.33... WAD');
    assert(sy_used == WAD, 'Should use all SY');

    // PT used should be rounded UP to protect the pool
    // pt_used = divUp(3 * 3_333_333_333_333_333_333 / 10) = divUp(999_999_999_999_999_999.9) = 1
    // WAD Without rawDivUp, this would be 999_999_999_999_999_999 (1 wei less than 1 WAD)
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
fn test_calc_burn_lp_zero() {
    let state = MarketState {
        sy_reserve: 100 * WAD,
        pt_reserve: 100 * WAD,
        total_lp: 100 * WAD,
        scalar_root: WAD,
        initial_anchor: WAD / 10,
        ln_fee_rate_root: WAD / 100,
        reserve_fee_percent: 0,
        expiry: 0,
        last_ln_implied_rate: 0,
        py_index: WAD,
    };

    let (sy_out, pt_out) = calc_burn_lp(@state, 0);
    assert(sy_out == 0, 'Should get 0 SY');
    assert(pt_out == 0, 'Should get 0 PT');
}

#[test]
fn test_calc_burn_lp_partial() {
    let state = MarketState {
        sy_reserve: 100 * WAD,
        pt_reserve: 100 * WAD,
        total_lp: 100 * WAD,
        scalar_root: WAD,
        initial_anchor: WAD / 10,
        ln_fee_rate_root: WAD / 100,
        reserve_fee_percent: 0,
        expiry: 0,
        last_ln_implied_rate: 0,
        py_index: WAD,
    };

    // Burn 25% of LP
    let (sy_out, pt_out) = calc_burn_lp(@state, 25 * WAD);

    assert(sy_out == 25 * WAD, 'Should get 25 SY');
    assert(pt_out == 25 * WAD, 'Should get 25 PT');
}

#[test]
fn test_calc_burn_lp_all() {
    let state = MarketState {
        sy_reserve: 100 * WAD,
        pt_reserve: 100 * WAD,
        total_lp: 100 * WAD,
        scalar_root: WAD,
        initial_anchor: WAD / 10,
        ln_fee_rate_root: WAD / 100,
        reserve_fee_percent: 0,
        expiry: 0,
        last_ln_implied_rate: 0,
        py_index: WAD,
    };

    // Burn all LP
    let (sy_out, pt_out) = calc_burn_lp(@state, 100 * WAD);

    assert(sy_out == 100 * WAD, 'Should get all SY');
    assert(pt_out == 100 * WAD, 'Should get all PT');
}

// ============ Price Impact Tests ============

#[test]
fn test_calc_price_impact_small_trade() {
    let impact = calc_price_impact(WAD, 100 * WAD, 100 * WAD);
    // Small trade should have small impact
    assert(impact < WAD / 10, 'Small trade low impact');
}

#[test]
fn test_calc_price_impact_large_trade() {
    let impact = calc_price_impact(50 * WAD, 100 * WAD, 100 * WAD);
    // Large trade should have larger impact
    assert(impact > WAD / 10, 'Large trade higher impact');
}

#[test]
fn test_calc_price_impact_empty_pool() {
    let impact = calc_price_impact(WAD, 0, 100 * WAD);
    assert(impact == WAD, 'Empty pool 100% impact');
}

// ============ Slippage Check Tests ============

#[test]
fn test_check_slippage_pass() {
    assert(check_slippage(100, 90), 'Should pass with margin');
    assert(check_slippage(100, 100), 'Should pass exactly');
}

#[test]
fn test_check_slippage_fail() {
    assert(!check_slippage(90, 100), 'Should fail under minimum');
}

// ============ Market Exchange Rate Tests ============

#[test]
fn test_get_market_exchange_rate() {
    let state = default_market();
    let rate = get_market_exchange_rate(@state, ONE_YEAR);

    // Exchange rate should be less than 1 (PT trades at discount)
    assert(rate > 0, 'Rate should be positive');
    assert(rate <= WAD, 'Rate should be <= 1');
}

#[test]
fn test_get_market_exchange_rate_approaches_one() {
    let state = default_market();

    let rate_1y = get_market_exchange_rate(@state, ONE_YEAR);
    let rate_1m = get_market_exchange_rate(@state, ONE_MONTH);
    let rate_1d = get_market_exchange_rate(@state, ONE_DAY);

    // Rate should approach 1 as expiry nears
    assert(rate_1y < rate_1m, 'Rate increases over time');
    assert(rate_1m < rate_1d, 'Rate approaches 1');
}

// ============ Ln Implied Rate Tests ============

#[test]
fn test_get_ln_implied_rate_balanced() {
    let state = default_market();
    let ln_rate = get_ln_implied_rate(@state, ONE_YEAR);

    // With balanced pool and initial anchor, should be around anchor
    assert(ln_rate > 0, 'Should have positive rate');
}

#[test]
fn test_get_ln_implied_rate_more_pt() {
    // More PT in pool means higher PT proportion
    // ln_implied_rate = anchor - scalar * ln(proportion / (1 - proportion))
    // Higher proportion → higher odds → higher ln(odds) → lower rate
    let state = create_market_state(50 * WAD, 150 * WAD, WAD / 100, WAD / 10, WAD);
    let ln_rate = get_ln_implied_rate(@state, ONE_YEAR);

    let balanced_state = default_market();
    let balanced_rate = get_ln_implied_rate(@balanced_state, ONE_YEAR);

    // More PT in pool → higher proportion → lower implied rate
    assert(ln_rate < balanced_rate, 'More PT = lower rate');
}

#[test]
fn test_get_ln_implied_rate_more_sy() {
    // More SY in pool means lower PT proportion
    // Lower proportion → lower odds → negative ln(odds) → higher rate
    let state = create_market_state(150 * WAD, 50 * WAD, WAD / 100, WAD / 10, WAD);
    let ln_rate = get_ln_implied_rate(@state, ONE_YEAR);

    let balanced_state = default_market();
    let balanced_rate = get_ln_implied_rate(@balanced_state, ONE_YEAR);

    // More SY in pool → lower proportion → higher implied rate
    assert(ln_rate > balanced_rate, 'More SY = higher rate');
}

// ============================================
// PENDLE-STYLE FEE RATE TESTS (Step 1.3)
// ============================================

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
    let state = default_market();
    let time_to_expiry: u64 = 31_536_000;

    let comp = get_market_pre_compute(@state, time_to_expiry);

    // Verify fee_rate is computed correctly
    let expected_fee_rate = get_fee_rate(state.ln_fee_rate_root, time_to_expiry);
    assert(comp.fee_rate == expected_fee_rate, 'precompute has fee_rate');
}

#[test]
fn test_precompute_includes_total_asset() {
    let state = default_market();
    let time_to_expiry: u64 = 31_536_000;

    let comp = get_market_pre_compute(@state, time_to_expiry);

    // total_asset = sy_to_asset(sy_reserve, py_index) + pt_reserve
    // With py_index = WAD, sy_to_asset(sy, WAD) = sy
    // So total_asset = sy_reserve + pt_reserve = 100 + 100 = 200 WAD
    let expected_total_asset = state.sy_reserve + state.pt_reserve;
    assert(comp.total_asset == expected_total_asset, 'precompute has total_asset');
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
    };

    // Try to get exact SY out - this requires selling PT, which would push proportion above 96%
    // Should fail with "trade infeasible"
    let time_to_expiry: u64 = 31_536_000;
    let _result = calc_swap_pt_for_exact_sy(@state, WAD, time_to_expiry);
}

/// Test that calc_swap_pt_for_exact_sy fails when requesting more SY than available
/// even if proportion limit isn't reached
#[test]
#[should_panic(expected: 'HZN: insufficient liquidity')]
fn test_calc_swap_pt_for_exact_sy_exceeds_reserve() {
    let state = default_market();
    let time_to_expiry: u64 = 31_536_000;

    // Try to get more SY than exists in reserve
    let _result = calc_swap_pt_for_exact_sy(@state, 200 * WAD, time_to_expiry);
}
