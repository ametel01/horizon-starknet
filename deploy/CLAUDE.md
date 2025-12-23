# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This directory contains deployment scripts for Horizon Protocol on Starknet. The scripts use `sncast` (Starknet Foundry's CLI) to declare contract classes and deploy contracts.

## Commands

### Full Deployment
```bash
./deploy/scripts/deploy.sh devnet    # Deploy to local devnet
./deploy/scripts/deploy.sh sepolia   # Deploy to Sepolia testnet
./deploy/scripts/deploy.sh mainnet   # Deploy to mainnet (no test setup)
```

### Declare Classes Only
```bash
./deploy/scripts/declare.sh devnet   # Declare contract classes without deploying
```

### Calculate Market Initial Anchor
```bash
./deploy/scripts/calc-anchor.sh 8              # Calculate anchor for 8% APY
./deploy/scripts/calc-anchor.sh 5 --update     # Calculate and update .env.devnet
./deploy/scripts/calc-anchor.sh 8 --update --market NST_STRK  # Update specific market
```

### Upgrade Contracts
```bash
./deploy/scripts/upgrade.sh devnet              # Upgrade all changed contracts on devnet
./deploy/scripts/upgrade.sh sepolia --dry-run   # Preview upgrades on sepolia
./deploy/scripts/upgrade.sh mainnet --contract Router  # Upgrade only Router on mainnet
```

### Export Addresses
```bash
./deploy/scripts/export-addresses.sh devnet    # Export to deploy/addresses/devnet.json
```

## Architecture

### Environment Files

Each network has a corresponding `.env.<network>` file in the project root:
- `.env.devnet` - Local devnet (auto-configured from predeployed accounts)
- `.env.sepolia` - Sepolia testnet (requires `DEPLOYER_ADDRESS` and `DEPLOYER_PRIVATE_KEY`)
- `.env.mainnet` - Mainnet (requires deployer credentials)

### Deployment Flow

1. **Declare all class hashes** - MockERC20, MockYieldToken, SY, PT, YT, Market, Factory, MarketFactory, Router
2. **Deploy core infrastructure** - Factory, MarketFactory, Router
3. **Deploy test setup** (non-mainnet only):
   - Deploy mock yield tokens (nstSTRK, sSTRK, wstETH)
   - Deploy SY wrappers for each yield token
   - Create PT/YT pairs via Factory
   - Create Markets via MarketFactory
   - Seed initial liquidity

### Output Files

- `deploy/addresses/<network>.json` - All deployed contract addresses
- `deploy/accounts/<network>.json` - sncast account configuration (auto-generated)
- `.env.<network>` - Updated with class hashes and addresses after deployment

## Key Parameters

### Market Parameters
- `MARKET_SCALAR_ROOT` - Rate sensitivity (default: 5 WAD = 5.0)
- `MARKET_INITIAL_ANCHOR` - Starting ln(implied_rate), use `calc-anchor.sh` to compute
- `MARKET_FEE_RATE` - Swap fee (default: 0.3%)

### Liquidity Seeding
- `SEED_LIQUIDITY` - Enable/disable seeding (default: true)
- `SEED_LIQUIDITY_AMOUNT` - Amount per market (default: 1M tokens with 18 decimals)

## Troubleshooting

- **"Class already declared"** - Not an error, class hash exists on-chain
- **"insufficient balance"** - Deployer needs more ETH/STRK for gas
- **Build contracts first** - Run `make build` or `cd contracts && scarb build`
- **Nonce errors on Sepolia** - Scripts include retry logic with delays
