# Package Integration Gaps: Contract Events to Indexer/Frontend

## System Overview

This document maps the gap between implemented contract features (Phases 1-7) and their integration into the indexer and frontend packages. All contract features from `pending-gaps-implementation.md` are complete; this document tracks what's needed to fully integrate them.

**Boundaries:**
- In scope: Indexer event handlers, schema tables, frontend type generation, new contract views
- Out of scope: Contract implementation (already complete), deployment scripts

**Entry points:**
- Indexer: `packages/indexer/src/indexers/*.indexer.ts`
- Frontend codegen: `packages/frontend/scripts/generate-types.ts`
- Event ABI codegen: `packages/indexer/scripts/generate-events-abi.ts`

## Core Components

| Component | Location | Status |
|-----------|----------|--------|
| Factory Indexer | `packages/indexer/src/indexers/factory.indexer.ts` | Missing 5 events |
| MarketFactory Indexer | `packages/indexer/src/indexers/market-factory.indexer.ts` | Missing 2 events |
| YT Indexer | `packages/indexer/src/indexers/yt.indexer.ts` | Missing 1 event |
| Market Indexer | `packages/indexer/src/indexers/market.indexer.ts` | Missing 1 event |
| Event ABI Generator | `packages/indexer/scripts/generate-events-abi.ts:27-37` | No changes needed |
| Frontend Type Generator | `packages/frontend/scripts/generate-types.ts:22-37` | No changes needed |

## Data Model: Missing Events

### Factory Contract Events (5 missing)

```
Location: contracts/src/factory.cairo:136-169

Event: SYWithRewardsDeployed
  Fields:
    - sy: ContractAddress [key]
    - name: ByteArray
    - symbol: ByteArray
    - underlying: ContractAddress
    - deployer: ContractAddress
    - timestamp: u64

Event: SYWithRewardsClassHashUpdated
  Fields:
    - old_class_hash: ClassHash
    - new_class_hash: ClassHash

Event: RewardFeeRateSet
  Fields:
    - old_fee_rate: u256
    - new_fee_rate: u256

Event: DefaultInterestFeeRateSet
  Fields:
    - old_fee_rate: u256
    - new_fee_rate: u256

Event: ExpiryDivisorSet
  Fields:
    - old_expiry_divisor: u64
    - new_expiry_divisor: u64
```

### MarketFactory Contract Events (2 missing)

```
Location: contracts/src/market/market_factory.cairo:184-193

Event: DefaultRateImpactSensitivityUpdated
  Fields:
    - old_sensitivity: u256
    - new_sensitivity: u256

Event: YieldContractFactoryUpdated
  Fields:
    - old_factory: ContractAddress
    - new_factory: ContractAddress
```

### YT Contract Events (1 missing)

```
Location: contracts/src/tokens/yt.cairo:375-388

Event: FlashMintPY
  Fields:
    - caller: ContractAddress [key]
    - receiver: ContractAddress [key]
    - amount_py: u256
    - fee_sy: u256
    - sy: ContractAddress
    - pt: ContractAddress
    - timestamp: u64
```

### Market Contract Events (1 missing)

```
Location: contracts/src/market/amm.cairo:317-329

Event: Skim
  Fields:
    - market: ContractAddress [key]
    - caller: ContractAddress [key]
    - sy_excess: u256
    - pt_excess: u256
    - sy_reserve_after: u256
    - pt_reserve_after: u256
    - timestamp: u64
```

## Execution Flows

### Flow: Add New Indexer Event

1. `packages/indexer/src/schema/index.ts` - Add pgTable definition
2. `packages/indexer/src/lib/validation.ts` - Add Zod validation schema
3. `packages/indexer/src/indexers/{contract}.indexer.ts` - Add selector: `const EVENT_NAME = getSelector("EventName")`
4. `packages/indexer/src/indexers/{contract}.indexer.ts` - Add filter: `{ address: config.contract, keys: [EVENT_NAME] }`
5. `packages/indexer/src/indexers/{contract}.indexer.ts` - Add transform logic with `matchSelector()` and `validateEvent()`
6. Run `bun run db:generate` - Generate Drizzle migration
7. Run `bun run codegen` - Regenerate event ABIs from contracts

**Failure paths:**
- If schema table missing: Indexer fails at insert (`schema/index.ts`)
- If validation schema missing: Event silently skipped (`validation.ts`)
- If filter missing: Event never received from stream

### Flow: Regenerate Types After Contract Changes

1. `make build` (repo root) - Rebuild contracts
2. `cd packages/frontend && bun run codegen` - Regenerate TypeScript types
3. `cd packages/indexer && bun run codegen` - Regenerate event ABIs

**Failure paths:**
- If contracts not built: codegen fails with "file not found" (`generate-types.ts:42-45`)
- If contract not in list: No types generated (but all contracts already listed)

## Invariants

- All indexer tables have `_id: uuid` primary key - required by Apibara drizzle plugin (`schema/index.ts`)
- All indexer tables have `_cursor` for reorg tracking - added automatically by Apibara
- Event selectors must match exactly (padding differences handled by `matchSelector()` at `utils.ts:18`)
- Factory events are admin-only - low frequency, governance tracking use case

## Implementation Checklist

### 1. Factory Indexer Updates

File: `packages/indexer/src/indexers/factory.indexer.ts`

**Add selectors after line 45:**
```typescript
const REWARD_FEE_RATE_SET = getSelector("RewardFeeRateSet");
const DEFAULT_INTEREST_FEE_RATE_SET = getSelector("DefaultInterestFeeRateSet");
const EXPIRY_DIVISOR_SET = getSelector("ExpiryDivisorSet");
const SY_WITH_REWARDS_DEPLOYED = getSelector("SYWithRewardsDeployed");
const SY_WITH_REWARDS_CLASS_HASH_UPDATED = getSelector("SYWithRewardsClassHashUpdated");
```

**Schema tables needed in `packages/indexer/src/schema/index.ts`:**

| Table | Fields |
|-------|--------|
| `factoryRewardFeeRateSet` | block_*, transaction_hash, event_index, old_fee_rate, new_fee_rate |
| `factoryDefaultInterestFeeRateSet` | block_*, transaction_hash, event_index, old_fee_rate, new_fee_rate |
| `factoryExpiryDivisorSet` | block_*, transaction_hash, event_index, old_expiry_divisor, new_expiry_divisor |
| `factorySYWithRewardsDeployed` | block_*, transaction_hash, event_index, sy, name, symbol, underlying, deployer |
| `factorySYWithRewardsClassHashUpdated` | block_*, transaction_hash, event_index, old_class_hash, new_class_hash |

### 2. MarketFactory Indexer Updates

File: `packages/indexer/src/indexers/market-factory.indexer.ts`

**Add selectors after line 57:**
```typescript
const YIELD_CONTRACT_FACTORY_UPDATED = getSelector("YieldContractFactoryUpdated");
const DEFAULT_RATE_IMPACT_SENSITIVITY_UPDATED = getSelector("DefaultRateImpactSensitivityUpdated");
```

**Schema tables needed:**

| Table | Fields |
|-------|--------|
| `marketFactoryYieldContractFactoryUpdated` | block_*, transaction_hash, event_index, old_factory, new_factory |
| `marketFactoryDefaultRateImpactSensitivityUpdated` | block_*, transaction_hash, event_index, old_sensitivity, new_sensitivity |

### 3. YT Indexer Updates

File: `packages/indexer/src/indexers/yt.indexer.ts`

**Add selector after line 84:**
```typescript
const FLASH_MINT_PY = getSelector("FlashMintPY");
```

**Schema table needed:**

| Table | Fields |
|-------|--------|
| `ytFlashMintPY` | block_*, transaction_hash, event_index, caller, receiver, yt, amount_py, fee_sy, sy, pt |

### 4. Market Indexer Updates

File: `packages/indexer/src/indexers/market.indexer.ts`

**Add selector after line 83:**
```typescript
const SKIM = getSelector("Skim");
```

**Schema table needed:**

| Table | Fields |
|-------|--------|
| `marketSkim` | block_*, transaction_hash, event_index, market, caller, sy_excess, pt_excess, sy_reserve_after, pt_reserve_after |

## Frontend Integration Opportunities

### New Contract Capabilities (Phase 4-7)

| Feature | Contract Function | Location | Frontend Use Case |
|---------|------------------|----------|-------------------|
| Flash Mint | `flash_mint_py()` | `yt.cairo:1476` | Advanced arbitrage UI |
| Market State | `get_market_state()` | `amm.cairo:1131` | Consolidated state fetch |
| YT Rewards | `claim_rewards()` | `yt.cairo:1291` | Reward claiming UI |
| YT Rewards | `get_reward_tokens()` | `yt.cairo:1384` | Display available rewards |
| YT Rewards | `redeem_due_interest_and_rewards()` | `yt.cairo:1305` | Combined claim UI |
| Dual Liquidity | `add_liquidity_dual_token_and_pt()` | `router.cairo:2316` | Flexible LP provision |
| Dual Liquidity | `remove_liquidity_dual_token_and_pt()` | `router.cairo:2417` | Flexible LP withdrawal |
| Token Swap | `swap_tokens_to_tokens()` | `router.cairo:1982` | General aggregator routing |

### Current Frontend Contract Coverage

Location: `packages/frontend/scripts/generate-types.ts:22-37`

All production contracts already included:
- Factory, MarketFactory, Router, RouterStatic
- Market, SY, SYWithRewards, PT, YT
- PragmaIndexOracle, PyLpOracle

### Current Indexer Event ABI Coverage

Location: `packages/indexer/scripts/generate-events-abi.ts:27-37`

Contracts processed for events:
- Factory, MarketFactory, Router, Market
- SY, SYWithRewards, PT, YT
- PragmaIndexOracle

Note: PyLpOracle is not in the indexer event list (frontend only).

## Open Questions

- `[UNCLEAR]` Priority of flash mint UI - depends on product roadmap
- `[UNCLEAR]` Whether admin events (fee rate changes) need indexing - depends on governance UI plans
- `[INFERRED]` SYWithRewardsDeployed may need sy.indexer.ts integration for discovery pattern

## Codegen Commands

```bash
# After contract rebuild - regenerate all types
make build
cd packages/frontend && bun run codegen
cd packages/indexer && bun run codegen

# After schema changes - generate migration
cd packages/indexer && bun run db:generate
```

## Verified Facts

| Fact | Evidence |
|------|----------|
| Factory has 5 unindexed events | `factory.cairo:136-169`, selectors defined at `factory.indexer.ts:44-45` only index 2 |
| MarketFactory has 2 unindexed events | `market_factory.cairo:184-193`, selectors at `market-factory.indexer.ts:53-57` index 5 of 7 |
| YT FlashMintPY in ABI but not indexed | `yt.json:688`, not in `yt.indexer.ts` selectors (lines 68-84) |
| Market Skim in ABI but not indexed | `market.json:514`, not in `market.indexer.ts` selectors (lines 69-83) |
| All contracts in generate-types.ts | `generate-types.ts:22-37` (11 contracts) |
| Indexer processes 9 contracts for events | `generate-events-abi.ts:27-37` (excludes PyLpOracle) |
| YT indexes 12 custom events | `yt.indexer.ts:71-84` (FlashMintPY is the 13th, not indexed) |
