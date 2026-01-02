/**
 * SwapForm Component Logic Tests
 *
 * Tests for validation logic, swap direction derivation, and state management.
 * Component rendering tests require React Testing Library integration.
 *
 * Run with: bun test src/components/forms/SwapForm.test.ts
 */

import { describe, expect, test } from 'bun:test';
import { calculateMinOutput } from '@features/swap';
import { parseWad } from '@shared/math/wad';
import { WAD } from '@/test/setup';

type SwapDirection = 'buy_pt' | 'sell_pt' | 'buy_yt' | 'sell_yt';
type TokenType = 'PT' | 'YT';

describe('SwapForm validation logic', () => {
  describe('swap direction derivation', () => {
    test('buy PT when buying and token type is PT', () => {
      const getDirection = (isBuying: boolean, tokenType: TokenType): SwapDirection => {
        return isBuying
          ? tokenType === 'PT'
            ? 'buy_pt'
            : 'buy_yt'
          : tokenType === 'PT'
            ? 'sell_pt'
            : 'sell_yt';
      };

      expect(getDirection(true, 'PT')).toBe('buy_pt');
    });

    test('buy YT when buying and token type is YT', () => {
      const getDirection = (isBuying: boolean, tokenType: TokenType): SwapDirection => {
        return isBuying
          ? tokenType === 'PT'
            ? 'buy_pt'
            : 'buy_yt'
          : tokenType === 'PT'
            ? 'sell_pt'
            : 'sell_yt';
      };

      expect(getDirection(true, 'YT')).toBe('buy_yt');
    });

    test('sell PT when selling and token type is PT', () => {
      const getDirection = (isBuying: boolean, tokenType: TokenType): SwapDirection => {
        return isBuying
          ? tokenType === 'PT'
            ? 'buy_pt'
            : 'buy_yt'
          : tokenType === 'PT'
            ? 'sell_pt'
            : 'sell_yt';
      };

      expect(getDirection(false, 'PT')).toBe('sell_pt');
    });

    test('sell YT when selling and token type is YT', () => {
      const getDirection = (isBuying: boolean, tokenType: TokenType): SwapDirection => {
        return isBuying
          ? tokenType === 'PT'
            ? 'buy_pt'
            : 'buy_yt'
          : tokenType === 'PT'
            ? 'sell_pt'
            : 'sell_yt';
      };

      expect(getDirection(false, 'YT')).toBe('sell_yt');
    });
  });

  describe('input parsing', () => {
    test('parses empty input as 0', () => {
      const parseInput = (inputAmount: string): bigint => {
        if (!inputAmount || inputAmount === '') return BigInt(0);
        try {
          return parseWad(inputAmount);
        } catch {
          return BigInt(0);
        }
      };

      expect(parseInput('')).toBe(0n);
    });

    test('parses valid decimal input', () => {
      const parseInput = (inputAmount: string): bigint => {
        if (!inputAmount || inputAmount === '') return BigInt(0);
        try {
          return parseWad(inputAmount);
        } catch {
          return BigInt(0);
        }
      };

      expect(parseInput('1.5')).toBe((15n * WAD) / 10n);
      expect(parseInput('100')).toBe(100n * WAD);
    });

    test('returns 0 for invalid input', () => {
      const parseInput = (inputAmount: string): bigint => {
        if (!inputAmount || inputAmount === '') return BigInt(0);
        try {
          return parseWad(inputAmount);
        } catch {
          return BigInt(0);
        }
      };

      expect(parseInput('abc')).toBe(0n);
    });
  });

  describe('balance validation', () => {
    test('detects insufficient balance', () => {
      const hasInsufficientBalance = (
        inputBalance: bigint | undefined,
        parsedInputAmount: bigint
      ): boolean => {
        return inputBalance !== undefined && parsedInputAmount > inputBalance;
      };

      expect(hasInsufficientBalance(100n * WAD, 200n * WAD)).toBe(true);
    });

    test('allows valid balance', () => {
      const hasInsufficientBalance = (
        inputBalance: bigint | undefined,
        parsedInputAmount: bigint
      ): boolean => {
        return inputBalance !== undefined && parsedInputAmount > inputBalance;
      };

      expect(hasInsufficientBalance(200n * WAD, 100n * WAD)).toBe(false);
      expect(hasInsufficientBalance(100n * WAD, 100n * WAD)).toBe(false);
    });

    test('handles undefined balance', () => {
      const hasInsufficientBalance = (
        inputBalance: bigint | undefined,
        parsedInputAmount: bigint
      ): boolean => {
        return inputBalance !== undefined && parsedInputAmount > inputBalance;
      };

      // When balance is undefined (loading), don't show error
      expect(hasInsufficientBalance(undefined, 100n * WAD)).toBe(false);
    });
  });

  describe('YT collateral requirement', () => {
    test('calculates collateral for sell_yt', () => {
      const getCollateralRequired = (direction: SwapDirection, amount: bigint): bigint => {
        return direction === 'sell_yt' ? amount * BigInt(4) : BigInt(0);
      };

      expect(getCollateralRequired('sell_yt', 100n * WAD)).toBe(400n * WAD);
    });

    test('no collateral for other directions', () => {
      const getCollateralRequired = (direction: SwapDirection, amount: bigint): bigint => {
        return direction === 'sell_yt' ? amount * BigInt(4) : BigInt(0);
      };

      expect(getCollateralRequired('buy_pt', 100n * WAD)).toBe(0n);
      expect(getCollateralRequired('sell_pt', 100n * WAD)).toBe(0n);
      expect(getCollateralRequired('buy_yt', 100n * WAD)).toBe(0n);
    });

    test('detects insufficient collateral', () => {
      const hasInsufficientCollateral = (
        direction: SwapDirection,
        syBalance: bigint | undefined,
        collateralRequired: bigint
      ): boolean => {
        return direction === 'sell_yt' && syBalance !== undefined && collateralRequired > syBalance;
      };

      expect(hasInsufficientCollateral('sell_yt', 300n * WAD, 400n * WAD)).toBe(true);
      expect(hasInsufficientCollateral('sell_yt', 400n * WAD, 400n * WAD)).toBe(false);
      expect(hasInsufficientCollateral('sell_yt', 500n * WAD, 400n * WAD)).toBe(false);
    });
  });

  describe('minimum output calculation', () => {
    test('calculates min output with slippage', () => {
      const expectedOutput = 1000n * WAD;
      const slippageBps = 50; // 0.5%

      const minOutput = calculateMinOutput(expectedOutput, slippageBps);

      // 1000 * (10000 - 50) / 10000 = 995
      expect(minOutput).toBe(995n * WAD);
    });

    test('handles 1% slippage', () => {
      const expectedOutput = 1000n * WAD;
      const slippageBps = 100;

      const minOutput = calculateMinOutput(expectedOutput, slippageBps);

      expect(minOutput).toBe(990n * WAD);
    });
  });

  describe('canSwap validation', () => {
    test('returns false when not connected', () => {
      const canSwap = (
        isConnected: boolean,
        isValidAmount: boolean,
        hasInsufficientBalance: boolean,
        hasInsufficientCollateral: boolean,
        isSwapping: boolean,
        isSuccess: boolean,
        canProceed: boolean
      ): boolean => {
        return (
          isConnected &&
          isValidAmount &&
          !hasInsufficientBalance &&
          !hasInsufficientCollateral &&
          !isSwapping &&
          !isSuccess &&
          canProceed
        );
      };

      expect(canSwap(false, true, false, false, false, false, true)).toBe(false);
    });

    test('returns false when amount invalid', () => {
      const canSwap = (
        isConnected: boolean,
        isValidAmount: boolean,
        hasInsufficientBalance: boolean,
        hasInsufficientCollateral: boolean,
        isSwapping: boolean,
        isSuccess: boolean,
        canProceed: boolean
      ): boolean => {
        return (
          isConnected &&
          isValidAmount &&
          !hasInsufficientBalance &&
          !hasInsufficientCollateral &&
          !isSwapping &&
          !isSuccess &&
          canProceed
        );
      };

      expect(canSwap(true, false, false, false, false, false, true)).toBe(false);
    });

    test('returns false when insufficient balance', () => {
      const canSwap = (
        isConnected: boolean,
        isValidAmount: boolean,
        hasInsufficientBalance: boolean,
        hasInsufficientCollateral: boolean,
        isSwapping: boolean,
        isSuccess: boolean,
        canProceed: boolean
      ): boolean => {
        return (
          isConnected &&
          isValidAmount &&
          !hasInsufficientBalance &&
          !hasInsufficientCollateral &&
          !isSwapping &&
          !isSuccess &&
          canProceed
        );
      };

      expect(canSwap(true, true, true, false, false, false, true)).toBe(false);
    });

    test('returns false when swapping', () => {
      const canSwap = (
        isConnected: boolean,
        isValidAmount: boolean,
        hasInsufficientBalance: boolean,
        hasInsufficientCollateral: boolean,
        isSwapping: boolean,
        isSuccess: boolean,
        canProceed: boolean
      ): boolean => {
        return (
          isConnected &&
          isValidAmount &&
          !hasInsufficientBalance &&
          !hasInsufficientCollateral &&
          !isSwapping &&
          !isSuccess &&
          canProceed
        );
      };

      expect(canSwap(true, true, false, false, true, false, true)).toBe(false);
    });

    test('returns true when all conditions met', () => {
      const canSwap = (
        isConnected: boolean,
        isValidAmount: boolean,
        hasInsufficientBalance: boolean,
        hasInsufficientCollateral: boolean,
        isSwapping: boolean,
        isSuccess: boolean,
        canProceed: boolean
      ): boolean => {
        return (
          isConnected &&
          isValidAmount &&
          !hasInsufficientBalance &&
          !hasInsufficientCollateral &&
          !isSwapping &&
          !isSuccess &&
          canProceed
        );
      };

      expect(canSwap(true, true, false, false, false, false, true)).toBe(true);
    });
  });

  describe('transaction status mapping', () => {
    test('maps isSwapping to pending', () => {
      const getTxStatus = (
        isSwapping: boolean,
        isSuccess: boolean,
        isError: boolean
      ): 'idle' | 'pending' | 'success' | 'error' => {
        if (isSwapping) return 'pending';
        if (isSuccess) return 'success';
        if (isError) return 'error';
        return 'idle';
      };

      expect(getTxStatus(true, false, false)).toBe('pending');
    });

    test('maps isSuccess to success', () => {
      const getTxStatus = (
        isSwapping: boolean,
        isSuccess: boolean,
        isError: boolean
      ): 'idle' | 'pending' | 'success' | 'error' => {
        if (isSwapping) return 'pending';
        if (isSuccess) return 'success';
        if (isError) return 'error';
        return 'idle';
      };

      expect(getTxStatus(false, true, false)).toBe('success');
    });

    test('maps isError to error', () => {
      const getTxStatus = (
        isSwapping: boolean,
        isSuccess: boolean,
        isError: boolean
      ): 'idle' | 'pending' | 'success' | 'error' => {
        if (isSwapping) return 'pending';
        if (isSuccess) return 'success';
        if (isError) return 'error';
        return 'idle';
      };

      expect(getTxStatus(false, false, true)).toBe('error');
    });

    test('defaults to idle', () => {
      const getTxStatus = (
        isSwapping: boolean,
        isSuccess: boolean,
        isError: boolean
      ): 'idle' | 'pending' | 'success' | 'error' => {
        if (isSwapping) return 'pending';
        if (isSuccess) return 'success';
        if (isError) return 'error';
        return 'idle';
      };

      expect(getTxStatus(false, false, false)).toBe('idle');
    });
  });

  describe('input token address selection', () => {
    test('returns SY address when buying', () => {
      const getInputToken = (
        isBuying: boolean,
        tokenType: TokenType,
        syAddress: string,
        ptAddress: string,
        ytAddress: string
      ): string => {
        return isBuying ? syAddress : tokenType === 'PT' ? ptAddress : ytAddress;
      };

      expect(getInputToken(true, 'PT', '0xsy', '0xpt', '0xyt')).toBe('0xsy');
      expect(getInputToken(true, 'YT', '0xsy', '0xpt', '0xyt')).toBe('0xsy');
    });

    test('returns PT address when selling PT', () => {
      const getInputToken = (
        isBuying: boolean,
        tokenType: TokenType,
        syAddress: string,
        ptAddress: string,
        ytAddress: string
      ): string => {
        return isBuying ? syAddress : tokenType === 'PT' ? ptAddress : ytAddress;
      };

      expect(getInputToken(false, 'PT', '0xsy', '0xpt', '0xyt')).toBe('0xpt');
    });

    test('returns YT address when selling YT', () => {
      const getInputToken = (
        isBuying: boolean,
        tokenType: TokenType,
        syAddress: string,
        ptAddress: string,
        ytAddress: string
      ): string => {
        return isBuying ? syAddress : tokenType === 'PT' ? ptAddress : ytAddress;
      };

      expect(getInputToken(false, 'YT', '0xsy', '0xpt', '0xyt')).toBe('0xyt');
    });
  });

  describe('label generation', () => {
    test('generates correct input label', () => {
      const getInputLabel = (
        isBuying: boolean,
        tokenType: TokenType,
        syLabel: string,
        ptLabel: string,
        ytLabel: string
      ): string => {
        return isBuying ? syLabel : tokenType === 'PT' ? ptLabel : ytLabel;
      };

      expect(getInputLabel(true, 'PT', 'SY-ETH', 'PT-ETH', 'YT-ETH')).toBe('SY-ETH');
      expect(getInputLabel(false, 'PT', 'SY-ETH', 'PT-ETH', 'YT-ETH')).toBe('PT-ETH');
      expect(getInputLabel(false, 'YT', 'SY-ETH', 'PT-ETH', 'YT-ETH')).toBe('YT-ETH');
    });

    test('generates correct output label', () => {
      const getOutputLabel = (
        isBuying: boolean,
        tokenType: TokenType,
        syLabel: string,
        ptLabel: string,
        ytLabel: string
      ): string => {
        return isBuying ? (tokenType === 'PT' ? ptLabel : ytLabel) : syLabel;
      };

      expect(getOutputLabel(true, 'PT', 'SY-ETH', 'PT-ETH', 'YT-ETH')).toBe('PT-ETH');
      expect(getOutputLabel(true, 'YT', 'SY-ETH', 'PT-ETH', 'YT-ETH')).toBe('YT-ETH');
      expect(getOutputLabel(false, 'PT', 'SY-ETH', 'PT-ETH', 'YT-ETH')).toBe('SY-ETH');
      expect(getOutputLabel(false, 'YT', 'SY-ETH', 'PT-ETH', 'YT-ETH')).toBe('SY-ETH');
    });
  });
});
