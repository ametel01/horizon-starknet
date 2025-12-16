/**
 * Error Message Utility
 *
 * Provides mode-aware error messages that are user-friendly in simple mode
 * and technical in advanced mode.
 */

/**
 * Error message mapping from technical (advanced) to user-friendly (simple)
 */
const errorMessageMap: Record<string, string> = {
  // Balance errors
  'Insufficient SY balance': 'Not enough tokens deposited',
  'Insufficient PT balance': 'Not enough Fixed-Rate Position',
  'Insufficient YT balance': 'Not enough Variable-Rate Position',
  'Insufficient LP balance': 'Not enough liquidity position',
  'Insufficient balance': 'Not enough tokens',
  'Insufficient underlying balance': 'Not enough tokens to deposit',

  // Approval errors
  'Approval failed': 'Failed to approve tokens',
  'Insufficient allowance': 'Please approve tokens first',

  // Transaction errors
  'Transaction failed': 'Transaction failed. Please try again.',
  'Transaction rejected': 'Transaction was cancelled',
  'User rejected': 'Transaction was cancelled',

  // Connection errors
  'Wallet not connected': 'Please connect your wallet',
  'Network error': 'Connection error. Please try again.',

  // Amount errors
  'Amount too low': 'Amount is too small',
  'Amount too high': 'Amount exceeds available balance',
  'Invalid amount': 'Please enter a valid amount',
  'Min output not met': 'Price changed too much. Try again.',

  // Slippage errors
  'Slippage exceeded': 'Price changed too much. Try again.',
  'Price impact too high': 'Trade size is too large',

  // Market errors
  'Market expired': 'This market has matured',
  'Market not found': 'Market not available',

  // Redemption errors
  'Cannot redeem': 'Unable to withdraw at this time',
  'Redemption failed': 'Withdrawal failed. Please try again.',
  'PT and YT mismatch': 'Position amounts must match to withdraw',
};

/**
 * Get a user-friendly error message for simple mode
 */
export function getSimpleErrorMessage(error: string | Error | null | undefined): string {
  if (error === null || error === undefined) return 'An error occurred';

  const errorString = error instanceof Error ? error.message : error;

  // Check for exact matches first
  const exactMatch = errorMessageMap[errorString];
  if (exactMatch !== undefined) {
    return exactMatch;
  }

  // Check for partial matches (case-insensitive)
  const lowerError = errorString.toLowerCase();
  for (const [key, value] of Object.entries(errorMessageMap)) {
    if (lowerError.includes(key.toLowerCase())) {
      return value;
    }
  }

  // Generic fallback
  return 'Something went wrong. Please try again.';
}

/**
 * Get the appropriate error message based on mode
 */
export function getModeAwareErrorMessage(
  error: string | Error | null | undefined,
  isSimple: boolean
): string {
  if (error === null || error === undefined)
    return isSimple ? 'An error occurred' : 'Unknown error';

  const errorString = error instanceof Error ? error.message : error;

  if (isSimple) {
    return getSimpleErrorMessage(errorString);
  }

  // In advanced mode, return the original technical error
  return errorString;
}

/**
 * Format a validation error for display
 */
export function formatValidationError(error: string | null, isSimple: boolean): string | null {
  if (!error) return null;

  if (isSimple) {
    // Simplify common validation errors
    const simplifications: Record<string, string> = {
      'Insufficient balance': 'Not enough tokens',
      'Amount exceeds balance': 'Not enough tokens',
      'Invalid amount': 'Enter a valid amount',
      'Amount required': 'Enter an amount',
      'Exceeds Fixed-Rate Position balance': 'Exceeds available position',
      'Exceeds Variable-Rate Position balance': 'Exceeds available position',
    };

    for (const [key, value] of Object.entries(simplifications)) {
      if (error.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
  }

  return error;
}

/**
 * Get help text based on error type and mode
 */
export function getErrorHelpText(
  error: string | Error | null | undefined,
  isSimple: boolean
): string | null {
  if (error === null || error === undefined) return null;

  const errorString = error instanceof Error ? error.message : error;
  const lowerError = errorString.toLowerCase();

  if (isSimple) {
    // Provide simple help text
    if (lowerError.includes('insufficient') || lowerError.includes('not enough')) {
      return 'You need more tokens to complete this action.';
    }
    if (lowerError.includes('slippage') || lowerError.includes('price')) {
      return 'Market conditions changed. Please try again.';
    }
    if (lowerError.includes('connect') || lowerError.includes('wallet')) {
      return 'Connect your wallet using the button in the top right.';
    }
    if (lowerError.includes('reject') || lowerError.includes('cancel')) {
      return 'You cancelled the transaction in your wallet.';
    }
  } else {
    // Provide technical help text
    if (lowerError.includes('insufficient sy')) {
      return 'Deposit more underlying tokens to increase your SY balance.';
    }
    if (lowerError.includes('slippage')) {
      return 'Increase slippage tolerance or reduce trade size.';
    }
    if (lowerError.includes('price impact')) {
      return 'Consider splitting into smaller trades to reduce impact.';
    }
  }

  return null;
}
