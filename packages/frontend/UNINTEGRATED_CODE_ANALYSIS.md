# Unintegrated Code Analysis

**Horizon Protocol Frontend**
*Analysis of implemented but unintegrated components, hooks, and utilities*

**Analysis Date:** 2025-12-28

---

## Executive Summary

The codebase is **very well-integrated** overall (~95% usage rate). The unused code falls into three categories:

1. **Shadcn/ui primitives** - base components available but not yet needed
2. **Analytics widget variants** - compact/inline exports for future use
3. **Utility functions** - helper exports not yet consumed

---

## Category 1: Unused Base UI Components

| Component | File | Status | Integration Opportunity |
|-----------|------|--------|-------------------------|
| **HoverCard** | `src/shared/ui/hover-card.tsx` | Exported, never imported | Use for token info tooltips on MarketCard, or APY explanations on hover |
| **Progress** | `src/shared/ui/progress.tsx` | Exported, never imported | Use for multi-step transaction progress, LP position health bars, or loading states with percentage |

### HoverCard Details

```tsx
// Currently exported from src/shared/ui/hover-card.tsx
export { HoverCard, HoverCardTrigger, HoverCardContent };
```

**Suggested Integration Points:**
- Token symbol hover → show full token details
- APY percentage hover → show APY breakdown
- Address hover → show truncated with copy button
- MarketCard metrics → contextual explanations

### Progress Details

```tsx
// Currently exported from src/shared/ui/progress.tsx
export { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue };
```

**Suggested Integration Points:**
- `TxStatus.tsx` → show transaction confirmation progress
- Portfolio loading → show sync progress with percentage
- LP position health → visual health indicator bar

---

## Category 2: Unused Analytics Widgets

These are fully implemented but NOT loaded in `AnalyticsPage.tsx`:

| Widget | File | Purpose | Integration Opportunity |
|--------|------|---------|-------------------------|
| **RateHistoryTable** | `src/widgets/analytics/RateHistoryTable.tsx` | Historical rate data in table format | Add to Analytics page "Advanced" section under yield charts |
| **RateSparkline** | `src/widgets/analytics/RateSparkline.tsx` | Compact rate trend visualization | Add to MarketCard or trade page market selector |
| **ProtocolTvlCard** | `src/widgets/analytics/ProtocolTvlCard.tsx` | Protocol-wide TVL card | Add to home page hero section or analytics header |
| **ProtocolStats** | `src/widgets/analytics/ProtocolStats.tsx` | Aggregate protocol metrics | Add to home page or analytics page header |

### RateSparkline Exports

The `RateSparkline.tsx` file exports multiple variants, none currently used:

```tsx
export {
  RateBadgeWithSparkline,  // Badge with inline sparkline
  RateSparkline,           // Standalone sparkline
  RateSparklineCard,       // Card wrapper with sparkline
  RateSparklineLarge,      // Larger sparkline for featured display
};
```

### ProtocolStats Exports

```tsx
export { ProtocolStats, ProtocolStatsCompact };
```

---

## Category 3: Compact/Inline Widget Variants

These are exported alongside their full-size counterparts but never imported elsewhere:

| Export | Source Widget | File | Potential Use |
|--------|---------------|------|---------------|
| `YieldCurveCompact` | YieldCurveChart | `YieldCurveChart.tsx` | Mobile/card view |
| `PtPriceCompact` | PtConvergenceChart | `PtConvergenceChart.tsx` | MarketCard badges |
| `SpreadIndicator` | ImpliedVsRealizedChart | `ImpliedVsRealizedChart.tsx` | Trade form context |
| `DepthIndicator` | DepthCurve | `DepthCurve.tsx` | Liquidity warnings |
| `LiquidityHealthBadge` | LiquidityHealthScore | `LiquidityHealthScore.tsx` | Pool cards |
| `ExecutionQualityBadge` | ExecutionQualityPanel | `ExecutionQualityPanel.tsx` | Trade confirmation |
| `FeeByMarketCompact` | FeeByMarket | `FeeByMarket.tsx` | Pool cards |
| `FeeCollectionInline` | FeeCollectionLog | `FeeCollectionLog.tsx` | Portfolio section |
| `ImpliedRateCompact` | ImpliedRateChart | `ImpliedRateChart.tsx` | Trade form |
| `TvlBreakdownCompact` | TvlBreakdown | `TvlBreakdown.tsx` | Dashboard cards |
| `TvlSparkline` | TvlChart | `TvlChart.tsx` | MarketCard |
| `VolumeBreakdownCompact` | VolumeByMarket | `VolumeByMarket.tsx` | Pool comparison |
| `VolumeStackedChart` | VolumeChart | `VolumeChart.tsx` | Analytics deep-dive |
| `VolumeInline` | VolumeStatsCard | `VolumeStatsCard.tsx` | Market selector |
| `RateHistoryInline` | RateHistoryTable | `RateHistoryTable.tsx` | Dashboard inline |
| `ProtocolTvlInline` | ProtocolTvlCard | `ProtocolTvlCard.tsx` | Header inline |
| `ProtocolStatsCompact` | ProtocolStats | `ProtocolStats.tsx` | Dashboard cards |

---

## Category 4: Unused Utility Functions

| Function | File | Description |
|----------|------|-------------|
| `getSlippageLabel` | `src/features/tx-settings/model/useSmartSlippage.ts` | Returns human-readable labels ("Very Low", "Low", "Standard", "High", "Very High") for slippage BPS values |

### getSlippageLabel Implementation

```typescript
// Currently exported but never imported
export function getSlippageLabel(bps: number): string {
  if (bps <= 15) return 'Very Low';
  if (bps <= 50) return 'Low';
  if (bps <= 100) return 'Standard';
  if (bps <= 200) return 'High';
  return 'Very High';
}
```

**Suggested Integration:**
- Add to `TransactionSettingsPanel.tsx` to show labels next to slippage values
- Use in trade confirmation dialogs

---

## Category 5: Verified As Integrated (No Action Needed)

### Docs Feature Components

All docs components are properly integrated via `DocsLayout.tsx` and MDX pages:

| Component | Integration Point |
|-----------|-------------------|
| `DocsLayout` | `/app/docs/layout.tsx` |
| `DocsSearch` | `DocsLayout.tsx` (sidebar + mobile) |
| `DocsSidebar` | `DocsLayout.tsx` |
| `TableOfContents` | `DocsLayout.tsx` (right sidebar) |
| `VersionBadge` | `DocsLayout.tsx` |
| `DocsNavigation` | All MDX pages |
| `Callout` | Multiple MDX pages |
| `Formula` | `mechanics/apy-calculation/page.mdx`, `mechanics/pricing/page.mdx` |
| `Table` components | Multiple MDX pages |
| `YieldCalculator` | `mechanics/apy-calculation/page.mdx` |
| `PriceSimulator` | `mechanics/pricing/page.mdx` |
| `Steps` | Guide pages |
| `TryItButton` | Getting started, guides |
| `CodeBlock` | Documentation code examples |

### Smart Slippage Hook

The `useSmartSlippage` hook IS integrated in `TransactionSettingsPanel.tsx` with full functionality including:
- Auto slippage calculation based on market volatility
- Confidence indicators (high/medium/low)
- One-click "Auto" button

---

## Recommended Integration Plan

### Priority 1: High (User-Facing Value)

#### 1.1 ProtocolStats → Home Page

**Location:** `src/app/(main)/page.tsx`

**Rationale:** Shows protocol health at a glance to new visitors.

```tsx
import { ProtocolStats } from '@widgets/analytics';

// In hero section
<ProtocolStats />
```

#### 1.2 RateSparkline → MarketCard

**Location:** `src/entities/market/ui/MarketCard.tsx`

**Rationale:** Shows rate trend in compact form, helping users identify trending markets.

```tsx
import { RateBadgeWithSparkline } from '@widgets/analytics';

// In MarketCard metric section
<RateBadgeWithSparkline marketAddress={market.address} />
```

#### 1.3 Progress → TxStatus

**Location:** `src/widgets/display/TxStatus.tsx`

**Rationale:** Multi-step transactions (approve + execute) benefit from progress indication.

```tsx
import { Progress, ProgressIndicator, ProgressTrack } from '@shared/ui/progress';

// During 'signing' or 'pending' states
{status === 'pending' && (
  <Progress value={50}>
    <ProgressTrack>
      <ProgressIndicator />
    </ProgressTrack>
  </Progress>
)}
```

#### 1.4 HoverCard → APY Displays

**Location:** `src/entities/market/ui/MarketCard.tsx`, `src/features/yield/ui/ApyBreakdown.tsx`

**Rationale:** Explain complex APY calculations on hover without cluttering UI.

```tsx
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@shared/ui/hover-card';

<HoverCard>
  <HoverCardTrigger>
    <span className="cursor-help">{formatPercent(apy)}%</span>
  </HoverCardTrigger>
  <HoverCardContent>
    <ApyBreakdown market={market} />
  </HoverCardContent>
</HoverCard>
```

### Priority 2: Medium (Enhanced Analytics)

#### 2.1 RateHistoryTable → Analytics Page

**Location:** `src/page-compositions/analytics/AnalyticsPage.tsx`

**Rationale:** Already has collapsible "Advanced" section; table complements existing charts.

```tsx
const RateHistoryTable = dynamic(
  () => import('@widgets/analytics/RateHistoryTable').then((m) => m.RateHistoryTable),
  { loading: () => <ChartSkeleton />, ssr: false }
);

// In Advanced section
<RateHistoryTable marketAddress={marketAddress} />
```

#### 2.2 ProtocolTvlCard → Analytics Header

**Location:** `src/page-compositions/analytics/AnalyticsPage.tsx`

**Rationale:** Prominent protocol-wide metrics complement per-market analytics.

```tsx
const ProtocolTvlCard = dynamic(
  () => import('@widgets/analytics/ProtocolTvlCard').then((m) => m.ProtocolTvlCard),
  { loading: () => <CardSkeleton /> }
);
```

#### 2.3 Compact Variants → Mobile Views

**Location:** Various page compositions

**Rationale:** Use compact variants for responsive mobile layouts.

```tsx
// Example in MarketCard
const isMobile = useMediaQuery('(max-width: 768px)');

{isMobile ? (
  <TvlSparkline marketAddress={market.address} />
) : (
  <TvlChart marketAddress={market.address} />
)}
```

### Priority 3: Low (Future Enhancement)

#### 3.1 getSlippageLabel → TransactionSettingsPanel

**Location:** `src/features/tx-settings/ui/TransactionSettingsPanel.tsx`

**Rationale:** Human-readable labels improve UX for slippage understanding.

```tsx
import { getSlippageLabel } from '../model/useSmartSlippage';

// Next to slippage display
<span className="text-muted-foreground text-xs">
  ({getSlippageLabel(slippageBps)})
</span>
```

---

## Metrics Summary

| Category | Count | Status |
|----------|-------|--------|
| Unused UI components | 2 | Ready for integration |
| Unused analytics widgets | 4 | Ready for integration |
| Unused compact variants | 17 | Available for mobile/responsive |
| Unused utility functions | 1 | Ready for integration |
| **Total unused exports** | **24** | ~5% of codebase |

---

## Architecture Notes

The unused code represents **intentional forward-looking architecture** rather than abandoned features:

1. **Compact variants** anticipate mobile/responsive views
2. **Inline variants** anticipate dashboard/card integrations
3. **Badge variants** anticipate status indicators in lists
4. **Utility functions** anticipate UI label needs

This pattern follows good software design principles:
- Components export all reasonable variations
- Parent components choose which variant to use
- Future features have building blocks ready

---

## File Locations Quick Reference

```
src/
├── shared/ui/
│   ├── hover-card.tsx       # UNUSED - HoverCard components
│   └── progress.tsx         # UNUSED - Progress components
├── widgets/analytics/
│   ├── RateHistoryTable.tsx # UNUSED - Full widget
│   ├── RateSparkline.tsx    # UNUSED - All 4 exports
│   ├── ProtocolTvlCard.tsx  # UNUSED - Full widget + inline
│   └── ProtocolStats.tsx    # UNUSED - Full widget + compact
└── features/tx-settings/model/
    └── useSmartSlippage.ts  # UNUSED - getSlippageLabel function
```

---

*Document generated: 2025-12-28*
