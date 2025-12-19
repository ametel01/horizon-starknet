# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Horizon is a Pendle-style yield tokenization protocol for Starknet. Users split yield-bearing assets into Principal Tokens (PT) and Yield Tokens (YT), enabling fixed-yield strategies and yield trading.

## Monorepo Structure

```
horizon-starknet/
├── contracts/           # Cairo smart contracts (Scarb 2.14.0)
├── packages/frontend/   # Next.js web application (Bun)
├── deploy/              # Deployment scripts and addresses
└── docker/              # Docker setup for local devnet
```

## Development Commands

### Smart Contracts

```bash
# Build contracts
make build                    # or: cd contracts && scarb build

# Run all tests
make test                     # or: cd contracts && snforge test

# Run a single test
cd contracts && snforge test test_name

# Run tests with backtrace
cd contracts && SNFORGE_BACKTRACE=1 snforge test

# Format
cd contracts && scarb fmt
```

### Frontend

```bash
cd packages/frontend

bun install                   # Install dependencies
bun run dev                   # Development server (localhost:3000)
bun run dev:fork              # Dev with fork network
bun run build                 # Production build
bun run check                 # Run typecheck + lint + format:check
bun run test                  # Run tests
bun run codegen               # Generate types from contract ABIs
```

### Local Development (Docker)

```bash
# Mock oracle mode (fast, for development)
make dev-up                   # Start devnet + deploy contracts
make dev-down                 # Stop and remove volumes
make dev-logs                 # View container logs

# Fork mode (real Pragma oracle from mainnet)
make dev-fork                 # Start forked devnet
make dev-fork-down            # Stop forked devnet
```

### Deployment

```bash
./deploy/scripts/deploy.sh devnet    # Deploy to local devnet
./deploy/scripts/deploy.sh sepolia   # Deploy to testnet
./deploy/scripts/export-addresses.sh devnet  # Export addresses to JSON
```

## Protocol Architecture

### Core Token Relationships

```
PT Price + YT Price = SY Price (underlying)
1 SY deposit → 1 PT + 1 YT (minting)
1 PT + 1 YT → 1 SY (redemption pre-expiry)
1 PT → 1 accounting asset (redemption post-expiry)
```

### Smart Contract Components

| Contract | Purpose |
|----------|---------|
| SY | Standardized Yield wrapper for yield-bearing tokens |
| PT | Principal Token, redeemable 1:1 at expiry |
| YT | Yield Token, accrues interest until expiry |
| Market | AMM with time-weighted pricing for PT/SY trading |
| Factory | Deploys PT/YT pairs for new underlying assets |
| MarketFactory | Deploys markets for PT tokens |
| Router | Aggregates operations with slippage protection |

### Key Formulas

**PY Index (monotonically non-decreasing):**
```
py_index = max(sy.exchange_rate(), stored_py_index)
```

**Minting/Redemption:**
```
amount_minted = sy_deposited * py_index
sy_redeemed = py_burned / current_py_index
```

**Implied APY:**
```
implied_apy = ((1 + yt_price/pt_price)^(365/days_to_expiry)) - 1
```

## Conventions

- Use `u256` for token amounts
- Use `u64` for timestamps
- Fixed-point math with 18 decimals (WAD = 10^18)
- Snake_case for Cairo code
- All public functions need comprehensive tests

## Important Notes

- PT redeems to the **accounting asset** (e.g., ETH), not the yield-bearing token
- YT distributes yield continuously until maturity
- At maturity: PT price → 1, YT price → 0
- The AMM curve naturally shifts PT toward underlying value as expiry approaches

## Tool Versions

Defined in `.tool-versions`:
- scarb 2.14.0
- starknet-foundry 0.54.0
- starkli 0.4.2

## Commit Messages

DO NOT ADD the Claude Code footer or Co-Authored-By to commit messages.
