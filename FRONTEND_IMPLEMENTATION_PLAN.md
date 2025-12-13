# Frontend Implementation Plan - Yield Tokenization Protocol

## Overview

This document outlines the implementation plan for a clean, minimal frontend for the Yield Tokenization Protocol on Starknet. The design prioritizes simplicity, leveraging Starknet's unique capabilities like multicalls for optimal UX.

---

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Package Manager** | Bun | Fast installs, native TS, built-in test runner |
| Framework | Next.js 15 (App Router) | SSR, file-based routing, excellent DX |
| Starknet | starknet.js v9.x | Latest V5 wallet API, multicall support |
| Wallet | get-starknet v5 | Wallet Standard, ArgentX/Braavos support |
| Styling | TailwindCSS | Utility-first, minimal bundle |
| State | TanStack Query v5 | Async state, caching, refetching |
| UI Components | Radix UI primitives | Unstyled, accessible, composable |
| Numbers | bignumber.js | Precise decimal arithmetic |

---

## Tooling & Code Quality

### Package Manager: Bun

Using Bun for fast dependency management and native TypeScript execution.

### Linting & Static Analysis

| Tool | Purpose | Config File |
|------|---------|-------------|
| **ESLint** | Code linting | `eslint.config.mjs` (flat config) |
| **TypeScript** | Type checking (strict mode) | `tsconfig.json` |
| **Prettier** | Code formatting | `.prettierrc` |
| **Biome** | Fast linting + formatting (optional) | `biome.json` |
| **Husky** | Git hooks | `.husky/` |
| **lint-staged** | Pre-commit linting | `.lintstagedrc` |

### ESLint Configuration (Strict)

```javascript
// eslint.config.mjs
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      import: importPlugin,
    },
    rules: {
      // Strict rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // React
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-key': 'error',

      // Imports
      'import/order': ['error', {
        'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        'alphabetize': { order: 'asc' }
      }],
      'import/no-duplicates': 'error',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    ignores: ['node_modules/', '.next/', 'dist/', '*.config.js'],
  }
);
```

### TypeScript Configuration (Strict)

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Prettier Configuration

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### Git Hooks Setup

```json
// .lintstagedrc
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md,css}": [
    "prettier --write"
  ]
}
```

---

## Bun Commands

### Development

```bash
# Install dependencies
bun install

# Run development server
bun dev

# Run with turbo (faster)
bun dev --turbo
```

### Code Quality

```bash
# Type checking
bun run typecheck

# Lint code
bun run lint

# Lint and fix
bun run lint:fix

# Format code
bun run format

# Format check (CI)
bun run format:check

# Run all checks (pre-commit)
bun run check
```

### Build & Production

```bash
# Build for production
bun run build

# Start production server
bun run start

# Analyze bundle
bun run analyze
```

### Testing

```bash
# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

### Utilities

```bash
# Generate contract types from ABIs
bun run codegen

# Export ABIs from contracts
bun run export-abis

# Clean build artifacts
bun run clean
```

### package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:turbo": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --max-warnings 0",
    "lint:fix": "eslint src --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,css}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,json,css}\"",
    "check": "bun run typecheck && bun run lint && bun run format:check",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage",
    "clean": "rm -rf .next node_modules/.cache",
    "codegen": "bun run scripts/generate-types.ts",
    "export-abis": "bun run scripts/export-abis.ts",
    "analyze": "ANALYZE=true next build",
    "prepare": "husky"
  }
}
```

---

## CI/CD Configuration

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Type check
        run: bun run typecheck

      - name: Lint
        run: bun run lint

      - name: Format check
        run: bun run format:check

      - name: Run tests
        run: bun test

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: quality
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build
        run: bun run build
```

### Husky Git Hooks

```bash
# .husky/pre-commit
bun run lint-staged

# .husky/pre-push
bun run typecheck
```

### lint-staged Configuration

```json
// .lintstagedrc
{
  "*.{ts,tsx}": [
    "eslint --fix --max-warnings 0",
    "prettier --write"
  ],
  "*.{json,md,css}": [
    "prettier --write"
  ]
}
```

---

## Project Structure

```
frontend/
├── .husky/
│   ├── pre-commit              # Run lint-staged
│   └── pre-push                # Run typecheck
├── scripts/
│   ├── export-abis.ts          # Extract ABIs from contracts
│   └── generate-types.ts       # Generate TS types from ABIs
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with providers
│   │   ├── page.tsx            # Dashboard (markets overview)
│   │   ├── mint/
│   │   │   └── page.tsx        # Mint PT+YT from SY
│   │   ├── trade/
│   │   │   └── page.tsx        # Swap PT/SY
│   │   ├── pools/
│   │   │   └── page.tsx        # LP management
│   │   └── portfolio/
│   │       └── page.tsx        # User positions & yield claiming
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx      # Nav + wallet connection
│   │   │   └── Container.tsx   # Max-width wrapper
│   │   ├── wallet/
│   │   │   ├── ConnectButton.tsx
│   │   │   ├── WalletModal.tsx
│   │   │   └── AccountDisplay.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── Toast.tsx
│   │   ├── forms/
│   │   │   ├── MintForm.tsx
│   │   │   ├── SwapForm.tsx
│   │   │   ├── AddLiquidityForm.tsx
│   │   │   └── RemoveLiquidityForm.tsx
│   │   ├── display/
│   │   │   ├── TokenAmount.tsx
│   │   │   ├── ImpliedYield.tsx
│   │   │   ├── ExpiryCountdown.tsx
│   │   │   └── TxStatus.tsx
│   │   └── markets/
│   │       ├── MarketCard.tsx
│   │       └── MarketList.tsx
│   ├── hooks/
│   │   ├── useStarknet.ts      # Provider + wallet state
│   │   ├── useAccount.ts       # Connected account
│   │   ├── useContracts.ts     # Contract instances
│   │   ├── useMarkets.ts       # Market data queries
│   │   ├── usePositions.ts     # User balances
│   │   ├── useYield.ts         # Claimable yield
│   │   └── useTransaction.ts   # Tx execution + status
│   ├── lib/
│   │   ├── starknet/
│   │   │   ├── provider.ts     # RpcProvider setup
│   │   │   ├── wallet.ts       # Wallet connection logic
│   │   │   ├── contracts.ts    # Contract instances
│   │   │   └── multicall.ts    # Batch read helpers
│   │   ├── constants/
│   │   │   ├── addresses.ts    # Deployed contract addresses
│   │   │   └── abis/           # Contract ABIs (JSON)
│   │   ├── math/
│   │   │   ├── wad.ts          # WAD (10^18) arithmetic
│   │   │   └── yield.ts        # APY calculations
│   │   └── utils/
│   │       ├── format.ts       # Number/date formatting
│   │       └── time.ts         # Expiry helpers
│   ├── providers/
│   │   ├── StarknetProvider.tsx
│   │   └── QueryProvider.tsx
│   ├── styles/
│   │   └── globals.css         # Tailwind base + custom
│   └── types/
│       └── contracts.ts        # Generated contract types
├── .env.example                # Environment template
├── .env.local                  # Local env (gitignored)
├── .eslintignore
├── .gitignore
├── .lintstagedrc
├── .prettierrc
├── bun.lock
├── eslint.config.mjs           # ESLint flat config
├── next.config.ts
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## Core Features

### 1. Dashboard (Landing Page)

**Route:** `/`

**Purpose:** Protocol overview with available markets

**Data to display:**
- List of active markets (PT/SY pairs)
- For each market:
  - Asset name (e.g., "xSTRK")
  - Expiry date + countdown
  - Implied APY (from `market.get_ln_implied_rate()`)
  - TVL (PT + SY reserves)
- Protocol total TVL

**Implementation:**
```typescript
// Multicall to fetch all market data in one RPC request
const marketData = await Promise.all(
  markets.map(async (market) => {
    const [reserves, lnRate, expiry] = await provider.callContract([
      { contractAddress: market, entrypoint: 'get_reserves' },
      { contractAddress: market, entrypoint: 'get_ln_implied_rate' },
      { contractAddress: market, entrypoint: 'expiry' }
    ]);
    return { market, reserves, lnRate, expiry };
  })
);
```

---

### 2. Mint Page

**Route:** `/mint`

**Purpose:** Deposit SY to receive PT + YT

**User flow:**
1. Select market (SY + expiry)
2. Enter SY amount
3. Preview output (PT + YT amounts)
4. Approve SY (if needed) + Mint in single multicall
5. Show success with TX link

**Key contract call:**
```typescript
// Router.mint_py_from_sy(yt, receiver, amount_sy_in, min_py_out)
const calls = [
  // Approve SY spend (if allowance insufficient)
  syContract.populate('approve', { spender: routerAddress, amount: amountSy }),
  // Mint PT+YT
  routerContract.populate('mint_py_from_sy', {
    yt: ytAddress,
    receiver: userAddress,
    amount_sy_in: amountSy,
    min_py_out: minPyOut // slippage protected
  })
];
const tx = await account.execute(calls);
```

**UI Components:**
- Market selector dropdown
- Amount input with MAX button
- Output preview (PT + YT amounts)
- Slippage settings (optional)
- Submit button with loading state

---

### 3. Trade Page

**Route:** `/trade`

**Purpose:** Swap between PT and SY

**Swap variants:**
- Buy PT with SY: `swap_exact_sy_for_pt` or `swap_sy_for_exact_pt`
- Sell PT for SY: `swap_exact_pt_for_sy` or `swap_pt_for_exact_sy`

**User flow:**
1. Select market
2. Choose direction (Buy PT / Sell PT)
3. Enter amount (input or output)
4. View price impact + implied yield change
5. Approve + Swap in multicall
6. Show result

**Key contract calls:**
```typescript
// Sell exact PT for SY
const calls = [
  ptContract.populate('approve', { spender: routerAddress, amount: ptAmount }),
  routerContract.populate('swap_exact_pt_for_sy', {
    market: marketAddress,
    receiver: userAddress,
    exact_pt_in: ptAmount,
    min_sy_out: minSyOut
  })
];
const tx = await account.execute(calls);
```

**UI Components:**
- Market selector
- Direction toggle (Buy/Sell)
- Input amount with token selector
- Output preview
- Price impact indicator
- Implied APY change preview
- Submit button

---

### 4. Pools Page

**Route:** `/pools`

**Purpose:** Add/remove liquidity from PT/SY pools

**Features:**
- View existing LP positions
- Add liquidity (deposit PT + SY)
- Remove liquidity (withdraw PT + SY)
- View pool APR from fees

**Add Liquidity flow:**
```typescript
const calls = [
  syContract.populate('approve', { spender: routerAddress, amount: syAmount }),
  ptContract.populate('approve', { spender: routerAddress, amount: ptAmount }),
  routerContract.populate('add_liquidity', {
    market: marketAddress,
    receiver: userAddress,
    sy_desired: syAmount,
    pt_desired: ptAmount,
    min_lp_out: minLpOut
  })
];
const tx = await account.execute(calls);
```

**Remove Liquidity flow:**
```typescript
const calls = [
  marketContract.populate('approve', { spender: routerAddress, amount: lpAmount }),
  routerContract.populate('remove_liquidity', {
    market: marketAddress,
    receiver: userAddress,
    lp_to_burn: lpAmount,
    min_sy_out: minSyOut,
    min_pt_out: minPtOut
  })
];
const tx = await account.execute(calls);
```

---

### 5. Portfolio Page

**Route:** `/portfolio`

**Purpose:** View positions and claim yield

**Sections:**
1. **Token Balances**
   - SY balance
   - PT balances (per expiry)
   - YT balances (per expiry)
   - LP positions

2. **Claimable Yield**
   - Pending interest per YT position
   - One-click claim all

3. **Redeemable Positions**
   - Expired PT that can be redeemed
   - PT+YT pairs that can be redeemed

**Multicall for positions (efficient batch read):**
```typescript
// Batch all balance queries in single RPC call
const provider = new RpcProvider({ batch: 0 }); // Auto-batch

const [syBal, ptBal, ytBal, lpBal, pendingYield] = await Promise.all([
  syContract.balanceOf(userAddress),
  ptContract.balanceOf(userAddress),
  ytContract.balanceOf(userAddress),
  marketContract.balanceOf(userAddress),
  ytContract.get_user_interest(userAddress)
]);
```

**Claim yield:**
```typescript
// YT.redeem_due_interest(user) - claims for connected user
const tx = await ytContract.redeem_due_interest(userAddress);
```

**Redeem PT post-expiry:**
```typescript
const calls = [
  ptContract.populate('approve', { spender: routerAddress, amount: ptAmount }),
  routerContract.populate('redeem_pt_post_expiry', {
    yt: ytAddress,
    receiver: userAddress,
    amount_pt_in: ptAmount,
    min_sy_out: minSyOut
  })
];
const tx = await account.execute(calls);
```

---

## Starknet Integration Details

### Wallet Connection (V5 API)

```typescript
// lib/starknet/wallet.ts
import { createStore } from '@starknet-io/get-starknet/discovery';
import { WalletAccountV5 } from 'starknet';

const store = createStore();

export async function connectWallet(nodeUrl: string) {
  const wallets = store.getWallets();

  if (wallets.length === 0) {
    throw new Error('No Starknet wallets found');
  }

  // Let user choose or auto-select first
  const wallet = wallets[0];

  const account = await WalletAccountV5.connect(
    { nodeUrl },
    wallet
  );

  return { wallet, account };
}
```

### Provider Setup

```typescript
// lib/starknet/provider.ts
import { RpcProvider } from 'starknet';

const RPC_URLS = {
  mainnet: 'https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10',
  sepolia: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10'
};

export function createProvider(network: 'mainnet' | 'sepolia') {
  return new RpcProvider({
    nodeUrl: RPC_URLS[network],
    batch: 0 // Enable auto-batching for multicalls
  });
}
```

### Contract Instances

```typescript
// lib/starknet/contracts.ts
import { Contract } from 'starknet';
import { ADDRESSES } from '../constants/addresses';
import RouterAbi from '../constants/abis/router.json';
import MarketAbi from '../constants/abis/market.json';
import SyAbi from '../constants/abis/sy.json';
import PtAbi from '../constants/abis/pt.json';
import YtAbi from '../constants/abis/yt.json';

export function getRouterContract(providerOrAccount: any) {
  return new Contract({
    abi: RouterAbi,
    address: ADDRESSES.ROUTER,
    providerOrAccount
  });
}

export function getMarketContract(address: string, providerOrAccount: any) {
  return new Contract({
    abi: MarketAbi,
    address,
    providerOrAccount
  });
}

// Similar for SY, PT, YT...
```

### Multicall Helper

```typescript
// lib/starknet/multicall.ts
import { RpcProvider } from 'starknet';

export async function batchCall<T extends readonly unknown[]>(
  provider: RpcProvider,
  calls: (() => Promise<unknown>)[]
): Promise<T> {
  // Provider with batch: 0 will automatically batch these
  return Promise.all(calls.map(fn => fn())) as Promise<T>;
}

// Usage:
const [reserves, rate, expiry] = await batchCall(provider, [
  () => market.get_reserves(),
  () => market.get_ln_implied_rate(),
  () => market.expiry()
]);
```

### Transaction Hook

```typescript
// hooks/useTransaction.ts
import { useState } from 'react';
import { useAccount } from './useAccount';
import { useStarknet } from './useStarknet';

type TxStatus = 'idle' | 'signing' | 'pending' | 'success' | 'error';

export function useTransaction() {
  const { account } = useAccount();
  const { provider } = useStarknet();
  const [status, setStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  async function execute(calls: any[]) {
    if (!account) throw new Error('Not connected');

    try {
      setStatus('signing');
      setError(null);

      const result = await account.execute(calls);
      setTxHash(result.transaction_hash);
      setStatus('pending');

      await provider.waitForTransaction(result.transaction_hash);
      setStatus('success');

      return result;
    } catch (err) {
      setError(err as Error);
      setStatus('error');
      throw err;
    }
  }

  function reset() {
    setStatus('idle');
    setTxHash(null);
    setError(null);
  }

  return { execute, status, txHash, error, reset };
}
```

---

## Math Utilities

### WAD Arithmetic

```typescript
// lib/math/wad.ts
import BigNumber from 'bignumber.js';

export const WAD = new BigNumber(10).pow(18);

export function fromWad(value: bigint | string): BigNumber {
  return new BigNumber(value.toString()).dividedBy(WAD);
}

export function toWad(value: number | string): bigint {
  return BigInt(new BigNumber(value).multipliedBy(WAD).toFixed(0));
}

export function formatWad(value: bigint | string, decimals = 4): string {
  return fromWad(value).toFixed(decimals);
}
```

### Implied Yield Calculation

```typescript
// lib/math/yield.ts
import BigNumber from 'bignumber.js';
import { fromWad } from './wad';

// Convert ln(implied_rate) to APY percentage
export function lnRateToApy(lnRate: bigint): BigNumber {
  const rate = fromWad(lnRate);
  // APY = e^(ln_rate) - 1
  const apy = Math.exp(rate.toNumber()) - 1;
  return new BigNumber(apy).multipliedBy(100); // as percentage
}

// Calculate days until expiry
export function daysToExpiry(expiry: number): number {
  const now = Math.floor(Date.now() / 1000);
  const seconds = expiry - now;
  return Math.max(0, seconds / 86400);
}
```

---

## UI Design Principles

### Clean & Minimal

1. **Color Palette:**
   - Background: `#0a0a0a` (near black)
   - Surface: `#141414` (dark gray)
   - Border: `#262626`
   - Text primary: `#fafafa`
   - Text secondary: `#a1a1a1`
   - Accent: `#3b82f6` (blue)
   - Success: `#22c55e`
   - Error: `#ef4444`

2. **Typography:**
   - Font: Inter (system fallback)
   - Headings: semibold
   - Body: regular
   - Monospace for addresses/numbers

3. **Spacing:**
   - Consistent 4px grid
   - Generous whitespace
   - Clear visual hierarchy

4. **Components:**
   - Rounded corners (8px default)
   - Subtle borders
   - No shadows (flat design)
   - Focus states for accessibility

### Example Card Component

```tsx
// components/ui/Card.tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn(
      'bg-neutral-900 border border-neutral-800 rounded-lg p-4',
      className
    )}>
      {children}
    </div>
  );
}
```

---

## Implementation Phases

### Phase 2.1: Project Setup, Tooling & Wallet Connection

**Tasks:**

**A. Project Initialization (Bun + Next.js)**
1. Initialize Next.js 15 project with Bun: `bunx create-next-app@latest`
2. Configure `src/` directory structure
3. Set up path aliases (`@/*` → `./src/*`)

**B. Strict Tooling Setup (MUST be done first)**
4. Configure TypeScript strict mode (`tsconfig.json`)
5. Install and configure ESLint with flat config (`eslint.config.mjs`)
   - typescript-eslint strict + stylistic presets
   - react-hooks plugin
   - import plugin with ordering rules
6. Install and configure Prettier (`.prettierrc`)
   - prettier-plugin-tailwindcss for class sorting
7. Set up Husky + lint-staged for pre-commit hooks
   - `bun run prepare` to initialize husky
   - Pre-commit: lint + format staged files
   - Pre-push: typecheck
8. Verify all quality checks pass: `bun run check`

**C. Styling Setup**
9. Configure Tailwind CSS with dark theme
10. Set up global styles and CSS variables
11. Install Radix UI primitives

**D. Wallet Connection**
12. Install starknet.js v9.x and get-starknet v5
13. Implement Starknet provider context
14. Build wallet connection flow (V5 API)
15. Create Header with connect button
16. Test with ArgentX and Braavos

**Deliverables:**
- Working project scaffold with strict tooling
- All quality checks passing (`bun run check`)
- Git hooks enforcing code quality
- Wallet connects and displays address
- Network detection (mainnet/sepolia)

**Quality Gates (must pass before proceeding):**
- `bun run typecheck` - Zero type errors
- `bun run lint` - Zero lint warnings/errors
- `bun run format:check` - All files formatted

---

### Phase 2.2: Contract Integration

**Tasks:**
1. Export ABIs from compiled contracts
2. Create contract address constants
3. Build contract instance helpers
4. Implement multicall utilities
5. Create React Query hooks for contract reads
6. Set up transaction execution hook

**Deliverables:**
- All contracts accessible from frontend
- Efficient batched reads
- Transaction execution with status tracking

---

### Phase 2.3: Dashboard Page

**Tasks:**
1. Fetch all markets from factory
2. Display market cards with key metrics
3. Implement implied APY calculation
4. Add TVL display
5. Create responsive grid layout
6. Add loading skeletons

**Deliverables:**
- Working dashboard showing all markets
- Real-time data from contracts

---

### Phase 2.4: Mint Page

**Tasks:**
1. Build market selector component
2. Create amount input with validation
3. Implement output preview calculation
4. Build approval + mint multicall
5. Add transaction status feedback
6. Handle errors gracefully

**Deliverables:**
- Users can mint PT+YT from SY
- Single-transaction approval + mint

---

### Phase 2.5: Trade Page

**Tasks:**
1. Implement swap form with direction toggle
2. Calculate price impact
3. Show implied yield change preview
4. Build approval + swap multicall
5. Add slippage settings
6. Transaction feedback

**Deliverables:**
- Users can swap PT/SY
- Clear price impact display

---

### Phase 2.6: Pools Page

**Tasks:**
1. Display user LP positions
2. Build add liquidity form (dual token input)
3. Build remove liquidity form
4. Implement balanced deposit calculation
5. Show pool APR from fees
6. Transaction flows

**Deliverables:**
- Users can manage LP positions
- Clear pool metrics

---

### Phase 2.7: Portfolio Page

**Tasks:**
1. Fetch all user balances (multicall)
2. Display token positions
3. Show claimable yield per YT
4. Implement claim yield action
5. Show redeemable positions
6. Implement redeem flows

**Deliverables:**
- Complete position overview
- One-click yield claiming

---

### Phase 2.8: Polish & Testing

**Tasks:**
1. Mobile responsive design
2. Error boundary implementation
3. Toast notifications
4. Loading states everywhere
5. Accessibility audit
6. Cross-browser testing

**Deliverables:**
- Production-ready UI
- Works on mobile
- Accessible

---

## Contract Entry Points Summary

| Action | Router Function | Approvals Needed |
|--------|----------------|------------------|
| Mint PT+YT | `mint_py_from_sy` | SY → Router |
| Redeem PT+YT | `redeem_py_to_sy` | PT → Router, YT → Router |
| Redeem PT (expired) | `redeem_pt_post_expiry` | PT → Router |
| Claim Yield | `YT.redeem_due_interest` | None |
| Buy PT | `swap_exact_sy_for_pt` | SY → Router |
| Sell PT | `swap_exact_pt_for_sy` | PT → Router |
| Add Liquidity | `add_liquidity` | SY → Router, PT → Router |
| Remove Liquidity | `remove_liquidity` | LP (Market) → Router |

---

## Events to Index (Future)

For historical data and analytics:

```
// From YT
MintPY { caller, receiver, amount_sy_deposited, amount_py_minted }
RedeemPY { caller, receiver, amount_py_redeemed, amount_sy_returned }
InterestClaimed { user, amount_sy }

// From Market
Mint { sender, receiver, sy_amount, pt_amount, lp_amount }
Burn { sender, receiver, lp_amount, sy_amount, pt_amount }
Swap { sender, receiver, pt_in, sy_in, pt_out, sy_out, fee }

// From Factory
YieldContractsCreated { sy, expiry, pt, yt, creator }
MarketCreated { pt, market, creator }
```

---

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_NETWORK=sepolia              # or mainnet
NEXT_PUBLIC_RPC_URL=https://...          # RPC endpoint
NEXT_PUBLIC_ROUTER_ADDRESS=0x...
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x...
```

---

## File Checklist

### Priority 0 (Tooling & Config - MUST be first)
- [x] `package.json` with all scripts
- [x] `tsconfig.json` (strict mode)
- [x] `eslint.config.mjs` (flat config, strict rules)
- [x] `.prettierrc`
- [x] `.lintstagedrc`
- [x] `.husky/pre-commit`
- [x] `.husky/pre-push`
- [x] `tailwind.config.ts`
- [x] `next.config.ts`
- [x] `.env.example`
- [x] `.gitignore`
- [x] `.github/workflows/frontend-ci.yml` (CI pipeline)
- [x] `.github/workflows/frontend-deploy.yml` (Vercel deployment)

### Priority 1 (Core Application)
- [x] `src/app/layout.tsx`
- [x] `src/app/page.tsx` (dashboard placeholder)
- [x] `src/providers/StarknetProvider.tsx`
- [x] `src/providers/QueryProvider.tsx`
- [x] `src/hooks/useStarknet.ts`
- [x] `src/hooks/useAccount.ts`
- [x] `src/lib/starknet/provider.ts`
- [x] `src/lib/starknet/wallet.ts`
- [x] `src/components/wallet/ConnectButton.tsx`
- [x] `src/components/layout/Header.tsx`

### Priority 2 (Contract Integration)
- [x] `src/lib/constants/addresses.ts`
- [x] `src/lib/constants/abis.ts` (imports from @contracts via webpack alias)
- [x] `src/lib/starknet/contracts.ts`
- [x] `src/hooks/useContracts.ts`
- [x] `src/hooks/useTransaction.ts`
- [x] `src/lib/math/wad.ts`
- [x] `src/lib/math/yield.ts`
- [x] ~~`scripts/export-abis.ts`~~ (not needed - using direct @contracts imports)
- [ ] `scripts/generate-types.ts`

### Priority 3 (Pages)
- [ ] `src/app/mint/page.tsx`
- [ ] `src/app/trade/page.tsx`
- [ ] `src/app/pools/page.tsx`
- [ ] `src/app/portfolio/page.tsx`

### Priority 4 (Components)
- [x] `src/components/ui/Button.tsx`
- [x] `src/components/ui/Card.tsx`
- [x] `src/components/ui/Skeleton.tsx`
- [ ] `src/components/ui/*` (remaining base components: Input, Modal, Toast)
- [ ] `src/components/forms/*` (all form components)
- [x] `src/components/display/TokenAmount.tsx`
- [x] `src/components/display/ExpiryCountdown.tsx`
- [ ] `src/components/display/*` (remaining: TxStatus, ImpliedYield)
- [x] `src/components/markets/MarketCard.tsx`
- [x] `src/components/markets/MarketList.tsx`
- [x] `src/components/markets/StatsOverview.tsx`

### Priority 5 (Hooks & Types)
- [x] `src/hooks/useMarket.ts`
- [x] `src/hooks/useMarkets.ts`
- [x] `src/types/market.ts`
- [ ] `src/hooks/usePositions.ts`
- [ ] `src/hooks/useYield.ts`

---

## Success Criteria

### Code Quality (Non-negotiable)
1. **Zero TypeScript errors**: `bun run typecheck` passes
2. **Zero lint warnings**: `bun run lint` passes with `--max-warnings 0`
3. **Consistent formatting**: `bun run format:check` passes
4. **Git hooks active**: Pre-commit runs lint-staged, pre-push runs typecheck
5. **No `any` types**: Strict TypeScript throughout
6. **No unused variables**: All imports and variables used

### Functionality
7. **Wallet Connection**: Users can connect ArgentX/Braavos
8. **Mint**: Users can deposit SY and receive PT+YT
9. **Trade**: Users can swap PT/SY with slippage protection
10. **Liquidity**: Users can add/remove LP
11. **Portfolio**: Users can view positions and claim yield
12. **Multicall**: All approve+action flows use single transaction

### UX
13. **Responsive**: Works on desktop and mobile
14. **Minimal**: Clean UI, no unnecessary elements
15. **Fast**: No unnecessary re-renders, efficient data fetching
