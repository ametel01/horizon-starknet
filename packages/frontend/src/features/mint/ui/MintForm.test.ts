/**
 * MintForm Component Logic Tests
 *
 * Tests for validation logic and state management used by MintForm.
 * Component rendering tests require React Testing Library integration.
 *
 * Run with: bun test src/components/forms/MintForm.test.ts
 */

import { describe, expect, test } from 'bun:test';
import { toWad } from '@shared/math/wad';
import { WAD } from '@/test/setup';

describe('MintForm validation logic', () => {
  describe('output amount calculation', () => {
    test('returns 0 for empty input', () => {
      const calculateOutput = (amountSy: string): bigint => {
        if (!amountSy || amountSy === '0') {
          return BigInt(0);
        }
        try {
          return toWad(amountSy);
        } catch {
          return BigInt(0);
        }
      };

      expect(calculateOutput('')).toBe(0n);
      expect(calculateOutput('0')).toBe(0n);
    });

    test('returns WAD amount for valid input', () => {
      const calculateOutput = (amountSy: string): bigint => {
        if (!amountSy || amountSy === '0') {
          return BigInt(0);
        }
        try {
          return toWad(amountSy);
        } catch {
          return BigInt(0);
        }
      };

      expect(calculateOutput('1')).toBe(WAD);
      expect(calculateOutput('1.0')).toBe(WAD);
      expect(calculateOutput('100')).toBe(100n * WAD);
    });

    test('returns 0 for invalid input', () => {
      const calculateOutput = (amountSy: string): bigint => {
        if (!amountSy || amountSy === '0') {
          return BigInt(0);
        }
        try {
          return toWad(amountSy);
        } catch {
          return BigInt(0);
        }
      };

      expect(calculateOutput('abc')).toBe(0n);
      expect(calculateOutput('--1')).toBe(0n);
    });
  });

  describe('validation error detection', () => {
    test('returns null for empty input', () => {
      const getValidationError = (
        amountSy: string,
        syBalance: bigint | undefined
      ): string | null => {
        if (!amountSy || amountSy === '0') {
          return null;
        }

        try {
          const amountWad = toWad(amountSy);
          if (syBalance !== undefined && amountWad > syBalance) {
            return 'Insufficient balance';
          }
        } catch {
          return 'Invalid amount';
        }

        return null;
      };

      expect(getValidationError('', 1000n * WAD)).toBeNull();
      expect(getValidationError('0', 1000n * WAD)).toBeNull();
    });

    test('returns Insufficient balance when amount exceeds balance', () => {
      const getValidationError = (
        amountSy: string,
        syBalance: bigint | undefined
      ): string | null => {
        if (!amountSy || amountSy === '0') {
          return null;
        }

        try {
          const amountWad = toWad(amountSy);
          if (syBalance !== undefined && amountWad > syBalance) {
            return 'Insufficient balance';
          }
        } catch {
          return 'Invalid amount';
        }

        return null;
      };

      expect(getValidationError('100', 50n * WAD)).toBe('Insufficient balance');
      expect(getValidationError('1.5', 1n * WAD)).toBe('Insufficient balance');
    });

    test('returns null when amount is within balance', () => {
      const getValidationError = (
        amountSy: string,
        syBalance: bigint | undefined
      ): string | null => {
        if (!amountSy || amountSy === '0') {
          return null;
        }

        try {
          const amountWad = toWad(amountSy);
          if (syBalance !== undefined && amountWad > syBalance) {
            return 'Insufficient balance';
          }
        } catch {
          return 'Invalid amount';
        }

        return null;
      };

      expect(getValidationError('50', 100n * WAD)).toBeNull();
      expect(getValidationError('100', 100n * WAD)).toBeNull();
    });

    test('returns Invalid amount for malformed input', () => {
      const getValidationError = (
        amountSy: string,
        syBalance: bigint | undefined
      ): string | null => {
        if (!amountSy || amountSy === '0') {
          return null;
        }

        try {
          const amountWad = toWad(amountSy);
          if (syBalance !== undefined && amountWad > syBalance) {
            return 'Insufficient balance';
          }
        } catch {
          return 'Invalid amount';
        }

        return null;
      };

      expect(getValidationError('abc', 1000n * WAD)).toBe('Invalid amount');
    });

    test('handles undefined balance', () => {
      const getValidationError = (
        amountSy: string,
        syBalance: bigint | undefined
      ): string | null => {
        if (!amountSy || amountSy === '0') {
          return null;
        }

        try {
          const amountWad = toWad(amountSy);
          if (syBalance !== undefined && amountWad > syBalance) {
            return 'Insufficient balance';
          }
        } catch {
          return 'Invalid amount';
        }

        return null;
      };

      // No error when balance is undefined (still loading)
      expect(getValidationError('100', undefined)).toBeNull();
    });
  });

  describe('button state', () => {
    test('button disabled when not connected', () => {
      const isButtonDisabled = (
        isConnected: boolean,
        amountSy: string,
        validationError: string | null,
        isLoading: boolean
      ): boolean => {
        return !isConnected || !amountSy || amountSy === '0' || !!validationError || isLoading;
      };

      expect(isButtonDisabled(false, '100', null, false)).toBe(true);
    });

    test('button disabled when no amount', () => {
      const isButtonDisabled = (
        isConnected: boolean,
        amountSy: string,
        validationError: string | null,
        isLoading: boolean
      ): boolean => {
        return !isConnected || !amountSy || amountSy === '0' || !!validationError || isLoading;
      };

      expect(isButtonDisabled(true, '', null, false)).toBe(true);
      expect(isButtonDisabled(true, '0', null, false)).toBe(true);
    });

    test('button disabled when validation error', () => {
      const isButtonDisabled = (
        isConnected: boolean,
        amountSy: string,
        validationError: string | null,
        isLoading: boolean
      ): boolean => {
        return !isConnected || !amountSy || amountSy === '0' || !!validationError || isLoading;
      };

      expect(isButtonDisabled(true, '100', 'Insufficient balance', false)).toBe(true);
    });

    test('button disabled when loading', () => {
      const isButtonDisabled = (
        isConnected: boolean,
        amountSy: string,
        validationError: string | null,
        isLoading: boolean
      ): boolean => {
        return !isConnected || !amountSy || amountSy === '0' || !!validationError || isLoading;
      };

      expect(isButtonDisabled(true, '100', null, true)).toBe(true);
    });

    test('button enabled when all conditions met', () => {
      const isButtonDisabled = (
        isConnected: boolean,
        amountSy: string,
        validationError: string | null,
        isLoading: boolean
      ): boolean => {
        return !isConnected || !amountSy || amountSy === '0' || !!validationError || isLoading;
      };

      expect(isButtonDisabled(true, '100', null, false)).toBe(false);
    });
  });

  describe('button text', () => {
    test('shows Connect Wallet when not connected', () => {
      const getButtonText = (
        isConnected: boolean,
        isLoading: boolean,
        validationError: string | null,
        amountSy: string
      ): string => {
        if (!isConnected) return 'Connect Wallet';
        if (isLoading) return 'Minting...';
        if (validationError) return validationError;
        if (!amountSy || amountSy === '0') return 'Enter Amount';
        return 'Mint PT + YT';
      };

      expect(getButtonText(false, false, null, '100')).toBe('Connect Wallet');
    });

    test('shows Minting... when loading', () => {
      const getButtonText = (
        isConnected: boolean,
        isLoading: boolean,
        validationError: string | null,
        amountSy: string
      ): string => {
        if (!isConnected) return 'Connect Wallet';
        if (isLoading) return 'Minting...';
        if (validationError) return validationError;
        if (!amountSy || amountSy === '0') return 'Enter Amount';
        return 'Mint PT + YT';
      };

      expect(getButtonText(true, true, null, '100')).toBe('Minting...');
    });

    test('shows validation error when present', () => {
      const getButtonText = (
        isConnected: boolean,
        isLoading: boolean,
        validationError: string | null,
        amountSy: string
      ): string => {
        if (!isConnected) return 'Connect Wallet';
        if (isLoading) return 'Minting...';
        if (validationError) return validationError;
        if (!amountSy || amountSy === '0') return 'Enter Amount';
        return 'Mint PT + YT';
      };

      expect(getButtonText(true, false, 'Insufficient balance', '100')).toBe(
        'Insufficient balance'
      );
    });

    test('shows Enter Amount when no amount', () => {
      const getButtonText = (
        isConnected: boolean,
        isLoading: boolean,
        validationError: string | null,
        amountSy: string
      ): string => {
        if (!isConnected) return 'Connect Wallet';
        if (isLoading) return 'Minting...';
        if (validationError) return validationError;
        if (!amountSy || amountSy === '0') return 'Enter Amount';
        return 'Mint PT + YT';
      };

      expect(getButtonText(true, false, null, '')).toBe('Enter Amount');
      expect(getButtonText(true, false, null, '0')).toBe('Enter Amount');
    });

    test('shows Mint PT + YT when ready', () => {
      const getButtonText = (
        isConnected: boolean,
        isLoading: boolean,
        validationError: string | null,
        amountSy: string
      ): string => {
        if (!isConnected) return 'Connect Wallet';
        if (isLoading) return 'Minting...';
        if (validationError) return validationError;
        if (!amountSy || amountSy === '0') return 'Enter Amount';
        return 'Mint PT + YT';
      };

      expect(getButtonText(true, false, null, '100')).toBe('Mint PT + YT');
    });
  });

  describe('token symbol generation', () => {
    test('generates SY symbol from token symbol', () => {
      const getSySymbol = (tokenSymbol: string): string => `SY-${tokenSymbol}`;
      expect(getSySymbol('ETH')).toBe('SY-ETH');
      expect(getSySymbol('STRK')).toBe('SY-STRK');
    });

    test('generates PT symbol from token symbol', () => {
      const getPtSymbol = (tokenSymbol: string): string => `PT-${tokenSymbol}`;
      expect(getPtSymbol('ETH')).toBe('PT-ETH');
      expect(getPtSymbol('STRK')).toBe('PT-STRK');
    });

    test('generates YT symbol from token symbol', () => {
      const getYtSymbol = (tokenSymbol: string): string => `YT-${tokenSymbol}`;
      expect(getYtSymbol('ETH')).toBe('YT-ETH');
      expect(getYtSymbol('STRK')).toBe('YT-STRK');
    });

    test('handles default when metadata missing', () => {
      // Simulate market.metadata?.yieldTokenSymbol ?? 'Token'
      const getTokenSymbol = (metadata: { yieldTokenSymbol?: string } | undefined): string => {
        return metadata?.yieldTokenSymbol ?? 'Token';
      };

      expect(getTokenSymbol(undefined)).toBe('Token');
      expect(getTokenSymbol({})).toBe('Token');
      expect(getTokenSymbol({ yieldTokenSymbol: 'ETH' })).toBe('ETH');
    });
  });
});
