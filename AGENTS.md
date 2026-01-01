# Repository Guidelines

## Project Structure & Module Organization
`contracts/` holds Cairo smart contracts (`src/`) and tests (`tests/`). `packages/frontend/` is the
Next.js dApp (Bun + React), and `packages/indexer/` is the Apibara indexer (Bun + Drizzle).
Deployment scripts live in `deploy/scripts/`, with network addresses in `deploy/addresses/`.
Shared docs and assets are in `docs/`, `assets/`, and `whitepaper/`.

## Build, Test, and Development Commands
- `make build` / `make test`: build and test Cairo contracts (Scarb + snforge).
- `cd contracts && scarb fmt`: format Cairo code.
- `make dev-up` / `make dev-fork`: start local devnet or a mainnet fork via Docker.
- `cd packages/frontend && bun install && bun run dev`: run the web app locally.
- `cd packages/frontend && bun run check`: typecheck + lint + format check.
- `cd packages/indexer && bun install && bun run dev`: run indexer with devnet preset.
- `cd packages/indexer && bun run test`: run indexer tests (Vitest).

## Coding Style & Naming Conventions
- Cairo: 4-space indentation, `snake_case` for functions/variables, `SCREAMING_SNAKE_CASE` for
  constants. Use `scarb fmt` before committing.
- TypeScript/React: 2-space indentation, `PascalCase` components, `camelCase` functions, `useX`
  hooks (e.g., `useSwap`). Format with Prettier and lint with ESLint.
- File naming: tests in `contracts/tests/test_*.cairo`, frontend `*.test.ts(x)`, indexer
  `tests/*.test.ts`.

## Testing Guidelines
Add tests alongside changes: `snforge test` for contracts, `bun test` for frontend unit tests,
`playwright test` for E2E, and `bun run test` for indexer (Vitest). Prefer small, focused tests
that cover edge cases (expiry, rounding, slippage).

## Commit & Pull Request Guidelines
Commit messages in this repo are short, imperative, and capitalized (e.g., “Add …”, “Update …”,
“Fix …”). Keep commits scoped to one change, and do not mention Claude/Codex in messages.
PRs should include a clear summary, tests run, linked issues when applicable, and screenshots
for UI changes.

## Security & Configuration Tips
Use `.env.example` files as templates; never commit secrets. `make dev-fork` uses real oracle
data—treat it as production-like. Review `CLAUDE.md` and subdirectory `CLAUDE.md` files for
component-specific guidance.
