/**
 * useMint Hook Utility Tests
 *
 * Tests for utility functions and calculations used by the useMint hook.
 * Run with: bun test src/hooks/useMint.test.ts
 */

import { describe, expect, test } from 'bun:test';
import { uint256 } from 'starknet';

import { getDeadline } from '@/lib/deadline';
import { toWad } from '@/lib/math/wad';
import { WAD } from '@/test/setup';

describe('Mint amount conversion', () => {
  test('converts string amount to WAD', () => {
    const amountStr = '1.0';
    const amountWad = toWad(amountStr);
    expect(amountWad).toBe(WAD);
  });

  test('converts small decimal amounts', () => {
    const amountStr = '0.001';
    const amountWad = toWad(amountStr);
    expect(amountWad).toBe(WAD / 1000n);
  });

  test('converts large amounts', () => {
    const amountStr = '1000000';
    const amountWad = toWad(amountStr);
    expect(amountWad).toBe(1000000n * WAD);
  });
});

describe('Default slippage calculation', () => {
  test('calculates 0.5% default slippage', () => {
    const amountSyWad = 1000n * WAD;
    // Default: minPyOut = amountSy * 0.995
    const defaultMinPy = (amountSyWad * 995n) / 1000n;
    expect(defaultMinPy).toBe(995n * WAD);
  });

  test('handles small amounts with slippage', () => {
    const amountSyWad = 100n; // Very small amount
    const defaultMinPy = (amountSyWad * 995n) / 1000n;
    expect(defaultMinPy).toBe(99n);
  });

  test('handles large amounts with slippage', () => {
    const amountSyWad = 1000000n * WAD;
    const defaultMinPy = (amountSyWad * 995n) / 1000n;
    expect(defaultMinPy).toBe(995000n * WAD);
  });

  test('custom minPyOut overrides default', () => {
    const amountSyWad = 1000n * WAD;
    const defaultMinPy = (amountSyWad * 995n) / 1000n;

    // Helper to simulate the hook's logic: const minPy = minPyOut ?? defaultMinPy
    const getMinPy = (minPyOut: bigint | undefined): bigint => minPyOut ?? defaultMinPy;

    // With custom value, should use custom
    const customMinPy = 900n * WAD; // User accepts 10% slippage
    expect(getMinPy(customMinPy)).toBe(customMinPy);

    // Without custom value, should use default
    expect(getMinPy(undefined)).toBe(defaultMinPy);
  });
});

describe('Approval check logic', () => {
  test('needs approval when allowance undefined', () => {
    const needsApproval = (allowance: bigint | undefined, amount: bigint): boolean => {
      if (allowance === undefined) return true;
      return allowance < amount;
    };

    expect(needsApproval(undefined, 1000n * WAD)).toBe(true);
  });

  test('needs approval when allowance less than amount', () => {
    const needsApproval = (allowance: bigint | undefined, amount: bigint): boolean => {
      if (allowance === undefined) return true;
      return allowance < amount;
    };

    expect(needsApproval(500n * WAD, 1000n * WAD)).toBe(true);
  });

  test('no approval needed when allowance sufficient', () => {
    const needsApproval = (allowance: bigint | undefined, amount: bigint): boolean => {
      if (allowance === undefined) return true;
      return allowance < amount;
    };

    expect(needsApproval(1000n * WAD, 1000n * WAD)).toBe(false);
    expect(needsApproval(2000n * WAD, 1000n * WAD)).toBe(false);
  });
});

describe('Uint256 conversion for calldata', () => {
  test('converts WAD to Uint256 and back', () => {
    const u256 = uint256.bnToUint256(WAD);
    // starknet.js returns hex strings, so verify round-trip
    const back = uint256.uint256ToBN(u256);
    expect(back).toBe(WAD);
  });

  test('converts large amount to Uint256', () => {
    const largeAmount = 10n ** 30n; // Larger than 2^128
    const u256 = uint256.bnToUint256(largeAmount);

    // Verify round-trip
    const back = uint256.uint256ToBN(u256);
    expect(back).toBe(largeAmount);
  });

  test('converts small amount to Uint256 and back', () => {
    const smallAmount = 1n;
    const u256 = uint256.bnToUint256(smallAmount);
    // starknet.js returns hex strings, so verify round-trip
    const back = uint256.uint256ToBN(u256);
    expect(back).toBe(smallAmount);
  });
});

describe('Deadline calculation', () => {
  test('deadline is in the future', () => {
    const deadline = getDeadline();
    const now = Math.floor(Date.now() / 1000);
    expect(Number(deadline)).toBeGreaterThan(now);
  });

  test('deadline with custom seconds', () => {
    // getDeadline takes seconds, not minutes
    const deadline300 = getDeadline(5 * 60); // 5 minutes = 300 seconds
    const deadline1800 = getDeadline(30 * 60); // 30 minutes = 1800 seconds

    expect(Number(deadline1800)).toBeGreaterThan(Number(deadline300));
    // Difference should be ~25 minutes (1500 seconds)
    const diff = Number(deadline1800) - Number(deadline300);
    expect(diff).toBeGreaterThanOrEqual(1500);
    expect(diff).toBeLessThanOrEqual(1501);
  });
});

describe('Calldata building', () => {
  test('builds approval calldata array', () => {
    const routerAddress = '0x456';
    const amountWad = 1000n * WAD;
    const u256Amount = uint256.bnToUint256(amountWad);

    const approveCalldata = [routerAddress, u256Amount.low, u256Amount.high];

    expect(approveCalldata[0]).toBe(routerAddress);
    expect(approveCalldata[1]).toBe(u256Amount.low);
    expect(approveCalldata[2]).toBe(u256Amount.high);
  });

  test('builds mint calldata array', () => {
    const ytAddress = '0xyt';
    const userAddress = '0xuser';
    const amountSyWad = 1000n * WAD;
    const minPyOut = 995n * WAD;
    const deadline = getDeadline();

    const u256AmountSy = uint256.bnToUint256(amountSyWad);
    const u256MinPy = uint256.bnToUint256(minPyOut);

    const mintCalldata = [
      ytAddress,
      userAddress,
      u256AmountSy.low,
      u256AmountSy.high,
      u256MinPy.low,
      u256MinPy.high,
      deadline.toString(),
    ];

    expect(mintCalldata[0]).toBe(ytAddress);
    expect(mintCalldata[1]).toBe(userAddress);
    expect(mintCalldata.length).toBe(7);
  });
});

describe('Input validation', () => {
  test('rejects empty amount', () => {
    const shouldProceed = (amountSy: string): boolean => {
      if (!amountSy || amountSy === '0') {
        return false;
      }
      return true;
    };

    expect(shouldProceed('')).toBe(false);
    expect(shouldProceed('0')).toBe(false);
    expect(shouldProceed('1')).toBe(true);
    expect(shouldProceed('0.001')).toBe(true);
  });

  test('validates user address exists', () => {
    const validateUser = (userAddress: string | undefined): void => {
      if (!userAddress) {
        throw new Error('Wallet not connected');
      }
    };

    expect(() => {
      validateUser(undefined);
    }).toThrow('Wallet not connected');
    expect(() => {
      validateUser('');
    }).toThrow('Wallet not connected');
    expect(() => {
      validateUser('0x123');
    }).not.toThrow();
  });
});

describe('Transaction status handling', () => {
  type TxStatus = 'idle' | 'signing' | 'pending' | 'success' | 'error';

  test('isLoading when signing', () => {
    const isLoading = (status: TxStatus): boolean => {
      return status === 'signing' || status === 'pending';
    };

    expect(isLoading('idle')).toBe(false);
    expect(isLoading('signing')).toBe(true);
    expect(isLoading('pending')).toBe(true);
    expect(isLoading('success')).toBe(false);
    expect(isLoading('error')).toBe(false);
  });
});
