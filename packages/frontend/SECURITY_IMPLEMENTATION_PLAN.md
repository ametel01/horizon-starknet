# Frontend Security Implementation Plan

**Project:** Horizon Protocol Frontend
**Standard:** OWASP ASVS Level 2 (SaaS)
**Date:** December 2024
**Scope:** Next.js 16 App Router, API Routes, Middleware, Environment Config, CI/CD

---

## Executive Summary

The Horizon Protocol frontend demonstrates a **strong baseline security posture** for a blockchain dApp. The codebase correctly implements:

- Comprehensive security headers (CSP, HSTS, X-Frame-Options)
- Proper environment variable separation (public vs private)
- Input validation via Zod schemas on all API endpoints
- SQL injection prevention via Drizzle ORM parameterization
- Wallet-based authentication (no session tokens to protect)

However, there are **opportunities for hardening** aligned with OWASP ASVS L2 controls.

### Risk Posture: LOW-MEDIUM

| Category | Current Status | Gap |
|----------|---------------|-----|
| XSS Protection | Excellent | Nonce-based CSP with strict-dynamic ✅ |
| Security Headers | Excellent | SRI enforced via SecureScript ✅ |
| Auth/Session | N/A (wallet-based) | - |
| CSRF | Not applicable | No cookie-based auth |
| Secrets Management | Good | Missing secret rotation policy |
| Input Validation | Excellent | - |
| SSRF | Excellent | RPC URL allowlist ✅ |
| Caching | Good | Add `Vary` headers |
| Dependencies | Good | OSV Scanner in CI ✅ |
| CI/CD | Good | Secret scanning in CI ✅, SAST pending |

---

## Audit Scope (Next.js Frontend)

| Component | Count | Status |
|-----------|-------|--------|
| App Router Pages | 10+ | Reviewed |
| API Route Handlers | 16 | Reviewed |
| Server Actions | 0 | N/A |
| Middleware/Proxy | 1 | Reviewed |
| MDX Content Pages | 20+ | Reviewed |
| External Fetch Calls | 2 | Reviewed |

---

## Implementation Plan by Priority

### Priority 1: Critical (Immediate)

#### 1.1 Add Dependency Vulnerability Scanning ✅

**ASVS Control:** V14.2.1 - Third Party Components
**OWASP Top 10:** A06:2021 - Vulnerable and Outdated Components

**Current State:** ✅ Implemented - OSV Scanner in CI/CD.

**Implementation:**

```yaml
# Add to .github/workflows/frontend-ci.yml
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: packages/frontend
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Audit dependencies
        run: bunx audit-ci --high
        continue-on-error: false
```

**Alternative:** Use GitHub Dependabot or Snyk integration.

**Files to modify:**
- `.github/workflows/frontend-ci.yml`
- Add `audit-ci` to devDependencies

---

#### 1.2 Add Secret Scanning to CI ✅

**ASVS Control:** V10.3.1 - Secrets in Code
**OWASP Top 10:** A07:2021 - Identification and Authentication Failures

**Current State:** ✅ Implemented - TruffleHog in CI/CD.

**Implementation:**

```yaml
# Add to .github/workflows/frontend-ci.yml
  secret-scan:
    name: Secret Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./packages/frontend
          extra_args: --only-verified
```

**Alternative:** Enable GitHub Advanced Security secret scanning.

---

#### 1.3 Improve CSP - Remove `unsafe-inline` for Scripts ✅

**ASVS Control:** V14.4.3 - Content Security Policy
**OWASP Top 10:** A03:2021 - Injection

**Current State:** ✅ Implemented - Nonce-based CSP with `strict-dynamic` in production.

**Implementation:** See `src/lib/csp.ts`, `src/components/security/NonceProvider.tsx`.

**Implementation Options:**

**Option A: Nonce-based CSP (Recommended)**

```typescript
// next.config.ts
import { headers } from 'next/headers';
import crypto from 'crypto';

// Generate nonce per request
const nonce = crypto.randomBytes(16).toString('base64');

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  ...
`;
```

Then configure Next.js to use nonces:
- See: https://nextjs.org/docs/app/guides/content-security-policy

**Option B: Hash-based CSP**

Pre-compute hashes for known inline scripts during build.

**Effort:** Medium (2-3 days)
**Risk if not done:** Medium - XSS attacks via inline script injection

---

### Priority 2: High (This Sprint)

#### 2.1 Add Subresource Integrity (SRI) for External Scripts ✅

**ASVS Control:** V14.2.3 - Subresource Integrity
**OWASP Top 10:** A08:2021 - Software and Data Integrity Failures

**Current State:** ✅ Implemented - `SecureScript` component enforces SRI for external scripts.

**Implementation:**
- `src/components/security/SecureScript.tsx` - Wrapper that enforces SRI hashes
- ESLint rule restricts direct `next/script` imports, requiring `SecureScript` usage

---

#### 2.2 Harden RPC Proxy Against Abuse ✅

**ASVS Control:** V13.2.5 - Server-Side Request Forgery
**OWASP Top 10:** A10:2021 - Server-Side Request Forgery

**Current State:** ✅ Implemented - RPC URL allowlist validates against known providers.

**Implementation:** `src/app/api/rpc/route.ts` - `ALLOWED_RPC_HOSTS` constant and `isAllowedRpcUrl()` validation.

**Implementation:**

```typescript
// src/app/api/rpc/route.ts

// Add explicit URL validation
const ALLOWED_RPC_HOSTS = [
  'starknet-mainnet.g.alchemy.com',
  `starknet-sepolia.g.alchemy.com`
];

function isAllowedRpcUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_RPC_HOSTS.some(host => parsed.hostname.endsWith(host));
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;

  if (!rpcUrl || !isAllowedRpcUrl(rpcUrl)) {
    return NextResponse.json({ error: 'Invalid RPC configuration' }, { status: 500 });
  }

  // ... rest of handler
}
```

**Files to modify:**
- `src/app/api/rpc/route.ts`

---

#### 2.3 Add Rate Limiting to API Routes ✅

**ASVS Control:** V11.1.4 - Rate Limiting
**OWASP Top 10:** A04:2021 - Insecure Design

**Current State:** ✅ Implemented - Upstash Redis rate limiting on all API endpoints.

**Implementation:** `src/lib/rate-limit.ts` with `@upstash/ratelimit` package.

**Rate Limit Presets:**
- `RPC`: 60 requests/minute (stricter for external API proxy)
- `PUBLIC`: 100 requests/minute (markets, analytics)
- `USER`: 100 requests/minute (user-specific endpoints)
- `HEALTH`: 300 requests/minute (health check endpoint)

**Setup:**
1. Create a free Redis database at https://console.upstash.com
2. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to environment
3. In development without Redis, rate limiting is bypassed (all requests allowed)

**API Routes with Rate Limiting:**
- `/api/rpc` - RPC config
- `/api/health` - HEALTH config
- `/api/markets/*` - PUBLIC config
- `/api/analytics/*` - PUBLIC config
- `/api/users/*` - USER config

---

#### 2.4 Add `Vary` Headers to Cached Responses ✅

**ASVS Control:** V14.4.5 - Cache Control
**OWASP Top 10:** A01:2021 - Broken Access Control

**Current State:** ✅ Implemented - Vary: Accept-Encoding added to all cache header functions.

**Implementation:** `src/lib/cache.ts` - Both `getCacheHeaders()` and `getNoCacheHeaders()` now include `Vary: Accept-Encoding` header.

---

### Priority 3: Medium (Next Sprint)

#### 3.1 Add SAST (Static Analysis) to CI

**ASVS Control:** V10.2.1 - Static Code Analysis
**OWASP Top 10:** Multiple

**Implementation:**

```yaml
# Add to .github/workflows/frontend-ci.yml
  sast:
    name: Static Analysis
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4

      - name: Run Semgrep
        uses: semgrep/semgrep-action@v1
        with:
          config: >-
            p/typescript
            p/react
            p/nextjs
            p/security-audit
          generateSarif: true

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: semgrep.sarif
```

**Alternative:** Use CodeQL via GitHub Advanced Security.

---

#### 3.2 Add Request Timeout to RPC Proxy ✅

**ASVS Control:** V13.2.3 - Timeouts
**OWASP Top 10:** A10:2021 - SSRF

**Current State:** ✅ Implemented - 30 second timeout via `AbortSignal.timeout()`.

**Implementation:**

```typescript
// src/app/api/rpc/route.ts
const response = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(30000), // 30 second timeout
});
```

**Files to modify:**
- `src/app/api/rpc/route.ts`

---

#### 3.3 Add Input Size Limits to API Routes ✅

**ASVS Control:** V13.1.1 - Input Size Limits
**OWASP Top 10:** A04:2021 - Insecure Design

**Current State:** ✅ Implemented - 10KB limit on RPC proxy requests.

**Implementation:**

```typescript
// src/app/api/rpc/route.ts
export async function POST(request: Request): Promise<Response> {
  // Check content length
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 10000) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

  // ... rest of handler
}
```

**Alternative:** Configure at reverse proxy/CDN level.

---

#### 3.4 Document Security Configuration

**ASVS Control:** V1.1.2 - Security Documentation

**Implementation:** Create security documentation:

```markdown
# docs/security.md

## Security Headers
- CSP, HSTS, X-Frame-Options configured in next.config.ts
- Headers applied to all routes

## Environment Variables
- NEXT_PUBLIC_* = Client-exposed, safe for public data only
- Non-prefixed = Server-only, contains secrets

## Authentication
- Wallet-based (no server sessions)
- User identity = connected wallet address

## API Security
- All inputs validated with Zod
- SQL injection prevented via Drizzle ORM
- Rate limiting via [chosen solution]

## Reporting Vulnerabilities
- Email: security@horizon.fi
- PGP key: [link]
```

---

### Priority 4: Low (Backlog)

#### 4.1 Add CSP Report-URI for Violation Monitoring

**Implementation:**

```typescript
// next.config.ts
const ContentSecurityPolicy = `
  ...existing policy...
  report-uri https://your-csp-report-endpoint.com/report;
  report-to csp-endpoint;
`;

const securityHeaders = [
  ...existing headers,
  {
    key: 'Report-To',
    value: JSON.stringify({
      group: 'csp-endpoint',
      max_age: 10886400,
      endpoints: [{ url: 'https://your-csp-report-endpoint.com/report' }],
    }),
  },
];
```

---

#### 4.2 Add Permissions-Policy for More Features

**Current State:** Camera, microphone, geolocation, payment disabled.

**Enhancement:**

```typescript
{
  key: 'Permissions-Policy',
  value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), idle-detection=()'
}
```

---

#### 4.3 Consider Removing `productionBrowserSourceMaps`

**Current State:** Source maps exposed in production for debugging.

**Risk:** Exposes source code structure to attackers.

**Recommendation:**
- Keep for easier debugging if acceptable risk
- Or remove and rely on Sentry source map upload only

```typescript
// next.config.ts
productionBrowserSourceMaps: false, // Hide source maps from browsers
```

Note: Sentry is already configured with `hideSourceMaps: true` which should handle this.

---

## ASVS Control Matrix

| Control ID | Control Name | Status | Evidence |
|------------|--------------|--------|----------|
| V1.1.2 | Security Documentation | ❌ Gap | No security.md |
| V10.2.1 | Static Analysis | ❌ Gap | No SAST in CI |
| V10.3.1 | Secrets in Code | ✅ Pass | TruffleHog in CI |
| V11.1.4 | Rate Limiting | ✅ Pass | Upstash Redis rate limiting on all API routes |
| V13.1.1 | Input Size Limits | ✅ Pass | RPC proxy has 10KB limit |
| V13.2.3 | Timeouts | ✅ Pass | RPC proxy has 30s timeout |
| V13.2.5 | SSRF Prevention | ✅ Pass | RPC URL allowlist enforced |
| V14.2.1 | Dependency Scanning | ✅ Pass | OSV Scanner in CI |
| V14.2.3 | Subresource Integrity | ✅ Pass | SecureScript component + ESLint enforcement |
| V14.4.3 | CSP | ✅ Pass | Nonce-based CSP with strict-dynamic |
| V14.4.5 | Cache Headers | ✅ Pass | Vary: Accept-Encoding on all cached responses |
| V14.4.6 | HSTS | ✅ Pass | Configured correctly |
| V14.4.7 | X-Frame-Options | ✅ Pass | Set to DENY |
| V3.1.1 | Session Security | N/A | Wallet-based auth |
| V4.2.1 | CSRF Protection | N/A | No cookie-based auth |
| V5.1.3 | Input Validation | ✅ Pass | Zod schemas on all APIs |
| V5.3.4 | SQL Injection | ✅ Pass | Drizzle ORM parameterization |

---

## Implementation Timeline

### Week 1
- [x] Add dependency vulnerability scanning to CI
- [x] Add secret scanning to CI
- [x] Add timeout to RPC proxy

### Week 2
- [x] Add RPC URL allowlist
- [x] Add Vary headers to cache utilities
- [x] Add input size limits

### Week 3
- [ ] Add SAST (Semgrep) to CI
- [ ] Create security documentation
- [x] Implement CSP nonce (strict-dynamic)

### Week 4
- [x] Implement rate limiting
- [ ] Add CSP report-uri monitoring
- [ ] Security review of all changes

---

## Verification Checklist

After implementing each control:

1. **Headers verification:**
   ```bash
   curl -I https://your-domain.com | grep -E "(Content-Security|Strict-Transport|X-Frame|X-Content)"
   ```

2. **Dependency audit:**
   ```bash
   bun audit
   ```

3. **Build verification:**
   ```bash
   bun run build && bun run check
   ```

4. **E2E test suite:**
   ```bash
   bun run test:e2e
   ```

---

## References

- [OWASP ASVS 4.0.3](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Top 10:2021](https://owasp.org/Top10/)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [Next.js CSP Guide](https://nextjs.org/docs/app/guides/content-security-policy)
- [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
