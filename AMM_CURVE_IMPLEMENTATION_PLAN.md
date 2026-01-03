# AMM Curve Integration Implementation Plan

**Date:** 2025-01-02
**Source:** `AMM_CURVE_INTEGRATION_ANALYSIS.md`
**Scope:** Indexer and Frontend integration for reserve fee and enhanced swap events

---

## Pre-Implementation Verification

Before starting, verify contract changes are deployed and events are emitting:

```bash
# 1. Build and test contracts
cd contracts && scarb build && snforge test

# 2. Verify Swap + MarketCreated ABI ordering
rg -n -C 6 "\"name\": \"Swap\"" target/dev/*.json
rg -n -C 6 "\"name\": \"MarketCreated\"" target/dev/*.json

# 3. Verify ReserveFeeTransferred event exists
rg -n -C 6 "\"name\": \"ReserveFeeTransferred\"" target/dev/*.json
```

**Failure mode:** If events/fields are not in ABI, contract changes are incomplete or ABI was not regenerated.

---

## Phase 1: Indexer Schema Updates **COMPLETE**

### Step 1.1: Update existing tables for new fee fields **COMPLETE**

**File:** `packages/indexer/src/schema/index.ts`

**Action:** Update existing tables to match new event payloads.

```typescript
// market_factory_market_created: replace fee_rate + add reserve_fee_percent
// (remove fee_rate, keep naming aligned with on-chain event)
ln_fee_rate_root: numeric("ln_fee_rate_root", { precision: 78, scale: 0 }).notNull(),
reserve_fee_percent: integer("reserve_fee_percent").notNull(),

// market_swap: add new fee breakdown columns
total_fee: numeric("total_fee", { precision: 78, scale: 0 }),
lp_fee: numeric("lp_fee", { precision: 78, scale: 0 }),
reserve_fee: numeric("reserve_fee", { precision: 78, scale: 0 }),
```

**Note:** Keep the existing `fee` column for backward compatibility and populate it with
`total_fee` in the swap handler. Add new columns as nullable to avoid backfilling historical rows.

**Validation:**
```bash
cd packages/indexer && bun run check
```

**Failure mode:** Type errors indicate missing imports or schema mismatches.

---

### Step 1.2: Add new tables to schema **COMPLETE**

**File:** `packages/indexer/src/schema/index.ts`

**Action:** Add these tables using existing schema conventions (`uuid` id, `mode: "number"`).

```typescript
export const marketReserveFeeTransferred = pgTable(
  "market_reserve_fee_transferred",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    market: text("market").notNull(),
    treasury: text("treasury").notNull(),
    caller: text("caller").notNull(),
    amount: numeric("amount", { precision: 78, scale: 0 }).notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  },
  (table) => [
    index("market_rft_market_idx").on(table.market),
    index("market_rft_treasury_idx").on(table.treasury),
    index("market_rft_caller_idx").on(table.caller),
    index("market_rft_expiry_idx").on(table.expiry),
    uniqueIndex("market_rft_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index,
    ),
  ],
);

export const marketFactoryTreasuryUpdated = pgTable(
  "market_factory_treasury_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    old_treasury: text("old_treasury").notNull(),
    new_treasury: text("new_treasury").notNull(),
  },
  (table) => [
    uniqueIndex("mf_tu_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index,
    ),
  ],
);

export const marketFactoryDefaultReserveFeeUpdated = pgTable(
  "market_factory_default_reserve_fee_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    old_percent: integer("old_percent").notNull(),
    new_percent: integer("new_percent").notNull(),
  },
  (table) => [
    uniqueIndex("mf_drfu_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index,
    ),
  ],
);

export const marketFactoryOverrideFeeSet = pgTable(
  "market_factory_override_fee_set",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    router: text("router").notNull(),
    market: text("market").notNull(),
    ln_fee_rate_root: numeric("ln_fee_rate_root", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("mf_ofs_router_idx").on(table.router),
    index("mf_ofs_market_idx").on(table.market),
    uniqueIndex("mf_ofs_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index,
    ),
  ],
);
```

**Validation:**
```bash
bun run check
```

---

### Step 1.3: Generate migration **COMPLETE**

**Action:**
```bash
cd packages/indexer
bun run db:generate
```

**Validation:**
```bash
make dev-up  # Verify tables exist in local docker database
```

**Failure mode:** Migration fails = schema syntax error. Check Drizzle docs for correct types.

---

## Phase 2: Indexer Validation Schemas **COMPLETE**

### Step 2.1: Add validation schemas for new events **COMPLETE**

**File:** `packages/indexer/src/lib/validation.ts`

**Action:** Add these schemas and update MarketCreated for new fields.

```typescript
// After existing schemas

export const marketReserveFeeTransferredSchema = z.object({
  keys: z.array(z.string()).length(4), // selector, market, treasury, caller
  data: z.array(z.string()).length(4), // amount(2), expiry, timestamp
});

export const marketFactoryTreasuryUpdatedSchema = z.object({
  keys: z.array(z.string()).length(1), // selector only
  data: z.array(z.string()).length(2), // old_treasury, new_treasury
});

export const marketFactoryDefaultReserveFeeUpdatedSchema = z.object({
  keys: z.array(z.string()).length(1), // selector only
  data: z.array(z.string()).length(2), // old_percent, new_percent
});

export const marketFactoryOverrideFeeSetSchema = z.object({
  keys: z.array(z.string()).length(3), // selector, router, market
  data: z.array(z.string()).length(2), // ln_fee_rate_root (u256)
});

// Update MarketCreated schema (ByteArray makes length variable; keep min)
export const marketFactoryMarketCreatedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, "MarketCreated requires at least 3 keys"),
  data: z
    .array(z.string())
    .min(19, "MarketCreated requires at least 19 data elements"),
});

// Add to eventSchemas map (near bottom)
export const eventSchemas = {
  // ...
  ReserveFeeTransferred: marketReserveFeeTransferredSchema,
  TreasuryUpdated: marketFactoryTreasuryUpdatedSchema,
  DefaultReserveFeeUpdated: marketFactoryDefaultReserveFeeUpdatedSchema,
  OverrideFeeSet: marketFactoryOverrideFeeSetSchema,
  // ...
};
```

**Validation:**
```bash
bun run check
```

---

### Step 2.2: Update existing swap schema **COMPLETE**

**File:** `packages/indexer/src/lib/validation.ts`

**Action:** Find `marketSwapSchema` and update data array length:

```typescript
// Before: data: z.array(z.string()).length(17),
// After:
export const marketSwapSchema = z.object({
  keys: z.array(z.string()).length(4),
  data: z.array(z.string()).length(27), // Updated for new fields
});
```

**Failure mode:** If length is wrong, all swap events will fail validation. Cross-reference with Appendix A in analysis doc.

---

## Phase 3: Indexer Event Handlers **COMPLETE**

### Step 3.1: Add ReserveFeeTransferred handler to market indexer **COMPLETE**

**File:** `packages/indexer/src/indexers/market.indexer.ts`

**Action 1:** Add selector constant (near top of file):

```typescript
const RESERVE_FEE_TRANSFERRED = getSelector("ReserveFeeTransferred");
```

**Action 2:** Add to event filter (in filter array):

```typescript
{
  fromAddress: marketAddress,
  keys: [[RESERVE_FEE_TRANSFERRED]],
  includeReceipt: false,
}
```

**Action 3:** Add handler in event processing loop:

```typescript
if (eventKey === RESERVE_FEE_TRANSFERRED) {
  const validated = validateEvent(marketReserveFeeTransferredSchema, event, {
    indexer: "market",
    eventName: "ReserveFeeTransferred",
    blockNumber,
    transactionHash,
  });
  if (!validated) {
    continue;
  }

  const amount = readU256(validated.data, 0, "amount");
  const expiry = Number(BigInt(validated.data[2] ?? "0"));
  const timestamp = Number(BigInt(validated.data[3] ?? "0"));

  reserveFeeTransfers.push({
    block_number: BigInt(block.header.blockNumber),
    block_timestamp: new Date(Number(block.header.timestamp) * 1000),
    transaction_hash: txHash,
    event_index: eventIndex,
    market: validated.keys[1] ?? "",
    treasury: validated.keys[2] ?? "",
    caller: validated.keys[3] ?? "",
    amount,
    expiry: BigInt(expiry),
    timestamp: BigInt(timestamp),
  });
}
```

**Action 4:** Add batch insert at end of block processing:

```typescript
if (reserveFeeTransfers.length > 0) {
  await db.insert(marketReserveFeeTransferred).values(reserveFeeTransfers);
}
```

**Validation:**
```bash
bun run check
bun run test
```

---

### Step 3.2: Update Swap event handler

**File:** `packages/indexer/src/indexers/market.indexer.ts`

**Action:** Update the Swap event parsing to extract new fields. Find existing swap handler and add:

```typescript
// Swap data mapping (see Appendix A)
const ptIn = readU256(data, 2, "pt_in");
const syIn = readU256(data, 4, "sy_in");
const ptOut = readU256(data, 6, "pt_out");
const syOut = readU256(data, 8, "sy_out");
const totalFee = readU256(data, 10, "total_fee");
const lpFee = readU256(data, 12, "lp_fee");
const reserveFee = readU256(data, 14, "reserve_fee");
const impliedRateBefore = readU256(data, 16, "implied_rate_before");
const impliedRateAfter = readU256(data, 18, "implied_rate_after");
const exchangeRate = readU256(data, 20, "exchange_rate");
const syReserve = readU256(data, 22, "sy_reserve");
const ptReserve = readU256(data, 24, "pt_reserve");
// data[26] is event timestamp (optional to persist)

// Add to swaps.push object
swaps.push({
  // ...existing fields...
  pt_in: ptIn,
  sy_in: syIn,
  pt_out: ptOut,
  sy_out: syOut,
  total_fee: totalFee,
  lp_fee: lpFee,
  reserve_fee: reserveFee,
  implied_rate_before: impliedRateBefore,
  implied_rate_after: impliedRateAfter,
  exchange_rate: exchangeRate,
  sy_reserve_after: syReserve,
  pt_reserve_after: ptReserve,
  fee: totalFee, // legacy column mapped to total_fee
});
```

**Validation:**
```bash
bun run test
```

**Failure mode:** Index mismatch = wrong data extracted. Verify against Appendix A field mapping.

---

### Step 3.3: Add MarketFactory event handlers **COMPLETE**

**File:** `packages/indexer/src/indexers/market-factory.indexer.ts`

**Action 1:** Add selector constants:

```typescript
const TREASURY_UPDATED = getSelector("TreasuryUpdated");
const DEFAULT_RESERVE_FEE_UPDATED = getSelector("DefaultReserveFeeUpdated");
const OVERRIDE_FEE_SET = getSelector("OverrideFeeSet");
```

**Action 2:** Add to event filter:

```typescript
{
  fromAddress: factoryAddress,
  keys: [[TREASURY_UPDATED, DEFAULT_RESERVE_FEE_UPDATED, OVERRIDE_FEE_SET]],
  includeReceipt: false,
}
```

**Action 3:** Add handlers (similar pattern to Step 3.1).

**Validation:**
```bash
bun run check && bun run test
```

---

### Step 3.4: Update MarketCreated handler **COMPLETE**

**File:** `packages/indexer/src/indexers/market-factory.indexer.ts`

**Action:** Update parsing to extract `ln_fee_rate_root` and `reserve_fee_percent` using a
ByteArray-aware offset (do not use fixed indices after `underlying_symbol`).

```typescript
// data mapping (after keys: pt, expiry)
const market = data[0];
const creator = data[1];
const scalarRoot = readU256(data, 2, "scalar_root");
const initialAnchor = readU256(data, 4, "initial_anchor");
const lnFeeRateRoot = readU256(data, 6, "ln_fee_rate_root");
const reserveFeePercent = Number(data[8] ?? "0");
const sy = data[9];
const yt = data[10];
const underlying = data[11];

// ByteArray-aware decode (create helper to return nextIndex)
const { value: underlyingSymbol, nextIndex } = decodeByteArrayWithOffset(
  data,
  12,
  "underlying_symbol",
);
const initialExchangeRate = readU256(data, nextIndex, "initial_exchange_rate");
const timestamp = Number(BigInt(data[nextIndex + 2] ?? "0"));
const marketIndex = Number(data[nextIndex + 3] ?? "0");
```

**Helper (new):** `packages/indexer/src/lib/utils.ts`
```typescript
export function decodeByteArrayWithOffset(
  data: string[],
  startIndex: number,
  field?: string,
): { value: string; nextIndex: number } {
  const arrayLen = Number(BigInt(data[startIndex] ?? "0"));
  const nextIndex = startIndex + 1 + arrayLen + 2;
  return { value: decodeByteArray(data, startIndex, field), nextIndex };
}
```

**Validation:**
```bash
bun run test market-factory
```

---

## Phase 4: Analytics Views Updates **COMPLETE**

### Step 4.1: Update materialized views for new fee fields

**File:** `packages/indexer/scripts/create-views.sql`

**Action:** Update fee and market metadata views to reflect new fields:
- Replace `fee_rate` with `ln_fee_rate_root` in `market_info`.
- Use `market_swap.total_fee` for `fees_24h` (and optionally add `lp_fee` / `reserve_fee`
  aggregates as in the analysis).
- If falling back to fee estimates from volume, convert with
  `exp(ln_fee_rate_root / 1e18) - 1` before multiplying.
- Add `treasury_fee_analytics` and `market_fee_overrides` views.

**Validation:**
```bash
cd packages/indexer
psql "$DATABASE_URL" -f scripts/create-views.sql
```

**Failure mode:** SQL errors from missing columns or view dependency order.

---

## Phase 5: Indexer Testing

### Step 5.1: Add unit tests for new event parsing

**Files:**
- `packages/indexer/tests/market.test.ts`
- `packages/indexer/tests/market-factory.test.ts`
- `packages/indexer/tests/validation.test.ts`
- `packages/indexer/tests/utils.test.ts`
- `packages/indexer/tests/idempotency.test.ts`

**Action:** Update fixtures and expectations:
- Swap data array length = 27 (see Appendix A), with new `total_fee`, `lp_fee`,
  `reserve_fee`, `implied_rate_before`, `implied_rate_after` positions.
- `fee` expectation should equal `total_fee` (legacy column).
- MarketCreated fixture includes `ln_fee_rate_root`, `reserve_fee_percent`, and ByteArray
  decode using the new offset helper.
- Validation tests updated for new schemas and min lengths.
- Add a `decodeByteArrayWithOffset` unit test in `utils.test.ts`.
- Add new tables to `ALL_EVENT_TABLES` and update the expected table count.

**Validation:**
```bash
bun run test market
bun run test market-factory
bun run test validation
```

---

## Phase 6: Frontend Type Updates **COMPLETE**

### Step 6.1: Regenerate TypeScript types from ABIs

**Action:**
```bash
cd packages/frontend
bun run codegen
```

**Validation:**
```bash
bun run check
```

**Failure mode:** Codegen fails = ABI files missing or malformed.

---

### Step 6.2: Update API types

**File:** `packages/frontend/src/shared/api/types.ts`

**Action:** Update types per Section 4.1 of analysis doc:

```typescript
export interface IndexedMarket {
  // ... existing fields ...
  lnFeeRateRoot: string;        // Renamed from feeRate
  reserveFeePercent: number;    // NEW (0-100)
}

export interface SwapEvent {
  // ... existing fields ...
  totalFee: string;
  lpFee: string;
  reserveFee: string;
  impliedRateBefore: string;
  impliedRateAfter: string;
}

export interface MarketConfig {
  treasury: string;
  lnFeeRateRoot: string;
  reserveFeePercent: number;
}
```

**Validation:**
```bash
bun run check
```

---

### Step 6.3: Add utility functions

**File:** `packages/frontend/src/shared/lib/fees.ts` (create new file)

**Action:**
```typescript
import { expWad } from '../math/amm';
import { WAD_BIGINT, formatWad } from '../math/wad';

/**
 * Convert ln_fee_rate_root to annual fee percentage.
 * ln_fee_rate_root is stored in WAD (10^18) fixed-point.
 */
export function calculateAnnualFeeRate(lnFeeRateRoot: string): number {
  const lnRate = BigInt(lnFeeRateRoot);
  const feeRateWad = expWad(lnRate) - WAD_BIGINT; // exp(ln) - 1
  return Number(feeRateWad) / Number(WAD_BIGINT);
}

export function formatFeeBreakdown(
  totalFee: bigint,
  lpFee: bigint,
  reserveFee: bigint,
  sySymbol: string,
): string {
  if (totalFee === 0n) return `0 ${sySymbol}`;
  const lpPercent = (Number(lpFee) / Number(totalFee) * 100).toFixed(1);
  const reservePercent = (Number(reserveFee) / Number(totalFee) * 100).toFixed(1);
  return `${formatWad(totalFee, 6)} ${sySymbol} (${lpPercent}% LP / ${reservePercent}% Treasury)`;
}
```

**Validation:**
```bash
bun run check
```

---

## Phase 7: Frontend Hook Updates

### Step 7.1: Update useMarkets hook

**File:** `packages/frontend/src/features/markets/model/useMarkets.ts`

**Action:** Add new contract calls and handle per-router fee override:

```typescript
const [
  // ... existing calls ...
  lnFeeRateRoot,
  reserveFeePercent,
  marketConfig,
] = await Promise.all([
  // ... existing calls ...
  market.get_ln_fee_rate_root(),
  market.get_reserve_fee_percent(),
  factory.get_market_config(market.address, routerAddress),
]);

return {
  // ... existing fields ...
  lnFeeRateRoot: marketConfig?.ln_fee_rate_root?.toString() ?? lnFeeRateRoot.toString(),
  reserveFeePercent: Number(reserveFeePercent),
  treasury: marketConfig?.treasury ?? "",
  annualFeeRate: calculateAnnualFeeRate(
    (marketConfig?.ln_fee_rate_root ?? lnFeeRateRoot).toString(),
  ),
};
```

**Note:** `get_reserve_fee_percent()` always reflects the factory default, even when
`get_market_config` overrides `ln_fee_rate_root` for a router.

**Validation:**
```bash
bun run check
```

---

## Phase 8: Frontend UI Components

### Step 8.1: Create FeeStructure component

**File:** `packages/frontend/src/features/markets/ui/FeeStructure.tsx` (create new file)

**Action:** Create component per Section 4.4 of analysis doc.

**Validation:**
```bash
bun run check
```

---

### Step 8.2: Update SwapForm fee display

**File:** `packages/frontend/src/features/swap/ui/SwapForm.tsx`

**Action:** Add fee breakdown display after swap result section.

**Validation:**
```bash
bun run check
bun run test
```

---

### Step 8.3: Add treasury analytics route (optional)

**File:** `packages/frontend/src/app/api/analytics/treasury/route.ts` (create new file)

**Action:** Implement per Section 4.5 of analysis doc.

**Validation:**
```bash
bun run check
curl localhost:3000/api/analytics/treasury
```

---

## Phase 9: End-to-End Testing

### Step 9.1: Local integration test

**Action:**
```bash
# Start all services
make dev-up
cd packages/indexer && bun run dev &
cd packages/frontend && bun run dev:fork &

# Perform swap and verify fee breakdown displays
# (open http://localhost:3000 in a browser)
```

**Validation:**
1. Swap form shows fee breakdown
2. Database has `market_swap` rows with `lp_fee` populated
3. If treasury set, `market_reserve_fee_transferred` has rows

---

### Step 9.2: Run all tests

**Action:**
```bash
cd packages/indexer && bun run check && bun run test
cd packages/frontend && bun run check && bun run test
```

---

## Deployment Order

1. **Contracts** (already done): Market, MarketFactory with new events
2. **Indexer Schema**: Run migration on production DB
3. **Indexer Views**: Re-run `create-views.sql` after schema change
4. **Indexer Code**: Deploy updated indexer
5. **Frontend**: Deploy after indexer processes first events

---

## Rollback Plan

### Indexer Rollback

```bash
# Revert to previous indexer version
git checkout <previous-commit> packages/indexer

# New columns are nullable, so old code will work
# New tables can be dropped if needed:
DROP TABLE market_reserve_fee_transferred;
DROP TABLE market_factory_treasury_updated;
DROP TABLE market_factory_default_reserve_fee_updated;
DROP TABLE market_factory_override_fee_set;

# If views were updated, re-run the previous create-views.sql version.
```

### Frontend Rollback

```bash
git checkout <previous-commit> packages/frontend
bun run build && bun run deploy
```

---

## Success Criteria

- [ ] All indexer tests pass
- [ ] All frontend tests pass
- [ ] Swap events populate new fee columns
- [ ] ReserveFeeTransferred events are indexed
- [ ] MarketCreated rows include `ln_fee_rate_root` and `reserve_fee_percent`
- [ ] Analytics views query `ln_fee_rate_root` and fee breakdown correctly
- [ ] SwapForm displays fee breakdown
- [ ] FeeStructure component renders on market cards
- [ ] No console errors in production
