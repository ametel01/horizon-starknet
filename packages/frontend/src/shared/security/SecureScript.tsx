'use client';

import Script, { type ScriptProps } from 'next/script';

import { useNonce } from './NonceProvider';

/**
 * Known external scripts with their SRI hashes
 *
 * To add a new script:
 * 1. Download the script: curl -s https://example.com/script.js > /tmp/script.js
 * 2. Generate hash: openssl dgst -sha384 -binary /tmp/script.js | openssl base64 -A
 * 3. Add entry below with format: 'sha384-<hash>'
 */
const SRI_HASHES: Record<string, string> = {
  // Example:
  // 'https://cdn.example.com/lib@1.0.0/script.js': 'sha384-abc123...',
};

interface SecureScriptProps extends Omit<ScriptProps, 'nonce'> {
  /**
   * The URL of the external script.
   * Must have an SRI hash registered in SRI_HASHES.
   */
  src: string;
  /**
   * Override SRI hash (use only for dynamically versioned scripts)
   */
  integrity?: string;
}

/**
 * Secure external script loader with SRI and CSP nonce support
 *
 * This component enforces:
 * - Subresource Integrity (SRI) for all external scripts
 * - CSP nonce for inline script execution
 * - Crossorigin attribute for SRI to work
 *
 * @example
 * ```tsx
 * // Script must be registered in SRI_HASHES
 * <SecureScript src="https://cdn.example.com/lib.js" strategy="afterInteractive" />
 *
 * // Or provide integrity directly
 * <SecureScript
 *   src="https://cdn.example.com/lib.js"
 *   integrity="sha384-abc123..."
 *   strategy="afterInteractive"
 * />
 * ```
 *
 * @throws Error if script src is not in SRI_HASHES and no integrity prop provided
 */
export function SecureScript({ src, integrity, ...props }: SecureScriptProps): React.ReactNode {
  const nonce = useNonce();

  // Get SRI hash from registry or props
  const sriHash = integrity ?? SRI_HASHES[src];

  if (!sriHash) {
    // In development, warn but don't block
    if (process.env.NODE_ENV === 'development') {
    } else {
      // In production, throw error to prevent loading unverified scripts
      throw new Error(
        `SecureScript: No SRI hash registered for "${src}". ` +
          'External scripts must have integrity verification.'
      );
    }
  }

  return <Script src={src} nonce={nonce} integrity={sriHash} crossOrigin="anonymous" {...props} />;
}

/**
 * Generate SRI hash for a script URL
 *
 * Usage (in terminal):
 * ```bash
 * curl -s "https://cdn.example.com/script.js" | openssl dgst -sha384 -binary | openssl base64 -A
 * ```
 *
 * Then add the result prefixed with 'sha384-' to SRI_HASHES
 */
export function generateSRICommand(url: string): string {
  return `curl -s "${url}" | openssl dgst -sha384 -binary | openssl base64 -A`;
}
