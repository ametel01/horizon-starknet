# Analytics Refactor Implementation Plan

## Executive Summary

This plan transforms Horizon Protocol's analytics from generic DeFi KPIs (TVL/Volume/Fees) into **yield-derivatives-native analytics** that outclass Pendle-style dashboards. The implementation is incremental, maintains full backward compatibility, and uses shadcn/ui components with semantic colors throughout.

**Key Deliverables:**
1. Yield Curve (Term Structure) Dashboard
2. PT Convergence to Par Visualization
3. Implied vs Realized APY Comparison
4. Execution Quality / Price Impact Analytics
5. Enhanced Wallet P&L with "Beat Implied" Scoring
6. LP Fee APR Decomposition

---

## Current State Analysis

### Existing Analytics Infrastructure

**Protocol Analytics Page** (`src/page-compositions/analytics/AnalyticsPage.tsx`):
- Protocol Stats Overview (TVL, Markets, Volume, Swaps, Fees, Users)
- TVL Chart + Breakdown by Market
- Volume Chart + Breakdown by Market
- Fee Revenue Chart + Collection Log

**Existing Widgets** (`src/widgets/analytics/`):
- `ProtocolStats` / `ProtocolTvlCard` / `TvlChart` / `TvlBreakdown`
- `VolumeChart` / `VolumeStatsCard` / `VolumeByMarket`
- `FeeRevenueChart` / `FeeByMarket` / `FeeCollectionLog`
- `ImpliedRateChart` / `RateHistoryTable` / `RateSparkline` (market-level)
- `SwapHistoryTable` / `TransactionHistory`

**Existing API Routes** (`src/app/api/analytics/`):
- `/stats` - Combined protocol stats
- `/tvl` - TVL metrics with history
- `/volume` - Volume metrics with history
- `/fees` - Fee metrics with breakdown

**Existing Database Views** (from indexer schema):
- `market_daily_stats` - Daily OHLC for implied rate, volume, fees
- `market_hourly_stats` - Hourly granularity
- `market_current_state` - Latest state per market
- `rate_history` - Rate changes from swaps
- `exchange_rate_history` - SY oracle rate updates
- `user_positions_summary` - PT/YT position aggregates
- `user_lp_positions` - LP position aggregates
- `user_trading_stats` - Trading activity stats
- `protocol_daily_stats` - Protocol-wide daily aggregates

### Gaps Identified (from Spec)

1. **No Yield Curve / Term Structure** - Multiple markets not compared by time-to-expiry
2. **No PT Pull-to-Par Visualization** - PT price convergence not shown
3. **No Implied vs Realized Comparison** - Missing key yield insight
4. **No Execution Quality Metrics** - Price impact distribution missing
5. **Redundant KPIs** - TVL/Volume/Fees repeated across sections
6. **Rate Naming Ambiguity** - `implied_rate` could be ln-rate, exp'd rate, or APY

---

## Database Schema Assessment

### No Breaking Changes Required

All existing tables and views remain unchanged. The current schema supports the new analytics:

| Required Data | Available Source |
|--------------|------------------|
| Implied Rate (APY) | `market_daily_stats.implied_rate_close` (needs conversion from ln-rate) |
| PT Price | Calculated: `exp(-ln_rate * time_to_expiry / SECONDS_PER_YEAR)` |
| Exchange Rate | `market_daily_stats.exchange_rate_close`, `exchange_rate_history` |
| Price Impact | `market_swap.implied_rate_before/after` |
| User Positions | `user_positions_summary`, `user_lp_positions` |
| Fee APR | `market_daily_stats.total_fees / TVL * 365` |

### New Views Required (Additive Only)

```sql
-- View 1: market_prices_snapshot_daily (convenience view for frontend)
-- Pre-computes PT price, APY, TVL in SY terms
CREATE MATERIALIZED VIEW market_prices_snapshot_daily AS
SELECT
  market,
  day,
  expiry,
  EXTRACT(EPOCH FROM (to_timestamp(expiry) - day)) as time_to_expiry_seconds,
  implied_rate_close as ln_implied_rate,
  (exp(implied_rate_close::numeric / 1e18) - 1) * 100 as apy_implied_percent,
  exp(-1.0 * implied_rate_close::numeric / 1e18 *
      EXTRACT(EPOCH FROM (to_timestamp(expiry) - day)) / 31536000) as pt_price_in_sy,
  sy_reserve,
  pt_reserve,
  sy_reserve + pt_reserve * exp(-1.0 * implied_rate_close::numeric / 1e18 *
      EXTRACT(EPOCH FROM (to_timestamp(expiry) - day)) / 31536000) as tvl_in_sy,
  total_fees,
  swap_count,
  underlying_symbol
FROM market_daily_stats
WHERE implied_rate_close IS NOT NULL;

-- View 2: market_execution_stats_daily (price impact analytics)
CREATE MATERIALIZED VIEW market_execution_stats_daily AS
SELECT
  market,
  DATE_TRUNC('day', block_timestamp) as day,
  COUNT(*) as swap_count,
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY ABS(implied_rate_after::numeric - implied_rate_before::numeric)
  ) as impact_median_wad,
  PERCENTILE_CONT(0.95) WITHIN GROUP (
    ORDER BY ABS(implied_rate_after::numeric - implied_rate_before::numeric)
  ) as impact_p95_wad,
  AVG(ABS(implied_rate_after::numeric - implied_rate_before::numeric)) as impact_avg_wad
FROM market_swap
GROUP BY market, DATE_TRUNC('day', block_timestamp);
```

**Migration Strategy:** Add these as new materialized views without touching existing tables. Refresh alongside existing views via `refresh_all_materialized_views()`.

---

## Implementation Phases

### Phase 1: Core Yield-Native Charts (High Priority)

**Goal:** Deliver 4 charts that visibly beat Pendle UX using existing data.

#### 1.1 Yield Curve (Term Structure) Chart

**New Files:**
- `src/widgets/analytics/YieldCurveChart.tsx`
- `src/app/api/analytics/yield-curve/route.ts`
- `src/features/analytics/api/useYieldCurve.ts`

**Data Flow:**
```
market_current_state → API → Frontend
  ├── market address
  ├── expiry timestamp
  ├── implied_rate (ln-rate WAD)
  └── underlying_symbol

Frontend calculates:
  ├── time_to_expiry = (expiry - now) / SECONDS_PER_YEAR
  └── apy = (exp(ln_rate) - 1) * 100

Chart: X = time_to_expiry, Y = APY%, color by underlying
```

**Component Design:**
```tsx
// YieldCurveChart.tsx
interface YieldCurveChartProps {
  className?: string;
  showHistorical?: boolean; // Toggle 7d/30d ago curves
}

// Uses shadcn Card, semantic colors:
// - chart-1 through chart-5 for different underlyings
// - muted-foreground for axis labels
// - primary for current curve
// - muted for historical curves
```

#### 1.2 PT Convergence to Par Chart

**New Files:**
- `src/widgets/analytics/PtConvergenceChart.tsx`
- `src/app/api/markets/[address]/pt-price/route.ts`

**Data Flow:**
```
market_daily_stats → API → Frontend
  ├── day
  ├── implied_rate_close (ln-rate)
  ├── expiry
  └── exchange_rate_close

Frontend calculates:
  └── pt_price = exp(-ln_rate * time_to_expiry / SECONDS_PER_YEAR)

Chart: X = date, Y = PT price (0 to 1.0), horizontal line at 1.0 (par)
```

**Visual Design:**
- Area chart with gradient fill
- Dashed horizontal line at Y=1.0 labeled "Par"
- Show days to expiry countdown
- Use `primary` for PT price line, `border` for par line

#### 1.3 Implied vs Realized APY Chart

**New Files:**
- `src/widgets/analytics/ImpliedVsRealizedChart.tsx`
- `src/app/api/analytics/implied-vs-realized/route.ts`

**Data Flow:**
```
market_daily_stats + exchange_rate_history → API → Frontend

Implied APY:
  └── apy = (exp(implied_rate_close) - 1) * 100

Realized APY (from underlying):
  └── daily_return = (new_rate - old_rate) / old_rate
  └── annualized = daily_return * 365 * 100

Spread:
  └── spread = implied_apy - realized_apy
```

**Visual Design:**
- Dual-line chart: Implied (primary), Realized (chart-2)
- Shaded area between lines showing spread
- Positive spread = green tint, negative = red tint
- Use semantic colors: `primary`, `chart-2`, `destructive`

#### 1.4 Execution Quality / Price Impact Chart

**New Files:**
- `src/widgets/analytics/ExecutionQualityPanel.tsx`
- `src/widgets/analytics/PriceImpactDistribution.tsx`
- `src/app/api/analytics/execution-quality/route.ts`

**Data Flow:**
```
market_swap (or enriched_router_swap) → API → Frontend
  ├── implied_rate_before
  ├── implied_rate_after
  ├── sy_in / pt_out (or pt_in / sy_out)
  └── fee

Calculations:
  ├── impact_bps = |ln_rate_after - ln_rate_before| / 1e18 * 10000
  ├── effective_price = sy_amount / pt_amount
  └── trade_size = sy_in + sy_out (in WAD)

Charts:
  1. Histogram: Impact distribution (p50, p75, p95 lines)
  2. Scatter: Impact vs Trade Size
  3. Daily: Impact p50/p95 over time
```

**Visual Design:**
- Bar chart for histogram with percentile lines
- Scatter plot with size-encoded points
- Use semantic `chart-1` for bars, `destructive` for high impact

---

### Phase 2: Wallet & LP Excellence

**Goal:** Position-level P&L, yield tracking, and "Beat Implied" scoreboard.

#### 2.1 Enhanced Wallet P&L Timeline

**New Files:**
- `src/widgets/portfolio/PositionPnlTimeline.tsx`
- `src/widgets/portfolio/YtCashflowChart.tsx`
- `src/app/api/portfolio/[address]/pnl-timeline/route.ts`

**Data Sources:**
- `user_positions_summary` - Net positions, entry data
- `yt_interest_claimed` - YT yield claims over time
- `enriched_router_mint_py` / `enriched_router_redeem_py` - Entry/exit events

**Features:**
- Cumulative YT cashflow chart (claimed SY over time)
- PT exposure timeline with unrealized P&L
- Entry price vs current price comparison

#### 2.2 "Beat Implied" Scoreboard

**New Files:**
- `src/widgets/portfolio/BeatImpliedScore.tsx`
- `src/app/api/portfolio/[address]/beat-implied/route.ts`

**Calculation:**
```
For PT positions:
  entry_apy = APY at mint time
  realized_apy = Current P&L annualized
  beat_implied = realized_apy - entry_apy

Score interpretation:
  > 0: Position outperforming initial implied rate
  < 0: Position underperforming
```

**Visual Design:**
- Score badge with color gradient (green → yellow → red)
- Comparison bar chart: Entry APY vs Realized APY
- Historical "beat" trend line

#### 2.3 LP Fee APR Decomposition

**New Files:**
- `src/widgets/portfolio/LpApyBreakdown.tsx`

**Calculation:**
```
fee_apr = (total_fees_period / tvl_avg) * (365 / period_days)

For user LP:
  share = lp_balance / total_lp
  user_fees = total_fees * share
  user_fee_apr = fee_apr (same as pool)
```

**Visual Design:**
- Stacked bar or pie showing APR components
- Fee APR prominently displayed
- Comparison to implied rate

---

### Phase 3: Advanced Market Microstructure

**Goal:** Depth curves, spread proxies, and liquidity health metrics.

#### 3.1 Slippage / Depth Curve

**New Files:**
- `src/widgets/analytics/DepthCurve.tsx`
- `src/app/api/markets/[address]/depth/route.ts`

**Calculation (Server-Side):**
Using market math library, simulate trades at various sizes:
```typescript
const sizes = [100, 1000, 10000, 100000]; // in SY
const impacts = sizes.map(size => {
  const { impliedRateAfter } = simulateSwap(marketState, size);
  return (impliedRateAfter - currentRate) / currentRate;
});
```

**Visual Design:**
- Line chart: X = trade size, Y = price impact %
- Shaded "acceptable slippage" zone (e.g., < 0.5%)
- Markers at key size thresholds

#### 3.2 Spread Proxy & Liquidity Health

**New Files:**
- `src/widgets/analytics/LiquidityHealthScore.tsx`

**Metrics:**
- Bid-ask spread proxy from recent trades
- Depth at 1% slippage threshold
- Utilization ratio: volume / liquidity
- Health score: composite 0-100

---

## UI/UX Improvements

### Consolidate Redundant Sections

**Current State:** TVL appears in 4 places (KPI, section header, chart, breakdown)

**New Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Protocol Overview (compact KPI bar)                    │
│  TVL | Markets | 24h Volume | 24h Swaps | 24h Fees     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Yield Analytics (NEW - primary focus)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ Yield Curve │  │ PT to Par   │  │ Implied vs Real │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Market Depth & Execution (collapsible)                 │
│  ┌─────────────┐  ┌─────────────┐                      │
│  │ Depth Curve │  │ Impact Dist │                      │
│  └─────────────┘  └─────────────┘                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  TVL & Volume (collapsible - existing)                  │
│  ┌─────────────┐  ┌─────────────┐                      │
│  │ TVL Chart   │  │ Volume Chart│                      │
│  └─────────────┘  └─────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

### Early-Stage Data Handling

Hide low-signal metrics until scale:
```tsx
// Only show unique users if > 10
{stats.uniqueUsers24h > 10 && (
  <StatCard label="Unique Users" value={stats.uniqueUsers24h} />
)}
```

---

## Semantic Color System

All analytics components use shadcn semantic colors:

| Color Variable | Usage |
|----------------|-------|
| `primary` | Primary metrics, positive trends, main chart line |
| `destructive` | Negative values, high impact, errors |
| `muted-foreground` | Axis labels, secondary text |
| `chart-1` through `chart-5` | Multi-series charts, market differentiation |
| `border` | Grid lines, separators |
| `card` / `background` | Container backgrounds |

Example usage in components:
```tsx
<span className={cn(
  "font-medium",
  value >= 0 ? "text-primary" : "text-destructive"
)}>
  {formatPercent(value)}
</span>
```

---

## New shadcn Components to Install

```bash
# For enhanced charts and interactions
bunx shadcn@latest add tabs          # Chart period selectors
bunx shadcn@latest add toggle-group  # View mode toggles
bunx shadcn@latest add slider        # Trade size simulation
bunx shadcn@latest add progress      # Liquidity health bar
bunx shadcn@latest add hover-card    # Metric explanations
bunx shadcn@latest add collapsible   # Section collapse
```

---

## File Structure (New Files)

```
src/
├── app/api/analytics/
│   ├── yield-curve/route.ts           # NEW
│   ├── implied-vs-realized/route.ts   # NEW
│   ├── execution-quality/route.ts     # NEW
│   └── ... (existing)
│
├── app/api/markets/[address]/
│   ├── pt-price/route.ts              # NEW
│   ├── depth/route.ts                 # NEW
│   └── ... (existing)
│
├── app/api/portfolio/[address]/
│   ├── pnl-timeline/route.ts          # NEW
│   ├── beat-implied/route.ts          # NEW
│   └── ... (existing)
│
├── features/analytics/
│   ├── api/
│   │   ├── useYieldCurve.ts           # NEW
│   │   ├── useImpliedVsRealized.ts    # NEW
│   │   ├── useExecutionQuality.ts     # NEW
│   │   └── ... (existing)
│   └── ... (existing)
│
├── widgets/analytics/
│   ├── YieldCurveChart.tsx            # NEW
│   ├── PtConvergenceChart.tsx         # NEW
│   ├── ImpliedVsRealizedChart.tsx     # NEW
│   ├── ExecutionQualityPanel.tsx      # NEW
│   ├── PriceImpactDistribution.tsx    # NEW
│   ├── DepthCurve.tsx                 # NEW
│   ├── LiquidityHealthScore.tsx       # NEW
│   └── ... (existing)
│
├── widgets/portfolio/
│   ├── PositionPnlTimeline.tsx        # NEW
│   ├── YtCashflowChart.tsx            # NEW
│   ├── BeatImpliedScore.tsx           # NEW
│   ├── LpApyBreakdown.tsx             # NEW
│   └── ... (existing)
│
└── page-compositions/analytics/
    └── AnalyticsPage.tsx              # MODIFY (reorganize layout)
```

---

## Implementation Order

### Step 1: API Foundation (No UI Changes)
1. Add `yield-curve` API route
2. Add `implied-vs-realized` API route
3. Add `execution-quality` API route
4. Add hooks: `useYieldCurve`, `useImpliedVsRealized`, `useExecutionQuality`
5. **Test:** Verify data transformation from existing views

### Step 2: Core Charts (Additive)
1. Create `YieldCurveChart.tsx` widget
2. Create `PtConvergenceChart.tsx` widget
3. Create `ImpliedVsRealizedChart.tsx` widget
4. Create `ExecutionQualityPanel.tsx` widget
5. **Test:** Render charts with real data

### Step 3: Analytics Page Reorganization
1. Add new "Yield Analytics" section to AnalyticsPage
2. Wrap existing TVL/Volume/Fees in collapsible sections
3. Consolidate Protocol Stats to compact bar
4. Hide low-signal early-stage metrics
5. **Test:** Full page layout

### Step 4: Portfolio Enhancement
1. Create `BeatImpliedScore.tsx` widget
2. Create `YtCashflowChart.tsx` widget
3. Create `LpApyBreakdown.tsx` widget
4. Integrate into PortfolioPage
5. **Test:** Position P&L calculations

### Step 5: Advanced Analytics
1. Create `DepthCurve.tsx` widget
2. Create `LiquidityHealthScore.tsx` widget
3. Add to market-level analytics
4. **Test:** Depth simulation accuracy

### Step 6: Cleanup & Polish
1. Remove redundant components if any
2. Consolidate duplicate formatting functions
3. Add loading/error states to all new components
4. Performance optimization (memoization, lazy loading)
5. **Test:** Full regression testing

---

## API Response Types

### `/api/analytics/yield-curve`
```typescript
interface YieldCurveResponse {
  markets: Array<{
    address: string;
    underlyingSymbol: string;
    expiry: number;
    timeToExpiryYears: number;
    impliedApyPercent: number;
    ptPriceInSy: number;
    tvlSy: string; // WAD
  }>;
  historicalCurves?: {
    date: string;
    markets: Array<{ address: string; impliedApyPercent: number }>;
  }[];
}
```

### `/api/analytics/implied-vs-realized`
```typescript
interface ImpliedVsRealizedResponse {
  market: string;
  dataPoints: Array<{
    date: string;
    impliedApyPercent: number;
    realizedApyPercent: number;
    spreadPercent: number;
  }>;
  summary: {
    avgImplied: number;
    avgRealized: number;
    avgSpread: number;
  };
}
```

### `/api/analytics/execution-quality`
```typescript
interface ExecutionQualityResponse {
  market: string;
  period: { start: string; end: string };
  summary: {
    totalSwaps: number;
    impactMedianBps: number;
    impactP95Bps: number;
    avgTradeSize: string; // WAD
  };
  distribution: Array<{
    impactBps: number;
    count: number;
  }>;
  timeSeries: Array<{
    date: string;
    impactMedianBps: number;
    impactP95Bps: number;
    swapCount: number;
  }>;
}
```

---

## Testing Strategy

### Unit Tests
- WAD math functions for APY/PT price calculations
- Rate conversion: ln-rate to APY
- Impact calculation accuracy

### Integration Tests
- API routes return correct structure
- Data transformations match expected values
- Edge cases: expired markets, zero liquidity

### E2E Tests
- Charts render with real indexer data
- Interactions (period selection, view toggles)
- Responsive layout

---

## Migration Notes

### Backward Compatibility
- All existing API routes remain unchanged
- Existing widgets exported from same paths
- No database schema changes to existing tables/views

### Deprecation Path
If consolidating redundant widgets:
```typescript
// widgets/analytics/index.ts
// Mark for removal in v2.1
/** @deprecated Use ProtocolStatsCompact instead */
export { ProtocolStats } from './ProtocolStats';
```

---

## Success Metrics

1. **Yield Curve Adoption:** Users view yield curve chart on analytics page
2. **Reduced Redundancy:** TVL mentioned once per page view
3. **PT Convergence Understanding:** Users hover/interact with par line
4. **Execution Quality Visibility:** Users check impact before large trades
5. **"Beat Implied" Engagement:** Users track their score on portfolio page

---

## Timeline (Effort, Not Calendar)

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Core Charts | 3-4 days | None |
| Phase 2: Wallet/LP | 2-3 days | Phase 1 |
| Phase 3: Advanced | 2-3 days | Phase 1 |
| Cleanup | 1 day | All phases |

**Total:** ~8-11 days of focused development

---

## Appendix: Math Reference

### APY from ln-rate (WAD)
```typescript
const WAD = 10n ** 18n;
function lnRateToApy(lnRateWad: bigint): number {
  const lnRate = Number(lnRateWad) / Number(WAD);
  return (Math.exp(lnRate) - 1) * 100; // percentage
}
```

### PT Price in SY
```typescript
const SECONDS_PER_YEAR = 31_536_000;
function ptPriceInSy(lnRateWad: bigint, timeToExpirySec: number): number {
  const lnRate = Number(lnRateWad) / Number(WAD);
  const timeToExpiryYears = timeToExpirySec / SECONDS_PER_YEAR;
  return Math.exp(-lnRate * timeToExpiryYears);
}
```

### Price Impact in Basis Points
```typescript
function impactBps(lnRateBefore: bigint, lnRateAfter: bigint): number {
  const before = Number(lnRateBefore) / Number(WAD);
  const after = Number(lnRateAfter) / Number(WAD);
  return Math.abs(after - before) * 10_000;
}
```

### Fee APR
```typescript
function feeApr(totalFeesWad: bigint, tvlWad: bigint, periodDays: number): number {
  const fees = Number(totalFeesWad) / Number(WAD);
  const tvl = Number(tvlWad) / Number(WAD);
  if (tvl === 0) return 0;
  return (fees / tvl) * (365 / periodDays) * 100;
}
```
