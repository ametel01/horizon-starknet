# Horizon Protocol - Technical Specification

## 1. Executive Summary

### 1.1 Project Overview

Horizon Protocol is a **Pendle-style yield tokenization protocol** built on Starknet. It enables users to split yield-bearing assets into two separate tokens: **Principal Tokens (PT)** representing the underlying principal and **Yield Tokens (YT)** representing the accrued yield until an expiry date. This mechanism enables:

- **Fixed yield strategies**: Lock in a fixed return by purchasing PT at a discount
- **Yield speculation**: Go long on yield by purchasing YT
- **Liquidity provision**: Earn swap fees by providing liquidity to PT/SY AMM markets

The protocol wraps yield-bearing assets into **Standardized Yield (SY)** tokens, which serve as a uniform interface for any yield-generating asset (stETH, aUSDC, ERC-4626 vaults, etc.). Users interact primarily through a **Router** contract that provides slippage protection and deadline-based transaction safety.

### 1.2 Primary Use Cases & Target Users

| User Type | Primary Actions | Value Proposition |
|-----------|-----------------|-------------------|
| **Fixed Yield Seekers** | Buy PT at discount, hold until expiry | Guaranteed return regardless of rate fluctuations |
| **Yield Speculators** | Buy YT, collect accruing interest | Leveraged exposure to yield (cost of YT << underlying) |
| **Liquidity Providers** | Add PT/SY to AMM markets | Earn swap fees, time-decay benefits |
| **Arbitrageurs** | Exploit PT/YT price mismatches | Maintain market efficiency |
| **DeFi Protocols** | Integrate fixed-rate lending | Offer predictable yields to users |

### 1.3 Technology Stack Overview

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Smart Contracts** | Cairo | 2.x | Starknet native contracts |
| **Build System** | Scarb | 2.15.0 | Package manager & compiler |
| **Testing** | Starknet Foundry | 0.54.1 | Contract unit & fuzz testing |
| **Frontend** | Next.js | 16.1.1 | React-based dApp |
| **Runtime** | Bun | 1.x | JavaScript/TypeScript runtime |
| **Indexer** | Apibara | 2.1.0-beta.47 | Starknet event indexing |
| **Database** | PostgreSQL | 15+ | Event storage & analytics |
| **ORM** | Drizzle ORM | 0.45.1 | Type-safe database queries |
| **State Management** | TanStack Query | 5.90.16 | Server state caching |
| **Styling** | Tailwind CSS | 4.1.18 | Utility-first CSS |

### 1.4 Current State & Maturity Level

- **Status**: Alpha on Starknet Mainnet
- **License**: BUSL-1.1 (converts to GPL-3.0 on 2028-12-19)
- **Mainnet Deployment**: December 23, 2025
- **Active Markets**: 1 (hrzSTRK - mock staked STRK)
- **Test Networks**: Devnet (local), Sepolia testnet

---

## 2. System Architecture

### 2.1 High-Level Design

The system follows a **layered architecture** with three main tiers:

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                  Next.js 16 dApp (React 19)                    │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         INDEXER LAYER                           │
│              Apibara + PostgreSQL + Drizzle ORM                │
│                    (40 event tables, 23 views)                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SMART CONTRACT LAYER                         │
│                                                                 │
│  ┌─────────┐   ┌─────────────┐   ┌────────────────┐            │
│  │ Router  │──▶│   Factory   │──▶│ SY / PT / YT   │            │
│  │(Gateway)│   │(Deployment) │   │   (Tokens)     │            │
│  └─────────┘   └─────────────┘   └────────────────┘            │
│       │                                    │                    │
│       ▼                                    ▼                    │
│  ┌─────────────┐              ┌────────────────────┐           │
│  │MarketFactory│─────────────▶│ Market (PT/SY AMM) │           │
│  └─────────────┘              └────────────────────┘           │
│                                        │                        │
│                                        ▼                        │
│                            ┌───────────────────┐               │
│                            │   Oracle Layer    │               │
│                            │ (Pragma TWAP/ERC4626)│            │
│                            └───────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

**Architecture Style**: Component-based monorepo with clear separation:
- Smart contracts: Standalone Cairo workspace
- Frontend: Next.js with Feature-Sliced Design (FSD)
- Indexer: Independent service with its own database

### 2.2 Component Breakdown

#### 2.2.1 Router Contract
- **File**: `contracts/src/router.cairo`
- **Purpose**: User-facing entry point for all protocol operations
- **Responsibilities**:
  - Transfer tokens on behalf of users
  - Apply slippage protection (min_out parameters)
  - Enforce deadline checks
  - Provide combined operations (YT flash swaps)
- **Key Functions**:
  - `mint_py_from_sy()` (line 229)
  - `redeem_py_to_sy()` (line 279)
  - `swap_exact_sy_for_pt()` (line 459)
  - `swap_exact_sy_for_yt()` (line 736) - Flash swap mechanism
- **Dependencies**: Factory, YT, Market contracts
- **Security**: ReentrancyGuard, PausableComponent, AccessControlComponent

#### 2.2.2 Factory Contract
- **File**: `contracts/src/factory.cairo`
- **Purpose**: Deploy PT/YT token pairs for SY tokens
- **Responsibilities**:
  - Deterministic PT/YT deployment via `deploy_syscall`
  - Registry of valid PT/YT addresses
  - Treasury address management
  - SYWithRewards deployment
- **Key Functions**:
  - `create_yield_contracts()` (line 173)
  - `deploy_sy_with_rewards()`
  - `set_treasury()`
- **Storage**: PT/YT registries, class hashes, treasury

#### 2.2.3 MarketFactory Contract
- **File**: `contracts/src/market/market_factory.cairo`
- **Purpose**: Deploy PT/SY AMM markets
- **Responsibilities**:
  - Market deployment with AMM parameters
  - Default/override fee management
  - Treasury configuration for reserve fees
- **Key Functions**:
  - `create_market()` - Deploy with scalar_root, initial_anchor, fee params
  - `set_fee_override()` - Per-router fee overrides
- **Storage**: Market registry, market list, fee configs

#### 2.2.4 SY Token (Standardized Yield)
- **File**: `contracts/src/tokens/sy.cairo`
- **Purpose**: ERC20 wrapper standardizing yield-bearing assets
- **Responsibilities**:
  - Wrap/unwrap underlying yield tokens
  - Track exchange rate (underlying per SY)
  - Support multiple deposit/redemption tokens
  - Detect negative yield (watermark pattern)
- **Key Functions**:
  - `deposit()` - Wrap underlying for SY
  - `redeem()` - Burn SY for underlying
  - `exchange_rate()` - Current rate from oracle
- **Architecture**: Uses SYComponent for reusable logic

#### 2.2.5 PT Token (Principal Token)
- **File**: `contracts/src/tokens/pt.cairo`
- **Purpose**: Redeemable 1:1 for SY at/after expiry
- **Responsibilities**:
  - ERC20 functionality
  - Restricted minting (only YT contract)
  - Expiry tracking
- **Key Property**: PT value converges to 1 SY at expiry

#### 2.2.6 YT Token (Yield Token)
- **File**: `contracts/src/tokens/yt.cairo`
- **Purpose**: Accrues yield until expiry, then worthless
- **Responsibilities**:
  - Mint PT+YT from SY (1:1 ratio)
  - Track per-user yield accrual
  - Handle pre/post-expiry redemption
  - Protocol fee on yield claims
  - Post-expiry yield to treasury
- **Key Functions**:
  - `mint_py()` - Create PT+YT from floating SY
  - `redeem_py()` - Burn PT+YT for SY (pre-expiry)
  - `redeem_py_post_expiry()` - PT-only redemption (post-expiry)
  - `redeem_due_interest()` - Claim accrued yield
  - `mint_py_multi()` / `redeem_py_multi()` - Batch operations
- **Storage**: PY index tracking, user interest maps, treasury

#### 2.2.7 Market (PT/SY AMM)
- **File**: `contracts/src/market/amm.cairo`
- **Purpose**: Automated market maker for PT/SY trading
- **Responsibilities**:
  - LP token minting/burning
  - Swap execution with Pendle V2 curve
  - Time-decay rate adjustments
  - TWAP oracle for implied rates
- **Key Functions**:
  - `mint()` / `burn()` - LP operations
  - `swap_exact_pt_for_sy()`, `swap_exact_sy_for_pt()`, `swap_sy_for_exact_pt()`, `swap_pt_for_exact_sy()` - Four swap variants
  - `observe()` - TWAP oracle queries
- **AMM Curve**: Logit-based with time decay (rates increase toward expiry)

### 2.3 Layer Architecture

#### Presentation Layer (Frontend)
- **Technology**: Next.js 16 with App Router
- **Pattern**: Feature-Sliced Design (FSD)
- **Structure**:
  ```
  app/               → Route handlers (pages)
  page-compositions/ → Page-specific orchestration
  widgets/           → Complex UI compositions
  features/          → User interactions (swap, mint, etc.)
  entities/          → Domain models (market, position)
  shared/            → UI components, utilities
  ```

#### Business Logic Layer (Smart Contracts)
- **Core Flow**:
  1. User calls Router with approvals
  2. Router transfers tokens, calls underlying contracts
  3. Factory/MarketFactory deploy new contracts
  4. YT manages PT/YT lifecycle
  5. Market handles AMM operations

#### Data Access Layer (Indexer)
- **Pattern**: Event sourcing with one table per event type
- **40 event tables** tracking all contract events
- **23 views** for analytics (9 materialized, 14 enriched/aggregated)
- **Architecture**: 6 independent indexers (Factory, MarketFactory, Router, SY, YT, Market)

#### Infrastructure Layer
- **PostgreSQL**: Event storage
- **Drizzle ORM**: Type-safe queries
- **Apibara DNA**: Starknet event streaming
- **Health checks**: HTTP endpoints for Kubernetes

---

## 3. Codebase Structure

### 3.1 Directory Layout

```
horizon-starknet/
├── contracts/                   # Cairo smart contracts
│   ├── src/
│   │   ├── factory.cairo        # PT/YT factory
│   │   ├── router.cairo         # User entry point
│   │   ├── tokens/              # SY, PT, YT, SY with rewards
│   │   ├── market/              # AMM and MarketFactory
│   │   ├── libraries/           # math, math_fp, errors, roles, oracle_lib
│   │   ├── interfaces/          # 13 interface files
│   │   ├── components/          # sy_component, reward_manager_component
│   │   ├── oracles/             # pragma_index_oracle, py_lp_oracle
│   │   └── mocks/               # Test infrastructure
│   ├── tests/                   # 48 test files
│   └── Scarb.toml               # Package config
│
├── packages/
│   ├── frontend/                # Next.js 16 dApp
│   │   ├── src/
│   │   │   ├── app/             # App Router pages
│   │   │   ├── page-compositions/ # Page orchestration
│   │   │   ├── features/        # FSD feature modules
│   │   │   ├── entities/        # Domain models
│   │   │   ├── shared/          # Utilities, components
│   │   │   └── providers/       # Context providers
│   │   ├── e2e/                 # Playwright tests (3 files)
│   │   └── package.json
│   │
│   └── indexer/                 # Apibara event indexer
│       ├── src/
│       │   ├── indexers/        # 6 event indexers
│       │   ├── schema/          # Drizzle ORM schema
│       │   └── lib/             # Utilities
│       ├── tests/               # 15 test files
│       ├── drizzle/             # DB migrations
│       └── package.json
│
├── deploy/                      # Deployment scripts
│   ├── scripts/                 # Shell scripts
│   ├── addresses/               # Deployed addresses JSON
│   └── accounts/                # sncast account configs
│
├── docs/                        # Protocol documentation
├── Makefile                     # Development commands
├── .tool-versions               # Pinned tool versions
└── CLAUDE.md                    # AI assistant guidance
```

### 3.2 Key Files Deep Dive

#### Smart Contract Core Files

| File | Purpose | Key Lines |
|------|---------|-----------|
| `contracts/src/router.cairo` | User entry point | `mint_py_from_sy`: 229, `swap_exact_sy_for_yt`: 736 |
| `contracts/src/factory.cairo` | PT/YT deployment | `create_yield_contracts`: 173 |
| `contracts/src/tokens/yt.cairo` | Yield token logic | Interface at `interfaces/i_yt.cairo` |
| `contracts/src/market/amm.cairo` | PT/SY AMM | TWAP oracle via IMarketOracle |
| `contracts/src/libraries/math.cairo` | WAD math | `wad_mul`: 25, `wad_div`: 92 |
| `contracts/src/libraries/errors.cairo` | Error codes | 56 error constants (103 lines) |

#### Frontend Core Files

| File | Purpose | Key Lines |
|------|---------|-----------|
| `packages/frontend/src/providers/index.tsx` | Provider composition | Lines 1-29 |
| `packages/frontend/src/providers/StarknetProvider.tsx` | Wallet context | Lines 1-146 |
| `packages/frontend/src/features/swap/model/useSwap.ts` | Swap mutation | Lines 70-294 (316 total) |
| `packages/frontend/src/shared/math/wad.ts` | WAD utilities | Lines 1-140 |
| `packages/frontend/src/shared/starknet/contracts.ts` | Typed contracts | Contract getters |

#### Indexer Core Files

| File | Purpose | Key Lines |
|------|---------|-----------|
| `packages/indexer/src/schema/index.ts` | DB schema | 2126 lines total |
| `packages/indexer/src/indexers/factory.indexer.ts` | Factory events | Event processing |
| `packages/indexer/src/lib/database.ts` | PostgreSQL pool | Pool config |
| `packages/indexer/src/lib/errors.ts` | Error classification | Lines 1-113 |

---

## 4. Data Models & State Management

### 4.1 Smart Contract Data Models

#### SY Token Storage
```cairo
struct Storage {
    underlying: ContractAddress,      // Yield-bearing token
    index_oracle: ContractAddress,    // Exchange rate source
    is_erc4626: bool,                 // Oracle type flag
    tokens_in: Map<ContractAddress, bool>,   // Valid deposits
    tokens_out: Map<ContractAddress, bool>,  // Valid redemptions
    last_exchange_rate: u256,         // For events
}
```

#### YT Token Storage
```cairo
struct Storage {
    sy: ContractAddress,
    pt: ContractAddress,
    expiry: u64,
    py_index_stored: u256,            // Watermark (monotonic)
    py_index_at_expiry: u256,         // Frozen at expiry
    user_py_index: Map<ContractAddress, u256>,
    user_interest: Map<ContractAddress, u256>,
    sy_reserve: u256,                 // Expected SY balance
    interest_fee_rate: u256,          // Protocol fee (WAD)
    treasury: ContractAddress,
}
```

#### Market Storage
```cairo
struct Storage {
    sy: ContractAddress,
    pt: ContractAddress,
    yt: ContractAddress,
    factory: ContractAddress,
    sy_reserve: u256,
    pt_reserve: u256,
    scalar_root: u256,                // Rate sensitivity
    initial_anchor: u256,             // Starting ln(rate)
    ln_fee_rate_root: u256,           // Swap fee
    reserve_fee_percent: u8,          // Treasury fee %
    last_ln_implied_rate: u256,
    observations: Map<u16, Observation>, // TWAP ring buffer
    observation_index: u16,
    observation_cardinality: u16,
    observation_cardinality_next: u16,
}
```

### 4.2 Frontend State Management

#### Provider Hierarchy
```typescript
ThemeProvider (next-themes)
  └── QueryProvider (TanStack Query)
      └── StarknetProvider (custom context)
          └── UIModeProvider
              └── TransactionSettingsProvider
```

#### TanStack Query Configuration
```typescript
// packages/frontend/src/providers/QueryProvider.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,           // 1 minute
      refetchOnWindowFocus: false,
      retry: 1,
      structuralSharing: false,       // BigInt compatibility
    },
  },
});
```

#### Query Key Patterns
```typescript
['market', address, network]
['token-balance', tokenAddress, userAddress]
['positions', userAddress, marketAddresses]
['marketFactory', 'activeMarketsPaginated', network]
```

### 4.3 Indexer Database Schema

#### Event Table Pattern
```typescript
// All event tables follow this pattern
export const marketSwap = pgTable('market_swap', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  // Block context
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  event_index: integer('event_index').notNull(),
  // Indexed keys
  sender: text('sender').notNull(),
  receiver: text('receiver').notNull(),
  // Event data
  pt_in: numeric('pt_in', { precision: 78, scale: 0 }).notNull(),
  sy_out: numeric('sy_out', { precision: 78, scale: 0 }).notNull(),
  // ...
}, (table) => [
  uniqueIndex('market_swap_event_key').on(
    table.block_number,
    table.transaction_hash,
    table.event_index
  ),
]);
```

#### View Categories (23 total)
| Category | Views | Purpose |
|----------|-------|---------|
| Enriched Router Views | 6 | Join router events with token metadata |
| Aggregated Materialized | 9 | Daily stats, current state, user positions |
| SY Monitoring Views | 4 | Rewards, pause state, negative yield alerts |
| YT Interest Analytics | 4 | Fee analytics, treasury summary, batch ops |

---

## 5. APIs & Interfaces

### 5.1 Smart Contract Interfaces

#### IRouter (User Entry Point)
```cairo
trait IRouter<TContractState> {
    // PT/YT Minting & Redemption
    fn mint_py_from_sy(yt, receiver, amount_sy_in, min_py_out, deadline) -> (u256, u256);
    fn redeem_py_to_sy(yt, receiver, amount_py_in, min_sy_out, deadline) -> u256;
    fn redeem_pt_post_expiry(yt, receiver, amount_pt_in, min_sy_out, deadline) -> u256;
    
    // Market Operations
    fn add_liquidity(market, receiver, sy_desired, pt_desired, min_lp_out, deadline) -> (u256, u256, u256);
    fn remove_liquidity(market, receiver, lp_to_burn, min_sy_out, min_pt_out, deadline) -> (u256, u256);
    
    // Swaps (4 PT variants)
    fn swap_exact_sy_for_pt(market, receiver, exact_sy_in, min_pt_out, deadline) -> u256;
    fn swap_exact_pt_for_sy(market, receiver, exact_pt_in, min_sy_out, deadline) -> u256;
    fn swap_sy_for_exact_pt(market, receiver, exact_pt_out, max_sy_in, deadline) -> u256;
    fn swap_pt_for_exact_sy(market, receiver, exact_sy_out, max_pt_in, deadline) -> u256;
    
    // YT Swaps (flash mechanism)
    fn swap_exact_sy_for_yt(yt, market, receiver, exact_sy_in, min_yt_out, deadline) -> u256;
    fn swap_exact_yt_for_sy(yt, market, receiver, exact_yt_in, max_sy_collateral, min_sy_out, deadline) -> u256;
    
    // Combined operations
    fn mint_py_and_keep(yt, market, receiver, amount_sy_in, min_pt_out, deadline) -> (u256, u256);
    
    // Admin
    fn pause();
    fn unpause();
    fn initialize_rbac();
}
```

#### IMarket (AMM)
```cairo
trait IMarket<TContractState> {
    fn sy() -> ContractAddress;
    fn pt() -> ContractAddress;
    fn yt() -> ContractAddress;
    fn expiry() -> u64;
    fn is_expired() -> bool;
    fn get_reserves() -> (u256, u256);
    fn mint(receiver, sy_desired, pt_desired) -> (u256, u256, u256);
    fn burn(receiver, lp_to_burn) -> (u256, u256);
    fn swap_exact_pt_for_sy(receiver, exact_pt_in, min_sy_out) -> u256;
    fn swap_sy_for_exact_pt(receiver, exact_pt_out, max_sy_in) -> u256;
    fn swap_exact_sy_for_pt(receiver, exact_sy_in, min_pt_out) -> u256;
    fn swap_pt_for_exact_sy(receiver, exact_sy_out, max_pt_in) -> u256;
}

trait IMarketOracle<TContractState> {
    fn observe(seconds_agos: Array<u32>) -> Array<u256>;
    fn get_observation(index: u16) -> (u64, u256, bool);
    fn get_ln_implied_rate() -> u256;
}
```

#### IFactory
```cairo
trait IFactory<TContractState> {
    fn create_yield_contracts(sy, expiry) -> (ContractAddress, ContractAddress);
    fn get_pt(sy, expiry) -> ContractAddress;
    fn get_yt(sy, expiry) -> ContractAddress;
    fn is_valid_pt(pt) -> bool;
    fn is_valid_yt(yt) -> bool;
    fn deploy_sy_with_rewards(...) -> ContractAddress;
    fn is_valid_sy(sy) -> bool;
    fn treasury() -> ContractAddress;
    fn set_treasury(treasury);
}
```

### 5.2 Frontend API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/markets` | GET | List markets with filters |
| `/api/markets/[address]` | GET | Market details |
| `/api/markets/[address]/price-impact` | GET | Price impact calculation |
| `/api/markets/[address]/rates` | GET | Implied/realized rates |
| `/api/markets/[address]/tvl` | GET | Total value locked |
| `/api/users/[address]/positions` | GET | User positions |
| `/api/users/[address]/yield` | GET | Claimable yield |
| `/api/portfolio/[address]` | GET | Portfolio summary |
| `/api/analytics/*` | GET | Protocol analytics |
| `/api/sy/[address]` | GET | SY token info |
| `/api/yt/[address]` | GET | YT token info |
| `/api/health` | GET | Health check |

### 5.3 Contract Interaction Patterns

#### Typed Contract Calls (Frontend)
```typescript
// packages/frontend/src/shared/starknet/contracts.ts
import { Contract } from 'starknet';

export function getRouterContract(account: Account, network: NetworkId) {
  const address = getAddresses(network).router;
  return new Contract(RouterAbi, address, account);
}

// Usage:
const router = getRouterContract(account, network);
await router.mint_py_from_sy(ytAddress, receiver, amount, minOut, deadline);
```

---

## 6. Configuration & Environment

### 6.1 Tool Versions (Pinned)

```
# .tool-versions
scarb 2.15.0
starknet-foundry 0.54.1
starkli 0.4.2
```

### 6.2 Smart Contract Configuration

#### Scarb.toml
```toml
[package]
name = "horizon"
version = "2.0.0"
edition = "2024_07"
license = "BUSL-1.1"

[dependencies]
starknet = "2.15.0"
openzeppelin_token = { git = "https://github.com/OpenZeppelin/cairo-contracts.git", tag = "v3.0.0" }
openzeppelin_access = { git = "https://github.com/OpenZeppelin/cairo-contracts.git", tag = "v3.0.0" }
openzeppelin_upgrades = { git = "https://github.com/OpenZeppelin/cairo-contracts.git", tag = "v3.0.0" }
openzeppelin_interfaces = { git = "https://github.com/OpenZeppelin/cairo-contracts.git", tag = "v3.0.0" }
openzeppelin_security = { git = "https://github.com/OpenZeppelin/cairo-contracts.git", tag = "v3.0.0" }
openzeppelin_introspection = { git = "https://github.com/OpenZeppelin/cairo-contracts.git", tag = "v3.0.0" }
cairo_fp = "1.0.0"

[dev-dependencies]
snforge_std = "0.54.1"
assert_macros = "2.15.0"

[[target.starknet-contract]]
sierra = true
```

### 6.3 Frontend Configuration

#### Environment Variables
```bash
# packages/frontend/.env.local
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_ALCHEMY_RPC_URL=https://starknet-mainnet.g.alchemy.com/v2/...
DATABASE_URL=postgresql://...
SENTRY_ORG=...
SENTRY_PROJECT=...
```

#### Next.js Config
```typescript
// packages/frontend/next.config.ts
const nextConfig: NextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  experimental: {
    inlineCss: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  turbopack: {
    resolveAlias: {
      '@contracts': '../../contracts/target/dev',
      '@deploy': '../../deploy',
      '@indexer': '../indexer/src',
    },
  },
};
```

### 6.4 Indexer Configuration

#### Environment Variables
```bash
# packages/indexer/.env
POSTGRES_CONNECTION_STRING=postgresql://...
DNA_STREAM_URL=https://mainnet.starknet.a5a.ch
DNA_TOKEN=dna_xxx
LOG_LEVEL=info
```

#### Apibara Presets
```typescript
// packages/indexer/apibara.config.ts
presets: {
  mainnet: {
    runtimeConfig: {
      network: "mainnet",
      starknet: {
        startingBlock: 4_643_300,  // Horizon mainnet deployment (2025-12-23)
        streamUrl: "https://mainnet.starknet.a5a.ch"
      }
    }
  },
  sepolia: {
    runtimeConfig: {
      network: "sepolia",
      starknet: {
        startingBlock: 4_194_445,
        streamUrl: "https://sepolia.starknet.a5a.ch"
      }
    }
  },
  devnet: {
    runtimeConfig: {
      network: "devnet",
      starknet: {
        startingBlock: 0,
        streamUrl: "http://localhost:7171"
      }
    }
  }
}
```

### 6.5 Deployment Configuration

#### Network Addresses
```json
// deploy/addresses/mainnet.json
{
  "network": "mainnet",
  "deployedAt": "2025-12-23T02:39:30Z",
  "classHashes": {
    "Factory": "0x005921264692808caa488f923c150adf41cdf2fe1c3e31e9d8e7ada78375235e",
    "MarketFactory": "0x05145ba825bbe074dc6555991031b8662bbf802acbdb3bfbe3991e5191dbe15d",
    "Router": "0x021464597c63d680b420af2731de902d9e4e19c7fd7410eaa93e5d09d6d01ac7"
  },
  "contracts": {
    "Factory": "0x04fd6d42072f76612ae0a5f97d191ab4c5ede3688d2df0185352e01b7f2fc444",
    "MarketFactory": "0x0465bc423ddde2495e9d4c31563e0b333d9c8b818a86d3d76064fd652ee4be6f",
    "Router": "0x07ccd371e51703e562cf7c7789d4252b7a63845dc87f25a07cf8b5c28e80563b"
  }
}
```

---

## 7. Dependencies & Integrations

### 7.1 Smart Contract Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `starknet` | 2.15.0 | Core Starknet types |
| `openzeppelin_access` | v3.0.0 | Ownable, AccessControl |
| `openzeppelin_token` | v3.0.0 | ERC20 implementation |
| `openzeppelin_upgrades` | v3.0.0 | Contract upgradeability |
| `openzeppelin_security` | v3.0.0 | ReentrancyGuard, Pausable |
| `openzeppelin_introspection` | v3.0.0 | SRC5 interface detection |
| `cairo_fp` | 1.0.0 | Fixed-point math library |
| `snforge_std` | 0.54.1 (dev) | Testing framework |

### 7.2 Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^16.1.1 | React framework |
| `react` | ^19.2.3 | UI library |
| `starknet` | ^9.2.1 | Blockchain SDK |
| `@tanstack/react-query` | ^5.90.16 | Server state |
| `tailwindcss` | ^4.1.18 | Styling |
| `@radix-ui/*` | various | UI primitives |
| `bignumber.js` | ^9.3.1 | Precision math |
| `cairo-fp` | ^1.0.0 | Fixed-point math |
| `recharts` | ^3.6.0 | Charts |
| `abi-wan-kanabi` | ^2.2.4 (dev) | Type generation |
| `@sentry/nextjs` | ^10.32.1 | Error tracking |

### 7.3 Indexer Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@apibara/indexer` | ^2.1.0-beta.47 | Event streaming |
| `@apibara/starknet` | ^2.1.0-beta.47 | Starknet types |
| `drizzle-orm` | 0.45.1 | Database ORM |
| `pg` | ^8.16.3 | PostgreSQL driver |
| `pino` | ^10.1.0 | Structured logging |
| `zod` | ^4.3.4 | Schema validation |
| `vitest` | ^4.0.16 (dev) | Test framework |

### 7.4 External Service Integrations

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Starknet RPC** | Blockchain access | Alchemy endpoints |
| **Apibara DNA** | Event streaming | Self-hosted or cloud |
| **PostgreSQL** | Data persistence | Self-hosted or cloud |
| **Sentry** | Error tracking | Frontend only |
| **Pragma Oracle** | Price feeds | On-chain integration |

---

## 8. Testing Strategy

### 8.1 Smart Contract Tests

#### Test Organization (48 files)
```
contracts/tests/
├── tokens/               # 10 tests (SY, PT, YT, rewards, fees, interest)
├── market/               # 8 tests (AMM, fees, expiry, invariants, oracle)
├── router/               # 2 tests (core, YT swaps)
├── math/                 # 6 tests (WAD, market math, oracle lib)
├── oracles/              # 3 tests (Pragma, mocks, py_lp_oracle)
├── integration/          # 4 tests (full flows, edge cases, expiry)
├── security/             # 2 tests (reentrancy, errors)
├── fuzz/                 # 2 tests (market math)
└── [module files]        # 11 module aggregators
```

#### Test Utilities
```cairo
// contracts/tests/utils.cairo
fn admin() -> ContractAddress { /* Account #0 */ }
fn user1() -> ContractAddress { /* Account #1 */ }
fn treasury() -> ContractAddress { /* Account #5 */ }

fn setup_full() -> SetupResult {
    // Deploy mock tokens, SY, PT/YT, Market
}
```

### 8.2 Frontend Tests

#### Test Organization (14 unit test files)
- **Math Tests**: wad.test.ts, amm.test.ts, apy-breakdown.test.ts
- **Hook Tests**: useSwap.test.ts, useMint.test.ts, useMarkets.test.ts, useTokenBalance.test.ts
- **Component Tests**: SwapForm.test.ts, MintForm.test.ts
- **Utility Tests**: deadline.test.ts, errors.test.ts, utils.test.ts
- **Infrastructure Tests**: rate-limit.test.ts, useExpiryStatus.test.ts

#### E2E Tests (3 files)
- `e2e/fixtures.ts` - Test fixtures
- `e2e/markets.spec.ts` - Market interaction tests
- `e2e/navigation.spec.ts` - Navigation tests

#### Testing Tools
- `bun test` - Built-in test runner
- `@testing-library/react` - Component testing
- `happy-dom` - DOM emulation
- `@playwright/test` - E2E tests

### 8.3 Indexer Tests

#### Test Organization (15 files)
- **Unit Tests**: utils.test.ts, validation.test.ts, env.test.ts, errors.test.ts, health.test.ts, metrics.test.ts, shutdown.test.ts, version.test.ts
- **Integration Tests**: factory.test.ts, market-factory.test.ts, router.test.ts, sy.test.ts, yt.test.ts, market.test.ts
- **Cross-cutting**: idempotency.test.ts (reorg handling)

#### Test Framework
- Vitest with configurable timeout
- PGlite for in-memory database testing

### 8.4 Test Commands

```bash
# Contracts
cd contracts && snforge test              # All tests
cd contracts && snforge test test_name    # Specific test

# Frontend
cd packages/frontend
bun run test                              # Unit tests
bun run test:e2e                          # Playwright E2E

# Indexer
cd packages/indexer
bun run test                              # All tests (vitest)
bun run test:watch                        # Watch mode
```

---

## 9. Error Handling & Logging

### 9.1 Smart Contract Errors

#### Error Module (`contracts/src/libraries/errors.cairo`)
```cairo
pub mod Errors {
    // General (3)
    pub const ZERO_ADDRESS: felt252 = 'HZN: zero address';
    pub const ZERO_AMOUNT: felt252 = 'HZN: zero amount';
    pub const UNAUTHORIZED: felt252 = 'HZN: unauthorized';

    // SY errors (9)
    pub const SY_INVALID_TOKEN_IN: felt252 = 'HZN: invalid token_in';
    
    // PT errors (5)
    pub const PT_ONLY_YT: felt252 = 'HZN: only YT';
    
    // YT errors (13)
    pub const YT_EXPIRED: felt252 = 'HZN: expired';
    pub const YT_NOT_EXPIRED: felt252 = 'HZN: not expired';
    
    // Market errors (11)
    pub const MARKET_SLIPPAGE_EXCEEDED: felt252 = 'HZN: slippage exceeded';
    
    // Router errors (2)
    pub const ROUTER_DEADLINE_EXCEEDED: felt252 = 'HZN: deadline exceeded';
    
    // Math errors (3)
    pub const MATH_OVERFLOW: felt252 = 'HZN: overflow';
    
    // Oracle errors (7)
    pub const ORACLE_TARGET_TOO_OLD: felt252 = 'HZN: oracle target too old';
    
    // Pragma Oracle errors (10)
    pub const PIO_ZERO_ADMIN: felt252 = 'HZN: zero admin';
    
    // Reward errors (3)
    pub const REWARD_EMPTY_TOKENS: felt252 = 'HZN: empty reward tokens';
    
    // Total: 56 error constants
}
```

### 9.2 Frontend Error Handling

#### Contract Error Parsing
```typescript
// packages/frontend/src/shared/lib/errors.ts
const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  'HZN: slippage exceeded': 'Price moved beyond slippage tolerance. Try again.',
  'HZN: expired': 'This position has expired.',
  'HZN: deadline exceeded': 'Transaction deadline exceeded. Please try again.',
  // ... 50+ mapped error messages
};

export function parseContractError(error: unknown): string {
  const message = extractErrorMessage(error);
  return CONTRACT_ERROR_MESSAGES[message] ?? `Transaction failed: ${message}`;
}

// Specialized error checks
export function isDeadlineError(error: unknown): boolean;
export function isSlippageError(error: unknown): boolean;
```

### 9.3 Indexer Error Classification

```typescript
// packages/indexer/src/lib/errors.ts
export class ParseError extends Error {
  constructor(message: string, public readonly context: ParseErrorContext) {
    super(message);
    this.name = 'ParseError';
  }
}

export class InvariantError extends Error {
  constructor(message: string) {
    super(`Invariant violation: ${message}`);
    this.name = 'InvariantError';
  }
}

export class DataError extends Error {
  constructor(message: string, public readonly event?: unknown) {
    super(message);
    this.name = 'DataError';
  }
}

// Classification helpers
export function isProgrammerError(err: unknown): boolean;  // Should crash
export function isDataError(err: unknown): boolean;        // Should log & skip
```

### 9.4 Logging Systems

#### Indexer Logging (Pino)
```typescript
// packages/indexer/src/lib/logger.ts
export const logger = pino({
  level: env.LOG_LEVEL ?? 'info',
  redact: ['connectionString', 'password', 'secret', 'token'],
  transport: env.LOG_PRETTY ? { target: 'pino-pretty' } : undefined,
});
```

#### Frontend Logging
- Development: Console with React DevTools
- Production: Sentry error tracking with source maps

---

## 10. Security Considerations

### 10.1 Smart Contract Security

#### Access Control
- **RBAC**: OpenZeppelin AccessControl with roles
  - `DEFAULT_ADMIN_ROLE`: Full access
  - `PAUSER_ROLE`: Emergency pause
- **Ownership**: OwnableComponent for upgrade control
- **RBAC Initialization**: One-time `initialize_rbac()` call

#### Reentrancy Protection
- All state-changing functions use ReentrancyGuard
- Storage updated before external calls
- Tested in `tests/security/test_reentrancy.cairo`

#### Upgradeability
- All core contracts upgradeable (Factory, MarketFactory, Router, SY, PT, YT, Market)
- Uses OpenZeppelin UpgradeableComponent
- Owner can call `upgrade(new_class_hash)`

#### Input Validation
- Deadline checks on all Router operations
- Slippage protection via min_out parameters
- Zero-amount and zero-address checks

### 10.2 Frontend Security

#### Content Security
- CSP with dynamic nonce support
- Security headers set in proxy layer

#### Transaction Safety
- All transactions include deadline (default: 5 minutes)
- Configurable slippage tolerance
- Preview functions before execution

### 10.3 Indexer Security

#### Database
- Connection pooling with limits
- Prepared statements (SQL injection prevention)
- Read-only materialized views for analytics

#### Rate Limiting
- API routes implement rate limiting via Upstash Redis
- Configurable per-endpoint

---

## 11. Performance Considerations

### 11.1 Smart Contract Optimizations

#### WAD Math
- Split multiplication for overflow safety (`math.cairo:25-67`)
- Lazy division for large remainders
- Precomputed constants (WAD_E, WAD_LN2, WAD_INV_LN2)

#### Storage Efficiency
- Packed storage where possible
- Lazy initialization patterns
- Minimal storage writes per transaction

#### AMM Curve
- O(1) swap calculations
- Pre-computed rate anchors
- Efficient TWAP ring buffer (max 8760 observations)

### 11.2 Frontend Optimizations

#### Bundle Size
- Tree-shaking enabled
- Dynamic imports for heavy components
- AVIF/WebP image formats
- Inline CSS for faster first paint

#### Data Fetching
- TanStack Query with 1-minute stale time
- Optimistic UI updates
- Parallel query execution
- Structural sharing disabled for BigInt compatibility

### 11.3 Indexer Optimizations

#### Database
- One table per event type (no contention)
- Strategic indexes per query pattern
- Materialized views for analytics with periodic refresh

#### Processing
- Batch inserts with `onConflictDoNothing` for idempotency
- Per-indexer parallelism
- Configurable pool sizes

---

## 12. Development Workflow

### 12.1 Local Development Setup

```bash
# 1. Clone and install dependencies
git clone <repo>
cd horizon-starknet
bun install

# 2. Start local devnet
make dev-up        # Docker compose: devnet + mock oracle

# 3. Deploy contracts (automatic with dev-up)
# Or manually: ./deploy/scripts/deploy.sh devnet

# 4. Start frontend
cd packages/frontend
bun run dev        # http://localhost:3000

# 5. Start indexer
cd packages/indexer
bun run dev        # Indexes from local devnet
```

### 12.2 Build Commands

#### Contracts
```bash
cd contracts
scarb build                    # Compile
snforge test                   # Run tests
scarb fmt                      # Format code
```

#### Frontend
```bash
cd packages/frontend
bun install                    # Install deps
bun run dev                    # Dev server
bun run build                  # Production build
bun run check                  # typecheck + lint + format:check
bun run codegen                # Generate types from ABIs
bun run test                   # Unit tests
bun run test:e2e               # Playwright E2E
```

#### Indexer
```bash
cd packages/indexer
bun run dev                    # Local devnet
bun run dev:mainnet            # Mainnet
bun run db:migrate             # Run migrations
bun run db:studio              # Drizzle Studio GUI
bun run db:refresh-views       # Refresh materialized views
bun run test                   # Run tests
```

### 12.3 Deployment

```bash
# Declare and deploy to network
./deploy/scripts/deploy.sh devnet|sepolia|mainnet

# Export addresses for frontend
./deploy/scripts/export-addresses.sh devnet|sepolia|mainnet

# Upgrade contracts
./deploy/scripts/upgrade.sh sepolia --contract Router
```

### 12.4 Code Quality

```bash
# Contracts
cd contracts && scarb fmt

# Frontend/Indexer
bun run format                 # Biome format
bun run lint                   # Biome lint
bun run check                  # All checks
```

---

`★ Insight ─────────────────────────────────────`
**Key Architectural Patterns in Horizon Protocol:**

1. **Floating Token Pattern**: Router transfers tokens directly to YT/PT contracts before calling `mint_py()`. The contracts detect "floating" tokens via balance difference (`get_floating_sy()`), avoiding excessive approvals.

2. **Watermark Index Mechanism**: PY index tracks cumulative SY exchange rate as a monotonically increasing watermark. This prevents stale price exploitation and enables proper yield attribution per user.

3. **Pendle V2 AMM Curve**: Logit-based formula with time decay - as expiry approaches, rate sensitivity increases (scalar scales with 1/timeToExpiry). This naturally converges PT price to 1 SY at expiry.

4. **One Table Per Event**: Indexer schema isolates each event type to its own table, enabling independent scaling, parallel processing, and clean reorg handling with idempotent inserts.
`─────────────────────────────────────────────────`

---

## Summary

This technical specification provides a comprehensive reference for the Horizon Protocol. Key metrics:

### Codebase Overview
- **38 Cairo source files** in `contracts/src/`
- **48 contract test files** with unit, integration, fuzz, and security tests
- **14 frontend unit test files** + 3 E2E test files
- **40 event tables + 23 views** in the indexer database schema
- **6 independent event indexers** processing contract events
- **15 indexer test files**

### Architecture Highlights
| Component | Technology | Key Files |
|-----------|------------|-----------|
| Smart Contracts | Cairo 2.x | `router.cairo`, `factory.cairo`, `yt.cairo`, `amm.cairo` |
| Frontend | Next.js 16 + React 19 | FSD structure: `features/`, `entities/`, `shared/` |
| Indexer | Apibara + PostgreSQL + Drizzle | `schema/index.ts` (2126 lines), 6 indexer files |
| Deployment | Shell scripts + sncast | `deploy.sh`, `upgrade.sh`, per-network JSON configs |

### Critical File References
- **Router entry point**: `contracts/src/router.cairo` (lines 229, 279, 459, 736 for key functions)
- **YT token logic**: `contracts/src/tokens/yt.cairo` + `interfaces/i_yt.cairo`
- **AMM math**: `contracts/src/market/market_math_fp.cairo` (Pendle V2 formulas)
- **Frontend swap hook**: `packages/frontend/src/features/swap/model/useSwap.ts` (316 lines)
- **Indexer schema**: `packages/indexer/src/schema/index.ts` (2126 lines)
