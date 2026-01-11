# AMM Market System V2.0: Frontend & Indexer Changes Required

## Overview

This document evaluates the changes required for the frontend and indexer packages following completion of the AMM Market System implementation plan (`02-amm-market-system-gaps-20260110-044451.md`). The plan implemented 5 phases of improvements across the contracts.

**Status:** All 5 phases COMPLETE in contracts. Frontend and indexer updates COMPLETE.

### Implementation Summary (Updated 2026-01-11)

| Component | Status | Notes |
|-----------|--------|-------|
| **Indexer Schema** | ✅ Complete | 5 new tables, 2 analytics views |
| **Indexer Event Parsing** | ✅ Complete | Market (11 events), Router (7 events) |
| **Validation Schemas** | ✅ Complete | All 5 new schemas added |
| **Database Migration** | ✅ Complete | Migration generated |
| **Frontend Hooks** | ✅ Complete | All hooks implemented |
| **Unit Tests** | ✅ Complete | Market LP reward indexing tests |
| **UI Components** | 🔲 Pending | Integration with existing UI needed |

---

## Contract Changes Summary (From Completed Plan)

### Phase 1: RewardManager Integration with Market ✅
- Market contract now has embedded RewardManagerComponent
- LP token transfers trigger reward updates
- New functions: `claim_rewards`, `get_reward_tokens`, `accrued_rewards`, `is_reward_token`, `reward_index`, `user_reward_index`, `reward_tokens_count`
- New events: `RewardsClaimed`, `RewardIndexUpdated`, `RewardTokenAdded` (from RewardManagerComponent)

### Phase 2: Single-Sided Liquidity ✅
- Router: `add_liquidity_single_sy()` - Add LP with only SY
- Router: `add_liquidity_single_pt()` - Add LP with only PT
- Uses binary search for optimal swap calculation

### Phase 3: Flash Swap Callbacks ✅
- All 4 Market swap functions now have `callback_data` parameter
- Enables composable flash operations

### Phase 4: LP Rollover ✅
- Router: `rollover_lp()` - Migrate LP from old market to new market
- New event: `RolloverLP`
- Market: `burn_with_receivers()` - Send SY/PT to separate addresses
- New event: `BurnWithReceivers`

### Phase 5: UX Improvements ✅
- Market: `skim()` - Reconcile reserves with actual balances (admin)

---

## Indexer Changes Required

### New Events to Track

#### 1. Market Contract - NEW Events

**BurnWithReceivers** (Phase 4)
```
Location: packages/indexer/src/lib/abi/market.json:171-251
Status: ✅ Indexed in marketBurnWithReceivers table
```

| Field | Type | Kind | Description |
|-------|------|------|-------------|
| sender | ContractAddress | key | User burning LP |
| receiver_sy | ContractAddress | key | SY recipient |
| receiver_pt | ContractAddress | key | PT recipient |
| expiry | u64 | data | Market expiry |
| sy | ContractAddress | data | SY contract |
| pt | ContractAddress | data | PT contract |
| lp_amount | u256 | data | LP tokens burned |
| sy_amount | u256 | data | SY sent |
| pt_amount | u256 | data | PT sent |
| exchange_rate | u256 | data | Current rate |
| implied_rate | u256 | data | Implied APY |
| sy_reserve_after | u256 | data | Post-op reserve |
| pt_reserve_after | u256 | data | Post-op reserve |
| total_lp_after | u256 | data | Post-op LP supply |
| timestamp | u64 | data | Block timestamp |

**RewardsClaimed** (Phase 1 - Market Rewards)
```
Location: packages/indexer/src/lib/abi/market.json:513-538
Status: ✅ Indexed in marketRewardsClaimed table
```

| Field | Type | Kind | Description |
|-------|------|------|-------------|
| user | ContractAddress | key | User claiming |
| reward_token | ContractAddress | key | Token claimed |
| amount | u256 | data | Amount claimed |
| timestamp | u64 | data | Claim time |

**RewardIndexUpdated** (Phase 1 - Market Rewards)
```
Location: packages/indexer/src/lib/abi/market.json:540-575
Status: ✅ Indexed in marketRewardIndexUpdated table
```

| Field | Type | Kind | Description |
|-------|------|------|-------------|
| reward_token | ContractAddress | key | Reward token |
| old_index | u256 | data | Previous index |
| new_index | u256 | data | New index |
| rewards_added | u256 | data | Delta |
| total_supply | u256 | data | LP supply |
| timestamp | u64 | data | Update time |

**RewardTokenAdded** (Phase 1 - Market Rewards)
```
Location: packages/indexer/src/lib/abi/market.json:577-597
Status: ✅ Indexed in marketRewardTokenAdded table
```

| Field | Type | Kind | Description |
|-------|------|------|-------------|
| reward_token | ContractAddress | key | Token added |
| index | u32 | data | Token index |
| timestamp | u64 | data | Add time |

#### 2. Router Contract - NEW Events

**RolloverLP** (Phase 4)
```
Location: packages/indexer/src/lib/abi/router.json:248-284
Status: ✅ Indexed in routerRolloverLp table
```

| Field | Type | Kind | Description |
|-------|------|------|-------------|
| sender | ContractAddress | key | User rolling over |
| receiver | ContractAddress | key | LP recipient |
| market_old | ContractAddress | data | Old market |
| market_new | ContractAddress | data | New market |
| lp_burned | u256 | data | LP removed from old |
| lp_minted | u256 | data | LP added to new |

---

### Indexer Implementation Tasks

#### Task 1: Add Market BurnWithReceivers Table ✅ COMPLETE

**File:** `packages/indexer/src/schema/index.ts`

Add new table `marketBurnWithReceivers`:
- Same structure as `marketBurn` but with `receiver_sy` and `receiver_pt` columns instead of single `receiver`
- Index on: sender, receiver_sy, receiver_pt, expiry, timestamp

**Implementation Notes:** Added in commit `572345f`. Table includes all fields from the event with proper indexes.

#### Task 2: Add Market Reward Tables ✅ COMPLETE

**File:** `packages/indexer/src/schema/index.ts`

Add 3 new tables (parallel to existing SY reward tables `syRewardsClaimed`, `syRewardIndexUpdated`, `syRewardTokenAdded`):
- `marketRewardsClaimed` - Track LP reward claims
- `marketRewardIndexUpdated` - Track reward distribution
- `marketRewardTokenAdded` - Track new reward tokens

Include `market` column to identify which market the rewards are from.

**Implementation Notes:** Added in commit `eec6515`. All three tables follow the SY reward table pattern with `market` column.

#### Task 3: Add Router RolloverLP Table ✅ COMPLETE

**File:** `packages/indexer/src/schema/index.ts`

Add new table `routerRolloverLp`:
- Columns: sender, receiver, market_old, market_new, lp_burned, lp_minted, timestamp
- Index on: sender, receiver, market_old, market_new, timestamp

**Implementation Notes:** Added in commit `9b73246`.

#### Task 4: Update Market Indexer ✅ COMPLETE

**File:** `packages/indexer/src/indexers/market.indexer.ts`

Currently indexes 7 events: Mint, Burn, Swap, ImpliedRateUpdated, FeesCollected, ScalarRootUpdated, ReserveFeeTransferred.

1. Add event selectors:
   ```typescript
   const BURN_WITH_RECEIVERS = getSelector("BurnWithReceivers");
   const REWARDS_CLAIMED = getSelector("RewardsClaimed");
   const REWARD_INDEX_UPDATED = getSelector("RewardIndexUpdated");
   const REWARD_TOKEN_ADDED = getSelector("RewardTokenAdded");
   ```

2. Add filters for new events in `knownMarketFilters` and factory function
3. Add parsing logic with validation
4. Add Zod schemas in `validation.ts`

**Implementation Notes:** Added in commit `fb1f97b`. Market indexer now handles all 11 events.

#### Task 5: Update Router Indexer ✅ COMPLETE

**File:** `packages/indexer/src/indexers/router.indexer.ts`

Currently indexes 6 events: MintPY, RedeemPY, AddLiquidity, RemoveLiquidity, Swap, SwapYT.

1. Add event selector:
   ```typescript
   const ROLLOVER_LP = getSelector("RolloverLP");
   ```

2. Add filter and parsing logic
3. Add Zod schema in `validation.ts`

**Implementation Notes:** Added in commit `3df07ec`. Router indexer now handles 7 events.

#### Task 6: Add Validation Schemas ✅ COMPLETE

**File:** `packages/indexer/src/lib/validation.ts`

Add schemas for:
- `marketBurnWithReceiversSchema`
- `marketRewardsClaimedSchema`
- `marketRewardIndexUpdatedSchema`
- `marketRewardTokenAddedSchema`
- `routerRolloverLPSchema`

**Implementation Notes:** Added in commit `ba16809`.

#### Task 7: Create Analytics Views ✅ COMPLETE

**File:** `packages/indexer/src/schema/index.ts`

Add new views:
- `marketRewardsSummary` - Aggregated market rewards by user (similar to existing `userRewardHistory` for SY)
- `rolloverActivity` - LP migration analytics
- `enrichedRouterRolloverLp` - Rollover with market metadata

**Implementation Notes:** `marketRewardsSummary` added in commit `39e22d2`. `rolloverActivity` added in commit `c2b96e3`. `enrichedRouterRolloverLp` deferred - can use rolloverActivity view with joins as needed.

#### Task 8: Run Migration ✅ COMPLETE

```bash
cd packages/indexer
bun run db:generate    # Generate migration
bun run db:push        # Apply to dev
```

**Implementation Notes:** Migration generated in commit `acb00c9`.

#### Task 9: Unit Tests ✅ COMPLETE

**Implementation Notes:** Tests added in commit `35b4e73` covering Market LP reward event indexing.

---

## Frontend Changes Required

### New Features to Implement

#### 1. Single-Sided Liquidity (Phase 2) - HIGH PRIORITY ✅ COMPLETE

**New Feature Module:** `packages/frontend/src/features/liquidity-single/`

```
liquidity-single/
├── api/
│   └── index.ts
├── model/
│   ├── useAddLiquiditySingleSy.ts
│   └── useAddLiquiditySinglePt.ts
├── ui/
│   ├── SingleSidedLiquidityForm.tsx
│   └── TokenSelector.tsx
└── index.ts
```

**Implementation:**
1. Create `useAddLiquiditySingleSy()` hook
   - Calls `router.add_liquidity_single_sy(market, receiver, amount_sy_in, min_lp_out, deadline)`
   - Handles SY approval
   - Optimistic UI updates

2. Create `useAddLiquiditySinglePt()` hook
   - Calls `router.add_liquidity_single_pt(market, receiver, amount_pt_in, min_lp_out, deadline)`
   - Handles PT approval
   - Optimistic UI updates

3. Update liquidity UI to offer single-sided option
   - Toggle between dual-sided and single-sided modes
   - Auto-detect when user only has SY or PT

**Router ABI Reference:**
```typescript
// From packages/frontend/src/types/generated/Router.ts:239-267
add_liquidity_single_sy(market, receiver, amount_sy_in, min_lp_out, deadline)
// Returns: (sy_used, pt_used, lp_out)

// From packages/frontend/src/types/generated/Router.ts:271-300
add_liquidity_single_pt(market, receiver, amount_pt_in, min_lp_out, deadline)
// Returns: (sy_used, pt_used, lp_out)
```

**Implementation Notes:** Hooks added in commit `5ea0139`. Located at `packages/frontend/src/features/liquidity/model/useSingleSidedLiquidity.ts` (exports `useAddLiquiditySingleSy` and `useAddLiquiditySinglePt`). UI components pending integration.

#### 2. LP Rollover (Phase 4) - MEDIUM PRIORITY ✅ COMPLETE

**New Feature Module:** `packages/frontend/src/features/rollover/`

```
rollover/
├── api/
│   └── index.ts
├── model/
│   └── useRolloverLp.ts
├── ui/
│   ├── RolloverForm.tsx
│   └── MarketPairSelector.tsx
└── index.ts
```

**Implementation:**
1. Create `useRolloverLp()` hook
   - Calls `router.rollover_lp(market_old, market_new, lp_to_rollover, min_lp_out, deadline)`
   - Handles LP token approval
   - Shows before/after LP positions

2. Create RolloverForm UI
   - Market pair selection (old → new)
   - LP amount input
   - Slippage protection
   - Migration preview

**Router ABI Reference:**
```typescript
// From packages/frontend/src/types/generated/Router.ts:605-636
rollover_lp(market_old, market_new, lp_to_rollover, min_lp_out, deadline)
// Returns: lp_new (u256)
```

**Implementation Notes:** Hook added in commit `b542282`. Located at `packages/frontend/src/features/liquidity/model/useRolloverLp.ts`. UI components pending integration.

#### 3. Market LP Rewards (Phase 1) - HIGH PRIORITY ✅ COMPLETE

**Extend Existing:** `packages/frontend/src/features/rewards/`

**Current State:** Rewards feature exists for SY contracts with comprehensive hooks:
- `useAccruedRewards(syAddress)` - Fetch pending rewards
- `useClaimRewards(syAddress)` - Claim rewards from single SY
- `useClaimAllRewards(syAddresses)` - Claim from multiple SY addresses
- `useRewardTokens(syAddress)` - List reward tokens
- `useRewardApy(syAddress)` - Calculate reward APY
- Plus additional hooks for history, summary, and portfolio aggregation

Need to extend for Market LP rewards.

**Implementation:**
1. Create `useMarketClaimRewards(marketAddress)` hook
   - Market has same interface as SY: `claim_rewards(user)`
   - Returns array of claimed amounts

2. Create `useMarketRewardTokens(marketAddress)` hook
   - Calls `market.get_reward_tokens()`
   - Returns list of reward token addresses

3. Create `useMarketAccruedRewards(marketAddress, user)` hook
   - Calls `market.accrued_rewards(user)`
   - Returns array of pending reward amounts

4. Update rewards UI to show LP rewards
   - Separate section for "LP Rewards"
   - Show reward tokens and amounts
   - Claim button for each market

**Market ABI Reference:**
```typescript
// From packages/frontend/src/types/generated/Market.ts:410-521
// IMarketRewards interface (7 functions)
get_reward_tokens() → Span<ContractAddress>
claim_rewards(user) → Span<u256>
accrued_rewards(user) → Span<u256>
reward_index(token) → u256
user_reward_index(user, token) → u256
is_reward_token(token) → bool
reward_tokens_count() → u32
```

**Implementation Notes:**
- `useMarketRewardTokens` added in commit `bb296ad`
- `useMarketAccruedRewards` added in commit `229fbc0`
- `useMarketClaimRewards` added in commit `8b720d7`
All hooks located at `packages/frontend/src/features/rewards/model/`. UI integration pending.

#### 4. Update Swap Calls (Phase 3) - LOW PRIORITY (Internal)

**File:** `packages/frontend/src/shared/starknet/contracts.ts`

The Market swap functions now require `callback_data` parameter. The Router abstracts this, so frontend changes are minimal.

**If calling Market directly (not via Router):**
- Pass `[]` (empty array) for callback_data
- Example: `market.swap_exact_sy_for_pt(receiver, amount, min_out, [])`

**Current Router calls remain unchanged** - Router handles callback_data internally.

---

### Frontend Implementation Priority

| Feature | Priority | Effort | User Impact | Status |
|---------|----------|--------|-------------|--------|
| Single-Sided Liquidity | HIGH | Medium | Major UX improvement | ✅ Hooks complete |
| Market LP Rewards | HIGH | Low | Enable LP incentives | ✅ Hooks complete |
| LP Rollover | MEDIUM | Medium | Market migration tool | ✅ Hook complete |
| Callback Data Updates | LOW | Low | Internal only | N/A (Router handles) |

---

## Database Migration Summary

### New Tables (5)

| Table | Contract | Event |
|-------|----------|-------|
| `marketBurnWithReceivers` | Market | BurnWithReceivers |
| `marketRewardsClaimed` | Market | RewardsClaimed |
| `marketRewardIndexUpdated` | Market | RewardIndexUpdated |
| `marketRewardTokenAdded` | Market | RewardTokenAdded |
| `routerRolloverLp` | Router | RolloverLP |

### New Views (2)

| View | Purpose |
|------|---------|
| `marketRewardsSummary` | User LP rewards aggregation |
| `rolloverActivity` | LP migration tracking |

*Note: `enrichedRouterRolloverLp` was deferred - use `rolloverActivity` with joins as needed.*

---

## API Changes Checklist

### Market Contract
- [x] ABI updated with new functions (generated)
- [x] `callback_data` parameter added to all swap functions
- [x] `burn_with_receivers` function added (Market.ts:170-193)
- [x] `skim` admin function added (Market.ts:573-579)
- [x] IMarketRewards interface added (7 functions, Market.ts:410-521)
- [x] RewardManager events integrated

### Router Contract
- [x] ABI updated with new functions (generated)
- [x] `add_liquidity_single_sy` function added (Router.ts:237-268)
- [x] `add_liquidity_single_pt` function added (Router.ts:269-300)
- [x] `rollover_lp` function added (Router.ts:605-636)
- [x] `RolloverLP` event added (Router.ts:1054-1089)

---

## Testing Requirements

### Indexer Tests
1. Test BurnWithReceivers event parsing
2. Test Market reward events parsing
3. Test RolloverLP event parsing
4. Test view queries return correct data

### Frontend Tests
1. Single-sided liquidity flow (SY only, PT only)
2. LP rollover flow
3. Market rewards display and claim
4. Error handling for new operations

---

## Deployment Notes

### Indexer Deployment
1. Generate migration: `bun run db:generate`
2. Stop indexer
3. Apply migration: `bun run db:push`
4. Start indexer with new code
5. Indexer will catch up on new events from deployed block

### Frontend Deployment
1. Ensure ABIs are regenerated: `bun run codegen`
2. Implement new features
3. Test on devnet/sepolia
4. Deploy to production

---

## Open Questions

1. **[UNCLEAR]** Should single-sided liquidity have a dedicated UI page or be a mode toggle on existing liquidity page?

2. **[UNCLEAR]** Should LP rollover require explicit market approval or be discoverable from user's LP positions?

3. **[INFERRED]** Market rewards use same event structure as SY rewards - tables can share schema pattern but need separate tables for query efficiency.

---

## References

- Implementation Plan: `.weld/plan/02-amm-market-system-gaps-20260110-044451.md`
- Market ABI: `packages/frontend/src/types/generated/Market.ts`
- Router ABI: `packages/frontend/src/types/generated/Router.ts`
- Indexer Market ABI: `packages/indexer/src/lib/abi/market.json`
- Indexer Router ABI: `packages/indexer/src/lib/abi/router.json`
- Indexer Schema: `packages/indexer/src/schema/index.ts`
- Market Indexer: `packages/indexer/src/indexers/market.indexer.ts`
- Router Indexer: `packages/indexer/src/indexers/router.indexer.ts`
