import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
  const response = NextResponse.next();

  // Add request timing header for performance monitoring
  response.headers.set('x-request-time', Date.now().toString());

  // Add request ID for tracing (useful for debugging)
  const requestId = crypto.randomUUID();
  response.headers.set('x-request-id', requestId);

  // Legacy route redirects
  // Redirect old paths to new ones for backwards compatibility
  const { pathname } = request.nextUrl;

  // Redirect /markets to /pools (markets is now called pools)
  if (pathname === '/markets') {
    return NextResponse.redirect(new URL('/pools', request.url), 301);
  }

  // Redirect /stake to /mint (stake is now called mint)
  if (pathname === '/stake') {
    return NextResponse.redirect(new URL('/mint', request.url), 301);
  }

  // Redirect /dashboard to /portfolio
  if (pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/portfolio', request.url), 301);
  }

  // Redirect /earn to /pools (alternative naming)
  if (pathname === '/earn') {
    return NextResponse.redirect(new URL('/pools', request.url), 301);
  }

  // Redirect /swap to /trade (alternative naming)
  if (pathname === '/swap') {
    return NextResponse.redirect(new URL('/trade', request.url), 301);
  }

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
