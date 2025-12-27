/**
 * Error Handling Tests
 *
 * Tests for contract error extraction and user-friendly message generation.
 * Run with: bun test src/lib/errors.test.ts
 */

import { describe, expect, test } from 'bun:test';

import {
  extractContractError,
  formatValidationError,
  getErrorHelpText,
  getModeAwareErrorMessage,
  getSimpleErrorMessage,
  isContractError,
  isDeadlineError,
  isInsufficientBalanceError,
  isPauseError,
  isSlippageError,
  parseContractError,
} from './errors';

describe('extractContractError', () => {
  test('extracts HZN: error from string', () => {
    const error = 'Transaction failed: HZN: slippage exceeded';
    expect(extractContractError(error)).toBe('HZN: slippage exceeded');
  });

  test('extracts HZN: error from Error object', () => {
    const error = new Error('HZN: insufficient balance');
    expect(extractContractError(error)).toBe('HZN: insufficient balance');
  });

  test('extracts error from JSON string', () => {
    const error = '{"message": "HZN: market expired", "code": 123}';
    expect(extractContractError(error)).toBe('HZN: market expired');
  });

  test('extracts error from nested object', () => {
    const error = { inner: { message: 'HZN: zero amount' } };
    expect(extractContractError(error)).toBe('HZN: zero amount');
  });

  test('extracts ERC20: error from string', () => {
    const error = 'Transaction failed: ERC20: insufficient balance';
    expect(extractContractError(error)).toBe('ERC20: insufficient balance');
  });

  test('extracts ERC20: error from Error object', () => {
    const error = new Error('ERC20: insufficient allowance');
    expect(extractContractError(error)).toBe('ERC20: insufficient allowance');
  });

  test('returns null for non-contract errors', () => {
    expect(extractContractError('Regular error message')).toBeNull();
    expect(extractContractError(new Error('Something went wrong'))).toBeNull();
  });

  test('returns null for null/undefined', () => {
    expect(extractContractError(null)).toBeNull();
    expect(extractContractError(undefined)).toBeNull();
  });

  test('handles number input', () => {
    expect(extractContractError(123)).toBeNull();
  });

  test('handles boolean input', () => {
    expect(extractContractError(false)).toBeNull();
  });

  test('handles bigint input', () => {
    expect(extractContractError(123n)).toBeNull();
  });

  test('extracts error with trailing content', () => {
    const error = 'Error: HZN: insufficient SY at block 12345';
    expect(extractContractError(error)).toBe('HZN: insufficient SY at block 12345');
  });
});

describe('parseContractError', () => {
  describe('advanced mode (isSimple = false)', () => {
    test('returns mapped message for known errors', () => {
      const error = 'HZN: slippage exceeded';
      expect(parseContractError(error, false)).toBe(
        'Price moved beyond slippage tolerance. Try again.'
      );
    });

    test('returns formatted message for unknown HZN errors', () => {
      const error = 'HZN: unknown error code';
      expect(parseContractError(error, false)).toBe('Contract error: HZN: unknown error code');
    });

    test('returns generic message for non-HZN errors', () => {
      expect(parseContractError('Random error', false)).toBe('An unexpected error occurred.');
    });
  });

  describe('simple mode (isSimple = true)', () => {
    test('returns simplified message for known errors', () => {
      const error = 'HZN: slippage exceeded';
      expect(parseContractError(error, true)).toBe('Price changed too much. Please try again.');
    });

    test('returns generic simple message for unknown HZN errors', () => {
      const error = 'HZN: unknown error code';
      expect(parseContractError(error, true)).toBe('Something went wrong. Please try again.');
    });

    test('returns generic simple message for non-HZN errors', () => {
      expect(parseContractError('Random error', true)).toBe(
        'Something went wrong. Please try again.'
      );
    });
  });

  describe('specific error mappings', () => {
    const errorMappings = [
      { code: 'HZN: zero address', advanced: 'Invalid address provided.' },
      { code: 'HZN: zero amount', advanced: 'Amount cannot be zero.' },
      { code: 'HZN: expired', advanced: 'This position has expired.' },
      { code: 'HZN: market expired', advanced: 'This market has expired.' },
      {
        code: 'HZN: deadline exceeded',
        advanced: 'Transaction deadline exceeded. Please try again.',
      },
      { code: 'HZN: paused', advanced: 'This operation is currently paused.' },
    ];

    for (const { code, advanced } of errorMappings) {
      test(`maps "${code}" correctly in advanced mode`, () => {
        expect(parseContractError(code, false)).toBe(advanced);
      });
    }
  });

  describe('ERC20 error handling', () => {
    test('returns mapped message for ERC20 insufficient balance', () => {
      expect(parseContractError('ERC20: insufficient balance', false)).toBe(
        'Insufficient token balance.'
      );
      expect(parseContractError('ERC20: insufficient balance', true)).toBe(
        'Not enough tokens in your wallet.'
      );
    });

    test('returns mapped message for ERC20 insufficient allowance', () => {
      expect(parseContractError('ERC20: insufficient allowance', false)).toBe(
        'Token approval required.'
      );
      expect(parseContractError('ERC20: insufficient allowance', true)).toBe(
        'Please approve tokens first.'
      );
    });

    test('returns mapped message for ERC20 transfer exceeds balance', () => {
      expect(parseContractError('ERC20: transfer amount exceeds balance', false)).toBe(
        'Insufficient token balance.'
      );
      expect(parseContractError('ERC20: transfer amount exceeds balance', true)).toBe(
        'Not enough tokens in your wallet.'
      );
    });
  });
});

describe('isContractError', () => {
  test('returns true for matching error', () => {
    expect(isContractError('HZN: slippage exceeded', 'HZN: slippage exceeded')).toBe(true);
  });

  test('returns false for non-matching error', () => {
    expect(isContractError('HZN: slippage exceeded', 'HZN: expired')).toBe(false);
  });

  test('returns false for non-HZN error', () => {
    expect(isContractError('Random error', 'HZN: expired')).toBe(false);
  });
});

describe('isDeadlineError', () => {
  test('returns true for deadline error', () => {
    expect(isDeadlineError('HZN: deadline exceeded')).toBe(true);
    expect(isDeadlineError(new Error('Transaction failed: HZN: deadline exceeded'))).toBe(true);
  });

  test('returns false for other errors', () => {
    expect(isDeadlineError('HZN: slippage exceeded')).toBe(false);
    expect(isDeadlineError('Random error')).toBe(false);
  });
});

describe('isSlippageError', () => {
  test('returns true for slippage error', () => {
    expect(isSlippageError('HZN: slippage exceeded')).toBe(true);
    expect(isSlippageError(new Error('HZN: slippage exceeded'))).toBe(true);
  });

  test('returns false for other errors', () => {
    expect(isSlippageError('HZN: deadline exceeded')).toBe(false);
    expect(isSlippageError('Random error')).toBe(false);
  });
});

describe('isPauseError', () => {
  test('returns true for pause error', () => {
    expect(isPauseError('HZN: paused')).toBe(true);
    expect(isPauseError(new Error('HZN: paused'))).toBe(true);
  });

  test('returns false for other errors', () => {
    expect(isPauseError('HZN: expired')).toBe(false);
    expect(isPauseError('Random error')).toBe(false);
  });
});

describe('isInsufficientBalanceError', () => {
  test('returns true for HZN insufficient balance errors', () => {
    expect(isInsufficientBalanceError('HZN: insufficient balance')).toBe(true);
    expect(isInsufficientBalanceError('HZN: insufficient PT')).toBe(true);
    expect(isInsufficientBalanceError('HZN: insufficient YT')).toBe(true);
    expect(isInsufficientBalanceError('HZN: insufficient SY')).toBe(true);
  });

  test('returns true for ERC20 insufficient balance errors', () => {
    expect(isInsufficientBalanceError('ERC20: insufficient balance')).toBe(true);
    expect(isInsufficientBalanceError('ERC20: transfer amount exceeds balance')).toBe(true);
  });

  test('returns false for other errors', () => {
    expect(isInsufficientBalanceError('HZN: slippage exceeded')).toBe(false);
    expect(isInsufficientBalanceError('Not enough tokens')).toBe(false);
    expect(isInsufficientBalanceError('ERC20: insufficient allowance')).toBe(false);
  });
});

describe('getSimpleErrorMessage', () => {
  test('returns simplified message for HZN errors', () => {
    expect(getSimpleErrorMessage('HZN: insufficient balance')).toBe('Not enough tokens.');
  });

  test('returns simplified message for ERC20 errors', () => {
    expect(getSimpleErrorMessage('ERC20: insufficient balance')).toBe(
      'Not enough tokens in your wallet.'
    );
    expect(getSimpleErrorMessage('ERC20: insufficient allowance')).toBe(
      'Please approve tokens first.'
    );
  });

  test('returns simplified message for legacy error patterns', () => {
    expect(getSimpleErrorMessage('Insufficient SY balance')).toBe('Not enough tokens deposited');
    expect(getSimpleErrorMessage('User rejected')).toBe('Transaction was cancelled');
    expect(getSimpleErrorMessage('Slippage exceeded')).toBe('Price changed too much. Try again.');
  });

  test('returns generic message for unknown errors', () => {
    expect(getSimpleErrorMessage('Some unknown error')).toBe(
      'Something went wrong. Please try again.'
    );
  });

  test('handles null/undefined', () => {
    expect(getSimpleErrorMessage(null)).toBe('An error occurred');
    expect(getSimpleErrorMessage(undefined)).toBe('An error occurred');
  });

  test('handles Error objects', () => {
    const error = new Error('Insufficient balance');
    expect(getSimpleErrorMessage(error)).toBe('Not enough tokens');
  });
});

describe('getModeAwareErrorMessage', () => {
  test('returns technical message in advanced mode', () => {
    const error = 'Insufficient SY balance for this operation';
    expect(getModeAwareErrorMessage(error, false)).toBe(
      'Insufficient SY balance for this operation'
    );
  });

  test('returns simplified message in simple mode', () => {
    const error = 'Insufficient SY balance';
    expect(getModeAwareErrorMessage(error, true)).toBe('Not enough tokens deposited');
  });

  test('handles HZN errors in advanced mode', () => {
    expect(getModeAwareErrorMessage('HZN: insufficient SY', false)).toBe(
      'Insufficient SY balance.'
    );
  });

  test('handles HZN errors in simple mode', () => {
    expect(getModeAwareErrorMessage('HZN: insufficient SY', true)).toBe(
      'Not enough deposited tokens.'
    );
  });

  test('handles ERC20 errors in advanced mode', () => {
    expect(getModeAwareErrorMessage('ERC20: insufficient balance', false)).toBe(
      'Insufficient token balance.'
    );
  });

  test('handles ERC20 errors in simple mode', () => {
    expect(getModeAwareErrorMessage('ERC20: insufficient balance', true)).toBe(
      'Not enough tokens in your wallet.'
    );
  });

  test('handles null/undefined', () => {
    expect(getModeAwareErrorMessage(null, true)).toBe('An error occurred');
    expect(getModeAwareErrorMessage(undefined, false)).toBe('Unknown error');
  });
});

describe('formatValidationError', () => {
  test('returns null for null input', () => {
    expect(formatValidationError(null, true)).toBeNull();
    expect(formatValidationError(null, false)).toBeNull();
  });

  test('simplifies validation errors in simple mode', () => {
    expect(formatValidationError('Insufficient balance', true)).toBe('Not enough tokens');
    expect(formatValidationError('Amount exceeds balance', true)).toBe('Not enough tokens');
    expect(formatValidationError('Invalid amount', true)).toBe('Enter a valid amount');
  });

  test('returns original error in advanced mode', () => {
    const error = 'Insufficient balance for this operation';
    expect(formatValidationError(error, false)).toBe(error);
  });

  test('returns original if no simplification found', () => {
    const error = 'Custom validation error';
    expect(formatValidationError(error, true)).toBe(error);
  });
});

describe('getErrorHelpText', () => {
  test('returns null for null input', () => {
    expect(getErrorHelpText(null, true)).toBeNull();
    expect(getErrorHelpText(undefined, false)).toBeNull();
  });

  test('returns help text for slippage error in simple mode', () => {
    const help = getErrorHelpText('HZN: slippage exceeded', true);
    expect(help).toBe('Market conditions changed. Please try again.');
  });

  test('returns help text for slippage error in advanced mode', () => {
    const help = getErrorHelpText('HZN: slippage exceeded', false);
    expect(help).toBe('Increase slippage tolerance or reduce trade size.');
  });

  test('returns help text for deadline error', () => {
    expect(getErrorHelpText('HZN: deadline exceeded', true)).toBe(
      'The transaction took too long to process.'
    );
    expect(getErrorHelpText('HZN: deadline exceeded', false)).toBe(
      'Increase deadline duration in settings or try during lower network congestion.'
    );
  });

  test('returns help text for pause error', () => {
    expect(getErrorHelpText('HZN: paused', true)).toBe(
      'The protocol is temporarily paused for maintenance.'
    );
    expect(getErrorHelpText('HZN: paused', false)).toBe(
      'The contract is paused. Check announcements for maintenance updates.'
    );
  });

  test('returns contextual help for wallet errors in simple mode', () => {
    const help = getErrorHelpText('Wallet not connected', true);
    expect(help).toBe('Connect your wallet using the button in the top right.');
  });

  test('returns contextual help for rejected transactions', () => {
    const help = getErrorHelpText('User rejected transaction', true);
    expect(help).toBe('You cancelled the transaction in your wallet.');
  });

  test('returns contextual help for insufficient errors in advanced mode', () => {
    const help = getErrorHelpText('Insufficient SY balance', false);
    expect(help).toBe('Deposit more underlying tokens to increase your SY balance.');
  });

  test('returns null for unrecognized errors', () => {
    expect(getErrorHelpText('Some random error', true)).toBeNull();
    expect(getErrorHelpText('Unknown technical issue', false)).toBeNull();
  });

  test('returns help text for ERC20 insufficient balance', () => {
    expect(getErrorHelpText('ERC20: insufficient balance', true)).toBe(
      'You need more tokens in your wallet to complete this action.'
    );
    expect(getErrorHelpText('ERC20: insufficient balance', false)).toBe(
      'Your wallet token balance is insufficient. Check your balance and try a smaller amount.'
    );
  });

  test('returns help text for ERC20 insufficient allowance', () => {
    expect(getErrorHelpText('ERC20: insufficient allowance', true)).toBe(
      'You need to approve tokens before this action.'
    );
    expect(getErrorHelpText('ERC20: insufficient allowance', false)).toBe(
      'Token allowance is insufficient. Approve tokens for the contract first.'
    );
  });
});

describe('Edge cases', () => {
  test('handles empty string', () => {
    expect(extractContractError('')).toBeNull();
    expect(parseContractError('', false)).toBe('An unexpected error occurred.');
  });

  test('handles whitespace-only string', () => {
    expect(extractContractError('   ')).toBeNull();
  });

  test('handles HZN: with extra spaces', () => {
    expect(extractContractError('HZN:  slippage exceeded')).toBe('HZN:  slippage exceeded');
  });

  test('handles nested Error objects', () => {
    const innerError = new Error('HZN: insufficient balance');
    const outerError = new Error(`Outer error: ${innerError.message}`);
    expect(extractContractError(outerError)).toBe('HZN: insufficient balance');
  });

  test('handles circular objects gracefully', () => {
    const obj: Record<string, unknown> = { message: 'test' };
    obj['self'] = obj; // Create circular reference
    // Should not throw, just return null for non-HZN content
    expect(extractContractError(obj)).toBeNull();
  });
});
