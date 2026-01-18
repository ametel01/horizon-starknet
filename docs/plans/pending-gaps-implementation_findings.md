# Research Findings: Package Integration Gaps for Completed Contract Features

## Authoritative Files
- `contracts/src/factory.cairo` - Factory contract with new fee and expiry events
- `contracts/src/market/market_factory.cairo` - MarketFactory with yield contract factory reference
- `contracts/src/tokens/yt.cairo` - YT contract with flash mint and reward events
- `contracts/src/market/amm.cairo` - Market with Skim event
- `packages/indexer/src/indexers/factory.indexer.ts` - Factory event indexer
- `packages/indexer/src/indexers/yt.indexer.ts` - YT event indexer
- `packages/indexer/src/indexers/market.indexer.ts` - Market event indexer
- `packages/indexer/scripts/generate-events-abi.ts` - Event ABI generator
- `packages/frontend/scripts/generate-types.ts` - Frontend type generator

## Key Findings

### Question 1: Do we need to implement new events indexing?
**Answer:** Yes, there are 7 events in contracts not being indexed

**Evidence - Missing Factory Events:**
- `RewardFeeRateSet` - `factory.cairo:154-158`
- `DefaultInterestFeeRateSet` - `factory.cairo:159-163`
- `ExpiryDivisorSet` - `factory.cairo:165-169`
- `SYWithRewardsDeployed` - `factory.cairo:136-146`
- `SYWithRewardsClassHashUpdated` - `factory.cairo:147-152`

**Evidence - Missing MarketFactory Events:**
- `YieldContractFactoryUpdated` - `market_factory.cairo:189-192`
- `DefaultRateImpactSensitivityUpdated` - `market_factory.cairo:183-188`

**Evidence - Missing YT Events:**
- `FlashMintPY` - `yt.cairo:377-393` (exists in ABI at `yt.json:688` but NOT indexed in `yt.indexer.ts`)

**Evidence - Missing Market Events:**
- `Skim` - `amm.cairo:318-327` (exists in ABI at `market.json:514` but NOT indexed in `market.indexer.ts`)

**Confidence:** High

---

### Question 2: Do we need to create new views?
**Answer:** Possibly - depends on frontend requirements

**Evidence:**
- Current schema at `schema/index.ts` has 15 views for analytics
- New events (fee rate changes, expiry divisor) are admin/config events
- Views for these would be useful for admin dashboards or governance UI
- The new `get_market_state()` view function was added to Market contract (`amm.cairo`) - frontend can call this directly

**Recommended Views (Optional):**
1. `factory_fee_config_history` - Track reward/interest fee rate changes over time
2. `factory_expiry_config` - Track expiry divisor changes
3. `yt_flash_mint_stats` - Aggregate flash mint activity

**Confidence:** Medium (depends on frontend requirements)

---

### Question 3: Do we need to update generate-events-abi.ts?
**Answer:** No changes needed

**Evidence:** `packages/indexer/scripts/generate-events-abi.ts:27-37`
```typescript
const CONTRACTS = [
  "Factory",
  "MarketFactory",
  "Router",
  "Market",
  "SY",
  "SYWithRewards",
  "PT",
  "YT",
  "PragmaIndexOracle",
] as const;
```
- All contracts are already listed
- Script correctly extracts Horizon-prefixed events
- ABIs already contain new events (verified in `abi/factory.json`, `abi/marketfactory.json`, `abi/yt.json`)
- Just need to run `bun run codegen` in indexer to regenerate after contract rebuild

**Confidence:** High

---

### Question 4: Can we implement new features in frontend?
**Answer:** Yes - several new contract capabilities can be exposed

**Evidence - New Frontend Features Possible:**

1. **Flash Mint Integration** (Phase 6)
   - `flash_mint_py()` function added to YT at `yt.cairo:1000-1100`
   - IYT interface updated at `i_yt.cairo`
   - Can enable atomic arbitrage UI or advanced trading features

2. **Market State View** (Phase 7)
   - `get_market_state()` added to Market at `amm.cairo`
   - Returns full `MarketState` struct for integrations
   - Currently frontend fetches individual fields - can consolidate to single call

3. **YT Reward Claiming** (Phase 4)
   - `claim_rewards()`, `get_reward_tokens()`, `redeem_due_interest_and_rewards()` added to YT
   - Frontend can display and claim YT rewards alongside interest

4. **Dual Token Liquidity** (Phase 5)
   - `add_liquidity_dual_token_and_pt()`, `remove_liquidity_dual_token_and_pt()` added to Router
   - `swap_tokens_to_tokens()` for general aggregator routing
   - Can enable more flexible liquidity provision UI

**Current Frontend Contract Usage:** `frontend/src/types/generated/index.ts:16-26`
- Already includes all core contracts: Factory, Market, MarketFactory, Router, RouterStatic, SY, SYWithRewards, PT, YT, oracles

**Confidence:** High

---

### Question 5: Do we need to add new contracts to generate-types.ts?
**Answer:** No changes needed

**Evidence:** `packages/frontend/scripts/generate-types.ts:22-37`
```typescript
const CONTRACTS = [
  { file: 'horizon_Factory.contract_class.json', name: 'Factory' },
  { file: 'horizon_MarketFactory.contract_class.json', name: 'MarketFactory' },
  { file: 'horizon_Router.contract_class.json', name: 'Router' },
  { file: 'horizon_RouterStatic.contract_class.json', name: 'RouterStatic' },
  { file: 'horizon_Market.contract_class.json', name: 'Market' },
  { file: 'horizon_SY.contract_class.json', name: 'SY' },
  { file: 'horizon_SYWithRewards.contract_class.json', name: 'SYWithRewards' },
  { file: 'horizon_PT.contract_class.json', name: 'PT' },
  { file: 'horizon_YT.contract_class.json', name: 'YT' },
  { file: 'horizon_PragmaIndexOracle.contract_class.json', name: 'PragmaIndexOracle' },
  { file: 'horizon_PyLpOracle.contract_class.json', name: 'PyLpOracle' },
];
```
- All production contracts already listed
- New functions added to existing contracts (not new contracts)
- Just need to run `bun run codegen` to regenerate types after contract rebuild

**Confidence:** High

---

## Implementation Checklist

### Indexer Updates Required

#### 1. Factory Indexer - Add 5 new events
File: `packages/indexer/src/indexers/factory.indexer.ts`

Missing selectors to add:
```typescript
const REWARD_FEE_RATE_SET = getSelector("RewardFeeRateSet");
const DEFAULT_INTEREST_FEE_RATE_SET = getSelector("DefaultInterestFeeRateSet");
const EXPIRY_DIVISOR_SET = getSelector("ExpiryDivisorSet");
const SY_WITH_REWARDS_DEPLOYED = getSelector("SYWithRewardsDeployed");
const SY_WITH_REWARDS_CLASS_HASH_UPDATED = getSelector("SYWithRewardsClassHashUpdated");
```

Schema tables needed in `packages/indexer/src/schema/index.ts`:
- `factoryRewardFeeRateSet`
- `factoryDefaultInterestFeeRateSet`
- `factoryExpiryDivisorSet`
- `factorySYWithRewardsDeployed`
- `factorySYWithRewardsClassHashUpdated`

#### 2. MarketFactory Indexer - Add 2 new events
File: `packages/indexer/src/indexers/market-factory.indexer.ts`

Missing selectors to add:
```typescript
const YIELD_CONTRACT_FACTORY_UPDATED = getSelector("YieldContractFactoryUpdated");
const DEFAULT_RATE_IMPACT_SENSITIVITY_UPDATED = getSelector("DefaultRateImpactSensitivityUpdated");
```

Schema tables needed:
- `marketFactoryYieldContractFactoryUpdated`
- `marketFactoryDefaultRateImpactSensitivityUpdated`

#### 3. YT Indexer - Add 1 new event
File: `packages/indexer/src/indexers/yt.indexer.ts`

Missing selector to add:
```typescript
const FLASH_MINT_PY = getSelector("FlashMintPY");
```

Schema table needed:
- `ytFlashMintPY`

#### 4. Market Indexer - Add 1 new event
File: `packages/indexer/src/indexers/market.indexer.ts`

Missing selector to add:
```typescript
const SKIM = getSelector("Skim");
```

Schema table needed:
- `marketSkim`

### Frontend Updates (Optional)

1. **Regenerate types** after contract rebuild:
   ```bash
   cd packages/frontend && bun run codegen
   ```

2. **Optional new features to implement:**
   - Flash mint UI for advanced users
   - Consolidated market state fetching via `get_market_state()`
   - YT reward display and claiming interface
   - Dual token liquidity provision UI

### Codegen Commands

After contract rebuild:
```bash
# Regenerate indexer event ABIs
cd packages/indexer && bun run codegen

# Regenerate frontend types
cd packages/frontend && bun run codegen
```

## Verified Facts
- Factory has 5 new events not indexed (`factory.cairo:136-169`)
- MarketFactory has 2 new events not indexed (`market_factory.cairo:183-192`)
- YT FlashMintPY exists in ABI but not indexed (`yt.json:688`)
- Market Skim exists in ABI but not indexed (`market.json:514`)
- All contracts already in generate-types.ts (`generate-types.ts:22-37`)
- All contracts already in generate-events-abi.ts (`generate-events-abi.ts:27-37`)
- YT RewardsClaimed is already indexed via RewardManagerComponent (`yt.indexer.ts:78`)

## Unknowns
- Frontend product requirements for new features unclear
- Whether admin events (fee rate changes) need indexing depends on governance UI plans
- Flash mint use case priority unknown

## Corrections
- Initial assumption that all new events are indexed → 9 events are missing from indexing
- YT reward events appear unindexed → Actually indexed via existing RewardsClaimed handler in yt.indexer.ts (lines 126-127, 176-177)
