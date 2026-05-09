# React Doctor Fix Inventory

**Date**: 2026-05-09
**Scope**: `packages/frontend`
**Tool**: `react-doctor v0.1.2` via `npx react-doctor@latest`
**Artifact reviewed**: `/var/folders/8w/y2jf8tbn197g08c6k1zq9ljc0000gn/T/react-doctor-081c67a6-d688-4a2a-af83-ebf2049415b1/diagnostics.json`
**Project detected**: Next.js, React `^19.2.5`, TypeScript

## Executive Summary

React Doctor reported **571 diagnostics** across **144 files**: **2 errors** and **569 warnings**.

The two errors should be fixed first because they indicate either a real lifecycle leak or a lint-rule violation that can break CI if React Hooks linting is enabled. The large warning volume is mostly Tailwind class cleanup, chart bundle splitting, and state/effect refactors.

## Priority Fixes

1. `packages/frontend/e2e/fixtures.ts:27:11` - Rename the Playwright fixture callback parameter named `use` to something like `runWithPage` and update `await use(page)` accordingly. React Doctor treats `use(...)` inside the async fixture as a React hook call, even though this is Playwright fixture API usage.
2. `packages/frontend/src/features/docs/ui/DocsSearch.tsx:191:3` - Store the `setTimeout` id used for focusing the input and return a cleanup function that calls `clearTimeout(id)`.
3. Review the two client-side `STRK_TOKEN_ADDRESS` warnings. If they are public Starknet token addresses, document/suppress or rename them as public constants rather than moving them to server-only secret env vars. If either is actually environment-specific, move it to `NEXT_PUBLIC_*` config for client use, not server-only `process.env.SECRET_NAME`.
4. Defer the 311 Tailwind `w-* h-*` to `size-*` warnings to a mechanical cleanup batch; this is low behavioral risk but creates broad visual-file churn.
5. Treat state/effect and async parallelization warnings as behavior-adjacent refactors. Fix them file-by-file with focused regression checks rather than sweeping changes.

## Validation After Fixes

- Run `bun run --cwd packages/frontend check` after code changes.
- Run `bun run --cwd packages/frontend test` for hook, utility, or state-management behavior changes.
- Run `bun run --cwd packages/frontend test:e2e` after Playwright fixture changes or user-flow changes.
- Re-run `npx react-doctor@latest packages/frontend --verbose` or run React Doctor from `packages/frontend` after batches to confirm diagnostics are cleared.

## Counts By Category

| Category | Count |
| --- | ---: |
| Correctness | 18 |
| State & Effects | 33 |
| Security | 2 |
| Accessibility | 17 |
| Next.js | 9 |
| Server | 12 |
| Performance | 69 |
| Bundle Size | 21 |
| Architecture | 390 |

## Rule Summary

| Rule | Severity | Category | Count | Required fix |
| --- | --- | --- | ---: | --- |
| `react-hooks/rules-of-hooks` | error | Correctness | 1 | Review the diagnostic and update the code at the listed locations. |
| `react-doctor/effect-needs-cleanup` | error | State & Effects | 1 | Return a cleanup function that releases the subscription / timer: `return () => target.removeEventListener(name, handler)` for listeners, `return () => clearInterval(id)` / `clearTimeout(id)` for timers, or `return unsubscribe` if the subscribe call already returned one |
| `react-doctor/no-array-index-as-key` | warning | Correctness | 5 | Use a stable unique identifier: `key={item.id}` or `key={item.slug}` — index keys break on reorder/filter |
| `react-doctor/no-prevent-default` | warning | Correctness | 1 | Use `<form action={serverAction}>` (works without JS) or `<button>` instead of `<a>` with preventDefault |
| `react-doctor/rendering-hydration-mismatch-time` | warning | Correctness | 9 | Wrap dynamic time/random values in useEffect+useState (client-only) or add suppressHydrationWarning to the parent if intentional |
| `react/no-danger` | warning | Correctness | 2 | `dangerouslySetInnerHTML` is a way to inject HTML into your React component. This is dangerous because it can easily lead to XSS vulnerabilities. |
| `react-doctor/no-cascading-set-state` | warning | State & Effects | 10 | Combine into useReducer: `const [state, dispatch] = useReducer(reducer, initialState)` |
| `react-doctor/no-derived-useState` | warning | State & Effects | 8 | Remove useState and compute the value inline: `const value = transform(propName)` |
| `react-doctor/no-effect-chain` | warning | State & Effects | 1 | Compute as much as possible during render (e.g. `const isGameOver = round > 5`) and write all related state inside the event handler that originally fires the chain. Each effect link adds an extra render and makes the code rigid as requirements evolve |
| `react-doctor/no-effect-event-handler` | warning | State & Effects | 7 | Move the conditional logic into onClick, onChange, or onSubmit handlers directly |
| `react-doctor/prefer-useReducer` | warning | State & Effects | 6 | Group related state: `const [state, dispatch] = useReducer(reducer, { field1, field2, ... })` |
| `react-doctor/no-secrets-in-client-code` | warning | Security | 2 | Move to server-side `process.env.SECRET_NAME`. Only `NEXT_PUBLIC_*` vars are safe for the client (and should not contain secrets) |
| `jsx-a11y/click-events-have-key-events` | warning | Accessibility | 2 | Visible, non-interactive elements with click handlers must have one of `keyup`, `keydown`, or `keypress` listener. |
| `jsx-a11y/label-has-associated-control` | warning | Accessibility | 7 | Either give the label a `htmlFor` attribute with the id of the associated control, or wrap the label around the control. |
| `jsx-a11y/no-autofocus` | warning | Accessibility | 2 | Remove the `autoFocus` attribute. |
| `jsx-a11y/no-static-element-interactions` | warning | Accessibility | 2 | Add a role attribute to this element, or use a semantic HTML element instead. |
| `react-doctor/design-no-vague-button-label` | warning | Accessibility | 4 | Name the action: "Save changes" instead of "Continue", "Send invite" instead of "Submit", "Delete account" instead of "OK". The label IS the button's accessible name |
| `react-doctor/nextjs-missing-metadata` | warning | Next.js | 8 | Add `export const metadata = { title: '...', description: '...' }` or `export async function generateMetadata()` |
| `react-doctor/nextjs-no-font-link` | warning | Next.js | 1 | `import { Inter } from "next/font/google"` — self-hosted, zero layout shift, no render-blocking requests |
| `react-doctor/server-fetch-without-revalidate` | warning | Server | 2 | Pass `{ next: { revalidate: <seconds> } }` (or `cache: "no-store"` / `next: { tags: [...] }`) so stale cached data doesn't silently persist |
| `react-doctor/server-sequential-independent-await` | warning | Server | 10 | Wrap independent awaits in `Promise.all([...])` so they race instead of waterfalling — second call doesn't depend on the first |
| `react-doctor/async-await-in-loop` | warning | Performance | 4 | Collect the items and use `await Promise.all(items.map(...))` to run independent operations concurrently |
| `react-doctor/async-parallel` | warning | Performance | 6 | Use `const [a, b] = await Promise.all([fetchA(), fetchB()])` to run independent operations concurrently |
| `react-doctor/js-combine-iterations` | warning | Performance | 26 | Combine `.map().filter()` (or similar chains) into a single pass with `.reduce()` or a `for...of` loop to avoid iterating the array twice |
| `react-doctor/js-flatmap-filter` | warning | Performance | 1 | Use `.flatMap(item => condition ? [value] : [])` — transforms and filters in a single pass instead of creating an intermediate array |
| `react-doctor/js-index-maps` | warning | Performance | 1 | Build an index `Map` once outside the loop instead of `array.find(...)` inside it |
| `react-doctor/js-set-map-lookups` | warning | Performance | 5 | Use a `Set` or `Map` for repeated membership tests / keyed lookups — `Array.includes`/`find` is O(n) per call |
| `react-doctor/js-tosorted-immutable` | warning | Performance | 3 | Use `array.toSorted()` (ES2023) instead of `[...array].sort()` for immutable sorting without the spread allocation |
| `react-doctor/no-inline-bounce-easing` | warning | Performance | 1 | Use `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) for natural deceleration — objects in the real world don't bounce |
| `react-doctor/rendering-hydration-no-flicker` | warning | Performance | 13 | Use `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` or add `suppressHydrationWarning` to the element |
| `react-doctor/rerender-memo-with-default-value` | warning | Performance | 2 | Move to module scope: `const EMPTY_ITEMS: Item[] = []` then use as the default value |
| `react-doctor/rerender-state-only-in-handlers` | warning | Performance | 7 | Replace useState with useRef when the value is only mutated and never read in render — `ref.current = ...` updates without re-rendering the component |
| `react-doctor/prefer-dynamic-import` | warning | Bundle Size | 21 | Use `const Component = dynamic(() => import('library'), { ssr: false })` from next/dynamic or React.lazy() |
| `react-doctor/design-no-bold-heading` | warning | Architecture | 9 | Use `font-semibold` (600) or `font-medium` (500) on headings — 700+ crushes letter counter shapes at display sizes |
| `react-doctor/design-no-em-dash-in-jsx-text` | warning | Architecture | 3 | Replace em dashes in JSX text with commas, colons, semicolons, periods, or parentheses — em dashes read as model-output filler |
| `react-doctor/design-no-redundant-padding-axes` | warning | Architecture | 24 | Collapse `px-N py-N` to `p-N` when both axes match. Keep them split only when one axis varies at a breakpoint (`py-2 md:py-3`) |
| `react-doctor/design-no-redundant-size-axes` | warning | Architecture | 311 | Collapse `w-N h-N` to `size-N` (Tailwind v3.4+) when both axes match |
| `react-doctor/design-no-three-period-ellipsis` | warning | Architecture | 9 | Use the typographic ellipsis "…" (or `&hellip;`) instead of three periods — pairs with action-with-followup labels ("Rename…", "Loading…") |
| `react-doctor/no-generic-handler-names` | warning | Architecture | 2 | Rename to describe the action: e.g. `handleSubmit` → `saveUserProfile`, `handleClick` → `toggleSidebar` |
| `react-doctor/no-giant-component` | warning | Architecture | 12 | Extract logical sections into focused components: `<UserHeader />`, `<UserActions />`, etc. |
| `react-doctor/no-inline-exhaustive-style` | warning | Architecture | 1 | Move styles to a CSS class, CSS module, Tailwind utilities, or a styled component — inline objects with many properties hurt readability and create new references every render |
| `react-doctor/no-many-boolean-props` | warning | Architecture | 1 | Split into compound components or named variants: `<Button.Primary />`, `<DialogConfirm />` instead of stacking `isPrimary`, `isConfirm` flags |
| `react-doctor/no-react19-deprecated-apis` | warning | Architecture | 8 | Pass `ref` as a regular prop on function components — `forwardRef` is no longer needed in React 19+. Replace `useContext(X)` with `use(X)` for branch-aware context reads. Only enabled on projects detected as React 19+. |
| `react-doctor/no-render-in-render` | warning | Architecture | 1 | Extract to a named component: `const ListItem = ({ item }) => <div>{item.name}</div>` |
| `react-doctor/no-side-tab-border` | warning | Architecture | 1 | Use a subtler accent (box-shadow inset, background gradient, or border-bottom) instead of a thick one-sided border |
| `react-doctor/react-compiler-destructure-method` | warning | Architecture | 8 | Destructure the method up front: `const { push } = useRouter()` then call `push(...)` directly — clearer dependency graph and easier for React Compiler to memoize |

## Complete Diagnostics Inventory

### react-hooks/rules-of-hooks

- Severity: error
- Category: Correctness
- Count: 1
- Required fix: Review the diagnostic and update the code at the listed locations.
- Diagnostic: React Hook "use" cannot be called in an async function.
- Locations:
  - `packages/frontend/e2e/fixtures.ts:27:11`

### react-doctor/effect-needs-cleanup

- Severity: error
- Category: State & Effects
- Count: 1
- Required fix: Return a cleanup function that releases the subscription / timer: `return () => target.removeEventListener(name, handler)` for listeners, `return () => clearInterval(id)` / `clearTimeout(id)` for timers, or `return unsubscribe` if the subscribe call already returned one
- Diagnostic: useEffect schedules `setTimeout(...)` but never returns a cleanup — leaks the registration on every re-run and on unmount. Return a cleanup function that calls clearTimeout(...)
- Locations:
  - `packages/frontend/src/features/docs/ui/DocsSearch.tsx:191:3`

### react-doctor/no-array-index-as-key

- Severity: warning
- Category: Correctness
- Count: 5
- Required fix: Use a stable unique identifier: `key={item.id}` or `key={item.slug}` — index keys break on reorder/filter
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/src/features/rewards/ui/RewardClaimHistory.tsx:121:20` - Array index "i" used as key — causes bugs when list is reordered or filtered
  - `packages/frontend/src/shared/ui/animations.tsx:153:11` - Array index "index" used as key — causes bugs when list is reordered or filtered
  - `packages/frontend/src/shared/ui/slider.tsx:56:13` - Array index "index" used as key — causes bugs when list is reordered or filtered
  - `packages/frontend/src/shared/ui/Sparkline.tsx:404:11` - Array index "i" used as key — causes bugs when list is reordered or filtered
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:535:23` - Array index "i" used as key — causes bugs when list is reordered or filtered

### react-doctor/no-prevent-default

- Severity: warning
- Category: Correctness
- Count: 1
- Required fix: Use `<form action={serverAction}>` (works without JS) or `<button>` instead of `<a>` with preventDefault
- Diagnostic: preventDefault() on <a> onClick — use a <button> or routing component instead
- Locations:
  - `packages/frontend/src/features/docs/ui/TableOfContents.tsx:84:13`

### react-doctor/rendering-hydration-mismatch-time

- Severity: warning
- Category: Correctness
- Count: 9
- Required fix: Wrap dynamic time/random values in useEffect+useState (client-only) or add suppressHydrationWarning to the parent if intentional
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:410:26` - new Date() reachable from JSX renders differently on server vs client — wrap in useEffect+useState (client-only) or add suppressHydrationWarning to the parent if intentional
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:410:26` - new Date() reachable from JSX renders differently on server vs client — wrap in useEffect+useState (client-only) or add suppressHydrationWarning to the parent if intentional
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:539:26` - new Date() reachable from JSX renders differently on server vs client — wrap in useEffect+useState (client-only) or add suppressHydrationWarning to the parent if intentional
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:539:26` - new Date() reachable from JSX renders differently on server vs client — wrap in useEffect+useState (client-only) or add suppressHydrationWarning to the parent if intentional
  - `packages/frontend/src/widgets/portfolio/LpPnlCard.tsx:297:16` - new Date() reachable from JSX renders differently on server vs client — wrap in useEffect+useState (client-only) or add suppressHydrationWarning to the parent if intentional
  - `packages/frontend/src/widgets/portfolio/LpPnlCard.tsx:297:16` - new Date() reachable from JSX renders differently on server vs client — wrap in useEffect+useState (client-only) or add suppressHydrationWarning to the parent if intentional
  - `packages/frontend/src/widgets/portfolio/LpPnlCard.tsx:307:16` - new Date() reachable from JSX renders differently on server vs client — wrap in useEffect+useState (client-only) or add suppressHydrationWarning to the parent if intentional
  - `packages/frontend/src/widgets/portfolio/LpPnlCard.tsx:307:16` - new Date() reachable from JSX renders differently on server vs client — wrap in useEffect+useState (client-only) or add suppressHydrationWarning to the parent if intentional
  - `packages/frontend/src/widgets/portfolio/PositionPnlTimeline.tsx:115:57` - Date.now() reachable from JSX renders differently on server vs client — wrap in useEffect+useState (client-only) or add suppressHydrationWarning to the parent if intentional

### react/no-danger

- Severity: warning
- Category: Correctness
- Count: 2
- Required fix: `dangerouslySetInnerHTML` is a way to inject HTML into your React component. This is dangerous because it can easily lead to XSS vulnerabilities.
- Diagnostic: Do not use `dangerouslySetInnerHTML` prop
- Locations:
  - `packages/frontend/src/features/docs/ui/Formula.tsx:27:9`
  - `packages/frontend/src/features/docs/ui/Formula.tsx:32:52`

### react-doctor/no-cascading-set-state

- Severity: warning
- Category: State & Effects
- Count: 10
- Required fix: Combine into useReducer: `const [state, dispatch] = useReducer(reducer, initialState)`
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/src/features/swap/ui/PriceImpactMeter.tsx:82:3` - 3 setState calls in a single useEffect — consider using useReducer or deriving state
  - `packages/frontend/src/features/wallet/model/useAccount.ts:17:3` - 3 setState calls in a single useEffect — consider using useReducer or deriving state
  - `packages/frontend/src/providers/StarknetProvider.tsx:50:3` - 4 setState calls in a single useEffect — consider using useReducer or deriving state
  - `packages/frontend/src/providers/StarknetProvider.tsx:78:3` - 3 setState calls in a single useEffect — consider using useReducer or deriving state
  - `packages/frontend/src/shared/hooks/useEstimateFee.ts:64:3` - 5 setState calls in a single useEffect — consider using useReducer or deriving state
  - `packages/frontend/src/shared/layout/mode-transition.tsx:21:3` - 4 setState calls in a single useEffect — consider using useReducer or deriving state
  - `packages/frontend/src/shared/layout/mode-transition.tsx:64:3` - 4 setState calls in a single useEffect — consider using useReducer or deriving state
  - `packages/frontend/src/shared/theme/ui-mode-context.tsx:40:3` - 3 setState calls in a single useEffect — consider using useReducer or deriving state
  - `packages/frontend/src/shared/ui/AnimatedNumber.tsx:41:3` - 3 setState calls in a single useEffect — consider using useReducer or deriving state
  - `packages/frontend/src/shared/ui/AnimatedNumber.tsx:150:3` - 3 setState calls in a single useEffect — consider using useReducer or deriving state

### react-doctor/no-derived-useState

- Severity: warning
- Category: State & Effects
- Count: 8
- Required fix: Remove useState and compute the value inline: `const value = transform(propName)`
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/src/shared/theme/ui-mode-context.tsx:35:32` - useState initialized from prop "defaultMode" — if this value should stay in sync with the prop, derive it during render instead
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:196:27` - useState initialized from prop "defaultDays" — if this value should stay in sync with the prop, derive it during render instead
  - `packages/frontend/src/widgets/analytics/FeeRevenueChart.tsx:64:29` - useState initialized from prop "defaultRange" — if this value should stay in sync with the prop, derive it during render instead
  - `packages/frontend/src/widgets/analytics/ImpliedRateChart.tsx:152:39` - useState initialized from prop "defaultResolution" — if this value should stay in sync with the prop, derive it during render instead
  - `packages/frontend/src/widgets/analytics/ImpliedRateChart.tsx:154:27` - useState initialized from prop "defaultDays" — if this value should stay in sync with the prop, derive it during render instead
  - `packages/frontend/src/widgets/analytics/ImpliedVsRealizedChart.tsx:105:27` - useState initialized from prop "defaultDays" — if this value should stay in sync with the prop, derive it during render instead
  - `packages/frontend/src/widgets/analytics/PtConvergenceChart.tsx:109:27` - useState initialized from prop "defaultDays" — if this value should stay in sync with the prop, derive it during render instead
  - `packages/frontend/src/widgets/portfolio/PortfolioValueChart.tsx:81:29` - useState initialized from prop "defaultRange" — if this value should stay in sync with the prop, derive it during render instead

### react-doctor/no-effect-chain

- Severity: warning
- Category: State & Effects
- Count: 1
- Required fix: Compute as much as possible during render (e.g. `const isGameOver = round > 5`) and write all related state inside the event handler that originally fires the chain. Each effect link adds an extra render and makes the code rigid as requirements evolve
- Diagnostic: useEffect reacts to "syAmount" which is set by another useEffect — chains of effects add an extra render per link and become rigid as code evolves. Compute what you can during render and write all related state inside the event handler that originally fires the chain
- Locations:
  - `packages/frontend/src/features/liquidity/ui/AddLiquidityForm.tsx:274:3`

### react-doctor/no-effect-event-handler

- Severity: warning
- Category: State & Effects
- Count: 7
- Required fix: Move the conditional logic into onClick, onChange, or onSubmit handlers directly
- Diagnostic: useEffect simulating an event handler — move logic to an actual event handler instead
- Locations:
  - `packages/frontend/src/features/docs/ui/DocsSearch.tsx:191:3`
  - `packages/frontend/src/features/liquidity/ui/AddLiquidityForm.tsx:455:3`
  - `packages/frontend/src/features/liquidity/ui/RemoveLiquidityForm.tsx:515:3`
  - `packages/frontend/src/features/liquidity/ui/TokenAggregatorLiquidityForm.tsx:575:3`
  - `packages/frontend/src/features/swap/ui/TokenAggregatorSwapForm.tsx:513:3`
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:144:3`
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:151:3`

### react-doctor/prefer-useReducer

- Severity: warning
- Category: State & Effects
- Count: 6
- Required fix: Group related state: `const [state, dispatch] = useReducer(reducer, { field1, field2, ... })`
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/src/features/liquidity/ui/AddLiquidityForm.tsx:215:91` - Component "AddLiquidityForm" has 5 useState calls — consider useReducer for related state
  - `packages/frontend/src/features/liquidity/ui/TokenAggregatorLiquidityForm.tsx:225:50` - Component "TokenAggregatorLiquidityForm" has 6 useState calls — consider useReducer for related state
  - `packages/frontend/src/features/swap/ui/SwapForm.tsx:76:75` - Component "SwapForm" has 5 useState calls — consider useReducer for related state
  - `packages/frontend/src/features/swap/ui/TokenAggregatorSwapForm.tsx:236:100` - Component "TokenAggregatorSwapForm" has 6 useState calls — consider useReducer for related state
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:104:47` - Component "FaucetPage" has 5 useState calls — consider useReducer for related state
  - `packages/frontend/src/providers/StarknetProvider.tsx:38:88` - Component "StarknetProvider" has 6 useState calls — consider useReducer for related state

### react-doctor/no-secrets-in-client-code

- Severity: warning
- Category: Security
- Count: 2
- Required fix: Move to server-side `process.env.SECRET_NAME`. Only `NEXT_PUBLIC_*` vars are safe for the client (and should not contain secrets)
- Diagnostic: Possible hardcoded secret in "STRK_TOKEN_ADDRESS" — use environment variables instead
- Locations:
  - `packages/frontend/src/features/yield/model/useClaimGasCheck.ts:15:7`
  - `packages/frontend/src/shared/hooks/useEstimateFee.ts:12:7`

### jsx-a11y/click-events-have-key-events

- Severity: warning
- Category: Accessibility
- Count: 2
- Required fix: Visible, non-interactive elements with click handlers must have one of `keyup`, `keydown`, or `keypress` listener.
- Diagnostic: Enforce a clickable non-interactive element has at least one keyboard event listener.
- Locations:
  - `packages/frontend/src/features/docs/ui/DocsLayout.tsx:51:11`
  - `packages/frontend/src/features/docs/ui/DocsSearch.tsx:218:11`

### jsx-a11y/label-has-associated-control

- Severity: warning
- Category: Accessibility
- Count: 7
- Required fix: Either give the label a `htmlFor` attribute with the id of the associated control, or wrap the label around the control.
- Diagnostic: A form label must be associated with a control.
- Locations:
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:258:11`
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:280:11`
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:303:13`
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:460:13`
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:286:17`
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:175:17`
  - `packages/frontend/src/shared/ui/label.tsx:8:5`

### jsx-a11y/no-autofocus

- Severity: warning
- Category: Accessibility
- Count: 2
- Required fix: Remove the `autoFocus` attribute.
- Diagnostic: The `autoFocus` attribute is found here, which can cause usability issues for sighted and non-sighted users.
- Locations:
  - `packages/frontend/src/features/tx-settings/ui/TransactionSettingsPanel.tsx:207:15`
  - `packages/frontend/src/features/tx-settings/ui/TransactionSettingsPanel.tsx:455:19`

### jsx-a11y/no-static-element-interactions

- Severity: warning
- Category: Accessibility
- Count: 2
- Required fix: Add a role attribute to this element, or use a semantic HTML element instead.
- Diagnostic: Static HTML elements with event handlers require a role.
- Locations:
  - `packages/frontend/src/features/docs/ui/DocsLayout.tsx:51:12`
  - `packages/frontend/src/features/docs/ui/DocsSearch.tsx:218:12`

### react-doctor/design-no-vague-button-label

- Severity: warning
- Category: Accessibility
- Count: 4
- Required fix: Name the action: "Save changes" instead of "Continue", "Send invite" instead of "Submit", "Delete account" instead of "OK". The label IS the button's accessible name
- Diagnostic: Vague button label "Done" — name the action ("Save changes", "Send invite", "Delete account") so screen readers and hesitant users know what happens
- Locations:
  - `packages/frontend/src/features/rewards/ui/ClaimRewardsCard.tsx:212:11`
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:205:11`
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:363:11`
  - `packages/frontend/src/widgets/portfolio/SimplePortfolio.tsx:264:13`

### react-doctor/nextjs-missing-metadata

- Severity: warning
- Category: Next.js
- Count: 8
- Required fix: Add `export const metadata = { title: '...', description: '...' }` or `export async function generateMetadata()`
- Diagnostic: Page without metadata or generateMetadata export — hurts SEO
- Locations:
  - `packages/frontend/src/app/analytics/page.tsx:1:1`
  - `packages/frontend/src/app/docs/page.tsx:1:1`
  - `packages/frontend/src/app/faucet/page.tsx:1:1`
  - `packages/frontend/src/app/mint/page.tsx:1:1`
  - `packages/frontend/src/app/page.tsx:1:1`
  - `packages/frontend/src/app/pools/page.tsx:1:1`
  - `packages/frontend/src/app/portfolio/page.tsx:1:1`
  - `packages/frontend/src/app/trade/page.tsx:1:1`

### react-doctor/nextjs-no-font-link

- Severity: warning
- Category: Next.js
- Count: 1
- Required fix: `import { Inter } from "next/font/google"` — self-hosted, zero layout shift, no render-blocking requests
- Diagnostic: Loading Google Fonts via <link> — use next/font instead for self-hosting, zero layout shift, and no render-blocking requests
- Locations:
  - `packages/frontend/src/app/layout.tsx:116:9`

### react-doctor/server-fetch-without-revalidate

- Severity: warning
- Category: Server
- Count: 2
- Required fix: Pass `{ next: { revalidate: <seconds> } }` (or `cache: "no-store"` / `next: { tags: [...] }`) so stale cached data doesn't silently persist
- Diagnostic: fetch(url) in a Server Component / route handler defaults to forever-caching — pass { next: { revalidate: <seconds> } } / { next: { tags: [...] } } / { cache: "no-store" } so stale data doesn't quietly persist
- Locations:
  - `packages/frontend/src/app/api/health/route.ts:67:28`
  - `packages/frontend/src/app/api/rpc/route.ts:115:28`

### react-doctor/server-sequential-independent-await

- Severity: warning
- Category: Server
- Count: 10
- Required fix: Wrap independent awaits in `Promise.all([...])` so they race instead of waterfalling — second call doesn't depend on the first
- Diagnostic: Sequential `await` without a data dependency on the previous result — wrap the independent calls in `Promise.all([...])` so they race instead of waterfalling
- Locations:
  - `packages/frontend/e2e/markets.spec.ts:45:5`
  - `packages/frontend/e2e/markets.spec.ts:104:5`
  - `packages/frontend/e2e/markets.spec.ts:144:5`
  - `packages/frontend/e2e/navigation.spec.ts:125:5`
  - `packages/frontend/e2e/rewards.spec.ts:23:5`
  - `packages/frontend/e2e/rewards.spec.ts:42:5`
  - `packages/frontend/e2e/rewards.spec.ts:94:5`
  - `packages/frontend/e2e/rewards.spec.ts:120:5`
  - `packages/frontend/e2e/rewards.spec.ts:143:5`
  - `packages/frontend/src/app/api/analytics/treasury/route.ts:244:3`

### react-doctor/async-await-in-loop

- Severity: warning
- Category: Performance
- Count: 4
- Required fix: Collect the items and use `await Promise.all(items.map(...))` to run independent operations concurrently
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/e2e/rewards.spec.ts:166:23` - await inside a for…of loop runs the calls sequentially — for independent operations, collect them and use `await Promise.all(items.map(...))` to run them concurrently
  - `packages/frontend/src/app/api/analytics/liquidity-health/route.ts:304:22` - await inside a for…of loop runs the calls sequentially — for independent operations, collect them and use `await Promise.all(items.map(...))` to run them concurrently
  - `packages/frontend/src/features/markets/model/useMarkets.ts:319:20` - await inside a while-loop runs the calls sequentially — for independent operations, collect them and use `await Promise.all(items.map(...))` to run them concurrently
  - `packages/frontend/src/features/markets/model/useMarkets.ts:422:20` - await inside a while-loop runs the calls sequentially — for independent operations, collect them and use `await Promise.all(items.map(...))` to run them concurrently

### react-doctor/async-parallel

- Severity: warning
- Category: Performance
- Count: 6
- Required fix: Use `const [a, b] = await Promise.all([fetchA(), fetchB()])` to run independent operations concurrently
- Diagnostic: 3 sequential await statements that appear independent — use Promise.all() for parallel execution
- Locations:
  - `packages/frontend/src/app/api/analytics/treasury/route.ts:232:3`
  - `packages/frontend/src/features/liquidity/model/useLiquidity.ts:131:7`
  - `packages/frontend/src/features/liquidity/model/useLiquidity.ts:286:7`
  - `packages/frontend/src/features/liquidity/model/useTokenLiquidity.ts:401:7`
  - `packages/frontend/src/features/redeem/model/useRedeem.ts:112:7`
  - `packages/frontend/src/features/redeem/model/useRedeem.ts:498:7`

### react-doctor/js-combine-iterations

- Severity: warning
- Category: Performance
- Count: 26
- Required fix: Combine `.map().filter()` (or similar chains) into a single pass with `.reduce()` or a `for...of` loop to avoid iterating the array twice
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/src/app/api/analytics/execution-quality/route.ts:127:10` - .filter().map() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/app/api/users/[address]/positions/route.ts:91:39` - .filter().map() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/app/api/users/[address]/positions/route.ts:134:39` - .filter().map() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/app/api/users/[address]/yield/route.ts:129:47` - .filter().map() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/features/docs/ui/DocsSearch.tsx:124:10` - .map().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/features/markets/model/useMarketRates.ts:126:17` - .map().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/features/markets/model/useMarkets.ts:213:16` - .map().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/features/markets/model/useMarkets.ts:236:10` - .map().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/features/markets/model/useMarkets.ts:324:27` - .map().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/features/markets/model/useMarkets.ts:427:27` - .map().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/features/rewards/model/usePortfolioRewards.ts:162:26` - .map().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/features/rewards/model/usePortfolioYTRewards.ts:163:26` - .map().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/features/yield/model/useTreasuryYield.ts:112:18` - .map().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/page-compositions/admin-treasury/TreasuryDashboard.tsx:26:23` - .map().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/page-compositions/analytics/AnalyticsPage.tsx:141:26` - .map().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/page-compositions/portfolio/PortfolioPage.tsx:563:34` - .filter().map() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/shared/layout/Header.tsx:42:24` - .filter().map() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/widgets/analytics/FeeByMarket.tsx:112:12` - .filter().map() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/widgets/analytics/FeeByMarket.tsx:305:12` - .filter().map() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/widgets/analytics/TvlBreakdown.tsx:72:12` - .filter().map() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/widgets/analytics/TvlBreakdown.tsx:225:12` - .filter().map() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/widgets/hero/HeroSection.tsx:153:26` - .map().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:74:20` - .filter().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:74:20` - .map().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:237:20` - .filter().filter() iterates the array twice — combine into a single loop with .reduce() or for...of
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:237:20` - .map().filter() iterates the array twice — combine into a single loop with .reduce() or for...of

### react-doctor/js-flatmap-filter

- Severity: warning
- Category: Performance
- Count: 1
- Required fix: Use `.flatMap(item => condition ? [value] : [])` — transforms and filters in a single pass instead of creating an intermediate array
- Diagnostic: .map().filter(Boolean) iterates twice — use .flatMap() to transform and filter in a single pass
- Locations:
  - `packages/frontend/src/app/api/users/[address]/positions/route.ts:125:18`

### react-doctor/js-index-maps

- Severity: warning
- Category: Performance
- Count: 1
- Required fix: Build an index `Map` once outside the loop instead of `array.find(...)` inside it
- Diagnostic: array.find() in a loop is O(n*m) — build a Map for O(1) lookups
- Locations:
  - `packages/frontend/src/app/api/analytics/execution-quality/route.ts:172:20`

### react-doctor/js-set-map-lookups

- Severity: warning
- Category: Performance
- Count: 5
- Required fix: Use a `Set` or `Map` for repeated membership tests / keyed lookups — `Array.includes`/`find` is O(n) per call
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/src/shared/lib/errors.ts:396:9` - array.includes() in a loop is O(n) per call — convert to a Set for O(1) lookups
  - `packages/frontend/src/shared/lib/errors.ts:474:11` - array.includes() in a loop is O(n) per call — convert to a Set for O(1) lookups
  - `packages/frontend/src/shared/lib/errors.ts:594:36` - array.includes() in a loop is O(n) per call — convert to a Set for O(1) lookups
  - `packages/frontend/src/shared/ui/NearExpiryWarning.test.tsx:83:21` - array.indexOf() in a loop is O(n) per call — convert to a Set for O(1) lookups
  - `packages/frontend/src/shared/ui/NearExpiryWarning.tsx:77:19` - array.indexOf() in a loop is O(n) per call — convert to a Set for O(1) lookups

### react-doctor/js-tosorted-immutable

- Severity: warning
- Category: Performance
- Count: 3
- Required fix: Use `array.toSorted()` (ES2023) instead of `[...array].sort()` for immutable sorting without the spread allocation
- Diagnostic: [...array].sort() — use array.toSorted() for immutable sorting (ES2023)
- Locations:
  - `packages/frontend/src/app/api/markets/[address]/price-impact/route.ts:153:27`
  - `packages/frontend/src/features/portfolio/model/useEnhancedPositions.ts:245:47`
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:660:25`

### react-doctor/no-inline-bounce-easing

- Severity: warning
- Category: Performance
- Count: 1
- Required fix: Use `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) for natural deceleration — objects in the real world don't bounce
- Diagnostic: animate-bounce feels dated and tacky — use a subtle ease-out transform for natural deceleration
- Locations:
  - `packages/frontend/src/widgets/display/TxStatus.tsx:70:15`

### react-doctor/rendering-hydration-no-flicker

- Severity: warning
- Category: Performance
- Count: 13
- Required fix: Use `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` or add `suppressHydrationWarning` to the element
- Diagnostic: useEffect(setState, []) on mount causes a flash — consider useSyncExternalStore or suppressHydrationWarning
- Locations:
  - `packages/frontend/src/entities/market/ui/MarketList.tsx:19:3`
  - `packages/frontend/src/entities/market/ui/SimpleMarketList.tsx:22:3`
  - `packages/frontend/src/entities/market/ui/StatsOverview.tsx:13:3`
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:274:3`
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:431:3`
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:236:3`
  - `packages/frontend/src/page-compositions/portfolio/PortfolioPage.tsx:508:3`
  - `packages/frontend/src/widgets/analytics/IndexerStatusBanner.tsx:25:3`
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:111:3`
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:156:3`
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:400:3`
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:347:3`
  - `packages/frontend/src/widgets/hero/HeroSection.tsx:28:3`

### react-doctor/rerender-memo-with-default-value

- Severity: warning
- Category: Performance
- Count: 2
- Required fix: Move to module scope: `const EMPTY_ITEMS: Item[] = []` then use as the default value
- Diagnostic: Default prop value [] creates a new array reference every render — extract to a module-level constant
- Locations:
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:399:17`
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:485:17`

### react-doctor/rerender-state-only-in-handlers

- Severity: warning
- Category: Performance
- Count: 7
- Required fix: Replace useState with useRef when the value is only mutated and never read in render — `ref.current = ...` updates without re-rendering the component
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/src/entities/market/ui/MarketList.tsx:17:9` - useState "mounted" is updated but never read in the component's return — use useRef so updates don't trigger re-renders
  - `packages/frontend/src/entities/market/ui/SimpleMarketList.tsx:20:9` - useState "mounted" is updated but never read in the component's return — use useRef so updates don't trigger re-renders
  - `packages/frontend/src/entities/market/ui/StatsOverview.tsx:11:9` - useState "mounted" is updated but never read in the component's return — use useRef so updates don't trigger re-renders
  - `packages/frontend/src/page-compositions/portfolio/PortfolioPage.tsx:481:9` - useState "mounted" is updated but never read in the component's return — use useRef so updates don't trigger re-renders
  - `packages/frontend/src/shared/layout/mode-transition.tsx:19:9` - useState "prevMode" is updated but never read in the component's return — use useRef so updates don't trigger re-renders
  - `packages/frontend/src/shared/theme/ui-mode-context.tsx:36:9` - useState "isHydrated" is updated but never read in the component's return — use useRef so updates don't trigger re-renders
  - `packages/frontend/src/widgets/analytics/IndexerStatusBanner.tsx:23:9` - useState "mounted" is updated but never read in the component's return — use useRef so updates don't trigger re-renders

### react-doctor/prefer-dynamic-import

- Severity: warning
- Category: Bundle Size
- Count: 21
- Required fix: Use `const Component = dynamic(() => import('library'), { ssr: false })` from next/dynamic or React.lazy()
- Diagnostic: "recharts" is a heavy library — use React.lazy() or next/dynamic for code splitting
- Locations:
  - `packages/frontend/src/widgets/analytics/DepthCurve.tsx:10:1`
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:40:1`
  - `packages/frontend/src/widgets/analytics/FeeByMarket.tsx:11:1`
  - `packages/frontend/src/widgets/analytics/FeeRevenueChart.tsx:12:1`
  - `packages/frontend/src/widgets/analytics/ImpliedRateChart.tsx:10:1`
  - `packages/frontend/src/widgets/analytics/ImpliedVsRealizedChart.tsx:10:1`
  - `packages/frontend/src/widgets/analytics/LiquidityHealthScore.tsx:8:1`
  - `packages/frontend/src/widgets/analytics/ProtocolTvlCard.tsx:10:1`
  - `packages/frontend/src/widgets/analytics/PtConvergenceChart.tsx:10:1`
  - `packages/frontend/src/widgets/analytics/RateSparkline.tsx:9:1`
  - `packages/frontend/src/widgets/analytics/TvlBreakdown.tsx:10:1`
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:11:1`
  - `packages/frontend/src/widgets/analytics/VolumeByMarket.tsx:11:1`
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:19:1`
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:10:1`
  - `packages/frontend/src/widgets/portfolio/BeatImpliedScore.tsx:13:1`
  - `packages/frontend/src/widgets/portfolio/LpApyBreakdown.tsx:10:1`
  - `packages/frontend/src/widgets/portfolio/PnlBreakdown.tsx:12:1`
  - `packages/frontend/src/widgets/portfolio/PortfolioValueChart.tsx:13:1`
  - `packages/frontend/src/widgets/portfolio/PositionPnlTimeline.tsx:19:1`
  - `packages/frontend/src/widgets/portfolio/YtCashflowChart.tsx:9:1`

### react-doctor/design-no-bold-heading

- Severity: warning
- Category: Architecture
- Count: 9
- Required fix: Use `font-semibold` (600) or `font-medium` (500) on headings — 700+ crushes letter counter shapes at display sizes
- Diagnostic: font-bold on <h1> crushes counter shapes at display sizes — use font-semibold (600) or font-medium (500)
- Locations:
  - `packages/frontend/mdx-components.tsx:11:11`
  - `packages/frontend/src/app/not-found.tsx:10:13`
  - `packages/frontend/src/app/pools/error.tsx:43:13`
  - `packages/frontend/src/app/portfolio/error.tsx:43:13`
  - `packages/frontend/src/app/privacy/page.tsx:71:13`
  - `packages/frontend/src/app/terms/page.tsx:57:13`
  - `packages/frontend/src/app/trade/error.tsx:43:13`
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:203:15`
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:233:13`

### react-doctor/design-no-em-dash-in-jsx-text

- Severity: warning
- Category: Architecture
- Count: 3
- Required fix: Replace em dashes in JSX text with commas, colons, semicolons, periods, or parentheses — em dashes read as model-output filler
- Diagnostic: Em dash (—) in JSX text reads as model output — replace with comma, colon, semicolon, or parentheses
- Locations:
  - `packages/frontend/src/app/privacy/page.tsx:229:46`
  - `packages/frontend/src/app/privacy/page.tsx:232:43`
  - `packages/frontend/src/app/privacy/page.tsx:235:43`

### react-doctor/design-no-redundant-padding-axes

- Severity: warning
- Category: Architecture
- Count: 24
- Required fix: Collapse `px-N py-N` to `p-N` when both axes match. Keep them split only when one axis varies at a breakpoint (`py-2 md:py-3`)
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/src/shared/layout/Header.tsx:142:14` - px-4 py-4 → use the shorthand p-4
  - `packages/frontend/src/widgets/analytics/RateHistoryTable.tsx:162:21` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/analytics/RateHistoryTable.tsx:163:21` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/analytics/RateHistoryTable.tsx:166:21` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/analytics/RateHistoryTable.tsx:169:25` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/analytics/RateHistoryTable.tsx:170:25` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/analytics/RateHistoryTable.tsx:174:23` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/analytics/RateHistoryTable.tsx:183:23` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/analytics/RateHistoryTable.tsx:184:23` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/analytics/RateHistoryTable.tsx:202:27` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/analytics/RateHistoryTable.tsx:205:27` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/analytics/RateHistoryTable.tsx:211:25` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:135:21` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:136:21` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:137:21` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:138:21` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:139:21` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:140:21` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:146:23` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:158:23` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:171:23` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:175:23` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:178:23` - px-2 py-2 → use the shorthand p-2
  - `packages/frontend/src/widgets/portfolio/LpEntryExitTable.tsx:181:23` - px-2 py-2 → use the shorthand p-2

### react-doctor/design-no-redundant-size-axes

- Severity: warning
- Category: Architecture
- Count: 311
- Required fix: Collapse `w-N h-N` to `size-N` (Tailwind v3.4+) when both axes match
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/src/app/pools/error.tsx:33:16` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/app/portfolio/error.tsx:33:16` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/app/privacy/page.tsx:63:14` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/app/terms/page.tsx:49:14` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/app/trade/error.tsx:33:16` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/entities/market/ui/AssetTypeBadge.tsx:63:13` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/entities/market/ui/MarketCard.tsx:166:20` - w-9 h-9 → use the shorthand size-9 (Tailwind v3.4+)
  - `packages/frontend/src/entities/market/ui/MarketCard.tsx:177:33` - w-2.5 h-2.5 → use the shorthand size-2.5 (Tailwind v3.4+)
  - `packages/frontend/src/entities/market/ui/StatsOverview.tsx:38:23` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/entities/market/ui/StatsOverview.tsx:45:22` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/entities/market/ui/StatsOverview.tsx:53:24` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/docs/ui/DocsLayout.tsx:33:29` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/features/docs/ui/DocsLayout.tsx:33:60` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/features/docs/ui/DocsNavigation.tsx:44:24` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/docs/ui/DocsNavigation.tsx:63:25` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/docs/ui/DocsSearch.tsx:207:17` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/docs/ui/DocsSearch.tsx:229:23` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/features/docs/ui/DocsSearch.tsx:248:20` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/features/docs/ui/DocsSidebar.tsx:101:36` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/docs/ui/DocsSidebar.tsx:101:75` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/docs/ui/Steps.tsx:26:14` - w-7 h-7 → use the shorthand size-7 (Tailwind v3.4+)
  - `packages/frontend/src/features/docs/ui/TryItButton.tsx:39:21` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/docs/ui/TryItButton.tsx:47:19` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/earn/ui/SimpleEarnForm.tsx:196:13` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/earn/ui/SimpleWithdrawForm.tsx:370:13` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/earn/ui/WrapToSyForm.tsx:231:13` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/liquidity/ui/TokenAggregatorLiquidityForm.tsx:663:20` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/features/liquidity/ui/TokenAggregatorLiquidityForm.tsx:677:45` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/features/liquidity/ui/TokenAggregatorLiquidityForm.tsx:710:26` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/liquidity/ui/TokenAggregatorLiquidityForm.tsx:760:17` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/markets/ui/FeeStructure.tsx:51:19` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/features/markets/ui/FeeStructure.tsx:79:16` - w-2 h-2 → use the shorthand size-2 (Tailwind v3.4+)
  - `packages/frontend/src/features/markets/ui/FeeStructure.tsx:83:16` - w-2 h-2 → use the shorthand size-2 (Tailwind v3.4+)
  - `packages/frontend/src/features/markets/ui/MarketRates.tsx:50:17` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/features/mint/ui/MintForm.tsx:188:13` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/price/ui/PriceImpactWarning.tsx:29:17` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/features/price/ui/PriceImpactWarning.tsx:36:25` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/features/price/ui/PriceImpactWarning.tsx:43:26` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/features/price/ui/PriceImpactWarning.tsx:135:30` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/price/ui/PriceImpactWarning.tsx:142:28` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/features/redeem/ui/UnwrapSyForm.tsx:214:13` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/rewards/ui/ClaimRewardsCard.tsx:144:18` - w-12 h-12 → use the shorthand size-12 (Tailwind v3.4+)
  - `packages/frontend/src/features/rewards/ui/ClaimRewardsCard.tsx:145:25` - w-6 h-6 → use the shorthand size-6 (Tailwind v3.4+)
  - `packages/frontend/src/features/rewards/ui/RewardApyBadge.tsx:84:17` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/features/rewards/ui/RewardClaimHistory.tsx:84:27` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/features/rewards/ui/RewardClaimHistory.tsx:156:18` - w-12 h-12 → use the shorthand size-12 (Tailwind v3.4+)
  - `packages/frontend/src/features/rewards/ui/RewardClaimHistory.tsx:157:25` - w-6 h-6 → use the shorthand size-6 (Tailwind v3.4+)
  - `packages/frontend/src/features/swap/ui/PriceImpactMeter.tsx:34:28` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/swap/ui/PriceImpactMeter.tsx:42:25` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/swap/ui/PriceImpactMeter.tsx:50:29` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/swap/ui/PriceImpactMeter.tsx:58:30` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/swap/ui/SwapDetails.tsx:103:22` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/swap/ui/SwapDetails.tsx:120:23` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/features/swap/ui/SwapDetails.tsx:143:40` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/features/swap/ui/SwapDetails.tsx:212:25` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/features/swap/ui/SwapForm.tsx:478:26` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/swap/ui/TokenAggregatorSwapForm.tsx:617:20` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/features/swap/ui/TokenAggregatorSwapForm.tsx:631:45` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/features/swap/ui/TokenAggregatorSwapForm.tsx:664:26` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/swap/ui/TokenAggregatorSwapForm.tsx:714:17` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/swap/ui/YtCollateralWarning.tsx:56:7` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/wallet/ui/DisclaimerDialog.tsx:41:16` - w-12 h-12 → use the shorthand size-12 (Tailwind v3.4+)
  - `packages/frontend/src/features/wallet/ui/DisclaimerDialog.tsx:42:28` - w-6 h-6 → use the shorthand size-6 (Tailwind v3.4+)
  - `packages/frontend/src/features/wallet/ui/DisclaimerDialog.tsx:54:29` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/features/wallet/ui/DisclaimerDialog.tsx:68:30` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/features/wallet/ui/DisclaimerDialog.tsx:96:29` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/features/wallet/ui/DisclaimerDialog.tsx:109:15` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/features/yield/ui/InterestClaimPreview.tsx:75:23` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/features/yield/ui/InterestClaimPreview.tsx:119:20` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/features/yield/ui/InterestClaimPreview.tsx:206:32` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/features/yield/ui/InterestClaimPreview.tsx:223:30` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/features/yield/ui/NegativeYieldWarning.tsx:112:27` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/admin-treasury/TreasuryDashboard.tsx:46:23` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/admin-treasury/TreasuryDashboard.tsx:59:21` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/admin-treasury/TreasuryDashboard.tsx:99:28` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/admin-treasury/TreasuryDashboard.tsx:156:16` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/admin-treasury/TreasuryDashboard.tsx:167:16` - w-10 h-10 → use the shorthand size-10 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/admin-treasury/TreasuryDashboard.tsx:168:23` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/admin-treasury/TreasuryDashboard.tsx:231:32` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/analytics/AnalyticsPage.tsx:171:16` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:63:18` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:73:26` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:89:18` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:202:26` - w-12 h-12 → use the shorthand size-12 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:222:14` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:230:14` - w-16 h-16 → use the shorthand size-16 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:231:21` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:271:32` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:271:63` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:322:22` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:343:28` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:348:29` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:371:25` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:89:16` - w-6 h-6 → use the shorthand size-6 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:98:16` - w-6 h-6 → use the shorthand size-6 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:109:24` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:121:14` - w-6 h-6 → use the shorthand size-6 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:130:14` - w-6 h-6 → use the shorthand size-6 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:142:14` - w-6 h-6 → use the shorthand size-6 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:180:14` - w-6 h-6 → use the shorthand size-6 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:191:14` - w-6 h-6 → use the shorthand size-6 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:203:22` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:250:14` - w-6 h-6 → use the shorthand size-6 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:397:23` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:555:25` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:593:16` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:604:16` - w-10 h-10 → use the shorthand size-10 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:605:20` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:218:23` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:371:25` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:401:28` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:468:23` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:474:26` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:485:26` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:496:26` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:507:26` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:508:38` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:525:31` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:527:26` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:555:16` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:566:16` - w-10 h-10 → use the shorthand size-10 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:567:23` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/portfolio/PortfolioPage.tsx:677:16` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/portfolio/ui/PortfolioEmptyStates.tsx:15:12` - w-16 h-16 → use the shorthand size-16 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/portfolio/ui/PortfolioEmptyStates.tsx:16:17` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/portfolio/ui/PortfolioEmptyStates.tsx:44:12` - w-16 h-16 → use the shorthand size-16 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/portfolio/ui/PortfolioEmptyStates.tsx:45:17` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/portfolio/ui/PortfolioSections.tsx:183:21` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/portfolio/ui/PortfolioSections.tsx:246:20` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/portfolio/ui/PositionCardSections.tsx:53:16` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:213:37` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:217:26` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:257:25` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:319:37` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:348:23` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:354:26` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:365:26` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:376:26` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:457:31` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:459:26` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:490:16` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:501:16` - w-10 h-10 → use the shorthand size-10 (Tailwind v3.4+)
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:502:29` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/shared/layout/MobileNav.tsx:80:19` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/shared/layout/MobileNav.tsx:88:35` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/shared/layout/MobileNav.tsx:94:25` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/shared/layout/MobileNav.tsx:103:29` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/shared/layout/MobileNav.tsx:109:21` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/shared/layout/mode-toggle.tsx:66:22` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/shared/layout/mode-toggle.tsx:82:18` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/shared/layout/theme-toggle.tsx:18:28` - w-9 h-9 → use the shorthand size-9 (Tailwind v3.4+)
  - `packages/frontend/src/shared/layout/theme-toggle.tsx:19:14` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/shared/layout/theme-toggle.tsx:20:15` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/shared/ui/GasEstimate.tsx:52:9` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/shared/ui/Skeleton.tsx:109:23` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/shared/ui/Skeleton.tsx:276:19` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/shared/ui/Skeleton.tsx:378:36` - w-10 h-10 → use the shorthand size-10 (Tailwind v3.4+)
  - `packages/frontend/src/shared/ui/Skeleton.tsx:417:21` - w-10 h-10 → use the shorthand size-10 (Tailwind v3.4+)
  - `packages/frontend/src/shared/ui/Sparkline.tsx:191:16` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/shared/ui/Sparkline.tsx:276:36` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/shared/ui/Sparkline.tsx:276:72` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/shared/ui/Sparkline.tsx:387:16` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/shared/ui/StatCard.tsx:157:60` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/shared/ui/StepProgress.tsx:70:28` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/DepthCurve.tsx:56:16` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/DepthCurve.tsx:63:21` - w-2 h-2 → use the shorthand size-2 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/DepthCurve.tsx:72:21` - w-2 h-2 → use the shorthand size-2 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/DepthCurve.tsx:314:19` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/DepthCurve.tsx:318:21` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/DepthCurve.tsx:337:19` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/DepthCurve.tsx:356:27` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/DepthCurve.tsx:366:25` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/DepthCurve.tsx:472:17` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/DepthCurve.tsx:512:77` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/DepthCurve.tsx:517:29` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/DepthCurve.tsx:522:31` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:87:20` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:116:19` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:122:19` - w-2 h-2 → use the shorthand size-2 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:129:19` - w-2 h-2 → use the shorthand size-2 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:157:26` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:165:25` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:173:23` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:180:26` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:240:23` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:287:18` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:291:26` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:310:18` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:314:21` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:335:18` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:381:27` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:390:30` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:399:23` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:408:20` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:421:26` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:425:27` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:429:22` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:556:43` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:558:45` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:588:17` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:626:30` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:632:29` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:637:34` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/FeeByMarket.tsx:237:22` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ImpliedVsRealizedChart.tsx:385:16` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ImpliedVsRealizedChart.tsx:389:16` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/IndexerStatusBanner.tsx:121:10` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/IndexerStatusBanner.tsx:134:10` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/IndexerStatusBanner.tsx:147:10` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ProtocolStats.tsx:111:27` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ProtocolStats.tsx:119:27` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ProtocolStats.tsx:127:25` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/ProtocolStats.tsx:146:24` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/RateSparkline.tsx:80:16` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/RateSparkline.tsx:130:38` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/RateSparkline.tsx:130:74` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/RateSparkline.tsx:187:16` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/RateSparkline.tsx:301:34` - w-2.5 h-2.5 → use the shorthand size-2.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/RateSparkline.tsx:301:74` - w-2.5 h-2.5 → use the shorthand size-2.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/RateSparkline.tsx:349:16` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/RateSparkline.tsx:393:23` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/RateSparkline.tsx:407:24` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/RateSparkline.tsx:409:26` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlBreakdown.tsx:189:22` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:67:19` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:73:19` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:80:21` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:87:24` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:214:17` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:218:23` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:240:19` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:258:25` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:267:28` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:276:29` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:287:23` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:313:17` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:359:23` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:368:26` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/TvlChart.tsx:377:27` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeByMarket.tsx:206:22` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:66:19` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:72:24` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:81:29` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:111:19` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:118:15` - w-2.5 h-2.5 → use the shorthand size-2.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:128:15` - w-2.5 h-2.5 → use the shorthand size-2.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:137:29` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:271:22` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:283:22` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:287:21` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:309:22` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:344:27` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:353:26` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:362:31` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:369:22` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:476:22` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:487:19` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:491:21` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:511:19` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:516:19` - w-2 h-2 → use the shorthand size-2 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:520:19` - w-2 h-2 → use the shorthand size-2 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:566:21` - w-2 h-2 → use the shorthand size-2 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/VolumeChart.tsx:575:21` - w-2 h-2 → use the shorthand size-2 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:102:11` - w-2.5 h-2.5 → use the shorthand size-2.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:110:25` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:119:20` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:126:23` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:133:20` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:161:19` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:166:23` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:195:23` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:204:18` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:213:18` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:242:22` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:249:19` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:256:23` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:286:21` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:446:21` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:458:21` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:462:22` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:493:25` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:501:15` - w-2 h-2 → use the shorthand size-2 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:525:23` - w-3.5 h-3.5 → use the shorthand size-3.5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:549:21` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:559:17` - w-2 h-2 → use the shorthand size-2 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/display/TxStatus.tsx:69:18` - w-10 h-10 → use the shorthand size-10 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/display/TxStatus.tsx:71:17` - w-6 h-6 → use the shorthand size-6 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/display/TxStatus.tsx:96:24` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/display/TxStatus.tsx:295:9` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/display/TxStatus.tsx:305:9` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/display/TxStatus.tsx:315:9` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/display/TxStatus.tsx:330:9` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/PnlBreakdown.tsx:328:23` - w-3 h-3 → use the shorthand size-3 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:124:23` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:130:18` - w-10 h-10 → use the shorthand size-10 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:131:25` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:148:23` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:282:23` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:288:18` - w-10 h-10 → use the shorthand size-10 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:289:25` - w-5 h-5 → use the shorthand size-5 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:306:23` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:432:27` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:449:27` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx:521:21` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/SimplePortfolio.tsx:40:14` - w-16 h-16 → use the shorthand size-16 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/SimplePortfolio.tsx:41:19` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/SimplePortfolio.tsx:84:23` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/SimplePortfolio.tsx:111:20` - w-4 h-4 → use the shorthand size-4 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/SimplePortfolio.tsx:149:16` - w-16 h-16 → use the shorthand size-16 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/SimplePortfolio.tsx:150:21` - w-8 h-8 → use the shorthand size-8 (Tailwind v3.4+)
  - `packages/frontend/src/widgets/portfolio/YieldByPosition.tsx:102:23` - w-10 h-10 → use the shorthand size-10 (Tailwind v3.4+)

### react-doctor/design-no-three-period-ellipsis

- Severity: warning
- Category: Architecture
- Count: 9
- Required fix: Use the typographic ellipsis "…" (or `&hellip;`) instead of three periods — pairs with action-with-followup labels ("Rename…", "Loading…")
- Diagnostic: Three-period ellipsis ("...") in JSX text — use the actual ellipsis character "…" (or `&hellip;`)
- Locations:
  - `packages/frontend/src/features/docs/ui/DocsSearch.tsx:208:44`
  - `packages/frontend/src/features/earn/ui/WrapToSyForm.tsx:262:57`
  - `packages/frontend/src/features/liquidity/ui/AddLiquidityForm.tsx:553:79`
  - `packages/frontend/src/features/liquidity/ui/RemoveLiquidityForm.tsx:599:81`
  - `packages/frontend/src/features/oracle/ui/OracleStatusBadge.tsx:33:49`
  - `packages/frontend/src/features/redeem/ui/UnwrapSyForm.tsx:245:57`
  - `packages/frontend/src/features/rewards/ui/RewardClaimHistory.tsx:116:28`
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:63:53`
  - `packages/frontend/src/page-compositions/faucet/FaucetPage.tsx:343:68`

### react-doctor/no-generic-handler-names

- Severity: warning
- Category: Architecture
- Count: 2
- Required fix: Rename to describe the action: e.g. `handleSubmit` → `saveUserProfile`, `handleClick` → `toggleSidebar`
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/src/features/mint/ui/TokenInput.tsx:299:13` - Non-descriptive handler name "handleBlur" — name should describe what it does, not when it runs
  - `packages/frontend/src/shared/ui/Input.tsx:130:9` - Non-descriptive handler name "handleChange" — name should describe what it does, not when it runs

### react-doctor/no-giant-component

- Severity: warning
- Category: Architecture
- Count: 12
- Required fix: Extract logical sections into focused components: `<UserHeader />`, `<UserActions />`, etc.
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/src/features/earn/ui/SimpleWithdrawForm.tsx:127:17` - Component "SimpleWithdrawForm" is 326 lines — consider breaking it into smaller focused components
  - `packages/frontend/src/features/liquidity/ui/AddLiquidityForm.tsx:215:17` - Component "AddLiquidityForm" is 460 lines — consider breaking it into smaller focused components
  - `packages/frontend/src/features/liquidity/ui/RemoveLiquidityForm.tsx:265:17` - Component "RemoveLiquidityForm" is 437 lines — consider breaking it into smaller focused components
  - `packages/frontend/src/features/liquidity/ui/TokenAggregatorLiquidityForm.tsx:222:17` - Component "TokenAggregatorLiquidityForm" is 604 lines — consider breaking it into smaller focused components
  - `packages/frontend/src/features/swap/ui/SwapForm.tsx:76:17` - Component "SwapForm" is 525 lines — consider breaking it into smaller focused components
  - `packages/frontend/src/features/swap/ui/TokenAggregatorSwapForm.tsx:236:17` - Component "TokenAggregatorSwapForm" is 572 lines — consider breaking it into smaller focused components
  - `packages/frontend/src/page-compositions/analytics/AnalyticsPage.tsx:129:17` - Component "AnalyticsPage" is 332 lines — consider breaking it into smaller focused components
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:229:10` - Component "PoolsPageContent" is 316 lines — consider breaking it into smaller focused components
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:94:10` - Component "TradePageContent" is 386 lines — consider breaking it into smaller focused components
  - `packages/frontend/src/widgets/analytics/ExecutionQualityPanel.tsx:190:17` - Component "ExecutionQualityPanel" is 408 lines — consider breaking it into smaller focused components
  - `packages/frontend/src/widgets/analytics/YieldCurveChart.tsx:337:17` - Component "YieldCurveChart" is 307 lines — consider breaking it into smaller focused components
  - `packages/frontend/src/widgets/portfolio/PnlBreakdown.tsx:54:17` - Component "PnlBreakdown" is 328 lines — consider breaking it into smaller focused components

### react-doctor/no-inline-exhaustive-style

- Severity: warning
- Category: Architecture
- Count: 1
- Required fix: Move styles to a CSS class, CSS module, Tailwind utilities, or a styled component — inline objects with many properties hurt readability and create new references every render
- Diagnostic: 9 inline style properties — extract to a CSS class, CSS module, or styled component for maintainability and reuse
- Locations:
  - `packages/frontend/src/app/global-error.tsx:26:18`

### react-doctor/no-many-boolean-props

- Severity: warning
- Category: Architecture
- Count: 1
- Required fix: Split into compound components or named variants: `<Button.Primary />`, `<DialogConfirm />` instead of stacking `isPrimary`, `isConfirm` flags
- Diagnostic: Component "SwapDetails" takes 4 boolean-like props (isValidAmount, isEstimatingFee, isPreviewLoading…) — consider compound components or explicit variants instead of stacking flags
- Locations:
  - `packages/frontend/src/features/swap/ui/SwapDetails.tsx:58:17`

### react-doctor/no-react19-deprecated-apis

- Severity: warning
- Category: Architecture
- Count: 8
- Required fix: Pass `ref` as a regular prop on function components — `forwardRef` is no longer needed in React 19+. Replace `useContext(X)` with `use(X)` for branch-aware context reads. Only enabled on projects detected as React 19+.
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/src/features/tx-settings/model/context.tsx:3:38` - useContext is superseded by `use()` on React 19+ — `use()` reads context conditionally inside hooks, branches, and loops; switch to `import { use } from 'react'`
  - `packages/frontend/src/features/wallet/model/useStarknet.ts:3:10` - useContext is superseded by `use()` on React 19+ — `use()` reads context conditionally inside hooks, branches, and loops; switch to `import { use } from 'react'`
  - `packages/frontend/src/shared/security/NonceProvider.tsx:3:25` - useContext is superseded by `use()` on React 19+ — `use()` reads context conditionally inside hooks, branches, and loops; switch to `import { use } from 'react'`
  - `packages/frontend/src/shared/theme/ui-mode-context.tsx:3:38` - useContext is superseded by `use()` on React 19+ — `use()` reads context conditionally inside hooks, branches, and loops; switch to `import { use } from 'react'`
  - `packages/frontend/src/shared/ui/Input.tsx:13:15` - forwardRef is no longer needed on React 19+ — refs are regular props on function components; remove forwardRef and pass ref directly
  - `packages/frontend/src/shared/ui/Input.tsx:57:19` - forwardRef is no longer needed on React 19+ — refs are regular props on function components; remove forwardRef and pass ref directly
  - `packages/frontend/src/shared/ui/Input.tsx:103:21` - forwardRef is no longer needed on React 19+ — refs are regular props on function components; remove forwardRef and pass ref directly
  - `packages/frontend/src/shared/ui/toggle-group.tsx:63:19` - useContext is superseded by `use()` on React 19+ — `use()` reads context conditionally inside hooks, branches, and loops; switch to `import { use } from 'react'`

### react-doctor/no-render-in-render

- Severity: warning
- Category: Architecture
- Count: 1
- Required fix: Extract to a named component: `const ListItem = ({ item }) => <div>{item.name}</div>`
- Diagnostic: Inline render function "renderPositionCards()" — extract to a separate component for proper reconciliation
- Locations:
  - `packages/frontend/src/page-compositions/portfolio/PortfolioPage.tsx:652:10`

### react-doctor/no-side-tab-border

- Severity: warning
- Category: Architecture
- Count: 1
- Required fix: Use a subtler accent (box-shadow inset, background gradient, or border-bottom) instead of a thick one-sided border
- Diagnostic: Thick one-sided border (border-l-4) — the most recognizable tell of AI-generated UIs. Use a subtler accent or remove it
- Locations:
  - `packages/frontend/mdx-components.tsx:83:7`

### react-doctor/react-compiler-destructure-method

- Severity: warning
- Category: Architecture
- Count: 8
- Required fix: Destructure the method up front: `const { push } = useRouter()` then call `push(...)` directly — clearer dependency graph and easier for React Compiler to memoize
- Diagnostics vary by occurrence; see each location.
- Locations:
  - `packages/frontend/src/features/docs/ui/DocsSearch.tsx:153:7` - Destructure for clarity: `const { push } = useRouter()` then call `push(...)` directly — easier for React Compiler to memoize and clearer about which methods this component depends on
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:269:23` - Destructure for clarity: `const { get } = useSearchParams()` then call `get(...)` directly — easier for React Compiler to memoize and clearer about which methods this component depends on
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:423:23` - Destructure for clarity: `const { get } = useSearchParams()` then call `get(...)` directly — easier for React Compiler to memoize and clearer about which methods this component depends on
  - `packages/frontend/src/page-compositions/mint/MintPage.tsx:424:20` - Destructure for clarity: `const { get } = useSearchParams()` then call `get(...)` directly — easier for React Compiler to memoize and clearer about which methods this component depends on
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:232:23` - Destructure for clarity: `const { get } = useSearchParams()` then call `get(...)` directly — easier for React Compiler to memoize and clearer about which methods this component depends on
  - `packages/frontend/src/page-compositions/pools/PoolsPage.tsx:252:7` - Destructure for clarity: `const { push } = useRouter()` then call `push(...)` directly — easier for React Compiler to memoize and clearer about which methods this component depends on
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:97:23` - Destructure for clarity: `const { get } = useSearchParams()` then call `get(...)` directly — easier for React Compiler to memoize and clearer about which methods this component depends on
  - `packages/frontend/src/page-compositions/trade/TradePage.tsx:133:7` - Destructure for clarity: `const { push } = useRouter()` then call `push(...)` directly — easier for React Compiler to memoize and clearer about which methods this component depends on

