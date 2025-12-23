# Analytics UI Implementation Plan

This document outlines the implementation plan for integrating indexed data into the Horizon Protocol frontend, ordered by impact (high to low).

## Overview

The indexer captures rich on-chain data that can power advanced analytics features. This plan prioritizes features by user value and implementation complexity.

---

## Design System Requirements

### MANDATORY: Use shadcn/ui Components

All new components **MUST** use the shadcn/ui library. An MCP server is available for component discovery and installation.

**MCP Configuration** (`.mcp.json`):
```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```

**Installing new shadcn components:**
```bash
bunx --bun shadcn@latest add [component-name]
```

**Available shadcn components in project:**
- `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`
- `Badge`
- `Button`
- `Input`, `Label`
- `Skeleton`, `SkeletonCard`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Dialog`
- `DropdownMenu`
- `Switch`, `Toggle`, `ToggleGroup`
- `Separator`
- `Sonner` (toasts)

### MANDATORY: Semantic Colors Only

**DO NOT use arbitrary colors** like `text-blue-500`, `bg-green-600`, etc.

**USE semantic color tokens** that adapt to light/dark mode:

| Token | Usage |
|-------|-------|
| `bg-background` | Page background |
| `bg-card` | Card backgrounds |
| `bg-popover` | Popover/dropdown backgrounds |
| `bg-muted` | Subtle backgrounds, disabled states |
| `bg-primary` | Primary actions, highlights |
| `bg-secondary` | Secondary elements |
| `bg-accent` | Accent highlights |
| `bg-destructive` | Errors, warnings, delete actions |
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary/subtle text |
| `text-primary` | Primary colored text |
| `text-destructive` | Error text |
| `border-border` | Default borders |
| `border-input` | Input borders |

**Chart Colors (for Recharts):**
| Token | CSS Variable |
|-------|--------------|
| `chart-1` | `var(--chart-1)` - Lightest |
| `chart-2` | `var(--chart-2)` |
| `chart-3` | `var(--chart-3)` |
| `chart-4` | `var(--chart-4)` |
| `chart-5` | `var(--chart-5)` - Darkest |

**Example - Correct:**
```tsx
<div className="bg-card text-card-foreground border-border rounded-lg border p-4">
  <span className="text-muted-foreground">Label:</span>
  <span className="text-foreground font-medium">Value</span>
</div>
```

**Example - WRONG:**
```tsx
// DO NOT DO THIS
<div className="bg-gray-800 text-white border-gray-600">
  <span className="text-gray-400">Label:</span>
  <span className="text-blue-500">Value</span>
</div>
```

### Status Colors Pattern

For status indicators (success, warning, error), use opacity variants of semantic colors:

```tsx
// Success (use primary with opacity)
<div className="bg-primary/10 text-primary">Success</div>

// Warning (use chart colors or muted)
<div className="bg-chart-1/10 text-chart-1">Warning</div>

// Error
<div className="bg-destructive/10 text-destructive">Error</div>

// Neutral/Info
<div className="bg-muted text-muted-foreground">Info</div>
```

### Component Structure Pattern

All analytics components should follow this structure:

```tsx
'use client';

import { type ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  className?: string;
}

export function MyComponent({ className }: MyComponentProps): ReactNode {
  // Use hooks for data
  const { data, isLoading, isError } = useMyHook();

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="py-8 text-center">
          <p className="text-destructive text-sm">Failed to load data</p>
        </CardContent>
      </Card>
    );
  }

  // Success state
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Content */}
      </CardContent>
    </Card>
  );
}
```

---

## Phase 1: High Impact - Core User Experience

### 1.1 Indexer Status Banner (Global)
**Impact:** Critical - Users need to know if data is stale
**Effort:** Low (already built)
**Location:** `src/app/layout.tsx`

```tsx
// Add to RootLayout, above {children}
import { IndexerStatusBanner } from '@/components/analytics';

<IndexerStatusBanner showOnlyIssues={true} className="mx-4 mt-2" />
```

**What it shows:**
- Warning when indexer is >5 minutes behind
- Error when indexer is offline
- Nothing when healthy (non-intrusive)

---

### 1.2 Protocol Stats Dashboard
**Impact:** High - First thing users see
**Effort:** Low (already built)
**Location:** `src/app/page.tsx` (home page)

```tsx
import { ProtocolStats } from '@/components/analytics';

// Replace or enhance StatsOverview with:
<ProtocolStats className="mb-8" />
```

**Metrics displayed:**
- Total TVL (from `market_current_state`)
- 24h Volume (from `protocol_daily_stats`)
- 24h Fees (from `protocol_daily_stats`)
- 24h Swaps count
- Unique traders (24h)
- Active markets count

---

### 1.3 Transaction History (Portfolio)
**Impact:** High - Users need to see their activity
**Effort:** Low (already built)
**Location:** `src/app/portfolio/page.tsx`

```tsx
import { TransactionHistory } from '@/components/analytics';

// Add below positions section:
<TransactionHistory className="mt-8" />
```

**Features:**
- Infinite scroll pagination
- Filter by event type (swap, mint, redeem, liquidity)
- Links to block explorer
- Relative timestamps

**Data source:** `useUserHistory()` hook → `/api/users/[address]/history`

---

### 1.4 Market Swap History (Trade Page)
**Impact:** High - Traders want to see recent activity
**Effort:** Low (already built)
**Location:** `src/app/trade/page.tsx`

```tsx
import { SwapHistoryTable } from '@/components/analytics';

// Add below swap form:
<SwapHistoryTable marketAddress={selectedMarket} className="mt-8" />
```

**Features:**
- Shows PT↔SY swaps for selected market
- Rate impact visualization (green/red)
- Trader addresses (truncated, linked)
- Infinite scroll

**Data source:** `useMarketSwaps()` hook → `/api/markets/[address]/swaps`

---

## Phase 2: High Impact - Analytics & Charts

### 2.1 TVL Charts
**Impact:** High - Key metric for protocol health
**Effort:** Medium
**Location:** New `/analytics` page + home page widget

**Components to build:**
```
src/components/analytics/
├── TvlChart.tsx           # Line chart for TVL over time
├── TvlBreakdown.tsx       # Pie chart by market
└── ProtocolTvlCard.tsx    # Summary card with sparkline
```

**Data source:**
- `useProtocolTvl()` → `/api/analytics/tvl`
- `useMarketTvlHistory()` → `/api/markets/[address]/tvl`

**Chart library:** Recharts (already in Next.js ecosystem)

```tsx
interface TvlChartProps {
  days?: number;           // 7, 30, 90, 365
  resolution?: 'hourly' | 'daily';
  marketAddress?: string;  // undefined = protocol-wide
}
```

---

### 2.2 Volume Analytics
**Impact:** High - Shows protocol activity
**Effort:** Medium
**Location:** `/analytics` page + home page widget

**Components to build:**
```
src/components/analytics/
├── VolumeChart.tsx        # Bar chart for daily volume
├── VolumeByMarket.tsx     # Stacked bar by market
└── VolumeStatsCard.tsx    # 24h/7d/30d summary
```

**Data source:** `useProtocolVolume()` → `/api/analytics/volume`

**Metrics:**
- Daily volume (SY + PT)
- Volume by market breakdown
- Swap count trends
- Unique traders over time

---

### 2.3 Yield Earned Per Position
**Impact:** High - Users want to see earnings
**Effort:** Medium
**Location:** Portfolio page, position cards

**Components to build:**
```
src/components/portfolio/
├── YieldEarnedCard.tsx    # Total yield summary
├── YieldHistory.tsx       # Claim history list
└── YieldByPosition.tsx    # Breakdown by YT position
```

**Data source:** `useUserYield()` → `/api/users/[address]/yield`

**Display:**
- Total yield claimed (all time)
- Yield by position (YT address)
- Claim history with timestamps
- Current claimable (from contract)

**Enhancement to EnhancedPositionCard:**
```tsx
// Add yield stats to position card
<div className="text-sm">
  <span className="text-muted-foreground">Yield Earned:</span>
  <span className="font-medium">{formatWad(totalYieldClaimed)} SY</span>
</div>
```

---

### 2.4 Rate/APY Charts
**Impact:** High - Core trading information
**Effort:** Medium
**Location:** Trade page, market detail

**Components to build:**
```
src/components/analytics/
├── ImpliedRateChart.tsx   # Line chart with OHLC option
├── RateHistoryTable.tsx   # Tabular rate changes
└── RateSparkline.tsx      # Mini chart for cards
```

**Data source:**
- `useMarketRateHistory()` → `/api/markets/[address]/rates`
- Resolution: `tick` (every swap) or `daily` (OHLC)

**Features:**
- Toggle between implied rate and APY view
- OHLC candles for daily view
- Overlay exchange rate
- Zoom/pan for longer timeframes

---

## Phase 3: Medium Impact - Advanced Analytics

### 3.1 LP P&L Tracking
**Impact:** Medium-High - Important for LPs
**Effort:** Medium
**Location:** Portfolio page, pools page

**Components to build:**
```
src/components/portfolio/
├── LpPnlCard.tsx          # P&L summary for LP position
├── LpEntryExitTable.tsx   # Entry/exit history
└── ImpermanentLossCalc.tsx # IL visualization
```

**Data source:** `useUserIndexedPositions()` → `/api/users/[address]/positions`

**Calculations:**
- Entry value vs current value
- Impermanent loss estimation
- Fees earned as LP
- Net P&L = Current - Entry + Fees - IL

**Fields from `user_lp_positions`:**
- `avg_entry_implied_rate`, `avg_entry_exchange_rate`
- `total_sy_deposited`, `total_pt_deposited`
- `total_sy_withdrawn`, `total_pt_withdrawn`

---

### 3.2 Price Impact Analysis
**Impact:** Medium - Helps traders understand slippage
**Effort:** Low-Medium
**Location:** Trade page, swap form

**Components to build:**
```
src/components/analytics/
├── PriceImpactChart.tsx   # Historical impact distribution
└── SlippageAnalysis.tsx   # Average slippage by size
```

**Data source:** `market_swap` table fields:
- `implied_rate_before`, `implied_rate_after`
- Calculate: `(rate_after - rate_before) / rate_before * 100`

**Enhancement to SwapForm:**
```tsx
// Show historical average impact for similar trade sizes
<div className="text-xs text-muted-foreground">
  Avg impact for this size: {avgImpact}%
</div>
```

---

### 3.3 Fee Revenue Tracking
**Impact:** Medium - Transparency for protocol
**Effort:** Low
**Location:** `/analytics` page

**Components to build:**
```
src/components/analytics/
├── FeeRevenueChart.tsx    # Daily fee revenue
├── FeeByMarket.tsx        # Breakdown by market
└── FeeCollectionLog.tsx   # Recent collections
```

**Data source:** `useProtocolFees()` → `/api/analytics/fees`

**Metrics:**
- 24h / 7d / 30d fees
- Fees by market (pie chart)
- Fee collection events (admin withdrawals)
- Average fee per swap

---

### 3.4 Portfolio Value Over Time
**Impact:** Medium - Users want to track growth
**Effort:** High
**Location:** Portfolio page

**Components to build:**
```
src/components/portfolio/
├── PortfolioValueChart.tsx  # Line chart of total value
├── PositionValueHistory.tsx # Per-position history
└── PnlBreakdown.tsx         # Realized vs unrealized
```

**Implementation approach:**
1. Query user's mint/redeem/swap events
2. Calculate position value at each event using `exchange_rate`
3. Interpolate between events for smooth chart
4. Current value from live contract data

**Complexity:** Requires client-side calculation from event history

---

## Phase 4: Lower Impact - Nice to Have

### 4.1 Leaderboards
**Impact:** Low-Medium - Gamification
**Effort:** Medium
**Location:** New `/leaderboard` page

**Components to build:**
```
src/components/analytics/
├── TraderLeaderboard.tsx   # Top traders by volume
├── LpLeaderboard.tsx       # Top LPs by TVL
└── LeaderboardCard.tsx     # Individual rank card
```

**Data source:** `user_trading_stats` materialized view

**Metrics:**
- Top traders by volume
- Top traders by swap count
- Top LPs by liquidity provided
- Most active (by transaction count)

---

### 4.2 Maturity Calendar
**Impact:** Low-Medium - Planning tool
**Effort:** Low
**Location:** Home page widget, `/markets` page

**Components to build:**
```
src/components/analytics/
├── MaturityCalendar.tsx    # Calendar view of expiries
└── ExpiryTimeline.tsx      # Timeline visualization
```

**Data source:** `market_factory_market_created` + `expiry` field

**Features:**
- Visual calendar with expiry dates
- Countdown to nearest expiry
- Filter by underlying asset

---

### 4.3 Whale Tracking
**Impact:** Low - Power user feature
**Effort:** Medium
**Location:** `/analytics` page

**Components to build:**
```
src/components/analytics/
├── WhaleActivity.tsx       # Large transactions feed
└── WhaleAlerts.tsx         # Notable movements
```

**Implementation:**
- Filter swaps/mints where amount > threshold (e.g., 10k USD)
- Show recent large transactions
- Optional: WebSocket for real-time alerts

---

### 4.4 Exchange Rate History (Oracle)
**Impact:** Low - Technical users only
**Effort:** Low
**Location:** Market detail page

**Components to build:**
```
src/components/analytics/
└── ExchangeRateChart.tsx   # Oracle rate over time
```

**Data source:** `exchange_rate_history` materialized view

**Use case:** Verify oracle is updating correctly, understand yield accrual

---

## Phase 5: Future Enhancements

### 5.1 Real-time Updates (WebSocket/SSE)
- Replace polling with real-time subscriptions
- Instant trade notifications
- Live TVL/volume counters

### 5.2 Advanced Charting
- TradingView integration
- Custom indicators
- Drawing tools

### 5.3 Export & Reporting
- CSV export of transaction history
- Tax reporting format
- Portfolio snapshots

### 5.4 Alerts & Notifications
- Price alerts
- Expiry reminders
- Large trade notifications

---

## Implementation Order Summary

| Priority | Feature | Effort | Files to Modify/Create |
|----------|---------|--------|------------------------|
| 1 | Indexer Status Banner | Low | `layout.tsx` |
| 2 | Protocol Stats | Low | `page.tsx` (home) |
| 3 | Transaction History | Low | `portfolio/page.tsx` |
| 4 | Swap History Table | Low | `trade/page.tsx` |
| 5 | TVL Charts | Medium | New components + `/analytics` page |
| 6 | Volume Analytics | Medium | New components |
| 7 | Yield Earned Display | Medium | Portfolio components |
| 8 | Rate/APY Charts | Medium | Trade page, new components |
| 9 | LP P&L Tracking | Medium | Portfolio components |
| 10 | Price Impact Analysis | Low-Med | SwapForm enhancement |
| 11 | Fee Revenue Dashboard | Low | `/analytics` page |
| 12 | Portfolio Value Chart | High | New components |
| 13 | Leaderboards | Medium | New `/leaderboard` page |
| 14 | Maturity Calendar | Low | New component |
| 15 | Whale Tracking | Medium | `/analytics` page |
| 16 | Exchange Rate History | Low | Market detail |

---

## Technical Requirements

### Dependencies to Add
```bash
bun add recharts                 # Charts
bun add date-fns                 # Date formatting
bun add @tanstack/react-virtual  # Virtual scrolling for large lists
```

### New Pages to Create
```
src/app/
├── analytics/
│   └── page.tsx              # Analytics dashboard
└── leaderboard/
    └── page.tsx              # Leaderboards
```

### Environment Variables
```bash
# Required for indexed data
DATABASE_URL=postgresql://frontend_readonly:xxx@host:port/db
```

---

## API Endpoints Reference

All endpoints are implemented in `src/app/api/`:

| Endpoint | Hook | Purpose |
|----------|------|---------|
| `/api/health` | `useIndexerHealth` | Indexer status |
| `/api/markets` | `useIndexedMarkets` | All markets with stats |
| `/api/markets/[address]` | `useIndexedMarket` | Market detail |
| `/api/markets/[address]/swaps` | `useMarketSwaps` | Swap history |
| `/api/markets/[address]/tvl` | `useMarketTvlHistory` | TVL time series |
| `/api/markets/[address]/rates` | `useMarketRateHistory` | Rate time series |
| `/api/users/[address]/history` | `useUserHistory` | Transaction history |
| `/api/users/[address]/positions` | `useUserIndexedPositions` | Aggregated positions |
| `/api/users/[address]/yield` | `useUserYield` | Yield claimed |
| `/api/analytics/tvl` | `useProtocolTvl` | Protocol TVL |
| `/api/analytics/volume` | `useProtocolVolume` | Protocol volume |
| `/api/analytics/fees` | `useProtocolFees` | Protocol fees |

---

## Next Steps

1. **Immediate (Priority 1-4):** Integrate existing components into pages
2. **Short-term (Priority 5-8):** Build chart components with Recharts
3. **Medium-term (Priority 9-12):** Advanced analytics features
4. **Long-term (Priority 13+):** Nice-to-have features

Start with `bun run dev` and verify the existing components work with the indexed data before building new ones.
