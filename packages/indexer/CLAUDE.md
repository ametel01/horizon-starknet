# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Event indexer for Horizon Protocol on Starknet using Apibara DNA with TypeScript. Captures all protocol events and stores them in PostgreSQL using a "one table per event type" architecture with 23 event tables across 6 contracts.

## Build Commands

```bash
bun install                  # Install dependencies
bun run dev                  # Run indexer with devnet preset
bun run dev:mainnet          # Run with mainnet preset (block 800,000+)
bun run dev:sepolia          # Run with sepolia preset (block 100,000+)
bun run check                # Run typecheck + lint + format:check
bun run typecheck            # TypeScript type checking only
bun run codegen              # Regenerate event ABIs from contracts
```

### Testing Commands

```bash
bun run test                 # Run snapshot tests
bun run test:update          # Update snapshots after code changes
```

### Database Commands

```bash
bun run docker:up            # Start PostgreSQL + pgAdmin
bun run docker:down          # Stop containers
bun run db:generate          # Generate Drizzle migrations after schema changes
bun run db:push              # Push schema directly (dev only, skips migrations)
bun run db:studio            # Open Drizzle Studio (database GUI)
```

Migrations auto-apply on indexer startup via the Apibara drizzle plugin.

## Architecture

### Indexer Types

**Static Contract Indexers** (fixed addresses known at startup):
- `factory.indexer.ts` - YieldContractsCreated, ClassHashesUpdated
- `market-factory.indexer.ts` - MarketCreated, MarketClassHashUpdated
- `router.indexer.ts` - MintPY, RedeemPY, AddLiquidity, RemoveLiquidity, Swap, SwapYT

**Factory Pattern Indexers** (discover contracts dynamically):
- `sy.indexer.ts` - Deposit, Redeem, OracleRateUpdated (discovers SY contracts from Factory)
- `yt.indexer.ts` - MintPY, RedeemPY, RedeemPYPostExpiry, InterestClaimed, ExpiryReached (discovers YT from Factory)
- `market.indexer.ts` - Mint, Burn, Swap, ImpliedRateUpdated, FeesCollected (discovers Markets from MarketFactory)

### Key Files

| Path | Purpose |
|------|---------|
| `src/schema/index.ts` | All 23 Drizzle ORM table definitions |
| `src/lib/constants.ts` | Network-specific contract addresses |
| `src/lib/abi/` | Contract ABIs for event decoding |
| `apibara.config.ts` | Apibara configuration with network presets |
| `drizzle.config.ts` | Drizzle ORM migration configuration |

### Schema Conventions

- All tables have `_id` (UUID primary key) - required by Apibara drizzle plugin
- All tables include `_cursor` for reorg tracking (automatic)
- Numeric precision 78 for WAD (10^18) fixed-point numbers
- Table naming: `{contract}_{event_name}` in snake_case

## Code Patterns

### Event Selector Computation
```typescript
import { hash } from "starknet";
const MINT_PY = hash.getSelectorFromName("MintPY") as `0x${string}`;
```

### U256 Parsing (two felts: low + high)
```typescript
const parseU256 = (low: string, high: string): bigint =>
  BigInt(low) + (BigInt(high) << 128n);
```

### Factory Pattern Hook
```typescript
async factory({ block: { events } }) {
  const newFilters = events
    .filter((e) => e.keys?.[0] === MARKET_CREATED)
    .map((event) => {
      const marketAddress = event.data?.[0];
      return { address: marketAddress, keys: [SWAP] };
    });
  return newFilters.length ? { filter: { events: newFilters } } : {};
}
```

## Bun-Specific Guidelines

- Use `bun run <script>` instead of npm/yarn
- Use `bunx <package>` instead of npx
- Bun auto-loads `.env` - don't use dotenv
- Use `Bun.file()` over `node:fs` readFile/writeFile

## Infrastructure

- **Runtime**: Bun (not Node.js)
- **Framework**: Apibara 2.1.0-beta.47
- **ORM**: Drizzle 0.40.1
- **Database**: PostgreSQL 16
- **DNA Server**: Self-hosted Apibara DNA at localhost:7171 (requires Starknet RPC)
