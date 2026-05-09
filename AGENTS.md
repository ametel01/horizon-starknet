# AGENTS.md

## Project overview

- Horizon Protocol is a Cairo and TypeScript repository for a Pendle-style yield tokenization protocol on Starknet.
- Main surfaces: `contracts`, `packages/frontend`, `packages/indexer`, `docs`, `.github/workflows`.
- Package manager: Bun for TypeScript packages.
- Contract toolchain: Scarb and Starknet Foundry `snforge`.
- Default branch: `main`.
- Project status from provided evidence: Alpha; README states Starknet Mainnet live status.
- Security posture from README evidence: core contracts are owner-upgradeable; mocks and faucet are immutable; project is not yet audited and has no active bug bounty at alpha stage.
- No single repository-wide canonical validation command was detected.
- Use scoped validation based on changed surface and report exact commands run.

## Agent workflow

1. Verify current directory is the repository root before running commands.
2. Read the target file before every edit.
3. Read at least one related caller, test, interface, type definition, docs page, or workflow before editing.
4. Identify the changed surface: contracts, frontend, indexer, docs, CI, deployment, or cross-cutting.
5. Make the smallest bounded change that satisfies the task.
6. Avoid broad refactors, unrelated formatting, dependency churn, lockfile churn, and behavior changes outside the request.
7. Add or update focused regression coverage when behavior changes.
8. Run the most specific validation commands for the changed surface.
9. If validation fails, read the full error and change approach before retrying.
10. Report changed files, validation evidence, known gaps, and any high-risk areas touched.

## Scope control

- Do not perform broad refactors unless explicitly requested.
- Do not reformat unrelated files.
- Do not change dependencies or lockfiles unless the task requires it.
- Do not change public APIs, protocol behavior, event shapes, schemas, deployment behavior, or user-facing behavior without matching tests and docs.
- Do not change README deployment addresses without explicit deployment evidence.
- Do not change license metadata without explicit legal or release instruction.
- Do not reorder upgradeable Cairo storage fields where storage-order comments are present.
- Keep contract, frontend, indexer, and docs changes separated when possible.
- Treat cross-package changes as high-risk unless the dependency chain is clear from evidence.

## Repository map

| Path | Purpose | Evidence |
| --- | --- | --- |
| `contracts` | Cairo smart contract workspace for Horizon protocol contracts and interfaces. | `contracts/Scarb.toml`, `contracts/src/factory.cairo`, `contracts/src/interfaces/i_router.cairo` |
| `contracts/src/components` | Reusable Cairo components for protocol behavior such as SY logic and reward accounting. | `contracts/src/components/sy_component.cairo`, `contracts/src/components/reward_manager_component.cairo` |
| `contracts/src/interfaces` | Cairo interface definitions for routers, markets, factories, token standards, callbacks, and oracles. | `contracts/src/interfaces/i_router.cairo`, `contracts/src/interfaces/i_market.cairo`, `contracts/src/interfaces/i_factory.cairo` |
| `packages/frontend` | Next/React frontend package with Bun scripts for dev, build, lint, format, typecheck, check, unit tests, and e2e tests. | `packages/frontend/package.json` |
| `packages/indexer` | TypeScript indexer package with Drizzle config, Docker Compose, Bun lockfile, and Bun scripts. | `packages/indexer/package.json`, `packages/indexer/drizzle.config.ts`, `packages/indexer/docker-compose.yml`, `packages/indexer/bun.lock` |
| `docs` | Protocol, integration, event, oracle, security-review, testing-quality, upgrade/RBAC, gap-analysis, and plan documentation. | `docs/EVENTS.md`, `docs/ORACLE_INTEGRATION.md`, `docs/TEST_QUALITY_AUDIT.md`, `docs/UPGRADE_RBAC.md` |
| `.github/workflows` | CI and automation workflows for Cairo, frontend, indexer, deploy, and release checks. | `.github/workflows/*.yml` listed in repo profile |
| `Makefile` | Root targets for Docker development, fork-mode development, contract build, contract tests, and env cleanup. | `Makefile` |
| `docker-compose.yml` | Apparent root Docker Compose configuration for local development targets. | `docker-compose.yml`, `Makefile` |

## Architecture

- Observed: the protocol splits yield-bearing assets into SY, PT, and YT tokens, and supports a Market AMM for PT/SY trading.
- Observed: README describes user flows for fixed yield, yield speculation, and liquidity provision.
- Observed: `contracts/Scarb.toml` names the contracts package `horizon`, version `2.0.0`, edition `2024_07`, license `BUSL-1.1`.
- Observed: `contracts/src/factory.cairo` deploys and tracks PT/YT pairs for SY tokens and expiries, and deploys `SYWithRewards` contracts.
- Observed: Factory storage includes PT/YT registries, valid PT/YT maps, deploy count, RBAC initialization flag, SYWithRewards class hash, valid SY map, treasury, fee rates, and expiry divisor.
- Observed: `SYComponent` handles deposit, redeem, exchange-rate, token-in/token-out, asset-type, and negative-yield watermark behavior.
- Observed: `RewardManagerComponent` tracks reward tokens using a global index model with user checkpoint indexes and accrued rewards.
- Observed: `RewardManagerComponent` uses hooks so containing contracts provide SY balances and total supply.
- Observed: router interfaces expose multicall, pause/unpause, RBAC initialization, PT/YT mint and redemption, market liquidity operations, and deadline-based slippage-protected flows.
- Observed: `RouterStatic` provides view-only previews and market information for frontend display.
- Observed: `RouterStatic` requires caller-supplied token-to-SY estimates for aggregator flows because view functions cannot call aggregators.
- Observed: market interfaces expose reserves, LP operations, swaps, market state, fees, pause/unpause, parameter updates, `collect_fees`, and `skim`.
- Observed: market factory interfaces create markets, track market registry and pagination, configure fees, treasury, rate impact sensitivity, and validate yield contract factory integration.
- Observed: oracle interfaces support Pragma TWAP summary stats and Pendle-style PT/YT/LP oracle helpers.
- Observed: external integrations include ERC-4626 vaults, external swap aggregators, flash callbacks, and market swap notification callbacks.
- Inferred: frontend likely consumes contract and indexer data for market display and preview flows based on `packages/frontend`, `RouterStatic`, and `docs/INDEXER_FRONTEND_INTEGRATION.md`.
- Inferred: indexer likely consumes contract events and writes indexed data using Drizzle ORM based on `packages/indexer/drizzle.config.ts`, Drizzle in repo frameworks, and `docs/EVENTS.md`.

## Setup

- Required for TypeScript package scripts: Bun.
- Required for contract build: Scarb.
- Required for contract tests: Starknet Foundry `snforge`.
- Required for root development targets: Docker Compose.
- Root workspace package manifest: Not detected. Safest fallback: run package scripts with `bun run --cwd` exactly as listed.
- Environment variable schema: Not detected. Safest fallback: inspect existing `.env*` examples or scripts before adding variables.
- Deployment process details: Not detected beyond README live-address tables, workflow names, and Makefile target names.
- Contract dependencies observed in `contracts/Scarb.toml`: Starknet `2.16.1`, OpenZeppelin Cairo contracts `v3.0.0` packages, `cairo_fp` `1.0.0`, `snforge_std` `0.58.1`, `assert_macros` `2.16.1`.

## Common commands

No canonical full validation command was detected.

| Changed surface | Command | When to run | Evidence/source |
| --- | --- | --- | --- |
| Contracts build | `make build` | Contract implementation, interfaces, Scarb config, or Cairo dependency changes. | `Makefile` |
| Contracts tests | `make test` | Contract behavior changes. | `Makefile` |
| Contracts tests | `cd contracts && snforge test` | Direct Starknet Foundry contract test run. | `contracts/Scarb.toml`, repo commands |
| Frontend dev | `bun run --cwd packages/frontend dev` | Local frontend development. | `packages/frontend/package.json` |
| Frontend build | `bun run --cwd packages/frontend build` | Frontend build-affecting changes. | `packages/frontend/package.json` |
| Frontend typecheck | `bun run --cwd packages/frontend typecheck` | Frontend TypeScript changes. | `packages/frontend/package.json` |
| Frontend lint | `bun run --cwd packages/frontend lint` | Frontend lint-affecting changes. | `packages/frontend/package.json` |
| Frontend format check | `bun run --cwd packages/frontend format:check` | Frontend formatting validation. | `packages/frontend/package.json` |
| Frontend aggregate check | `bun run --cwd packages/frontend check` | Frontend changes when broader package validation is needed. | `packages/frontend/package.json` |
| Frontend tests | `bun run --cwd packages/frontend test` | Frontend behavior changes. | `packages/frontend/package.json` |
| Frontend e2e | `bun run --cwd packages/frontend test:e2e` | User-flow or routing changes. | `packages/frontend/package.json` |
| Indexer dev | `bun run --cwd packages/indexer dev` | Local indexer development. | `packages/indexer/package.json` |
| Indexer build | `bun run --cwd packages/indexer build` | Indexer build-affecting changes. | `packages/indexer/package.json` |
| Indexer typecheck | `bun run --cwd packages/indexer typecheck` | Indexer TypeScript changes. | `packages/indexer/package.json` |
| Indexer lint | `bun run --cwd packages/indexer lint` | Indexer lint-affecting changes. | `packages/indexer/package.json` |
| Indexer format check | `bun run --cwd packages/indexer format:check` | Indexer formatting validation. | `packages/indexer/package.json` |
| Indexer aggregate check | `bun run --cwd packages/indexer check` | Indexer changes when broader package validation is needed. | `packages/indexer/package.json` |
| Indexer tests | `bun run --cwd packages/indexer test` | Indexer behavior changes. | `packages/indexer/package.json` |
| Local dev stack | `make dev-up` | Start docker-compose with contracts deployment for local development with mock oracle. | `Makefile` |
| Stop local dev stack | `make dev-down` | Stop docker-compose and remove volumes. | `Makefile` |
| Fork dev stack | `make dev-fork` | Start forked mainnet devnet with real Pragma TWAP oracle. | `Makefile` |
| Stop fork dev stack | `make dev-fork-down` | Stop forked devnet and remove volumes. | `Makefile` |
| Env cleanup | `make clean-env` | Reset `.env.devnet` and `.env.fork` through `deploy/scripts/reset-env.sh`. | `Makefile` |

## Coding conventions

- TypeScript packages use Bun script execution.
- Frontend and indexer have separate `biome.json` and `tsconfig.json` files.
- Use existing package-local scripts instead of inventing root commands.
- Cairo interface files use `i_*` naming in `contracts/src/interfaces`, such as `i_router.cairo` and `i_market.cairo`.
- Cairo component files use `*_component.cairo` naming in `contracts/src/components`, such as `sy_component.cairo`.
- Keep contract naming and module boundaries aligned with existing factories, router, market, oracle, SY, PT, YT, and reward components.
- Exact frontend component structure: Not detected. Safest fallback: inspect nearby components, routes, and tests before editing.
- Exact indexer service structure: Not detected. Safest fallback: inspect nearby handlers, schemas, and tests before editing.

## Change rules

### Safe edit zones

- `docs`: safe for documentation updates when behavior, integration expectations, events, oracle logic, testing guidance, or upgrade/RBAC behavior changes.
- `packages/frontend`: safe for frontend-only changes when validated with frontend Bun scripts.
- `packages/indexer`: safe for indexer-only changes when validated with indexer Bun scripts.

### Careful edit zones

- `contracts`: run contract build and Starknet Foundry tests for Cairo changes.
- `contracts/src/factory.cairo`: storage layout is upgrade-sensitive; follow existing storage-order comments.
- Factory, MarketFactory, Router, SY, PT, YT, Market, oracle, reward, treasury, fee, pause, expiry, slippage, upgrade, and RBAC logic: security-sensitive by protocol role.
- Aggregator integrations: view previews cannot call aggregators and rely on off-chain estimates passed by the caller.
- Oracle integrations: TWAP readiness, duration, cardinality, and stale or insufficient observations can affect pricing.
- `packages/indexer/drizzle.config.ts` and any database schema or migration-like files: migration procedure is not detected; treat as careful.
- `.github/workflows`: CI behavior can affect required checks, deploy, and release automation.
- `docker-compose.yml` and `packages/indexer/docker-compose.yml`: local service topology changes can affect development and tests.

### Do-not-edit-without-explicit-instruction zones

- Do not reorder existing storage fields in upgradeable Cairo contracts where storage-order comments are present.
- Do not change README mainnet live addresses without explicit deployment evidence.
- Do not change license metadata in `README.md` or `contracts/Scarb.toml` without explicit instruction.
- Do not change release workflow behavior without explicit release-process intent.
- Do not update `packages/indexer/bun.lock` unless dependency changes are required.

## Testing strategy

- Contract tests are run from `contracts` with `snforge test` or through `make test`.
- Frontend test and e2e scripts are present in `packages/frontend/package.json`.
- Indexer test script is present in `packages/indexer/package.json`.
- CI workflows exist for Cairo build, formatting, linting, and tests.
- CI workflows exist for frontend CI/deploy and indexer CI.
- Add regression tests when changing behavior in contracts, frontend, or indexer.
- For contract behavior changes, prefer the smallest `snforge` coverage that proves the changed invariant or flow.
- For frontend behavior changes, run unit tests and use e2e when user-visible flows or routing are affected.
- For indexer behavior changes, run indexer tests and typecheck; inspect event docs when event parsing changes.
- Test file locations and naming conventions beyond `i_*` interfaces and `*_component.cairo` components: Not detected. Safest fallback: search the package for existing nearby tests before adding new patterns.

## Validation checklist

- Confirm working directory and changed files.
- Read target files and related files before editing.
- Confirm the change is bounded to the requested surface.
- Confirm no unrelated formatting appears in the diff.
- Confirm no unintended dependency or lockfile changes.
- Confirm no secrets, credentials, private keys, RPC tokens, or deployment credentials are added.
- For contracts: run `make build` and `make test` or `cd contracts && snforge test` when behavior changes.
- For frontend: run the relevant `bun run --cwd packages/frontend ...` scripts.
- For indexer: run the relevant `bun run --cwd packages/indexer ...` scripts.
- For docs-only changes: verify affected links or referenced paths when possible.
- If a validation command cannot be run, record the reason and the safest remaining evidence.

## PR rules

- Include test evidence with exact commands and pass/fail status.
- State if no canonical full validation command was available.
- Do not include unrelated formatting.
- Do not include secrets or credentials.
- Update documentation for public behavior changes.
- Call out risky areas touched: upgradeability, storage layout, oracle pricing, RBAC, fees, treasury, callbacks, aggregators, slippage, deadlines, indexer schemas, CI, deploy, or release workflows.
- For contract changes, state whether storage layout changed.
- For frontend/indexer integration changes, state docs checked or updated.
- For failed or skipped validation, include the reason and residual risk.
- Contribution guide, branch naming, commit style, review ownership, and approval policy: Not detected.

## Known pitfalls

- `contracts/src/factory.cairo` has an explicit existing-storage ordering constraint for upgrade compatibility.
- README states core contracts are owner-upgradeable and admin keys control upgrades.
- README states the project is not audited and has no active bug bounty at alpha stage.
- Router operations include deadline parameters for stale transaction protection.
- Router `multicall` is documented as allowing only calls to self to prevent arbitrary external calls.
- `RouterStatic` preview functions cannot call external aggregators in view context and require caller-supplied off-chain estimates.
- Oracle pricing consumers should check readiness before querying TWAP-dependent prices.
- `MarketFactory.get_all_markets` is documented as potentially exceeding gas limits for large market counts; prefer paginated access for production-scale reads.
- Reward accounting depends on hook implementations for user SY balance and total SY supply.
- SY negative-yield detection depends on exchange-rate watermark behavior.

## Generated files

- Detected lockfile: `packages/indexer/bun.lock`; do not edit without dependency-change intent.
- Detected maintainer context files: `.open-maintainer.yml`, `.open-maintainer/profile.json`, `.open-maintainer/report.md`.
- Detected generated-file hints exist in the repository profile, but exact generated code paths beyond provided files are not confirmed.
- Compiled artifacts: Not detected. Safest fallback: do not commit build outputs unless an existing tracked artifact pattern proves they belong.
- Migrations and schemas: Not confirmed. `packages/indexer/drizzle.config.ts` indicates Drizzle usage; inspect indexer structure before changing schema-like files.
- Vendored code: Not detected. Safest fallback: do not edit dependency/vendor-like directories without explicit instruction.
- Deployment files detected: `.github/workflows/frontend-deploy.yml`, `.github/workflows/release.yml`, `docker-compose.yml`, `packages/indexer/docker-compose.yml`; treat changes as high-risk.

## Security and high-risk areas

- Repository profile states authentication, secret, payment, or security-sensitive paths are present.
- Core protocol contracts are mainnet live and owner-upgradeable according to README evidence.
- High-risk contract areas: Factory, MarketFactory, Router, SY, PT, YT, Market, oracle, reward, treasury, fees, pause/unpause, expiry, slippage, deadlines, upgrade, RBAC.
- External aggregator swaps and callbacks cross trust boundaries and include slippage/callback data handling.
- Oracle and TWAP integrations affect market pricing and downstream DeFi composability.
- Indexer and frontend integration can affect displayed market state, preview values, and user-facing DeFi actions.
- Never add secrets, credentials, private keys, API tokens, or RPC credentials to the repository.
- If touching security-sensitive code, include explicit validation and residual-risk notes in the PR.

## Documentation alignment

| Change type | Docs to check or update | Evidence/source |
| --- | --- | --- |
| Public protocol overview, status, security triage, roles, deployments | `README.md` | README evidence |
| Contract events or event shapes | `docs/EVENTS.md` | Event docs and contract components |
| Oracle or TWAP behavior | `docs/ORACLE_INTEGRATION.md` | Oracle interfaces and docs |
| Frontend-indexer integration | `docs/INDEXER_FRONTEND_INTEGRATION.md`, `docs/AMM-MARKET-V2-FRONTEND-INDEXER-CHANGES.md`, `docs/plans/frontend-integration-gaps_plan.md` | Integration docs |
| Upgrade or RBAC behavior | `docs/UPGRADE_RBAC.md` | Upgrade/RBAC docs and interfaces |
| Test strategy or quality expectations | `docs/TEST_QUALITY_AUDIT.md` | Testing quality docs |
| Gap implementation or protocol features | `docs/gap-analysis/README.md`, `docs/gap-analysis/00-consolidated-pending-gaps.md`, `docs/plans/pending-gaps-implementation.md` | Gap and plan docs |
| Package integration gaps | `docs/package-integration-gaps.md`, `docs/plans/package-integration-gaps-implementation.md` | Package integration docs |

## Unknowns and missing evidence

- Exact frontend route, component, state-management, styling, and test structure are not detected.
- Exact indexer event handlers, database schema, migrations, and service boundaries are not detected.
- Exact frontend and indexer dependency versions are not detected in provided evidence beyond package scripts and repo-profile frameworks.
- Exact CI job matrices, caches, secrets, and command ordering are not detected.
- Contribution guide, code ownership, branch policy, and PR approval policy are not detected.
- Release process details are not detected beyond `.github/workflows/release.yml`.
- Production deployment process is not detected beyond README live deployment addresses and frontend deploy workflow path.
- Environment variable schema is not detected.
- Database migration procedure is not detected.
- Full implementations for Market, Router, PT, YT, and oracle contracts are not detected in provided excerpts; inspect source before changing those areas.
