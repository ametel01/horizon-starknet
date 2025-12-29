/**
 * APY Breakdown Calculation Tests
 *
 * Tests for verifying APY calculations match Pendle's format.
 * Run with: bun test src/shared/math/apy-breakdown.test.ts
 */

import { describe, expect, test } from 'bun:test';

import { calculatePtFixedApy, formatApyPercent, getApyColorClass } from './apy-breakdown';
import { toWad } from './wad';

describe('calculatePtFixedApy', () => {
  test('returns 0 for zero input', () => {
    expect(calculatePtFixedApy(0n)).toBe(0);
  });

  test('calculates APY using continuous compounding formula (e^ln_rate - 1)', () => {
    // ln_rate of 0.05 WAD should give ~5.127% APY (not exactly 5%)
    // This is the key Pendle formula: APY = e^(ln_rate) - 1
    const lnRate = toWad(0.05);
    const apy = calculatePtFixedApy(lnRate);

    // e^0.05 - 1 ≈ 0.05127...
    expect(apy).toBeCloseTo(0.05127, 4);
  });

  test('handles 10% ln rate correctly', () => {
    // ln_rate of 0.10 WAD → e^0.10 - 1 ≈ 10.52%
    const lnRate = toWad(0.1);
    const apy = calculatePtFixedApy(lnRate);

    expect(apy).toBeCloseTo(0.10517, 4);
  });

  test('handles larger rates (50% ln rate)', () => {
    // ln_rate of 0.50 WAD → e^0.50 - 1 ≈ 64.87%
    const lnRate = toWad(0.5);
    const apy = calculatePtFixedApy(lnRate);

    expect(apy).toBeCloseTo(0.6487, 3);
  });

  test('handles small rates (1% ln rate)', () => {
    // ln_rate of 0.01 WAD → e^0.01 - 1 ≈ 1.005%
    const lnRate = toWad(0.01);
    const apy = calculatePtFixedApy(lnRate);

    expect(apy).toBeCloseTo(0.01005, 4);
  });
});

describe('formatApyPercent', () => {
  test('formats standard APY with 2 decimal places', () => {
    expect(formatApyPercent(0.05127)).toBe('5.13%');
    expect(formatApyPercent(0.1)).toBe('10.00%');
    expect(formatApyPercent(0.256789)).toBe('25.68%');
  });

  test('handles negative APY (YT in loss)', () => {
    expect(formatApyPercent(-0.05)).toBe('-5.00%');
    expect(formatApyPercent(-0.15)).toBe('-15.00%');
  });

  test('shows "< 0.01%" for very small positive values', () => {
    expect(formatApyPercent(0.00001)).toBe('< 0.01%');
    expect(formatApyPercent(0.00005)).toBe('< 0.01%');
  });

  test('shows "> -0.01%" for very small negative values', () => {
    expect(formatApyPercent(-0.00001)).toBe('> -0.01%');
    expect(formatApyPercent(-0.00005)).toBe('> -0.01%');
  });

  test('shows "> 1000%" for very high positive APY', () => {
    expect(formatApyPercent(15.5)).toBe('> 1000%');
    expect(formatApyPercent(100)).toBe('> 1000%');
  });

  test('shows "< -1000%" for very large negative APY', () => {
    expect(formatApyPercent(-15.5)).toBe('< -1000%');
    expect(formatApyPercent(-100)).toBe('< -1000%');
  });

  test('handles non-finite values', () => {
    expect(formatApyPercent(Infinity)).toBe('-.--%-');
    expect(formatApyPercent(-Infinity)).toBe('-.--%-');
    expect(formatApyPercent(NaN)).toBe('-.--%-');
  });

  test('respects decimals parameter', () => {
    expect(formatApyPercent(0.05127, 1)).toBe('5.1%');
    expect(formatApyPercent(0.05127, 3)).toBe('5.127%');
    expect(formatApyPercent(0.05127, 0)).toBe('5%');
  });

  test('handles zero correctly', () => {
    expect(formatApyPercent(0)).toBe('0.00%');
  });
});

describe('getApyColorClass', () => {
  test('returns primary color for positive APY', () => {
    expect(getApyColorClass(0.05)).toBe('text-primary');
    expect(getApyColorClass(0.001)).toBe('text-primary');
  });

  test('returns destructive color for negative APY (YT loss)', () => {
    expect(getApyColorClass(-0.05)).toBe('text-destructive');
    expect(getApyColorClass(-0.001)).toBe('text-destructive');
  });

  test('returns foreground color for zero APY', () => {
    expect(getApyColorClass(0)).toBe('text-foreground');
  });
});
