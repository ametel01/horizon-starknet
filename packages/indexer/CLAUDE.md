# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Event indexer for Horizon Protocol on Starknet using Apibara DNA with TypeScript. Captures all protocol events and stores them in PostgreSQL using a "one table per event type" architecture with 24 event tables across 6 contracts + 15 database views for analytics.

## Build Commands

```bash
bun install                  # Install dependencies
bun run dev                  # Run indexer with devnet preset
bun run dev:mainnet          # Run with mainnet preset (block 4,643,300+)
bun run dev:sepolia          # Run with sepolia preset (block 4,194,445+)
bun run check                # Run typecheck + lint + format:check
bun run typecheck            # TypeScript type checking only
bun run codegen              # Regenerate event ABIs from contracts
```

### Testing Commands

```bash
bun run test                 # Run snapshot tests (uses vitest + cassettes)
bun run test:watch           # Watch mode for development
```

Tests use Apibara's VCR pattern - cassettes in `cassettes/` record DNA stream data for replay.

### Database Commands

```bash
bun run docker:up            # Start PostgreSQL + pgAdmin + MinIO + DNA server
bun run docker:down          # Stop containers
bun run db:generate          # Generate Drizzle migrations after schema changes
bun run db:push              # Push schema directly (dev only, skips migrations)
bun run db:studio            # Open Drizzle Studio (database GUI)
bun run db:create-views      # Create/update PostgreSQL views
bun run db:refresh-views     # Refresh materialized views
```

Migrations auto-apply on indexer startup via the Apibara drizzle plugin.

## Architecture

### Indexer Types

**Static Contract Indexers** (fixed addresses from `src/lib/constants.ts`):
- `factory.indexer.ts` - YieldContractsCreated, ClassHashesUpdated
- `market-factory.indexer.ts` - MarketCreated, MarketClassHashUpdated
- `router.indexer.ts` - MintPY, RedeemPY, AddLiquidity, RemoveLiquidity, Swap, SwapYT

**Factory Pattern Indexers** (discover contracts dynamically + use `knownContracts` for restarts):
- `sy.indexer.ts` - Deposit, Redeem, OracleRateUpdated (discovers SY from Factory.YieldContractsCreated)
- `yt.indexer.ts` - MintPY, RedeemPY, RedeemPYPostExpiry, InterestClaimed, ExpiryReached (discovers YT from Factory)
- `market.indexer.ts` - Mint, Burn, Swap, ImpliedRateUpdated, FeesCollected, ScalarRootUpdated (discovers Markets from MarketFactory)

### Key Files

| Path | Purpose |
|------|---------|
| `src/schema/index.ts` | 24 Drizzle ORM tables + 15 view definitions |
| `src/lib/constants.ts` | Network configs with `knownContracts` for factory indexers |
| `src/lib/utils.ts` | `matchSelector`, `readU256`, `readI256`, `decodeByteArray` |
| `apibara.config.ts` | Apibara config with devnet/sepolia/mainnet presets |

### Schema Conventions

- All tables have `_id` (UUID primary key) - required by Apibara drizzle plugin
- All tables include `_cursor` for reorg tracking (added automatically)
- Numeric precision 78 for WAD (10^18) fixed-point numbers
- Table naming: `{contract}_{event_name}` in snake_case
- Views: enriched views join router events with underlying contract events for frontend

## Code Patterns

### Event Selector (use Apibara helper)
```typescript
import { getSelector } from "@apibara/starknet";
const MINT_PY = getSelector("MintPY");
```

### Selector Matching (handles padding differences)
```typescript
import { matchSelector } from "../lib/utils";
if (matchSelector(event.keys[0], MINT_PY)) { ... }
```

### U256 Parsing (uses starknet.js)
```typescript
import { readU256 } from "../lib/utils";
const amount = readU256(data, 2);  // reads data[2] (low) + data[3] (high)
```

### ByteArray Decoding (for Cairo strings)
```typescript
import { decodeByteArray } from "../lib/utils";
const symbol = decodeByteArray(data, 4);  // reads ByteArray starting at index 4
```

### Factory Pattern with Known Contracts
```typescript
// Initial filter includes known contracts for restart resilience
const knownMarketFilters = config.knownMarkets.flatMap((addr) => [
  { address: addr, keys: [SWAP] },
  { address: addr, keys: [MINT] },
]);

return defineIndexer(StarknetStream)({
  filter: {
    events: [
      { address: config.marketFactory, keys: [MARKET_CREATED] },
      ...knownMarketFilters,
    ],
  },
  async factory({ block: { events } }) {
    // Discover new contracts from creation events
    const newFilters = events
      .filter((e) => matchSelector(e.keys[0], MARKET_CREATED))
      .flatMap((event) => {
        const marketAddress = event.data[0] as `0x${string}`;
        return [
          { address: marketAddress, keys: [SWAP] },
          { address: marketAddress, keys: [MINT] },
        ];
      });
    return newFilters.length ? { filter: { events: newFilters } } : {};
  },
});
```

### Batch Inserts Pattern
```typescript
const { db } = useDrizzleStorage();
const rows: typeof marketSwap.$inferInsert[] = [];

for (const event of events) {
  rows.push({ ... });
}

if (rows.length > 0) {
  await db.insert(marketSwap).values(rows);
}
```

## Adding a New Event

1. Add table definition in `src/schema/index.ts`
2. Run `bun run db:generate` to create migration
3. Add event selector in indexer: `const NEW_EVENT = getSelector("NewEvent");`
4. Add filter: `{ address: config.contract, keys: [NEW_EVENT] }`
5. Add parsing logic in transform function
6. Update `knownContracts` in `src/lib/constants.ts` if factory pattern

## Bun-Specific Guidelines

- Use `bun run <script>` instead of npm/yarn
- Use `bunx <package>` instead of npx
- Bun auto-loads `.env` - don't use dotenv

## Infrastructure

- **Runtime**: Bun (not Node.js)
- **Framework**: Apibara 2.1.0-beta.47
- **ORM**: Drizzle 0.45.1
- **Database**: PostgreSQL 16
- **DNA Server**: Self-hosted Apibara DNA at localhost:7171 or Apibara hosted (mainnet.starknet.a5a.ch)
