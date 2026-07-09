import { describe, expect, test } from 'bun:test';

import { applySecurityHeaders, buildCSP, generateNonce } from './csp';

describe('csp', () => {
  test('generates unique base64 nonces', () => {
    const firstNonce = generateNonce();
    const secondNonce = generateNonce();

    expect(firstNonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(atob(firstNonce)).toHaveLength(16);
    expect(firstNonce).not.toBe(secondNonce);
  });

  test('builds production CSP with script nonce and strict dynamic', () => {
    const nonce = 'test-nonce';
    const csp = buildCSP(nonce, { isProduction: true });

    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(csp).toContain('frame-ancestors');
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).not.toContain("'unsafe-eval'");
  });

  test('keeps development CSP compatible with Next.js inline scripts', () => {
    const csp = buildCSP('test-nonce', { isProduction: false });

    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(csp).not.toContain('strict-dynamic');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  test('applies CSP and browser hardening headers', () => {
    const headers = new Headers();

    applySecurityHeaders(headers, 'test-nonce');

    expect(headers.get('Content-Security-Policy')).toContain('script-src');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()'
    );
  });
});
