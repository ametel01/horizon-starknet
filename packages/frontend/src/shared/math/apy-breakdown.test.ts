/**
 * APY Breakdown Calculation Tests
 *
 * Tests for verifying APY calculations match Pendle's format.
 * Run with: bun test src/shared/math/apy-breakdown.test.ts
 */

import { describe, expect, test } from 'bun:test';

import {
  calculateApyBreakdown,
  calculatePtFixedApy,
  calculateSwapFeeApy,
  calculateUnderlyingApy,
  formatApyPercent,
  getApyColorClass,
} from './apy-breakdown';
import { toWad, WAD_BIGINT } from './wad';

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
    expect(formatApyPercent(Number.POSITIVE_INFINITY)).toBe('-.--%-');
    expect(formatApyPercent(Number.NEGATIVE_INFINITY)).toBe('-.--%-');
    expect(formatApyPercent(Number.NaN)).toBe('-.--%-');
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

describe('calculateUnderlyingApy', () => {
  test('returns 0 for zero previous rate', () => {
    expect(calculateUnderlyingApy(WAD_BIGINT, 0n, 86400)).toBe(0);
  });

  test('returns 0 for zero time delta', () => {
    expect(calculateUnderlyingApy(WAD_BIGINT, WAD_BIGINT, 0)).toBe(0);
  });

  test('returns 0 when current rate equals previous rate', () => {
    expect(calculateUnderlyingApy(WAD_BIGINT, WAD_BIGINT, 86400)).toBe(0);
  });

  test('calculates APY from rate growth over 1 day', () => {
    // 0.01% daily growth ≈ 3.7% APY
    const currentRate = toWad(1.0001);
    const previousRate = WAD_BIGINT;
    const apy = calculateUnderlyingApy(currentRate, previousRate, 86400);
    expect(apy).toBeGreaterThan(0.03);
    expect(apy).toBeLessThan(0.04);
  });
});

describe('calculateSwapFeeApy', () => {
  test('returns 0 for zero volume', () => {
    expect(calculateSwapFeeApy(0n, WAD_BIGINT, WAD_BIGINT, toWad(0.003), 0.2)).toBe(0);
  });

  test('returns 0 for zero reserves', () => {
    expect(calculateSwapFeeApy(toWad(1000), 0n, 0n, toWad(0.003), 0.2)).toBe(0);
  });

  test('calculates swap fee APY correctly', () => {
    // $1000 daily volume, $10000 TVL, 0.3% fee, 20% LP share
    // Daily fees = 1000 * 0.003 * 0.2 = 0.6
    // APY = (0.6 / 10000) * 365 ≈ 0.0219 (2.19%)
    const volume = toWad(1000);
    const syReserve = toWad(5000);
    const ptReserve = toWad(5000);
    const feeRate = toWad(0.003);
    const lpFeeShare = 0.2;

    const apy = calculateSwapFeeApy(volume, syReserve, ptReserve, feeRate, lpFeeShare);
    expect(apy).toBeCloseTo(0.0219, 3);
  });
});

describe('calculateApyBreakdown', () => {
  const baseParams = {
    syReserve: toWad(5000),
    ptReserve: toWad(5000),
    lnImpliedRate: toWad(0.05), // 5% ln rate
    expiry: BigInt(Math.floor(Date.now() / 1000) + 365 * 86400), // 1 year from now
    syExchangeRate: WAD_BIGINT,
    previousExchangeRate: WAD_BIGINT,
    rateTimeDelta: 86400,
    swapVolume24h: toWad(100),
    feeRate: toWad(0.003),
    lpFeeShare: 0.2,
  };

  test('calculates breakdown with default rewardApr (0)', () => {
    const breakdown = calculateApyBreakdown(baseParams);

    expect(breakdown.underlying.rewardsApr).toBe(0);
    expect(breakdown.underlying.totalApy).toBe(breakdown.underlying.interestApy);
    expect(breakdown.lpApy.rewards).toBe(0);
  });

  test('includes rewardApr in underlying totalApy', () => {
    const rewardApr = 0.05; // 5% reward APR
    const breakdown = calculateApyBreakdown({ ...baseParams, rewardApr });

    expect(breakdown.underlying.rewardsApr).toBe(rewardApr);
    expect(breakdown.underlying.totalApy).toBe(breakdown.underlying.interestApy + rewardApr);
  });

  test('includes rewardApr in LP rewards and total', () => {
    const rewardApr = 0.03; // 3% reward APR
    const breakdown = calculateApyBreakdown({ ...baseParams, rewardApr });

    expect(breakdown.lpApy.rewards).toBe(rewardApr);
    // LP total should include rewards
    const expectedLpTotal =
      breakdown.lpApy.ptYield + breakdown.lpApy.syYield + breakdown.lpApy.swapFees + rewardApr;
    expect(breakdown.lpApy.total).toBeCloseTo(expectedLpTotal, 10);
  });

  test('calculates PT fixed APY from ln implied rate', () => {
    const breakdown = calculateApyBreakdown(baseParams);

    // e^0.05 - 1 ≈ 0.05127
    expect(breakdown.ptFixedApy).toBeCloseTo(0.05127, 4);
  });

  test('handles expired market', () => {
    const expiredParams = {
      ...baseParams,
      expiry: BigInt(Math.floor(Date.now() / 1000) - 86400), // 1 day ago
    };
    const breakdown = calculateApyBreakdown(expiredParams);

    // Should still return valid breakdown
    expect(breakdown.ptFixedApy).toBeDefined();
    expect(breakdown.lpApy.total).toBeDefined();
  });
});
