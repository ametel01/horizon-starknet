# Horizon Protocol: Research Artifact

> Produced from direct code analysis and team interviews. Last updated: 2025-12-29 (synced with IMPLEMENTATION_PLAN.md)

## Design Philosophy

**"Simplicity is intentional."** v1 is deliberately minimal and expandable. The protocol prioritizes:

1. **Correctness over features**: Ship a working yield tokenization system first
2. **Pendle compatibility**: Mental model is "Pendle on Starknet", adapted for Cairo
3. **Composability**: PT/YT/Market are non-upgradeable to enable safe third-party integrations
4. **Conservative parameters**: Start with 3-6 month expiries, fixed market defaults, expand based on learnings

---

## Executive Summary

Horizon is a **Pendle-style yield tokenization protocol** on Starknet that splits yield-bearing assets into tradeable Principal Tokens (PT) and Yield Tokens (YT). The system enables fixed yield strategies and yield speculation through a logit-based AMM.

---

## 1. Core Token System

### Token Hierarchy

```
Underlying Asset (e.g., nstSTRK from Nostra)
        │
        │ deposit to SY
        ▼
   SY (Standardized Yield)
        │
        │ mint_py (1 SY → 1 PT + 1 YT)
        ▼
   ┌────┴────┐
   │         │
  PT        YT
(Principal) (Yield)
```

### 1.1 SY (Standardized Yield Token)

**Source**: `contracts/src/tokens/sy.cairo`

**Purpose**: Wraps yield-bearing assets into a standardized interface. 1 SY = 1 share of the underlying vault.

**Key Implementation Details**:
- **Exchange Rate Sources**: Two modes controlled by `is_erc4626` flag
  - ERC-4626 vaults: Calls `convert_to_assets(WAD)` directly on the vault
  - Custom oracles: Calls `index()` on a separate `IIndexOracle` implementation
- **Deposit/Redeem**: 1:1 with underlying shares (NOT assets)
- **Oracle Rate Tracking**: Emits `OracleRateUpdated` event when exchange rate changes (tracks in basis points)
- **Access Control**: PAUSER_ROLE can pause deposits; owner can upgrade

**Critical Invariant**: SY is 1:1 with underlying shares, the exchange rate only reflects the underlying vault's rate.

### 1.2 PT (Principal Token)

**Source**: `contracts/src/tokens/pt.cairo`

**Purpose**: Represents the principal portion. Redeemable 1:1 for SY at or after expiry.

**Key Implementation Details**:
- **Minting/Burning**: Only callable by the YT contract (enforced by `assert_only_yt()`)
- **Initialization Pattern**: PT is deployed by YT, then YT calls `initialize_yt()` to set the circular reference
- **Anti-frontrunning**: Only the deployer (YT) can call `initialize_yt()`, stored in `deployer` field
- **Expiry Check**: `is_expired()` returns true when `block_timestamp >= expiry`

### 1.3 YT (Yield Token)

**Source**: `contracts/src/tokens/yt.cairo`

**Purpose**: Represents yield rights until expiry. YT holders accrue interest from the underlying's rate appreciation.

**Key Implementation Details**:
- **Interest Calculation**: Uses PY Index system (watermark pattern)
  ```
  interest = yt_balance * (current_index - user_index) / user_index
  ```
- **Index Storage**:
  - `py_index_stored`: Global index (watermark - only increases)
  - `user_py_index`: Per-user last recorded index
  - `user_interest`: Per-user accrued but unclaimed interest
- **Transfer Hooks**: `_update_user_interest()` called on both sender and recipient before transfers
- **PT Deployment**: YT constructor deploys PT using `deploy_syscall` with PT class hash

**State Transitions**:
- **Before Expiry**: `mint_py()` and `redeem_py()` require both PT and YT
- **After Expiry**: `redeem_py_post_expiry()` only requires PT (YT worthless)

---

## 2. Factory System

### 2.1 Factory (PT/YT Deployment)

**Source**: `contracts/src/factory.cairo`

**Deployment Flow**:
1. User calls `create_yield_contracts(sy, expiry)`
2. Factory validates: SY not zero, expiry in future, no existing pair
3. Factory deploys YT (which internally deploys PT)
4. Stores in registries: `pt_registry[(sy, expiry)]`, `yt_registry[(sy, expiry)]`
5. Marks in valid sets: `valid_pts[pt]`, `valid_yts[yt]`

**Key Storage**:
- `yt_class_hash`, `pt_class_hash`: Updatable by owner
- `deploy_count`: Used as salt for deterministic addresses

### 2.2 MarketFactory (AMM Deployment)

**Source**: `contracts/src/market/market_factory.cairo`

**Deployment Flow**:
1. User calls `create_market(pt, scalar_root, initial_anchor, fee_rate)`
2. Validates parameters against bounds:
   - `scalar_root`: [1 WAD, 1000 WAD]
   - `initial_anchor`: <= 4.6 WAD (~100x max implied rate)
   - `fee_rate`: <= 0.1 WAD (10% max)
3. Deploys Market contract with PT address
4. Market reads SY, YT, expiry from PT contract

**One Market Per PT**: `market_registry[pt]` enforces uniqueness.

---

## 3. AMM (Market) System

### 3.1 Core AMM Design

**Source**: `contracts/src/market/amm.cairo`

**Pool Composition**: PT/SY trading pairs (NOT PT/underlying)

**LP Token**: The Market contract IS the LP token (ERC20). First deposit locks `MINIMUM_LIQUIDITY` (1000 wei) to dead address.

### 3.2 Pendle Logit Curve Mathematics

**Source**: `contracts/src/market/market_math.cairo`

**Core Formula**:
```
exchangeRate = ln(proportion / (1 - proportion)) / rateScalar + rateAnchor
```

Where:
- `proportion = pt_reserve / (pt_reserve + sy_reserve)`
- `rateScalar = scalar_root * SECONDS_PER_YEAR / time_to_expiry`
- `rateAnchor` recalculated after each trade to maintain implied rate continuity

**Key Properties**:
1. **Time Decay**: As expiry approaches, `rateScalar` increases, flattening the curve
2. **Price Convergence**: PT price naturally approaches 1 SY at expiry
3. **Fee Decay**: `fee_rate * time_to_expiry / SECONDS_PER_YEAR` (zero fees at expiry)

**Binary Search**: For SY→PT and PT→exact SY swaps, binary search finds the correct amount (tolerance: 1000 wei, max 64 iterations).

**Test Coverage**: Comprehensive suite including:
- **Fuzz testing**: 20 fuzz tests with 256 runs each covering all swap functions, boundary conditions, and edge cases
- **Invariant tests**: Pool invariants verified (reserves > 0, proportion bounds, exchange rate bounds)
- **Large trade tests**: 16 tests validating binary search convergence for trades up to 90% of reserves
- **First depositor tests**: 10 tests verifying MINIMUM_LIQUIDITY attack mitigation

### 3.3 Swap Functions

| Function | Input | Output | Search Type |
|----------|-------|--------|-------------|
| `swap_exact_pt_for_sy` | exact PT | SY | Direct calc |
| `swap_exact_sy_for_pt` | exact SY | PT | Binary search |
| `swap_sy_for_exact_pt` | SY | exact PT | Direct calc |
| `swap_pt_for_exact_sy` | PT | exact SY | Binary search |

---

## 4. Router (User Entry Point)

**Source**: `contracts/src/router.cairo`

**Security Features**:
- `ReentrancyGuardComponent`: Prevents reentrancy during token transfers
- `deadline` parameter: All operations must complete before timestamp
- `PausableComponent`: Emergency pause capability

### 4.1 Key User Flows

**Mint PT+YT from SY**:
```
User → Router.mint_py_from_sy(yt, receiver, amount_sy_in, min_py_out, deadline)
  → transfers SY from user
  → approves YT to spend SY
  → calls YT.mint_py(receiver, amount)
  → checks slippage (pt >= min_py_out, yt >= min_py_out)
```

**YT Trading (Flash Swap Pattern)**:

`swap_exact_sy_for_yt`:
1. User deposits SY
2. Router mints PT+YT from SY
3. Router sells PT back to market for SY
4. User receives YT + recovered SY

`swap_exact_yt_for_sy`:
1. User provides YT + SY collateral
2. Router buys PT from market using SY
3. Router redeems PT+YT for SY
4. User receives net SY + refund

---

## 5. Oracle System

### 5.1 Current: PragmaIndexOracle

**Source**: `contracts/src/oracles/pragma_index_oracle.cairo`

**Purpose**: Converts Pragma TWAP feeds to exchange rate index for non-ERC4626 assets.

**Modes**:
1. **Single Feed**: `denominator_pair_id = 0`, direct index from one feed
2. **Dual Feed**: Calculate ratio `numerator_price / denominator_price`

**Watermark Pattern**: Index can only increase (monotonic). Stored index = `max(oracle_index, stored_index)`

**Configuration**:
- `twap_window`: Default 1 hour (minimum 5 minutes)
- `max_staleness`: Default 24 hours
- Emergency: Admin can set index (only upward)

### 5.2 Planned: Protocol-Maintained Chainlink TWAP

**Status**: Planned migration from Pragma to Chainlink

**Architecture**:
- **Ring buffer storage**: Fixed-size array (32-128 observations) of `(timestamp, price)` tuples
- **Poke mechanism**: Any state-changing action (mint/redeem/swap) calls `poke(asset_id)` to record latest Chainlink price
- **TWAP computation**: Walk backward through observations, compute time-weighted average:
  ```
  TWAP = Σ(price_i × Δt_i) / Σ(Δt_i)
  ```

**Edge Case Handling**:
- **Sparse observations**: If Starknet block production delays cause irregular spacing, use bounded age fallback to latest spot with staleness check
- **Minimum observations**: Require N observations in window, else revert or use fallback

**Benefits over current approach**:
- Predictable gas (capped buffer length)
- Chainlink reliability and broader asset coverage
- Protocol controls observation frequency

---

## 6. Math Libraries

### 6.1 WAD Fixed-Point (10^18)

**Source**: `contracts/src/libraries/math_fp.cairo`

**Key Constants**:
```cairo
WAD = 1_000_000_000_000_000_000 (10^18)
HALF_WAD = 500_000_000_000_000_000
WAD_E = 2_718_281_828_459_045_235
```

**Implementation**: Uses `cairo_fp` library (64.64 binary fixed-point) internally, converts to/from WAD at boundaries.

**Key Functions**: `wad_mul`, `wad_div`, `exp_wad`, `exp_neg_wad`, `ln_wad`, `pow_wad`, `sqrt_wad`

### 6.2 Market Math Constants

**Source**: `contracts/src/market/market_math.cairo`

```cairo
SECONDS_PER_YEAR = 31_536_000
MIN_PROPORTION = 0.001 WAD (0.1%)
MAX_PROPORTION = 0.999 WAD (99.9%)
MINIMUM_LIQUIDITY = 1000 wei
MAX_LN_IMPLIED_RATE = 4.6 WAD (~10000% APY cap)
```

---

## 7. Frontend Architecture

**Source**: `packages/frontend/CLAUDE.md`

**Stack**: Next.js 16 + React 19 + TanStack Query + starknet.js + Tailwind CSS 4 + shadcn/ui

**Architecture**: Feature-Sliced Design (FSD)
```
src/
├── app/        # Next.js App Router
├── widgets/    # Page compositions
├── features/   # User interactions (swap, mint, redeem, portfolio)
├── entities/   # Domain concepts (market, position, token)
└── shared/     # Utilities (ui, math, starknet, config)
```

**Data Flow**:
```
User action → Feature hook → Contract call → Wallet signature → TX → Query invalidation → UI update
```

**Import Enforcement**: ESLint blocks legacy paths (`@/components`, `@/hooks`), requires FSD paths (`@shared/*`, `@features/*`)

### 7.2 UX Decisions

**Rate Display**: Match Pendle's display format for user familiarity (APY conversion from continuous rates)

**Near-Expiry Behavior**:
- Warning banners displayed as expiry approaches (`NearExpiryWarning` component)
- Three severity levels: info (7 days), warning (3 days), critical (1 day)
- Context-aware messaging for swap, mint, and portfolio views
- Trading remains enabled (user responsibility)
- Pre-flight validation disables swaps/mints on expired markets ("Market Expired" button state)

**YT Expiry Notifications**:
- Dashboard warnings only (no email/push)
- `YieldExpiryAlert` component for positions with claimable yield near expiry
- Portfolio-level summary alert when any position meets near-expiry criteria
- Critical styling (red) at 1-day threshold
- Users responsible for claiming interest before expiry
- YT becomes worthless at expiry (by design)

**Interest Claim Threshold**:
- No minimum threshold in contract (any amount claimable)
- `ClaimValueWarning` component shows warning if claim amount < 2x gas cost
- `useClaimGasCheck` hook compares claimable USD value against estimated gas
- "Claim Anyway" option for users who want to proceed despite low value

**Error Handling**:
- Custom error parsing with actionable suggestions (implemented)
- Specific help text for common errors (slippage, deadline, expired markets)
- Pre-flight validation for expired markets (disables swap/mint with "Market Expired" button state)

---

## 8. Indexer Architecture

**Source**: `packages/indexer/`

**Stack**: Bun + Apibara DNA 2.1.0 + Drizzle ORM + PostgreSQL 16

### 8.1 Indexer Types

**Static Contract Indexers** (fixed addresses from `constants.ts`):
- `factory.indexer.ts` - YieldContractsCreated, ClassHashesUpdated
- `market-factory.indexer.ts` - MarketCreated, MarketClassHashUpdated
- `router.indexer.ts` - MintPY, RedeemPY, AddLiquidity, RemoveLiquidity, Swap, SwapYT

**Factory Pattern Indexers** (dynamic discovery + `knownContracts` for restarts):
- `sy.indexer.ts` - Discovers SY from Factory.YieldContractsCreated
- `yt.indexer.ts` - Discovers YT from Factory.YieldContractsCreated
- `market.indexer.ts` - Discovers Markets from MarketFactory.MarketCreated

### 8.2 Event Tables (24 total)

| Contract | Events | Table Names |
|----------|--------|-------------|
| Factory (2) | YieldContractsCreated, ClassHashesUpdated | `factory_yield_contracts_created`, `factory_class_hashes_updated` |
| MarketFactory (2) | MarketCreated, ClassHashUpdated | `market_factory_market_created`, `market_factory_class_hash_updated` |
| SY (3) | Deposit, Redeem, OracleRateUpdated | `sy_deposit`, `sy_redeem`, `sy_oracle_rate_updated` |
| YT (5) | MintPY, RedeemPY, RedeemPYPostExpiry, InterestClaimed, ExpiryReached | `yt_mint_py`, `yt_redeem_py`, `yt_redeem_py_post_expiry`, `yt_interest_claimed`, `yt_expiry_reached` |
| Market (6) | Mint, Burn, Swap, ImpliedRateUpdated, FeesCollected, ScalarRootUpdated | `market_mint`, `market_burn`, `market_swap`, `market_implied_rate_updated`, `market_fees_collected`, `market_scalar_root_updated` |
| Router (6) | MintPY, RedeemPY, AddLiquidity, RemoveLiquidity, Swap, SwapYT | `router_mint_py`, `router_redeem_py`, `router_add_liquidity`, `router_remove_liquidity`, `router_swap`, `router_swap_yt` |

### 8.3 Database Views (15 total)

**Enriched Router Views (6)** - Join router events with underlying contract events:
- `enriched_router_swap` - Joins with market_swap + market creation
- `enriched_router_swap_yt` - Joins with market data for YT swaps
- `enriched_router_add_liquidity` - Joins with market_mint
- `enriched_router_remove_liquidity` - Joins with market_burn
- `enriched_router_mint_py` - Joins with yt_mint_py
- `enriched_router_redeem_py` - Joins with yt_redeem_py or post_expiry

**Aggregated Materialized Views (9)** - Pre-computed analytics (refresh via `SELECT refresh_all_materialized_views();`):
- `market_daily_stats` - TVL, volume, fees per market per day
- `market_hourly_stats` - Granular hourly metrics
- `market_current_state` - Latest state per market (TVL, rates, 24h volume)
- `user_positions_summary` - PT/YT holdings with P&L metrics
- `user_lp_positions` - LP positions per market
- `user_trading_stats` - Leaderboard data
- `protocol_daily_stats` - Protocol-wide daily metrics
- `rate_history` - Implied rate time series
- `exchange_rate_history` - SY oracle rate time series

### 8.4 Schema Conventions

- `_id` (UUID): Primary key for all tables
- `_cursor`: Reorg tracking (added automatically by Apibara)
- Numeric precision 78: For WAD (10^18) fixed-point values
- Naming: `{contract}_{event_name}` in snake_case

### 8.5 Network Configurations

| Network | Starting Block | Deployment Date |
|---------|----------------|-----------------|
| mainnet | 4,643,300 | 2025-12-23 |
| sepolia | 4,194,445 | - |
| devnet | 0 | - |

**Known Contracts (for factory pattern restart resilience)**:
- `knownYTContracts`: YT addresses discovered from Factory
- `knownSYContracts`: SY addresses discovered from Factory
- `knownMarkets`: Market addresses discovered from MarketFactory

### 8.6 Data Freshness

**Materialized View Refresh**: Periodic (approximately 30 minute intervals)
- Acceptable for portfolio values and analytics
- Real-time requirements met via direct event queries

**Developer Experience**: Apibara + Drizzle stack is easy to extend
- Add handler + schema for new events
- Migrations are smooth

---

## 9. Authoritative Files Reference

### Smart Contracts (Cairo)

| File | Purpose |
|------|---------|
| `contracts/src/tokens/sy.cairo` | SY token implementation |
| `contracts/src/tokens/pt.cairo` | PT token implementation |
| `contracts/src/tokens/yt.cairo` | YT token + PT deployment |
| `contracts/src/factory.cairo` | PT/YT pair deployment |
| `contracts/src/market/amm.cairo` | AMM market implementation |
| `contracts/src/market/market_factory.cairo` | Market deployment |
| `contracts/src/market/market_math.cairo` | Pendle AMM mathematics |
| `contracts/src/router.cairo` | User entry point |
| `contracts/src/oracles/pragma_index_oracle.cairo` | Pragma TWAP adapter |
| `contracts/src/libraries/math_fp.cairo` | WAD fixed-point math |

### Frontend (TypeScript)

| File | Purpose |
|------|---------|
| `packages/frontend/src/shared/math/` | WAD math, AMM calculations |
| `packages/frontend/src/shared/starknet/` | Contract interactions |
| `packages/frontend/src/features/*/api/` | Contract call implementations |
| `packages/frontend/src/features/*/model/` | React hooks (useQuery, useMutation) |
| `packages/frontend/src/shared/ui/NearExpiryWarning.tsx` | Near-expiry warning banners |
| `packages/frontend/src/shared/hooks/useExpiryStatus.ts` | Expiry status hook |
| `packages/frontend/src/features/portfolio/ui/YieldExpiryAlert.tsx` | YT expiry alert |
| `packages/frontend/src/features/yield/model/useClaimGasCheck.ts` | Claim gas comparison hook |
| `packages/frontend/src/features/yield/ui/ClaimValueWarning.tsx` | Low claim value warning |

### Indexer (TypeScript)

| File | Purpose |
|------|---------|
| `packages/indexer/src/indexers/*.indexer.ts` | Event indexers |
| `packages/indexer/src/schema/index.ts` | Database schema |
| `packages/indexer/src/lib/constants.ts` | Network configs, known contracts |
| `packages/indexer/src/lib/utils.ts` | Event parsing utilities |

### Security & Tests (Cairo)

| File | Purpose |
|------|---------|
| `SECURITY.md` | Reentrancy analysis and security documentation |
| `contracts/tests/fuzz/fuzz_market_math.cairo` | AMM math fuzz tests (20 tests) |
| `contracts/tests/test_market_invariants.cairo` | Pool invariant tests |
| `contracts/tests/test_reentrancy.cairo` | Reentrancy attack tests |
| `contracts/tests/test_market_large_trades.cairo` | Binary search edge cases |
| `contracts/tests/test_market_first_depositor.cairo` | First depositor attack tests |
| `contracts/tests/test_yt_interest.cairo` | YT interest calculation tests |
| `contracts/tests/test_router_yt_swaps.cairo` | Flash swap pattern tests |
| `contracts/tests/test_market_fees.cairo` | Time-decay fee tests |

---

## 10. Key Invariants & Security

### 10.1 Core Invariants

1. **Only YT can mint/burn PT**: Enforced by `assert_only_yt()` in PT contract
2. **SY 1:1 with underlying shares**: NOT assets (exchange rate is separate)
3. **PY Index watermark**: Can only increase, never decrease
4. **MINIMUM_LIQUIDITY lock**: First LP deposit locks 1000 wei to prevent attacks
5. **Market parameter bounds**: Factory validates scalar_root, anchor, fee_rate
6. **Reentrancy protection**: Router and YT use OpenZeppelin ReentrancyGuard
7. **Deploy count atomicity**: Factory's `deploy_count` only increments on successful deployment

### 10.2 Upgradeability Model

**Upgradeable Contracts** (owner-controlled):
| Contract | Rationale |
|----------|-----------|
| **Factory** | Infrastructure - `set_class_hashes()` updates code for NEW PT/YT deployments |
| **MarketFactory** | Infrastructure - `set_market_class_hash()` updates code for NEW Market deployments |
| **Router** | Stateless entry point - upgrades don't affect user funds |
| **SY** | Long-lived wrapper - may need oracle fixes or underlying asset updates |

**Non-Upgradeable Contracts** (immutable after deployment):
| Contract | Rationale |
|----------|-----------|
| **PT** | Ephemeral (fixed expiry) - users trust the code at deployment time |
| **YT** | Ephemeral (fixed expiry) - enables safe third-party integrations |
| **Market** | Ephemeral (per-PT) - LP positions rely on immutable contract logic |

**Class Hash Flow**: Protocol improvements reach NEW deployments via factory class hash updates:
```
Factory.set_class_hashes(new_yt, new_pt)   → New PT/YT pairs use updated code
MarketFactory.set_market_class_hash(new)  → New Markets use updated code
Existing contracts remain immutable       → No rugpull risk for active positions
```

### 10.3 Security Posture

**Audit Status**: Internal review only (no external audit yet)
- Plan: Complete audit before removing alpha label
- Fuzz testing complete (20 tests, 256 runs each) - see Section 3.2

**Incident Response**: Not yet formalized
- PAUSER_ROLE exists on SY (pauses new deposits only, existing positions operate)
- Router has PausableComponent
- No automated circuit breakers currently

**Known Research Items**:
- ~~Reentrancy on token contracts~~ **RESOLVED**: Analysis complete, YT now has ReentrancyGuard, see SECURITY.md
- MEV/frontrunning analysis specific to Starknet sequencer
- ~~MINIMUM_LIQUIDITY sufficiency for PT's unique price dynamics~~ **RESOLVED**: See Section 10.3.1

### 10.3.1 MINIMUM_LIQUIDITY Economic Analysis

**Attack Vector**: First Depositor Attack (LP Token Inflation Attack)

The classic attack works as follows:
1. Attacker deposits minimal tokens as first LP
2. Attacker "donates" large amounts directly to inflate LP share price
3. Victim deposits, receives near-zero LP tokens due to rounding
4. Attacker withdraws, stealing victim's funds

**Defense Mechanisms in Horizon**:

| Defense | Implementation | Effect |
|---------|----------------|--------|
| **MINIMUM_LIQUIDITY lock** | 1000 LP tokens locked to dead address (0x1) on first deposit | Attacker cannot profit from inflation |
| **Stored reserves pattern** | AMM tracks reserves in storage, not token balances | Direct token "donations" don't affect LP accounting |
| **WAD normalization** | All values scaled by 10^18 | Large numerical range reduces rounding attack surface |

**Mathematical Analysis**:

```
LP_minted = sqrt_wad(wad_mul(sy_amount, pt_amount))
         = sqrt(sy_amount × pt_amount / WAD) × sqrt(WAD)
         = sqrt(sy_amount × pt_amount)

For first deposit:
  user_lp = LP_minted - MINIMUM_LIQUIDITY
  dead_lp = MINIMUM_LIQUIDITY = 1000

Constraint: LP_minted > MINIMUM_LIQUIDITY (enforced by assertion)
```

**Victim Loss Analysis**:

For a victim depositing after attacker's first deposit:
- Victim's LP share = `victim_lp / (victim_lp + attacker_lp + MINIMUM_LIQUIDITY)`
- The MINIMUM_LIQUIDITY portion goes to dead address (shared proportionally)

| Attacker Deposit | Victim Deposit | Victim Loss to Dead Address |
|------------------|----------------|----------------------------|
| 1 WAD (1 token) | 1 WAD | ~0.0001% (negligible) |
| 1 WAD | 100 WAD | ~0.00001% |
| 1 WAD | 1000 WAD | ~0.000001% |

**Key Finding**: With MINIMUM_LIQUIDITY = 1000 and WAD = 10^18, victim loss is bounded to **< 0.01%** for any reasonable deposit size (≥ 0.01 tokens).

**Stored Reserves Defense**:

The AMM uses **stored reserves** (tracked in contract storage) rather than **token balances** (actual contract holdings). This means:
- Direct token transfers to the market contract do NOT affect LP accounting
- The "donation" step of the attack has no effect
- This provides defense-in-depth beyond MINIMUM_LIQUIDITY

**Recommendation**: MINIMUM_LIQUIDITY = 1000 is **sufficient** for WAD-normalized LP tokens. No change recommended.

**Test Coverage**: `tests/test_market_first_depositor.cairo` (10 tests)
- Verifies MINIMUM_LIQUIDITY locked to dead address
- Confirms attack mitigation with stored reserves
- Documents victim loss bounds
- Tests edge cases (asymmetric deposits, full withdrawal)

### 10.4 Interest Calculation Design

The YT interest formula `yt_balance * (current_index - user_index) / user_index` is **intentionally** designed so earlier YT holders earn more:
- Users who mint/receive YT at lower index earn proportionally more interest
- This creates natural trading dynamics and rewards early participants
- Not a bug - explicitly designed behavior

---

## 11. Deployment & Operations

**Commands**:
```bash
# Contracts
make build                     # Build contracts
make test                      # Run tests
./deploy/scripts/deploy.sh mainnet  # Deploy

# Frontend
cd packages/frontend && bun run dev  # Dev server
bun run codegen                # Generate types from ABIs

# Indexer
cd packages/indexer && bun run dev:mainnet  # Run indexer
bun run db:studio              # Database GUI
```

**Networks**:
- `devnet`: Local starknet-devnet-rs (mock oracle)
- `fork`: Mainnet fork (real Pragma TWAP)
- `sepolia`: Testnet
- `mainnet`: Production

---

## 12. Common Pitfalls

1. **WAD everywhere**: All amounts and rates are 10^18 scaled
2. **Expiry is Unix timestamp**: Not block number
3. **YT deploys PT**: Not Factory - Factory only deploys YT
4. **Market trades PT/SY**: Not PT/underlying
5. **Binary search tolerance**: 1000 wei, may need adjustment for very large trades
6. **Oracle monotonic**: Index can never decrease, even in emergency_set_index

---

## 13. Tokenomics & Governance

### 13.1 Protocol Token (Planned)

**Role**: Governance + LP Incentives

**Governance**:
- Plan: Full DAO governance for protocol parameter changes
- Current: Owner is EOA, multisig planned as intermediate step

**LP Incentives**:
- Incentive mechanism undecided (researching options)
- Options under consideration:
  - Fixed emissions per market (simple)
  - Gauge-based voting like Curve/Pendle (complex but proven)
  - Boosted LP with veToken model

### 13.2 Asset Listing

**Process**: Permissionless with technical requirements
- Any asset with oracle support + ERC4626 interface (or custom IIndexOracle) can have SY deployed
- No governance approval required for new SY contracts
- Market creation also permissionless (with parameter bounds)

---

## 14. Economic Model

### 14.1 Fee Structure

- **Swap fees**: Time-decaying (`fee_rate * time_to_expiry / SECONDS_PER_YEAR`)
- **Zero fees at expiry**: Natural convergence behavior
- **Fee caps**: Max 10% fee rate enforced by MarketFactory

### 14.2 LP Economics

**Known Considerations** (need formal modeling):
- Early LPs earn more fees but face more impermanent loss risk
- As expiry approaches, fees decrease but IL risk also decreases
- LP economics throughout PT lifecycle not yet formally modeled

### 14.3 Liquidity Bootstrapping

**Status**: Not yet planned

**Options under consideration**:
| Approach | Pros | Cons |
|----------|------|------|
| Protocol seeding | Fast, controlled | Capital-intensive, team takes IL |
| LBP/auction | Fair price discovery | Complex UX, may deter retail |
| Market maker partnership | Professional liquidity | May extract value, incentive alignment |
| Organic growth | No capital required | Slow, first LPs speculate on fair value |

**Recommended**: Protocol seeding + market maker partnership for initial markets given Starknet's smaller ecosystem.

### 14.4 Aggregator Integration

**Status**: Not yet engaged with Starknet DEX aggregators (AVNU, Fibrous)
- Potential benefit: Discovery and volume
- Potential concern: MEV vectors
- TODO: Explore partnerships

---

## 15. Open Research & TODO

### 15.1 Critical (Pre-mainnet scale)

| Item | Status | Priority |
|------|--------|----------|
| AMM math fuzz testing | **Complete** (fuzz + invariant tests) | High |
| Reentrancy analysis on PT/YT/SY | **Complete** (see SECURITY.md, YT has ReentrancyGuard) | High |
| Binary search large trade analysis | **Complete** (16 tests in test_market_large_trades.cairo) | Medium |
| MINIMUM_LIQUIDITY attack vector analysis | **Complete** (see Section 10.3.1) | Medium |

### 15.2 Important (Pre-beta)

| Item | Status | Priority |
|------|--------|----------|
| External audit | Not started | High |
| Incident response formalization | Not started | High |
| LP economics modeling | Not started | Medium |
| MEV/frontrunning Starknet analysis | Not started | Medium |

### 15.3 Completed Spec Compliance (P2)

| Item | Status | Test File |
|------|--------|-----------|
| YT interest calculation tests | **Complete** (20 tests) | `test_yt_interest.cairo` |
| Router YT flash swap tests | **Complete** (18 tests) | `test_router_yt_swaps.cairo` |
| Time decay fee tests | **Complete** (16 tests) | `test_market_fees.cairo` |
| Error handling tests | **Complete** (9 tests) | `test_errors.cairo` |
| Oracle edge cases | Not started | - |

### 15.4 Backlog

| Item | Status | Notes |
|------|--------|-------|
| Multi-chain deployment | Undecided | Starknet exclusive for now |
| Underlying asset risk handling | Needs design | Circuit breakers for depeg scenarios |
| Custom error UX in frontend | **Complete** | See Section 7.2 - Error parsing with help text |
| Aggregator integrations | Not started | AVNU, Fibrous partnerships |

### 15.5 Test Coverage Summary

**Total**: 514 passing tests across 20+ test files

| Category | Tests | Files |
|----------|-------|-------|
| Fuzz tests | 20 | `tests/fuzz/fuzz_market_math.cairo` |
| Invariant tests | 4 | `test_market_invariants.cairo` |
| Reentrancy tests | 16 | `test_reentrancy.cairo` |
| Large trade tests | 16 | `test_market_large_trades.cairo` |
| First depositor tests | 10 | `test_market_first_depositor.cairo` |
| YT interest tests | 20 | `test_yt_interest.cairo` |
| Router YT swap tests | 18 | `test_router_yt_swaps.cairo` |
| Fee decay tests | 16 | `test_market_fees.cairo` |
| Error tests | 9 | `test_errors.cairo` |
| Core unit tests | ~385 | Various (`test_sy.cairo`, `test_yt.cairo`, etc.) |

---

## 16. Roadmap & Alpha Exit

### 16.1 Alpha Exit Criteria

Exit alpha status when ALL of the following are met:
1. **Audit completed**: External security audit with no critical findings
2. **TVL threshold**: Meaningful TVL sustained (target TBD)
3. **Time in production**: Extended period without incidents
4. **Feature completeness**: Core features stable and tested

### 16.2 v1 Scope

**In scope**:
- Single market per PT
- 3-6 month expiries
- Fixed market parameters (scalar_root, anchor, fee_rate defaults)
- Basic frontend with Pendle-style rate display

**Explicitly out of scope for v1**:
- Multiple markets per PT
- Gauge-based incentive voting
- Cross-chain bridging
- Automated position management
- Advanced analytics (beyond current views)
