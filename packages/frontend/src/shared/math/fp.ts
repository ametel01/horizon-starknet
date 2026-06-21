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

import { WAD_BIGINT } from './wad';

// ============================================================================
// Types
// ============================================================================

/** Cubit Fixed-point representation (64.64 format) */
interface Fixed {
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
  default?: CairoFP;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const cairoFpModule: CairoFP = require('cairo-fp');
// Handle both ESM (default export) and CJS (direct export)
const cairoFp: CairoFP = cairoFpModule.default ?? cairoFpModule;
const f128: F128Utils = cairoFp.f128;

// ============================================================================
// Constants
// ============================================================================
// ============================================================================
// Conversion Functions
// ============================================================================
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
// ============================================================================
// DeFi-specific Utilities
// ============================================================================
// ============================================================================
// Re-export cairo-fp for direct use
// ============================================================================
