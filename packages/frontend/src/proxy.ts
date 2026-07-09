import {
  applySecurityHeaders,
  buildCSP,
  CSP_HEADER,
  CSP_NONCE_HEADER,
  generateNonce,
} from '@shared/server/csp';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Next.js Proxy (formerly Middleware)
 *
 * Runs on Node.js runtime for every matched request.
 * Use for lightweight request processing like:
 * - Request timing headers
 * - Route redirects
 * - Geo-based routing
 *
 * Note: Authentication should be done in Layouts or Route Handlers, not here.
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const csp = buildCSP(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_HEADER, csp);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);

  let response: NextResponse;

  const buildRedirect = (pathname: string): NextResponse =>
    NextResponse.redirect(new URL(pathname, request.url), 301);

  const { pathname } = request.nextUrl;

  if (pathname === '/markets') {
    response = buildRedirect('/pools');
  } else if (pathname === '/stake') {
    response = buildRedirect('/mint');
  } else if (pathname === '/dashboard') {
    response = buildRedirect('/portfolio');
  } else if (pathname === '/earn') {
    response = buildRedirect('/pools');
  } else if (pathname === '/swap') {
    response = buildRedirect('/trade');
  } else {
    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Add request timing header for performance monitoring
  response.headers.set('x-request-time', Date.now().toString());

  // Add request ID for tracing (useful for debugging)
  const requestId = crypto.randomUUID();
  response.headers.set('x-request-id', requestId);

  response.headers.set(CSP_NONCE_HEADER, nonce);
  applySecurityHeaders(response.headers, nonce, csp);

  return response;
}

export const config = {
  // Match all routes except:
  // - api routes (handled separately)
  // - _next/static (static files)
  // - _next/image (image optimization)
  // - favicon.ico and other static assets
  // - monitoring (Sentry tunnel)
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|monitoring|.*\\..*).*)'],
};
