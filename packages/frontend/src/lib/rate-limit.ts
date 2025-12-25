/**
 * Rate limiting for API routes using Upstash Redis
 *
 * Uses @upstash/ratelimit with Redis for distributed rate limiting
 * that works across Vercel serverless functions and edge runtime.
 *
 * Setup:
 * 1. Create a free Redis database at https://console.upstash.com
 * 2. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env
 *
 * ASVS Control: V11.1.4 - Rate Limiting
 * OWASP Top 10: A04:2021 - Insecure Design
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

/**
 * Rate limit configuration presets
 */
export const RateLimitConfig = {
  /** RPC proxy - stricter limits due to external API cost */
  RPC: { requests: 60, window: '1m' as const },
  /** Public data endpoints (markets, analytics) */
  PUBLIC: { requests: 100, window: '1m' as const },
  /** User-specific endpoints (positions, history) */
  USER: { requests: 100, window: '1m' as const },
  /** Health check endpoint - very permissive */
  HEALTH: { requests: 300, window: '1m' as const },
} as const;

export type RateLimitConfigKey = keyof typeof RateLimitConfig;

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// Lazy-initialize Redis client to avoid errors when env vars are missing
let redis: Redis | null = null;
let ratelimitInstances: Map<string, Ratelimit> | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

function getRatelimiter(config: RateLimitConfigKey): Ratelimit | null {
  const redisClient = getRedis();
  if (!redisClient) return null;

  ratelimitInstances ??= new Map();

  if (!ratelimitInstances.has(config)) {
    const { requests, window } = RateLimitConfig[config];
    const limiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix: `horizon:ratelimit:${config.toLowerCase()}`,
      analytics: true,
    });
    ratelimitInstances.set(config, limiter);
  }

  return ratelimitInstances.get(config) ?? null;
}

/**
 * Check rate limit for a request
 *
 * @param identifier - Unique identifier for rate limiting (e.g., IP address)
 * @param config - Rate limit configuration key
 * @returns Rate limit result with success status and metadata
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfigKey
): Promise<RateLimitResult> {
  const limiter = getRatelimiter(config);

  // If Redis is not configured, allow all requests (development mode)
  if (!limiter) {
    const { requests } = RateLimitConfig[config];
    return {
      success: true,
      limit: requests,
      remaining: requests - 1,
      reset: Date.now() + 60_000,
    };
  }

  const result = await limiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Rate limit headers as a record type
 */
interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
}

/**
 * Get rate limit headers for a response
 */
export function getRateLimitHeaders(result: RateLimitResult): RateLimitHeaders {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
  };
}

/**
 * Create a 429 Too Many Requests response with proper headers
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);

  return NextResponse.json(
    {
      error: 'Too many requests',
      retryAfter,
    },
    {
      status: 429,
      headers: {
        ...getRateLimitHeaders(result),
        'Retry-After': String(Math.max(1, retryAfter)),
      },
    }
  );
}

/**
 * Extract client identifier from request
 *
 * Uses x-forwarded-for header (set by Vercel/CDNs) with fallback.
 */
export function getClientIdentifier(request: Request): string {
  // x-forwarded-for contains comma-separated list, first is client IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const clientIp = forwarded.split(',')[0]?.trim();
    if (clientIp) {
      return clientIp;
    }
  }

  // Fallback headers
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'anonymous';
}

/**
 * Apply rate limiting to a request
 *
 * Returns a 429 response if rate limited, null otherwise.
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
 *   if (rateLimitResult) return rateLimitResult;
 *
 *   // ... handle request
 * }
 * ```
 */
export async function applyRateLimit(
  request: Request,
  config: RateLimitConfigKey
): Promise<NextResponse | null> {
  const identifier = getClientIdentifier(request);
  const result = await checkRateLimit(identifier, config);

  if (!result.success) {
    return rateLimitResponse(result);
  }

  return null;
}

/**
 * Add rate limit headers to a response
 */
export function withRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  const headers = getRateLimitHeaders(result);
  response.headers.set('X-RateLimit-Limit', headers['X-RateLimit-Limit']);
  response.headers.set('X-RateLimit-Remaining', headers['X-RateLimit-Remaining']);
  response.headers.set('X-RateLimit-Reset', headers['X-RateLimit-Reset']);
  return response;
}
