# Deployment Scripts

This directory contains deployment scripts for Horizon Protocol.

## Directory Structure

```
deploy/
├── scripts/
│   ├── deploy.sh           # Full deployment script
│   ├── declare.sh          # Declare classes only
│   └── export-addresses.sh # Export addresses to JSON
├── addresses/
│   ├── katana.json         # Deployed addresses (generated)
│   ├── sepolia.json
│   └── mainnet.json
└── README.md
```

## Prerequisites

1. **starkli** - Starknet CLI tool
   ```bash
   curl https://get.starkli.sh | sh
   starkliup
   ```

2. **scarb** - Cairo build tool
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh
   ```

3. **Running network**
   - Katana: `katana` (local devnet)
   - Sepolia: Public testnet (no setup needed)
   - Mainnet: Starknet mainnet

## Environment Setup

### Katana (Local Development)

1. Start Katana in a separate terminal:
   ```bash
   katana
   ```

2. The `.env.katana` file is pre-configured with Katana's prefunded accounts.

### Sepolia (Testnet)

1. Copy and configure the environment file:
   ```bash
   cp .env.example .env.sepolia
   ```

2. Set your deployer account:
   ```bash
   # Create a new account
   starkli account oz init ~/.starkli-wallets/deployer/account.json

   # Fund it with Sepolia ETH (use faucet)
   # Deploy the account
   starkli account deploy ~/.starkli-wallets/deployer/account.json
   ```

3. Update `.env.sepolia` with your account address and private key.

### Mainnet

1. Copy and configure:
   ```bash
   cp .env.example .env.mainnet
   ```

2. Use a secure account with sufficient ETH for gas.

## Deployment

### Full Deployment

Deploys all contracts including test setup:

```bash
# Deploy to Katana
./deploy/scripts/deploy.sh katana

# Deploy to Sepolia
./deploy/scripts/deploy.sh sepolia

# Deploy to Mainnet (no test setup)
./deploy/scripts/deploy.sh mainnet
```

### Declare Only

Only declares contract classes (useful for upgrades or debugging):

```bash
./deploy/scripts/declare.sh katana
```

### Export Addresses

Export deployed addresses to JSON format for frontend:

```bash
./deploy/scripts/export-addresses.sh katana
```

## Deployment Order

The scripts deploy contracts in this order:

1. **Declare all classes**
   - MockYieldToken, SY, PT, YT, Market
   - Factory, MarketFactory, Router

2. **Deploy core infrastructure**
   - Factory (needs YT + PT class hashes)
   - MarketFactory (needs Market class hash)
   - Router (stateless)

3. **Deploy test setup** (non-mainnet only)
   - MockYieldToken
   - SY (wraps MockYieldToken)
   - Create PT/YT pair via Factory
   - Create Market via MarketFactory

## Contract Addresses

After deployment, addresses are saved to:
- Environment file: `.env.[network]`
- JSON file: `deploy/addresses/[network].json`

### Class Hashes

| Contract | Description |
|----------|-------------|
| MockYieldToken | Test yield-bearing token |
| SY | Standardized Yield wrapper |
| PT | Principal Token |
| YT | Yield Token |
| Market | AMM pool |
| Factory | Deploys PT/YT pairs |
| MarketFactory | Deploys Markets |
| Router | User-friendly aggregator |

### Deployed Contracts

| Contract | Purpose |
|----------|---------|
| Factory | Create new PT/YT pairs for any SY+expiry |
| MarketFactory | Create trading pools for PT tokens |
| Router | One-stop shop for all user operations |

## Troubleshooting

### "Class already declared"

This is a warning, not an error. The class hash is already on-chain.

### "insufficient balance"

Your deployer account needs more ETH/STRK for gas.

### "contract not found"

Make sure to build contracts first:
```bash
cd contracts && scarb build
```

### "RPC error"

Check if the network is accessible:
```bash
# Katana
curl http://localhost:5050

# Sepolia
curl https://starknet-sepolia.public.blastapi.io/rpc/v0_7
```

## Post-Deployment

After successful deployment:

1. **Verify contracts** on block explorer
2. **Test basic operations**:
   - Deposit underlying → SY
   - Mint PT + YT
   - Add liquidity to market
   - Execute swaps
3. **Export addresses** for frontend:
   ```bash
   ./deploy/scripts/export-addresses.sh [network]
   ```
