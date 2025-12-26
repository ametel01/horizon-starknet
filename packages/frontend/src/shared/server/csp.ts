/**
 * Content Security Policy utilities
 *
 * Provides nonce-based CSP for enhanced XSS protection.
 * The nonce is generated per-request in middleware and passed via headers.
 */

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Generate a cryptographically secure nonce for CSP
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64');
}

/**
 * Build Content Security Policy header value with nonce
 *
 * @param nonce - The cryptographic nonce for inline scripts
 * @returns The complete CSP header value
 */
export function buildCSP(nonce: string): string {
  // In development, Next.js injects inline scripts that don't have nonces.
  // When a nonce is present, 'unsafe-inline' is ignored in modern browsers.
  // So in dev mode, we skip the nonce entirely and use 'unsafe-inline' + 'unsafe-eval'.
  // In production, we use strict nonce-based CSP with 'strict-dynamic'.
  //
  // snaps.consensys.io is needed for MetaMask Snaps wallet discovery
  const scriptSrc = isProduction
    ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", 'https://snaps.consensys.io']
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://snaps.consensys.io'];

  const policy = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for Tailwind CSS and dynamic styling
    ],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      // Wallet discovery and connections
      'https://*.starknet.io',
      'wss://*.starknet.io',
      // MetaMask Snaps for Starknet wallet
      'https://snaps.consensys.io',
      // RPC providers (for wallet direct connections)
      'https://*.alchemy.com',
      'wss://*.alchemy.com',
      // Block explorer
      'https://*.voyager.online',
      // Swap routing
      'https://*.avnu.fi',
      // Oracle
      'https://api.pragma.build',
      // Error tracking
      'https://*.sentry.io',
      // Dev: HMR WebSocket
      ...(isProduction ? [] : ['ws://localhost:*']),
    ],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    ...(isProduction && { 'upgrade-insecure-requests': [] }),
  };

  return Object.entries(policy)
    .map(([key, values]) => {
      if (values.length === 0) return key;
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Header name used to pass the nonce from middleware to the app
 */
export const CSP_NONCE_HEADER = 'x-csp-nonce';
