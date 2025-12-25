'use client';

import { createContext, useContext } from 'react';

/**
 * Context for CSP nonce
 *
 * The nonce is generated per-request in middleware and passed to the app
 * via headers. Components that need to inject inline scripts should use
 * this context to get the nonce.
 */
const NonceContext = createContext<string | undefined>(undefined);

interface NonceProviderProps {
  nonce: string | undefined;
  children: React.ReactNode;
}

export function NonceProvider({ nonce, children }: NonceProviderProps): React.ReactNode {
  return <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>;
}

/**
 * Hook to get the CSP nonce for inline scripts
 *
 * @returns The CSP nonce or undefined if not available
 *
 * @example
 * ```tsx
 * const nonce = useNonce();
 * return <script nonce={nonce}>...</script>;
 * ```
 */
export function useNonce(): string | undefined {
  return useContext(NonceContext);
}
