/// Tests for the high-precision fixed-point math library (math_fp.cairo)
/// Verifies that cubit-based calculations match expected DeFi precision requirements

use horizon::libraries::math_fp::{
    HALF_WAD, WAD, WAD_E, WAD_LN2, abs_diff, continuous_compound, decay, exp2_wad, exp_neg_wad,
    exp_wad, fp_to_wad, growth, lerp, ln_wad, log2_wad, max, min, pow_wad, sqrt_wad, wad_div,
    wad_mul, wad_to_fp,
};

/// Helper to check if two values are within tolerance
fn assert_approx_eq(actual: u256, expected: u256, tolerance_bps: u256, msg: felt252) {
    let diff = abs_diff(actual, expected);
    // tolerance in basis points (1 bp = 0.01%)
    let max_diff = expected * tolerance_bps / 10000;
    assert(diff <= max_diff, msg);
}

// ============================================
// WAD ARITHMETIC TESTS
// ============================================

#[test]
fn test_wad_mul_basic() {
    // 2 * 3 = 6
    let a = 2 * WAD;
    let b = 3 * WAD;
    let result = wad_mul(a, b);
    assert(result == 6 * WAD, 'wad_mul 2*3 failed');
}

#[test]
fn test_wad_mul_fractions() {
    // 0.5 * 0.5 = 0.25
    let a = HALF_WAD;
    let b = HALF_WAD;
    let result = wad_mul(a, b);
    let expected = WAD / 4; // 0.25
    assert_approx_eq(result, expected, 1, 'wad_mul 0.5*0.5 failed');
}

#[test]
fn test_wad_mul_zero() {
    let result = wad_mul(WAD, 0);
    assert(result == 0, 'wad_mul with zero failed');
}

#[test]
fn test_wad_div_basic() {
    // 6 / 2 = 3
    let a = 6 * WAD;
    let b = 2 * WAD;
    let result = wad_div(a, b);
    assert(result == 3 * WAD, 'wad_div 6/2 failed');
}

#[test]
fn test_wad_div_fractions() {
    // 1 / 4 = 0.25
    let a = WAD;
    let b = 4 * WAD;
    let result = wad_div(a, b);
    let expected = WAD / 4;
    assert_approx_eq(result, expected, 1, 'wad_div 1/4 failed');
}

// ============================================
// EXPONENTIAL TESTS
// ============================================

#[test]
fn test_exp_wad_zero() {
    // e^0 = 1
    let result = exp_wad(0);
    assert(result == WAD, 'exp(0) should be 1');
}

#[test]
fn test_exp_wad_one() {
    // e^1 ≈ 2.718281828459045
    let result = exp_wad(WAD);
    // Allow 0.1% tolerance
    assert_approx_eq(result, WAD_E, 10, 'exp(1) precision');
}

#[test]
fn test_exp_wad_two() {
    // e^2 ≈ 7.389056098930650
    let expected: u256 = 7_389_056_098_930_650_000;
    let result = exp_wad(2 * WAD);
    // Allow 0.1% tolerance
    assert_approx_eq(result, expected, 10, 'exp(2) precision');
}

#[test]
fn test_exp_neg_wad_one() {
    // e^(-1) ≈ 0.367879441171442
    let expected: u256 = 367_879_441_171_442_000;
    let result = exp_neg_wad(WAD);
    assert_approx_eq(result, expected, 10, 'exp(-1) precision');
}

#[test]
fn test_exp_neg_wad_small() {
    // e^(-0.1) ≈ 0.904837418035959
    let input: u256 = WAD / 10; // 0.1
    let expected: u256 = 904_837_418_035_959_000;
    let result = exp_neg_wad(input);
    assert_approx_eq(result, expected, 10, 'exp(-0.1) precision');
}

#[test]
fn test_exp2_wad() {
    // 2^3 = 8
    let result = exp2_wad(3 * WAD);
    assert_approx_eq(result, 8 * WAD, 1, 'exp2(3) should be 8');
}

#[test]
fn test_exp2_wad_fractional() {
    // 2^1.5 ≈ 2.828427124746190
    let input: u256 = WAD + HALF_WAD; // 1.5
    let expected: u256 = 2_828_427_124_746_190_000;
    let result = exp2_wad(input);
    assert_approx_eq(result, expected, 10, 'exp2(1.5) precision');
}

// ============================================
// LOGARITHM TESTS
// ============================================

#[test]
fn test_ln_wad_one() {
    // ln(1) = 0
    let (result, is_negative) = ln_wad(WAD);
    assert(result == 0, 'ln(1) should be 0');
    assert(!is_negative, 'ln(1) should not be negative');
}

#[test]
fn test_ln_wad_e() {
    // ln(e) = 1
    let (result, is_negative) = ln_wad(WAD_E);
    assert_approx_eq(result, WAD, 10, 'ln(e) should be 1');
    assert(!is_negative, 'ln(e) should not be negative');
}

#[test]
fn test_ln_wad_less_than_one() {
    // ln(0.5) ≈ -0.693147180559945
    let (result, is_negative) = ln_wad(HALF_WAD);
    assert_approx_eq(result, WAD_LN2, 10, 'ln(0.5) magnitude');
    assert(is_negative, 'ln(0.5) should be negative');
}

#[test]
fn test_log2_wad_power_of_two() {
    // log2(8) = 3
    let (result, is_negative) = log2_wad(8 * WAD);
    assert_approx_eq(result, 3 * WAD, 10, 'log2(8) should be 3');
    assert(!is_negative, 'log2(8) not negative');
}

// ============================================
// POWER TESTS
// ============================================

#[test]
fn test_pow_wad_integer() {
    // 2^4 = 16
    let result = pow_wad(2 * WAD, 4 * WAD);
    assert_approx_eq(result, 16 * WAD, 10, 'pow(2,4) should be 16');
}

#[test]
fn test_pow_wad_fractional() {
    // 4^0.5 = 2 (square root)
    let result = pow_wad(4 * WAD, HALF_WAD);
    assert_approx_eq(result, 2 * WAD, 10, 'pow(4,0.5) should be 2');
}

#[test]
fn test_pow_wad_compound_interest() {
    // (1.05)^10 ≈ 1.628894626777442 (5% for 10 periods)
    let base: u256 = WAD + WAD / 20; // 1.05
    let exp: u256 = 10 * WAD;
    let expected: u256 = 1_628_894_626_777_442_000;
    let result = pow_wad(base, exp);
    assert_approx_eq(result, expected, 50, 'compound 5% x 10');
}

// ============================================
// SQRT TESTS
// ============================================

#[test]
fn test_sqrt_wad_perfect_square() {
    // sqrt(4) = 2
    let result = sqrt_wad(4 * WAD);
    assert_approx_eq(result, 2 * WAD, 10, 'sqrt(4) should be 2');
}

#[test]
fn test_sqrt_wad_non_perfect() {
    // sqrt(2) ≈ 1.414213562373095
    let expected: u256 = 1_414_213_562_373_095_000;
    let result = sqrt_wad(2 * WAD);
    assert_approx_eq(result, expected, 10, 'sqrt(2) precision');
}

#[test]
fn test_sqrt_wad_large() {
    // sqrt(1000000) = 1000
    let result = sqrt_wad(1_000_000 * WAD);
    assert_approx_eq(result, 1000 * WAD, 10, 'sqrt(1M) should be 1000');
}

// ============================================
// UTILITY FUNCTION TESTS
// ============================================

#[test]
fn test_max() {
    assert(max(5, 3) == 5, 'max(5,3) should be 5');
    assert(max(3, 5) == 5, 'max(3,5) should be 5');
    assert(max(5, 5) == 5, 'max(5,5) should be 5');
}

#[test]
fn test_min() {
    assert(min(5, 3) == 3, 'min(5,3) should be 3');
    assert(min(3, 5) == 3, 'min(3,5) should be 3');
    assert(min(5, 5) == 5, 'min(5,5) should be 5');
}

#[test]
fn test_abs_diff() {
    assert(abs_diff(5, 3) == 2, 'abs_diff(5,3) should be 2');
    assert(abs_diff(3, 5) == 2, 'abs_diff(3,5) should be 2');
    assert(abs_diff(5, 5) == 0, 'abs_diff(5,5) should be 0');
}

#[test]
fn test_lerp() {
    // lerp(0, 100, 0.5) = 50
    let result = lerp(0, 100 * WAD, HALF_WAD);
    assert_approx_eq(result, 50 * WAD, 1, 'lerp midpoint');
}

#[test]
fn test_lerp_endpoints() {
    let start = 10 * WAD;
    let end = 100 * WAD;

    assert(lerp(start, end, 0) == start, 'lerp at t=0');
    assert(lerp(start, end, WAD) == end, 'lerp at t=1');
}

// ============================================
// DEFI PRIMITIVE TESTS
// ============================================

#[test]
fn test_decay() {
    // 1000 * (1 - 0.1)^2 = 1000 * 0.81 = 810
    let initial: u256 = 1000 * WAD;
    let rate: u256 = WAD / 10; // 10%
    let periods: u256 = 2 * WAD;
    let expected: u256 = 810 * WAD;

    let result = decay(initial, rate, periods);
    assert_approx_eq(result, expected, 50, 'decay 10% x 2');
}

#[test]
fn test_growth() {
    // 1000 * (1 + 0.1)^2 = 1000 * 1.21 = 1210
    let initial: u256 = 1000 * WAD;
    let rate: u256 = WAD / 10; // 10%
    let periods: u256 = 2 * WAD;
    let expected: u256 = 1210 * WAD;

    let result = growth(initial, rate, periods);
    assert_approx_eq(result, expected, 50, 'growth 10% x 2');
}

#[test]
fn test_continuous_compound() {
    // 1000 * e^(0.1 * 1) = 1000 * e^0.1 ≈ 1105.17
    let principal: u256 = 1000 * WAD;
    let rate: u256 = WAD / 10; // 10%
    let time: u256 = WAD; // 1 year
    let expected: u256 = 1_105_170_918_075_647_000_000; // ~1105.17 WAD

    let result = continuous_compound(principal, rate, time);
    assert_approx_eq(result, expected, 50, 'continuous compound');
}

// ============================================
// CONVERSION TESTS
// ============================================

#[test]
fn test_wad_to_fp_and_back() {
    // Converting WAD to FP and back should preserve value
    let original: u256 = 123_456_789_012_345_678; // Some arbitrary value
    let fp = wad_to_fp(original);
    let back = fp_to_wad(fp);

    // Allow small rounding error due to conversion
    assert_approx_eq(back, original, 1, 'roundtrip conversion');
}

#[test]
fn test_wad_to_fp_one() {
    let fp = wad_to_fp(WAD);
    let back = fp_to_wad(fp);
    assert_approx_eq(back, WAD, 1, 'WAD to FP one');
}

// ============================================
// EDGE CASE TESTS
// ============================================

#[test]
fn test_exp_wad_small_value() {
    // e^0.0001 ≈ 1.0001000050001667
    let input: u256 = WAD / 10000; // 0.0001
    let expected: u256 = 1_000_100_005_000_166_700;
    let result = exp_wad(input);
    assert_approx_eq(result, expected, 10, 'exp small value');
}

#[test]
fn test_decay_zero_rate() {
    let result = decay(1000 * WAD, 0, 10 * WAD);
    assert(result == 1000 * WAD, 'decay zero rate');
}

#[test]
fn test_decay_zero_periods() {
    let result = decay(1000 * WAD, WAD / 10, 0);
    assert(result == 1000 * WAD, 'decay zero periods');
}

#[test]
fn test_pow_wad_zero_exp() {
    // x^0 = 1
    let result = pow_wad(42 * WAD, 0);
    assert(result == WAD, 'x^0 should be 1');
}

#[test]
fn test_pow_wad_one_exp() {
    // x^1 = x
    let base = 42 * WAD;
    let result = pow_wad(base, WAD);
    assert_approx_eq(result, base, 1, 'x^1 should be x');
}
