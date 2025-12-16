/**
 * AMM Math Tests
 *
 * Tests for verifying price impact and swap calculation accuracy.
 * These can be run with: bun test src/lib/math/amm.test.ts
 */

import BigNumber from 'bignumber.js';
import { describe, expect, test } from 'bun:test';

import {
  calcSwapExactPtForSy,
  calcSwapExactSyForPt,
  formatPriceImpact,
  getImpliedApy,
  getPriceImpactSeverity,
  getPtPrice,
  getTimeToExpiry,
  type MarketState,
} from './amm';
import { WAD_BIGINT } from './wad';

// Test market state with reasonable values
const createMarketState = (overrides: Partial<MarketState> = {}): MarketState => ({
  syReserve: 1_000_000n * WAD_BIGINT, // 1M SY
  ptReserve: 1_000_000n * WAD_BIGINT, // 1M PT
  totalLp: 2_000_000n * WAD_BIGINT, // 2M LP
  scalarRoot: WAD_BIGINT, // 1.0
  initialAnchor: 50_000_000_000_000_000n, // 5% initial ln rate
  feeRate: 3_000_000_000_000_000n, // 0.3% fee
  expiry: BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60), // 1 year from now
  lastLnImpliedRate: 50_000_000_000_000_000n, // 5% ln rate
  ...overrides,
});

describe('AMM Math', () => {
  describe('getPriceImpactSeverity', () => {
    test('returns low for small impacts', () => {
      expect(getPriceImpactSeverity(0.005)).toBe('low'); // 0.5%
      expect(getPriceImpactSeverity(0.009)).toBe('low'); // 0.9%
    });

    test('returns medium for moderate impacts', () => {
      expect(getPriceImpactSeverity(0.01)).toBe('medium'); // 1%
      expect(getPriceImpactSeverity(0.02)).toBe('medium'); // 2%
    });

    test('returns high for significant impacts', () => {
      expect(getPriceImpactSeverity(0.03)).toBe('high'); // 3%
      expect(getPriceImpactSeverity(0.04)).toBe('high'); // 4%
    });

    test('returns very-high for extreme impacts', () => {
      expect(getPriceImpactSeverity(0.05)).toBe('very-high'); // 5%
      expect(getPriceImpactSeverity(0.1)).toBe('very-high'); // 10%
    });
  });

  describe('formatPriceImpact', () => {
    test('formats price impact as percentage', () => {
      expect(formatPriceImpact(0.01)).toBe('1.00%');
      expect(formatPriceImpact(0.025)).toBe('2.50%');
      expect(formatPriceImpact(0.1)).toBe('10.00%');
    });
  });

  describe('getImpliedApy', () => {
    test('calculates APY from ln rate', () => {
      // 5% ln rate ≈ 5.13% APY (e^0.05 - 1)
      const lnRate = 50_000_000_000_000_000n;
      const apy = getImpliedApy(lnRate);
      expect(apy).toBeGreaterThan(0.05);
      expect(apy).toBeLessThan(0.06);
    });

    test('handles zero rate', () => {
      expect(getImpliedApy(0n)).toBe(0);
    });

    test('handles high rates', () => {
      // 50% ln rate ≈ 64.9% APY
      const lnRate = 500_000_000_000_000_000n;
      const apy = getImpliedApy(lnRate);
      expect(apy).toBeGreaterThan(0.6);
      expect(apy).toBeLessThan(0.7);
    });
  });

  describe('getPtPrice', () => {
    test('returns reasonable PT price', () => {
      const marketState = createMarketState();
      const timeToExpiry = getTimeToExpiry(marketState.expiry);
      const ptPrice = getPtPrice(marketState.lastLnImpliedRate, timeToExpiry);

      // PT price should be less than 1 (trades at discount)
      expect(ptPrice).toBeLessThan(WAD_BIGINT);
      // But not too low (reasonable discount)
      expect(ptPrice).toBeGreaterThan(WAD_BIGINT / 2n);
    });

    test('PT price approaches 1 near expiry', () => {
      const nearExpiry = createMarketState({
        expiry: BigInt(Math.floor(Date.now() / 1000) + 60 * 60), // 1 hour to expiry
      });
      const timeToExpiry = getTimeToExpiry(nearExpiry.expiry);
      const ptPrice = getPtPrice(nearExpiry.lastLnImpliedRate, timeToExpiry);

      // PT should be very close to 1 SY near expiry
      const priceBN = new BigNumber(ptPrice.toString());
      const oneBN = new BigNumber(WAD_BIGINT.toString());
      const ratio = priceBN.dividedBy(oneBN).toNumber();

      expect(ratio).toBeGreaterThan(0.99);
    });
  });

  describe('calcSwapExactSyForPt', () => {
    test('calculates swap output for small trade', () => {
      const marketState = createMarketState();
      const syIn = 1000n * WAD_BIGINT; // 1k SY

      const result = calcSwapExactSyForPt(marketState, syIn);

      // Output should be reasonable (within 10% of input after fees and price)
      expect(result.amountOut).toBeGreaterThan((syIn * 9n) / 10n);
      expect(result.amountOut).toBeLessThan((syIn * 11n) / 10n);
      // Price impact should be low for small trade relative to reserves
      expect(result.priceImpact).toBeLessThan(0.05);
    });

    test('larger trades have higher price impact', () => {
      const marketState = createMarketState();
      const smallTrade = 1000n * WAD_BIGINT;
      const largeTrade = 100_000n * WAD_BIGINT;

      const smallResult = calcSwapExactSyForPt(marketState, smallTrade);
      const largeResult = calcSwapExactSyForPt(marketState, largeTrade);

      // Large trade should have higher price impact
      expect(largeResult.priceImpact).toBeGreaterThan(smallResult.priceImpact);
    });

    test('includes fee in output', () => {
      const marketState = createMarketState();
      const syIn = 10000n * WAD_BIGINT;

      const result = calcSwapExactSyForPt(marketState, syIn);

      // Fee should be positive
      expect(result.fee).toBeGreaterThan(0n);
    });
  });

  describe('calcSwapExactPtForSy', () => {
    test('calculates swap output for selling PT', () => {
      const marketState = createMarketState();
      const ptIn = 1000n * WAD_BIGINT;

      const result = calcSwapExactPtForSy(marketState, ptIn);

      // Output should be reasonable (within 10% of input after fees and price)
      expect(result.amountOut).toBeGreaterThan((ptIn * 9n) / 10n);
      expect(result.amountOut).toBeLessThan((ptIn * 11n) / 10n);
      // Price impact should be low for small trade relative to reserves
      expect(result.priceImpact).toBeLessThan(0.05);
    });

    test('round-trip loses value due to fees', () => {
      const marketState = createMarketState();
      const syIn = 10000n * WAD_BIGINT;

      // Buy PT with SY
      const buyResult = calcSwapExactSyForPt(marketState, syIn);

      // Create new state after the buy
      const afterBuyState = {
        ...marketState,
        syReserve: marketState.syReserve + syIn,
        ptReserve: marketState.ptReserve - buyResult.amountOut,
        lastLnImpliedRate: buyResult.newLnImpliedRate,
      };

      // Sell PT back for SY
      const sellResult = calcSwapExactPtForSy(afterBuyState, buyResult.amountOut);

      // Should get back less than we started with (fees + slippage)
      expect(sellResult.amountOut).toBeLessThan(syIn);
    });
  });

  describe('Price Impact Accuracy', () => {
    test('price impact increases with trade size', () => {
      const marketState = createMarketState();
      const tradesSizes = [
        100n * WAD_BIGINT,
        1000n * WAD_BIGINT,
        10000n * WAD_BIGINT,
        100000n * WAD_BIGINT,
      ];

      let lastImpact = 0;
      for (const size of tradesSizes) {
        const result = calcSwapExactSyForPt(marketState, size);
        expect(result.priceImpact).toBeGreaterThan(lastImpact);
        lastImpact = result.priceImpact;
      }
    });

    test('effective price differs from spot price', () => {
      const marketState = createMarketState();
      const syIn = 50000n * WAD_BIGINT; // 5% of reserves

      const result = calcSwapExactSyForPt(marketState, syIn);

      // Effective price should be worse than spot price
      // (pay more SY per PT than spot indicates)
      expect(result.effectivePrice).toBeGreaterThan(result.spotPrice);
    });

    test('new ln implied rate changes after trade', () => {
      const marketState = createMarketState();
      const syIn = 50000n * WAD_BIGINT;

      const result = calcSwapExactSyForPt(marketState, syIn);

      // Buying PT should decrease the implied rate (PT becomes more expensive)
      // This means newLnImpliedRate < lastLnImpliedRate
      expect(result.newLnImpliedRate).not.toBe(marketState.lastLnImpliedRate);
    });
  });
});
