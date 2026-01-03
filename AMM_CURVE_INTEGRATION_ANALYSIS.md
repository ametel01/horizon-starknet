# AMM Curve Integration Analysis: Frontend & Indexer Impact

**Date:** 2025-01-02
**Source (code-verified):** `contracts/src/market/amm.cairo`,
`contracts/src/market/market_factory.cairo`,
`contracts/src/interfaces/i_market.cairo`,
`contracts/src/interfaces/i_market_factory.cairo`,
`contracts/src/market/market_math_fp.cairo`

**Scope:** Integration analysis for packages/frontend and packages/indexer

---

## Executive Summary

The AMM curve implementation changes fee parameterization, reserve-fee routing, and swap event
payloads. This document captures code-verified integration impacts for frontend and indexer,
separating required updates from optional UX/analytics ideas.

**Authoritative flow (code-verified):**
- Swaps/mints/burns and all market events are emitted in `contracts/src/market/amm.cairo`.
- Fee config and treasury routing live in `contracts/src/market/market_factory.cairo` and
  `contracts/src/interfaces/i_market_factory.cairo`.
- Fee math uses `ln_fee_rate_root` and `reserve_fee_percent` in
  `contracts/src/market/market_math_fp.cairo`.

### Key Contract Changes

| Change | Impact | Priority |
|--------|--------|----------|
| `fee_rate` → `ln_fee_rate_root` | Breaking: parameter rename | HIGH |
| New `reserve_fee_percent` (u8, base-100) | New field in Market constructor | HIGH |
| Treasury wiring (conditional per-swap transfers) | New event: `ReserveFeeTransferred` | HIGH |
| Fee split: LP fee vs Reserve fee | Swap event enhanced | MEDIUM |
| Override fee per router/market | Only `ln_fee_rate_root` is overrideable (reserve fee is factory-default) | MEDIUM |
| `MarketConfig` struct | New return type for `get_market_config` | MEDIUM |
| MINIMUM_LIQUIDITY recipient | Treasury if set; dead-address fallback | LOW |

---

## 1. Breaking Changes

### 1.1 Market Constructor Signature Change

**Current (code-verified):**
```cairo
constructor(name, symbol, pt, scalar_root, initial_anchor, ln_fee_rate_root, reserve_fee_percent, pauser, factory)
```

**Impact:**
- Frontend market creation UI (if exists) needs parameter update
- Deployment scripts need update
- Any hardcoded fee values need conversion to ln-space

### 1.2 MarketFactory.create_market Signature Change

**Current (code-verified):** `create_market(pt, scalar_root, initial_anchor, ln_fee_rate_root, reserve_fee_percent)`

**Files Affected:**
- `packages/frontend/src/types/generated/MarketFactory.ts` - verify regenerated ABI matches new signature
- Any frontend forms that create markets

### 1.3 New Market Getter Methods

| Old | New | Notes |
|-----|-----|-------|
| (none) | `get_ln_fee_rate_root()` | Returns u256 in WAD |
| (none) | `get_reserve_fee_percent()` | Returns u8 (0-100); uses factory default when factory is set |

---

## 2. New Events to Index

### 2.1 Market Contract Events

#### ReserveFeeTransferred (NEW)
```typescript
{
  market: ContractAddress,      // key
  treasury: ContractAddress,    // key
  caller: ContractAddress,      // key
  amount: u256,                 // data - SY amount transferred
  expiry: u64,                  // data
  timestamp: u64                // data
}
```

**Emission condition (code-verified):**
- Emitted only when a factory treasury is set and `reserve_fee > 0`.
- If factory is zero or treasury is zero, reserve fee stays in the pool and no
  `ReserveFeeTransferred` event is emitted (reserve fee still appears in `Swap`).

**Indexer Action Required:**
- Add table: `market_reserve_fee_transferred`
- Add parser in `market.indexer.ts`
- Add validation schema in `validation.ts`

#### Enhanced Swap Event
**New fields added:**
```typescript
{
  // Existing fields...
  total_fee: u256,              // NEW - Total fee charged
  lp_fee: u256,                 // NEW - Fee retained by LPs
  reserve_fee: u256,            // NEW - Fee sent to treasury
  implied_rate_before: u256,    // NEW - Rate before swap
  implied_rate_after: u256,     // NEW - Rate after swap
  // ...existing fields
}
```

**Keys (code-verified):** selector + `sender`, `receiver`, `expiry`

**Indexer Action Required:**
- Update `market_swap` table schema
- Update parser to extract new fields
- Update validation schema

#### Enhanced FeesCollected Event
**Changed field:**
- `fee_rate` is now `ln_fee_rate_root` (same type, different meaning)

**Behavior note (code-verified):**
- `collect_fees()` is analytics-only; no fee transfer occurs. LP fees remain in reserves.

### 2.2 MarketFactory Events

#### TreasuryUpdated (NEW)
```typescript
{
  old_treasury: ContractAddress,  // data
  new_treasury: ContractAddress   // data
}
```

#### DefaultReserveFeeUpdated (NEW)
```typescript
{
  old_percent: u8,  // data
  new_percent: u8   // data
}
```

#### OverrideFeeSet (NEW)
```typescript
{
  router: ContractAddress,        // key
  market: ContractAddress,        // key
  ln_fee_rate_root: u256          // data
}
```

#### Enhanced MarketCreated Event
**New fields:**
```typescript
{
  // Existing fields...
  ln_fee_rate_root: u256,         // Renamed from fee_rate
  reserve_fee_percent: u8,        // NEW
  // ...existing fields
}
```

---

## 3. Indexer Changes Required

### 3.1 Schema Updates (`packages/indexer/src/schema/index.ts`)

```typescript
// NEW TABLE: Reserve fee transfers
export const marketReserveFeeTransferred = pgTable("market_reserve_fee_transferred", {
  id: serial("id").primaryKey(),
  block_number: bigint("block_number", { mode: "bigint" }).notNull(),
  block_timestamp: timestamp("block_timestamp").notNull(),
  transaction_hash: text("transaction_hash").notNull(),
  event_index: integer("event_index").notNull(),

  // Keys
  market: text("market").notNull(),
  treasury: text("treasury").notNull(),
  caller: text("caller").notNull(),

  // Data
  amount: numeric("amount", { precision: 78, scale: 0 }).notNull(),
  expiry: bigint("expiry", { mode: "bigint" }).notNull(),
  timestamp: bigint("timestamp", { mode: "bigint" }).notNull(),
}, (table) => ({
  unique: uniqueIndex().on(table.block_number, table.transaction_hash, table.event_index),
}));

// UPDATE: market_swap table - add new columns
// total_fee: numeric("total_fee", { precision: 78, scale: 0 }),
// lp_fee: numeric("lp_fee", { precision: 78, scale: 0 }),
// reserve_fee: numeric("reserve_fee", { precision: 78, scale: 0 }),
// implied_rate_before: numeric("implied_rate_before", { precision: 78, scale: 0 }),
// implied_rate_after: numeric("implied_rate_after", { precision: 78, scale: 0 }),

// NEW TABLES: MarketFactory events
export const marketFactoryTreasuryUpdated = pgTable("market_factory_treasury_updated", {...});
export const marketFactoryDefaultReserveFeeUpdated = pgTable("market_factory_default_reserve_fee_updated", {...});
export const marketFactoryOverrideFeeSet = pgTable("market_factory_override_fee_set", {...});
```

### 3.2 Indexer Handler Updates

**File:** `packages/indexer/src/indexers/market.indexer.ts`

```typescript
// Add new selector
const RESERVE_FEE_TRANSFERRED = getSelector("ReserveFeeTransferred");

// Add to filter (line ~125)
{
  fromAddress: marketAddress,
  keys: [[RESERVE_FEE_TRANSFERRED]],
  includeReceipt: false,
}

// Add parser (after line ~430)
if (eventKey === RESERVE_FEE_TRANSFERRED) {
  const validated = marketReserveFeeTransferredSchema.safeParse({ keys, data });
  if (!validated.success) {
    console.warn("Invalid ReserveFeeTransferred event", validated.error);
    continue;
  }

  const amount = readU256(data, 0, "amount");
  const expiry = Number(BigInt(data[2] ?? "0"));
  const timestamp = Number(BigInt(data[3] ?? "0"));

  reserveFeeTransfers.push({
    block_number: BigInt(block.header.blockNumber),
    block_timestamp: new Date(Number(block.header.timestamp) * 1000),
    transaction_hash: txHash,
    event_index: eventIndex,
    market: keys[1] ?? "",
    treasury: keys[2] ?? "",
    caller: keys[3] ?? "",
    amount,
    expiry: BigInt(expiry),
    timestamp: BigInt(timestamp),
  });
}
```

**File:** `packages/indexer/src/indexers/market-factory.indexer.ts`

Add handlers for:
- `TreasuryUpdated`
- `DefaultReserveFeeUpdated`
- `OverrideFeeSet`

### 3.3 Validation Schema Updates

**File:** `packages/indexer/src/lib/validation.ts`

```typescript
export const marketSwapSchema = z.object({
  keys: z.array(z.string()).length(4),
  data: z.array(z.string()).length(27), // sy, pt, 12x u256, timestamp
});

export const marketReserveFeeTransferredSchema = z.object({
  keys: z.array(z.string()).length(4), // selector, market, treasury, caller
  data: z.array(z.string()).length(4), // amount(2), expiry, timestamp
});
```

### 3.4 Analytics Views Updates

**File:** `packages/indexer/scripts/create-views.sql`

```sql
-- Update market_current_state to include fee breakdown
CREATE MATERIALIZED VIEW market_current_state AS
SELECT
  m.address,
  -- ... existing fields ...

  -- Fee breakdown (NEW)
  SUM(CASE WHEN s.timestamp > NOW() - INTERVAL '24 hours' THEN s.lp_fee ELSE 0 END) as lp_fees_24h,
  SUM(CASE WHEN s.timestamp > NOW() - INTERVAL '24 hours' THEN s.reserve_fee ELSE 0 END) as reserve_fees_24h,

  -- Implied rate change tracking (NEW)
  AVG(CASE WHEN s.timestamp > NOW() - INTERVAL '24 hours'
      THEN ABS(s.implied_rate_after - s.implied_rate_before) ELSE NULL END) as avg_rate_impact_24h
FROM markets m
LEFT JOIN market_swap s ON s.market = m.address
-- ...
;

-- NEW VIEW: Treasury fee collection analytics
CREATE MATERIALIZED VIEW treasury_fee_analytics AS
SELECT
  DATE_TRUNC('day', block_timestamp) as day,
  treasury,
  SUM(amount::numeric / 1e18) as total_fees_collected,
  COUNT(*) as collection_count,
  COUNT(DISTINCT market) as markets_collected_from
FROM market_reserve_fee_transferred
GROUP BY 1, 2
ORDER BY 1 DESC;

-- NEW VIEW: Override fee tracking
CREATE VIEW market_fee_overrides AS
SELECT
  router,
  market,
  ln_fee_rate_root,
  block_timestamp as set_at
FROM market_factory_override_fee_set
ORDER BY block_timestamp DESC;
```

---

## 4. Frontend Changes Required

### 4.1 API Type Updates

**File:** `packages/frontend/src/shared/api/types.ts`

```typescript
// Update IndexedMarket type
export interface IndexedMarket {
  // ... existing fields ...
  lnFeeRateRoot: string;        // Renamed from feeRate
  reserveFeePercent: number;    // NEW (0-100)
}

// Update SwapEvent type
export interface SwapEvent {
  // ... existing fields ...
  totalFee: string;             // NEW
  lpFee: string;                // NEW
  reserveFee: string;           // NEW
  impliedRateBefore: string;    // NEW
  impliedRateAfter: string;     // NEW
}

// NEW: Market configuration from factory
export interface MarketConfig {
  treasury: string;
  lnFeeRateRoot: string;
  reserveFeePercent: number;
}
```

### 4.2 useMarkets Hook Updates

**File:** `packages/frontend/src/features/markets/model/useMarkets.ts`

```typescript
// Add new contract calls
const fetchMarketData = async (market: Contract) => {
  const [
    // ... existing calls ...
    lnFeeRateRoot,
    reserveFeePercent,
  ] = await Promise.all([
    // ... existing calls ...
    market.get_ln_fee_rate_root(),
    market.get_reserve_fee_percent(),
  ]);

  return {
    // ... existing fields ...
    lnFeeRateRoot: lnFeeRateRoot.toString(),
    reserveFeePercent: Number(reserveFeePercent),
    // Calculated: effective annual fee rate
    annualFeeRate: calculateAnnualFeeRate(lnFeeRateRoot),
  };
};
```

**Note:** swaps can use a per-router `ln_fee_rate_root` override from
`MarketFactory.get_market_config(market, router)`. If the UI displays "effective fee", use
factory config for the active router; `get_reserve_fee_percent()` always reflects the factory
default (not per-router).

### 4.3 SwapForm UI Enhancements

**File:** `packages/frontend/src/features/swap/ui/SwapForm.tsx`

```typescript
// Enhanced fee display (after line ~670)
<FormSection title="Fee Breakdown">
  <FormRow
    label="Total Fee"
    value={formatWad(swapResult.totalFee, 6) + " " + syLabel}
  />
  <FormRow
    label="LP Share"
    value={formatWad(swapResult.lpFee, 6) + " " + syLabel}
    tooltip="Fee retained by liquidity providers"
  />
  <FormRow
    label="Protocol Share"
    value={formatWad(swapResult.reserveFee, 6) + " " + syLabel}
    tooltip="Fee sent to protocol treasury"
  />
</FormSection>

// Implied rate impact display
<FormRow
  label="Rate Impact"
  value={formatRateChange(swapResult.impliedRateBefore, swapResult.impliedRateAfter)}
  tooltip="Change in implied yield rate from this swap"
/>
```

### 4.4 New UI Components Recommended

#### Fee Structure Display (Market Card)
```typescript
// packages/frontend/src/features/markets/ui/FeeStructure.tsx
export const FeeStructure = ({ market }: { market: MarketData }) => {
  const annualRate = calculateAnnualFeeRate(market.lnFeeRateRoot);
  const lpShare = 100 - market.reserveFeePercent;

  return (
    <div className="fee-structure">
      <div className="fee-rate">
        <Label>Annual Fee Rate</Label>
        <Value>{formatPercent(annualRate)}</Value>
      </div>
      <div className="fee-split">
        <div className="lp-share" style={{ width: `${lpShare}%` }}>
          LP: {lpShare}%
        </div>
        <div className="reserve-share" style={{ width: `${market.reserveFeePercent}%` }}>
          Treasury: {market.reserveFeePercent}%
        </div>
      </div>
    </div>
  );
};
```

#### Treasury Analytics Widget
```typescript
// packages/frontend/src/widgets/analytics/TreasuryRevenue.tsx
export const TreasuryRevenue = () => {
  const { data } = useTreasuryAnalytics();

  return (
    <AnalyticsCard title="Protocol Treasury Revenue">
      <Metric label="24h Revenue" value={data.revenue24h} />
      <Metric label="7d Revenue" value={data.revenue7d} />
      <Chart data={data.history} type="area" />
    </AnalyticsCard>
  );
};
```

### 4.5 API Route Updates

**File:** `packages/frontend/src/app/api/markets/[address]/route.ts`

```typescript
// Add fee config to response
return NextResponse.json({
  // ... existing fields ...
  feeConfig: {
    lnFeeRateRoot: market.ln_fee_rate_root,
    reserveFeePercent: market.reserve_fee_percent,
    annualRate: calculateAnnualRate(market.ln_fee_rate_root),
  },
});
```

**New Route:** `packages/frontend/src/app/api/analytics/treasury/route.ts`

```typescript
// Treasury revenue analytics endpoint
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30");

  const revenue = await db.query.marketReserveFeeTransferred.findMany({
    where: gte(blockTimestamp, subDays(new Date(), days)),
    orderBy: desc(blockTimestamp),
  });

  return NextResponse.json({
    total: aggregateRevenue(revenue),
    byMarket: groupByMarket(revenue),
    history: aggregateByDay(revenue),
  });
}
```

---

## 5. New Analytics Opportunities

### 5.1 Fee Revenue Analytics

| Metric | Description | Source |
|--------|-------------|--------|
| LP Revenue | Sum of `lp_fee` from Swap events | `market_swap.lp_fee` |
| Protocol Revenue | Sum of `reserve_fee` from Swap events | `market_swap.reserve_fee` |
| Fee APY for LPs | (lp_fees_24h * 365) / total_liquidity | Computed view |
| Treasury Inflow Rate | reserve_fee per hour/day | Aggregated view |

### 5.2 Rate Impact Analytics

| Metric | Description | Source |
|--------|-------------|--------|
| Average Rate Impact | Mean of |implied_rate_after - implied_rate_before| | `market_swap` |
| Large Trade Detection | Swaps with rate impact > threshold | Computed |
| Rate Volatility | Std dev of implied rate changes | Aggregated view |
| Rate Recovery Time | Time for rate to return to mean | Time series analysis |

### 5.3 Override Fee Analytics

| Metric | Description | Source |
|--------|-------------|--------|
| Router Fee Discounts | Markets with override fees | `market_factory_override_fee_set` |
| Discount Volume | Volume through discounted routers | Join with swaps |
| Protocol Fee Impact | Revenue change from overrides | Computed |

### 5.4 Treasury Analytics Dashboard

Recommended new analytics page sections:
1. **Revenue Overview**: 24h, 7d, 30d protocol revenue
2. **Revenue by Market**: Pie chart of fee contribution per market
3. **Fee Rate Comparison**: ln_fee_rate_root across markets
4. **Override Tracking**: Active fee overrides and their impact
5. **Treasury Balance**: Running total of collected fees (requires treasury contract query)

---

## 6. Migration Checklist

### 6.1 Indexer Migration

- [ ] Add new tables to schema
- [ ] Run `bun run db:generate` for migration
- [ ] Update market.indexer.ts with new event handlers
- [ ] Update market-factory.indexer.ts with new event handlers
- [ ] Update validation schemas
- [ ] Update/add materialized views
- [ ] Test with local devnet
- [ ] Deploy migration to production DB
- [ ] Reindex from appropriate block (if needed for historical data)

### 6.2 Frontend Migration

- [ ] Run `bun run codegen` if ABI changes are not yet reflected
- [ ] Update API types
- [ ] Update useMarkets hook
- [ ] Update SwapForm fee display
- [ ] Add FeeStructure component
- [ ] Add treasury analytics route
- [ ] Update market detail pages
- [ ] Add TreasuryRevenue widget
- [ ] Test with local devnet
- [ ] Deploy to staging

### 6.3 Deployment Order

1. **Contracts**: Deploy new Market and MarketFactory contracts
2. **Indexer**: Deploy schema migration, then update indexer code
3. **Frontend**: Deploy after indexer is processing new events
4. **Backfill**: If historical data needed, reindex from contract creation

---

## 7. Risk Assessment

### 7.1 Breaking Change Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Old markets incompatible | MEDIUM | New markets only; old markets continue working |
| Fee calculation mismatch | HIGH | Validate with contract tests before frontend integration |
| Indexer event parsing failure | HIGH | Add validation; graceful degradation for unknown events |

### 7.2 Data Consistency Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Missing historical fee data | LOW | Compute from Swap events retroactively |
| ReserveFeeTransferred only emitted when treasury set | MEDIUM | Use `Swap.reserve_fee` for totals; treat missing transfer events as "not transferred" not "zero fee" |
| Treasury address changes | LOW | Index TreasuryUpdated events |

---

## 8. Testing Requirements

### 8.1 Indexer Tests

```typescript
describe("ReserveFeeTransferred", () => {
  it("parses event correctly", async () => {
    const event = mockReserveFeeTransferredEvent({
      market: "0x123...",
      treasury: "0x456...",
      amount: "1000000000000000000", // 1 WAD
    });
    const result = await processEvent(event);
    expect(result.amount).toBe("1000000000000000000");
  });
});

describe("Enhanced Swap Event", () => {
  it("extracts fee breakdown", async () => {
    const event = mockSwapEvent({
      totalFee: "3000000000000000", // 0.003 WAD
      lpFee: "1500000000000000",
      reserveFee: "1500000000000000",
    });
    const result = await processEvent(event);
    expect(result.lpFee).toBe("1500000000000000");
  });
});
```

### 8.2 Frontend Tests

```typescript
describe("Fee Structure Display", () => {
  it("calculates annual rate from ln_fee_rate_root", () => {
    const lnFeeRateRoot = "48790164169432000"; // ~5% annual
    const annualRate = calculateAnnualFeeRate(lnFeeRateRoot);
    expect(annualRate).toBeCloseTo(0.05, 3);
  });

  it("displays fee split correctly", () => {
    render(<FeeStructure market={{ reserveFeePercent: 20 }} />);
    expect(screen.getByText("LP: 80%")).toBeInTheDocument();
    expect(screen.getByText("Treasury: 20%")).toBeInTheDocument();
  });
});
```

---

## Appendix A: Event Field Mappings

### Swap Event Field Mapping (Data Felts)

| Index | Field | Type |
|-------|-------|------|
| 0 | sy | ContractAddress |
| 1 | pt | ContractAddress |
| 2-3 | pt_in | u256 |
| 4-5 | sy_in | u256 |
| 6-7 | pt_out | u256 |
| 8-9 | sy_out | u256 |
| 10-11 | total_fee | u256 |
| 12-13 | lp_fee | u256 |
| 14-15 | reserve_fee | u256 |
| 16-17 | implied_rate_before | u256 |
| 18-19 | implied_rate_after | u256 |
| 20-21 | exchange_rate | u256 |
| 22-23 | sy_reserve_after | u256 |
| 24-25 | pt_reserve_after | u256 |
| 26 | timestamp | u64 |

### MarketCreated Event Field Mapping

`MarketCreated` includes a `ByteArray` (`underlying_symbol`), which makes fixed felt offsets
fragile. Use ABI decoding instead of hard-coded indices. Code order in
`contracts/src/market/market_factory.cairo` is authoritative:
`market`, `creator`, `scalar_root`, `initial_anchor`, `ln_fee_rate_root`,
`reserve_fee_percent`, `sy`, `yt`, `underlying`, `underlying_symbol`,
`initial_exchange_rate`, `timestamp`, `market_index` (with keys `pt`, `expiry`).

---

## Appendix B: Utility Functions

### Annual Fee Rate Calculation

```typescript
// Convert ln_fee_rate_root to annual percentage
function calculateAnnualFeeRate(lnFeeRateRoot: string): number {
  const WAD = 10n ** 18n;
  const lnRate = BigInt(lnFeeRateRoot);

  // Annual fee multiplier = exp(ln_fee_rate_root)
  // Annual fee rate = exp(ln_fee_rate_root) - 1
  // Use a WAD exp helper; linear approximation is only valid for small values.
  const feeRateWad = expWad(lnRate) - WAD; // expWad is a placeholder for a WAD fixed-point exp

  return Number(feeRateWad) / Number(WAD);
}
```

### Fee Breakdown Display

```typescript
function formatFeeBreakdown(
  totalFee: bigint,
  lpFee: bigint,
  reserveFee: bigint,
  sySymbol: string
): string {
  const total = formatWad(totalFee, 6);
  const lpPercent = (Number(lpFee) / Number(totalFee) * 100).toFixed(1);
  const reservePercent = (Number(reserveFee) / Number(totalFee) * 100).toFixed(1);

  return `${total} ${sySymbol} (${lpPercent}% LP / ${reservePercent}% Treasury)`;
}
```
