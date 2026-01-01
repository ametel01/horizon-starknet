# YT Interest System Implementation Plan

## Overview

This plan implements 7 new YT events + MintPY schema update across the indexer and frontend, based on the research in `YT_INTEREST_FRONTEND_INDEXER_RESEARCH.md`.

**Total scope:** ~18-20 discrete steps across 2 packages (+ optional analytics views and admin UI)

---

## Phase 1: Indexer Database Schema (7 new tables + 1 update + optional views)

### Step 1.1: Update `yt_mint_py` table for split receivers **COMPLETE**

**File:** `packages/indexer/src/schema/index.ts:450-499`

**Change:** Replace single `receiver` column with `receiver_pt` and `receiver_yt`

**Note:** `expiry` stays in the table but now comes from event `data[0]` (keys no longer include expiry).

```typescript
// BEFORE (line 460)
receiver: text("receiver").notNull(),

// AFTER
receiver_pt: text("receiver_pt").notNull(),
receiver_yt: text("receiver_yt").notNull(),
```

**Also update indexes (lines 488-492):**
```typescript
// BEFORE
index("yt_mint_receiver_idx").on(table.receiver),

// AFTER
index("yt_mint_receiver_pt_idx").on(table.receiver_pt),
index("yt_mint_receiver_yt_idx").on(table.receiver_yt),
```

**Validation:**
```bash
cd packages/indexer && bun run typecheck
```

**Failure modes:**
- Type errors in `yt.indexer.ts` where `receiver` is used → Expected, fix in Step 2.1
- Migration conflicts if existing data → Run `bun run db:generate` to create migration

---

### Step 1.2: Add `yt_post_expiry_data_set` table **COMPLETE**
**File:** `packages/indexer/src/schema/index.ts` (after line 669, after `ytExpiryReached`)

**Add:**
```typescript
// PostExpiryDataSet: emitted once when post-expiry data is initialized
export const ytPostExpiryDataSet = pgTable(
  "yt_post_expiry_data_set",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Keys: [selector, yt, pt]
    yt: text("yt").notNull(),
    pt: text("pt").notNull(),
    // Data fields
    sy: text("sy").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    first_py_index: numeric("first_py_index", { precision: 78, scale: 0 }).notNull(),
    exchange_rate_at_init: numeric("exchange_rate_at_init", { precision: 78, scale: 0 }).notNull(),
    total_pt_supply: numeric("total_pt_supply", { precision: 78, scale: 0 }).notNull(),
    total_yt_supply: numeric("total_yt_supply", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    index("yt_peds_yt_idx").on(table.yt),
    index("yt_peds_pt_idx").on(table.pt),
    uniqueIndex("yt_peds_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index,
    ),
  ],
);
```

**Validation:**
```bash
cd packages/indexer && bun run typecheck
```

---

### Step 1.3: Add `yt_py_index_updated` table **COMPLETE**

**File:** `packages/indexer/src/schema/index.ts` (after `ytPostExpiryDataSet`)

**Add:**
```typescript
// PyIndexUpdated: emitted when PY index changes
export const ytPyIndexUpdated = pgTable(
  "yt_py_index_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Keys: [selector, yt]
    yt: text("yt").notNull(),
    // Data fields
    old_index: numeric("old_index", { precision: 78, scale: 0 }).notNull(),
    new_index: numeric("new_index", { precision: 78, scale: 0 }).notNull(),
    exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }).notNull(),
    index_block_number: bigint("index_block_number", { mode: "number" }).notNull(),
  },
  (table) => [
    index("yt_piu_yt_idx").on(table.yt),
    index("yt_piu_block_idx").on(table.index_block_number),
    uniqueIndex("yt_piu_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index,
    ),
  ],
);
```

---

### Step 1.4: Add `yt_treasury_interest_redeemed` table **COMPLETE**

**File:** `packages/indexer/src/schema/index.ts` (after `ytPyIndexUpdated`)

**Add:**
```typescript
// TreasuryInterestRedeemed: admin claims post-expiry yield
export const ytTreasuryInterestRedeemed = pgTable(
  "yt_treasury_interest_redeemed",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Keys: [selector, yt, treasury]
    yt: text("yt").notNull(),
    treasury: text("treasury").notNull(),
    // Data fields
    amount_sy: numeric("amount_sy", { precision: 78, scale: 0 }).notNull(),
    sy: text("sy").notNull(),
    expiry_index: numeric("expiry_index", { precision: 78, scale: 0 }).notNull(),
    current_index: numeric("current_index", { precision: 78, scale: 0 }).notNull(),
    total_yt_supply: numeric("total_yt_supply", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    index("yt_tir_yt_idx").on(table.yt),
    index("yt_tir_treasury_idx").on(table.treasury),
    uniqueIndex("yt_tir_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index,
    ),
  ],
);
```

---

### Step 1.5: Add `yt_interest_fee_rate_set` table **COMPLETE**

**File:** `packages/indexer/src/schema/index.ts` (after `ytTreasuryInterestRedeemed`)

**Add:**
```typescript
// InterestFeeRateSet: admin changes fee rate
export const ytInterestFeeRateSet = pgTable(
  "yt_interest_fee_rate_set",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Keys: [selector, yt]
    yt: text("yt").notNull(),
    // Data fields
    old_rate: numeric("old_rate", { precision: 78, scale: 0 }).notNull(),
    new_rate: numeric("new_rate", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    index("yt_ifrs_yt_idx").on(table.yt),
    uniqueIndex("yt_ifrs_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index,
    ),
  ],
);
```

---

### Step 1.6: Add `yt_mint_py_multi` table **COMPLETE**

**File:** `packages/indexer/src/schema/index.ts` (after `ytInterestFeeRateSet`)

**Add:**
```typescript
// MintPYMulti: batch minting
export const ytMintPYMulti = pgTable(
  "yt_mint_py_multi",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Keys: [selector, caller, expiry]
    caller: text("caller").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Data fields (yt derived from event.address)
    yt: text("yt").notNull(),
    total_sy_deposited: numeric("total_sy_deposited", { precision: 78, scale: 0 }).notNull(),
    total_py_minted: numeric("total_py_minted", { precision: 78, scale: 0 }).notNull(),
    receiver_count: integer("receiver_count").notNull(),
  },
  (table) => [
    index("yt_mpm_caller_idx").on(table.caller),
    index("yt_mpm_expiry_idx").on(table.expiry),
    index("yt_mpm_yt_idx").on(table.yt),
    uniqueIndex("yt_mpm_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index,
    ),
  ],
);
```

---

### Step 1.7: Add `yt_redeem_py_multi` table **COMPLETE**

**File:** `packages/indexer/src/schema/index.ts` (after `ytMintPYMulti`)

**Add:**
```typescript
// RedeemPYMulti: batch redemption
export const ytRedeemPYMulti = pgTable(
  "yt_redeem_py_multi",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Keys: [selector, caller, expiry]
    caller: text("caller").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Data fields
    yt: text("yt").notNull(),
    total_py_redeemed: numeric("total_py_redeemed", { precision: 78, scale: 0 }).notNull(),
    total_sy_returned: numeric("total_sy_returned", { precision: 78, scale: 0 }).notNull(),
    receiver_count: integer("receiver_count").notNull(),
  },
  (table) => [
    index("yt_rpm_caller_idx").on(table.caller),
    index("yt_rpm_expiry_idx").on(table.expiry),
    index("yt_rpm_yt_idx").on(table.yt),
    uniqueIndex("yt_rpm_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index,
    ),
  ],
);
```

---

### Step 1.8: Add `yt_redeem_py_with_interest` table **COMPLETE**

**File:** `packages/indexer/src/schema/index.ts` (after `ytRedeemPYMulti`)

**Add:**
```typescript
// RedeemPYWithInterest: combined redeem + claim
export const ytRedeemPYWithInterest = pgTable(
  "yt_redeem_py_with_interest",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Keys: [selector, caller, receiver, expiry]
    caller: text("caller").notNull(),
    receiver: text("receiver").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Data fields
    yt: text("yt").notNull(),
    amount_py_redeemed: numeric("amount_py_redeemed", { precision: 78, scale: 0 }).notNull(),
    amount_sy_from_redeem: numeric("amount_sy_from_redeem", { precision: 78, scale: 0 }).notNull(),
    amount_interest_claimed: numeric("amount_interest_claimed", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    index("yt_rpwi_caller_idx").on(table.caller),
    index("yt_rpwi_receiver_idx").on(table.receiver),
    index("yt_rpwi_expiry_idx").on(table.expiry),
    index("yt_rpwi_yt_idx").on(table.yt),
    uniqueIndex("yt_rpwi_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index,
    ),
  ],
);
```

---

### Step 1.9: Generate database migration **COMPLETE**

**Command:**
```bash
cd packages/indexer && bun run db:generate
```

**Validation:**
- Check `drizzle/` folder for new migration file
- Review migration SQL for correctness
- Run `bun run typecheck` to ensure schema exports work

**Failure modes:**
- "No schema changes detected" → Schema file not saved correctly
- Migration file empty → Check Drizzle config in `drizzle.config.ts`

---

### Step 1.10: Add analytics views (optional but recommended) ✅ **COMPLETE**

**File:** SQL migration in `packages/indexer/drizzle/` (or a manual SQL step)

**Add:**
```sql
-- Tracks current fee rate per YT and rate change history
CREATE MATERIALIZED VIEW yt_fee_analytics AS
SELECT
  yt,
  MAX(new_rate) as current_fee_rate,
  COUNT(*) as rate_change_count,
  MAX(block_timestamp) as last_change
FROM yt_interest_fee_rate_set
GROUP BY yt;

-- Aggregates total treasury claims per YT
CREATE MATERIALIZED VIEW treasury_yield_summary AS
SELECT
  yt,
  treasury,
  SUM(amount_sy::numeric) as total_sy_claimed,
  COUNT(*) as claim_count,
  MAX(block_timestamp) as last_claim
FROM yt_treasury_interest_redeemed
GROUP BY yt, treasury;

-- Aggregates batch mint/redeem activity per caller
CREATE MATERIALIZED VIEW batch_operations_summary AS
SELECT
  caller,
  SUM(total_sy_deposited::numeric) FILTER (WHERE table_source = 'mint') as total_batch_minted_sy,
  SUM(total_py_minted::numeric) FILTER (WHERE table_source = 'mint') as total_batch_minted_py,
  SUM(total_sy_returned::numeric) FILTER (WHERE table_source = 'redeem') as total_batch_redeemed_sy,
  SUM(receiver_count) as total_receivers_served,
  COUNT(*) as batch_operation_count
FROM (
  SELECT caller, total_sy_deposited, total_py_minted, NULL as total_sy_returned, receiver_count, 'mint' as table_source
  FROM yt_mint_py_multi
  UNION ALL
  SELECT caller, NULL, NULL, total_sy_returned, receiver_count, 'redeem' as table_source
  FROM yt_redeem_py_multi
) combined
GROUP BY caller;

-- Tracks redemptions that also claimed interest
CREATE VIEW redeem_with_interest_analytics AS
SELECT
  r.yt,
  r.caller,
  r.receiver,
  r.expiry,
  r.amount_py_redeemed,
  r.amount_sy_from_redeem,
  r.amount_interest_claimed,
  r.block_timestamp,
  (r.amount_interest_claimed::numeric * 100 / NULLIF(r.amount_sy_from_redeem::numeric + r.amount_interest_claimed::numeric, 0)) as interest_percentage
FROM yt_redeem_py_with_interest r
ORDER BY r.block_timestamp DESC;
```

**Validation:**
```bash
cd packages/indexer && bun run db:push
```

---

## Phase 2: Indexer Validation Schemas (8 schemas)

### Step 2.1: Update MintPY validation schema **COMPLETE**

**File:** `packages/indexer/src/lib/validation.ts:222-227`

**Change:**
```typescript
// BEFORE
export const ytMintPYSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, "MintPY requires at least 4 keys"),
  data: z
    .array(z.string())
    .min(14, "MintPY requires at least 14 data elements"),
});

// AFTER (split receivers: keys now has 4 keys [selector, caller, receiver_pt, receiver_yt])
// Data now includes expiry (moved from keys) + timestamp
export const ytMintPYSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, "MintPY requires at least 4 keys"),
  data: z
    .array(z.string())
    .min(16, "MintPY requires at least 16 data elements"),
});
```

**Validation:**
```bash
cd packages/indexer && bun run typecheck
```

---

### Step 2.2: Add 7 new YT validation schemas **COMPLETE**

**File:** `packages/indexer/src/lib/validation.ts` (after line 278, after `ytExpiryReachedSchema`)

**Add:**
```typescript
// ============================================================
// YT NEW EVENTS (7 schemas) - Pendle-style interest system
// ============================================================

/**
 * YT.TreasuryInterestRedeemed event
 * keys: [selector, yt, treasury]
 * data: [amount_sy(u256), sy, expiry_index(u256), current_index(u256), total_yt_supply(u256), timestamp]
 */
export const ytTreasuryInterestRedeemedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "TreasuryInterestRedeemed requires at least 3 keys"),
  data: z.array(z.string()).min(10, "TreasuryInterestRedeemed requires at least 10 data elements"),
});

/**
 * YT.InterestFeeRateSet event
 * keys: [selector, yt]
 * data: [old_rate(u256), new_rate(u256), timestamp]
 */
export const ytInterestFeeRateSetSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(2, "InterestFeeRateSet requires at least 2 keys"),
  data: z.array(z.string()).min(5, "InterestFeeRateSet requires at least 5 data elements"),
});

/**
 * YT.MintPYMulti event
 * keys: [selector, caller, expiry]
 * data: [total_sy_deposited(u256), total_py_minted(u256), receiver_count, timestamp]
 */
export const ytMintPYMultiSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "MintPYMulti requires at least 3 keys"),
  data: z.array(z.string()).min(6, "MintPYMulti requires at least 6 data elements"),
});

/**
 * YT.RedeemPYMulti event
 * keys: [selector, caller, expiry]
 * data: [total_py_redeemed(u256), total_sy_returned(u256), receiver_count, timestamp]
 */
export const ytRedeemPYMultiSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "RedeemPYMulti requires at least 3 keys"),
  data: z.array(z.string()).min(6, "RedeemPYMulti requires at least 6 data elements"),
});

/**
 * YT.RedeemPYWithInterest event
 * keys: [selector, caller, receiver, expiry]
 * data: [amount_py_redeemed(u256), amount_sy_from_redeem(u256), amount_interest_claimed(u256), timestamp]
 */
export const ytRedeemPYWithInterestSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, "RedeemPYWithInterest requires at least 4 keys"),
  data: z.array(z.string()).min(7, "RedeemPYWithInterest requires at least 7 data elements"),
});

/**
 * YT.PostExpiryDataSet event
 * keys: [selector, yt, pt]
 * data: [sy, expiry, first_py_index(u256), exchange_rate_at_init(u256), total_pt_supply(u256), total_yt_supply(u256), timestamp]
 */
export const ytPostExpiryDataSetSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "PostExpiryDataSet requires at least 3 keys"),
  data: z.array(z.string()).min(11, "PostExpiryDataSet requires at least 11 data elements"),
});

/**
 * YT.PyIndexUpdated event
 * keys: [selector, yt]
 * data: [old_index(u256), new_index(u256), exchange_rate(u256), block_number, timestamp]
 */
export const ytPyIndexUpdatedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(2, "PyIndexUpdated requires at least 2 keys"),
  data: z.array(z.string()).min(8, "PyIndexUpdated requires at least 8 data elements"),
});
```

**Also add to `eventSchemas` map (around line 570):**
```typescript
// YT (new events)
TreasuryInterestRedeemed: ytTreasuryInterestRedeemedSchema,
InterestFeeRateSet: ytInterestFeeRateSetSchema,
MintPYMulti: ytMintPYMultiSchema,
RedeemPYMulti: ytRedeemPYMultiSchema,
RedeemPYWithInterest: ytRedeemPYWithInterestSchema,
PostExpiryDataSet: ytPostExpiryDataSetSchema,
PyIndexUpdated: ytPyIndexUpdatedSchema,
```

**Validation:**
```bash
cd packages/indexer && bun run typecheck
```

---

## Phase 3: YT Indexer Event Handlers

### Step 3.1: Add new event selectors

**File:** `packages/indexer/src/indexers/yt.indexer.ts:57-64`

**Add after line 64:**
```typescript
// New YT events (Pendle-style interest system)
const TREASURY_INTEREST_REDEEMED = getSelector("TreasuryInterestRedeemed");
const INTEREST_FEE_RATE_SET = getSelector("InterestFeeRateSet");
const MINT_PY_MULTI = getSelector("MintPYMulti");
const REDEEM_PY_MULTI = getSelector("RedeemPYMulti");
const REDEEM_PY_WITH_INTEREST = getSelector("RedeemPYWithInterest");
const POST_EXPIRY_DATA_SET = getSelector("PostExpiryDataSet");
const PY_INDEX_UPDATED = getSelector("PyIndexUpdated");
```

---

### Step 3.2: Add new table imports and drizzle registration

**File:** `packages/indexer/src/indexers/yt.indexer.ts:22-28`

**Update imports:**
```typescript
import {
  ytExpiryReached,
  ytInterestClaimed,
  ytInterestFeeRateSet,     // NEW
  ytMintPY,
  ytMintPYMulti,            // NEW
  ytPostExpiryDataSet,      // NEW
  ytPyIndexUpdated,         // NEW
  ytRedeemPY,
  ytRedeemPYMulti,          // NEW
  ytRedeemPYPostExpiry,
  ytRedeemPYWithInterest,   // NEW
  ytTreasuryInterestRedeemed, // NEW
} from "@/schema";
```

**Update validation imports (lines 43-50):**
```typescript
import {
  validateEvent,
  ytExpiryReachedSchema,
  ytInterestClaimedSchema,
  ytInterestFeeRateSetSchema,      // NEW
  ytMintPYMultiSchema,             // NEW
  ytMintPYSchema,
  ytPostExpiryDataSetSchema,       // NEW
  ytPyIndexUpdatedSchema,          // NEW
  ytRedeemPYMultiSchema,           // NEW
  ytRedeemPYPostExpirySchema,
  ytRedeemPYSchema,
  ytRedeemPYWithInterestSchema,    // NEW
  ytTreasuryInterestRedeemedSchema, // NEW
} from "../lib/validation";
```

**Update drizzle registration (lines 71-79):**
```typescript
const database = drizzle(
  getDrizzleOptions({
    ytMintPY,
    ytRedeemPY,
    ytRedeemPYPostExpiry,
    ytInterestClaimed,
    ytExpiryReached,
    // New tables
    ytPostExpiryDataSet,
    ytPyIndexUpdated,
    ytTreasuryInterestRedeemed,
    ytInterestFeeRateSet,
    ytMintPYMulti,
    ytRedeemPYMulti,
    ytRedeemPYWithInterest,
  }),
);
```

---

### Step 3.3: Update event filters for new events

**File:** `packages/indexer/src/indexers/yt.indexer.ts:90-98`

**Update known YT filters:**
```typescript
const knownYTFilters = config.knownYTContracts.flatMap(
  (ytAddress: `0x${string}`) => [
    { address: ytAddress, keys: [MINT_PY] },
    { address: ytAddress, keys: [REDEEM_PY] },
    { address: ytAddress, keys: [REDEEM_PY_POST_EXPIRY] },
    { address: ytAddress, keys: [INTEREST_CLAIMED] },
    { address: ytAddress, keys: [EXPIRY_REACHED] },
    // New events
    { address: ytAddress, keys: [TREASURY_INTEREST_REDEEMED] },
    { address: ytAddress, keys: [INTEREST_FEE_RATE_SET] },
    { address: ytAddress, keys: [MINT_PY_MULTI] },
    { address: ytAddress, keys: [REDEEM_PY_MULTI] },
    { address: ytAddress, keys: [REDEEM_PY_WITH_INTEREST] },
    { address: ytAddress, keys: [POST_EXPIRY_DATA_SET] },
    { address: ytAddress, keys: [PY_INDEX_UPDATED] },
  ],
);
```

**Update factory function (lines 133-139):**
```typescript
return [
  { address: ytAddress, keys: [MINT_PY] },
  { address: ytAddress, keys: [REDEEM_PY] },
  { address: ytAddress, keys: [REDEEM_PY_POST_EXPIRY] },
  { address: ytAddress, keys: [INTEREST_CLAIMED] },
  { address: ytAddress, keys: [EXPIRY_REACHED] },
  // New events
  { address: ytAddress, keys: [TREASURY_INTEREST_REDEEMED] },
  { address: ytAddress, keys: [INTEREST_FEE_RATE_SET] },
  { address: ytAddress, keys: [MINT_PY_MULTI] },
  { address: ytAddress, keys: [REDEEM_PY_MULTI] },
  { address: ytAddress, keys: [REDEEM_PY_WITH_INTEREST] },
  { address: ytAddress, keys: [POST_EXPIRY_DATA_SET] },
  { address: ytAddress, keys: [PY_INDEX_UPDATED] },
];
```

---

### Step 3.4: Update MintPY parsing for split receivers

**File:** `packages/indexer/src/indexers/yt.indexer.ts:187-231`

**Update MintPY parsing:**
```typescript
if (matchSelector(eventKey, MINT_PY)) {
  const validated = validateEvent(ytMintPYSchema, event, {
    indexer: "yt",
    eventName: "MintPY",
    blockNumber,
    transactionHash,
  });
  if (!validated) {
    errorCount++;
    continue;
  }

  // NEW layout: keys[selector, caller, receiver_pt, receiver_yt]
  const caller = validated.keys[1] ?? "";
  const receiverPt = validated.keys[2] ?? "";
  const receiverYt = validated.keys[3] ?? "";

  // NEW layout: data[expiry, amount_sy_deposited(u256), amount_py_minted(u256), pt, sy, py_index(u256),
  //             exchange_rate(u256), total_pt_supply(u256), total_yt_supply(u256), timestamp]
  const data = validated.data;
  const expiry = Number(BigInt(data[0] ?? "0"));
  const amountSyDeposited = readU256(data, 1, "amount_sy_deposited");
  const amountPyMinted = readU256(data, 3, "amount_py_minted");
  const pt = data[5] ?? "";
  const sy = data[6] ?? "";
  const pyIndex = readU256(data, 7, "py_index");
  const exchangeRate = readU256(data, 9, "exchange_rate");
  const totalPtSupply = readU256(data, 11, "total_pt_supply");
  const totalYtSupply = readU256(data, 13, "total_yt_supply");

  mintPYRows.push({
    block_number: blockNumber,
    block_timestamp: blockTimestamp,
    transaction_hash: transactionHash,
    event_index: eventIndex,
    caller,
    receiver_pt: receiverPt,  // CHANGED
    receiver_yt: receiverYt,  // CHANGED
    expiry,
    yt: ytAddress,
    sy,
    pt,
    amount_sy_deposited: amountSyDeposited,
    amount_py_minted: amountPyMinted,
    py_index: pyIndex,
    exchange_rate: exchangeRate,
    total_pt_supply_after: totalPtSupply,
    total_yt_supply_after: totalYtSupply,
  });
}
```

---

### Step 3.5: Add row type definitions and collection arrays

**File:** `packages/indexer/src/indexers/yt.indexer.ts:163-173`

**Add after existing type definitions:**
```typescript
// Existing types
type MintPYRow = typeof ytMintPY.$inferInsert;
type RedeemPYRow = typeof ytRedeemPY.$inferInsert;
type RedeemPostExpiryRow = typeof ytRedeemPYPostExpiry.$inferInsert;
type InterestClaimedRow = typeof ytInterestClaimed.$inferInsert;
type ExpiryReachedRow = typeof ytExpiryReached.$inferInsert;

// New types
type PostExpiryDataSetRow = typeof ytPostExpiryDataSet.$inferInsert;
type PyIndexUpdatedRow = typeof ytPyIndexUpdated.$inferInsert;
type TreasuryInterestRedeemedRow = typeof ytTreasuryInterestRedeemed.$inferInsert;
type InterestFeeRateSetRow = typeof ytInterestFeeRateSet.$inferInsert;
type MintPYMultiRow = typeof ytMintPYMulti.$inferInsert;
type RedeemPYMultiRow = typeof ytRedeemPYMulti.$inferInsert;
type RedeemPYWithInterestRow = typeof ytRedeemPYWithInterest.$inferInsert;

// Existing arrays
const mintPYRows: MintPYRow[] = [];
const redeemPYRows: RedeemPYRow[] = [];
const redeemPostExpiryRows: RedeemPostExpiryRow[] = [];
const interestClaimedRows: InterestClaimedRow[] = [];
const expiryReachedRows: ExpiryReachedRow[] = [];

// New arrays
const postExpiryDataSetRows: PostExpiryDataSetRow[] = [];
const pyIndexUpdatedRows: PyIndexUpdatedRow[] = [];
const treasuryInterestRedeemedRows: TreasuryInterestRedeemedRow[] = [];
const interestFeeRateSetRows: InterestFeeRateSetRow[] = [];
const mintPYMultiRows: MintPYMultiRow[] = [];
const redeemPYMultiRows: RedeemPYMultiRow[] = [];
const redeemPYWithInterestRows: RedeemPYWithInterestRow[] = [];
```

---

### Step 3.6: Add event parsing for 7 new events

**File:** `packages/indexer/src/indexers/yt.indexer.ts` (after ExpiryReached handling, before catch block ~line 396)

**Add parsing for each new event:**

```typescript
} else if (matchSelector(eventKey, POST_EXPIRY_DATA_SET)) {
  const validated = validateEvent(ytPostExpiryDataSetSchema, event, {
    indexer: "yt",
    eventName: "PostExpiryDataSet",
    blockNumber,
    transactionHash,
  });
  if (!validated) {
    errorCount++;
    continue;
  }

  // keys: [selector, yt, pt]
  const yt = validated.keys[1] ?? ytAddress;
  const pt = validated.keys[2] ?? "";

  // data: [sy, expiry, first_py_index(u256), exchange_rate_at_init(u256),
  //        total_pt_supply(u256), total_yt_supply(u256), timestamp]
  const data = validated.data;
  const sy = data[0] ?? "";
  const expiry = Number(BigInt(data[1] ?? "0"));
  const firstPyIndex = readU256(data, 2, "first_py_index");
  const exchangeRateAtInit = readU256(data, 4, "exchange_rate_at_init");
  const totalPtSupply = readU256(data, 6, "total_pt_supply");
  const totalYtSupply = readU256(data, 8, "total_yt_supply");

  postExpiryDataSetRows.push({
    block_number: blockNumber,
    block_timestamp: blockTimestamp,
    transaction_hash: transactionHash,
    event_index: eventIndex,
    yt,
    pt,
    sy,
    expiry,
    first_py_index: firstPyIndex,
    exchange_rate_at_init: exchangeRateAtInit,
    total_pt_supply: totalPtSupply,
    total_yt_supply: totalYtSupply,
  });

} else if (matchSelector(eventKey, PY_INDEX_UPDATED)) {
  const validated = validateEvent(ytPyIndexUpdatedSchema, event, {
    indexer: "yt",
    eventName: "PyIndexUpdated",
    blockNumber,
    transactionHash,
  });
  if (!validated) {
    errorCount++;
    continue;
  }

  // keys: [selector, yt]
  const yt = validated.keys[1] ?? ytAddress;

  // data: [old_index(u256), new_index(u256), exchange_rate(u256), block_number, timestamp]
  const data = validated.data;
  const oldIndex = readU256(data, 0, "old_index");
  const newIndex = readU256(data, 2, "new_index");
  const exchangeRate = readU256(data, 4, "exchange_rate");
  const indexBlockNumber = Number(BigInt(data[6] ?? "0"));

  pyIndexUpdatedRows.push({
    block_number: blockNumber,
    block_timestamp: blockTimestamp,
    transaction_hash: transactionHash,
    event_index: eventIndex,
    yt,
    old_index: oldIndex,
    new_index: newIndex,
    exchange_rate: exchangeRate,
    index_block_number: indexBlockNumber,
  });

} else if (matchSelector(eventKey, TREASURY_INTEREST_REDEEMED)) {
  const validated = validateEvent(ytTreasuryInterestRedeemedSchema, event, {
    indexer: "yt",
    eventName: "TreasuryInterestRedeemed",
    blockNumber,
    transactionHash,
  });
  if (!validated) {
    errorCount++;
    continue;
  }

  // keys: [selector, yt, treasury]
  const yt = validated.keys[1] ?? ytAddress;
  const treasury = validated.keys[2] ?? "";

  // data: [amount_sy(u256), sy, expiry_index(u256), current_index(u256), total_yt_supply(u256), timestamp]
  const data = validated.data;
  const amountSy = readU256(data, 0, "amount_sy");
  const sy = data[2] ?? "";
  const expiryIndex = readU256(data, 3, "expiry_index");
  const currentIndex = readU256(data, 5, "current_index");
  const totalYtSupply = readU256(data, 7, "total_yt_supply");

  treasuryInterestRedeemedRows.push({
    block_number: blockNumber,
    block_timestamp: blockTimestamp,
    transaction_hash: transactionHash,
    event_index: eventIndex,
    yt,
    treasury,
    amount_sy: amountSy,
    sy,
    expiry_index: expiryIndex,
    current_index: currentIndex,
    total_yt_supply: totalYtSupply,
  });

} else if (matchSelector(eventKey, INTEREST_FEE_RATE_SET)) {
  const validated = validateEvent(ytInterestFeeRateSetSchema, event, {
    indexer: "yt",
    eventName: "InterestFeeRateSet",
    blockNumber,
    transactionHash,
  });
  if (!validated) {
    errorCount++;
    continue;
  }

  // keys: [selector, yt]
  const yt = validated.keys[1] ?? ytAddress;

  // data: [old_rate(u256), new_rate(u256), timestamp]
  const data = validated.data;
  const oldRate = readU256(data, 0, "old_rate");
  const newRate = readU256(data, 2, "new_rate");

  interestFeeRateSetRows.push({
    block_number: blockNumber,
    block_timestamp: blockTimestamp,
    transaction_hash: transactionHash,
    event_index: eventIndex,
    yt,
    old_rate: oldRate,
    new_rate: newRate,
  });

} else if (matchSelector(eventKey, MINT_PY_MULTI)) {
  const validated = validateEvent(ytMintPYMultiSchema, event, {
    indexer: "yt",
    eventName: "MintPYMulti",
    blockNumber,
    transactionHash,
  });
  if (!validated) {
    errorCount++;
    continue;
  }

  // keys: [selector, caller, expiry]
  const caller = validated.keys[1] ?? "";
  const expiry = Number(BigInt(validated.keys[2] ?? "0"));

  // data: [total_sy_deposited(u256), total_py_minted(u256), receiver_count, timestamp]
  const data = validated.data;
  const totalSyDeposited = readU256(data, 0, "total_sy_deposited");
  const totalPyMinted = readU256(data, 2, "total_py_minted");
  const receiverCount = Number(BigInt(data[4] ?? "0"));

  mintPYMultiRows.push({
    block_number: blockNumber,
    block_timestamp: blockTimestamp,
    transaction_hash: transactionHash,
    event_index: eventIndex,
    caller,
    expiry,
    yt: ytAddress,
    total_sy_deposited: totalSyDeposited,
    total_py_minted: totalPyMinted,
    receiver_count: receiverCount,
  });

} else if (matchSelector(eventKey, REDEEM_PY_MULTI)) {
  const validated = validateEvent(ytRedeemPYMultiSchema, event, {
    indexer: "yt",
    eventName: "RedeemPYMulti",
    blockNumber,
    transactionHash,
  });
  if (!validated) {
    errorCount++;
    continue;
  }

  // keys: [selector, caller, expiry]
  const caller = validated.keys[1] ?? "";
  const expiry = Number(BigInt(validated.keys[2] ?? "0"));

  // data: [total_py_redeemed(u256), total_sy_returned(u256), receiver_count, timestamp]
  const data = validated.data;
  const totalPyRedeemed = readU256(data, 0, "total_py_redeemed");
  const totalSyReturned = readU256(data, 2, "total_sy_returned");
  const receiverCount = Number(BigInt(data[4] ?? "0"));

  redeemPYMultiRows.push({
    block_number: blockNumber,
    block_timestamp: blockTimestamp,
    transaction_hash: transactionHash,
    event_index: eventIndex,
    caller,
    expiry,
    yt: ytAddress,
    total_py_redeemed: totalPyRedeemed,
    total_sy_returned: totalSyReturned,
    receiver_count: receiverCount,
  });

} else if (matchSelector(eventKey, REDEEM_PY_WITH_INTEREST)) {
  const validated = validateEvent(ytRedeemPYWithInterestSchema, event, {
    indexer: "yt",
    eventName: "RedeemPYWithInterest",
    blockNumber,
    transactionHash,
  });
  if (!validated) {
    errorCount++;
    continue;
  }

  // keys: [selector, caller, receiver, expiry]
  const caller = validated.keys[1] ?? "";
  const receiver = validated.keys[2] ?? "";
  const expiry = Number(BigInt(validated.keys[3] ?? "0"));

  // data: [amount_py_redeemed(u256), amount_sy_from_redeem(u256), amount_interest_claimed(u256), timestamp]
  const data = validated.data;
  const amountPyRedeemed = readU256(data, 0, "amount_py_redeemed");
  const amountSyFromRedeem = readU256(data, 2, "amount_sy_from_redeem");
  const amountInterestClaimed = readU256(data, 4, "amount_interest_claimed");

  redeemPYWithInterestRows.push({
    block_number: blockNumber,
    block_timestamp: blockTimestamp,
    transaction_hash: transactionHash,
    event_index: eventIndex,
    caller,
    receiver,
    expiry,
    yt: ytAddress,
    amount_py_redeemed: amountPyRedeemed,
    amount_sy_from_redeem: amountSyFromRedeem,
    amount_interest_claimed: amountInterestClaimed,
  });
}
```

---

### Step 3.7: Update batch insert for new tables

**File:** `packages/indexer/src/indexers/yt.indexer.ts:430-460`

**Add inserts for new tables:**
```typescript
await measureDbLatency("yt", async () => {
  await db.transaction(async (tx) => {
    // Existing inserts
    if (mintPYRows.length > 0) {
      await tx.insert(ytMintPY).values(mintPYRows).onConflictDoNothing();
    }
    if (redeemPYRows.length > 0) {
      await tx.insert(ytRedeemPY).values(redeemPYRows).onConflictDoNothing();
    }
    if (redeemPostExpiryRows.length > 0) {
      await tx.insert(ytRedeemPYPostExpiry).values(redeemPostExpiryRows).onConflictDoNothing();
    }
    if (interestClaimedRows.length > 0) {
      await tx.insert(ytInterestClaimed).values(interestClaimedRows).onConflictDoNothing();
    }
    if (expiryReachedRows.length > 0) {
      await tx.insert(ytExpiryReached).values(expiryReachedRows).onConflictDoNothing();
    }
    // New inserts
    if (postExpiryDataSetRows.length > 0) {
      await tx.insert(ytPostExpiryDataSet).values(postExpiryDataSetRows).onConflictDoNothing();
    }
    if (pyIndexUpdatedRows.length > 0) {
      await tx.insert(ytPyIndexUpdated).values(pyIndexUpdatedRows).onConflictDoNothing();
    }
    if (treasuryInterestRedeemedRows.length > 0) {
      await tx.insert(ytTreasuryInterestRedeemed).values(treasuryInterestRedeemedRows).onConflictDoNothing();
    }
    if (interestFeeRateSetRows.length > 0) {
      await tx.insert(ytInterestFeeRateSet).values(interestFeeRateSetRows).onConflictDoNothing();
    }
    if (mintPYMultiRows.length > 0) {
      await tx.insert(ytMintPYMulti).values(mintPYMultiRows).onConflictDoNothing();
    }
    if (redeemPYMultiRows.length > 0) {
      await tx.insert(ytRedeemPYMulti).values(redeemPYMultiRows).onConflictDoNothing();
    }
    if (redeemPYWithInterestRows.length > 0) {
      await tx.insert(ytRedeemPYWithInterest).values(redeemPYWithInterestRows).onConflictDoNothing();
    }
  });
});
```

**Update metrics (line 464-470):**
```typescript
const successCount =
  mintPYRows.length +
  redeemPYRows.length +
  redeemPostExpiryRows.length +
  interestClaimedRows.length +
  expiryReachedRows.length +
  postExpiryDataSetRows.length +
  pyIndexUpdatedRows.length +
  treasuryInterestRedeemedRows.length +
  interestFeeRateSetRows.length +
  mintPYMultiRows.length +
  redeemPYMultiRows.length +
  redeemPYWithInterestRows.length;
```

---

### Step 3.8: Validate indexer changes

**Commands:**
```bash
cd packages/indexer
bun run typecheck
bun run lint
bun run test
```

**Failure modes:**
- Type errors → Missing imports or schema mismatches
- Lint errors → Code style issues
- Test failures → Event parsing logic errors

---

## Phase 4: Indexer Final Validation

### Step 4.1: Run full indexer check

**Commands:**
```bash
cd packages/indexer
bun run check           # typecheck + lint + format:check
bun run db:push         # Push schema to dev database (skip migrations for dev)
```

**Validation:**
- All checks pass
- Database schema updated successfully
- No runtime errors when starting indexer

---

### Step 4.2: Test with devnet

**Commands:**
```bash
# Terminal 1: Start devnet
make dev-up

# Terminal 2: Run indexer
cd packages/indexer && bun run dev
```

**Validation:**
- Indexer starts without errors
- Factory events are captured
- New YT events are indexed when triggered

**Failure modes:**
- "Table not found" → Run `bun run db:push`
- "Invalid column" → Schema mismatch, regenerate migration
- Event parsing errors → Check data offsets in research doc

---

## Phase 5: Frontend Changes (Deferred)

The following frontend changes are documented for future implementation:

### 5.1: New Hooks (Priority: Medium)
- `useInterestFee(ytAddress)` - Get current fee rate and treasury
- `usePostExpiryStatus(ytAddress)` - Get post-expiry state
- Update `useYield` and `useUserYield` to include gross/net yield + fee tracking

### 5.2: Component Updates (Priority: Medium)
- `InterestClaimPreview` - Show fee breakdown before claim
- Position card updates for post-expiry badge + fee rate indicator
- Add split PT/YT receiver selection for mint (if direct YT calls are exposed)

### 5.3: Redeem Updates (Priority: High)
- Add `redeemWithInterest` to `useRedeem` hook
- Support combined PT/YT redeem + interest claim

### 5.4: Treasury Admin UI (Priority: Low, Optional)
- Add a simple treasury dashboard using `useTreasuryYield` for pending/claimed yield

### 5.5: API Endpoints (Priority: Low)
- `GET /api/yt/[address]/fee-history`
- `GET /api/yt/[address]/post-expiry`
- `GET /api/analytics/treasury`
- `GET /api/py-index/[yt]/history`

---

## Frontend Behavior Notes (Critical)

- **Pre-transfer pattern:** direct YT calls must transfer SY/PT/YT before `mint_py`/`redeem_py`; router flows are unaffected.
- **Interest formula:** display underlying value (or net SY) since the normalized formula reduces raw SY amounts.
- **Post-expiry carve-out:** post-expiry redemptions return slightly less SY; reflect treasury carve-out in UI copy.

---

## Execution Checklist

### Indexer (Phases 1-4)
- [x] Step 1.1: Update yt_mint_py table
- [x] Step 1.2: Add yt_post_expiry_data_set table
- [x] Step 1.3: Add yt_py_index_updated table
- [x] Step 1.4: Add yt_treasury_interest_redeemed table
- [x] Step 1.5: Add yt_interest_fee_rate_set table
- [x] Step 1.6: Add yt_mint_py_multi table
- [x] Step 1.7: Add yt_redeem_py_multi table
- [x] Step 1.8: Add yt_redeem_py_with_interest table
- [x] Step 1.9: Generate database migration
- [x] Step 1.10: Add analytics views (optional)
- [x] Step 2.1: Update MintPY validation schema
- [x] Step 2.2: Add 7 new validation schemas
- [ ] Step 3.1: Add new event selectors
- [ ] Step 3.2: Add table imports and drizzle registration
- [ ] Step 3.3: Update event filters
- [ ] Step 3.4: Update MintPY parsing
- [ ] Step 3.5: Add row type definitions
- [ ] Step 3.6: Add event parsing for 7 new events
- [ ] Step 3.7: Update batch insert
- [ ] Step 3.8: Validate indexer changes
- [ ] Step 4.1: Run full indexer check
- [ ] Step 4.2: Test with devnet

### Frontend (Phase 5 - Deferred)
- [ ] Step 5.1: New hooks
- [ ] Step 5.2: Component updates
- [ ] Step 5.3: Redeem updates
- [ ] Step 5.4: Treasury admin UI
- [ ] Step 5.5: API endpoints

---

## Runtime Validation Notes

After implementation, verify with devnet events:
1. Emit each new event type from contract
2. Verify data offsets match ABI specification
3. Confirm fee calculation precision matches contract WAD math
4. Test pre-transfer pattern in frontend flows

---

## References

- Research: `YT_INTEREST_FRONTEND_INDEXER_RESEARCH.md`
- YT ABI: `packages/indexer/src/lib/abi/yt.json`
- Contract: `contracts/src/tokens/yt.cairo`
