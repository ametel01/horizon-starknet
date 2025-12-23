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
bun test src/lib/math/amm.test.ts  # Run specific test
bun run codegen               # Generate TypeScript types from contract ABIs
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

### Directory Structure

```
src/
├── app/              # Next.js App Router pages
├── components/       # React components
│   ├── ui/           # Base UI (shadcn)
│   ├── forms/        # Transaction forms (MintForm, SwapForm, etc.)
│   ├── markets/      # Market display components
│   └── layout/       # Header, Footer, Navigation
├── hooks/            # Custom React hooks (data fetching, mutations)
├── lib/              # Core utilities
│   ├── starknet/     # Contract interactions, provider, wallet
│   ├── math/         # WAD fixed-point math, AMM calculations
│   └── constants/    # Network addresses, config
├── providers/        # React context providers
├── contexts/         # Global state (transaction settings, UI mode)
└── types/            # TypeScript types
    └── generated/    # Auto-generated from contract ABIs
```

### Data Flow Pattern

User action → Hook (useSwap, useMint) → Starknet contract call → Wallet signature → Transaction → React Query invalidation → UI update

All blockchain data flows through typed contracts and React Query for caching.

### Key Patterns

**Type-Safe Contracts:**
```typescript
// Auto-generated types from ABIs using abi-wan-kanabi
import { ROUTER_ABI } from '@/types/generated';
const router = new Contract(ROUTER_ABI, address, provider).typedv2(ROUTER_ABI);
await router.mint_py_from_sy(...);  // Full TypeScript support
```

**WAD Fixed-Point Math (10^18):**
```typescript
import { WAD, fromWad, toWad, wadMul, formatWad } from '@/lib/math/wad';
const value = 1000000000000000000n;  // 1 WAD
formatWad(value);  // "1.0000"
```

**Hook Pattern:**
```typescript
// Data fetching with React Query
export function useMarkets() {
  return useQuery({ queryKey: ['markets'], queryFn: fetchMarketData });
}

// Mutations for transactions
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

### UI Mode System

Two UI modes for different users:
- **Simple Mode**: Beginner-friendly, hides technical details
- **Advanced Mode**: Full protocol features

```typescript
const { isSimple } = useUIMode();
```

### Transaction Settings Context

Global slippage and deadline settings:
```typescript
const { slippageBps, deadlineMinutes } = useTransactionSettings();
```

## Code Patterns

### Contract Error Handling

All contract errors use `HZN:` prefix for parsing:
```typescript
const CONTRACT_ERROR_MESSAGES = {
  'HZN: slippage exceeded': 'Price moved beyond slippage tolerance.',
  'HZN: expired': 'This position has expired.',
};
```

### Path Aliases

- `@/*` → `src/*`
- `@contracts/*` → `../../contracts/*`
- `@deploy/*` → `../../deploy/*`

## Type Generation Workflow

After updating Cairo contracts:
```bash
cd ../..              # Go to repo root
make build            # Build contracts (generates ABI JSON)
cd packages/frontend
bun run codegen       # Generate TypeScript types from ABIs
```


MANDATORY: Use shadcn/ui Components
All new components **MUST** use the shadcn/ui library. An MCP server is available for component discovery and installation.
