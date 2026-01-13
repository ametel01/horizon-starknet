/**
 * Fixed-Point Math Utilities using cairo-fp
 *
 * Provides WAD-based (10^18) math functions that match the on-chain
 * cubit 64.64 fixed-point calculations in math_fp.cairo.
 *
 * The contracts internally use cubit's 64.64 format but expose WAD
 * at the interface level. This module handles the conversion.
 *
 * @see Security Audit I-08 - Fixed-Point Library Integration
 */

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
import cairoFpModule from 'cairo-fp';
import { WAD_BIGINT } from './wad';

// ============================================================================
// Types
// ============================================================================

/** Cubit Fixed-point representation (64.64 format) */
export interface Fixed {
  mag: bigint;
  sign: boolean;
}

/**
 * Type declaration for cairo-fp f128 module
 * Since cairo-fp lacks TypeScript definitions, we declare the interface here
 */
interface F128Utils {
  toFixed(num: number): Fixed;
  fromFixed(fixed: Fixed): number;
  exp(x: number): Fixed;
  ln(x: number): Fixed;
  sqrt(x: number): Fixed;
  pow(base: number, exp: number): Fixed;
  log2(x: number): Fixed;
  exp2(x: number): Fixed;
  proportion(part: number, total: number): Fixed | null;
  percentageChange(oldVal: number, newVal: number): Fixed | null;
}

interface CairoFP {
  f128: F128Utils;
  f64: F128Utils;
}

// Initialize cairo-fp
const cairoFp = cairoFpModule as CairoFP;
const f128: F128Utils = cairoFp.f128;

// ============================================================================
// Constants
// ============================================================================

/** Cubit ONE = 2^64 */
export const CUBIT_ONE = 18446744073709551616n;

/** Maximum safe value for WAD operations */
export const MAX_WAD = BigInt(
  '115792089237316195423570985008687907853269984665640564039457584007913129639935'
); // 2^256 - 1

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert WAD (10^18) to cubit Fixed (64.64) format
 * Matches on-chain wad_to_fp() in math_fp.cairo
 *
 * @param wadValue - Value in WAD format (10^18 scale)
 * @returns Fixed-point representation
 */
export function wadToFixed(wadValue: bigint): Fixed {
  if (wadValue === 0n) {
    return { mag: 0n, sign: false };
  }

  const isNegative = wadValue < 0n;
  const absValue = isNegative ? -wadValue : wadValue;

  // result = wadValue * 2^64 / 10^18
  const result = (absValue * CUBIT_ONE) / WAD_BIGINT;

  return { mag: result, sign: isNegative };
}

/**
 * Convert cubit Fixed (64.64) to WAD (10^18)
 * Matches on-chain fp_to_wad() in math_fp.cairo
 *
 * @param fixed - Fixed-point value
 * @returns Value in WAD format
 */
export function fixedToWad(fixed: Fixed): bigint {
  if (fixed.mag === 0n) {
    return 0n;
  }

  // result = mag * 10^18 / 2^64
  const result = (fixed.mag * WAD_BIGINT) / CUBIT_ONE;

  return fixed.sign ? -result : result;
}

/**
 * Convert a JavaScript number to Fixed format
 * Wrapper around cairo-fp's toFixed
 */
export function numberToFixed(num: number): Fixed {
  return f128.toFixed(num);
}

/**
 * Convert Fixed format to JavaScript number
 * Wrapper around cairo-fp's fromFixed
 */
export function fixedToNumber(fixed: Fixed): number {
  return f128.fromFixed(fixed);
}

// ============================================================================
// WAD Math Functions (using cairo-fp internally)
// ============================================================================

/**
 * Calculate e^x where x is in WAD format
 * Matches on-chain exp_wad() in math_fp.cairo
 *
 * @param x - Exponent in WAD format
 * @returns e^x in WAD format
 */
export function expWad(x: bigint): bigint {
  if (x === 0n) {
    return WAD_BIGINT; // e^0 = 1
  }

  // Convert WAD to float, compute exp, convert back
  const xFloat = Number(x) / 1e18;

  // Handle edge cases
  if (xFloat > 135) {
    // Overflow protection - cap at max safe value
    return BigInt(
      '3273390607896141870013189696827599152216642046043064789483291368096133796404674554883270092325904157150886684127560071009217256545885393053328527589376'
    );
  }
  if (xFloat < -40) {
    return 0n; // Underflow to zero
  }

  const result = f128.exp(xFloat);
  return BigInt(Math.floor(f128.fromFixed(result) * 1e18));
}

/**
 * Calculate e^(-x) where x is in WAD format
 *
 * @param x - Positive exponent in WAD format
 * @returns e^(-x) in WAD format
 */
export function expNegWad(x: bigint): bigint {
  if (x === 0n) {
    return WAD_BIGINT; // e^0 = 1
  }

  const xFloat = Number(x) / 1e18;

  if (xFloat > 40) {
    return 0n; // Underflow to zero
  }

  const result = f128.exp(-xFloat);
  return BigInt(Math.floor(f128.fromFixed(result) * 1e18));
}

/**
 * Calculate ln(x) where x is in WAD format
 * Matches on-chain ln_wad() in math_fp.cairo
 *
 * @param x - Input in WAD format (must be > 0)
 * @returns { value: |ln(x)|, isNegative: ln(x) < 0 } in WAD format
 */
export function lnWad(x: bigint): { value: bigint; isNegative: boolean } {
  if (x <= 0n) {
    throw new Error('ln undefined for x <= 0');
  }

  const xFloat = Number(x) / 1e18;
  const result = f128.ln(xFloat);
  const lnValue = f128.fromFixed(result);

  return {
    value: BigInt(Math.floor(Math.abs(lnValue) * 1e18)),
    isNegative: lnValue < 0,
  };
}

/**
 * Calculate sqrt(x) where x is in WAD format
 * Matches on-chain sqrt_wad() in math_fp.cairo
 *
 * @param x - Input in WAD format
 * @returns sqrt(x) in WAD format
 */
export function sqrtWad(x: bigint): bigint {
  if (x === 0n) {
    return 0n;
  }

  const xFloat = Number(x) / 1e18;
  const result = f128.sqrt(xFloat);
  return BigInt(Math.floor(f128.fromFixed(result) * 1e18));
}

/**
 * Calculate base^exp where both are in WAD format
 * Matches on-chain pow_wad() in math_fp.cairo
 *
 * @param base - Base in WAD format
 * @param exponent - Exponent in WAD format
 * @returns base^exp in WAD format
 */
export function powWad(base: bigint, exponent: bigint): bigint {
  if (exponent === 0n) {
    return WAD_BIGINT; // x^0 = 1
  }
  if (base === 0n) {
    return 0n; // 0^x = 0
  }

  const baseFloat = Number(base) / 1e18;
  const expFloat = Number(exponent) / 1e18;

  const result = f128.pow(baseFloat, expFloat);
  return BigInt(Math.floor(f128.fromFixed(result) * 1e18));
}

/**
 * Calculate log2(x) where x is in WAD format
 *
 * @param x - Input in WAD format (must be > 0)
 * @returns log2(x) in WAD format
 */
export function log2Wad(x: bigint): { value: bigint; isNegative: boolean } {
  if (x <= 0n) {
    throw new Error('log2 undefined for x <= 0');
  }

  const xFloat = Number(x) / 1e18;
  const result = f128.log2(xFloat);
  const logValue = f128.fromFixed(result);

  return {
    value: BigInt(Math.floor(Math.abs(logValue) * 1e18)),
    isNegative: logValue < 0,
  };
}

/**
 * Calculate 2^x where x is in WAD format
 *
 * @param x - Exponent in WAD format
 * @returns 2^x in WAD format
 */
export function exp2Wad(x: bigint): bigint {
  const xFloat = Number(x) / 1e18;
  const result = f128.exp2(xFloat);
  return BigInt(Math.floor(f128.fromFixed(result) * 1e18));
}

// ============================================================================
// DeFi-specific Utilities
// ============================================================================

/**
 * Calculate proportion: part / total
 * Returns result in WAD format
 */
export function proportionWad(part: bigint, total: bigint): bigint {
  if (total === 0n) {
    return 0n;
  }

  const partFloat = Number(part) / 1e18;
  const totalFloat = Number(total) / 1e18;

  const result = f128.proportion(partFloat, totalFloat);
  if (!result) return 0n;

  return BigInt(Math.floor(f128.fromFixed(result) * 1e18));
}

/**
 * Calculate percentage change: (new - old) / old
 * Returns result in WAD format (1 WAD = 100%)
 */
export function percentageChangeWad(oldValue: bigint, newValue: bigint): bigint {
  if (oldValue === 0n) {
    return 0n;
  }

  const oldFloat = Number(oldValue) / 1e18;
  const newFloat = Number(newValue) / 1e18;

  const result = f128.percentageChange(oldFloat, newFloat);
  if (!result) return 0n;

  return BigInt(Math.floor(f128.fromFixed(result) * 1e18));
}

// ============================================================================
// Re-export cairo-fp for direct use
// ============================================================================

export { f128 };
