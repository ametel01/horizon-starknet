# P4 Indexer Implementation Plan

> **Date:** 2025-12-31
> **Status:** Ready for implementation
> **Scope:** Index new SY/SYWithRewards events for monitoring, pause state, and reward history

---

## Event Structures (from contracts)

### 1. NegativeYieldDetected (SYComponent)

**Source:** `contracts/src/components/sy_component.cairo:143-158`

```cairo
#[derive(Drop, starknet::Event)]
pub struct NegativeYieldDetected {
    #[key]
    pub sy: ContractAddress,
    #[key]
    pub underlying: ContractAddress,
    pub watermark_rate: u256,      // Previous high water mark
    pub current_rate: u256,        // Current (lower) rate
    pub rate_drop_bps: u256,       // Drop in basis points (10000 = 100%)
    pub timestamp: u64,
}
```

**Selector:** `sn_keccak("NegativeYieldDetected")`

### 2. Paused / Unpaused (OpenZeppelin PausableComponent)

**Source:** OpenZeppelin `pausable::PausableComponent::Event`

```cairo
// Paused event
#[derive(Drop, starknet::Event)]
struct Paused {
    account: ContractAddress,  // Who paused
}

// Unpaused event
#[derive(Drop, starknet::Event)]
struct Unpaused {
    account: ContractAddress,  // Who unpaused
}
```

**Selectors:** `sn_keccak("Paused")`, `sn_keccak("Unpaused")`

### 3. RewardsClaimed (RewardManagerComponent)

**Source:** `contracts/src/components/reward_manager_component.cairo:85-94`

```cairo
#[derive(Drop, starknet::Event)]
pub struct RewardsClaimed {
    #[key]
    pub user: ContractAddress,
    #[key]
    pub reward_token: ContractAddress,
    pub amount: u256,
    pub timestamp: u64,
}
```

**Selector:** `sn_keccak("RewardsClaimed")`

### 4. RewardIndexUpdated (RewardManagerComponent)

**Source:** `contracts/src/components/reward_manager_component.cairo:96-106`

```cairo
#[derive(Drop, starknet::Event)]
pub struct RewardIndexUpdated {
    #[key]
    pub reward_token: ContractAddress,
    pub old_index: u256,
    pub new_index: u256,
    pub rewards_added: u256,
    pub total_supply: u256,
    pub timestamp: u64,
}
```

**Selector:** `sn_keccak("RewardIndexUpdated")`

### 5. RewardTokenAdded (RewardManagerComponent)

**Source:** `contracts/src/components/reward_manager_component.cairo:108-115`

```cairo
#[derive(Drop, starknet::Event)]
pub struct RewardTokenAdded {
    #[key]
    pub reward_token: ContractAddress,
    pub index: u32,
    pub timestamp: u64,
}
```

**Selector:** `sn_keccak("RewardTokenAdded")`

---

## Database Schema Changes

### New Tables

```typescript
// src/schema/index.ts - Add to SY events section

// 1. Negative Yield Detection (monitoring)
export const syNegativeYieldDetected = pgTable(
  "sy_negative_yield_detected",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    blockNumber: bigint("block_number", { mode: "number" }),
    blockTimestamp: timestamp("block_timestamp"),
    transactionHash: text("transaction_hash"),
    eventIndex: integer("event_index"),
    // Keys
    sy: text("sy").notNull(),
    underlying: text("underlying").notNull(),
    // Data
    watermarkRate: numeric("watermark_rate", { precision: 78, scale: 0 }),
    currentRate: numeric("current_rate", { precision: 78, scale: 0 }),
    rateDropBps: numeric("rate_drop_bps", { precision: 78, scale: 0 }),
    eventTimestamp: bigint("event_timestamp", { mode: "number" }),
  },
  (table) => [
    index("sy_negative_yield_sy_idx").on(table.sy),
    index("sy_negative_yield_underlying_idx").on(table.underlying),
    uniqueIndex("sy_negative_yield_unique_idx").on(
      table.blockNumber,
      table.transactionHash,
      table.eventIndex
    ),
  ]
);

// 2. Pause State Tracking
export const syPauseState = pgTable(
  "sy_pause_state",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    blockNumber: bigint("block_number", { mode: "number" }),
    blockTimestamp: timestamp("block_timestamp"),
    transactionHash: text("transaction_hash"),
    eventIndex: integer("event_index"),
    // Keys
    sy: text("sy").notNull(),          // Contract address (derived from event source)
    // Data
    account: text("account").notNull(), // Who triggered pause/unpause
    isPaused: boolean("is_paused").notNull(), // true = Paused, false = Unpaused
  },
  (table) => [
    index("sy_pause_state_sy_idx").on(table.sy),
    uniqueIndex("sy_pause_state_unique_idx").on(
      table.blockNumber,
      table.transactionHash,
      table.eventIndex
    ),
  ]
);

// 3. Rewards Claimed (SYWithRewards)
export const syRewardsClaimed = pgTable(
  "sy_rewards_claimed",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    blockNumber: bigint("block_number", { mode: "number" }),
    blockTimestamp: timestamp("block_timestamp"),
    transactionHash: text("transaction_hash"),
    eventIndex: integer("event_index"),
    // Keys
    sy: text("sy").notNull(),              // SYWithRewards contract (derived)
    user: text("user").notNull(),
    rewardToken: text("reward_token").notNull(),
    // Data
    amount: numeric("amount", { precision: 78, scale: 0 }),
    eventTimestamp: bigint("event_timestamp", { mode: "number" }),
  },
  (table) => [
    index("sy_rewards_claimed_user_idx").on(table.user),
    index("sy_rewards_claimed_sy_idx").on(table.sy),
    index("sy_rewards_claimed_token_idx").on(table.rewardToken),
    uniqueIndex("sy_rewards_claimed_unique_idx").on(
      table.blockNumber,
      table.transactionHash,
      table.eventIndex
    ),
  ]
);

// 4. Reward Index Updated (for APY calculation)
export const syRewardIndexUpdated = pgTable(
  "sy_reward_index_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    blockNumber: bigint("block_number", { mode: "number" }),
    blockTimestamp: timestamp("block_timestamp"),
    transactionHash: text("transaction_hash"),
    eventIndex: integer("event_index"),
    // Keys
    sy: text("sy").notNull(),              // SYWithRewards contract (derived)
    rewardToken: text("reward_token").notNull(),
    // Data
    oldIndex: numeric("old_index", { precision: 78, scale: 0 }),
    newIndex: numeric("new_index", { precision: 78, scale: 0 }),
    rewardsAdded: numeric("rewards_added", { precision: 78, scale: 0 }),
    totalSupply: numeric("total_supply", { precision: 78, scale: 0 }),
    eventTimestamp: bigint("event_timestamp", { mode: "number" }),
  },
  (table) => [
    index("sy_reward_index_sy_idx").on(table.sy),
    index("sy_reward_index_token_idx").on(table.rewardToken),
    uniqueIndex("sy_reward_index_unique_idx").on(
      table.blockNumber,
      table.transactionHash,
      table.eventIndex
    ),
  ]
);

// 5. Reward Token Added (registry)
export const syRewardTokenAdded = pgTable(
  "sy_reward_token_added",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    blockNumber: bigint("block_number", { mode: "number" }),
    blockTimestamp: timestamp("block_timestamp"),
    transactionHash: text("transaction_hash"),
    eventIndex: integer("event_index"),
    // Keys
    sy: text("sy").notNull(),              // SYWithRewards contract (derived)
    rewardToken: text("reward_token").notNull(),
    // Data
    tokenIndex: integer("token_index"),    // Index in reward tokens array
    eventTimestamp: bigint("event_timestamp", { mode: "number" }),
  },
  (table) => [
    index("sy_reward_token_added_sy_idx").on(table.sy),
    uniqueIndex("sy_reward_token_added_unique_idx").on(
      table.blockNumber,
      table.transactionHash,
      table.eventIndex
    ),
  ]
);
```

### New Views

```typescript
// User Reward History View
export const userRewardHistory = pgView("user_reward_history", {
  user: text("user"),
  sy: text("sy"),
  rewardToken: text("reward_token"),
  totalClaimed: numeric("total_claimed", { precision: 78, scale: 0 }),
  claimCount: integer("claim_count"),
  lastClaimTimestamp: timestamp("last_claim_timestamp"),
}).as(sql`
  SELECT
    "user",
    sy,
    reward_token,
    SUM(amount) as total_claimed,
    COUNT(*) as claim_count,
    MAX(block_timestamp) as last_claim_timestamp
  FROM sy_rewards_claimed
  GROUP BY "user", sy, reward_token
`);

// SY Pause State Current View
export const syCurrentPauseState = pgView("sy_current_pause_state", {
  sy: text("sy"),
  isPaused: boolean("is_paused"),
  lastUpdatedAt: timestamp("last_updated_at"),
  lastUpdatedBy: text("last_updated_by"),
}).as(sql`
  SELECT DISTINCT ON (sy)
    sy,
    is_paused,
    block_timestamp as last_updated_at,
    account as last_updated_by
  FROM sy_pause_state
  ORDER BY sy, block_number DESC, event_index DESC
`);

// Negative Yield Alerts View
export const negativeYieldAlerts = pgView("negative_yield_alerts", {
  sy: text("sy"),
  underlying: text("underlying"),
  eventCount: integer("event_count"),
  maxDropBps: numeric("max_drop_bps", { precision: 78, scale: 0 }),
  lastDetectedAt: timestamp("last_detected_at"),
}).as(sql`
  SELECT
    sy,
    underlying,
    COUNT(*) as event_count,
    MAX(rate_drop_bps) as max_drop_bps,
    MAX(block_timestamp) as last_detected_at
  FROM sy_negative_yield_detected
  GROUP BY sy, underlying
`);

// Reward APY Calculation View (rolling 7-day)
export const syRewardApy = pgView("sy_reward_apy", {
  sy: text("sy"),
  rewardToken: text("reward_token"),
  rewardsLast7Days: numeric("rewards_last_7_days", { precision: 78, scale: 0 }),
  avgTotalSupply: numeric("avg_total_supply", { precision: 78, scale: 0 }),
  updateCount: integer("update_count"),
}).as(sql`
  SELECT
    sy,
    reward_token,
    SUM(rewards_added) as rewards_last_7_days,
    AVG(total_supply) as avg_total_supply,
    COUNT(*) as update_count
  FROM sy_reward_index_updated
  WHERE block_timestamp > NOW() - INTERVAL '7 days'
  GROUP BY sy, reward_token
`);
```

---

## Indexer Updates

### Step 1: Add Event Selectors

```typescript
// src/lib/constants.ts - Add to event selectors section

// SY Component Events (Phase 4)
export const NEGATIVE_YIELD_DETECTED = eventSelector("NegativeYieldDetected");

// OpenZeppelin Pausable Events
export const PAUSED = eventSelector("Paused");
export const UNPAUSED = eventSelector("Unpaused");

// RewardManager Events (SYWithRewards only)
export const REWARDS_CLAIMED = eventSelector("RewardsClaimed");
export const REWARD_INDEX_UPDATED = eventSelector("RewardIndexUpdated");
export const REWARD_TOKEN_ADDED = eventSelector("RewardTokenAdded");
```

### Step 2: Add Validation Schemas

```typescript
// src/lib/validation.ts - Add Zod schemas

// NegativeYieldDetected: 2 keys (sy, underlying) + 4 data fields
export const syNegativeYieldDetectedSchema = z.object({
  keys: z.array(z.string()).length(2),      // sy, underlying
  data: z.array(z.string()).min(7),         // watermark(2), current(2), dropBps(2), timestamp(1)
});

// Paused/Unpaused: 0 keys + 1 data field (account)
export const pausedSchema = z.object({
  keys: z.array(z.string()).length(0),
  data: z.array(z.string()).length(1),      // account
});

// RewardsClaimed: 2 keys + 3 data fields
export const rewardsClaimedSchema = z.object({
  keys: z.array(z.string()).length(2),      // user, reward_token
  data: z.array(z.string()).min(3),         // amount(2), timestamp(1)
});

// RewardIndexUpdated: 1 key + 9 data fields
export const rewardIndexUpdatedSchema = z.object({
  keys: z.array(z.string()).length(1),      // reward_token
  data: z.array(z.string()).min(9),         // old(2), new(2), added(2), supply(2), timestamp(1)
});

// RewardTokenAdded: 1 key + 2 data fields
export const rewardTokenAddedSchema = z.object({
  keys: z.array(z.string()).length(1),      // reward_token
  data: z.array(z.string()).length(2),      // index(1), timestamp(1)
});
```

### Step 3: Update sy.indexer.ts

```typescript
// src/indexers/sy.indexer.ts - Add to transform function

// Import new tables and selectors
import {
  syNegativeYieldDetected,
  syPauseState,
  syRewardsClaimed,
  syRewardIndexUpdated,
  syRewardTokenAdded,
} from "../schema";

import {
  NEGATIVE_YIELD_DETECTED,
  PAUSED,
  UNPAUSED,
  REWARDS_CLAIMED,
  REWARD_INDEX_UPDATED,
  REWARD_TOKEN_ADDED,
} from "../lib/constants";

// Add to filter (include new event selectors)
const SY_EVENT_FILTER = [
  DEPOSIT,
  REDEEM,
  ORACLE_RATE_UPDATED,
  // Phase 4 additions
  NEGATIVE_YIELD_DETECTED,
  PAUSED,
  UNPAUSED,
  REWARDS_CLAIMED,
  REWARD_INDEX_UPDATED,
  REWARD_TOKEN_ADDED,
];

// Add row collectors
const negativeYieldRows: (typeof syNegativeYieldDetected.$inferInsert)[] = [];
const pauseStateRows: (typeof syPauseState.$inferInsert)[] = [];
const rewardsClaimedRows: (typeof syRewardsClaimed.$inferInsert)[] = [];
const rewardIndexRows: (typeof syRewardIndexUpdated.$inferInsert)[] = [];
const rewardTokenRows: (typeof syRewardTokenAdded.$inferInsert)[] = [];

// Add event handlers in transform loop
if (matchSelector(eventKey, NEGATIVE_YIELD_DETECTED)) {
  const validated = validateEvent(syNegativeYieldDetectedSchema, event, {
    indexer: "sy",
    eventName: "NegativeYieldDetected",
    blockNumber,
    transactionHash,
  });
  if (!validated) { errorCount++; continue; }

  const sy = validated.keys[0];
  const underlying = validated.keys[1];
  const data = validated.data;

  negativeYieldRows.push({
    blockNumber,
    blockTimestamp: timestamp,
    transactionHash,
    eventIndex,
    sy,
    underlying,
    watermarkRate: readU256(data, 0, "watermark_rate").toString(),
    currentRate: readU256(data, 2, "current_rate").toString(),
    rateDropBps: readU256(data, 4, "rate_drop_bps").toString(),
    eventTimestamp: readFeltAsNumber(data, 6, "timestamp"),
  });
  continue;
}

if (matchSelector(eventKey, PAUSED)) {
  const validated = validateEvent(pausedSchema, event, {
    indexer: "sy",
    eventName: "Paused",
    blockNumber,
    transactionHash,
  });
  if (!validated) { errorCount++; continue; }

  pauseStateRows.push({
    blockNumber,
    blockTimestamp: timestamp,
    transactionHash,
    eventIndex,
    sy: contractAddress,  // SY contract that emitted the event
    account: validated.data[0],
    isPaused: true,
  });
  continue;
}

if (matchSelector(eventKey, UNPAUSED)) {
  const validated = validateEvent(pausedSchema, event, {
    indexer: "sy",
    eventName: "Unpaused",
    blockNumber,
    transactionHash,
  });
  if (!validated) { errorCount++; continue; }

  pauseStateRows.push({
    blockNumber,
    blockTimestamp: timestamp,
    transactionHash,
    eventIndex,
    sy: contractAddress,
    account: validated.data[0],
    isPaused: false,
  });
  continue;
}

if (matchSelector(eventKey, REWARDS_CLAIMED)) {
  const validated = validateEvent(rewardsClaimedSchema, event, {
    indexer: "sy",
    eventName: "RewardsClaimed",
    blockNumber,
    transactionHash,
  });
  if (!validated) { errorCount++; continue; }

  const user = validated.keys[0];
  const rewardToken = validated.keys[1];
  const data = validated.data;

  rewardsClaimedRows.push({
    blockNumber,
    blockTimestamp: timestamp,
    transactionHash,
    eventIndex,
    sy: contractAddress,  // SYWithRewards contract
    user,
    rewardToken,
    amount: readU256(data, 0, "amount").toString(),
    eventTimestamp: readFeltAsNumber(data, 2, "timestamp"),
  });
  continue;
}

if (matchSelector(eventKey, REWARD_INDEX_UPDATED)) {
  const validated = validateEvent(rewardIndexUpdatedSchema, event, {
    indexer: "sy",
    eventName: "RewardIndexUpdated",
    blockNumber,
    transactionHash,
  });
  if (!validated) { errorCount++; continue; }

  const rewardToken = validated.keys[0];
  const data = validated.data;

  rewardIndexRows.push({
    blockNumber,
    blockTimestamp: timestamp,
    transactionHash,
    eventIndex,
    sy: contractAddress,
    rewardToken,
    oldIndex: readU256(data, 0, "old_index").toString(),
    newIndex: readU256(data, 2, "new_index").toString(),
    rewardsAdded: readU256(data, 4, "rewards_added").toString(),
    totalSupply: readU256(data, 6, "total_supply").toString(),
    eventTimestamp: readFeltAsNumber(data, 8, "timestamp"),
  });
  continue;
}

if (matchSelector(eventKey, REWARD_TOKEN_ADDED)) {
  const validated = validateEvent(rewardTokenAddedSchema, event, {
    indexer: "sy",
    eventName: "RewardTokenAdded",
    blockNumber,
    transactionHash,
  });
  if (!validated) { errorCount++; continue; }

  const rewardToken = validated.keys[0];
  const data = validated.data;

  rewardTokenRows.push({
    blockNumber,
    blockTimestamp: timestamp,
    transactionHash,
    eventIndex,
    sy: contractAddress,
    rewardToken,
    tokenIndex: readFeltAsNumber(data, 0, "index"),
    eventTimestamp: readFeltAsNumber(data, 1, "timestamp"),
  });
  continue;
}

// Add to transaction batch insert
await db.transaction(async (tx) => {
  // ... existing inserts ...

  if (negativeYieldRows.length > 0) {
    await tx.insert(syNegativeYieldDetected).values(negativeYieldRows).onConflictDoNothing();
  }
  if (pauseStateRows.length > 0) {
    await tx.insert(syPauseState).values(pauseStateRows).onConflictDoNothing();
  }
  if (rewardsClaimedRows.length > 0) {
    await tx.insert(syRewardsClaimed).values(rewardsClaimedRows).onConflictDoNothing();
  }
  if (rewardIndexRows.length > 0) {
    await tx.insert(syRewardIndexUpdated).values(rewardIndexRows).onConflictDoNothing();
  }
  if (rewardTokenRows.length > 0) {
    await tx.insert(syRewardTokenAdded).values(rewardTokenRows).onConflictDoNothing();
  }
});
```

### Step 4: Update Known Contracts

```typescript
// src/lib/constants.ts - Add SYWithRewards contracts when deployed

export const MAINNET: NetworkConfig = {
  // ... existing config ...
  knownSYContracts: [
    "0x0601a671...", // SY-hrzSTRK
  ],
  // Add when SYWithRewards contracts are deployed
  knownSYWithRewardsContracts: [
    // "0x..." // Future SYWithRewards contracts
  ],
};
```

---

## Frontend Integration Strategy

### API Endpoints

Create new API routes in `packages/frontend/src/app/api/`:

```typescript
// 1. GET /api/sy/[address]/pause-state
// Returns current pause state for an SY contract
// Query: SELECT * FROM sy_current_pause_state WHERE sy = $1

// 2. GET /api/sy/[address]/negative-yield
// Returns negative yield events for an SY contract
// Query: SELECT * FROM sy_negative_yield_detected WHERE sy = $1 ORDER BY block_number DESC LIMIT 10

// 3. GET /api/rewards/[user]
// Returns all reward claims for a user
// Query: SELECT * FROM sy_rewards_claimed WHERE "user" = $1 ORDER BY block_number DESC

// 4. GET /api/rewards/[user]/summary
// Returns aggregated reward stats for a user
// Query: SELECT * FROM user_reward_history WHERE "user" = $1

// 5. GET /api/sy/[address]/reward-apy
// Returns reward APY calculation for an SY
// Query: SELECT * FROM sy_reward_apy WHERE sy = $1
```

### React Query Hooks

```typescript
// src/features/rewards/model/useRewardHistory.ts
export function useRewardHistory(userAddress: string | undefined) {
  return useQuery({
    queryKey: ['rewards', 'history', userAddress],
    queryFn: () => fetch(`/api/rewards/${userAddress}`).then(r => r.json()),
    enabled: !!userAddress,
    staleTime: 60_000, // 1 minute
  });
}

// src/features/yield/model/useSyPauseState.ts (replace contract call with indexed data)
export function useSyPauseStateIndexed(syAddress: string | undefined) {
  return useQuery({
    queryKey: ['sy', 'pause-state', 'indexed', syAddress],
    queryFn: () => fetch(`/api/sy/${syAddress}/pause-state`).then(r => r.json()),
    enabled: !!syAddress,
    staleTime: 30_000,
  });
}

// src/features/yield/model/useNegativeYieldAlerts.ts
export function useNegativeYieldAlerts(syAddress: string | undefined) {
  return useQuery({
    queryKey: ['sy', 'negative-yield', syAddress],
    queryFn: () => fetch(`/api/sy/${syAddress}/negative-yield`).then(r => r.json()),
    enabled: !!syAddress,
    staleTime: 60_000,
  });
}

// src/features/rewards/model/useRewardApy.ts
export function useRewardApy(syAddress: string | undefined) {
  return useQuery({
    queryKey: ['sy', 'reward-apy', syAddress],
    queryFn: () => fetch(`/api/sy/${syAddress}/reward-apy`).then(r => r.json()),
    enabled: !!syAddress,
    staleTime: 300_000, // 5 minutes
  });
}
```

### UI Components

```typescript
// 1. NegativeYieldWarning - Banner when SY has negative yield
// Location: src/widgets/market-card/ui/NegativeYieldWarning.tsx
// Uses: useNegativeYieldAlerts hook

// 2. RewardClaimHistory - Table of past reward claims
// Location: src/features/rewards/ui/RewardClaimHistory.tsx
// Uses: useRewardHistory hook

// 3. RewardApyBadge - Display reward APY on market cards
// Location: src/features/rewards/ui/RewardApyBadge.tsx
// Uses: useRewardApy hook

// 4. PauseStateBanner - Warning when SY is paused
// Location: src/widgets/market-card/ui/PauseStateBanner.tsx
// Uses: useSyPauseStateIndexed hook (faster than contract call)
```

---

## Implementation Checklist

### Phase 1: Schema & Migration

- [x] Add 5 new tables to `src/schema/index.ts`
- [ ] Add 4 new views to `src/schema/index.ts`
- [x] Run `bun run db:generate` to create migration
- [x] Verify tables in Drizzle Studio (`bun run db:studio`)

### Phase 2: Indexer Updates

- [x] Add event selectors to `src/lib/constants.ts` (defined inline in sy.indexer.ts per existing pattern)
- [x] Add Zod validation schemas to `src/lib/validation.ts`
- [x] Update `sy.indexer.ts` with new event handlers
- [ ] Add SYWithRewards contracts to `knownSYContracts` when deployed
- [ ] Test indexer locally with devnet (`bun run dev`)

### Phase 3: Frontend API

- [x] Create `/api/sy/[address]/pause-state` route
- [x] Create `/api/sy/[address]/negative-yield` route
- [x] Create `/api/rewards/[user]` route
- [x] Create `/api/rewards/[user]/summary` route
- [x] Create `/api/sy/[address]/reward-apy` route
- [x] Add rate limiting to new endpoints (all routes use applyRateLimit)

### Phase 4: Frontend Hooks & UI

- [x] Create `useRewardHistory` hook (with `useRewardSummary`)
- [x] Create `useSyPauseStateIndexed` hook (with `useIsSyPausedIndexed`)
- [x] Create `useNegativeYieldAlerts` hook (with `useHasNegativeYieldHistory`)
- [x] Create `useRewardApy` hook (with `useTotalRewardApy`)
- [x] Create `NegativeYieldWarning` component (enhanced with `useIndexed` prop)
- [x] Create `RewardClaimHistory` component
- [x] Create `RewardApyBadge` component
- [x] Integrate pause state into existing warnings (via `useIndexed` prop on `PausedWarningBanner`)

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Starknet Blockchain                          │
│  SY/SYWithRewards contracts emit events                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Apibara DNA Stream                           │
│  Filters: NegativeYieldDetected, Paused, Unpaused,              │
│           RewardsClaimed, RewardIndexUpdated, RewardTokenAdded  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    sy.indexer.ts                                │
│  Parse events → Validate → Transform → Batch insert            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                          │
│  Tables: sy_negative_yield_detected, sy_pause_state,            │
│          sy_rewards_claimed, sy_reward_index_updated,           │
│          sy_reward_token_added                                  │
│  Views:  user_reward_history, sy_current_pause_state,           │
│          negative_yield_alerts, sy_reward_apy                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend API Routes                          │
│  /api/sy/[address]/pause-state                                  │
│  /api/sy/[address]/negative-yield                               │
│  /api/rewards/[user]                                            │
│  /api/sy/[address]/reward-apy                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    React Query Hooks                            │
│  useRewardHistory, useSyPauseStateIndexed,                      │
│  useNegativeYieldAlerts, useRewardApy                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UI Components                                │
│  NegativeYieldWarning, RewardClaimHistory,                      │
│  RewardApyBadge, PauseStateBanner                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Index from SY contracts (not SYWithRewards separately) | Same indexer, same factory discovery pattern |
| Use contract address as `sy` field | Derive from event source, not in event keys |
| Store pause events, not just current state | Enable historical analysis of pause/unpause patterns |
| Create materialized views for aggregations | Efficient queries without real-time aggregation |
| APY view uses 7-day rolling window | Balance between responsiveness and stability |
| Separate reward tables from YT interest | Different sources: SYWithRewards vs YT contract |

---

## Notes

1. **SYWithRewards vs SY**: Both contract types emit `NegativeYieldDetected`, `Paused`, `Unpaused`. Only SYWithRewards emits `RewardsClaimed`, `RewardIndexUpdated`, `RewardTokenAdded`.

2. **Factory Discovery**: The existing factory pattern will discover SYWithRewards contracts automatically since they're deployed via the same Factory.

3. **Event Key Structure**: Cairo events have `#[key]` fields that become indexed keys in the event. Non-key fields go into the data array.

4. **Timestamp Fields**: Events include `timestamp: u64` from the contract (block timestamp at emit time), which we store as `event_timestamp`. We also store `block_timestamp` from the indexer for ordering.
