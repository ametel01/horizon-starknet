/**
 * Cache utilities for API routes
 *
 * Provides consistent cache headers for CDN-level caching.
 * Uses stale-while-revalidate pattern for optimal performance.
 *
 * ASVS Control: V14.4.5 - Cache Control
 * All responses include Vary: Accept-Encoding to prevent cache poisoning.
 */

/**
 * Cache duration presets (in seconds)
 */
export const CacheDuration = {
  /** Real-time data that changes frequently (30s cache, 2min stale) */
  SHORT: { maxAge: 30, staleWhileRevalidate: 120 },
  /** Analytics data that updates periodically (60s cache, 5min stale) */
  MEDIUM: { maxAge: 60, staleWhileRevalidate: 300 },
  /** Historical data that rarely changes (5min cache, 1hr stale) */
  LONG: { maxAge: 300, staleWhileRevalidate: 3600 },
  /** Static content (1hr cache, 24hr stale) */
  STATIC: { maxAge: 3600, staleWhileRevalidate: 86400 },
} as const;

export type CacheDurationKey = keyof typeof CacheDuration;

/**
 * Generate Cache-Control header value for API responses.
 *
 * Uses the stale-while-revalidate pattern:
 * - s-maxage: How long CDN caches the response
 * - stale-while-revalidate: How long to serve stale content while revalidating
 *
 * @example
 * ```ts
 * return NextResponse.json(data, {
 *   headers: getCacheHeaders('MEDIUM'),
 * });
 * ```
 */
export function getCacheHeaders(
  duration: CacheDurationKey | { maxAge: number; staleWhileRevalidate: number }
): HeadersInit {
  const { maxAge, staleWhileRevalidate } =
    typeof duration === 'string' ? CacheDuration[duration] : duration;

  return {
    'Cache-Control': `public, s-maxage=${String(maxAge)}, stale-while-revalidate=${String(staleWhileRevalidate)}`,
    Vary: 'Accept-Encoding',
  };
}

/**
 * No-cache headers for dynamic or user-specific data.
 */
export function getNoCacheHeaders(): HeadersInit {
  return {
    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    Vary: 'Accept-Encoding',
  };
}
