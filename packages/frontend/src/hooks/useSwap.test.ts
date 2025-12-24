/**
 * useSwap Hook Tests
 *
 * Tests for swap calculations and slippage utilities.
 * Run with: bun test src/hooks/useSwap.test.ts
 */

import { describe, expect, test } from 'bun:test';

import { WAD } from '@/test/setup';

import { calculateMaxInput, calculateMinOutput } from './useSwap';

describe('calculateMinOutput', () => {
  test('calculates 0.5% slippage correctly', () => {
    const expectedOutput = 1000n * WAD; // 1000 tokens
    const slippageBps = 50; // 0.5%
    const minOutput = calculateMinOutput(expectedOutput, slippageBps);

    // 1000 * (10000 - 50) / 10000 = 995
    expect(minOutput).toBe(995n * WAD);
  });

  test('calculates 1% slippage correctly', () => {
    const expectedOutput = 1000n * WAD;
    const slippageBps = 100; // 1%
    const minOutput = calculateMinOutput(expectedOutput, slippageBps);

    // 1000 * (10000 - 100) / 10000 = 990
    expect(minOutput).toBe(990n * WAD);
  });

  test('calculates 5% slippage correctly', () => {
    const expectedOutput = 1000n * WAD;
    const slippageBps = 500; // 5%
    const minOutput = calculateMinOutput(expectedOutput, slippageBps);

    // 1000 * (10000 - 500) / 10000 = 950
    expect(minOutput).toBe(950n * WAD);
  });

  test('handles zero slippage', () => {
    const expectedOutput = 1000n * WAD;
    const slippageBps = 0;
    const minOutput = calculateMinOutput(expectedOutput, slippageBps);

    expect(minOutput).toBe(expectedOutput);
  });

  test('handles 100% slippage (extreme case)', () => {
    const expectedOutput = 1000n * WAD;
    const slippageBps = 10000; // 100%
    const minOutput = calculateMinOutput(expectedOutput, slippageBps);

    expect(minOutput).toBe(0n);
  });

  test('handles small amounts', () => {
    const expectedOutput = 100n; // Very small amount
    const slippageBps = 50; // 0.5%
    const minOutput = calculateMinOutput(expectedOutput, slippageBps);

    // 100 * 9950 / 10000 = 99.5 -> 99 (integer division)
    expect(minOutput).toBe(99n);
  });

  test('handles large amounts', () => {
    const expectedOutput = 1000000000n * WAD; // 1 billion tokens
    const slippageBps = 50;
    const minOutput = calculateMinOutput(expectedOutput, slippageBps);

    expect(minOutput).toBe(995000000n * WAD);
  });
});

describe('calculateMaxInput', () => {
  test('calculates 0.5% slippage correctly', () => {
    const expectedInput = 1000n * WAD;
    const slippageBps = 50; // 0.5%
    const maxInput = calculateMaxInput(expectedInput, slippageBps);

    // 1000 * (10000 + 50) / 10000 = 1005
    expect(maxInput).toBe(1005n * WAD);
  });

  test('calculates 1% slippage correctly', () => {
    const expectedInput = 1000n * WAD;
    const slippageBps = 100; // 1%
    const maxInput = calculateMaxInput(expectedInput, slippageBps);

    // 1000 * (10000 + 100) / 10000 = 1010
    expect(maxInput).toBe(1010n * WAD);
  });

  test('calculates 5% slippage correctly', () => {
    const expectedInput = 1000n * WAD;
    const slippageBps = 500; // 5%
    const maxInput = calculateMaxInput(expectedInput, slippageBps);

    // 1000 * (10000 + 500) / 10000 = 1050
    expect(maxInput).toBe(1050n * WAD);
  });

  test('handles zero slippage', () => {
    const expectedInput = 1000n * WAD;
    const slippageBps = 0;
    const maxInput = calculateMaxInput(expectedInput, slippageBps);

    expect(maxInput).toBe(expectedInput);
  });

  test('handles small amounts', () => {
    const expectedInput = 100n;
    const slippageBps = 50;
    const maxInput = calculateMaxInput(expectedInput, slippageBps);

    // 100 * 10050 / 10000 = 100.5 -> 100 (integer division)
    expect(maxInput).toBe(100n);
  });

  test('handles large amounts', () => {
    const expectedInput = 1000000000n * WAD;
    const slippageBps = 50;
    const maxInput = calculateMaxInput(expectedInput, slippageBps);

    expect(maxInput).toBe(1005000000n * WAD);
  });
});

describe('Slippage calculation symmetry', () => {
  test('min output is always less than or equal to expected', () => {
    const amounts = [100n, 1000n * WAD, 1000000n * WAD];
    const slippages = [0, 50, 100, 500, 1000];

    for (const amount of amounts) {
      for (const slippage of slippages) {
        const minOutput = calculateMinOutput(amount, slippage);
        expect(minOutput).toBeLessThanOrEqual(amount);
      }
    }
  });

  test('max input is always greater than or equal to expected', () => {
    const amounts = [100n, 1000n * WAD, 1000000n * WAD];
    const slippages = [0, 50, 100, 500, 1000];

    for (const amount of amounts) {
      for (const slippage of slippages) {
        const maxInput = calculateMaxInput(amount, slippage);
        expect(maxInput).toBeGreaterThanOrEqual(amount);
      }
    }
  });

  test('slippage protection is proportional', () => {
    const amount = 10000n * WAD;

    // Higher slippage should give more protection
    const min50 = calculateMinOutput(amount, 50);
    const min100 = calculateMinOutput(amount, 100);
    const min500 = calculateMinOutput(amount, 500);

    expect(min50).toBeGreaterThan(min100);
    expect(min100).toBeGreaterThan(min500);
  });
});

describe('Edge cases', () => {
  test('handles zero amount', () => {
    expect(calculateMinOutput(0n, 50)).toBe(0n);
    expect(calculateMaxInput(0n, 50)).toBe(0n);
  });

  test('handles very high slippage', () => {
    const amount = 1000n * WAD;

    // 99% slippage
    const min99 = calculateMinOutput(amount, 9900);
    expect(min99).toBe(10n * WAD); // 1% of original

    // 99.9% slippage
    const min999 = calculateMinOutput(amount, 9990);
    expect(min999).toBe(1n * WAD); // 0.1% of original
  });
});
