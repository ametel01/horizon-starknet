# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Horizon Protocol is a Pendle-style yield tokenization protocol on Starknet. It splits yield-bearing assets into Principal Tokens (PT) and Yield Tokens (YT), enabling fixed yield strategies and yield speculation.

**Status:** Alpha on Starknet Mainnet | **License:** BUSL-1.1 (converts to GPL-3.0 on 2028-12-19)

## Build Commands

### Smart Contracts (Cairo)
```bash
make build                    # Build contracts (cd contracts && scarb build)
make test                     # Run tests (cd contracts && snforge test)
cd contracts && snforge test test_name  # Run specific test
cd contracts && scarb fmt     # Format Cairo code
```

### Frontend (Next.js/Bun)
```bash
cd packages/frontend
bun install                   # Install dependencies
bun run dev                   # Start dev server
bun run dev:fork              # Dev with fork network (real Pragma oracle)
bun run check                 # Run typecheck + lint + format:check
bun run test                  # Run tests
bun run test:e2e              # Run Playwright E2E tests
bun run codegen               # Generate TypeScript types from ABIs
```

### Indexer (Bun/Apibara)
```bash
cd packages/indexer
bun install                   # Install dependencies
bun run dev                   # Run indexer with devnet preset
bun run dev:mainnet           # Run with mainnet preset
bun run check                 # Run typecheck + lint + format:check
bun run test                  # Run tests
bun run db:studio             # Open Drizzle Studio (database GUI)
```

### Local Development (Docker)
```bash
make dev-up                   # Start local devnet with mock oracle
make dev-down                 # Stop devnet and remove volumes
make dev-logs                 # Follow container logs
make dev-fork                 # Start mainnet fork (real Pragma TWAP oracle)
make dev-fork-down            # Stop forked devnet
```

## Tool Versions (Pinned)

From `.tool-versions`:
- scarb 2.15.0
- starknet-foundry 0.54.1
- starkli 0.4.2

## Architecture

### Core Token System
```
Underlying Asset (stETH, aUSDC, etc.)
        │ deposit
        ▼
       SY (Standardized Yield wrapper)
        │ mint_py
        ▼
   PT + YT (split into Principal + Yield)
        │
   ┌────┴────┐
   ▼         ▼
Market    Hold for yield
(PT/SY AMM)
```

### Contract Upgradeability Model

**All core contracts are upgradeable (owner-controlled):** SY, PT, YT, Market, Factory, MarketFactory, Router

**Non-upgradeable:** Mocks and Faucet (test infrastructure only)

Each upgradeable contract uses OpenZeppelin's OwnableComponent and UpgradeableComponent. The owner can call `upgrade(new_class_hash)` to upgrade the contract implementation.

### Key Contracts

| Contract | Purpose |
|----------|---------|
| Router | User entry point for all operations (recommended) |
| Factory | Deploys SY/PT/YT token sets |
| MarketFactory | Deploys PT/SY AMM markets |
| Market | Time-decay AMM for PT/SY trading |
| SY | ERC20 wrapper standardizing yield-bearing assets |
| PT | Principal token, redeemable 1:1 at expiry |
| YT | Yield token, accrues interest until expiry |

### Key Libraries

- `libraries/math.cairo` - WAD (10^18) fixed-point math, exp, ln functions
- `libraries/math_fp.cairo` - Fixed-point math extensions
- `libraries/oracle_lib.cairo` - Oracle library utilities
- `libraries/roles.cairo` - RBAC role definitions
- `libraries/errors.cairo` - Custom error definitions (56 error constants)
- `market/market_math.cairo` - AMM pricing with time-decay curves
- `market/market_math_fp.cairo` - Fixed-point AMM math (Pendle V2 formulas)

## Code Patterns

### All arithmetic uses WAD (10^18 fixed-point)
Amounts and rates are scaled by 10^18. Use math library functions for multiplication and division.

### Router is the user entry point
All user operations should go through the Router contract with slippage protection (min_out parameters).

### Access control on PT/YT minting
Only the YT contract can mint/burn PT and YT tokens.

### Expiry handling
- Before expiry: PT + YT can be redeemed together for SY
- After expiry: PT redeems 1:1 for SY, YT becomes worthless

## Project Structure

```
contracts/
├── src/
│   ├── factory.cairo        # Deploys SY/PT/YT pairs
│   ├── router.cairo         # User entry point
│   ├── tokens/              # SY, PT, YT implementations
│   ├── market/              # AMM and MarketFactory
│   ├── libraries/           # math, math_fp, oracle_lib, errors, roles
│   ├── components/          # sy_component, reward_manager_component
│   ├── interfaces/          # Contract interfaces (13 files)
│   ├── mocks/               # Test mocks
│   └── oracles/             # Pragma oracle integration
└── tests/                   # Unit & integration tests (48 files)

packages/
├── frontend/                # Next.js dApp (React 19, TypeScript, Bun)
└── indexer/                 # Event indexer (Apibara, Drizzle ORM, PostgreSQL)

deploy/
├── scripts/                 # deploy.sh, declare.sh, export-addresses.sh
├── addresses/               # Deployed contract addresses by network
└── accounts/                # sncast account files
```

Each subdirectory (contracts/, packages/frontend/, packages/indexer/, deploy/) has its own CLAUDE.md with component-specific guidance.

## Deployment

```bash
./deploy/scripts/deploy.sh devnet|sepolia|mainnet
./deploy/scripts/export-addresses.sh devnet|sepolia|mainnet  # Export to JSON
```

See `deploy/README.md` for detailed deployment instructions.

## Git Commits

- Never mention CLaude code in commit messages.

DO NOT ADD THIS TO COMMIT MESSAGES!
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
- Always break down commit messages into small, focused changes.
- Use imperative mood for commit messages.

## Intentional Compaction

Intentional compaction is the deliberate compression of context into a minimal, high-signal representation.

Instead of dragging an ever-growing conversation forward, you:

- **Summarize the current state into a markdown artifact**
- **Review and validate it as a human**
- **Start a fresh context seeded with that artifact**
- **What to compact**
  - Relevant files and line ranges
  - Verified architectural behavior
  - Decisions already made
  - Explicit constraints and non-goals
- **What not to compact**
  - Raw logs
  - Tool traces
  - Full file contents
  - Repetitive error explanations

## Code Quality

- **Linting**: Ensure code adheres to style guidelines. Never bypass linting using exceptions unless requested by the user
- **Documentation**: Document public APIs and interfaces.
- **Testing**: Write unit tests for critical functions.
- **Security**: Review for vulnerabilities and best practices.
- **Performance**: Optimize for speed and resource usage.
- **Maintainability**: Keep codebase clean and modular.
