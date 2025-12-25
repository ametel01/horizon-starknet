/**
 * Security Components
 *
 * This module provides security-focused components for the application.
 *
 * ## CSP Nonce Support
 * - NonceProvider: Provides CSP nonce context to the app
 * - useNonce: Hook to access the current request's nonce
 *
 * ## Subresource Integrity (SRI)
 * - SecureScript: Loads external scripts with SRI verification
 *
 * ## Usage Policy
 *
 * ### External Scripts
 * NEVER use next/script directly for external URLs.
 * Always use SecureScript which enforces SRI.
 *
 * ```tsx
 * // BAD - No SRI verification
 * import Script from 'next/script';
 * <Script src="https://cdn.example.com/lib.js" />
 *
 * // GOOD - SRI enforced
 * import { SecureScript } from '@/components/security';
 * <SecureScript src="https://cdn.example.com/lib.js" />
 * ```
 *
 * ### Inline Scripts
 * Use the nonce from useNonce() hook for inline scripts.
 *
 * ```tsx
 * import { useNonce } from '@/components/security';
 *
 * function MyComponent() {
 *   const nonce = useNonce();
 *   return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: '...' }} />;
 * }
 * ```
 */

export { NonceProvider, useNonce } from './NonceProvider';
export { SecureScript, generateSRICommand } from './SecureScript';
