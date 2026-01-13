import { useContext } from 'solid-js';
import { TransactionSettingsContext, type TransactionSettingsContextValue } from '@/providers';

/**
 * Hook to access transaction settings context.
 *
 * Provides reactive access to slippage and deadline settings for transactions.
 * Must be used within a TransactionSettingsProvider.
 *
 * @throws Error if used outside TransactionSettingsProvider
 * @returns Transaction settings context value
 */
export function useTransactionSettings(): TransactionSettingsContextValue {
  const context = useContext(TransactionSettingsContext);
  if (!context) {
    throw new Error('useTransactionSettings must be used within a TransactionSettingsProvider');
  }
  return context;
}
