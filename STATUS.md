# Agent Team Status

## Active Work
- issue: #84 Replace the home hero with a protocol workbench
  owner: builder-agent pending spawn
  branch: codex/issue-84-home-workbench
  worktree: /Users/alexmetelli/source/horizon-starknet-issue-84
  pr: none
  phase: implementing
  cycle: 0/5
  blocker: none
- issue: #85 Redesign the frontend app chrome and footer colophon
  owner: builder-agent pending spawn
  branch: codex/issue-85-app-chrome-colophon
  worktree: /Users/alexmetelli/source/horizon-starknet-issue-85
  pr: none
  phase: implementing
  cycle: 0/5
  blocker: none
- issue: #86 Make market APY details touch-accessible and reduce card glow
  owner: builder-agent pending spawn
  branch: codex/issue-86-market-apy-access
  worktree: /Users/alexmetelli/source/horizon-starknet-issue-86
  pr: none
  phase: implementing
  cycle: 0/5
  blocker: none

## Target Queue
- repo: `ametel01/horizon-starknet`
- completed:
  - #82 Set up tracking and capture frontend redesign baseline
  - #83 Establish frontend token, motion, and no-overflow foundation
- remaining:
  - #84 Replace the home hero with a protocol workbench
  - #85 Redesign the frontend app chrome and footer colophon
  - #86 Make market APY details touch-accessible and reduce card glow
  - #87 Verify the Hallmark frontend redesign against gates and viewports

## Dependency Graph
- wave 0: #82 closed by PR #88
- wave 1: #83 closed by PR #89
- wave 2: #84, #85, and #86 ready in parallel after #83
- wave 3: #87 blocked by #84, #85, and #86

## Completion Contract
- issue: #84 Replace the home hero with a protocol workbench
  readiness: ready
  outcome: Replace the current centered marketing hero with a dense Horizon protocol workbench that foregrounds market state, rate context, and primary user paths while preserving simple and advanced UI modes.
  acceptance criteria:
    - Home first viewport no longer uses the tall centered `min-h-[70vh]` hero, radial glow layers, floating circular stat orbs, or generic staggered marketing composition as the main structure.
    - Home presents only live or fallback-safe protocol metrics from existing frontend data sources such as `useDashboardMarkets`, price helpers, and existing protocol stats; loading, empty, offline, and indexer-unavailable states remain honest.
    - Simple mode still emphasizes fixed-yield earning and routes toward `/mint`; advanced mode still exposes mint, trade, pools, portfolio, and analytics paths as applicable.
    - The generic `What you can do` card grid is replaced or reshaped into a protocol-specific action path or compact task rail without taking over #85 app chrome/footer scope or #86 market APY/card-detail scope.
    - Existing market list remains reachable below/within the workbench and still supports degraded local RPC/indexer states covered by current e2e accepted-state patterns.
    - Navigation and markets e2e assertions no longer encode the old hero headings, floating-orb stats, or old feature-card rhythm.
    - `PROGRESS.md` is updated only for Step 2/#84 validation evidence, and `CHANGELOG.md` records only the visible home redesign.
  non-goals:
    - Do not redesign shared header, mobile navigation, footer, or protocol colophon except for a narrow route/copy integration point explicitly needed by the home workbench.
    - Do not implement market-card APY disclosure, touch-accessible APY details, or market-card glow reductions owned by #86.
    - Do not change contracts, indexer schemas, APIs, Starknet transaction behavior, oracle math, fee logic, deployment addresses, README live-address tables, dependencies, or lockfiles.
    - Do not invent TVL, APY, volume, user, or proof metrics; show unavailable/empty states instead.
  likely touchpoints:
    - `packages/frontend/src/widgets/hero/HeroSection.tsx`
    - `packages/frontend/src/app/home-page-client.tsx`
    - `packages/frontend/e2e/navigation.spec.ts`
    - `packages/frontend/e2e/markets.spec.ts`
    - Related existing data/UI references: `packages/frontend/src/features/markets/model/useMarkets.ts`, `packages/frontend/src/widgets/analytics/ProtocolStats.tsx`, `packages/frontend/src/entities/market/ui/MarketList.tsx`, `packages/frontend/src/entities/market/ui/SimpleMarketList.tsx`, `packages/frontend/src/shared/theme/ui-mode-context.tsx`
  required tests/gates:
    - `bun run --cwd packages/frontend format:check`
    - `bun run --cwd packages/frontend lint`
    - `bun run --cwd packages/frontend typecheck`
    - `bun run --cwd packages/frontend test`
    - `bun run --cwd packages/frontend test:e2e e2e/navigation.spec.ts --project=chromium`
    - `bun run --cwd packages/frontend test:e2e e2e/markets.spec.ts --project=chromium`
    - If `bun run --cwd packages/frontend build` is attempted and hangs at `Creating an optimized production build ...`, record it against the known local baseline and verify whether CI/build context passes before calling it a #84 regression.
  risks:
    - Home uses live market/price hooks; rendering must not turn unavailable indexer/RPC or price data into fake zero-confidence claims.
    - Workbench copy and action hierarchy can accidentally overlap #85 route chrome or #86 market-card details; keep shared layout and market card edits out unless a narrow integration point is documented.
    - E2E tests currently assert old hero headings and floating-orb stats, so test updates must prove the new workbench behavior rather than weakening coverage.
  do-not-touch:
    - Preserve untracked local artifacts `PLAN.md`, `hallmark-frontend-created-issues.json`, and `hallmark-frontend-issues.json`.
    - Avoid `packages/frontend/src/shared/layout/Header.tsx`, `packages/frontend/src/shared/layout/Footer.tsx`, and `packages/frontend/src/shared/layout/MobileNav.tsx` except for documented minimal integration with #84.
    - Avoid `packages/frontend/src/entities/market/ui/MarketCard.tsx` APY/detail behavior except for reading context.
    - Avoid contracts, indexer, docs unrelated to #84, CI, deployment, dependency, lockfile, license, and README address changes.
  dependency blockers:
    - None. #82 closed by PR #88 and #83 closed by PR #89; issue #84 is unblocked and parallel-safe with #85/#86.
  open questions:
    - Whether the final workbench should keep a level-1 heading text close to the old simple/advanced labels or use a new stable accessible heading; builder should choose a testable heading that reflects the workbench and update e2e expectations.
    - Whether `ProtocolStats` remains a separate band below the first viewport or is integrated into the workbench; either is acceptable if duplicated/conflicting metrics are avoided and loading/error states stay clear.
- issue: #85 Redesign the frontend app chrome and footer colophon
  readiness: ready
  outcome: Replace the stock SaaS header/footer pattern with compact Horizon protocol app chrome and a real protocol colophon while preserving wallet connection, theme toggle, simple/advanced mode behavior, and route access.
  acceptance criteria:
    - Header no longer reads as wordmark-left, inline link list, CTA-right marketing chrome; it prioritizes app status, wallet/network actions, theme/mode controls, and compact app navigation.
    - Mobile header, hamburger/menu state, mode toggle, onboarding tooltip, wallet button, and bottom navigation fit inside 320px without horizontal overflow.
    - Footer no longer uses Product/Learn/Resources/Legal stock columns; it becomes a compact protocol colophon with only real route, legal, status, and Starknet/protocol content.
    - Manual SVG chrome icons touched by this slice are replaced with existing `lucide-react` icons where suitable.
    - Existing simple and advanced navigation paths remain reachable: `/`, `/mint`, `/trade`, `/pools`, `/portfolio`, `/docs`, plus existing legal/docs footer targets that still exist.
    - `packages/frontend/e2e/navigation.spec.ts` is updated if selectors/copy change and continues to cover navigation, mode/theme controls, mobile navigation, and no horizontal overflow at 320, 375, 414, 768, and 1280 px.
    - `PROGRESS.md` records #85 validation evidence, and `CHANGELOG.md` records only the visible app chrome/footer redesign for this slice.
  non-goals:
    - Do not redesign the #84 home workbench/hero, #86 market APY/card presentation, docs content, legal page content, analytics data, wallet connection internals, Starknet provider behavior, indexer behavior, contracts, deployment addresses, dependencies, lockfiles, or CI.
    - Do not claim #84 home scope or #86 market card/APY scope except for narrow shell integration needed to keep navigation and layout coherent.
    - Do not introduce fake protocol metrics, fake footer links, new icon libraries, new animation libraries, or broad design-system rewrites.
  likely touchpoints:
    - `packages/frontend/src/shared/layout/Header.tsx`
    - `packages/frontend/src/shared/layout/Footer.tsx`
    - `packages/frontend/src/shared/layout/MobileNav.tsx`
    - `packages/frontend/src/shared/layout/mode-toggle.tsx`
    - `packages/frontend/src/shared/layout/theme-toggle.tsx`
    - `packages/frontend/src/app/layout.tsx`
    - `packages/frontend/e2e/navigation.spec.ts`
    - `PROGRESS.md`
    - `CHANGELOG.md`
  required tests/gates:
    - `bun run --cwd packages/frontend format:check`
    - `bun run --cwd packages/frontend lint`
    - `bun run --cwd packages/frontend typecheck`
    - `bun run --cwd packages/frontend test`
    - `bun run --cwd packages/frontend test:e2e e2e/navigation.spec.ts --project=chromium`
    - Optional if layout changes are broad or route semantics shift: `bun run --cwd packages/frontend check`
    - Build note: local `bun run --cwd packages/frontend build` has a documented baseline hang at `Creating an optimized production build ...`; run it if practical, but if it hangs, record the exact timeout/error and reference the baseline instead of treating it as a #85 regression.
  risks:
    - Wallet/network affordances must not misrepresent connection state or hide required disclaimers.
    - Frontend/indexer status copy must remain honest; do not show live or healthy protocol status unless backed by existing health data.
    - 320px layout regressions are likely because `ConnectButton`, `ModeToggle`, theme toggle, menu button, and tooltip compete for header width.
    - Changing global shell can affect every page, including docs, legal, analytics, and form pages.
  do-not-touch:
    - Preserve untracked local artifacts `PLAN.md`, `hallmark-frontend-created-issues.json`, and `hallmark-frontend-issues.json`.
    - Do not touch contracts, indexer, deployment workflows, README mainnet addresses, license metadata, package dependencies, lockfiles, or generated files.
    - Avoid #84-owned `HeroSection.tsx` / home workbench behavior and #86-owned `MarketCard.tsx` / APY detail behavior unless a narrow layout integration is unavoidable and documented.
  dependency blockers:
    - None. #82 is closed by PR #88 and #83 is closed by PR #89; #85 is unblocked and parallel-safe with #84 and #86.
    - #87 remains downstream and should stay blocked until #84, #85, and #86 merge.
  open questions:
    - What exact protocol status should the header expose if the existing indexer health banner is hidden by `showOnlyIssues={true}`? Default to existing health/status data only and avoid invented live claims.
    - Should advanced-only routes be visible but disabled in simple mode, or stay hidden as today? Default to preserving current behavior unless the issue owner clarifies.

## Worktrees
- `/Users/alexmetelli/source/horizon-starknet`
  - branch: `main`
  - owner: coordinator
  - phase: coordinating
  - cleanliness: tracked tree clean before this status reconciliation; preserved local source artifacts remain untracked: `PLAN.md`, `hallmark-frontend-created-issues.json`, and `hallmark-frontend-issues.json`.
- `/Users/alexmetelli/source/horizon-starknet-issue-84`
  - branch: `codex/issue-84-home-workbench`
  - owner: builder-agent pending spawn
  - phase: implementing #84
  - cleanliness: clean at creation from `origin/main`.
- `/Users/alexmetelli/source/horizon-starknet-issue-85`
  - branch: `codex/issue-85-app-chrome-colophon`
  - owner: builder-agent pending spawn
  - phase: implementing #85
  - cleanliness: clean at creation from `origin/main`.
- `/Users/alexmetelli/source/horizon-starknet-issue-86`
  - branch: `codex/issue-86-market-apy-access`
  - owner: builder-agent pending spawn
  - phase: implementing #86
  - cleanliness: clean at creation from `origin/main`.

## Gates
- command: `git worktree add /Users/alexmetelli/source/horizon-starknet-issue-84 -b codex/issue-84-home-workbench origin/main`
  result: passed
  evidence: created clean #84 worktree at `2c8d23834abe8ad2d9f5790f1fd4431ca1551f9e`.
- command: `git worktree add /Users/alexmetelli/source/horizon-starknet-issue-85 -b codex/issue-85-app-chrome-colophon origin/main`
  result: passed
  evidence: created clean #85 worktree at `2c8d23834abe8ad2d9f5790f1fd4431ca1551f9e`.
- command: `git worktree add /Users/alexmetelli/source/horizon-starknet-issue-86 -b codex/issue-86-market-apy-access origin/main`
  result: passed
  evidence: created clean #86 worktree at `2c8d23834abe8ad2d9f5790f1fd4431ca1551f9e`.
- command: `gh issue view 84 --json number,title,state,body,comments,labels,url`
  result: passed
  evidence: issue #84 is OPEN, has no comments, is labeled `agent-ready`, `area:frontend`, `area:design`, `area:tests`, `type:feature`, and `parallel-safe`; body says it was blocked only by #83 and is parallel-safe with #85/#86.
- command: `gh issue view 85 --json number,title,state,body,comments,labels,url`
  result: passed
  evidence: issue #85 is OPEN, has no comments, is labeled `agent-ready`, `area:frontend`, `area:design`, `area:tests`, `type:feature`, and `parallel-safe`; body says it was blocked only by #83 and is parallel-safe with #84/#86.
- command: `gh issue view 86 --json number,title,state,body,comments,url`
  result: passed
  evidence: issue #86 is OPEN, owns market-card APY/detail accessibility and card-glow scope, has no comments, and is parallel-safe with #84/#85 after #83.
- command: `gh issue view 83 --json number,title,state,closedAt,url,body,comments`
  result: passed
  evidence: issue #83 is CLOSED at 2026-07-09T07:06:25Z, so #84 is unblocked.
- command: `gh pr view 89 --json number,title,state,mergedAt,mergeCommit,url,closingIssuesReferences,files`
  result: passed
  evidence: PR #89 is MERGED at 2026-07-09T07:06:24Z with merge commit `09320febb24a50ca183aa8f2aaf8a13ccc6a3ced`; it closed only #83 and touched frontend foundation files, not a #84 home workbench implementation.
- command: `gh issue view 86 --json number,title,state,body,comments,labels,url`
  result: passed
  evidence: issue #86 is OPEN, has no comments, is labeled `agent-ready`, `area:frontend`, `area:design`, `area:tests`, `area:accessibility`, and `parallel-safe`; body says it was blocked only by #83.
- command: `gh issue view 83 --json number,title,state,closedAt,url,comments`
  result: passed
  evidence: issue #83 is CLOSED at 2026-07-09T07:06:25Z, so #86 is unblocked.
- command: `gh pr list --state all --search "86" --json number,title,state,url,body,closingIssuesReferences --limit 20`
  result: passed
  evidence: no open PR currently claims or closes #86; merged PR #89 explicitly lists #86 as downstream unblocked and out of #83 scope.
- command: `gh pr view 89 --json state,mergedAt,mergeCommit,url,closingIssuesReferences`
  result: passed
  evidence: PR #89 is merged at 2026-07-09T07:06:24Z with merge commit `09320febb24a50ca183aa8f2aaf8a13ccc6a3ced`; closing reference is only issue #83.
- command: `gh issue view 83 --json number,state,closedAt,url,title`
  result: passed
  evidence: issue #83 is closed at 2026-07-09T07:06:25Z.
- command: `gh issue list --state open --limit 100`
  result: passed
  evidence: issues #84, #85, #86, and #87 remain open.
- command: `gh pr list --state open --limit 100`
  result: passed
  evidence: no open PRs after PR #89 merge.
- command: `git push origin --delete codex/issue-83-frontend-foundation`
  result: passed
  evidence: remote issue #83 branch was deleted after PR #89 merged.
- command: `git worktree remove /Users/alexmetelli/source/horizon-starknet-issue-83`
  result: passed
  evidence: clean issue #83 worktree was removed after merge.
- command: `git branch -D codex/issue-83-frontend-foundation`
  result: passed
  evidence: local issue #83 branch was force-deleted because squash merge leaves the exact branch commit unmerged locally.

## Handoffs
- from: issue-spec-agent
  to: builder-agent
  timestamp: 2026-07-09
  request: Implement issue #84 only. Replace the home hero with a protocol workbench using existing market/price/protocol-stat data sources, preserve simple/advanced routes, update focused navigation and markets e2e expectations, and update `PROGRESS.md`/`CHANGELOG.md` only for the #84 slice.
  evidence: Read `STATUS.md`, `PROGRESS.md`, `CHANGELOG.md`, `PLAN.md`, `AGENTS.md`, issue #84, linked issues #82/#83/#85/#86, PR #89, `packages/frontend/package.json`, `packages/frontend/src/widgets/hero/HeroSection.tsx`, `packages/frontend/src/app/home-page-client.tsx`, `packages/frontend/e2e/navigation.spec.ts`, `packages/frontend/e2e/markets.spec.ts`, `useDashboardMarkets`, `ProtocolStats`, `MarketList`, `SimpleMarketList`, market data types, and UI mode context. Current target code still uses centered `min-h-[70vh]`, radial glow layers, stat orbs, old hero headings, and a generic `What you can do` grid.
  next-action: Start from `packages/frontend/src/widgets/hero/HeroSection.tsx` and `packages/frontend/src/app/home-page-client.tsx`; coordinate only if #85 touches route/chrome copy or #86 touches home market-list expectations.

- from: issue-spec-agent
  to: builder-agent
  timestamp: 2026-07-09
  request: Implement issue #86 only. Make market-card APY/oracle details reachable without hover-only interaction, reduce generated glow/hover treatment, update focused markets e2e coverage, and update `PROGRESS.md`/`CHANGELOG.md` only for the #86 slice.
  evidence: Read `STATUS.md`, `PROGRESS.md`, `CHANGELOG.md`, `PLAN.md`, `AGENTS.md`, issue #86, issue #83, issues #84/#85 bodies, PR search for #86, `packages/frontend/package.json`, `packages/frontend/src/entities/market/ui/MarketCard.tsx`, `MarketList.tsx`, `SimpleMarketCard.tsx`, `packages/frontend/e2e/markets.spec.ts`, `home-page-client.tsx`, `HeroSection.tsx`, APY breakdown/oracle utilities, and market data types. Current target code uses `HoverCard`, `card-hover-glow`, `transition-all`, a yield-intensity overlay, and hover-revealed action opacity in `MarketCard.tsx`.
  next-action: Start from `packages/frontend/src/entities/market/ui/MarketCard.tsx`; coordinate with #84 only if home market-list expectations need a narrow test assertion update.

- from: issue-spec-agent
  to: builder-agent
  timestamp: 2026-07-09
  request: Implement issue #85 only. Redesign frontend app chrome and footer colophon, preserve wallet/theme/mode behavior and all simple/advanced route access, update focused navigation e2e coverage, and update `PROGRESS.md`/`CHANGELOG.md` only for the #85 slice.
  evidence: Read `STATUS.md`, `PROGRESS.md`, `CHANGELOG.md`, `PLAN.md`, `AGENTS.md`, issue #85, issues #82/#83/#84/#86, PR #89, `packages/frontend/package.json`, `Header.tsx`, `Footer.tsx`, `MobileNav.tsx`, `mode-toggle.tsx`, `theme-toggle.tsx`, `app/layout.tsx`, `home-page-client.tsx`, `ConnectButton.tsx`, `IndexerStatusBanner.tsx`, and `packages/frontend/e2e/navigation.spec.ts`. Current target code still has inline header links, `Connect Wallet` CTA-right chrome, manual SVG menu/dismiss icons in touched chrome, four stock footer columns, and 320px-sensitive header controls.
  next-action: Start from `packages/frontend/src/shared/layout/Header.tsx`, `Footer.tsx`, `MobileNav.tsx`, and `mode-toggle.tsx`; coordinate with #84/#86 only for narrow route/test integration.

- from: coordinator
  to: issue-spec-agent
  timestamp: 2026-07-09
  request: Produce completion contracts for issues #84, #85, and #86 in parallel using GitHub issues, `PROGRESS.md`, `CHANGELOG.md`, `PLAN.md`, relevant frontend source/tests, and the merged #83 foundation.
  evidence: #83 is closed by merged PR #89; #84, #85, and #86 are now unblocked and marked parallel-safe in their issue bodies.
  next-action: Spec #84, #85, and #86 before assigning builders.

## Blockers
- none for #84/#85/#86 spec.

## Completion Contract - Issue #86
Issue: #86 Make market APY details touch-accessible and reduce card glow
Readiness: ready
Outcome: Market cards keep the same protocol data and actions, but APY/oracle explanation is available through touch and keyboard paths instead of a hover-only `HoverCard`; generated-looking card glow, broad transitions, and gratuitous hover emphasis are reduced.
Acceptance Criteria:
- APY breakdown and oracle context are reachable without hover, including keyboard and touch paths.
- Market cards preserve implied APY, spot/TWAP status, exchange rates, negative-yield warning, expiry badge, trade/pool actions, and advanced-mode fee/rate details.
- Generic APY glow overlays, `card-hover-glow`, broad `transition-all`, and unnecessary hover shadow/glow treatment are removed or replaced with restrained explicit state styling in the market-card surface.
- `packages/frontend/e2e/markets.spec.ts` verifies the non-hover APY details path and confirms market-card trade/pool actions remain available when markets render.
- No invented APY, TVL, oracle, exchange-rate, or protocol data is introduced.
- `PROGRESS.md` records #86 validation evidence, and `CHANGELOG.md` records the visible market-card accessibility/design change only for this slice.
Non-goals:
- Do not implement the #84 home workbench, hero replacement, or generic feature-grid redesign.
- Do not implement the #85 app chrome, mobile nav, footer colophon, or wallet/mode chrome redesign.
- Do not change market math, APY calculation formulas, oracle readiness semantics, indexer APIs, contract calls, transaction behavior, routes, deployment config, dependencies, or lockfiles.
- Do not remove APY/advanced details because they are visually hard; preserve or restate them in an accessible compact pattern.
Likely Touchpoints:
- `packages/frontend/src/entities/market/ui/MarketCard.tsx` for the APY disclosure/details UI, card styling, yield bar transitions, and action visibility.
- `packages/frontend/e2e/markets.spec.ts` for regression coverage around APY details and Trade PT/Pool actions.
- `packages/frontend/src/features/yield/ui/ApyBreakdown.tsx`, `packages/frontend/src/features/yield/model/useApyBreakdown.ts`, `packages/frontend/src/features/oracle/ui/OracleStatusBadge.tsx`, and `packages/frontend/src/entities/market/model/types.ts` as read-only reference unless a narrow accessibility integration requires a local prop or wrapper change.
- `packages/frontend/src/entities/market/ui/MarketList.tsx`, `packages/frontend/src/app/home-page-client.tsx`, and `packages/frontend/src/widgets/hero/HeroSection.tsx` only as integration/test context because #84 may change the home surface in parallel.
Required Tests / Gates:
- `bun run --cwd packages/frontend format:check`
- `bun run --cwd packages/frontend lint`
- `bun run --cwd packages/frontend typecheck`
- `bun run --cwd packages/frontend test`
- `bun run --cwd packages/frontend test:e2e e2e/markets.spec.ts --project=chromium`
- Optional broader e2e if the builder changes shared market-list/home expectations: `bun run --cwd packages/frontend test:e2e e2e/navigation.spec.ts --project=chromium`
Security / Data / Migration Risks:
- Oracle/TWAP and APY labels affect DeFi decision-making; preserve existing data sources and distinguish TWAP, spot-only, partial, and current spot values honestly.
- `useApyBreakdown` currently has fallback/estimated underlying-yield behavior; do not make fallback values look more authoritative than they are.
- No storage, migration, contract, indexer schema, deployment, secrets, or wallet transaction risk should be introduced by this frontend-only issue.
Do Not Touch:
- Contracts, indexer, `.github/workflows`, README deployment addresses, license metadata, dependency manifests, lockfiles, generated ABI files, and local untracked artifacts `PLAN.md`, `hallmark-frontend-created-issues.json`, `hallmark-frontend-issues.json`.
- #84-owned hero/workbench and #85-owned chrome/footer implementation scope, except for narrow test or integration text that is documented in the PR.
Dependency Blockers:
- #82 is closed by PR #88, and #83 is closed by PR #89; no active dependency blocker remains for #86.
- #84 and #85 may proceed in parallel later; coordinate if both branches touch home market-list expectations or shared viewport assertions.
- #87 remains downstream and should stay blocked until #84, #85, and #86 merge.
Open Questions:
- None blocking. Builder may choose the exact pattern, but it must be checkable by keyboard/touch, such as a visible compact details row, an accessible disclosure, or a tap-open panel.

## Decisions And Lessons
- 2026-07-09: For same-author PRs, maintainer-reviewer approval can be recorded as a COMMENT review when GitHub rejects formal approval; PR #88 used review `4660459239`, and PR #89 used review `4660641271`.
- 2026-07-09: Local `next build` can hang at `Creating an optimized production build ...`; PR #88 records this as baseline evidence, while GitHub Build passed for PR #89.
- 2026-07-09: Preserve local source artifacts `PLAN.md`, `hallmark-frontend-created-issues.json`, and `hallmark-frontend-issues.json` unless a future issue explicitly scopes them.
- 2026-07-09: Use `codex/...` branch prefixes for agent streams.
- 2026-07-09: #83 retrospective `create-process-issue` recommendation is downgraded to status-lesson-only for this run; no separate GitHub process issue unless the same closeout friction repeats beyond #84/#85/#86.

## Completed
- issue: #82 Set up tracking and capture frontend redesign baseline
  pr: https://github.com/ametel01/horizon-starknet/pull/88
  merge: 743db2bda2ed3fa5fa6ea13b65e6828b29f378c9
  final-review: https://github.com/ametel01/horizon-starknet/pull/88#pullrequestreview-4660459239
- issue: #83 Establish frontend token, motion, and no-overflow foundation
  pr: https://github.com/ametel01/horizon-starknet/pull/89
  merge: 09320febb24a50ca183aa8f2aaf8a13ccc6a3ced
  final-review: https://github.com/ametel01/horizon-starknet/pull/89#pullrequestreview-4660641271
