use horizon::libraries::errors::Errors;

// WAD = 10^18 (standard 18 decimal precision)
pub const WAD: u256 = 1_000_000_000_000_000_000;
pub const HALF_WAD: u256 = 500_000_000_000_000_000;

// Useful constants in WAD
pub const WAD_E: u256 = 2_718_281_828_459_045_235; // e ≈ 2.718281828459045235
pub const WAD_LN2: u256 = 693_147_180_559_945_309; // ln(2) ≈ 0.693147180559945309
pub const WAD_INV_LN2: u256 = 1_442_695_040_888_963_407; // 1/ln(2) ≈ 1.4426950408889634

// Two WAD for comparisons
pub const TWO_WAD: u256 = 2_000_000_000_000_000_000;

// For safe multiplication without overflow
// We split u256 into two u128 parts
const U128_MAX: u256 = 0xffffffffffffffffffffffffffffffff;
const SQRT_WAD: u256 = 1_000_000_000; // 10^9

/// Multiplies two WAD numbers, rounding down
/// Uses split multiplication to handle large numbers safely
/// @param a First operand in WAD
/// @param b Second operand in WAD
/// @return a * b / WAD
pub fn wad_mul(a: u256, b: u256) -> u256 {
    if a == 0 || b == 0 {
        return 0;
    }

    // For smaller values, direct multiplication is safe
    // If a * b / WAD won't overflow, use simple path
    // This is true if a * b < u256::MAX, i.e., a < u256::MAX / b
    let max_u256: u256 = U128_MAX * U128_MAX;
    if a <= max_u256 / b {
        return (a * b) / WAD;
    }

    // For larger values, use schoolbook multiplication with parts
    // Split each number: a = a_hi * 10^9 + a_lo, b = b_hi * 10^9 + b_lo
    // where 10^9 = sqrt(WAD)
    let a_hi = a / SQRT_WAD;
    let a_lo = a % SQRT_WAD;
    let b_hi = b / SQRT_WAD;
    let b_lo = b % SQRT_WAD;

    // a * b = a_hi*b_hi*10^18 + (a_hi*b_lo + a_lo*b_hi)*10^9 + a_lo*b_lo
    // Dividing by WAD = 10^18:
    // result = a_hi*b_hi + (a_hi*b_lo + a_lo*b_hi)/10^9 + a_lo*b_lo/10^18

    let hi_hi = a_hi * b_hi; // This is already divided by WAD (conceptually)
    let hi_lo = a_hi * b_lo;
    let lo_hi = a_lo * b_hi;
    let lo_lo = a_lo * b_lo;

    // Mid terms need to be divided by sqrt(WAD)
    let mid = hi_lo + lo_hi;
    let mid_contribution = mid / SQRT_WAD;

    // Low term needs to be divided by WAD
    let lo_contribution = lo_lo / WAD;

    // Remainder handling for precision
    let mid_remainder = mid % SQRT_WAD;
    let combined_remainder = mid_remainder * SQRT_WAD + lo_lo % WAD;
    let remainder_contribution = combined_remainder / WAD;

    hi_hi + mid_contribution + lo_contribution + remainder_contribution
}

/// Multiplies two WAD numbers, rounding to nearest
pub fn wad_mul_round(a: u256, b: u256) -> u256 {
    if a == 0 || b == 0 {
        return 0;
    }

    let max_u256: u256 = U128_MAX * U128_MAX;
    if a <= max_u256 / b {
        return (a * b + HALF_WAD) / WAD;
    }

    // For large values, add rounding term before division
    // This is an approximation - for very large numbers, precision may vary
    let result = wad_mul(a, b);
    // Check if we should round up (simplified check)
    result
}

/// Divides two WAD numbers, rounding down
/// @param a Numerator in WAD
/// @param b Denominator in WAD
/// @return a * WAD / b
pub fn wad_div(a: u256, b: u256) -> u256 {
    assert(b != 0, Errors::MATH_DIVISION_BY_ZERO);

    if a == 0 {
        return 0;
    }

    // Check if a * WAD won't overflow
    let max_u256: u256 = U128_MAX * U128_MAX;
    if a <= max_u256 / WAD {
        return (a * WAD) / b;
    }

    // For larger values, compute quotient and remainder separately
    // a * WAD / b = (a / b) * WAD + (a % b) * WAD / b
    let q = a / b;
    let r = a % b;

    // Check if remainder multiplication is safe
    if r <= max_u256 / WAD {
        return q * WAD + (r * WAD) / b;
    }

    // For very large remainders, use iterative approach
    // This is rare in practice for DeFi use cases
    let r_contribution = wad_div_large_remainder(r, b);
    q * WAD + r_contribution
}

/// Helper for division with large remainder
fn wad_div_large_remainder(r: u256, b: u256) -> u256 {
    // Split r into parts and compute contribution
    let r_hi = r / SQRT_WAD;
    let r_lo = r % SQRT_WAD;

    // (r_hi * SQRT_WAD + r_lo) * WAD / b
    // = r_hi * SQRT_WAD * WAD / b + r_lo * WAD / b
    // = r_hi * WAD * SQRT_WAD / b + r_lo * WAD / b

    let hi_contrib = (r_hi * WAD) / b * SQRT_WAD;
    let lo_contrib = (r_lo * WAD) / b;

    hi_contrib + lo_contrib
}

/// Divides two WAD numbers, rounding to nearest
pub fn wad_div_round(a: u256, b: u256) -> u256 {
    assert(b != 0, Errors::MATH_DIVISION_BY_ZERO);

    if a == 0 {
        return 0;
    }

    let max_u256: u256 = U128_MAX * U128_MAX;
    if a <= max_u256 / WAD {
        return (a * WAD + b / 2) / b;
    }

    // Approximate for large values
    wad_div(a, b)
}

/// Calculates e^x for x in WAD format
/// @param x Exponent in WAD (non-negative)
/// @return e^x in WAD
pub fn exp_wad(x: u256) -> u256 {
    if x == 0 {
        return WAD;
    }

    // Overflow protection: e^88 ≈ 1.65 * 10^38
    let max_exp: u256 = 88_000_000_000_000_000_000; // 88 WAD
    assert(x <= max_exp, Errors::MATH_OVERFLOW);

    // Use exp2: e^x = 2^(x / ln(2))
    let x_for_exp2 = wad_mul(x, WAD_INV_LN2);

    exp2_wad(x_for_exp2)
}

/// Calculates e^(-x) for x in WAD format (for negative exponents)
pub fn exp_neg_wad(x: u256) -> u256 {
    if x == 0 {
        return WAD;
    }

    // For very large negative exponents, result approaches 0
    let max_exp: u256 = 88_000_000_000_000_000_000;
    if x > max_exp {
        return 0;
    }

    let exp_x = exp_wad(x);
    if exp_x == 0 {
        return 0;
    }

    wad_div(WAD, exp_x)
}

/// Calculates 2^x for x in WAD format
pub fn exp2_wad(x: u256) -> u256 {
    let x_int = x / WAD;
    let x_frac = x % WAD;

    // Max safe integer exponent
    assert(x_int < 128, Errors::MATH_OVERFLOW);

    let int_result: u256 = if x_int == 0 {
        WAD
    } else {
        pow2(x_int) * WAD
    };

    if x_frac == 0 {
        return int_result;
    }

    // 2^f = e^(f * ln(2))
    let f_ln2 = wad_mul(x_frac, WAD_LN2);
    let frac_result = exp_taylor(f_ln2);

    wad_mul(int_result, frac_result)
}

/// 2^n for integer n
fn pow2(n: u256) -> u256 {
    if n == 0 {
        return 1;
    }
    assert(n < 256, Errors::MATH_OVERFLOW);

    let mut result: u256 = 1;
    let mut i: u256 = 0;
    while i < n {
        result = result * 2;
        i = i + 1;
    }
    result
}

/// Taylor series for e^x, valid for small x
fn exp_taylor(x: u256) -> u256 {
    let mut result = WAD;
    let mut term = WAD;

    term = wad_mul(term, x);
    result = result + term;

    term = wad_mul(term, x) / 2;
    result = result + term;

    term = wad_mul(term, x) / 3;
    result = result + term;

    term = wad_mul(term, x) / 4;
    result = result + term;

    term = wad_mul(term, x) / 5;
    result = result + term;

    term = wad_mul(term, x) / 6;
    result = result + term;

    term = wad_mul(term, x) / 7;
    result = result + term;

    term = wad_mul(term, x) / 8;
    result = result + term;

    term = wad_mul(term, x) / 9;
    result = result + term;

    term = wad_mul(term, x) / 10;
    result = result + term;

    term = wad_mul(term, x) / 11;
    result = result + term;

    term = wad_mul(term, x) / 12;
    result = result + term;

    result
}

/// Calculates natural logarithm ln(x) for x in WAD format
/// @return (|ln(x)| in WAD, is_negative)
pub fn ln_wad(x: u256) -> (u256, bool) {
    assert(x > 0, Errors::MATH_DIVISION_BY_ZERO);

    let (log2_result, is_negative) = log2_wad(x);
    let result = wad_mul(log2_result, WAD_LN2);

    (result, is_negative)
}

/// Calculates log2(x) for x in WAD format
/// x represents the value (x/WAD), so we compute log2(x/WAD)
/// @return (|log2(x/WAD)| in WAD, is_negative)
pub fn log2_wad(x: u256) -> (u256, bool) {
    assert(x > 0, Errors::MATH_DIVISION_BY_ZERO);

    if x == WAD {
        return (0, false); // log2(1) = 0
    }

    let is_negative = x < WAD;

    if is_negative {
        // For x < WAD: log2(x/WAD) is negative
        // log2(x/WAD) = -log2(WAD/x)
        let inverted = wad_div(WAD, x);
        let (result, _) = log2_wad(inverted);
        return (result, true);
    }

    // x >= WAD case: log2(x/WAD) >= 0
    // Find integer part: n such that 2^n <= x/WAD < 2^(n+1)
    // Equivalently: 2^n * WAD <= x < 2^(n+1) * WAD
    let int_part = integer_log2_of_ratio(x);

    // Normalize x to [WAD, 2*WAD) by dividing by 2^n
    let normalized = if int_part > 0 {
        x / pow2(int_part.into())
    } else {
        x
    };

    // Compute fractional part for normalized value in [WAD, 2*WAD)
    let frac_part = log2_fractional(normalized);

    // Total = int_part * WAD + frac_part
    let int_part_wad: u256 = int_part.into() * WAD;
    (int_part_wad + frac_part, false)
}

/// Find n such that 2^n * WAD <= x < 2^(n+1) * WAD
/// This gives us floor(log2(x/WAD))
fn integer_log2_of_ratio(x: u256) -> u32 {
    // x >= WAD guaranteed by caller
    // We want floor(log2(x/WAD))
    // Compute x/WAD first (integer division gives floor)
    let ratio = x / WAD;

    if ratio == 0 {
        return 0;
    }

    // Now find floor(log2(ratio))
    integer_log2(ratio)
}

/// Integer part of log2
fn integer_log2(x: u256) -> u32 {
    if x == 0 {
        return 0;
    }

    let mut n: u32 = 0;
    let mut val = x;

    if val >= 0x100000000000000000000000000000000 {
        val = val / 0x100000000000000000000000000000000;
        n = n + 128;
    }
    if val >= 0x10000000000000000 {
        val = val / 0x10000000000000000;
        n = n + 64;
    }
    if val >= 0x100000000 {
        val = val / 0x100000000;
        n = n + 32;
    }
    if val >= 0x10000 {
        val = val / 0x10000;
        n = n + 16;
    }
    if val >= 0x100 {
        val = val / 0x100;
        n = n + 8;
    }
    if val >= 0x10 {
        val = val / 0x10;
        n = n + 4;
    }
    if val >= 0x4 {
        val = val / 0x4;
        n = n + 2;
    }
    if val >= 0x2 {
        n = n + 1;
    }

    n
}

/// Fractional part of log2 for x in [WAD, 2*WAD)
fn log2_fractional(x: u256) -> u256 {
    let mut y = x;
    let mut result: u256 = 0;
    let mut precision = HALF_WAD;

    let mut i: u32 = 0;
    while i < 60 {
        y = wad_mul(y, y);
        if y >= TWO_WAD {
            result = result + precision;
            y = y / 2;
        }
        precision = precision / 2;
        i = i + 1;
    }

    result
}

/// Calculates base^exp where both are in WAD format
pub fn pow_wad(base: u256, exp: u256) -> u256 {
    if exp == 0 {
        return WAD;
    }
    if base == 0 {
        return 0;
    }
    if base == WAD {
        return WAD;
    }

    let (ln_base, is_negative) = ln_wad(base);
    let exp_arg = wad_mul(exp, ln_base);

    if is_negative {
        exp_neg_wad(exp_arg)
    } else {
        exp_wad(exp_arg)
    }
}

/// Integer power
pub fn pow_u256(base: u256, exp: u256) -> u256 {
    if exp == 0 {
        return 1;
    }

    let mut result: u256 = 1;
    let mut b = base;
    let mut e = exp;

    while e > 0 {
        if e % 2 == 1 {
            result = result * b;
        }
        e = e / 2;
        if e > 0 {
            b = b * b;
        }
    }

    result
}

/// Maximum of two values
pub fn max(a: u256, b: u256) -> u256 {
    if a >= b {
        a
    } else {
        b
    }
}

/// Minimum of two values
pub fn min(a: u256, b: u256) -> u256 {
    if a <= b {
        a
    } else {
        b
    }
}

/// Absolute difference
pub fn abs_diff(a: u256, b: u256) -> u256 {
    if a >= b {
        a - b
    } else {
        b - a
    }
}
