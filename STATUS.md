# Agent Team Status

## Active Work
- issue: #85 Redesign the frontend app chrome and footer colophon
  owner: builder-agent Noether (`019f45bf-1bba-7fa1-8c82-cb2d3c90160d`)
  branch: codex/issue-85-app-chrome-colophon
  worktree: /Users/alexmetelli/source/horizon-starknet-issue-85
  pr: https://github.com/ametel01/horizon-starknet/pull/90
  phase: rebase-needed
  cycle: 0/5
  blocker: PR #90 is merge-dirty after #91 merged; rebase branch on current `origin/main`, rerun focused checks, renew review, then merge.

## Target Queue
- repo: `ametel01/horizon-starknet`
- completed:
  - #82 Set up tracking and capture frontend redesign baseline
  - #83 Establish frontend token, motion, and no-overflow foundation
  - #84 Replace the home hero with a protocol workbench
  - #86 Make market APY details touch-accessible and reduce card glow
- remaining:
  - #85 Redesign the frontend app chrome and footer colophon
  - #87 Verify the Hallmark frontend redesign against gates and viewports

## Dependency Graph
- wave 0: #82 closed by PR #88
- wave 1: #83 closed by PR #89
- wave 2: #84 closed by PR #91; #86 closed by PR #92; #85 remains active after #83
- wave 3: #87 blocked by #85

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
    - #87 remains downstream and should stay blocked until #85 merges.
  open questions:
    - What exact protocol status should the header expose if the existing indexer health banner is hidden by `showOnlyIssues={true}`? Default to existing health/status data only and avoid invented live claims.
    - Should advanced-only routes be visible but disabled in simple mode, or stay hidden as today? Default to preserving current behavior unless the issue owner clarifies.

## Worktrees
- `/Users/alexmetelli/source/horizon-starknet`
  - branch: `main`
  - owner: coordinator
  - phase: coordinating
  - cleanliness: tracked tree clean after post-#91 reconciliation commit; preserved local source artifacts remain untracked: `PLAN.md`, `hallmark-frontend-created-issues.json`, and `hallmark-frontend-issues.json`.
- `/Users/alexmetelli/source/horizon-starknet-issue-84`
  - branch: `codex/issue-84-home-workbench`
  - owner: builder-agent Archimedes (`019f45be-d26e-7353-b71d-40b38a523d8b`)
  - phase: merged #84 / cleanup pending
  - cleanliness: dirty local `STATUS.md` renewed-review evidence update after PR #91 merged; preserve worktree until coordinator records or explicitly discards it.
- `/Users/alexmetelli/source/horizon-starknet-issue-85`
  - branch: `codex/issue-85-app-chrome-colophon`
  - owner: builder-agent Noether (`019f45bf-1bba-7fa1-8c82-cb2d3c90160d`)
  - phase: rebase-needed #85 / PR #90
  - cleanliness: clean before #90 rebase; branch head `b7b4bf30f449215a4be437697b4b820f86c2a5d3`.
- `/Users/alexmetelli/source/horizon-starknet-issue-86`
  - branch: `codex/issue-86-market-apy-access`
  - owner: builder-agent Sagan (`019f45bf-d01f-7a12-8c72-5ad45b68ddce`)
  - phase: merged #86 / cleanup pending
  - cleanliness: dirty local `STATUS.md` review-evidence update after PR #92 merged; preserve worktree until coordinator records or explicitly discards it.

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
- command: `multi_agent_v1.spawn_agent` for #84/#85/#86 builders
  result: passed
  evidence: spawned #84 Archimedes `019f45be-d26e-7353-b71d-40b38a523d8b`, #85 Noether `019f45bf-1bba-7fa1-8c82-cb2d3c90160d`, and #86 Sagan `019f45bf-d01f-7a12-8c72-5ad45b68ddce`.
- command: `git show --stat --oneline --decorate --name-only HEAD` in `/Users/alexmetelli/source/horizon-starknet-issue-85`
  result: passed
  evidence: #85 builder committed `48593a6e0b272aca013d6d64e2b3f1e233e90ba7` touching only chrome/footer/navigation e2e/tracker files.
- command: `git show --stat --oneline --decorate --name-only HEAD` in `/Users/alexmetelli/source/horizon-starknet-issue-84`
  result: passed
  evidence: #84 builder committed `78d50fdd39f7c311a030057da109d6d75253ebf2` touching home workbench, navigation/markets e2e, and tracker files.
- command: `gh pr view 90 --json closingIssuesReferences,body`
  result: passed
  evidence: PR #90 is ready for review and closes only issue #85; context gate body includes dependencies, sibling issues, behavior scope, non-goals, validation, skipped checks, risks, and merge order.
- command: `gh pr view 91 --json closingIssuesReferences,body`
  result: passed
  evidence: PR #91 is ready for review and closes only issue #84; context gate body includes dependencies, sibling issues/PR #90, behavior scope, non-goals, validation, skipped checks, risks, and merge order.
- command: `multi_agent_v1.spawn_agent` for #86 checker
  result: passed
  evidence: spawned checker Hume `019f45d3-5c78-77c0-8f69-3be339acb491`.
- command: `gh pr view 92 --json closingIssuesReferences,body`
  result: passed
  evidence: PR #92 is ready for review and closes only issue #86; context gate body includes dependencies, sibling PRs, behavior scope, non-goals, validation, skipped checks, risks, and merge order.
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
- command: `bun install --frozen-lockfile`
  result: passed
  evidence: run from `packages/frontend` because package-local binaries were missing; restored frontend `node_modules` without manifest or lockfile changes.
- command: `bun run --cwd packages/frontend format:check`
  result: passed
  evidence: Biome formatted 469 frontend source files with no fixes applied after formatting `MarketCard.tsx`.
- command: `bun run --cwd packages/frontend lint`
  result: passed
  evidence: Biome lint checked 469 frontend source files with no fixes applied.
- command: `bun run --cwd packages/frontend typecheck`
  result: passed
  evidence: `tsc --noEmit` completed successfully.
- command: `bun run --cwd packages/frontend test`
  result: passed
  evidence: Bun reported 476 passing tests, 0 failures, and 810 assertions across 20 files.
- command: `bun run --cwd packages/frontend test:e2e e2e/markets.spec.ts --project=chromium`
  result: passed
  evidence: exact configured chromium markets spec passed 16/16 in 21.2s after a transient sibling-worktree port 3000 conflict cleared. Local logs still show expected missing `RPC_URL`/database fallback noise.
- command: `gh pr review 91 --approve --body-file -`
  result: failed
  evidence: GitHub rejected same-author approval with `Review Can not approve your own pull request`.
- command: `gh pr review 91 --comment --body-file -`
  result: passed
  evidence: submitted maintainer-reviewer evidence review `4661113927` at https://github.com/ametel01/horizon-starknet/pull/91#pullrequestreview-4661113927 with explicit `Decision: APPROVE`; this evidence belongs to pre-rebase head `d8210edd1d1f0ec10808f0c93381e0e931f80bb2` and must be renewed after the #92 rebase force-push.
- command: `gh pr view 91 --json closingIssuesReferences,body,headRefOid,mergeStateStatus,reviewDecision,state,isDraft,url`
  result: passed
  evidence: pre-merge context gate passed for head `68e0969d1d89c723b7091f4e6dbbe5369c7065fe`; PR #91 closed only #84 and merge state was `CLEAN`.
- command: `gh pr checks 91 --watch=false`
  result: passed
  evidence: Build, Code Quality, Unit Tests, E2E Tests, Quality Checks, Secret Scanning, Socket, GitGuardian, Vercel, and CodeRabbit passed; deploy jobs were skipped/ignored as expected.
- command: `gh pr merge 91 --squash --delete-branch`
  result: remote merge passed; local command exited 1 only because branch deletion failed while `codex/issue-84-home-workbench` remained checked out in `/Users/alexmetelli/source/horizon-starknet-issue-84`.
  evidence: PR #91 is MERGED at 2026-07-09T08:28:04Z with merge commit `245e50f5df8f642f18b8e3397eb92f2e09daf586`; issue #84 closed at 2026-07-09T08:28:05Z.
- command: `bun run --cwd packages/frontend format:check && bun run --cwd packages/frontend lint && bun run --cwd packages/frontend typecheck && bun run --cwd packages/frontend check`
  result: passed
  evidence: #85 builder validation passed; Biome format/lint/check all checked 469 files with no fixes applied and `tsc --noEmit` passed.
- command: `bun run --cwd packages/frontend test`
  result: passed
  evidence: #85 builder validation passed with 476 tests passed, 0 failed, and 810 expect calls across 20 files.
- command: `CI=1 bun run --cwd packages/frontend test:e2e e2e/navigation.spec.ts --project=chromium`
  result: passed
  evidence: #85 builder validation passed with 39 Chromium navigation tests on a fresh Playwright dev server. A prior non-CI rerun reused stale old localhost app code and then failed with `ERR_CONNECTION_REFUSED`; fresh-server rerun passed.

## Handoffs
- from: maintainer-reviewer
  to: coordinator
  timestamp: 2026-07-09
  request: Treat review `4661113927` as stale pre-rebase evidence only; after force-pushing the rebased #91 branch, wait for fresh checks and renew maintainer-reviewer acceptance before merge.
  evidence: Review `4661113927` was submitted as COMMENT because GitHub refused same-author approval; body states `Decision: APPROVE`. Findings: none. It reviewed pre-rebase head `d8210edd1d1f0ec10808f0c93381e0e931f80bb2`.
  next-action: Coordinator should force-push the rebased branch, wait for fresh CI, and request renewed review.

- from: builder-agent Sagan
  to: checker-agent
  timestamp: 2026-07-09
  request: Review issue #86 only on branch `codex/issue-86-market-apy-access`. Verify the market-card APY/oracle disclosure is non-hover accessible, market data/actions are preserved, glow/hover treatment is reduced, and the diff stays out of #84/#85 scope.
  changed-files: `packages/frontend/src/entities/market/ui/MarketCard.tsx`, `packages/frontend/e2e/markets.spec.ts`, `PROGRESS.md`, `CHANGELOG.md`, `STATUS.md`.
  evidence: Replaced `HoverCard` APY details with a visible `CollapsibleTrigger` disclosure that supports keyboard and pointer/touch activation; kept implied APY, current spot APY, oracle badge/detail, APY breakdown, TWAP/spot rows, stats, exchange rates, negative-yield warning, expiry badge, and Trade PT/Pool links. Removed the APY glow overlay, `card-hover-glow`, broad market-card/yield `transition-all`, and hover-revealed action opacity. Added markets e2e coverage that switches to advanced mode, opens details with keyboard and click, and checks Trade PT/Pool links when cards render.
  validation: `format:check`, `lint`, `typecheck`, `test`, and exact configured `test:e2e e2e/markets.spec.ts --project=chromium` passed.
  risks: Frontend-only. No market math, oracle semantics, indexer API, contract call, transaction behavior, route, dependency, lockfile, contract, CI, deployment, README address, or license changes. Coordination note: port 3000 was briefly occupied by a sibling worktree during local E2E, then cleared before the exact command passed on this branch.
  next-action: Checker should inspect the diff and rerun gates.

- from: checker-agent
  to: coordinator
  timestamp: 2026-07-09
  request: Package issue #84 for PR; do not open/approve a PR from this checker handoff.
  evidence: |
    ## Checker Result
    Status: ALL GREEN

    ## Commands
    - command: `pwd && git rev-parse --show-toplevel && git branch --show-current`
      result: passed
      evidence: worktree root is `/Users/alexmetelli/source/horizon-starknet-issue-84`; branch is `codex/issue-84-home-workbench`.
    - command: `git rev-parse HEAD && git show --stat --oneline --decorate --no-renames 78d50fdd39f7c311a030057da109d6d75253ebf2`
      result: passed
      evidence: HEAD is builder commit `78d50fdd39f7c311a030057da109d6d75253ebf2` (`Replace home hero with protocol workbench`).
    - command: `gh issue view 84 --json number,title,state,body,labels,assignees,url`
      result: passed
      evidence: issue #84 is open; body requires replacing the centered marketing hero with a protocol workbench, preserving simple/advanced modes, updating nav/markets e2e, and updating progress/changelog.
    - command: `git diff --name-status --no-renames origin/main...HEAD`
      result: passed
      evidence: diff is limited to `CHANGELOG.md`, `PROGRESS.md`, `STATUS.md`, `packages/frontend/e2e/markets.spec.ts`, `packages/frontend/e2e/navigation.spec.ts`, `packages/frontend/src/app/home-page-client.tsx`, and `packages/frontend/src/widgets/hero/HeroSection.tsx`.
    - command: `git diff --name-only origin/main...HEAD | rg 'Header|Footer|MobileNav|MarketCard|SimpleMarketCard|shared/layout|package.json|bun.lock|lock|contracts|indexer|\.github|README' || true`
      result: passed
      evidence: no changed #85 chrome/footer/mobile-nav files, no #86 market-card APY/detail files, and no dependency, lockfile, contract, indexer, CI, deployment, or README address files.
    - command: `bun run --cwd packages/frontend format:check`
      result: passed
      evidence: `biome format src`; checked 469 files in 62ms; no fixes applied.
    - command: `bun run --cwd packages/frontend lint`
      result: passed
      evidence: `biome lint src`; checked 469 files in 112ms; no fixes applied.
    - command: `bun run --cwd packages/frontend typecheck`
      result: passed
      evidence: `tsc --noEmit` completed successfully.
    - command: `bun run --cwd packages/frontend test`
      result: passed
      evidence: `476 pass`, `0 fail`, 810 expect calls across 20 files.
    - command: `bun run --cwd packages/frontend test:e2e e2e/navigation.spec.ts --project=chromium`
      result: passed
      evidence: `28 passed` in 21.7s. Local logs still show missing `DATABASE_URL`/`RPC_URL`, analytics stats query failure, and `useMarkets` fallback noise.
    - command: `bun run --cwd packages/frontend test:e2e e2e/markets.spec.ts --project=chromium`
      result: passed
      evidence: `15 passed` in 24.9s. Local logs still show missing `DATABASE_URL`/`RPC_URL`, analytics stats query failure, and `useMarkets` fallback noise.

    ## Semantic Checks
    - Home first viewport replaces old tall centered `min-h-[70vh]` hero/radial glow/stat orbs/generic feature grid with a bordered dense workbench in `HeroSection.tsx`.
    - Workbench metrics use existing `useDashboardMarkets`, token price helpers, and `useProtocolStats`; unavailable prices/stats render `Unavailable` or `Indexer unavailable` instead of invented values.
    - Simple route path keeps fixed-yield mint/market/portfolio actions; advanced exposes mint/trade/pools/portfolio/analytics actions.
    - Home market list remains reachable at `#markets` with existing `SimpleMarketList`/`MarketList` fallbacks.
    - Navigation and markets e2e now assert the workbench heading/metrics and market headings rather than the old hero headings or floating-orb stat rhythm.

    ## Failures
    - none.

    ## Coverage Gaps
    - `bun run --cwd packages/frontend build` was not rerun because it is not in the #84 required gate list and `STATUS.md`/`PROGRESS.md` document a local baseline hang at `Creating an optimized production build ...`.
    - E2E passed under degraded local DB/RPC/indexer conditions; this validates accepted fallback behavior but not a fully connected local dev stack.

    ## Next Action
    - Ready for coordinator PR packaging for issue #84.
  next-action: Coordinator may package the #84 branch for PR; keep #85 and #86 in their separate scopes.

- from: builder-agent Archimedes
  to: checker-agent
  timestamp: 2026-07-09
  request: Review issue #84 implementation and validation evidence, then decide whether this branch is ready for PR creation.
  evidence: Changed `packages/frontend/src/widgets/hero/HeroSection.tsx`, `packages/frontend/src/app/home-page-client.tsx`, `packages/frontend/e2e/navigation.spec.ts`, `packages/frontend/e2e/markets.spec.ts`, `PROGRESS.md`, `CHANGELOG.md`, and `STATUS.md`. Replaced the centered `min-h-[70vh]` marketing hero, radial glow layers, floating stat orbs, and generic feature cards with a dense workbench using `useDashboardMarkets`, token price helpers, and `useProtocolStats`; simple mode emphasizes fixed-yield minting and advanced mode exposes mint/trade/pools/portfolio/analytics task paths. Market list remains reachable at `#markets` with existing `SimpleMarketList`/`MarketList` fallback behavior. Validation passed: `bun run --cwd packages/frontend format:check`; `bun run --cwd packages/frontend lint`; `bun run --cwd packages/frontend typecheck`; `bun run --cwd packages/frontend test` (476 pass, 0 fail); `bun run --cwd packages/frontend test:e2e e2e/navigation.spec.ts --project=chromium` (28 passed); `bun run --cwd packages/frontend test:e2e e2e/markets.spec.ts --project=chromium` (15 passed). E2E logs still show local missing `DATABASE_URL`/`RPC_URL`, analytics stats query failure, and `useMarkets` fallback noise; tests cover accepted degraded states and passed.
  next-action: Checker should inspect the diff for #84 scope boundaries, verify no #85 chrome/footer or #86 market-card APY/detail work leaked in, and rerun any desired focused gate. Stop if local DB/RPC env noise needs coordinator decision.

- from: builder-agent
  to: checker-agent
  timestamp: 2026-07-09
  request: Check issue #85 implementation only, then hand off for reviewer if acceptable.
  evidence: Changed `packages/frontend/src/shared/layout/Header.tsx`, `Footer.tsx`, `MobileNav.tsx`, `mode-toggle.tsx`, `packages/frontend/e2e/navigation.spec.ts`, `PROGRESS.md`, `CHANGELOG.md`, and this `STATUS.md`. Header now uses compact Horizon app chrome with network/mode/wallet status, lucide app-menu controls, preserved `ConnectButton`, `ThemeToggle`, and `ModeToggle`, and simple-mode hiding for advanced-only routes. Footer now uses compact app/reference/policy links with alpha/risk/Starknet protocol colophon content instead of stock columns. Mobile bottom nav spacing/glow is reduced and the onboarding tooltip close icon is lucide with viewport-bounded width. Navigation e2e now covers route access, footer colophon links, theme menu items, 320px app menu, and no horizontal overflow at 320, 375, 414, 768, and 1280 px on app routes.
  next-action: Verify diff scope, run or trust recorded frontend gates, and check for merge conflicts with #84/#86 branches before PR creation.
  stop-condition: Escalate if checker finds header/footer behavior hides wallet/theme/mode controls, breaks simple/advanced route access, or conflicts with sibling #84/#86 edits.

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
- PR #90 for issue #85 is merge-dirty after PR #91 merged. Next action: rebase `/Users/alexmetelli/source/horizon-starknet-issue-85` on current `origin/main`, resolve shared tracker conflicts, rerun focused gates, force-push, wait for fresh CI/CodeRabbit, renew review, and merge.

## Checker Result - Issue #86
Status: ALL GREEN

Commands:
- `pwd && git rev-parse --show-toplevel && git status --short --branch && git branch --show-current && git rev-parse HEAD`: passed; confirmed `/Users/alexmetelli/source/horizon-starknet-issue-86`, branch `codex/issue-86-market-apy-access`, builder commit `fb637d6ac9cf430de48679b6ed5ad94612d205f1`, clean before checker status update.
- `gh issue view 86 --json number,title,state,body,labels,assignees,url,comments`: passed; issue #86 is open, owns market-card APY/oracle accessibility and glow reduction, and is parallel-safe with #84/#85.
- `git diff --name-status origin/main...HEAD`: passed; changed files are only `CHANGELOG.md`, `PROGRESS.md`, `STATUS.md`, `packages/frontend/e2e/markets.spec.ts`, and `packages/frontend/src/entities/market/ui/MarketCard.tsx`.
- `git diff --check origin/main...HEAD`: passed; no whitespace errors.
- `bun run --cwd packages/frontend format:check`: passed; Biome checked 469 files with no fixes applied.
- `bun run --cwd packages/frontend lint`: passed; Biome checked 469 files with no fixes applied.
- `bun run --cwd packages/frontend typecheck`: passed; `tsc --noEmit` completed successfully.
- `bun run --cwd packages/frontend test`: passed; 476 tests passed, 0 failed, 810 expect calls across 20 files.
- `bun run --cwd packages/frontend test:e2e e2e/markets.spec.ts --project=chromium`: passed; 16/16 Chromium tests passed in 21.5s. Logs still show expected local missing `RPC_URL`/database fallback noise.

Semantic evidence:
- `MarketCard.tsx` replaces hover-only APY `HoverCard` with a visible `CollapsibleTrigger` button and panel; the trigger is keyboard-focusable, exposes `aria-controls` and Radix `aria-expanded`, and supports pointer/touch click.
- APY/oracle details remain sourced from existing market fields and helpers: implied APY, current spot APY, oracle badge/detail, `ApyBreakdown`, TWAP/spot rows, exchange rates, negative-yield warning, expiry badge, fees, and Trade PT/Pool links are preserved.
- Generic APY glow overlay, `card-hover-glow`, broad market-card/yield `transition-all`, hover shadow treatment, and hover-revealed action opacity were removed or narrowed.
- #84 home workbench files and #85 chrome/footer files were not touched; no contracts, indexer, dependencies, lockfiles, CI, deployment, README addresses, market math, oracle semantics, API, route, or transaction behavior changed.
- `markets.spec.ts` now asserts the non-hover details path with keyboard Enter and click when advanced market cards render, and confirms Trade PT/Pool links remain visible.

Coverage gaps:
- Optional `bun run --cwd packages/frontend test:e2e e2e/navigation.spec.ts --project=chromium` not run because #86 did not change shared navigation, header/footer, mobile nav, or home workbench implementation files.
- Local e2e environment uses fallback market/RPC behavior due missing `RPC_URL` and database configuration; accepted by existing markets e2e patterns, but final PR CI should remain the source for hosted/build confirmation.
- `bun run --cwd packages/frontend build` not run; not required by #86 handoff and existing status records a local Next build hang baseline.
- Packaging note: after the checker pass, `origin/main` is one tracker-only commit ahead (`3fb12999 chore: track wave 2 PRs`, touching `STATUS.md`). Read-only `git merge-tree $(git merge-base HEAD origin/main) HEAD origin/main` predicts a `STATUS.md` conflict around #84/#85/#86 status lines, so coordinator should rebase/reconcile tracker state before opening the #86 PR.

Next Action:
- Ready for coordinator/maintainer PR packaging for issue #86 after reconciling the tracker-only `origin/main` `STATUS.md` update. Do not approve or open a PR from checker context.

## Checker Result - Issue #85
Status: FAILED

## Commands
- command: `pwd && git rev-parse --show-toplevel && git status --short --branch --untracked-files=all && git rev-parse HEAD && git branch --show-current`
  result: passed
  evidence: confirmed `/Users/alexmetelli/source/horizon-starknet-issue-85`, branch `codex/issue-85-app-chrome-colophon`, HEAD `48593a6e0b272aca013d6d64e2b3f1e233e90ba7`; final status showed branch ahead 1 and behind current `origin/main` by 2.
- command: `gh issue view 85 --comments --json number,title,state,body,comments,labels,assignees,url`
  result: passed
  evidence: issue #85 is open, frontend/design/tests feature scope, parallel-safe with #84/#86, and requires app chrome/footer redesign plus navigation e2e.
- command: `git diff --name-status origin/main...HEAD && git diff --stat origin/main...HEAD`
  result: passed
  evidence: diff is scoped to `CHANGELOG.md`, `PROGRESS.md`, `STATUS.md`, `packages/frontend/e2e/navigation.spec.ts`, and touched layout chrome files `Footer.tsx`, `Header.tsx`, `MobileNav.tsx`, `mode-toggle.tsx`.
- command: `git diff --name-status origin/main...HEAD -- packages/frontend/src/widgets/hero packages/frontend/src/app/home-page-client.tsx packages/frontend/src/entities/market/ui/MarketCard.tsx packages/frontend/src/entities/market/ui/SimpleMarketCard.tsx`
  result: passed
  evidence: no #84 home workbench or #86 market-card/APY files are changed by #85.
- command: `git diff --check origin/main...HEAD`
  result: passed
  evidence: no whitespace conflict markers or whitespace errors in the issue diff.
- command: `rg --files packages/frontend/src/app | sort`
  result: passed
  evidence: footer targets used by #85 exist, including `/docs`, `/docs/risks`, `/docs/mechanics`, `/docs/faq`, `/terms`, and `/privacy`.
- command: `rg -n "<svg|Product|Learn|Resources|Legal|TVL|volume|users|healthy|live|Mainnet|Sepolia|Devnet|Fork|Alpha protocol|User risk review" packages/frontend/src/shared/layout packages/frontend/e2e/navigation.spec.ts`
  result: passed
  evidence: no manual `<svg>` remains in touched chrome; old stock footer labels are only asserted absent in e2e; status copy is network/mode/wallet state plus alpha/risk labels, not fake metrics.
- command: `bun run --cwd packages/frontend format:check`
  result: passed
  evidence: Biome format checked 469 files; no fixes applied.
- command: `bun run --cwd packages/frontend lint`
  result: passed
  evidence: Biome lint checked 469 files; no fixes applied.
- command: `bun run --cwd packages/frontend typecheck`
  result: passed
  evidence: `tsc --noEmit` completed successfully.
- command: `bun run --cwd packages/frontend test`
  result: passed
  evidence: 476 tests passed, 0 failed, 810 expect calls across 20 files.
- command: `CI=1 bun run --cwd packages/frontend test:e2e e2e/navigation.spec.ts --project=chromium`
  result: passed
  evidence: 39 Chromium navigation tests passed. Local dev-server logs still include known missing `RPC_URL`/database fallback noise, but no test failed.
- command: `bun run --cwd packages/frontend check`
  result: passed
  evidence: run because #85 changes global shell layout; `tsc --noEmit` passed and Biome checked 469 files with no fixes applied.
- command: `git merge-tree $(git merge-base HEAD origin/main) HEAD origin/main`
  result: failed
  evidence: `STATUS.md` has merge conflicts against current `origin/main` in #85 phase/cleanliness lines because both this branch and the coordinator updated hot status after the branch split.

## Failures
- `STATUS.md`: PR packaging conflict only. Current #85 code/test scope is green, but the branch is not ready to package until it rebases or merges current `origin/main` and reconciles the `STATUS.md` hot-state conflict.

## Coverage Gaps
- Did not run `bun run --cwd packages/frontend build`; not required by #85, and repo status records a local baseline Next build hang at `Creating an optimized production build ...`.
- Did not run contract or indexer gates because #85 touches frontend chrome/e2e/tracker files only.

## Next Action
- Rebase or merge current `origin/main` into `codex/issue-85-app-chrome-colophon`, reconcile `STATUS.md` only, rerun the frontend checker gates if any source/test files change during conflict resolution, then package the PR.

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
- #87 remains downstream and should stay blocked until #85 merges.
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
- issue: #84 Replace the home hero with a protocol workbench
  pr: https://github.com/ametel01/horizon-starknet/pull/91
  merge: 245e50f5df8f642f18b8e3397eb92f2e09daf586
  final-review: https://github.com/ametel01/horizon-starknet/pull/91#pullrequestreview-4661240607
