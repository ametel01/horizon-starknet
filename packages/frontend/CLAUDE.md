# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
bun install                   # Install dependencies
bun run dev                   # Dev server (port 3000)
bun run dev:fork              # Dev with mainnet fork (real Pragma oracle)
bun run build                 # Production build
bun run check                 # Run typecheck + lint + format:check
bun run test                  # Run tests (Bun test runner)
bun test src/shared/math/amm.test.ts  # Run specific test
bun run test:e2e              # Run Playwright E2E tests (all browsers)
bun run test:e2e --project=chromium  # Run E2E tests (Chromium only)
bun run codegen               # Generate TypeScript types from contract ABIs
bun run commit:check          # Full pre-commit validation (install, codegen, build, lint, test, e2e)
```

## Tech Stack

- **Next.js 16** with App Router and Turbopack
- **React 19** with TypeScript 5.9 (strict mode)
- **Bun** for package management and testing
- **TanStack Query** for server state and caching
- **starknet.js** for blockchain interactions
- **Tailwind CSS 4** + shadcn/ui + Radix UI for components
- **MDX** for documentation pages

## Architecture

This codebase follows **Feature-Sliced Design (FSD)** architecture with strict layer boundaries enforced by ESLint.

### Layer Structure

```
src/
├── app/              # Next.js App Router pages and API routes
├── widgets/          # Page-level compositions (MarketCard, Shell, Analytics)
├── features/         # User interactions (swap, mint, redeem, portfolio, etc.)
├── entities/         # Domain concepts (market, position, token)
├── shared/           # Business-logic-free utilities and primitives
│   ├── ui/           # Base UI components (shadcn)
│   ├── math/         # WAD fixed-point math, AMM calculations
│   ├── starknet/     # Contract interactions, provider, wallet
│   ├── config/       # Network addresses, constants
│   ├── api/          # API client utilities
│   ├── lib/          # General utilities, error handling
│   ├── security/     # SecureScript wrapper
│   ├── hooks/        # Shared React hooks
│   └── server/       # Server-only code (db, rate-limit) - NOT exported
└── types/            # TypeScript types (including generated contract types)
```

### Import Rules (ESLint enforced)

- **Legacy paths forbidden**: `@/components`, `@/hooks`, `@/contexts`, `@/lib` are blocked
- **Use FSD paths**: `@shared/*`, `@entities/*`, `@features/*`, `@widgets/*`
- **Server isolation**: DB/server modules cannot be imported into client code

### Path Aliases

- `@shared/*` → `src/shared/*`
- `@entities/*` → `src/entities/*`
- `@features/*` → `src/features/*`
- `@widgets/*` → `src/widgets/*`
- `@/*` → `src/*`
- `@contracts/*` → `../../contracts/target/dev/*`
- `@deploy/*` → `../../deploy/*`

### Data Flow Pattern

User action → Feature hook (useSwap, useMint) → Starknet contract call → Wallet signature → Transaction → React Query invalidation → UI update

### Key Patterns

**Type-Safe Contracts:**
```typescript
import { ROUTER_ABI } from '@/types/generated';
const router = new Contract(ROUTER_ABI, address, provider).typedv2(ROUTER_ABI);
await router.mint_py_from_sy(...);  // Full TypeScript support
```

**WAD Fixed-Point Math (10^18):**
```typescript
import { WAD, fromWad, toWad, wadMul, formatWad } from '@shared/math';
const value = 1000000000000000000n;  // 1 WAD
formatWad(value);  // "1.0000"
```

Note: The codebase uses `cairo-fp` library for some fixed-point conversions and `@shared/math` for WAD operations. Prefer `@shared/math` for new code.

**Feature Hook Pattern:**
```typescript
// Data fetching (features/*/model/)
export function useMarkets() {
  return useQuery({ queryKey: ['markets'], queryFn: fetchMarketData });
}

// Mutations (features/*/model/)
export function useSwap() {
  return useMutation({ mutationFn: executeSwap });
}
```

### Network Configuration

Set via `NEXT_PUBLIC_NETWORK` environment variable:
- `mainnet` - Starknet mainnet (default for production)
- `sepolia` - Starknet Sepolia testnet
- `devnet` - Local starknet-devnet-rs (mock oracle)
- `fork` - Mainnet fork (real Pragma TWAP oracle)

Contract addresses are loaded from `@deploy/addresses/{network}.json`.

## Code Patterns

### Contract Error Handling

All contract errors use `HZN:` prefix for parsing:
```typescript
const CONTRACT_ERROR_MESSAGES = {
  'HZN: slippage exceeded': 'Price moved beyond slippage tolerance.',
  'HZN: expired': 'This position has expired.',
};
```

### TypeScript Configuration

Strict mode is enabled with additional strictness:
- `noUncheckedIndexedAccess` - Array/object access may be undefined
- `exactOptionalPropertyTypes` - Optional properties must match exactly
- `noPropertyAccessFromIndexSignature` - Use bracket notation for index signatures
- `@typescript-eslint/strict-boolean-expressions` - No implicit boolean coercion (nullable booleans and strings allowed)

### ESLint Import Rules

- `import/order` enforced with alphabetical ordering and grouped by type
- `import/no-cycle` prevents circular dependencies
- `@typescript-eslint/consistent-type-imports` requires `type` keyword for type-only imports

## Type Generation Workflow

After updating Cairo contracts:
```bash
cd ../..              # Go to repo root
make build            # Build contracts (generates ABI JSON)
cd packages/frontend
bun run codegen       # Generate TypeScript types from ABIs
```

## Database Queries

Database connection is configured in `.env.local` via `DATABASE_URL`.

```bash
bun run scripts/query-users.ts  # Query unique protocol users with tx hashes
```

## Mandatory: Use shadcn/ui Components

All new components **MUST** use the shadcn/ui library. An MCP server is available for component discovery and installation.

## Feature Structure Convention

Each feature follows FSD's segmented structure:
```
features/<name>/
├── api/       # Contract calls, API functions
├── model/     # React hooks (useQuery, useMutation), state
├── ui/        # React components
└── index.ts   # Public API (re-exports from model/ and ui/)
```

Export only what's needed through `index.ts`. Internal helpers stay private to the segment.


## Intentional Compaction

Intentional compaction is the deliberate compression of context into a minimal, high-signal representation.

Instead of dragging an ever-growing conversation forward, you:

- **Summarize the current state into a markdown artifact**
- **Review and validate it as a human**
- **Start a fresh context seeded with that artifact**
- **What to compact**
  - Relevant files and line ranges
  - Verified architectural behavior
  - Decisions already made
  - Explicit constraints and non-goals
- **What not to compact**
  - Raw logs
  - Tool traces
  - Full file contents
  - Repetitive error explanations
