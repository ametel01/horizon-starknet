1. The Factory indexer currently handles only 2 events (not 2 tables + 5 new = 7 as the doc claims): `YieldContractsCreated`, `ClassHashesUpdated` - lines 44-45 in factory.indexer.ts
2. The MarketFactory indexer currently handles 5 events (not 5 + 2 new = 7): `MarketCreated`, `MarketClassHashUpdated`, `TreasuryUpdated`, `DefaultReserveFeeUpdated`, `OverrideFeeSet` - lines 53-57 in market-factory.indexer.ts
3. The YT indexer does not have `FlashMintPY` - lines 71-84 show all 12 current selectors
4. The Market indexer does not have `Skim` - lines 72-83 show all 11 current selectors
5. Schema file line numbers need verification - Factory tables end at line 87, MarketFactory tables end at line 225
6. Validation file has 2 factory schemas (lines 39-70), 5 MarketFactory schemas (lines 72-140)

The document is accurate - these events exist in contracts but are NOT YET implemented in the indexer. The document is a plan for adding them.

Let me verify the FlashMintPY event structure details in the document against the actual contract:

From YT contract (lines 378-388):
- `FlashMintPY` has:
  - `#[key] caller`, `#[key] receiver`
  - `amount_py: u256`, `fee_sy: u256`, `sy: ContractAddress`, `pt: ContractAddress`, `timestamp: u64`

The document says:
- keys: 3 (selector, caller, receiver) ✓
- data: 7 (amount_py[2], fee_sy[2], sy, pt, timestamp) ✓

Let me also verify the Skim event:
From Market contract (lines 319-329):
- `Skim` has:
  - `#[key] market`, `#[key] caller`
  - `sy_excess: u256`, `pt_excess: u256`, `sy_reserve_after: u256`, `pt_reserve_after: u256`, `timestamp: u64`

The document says:
- keys: 3 (selector, market, caller) ✓
- data: 9 (sy_excess[2], pt_excess[2], sy_reserve_after[2], pt_reserve_after[2], timestamp) ✓

Now let me produce the corrected document with accurate line numbers and details:

## Phase 1: Factory Indexer Event Integration **COMPLETE**

Add 5 missing Factory events to the indexer: SYWithRewardsDeployed, SYWithRewardsClassHashUpdated, RewardFeeRateSet, DefaultInterestFeeRateSet, ExpiryDivisorSet.

### Phase Validation
```bash
cd packages/indexer && bun run check
```

### Step 1: Add Factory schema tables for new events **COMPLETE**

#### Goal
Create 5 new pgTable definitions in schema/index.ts for Factory admin events.

#### Files
- `packages/indexer/src/schema/index.ts` - Add factoryRewardFeeRateSet, factoryDefaultInterestFeeRateSet, factoryExpiryDivisorSet, factorySYWithRewardsDeployed, factorySYWithRewardsClassHashUpdated tables after line 87 (after factoryClassHashesUpdated)

#### Validation
```bash
grep -q "factoryRewardFeeRateSet" packages/indexer/src/schema/index.ts && grep -q "factorySYWithRewardsDeployed" packages/indexer/src/schema/index.ts && echo "OK"
```

#### Failure modes
- Table name conflicts with existing tables
- Missing required columns (_id, block_number, block_timestamp, transaction_hash, event_index)
- Missing unique index on (block_number, transaction_hash, event_index)

---

### Step 2: Add Factory validation schemas for new events **COMPLETE**

#### Goal
Create Zod validation schemas for the 5 new Factory events following existing patterns.

#### Files
- `packages/indexer/src/lib/validation.ts` - Add factoryRewardFeeRateSetSchema, factoryDefaultInterestFeeRateSetSchema, factoryExpiryDivisorSetSchema, factorySYWithRewardsDeployedSchema, factorySYWithRewardsClassHashUpdatedSchema after line 70 (after factoryClassHashesUpdatedSchema)

#### Validation
```bash
grep -q "factoryRewardFeeRateSetSchema" packages/indexer/src/lib/validation.ts && grep -q "factorySYWithRewardsDeployedSchema" packages/indexer/src/lib/validation.ts && echo "OK"
```

#### Failure modes
- Incorrect minimum data array length (RewardFeeRateSet needs 4 for 2 u256 fields, SYWithRewardsDeployed has 2 ByteArray fields requiring variable length)
- Incorrect minimum keys count (SYWithRewardsDeployed has 2 keys: selector and sy)

---

### Step 3: Add Factory event selectors and filters **COMPLETE**

#### Goal
Add event selectors for 5 new events and include them in the filter configuration.

#### Files
- `packages/indexer/src/indexers/factory.indexer.ts` - Add selectors after line 45, add to filter array after line 82, add to drizzle schema imports

#### Validation
```bash
grep -q "REWARD_FEE_RATE_SET" packages/indexer/src/indexers/factory.indexer.ts && grep -q "SY_WITH_REWARDS_DEPLOYED" packages/indexer/src/indexers/factory.indexer.ts && echo "OK"
```

#### Failure modes
- Selector names don't match Cairo event names exactly
- Filter not added to events array

---

### Step 4: Add Factory transform logic for new events **COMPLETE**

#### Goal
Implement event parsing and row insertion for 5 new Factory events in the transform function.

#### Files
- `packages/indexer/src/indexers/factory.indexer.ts` - Add row type definitions, collection arrays, matchSelector branches, and batch insert statements

#### Validation
```bash
grep -q "rewardFeeRateSetRows" packages/indexer/src/indexers/factory.indexer.ts && grep -q "syWithRewardsDeployedRows" packages/indexer/src/indexers/factory.indexer.ts && echo "OK"
```

#### Failure modes
- Incorrect data index offsets for u256 fields (each u256 uses 2 array slots)
- Missing decodeByteArrayWithOffset for SYWithRewardsDeployed name/symbol fields
- Missing validateEvent call before parsing

---

## Phase 2: MarketFactory Indexer Event Integration **COMPLETE**

Add 2 missing MarketFactory events: DefaultRateImpactSensitivityUpdated, YieldContractFactoryUpdated.

### Phase Validation
```bash
cd packages/indexer && bun run check
```

### Step 5: Add MarketFactory schema tables for new events **COMPLETE**

#### Goal
Create 2 new pgTable definitions for MarketFactory admin events.

#### Files
- `packages/indexer/src/schema/index.ts` - Add marketFactoryDefaultRateImpactSensitivityUpdated, marketFactoryYieldContractFactoryUpdated tables after line 225 (after marketFactoryOverrideFeeSet)

#### Validation
```bash
grep -q "marketFactoryDefaultRateImpactSensitivityUpdated" packages/indexer/src/schema/index.ts && grep -q "marketFactoryYieldContractFactoryUpdated" packages/indexer/src/schema/index.ts && echo "OK"
```

#### Failure modes
- Incorrect column types for u256 (should be numeric with precision 78, scale 0)
- Missing unique index constraint

---

### Step 6: Add MarketFactory validation schemas for new events **COMPLETE**

#### Goal
Create Zod validation schemas for the 2 new MarketFactory events.

#### Files
- `packages/indexer/src/lib/validation.ts` - Add marketFactoryDefaultRateImpactSensitivityUpdatedSchema, marketFactoryYieldContractFactoryUpdatedSchema after line 140 (after marketFactoryOverrideFeeSetSchema)

#### Validation
```bash
grep -q "marketFactoryDefaultRateImpactSensitivityUpdatedSchema" packages/indexer/src/lib/validation.ts && grep -q "marketFactoryYieldContractFactoryUpdatedSchema" packages/indexer/src/lib/validation.ts && echo "OK"
```

#### Failure modes
- Incorrect minimum data array length (DefaultRateImpactSensitivityUpdated needs 4 for 2 u256 fields, YieldContractFactoryUpdated needs 2 for addresses)

---

### Step 7: Add MarketFactory event selectors, filters, and transform logic **COMPLETE**

#### Goal
Complete MarketFactory indexer integration: selectors, filters, and transform branches.

#### Files
- `packages/indexer/src/indexers/market-factory.indexer.ts` - Add selectors after line 57, filters after line 102, row types, collection arrays, matchSelector branches, and batch inserts

#### Validation
```bash
grep -q "YIELD_CONTRACT_FACTORY_UPDATED" packages/indexer/src/indexers/market-factory.indexer.ts && grep -q "DEFAULT_RATE_IMPACT_SENSITIVITY_UPDATED" packages/indexer/src/indexers/market-factory.indexer.ts && echo "OK"
```

#### Failure modes
- Selector mismatch with Cairo event name
- Missing schema import for new tables
- Incorrect u256 parsing (needs readU256 with correct indices)

---

## Phase 3: YT Indexer FlashMintPY Event Integration **COMPLETE**

Add FlashMintPY event to YT indexer.

### Phase Validation
```bash
cd packages/indexer && bun run check
```

### Step 8: Add YT FlashMintPY schema table **COMPLETE**

#### Goal
Create pgTable for ytFlashMintPY event tracking flash mint operations.

#### Files
- `packages/indexer/src/schema/index.ts` - Add ytFlashMintPY table in YT events section (after ytRedeemPYWithInterest around line 996)

#### Validation
```bash
grep -q "ytFlashMintPY" packages/indexer/src/schema/index.ts && echo "OK"
```

#### Failure modes
- Missing indexed key columns (caller, receiver are both #[key])
- Missing yt column (should derive from event.address)

---

### Step 9: Add YT FlashMintPY validation schema **COMPLETE**

#### Goal
Create Zod validation schema for FlashMintPY event.

#### Files
- `packages/indexer/src/lib/validation.ts` - Add ytFlashMintPYSchema after YT event schemas section (after ytPyIndexUpdatedSchema around line 418)

#### Validation
```bash
grep -q "ytFlashMintPYSchema" packages/indexer/src/lib/validation.ts && echo "OK"
```

#### Failure modes
- Incorrect minimum keys count (3: selector, caller, receiver)
- Incorrect minimum data count (7: amount_py[2], fee_sy[2], sy, pt, timestamp)

---

### Step 10: Add YT FlashMintPY selector, filter, and transform logic **COMPLETE**

#### Goal
Complete YT indexer FlashMintPY integration.

#### Files
- `packages/indexer/src/indexers/yt.indexer.ts` - Add FLASH_MINT_PY selector after line 84, add to knownYTFilters, add schema import, add row type and collection array, add matchSelector branch, add batch insert

#### Validation
```bash
grep -q "FLASH_MINT_PY" packages/indexer/src/indexers/yt.indexer.ts && grep -q "ytFlashMintPY" packages/indexer/src/indexers/yt.indexer.ts && echo "OK"
```

#### Failure modes
- Missing filter in knownYTFilters array
- Incorrect key indices (caller is keys[1], receiver is keys[2])
- Incorrect data parsing (amount_py is u256 at data[0-1], fee_sy is u256 at data[2-3])

---

## Phase 4: Market Indexer Skim Event Integration

Add Skim event to Market indexer.

### Phase Validation
```bash
cd packages/indexer && bun run check
```

### Step 11: Add Market Skim schema table **COMPLETE**

#### Goal
Create pgTable for marketSkim event tracking excess token removal.

#### Files
- `packages/indexer/src/schema/index.ts` - Add marketSkim table in Market events section (after marketRewardTokenAdded around line 1450)

#### Validation
```bash
grep -q "marketSkim" packages/indexer/src/schema/index.ts && echo "OK"
```

#### Failure modes
- Missing market column (from keys[1], #[key])
- Missing caller column (from keys[2], #[key])
- Incorrect numeric precision for u256 reserve fields

---

### Step 12: Add Market Skim validation schema **COMPLETE**

#### Goal
Create Zod validation schema for Skim event.

#### Files
- `packages/indexer/src/lib/validation.ts` - Add marketSkimSchema after Market event schemas section (after marketRewardTokenAddedSchema around line 575)

#### Validation
```bash
grep -q "marketSkimSchema" packages/indexer/src/lib/validation.ts && echo "OK"
```

#### Failure modes
- Incorrect minimum keys count (3: selector, market, caller)
- Incorrect minimum data count (9: sy_excess[2], pt_excess[2], sy_reserve_after[2], pt_reserve_after[2], timestamp)

---

### Step 13: Add Market Skim selector, filter, and transform logic **COMPLETE**

#### Goal
Complete Market indexer Skim integration.

#### Files
- `packages/indexer/src/indexers/market.indexer.ts` - Add SKIM selector after line 83, add to knownMarketFilters, add schema import, add row type and collection array, add matchSelector branch, add batch insert

#### Validation
```bash
grep -q "SKIM" packages/indexer/src/indexers/market.indexer.ts && grep -q "marketSkim" packages/indexer/src/indexers/market.indexer.ts && echo "OK"
```

#### Failure modes
- Missing filter in knownMarketFilters array
- Market address comes from event.address (not keys[1]) since market emits the event from itself
- Incorrect u256 field offsets (each uses 2 slots)

---

## Phase 5: Database Migration Generation

Generate Drizzle migration for all new schema tables.

### Phase Validation
```bash
cd packages/indexer && bun run db:generate && ls drizzle/*.sql | tail -1
```

### Step 14: Generate Drizzle migration

#### Goal
Run Drizzle kit to generate SQL migration for the 10 new tables.

#### Files
- `packages/indexer/drizzle/*.sql` - New migration file generated

#### Validation
```bash
cd packages/indexer && bun run db:generate && grep -l "factory_reward_fee_rate_set" drizzle/*.sql | head -1
```

#### Failure modes
- Schema type errors prevent migration generation
- Missing table definitions in schema export

---

## Phase 6: Regenerate Event ABIs

Regenerate event ABIs from rebuilt contracts to ensure ABI alignment.

### Phase Validation
```bash
cd packages/indexer && bun run codegen && echo "OK"
```

### Step 15: Rebuild contracts and regenerate indexer event ABIs

#### Goal
Ensure indexer event ABIs match current contract definitions.

#### Files
- `packages/indexer/src/lib/abi/factory.json` - Updated with latest events
- `packages/indexer/src/lib/abi/marketfactory.json` - Updated with latest events
- `packages/indexer/src/lib/abi/yt.json` - Updated with FlashMintPY
- `packages/indexer/src/lib/abi/market.json` - Updated with Skim

#### Validation
```bash
make build && cd packages/indexer && bun run codegen && grep -q "FlashMintPY" src/lib/abi/yt.json && echo "OK"
```

#### Failure modes
- Contract build fails
- codegen script fails to read contract artifacts
- ABI doesn't include expected events

---

## Phase 7: Type Checking and Linting

Verify all changes pass type checking and linting.

### Phase Validation
```bash
cd packages/indexer && bun run check
```

### Step 16: Run full type check and lint

#### Goal
Ensure all new code passes TypeScript and ESLint validation.

#### Files
- All modified indexer files

#### Validation
```bash
cd packages/indexer && bun run check
```

#### Failure modes
- Type errors from incorrect schema field types
- Lint errors from missing validation schema exports
- Unused imports or variables

---

## Phase 8: Integration Testing

Test indexer against devnet to verify event parsing.

### Phase Validation
```bash
cd packages/indexer && bun run test
```

### Step 17: Run indexer unit tests

#### Goal
Verify existing tests pass and new event parsing logic works correctly.

#### Files
- `packages/indexer/src/**/*.test.ts` - Existing test files

#### Validation
```bash
cd packages/indexer && bun run test
```

#### Failure modes
- Existing tests break due to schema changes
- Validation schema export issues

---
