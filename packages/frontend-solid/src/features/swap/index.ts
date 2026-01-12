// Swap feature barrel export

// Model (hooks and types)
export {
  useSwap,
  calculateMinOutput,
  calculateMaxInput,
  type SwapDirection,
  type SwapParams,
  type SwapResult,
  type UseSwapReturn,
} from './model/useSwap';

// Lib (pure logic functions)
export {
  // Direction derivation
  deriveSwapDirection,
  // Swap quote calculation
  calculateSwapQuote,
  // Call building
  buildSwapCalls,
  // Transaction steps
  getTransactionSteps,
  // Button state derivation
  deriveButtonState,
  // Token labels
  deriveTokenLabels,
  getInputTokenAddress,
  // Output badge styling
  deriveOutputBadgeStyle,
  // Implied APY display
  deriveImpliedApyDisplay,
  // Swap rate display
  formatSwapRate,
  // UI state derivation
  deriveSwapFormUiState,
  // Token type utilities
  getTokenTypeDescription,
  isValidTokenType,
  isValidBuySell,
  // Types
  type TokenType,
  type SwapFormMarket,
  type SwapFormState,
  type ButtonState,
  type OutputBadgeStyle,
  type ImpliedApyDisplay,
  type SwapFormUiState,
} from './lib/swapFormLogic';

// UI (components)
export { SwapForm, type SwapFormProps } from './ui/SwapForm';
export { SwapDetails, type SwapDetailsProps } from './ui/SwapDetails';
