use yield_tokenization::libraries::math::{
    HALF_WAD, TWO_WAD, WAD, abs_diff, exp2_wad, exp_neg_wad, exp_wad, ln_wad, log2_wad, max, min,
    pow_u256, pow_wad, wad_div, wad_mul,
};

// ============ WAD Constants Tests ============

#[test]
fn test_wad_constants() {
    assert(WAD == 1_000_000_000_000_000_000, 'WAD should be 10^18');
    assert(HALF_WAD == 500_000_000_000_000_000, 'HALF_WAD should be 5*10^17');
    assert(TWO_WAD == 2_000_000_000_000_000_000, 'TWO_WAD should be 2*10^18');
}

// ============ wad_mul Tests ============

#[test]
fn test_wad_mul_zero() {
    assert(wad_mul(0, WAD) == 0, 'wad_mul(0, WAD) should be 0');
    assert(wad_mul(WAD, 0) == 0, 'wad_mul(WAD, 0) should be 0');
    assert(wad_mul(0, 0) == 0, 'wad_mul(0, 0) should be 0');
}

#[test]
fn test_wad_mul_identity() {
    // 1 * 1 = 1 (in WAD)
    assert(wad_mul(WAD, WAD) == WAD, 'wad_mul(WAD, WAD) should be WAD');
}

#[test]
fn test_wad_mul_basic() {
    // 2 * 3 = 6 (in WAD)
    let two_wad = 2 * WAD;
    let three_wad = 3 * WAD;
    let six_wad = 6 * WAD;
    assert(wad_mul(two_wad, three_wad) == six_wad, 'wad_mul 2*3 should be 6');
}

#[test]
fn test_wad_mul_fractions() {
    // 0.5 * 0.5 = 0.25 (in WAD)
    let half = HALF_WAD;
    let quarter = WAD / 4;
    assert(wad_mul(half, half) == quarter, 'wad_mul 0.5*0.5 should be 0.25');
}

#[test]
fn test_wad_mul_mixed() {
    // 2 * 0.5 = 1 (in WAD)
    let two_wad = 2 * WAD;
    assert(wad_mul(two_wad, HALF_WAD) == WAD, 'wad_mul 2*0.5 should be 1');
}

// ============ wad_div Tests ============

#[test]
fn test_wad_div_zero_numerator() {
    assert(wad_div(0, WAD) == 0, 'wad_div(0, WAD) should be 0');
}

#[test]
fn test_wad_div_identity() {
    // 1 / 1 = 1 (in WAD)
    assert(wad_div(WAD, WAD) == WAD, 'wad_div(WAD, WAD) should be WAD');
}

#[test]
fn test_wad_div_basic() {
    // 6 / 2 = 3 (in WAD)
    let six_wad = 6 * WAD;
    let two_wad = 2 * WAD;
    let three_wad = 3 * WAD;
    assert(wad_div(six_wad, two_wad) == three_wad, 'wad_div 6/2 should be 3');
}

#[test]
fn test_wad_div_fractions() {
    // 1 / 2 = 0.5 (in WAD)
    let two_wad = 2 * WAD;
    assert(wad_div(WAD, two_wad) == HALF_WAD, 'wad_div 1/2 should be 0.5');
}

#[test]
fn test_wad_div_inverse() {
    // 1 / 0.5 = 2 (in WAD)
    let two_wad = 2 * WAD;
    assert(wad_div(WAD, HALF_WAD) == two_wad, 'wad_div 1/0.5 should be 2');
}

#[test]
#[should_panic(expected: 'Math: division by zero')]
fn test_wad_div_by_zero() {
    wad_div(WAD, 0);
}

// ============ exp_wad Tests ============

#[test]
fn test_exp_wad_zero() {
    // e^0 = 1
    assert(exp_wad(0) == WAD, 'exp_wad(0) should be WAD');
}

#[test]
fn test_exp_wad_one() {
    // e^1 ≈ 2.718281828
    let result = exp_wad(WAD);
    let expected = 2_718_281_828_459_045_235; // e in WAD

    // Allow 1% error margin
    let error = abs_diff(result, expected);
    let max_error = expected / 100;
    assert(error <= max_error, 'exp_wad(1) should be ~e');
}

#[test]
fn test_exp_wad_small() {
    // e^0.1 ≈ 1.105170918
    let x = WAD / 10; // 0.1 WAD
    let result = exp_wad(x);
    let expected: u256 = 1_105_170_918_075_647_624;

    let error = abs_diff(result, expected);
    let max_error = expected / 100;
    assert(error <= max_error, 'exp_wad(0.1) error too high');
}

// ============ exp_neg_wad Tests ============

#[test]
fn test_exp_neg_wad_zero() {
    // e^(-0) = 1
    assert(exp_neg_wad(0) == WAD, 'exp_neg_wad(0) should be WAD');
}

#[test]
fn test_exp_neg_wad_one() {
    // e^(-1) ≈ 0.367879441
    let result = exp_neg_wad(WAD);
    let expected: u256 = 367_879_441_171_442_321;

    let error = abs_diff(result, expected);
    let max_error = expected / 50; // 2% error margin
    assert(error <= max_error, 'exp_neg_wad(1) error too high');
}

// ============ exp2_wad Tests ============

#[test]
fn test_exp2_wad_zero() {
    // 2^0 = 1
    assert(exp2_wad(0) == WAD, 'exp2_wad(0) should be WAD');
}

#[test]
fn test_exp2_wad_one() {
    // 2^1 = 2
    assert(exp2_wad(WAD) == TWO_WAD, 'exp2_wad(1) should be 2 WAD');
}

#[test]
fn test_exp2_wad_two() {
    // 2^2 = 4
    let two_wad = 2 * WAD;
    let four_wad = 4 * WAD;
    assert(exp2_wad(two_wad) == four_wad, 'exp2_wad(2) should be 4 WAD');
}

#[test]
fn test_exp2_wad_half() {
    // 2^0.5 ≈ 1.414213562 (sqrt(2))
    let result = exp2_wad(HALF_WAD);
    let expected: u256 = 1_414_213_562_373_095_048;

    let error = abs_diff(result, expected);
    let max_error = expected / 100;
    assert(error <= max_error, 'exp2_wad(0.5) error too high');
}

// ============ ln_wad Tests ============

#[test]
fn test_ln_wad_one() {
    // ln(1) = 0
    let (result, is_negative) = ln_wad(WAD);
    assert(result == 0, 'ln_wad(1) should be 0');
    assert(!is_negative, 'ln_wad(1) not negative');
}

#[test]
fn test_ln_wad_e() {
    // ln(e) = 1
    let e_wad = 2_718_281_828_459_045_235;
    let (result, is_negative) = ln_wad(e_wad);

    // Should be approximately 1 WAD
    let error = abs_diff(result, WAD);
    let max_error = WAD / 10; // 10% error margin
    assert(error <= max_error, 'ln_wad(e) should be ~1');
    assert(!is_negative, 'ln_wad(e) not negative');
}

#[test]
fn test_ln_wad_less_than_one() {
    // ln(0.5) ≈ -0.693147
    let (result, is_negative) = ln_wad(HALF_WAD);
    let expected: u256 = 693_147_180_559_945_309;

    let error = abs_diff(result, expected);
    let max_error = expected / 10; // 10% error margin
    assert(error <= max_error, 'ln_wad(0.5) error too high');
    assert(is_negative, 'ln_wad(0.5) should be neg');
}

// ============ log2_wad Tests ============

#[test]
fn test_log2_wad_one() {
    // log2(1) = 0
    let (result, is_negative) = log2_wad(WAD);
    assert(result == 0, 'log2_wad(1) should be 0');
    assert(!is_negative, 'log2_wad(1) not negative');
}

#[test]
fn test_log2_wad_two() {
    // log2(2) = 1
    let (result, is_negative) = log2_wad(TWO_WAD);

    let error = abs_diff(result, WAD);
    let max_error = WAD / 50; // 2% error margin
    assert(error <= max_error, 'log2_wad(2) should be ~1');
    assert(!is_negative, 'log2_wad(2) not negative');
}

#[test]
fn test_log2_wad_four() {
    // log2(4) = 2
    let four_wad = 4 * WAD;
    let (result, is_negative) = log2_wad(four_wad);
    let two_wad = 2 * WAD;

    let error = abs_diff(result, two_wad);
    let max_error = two_wad / 50; // 2% error margin
    assert(error <= max_error, 'log2_wad(4) should be ~2');
    assert(!is_negative, 'log2_wad(4) not negative');
}

// ============ pow_wad Tests ============

#[test]
fn test_pow_wad_zero_exp() {
    // x^0 = 1
    assert(pow_wad(TWO_WAD, 0) == WAD, 'pow_wad(x, 0) should be 1');
}

#[test]
fn test_pow_wad_zero_base() {
    // 0^x = 0
    assert(pow_wad(0, WAD) == 0, 'pow_wad(0, x) should be 0');
}

#[test]
fn test_pow_wad_one_base() {
    // 1^x = 1
    assert(pow_wad(WAD, TWO_WAD) == WAD, 'pow_wad(1, x) should be 1');
}

#[test]
fn test_pow_wad_square() {
    // 2^2 = 4
    let result = pow_wad(TWO_WAD, TWO_WAD);
    let expected = 4 * WAD;

    let error = abs_diff(result, expected);
    let max_error = expected / 10; // 10% error margin
    assert(error <= max_error, 'pow_wad(2, 2) should be ~4');
}

#[test]
fn test_pow_wad_sqrt() {
    // 4^0.5 = 2
    let four_wad = 4 * WAD;
    let result = pow_wad(four_wad, HALF_WAD);

    let error = abs_diff(result, TWO_WAD);
    let max_error = TWO_WAD / 10; // 10% error margin
    assert(error <= max_error, 'pow_wad(4,0.5) should be ~2');
}

// ============ pow_u256 Tests ============

#[test]
fn test_pow_u256_zero_exp() {
    assert(pow_u256(5, 0) == 1, 'pow_u256(x, 0) should be 1');
}

#[test]
fn test_pow_u256_basic() {
    assert(pow_u256(2, 3) == 8, 'pow_u256(2, 3) should be 8');
    assert(pow_u256(3, 3) == 27, 'pow_u256(3, 3) should be 27');
    assert(pow_u256(10, 6) == 1_000_000, 'pow_u256(10, 6) error');
}

// ============ Utility Function Tests ============

#[test]
fn test_max() {
    assert(max(5, 3) == 5, 'max(5, 3) should be 5');
    assert(max(3, 5) == 5, 'max(3, 5) should be 5');
    assert(max(5, 5) == 5, 'max(5, 5) should be 5');
}

#[test]
fn test_min() {
    assert(min(5, 3) == 3, 'min(5, 3) should be 3');
    assert(min(3, 5) == 3, 'min(3, 5) should be 3');
    assert(min(5, 5) == 5, 'min(5, 5) should be 5');
}

#[test]
fn test_abs_diff() {
    assert(abs_diff(5, 3) == 2, 'abs_diff(5, 3) should be 2');
    assert(abs_diff(3, 5) == 2, 'abs_diff(3, 5) should be 2');
    assert(abs_diff(5, 5) == 0, 'abs_diff(5, 5) should be 0');
}

// ============ Roundtrip Tests ============

#[test]
fn test_exp_ln_roundtrip() {
    // exp(ln(x)) ≈ x
    let x = TWO_WAD;
    let (ln_x, is_negative) = ln_wad(x);
    assert(!is_negative, 'ln(2) should be positive');

    let result = exp_wad(ln_x);

    let error = abs_diff(result, x);
    let max_error = x / 10; // 10% error margin
    assert(error <= max_error, 'exp(ln(x)) should be ~x');
}

#[test]
fn test_mul_div_roundtrip() {
    // (a * b) / b ≈ a
    let a = 123 * WAD;
    let b = 456 * WAD;

    let product = wad_mul(a, b);
    let result = wad_div(product, b);

    let error = abs_diff(result, a);
    let max_error = a / 1000; // 0.1% error margin
    assert(error <= max_error, 'mul/div roundtrip error');
}
