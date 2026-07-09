/**
 * Content Security Policy utilities
 *
 * Provides nonce-based CSP for enhanced XSS protection.
 * The nonce is generated per-request in middleware and passed via headers.
 */

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

interface BuildCSPOptions {
  isProduction?: boolean;
}

/**
 * Generate a cryptographically secure nonce for CSP
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  let binary = '';
  for (const byte of array) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Build Content Security Policy header value with nonce
 *
 * @param nonce - The cryptographic nonce for inline scripts
 * @returns The complete CSP header value
 */
export function buildCSP(nonce: string, options: BuildCSPOptions = {}): string {
  // In development, Next.js injects inline scripts that don't have nonces.
  // When a nonce is present, 'unsafe-inline' is ignored in modern browsers.
  // So in dev mode, we skip the nonce entirely and use 'unsafe-inline' + 'unsafe-eval'.
  // In production, we use strict nonce-based CSP with 'strict-dynamic'.
  //
  // snaps.consensys.io is needed for MetaMask Snaps wallet discovery
  const isProduction = options.isProduction ?? isProductionEnvironment();
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
export const CSP_HEADER = 'Content-Security-Policy';

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
} as const;

/**
 * Apply CSP and baseline browser hardening headers to page responses.
 */
export function applySecurityHeaders(headers: Headers, nonce: string, csp = buildCSP(nonce)): void {
  headers.set(CSP_HEADER, csp);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
}
