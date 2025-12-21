# Horizon Protocol Indexer

Event indexer for Horizon Protocol on Starknet using [Apibara](https://www.apibara.com/) DNA.

## Overview

This indexer captures all protocol events and stores them in PostgreSQL:

| Indexer | Type | Events |
|---------|------|--------|
| factory | Static | YieldContractsCreated, ClassHashesUpdated |
| market-factory | Static | MarketCreated, MarketClassHashUpdated |
| router | Static | MintPY, RedeemPY, AddLiquidity, RemoveLiquidity, Swap, SwapYT |
| sy | Factory | Deposit, Redeem, OracleRateUpdated |
| yt | Factory | MintPY, RedeemPY, RedeemPYPostExpiry, InterestClaimed, ExpiryReached |
| market | Factory | Mint, Burn, Swap, ImpliedRateUpdated, FeesCollected |

## Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- [Docker](https://www.docker.com/) and Docker Compose
- A self-hosted [Apibara DNA](https://github.com/apibara/dna) server

## Quick Start

```bash
# Install dependencies
bun install

# Copy environment file
cp .env.example .env

# Start PostgreSQL
bun run docker:up

# Run indexer (devnet)
bun run dev
```

## Configuration

### Environment Variables

Edit `.env` to configure:

```bash
# PostgreSQL connection
POSTGRES_CONNECTION_STRING="postgres://horizon:horizon@localhost:5432/horizon_indexer"

# DNA Server URL (your self-hosted DNA server)
DNA_STREAM_URL="http://localhost:7171"
```

### Network Presets

The indexer supports three network presets configured in `apibara.config.ts`:

| Preset | Starting Block | Description |
|--------|----------------|-------------|
| devnet | 0 | Local development |
| sepolia | 100,000 | Starknet testnet |
| mainnet | 800,000 | Starknet mainnet |

## Running the Indexer

### Development (Local Devnet)

```bash
# Start local PostgreSQL
bun run docker:up

# Run with default devnet preset
bun run dev
```

### Sepolia Testnet

```bash
# Update .env with your Sepolia DNA server URL
DNA_STREAM_URL="http://your-sepolia-dna-server:7171"

# Run with sepolia preset
bun run dev:sepolia
```

### Mainnet

```bash
# Update .env with your Mainnet DNA server URL
DNA_STREAM_URL="http://your-mainnet-dna-server:7171"

# Run with mainnet preset
bun run dev:mainnet
```

## Setting Up a DNA Server

The indexer requires a self-hosted Apibara DNA server. See the [Apibara documentation](https://www.apibara.com/docs) for setup instructions.

Example DNA server with Docker:

```bash
docker run -p 7171:7171 quay.io/apibara/starknet:2.0.0 \
  start \
  --rpc https://your-starknet-rpc-url
```

## Database Management

### How Migrations Work

The indexer uses [Drizzle ORM](https://orm.drizzle.team/) for database management. Migrations are handled automatically:

1. **Schema Definition**: All 23 event tables are defined in `src/schema/index.ts`
2. **Migration Generation**: Run `bun run db:generate` to create SQL migration files in `drizzle/`
3. **Auto-Migration on Startup**: When the indexer starts, the Apibara drizzle plugin automatically applies pending migrations

**Important**: Migrations run automatically on indexer startup. You don't need to manually run migrations unless you're using `db:push` for development.

### Database Commands

```bash
# Start PostgreSQL and pgAdmin
bun run docker:up

# Stop containers
bun run docker:down

# View logs
bun run docker:logs

# Generate new migrations (after schema changes)
bun run db:generate

# Push schema directly (development only, skips migrations)
bun run db:push

# Open Drizzle Studio (database GUI)
bun run db:studio
```

### Accessing pgAdmin

pgAdmin is included for database inspection and management.

1. Open http://localhost:5050 in your browser
2. Login with:
   - **Email**: `admin@horizon.io`
   - **Password**: `admin`
3. Add a new server connection:
   - **Host**: `postgres` (Docker network name) or `host.docker.internal` (from host)
   - **Port**: `5432`
   - **Database**: `horizon_indexer`
   - **Username**: `horizon`
   - **Password**: `horizon`

### Direct Database Access

Connect directly via `psql`:

```bash
# From host machine
psql postgres://horizon:horizon@localhost:5432/horizon_indexer

# Or via Docker
docker exec -it indexer-postgres-1 psql -U horizon -d horizon_indexer

# List all tables
docker exec indexer-postgres-1 psql -U horizon -d horizon_indexer -c '\dt'

# Query a table
docker exec indexer-postgres-1 psql -U horizon -d horizon_indexer -c 'SELECT * FROM market_swap LIMIT 5;'
```

## Development

```bash
# Type check
bun run typecheck

# Lint
bun run lint

# Format
bun run format

# Run all checks
bun run check

# Regenerate event ABIs from contracts
bun run codegen
```

## Project Structure

```
packages/indexer/
├── src/
│   ├── indexers/           # Indexer definitions
│   │   ├── factory.indexer.ts
│   │   ├── market-factory.indexer.ts
│   │   ├── market.indexer.ts
│   │   ├── router.indexer.ts
│   │   ├── sy.indexer.ts
│   │   └── yt.indexer.ts
│   ├── schema/             # Drizzle schema (23 tables)
│   │   └── index.ts
│   └── lib/
│       ├── abi/            # Generated event ABIs
│       └── constants.ts    # Network configurations
├── drizzle/                # Database migrations
├── scripts/                # Utility scripts
├── apibara.config.ts       # Apibara configuration
├── drizzle.config.ts       # Drizzle configuration
└── docker-compose.yml      # PostgreSQL + pgAdmin
```

## Troubleshooting

### Connection Refused to DNA Server

```
ERROR: connect ECONNREFUSED 127.0.0.1:7171
```

Ensure your DNA server is running and `DNA_STREAM_URL` is correctly set in `.env`.

### Migration Errors

If you see "relation already exists" errors:

```bash
# Reset the database
bun run docker:down
docker volume rm indexer_postgres_data
bun run docker:up
```

### Missing pg Module

```bash
bun add pg
```
