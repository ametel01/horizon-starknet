# Frontend Improvement Plan

Based on analysis of `NEXT_BEST_PRACTICES.md` against the current `packages/frontend` codebase.

---

## Current State Summary

**Strengths:**
- Next.js 16 with App Router fully adopted
- Strict TypeScript with all checks enabled
- Excellent ESLint/Prettier configuration with zero-warning policy
- React Query for server state, Context for UI state
- shadcn/ui component library
- Tailwind CSS 4 with CSS variables theming
- CI/CD with quality gates and staging/production separation
- MDX-based in-app documentation
- Hydration-safe context providers

**Gaps Identified:**
- ~~Minimal test coverage (1 test file)~~ **DONE: 11 test files, 329 tests (+558%)**
- ~~No error/loading route segments~~ **DONE**
- No structured logging
- No analytics/monitoring integration
- Missing image optimization patterns
- No middleware implementation
- No sitemap/robots.txt

---

## Priority 1: Critical Improvements

### 1.1 Add Route Segment Error Handling ✅ COMPLETED

**Best Practice:** Use `loading.js`, `error.js`, `not-found.js` for UX

**Status:** Implemented on 2025-12-25

**Files Created:**
- [x] `src/app/error.tsx` - Global error boundary with Card UI, error digest display
- [x] `src/app/not-found.tsx` - Custom 404 page with navigation options
- [x] `src/app/loading.tsx` - Global loading state with skeleton cards
- [x] `src/app/trade/error.tsx` - Trade-specific error with context
- [x] `src/app/portfolio/error.tsx` - Portfolio error with reassurance message
- [x] `src/app/pools/error.tsx` - Pools error with LP safety message

---

### 1.2 Expand Test Coverage ✅ COMPLETED

**Best Practice:** Vitest for unit tests, Playwright for E2E

**Status:** Completed on 2025-12-25

**Completed - Utility Function Tests:**
- [x] `lib/math/wad.test.ts` - 50+ tests for WAD fixed-point math
- [x] `lib/deadline.test.ts` - 20+ tests for deadline utilities
- [x] `lib/errors.test.ts` - 40+ tests for error handling

**Completed - Hook Tests:**
- [x] `hooks/useSwap.test.ts` - Slippage calculations (calculateMinOutput, calculateMaxInput)
- [x] `hooks/useMarkets.test.ts` - Address conversion, pagination parsing, statistics
- [x] `hooks/useMint.test.ts` - Mint calculations, Uint256 conversion, validation
- [x] `hooks/useTokenBalance.test.ts` - Balance conversion, felt parsing, allowance checks

**Completed - Component Tests:**
- [x] `components/forms/MintForm.test.ts` - Validation logic, button states, output calculations
- [x] `components/forms/SwapForm.test.ts` - Direction derivation, collateral requirements, input parsing

**Completed - API Route Tests:**
- [x] `app/api/utils.test.ts` - Address normalization, query parsing, volume calculations

**Completed - E2E Tests:**
- [x] Playwright configuration (`playwright.config.ts`)
- [x] `e2e/navigation.spec.ts` - Page navigation, 404 handling, responsive design
- [x] `e2e/markets.spec.ts` - Market display, trade page, pools page, portfolio page

**Completed - CI Integration:**
- [x] Unit tests run in CI (`bun test`)
- [x] E2E tests run in CI with Playwright
- [x] Updated `frontend-ci.yml` with separate test and e2e jobs

**Test Count Summary:**
- Before: 50 tests (1 file)
- After: 329 tests (11 files)
- Increase: +558%

---

### 1.3 Implement Structured Logging

**Best Practice:** Error tracking with Sentry/Datadog

**Current State:** Only `console.error` used

**Action Items:**
- [ ] Install Sentry: `bun add @sentry/nextjs`
- [ ] Configure Sentry instrumentation:
  - `sentry.client.config.ts`
  - `sentry.server.config.ts`
  - `sentry.edge.config.ts`
- [ ] Add to `next.config.ts`:
  ```ts
  const { withSentryConfig } = require('@sentry/nextjs');
  module.exports = withSentryConfig(nextConfig, sentryOptions);
  ```
- [ ] Create error utility with context:
  ```ts
  // src/lib/logger.ts
  import * as Sentry from '@sentry/nextjs';

  export function logError(error: Error, context?: Record<string, unknown>) {
    Sentry.captureException(error, { extra: context });
    console.error(error, context);
  }
  ```
- [ ] Replace all `console.error` calls with `logError`
- [ ] Add environment variable: `SENTRY_DSN`

---

## Priority 2: Performance Optimization

### 2.1 Image Optimization

**Best Practice:** Use `<Image />` component, AVIF/WebP formats

**Current State:** Not consistently using next/image

**Action Items:**
- [ ] Audit all `<img>` tags and replace with `next/image`
- [ ] Configure image formats in `next.config.ts`:
  ```ts
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Add trusted image sources
    ],
  }
  ```
- [ ] Add blur placeholders for hero images
- [ ] Optimize static assets in `/public`:
  - Convert PNGs to WebP where possible
  - Add appropriate dimensions to prevent layout shift

---

### 2.2 ISR for Analytics Pages

**Best Practice:** Leverage ISR with `revalidate`

**Current State:** API routes use `force-dynamic`

**Action Items:**
- [ ] Add revalidation to analytics pages:
  ```tsx
  // src/app/analytics/page.tsx
  export const revalidate = 60; // Revalidate every 60 seconds
  ```
- [ ] Consider ISR for:
  - `/analytics` - Protocol stats (revalidate: 60)
  - `/docs/*` - Documentation (revalidate: 3600)
  - Home page stats (revalidate: 30)
- [ ] Add cache headers to API routes:
  ```ts
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
    },
  });
  ```

---

### 2.3 Route Prefetching

**Best Practice:** Use Link prefetch for navigation

**Current State:** Not explicitly configured

**Action Items:**
- [ ] Audit navigation components in `src/components/layout/`
- [ ] Ensure `next/link` is used with default prefetch behavior
- [ ] Add explicit prefetch for high-traffic routes:
  ```tsx
  <Link href="/trade" prefetch={true}>Trade</Link>
  ```
- [ ] Disable prefetch for rarely-used routes:
  ```tsx
  <Link href="/docs/glossary" prefetch={false}>Glossary</Link>
  ```

---

## Priority 3: Security & SEO

### 3.1 Security Headers

**Best Practice:** CSP, HSTS in next.config.js

**Current State:** No security headers configured

**Action Items:**
- [ ] Add security headers to `next.config.ts`:
  ```ts
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  }
  ```
- [ ] Configure Content Security Policy (CSP) with nonce for scripts
- [ ] Test headers with securityheaders.com

---

### 3.2 SEO: Sitemap & Robots

**Best Practice:** Add for SEO

**Current State:** Not present

**Action Items:**
- [ ] Create `src/app/sitemap.ts`:
  ```ts
  import { MetadataRoute } from 'next';

  export default function sitemap(): MetadataRoute.Sitemap {
    return [
      { url: 'https://splityield.org/', lastModified: new Date(), priority: 1 },
      { url: 'https://splityield.org/trade', lastModified: new Date(), priority: 0.9 },
      { url: 'https://splityield.org/pools', lastModified: new Date(), priority: 0.8 },
      // ... add all public routes
    ];
  }
  ```
- [ ] Create `src/app/robots.ts`:
  ```ts
  import { MetadataRoute } from 'next';

  export default function robots(): MetadataRoute.Robots {
    return {
      rules: { userAgent: '*', allow: '/', disallow: '/api/' },
      sitemap: 'https://splityield.org/sitemap.xml',
    };
  }
  ```
- [ ] Ensure `generateMetadata` is used for all pages

---

### 3.3 API Route Protection

**Best Practice:** Validate with Zod, protect API routes

**Current State:** Basic error handling, no input validation

**Action Items:**
- [ ] Install Zod: `bun add zod`
- [ ] Create validation schemas:
  ```ts
  // src/lib/validations/api.ts
  import { z } from 'zod';

  export const marketQuerySchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
    sortBy: z.enum(['tvl', 'volume', 'expiry']).optional(),
  });
  ```
- [ ] Apply validation in API routes:
  ```ts
  const parsed = marketQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  ```
- [ ] Add rate limiting for public API routes (consider Vercel Edge Config)

---

## Priority 4: Analytics & Monitoring

### 4.1 Vercel Analytics

**Best Practice:** RUM via Vercel Analytics / Web Vitals

**Current State:** No analytics integration

**Action Items:**
- [ ] Enable Vercel Analytics in project settings
- [ ] Install: `bun add @vercel/analytics`
- [ ] Add to layout:
  ```tsx
  // src/app/layout.tsx
  import { Analytics } from '@vercel/analytics/react';

  export default function RootLayout({ children }) {
    return (
      <html>
        <body>
          {children}
          <Analytics />
        </body>
      </html>
    );
  }
  ```
- [ ] Add Speed Insights:
  ```tsx
  import { SpeedInsights } from '@vercel/speed-insights/next';
  // Add <SpeedInsights /> alongside <Analytics />
  ```

---

### 4.2 Custom Event Tracking

**Best Practice:** Track key user actions

**Action Items:**
- [ ] Create analytics utility:
  ```ts
  // src/lib/analytics.ts
  import { track } from '@vercel/analytics';

  export const trackEvent = {
    walletConnected: (address: string) => track('wallet_connected', { address: address.slice(0, 10) }),
    mintCompleted: (market: string, amount: string) => track('mint_completed', { market, amount }),
    swapCompleted: (market: string, direction: string) => track('swap_completed', { market, direction }),
    liquidityAdded: (market: string) => track('liquidity_added', { market }),
  };
  ```
- [ ] Integrate tracking in hooks:
  - `useMint` - Track successful mints
  - `useSwap` - Track swaps
  - `useLiquidity` - Track LP actions

---

## Priority 5: Developer Experience

### 5.1 Middleware for Routing Logic

**Best Practice:** Use middleware for auth/routing

**Current State:** No middleware

**Action Items:**
- [ ] Create `src/middleware.ts`:
  ```ts
  import { NextResponse } from 'next/server';
  import type { NextRequest } from 'next/server';

  export function middleware(request: NextRequest) {
    // Add request timing header
    const response = NextResponse.next();
    response.headers.set('x-request-time', Date.now().toString());

    // Redirect old routes if needed
    // if (request.nextUrl.pathname === '/old-path') {
    //   return NextResponse.redirect(new URL('/new-path', request.url));
    // }

    return response;
  }

  export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
  };
  ```
- [ ] Consider adding geo-based redirects for compliance if needed

---

### 5.2 Pre-push Hook

**Best Practice:** Run tests before push

**Current State:** Pre-push hook is empty

**Action Items:**
- [ ] Update `.husky/pre-push`:
  ```bash
  #!/bin/sh
  . "$(dirname "$0")/_/husky.sh"

  cd packages/frontend
  bun run check
  bun test
  ```

---

### 5.3 Bundle Analysis

**Best Practice:** Use @next/bundle-analyzer

**Current State:** Not configured

**Action Items:**
- [ ] Install: `bun add -d @next/bundle-analyzer`
- [ ] Add to `next.config.ts`:
  ```ts
  import withBundleAnalyzer from '@next/bundle-analyzer';

  const bundleAnalyzer = withBundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
  });

  export default bundleAnalyzer(nextConfig);
  ```
- [ ] Add script: `"analyze": "ANALYZE=true bun run build"`
- [ ] Run periodically to identify large dependencies

---

## Priority 6: Code Quality Enhancements

### 6.1 API Client Wrapper

**Best Practice:** Central API client wrapper

**Current State:** Direct fetch calls in API hooks

**Action Items:**
- [ ] Create centralized API client:
  ```ts
  // src/lib/api/client.ts
  const API_BASE = '/api';

  class ApiClient {
    async get<T>(path: string, params?: Record<string, string>): Promise<T> {
      const url = new URL(`${API_BASE}${path}`, window.location.origin);
      if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      }
      const res = await fetch(url);
      if (!res.ok) throw new ApiError(res.status, await res.text());
      return res.json();
    }
  }

  export const api = new ApiClient();
  ```
- [ ] Refactor API hooks to use the client
- [ ] Add request/response interceptors for logging

---

### 6.2 React Query Utilities

**Best Practice:** Consistent query key management

**Action Items:**
- [ ] Create query key factory:
  ```ts
  // src/lib/query-keys.ts
  export const queryKeys = {
    markets: {
      all: ['markets'] as const,
      list: (params: MarketQueryParams) => [...queryKeys.markets.all, 'list', params] as const,
      detail: (address: string) => [...queryKeys.markets.all, 'detail', address] as const,
      rates: (address: string) => [...queryKeys.markets.all, 'rates', address] as const,
    },
    users: {
      positions: (address: string) => ['users', address, 'positions'] as const,
      history: (address: string) => ['users', address, 'history'] as const,
    },
    analytics: {
      stats: ['analytics', 'stats'] as const,
      tvl: ['analytics', 'tvl'] as const,
    },
  };
  ```
- [ ] Update all useQuery calls to use factory
- [ ] Add query invalidation helpers

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] 1.1 Route segment error handling
- [ ] 3.1 Security headers
- [ ] 3.2 Sitemap & robots.txt
- [ ] 5.2 Pre-push hook

### Phase 2: Quality & Monitoring (Week 2)
- [ ] 1.3 Sentry integration
- [ ] 4.1 Vercel Analytics
- [ ] 4.2 Custom event tracking
- [ ] 6.1 API client wrapper

### Phase 3: Testing (Week 3-4)
- [ ] 1.2 Unit tests for hooks
- [ ] 1.2 Component tests
- [ ] 1.2 API route tests
- [ ] 1.2 Playwright E2E setup

### Phase 4: Performance (Week 5)
- [ ] 2.1 Image optimization audit
- [ ] 2.2 ISR for analytics
- [ ] 2.3 Route prefetching
- [ ] 5.3 Bundle analysis

### Phase 5: Polish (Week 6)
- [ ] 3.3 Zod API validation
- [ ] 5.1 Middleware
- [ ] 6.2 Query key factory
- [ ] Documentation updates

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Test Coverage | ~30% (329 tests) | >60% |
| Lighthouse Performance | Unknown | >90 |
| Lighthouse Accessibility | Unknown | >95 |
| Core Web Vitals (LCP) | Unknown | <2.5s |
| Core Web Vitals (CLS) | Unknown | <0.1 |
| Error Rate | Unknown | <0.1% |
| Build Time | ~45s | <30s |

---

## Notes

- All improvements should be implemented incrementally
- Each change should include tests where applicable
- Performance improvements should be measured before/after
- Security headers should be tested in staging first
- Analytics tracking must respect user privacy preferences
