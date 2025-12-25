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

### 1.3 Implement Structured Logging ✅ COMPLETED

**Best Practice:** Error tracking with Sentry/Datadog

**Status:** Completed on 2025-12-25

**Files Created/Modified:**
- [x] Installed `@sentry/nextjs`
- [x] `instrumentation-client.ts` - Client-side Sentry initialization with:
  - Replay integration for error context
  - Browser tracing integration
  - Console logging integration (auto-captures console.warn/error)
  - `enableLogs: true` for structured logging
- [x] `sentry.server.config.ts` - Server-side Sentry with enableLogs and console integration
- [x] `sentry.edge.config.ts` - Edge runtime Sentry with enableLogs
- [x] `next.config.ts` - Updated with `withSentryConfig` wrapper
- [x] `src/lib/logger.ts` - Structured logging utility using Sentry's logger:
  - `logError()` - Captures exception + structured log
  - `logWarn()` - Warning logs via `logger.warn`
  - `logInfo()` - Info logs via `logger.info`
  - `logDebug()` - Debug logs via `logger.debug`
  - `logTrace()` - Trace logs via `logger.trace`
  - `logFatal()` - Fatal logs via `logger.fatal`
  - `setUser()` - Sets user context for error tracking
  - `addBreadcrumb()` - Adds navigation breadcrumbs
  - `trace()` - Performance tracing with `Sentry.startSpan`
  - `traceAsync()` - Async tracing with attributes
  - `fmt` - Template literal helper for structured logs
  - `logger` - Direct access to Sentry logger
- [x] Replaced 26 `console.error` calls with `logError` across:
  - API routes (12 files)
  - Error boundaries (4 files)
  - Hooks (1 file)
  - Components (1 file)
  - Wallet utilities (1 file)
  - Faucet page (1 file)
- [x] `.env.example` - Added Sentry environment variables:
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `SENTRY_DSN`
  - `SENTRY_ORG`
  - `SENTRY_PROJECT`

**Usage Examples:**
```ts
import { logError, logInfo, trace, logger, fmt } from '@/lib/logger';

// Error logging with context
logError(error, { module: 'markets', marketAddress });

// Template literal logging
logger.debug(fmt`Cache miss for user: ${userId}`);

// Performance tracing
const result = await trace('ui.click', 'Swap Button', async (span) => {
  span.setAttribute('market', marketAddress);
  return await executeSwap();
});
```

---

## Priority 2: Performance Optimization

### 2.1 Image Optimization ✅ COMPLETED

**Best Practice:** Use `<Image />` component, AVIF/WebP formats

**Status:** Completed on 2025-12-25

**Audit Results:**
- [x] All images already use `next/image` component (Header logo, MDX documentation diagrams)
- [x] No raw `<img>` tags found in codebase
- [x] Header logo uses `priority` attribute for above-the-fold loading

**Configuration Added:**
- [x] AVIF/WebP format support in `next.config.ts`
- [x] Optimized device sizes for responsive images
- [x] Development mode skips optimization for faster builds

**Static Assets Analysis:**
- Logo PNGs (32px, 64px, 128px): Already optimized at 1.4KB-4.8KB
- Documentation diagrams: SVG format (vector, already optimal)
- No hero/banner images exist - blur placeholders not applicable

---

### 2.2 ISR for Analytics Pages ✅ COMPLETED

**Best Practice:** Leverage ISR with `revalidate`

**Status:** Completed on 2025-12-25

**Cache Utility Created:**
- [x] `src/lib/cache.ts` - Centralized cache header utilities
  - `CacheDuration.SHORT` (30s cache, 2min stale) - For real-time data
  - `CacheDuration.MEDIUM` (60s cache, 5min stale) - For analytics
  - `CacheDuration.LONG` (5min cache, 1hr stale) - For historical data
  - `CacheDuration.STATIC` (1hr cache, 24hr stale) - For static content
  - `getCacheHeaders()` - Generate Cache-Control headers
  - `getNoCacheHeaders()` - For user-specific data

**API Route Caching Applied:**
- [x] `/api/analytics/stats` - MEDIUM cache (60s)
- [x] `/api/analytics/tvl` - MEDIUM cache (60s)
- [x] `/api/analytics/volume` - MEDIUM cache (60s)
- [x] `/api/analytics/fees` - MEDIUM cache (60s)
- [x] `/api/markets` - SHORT cache (30s)

**ISR for Documentation Pages:**
- [x] Added `revalidate = 3600` to `/docs` layout
- [x] All 18 docs pages now use ISR with 1-hour revalidation

**Note:** Analytics page is a client component that fetches from API routes.
CDN-level caching via Cache-Control headers provides equivalent benefits.

---

### 2.3 Route Prefetching ✅ COMPLETED

**Best Practice:** Use Link prefetch for navigation

**Status:** Completed on 2025-12-25

**Prefetch Strategy Implemented:**

| Component | Route Type | Prefetch Setting |
|-----------|------------|------------------|
| Header | Main nav (/, /mint, /trade, /pools, /portfolio, /docs) | Default (enabled) |
| Footer Product | High-traffic (/trade, /pools, /portfolio) | Default (enabled) |
| Footer Learn | Docs pages | `prefetch={false}` |
| Footer Resources | Reference pages (glossary, risks, mechanics) | `prefetch={false}` |
| Footer Legal | /terms, /privacy | `prefetch={false}` |
| DocsSidebar | All 18+ docs navigation links | `prefetch={false}` |
| DocsSearch | Dynamic search results | `prefetch={false}` |
| DocsNavigation | Prev/Next links | Default (enabled - only 2 links) |

**Files Modified:**
- [x] `src/components/layout/Footer.tsx` - Added prefetch config per link section
- [x] `src/components/docs/DocsSidebar.tsx` - Disabled prefetch for sidebar links
- [x] `src/components/docs/DocsSearch.tsx` - Disabled prefetch for search results

**Rationale:**
- High-traffic routes (main app pages) keep default prefetch for instant navigation
- Docs pages disable prefetch since there are many links and pages are ISR cached
- Legal/reference pages rarely accessed, don't need prefetch overhead

---

## Priority 3: Security & SEO

### 3.1 Security Headers ✅ COMPLETED

**Best Practice:** CSP, HSTS in next.config.js

**Status:** Completed on 2025-12-25

**Security Headers Configured in `next.config.ts`:**

| Header | Value | Purpose |
|--------|-------|---------|
| `X-DNS-Prefetch-Control` | `on` | Enable DNS prefetching for external resources |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years |
| `X-Frame-Options` | `DENY` | Prevent clickjacking (no iframe embedding) |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer information |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disable unused browser features |
| `Content-Security-Policy` | (see below) | Prevent XSS and injection attacks |

**Content Security Policy Configuration:**
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' https://*.starknet.io https://*.infura.io https://*.alchemy.com
            https://*.blast.io https://*.voyager.online https://api.pragma.build
            https://*.sentry.io wss://*.starknet.io wss://*.infura.io wss://*.alchemy.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
```

**CSP Notes:**
- `'unsafe-inline'` for styles is required for Tailwind CSS dynamic styling
- `'unsafe-eval'` is NOT included to prevent XSS attacks
- Wallet extensions work via browser extension APIs (not affected by CSP)
- Connect sources include Starknet RPC providers and Sentry for monitoring

**Testing:** Deploy to staging and verify at https://securityheaders.com

---

### 3.2 SEO: Sitemap & Robots ✅ COMPLETED

**Best Practice:** Add for SEO

**Status:** Completed on 2025-12-25

**Files Created:**

**`src/app/sitemap.ts`:**
- [x] 6 main app pages (/, /trade, /pools, /mint, /portfolio, /analytics) - priority 0.7-1.0
- [x] 18 documentation pages - priority 0.5-0.8
- [x] 2 legal pages (/terms, /privacy) - priority 0.3
- [x] Change frequency configured (daily/weekly/monthly based on content type)

**`src/app/robots.ts`:**
- [x] Allow all crawlers to index public pages
- [x] Disallow: /api/, /faucet, /monitoring, /_next/
- [x] Sitemap reference included

**Enhanced Root Layout Metadata (`src/app/layout.tsx`):**
- [x] `metadataBase` - Base URL for relative paths
- [x] `title.template` - Consistent page titles
- [x] `description` - Comprehensive site description
- [x] `keywords` - DeFi, Starknet, yield tokenization keywords
- [x] `openGraph` - Social sharing metadata
- [x] `twitter` - Twitter card configuration
- [x] `robots` - Crawler indexing directives

**Build Output:**
```
├ ○ /robots.txt
├ ○ /sitemap.xml
```

Both files are statically generated at build time.

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
