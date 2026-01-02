/**
 * AMM Math Tests
 *
 * Tests for verifying price impact and swap calculation accuracy.
 * These can be run with: bun test src/lib/math/amm.test.ts
 */

import { describe, expect, test } from 'bun:test';
import BigNumber from 'bignumber.js';

import {
  calcSwapExactPtForSy,
  calcSwapExactSyForPt,
  formatPriceImpact,
  getExchangeRate,
  getExchangeRateFromImpliedRate,
  getImpliedApy,
  getLogit,
  getPriceImpactSeverity,
  getPtPrice,
  getRateAnchor,
  getRateScalar,
  getTimeAdjustedFeeRate,
  getTimeToExpiry,
  type MarketState,
  SECONDS_PER_YEAR,
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

  describe('Logit-Based AMM Functions', () => {
    describe('getRateScalar', () => {
      test('increases as time to expiry decreases', () => {
        const scalarRoot = WAD_BIGINT;
        const oneYear = SECONDS_PER_YEAR;
        const sixMonths = SECONDS_PER_YEAR / 2n;

        const scalarOneYear = getRateScalar(scalarRoot, oneYear);
        const scalarSixMonths = getRateScalar(scalarRoot, sixMonths);

        // Scalar should be higher with less time (more sensitive)
        expect(scalarSixMonths).toBeGreaterThan(scalarOneYear);
      });

      test('equals scalarRoot at exactly one year', () => {
        const scalarRoot = WAD_BIGINT;
        const oneYear = SECONDS_PER_YEAR;

        const scalar = getRateScalar(scalarRoot, oneYear);

        // Should be approximately equal to scalarRoot
        const ratio = Number(scalar) / Number(scalarRoot);
        expect(ratio).toBeGreaterThan(0.99);
        expect(ratio).toBeLessThan(1.01);
      });
    });

    describe('getLogit', () => {
      test('returns 0 for 50% proportion', () => {
        const halfWad = WAD_BIGINT / 2n;
        const { value } = getLogit(halfWad);

        // logit(0.5) = ln(1) = 0
        expect(value).toBeLessThan(WAD_BIGINT / 1000n); // Very close to 0
      });

      test('returns negative for proportion < 50%', () => {
        const lowProportion = WAD_BIGINT / 4n; // 25%
        const { isNegative } = getLogit(lowProportion);

        expect(isNegative).toBe(true);
      });

      test('returns positive for proportion > 50%', () => {
        const highProportion = (WAD_BIGINT * 3n) / 4n; // 75%
        const { isNegative } = getLogit(highProportion);

        expect(isNegative).toBe(false);
      });
    });

    describe('getExchangeRate', () => {
      test('returns higher rate for higher proportion', () => {
        const rateScalar = WAD_BIGINT;
        const rateAnchor = WAD_BIGINT + WAD_BIGINT / 10n; // 1.1

        const lowProportion = WAD_BIGINT / 4n; // 25%
        const highProportion = (WAD_BIGINT * 3n) / 4n; // 75%

        const lowRate = getExchangeRate(lowProportion, rateScalar, rateAnchor);
        const highRate = getExchangeRate(highProportion, rateScalar, rateAnchor);

        expect(highRate).toBeGreaterThan(lowRate);
      });

      test('returns at least 1.0 WAD', () => {
        const rateScalar = WAD_BIGINT;
        const rateAnchor = WAD_BIGINT; // 1.0

        const lowProportion = WAD_BIGINT / 10n; // 10%
        const rate = getExchangeRate(lowProportion, rateScalar, rateAnchor);

        expect(rate).toBeGreaterThanOrEqual(WAD_BIGINT);
      });
    });

    describe('getTimeAdjustedFeeRate', () => {
      test('returns 0 at expiry', () => {
        const feeRate = WAD_BIGINT / 100n; // 1%
        const adjusted = getTimeAdjustedFeeRate(feeRate, 0n);

        expect(adjusted).toBe(0n);
      });

      test('returns full rate at one year', () => {
        const feeRate = WAD_BIGINT / 100n; // 1%
        const adjusted = getTimeAdjustedFeeRate(feeRate, SECONDS_PER_YEAR);

        expect(adjusted).toBe(feeRate);
      });

      test('returns half rate at six months', () => {
        const feeRate = WAD_BIGINT / 100n; // 1%
        const sixMonths = SECONDS_PER_YEAR / 2n;
        const adjusted = getTimeAdjustedFeeRate(feeRate, sixMonths);

        // Should be approximately half
        const ratio = Number(adjusted) / Number(feeRate);
        expect(ratio).toBeGreaterThan(0.49);
        expect(ratio).toBeLessThan(0.51);
      });

      test('decays linearly', () => {
        const feeRate = WAD_BIGINT / 100n;
        const threeMonths = SECONDS_PER_YEAR / 4n;
        const sixMonths = SECONDS_PER_YEAR / 2n;
        const nineMonths = (SECONDS_PER_YEAR * 3n) / 4n;

        const fee3m = getTimeAdjustedFeeRate(feeRate, threeMonths);
        const fee6m = getTimeAdjustedFeeRate(feeRate, sixMonths);
        const fee9m = getTimeAdjustedFeeRate(feeRate, nineMonths);

        // Verify proportional relationship
        expect(fee6m).toBeGreaterThan(fee3m);
        expect(fee9m).toBeGreaterThan(fee6m);

        // 6 months should be ~2x 3 months
        const ratio6to3 = Number(fee6m) / Number(fee3m);
        expect(ratio6to3).toBeGreaterThan(1.9);
        expect(ratio6to3).toBeLessThan(2.1);
      });
    });

    describe('getExchangeRateFromImpliedRate', () => {
      test('returns 1.0 at expiry', () => {
        const lnImpliedRate = WAD_BIGINT / 10n; // 10%
        const rate = getExchangeRateFromImpliedRate(lnImpliedRate, 0n);

        expect(rate).toBe(WAD_BIGINT);
      });

      test('returns higher rate for higher implied rate', () => {
        const oneYear = SECONDS_PER_YEAR;
        const lowRate = WAD_BIGINT / 20n; // 5%
        const highRate = WAD_BIGINT / 5n; // 20%

        const exchangeLow = getExchangeRateFromImpliedRate(lowRate, oneYear);
        const exchangeHigh = getExchangeRateFromImpliedRate(highRate, oneYear);

        expect(exchangeHigh).toBeGreaterThan(exchangeLow);
      });
    });

    describe('getRateAnchor', () => {
      test('recalculates anchor from market state', () => {
        const marketState = createMarketState();
        const timeToExpiry = getTimeToExpiry(marketState.expiry);

        const anchor = getRateAnchor(marketState, timeToExpiry);

        // Anchor should be positive
        expect(anchor).toBeGreaterThan(0n);
        // And at least 1.0 WAD
        expect(anchor).toBeGreaterThanOrEqual(WAD_BIGINT);
      });
    });
  });

  describe('Fee Decay in Swaps', () => {
    test('fees are lower near expiry', () => {
      const marketState = createMarketState();
      const nearExpiryState = createMarketState({
        expiry: BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60), // 30 days
      });

      const syIn = 10000n * WAD_BIGINT;

      const resultFar = calcSwapExactSyForPt(marketState, syIn);
      const resultNear = calcSwapExactSyForPt(nearExpiryState, syIn);

      // Fees should be lower near expiry
      expect(resultNear.fee).toBeLessThan(resultFar.fee);
    });
  });
});
