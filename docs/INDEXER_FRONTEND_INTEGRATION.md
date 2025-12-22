# Indexer-Frontend Integration Analysis

This document analyzes the indexer schema against proposed frontend features and provides recommendations for integration.

## Schema Overview

The indexer captures 23 event tables across 6 contracts:
- **Factory** (2): YieldContractsCreated, ClassHashesUpdated
- **MarketFactory** (2): MarketCreated, ClassHashUpdated
- **SY** (3): Deposit, Redeem, OracleRateUpdated
- **YT** (5): MintPY, RedeemPY, RedeemPYPostExpiry, InterestClaimed, ExpiryReached
- **Market** (5): Mint, Burn, Swap, ImpliedRateUpdated, FeesCollected
- **Router** (6): MintPY, RedeemPY, AddLiquidity, RemoveLiquidity, Swap, SwapYT

---

## Feature Implementability Analysis

### All 12 Proposed Features Are Implementable

| Feature | Status | Schema Tables Used |
|---------|--------|-------------------|
| Transaction history | **Yes** | All tables have `block_timestamp`, `transaction_hash`, user addresses |
| Portfolio value over time | **Yes** | `exchange_rate` in YT/Market events, `total_supply_after` fields |
| Yield earned per position | **Yes** | `py_index` + `exchange_rate` in `yt_mint_py`, `yt_redeem_py`, `yt_interest_claimed` |
| Real-time APY | **Yes** | `sy_oracle_rate_updated` has rate changes with timestamps |
| TVL charts | **Yes** | `total_supply_after`, `sy_reserve_after`, `pt_reserve_after` |
| Volume analytics | **Yes** | All swap/trade amounts with timestamps in `market_swap`, `router_swap` |
| Price impact analysis | **Yes** | `implied_rate_before`, `implied_rate_after` in `market_swap` |
| LP P&L tracking | **Yes** | `market_mint`/`market_burn` have entry/exit `exchange_rate`, `implied_rate` |
| Maturity calendar | **Yes** | `expiry` in most events, `yt_expiry_reached` for final snapshots |
| Leaderboards | **Yes** | Full trade context with user addresses across all tables |
| Rate correlation | **Yes** | `exchange_rate` + `implied_rate` in market events |
| Fee revenue tracking | **Yes** | `fee` field on `market_swap`, dedicated `market_fees_collected` table |

---

## Schema Gaps and Proposed Fixes

### Gap 1: Router Events Lack Enrichment ✅ FIXED

Router events are the primary user-facing events but lack enriched data compared to contract-level events.

**Affected tables:**
- `router_mint_py` - missing: `expiry`, `exchange_rate`, `py_index`, `sy`, `pt`
- `router_redeem_py` - missing: `expiry`, `exchange_rate`, `sy`, `pt`
- `router_add_liquidity` - missing: `expiry`, `exchange_rate`, `implied_rate`, `sy`, `pt`
- `router_remove_liquidity` - missing: `expiry`, `exchange_rate`, `implied_rate`, `sy`, `pt`
- `router_swap` - missing: `expiry`, `exchange_rate`, `implied_rate`, `fee`, `sy`, `pt`
- `router_swap_yt` - missing: `expiry`, `exchange_rate`, `implied_rate`

**Solution Implemented: PostgreSQL Views**

Created 6 enriched views in `drizzle/0001_enriched_router_views.sql`:

| View | Joins With | Enrichment Fields |
|------|------------|-------------------|
| `enriched_router_swap` | `market_swap`, `market_factory_market_created` | expiry, sy, pt, yt, underlying, exchange_rate, implied_rate_before/after, fee, reserves |
| `enriched_router_swap_yt` | `market_swap`, `market_factory_market_created` | expiry, sy, pt, underlying, exchange_rate, implied_rate, fee |
| `enriched_router_add_liquidity` | `market_mint`, `market_factory_market_created` | expiry, sy, pt, yt, underlying, exchange_rate, implied_rate, reserves, total_lp |
| `enriched_router_remove_liquidity` | `market_burn`, `market_factory_market_created` | expiry, sy, pt, yt, underlying, exchange_rate, implied_rate, reserves, total_lp |
| `enriched_router_mint_py` | `yt_mint_py` | expiry, sy, pt, py_index, exchange_rate, total_pt/yt_supply |
| `enriched_router_redeem_py` | `yt_redeem_py`, `yt_redeem_py_post_expiry` | expiry, sy, pt, py_index, exchange_rate, is_post_expiry |

**How It Works:**
Router calls emit both router events AND underlying contract events (market/yt) in the same transaction. Views join on `transaction_hash` to correlate them.

**Apply Migration:**
```bash
cd packages/indexer
bun run db:migrate
```

**TypeScript Usage:**
```typescript
import { enrichedRouterSwap, enrichedRouterMintPY } from '@horizon/indexer/schema';

// Query enriched swap history
const swaps = await db.select().from(enrichedRouterSwap)
  .where(eq(enrichedRouterSwap.sender, userAddress))
  .orderBy(desc(enrichedRouterSwap.block_timestamp));
```

### Gap 2: Factory YieldContractsCreated Missing Enrichment

The `factory_yield_contracts_created` table lacks:
- `underlying` address
- `underlying_symbol`
- `initial_exchange_rate`

**Impact:** Cannot display full token info from factory events alone.

**Workaround:** These can be obtained by joining with `market_factory_market_created` which has full enrichment.

### Gap 3: No Computed/Aggregated Tables ✅ FIXED

The schema stores raw events but lacks:
- Aggregated daily/hourly snapshots
- User position summaries
- Market summary stats

**Solution Implemented: 9 Materialized Views**

Created in `drizzle/0002_aggregated_materialized_views.sql`:

| View | Purpose | Key Fields |
|------|---------|------------|
| `market_daily_stats` | Daily market metrics | OHLC rates, volume, fees, TVL, unique traders |
| `market_hourly_stats` | Hourly granular data | Reserves, rates, volume for real-time charts |
| `user_positions_summary` | PT/YT positions | Net balances, entry metrics, interest claimed |
| `user_lp_positions` | LP positions | Net LP, entry/exit rates for P&L |
| `protocol_daily_stats` | Protocol-wide metrics | Total volume, fees, users, mints |
| `market_current_state` | Latest market state | Current reserves, rates, 24h stats, is_expired |
| `user_trading_stats` | Leaderboard data | Total swaps, volume, fees paid |
| `rate_history` | Rate time series | Implied rate before/after for charts |
| `exchange_rate_history` | Oracle rate history | SY exchange rate changes |

**Apply Migration:**
```bash
cd packages/indexer
bun run db:migrate
```

**Refresh Views (run periodically via cron):**
```sql
-- Refresh all views at once
SELECT refresh_all_materialized_views();

-- Or refresh individually
REFRESH MATERIALIZED VIEW CONCURRENTLY market_daily_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY user_positions_summary;
```

**Recommended Refresh Schedule:**
- `market_hourly_stats`: Every 5 minutes
- `market_current_state`: Every 5 minutes
- `market_daily_stats`: Every 15 minutes
- `user_positions_summary`: Every 15 minutes
- `protocol_daily_stats`: Every hour
- `user_trading_stats`: Every hour

**TypeScript Usage:**
```typescript
import {
  marketDailyStats,
  userPositionsSummary,
  marketCurrentState,
  protocolDailyStats,
} from '@horizon/indexer/schema';

// Get market TVL history
const tvlHistory = await db.select().from(marketDailyStats)
  .where(eq(marketDailyStats.market, marketAddress))
  .orderBy(desc(marketDailyStats.day))
  .limit(30);

// Get user portfolio
const positions = await db.select().from(userPositionsSummary)
  .where(eq(userPositionsSummary.user_address, userAddress));

// Get all active markets with current state
const markets = await db.select().from(marketCurrentState)
  .where(eq(marketCurrentState.is_expired, false))
  .orderBy(desc(marketCurrentState.volume_24h));

// Get protocol stats for dashboard
const stats = await db.select().from(protocolDailyStats)
  .orderBy(desc(protocolDailyStats.day))
  .limit(30);
```

---

## Additional Implementable Features

Beyond the 12 proposed features, the schema enables:

| Feature | Implementation |
|---------|----------------|
| **User activity feed** | Query all tables by sender/receiver/caller/user address |
| **Market depth history** | `sy_reserve_after`, `pt_reserve_after` time series |
| **Interest rate term structure** | Multiple markets with different expiries, query by `expiry` |
| **Slippage analysis** | Calculate from swap amounts vs implied rate changes |
| **Whale tracking** | Filter by amount thresholds across swap/mint events |
| **Protocol revenue dashboard** | `market_fees_collected` + sum of `fee` from swaps |
| **Time-weighted APY (TWAPY)** | `block_timestamp` + `implied_rate` enables TWAP calculations |
| **Expiry countdown alerts** | `yt_expiry_reached` + `expiry` fields across tables |
| **Position entry/exit P&L** | `py_index` at mint vs redeem enables exact yield calculation |
| **Exchange rate history** | `sy_oracle_rate_updated` provides complete rate timeline |
| **Liquidity mining analytics** | `market_mint`/`market_burn` with timestamps |
| **Gas usage tracking** | Would need additional indexing of transaction receipts |

---

## Backend Architecture Recommendation

### Current Frontend Architecture

The frontend currently:
- Fetches data directly from RPC calls to Starknet
- Uses React Query for caching (30-60s stale time)
- Has no API layer between UI and blockchain

### Recommended Architecture: Next.js API Routes + Direct DB

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Browser   │────▶│  Next.js Frontend │────▶│  PostgreSQL  │
│   (React)   │     │   (API Routes)    │     │   (Indexer)  │
└─────────────┘     └──────────────────┘     └──────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Starknet RPC    │
                    │  (Real-time)     │
                    └──────────────────┘
```

**Why Next.js API Routes (No Separate Backend Package):**

1. **Simplicity** - Single deployment, shared TypeScript types
2. **Sufficient for scale** - Read-heavy workload suits serverless well
3. **Already using Next.js** - No new infrastructure needed
4. **Edge caching** - Vercel/Cloudflare can cache API responses

**When to Add Separate Backend:**
- Need WebSocket for real-time updates (consider: SSE works in Next.js)
- Complex aggregation queries that timeout on serverless
- Multi-tenant rate limiting
- Background job processing

### Hybrid Data Strategy

| Data Type | Source | Why |
|-----------|--------|-----|
| Historical data (tx history, charts) | PostgreSQL (indexed) | Faster, no RPC limits |
| Real-time state (current balances, rates) | Starknet RPC | Always fresh |
| Aggregations (TVL, volume) | PostgreSQL + materialized views | Precomputed |
| User positions | PostgreSQL with RPC verification | Trust but verify |

---

## Implementation Roadmap

### Phase 1: Database Access Layer (1-2 days)

1. Add Drizzle ORM to frontend package
2. Create database connection utility
3. Add environment variables for DB connection

```typescript
// src/lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@indexer/schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
```

### Phase 2: API Routes (2-3 days)

Create Next.js API routes for indexed data:

```
src/app/api/
├── markets/
│   ├── route.ts              # GET /api/markets - list all markets
│   └── [address]/
│       ├── route.ts          # GET /api/markets/[address] - market details
│       ├── swaps/route.ts    # GET /api/markets/[address]/swaps
│       ├── tvl/route.ts      # GET /api/markets/[address]/tvl (time series)
│       └── rates/route.ts    # GET /api/markets/[address]/rates (time series)
├── users/
│   └── [address]/
│       ├── history/route.ts  # GET /api/users/[address]/history
│       ├── positions/route.ts # GET /api/users/[address]/positions
│       └── yield/route.ts    # GET /api/users/[address]/yield
├── analytics/
│   ├── tvl/route.ts          # GET /api/analytics/tvl
│   ├── volume/route.ts       # GET /api/analytics/volume
│   └── fees/route.ts         # GET /api/analytics/fees
└── health/route.ts           # GET /api/health (indexer sync status)
```

### Phase 3: React Query Integration (1-2 days)

Create hooks that fetch from API routes:

```typescript
// src/hooks/useMarketHistory.ts
export function useMarketHistory(marketAddress: string) {
  return useQuery({
    queryKey: ['market', 'history', marketAddress],
    queryFn: () => fetch(`/api/markets/${marketAddress}/swaps`).then(r => r.json()),
    staleTime: 30_000,
  });
}

// src/hooks/useUserTransactionHistory.ts
export function useUserHistory(userAddress: string) {
  return useQuery({
    queryKey: ['user', 'history', userAddress],
    queryFn: () => fetch(`/api/users/${userAddress}/history`).then(r => r.json()),
    staleTime: 60_000,
  });
}
```

### Phase 4: UI Components (3-5 days)

- Transaction history table
- TVL/Volume charts (use Recharts or similar)
- Rate history charts
- Portfolio value over time
- Yield earned breakdown

### Phase 5: Materialized Views (1 day)

Add PostgreSQL materialized views for expensive aggregations:
- Daily market snapshots
- User position summaries
- Protocol-wide stats

---

## Database Connection Considerations

### Option A: Direct Connection from Serverless

```typescript
// Needs connection pooling for serverless
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Serverless needs smaller pools
  idleTimeoutMillis: 10000,
});
```

**Pros:** Simple setup
**Cons:** Connection limits can be exhausted

### Option B: Connection Pooler (Recommended)

Use PgBouncer, Supabase Pooler, or Neon's pooler:

```
DATABASE_URL=postgres://user:pass@pooler.host:6543/db?pgbouncer=true
```

**Pros:** Handles connection limits, works well with serverless
**Cons:** Slightly more infrastructure

### Option C: Prisma Accelerate / Drizzle HTTP

Use HTTP-based database access:

```typescript
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql);
```

**Pros:** No connection pooling needed
**Cons:** Slightly higher latency

---

## Security Considerations

1. **Read-only credentials** - Frontend API should only have SELECT permissions
2. **Rate limiting** - Add rate limiting to API routes
3. **Validation** - Validate address parameters before queries
4. **Pagination** - All list endpoints should be paginated
5. **CORS** - Configure appropriately for production domain

---

## Post-Deploy TODOs

### 1. Run Database Migrations

```bash
cd packages/indexer
bun run db:migrate
```

### 2. Set Up Materialized View Refresh Schedule

Set up via pg_cron or external scheduler (e.g., Railway cron, AWS EventBridge, GitHub Actions):

```sql
-- Every 5 minutes
REFRESH MATERIALIZED VIEW CONCURRENTLY market_hourly_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY market_current_state;

-- Every 15 minutes
REFRESH MATERIALIZED VIEW CONCURRENTLY market_daily_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY user_positions_summary;
REFRESH MATERIALIZED VIEW CONCURRENTLY user_lp_positions;

-- Hourly
REFRESH MATERIALIZED VIEW CONCURRENTLY protocol_daily_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY user_trading_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY rate_history;
REFRESH MATERIALIZED VIEW CONCURRENTLY exchange_rate_history;
```

**Option A: pg_cron (if available)**
```sql
-- Install pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule 5-minute refreshes
SELECT cron.schedule('refresh-5min', '*/5 * * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY market_hourly_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY market_current_state;
$$);

-- Schedule 15-minute refreshes
SELECT cron.schedule('refresh-15min', '*/15 * * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY market_daily_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_positions_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_lp_positions;
$$);

-- Schedule hourly refreshes
SELECT cron.schedule('refresh-hourly', '0 * * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY protocol_daily_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_trading_stats;
$$);
```

**Option B: External cron job**
```bash
# crontab entry calling psql
*/5 * * * * psql $DATABASE_URL -c "SELECT refresh_all_materialized_views();"
```

### 3. Create Read-Only Database User

```sql
-- Create read-only user for frontend API
CREATE USER frontend_readonly WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE horizon_indexer TO frontend_readonly;
GRANT USAGE ON SCHEMA public TO frontend_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO frontend_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO frontend_readonly;
```

### 4. Configure Environment Variables

Add to frontend `.env`:
```bash
# Read-only connection for frontend API routes
DATABASE_URL=postgres://frontend_readonly:password@host:5432/horizon_indexer
```

---

## Conclusion

**Schema Assessment:** The current indexer schema is well-designed and supports all 12 proposed features. Minor gaps exist in router event enrichment but can be solved with SQL views.

**Backend Decision:** No separate backend package is needed. Next.js API routes provide sufficient capability for this use case while maintaining simplicity.

**Next Steps:**
1. Set up database connection in frontend
2. Implement core API routes for transaction history and analytics
3. Add React Query hooks for indexed data
4. Build UI components for historical data visualization
