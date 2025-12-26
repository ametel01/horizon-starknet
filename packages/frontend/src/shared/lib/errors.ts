/**
 * Error Message Utility
 *
 * Provides mode-aware error messages that are user-friendly in simple mode
 * and technical in advanced mode.
 *
 * @see Security Audit I-01 - Standardized Error Prefixes
 * All contract errors now use "HZN:" prefix for consistent parsing.
 */

// ============================================================================
// Contract Error Codes (HZN: prefix)
// Matches errors.cairo definitions
// ============================================================================

/**
 * Mapping of HZN: prefixed contract error codes to user-friendly messages
 */
const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  // General errors
  'HZN: zero address': 'Invalid address provided.',
  'HZN: zero amount': 'Amount cannot be zero.',
  'HZN: unauthorized': 'You are not authorized to perform this action.',

  // SY errors
  'HZN: zero deposit': 'Deposit amount cannot be zero.',
  'HZN: zero redeem': 'Redeem amount cannot be zero.',
  'HZN: insufficient balance': 'Insufficient token balance.',

  // PT errors
  'HZN: only YT': 'Only the YT contract can perform this action.',
  'HZN: only deployer': 'Only the deployer can perform this action.',
  'HZN: YT not set': 'YT contract not configured.',
  'HZN: YT already set': 'YT contract already configured.',
  'HZN: invalid expiry': 'Invalid expiry date.',

  // YT errors
  'HZN: expired': 'This position has expired.',
  'HZN: not expired': 'This position has not yet expired.',
  'HZN: insufficient PT': 'Insufficient PT balance.',
  'HZN: insufficient YT': 'Insufficient YT balance.',
  'HZN: insufficient SY': 'Insufficient SY balance.',

  // Market errors
  'HZN: market expired': 'This market has expired.',
  'HZN: insufficient liquidity': 'Not enough liquidity in the market.',
  'HZN: slippage exceeded': 'Price moved beyond slippage tolerance. Try again.',
  'HZN: zero liquidity': 'Market has no liquidity.',
  'HZN: invalid reserves': 'Invalid market reserves.',
  'HZN: transfer failed': 'Token transfer failed.',

  // Market Factory errors
  'HZN: market already exists': 'A market for this pair already exists.',
  'HZN: market deploy failed': 'Failed to deploy market.',
  'HZN: index out of bounds': 'Invalid market index.',
  'HZN: invalid scalar': 'Invalid market scalar parameter.',
  'HZN: invalid anchor': 'Invalid market anchor parameter.',
  'HZN: invalid fee': 'Invalid fee rate.',

  // Router errors
  'HZN: deadline exceeded': 'Transaction deadline exceeded. Please try again.',

  // Math errors
  'HZN: overflow': 'Calculation overflow. Try a smaller amount.',
  'HZN: underflow': 'Calculation underflow. Try a larger amount.',
  'HZN: division by zero': 'Invalid calculation. Please try different values.',

  // Factory errors
  'HZN: pair already exists': 'This token pair already exists.',
  'HZN: deploy failed': 'Failed to deploy contract.',

  // RBAC errors
  'HZN: RBAC already init': 'Access control already initialized.',

  // Oracle errors
  'HZN: zero admin': 'Invalid admin address.',
  'HZN: zero oracle': 'Invalid oracle address.',
  'HZN: zero numerator pair': 'Invalid price pair.',
  'HZN: invalid initial index': 'Invalid initial index value.',
  'HZN: not admin': 'Admin privileges required.',
  'HZN: paused': 'This operation is currently paused.',
  'HZN: window too short': 'TWAP window is too short.',
  'HZN: staleness < window': 'Invalid staleness configuration.',
  'HZN: zero denom price': 'Invalid denominator price.',
  'HZN: index below WAD': 'Index value is too low.',
};

/**
 * Simple (user-friendly) versions of contract errors
 * Used in simple mode for non-technical users
 */
const CONTRACT_ERROR_SIMPLE: Record<string, string> = {
  'HZN: zero address': 'Something went wrong. Please try again.',
  'HZN: zero amount': 'Please enter an amount.',
  'HZN: unauthorized': 'You cannot perform this action.',
  'HZN: insufficient balance': 'Not enough tokens.',
  'HZN: zero deposit': 'Please enter an amount to deposit.',
  'HZN: zero redeem': 'Please enter an amount to withdraw.',
  'HZN: insufficient PT': 'Not enough Fixed-Rate Position.',
  'HZN: insufficient YT': 'Not enough Variable-Rate Position.',
  'HZN: insufficient SY': 'Not enough deposited tokens.',
  'HZN: expired': 'This position has matured.',
  'HZN: not expired': 'Position is still active.',
  'HZN: market expired': 'This market has matured.',
  'HZN: insufficient liquidity': 'Not enough funds in the pool.',
  'HZN: slippage exceeded': 'Price changed too much. Please try again.',
  'HZN: zero liquidity': 'Pool is empty.',
  'HZN: transfer failed': 'Token transfer failed. Please try again.',
  'HZN: deadline exceeded': 'Transaction took too long. Please try again.',
  'HZN: overflow': 'Amount is too large.',
  'HZN: underflow': 'Amount is too small.',
  'HZN: division by zero': 'Invalid calculation. Please try again.',
  'HZN: paused': 'Temporarily unavailable for maintenance.',
};

/**
 * Extract HZN: error code from an error message or object
 * Handles various error formats from Starknet transactions
 */
export function extractContractError(error: unknown): string | null {
  if (error === null || error === undefined) {
    return null;
  }

  // Convert to string for searching
  let errorString: string;
  if (error instanceof Error) {
    errorString = error.message;
  } else if (typeof error === 'string') {
    errorString = error;
  } else if (typeof error === 'object') {
    // Handle Starknet error objects which may have nested structure
    try {
      errorString = JSON.stringify(error);
    } catch {
      errorString = '[object Object]';
    }
  } else if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
    errorString = String(error);
  } else {
    // For symbols, functions, etc.
    errorString = '[unknown error type]';
  }

  // Match HZN: prefixed errors
  // Pattern matches "HZN: " followed by any text until end of string or quote/bracket
  const hznPattern = /HZN:\s*[^"'\]}\n]+/;
  const hznMatch = hznPattern.exec(errorString);
  if (hznMatch) {
    // Clean up the matched error code
    return hznMatch[0].trim();
  }

  return null;
}

/**
 * Parse a contract error and return a user-friendly message
 * @param error - The error to parse (can be Error, string, or unknown object)
 * @param isSimple - Whether to use simple (non-technical) messages
 * @returns User-friendly error message
 */
export function parseContractError(error: unknown, isSimple = false): string {
  const hznError = extractContractError(error);

  if (hznError) {
    // Use simple or technical message based on mode
    const messageMap = isSimple ? CONTRACT_ERROR_SIMPLE : CONTRACT_ERROR_MESSAGES;
    const message = messageMap[hznError];

    if (message) {
      return message;
    }

    // If we found an HZN error but don't have a mapping, format it nicely
    return isSimple ? 'Something went wrong. Please try again.' : `Contract error: ${hznError}`;
  }

  // Fallback to generic message
  return isSimple ? 'Something went wrong. Please try again.' : 'An unexpected error occurred.';
}

/**
 * Check if an error is a specific HZN error type
 */
export function isContractError(error: unknown, errorCode: string): boolean {
  const hznError = extractContractError(error);
  return hznError === errorCode;
}

/**
 * Check if error is a deadline exceeded error
 */
export function isDeadlineError(error: unknown): boolean {
  return isContractError(error, 'HZN: deadline exceeded');
}

/**
 * Check if error is a slippage exceeded error
 */
export function isSlippageError(error: unknown): boolean {
  const hznError = extractContractError(error);
  return hznError === 'HZN: slippage exceeded';
}

/**
 * Check if error is a pause-related error
 */
export function isPauseError(error: unknown): boolean {
  return isContractError(error, 'HZN: paused');
}

/**
 * Check if error is an insufficient balance error
 */
export function isInsufficientBalanceError(error: unknown): boolean {
  const hznError = extractContractError(error);
  if (!hznError) return false;
  return (
    hznError === 'HZN: insufficient balance' ||
    hznError === 'HZN: insufficient PT' ||
    hznError === 'HZN: insufficient YT' ||
    hznError === 'HZN: insufficient SY'
  );
}

// ============================================================================
// Legacy Error Handling (for non-contract errors)
// ============================================================================

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

  // First, check for HZN: contract errors
  const hznError = extractContractError(error);
  if (hznError) {
    const contractMessage = CONTRACT_ERROR_SIMPLE[hznError];
    if (contractMessage) {
      return contractMessage;
    }
  }

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

  // First, check for HZN: contract errors
  const hznError = extractContractError(error);
  if (hznError) {
    const messageMap = isSimple ? CONTRACT_ERROR_SIMPLE : CONTRACT_ERROR_MESSAGES;
    const contractMessage = messageMap[hznError];
    if (contractMessage) {
      return contractMessage;
    }
    // If no mapping, show the raw error in advanced mode
    if (!isSimple) {
      return `Contract error: ${hznError}`;
    }
  }

  const errorString = error instanceof Error ? error.message : error;

  if (isSimple) {
    return getSimpleErrorMessage(errorString);
  }

  // In advanced mode, return the original technical error
  return errorString;
}

/**
 * Validation error simplifications (at module scope for better performance)
 */
const validationSimplifications: Record<string, string> = {
  'Insufficient balance': 'Not enough tokens',
  'Amount exceeds balance': 'Not enough tokens',
  'Invalid amount': 'Enter a valid amount',
  'Amount required': 'Enter an amount',
  'Exceeds Fixed-Rate Position balance': 'Exceeds available position',
  'Exceeds Variable-Rate Position balance': 'Exceeds available position',
};

/**
 * Format a validation error for display
 */
export function formatValidationError(error: string | null, isSimple: boolean): string | null {
  if (!error) return null;

  if (isSimple) {
    for (const [key, value] of Object.entries(validationSimplifications)) {
      if (error.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
  }

  return error;
}

/**
 * Help text for specific HZN: errors
 */
const CONTRACT_ERROR_HELP: Record<string, { simple: string; advanced: string }> = {
  'HZN: slippage exceeded': {
    simple: 'Market conditions changed. Please try again.',
    advanced: 'Increase slippage tolerance or reduce trade size.',
  },
  'HZN: deadline exceeded': {
    simple: 'The transaction took too long to process.',
    advanced: 'Increase deadline duration in settings or try during lower network congestion.',
  },
  'HZN: insufficient liquidity': {
    simple: 'Not enough funds available in the pool.',
    advanced: 'Reduce trade size or wait for more liquidity to be added.',
  },
  'HZN: insufficient balance': {
    simple: 'You need more tokens to complete this action.',
    advanced: 'Ensure you have sufficient token balance for this operation.',
  },
  'HZN: insufficient SY': {
    simple: 'You need to deposit more tokens first.',
    advanced: 'Deposit more underlying tokens to increase your SY balance.',
  },
  'HZN: insufficient PT': {
    simple: 'Not enough Fixed-Rate Position available.',
    advanced: 'Your PT balance is insufficient. Mint more PT+YT or acquire PT from the market.',
  },
  'HZN: insufficient YT': {
    simple: 'Not enough Variable-Rate Position available.',
    advanced: 'Your YT balance is insufficient. Mint more PT+YT or acquire YT from the market.',
  },
  'HZN: paused': {
    simple: 'The protocol is temporarily paused for maintenance.',
    advanced: 'The contract is paused. Check announcements for maintenance updates.',
  },
  'HZN: market expired': {
    simple: 'This market has matured. You can redeem your position.',
    advanced: 'Market is expired. Use post-expiry redemption to withdraw.',
  },
  'HZN: overflow': {
    simple: 'The amount is too large to process.',
    advanced: 'Reduce the amount to prevent arithmetic overflow.',
  },
};

/**
 * Get help text based on error type and mode
 */
export function getErrorHelpText(
  error: string | Error | null | undefined,
  isSimple: boolean
): string | null {
  if (error === null || error === undefined) return null;

  // First, check for HZN: contract errors
  const hznError = extractContractError(error);
  if (hznError) {
    const helpText = CONTRACT_ERROR_HELP[hznError];
    if (helpText) {
      return isSimple ? helpText.simple : helpText.advanced;
    }
  }

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
