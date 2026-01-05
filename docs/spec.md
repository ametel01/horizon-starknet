I'll create a comprehensive technical specification for the Horizon Protocol codebase. Let me start by exploring the project structure in depth.Good, I've launched background agents to explore the main components. While they work, let me explore the root-level files and configurations directly.Let me read the key configuration files and root documentation:Excellent! Now let me read the documentation files and check on the agent outputs:The agents are still running. Let me continue gathering more direct information while waiting:Now let me read the key contract files to understand the core interfaces and implementations:Let me now check on the agent outputs and gather additional information about the errors library, math library, and testing:Excellent! The contracts agent has completed. Let me now check on the other agents and gather remaining information:Now I have comprehensive information from all agents. Let me update my progress and compile the final technical specification:Now let me compile the complete technical specification document:

---

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
| **Testing** | Starknet Foundry | 0.54.0 | Contract unit & fuzz testing |
| **Frontend** | Next.js | 16.1.1 | React-based dApp |
| **Runtime** | Bun | 1.x | JavaScript/TypeScript runtime |
| **Indexer** | Apibara | 1.x | Starknet event indexing |
| **Database** | PostgreSQL | 15+ | Event storage & analytics |
| **ORM** | Drizzle ORM | 0.31+ | Type-safe database queries |
| **State Management** | TanStack Query | 5.x | Server state caching |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS |

### 1.4 Current State & Maturity Level

- **Status**: Alpha on Starknet Mainnet
- **License**: BSL-1.1 (converts to GPL-3.0 on 2028-12-19)
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
│                    (33 event tables, 15 views)                  │
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
  - `mint_py_from_sy()` (lines 229-277)
  - `redeem_py_to_sy()` (lines 279-315)
  - `swap_exact_sy_for_pt()` (lines 459-504)
  - `swap_exact_sy_for_yt()` (lines 736-802) - Flash swap mechanism
- **Dependencies**: Factory, YT, Market contracts
- **Security**: ReentrancyGuard, PausableComponent

#### 2.2.2 Factory Contract
- **File**: `contracts/src/factory.cairo`
- **Purpose**: Deploy PT/YT token pairs for SY tokens
- **Responsibilities**:
  - Deterministic PT/YT deployment via `deploy_syscall`
  - Registry of valid PT/YT addresses
  - Treasury address management
  - SYWithRewards deployment
- **Key Functions**:
  - `create_yield_contracts()` (lines 173-278)
  - `deploy_sy_with_rewards()` (lines 358-442)
  - `set_treasury()` (lines 457-461)
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
  - `swap_exact_*()` - Four swap variants
  - `observe()` - TWAP oracle queries
- **AMM Curve**: Logit-based with time decay (rates increase toward expiry)

### 2.3 Layer Architecture

#### Presentation Layer (Frontend)
- **Technology**: Next.js 16 with App Router
- **Pattern**: Feature-Sliced Design (FSD)
- **Structure**:
  ```
  app/           → Route handlers (pages)
  page-compositions/ → Page-specific orchestration
  widgets/       → Complex UI compositions
  features/      → User interactions (swap, mint, etc.)
  entities/      → Domain models (market, position)
  shared/        → UI components, utilities
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
- **33 event tables** tracking all contract events
- **15 materialized views** for analytics
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
│   │   ├── tokens/              # SY, PT, YT implementations
│   │   ├── market/              # AMM and MarketFactory
│   │   ├── libraries/           # math, errors, roles
│   │   ├── interfaces/          # Contract interfaces
│   │   ├── components/          # Reusable Cairo components
│   │   ├── oracles/             # Pragma TWAP oracle integration
│   │   └── mocks/               # Test infrastructure
│   ├── tests/                   # 45 test files
│   └── Scarb.toml               # Package config
│
├── packages/
│   ├── frontend/                # Next.js 16 dApp
│   │   ├── src/
│   │   │   ├── app/             # App Router pages
│   │   │   ├── features/        # FSD feature modules
│   │   │   ├── entities/        # Domain models
│   │   │   ├── shared/          # Utilities, components
│   │   │   └── providers/       # Context providers
│   │   ├── e2e/                 # Playwright tests
│   │   └── package.json
│   │
│   └── indexer/                 # Apibara event indexer
│       ├── src/
│       │   ├── indexers/        # 6 event indexers
│       │   ├── schema/          # Drizzle ORM schema
│       │   └── lib/             # Utilities
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
├── .tool-versions               # pinned tool versions
└── CLAUDE.md                    # AI assistant guidance
```

### 3.2 Key Files Deep Dive

#### Smart Contract Core Files

| File | Purpose | Key Lines |
|------|---------|-----------|
| `contracts/src/router.cairo` | User entry point | `mint_py_from_sy`: 229-277, `swap_exact_sy_for_yt`: 736-802 |
| `contracts/src/factory.cairo` | PT/YT deployment | `create_yield_contracts`: 173-278 |
| `contracts/src/tokens/yt.cairo` | Yield token logic | Interface at `i_yt.cairo` |
| `contracts/src/market/amm.cairo` | PT/SY AMM | TWAP oracle at IMarketOracle |
| `contracts/src/libraries/math.cairo` | WAD math | `wad_mul`: 25-68, `wad_div`: 92-119 |
| `contracts/src/libraries/errors.cairo` | Error codes | 103 error constants |

#### Frontend Core Files

| File | Purpose | Key Lines |
|------|---------|-----------|
| `packages/frontend/src/app/layout.tsx` | Root layout | Provider composition: 103-130 |
| `packages/frontend/src/providers/StarknetProvider.tsx` | Wallet context | Provider setup: 38-146 |
| `packages/frontend/src/features/swap/model/useSwap.ts` | Swap mutation | Full hook: 70-294 |
| `packages/frontend/src/shared/math/wad.ts` | WAD utilities | Core functions: 1-141 |
| `packages/frontend/src/shared/starknet/contracts.ts` | Typed contracts | Contract getters: 44-79 |

#### Indexer Core Files

| File | Purpose | Key Lines |
|------|---------|-----------|
| `packages/indexer/src/schema/index.ts` | DB schema | 33 tables: 31-1290, 15 views: 1488-2126 |
| `packages/indexer/src/indexers/factory.indexer.ts` | Factory events | Event processing: 113-262 |
| `packages/indexer/src/lib/database.ts` | PostgreSQL pool | Pool config: 26-109 |
| `packages/indexer/src/lib/utils.ts` | Event parsing | `readU256`: 37-66 |

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
      staleTime: 60_000,              // 1 minute
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

#### Key Materialized Views
| View | Purpose | Refresh Strategy |
|------|---------|------------------|
| `market_daily_stats` | Daily TVL, volume, fees | Periodic refresh |
| `market_current_state` | Latest state per market | Periodic refresh |
| `user_positions_summary` | Aggregated user positions | Periodic refresh |
| `protocol_daily_stats` | Protocol-wide metrics | Periodic refresh |

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
    fn add_liquidity(market, receiver, sy_desired, pt_desired, min_lp, deadline) -> (u256, u256, u256);
    fn remove_liquidity(market, receiver, lp_to_burn, min_sy, min_pt, deadline) -> (u256, u256);
    
    // Swaps
    fn swap_exact_sy_for_pt(market, receiver, sy_in, min_pt_out, deadline) -> u256;
    fn swap_exact_pt_for_sy(market, receiver, pt_in, min_sy_out, deadline) -> u256;
    fn swap_exact_sy_for_yt(yt, market, receiver, sy_in, min_yt_out, deadline) -> u256;
    fn swap_exact_yt_for_sy(yt, market, receiver, yt_in, max_sy_collateral, min_sy_out, deadline) -> u256;
}
```

#### IMarket (AMM)
```cairo
trait IMarket<TContractState> {
    fn sy() -> ContractAddress;
    fn pt() -> ContractAddress;
    fn expiry() -> u64;
    fn get_reserves() -> (u256, u256);
    fn swap_exact_pt_for_sy(receiver, exact_pt_in, min_sy_out) -> u256;
    fn swap_exact_sy_for_pt(receiver, exact_sy_in, min_pt_out) -> u256;
    fn mint(receiver, sy_desired, pt_desired) -> (u256, u256, u256);
    fn burn(receiver, lp_to_burn) -> (u256, u256);
}

trait IMarketOracle<TContractState> {
    fn observe(seconds_agos: Array<u32>) -> Array<u256>;
    fn get_observation(index: u16) -> (u64, u256, bool);
}
```

### 5.2 Frontend API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/markets` | GET | List markets with filters |
| `/api/markets/[address]` | GET | Market details |
| `/api/users/[address]/positions` | GET | User positions |
| `/api/users/[address]/yield` | GET | Claimable yield |
| `/api/analytics/*` | GET | Protocol analytics |

#### Example: Markets API
```typescript
// packages/frontend/src/app/api/markets/route.ts:138-200
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const network = searchParams.get('network') ?? 'mainnet';
  const expiredFilter = searchParams.get('expired');
  
  // Query indexed data
  const markets = await db.query.marketCurrentState.findMany({
    where: expiredFilter ? eq(schema.marketCurrentState.is_expired, true) : undefined,
    orderBy: desc(schema.marketCurrentState.created_at),
  });
  
  return NextResponse.json(markets);
}
```

### 5.3 Contract Interaction Patterns

#### Typed Contract Calls (Frontend)
```typescript
// packages/frontend/src/shared/starknet/contracts.ts
import { TypedContractV2 } from 'starknet';
import { Abi } from '@contracts/abis/Router.json';

export type TypedRouter = TypedContractV2<typeof Abi>;

export function getRouterContract(
  account: Account,
  network: NetworkId
): TypedRouter {
  const address = getAddresses(network).router;
  return new Contract(Abi, address, account) as TypedRouter;
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
starknet-foundry 0.54.0
starkli 0.4.2
```

### 6.2 Smart Contract Configuration

#### Scarb.toml
```toml
[package]
name = "horizon"
version = "0.2.0"

[dependencies]
starknet = "=2.15.0"
openzeppelin_access = "0.23.0"
openzeppelin_token = "0.23.0"
openzeppelin_upgrades = "0.23.0"
openzeppelin_security = "0.23.0"

[[target.starknet-contract]]
sierra = true
build-external-contracts = ["snforge_std"]
```

### 6.3 Frontend Configuration

#### Environment Variables
```bash
# packages/frontend/.env.local
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_ALCHEMY_RPC_URL=https://starknet-mainnet.g.alchemy.com/v2/...
DATABASE_URL=postgresql://...
SENTRY_DSN=https://...
```

#### Next.js Config
```typescript
// packages/frontend/next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    turbo: {}, // Turbopack enabled
    inlineCss: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Sentry integration for error tracking
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
HEALTH_PORT=8080
```

#### Apibara Presets
```typescript
// packages/indexer/apibara.config.ts
presets: {
  mainnet: {
    startingBlock: 4_643_300,
    streamUrl: "https://mainnet.starknet.a5a.ch"
  },
  sepolia: {
    startingBlock: 4_194_445,
    streamUrl: "https://sepolia.starknet.a5a.ch"
  },
  devnet: {
    startingBlock: 0,
    streamUrl: "http://localhost:7171"
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
    "Factory": "0x...",
    "MarketFactory": "0x...",
    "Router": "0x...",
    "SY": "0x...",
    "PT": "0x...",
    "YT": "0x...",
    "Market": "0x..."
  },
  "contracts": {
    "Factory": "0x04fd6d42...",
    "MarketFactory": "0x0465bc42...",
    "Router": "0x07ccd371..."
  }
}
```

---

## 7. Dependencies & Integrations

### 7.1 Smart Contract Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `starknet` | 2.15.0 | Core Starknet types |
| `openzeppelin_access` | 0.23.0 | Ownable, AccessControl |
| `openzeppelin_token` | 0.23.0 | ERC20 implementation |
| `openzeppelin_upgrades` | 0.23.0 | Contract upgradeability |
| `openzeppelin_security` | 0.23.0 | ReentrancyGuard, Pausable |
| `snforge_std` | (dev) | Testing framework |

### 7.2 Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.1 | React framework |
| `react` | 19.2.3 | UI library |
| `starknet` | 9.2.1 | Blockchain SDK |
| `@tanstack/react-query` | 5.90.16 | Server state |
| `tailwindcss` | 4.1.18 | Styling |
| `@radix-ui/*` | various | UI primitives |
| `bignumber.js` | 9.3.1 | Precision math |
| `cairo-fp` | 1.0.0 | Fixed-point math |
| `recharts` | 3.6.0 | Charts |
| `abi-wan-kanabi` | (codegen) | Type generation |

### 7.3 Indexer Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@apibara/indexer` | 1.x | Event streaming |
| `drizzle-orm` | 0.31+ | Database ORM |
| `pg` | 8.x | PostgreSQL driver |
| `zod` | 3.x | Schema validation |
| `pino` | 8.x | Structured logging |

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

#### Test Organization (45 files)
```
contracts/tests/
├── tokens/               # 10 tests (SY, PT, YT variations)
├── market/               # 8 tests (AMM, fees, expiry)
├── router/               # 2 tests (core, YT swaps)
├── math/                 # 6 tests (WAD, market math, oracle)
├── oracles/              # 3 tests (Pragma, mocks)
├── integration/          # 4 tests (full flows, edge cases)
├── security/             # 2 tests (reentrancy, errors)
└── fuzz/                 # 2 tests (market math)
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

fn mint_and_mint_py(setup, amount) {
    // Helper for minting test tokens
}
```

### 8.2 Frontend Tests

#### Test Organization (13 files)
- **Unit Tests**: WAD math, AMM calculations, deadline, errors
- **Integration Tests**: useMarkets, useSwap, useMint hooks
- **Component Tests**: SwapForm, MintForm

#### Testing Tools
- `bun test` - Built-in test runner
- `@testing-library/react` - Component testing
- `happy-dom` - DOM emulation
- `playwright` - E2E tests

### 8.3 Indexer Tests

#### Test Organization (15 files)
- **Unit Tests**: utils, validation, env, errors, health, metrics
- **Integration Tests**: All 6 indexers (factory, market-factory, router, sy, yt, market)
- **Cross-cutting**: idempotency.test.ts (reorg handling)

#### Test Framework
- Vitest with 60s timeout
- Inline Apibara packages for isolation

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
bun run test                              # All tests
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

    // SY errors (7)
    pub const SY_INVALID_TOKEN_IN: felt252 = 'HZN: invalid token_in';
    
    // YT errors (9)
    pub const YT_EXPIRED: felt252 = 'HZN: expired';
    pub const YT_NOT_EXPIRED: felt252 = 'HZN: not expired';
    
    // Market errors (10)
    pub const MARKET_SLIPPAGE_EXCEEDED: felt252 = 'HZN: slippage exceeded';
    
    // Math errors (3)
    pub const MATH_OVERFLOW: felt252 = 'HZN: overflow';
    
    // Oracle errors (8)
    pub const ORACLE_TARGET_TOO_OLD: felt252 = 'HZN: oracle target too old';
    
    // Total: 103 error constants
}
```

### 9.2 Frontend Error Handling

#### Contract Error Parsing
```typescript
// packages/frontend/src/shared/lib/errors.ts
const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  'HZN: slippage exceeded': 'Price moved beyond slippage tolerance.',
  'HZN: expired': 'This position has expired.',
  'HZN: deadline exceeded': 'Transaction took too long.',
};

export function parseContractError(error: unknown): string {
  const message = extractErrorMessage(error);
  return CONTRACT_ERROR_MESSAGES[message] ?? `Transaction failed: ${message}`;
}
```

### 9.3 Indexer Error Classification

```typescript
// packages/indexer/src/lib/errors.ts
export class DataError extends Error {
  constructor(message: string, public readonly context?: unknown) {
    super(message);
    this.name = 'DataError';
  }
}

export class ParseError extends DataError {
  constructor(message: string, public readonly index: number) {
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

// Usage in indexers:
if (isDataError(err)) {
  log.warn({ err }, 'Skipping malformed event');
} else {
  throw err; // Crash on programmer error
}
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

// Per-indexer child loggers
export const createIndexerLogger = (name: string) =>
  logger.child({ indexer: name });
```

#### Frontend Logging
- Development: Console with React DevTools
- Production: Sentry error tracking

---

## 10. Security Considerations

### 10.1 Smart Contract Security

#### Access Control
- **RBAC**: OpenZeppelin AccessControl with roles
  - `DEFAULT_ADMIN_ROLE`: Full access
  - `PAUSER_ROLE`: Emergency pause
  - `OPERATOR_ROLE`: Config updates
- **Ownership**: OwnableComponent for upgrade control

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
```typescript
// packages/frontend/src/shared/security/SecureScript.tsx
// Implements nonce-based CSP for inline scripts
```

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
- API routes implement rate limiting
- Configurable per-endpoint

---

## 11. Performance Considerations

### 11.1 Smart Contract Optimizations

#### WAD Math
- Split multiplication for overflow safety (`math.cairo:25-68`)
- Lazy division for large remainders
- Precomputed constants (WAD_E, WAD_LN2)

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

#### Data Fetching
- TanStack Query with 1-minute stale time
- Optimistic UI updates
- Parallel query execution

### 11.3 Indexer Optimizations

#### Database
- One table per event type (no contention)
- Strategic indexes per query pattern
- Materialized views for analytics

#### Processing
- Batch inserts with `onConflictDoNothing`
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
bun run check                  # typecheck + lint + format
bun run codegen                # Generate types from ABIs
```

#### Indexer
```bash
cd packages/indexer
bun run dev                    # Local devnet
bun run dev:mainnet            # Mainnet
bun run db:migrate             # Run migrations
bun run db:studio              # Drizzle Studio GUI
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

---I've completed the comprehensive technical specification document for the Horizon Protocol codebase. The document covers all 12 sections as requested:

## Summary

This technical specification provides an **exhaustive reference** for the Horizon Protocol - a Pendle-style yield tokenization protocol on Starknet. Here are the key highlights:

### Codebase Overview
- **52 Cairo source files** implementing the smart contract layer
- **45 contract test files** with unit, integration, fuzz, and security tests
- **~150 TypeScript files** in the frontend (Next.js 16 with FSD architecture)
- **33 event tables + 15 materialized views** in the indexer database schema
- **6 independent event indexers** processing contract events

### Architecture Highlights
| Component | Technology | Key Files |
|-----------|------------|-----------|
| Smart Contracts | Cairo 2.x | `router.cairo`, `factory.cairo`, `yt.cairo`, `amm.cairo` |
| Frontend | Next.js 16 + React 19 | FSD structure: `features/`, `entities/`, `shared/` |
| Indexer | Apibara + PostgreSQL + Drizzle | `schema/index.ts` (2127 lines), 6 indexer files |
| Deployment | Shell scripts + sncast | `deploy.sh`, `upgrade.sh`, per-network JSON configs |

### Critical File References
- **Router entry point**: `contracts/src/router.cairo:229-802` (core user operations)
- **YT token logic**: `contracts/src/tokens/yt.cairo` + `i_yt.cairo` interface
- **AMM math**: `contracts/src/market/market_math_fp.cairo` (Pendle V2 formulas)
- **Frontend swap hook**: `packages/frontend/src/features/swap/model/useSwap.ts:70-294`
- **Indexer schema**: `packages/indexer/src/schema/index.ts:31-2127`

### Key Architectural Patterns
1. **Floating Token Pattern** - Pre-transfer tokens, detect via balance difference
2. **Watermark Index** - Monotonic PY index prevents stale price exploitation
3. **Pendle V2 AMM** - Logit-based curve with time decay toward expiry
4. **One Table Per Event** - Indexer isolation for parallel processing

This document serves as the **authoritative technical reference** for developers working on, maintaining, or integrating with the Horizon Protocol codebase.