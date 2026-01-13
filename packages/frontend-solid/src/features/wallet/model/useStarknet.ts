import { useContext } from 'solid-js';
import { StarknetContext, type StarknetContextValue } from '@/providers/StarknetProvider';

/**
 * Hook to access the Starknet context.
 * Must be used within a StarknetProvider.
 *
 * @returns The Starknet context value containing provider, wallet state, and actions
 * @throws Error if used outside of StarknetProvider
 */
export function useStarknet(): StarknetContextValue {
  const context = useContext(StarknetContext);
  if (!context) {
    throw new Error('useStarknet must be used within a StarknetProvider');
  }
  return context;
}
