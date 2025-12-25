# Security Configuration

This document describes the security measures implemented in the Horizon Protocol frontend.

**ASVS Control:** V1.1.2 - Security Documentation
**Last Updated:** December 2024

## Overview

The Horizon Protocol frontend follows OWASP ASVS Level 2 guidelines for SaaS applications. As a blockchain dApp with wallet-based authentication, some traditional web security concerns (session management, CSRF) do not apply.

## Content Security Policy (CSP)

**Implementation:** `src/lib/csp.ts`

### Production Mode
- **Nonce-based CSP** with `'strict-dynamic'` for maximum XSS protection
- Per-request cryptographic nonce generated for inline scripts
- Fallback chain: nonce → strict-dynamic → allowed origins

### Development Mode
- Relaxed policy using `'unsafe-inline'` and `'unsafe-eval'` for HMR support
- This is intentional and only applies to local development

### CSP Directives

| Directive | Value | Purpose |
|-----------|-------|---------|
| `default-src` | `'self'` | Restrict all resources to same origin by default |
| `script-src` | `'self' 'nonce-{nonce}' 'strict-dynamic'` | Nonce-based script loading |
| `style-src` | `'self' 'unsafe-inline'` | Allow inline styles (Tailwind CSS) |
| `img-src` | `'self' data: blob: https:` | Images from any HTTPS source |
| `connect-src` | (see csp.ts) | Allowlisted API endpoints |
| `frame-ancestors` | `'none'` | Prevent clickjacking |
| `base-uri` | `'self'` | Prevent base tag injection |
| `form-action` | `'self'` | Restrict form submissions |

### Allowed Connect Sources
- `*.starknet.io` - Wallet discovery
- `snaps.consensys.io` - MetaMask Snaps
- `*.alchemy.com` - RPC provider
- `*.voyager.online` - Block explorer
- `*.avnu.fi` - Swap routing
- `api.pragma.build` - Oracle
- `*.sentry.io` - Error tracking

## Subresource Integrity (SRI)

**Implementation:** `src/components/security/SecureScript.tsx`

All external scripts must use the `SecureScript` component which enforces:
- SRI hash verification (`integrity` attribute)
- CSP nonce for execution
- `crossorigin="anonymous"` for CORS

### Adding External Scripts

```bash
# Generate SRI hash
curl -s "https://cdn.example.com/script.js" | openssl dgst -sha384 -binary | openssl base64 -A
```

Add the hash to `SRI_HASHES` in `SecureScript.tsx`.

## Rate Limiting

**Implementation:** `src/lib/rate-limit.ts`

All API routes are rate limited using Upstash Redis:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| RPC Proxy | 60 requests | 1 minute |
| Public Data | 100 requests | 1 minute |
| User Data | 100 requests | 1 minute |
| Health Check | 300 requests | 1 minute |

### Configuration

Set these environment variables for production:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

In development (without Redis), rate limiting is bypassed.

### Response Headers

Rate-limited endpoints include these headers:
- `X-RateLimit-Limit` - Maximum requests per window
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - Unix timestamp when limit resets
- `Retry-After` - Seconds until retry (on 429 response)

## Input Validation

**Implementation:** `src/lib/validations/api.ts`

All API endpoints validate inputs using Zod schemas:
- Query parameters validated before processing
- Starknet addresses validated with regex
- Numeric parameters bounded (min/max values)
- Pagination limits enforced (max 100 per page)

### Validation Response

Invalid requests return 400 with structured error:
```json
{
  "error": "Validation Error",
  "details": [
    { "path": "limit", "message": "Number must be less than or equal to 100" }
  ]
}
```

## SQL Injection Prevention

**Implementation:** Drizzle ORM

All database queries use Drizzle ORM with parameterized queries:
- No raw SQL string concatenation
- Type-safe query builder
- Automatic escaping of user input

## SSRF Prevention

**Implementation:** `src/app/api/rpc/route.ts`

The RPC proxy validates URLs against an allowlist:

```typescript
const ALLOWED_RPC_HOSTS = [
  'starknet-mainnet.g.alchemy.com',
  'starknet-sepolia.g.alchemy.com',
  'starknet-mainnet.infura.io',
  'starknet-sepolia.infura.io',
  'localhost',
  '127.0.0.1',
];
```

### Additional Protections
- Request timeout: 30 seconds
- Request size limit: 10KB
- No user-controlled URL parameters

## Environment Variables

### Public Variables (`NEXT_PUBLIC_*`)
Exposed to the browser - safe for non-sensitive configuration:
- `NEXT_PUBLIC_NETWORK` - Network identifier (mainnet/sepolia/devnet)
- `NEXT_PUBLIC_RPC_URL` - Public RPC endpoint (without API key)

### Server-Only Variables
Never exposed to browser - may contain secrets:
- `RPC_URL` - RPC endpoint with API key
- `DATABASE_URL` - Database connection string
- `UPSTASH_REDIS_REST_URL` - Redis URL
- `UPSTASH_REDIS_REST_TOKEN` - Redis auth token
- `SENTRY_AUTH_TOKEN` - Sentry upload token

## Authentication

This application uses **wallet-based authentication**:
- No server sessions or cookies
- User identity = connected wallet address
- Transaction signing via wallet (user's private key never exposed)

This eliminates:
- Session hijacking risks
- CSRF vulnerabilities
- Password-related attacks

## Cache Security

**Implementation:** `src/lib/cache.ts`

All cached responses include:
- `Cache-Control` with appropriate `s-maxage` and `stale-while-revalidate`
- `Vary: Accept-Encoding` to prevent cache poisoning

User-specific endpoints use:
- `Cache-Control: private, no-cache, no-store, must-revalidate`

## Error Handling

**Implementation:** `src/lib/logger.ts`

- Errors are logged server-side with context
- Client receives generic error messages (no stack traces)
- Sentry integration for production error tracking

## CI/CD Security

### Automated Checks
- **Dependency scanning:** OSV Scanner in CI
- **Secret scanning:** TruffleHog for leaked credentials
- **Type checking:** TypeScript strict mode
- **Linting:** ESLint with security rules

### GitHub Settings
- Branch protection on `main`
- Required reviews for PRs
- Dependabot for dependency updates

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email security concerns to the team
3. Include steps to reproduce
4. Allow time for a fix before disclosure

## Security Headers Summary

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | (see CSP section) | XSS prevention |
| X-Frame-Options | DENY | Clickjacking prevention |
| X-Content-Type-Options | nosniff | MIME sniffing prevention |
| Referrer-Policy | strict-origin-when-cross-origin | Referrer leakage prevention |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), payment=() | Feature restrictions |

## References

- [OWASP ASVS 4.0.3](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Top 10:2021](https://owasp.org/Top10/)
- [Next.js Security Headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers)
- [Next.js CSP Guide](https://nextjs.org/docs/app/guides/content-security-policy)
