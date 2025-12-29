/// Debug tests to analyze fuzz failure edge cases
///
/// This file contains tests to reproduce and analyze specific failure cases
/// found during fuzz testing.
///
/// ## BUG FIXED: calc_swap_exact_pt_for_sy missing bounds check
///
/// The `calc_swap_exact_pt_for_sy` function in market_math_fp.cairo was missing a check
/// that `sy_out <= sy_reserve`. In extremely unbalanced markets (>96% PT), this
/// could produce sy_out values that exceed the reserve.
///
/// Root cause: Missing assertion `assert(sy_out < *state.sy_reserve, INSUFFICIENT_LIQUIDITY)`
///
/// FIX APPLIED: Added bounds check in calc_swap_exact_pt_for_sy before fee calculation.
/// The test_debug_sy_out_exceeds_reserve now validates the fix works correctly.

use horizon::libraries::math_fp::WAD;
use horizon::market::market_math_fp::{
    MINIMUM_LIQUIDITY, MarketState, calc_swap_exact_pt_for_sy, get_market_pre_compute,
    get_proportion,
};

/// Bound a u256 value to a reasonable range (same as in fuzz tests)
fn bound(value: u256, min: u256, max: u256) -> u256 {
    if max <= min {
        return min;
    }
    let range = max - min;
    min + (value % (range + 1))
}

fn bound_u64(value: u64, min: u64, max: u64) -> u64 {
    if max <= min {
        return min;
    }
    let range = max - min;
    min + (value % (range + 1))
}

/// Create a market state with bounded random values (same as in fuzz tests)
fn create_fuzz_market(
    sy_reserve_raw: u256,
    pt_reserve_raw: u256,
    total_lp_raw: u256,
    scalar_root_raw: u256,
    fee_rate_raw: u256,
    ln_implied_rate_raw: u256,
    time_to_expiry_raw: u64,
) -> (MarketState, u64) {
    let min_reserve = 100 * WAD;
    let max_reserve = 1_000_000_000 * WAD;

    let sy_reserve = bound(sy_reserve_raw, min_reserve, max_reserve);
    let pt_reserve = bound(pt_reserve_raw, min_reserve, max_reserve);
    let total_lp = bound(total_lp_raw, MINIMUM_LIQUIDITY + 1, max_reserve);
    let scalar_root = bound(scalar_root_raw, WAD / 1000, WAD / 10);
    let fee_rate = bound(fee_rate_raw, 0, WAD / 20);
    let last_ln_implied_rate = bound(ln_implied_rate_raw, 0, WAD * 2);
    let time_to_expiry = bound_u64(time_to_expiry_raw, 1, 2 * 31_536_000);

    let current_time: u64 = 1000000;
    let expiry = current_time + time_to_expiry;

    let state = MarketState {
        sy_reserve,
        pt_reserve,
        total_lp,
        scalar_root,
        initial_anchor: WAD,
        fee_rate,
        expiry,
        last_ln_implied_rate,
    };

    (state, time_to_expiry)
}

/// Test to analyze the sy_out > sy_reserve failure
/// Original failure arguments from fuzzer:
/// sy_reserve_raw: 62939588078488604907080921895946355415804248882912510307166766253101451200774
/// pt_reserve_raw: 38158931331626183671817864584564046567559482002730804567708798080932866287058
/// total_lp_raw: 2863512636662279575530570204614325482596970706325126879962058643631849262448
/// scalar_root_raw: 62701438020225058627826303823091026425979520902302830223236861550385392773723
/// fee_rate_raw: 50453824365869241391580618894804343910846930460742072773952771573151066643496
/// ln_implied_rate_raw:
/// 76019103213326562829639602536007737781481597205189937153912363189907876056786
/// time_to_expiry_raw: 17023846189939904699 pt_in_raw:
/// 98057365481471365512484798680179504999889643081322863440561094087081424811743
///
/// This test now validates that the FIX works - it should panic with 'insufficient liquidity'
/// because the bounds check was added to calc_swap_exact_pt_for_sy.
#[test]
#[should_panic(expected: 'HZN: insufficient liquidity')]
fn test_debug_sy_out_exceeds_reserve() {
    // Raw values from the failure
    let sy_reserve_raw: u256 =
        62939588078488604907080921895946355415804248882912510307166766253101451200774;
    let pt_reserve_raw: u256 =
        38158931331626183671817864584564046567559482002730804567708798080932866287058;
    let total_lp_raw: u256 =
        2863512636662279575530570204614325482596970706325126879962058643631849262448;
    let scalar_root_raw: u256 =
        62701438020225058627826303823091026425979520902302830223236861550385392773723;
    let fee_rate_raw: u256 =
        50453824365869241391580618894804343910846930460742072773952771573151066643496;
    let ln_implied_rate_raw: u256 =
        76019103213326562829639602536007737781481597205189937153912363189907876056786;
    let time_to_expiry_raw: u64 = 17023846189939904699;
    let pt_in_raw: u256 =
        98057365481471365512484798680179504999889643081322863440561094087081424811743;

    // Create the market state
    let (state, tte) = create_fuzz_market(
        sy_reserve_raw,
        pt_reserve_raw,
        total_lp_raw,
        scalar_root_raw,
        fee_rate_raw,
        ln_implied_rate_raw,
        time_to_expiry_raw,
    );

    // Print bounded values for analysis
    println!("=== Market State After Bounding ===");
    println!("sy_reserve: {}", state.sy_reserve);
    println!("pt_reserve: {}", state.pt_reserve);
    println!("total_lp: {}", state.total_lp);
    println!("scalar_root: {}", state.scalar_root);
    println!("fee_rate: {}", state.fee_rate);
    println!("last_ln_implied_rate: {}", state.last_ln_implied_rate);
    println!("time_to_expiry: {}", tte);

    // Bound pt_in as done in the fuzz test
    let max_pt_in = state.pt_reserve / 10;
    let min_pt_in: u256 = 1;
    let pt_in = bound(pt_in_raw, min_pt_in, max_pt_in);
    println!("pt_in (bounded): {}", pt_in);

    // Calculate proportion
    let proportion = get_proportion(@state);
    println!("proportion: {}", proportion);

    // Get precomputed values
    let comp = get_market_pre_compute(@state, tte);
    println!("rate_scalar: {}", comp.rate_scalar);
    println!("rate_anchor: {}", comp.rate_anchor);

    // Execute the swap - this should panic with 'HZN: insufficient liquidity'
    // because the fix added a bounds check in calc_swap_exact_pt_for_sy.
    // The swap would produce sy_out > sy_reserve without the check.
    let (_sy_out, _fee) = calc_swap_exact_pt_for_sy(@state, pt_in, tte);
}

/// Test with extreme market conditions to find edge cases
#[test]
fn test_extreme_proportion_high_pt() {
    // Create a market with very high PT proportion (near MAX_PROPORTION)
    let state = MarketState {
        sy_reserve: 100 * WAD, // Small SY reserve
        pt_reserve: 9500 * WAD, // Large PT reserve (95% proportion)
        total_lp: 1000 * WAD,
        scalar_root: WAD / 100, // 1%
        initial_anchor: WAD,
        fee_rate: WAD / 100, // 1%
        expiry: 1000000 + 31_536_000, // 1 year
        last_ln_implied_rate: WAD / 10 // 10%
    };

    let tte: u64 = 31_536_000;
    let pt_in = 100 * WAD; // Swap 100 PT

    println!("=== Extreme High PT Proportion ===");
    println!("proportion: {}", get_proportion(@state));

    let (sy_out, fee) = calc_swap_exact_pt_for_sy(@state, pt_in, tte);
    println!("pt_in: {}", pt_in);
    println!("sy_out: {}", sy_out);
    println!("fee: {}", fee);
    println!("sy_reserve: {}", state.sy_reserve);

    // Check invariant
    assert(sy_out <= state.sy_reserve, 'sy_out > sy_reserve');
}

/// Test with extreme market conditions - low PT proportion
#[test]
fn test_extreme_proportion_low_pt() {
    // Create a market with very low PT proportion (near MIN_PROPORTION)
    let state = MarketState {
        sy_reserve: 9500 * WAD, // Large SY reserve
        pt_reserve: 100 * WAD, // Small PT reserve (1% proportion)
        total_lp: 1000 * WAD,
        scalar_root: WAD / 100, // 1%
        initial_anchor: WAD,
        fee_rate: WAD / 100, // 1%
        expiry: 1000000 + 31_536_000, // 1 year
        last_ln_implied_rate: WAD / 10 // 10%
    };

    let tte: u64 = 31_536_000;
    let pt_in = 10 * WAD; // Swap 10 PT (10% of reserve)

    println!("=== Extreme Low PT Proportion ===");
    println!("proportion: {}", get_proportion(@state));

    let (sy_out, fee) = calc_swap_exact_pt_for_sy(@state, pt_in, tte);
    println!("pt_in: {}", pt_in);
    println!("sy_out: {}", sy_out);
    println!("fee: {}", fee);
    println!("sy_reserve: {}", state.sy_reserve);

    // Check invariant
    assert(sy_out <= state.sy_reserve, 'sy_out > sy_reserve');
}

/// Test near expiry conditions
#[test]
fn test_near_expiry() {
    let state = MarketState {
        sy_reserve: 1000 * WAD,
        pt_reserve: 1000 * WAD,
        total_lp: 1000 * WAD,
        scalar_root: WAD / 100,
        initial_anchor: WAD,
        fee_rate: WAD / 100,
        expiry: 1000000 + 100, // 100 seconds to expiry
        last_ln_implied_rate: WAD / 10,
    };

    let tte: u64 = 100;
    let pt_in = 100 * WAD;

    println!("=== Near Expiry ===");
    println!("time_to_expiry: {}", tte);

    let comp = get_market_pre_compute(@state, tte);
    println!("rate_scalar: {}", comp.rate_scalar);

    let (sy_out, fee) = calc_swap_exact_pt_for_sy(@state, pt_in, tte);
    println!("pt_in: {}", pt_in);
    println!("sy_out: {}", sy_out);
    println!("fee: {}", fee);

    // Near expiry, PT should be worth ~1 SY
    assert(sy_out <= state.sy_reserve, 'sy_out > sy_reserve');
}

/// Test with very high implied rate
#[test]
fn test_high_implied_rate() {
    let state = MarketState {
        sy_reserve: 1000 * WAD,
        pt_reserve: 1000 * WAD,
        total_lp: 1000 * WAD,
        scalar_root: WAD / 100,
        initial_anchor: WAD,
        fee_rate: WAD / 100,
        expiry: 1000000 + 31_536_000,
        last_ln_implied_rate: WAD * 2 // 200% implied rate
    };

    let tte: u64 = 31_536_000;
    let pt_in = 100 * WAD;

    println!("=== High Implied Rate ===");
    println!("ln_implied_rate: {}", state.last_ln_implied_rate);

    let comp = get_market_pre_compute(@state, tte);
    println!("rate_anchor: {}", comp.rate_anchor);

    let (sy_out, _fee) = calc_swap_exact_pt_for_sy(@state, pt_in, tte);
    println!("pt_in: {}", pt_in);
    println!("sy_out: {}", sy_out);

    assert(sy_out <= state.sy_reserve, 'sy_out > sy_reserve');
}
