### What’s good already (keep)

* `app/` is correctly the routing surface, with route handlers under `app/api/*`.
* You already have strong “core” modules: `lib/`, `types/`, `providers/`, `components/`.
* Domain math/logic is mostly in `lib/math` and `lib/position` (good separation from UI).

Your main maintainability problem is **horizontal layering is implicit**: `components/`, `hooks/`, `contexts/`, `lib/` all act as global namespaces, so boundaries will erode as the app grows.

Below is a concrete refactor plan that preserves Next.js ergonomics but makes module boundaries explicit and enforceable.

---

## Target architecture (minimal churn, high payoff)

### 1) Keep `app/` as-is, but make it “thin”

Rule: `app/**/page.tsx` and `layout.tsx` should mostly compose “page modules”, not implement feature logic.

Create:

* `src/pages/` (or `src/widgets/` if you prefer) containing per-route page compositions.

Example mapping:

* `app/trade/page.tsx` → renders `pages/trade/TradePage`
* `app/portfolio/page.tsx` → renders `pages/portfolio/PortfolioPage`

This isolates route changes from UI/feature code.

---

## Step-by-step refactor (with file moves)

### Step A — Split `components/` into `shared/ui` vs domain modules

**Move these immediately:**

1. `components/ui/*` → `shared/ui/*`
2. `components/security/*` → `shared/security/*`
3. `components/layout/*` + `components/theme-toggle*` + mode components → `shared/layout/*` (or `widgets/shell/*`)

Then “domain UI” becomes feature/entity-owned:

* `components/forms/*` → `features/liquidity/ui/*`, `features/swap/ui/*`, `features/mint/ui/*`, `features/earn/ui/*`
* `components/portfolio/*` → `widgets/portfolio/*` (mostly page sections) or `features/portfolio/*` depending on reuse
* `components/analytics/*` → `widgets/analytics/*` (page section) + `features/analytics/*` (hooks/api)
* `components/markets/*` → `entities/market/ui/*` + `widgets/markets/*`
* `components/wallet/*` → `features/wallet/ui/*`

Heuristic:

* If a component is a *primitive* (Button, Dialog, Input) → `shared/ui`
* If it represents a *domain concept* (MarketCard, PositionCard) → `entities/*/ui`
* If it’s a *flow* (SwapForm, AddLiquidityForm) → `features/*/ui`
* If it’s a *page section* (TvlChart + cards + tables) → `widgets/*`

---

### Step B — Re-home `hooks/` into the module that owns the behavior

Right now `hooks/` is essentially “global public API”, which makes coupling inevitable.

Refactor:

* `hooks/api/*` → `features/*/api/*` (or `shared/api/*` for generic fetcher)

  * `hooks/api/fetcher.ts` → `shared/api/fetcher.ts`
  * `hooks/api/types.ts` → `shared/api/types.ts` (if generic) or `features/*/model/types.ts`

Then move each hook next to its domain:

* `useSwap.ts` → `features/swap/model/useSwap.ts` (or `features/swap/hooks/useSwap.ts`)
* `useMint.ts` → `features/mint/...`
* `useMarkets.ts`, `useMarket.ts` → `entities/market/...` (if “market domain”) or `features/markets/...` if it’s a UI flow
* `useAccount.ts`, `useStarknet.ts`, `useContracts.ts` → `features/wallet/...` (and `shared/starknet` for low-level)

Leave `shared/hooks/*` only for truly generic hooks (debounce, media query, etc.).

---

### Step C — Merge `contexts/` into feature modules

`transaction-settings-context.tsx` → `features/tx-settings/model/context.tsx` (or store)
`ui-mode-context.tsx` → `shared/theme/model/context.tsx` (or `shared/ui-mode/...`)

Rule: contexts are private implementation details of a feature unless used globally.

---

### Step D — Split `lib/` into `shared/` + `entities/` + `features/` (but keep most code in place at first)

You can do this in two passes:

**Pass 1 (low risk):** keep `lib/` but add subpackages and barrel exports.

* Introduce `shared/` while leaving `lib/` as a compatibility layer that re-exports.

**Pass 2 (real move):**

* `lib/math/*` → `shared/math/*` (pure math)
* `lib/utils.ts`, `lib/errors.ts`, `lib/logger.ts`, `lib/cache.ts` → `shared/lib/*`
* `lib/constants/*` → `shared/config/*` (addresses are “config”)
* `lib/starknet/*` + `transaction-builder.ts` → `shared/starknet/*` and `features/wallet/*` (split low-level vs app logic)
* `lib/position/*` → `entities/position/*`
* `lib/query-keys.ts` → per-feature query keys (`features/swap/api/queryKeys.ts`, etc.) with a small `shared/query` helper

API handlers support libs:

* `lib/rate-limit.ts`, `lib/validations/api.ts`, `lib/db/*` stay as server-oriented under `shared/server/*` (or `server/*`) so it’s obvious they must not be imported by client components.

**Important Next.js rule:** Anything that imports `postgres`, `drizzle-orm`, `next/headers`, etc. should live under a clearly server-only module (and never be reachable from client components).

---

### Step E — Create “public surfaces” and ban deep imports

For each module:

* `shared/*/index.ts`
* `entities/*/index.ts`
* `features/*/index.ts`
* `widgets/*/index.ts`

Then enforce “only import from index.ts” across module boundaries.

---

## Concrete new tree (example)

```
src/
  app/...
  pages/
    trade/TradePage.tsx
    portfolio/PortfolioPage.tsx
  widgets/
    analytics/...
    markets/...
    shell/...
  features/
    wallet/{ui,model,api,index.ts}
    swap/{ui,model,api,index.ts}
    liquidity/{ui,model,api,index.ts}
    mint/{ui,model,api,index.ts}
    docs/{ui,lib,index.ts}
    tx-settings/{model,ui,index.ts}
  entities/
    market/{model,ui,lib,index.ts}
    position/{model,ui,lib,index.ts}
    token/{model,ui,lib,index.ts}
  shared/
    ui/...
    layout/...
    security/...
    api/...
    config/...
    server/{db,rate-limit,validations,...}
    math/...
    starknet/...
    lib/...
  types/ (or fold into entities/shared as you touch them)
```

You can keep `types/generated/*` as-is initially; longer-term it usually belongs under `shared/starknet/generated` or `entities/contracts`.

---

## Rules to adopt (these are the non-negotiables)

1. `app/` contains routing, metadata, and composition only.
2. Client Components import only from:

   * `shared/ui`, `shared/lib`, `entities/*`, `features/*/ui|model`
     Never from `shared/server` or anything DB/rate-limit related.
3. All cross-module imports go through module `index.ts` (no deep imports).
4. A feature owns its hooks, state, API calls, UI.
5. Shared means “no business meaning”.

---

## The quickest high-impact move (1–2 hours)

If you do only one thing now:

1. Rename/move:

* `components/ui` → `shared/ui`
* `hooks/api/fetcher.ts` → `shared/api/fetcher.ts`
* `lib/db`, `lib/rate-limit`, `lib/validations` → `shared/server/*`

2. Add TS path aliases:

* `@/shared/*`, `@/features/*`, `@/entities/*`, `@/widgets/*`

3. Add ESLint restriction to stop `components/*` and `hooks/*` from staying a dumping ground (force new code into modules).

This immediately improves maintainability without a risky “big bang” rewrite.

---

## Next: enforce boundaries in ESLint (practical policy)

If you want, I can give you a ready-to-paste `eslint` config using `no-restricted-imports` that:

* blocks `shared/server` imports from any client file
* blocks `features/*` importing from `app/*`
* blocks deep imports across modules

Paste your current `tsconfig.json` paths section (or tell me if you use one) and your ESLint config file location, and I’ll output the exact config snippet.
