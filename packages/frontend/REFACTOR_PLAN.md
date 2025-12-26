# Frontend Modular Architecture Refactor Plan

This document provides a detailed, step-by-step plan to migrate from the current flat structure to a Feature-Sliced Design (FSD) architecture. The plan is organized into phases to minimize risk and allow incremental validation.

---

## Current State Analysis

### Existing Structure
```
src/
├── app/           # Next.js routes (keep as-is)
├── components/    # 13 subdirs, ~60 files (flat, global namespace)
├── hooks/         # 32 hooks (global namespace)
├── lib/           # Utilities, math, starknet (mixed concerns)
├── contexts/      # 2 contexts (global)
├── providers/     # 4 providers
└── types/         # Type definitions + generated
```

### Key Metrics
- **Total Lines of Code:** ~9,763
- **Components:** ~60 files across 13 directories
- **Hooks:** 32 files (api/: 8, root: 24)
- **Lib Files:** ~35 files across 8 directories

### Problems to Solve
1. **Global namespaces** - `components/`, `hooks/`, `contexts/` act as dumping grounds
2. **Implicit boundaries** - No enforcement of module separation
3. **Server/client mixing** - Server-only code (`lib/db`, `rate-limit`) not clearly isolated
4. **Cross-feature coupling** - Features can import any hook/component freely

---

## Target Architecture

```
src/
├── app/                    # Routing only (thin)
├── page-compositions/                  # Route page compositions (NEW)
├── widgets/                # Page sections (NEW)
├── features/               # Domain features (NEW)
├── entities/               # Domain entities (NEW)
├── shared/                 # Shared utilities (NEW)
├── providers/              # Keep (global providers)
└── types/                  # Keep (generated types)
```

### Module Hierarchy (Import Rules)
```
app → pages → widgets → features → entities → shared
       ↓         ↓          ↓          ↓          ↓
     (can import from layers to the right only)
```

---

## Phase 0: Preparation (Foundation) ✅ COMPLETED

> **Status:** Completed on 2025-12-26
> - Created 102 directories
> - Created 99 index.ts placeholder files
> - All module structures ready for Phase 1

### 0.1 Create Directory Structure ✅
Created the new module directories with index.ts files.

```bash
# Create new module directories
mkdir -p src/shared/{ui,layout,security,api,config,server,math,starknet,lib,hooks,theme}
mkdir -p src/entities/{market,position,token}/{model,ui,lib}
mkdir -p src/features/{wallet,swap,liquidity,mint,redeem,earn,tx-settings,docs,faucet,analytics}/{ui,model,api}
mkdir -p src/widgets/{markets,portfolio,analytics,shell}
mkdir -p src/page-compositions/{trade,portfolio,mint,pools,analytics,faucet}
```

### 0.2 Verify TypeScript Path Aliases ✅
The `tsconfig.json` already has the correct path aliases:
- `@shared/*` → `./src/shared/*`
- `@entities/*` → `./src/entities/*`
- `@features/*` → `./src/features/*`
- `@widgets/*` → `./src/widgets/*`

### 0.3 Verify ESLint Configuration ✅
The `eslint.config.mjs` already enforces:
- No deep imports across module boundaries
- No growth of legacy namespaces (`@/components/**`, `@/hooks/**`, `@/contexts/**`)
- Server-only imports blocked from client code

---

## Phase 1: Shared Layer (Lowest Risk) ✅ COMPLETED

> **Status:** Completed on 2025-12-26
> - Moved 15 UI primitives to `shared/ui/`
> - Moved layout components to `shared/layout/`
> - Moved security components to `shared/security/`
> - Moved server-only code to `shared/server/`
> - Moved math utilities to `shared/math/`
> - Moved generic utilities to `shared/lib/`
> - Moved config/constants to `shared/config/`
> - Moved starknet code to `shared/starknet/`
> - Moved API utilities to `shared/api/`
> - Moved generic hooks to `shared/hooks/`
> - Moved theme context to `shared/theme/`
> - All tests passing (347 tests)
> - Typecheck and lint passing

Move foundational, business-logic-free code first. These have no domain dependencies.

### 1.1 Move UI Primitives
**Source:** `components/ui/*`
**Destination:** `shared/ui/*`

| File | Action |
|------|--------|
| `Button.tsx` | Move to `shared/ui/Button.tsx` |
| `Card.tsx` | Move to `shared/ui/Card.tsx` |
| `Input.tsx` | Move to `shared/ui/Input.tsx` |
| `badge.tsx` | Move to `shared/ui/badge.tsx` |
| `dialog.tsx` | Move to `shared/ui/dialog.tsx` |
| `dropdown-menu.tsx` | Move to `shared/ui/dropdown-menu.tsx` |
| `label.tsx` | Move to `shared/ui/label.tsx` |
| `separator.tsx` | Move to `shared/ui/separator.tsx` |
| `Skeleton.tsx` | Move to `shared/ui/Skeleton.tsx` |
| `sonner.tsx` | Move to `shared/ui/sonner.tsx` |
| `switch.tsx` | Move to `shared/ui/switch.tsx` |
| `tabs.tsx` | Move to `shared/ui/tabs.tsx` |
| `toggle-group.tsx` | Move to `shared/ui/toggle-group.tsx` |
| `toggle.tsx` | Move to `shared/ui/toggle.tsx` |

**Create:** `shared/ui/index.ts` with all exports

### 1.2 Move Layout Components
**Source:** `components/layout/*` + mode components
**Destination:** `shared/layout/*`

| File | Action |
|------|--------|
| `Header.tsx` | Move to `shared/layout/Header.tsx` |
| `Footer.tsx` | Move to `shared/layout/Footer.tsx` |
| `mode-toggle.tsx` | Move to `shared/layout/mode-toggle.tsx` |
| `mode-transition.tsx` | Move to `shared/layout/mode-transition.tsx` |
| `theme-toggle.tsx` | Move to `shared/layout/theme-toggle.tsx` |

**Create:** `shared/layout/index.ts` with all exports

### 1.3 Move Security Components
**Source:** `components/security/*`
**Destination:** `shared/security/*`

| File | Action |
|------|--------|
| `index.ts` | Move to `shared/security/index.ts` |
| `NonceProvider.tsx` | Move to `shared/security/NonceProvider.tsx` |
| `SecureScript.tsx` | Move to `shared/security/SecureScript.tsx` |

### 1.4 Move Server-Only Code
**Source:** `lib/db/*`, `lib/rate-limit.ts`, `lib/validations/*`, `lib/logger.ts`, `lib/cache.ts`, `lib/csp.ts`
**Destination:** `shared/server/*`

| File | Action |
|------|--------|
| `lib/db/*` | Move to `shared/server/db/*` |
| `lib/rate-limit.ts` | Move to `shared/server/rate-limit.ts` |
| `lib/rate-limit.test.ts` | Move to `shared/server/rate-limit.test.ts` |
| `lib/validations/*` | Move to `shared/server/validations/*` |
| `lib/logger.ts` | Move to `shared/server/logger.ts` |
| `lib/cache.ts` | Move to `shared/server/cache.ts` |
| `lib/csp.ts` | Move to `shared/server/csp.ts` |

**Create:** `shared/server/index.ts`

### 1.5 Move Math Utilities
**Source:** `lib/math/*`
**Destination:** `shared/math/*`

| File | Action |
|------|--------|
| `wad.ts` | Move to `shared/math/wad.ts` |
| `wad.test.ts` | Move to `shared/math/wad.test.ts` |
| `fp.ts` | Move to `shared/math/fp.ts` |
| `amm.ts` | Move to `shared/math/amm.ts` |
| `amm.test.ts` | Move to `shared/math/amm.test.ts` |
| `yield.ts` | Move to `shared/math/yield.ts` |
| `apy-breakdown.ts` | Move to `shared/math/apy-breakdown.ts` |

**Create:** `shared/math/index.ts`

### 1.6 Move Generic Utilities
**Source:** `lib/utils.ts`, `lib/errors.ts`, `lib/deadline.ts`
**Destination:** `shared/lib/*`

| File | Action |
|------|--------|
| `lib/utils.ts` | Move to `shared/lib/utils.ts` |
| `lib/errors.ts` | Move to `shared/lib/errors.ts` |
| `lib/errors.test.ts` | Move to `shared/lib/errors.test.ts` |
| `lib/deadline.ts` | Move to `shared/lib/deadline.ts` |
| `lib/deadline.test.ts` | Move to `shared/lib/deadline.test.ts` |
| `lib/polyfills/*` | Move to `shared/lib/polyfills/*` |

**Create:** `shared/lib/index.ts`

### 1.7 Move Config/Constants
**Source:** `lib/constants/*`
**Destination:** `shared/config/*`

| File | Action |
|------|--------|
| `addresses.ts` | Move to `shared/config/addresses.ts` |
| `index.ts` | Move to `shared/config/index.ts` |

### 1.8 Move Low-Level Starknet Code
**Source:** `lib/starknet/*`
**Destination:** `shared/starknet/*`

| File | Action |
|------|--------|
| `provider.ts` | Move to `shared/starknet/provider.ts` |
| `contracts.ts` | Move to `shared/starknet/contracts.ts` |
| `wallet.ts` | Move to `shared/starknet/wallet.ts` |

**Create:** `shared/starknet/index.ts`

### 1.9 Move Generic API Utilities
**Source:** `hooks/api/fetcher.ts`, `hooks/api/types.ts`
**Destination:** `shared/api/*`

| File | Action |
|------|--------|
| `fetcher.ts` | Move to `shared/api/fetcher.ts` |
| `types.ts` | Move to `shared/api/types.ts` |

**Create:** `shared/api/index.ts`

### 1.10 Move Generic Hooks
**Source:** Generic hooks from `hooks/`
**Destination:** `shared/hooks/*`

| File | Action |
|------|--------|
| `useToast.ts` | Move to `shared/hooks/useToast.ts` |
| `useTransaction.ts` | Move to `shared/hooks/useTransaction.ts` |

**Create:** `shared/hooks/index.ts`

### 1.11 Move Theme Context
**Source:** `contexts/ui-mode-context.tsx`
**Destination:** `shared/theme/*`

| File | Action |
|------|--------|
| `ui-mode-context.tsx` | Move to `shared/theme/ui-mode-context.tsx` |

**Create:** `shared/theme/index.ts`

### 1.12 Create Shared Index
**Create:** `shared/index.ts` as the public API for the shared layer

```typescript
// shared/index.ts
export * from './ui';
export * from './layout';
export * from './security';
export * from './math';
export * from './lib';
export * from './config';
export * from './starknet';
export * from './api';
export * from './hooks';
export * from './theme';
// Note: server/* is intentionally NOT exported (server-only)
```

### Phase 1 Verification
```bash
bun run typecheck
bun run lint
bun run test
```

---

## Phase 2: Entities Layer

> **Status: COMPLETE** ✅
> - Moved Market entity (types, UI components) to `entities/market/`
> - Moved Position entity (types, UI components) to `entities/position/`
> - Moved Token entity (TokenAmount, ApyDisplay) to `entities/token/`
> - Created entity barrel exports (index.ts files)
> - Updated all imports across the codebase
> - All 347 tests passing
> - Typecheck, lint, and build passing

Move domain concepts that are reused across features.

### 2.1 Market Entity
**Destination:** `entities/market/`

```
entities/market/
├── model/
│   ├── types.ts          # Market types (from types/market.ts)
│   └── index.ts
├── ui/
│   ├── MarketCard.tsx    # From components/markets/
│   ├── MarketList.tsx
│   ├── SimpleMarketCard.tsx
│   ├── SimpleMarketList.tsx
│   ├── StatsOverview.tsx
│   └── index.ts
├── lib/
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `types/market.ts` | `entities/market/model/types.ts` |
| `components/markets/MarketCard.tsx` | `entities/market/ui/MarketCard.tsx` |
| `components/markets/MarketList.tsx` | `entities/market/ui/MarketList.tsx` |
| `components/markets/SimpleMarketCard.tsx` | `entities/market/ui/SimpleMarketCard.tsx` |
| `components/markets/SimpleMarketList.tsx` | `entities/market/ui/SimpleMarketList.tsx` |
| `components/markets/StatsOverview.tsx` | `entities/market/ui/StatsOverview.tsx` |

### 2.2 Position Entity
**Destination:** `entities/position/`

```
entities/position/
├── model/
│   ├── types.ts          # From types/position.ts
│   └── index.ts
├── lib/
│   ├── pnl.ts            # From lib/position/pnl.ts
│   ├── value.ts          # From lib/position/value.ts
│   └── index.ts
├── ui/
│   ├── EnhancedPositionCard.tsx  # From components/portfolio/
│   ├── SummaryCard.tsx
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `types/position.ts` | `entities/position/model/types.ts` |
| `lib/position/pnl.ts` | `entities/position/lib/pnl.ts` |
| `lib/position/value.ts` | `entities/position/lib/value.ts` |
| `components/portfolio/EnhancedPositionCard.tsx` | `entities/position/ui/EnhancedPositionCard.tsx` |
| `components/portfolio/SummaryCard.tsx` | `entities/position/ui/SummaryCard.tsx` |

### 2.3 Token Entity
**Destination:** `entities/token/`

```
entities/token/
├── model/
│   ├── types.ts          # Token-related types
│   └── index.ts
├── ui/
│   ├── TokenAmount.tsx   # From components/display/
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `types/apy.ts` | `entities/token/model/types.ts` (APY types) |
| `components/display/TokenAmount.tsx` | `entities/token/ui/TokenAmount.tsx` |

### Phase 2 Verification
```bash
bun run typecheck
bun run lint
bun run test
```

---

## Phase 3: Features Layer

> **Status: COMPLETE** ✅
> - Moved 14 features: wallet, swap, liquidity, mint, redeem, earn, tx-settings, markets, portfolio, yield, analytics, price, protocol-status, docs
> - Updated all feature index files with proper exports
> - Fixed all import paths across the codebase
> - Maintained backwards compatibility via hooks/api/index.ts re-exports
> - All 347 tests passing
> - Typecheck, lint, and build passing

Move domain-specific flows and behaviors.

### 3.1 Wallet Feature
**Destination:** `features/wallet/`

```
features/wallet/
├── model/
│   ├── useAccount.ts
│   ├── useStarknet.ts
│   ├── useContracts.ts
│   └── index.ts
├── ui/
│   ├── ConnectButton.tsx
│   ├── DisclaimerDialog.tsx
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `hooks/useAccount.ts` | `features/wallet/model/useAccount.ts` |
| `hooks/useStarknet.ts` | `features/wallet/model/useStarknet.ts` |
| `hooks/useContracts.ts` | `features/wallet/model/useContracts.ts` |
| `components/wallet/ConnectButton.tsx` | `features/wallet/ui/ConnectButton.tsx` |
| `components/wallet/DisclaimerDialog.tsx` | `features/wallet/ui/DisclaimerDialog.tsx` |

### 3.2 Swap Feature
**Destination:** `features/swap/`

```
features/swap/
├── model/
│   ├── useSwap.ts
│   ├── useSwap.test.ts
│   └── index.ts
├── ui/
│   ├── SwapForm.tsx
│   ├── SwapForm.test.ts
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `hooks/useSwap.ts` | `features/swap/model/useSwap.ts` |
| `hooks/useSwap.test.ts` | `features/swap/model/useSwap.test.ts` |
| `components/forms/SwapForm.tsx` | `features/swap/ui/SwapForm.tsx` |
| `components/forms/SwapForm.test.ts` | `features/swap/ui/SwapForm.test.ts` |

### 3.3 Liquidity Feature
**Destination:** `features/liquidity/`

```
features/liquidity/
├── model/
│   ├── useLiquidity.ts
│   └── index.ts
├── ui/
│   ├── AddLiquidityForm.tsx
│   ├── RemoveLiquidityForm.tsx
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `hooks/useLiquidity.ts` | `features/liquidity/model/useLiquidity.ts` |
| `components/forms/AddLiquidityForm.tsx` | `features/liquidity/ui/AddLiquidityForm.tsx` |
| `components/forms/RemoveLiquidityForm.tsx` | `features/liquidity/ui/RemoveLiquidityForm.tsx` |

### 3.4 Mint Feature
**Destination:** `features/mint/`

```
features/mint/
├── model/
│   ├── useMint.ts
│   ├── useMint.test.ts
│   └── index.ts
├── ui/
│   ├── MintForm.tsx
│   ├── MintForm.test.ts
│   ├── TokenInput.tsx
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `hooks/useMint.ts` | `features/mint/model/useMint.ts` |
| `hooks/useMint.test.ts` | `features/mint/model/useMint.test.ts` |
| `components/forms/MintForm.tsx` | `features/mint/ui/MintForm.tsx` |
| `components/forms/MintForm.test.ts` | `features/mint/ui/MintForm.test.ts` |
| `components/forms/TokenInput.tsx` | `features/mint/ui/TokenInput.tsx` |

### 3.5 Redeem Feature
**Destination:** `features/redeem/`

```
features/redeem/
├── model/
│   ├── useRedeem.ts
│   ├── useUnwrapSy.ts
│   └── index.ts
├── ui/
│   ├── UnwrapSyForm.tsx
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `hooks/useRedeem.ts` | `features/redeem/model/useRedeem.ts` |
| `hooks/useUnwrapSy.ts` | `features/redeem/model/useUnwrapSy.ts` |
| `components/forms/UnwrapSyForm.tsx` | `features/redeem/ui/UnwrapSyForm.tsx` |

### 3.6 Earn Feature (Simple Mode)
**Destination:** `features/earn/`

```
features/earn/
├── model/
│   ├── useSimpleDeposit.ts
│   ├── useSimpleWithdraw.ts
│   ├── useWrapToSy.ts
│   └── index.ts
├── ui/
│   ├── SimpleEarnForm.tsx
│   ├── SimpleWithdrawForm.tsx
│   ├── WrapToSyForm.tsx
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `hooks/useSimpleDeposit.ts` | `features/earn/model/useSimpleDeposit.ts` |
| `hooks/useSimpleWithdraw.ts` | `features/earn/model/useSimpleWithdraw.ts` |
| `hooks/useWrapToSy.ts` | `features/earn/model/useWrapToSy.ts` |
| `components/forms/SimpleEarnForm.tsx` | `features/earn/ui/SimpleEarnForm.tsx` |
| `components/forms/SimpleWithdrawForm.tsx` | `features/earn/ui/SimpleWithdrawForm.tsx` |
| `components/forms/WrapToSyForm.tsx` | `features/earn/ui/WrapToSyForm.tsx` |

### 3.7 Transaction Settings Feature
**Destination:** `features/tx-settings/`

```
features/tx-settings/
├── model/
│   ├── context.tsx
│   └── index.ts
├── ui/
│   ├── TransactionSettingsPanel.tsx
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `contexts/transaction-settings-context.tsx` | `features/tx-settings/model/context.tsx` |
| `components/settings/TransactionSettingsPanel.tsx` | `features/tx-settings/ui/TransactionSettingsPanel.tsx` |

### 3.8 Markets Feature (Data Fetching)
**Destination:** `features/markets/`

```
features/markets/
├── model/
│   ├── useMarkets.ts
│   ├── useMarkets.test.ts
│   ├── useMarket.ts
│   ├── useMarketRates.ts
│   └── index.ts
├── api/
│   ├── useIndexedMarkets.ts
│   ├── useMarketHistory.ts
│   ├── queryKeys.ts
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `hooks/useMarkets.ts` | `features/markets/model/useMarkets.ts` |
| `hooks/useMarkets.test.ts` | `features/markets/model/useMarkets.test.ts` |
| `hooks/useMarket.ts` | `features/markets/model/useMarket.ts` |
| `hooks/useMarketRates.ts` | `features/markets/model/useMarketRates.ts` |
| `hooks/api/useIndexedMarkets.ts` | `features/markets/api/useIndexedMarkets.ts` |
| `hooks/api/useMarketHistory.ts` | `features/markets/api/useMarketHistory.ts` |

### 3.9 Portfolio Feature
**Destination:** `features/portfolio/`

```
features/portfolio/
├── model/
│   ├── usePositions.ts
│   ├── useEnhancedPositions.ts
│   ├── useTokenBalance.ts
│   ├── useTokenBalance.test.ts
│   └── index.ts
├── api/
│   ├── useUserData.ts
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `hooks/usePositions.ts` | `features/portfolio/model/usePositions.ts` |
| `hooks/useEnhancedPositions.ts` | `features/portfolio/model/useEnhancedPositions.ts` |
| `hooks/useTokenBalance.ts` | `features/portfolio/model/useTokenBalance.ts` |
| `hooks/useTokenBalance.test.ts` | `features/portfolio/model/useTokenBalance.test.ts` |
| `hooks/api/useUserData.ts` | `features/portfolio/api/useUserData.ts` |

### 3.10 Yield Feature
**Destination:** `features/yield/`

```
features/yield/
├── model/
│   ├── useYield.ts
│   ├── useUserYield.ts
│   ├── useApyBreakdown.ts
│   ├── useUnderlying.ts
│   └── index.ts
├── ui/
│   ├── ApyBreakdown.tsx
│   ├── ImpliedYield.tsx
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `hooks/useYield.ts` | `features/yield/model/useYield.ts` |
| `hooks/useUserYield.ts` | `features/yield/model/useUserYield.ts` |
| `hooks/useApyBreakdown.ts` | `features/yield/model/useApyBreakdown.ts` |
| `hooks/useUnderlying.ts` | `features/yield/model/useUnderlying.ts` |
| `components/display/ApyBreakdown.tsx` | `features/yield/ui/ApyBreakdown.tsx` |
| `components/display/ImpliedYield.tsx` | `features/yield/ui/ImpliedYield.tsx` |

### 3.11 Analytics Feature
**Destination:** `features/analytics/`

```
features/analytics/
├── api/
│   ├── useProtocolAnalytics.ts
│   ├── useIndexerHealth.ts
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `hooks/api/useProtocolAnalytics.ts` | `features/analytics/api/useProtocolAnalytics.ts` |
| `hooks/api/useIndexerHealth.ts` | `features/analytics/api/useIndexerHealth.ts` |

### 3.12 Price Feature
**Destination:** `features/price/`

```
features/price/
├── model/
│   ├── usePrices.ts
│   ├── usePriceImpact.ts
│   └── index.ts
├── ui/
│   ├── PriceImpactWarning.tsx
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `hooks/usePrices.ts` | `features/price/model/usePrices.ts` |
| `hooks/usePriceImpact.ts` | `features/price/model/usePriceImpact.ts` |
| `components/display/PriceImpactWarning.tsx` | `features/price/ui/PriceImpactWarning.tsx` |

### 3.13 Protocol Status Feature
**Destination:** `features/protocol-status/`

```
features/protocol-status/
├── model/
│   ├── usePauseStatus.ts
│   ├── useProtocolVolume.ts
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `hooks/usePauseStatus.ts` | `features/protocol-status/model/usePauseStatus.ts` |
| `hooks/useProtocolVolume.ts` | `features/protocol-status/model/useProtocolVolume.ts` |

### 3.14 Docs Feature
**Destination:** `features/docs/`

```
features/docs/
├── ui/
│   ├── Callout.tsx
│   ├── CodeBlock.tsx
│   ├── DocsLayout.tsx
│   ├── DocsNavigation.tsx
│   ├── DocsSearch.tsx
│   ├── DocsSidebar.tsx
│   ├── Formula.tsx
│   ├── PriceSimulator.tsx
│   ├── Steps.tsx
│   ├── Table.tsx
│   ├── TableOfContents.tsx
│   ├── TryItButton.tsx
│   ├── VersionBadge.tsx
│   ├── YieldCalculator.tsx
│   └── index.ts
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `components/docs/*` | `features/docs/ui/*` |

### Phase 3 Verification
```bash
bun run typecheck
bun run lint
bun run test
```

---

## Phase 4: Widgets Layer ✅ COMPLETED

> **Status:** Completed on 2025-12-26
> - Moved 10 portfolio widgets to `widgets/portfolio/`
> - Moved 16 analytics widgets to `widgets/analytics/`
> - Moved ErrorBoundary to `widgets/shell/`
> - Moved TxStatus/ExpiryCountdown to `widgets/display/`
> - Created proper barrel exports for all widget modules
> - Maintained backwards compatibility via re-exports
> - All 347 tests passing
> - Typecheck, lint, and build passing

Move page sections that compose features and entities.

### 4.1 Portfolio Widget
**Destination:** `widgets/portfolio/`

```
widgets/portfolio/
├── ImpermanentLossCalc.tsx
├── LpEntryExitTable.tsx
├── LpPnlCard.tsx
├── PnlBreakdown.tsx
├── PortfolioValueChart.tsx
├── PositionValueHistory.tsx
├── SimplePortfolio.tsx
├── YieldByPosition.tsx
├── YieldEarnedCard.tsx
├── YieldHistory.tsx
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `components/portfolio/ImpermanentLossCalc.tsx` | `widgets/portfolio/ImpermanentLossCalc.tsx` |
| `components/portfolio/LpEntryExitTable.tsx` | `widgets/portfolio/LpEntryExitTable.tsx` |
| `components/portfolio/LpPnlCard.tsx` | `widgets/portfolio/LpPnlCard.tsx` |
| `components/portfolio/PnlBreakdown.tsx` | `widgets/portfolio/PnlBreakdown.tsx` |
| `components/portfolio/PortfolioValueChart.tsx` | `widgets/portfolio/PortfolioValueChart.tsx` |
| `components/portfolio/PositionValueHistory.tsx` | `widgets/portfolio/PositionValueHistory.tsx` |
| `components/portfolio/SimplePortfolio.tsx` | `widgets/portfolio/SimplePortfolio.tsx` |
| `components/portfolio/YieldByPosition.tsx` | `widgets/portfolio/YieldByPosition.tsx` |
| `components/portfolio/YieldEarnedCard.tsx` | `widgets/portfolio/YieldEarnedCard.tsx` |
| `components/portfolio/YieldHistory.tsx` | `widgets/portfolio/YieldHistory.tsx` |

### 4.2 Analytics Widget
**Destination:** `widgets/analytics/`

```
widgets/analytics/
├── FeeByMarket.tsx
├── FeeCollectionLog.tsx
├── FeeRevenueChart.tsx
├── ImpliedRateChart.tsx
├── IndexerStatusBanner.tsx
├── ProtocolStats.tsx
├── ProtocolTvlCard.tsx
├── RateHistoryTable.tsx
├── RateSparkline.tsx
├── SwapHistoryTable.tsx
├── TransactionHistory.tsx
├── TvlBreakdown.tsx
├── TvlChart.tsx
├── VolumeByMarket.tsx
├── VolumeChart.tsx
├── VolumeStatsCard.tsx
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `components/analytics/*` | `widgets/analytics/*` |

### 4.3 Shell Widget (App Chrome)
**Destination:** `widgets/shell/`

```
widgets/shell/
├── ErrorBoundary.tsx
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `components/ErrorBoundary.tsx` | `widgets/shell/ErrorBoundary.tsx` |

### 4.4 Display Widget (Shared Display)
**Destination:** `widgets/display/`

```
widgets/display/
├── ExpiryCountdown.tsx
├── TxStatus.tsx
└── index.ts
```

| Source | Destination |
|--------|-------------|
| `components/display/ExpiryCountdown.tsx` | `widgets/display/ExpiryCountdown.tsx` |
| `components/display/TxStatus.tsx` | `widgets/display/TxStatus.tsx` |

### Phase 4 Verification
```bash
bun run typecheck
bun run lint
bun run test
```

---

## Phase 5: Pages Layer ✅ COMPLETED

> **Status:** Completed on 2025-12-26
> - Created TradePage composition in `page-compositions/trade/`
> - Created PortfolioPage composition in `page-compositions/portfolio/`
> - Created MintPage composition in `page-compositions/mint/`
> - Created PoolsPage composition in `page-compositions/pools/`
> - Created AnalyticsPage composition in `page-compositions/analytics/`
> - Created FaucetPage composition in `page-compositions/faucet/`
> - Updated app routes to use thin wrappers
> - All 347 tests passing
> - Typecheck, lint, and build passing

Create thin page compositions.

### 5.1 Trade Page
**Destination:** `page-compositions/trade/TradePage.tsx`

Extract route logic from `app/trade/page.tsx` into a composable page component.

### 5.2 Portfolio Page
**Destination:** `page-compositions/portfolio/PortfolioPage.tsx`

Extract route logic from `app/portfolio/page.tsx` into a composable page component.

### 5.3 Mint Page
**Destination:** `page-compositions/mint/MintPage.tsx`

Extract route logic from `app/mint/page.tsx` into a composable page component.

### 5.4 Pools Page
**Destination:** `page-compositions/pools/PoolsPage.tsx`

Extract route logic from `app/pools/page.tsx` into a composable page component.

### 5.5 Analytics Page
**Destination:** `page-compositions/analytics/AnalyticsPage.tsx`

Extract route logic from `app/analytics/page.tsx` into a composable page component.

### 5.6 Faucet Page
**Destination:** `page-compositions/faucet/FaucetPage.tsx`

Extract route logic from `app/faucet/page.tsx` into a composable page component.

### Phase 5 Verification
```bash
bun run typecheck
bun run lint
bun run test
```

---

## Phase 6: Cleanup

### 6.1 Delete Empty Legacy Directories
After all moves are complete and verified:

```bash
# Remove empty legacy directories
rm -rf src/components/
rm -rf src/hooks/
rm -rf src/contexts/
rm -rf src/lib/ (if completely migrated)
```

### 6.2 Update Import Statements
Run a codemod or manually update all import statements to use new paths:

```typescript
// Before
import { Button } from '@/components/ui/Button';
import { useSwap } from '@/hooks/useSwap';

// After
import { Button } from '@shared/ui';
import { useSwap } from '@features/swap';
```

### 6.3 Update ESLint Configuration
Remove legacy namespace restrictions once migration is complete.

### 6.4 Extract Query Keys
Distribute `lib/query-keys.ts` into feature-specific query key files:

| Keys | Destination |
|------|-------------|
| `MARKETS_QUERY_KEY`, `MARKET_RATES_KEY` | `features/markets/api/queryKeys.ts` |
| `POSITIONS_KEY`, `BALANCES_KEY` | `features/portfolio/api/queryKeys.ts` |
| etc. | Respective feature query keys |

Keep `shared/query/index.ts` for generic query helpers.

### 6.5 Update Transaction Builder
Move and split `lib/transaction-builder.ts`:
- Generic builder utilities → `shared/starknet/transaction.ts`
- Feature-specific builders → Respective feature `model/` directories

---

## Phase 7: Final Verification

### 7.1 Full Test Suite
```bash
bun run check          # typecheck + lint + format
bun run test           # all tests
bun run build          # production build
```

### 7.2 Manual Testing
1. Test all routes load correctly
2. Test all forms submit correctly
3. Test wallet connection
4. Test transaction flows

### 7.3 Update Documentation
Update `CLAUDE.md` with new architecture documentation.

---

## Migration Order Summary

1. **Phase 0**: Create directory structure (no code changes)
2. **Phase 1**: `shared/*` - UI, layout, security, server, math, lib, config, starknet, api, hooks
3. **Phase 2**: `entities/*` - market, position, token
4. **Phase 3**: `features/*` - wallet, swap, liquidity, mint, redeem, earn, tx-settings, markets, portfolio, yield, analytics, price, protocol-status, docs
5. **Phase 4**: `widgets/*` - portfolio, analytics, shell, display
6. **Phase 5**: `page-compositions/*` - trade, portfolio, mint, pools, analytics, faucet
7. **Phase 6**: Cleanup legacy directories, update imports
8. **Phase 7**: Final verification

---

## Risk Mitigation

### Incremental Migration
- Each phase is independently verifiable
- Run tests after each phase
- Commit after each successful phase

### Backward Compatibility
During migration, the ESLint rule for legacy imports is already warning-level.
Legacy code continues to work while new code uses new paths.

### Rollback Strategy
Each phase commit is a safe rollback point if issues arise.

---

## Time Estimates

| Phase | Complexity | Estimated Effort |
|-------|------------|------------------|
| Phase 0 | Low | Directory creation only |
| Phase 1 | Low | ~15-20 file moves + index files |
| Phase 2 | Medium | ~15 file moves, some refactoring |
| Phase 3 | High | ~40 file moves, significant refactoring |
| Phase 4 | Medium | ~20 file moves |
| Phase 5 | Medium | Logic extraction from app pages |
| Phase 6 | Low | Cleanup and import updates |
| Phase 7 | Low | Verification only |

---

## Appendix: Full File Mapping

### Components (60 files)
| Current Location | New Location |
|------------------|--------------|
| `components/ui/*` (15 files) | `shared/ui/*` |
| `components/layout/*` (2 files) | `shared/layout/*` |
| `components/security/*` (3 files) | `shared/security/*` |
| `components/mode-toggle.tsx` | `shared/layout/` |
| `components/mode-transition.tsx` | `shared/layout/` |
| `components/theme-toggle.tsx` | `shared/layout/` |
| `components/ErrorBoundary.tsx` | `widgets/shell/` |
| `components/markets/*` (5 files) | `entities/market/ui/*` |
| `components/portfolio/*` (12 files) | `entities/position/ui/*` + `widgets/portfolio/*` |
| `components/wallet/*` (2 files) | `features/wallet/ui/*` |
| `components/forms/*` (11 files) | Various `features/*/ui/*` |
| `components/display/*` (6 files) | Various `features/*/ui/*` + `widgets/display/*` |
| `components/analytics/*` (17 files) | `widgets/analytics/*` |
| `components/docs/*` (15 files) | `features/docs/ui/*` |
| `components/settings/*` (1 file) | `features/tx-settings/ui/*` |

### Hooks (32 files)
| Current Location | New Location |
|------------------|--------------|
| `hooks/api/fetcher.ts` | `shared/api/` |
| `hooks/api/types.ts` | `shared/api/` |
| `hooks/api/index.ts` | Delete (re-export) |
| `hooks/api/useIndexedMarkets.ts` | `features/markets/api/` |
| `hooks/api/useIndexerHealth.ts` | `features/analytics/api/` |
| `hooks/api/useMarketHistory.ts` | `features/markets/api/` |
| `hooks/api/useProtocolAnalytics.ts` | `features/analytics/api/` |
| `hooks/api/useUserData.ts` | `features/portfolio/api/` |
| `hooks/useAccount.ts` | `features/wallet/model/` |
| `hooks/useStarknet.ts` | `features/wallet/model/` |
| `hooks/useContracts.ts` | `features/wallet/model/` |
| `hooks/useSwap.ts` | `features/swap/model/` |
| `hooks/useMint.ts` | `features/mint/model/` |
| `hooks/useLiquidity.ts` | `features/liquidity/model/` |
| `hooks/useRedeem.ts` | `features/redeem/model/` |
| `hooks/useUnwrapSy.ts` | `features/redeem/model/` |
| `hooks/useWrapToSy.ts` | `features/earn/model/` |
| `hooks/useSimpleDeposit.ts` | `features/earn/model/` |
| `hooks/useSimpleWithdraw.ts` | `features/earn/model/` |
| `hooks/useMarkets.ts` | `features/markets/model/` |
| `hooks/useMarket.ts` | `features/markets/model/` |
| `hooks/useMarketRates.ts` | `features/markets/model/` |
| `hooks/usePositions.ts` | `features/portfolio/model/` |
| `hooks/useEnhancedPositions.ts` | `features/portfolio/model/` |
| `hooks/useTokenBalance.ts` | `features/portfolio/model/` |
| `hooks/useYield.ts` | `features/yield/model/` |
| `hooks/useUserYield.ts` | `features/yield/model/` |
| `hooks/useApyBreakdown.ts` | `features/yield/model/` |
| `hooks/useUnderlying.ts` | `features/yield/model/` |
| `hooks/usePrices.ts` | `features/price/model/` |
| `hooks/usePriceImpact.ts` | `features/price/model/` |
| `hooks/usePauseStatus.ts` | `features/protocol-status/model/` |
| `hooks/useProtocolVolume.ts` | `features/protocol-status/model/` |
| `hooks/useToast.ts` | `shared/hooks/` |
| `hooks/useTransaction.ts` | `shared/hooks/` |

### Lib (35+ files)
| Current Location | New Location |
|------------------|--------------|
| `lib/math/*` | `shared/math/*` |
| `lib/position/*` | `entities/position/lib/*` |
| `lib/starknet/*` | `shared/starknet/*` |
| `lib/constants/*` | `shared/config/*` |
| `lib/db/*` | `shared/server/db/*` |
| `lib/validations/*` | `shared/server/validations/*` |
| `lib/rate-limit.ts` | `shared/server/` |
| `lib/logger.ts` | `shared/server/` |
| `lib/cache.ts` | `shared/server/` |
| `lib/csp.ts` | `shared/server/` |
| `lib/utils.ts` | `shared/lib/` |
| `lib/errors.ts` | `shared/lib/` |
| `lib/deadline.ts` | `shared/lib/` |
| `lib/polyfills/*` | `shared/lib/polyfills/*` |
| `lib/query-keys.ts` | Distribute to features |
| `lib/transaction-builder.ts` | `shared/starknet/` + features |
| `lib/api/*` | Evaluate: shared/api or features |

### Contexts (2 files)
| Current Location | New Location |
|------------------|--------------|
| `contexts/transaction-settings-context.tsx` | `features/tx-settings/model/` |
| `contexts/ui-mode-context.tsx` | `shared/theme/` |

### Types (4 files)
| Current Location | New Location |
|------------------|--------------|
| `types/market.ts` | `entities/market/model/types.ts` |
| `types/position.ts` | `entities/position/model/types.ts` |
| `types/apy.ts` | `entities/token/model/types.ts` |
| `types/generated/*` | Keep or move to `shared/starknet/generated/` |
