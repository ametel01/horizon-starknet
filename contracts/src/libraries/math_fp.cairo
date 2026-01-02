/// Fixed-Point Math Library using cubit (64.64 format)
///
/// This library provides high-precision mathematical operations for DeFi
/// using cubit's 64.64 fixed-point format internally, with WAD (10^18)
/// interfaces for compatibility with the rest of the protocol.
///
/// Key design decisions:
/// - Internal calculations use cubit's Fixed type (64.64 binary format)
/// - External interfaces use WAD (10^18 decimal format) for compatibility
/// - Conversion between formats uses wad_to_fp and fp_to_wad
/// - Provides ~19 decimal digits of precision via 64-bit fractional part
///
/// Based on Pendle's LogExpMath.sol precision requirements.

use cairo_fp::f128::types::fixed::{Fixed, FixedTrait};
use horizon::libraries::errors::Errors;

/// WAD = 10^18 (standard DeFi 18 decimal precision)
pub const WAD: u256 = 1_000_000_000_000_000_000;
pub const HALF_WAD: u256 = 500_000_000_000_000_000;

/// cubit ONE = 2^64
const CUBIT_ONE: u128 = 18446744073709551616; // 2^64

/// Useful constants in WAD format
pub const WAD_E: u256 = 2_718_281_828_459_045_235; // e ≈ 2.718281828459045235
pub const WAD_LN2: u256 = 693_147_180_559_945_309; // ln(2) ≈ 0.693147180559945309
pub const WAD_INV_LN2: u256 = 1_442_695_040_888_963_407; // 1/ln(2) ≈ 1.4426950408889634
pub const TWO_WAD: u256 = 2_000_000_000_000_000_000;

/// Maximum safe exponent for exp (e^88 ≈ 1.65 * 10^38)
pub const MAX_EXPONENT_WAD: u256 = 88_000_000_000_000_000_000;

/// Constants for overflow-safe arithmetic
const U128_MAX: u256 = 0xffffffffffffffffffffffffffffffff;
const SQRT_WAD: u256 = 1_000_000_000; // 10^9

/// Convert WAD (10^18) to cubit Fixed (64.64 format)
/// Formula: fixed_value = wad_value * 2^64 / 10^18
/// This preserves maximum precision during conversion
pub fn wad_to_fp(wad_value: u256) -> Fixed {
    if wad_value == 0 {
        return FixedTrait::ZERO();
    }

    // wad_value is x * 10^18, we want x * 2^64
    // So we compute: wad_value * 2^64 / 10^18
    // To avoid overflow, we can rearrange:
    // = wad_value * (2^64 / 10^18)
    // = wad_value * 18446744073709551616 / 1000000000000000000
    // ≈ wad_value * 18.446744073709551616

    // For precision, we use: (wad_value * 2^64) / 10^18
    // Split to avoid overflow for large values
    let cubit_one_u256: u256 = CUBIT_ONE.into();
    let product = wad_value * cubit_one_u256;
    let result = product / WAD;

    // Convert to u128 (cubit uses u128 magnitude)
    assert(result.high == 0, Errors::MATH_OVERFLOW);

    FixedTrait::new(result.low, false)
}

/// Convert cubit Fixed (64.64 format) to WAD (10^18)
/// Formula: wad_value = fixed_value * 10^18 / 2^64
pub fn fp_to_wad(fp_value: Fixed) -> u256 {
    if fp_value.mag == 0 {
        return 0;
    }

    // fp_value.mag is x * 2^64, we want x * 10^18
    // So we compute: mag * 10^18 / 2^64
    let mag_u256: u256 = fp_value.mag.into();
    let product = mag_u256 * WAD;
    let cubit_one_u256: u256 = CUBIT_ONE.into();
    let result = product / cubit_one_u256;

    // Note: sign is handled by caller if needed
    result
}

/// Convert signed WAD to cubit Fixed
/// Handles negative values properly
pub fn wad_to_fp_signed(wad_value: u256, is_negative: bool) -> Fixed {
    let fp = wad_to_fp(wad_value);
    FixedTrait::new(fp.mag, is_negative)
}

/// Multiplies two WAD numbers using cubit precision
/// @param a First operand in WAD
/// @param b Second operand in WAD
/// @return a * b / WAD (rounded down)
pub fn wad_mul(a: u256, b: u256) -> u256 {
    if a == 0 || b == 0 {
        return 0;
    }

    // Convert to fixed-point, multiply, convert back
    let fp_a = wad_to_fp(a);
    let fp_b = wad_to_fp(b);
    let fp_result = fp_a * fp_b;

    fp_to_wad(fp_result)
}

/// Divides two WAD numbers using cubit precision
/// @param a Numerator in WAD
/// @param b Denominator in WAD
/// @return a * WAD / b
pub fn wad_div(a: u256, b: u256) -> u256 {
    assert(b != 0, Errors::MATH_DIVISION_BY_ZERO);

    if a == 0 {
        return 0;
    }

    // Convert to fixed-point, divide, convert back
    let fp_a = wad_to_fp(a);
    let fp_b = wad_to_fp(b);
    let fp_result = fp_a / fp_b;

    fp_to_wad(fp_result)
}

/// Calculates e^x for x in WAD format using cubit's exp
/// @param x Exponent in WAD (non-negative)
/// @return e^x in WAD
pub fn exp_wad(x: u256) -> u256 {
    if x == 0 {
        return WAD;
    }

    // Overflow protection
    assert(x <= MAX_EXPONENT_WAD, Errors::MATH_OVERFLOW);

    // Convert to fixed-point and compute exp
    let fp_x = wad_to_fp(x);
    let fp_result = fp_x.exp();

    fp_to_wad(fp_result)
}

/// Calculates e^(-x) for x in WAD format (for negative exponents)
/// @param x Absolute value of exponent in WAD
/// @return e^(-x) in WAD
pub fn exp_neg_wad(x: u256) -> u256 {
    if x == 0 {
        return WAD;
    }

    // For very large negative exponents, result approaches 0
    if x > MAX_EXPONENT_WAD {
        return 0;
    }

    // Create negative fixed-point and compute exp
    let fp_x = wad_to_fp_signed(x, true); // negative
    let fp_result = fp_x.exp();

    fp_to_wad(fp_result)
}

/// Calculates 2^x for x in WAD format using cubit's exp2
/// @param x Exponent in WAD
/// @return 2^x in WAD
pub fn exp2_wad(x: u256) -> u256 {
    if x == 0 {
        return WAD;
    }

    let fp_x = wad_to_fp(x);
    let fp_result = fp_x.exp2();

    fp_to_wad(fp_result)
}

/// Calculates natural logarithm ln(x) for x in WAD format
/// @param x Value in WAD (must be > 0)
/// @return (|ln(x)| in WAD, is_negative)
pub fn ln_wad(x: u256) -> (u256, bool) {
    assert(x > 0, Errors::MATH_DIVISION_BY_ZERO);

    if x == WAD {
        return (0, false); // ln(1) = 0
    }

    let _is_negative = x < WAD;

    // Convert to fixed-point and compute ln
    let fp_x = wad_to_fp(x);
    let fp_result = fp_x.ln();

    let result_wad = fp_to_wad(FixedTrait::new(fp_result.mag, false));

    (result_wad, fp_result.sign)
}

/// Calculates log2(x) for x in WAD format using cubit's log2
/// @param x Value in WAD (must be > 0)
/// @return (|log2(x)| in WAD, is_negative)
pub fn log2_wad(x: u256) -> (u256, bool) {
    assert(x > 0, Errors::MATH_DIVISION_BY_ZERO);

    if x == WAD {
        return (0, false); // log2(1) = 0
    }

    let fp_x = wad_to_fp(x);
    let fp_result = fp_x.log2();

    let result_wad = fp_to_wad(FixedTrait::new(fp_result.mag, false));

    (result_wad, fp_result.sign)
}

/// Calculates base^exp where both are in WAD format using cubit's pow
/// @param base Base in WAD
/// @param exp Exponent in WAD
/// @return base^exp in WAD
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

    let fp_base = wad_to_fp(base);
    let fp_exp = wad_to_fp(exp);
    let fp_result = fp_base.pow(fp_exp);

    fp_to_wad(fp_result)
}

/// Calculates pow with potentially negative result (for base^exp where base < 1)
/// @param base Base in WAD
/// @param exp Exponent in WAD
/// @param exp_is_negative Whether the exponent is negative
/// @return base^exp in WAD
pub fn pow_wad_signed(base: u256, exp: u256, exp_is_negative: bool) -> u256 {
    if exp == 0 {
        return WAD;
    }
    if base == 0 {
        return 0;
    }
    if base == WAD {
        return WAD;
    }

    let fp_base = wad_to_fp(base);
    let fp_exp = wad_to_fp_signed(exp, exp_is_negative);
    let fp_result = fp_base.pow(fp_exp);

    fp_to_wad(fp_result)
}

/// Calculates square root using cubit's sqrt
/// @param x Value in WAD
/// @return sqrt(x) in WAD
pub fn sqrt_wad(x: u256) -> u256 {
    if x == 0 {
        return 0;
    }

    let fp_x = wad_to_fp(x);
    let fp_result = fp_x.sqrt();

    fp_to_wad(fp_result)
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

/// Integer power (uses binary exponentiation)
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

/// Linear interpolation: start + (end - start) * t
/// @param start Start value in WAD
/// @param end End value in WAD
/// @param t Interpolation factor in WAD (0 to 1)
/// @return Interpolated value in WAD
pub fn lerp(start: u256, end: u256, t: u256) -> u256 {
    if t == 0 {
        return start;
    }
    if t >= WAD {
        return end;
    }

    let diff = if end >= start {
        wad_mul(end - start, t)
    } else {
        wad_mul(start - end, t)
    };

    if end >= start {
        start + diff
    } else {
        start - diff
    }
}

/// Exponential decay: initial * (1 - rate)^periods
/// Using cubit's high-precision pow
pub fn decay(initial: u256, rate: u256, periods: u256) -> u256 {
    if rate == 0 || periods == 0 {
        return initial;
    }
    if rate >= WAD {
        return 0; // Complete decay
    }

    let base = WAD - rate;
    let multiplier = pow_wad(base, periods);
    wad_mul(initial, multiplier)
}

/// Exponential growth: initial * (1 + rate)^periods
/// Using cubit's high-precision pow
pub fn growth(initial: u256, rate: u256, periods: u256) -> u256 {
    if rate == 0 || periods == 0 {
        return initial;
    }

    let base = WAD + rate;
    let multiplier = pow_wad(base, periods);
    wad_mul(initial, multiplier)
}

/// Continuous compound interest: principal * e^(rate * time)
/// This is the limit of compound interest as compounding frequency → ∞
pub fn continuous_compound(principal: u256, rate: u256, time: u256) -> u256 {
    if rate == 0 || time == 0 {
        return principal;
    }

    let exponent = wad_mul(rate, time);
    let multiplier = exp_wad(exponent);
    wad_mul(principal, multiplier)
}

/// Divides two WAD numbers, rounding up
/// @param a Numerator in WAD
/// @param b Denominator in WAD
/// @return ceil(a * WAD / b)
pub fn wad_div_up(a: u256, b: u256) -> u256 {
    assert(b != 0, Errors::MATH_DIVISION_BY_ZERO);

    if a == 0 {
        return 0;
    }

    // Check if a * WAD won't overflow
    let max_u256: u256 = U128_MAX * U128_MAX;
    if a <= max_u256 / WAD {
        // Safe path: (a * WAD + b - 1) / b for ceiling
        return (a * WAD + b - 1) / b;
    }

    // For larger values, compute quotient and remainder separately
    // a * WAD / b = (a / b) * WAD + (a % b) * WAD / b
    // Then add 1 if there was any remainder for ceiling
    let q = a / b;
    let r = a % b;

    // Check if remainder multiplication is safe
    if r <= max_u256 / WAD {
        let remainder_div = (r * WAD) / b;
        let has_remainder = (r * WAD) % b > 0;
        if has_remainder {
            return q * WAD + remainder_div + 1;
        }
        return q * WAD + remainder_div;
    }

    // For very large remainders, use decomposition approach
    let r_contribution = wad_div_large_remainder(r, b);
    q * WAD + r_contribution + 1
}

/// Helper for division with large remainder
/// Splits the remainder to avoid overflow when multiplying by WAD
fn wad_div_large_remainder(r: u256, b: u256) -> u256 {
    // Split r into parts: r = r_hi * SQRT_WAD + r_lo
    let r_hi = r / SQRT_WAD;
    let r_lo = r % SQRT_WAD;

    // (r_hi * SQRT_WAD + r_lo) * WAD / b
    // = r_hi * SQRT_WAD * WAD / b + r_lo * WAD / b
    // = r_hi * WAD * SQRT_WAD / b + r_lo * WAD / b
    let hi_contrib = (r_hi * WAD) / b * SQRT_WAD;
    let lo_contrib = (r_lo * WAD) / b;

    hi_contrib + lo_contrib
}

// ============ PYIndex Asset Conversion Helpers ============
// These functions convert between SY (Standardized Yield) and asset amounts
// using the PYIndex from the YT contract. The PYIndex represents how many
// underlying assets one SY token is worth.

/// Convert SY amount to asset amount
/// asset = sy * py_index
/// @param sy SY token amount in WAD
/// @param py_index Current PY index (SY→asset rate) in WAD
/// @return Equivalent asset amount in WAD
pub fn sy_to_asset(sy: u256, py_index: u256) -> u256 {
    wad_mul(sy, py_index)
}

/// Convert asset amount to SY amount (rounds down)
/// sy = asset / py_index
/// @param asset Asset amount in WAD
/// @param py_index Current PY index (SY→asset rate) in WAD
/// @return Equivalent SY amount in WAD (rounded down)
pub fn asset_to_sy(asset: u256, py_index: u256) -> u256 {
    wad_div(asset, py_index)
}

/// Convert asset amount to SY amount (rounds up)
/// Used when the protocol is owed assets (e.g., user buying PT)
/// to ensure the protocol is not undercharged
/// @param asset Asset amount in WAD
/// @param py_index Current PY index (SY→asset rate) in WAD
/// @return Equivalent SY amount in WAD (rounded up)
pub fn asset_to_sy_up(asset: u256, py_index: u256) -> u256 {
    wad_div_up(asset, py_index)
}
