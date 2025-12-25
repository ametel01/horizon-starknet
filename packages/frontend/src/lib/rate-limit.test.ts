import { describe, expect, test, beforeEach } from 'bun:test';

import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
  rateLimitResponse,
  RateLimitConfig,
} from './rate-limit';

// Mock Upstash Redis to test without actual connection
beforeEach(() => {
  // Reset environment to ensure consistent test behavior
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe('rate-limit', () => {
  describe('RateLimitConfig', () => {
    test('has correct presets for RPC', () => {
      expect(RateLimitConfig.RPC.requests).toBe(60);
      expect(RateLimitConfig.RPC.window).toBe('1m');
    });

    test('has correct presets for PUBLIC', () => {
      expect(RateLimitConfig.PUBLIC.requests).toBe(100);
      expect(RateLimitConfig.PUBLIC.window).toBe('1m');
    });

    test('has correct presets for USER', () => {
      expect(RateLimitConfig.USER.requests).toBe(100);
      expect(RateLimitConfig.USER.window).toBe('1m');
    });

    test('has correct presets for HEALTH', () => {
      expect(RateLimitConfig.HEALTH.requests).toBe(300);
      expect(RateLimitConfig.HEALTH.window).toBe('1m');
    });
  });

  describe('checkRateLimit', () => {
    test('allows requests when Redis is not configured (development mode)', async () => {
      const result = await checkRateLimit('test-ip', 'PUBLIC');

      expect(result.success).toBe(true);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(99);
      expect(result.reset).toBeGreaterThan(Date.now());
    });

    test('uses correct limit for each config', async () => {
      const rpcResult = await checkRateLimit('test-ip', 'RPC');
      expect(rpcResult.limit).toBe(60);

      const publicResult = await checkRateLimit('test-ip', 'PUBLIC');
      expect(publicResult.limit).toBe(100);

      const healthResult = await checkRateLimit('test-ip', 'HEALTH');
      expect(healthResult.limit).toBe(300);
    });
  });

  describe('getClientIdentifier', () => {
    test('extracts IP from x-forwarded-for header', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '203.0.113.50, 70.41.3.18, 150.172.238.178',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('203.0.113.50');
    });

    test('handles single IP in x-forwarded-for', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('192.168.1.1');
    });

    test('falls back to x-real-ip header', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-real-ip': '10.0.0.1',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('10.0.0.1');
    });

    test('returns anonymous when no IP headers present', () => {
      const request = new Request('http://localhost/api/test');

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('anonymous');
    });

    test('trims whitespace from IP addresses', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '  203.0.113.50  ,  70.41.3.18  ',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('203.0.113.50');
    });
  });

  describe('getRateLimitHeaders', () => {
    test('returns correct headers', () => {
      const result = {
        success: true,
        limit: 100,
        remaining: 95,
        reset: 1704067200000, // 2024-01-01 00:00:00 UTC
      };

      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('95');
      expect(headers['X-RateLimit-Reset']).toBe('1704067200');
    });

    test('handles zero remaining correctly', () => {
      const result = {
        success: false,
        limit: 60,
        remaining: 0,
        reset: Date.now() + 60000,
      };

      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe('60');
      expect(headers['X-RateLimit-Remaining']).toBe('0');
    });
  });

  describe('rateLimitResponse', () => {
    test('returns 429 status', () => {
      const result = {
        success: false,
        limit: 100,
        remaining: 0,
        reset: Date.now() + 60000,
      };

      const response = rateLimitResponse(result);

      expect(response.status).toBe(429);
    });

    test('includes Retry-After header', () => {
      const now = Date.now();
      const result = {
        success: false,
        limit: 100,
        remaining: 0,
        reset: now + 30000, // 30 seconds from now
      };

      const response = rateLimitResponse(result);

      const retryAfter = response.headers.get('Retry-After');
      expect(retryAfter).not.toBeNull();
      expect(parseInt(retryAfter ?? '0', 10)).toBeGreaterThanOrEqual(1);
    });

    test('includes rate limit headers', () => {
      const result = {
        success: false,
        limit: 100,
        remaining: 0,
        reset: Date.now() + 60000,
      };

      const response = rateLimitResponse(result);

      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).not.toBeNull();
    });

    test('returns correct JSON body', async () => {
      const result = {
        success: false,
        limit: 100,
        remaining: 0,
        reset: Date.now() + 30000,
      };

      const response = rateLimitResponse(result);
      const body = (await response.json()) as { error: string; retryAfter: number };

      expect(body.error).toBe('Too many requests');
      expect(body.retryAfter).toBeGreaterThanOrEqual(1);
    });

    test('ensures minimum Retry-After of 1 second', () => {
      const result = {
        success: false,
        limit: 100,
        remaining: 0,
        reset: Date.now() - 1000, // Already expired
      };

      const response = rateLimitResponse(result);

      const retryAfter = response.headers.get('Retry-After');
      expect(parseInt(retryAfter ?? '0', 10)).toBe(1);
    });
  });
});
