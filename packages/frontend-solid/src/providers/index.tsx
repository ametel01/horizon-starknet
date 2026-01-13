import type { ParentProps } from 'solid-js';

import { QueryProvider } from './QueryProvider';
import { StarknetProvider } from './StarknetProvider';
import { ThemeProvider } from './ThemeProvider';
import { TransactionSettingsProvider } from './TransactionSettingsProvider';
import { UIModeProvider } from './UIModeProvider';

// Re-export all providers and hooks for convenience
export { QueryProvider } from './QueryProvider';
export {
  StarknetContext,
  type StarknetContextValue,
  StarknetProvider,
  useStarknet,
} from './StarknetProvider';
export {
  type Theme,
  ThemeContext,
  type ThemeContextValue,
  ThemeProvider,
  useTheme,
} from './ThemeProvider';
export {
  DEADLINE_OPTIONS,
  DEFAULT_DEADLINE_MINUTES,
  DEFAULT_SLIPPAGE_BPS,
  formatSlippagePercent,
  getSlippageLabel,
  MAX_DEADLINE_MINUTES,
  MAX_SLIPPAGE_BPS,
  MIN_DEADLINE_MINUTES,
  MIN_SLIPPAGE_BPS,
  SLIPPAGE_OPTIONS,
  type TransactionSettings,
  TransactionSettingsContext,
  type TransactionSettingsContextValue,
  TransactionSettingsProvider,
  useDeadline,
  useSlippageWad,
  useTransactionSettings,
} from './TransactionSettingsProvider';
export {
  type UIMode,
  UIModeContext,
  type UIModeContextValue,
  UIModeProvider,
  type UIModeProviderProps,
  useUIMode,
} from './UIModeProvider';

/**
 * Root Providers component that composes all providers in the correct nesting order.
 *
 * Nesting order (outer to inner):
 * 1. ThemeProvider - No dependencies, needed first for UI rendering
 * 2. QueryProvider - No dependencies on other providers
 * 3. StarknetProvider - May use query client for wallet state caching
 * 4. UIModeProvider - UI state, independent but logically after Starknet
 * 5. TransactionSettingsProvider - May depend on Starknet context for network-specific defaults
 */
export function Providers(props: ParentProps): ReturnType<typeof ThemeProvider> {
  return (
    <ThemeProvider>
      <QueryProvider>
        <StarknetProvider>
          <UIModeProvider>
            <TransactionSettingsProvider>{props.children}</TransactionSettingsProvider>
          </UIModeProvider>
        </StarknetProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
