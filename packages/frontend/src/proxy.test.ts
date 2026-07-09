import { describe, expect, test } from 'bun:test';
import { CSP_HEADER, CSP_NONCE_HEADER } from '@shared/server/csp';
import { NextRequest } from 'next/server';

import { proxy } from './proxy';

function createRequest(pathname: string): NextRequest {
  return new NextRequest(`https://splityield.org${pathname}`);
}

describe('proxy', () => {
  test('sets CSP nonce and hardening headers on page responses', () => {
    const response = proxy(createRequest('/pools'));
    const nonce = response.headers.get(CSP_NONCE_HEADER);

    expect(nonce).toBeTruthy();
    expect(response.headers.get('Content-Security-Policy')).toContain('script-src');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()'
    );
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('x-request-time')).toBeTruthy();
  });

  test('forwards the nonce through middleware request headers for the app layout', () => {
    const response = proxy(createRequest('/trade'));
    const nonce = response.headers.get(CSP_NONCE_HEADER);
    const csp = response.headers.get(CSP_HEADER);

    expect(response.headers.get(`x-middleware-request-${CSP_NONCE_HEADER}`)).toBe(nonce);
    expect(response.headers.get(`x-middleware-request-${CSP_HEADER.toLowerCase()}`)).toBe(csp);
    expect(response.headers.get('x-middleware-override-headers')).toContain(
      CSP_HEADER.toLowerCase()
    );
    expect(response.headers.get('x-middleware-override-headers')).toContain(CSP_NONCE_HEADER);
  });

  test('keeps security headers on legacy redirects', () => {
    const response = proxy(createRequest('/markets'));

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://splityield.org/pools');
    expect(response.headers.get(CSP_NONCE_HEADER)).toBeTruthy();
    expect(response.headers.get('Content-Security-Policy')).toContain('script-src');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });
});
