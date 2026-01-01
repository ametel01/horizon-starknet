# Research: YT Interest System - Frontend & Indexer Changes

## Executive Summary

The YT contract has undergone major changes to align with Pendle's `InterestManagerYT`:
1. **Pendle-style interest formula** - Normalized formula `interest = balance × (curr - prev) / (prev × curr)`
2. **SY reserve tracking** - `sy_reserve` with floating SY detection
3. **Protocol fee system** - `interest_fee_rate` deducted from claims, sent to treasury
4. **Post-expiry treasury yield** - Orphaned yield redirected to treasury
5. **Pre-transfer pattern** - Mint/redeem now require pre-transferring tokens (not `transfer_from`)
6. **Batch operations** - `mint_py_multi`, `redeem_py_multi`, `redeem_py_with_interest`
7. **New/updated events** - 7 new YT events plus MintPY key layout change (split receivers, expiry in data)

The frontend and indexer need updates to leverage these new capabilities.

---

## Authoritative Files

### Contract (Source of Truth)
| File | Lines | Key Changes |
|------|-------|-------------|
| `contracts/src/tokens/yt.cairo` | 1-1590 | All YT implementation |
| `packages/frontend/src/types/generated/YT.ts` | 1-1748 | TypeScript ABI (already updated) |

### Frontend
| File | Purpose | Required Changes |
|------|---------|------------------|
| `features/yield/model/useUserYield.ts` | Yield claim history | Extend for fee tracking |
| `features/yield/model/useYield.ts` | Pending yield calculation | Add fee preview |
| `features/redeem/model/useRedeem.ts` | Redeem operations | Support `redeem_py_with_interest` |
| `features/portfolio/model/usePositions.ts` | Position tracking | Add post-expiry status |

### Indexer
| File | Purpose | Required Changes |
|------|---------|------------------|
| `indexers/yt.indexer.ts` | YT event indexing | Add 7 new events + update MintPY parsing |
| `schema/index.ts` | Database tables | Add 7 new tables + update `yt_mint_py` columns |
| `lib/validation.ts` | Event validation | Add 7 new schemas + update MintPY schema |

---

## New Contract Events (7 Confirmed in ABI)

**Source:** `packages/indexer/src/lib/abi/yt.json` (regenerated)

### 1. TreasuryInterestRedeemed
Emitted when admin claims post-expiry yield for treasury.

```
keys: [selector, yt, treasury]
data: [amount_sy(u256), sy, expiry_index(u256), current_index(u256), total_yt_supply(u256), timestamp]
```

**Data offsets:**
- `data[0:2]` = amount_sy (u256)
- `data[2]` = sy
- `data[3:5]` = expiry_index (u256)
- `data[5:7]` = current_index (u256)
- `data[7:9]` = total_yt_supply (u256)
- `data[9]` = timestamp

### 2. InterestFeeRateSet
Emitted when admin changes the interest fee rate.

```
keys: [selector, yt]
data: [old_rate(u256), new_rate(u256), timestamp]
```

**Data offsets:**
- `data[0:2]` = old_rate (u256)
- `data[2:4]` = new_rate (u256)
- `data[4]` = timestamp

### 3. MintPYMulti
Emitted for batch minting operations.

```
keys: [selector, caller, expiry]
data: [total_sy_deposited(u256), total_py_minted(u256), receiver_count, timestamp]
```

**Data offsets:**
- `data[0:2]` = total_sy_deposited (u256)
- `data[2:4]` = total_py_minted (u256)
- `data[4]` = receiver_count (u32)
- `data[5]` = timestamp

### 4. RedeemPYMulti
Emitted for batch redemption operations.

```
keys: [selector, caller, expiry]
data: [total_py_redeemed(u256), total_sy_returned(u256), receiver_count, timestamp]
```

**Data offsets:**
- `data[0:2]` = total_py_redeemed (u256)
- `data[2:4]` = total_sy_returned (u256)
- `data[4]` = receiver_count (u32)
- `data[5]` = timestamp

### 5. RedeemPYWithInterest
Emitted when redeeming PT/YT with optional interest claim.

```
keys: [selector, caller, receiver, expiry]
data: [amount_py_redeemed(u256), amount_sy_from_redeem(u256), amount_interest_claimed(u256), timestamp]
```

**Data offsets:**
- `data[0:2]` = amount_py_redeemed (u256)
- `data[2:4]` = amount_sy_from_redeem (u256)
- `data[4:6]` = amount_interest_claimed (u256)
- `data[6]` = timestamp

### 6. PostExpiryDataSet
Emitted once when post-expiry data is initialized.

```
keys: [selector, yt, pt]
data: [sy, expiry(u64), first_py_index(u256), exchange_rate_at_init(u256), total_pt_supply(u256), total_yt_supply(u256), timestamp]
```

**Data offsets:**
- `data[0]` = sy
- `data[1]` = expiry
- `data[2:4]` = first_py_index (u256)
- `data[4:6]` = exchange_rate_at_init (u256)
- `data[6:8]` = total_pt_supply (u256)
- `data[8:10]` = total_yt_supply (u256)
- `data[10]` = timestamp

### 7. PyIndexUpdated
Emitted when the PY index changes via `update_py_index()`.

```
keys: [selector, yt]
data: [old_index(u256), new_index(u256), exchange_rate(u256), block_number(u64), timestamp]
```

**Data offsets:**
- `data[0:2]` = old_index (u256)
- `data[2:4]` = new_index (u256)
- `data[4:6]` = exchange_rate (u256)
- `data[6]` = block_number
- `data[7]` = timestamp

### Existing Event Layout Change: MintPY
`MintPY` now uses split receivers and moves `expiry` into data.

```
keys: [selector, caller, receiver_pt, receiver_yt]
data: [expiry(u64), amount_sy_deposited(u256), amount_py_minted(u256), pt, sy, py_index(u256),
       exchange_rate(u256), total_pt_supply_after(u256), total_yt_supply_after(u256), timestamp]
```

---

## New Contract Functions

### View Functions
| Function | Returns | Purpose |
|----------|---------|---------|
| `treasury()` | ContractAddress | Get treasury address |
| `interest_fee_rate()` | u256 | Get current fee rate (WAD) |
| `sy_reserve()` | u256 | Get expected SY balance |
| `get_floating_sy()` | u256 | Get floating SY (donations) |
| `get_floating_pt()` | u256 | Get floating PT for redeem |
| `get_floating_yt()` | u256 | Get floating YT for redeem |
| `first_py_index()` | u256 | Get expiry index (Pendle: firstPYIndex) |
| `total_sy_interest_for_treasury()` | u256 | Get treasury accumulated interest |
| `get_post_expiry_data()` | (u256, u256, bool) | Batch getter for post-expiry state |
| `get_post_expiry_treasury_interest()` | u256 | Get pending treasury interest |

### Transaction Functions
| Function | Parameters | Purpose |
|----------|------------|---------|
| `mint_py(receiver_pt, receiver_yt)` | Separate receivers | Pre-transfer pattern, split receivers |
| `redeem_py(receiver)` | receiver | Pre-transfer pattern |
| `redeem_py_post_expiry(receiver)` | receiver | Pre-transfer, treasury carve-out |
| `mint_py_multi(receivers_pt, receivers_yt, amounts)` | Arrays | Batch mint |
| `redeem_py_multi(receivers, amounts)` | Arrays | Batch redeem |
| `redeem_py_with_interest(receiver, redeem_interest)` | receiver, bool | Combined redeem + claim |
| `update_py_index()` | u256 | Update and return current index (emits PyIndexUpdated) |
| `set_interest_fee_rate(rate)` | u256 | Admin: set fee (max 50%) |
| `redeem_post_expiry_interest_for_treasury()` | - | Admin: claim treasury yield |

---

## Indexer Changes Required

### 1. Database Schema Updates (MintPY + 7 new tables)

Update existing `yt_mint_py` to match the new MintPY layout:
- Replace `receiver` with `receiver_pt` and `receiver_yt`
- Move `expiry` from keys into event data (still store in the table)

Add 7 new tables to `packages/indexer/src/schema/index.ts`:

```typescript
// Post-expiry initialization tracking
export const ytPostExpiryDataSet = pgTable('yt_post_expiry_data_set', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  event_index: integer('event_index').notNull(),
  yt: text('yt').notNull(),
  pt: text('pt').notNull(),
  sy: text('sy').notNull(),
  expiry: bigint('expiry', { mode: 'number' }).notNull(),
  first_py_index: numeric('first_py_index', { precision: 78, scale: 0 }).notNull(),
  exchange_rate_at_init: numeric('exchange_rate_at_init', { precision: 78, scale: 0 }).notNull(),
  total_pt_supply: numeric('total_pt_supply', { precision: 78, scale: 0 }).notNull(),
  total_yt_supply: numeric('total_yt_supply', { precision: 78, scale: 0 }).notNull(),
}, (table) => [
  index('yt_peds_yt_idx').on(table.yt),
  index('yt_peds_pt_idx').on(table.pt),
  uniqueIndex('yt_peds_event_key').on(table.block_number, table.transaction_hash, table.event_index),
]);

// PY index updates for APY/history
export const ytPyIndexUpdated = pgTable('yt_py_index_updated', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  event_index: integer('event_index').notNull(),
  yt: text('yt').notNull(),
  old_index: numeric('old_index', { precision: 78, scale: 0 }).notNull(),
  new_index: numeric('new_index', { precision: 78, scale: 0 }).notNull(),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }).notNull(),
  index_block_number: bigint('index_block_number', { mode: 'number' }).notNull(),
}, (table) => [
  index('yt_piu_yt_idx').on(table.yt),
  index('yt_piu_block_idx').on(table.index_block_number),
  uniqueIndex('yt_piu_event_key').on(table.block_number, table.transaction_hash, table.event_index),
]);
```

Existing additions (keep):

```typescript
// Treasury interest redemption tracking
export const ytTreasuryInterestRedeemed = pgTable('yt_treasury_interest_redeemed', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  event_index: integer('event_index').notNull(),
  yt: text('yt').notNull(),
  treasury: text('treasury').notNull(),
  amount_sy: numeric('amount_sy', { precision: 78, scale: 0 }).notNull(),
  sy: text('sy').notNull(),
  expiry_index: numeric('expiry_index', { precision: 78, scale: 0 }).notNull(),
  current_index: numeric('current_index', { precision: 78, scale: 0 }).notNull(),
  total_yt_supply: numeric('total_yt_supply', { precision: 78, scale: 0 }).notNull(),
}, (table) => [
  index('yt_tir_yt_idx').on(table.yt),
  index('yt_tir_treasury_idx').on(table.treasury),
  uniqueIndex('yt_tir_event_key').on(table.block_number, table.transaction_hash, table.event_index),
]);

// Interest fee rate changes
export const ytInterestFeeRateSet = pgTable('yt_interest_fee_rate_set', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  event_index: integer('event_index').notNull(),
  yt: text('yt').notNull(),
  old_rate: numeric('old_rate', { precision: 78, scale: 0 }).notNull(),
  new_rate: numeric('new_rate', { precision: 78, scale: 0 }).notNull(),
}, (table) => [
  index('yt_ifrs_yt_idx').on(table.yt),
  uniqueIndex('yt_ifrs_event_key').on(table.block_number, table.transaction_hash, table.event_index),
]);

// Batch mint events
export const ytMintPYMulti = pgTable('yt_mint_py_multi', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  event_index: integer('event_index').notNull(),
  caller: text('caller').notNull(),
  expiry: bigint('expiry', { mode: 'number' }).notNull(),
  yt: text('yt').notNull(),
  total_sy_deposited: numeric('total_sy_deposited', { precision: 78, scale: 0 }).notNull(),
  total_py_minted: numeric('total_py_minted', { precision: 78, scale: 0 }).notNull(),
  receiver_count: integer('receiver_count').notNull(),
}, (table) => [
  index('yt_mpm_caller_idx').on(table.caller),
  index('yt_mpm_expiry_idx').on(table.expiry),
  uniqueIndex('yt_mpm_event_key').on(table.block_number, table.transaction_hash, table.event_index),
]);

// Batch redeem events
export const ytRedeemPYMulti = pgTable('yt_redeem_py_multi', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  event_index: integer('event_index').notNull(),
  caller: text('caller').notNull(),
  expiry: bigint('expiry', { mode: 'number' }).notNull(),
  yt: text('yt').notNull(),
  total_py_redeemed: numeric('total_py_redeemed', { precision: 78, scale: 0 }).notNull(),
  total_sy_returned: numeric('total_sy_returned', { precision: 78, scale: 0 }).notNull(),
  receiver_count: integer('receiver_count').notNull(),
}, (table) => [
  index('yt_rpm_caller_idx').on(table.caller),
  index('yt_rpm_expiry_idx').on(table.expiry),
  uniqueIndex('yt_rpm_event_key').on(table.block_number, table.transaction_hash, table.event_index),
]);

// Redeem with interest events
export const ytRedeemPYWithInterest = pgTable('yt_redeem_py_with_interest', {
  _id: uuid('_id').primaryKey().defaultRandom(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  event_index: integer('event_index').notNull(),
  caller: text('caller').notNull(),
  receiver: text('receiver').notNull(),
  expiry: bigint('expiry', { mode: 'number' }).notNull(),
  yt: text('yt').notNull(),
  amount_py_redeemed: numeric('amount_py_redeemed', { precision: 78, scale: 0 }).notNull(),
  amount_sy_from_redeem: numeric('amount_sy_from_redeem', { precision: 78, scale: 0 }).notNull(),
  amount_interest_claimed: numeric('amount_interest_claimed', { precision: 78, scale: 0 }).notNull(),
}, (table) => [
  index('yt_rpwi_caller_idx').on(table.caller),
  index('yt_rpwi_receiver_idx').on(table.receiver),
  index('yt_rpwi_expiry_idx').on(table.expiry),
  uniqueIndex('yt_rpwi_event_key').on(table.block_number, table.transaction_hash, table.event_index),
]);

```

### 2. New/Updated Validation Schemas (7 + MintPY)

Add to `packages/indexer/src/lib/validation.ts`:

```typescript
// Update MintPY: keys[selector, caller, receiver_pt, receiver_yt], data now includes expiry + timestamp
export const ytMintPYSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, 'MintPY requires at least 4 keys'),
  data: z.array(z.string()).min(16, 'MintPY requires at least 16 data elements'),
});

// TreasuryInterestRedeemed: keys[selector, yt, treasury], data[amount_sy(u256), sy, expiry_index(u256), current_index(u256), total_yt_supply(u256), timestamp]
export const ytTreasuryInterestRedeemedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, 'TreasuryInterestRedeemed requires at least 3 keys'),
  data: z.array(z.string()).min(10, 'TreasuryInterestRedeemed requires at least 10 data elements'),
});

// InterestFeeRateSet: keys[selector, yt], data[old_rate(u256), new_rate(u256), timestamp]
export const ytInterestFeeRateSetSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(2, 'InterestFeeRateSet requires at least 2 keys'),
  data: z.array(z.string()).min(5, 'InterestFeeRateSet requires at least 5 data elements'),
});

// MintPYMulti: keys[selector, caller, expiry], data[total_sy_deposited(u256), total_py_minted(u256), receiver_count, timestamp]
export const ytMintPYMultiSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, 'MintPYMulti requires at least 3 keys'),
  data: z.array(z.string()).min(6, 'MintPYMulti requires at least 6 data elements'),
});

// RedeemPYMulti: keys[selector, caller, expiry], data[total_py_redeemed(u256), total_sy_returned(u256), receiver_count, timestamp]
export const ytRedeemPYMultiSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, 'RedeemPYMulti requires at least 3 keys'),
  data: z.array(z.string()).min(6, 'RedeemPYMulti requires at least 6 data elements'),
});

// RedeemPYWithInterest: keys[selector, caller, receiver, expiry], data[amount_py_redeemed(u256), amount_sy_from_redeem(u256), amount_interest_claimed(u256), timestamp]
export const ytRedeemPYWithInterestSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(4, 'RedeemPYWithInterest requires at least 4 keys'),
  data: z.array(z.string()).min(7, 'RedeemPYWithInterest requires at least 7 data elements'),
});

// PostExpiryDataSet: keys[selector, yt, pt], data[sy, expiry, first_py_index(u256), exchange_rate_at_init(u256), total_pt_supply(u256), total_yt_supply(u256), timestamp]
export const ytPostExpiryDataSetSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(3, 'PostExpiryDataSet requires at least 3 keys'),
  data: z.array(z.string()).min(11, 'PostExpiryDataSet requires at least 11 data elements'),
});

// PyIndexUpdated: keys[selector, yt], data[old_index(u256), new_index(u256), exchange_rate(u256), block_number(u64), timestamp]
export const ytPyIndexUpdatedSchema = baseEventSchema.extend({
  keys: z.array(z.string()).min(2, 'PyIndexUpdated requires at least 2 keys'),
  data: z.array(z.string()).min(8, 'PyIndexUpdated requires at least 8 data elements'),
});
```

### 3. New Views

```sql
-- YT Fee Analytics View
-- Tracks current fee rate per YT and rate change history
CREATE MATERIALIZED VIEW yt_fee_analytics AS
SELECT
  yt,
  MAX(new_rate) as current_fee_rate,
  COUNT(*) as rate_change_count,
  MAX(block_timestamp) as last_change
FROM yt_interest_fee_rate_set
GROUP BY yt;

-- Treasury Yield Summary View
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

-- Batch Operations Summary View
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

-- Combined Redeem Interest View
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

---

## Frontend Changes Required

### 1. New Hook: `useInterestFee`

```typescript
// features/yield/model/useInterestFee.ts
export function useInterestFee(ytAddress: string) {
  const { contract } = useContract('YT', ytAddress);

  return useQuery({
    queryKey: ['interest-fee', ytAddress],
    queryFn: async () => {
      const feeRate = await contract.interest_fee_rate();
      const treasury = await contract.treasury();
      return {
        feeRate: BigInt(feeRate),
        feePercentage: Number(feeRate) / 1e18 * 100, // e.g., 3%
        treasury,
      };
    },
    enabled: !!contract,
    staleTime: 60000,
  });
}
```

### 2. Updated `useUserYield` - Include Fee Tracking

Extend `YieldResponse` and `ProcessedYieldData`:

```typescript
interface YieldClaimEvent {
  // ... existing fields
  grossAmount: string;  // Before fee
  feeAmount: string;    // Fee deducted
  netAmount: string;    // After fee (amount_sy from event)
}

interface YieldSummary {
  // ... existing fields
  totalFeesPaid: string;
  currentFeeRate: string;
}
```

### 3. New Hook: `usePostExpiryStatus`

```typescript
// features/yield/model/usePostExpiryStatus.ts
export function usePostExpiryStatus(ytAddress: string) {
  const { contract } = useContract('YT', ytAddress);

  return useQuery({
    queryKey: ['post-expiry-status', ytAddress],
    queryFn: async () => {
      const [firstPyIndex, treasuryInterest, isInitialized] =
        await contract.get_post_expiry_data();
      const pendingTreasuryYield = await contract.get_post_expiry_treasury_interest();

      return {
        isExpired: await contract.is_expired(),
        isPostExpiryInitialized: isInitialized,
        firstPyIndex: BigInt(firstPyIndex),
        totalTreasuryInterest: BigInt(treasuryInterest),
        pendingTreasuryYield: BigInt(pendingTreasuryYield),
      };
    },
    enabled: !!contract,
  });
}
```

### 4. New Component: `InterestClaimPreview`

Show fee breakdown before claiming:

```tsx
// features/yield/ui/InterestClaimPreview.tsx
export function InterestClaimPreview({ ytAddress, pendingYield }: Props) {
  const { data: feeData } = useInterestFee(ytAddress);

  if (!feeData) return <Skeleton />;

  const grossAmount = pendingYield;
  const feeAmount = (grossAmount * BigInt(feeData.feeRate)) / WAD;
  const netAmount = grossAmount - feeAmount;

  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span>Gross Yield</span>
        <span>{formatWad(grossAmount)} SY</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Protocol Fee ({feeData.feePercentage.toFixed(1)}%)</span>
        <span>-{formatWad(feeAmount)} SY</span>
      </div>
      <Separator />
      <div className="flex justify-between font-medium">
        <span>You Receive</span>
        <span>{formatWad(netAmount)} SY</span>
      </div>
    </div>
  );
}
```

### 5. Update `useRedeem` - Support Combined Claim

```typescript
// features/redeem/model/useRedeem.ts
export function useRedeem() {
  // ... existing code

  const redeemWithInterest = useMutation({
    mutationFn: async ({
      ytAddress,
      receiver,
      redeemInterest
    }: {
      ytAddress: string;
      receiver: string;
      redeemInterest: boolean;
    }) => {
      // 1. Pre-transfer PT + YT to YT contract
      // 2. Call redeem_py_with_interest(receiver, redeemInterest)
      const yt = new Contract(YT_ABI, ytAddress, account);
      return yt.redeem_py_with_interest(receiver, redeemInterest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['user-yield'] });
    },
  });

  return { redeem, redeemWithInterest };
}
```

### 6. New Feature: Treasury Dashboard (Admin)

For protocol admins to monitor and claim treasury yield:

```typescript
// features/admin/model/useTreasuryYield.ts
export function useTreasuryYield(ytAddress: string) {
  return useQuery({
    queryKey: ['treasury-yield', ytAddress],
    queryFn: async () => {
      const yt = new Contract(YT_ABI, ytAddress, provider);
      const [pending, claimed, treasury] = await Promise.all([
        yt.get_post_expiry_treasury_interest(),
        yt.total_sy_interest_for_treasury(),
        yt.treasury(),
      ]);
      return {
        pending: BigInt(pending),
        claimed: BigInt(claimed),
        treasury,
      };
    },
  });
}
```

### 7. Position Card Updates

Update position display to show:
- Post-expiry status badge
- Fee rate indicator
- Split PT/YT receiver option on mint

### 8. API Endpoints Needed

Add to `packages/frontend/src/app/api/`:

```
GET /api/yt/[address]/fee-history
  - Returns fee rate change history

GET /api/yt/[address]/post-expiry
  - Returns post-expiry status and treasury stats

GET /api/analytics/treasury
  - Returns protocol-wide treasury yield stats

GET /api/py-index/[yt]/history
  - Returns PY index history for APY calculation
```

---

## Critical Implementation Notes

### Pre-Transfer Pattern Impact

**Breaking Change**: The YT contract now requires tokens to be transferred BEFORE calling mint/redeem:

```typescript
// OLD (transfer_from pattern)
await yt.mint_py(receiver, amount_sy);

// NEW (pre-transfer pattern)
await sy.transfer(ytAddress, amount_sy);  // First: transfer SY to YT
await yt.mint_py(receiver_pt, receiver_yt);  // Then: call mint (consumes floating SY)
```

The Router contract handles this internally, so frontend mutations through Router are unaffected. Direct YT calls need updating.

### Interest Formula Change

The new Pendle-style formula returns fewer SY tokens but each is worth more:

```
OLD: interest = balance × (curr - prev) / prev
NEW: interest = balance × (curr - prev) / (prev × curr)
```

Example: 100 YT, index 1.0 → 1.1 (10% yield)
- Old: 10.0 SY
- New: 9.09 SY (worth the same in underlying)

Frontend should display underlying value, not raw SY amounts.

### Post-Expiry Treasury Carve-out

After expiry, each PT redemption carves out post-expiry yield for treasury:
1. User gets: `ptAmount × WAD / expiryIndex`
2. Treasury gets: `ptAmount × (current - expiry) / (expiry × current)`

This is automatic - users see slightly less SY but it's economically fair (they don't deserve post-expiry yield).

---

## Migration Steps

### Indexer
1. Update `yt_mint_py` schema + parsing for split receivers and expiry-in-data
2. Add 7 new tables to schema (TreasuryInterestRedeemed, InterestFeeRateSet, MintPYMulti, RedeemPYMulti, RedeemPYWithInterest, PostExpiryDataSet, PyIndexUpdated)
3. Add 7 new validation schemas to `lib/validation.ts` (plus MintPY update)
4. Add 7 new event selectors to `yt.indexer.ts`:
   ```typescript
   const TREASURY_INTEREST_REDEEMED = getSelector("TreasuryInterestRedeemed");
   const INTEREST_FEE_RATE_SET = getSelector("InterestFeeRateSet");
   const MINT_PY_MULTI = getSelector("MintPYMulti");
   const REDEEM_PY_MULTI = getSelector("RedeemPYMulti");
   const REDEEM_PY_WITH_INTEREST = getSelector("RedeemPYWithInterest");
   const POST_EXPIRY_DATA_SET = getSelector("PostExpiryDataSet");
   const PY_INDEX_UPDATED = getSelector("PyIndexUpdated");
   ```
5. Add filter entries for new events in both initial filter and factory function
6. Generate migrations: `bun run db:generate`
7. Create new views via SQL migration

### Frontend
1. Run `bun run codegen` to update TypeScript types (already done)
2. Create `useInterestFee` hook
3. Create `usePostExpiryStatus` hook
4. Update `useUserYield` response types
5. Create `InterestClaimPreview` component
6. Add `redeemWithInterest` to `useRedeem`
7. Add treasury admin dashboard (if needed)

---

## Open Questions

### Requires Runtime Validation
- [ ] Verify event data offsets match ABI (test with devnet events)
- [ ] Confirm fee calculation precision matches contract
- [ ] Test pre-transfer pattern works correctly in frontend flows

### Requires Human Input
- [ ] Should treasury dashboard be admin-only or public?
- [ ] Display strategy for fee: show gross/net or just net?
- [ ] Priority: Should batch operation UI be implemented?

### Out of Scope (Noted for Future)
- Multi-reward system (Pendle supports, Horizon doesn't)

---

## Verified Against ABI

**Source:** `packages/indexer/src/lib/abi/yt.json` (regenerated, latest)

All 7 new events confirmed present:
- ✅ TreasuryInterestRedeemed
- ✅ InterestFeeRateSet
- ✅ MintPYMulti
- ✅ RedeemPYMulti
- ✅ RedeemPYWithInterest
- ✅ PostExpiryDataSet
- ✅ PyIndexUpdated

Existing events present (MintPY layout updated with split receivers + expiry in data):
- ✅ MintPY
- ✅ RedeemPY
- ✅ RedeemPYPostExpiry
- ✅ InterestClaimed
- ✅ ExpiryReached
