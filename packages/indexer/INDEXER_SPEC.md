# Horizon Protocol Indexer Specification

## Overview

This document specifies the complete implementation plan for the Horizon Protocol indexer using Apibara DNA with the TypeScript SDK. The indexer will capture all protocol events and persist them to PostgreSQL for frontend consumption.

**Runtime:** Bun (v1.0+)

---

## Quick Start

```bash
# 1. Navigate to indexer package
cd packages/indexer

# 2. Install dependencies
bun install

# 3. Start PostgreSQL
bun run docker:up

# 4. Run migrations
bun run db:migrate

# 5. Start indexer (choose network)
bun run dev:mainnet   # Production
bun run dev:sepolia   # Testnet
bun run dev:devnet    # Local development
```

---

## Architecture Decision: One Table Per Event

**Decision: YES - Each event type writes to its own dedicated table.**

### Rationale

1. **Race Condition Prevention**
   - Each indexer (sink) writes exclusively to one table
   - No concurrent writes from multiple indexers to the same table
   - Eliminates row-level locking contention

2. **Independent Scaling**
   - Each event indexer can run as a separate process
   - Slow events don't block fast events
   - Can restart individual indexers without affecting others

3. **Reorg Handling Isolation**
   - Apibara's drizzle plugin handles reorgs per-indexer
   - Each indexer tracks its own cursor position
   - Rollbacks are isolated to affected tables only

4. **Query Performance**
   - Each table can have optimized indexes for its specific query patterns
   - No polymorphic "event_type" column filtering overhead
   - Smaller table scans for type-specific queries

5. **Schema Evolution**
   - Adding fields to one event doesn't affect others
   - Migrations are simpler and isolated

### Trade-offs

- More tables to manage (23 event types = 23 tables)
- Cross-event queries require JOINs or UNION
- Mitigated by: PostgreSQL materialized views for aggregate queries

---

## Database Schema

### Naming Convention

- Table names: `{contract}_{event_name}` (snake_case)
- All tables have `_id` as UUID primary key (required by Apibara drizzle plugin)
- All tables include `_cursor` for reorg tracking (handled automatically)

### Schema Definitions

```typescript
// packages/indexer/src/schema/index.ts

import {
  bigint,
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
} from "drizzle-orm/pg-core";

// ============================================================
// FACTORY EVENTS
// ============================================================

export const factoryYieldContractsCreated = pgTable(
  "factory_yield_contracts_created",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    // Block context
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    sy: text("sy").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data
    pt: text("pt").notNull(),
    yt: text("yt").notNull(),
    creator: text("creator").notNull(),
  },
  (table) => ({
    syIdx: index("factory_ycc_sy_idx").on(table.sy),
    expiryIdx: index("factory_ycc_expiry_idx").on(table.expiry),
    creatorIdx: index("factory_ycc_creator_idx").on(table.creator),
  })
);

export const factoryClassHashesUpdated = pgTable(
  "factory_class_hashes_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    yt_class_hash: text("yt_class_hash").notNull(),
    pt_class_hash: text("pt_class_hash").notNull(),
  }
);

// ============================================================
// MARKET FACTORY EVENTS
// ============================================================

export const marketFactoryMarketCreated = pgTable(
  "market_factory_market_created",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    pt: text("pt").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data
    market: text("market").notNull(),
    creator: text("creator").notNull(),
    scalar_root: numeric("scalar_root", { precision: 78, scale: 0 }).notNull(),
    initial_anchor: numeric("initial_anchor", { precision: 78, scale: 0 }).notNull(),
    fee_rate: numeric("fee_rate", { precision: 78, scale: 0 }).notNull(),
    sy: text("sy").notNull(),
    yt: text("yt").notNull(),
    underlying: text("underlying").notNull(),
    underlying_symbol: text("underlying_symbol").notNull(),
    initial_exchange_rate: numeric("initial_exchange_rate", { precision: 78, scale: 0 }).notNull(),
    market_index: integer("market_index").notNull(),
  },
  (table) => ({
    ptIdx: index("mf_mc_pt_idx").on(table.pt),
    expiryIdx: index("mf_mc_expiry_idx").on(table.expiry),
    marketIdx: index("mf_mc_market_idx").on(table.market),
    underlyingIdx: index("mf_mc_underlying_idx").on(table.underlying),
  })
);

export const marketFactoryClassHashUpdated = pgTable(
  "market_factory_class_hash_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    old_class_hash: text("old_class_hash").notNull(),
    new_class_hash: text("new_class_hash").notNull(),
  }
);

// ============================================================
// SY (STANDARDIZED YIELD) EVENTS
// ============================================================

export const syDeposit = pgTable(
  "sy_deposit",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    caller: text("caller").notNull(),
    receiver: text("receiver").notNull(),
    underlying: text("underlying").notNull(),
    // Event data (SY contract address from event source)
    sy: text("sy").notNull(),
    amount_deposited: numeric("amount_deposited", { precision: 78, scale: 0 }).notNull(),
    amount_sy_minted: numeric("amount_sy_minted", { precision: 78, scale: 0 }).notNull(),
    exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }).notNull(),
    total_supply_after: numeric("total_supply_after", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    callerIdx: index("sy_deposit_caller_idx").on(table.caller),
    receiverIdx: index("sy_deposit_receiver_idx").on(table.receiver),
    syIdx: index("sy_deposit_sy_idx").on(table.sy),
    underlyingIdx: index("sy_deposit_underlying_idx").on(table.underlying),
  })
);

export const syRedeem = pgTable(
  "sy_redeem",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    caller: text("caller").notNull(),
    receiver: text("receiver").notNull(),
    underlying: text("underlying").notNull(),
    // Event data
    sy: text("sy").notNull(),
    amount_sy_burned: numeric("amount_sy_burned", { precision: 78, scale: 0 }).notNull(),
    amount_redeemed: numeric("amount_redeemed", { precision: 78, scale: 0 }).notNull(),
    exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }).notNull(),
    total_supply_after: numeric("total_supply_after", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    callerIdx: index("sy_redeem_caller_idx").on(table.caller),
    receiverIdx: index("sy_redeem_receiver_idx").on(table.receiver),
    syIdx: index("sy_redeem_sy_idx").on(table.sy),
  })
);

export const syOracleRateUpdated = pgTable(
  "sy_oracle_rate_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    sy: text("sy").notNull(),
    underlying: text("underlying").notNull(),
    // Event data
    old_rate: numeric("old_rate", { precision: 78, scale: 0 }).notNull(),
    new_rate: numeric("new_rate", { precision: 78, scale: 0 }).notNull(),
    rate_change_bps: numeric("rate_change_bps", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    syIdx: index("sy_oru_sy_idx").on(table.sy),
    underlyingIdx: index("sy_oru_underlying_idx").on(table.underlying),
  })
);

// ============================================================
// YT (YIELD TOKEN) EVENTS
// ============================================================

export const ytMintPY = pgTable(
  "yt_mint_py",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    caller: text("caller").notNull(),
    receiver: text("receiver").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data (YT contract from event source)
    yt: text("yt").notNull(),
    sy: text("sy").notNull(),
    pt: text("pt").notNull(),
    amount_sy_deposited: numeric("amount_sy_deposited", { precision: 78, scale: 0 }).notNull(),
    amount_py_minted: numeric("amount_py_minted", { precision: 78, scale: 0 }).notNull(),
    py_index: numeric("py_index", { precision: 78, scale: 0 }).notNull(),
    exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }).notNull(),
    total_pt_supply_after: numeric("total_pt_supply_after", { precision: 78, scale: 0 }).notNull(),
    total_yt_supply_after: numeric("total_yt_supply_after", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    callerIdx: index("yt_mint_caller_idx").on(table.caller),
    receiverIdx: index("yt_mint_receiver_idx").on(table.receiver),
    expiryIdx: index("yt_mint_expiry_idx").on(table.expiry),
    ytIdx: index("yt_mint_yt_idx").on(table.yt),
  })
);

export const ytRedeemPY = pgTable(
  "yt_redeem_py",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    caller: text("caller").notNull(),
    receiver: text("receiver").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data
    yt: text("yt").notNull(),
    sy: text("sy").notNull(),
    pt: text("pt").notNull(),
    amount_py_redeemed: numeric("amount_py_redeemed", { precision: 78, scale: 0 }).notNull(),
    amount_sy_returned: numeric("amount_sy_returned", { precision: 78, scale: 0 }).notNull(),
    py_index: numeric("py_index", { precision: 78, scale: 0 }).notNull(),
    exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    callerIdx: index("yt_redeem_caller_idx").on(table.caller),
    receiverIdx: index("yt_redeem_receiver_idx").on(table.receiver),
    expiryIdx: index("yt_redeem_expiry_idx").on(table.expiry),
  })
);

export const ytRedeemPYPostExpiry = pgTable(
  "yt_redeem_py_post_expiry",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    caller: text("caller").notNull(),
    receiver: text("receiver").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data
    yt: text("yt").notNull(),
    sy: text("sy").notNull(),
    pt: text("pt").notNull(),
    amount_pt_redeemed: numeric("amount_pt_redeemed", { precision: 78, scale: 0 }).notNull(),
    amount_sy_returned: numeric("amount_sy_returned", { precision: 78, scale: 0 }).notNull(),
    final_py_index: numeric("final_py_index", { precision: 78, scale: 0 }).notNull(),
    final_exchange_rate: numeric("final_exchange_rate", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    callerIdx: index("yt_redeem_pe_caller_idx").on(table.caller),
    receiverIdx: index("yt_redeem_pe_receiver_idx").on(table.receiver),
    expiryIdx: index("yt_redeem_pe_expiry_idx").on(table.expiry),
  })
);

export const ytInterestClaimed = pgTable(
  "yt_interest_claimed",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    user: text("user").notNull(),
    yt: text("yt").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data
    sy: text("sy").notNull(),
    amount_sy: numeric("amount_sy", { precision: 78, scale: 0 }).notNull(),
    yt_balance: numeric("yt_balance", { precision: 78, scale: 0 }).notNull(),
    py_index_at_claim: numeric("py_index_at_claim", { precision: 78, scale: 0 }).notNull(),
    exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    userIdx: index("yt_ic_user_idx").on(table.user),
    ytIdx: index("yt_ic_yt_idx").on(table.yt),
    expiryIdx: index("yt_ic_expiry_idx").on(table.expiry),
  })
);

export const ytExpiryReached = pgTable(
  "yt_expiry_reached",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    market: text("market").notNull(),
    yt: text("yt").notNull(),
    pt: text("pt").notNull(),
    // Event data
    sy: text("sy").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    final_exchange_rate: numeric("final_exchange_rate", { precision: 78, scale: 0 }).notNull(),
    final_py_index: numeric("final_py_index", { precision: 78, scale: 0 }).notNull(),
    total_pt_supply: numeric("total_pt_supply", { precision: 78, scale: 0 }).notNull(),
    total_yt_supply: numeric("total_yt_supply", { precision: 78, scale: 0 }).notNull(),
    sy_reserve: numeric("sy_reserve", { precision: 78, scale: 0 }).notNull(),
    pt_reserve: numeric("pt_reserve", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    ytIdx: index("yt_er_yt_idx").on(table.yt),
    ptIdx: index("yt_er_pt_idx").on(table.pt),
    expiryIdx: index("yt_er_expiry_idx").on(table.expiry),
  })
);

// ============================================================
// MARKET (AMM) EVENTS
// ============================================================

export const marketMint = pgTable(
  "market_mint",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    sender: text("sender").notNull(),
    receiver: text("receiver").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data (market address from event source)
    market: text("market").notNull(),
    sy: text("sy").notNull(),
    pt: text("pt").notNull(),
    sy_amount: numeric("sy_amount", { precision: 78, scale: 0 }).notNull(),
    pt_amount: numeric("pt_amount", { precision: 78, scale: 0 }).notNull(),
    lp_amount: numeric("lp_amount", { precision: 78, scale: 0 }).notNull(),
    exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }).notNull(),
    implied_rate: numeric("implied_rate", { precision: 78, scale: 0 }).notNull(),
    sy_reserve_after: numeric("sy_reserve_after", { precision: 78, scale: 0 }).notNull(),
    pt_reserve_after: numeric("pt_reserve_after", { precision: 78, scale: 0 }).notNull(),
    total_lp_after: numeric("total_lp_after", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    senderIdx: index("market_mint_sender_idx").on(table.sender),
    receiverIdx: index("market_mint_receiver_idx").on(table.receiver),
    expiryIdx: index("market_mint_expiry_idx").on(table.expiry),
    marketIdx: index("market_mint_market_idx").on(table.market),
  })
);

export const marketBurn = pgTable(
  "market_burn",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    sender: text("sender").notNull(),
    receiver: text("receiver").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data
    market: text("market").notNull(),
    sy: text("sy").notNull(),
    pt: text("pt").notNull(),
    lp_amount: numeric("lp_amount", { precision: 78, scale: 0 }).notNull(),
    sy_amount: numeric("sy_amount", { precision: 78, scale: 0 }).notNull(),
    pt_amount: numeric("pt_amount", { precision: 78, scale: 0 }).notNull(),
    exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }).notNull(),
    implied_rate: numeric("implied_rate", { precision: 78, scale: 0 }).notNull(),
    sy_reserve_after: numeric("sy_reserve_after", { precision: 78, scale: 0 }).notNull(),
    pt_reserve_after: numeric("pt_reserve_after", { precision: 78, scale: 0 }).notNull(),
    total_lp_after: numeric("total_lp_after", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    senderIdx: index("market_burn_sender_idx").on(table.sender),
    receiverIdx: index("market_burn_receiver_idx").on(table.receiver),
    expiryIdx: index("market_burn_expiry_idx").on(table.expiry),
    marketIdx: index("market_burn_market_idx").on(table.market),
  })
);

export const marketSwap = pgTable(
  "market_swap",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    sender: text("sender").notNull(),
    receiver: text("receiver").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data
    market: text("market").notNull(),
    sy: text("sy").notNull(),
    pt: text("pt").notNull(),
    pt_in: numeric("pt_in", { precision: 78, scale: 0 }).notNull(),
    sy_in: numeric("sy_in", { precision: 78, scale: 0 }).notNull(),
    pt_out: numeric("pt_out", { precision: 78, scale: 0 }).notNull(),
    sy_out: numeric("sy_out", { precision: 78, scale: 0 }).notNull(),
    fee: numeric("fee", { precision: 78, scale: 0 }).notNull(),
    implied_rate_before: numeric("implied_rate_before", { precision: 78, scale: 0 }).notNull(),
    implied_rate_after: numeric("implied_rate_after", { precision: 78, scale: 0 }).notNull(),
    exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }).notNull(),
    sy_reserve_after: numeric("sy_reserve_after", { precision: 78, scale: 0 }).notNull(),
    pt_reserve_after: numeric("pt_reserve_after", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    senderIdx: index("market_swap_sender_idx").on(table.sender),
    receiverIdx: index("market_swap_receiver_idx").on(table.receiver),
    expiryIdx: index("market_swap_expiry_idx").on(table.expiry),
    marketIdx: index("market_swap_market_idx").on(table.market),
    timestampIdx: index("market_swap_timestamp_idx").on(table.block_timestamp),
  })
);

export const marketImpliedRateUpdated = pgTable(
  "market_implied_rate_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    market: text("market").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data
    old_rate: numeric("old_rate", { precision: 78, scale: 0 }).notNull(),
    new_rate: numeric("new_rate", { precision: 78, scale: 0 }).notNull(),
    time_to_expiry: bigint("time_to_expiry", { mode: "number" }).notNull(),
    exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }).notNull(),
    sy_reserve: numeric("sy_reserve", { precision: 78, scale: 0 }).notNull(),
    pt_reserve: numeric("pt_reserve", { precision: 78, scale: 0 }).notNull(),
    total_lp: numeric("total_lp", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    marketIdx: index("market_iru_market_idx").on(table.market),
    expiryIdx: index("market_iru_expiry_idx").on(table.expiry),
    timestampIdx: index("market_iru_timestamp_idx").on(table.block_timestamp),
  })
);

export const marketFeesCollected = pgTable(
  "market_fees_collected",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    collector: text("collector").notNull(),
    receiver: text("receiver").notNull(),
    market: text("market").notNull(),
    // Event data
    amount: numeric("amount", { precision: 78, scale: 0 }).notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    fee_rate: numeric("fee_rate", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    collectorIdx: index("market_fc_collector_idx").on(table.collector),
    receiverIdx: index("market_fc_receiver_idx").on(table.receiver),
    marketIdx: index("market_fc_market_idx").on(table.market),
  })
);

// ============================================================
// ROUTER EVENTS
// ============================================================

export const routerMintPY = pgTable(
  "router_mint_py",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    sender: text("sender").notNull(),
    receiver: text("receiver").notNull(),
    // Event data
    yt: text("yt").notNull(),
    sy_in: numeric("sy_in", { precision: 78, scale: 0 }).notNull(),
    pt_out: numeric("pt_out", { precision: 78, scale: 0 }).notNull(),
    yt_out: numeric("yt_out", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    senderIdx: index("router_mint_sender_idx").on(table.sender),
    receiverIdx: index("router_mint_receiver_idx").on(table.receiver),
    ytIdx: index("router_mint_yt_idx").on(table.yt),
  })
);

export const routerRedeemPY = pgTable(
  "router_redeem_py",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    sender: text("sender").notNull(),
    receiver: text("receiver").notNull(),
    // Event data
    yt: text("yt").notNull(),
    py_in: numeric("py_in", { precision: 78, scale: 0 }).notNull(),
    sy_out: numeric("sy_out", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    senderIdx: index("router_redeem_sender_idx").on(table.sender),
    receiverIdx: index("router_redeem_receiver_idx").on(table.receiver),
  })
);

export const routerAddLiquidity = pgTable(
  "router_add_liquidity",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    sender: text("sender").notNull(),
    receiver: text("receiver").notNull(),
    // Event data
    market: text("market").notNull(),
    sy_used: numeric("sy_used", { precision: 78, scale: 0 }).notNull(),
    pt_used: numeric("pt_used", { precision: 78, scale: 0 }).notNull(),
    lp_out: numeric("lp_out", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    senderIdx: index("router_al_sender_idx").on(table.sender),
    receiverIdx: index("router_al_receiver_idx").on(table.receiver),
    marketIdx: index("router_al_market_idx").on(table.market),
  })
);

export const routerRemoveLiquidity = pgTable(
  "router_remove_liquidity",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    sender: text("sender").notNull(),
    receiver: text("receiver").notNull(),
    // Event data
    market: text("market").notNull(),
    lp_in: numeric("lp_in", { precision: 78, scale: 0 }).notNull(),
    sy_out: numeric("sy_out", { precision: 78, scale: 0 }).notNull(),
    pt_out: numeric("pt_out", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    senderIdx: index("router_rl_sender_idx").on(table.sender),
    receiverIdx: index("router_rl_receiver_idx").on(table.receiver),
    marketIdx: index("router_rl_market_idx").on(table.market),
  })
);

export const routerSwap = pgTable(
  "router_swap",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    sender: text("sender").notNull(),
    receiver: text("receiver").notNull(),
    // Event data
    market: text("market").notNull(),
    sy_in: numeric("sy_in", { precision: 78, scale: 0 }).notNull(),
    pt_in: numeric("pt_in", { precision: 78, scale: 0 }).notNull(),
    sy_out: numeric("sy_out", { precision: 78, scale: 0 }).notNull(),
    pt_out: numeric("pt_out", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    senderIdx: index("router_swap_sender_idx").on(table.sender),
    receiverIdx: index("router_swap_receiver_idx").on(table.receiver),
    marketIdx: index("router_swap_market_idx").on(table.market),
  })
);

export const routerSwapYT = pgTable(
  "router_swap_yt",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields
    sender: text("sender").notNull(),
    receiver: text("receiver").notNull(),
    // Event data
    yt: text("yt").notNull(),
    market: text("market").notNull(),
    sy_in: numeric("sy_in", { precision: 78, scale: 0 }).notNull(),
    yt_in: numeric("yt_in", { precision: 78, scale: 0 }).notNull(),
    sy_out: numeric("sy_out", { precision: 78, scale: 0 }).notNull(),
    yt_out: numeric("yt_out", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    senderIdx: index("router_swap_yt_sender_idx").on(table.sender),
    receiverIdx: index("router_swap_yt_receiver_idx").on(table.receiver),
    marketIdx: index("router_swap_yt_market_idx").on(table.market),
    ytIdx: index("router_swap_yt_yt_idx").on(table.yt),
  })
);
```

---

## Indexer Architecture

### File Structure

```
packages/indexer/
├── src/
│   ├── schema/
│   │   └── index.ts              # All table definitions (shared)
│   ├── indexers/
│   │   ├── factory.indexer.ts    # Factory events (2 event types)
│   │   ├── market-factory.indexer.ts
│   │   ├── sy.indexer.ts         # SY events (3 types) - factory pattern
│   │   ├── yt.indexer.ts         # YT events (5 types) - factory pattern
│   │   ├── market.indexer.ts     # Market AMM events (5 types) - factory pattern
│   │   └── router.indexer.ts     # Router events (6 types)
│   ├── lib/
│   │   ├── abi/                  # Contract ABIs (JSON)
│   │   │   ├── factory.json
│   │   │   ├── market_factory.json
│   │   │   ├── sy.json
│   │   │   ├── yt.json
│   │   │   ├── market.json
│   │   │   └── router.json
│   │   ├── constants.ts          # Contract addresses per network
│   │   └── utils.ts              # Shared utilities
│   └── config/
│       └── addresses.ts          # Network-specific addresses
├── drizzle/                      # Generated migrations
├── apibara.config.ts             # Apibara configuration
├── drizzle.config.ts             # Drizzle migration config
├── docker-compose.yml            # Local development
├── package.json
├── tsconfig.json
├── bun.lockb                     # Bun lockfile (generated)
└── .env.example
```

### Indexer Patterns

#### 1. Static Contract Indexer (Router, Factory, MarketFactory)

For contracts with fixed addresses known at startup:

```typescript
// indexers/router.indexer.ts
import { StarknetStream } from "@apibara/starknet";
import { defineIndexer } from "apibara/indexer";
import { drizzleStorage, useDrizzleStorage, drizzle } from "@apibara/plugin-drizzle";
import { decodeEvent } from "@apibara/starknet";
import { hash } from "starknet";
import * as schema from "../schema";
import routerAbi from "../lib/abi/router.json";
import { ROUTER_ADDRESS, STARTING_BLOCK } from "../lib/constants";

const MINT_PY = hash.getSelectorFromName("MintPY") as `0x${string}`;
const REDEEM_PY = hash.getSelectorFromName("RedeemPY") as `0x${string}`;
// ... other event selectors

export default function routerIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  const database = drizzle({
    schema: {
      routerMintPY: schema.routerMintPY,
      routerRedeemPY: schema.routerRedeemPY,
      routerAddLiquidity: schema.routerAddLiquidity,
      routerRemoveLiquidity: schema.routerRemoveLiquidity,
      routerSwap: schema.routerSwap,
      routerSwapYT: schema.routerSwapYT,
    },
  });

  return defineIndexer(StarknetStream)({
    streamUrl: runtimeConfig.starknet.streamUrl,
    finality: "accepted",
    startingBlock: BigInt(runtimeConfig.starknet.startingBlock),
    plugins: [
      drizzleStorage({
        db: database,
        idColumn: { "*": "_id" },
        persistState: true,
        indexerName: "router",
        migrate: { migrationsFolder: "./drizzle" },
      }),
    ],
    filter: {
      events: [
        { address: ROUTER_ADDRESS, keys: [MINT_PY] },
        { address: ROUTER_ADDRESS, keys: [REDEEM_PY] },
        // ... other events
      ],
    },
    async transform({ block, endCursor }) {
      const { db } = useDrizzleStorage();
      const { events, header } = block;

      for (const event of events) {
        const blockNumber = Number(header.blockNumber);
        const blockTimestamp = new Date(Number(header.timestamp) * 1000);
        const transactionHash = event.transactionHash;

        // Decode based on first key (event selector)
        const eventKey = event.keys?.[0];

        if (eventKey === MINT_PY) {
          const decoded = decodeEvent({
            abi: routerAbi,
            eventName: "MintPY",
            event,
            strict: false,
          });
          if (decoded) {
            await db.insert(schema.routerMintPY).values({
              block_number: blockNumber,
              block_timestamp: blockTimestamp,
              transaction_hash: transactionHash,
              sender: decoded.args.sender,
              receiver: decoded.args.receiver,
              yt: decoded.args.yt,
              sy_in: decoded.args.sy_in.toString(),
              pt_out: decoded.args.pt_out.toString(),
              yt_out: decoded.args.yt_out.toString(),
            });
          }
        }
        // ... handle other events
      }
    },
  });
}
```

#### 2. Factory Pattern Indexer (SY, YT, Market)

For contracts deployed dynamically, we use the factory pattern to discover new contracts:

```typescript
// indexers/market.indexer.ts
import { StarknetStream } from "@apibara/starknet";
import { defineIndexer } from "apibara/indexer";
import { hash } from "starknet";
import { MARKET_FACTORY_ADDRESS } from "../lib/constants";

const MARKET_CREATED = hash.getSelectorFromName("MarketCreated") as `0x${string}`;
const MINT = hash.getSelectorFromName("Mint") as `0x${string}`;
const BURN = hash.getSelectorFromName("Burn") as `0x${string}`;
const SWAP = hash.getSelectorFromName("Swap") as `0x${string}`;
// ... other selectors

export default function marketIndexer(runtimeConfig: ApibaraRuntimeConfig) {
  // ... database setup

  return defineIndexer(StarknetStream)({
    streamUrl: runtimeConfig.starknet.streamUrl,
    finality: "accepted",
    startingBlock: BigInt(runtimeConfig.starknet.startingBlock),
    plugins: [/* drizzle plugin */],

    // Initial filter: listen to MarketFactory for new markets
    filter: {
      events: [
        { address: MARKET_FACTORY_ADDRESS, keys: [MARKET_CREATED] },
      ],
    },

    // Factory hook: dynamically add filters for new markets
    async factory({ block: { events } }) {
      const newMarketFilters = events
        .filter((e) => e.keys?.[0] === MARKET_CREATED)
        .map((event) => {
          const marketAddress = event.data?.[0]; // market address from event
          return [
            { address: marketAddress, keys: [MINT] },
            { address: marketAddress, keys: [BURN] },
            { address: marketAddress, keys: [SWAP] },
            // ... other market events
          ];
        })
        .flat();

      if (newMarketFilters.length === 0) return {};

      return {
        filter: {
          events: newMarketFilters,
        },
      };
    },

    async transform({ block, endCursor }) {
      // Handle both MarketCreated and Market events
      // The filter will include events from all discovered markets
    },
  });
}
```

---

## Infrastructure Architecture

### What is `streamUrl`?

The `streamUrl` points to an **Apibara DNA server** - a gRPC endpoint that streams blockchain data to your indexer.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Starknet RPC   │────▶│   DNA Server    │────▶│    Indexer      │
│ (pathfinder/    │     │  (gRPC stream)  │     │  (TypeScript)   │
│  juno/etc)      │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ▲                       │                       │
        │                       │                       ▼
   Your node or              Port 7171           ┌─────────────────┐
   3rd party RPC             (default)           │   PostgreSQL    │
                                                 └─────────────────┘
```

The DNA server provides:
- **Efficient streaming** - Cursor-based pagination instead of polling
- **Automatic reorg handling** - Detects and notifies of chain reorganizations
- **Filter-based selection** - Only sends events matching your filters
- **Backfilling** - Efficiently syncs historical data

### Self-Hosted Production Setup

For production, you need:
1. **Starknet Full Node** - pathfinder, juno, or third-party RPC
2. **DNA Starknet Server** - Built from `/Users/ametel/source/dna`
3. **PostgreSQL** - For indexer storage
4. **Optional**: etcd (coordination), minio (object storage), prometheus/grafana (metrics)

---

## Docker Compose Configuration

### Development (Local)

```yaml
# packages/indexer/docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: horizon
      POSTGRES_PASSWORD: horizon
      POSTGRES_DB: horizon_indexer
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U horizon -d horizon_indexer"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Optional: pgAdmin for database inspection
  pgadmin:
    image: dpage/pgadmin4:latest
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@horizon.io
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

### Production (Self-Hosted DNA)

```yaml
# packages/indexer/docker-compose.prod.yml
services:
  # DNA Starknet Server
  # Build from: https://github.com/apibara/dna (starknet crate)
  dna-starknet:
    image: ghcr.io/apibara/starknet:latest
    # Or build locally:
    # build:
    #   context: /path/to/dna
    #   dockerfile: Dockerfile.starknet
    restart: unless-stopped
    ports:
      - "7171:7171"
    environment:
      # Your Starknet RPC node
      STARKNET_RPC_URL: "${STARKNET_RPC_URL:-http://pathfinder:9545}"
      STARKNET_RPC_TIMEOUT_SEC: "30"
      # Optional: API key header for RPC
      # STARKNET_RPC_HEADERS: "x-api-key:your-api-key"
      # Ingest pending blocks (optional)
      STARKNET_NO_INGEST_PENDING: "false"
      # Ingest transaction traces (optional, increases load)
      STARKNET_INGEST_TRACES: "false"
    command: ["start", "--server.address", "0.0.0.0:7171"]
    depends_on:
      - minio
    volumes:
      - dna_data:/data

  # Object storage for DNA
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    environment:
      MINIO_ROOT_USER: "minioadmin"
      MINIO_ROOT_PASSWORD: "minioadmin"
    command: ["server", "/data", "--console-address", ":9001"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: horizon
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:-horizon}"
      POSTGRES_DB: horizon_indexer
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U horizon -d horizon_indexer"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Optional: Metrics
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus:/etc/prometheus:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin

volumes:
  dna_data:
  minio_data:
  postgres_data:
  prometheus_data:
  grafana_data:
```

### Building DNA Server

```bash
# Clone DNA repository (already at /Users/ametel/source/dna)
cd /Users/ametel/source/dna

# Build with Nix (recommended)
nix develop
cargo build --release -p apibara-dna-starknet

# Binary at: target/release/apibara-dna-starknet

# Or build Docker image
docker build -t horizon-dna-starknet -f Dockerfile.starknet .
```

### DNA Server CLI

```bash
# Start DNA server pointing to your RPC
./apibara-dna-starknet start \
  --rpc.url "https://your-starknet-rpc.com" \
  --server.address "0.0.0.0:7171"

# With API key for RPC
./apibara-dna-starknet start \
  --rpc.url "https://your-starknet-rpc.com" \
  --rpc.headers "x-api-key:your-key" \
  --server.address "0.0.0.0:7171"
```

---

## Implementation Steps

### Phase 1: Project Setup

1. **Initialize the indexer package**
   ```bash
   cd packages/indexer
   bun init
   ```

2. **Install dependencies**
   ```bash
   bun add @apibara/indexer @apibara/starknet @apibara/plugin-drizzle \
           @apibara/protocol apibara drizzle-orm pg starknet
   bun add -d @types/pg bun-types drizzle-kit typescript
   ```

3. **Create `tsconfig.json`**
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ESNext",
       "moduleResolution": "bundler",
       "esModuleInterop": true,
       "strict": true,
       "skipLibCheck": true,
       "outDir": "dist",
       "rootDir": "src",
       "types": ["bun-types"],
       "paths": {
         "@/*": ["./src/*"]
       }
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules"]
   }
   ```

4. **Create `apibara.config.ts`**
   ```typescript
   import { defineConfig } from "apibara/config";

   export default defineConfig({
     runtimeConfig: {
       starknet: {
         startingBlock: 0,
         // DNA stream server URL (gRPC endpoint)
         // Self-hosted: point to your DNA server
         streamUrl: process.env.DNA_STREAM_URL ?? "http://localhost:7171",
       },
     },
     presets: {
       mainnet: {
         runtimeConfig: {
           starknet: {
             startingBlock: 800_000, // Horizon mainnet deployment block
             streamUrl: process.env.DNA_STREAM_URL ?? "http://dna-starknet:7171",
           },
         },
       },
       sepolia: {
         runtimeConfig: {
           starknet: {
             startingBlock: 100_000,
             streamUrl: process.env.DNA_STREAM_URL ?? "http://dna-starknet:7171",
           },
         },
       },
       devnet: {
         runtimeConfig: {
           starknet: {
             startingBlock: 0,
             streamUrl: "http://localhost:7171",
           },
         },
       },
     },
   });
   ```

5. **Create `drizzle.config.ts`**
   ```typescript
   import type { Config } from "drizzle-kit";

   export default {
     schema: "./src/schema/index.ts",
     out: "./drizzle",
     dialect: "postgresql",
     dbCredentials: {
       url: process.env.POSTGRES_CONNECTION_STRING ??
            "postgres://horizon:horizon@localhost:5432/horizon_indexer",
     },
   } satisfies Config;
   ```

6. **Create `.env.example`**
   ```bash
   # PostgreSQL connection
   POSTGRES_CONNECTION_STRING="postgres://horizon:horizon@localhost:5432/horizon_indexer"

   # DNA Server URL (your self-hosted DNA server)
   DNA_STREAM_URL="http://localhost:7171"

   # Starknet RPC (for DNA server)
   STARKNET_RPC_URL="https://your-starknet-rpc.com"

   # Optional: Runtime config override
   # APIBARA_RUNTIME_CONFIG='{"starknet": {"startingBlock": 800000}}'
   ```

### Phase 2: Extract ABIs

1. **Build contracts and extract ABIs**
   ```bash
   cd contracts
   scarb build
   ```

2. **Copy ABIs to indexer**
   ```bash
   mkdir -p packages/indexer/src/lib/abi
   cp contracts/target/dev/horizon_Router.contract_class.json \
      packages/indexer/src/lib/abi/router.json
   # Repeat for other contracts
   ```

3. **Create constants file**
   ```typescript
   // src/lib/constants.ts
   export const MAINNET = {
     FACTORY: "0x...",
     MARKET_FACTORY: "0x...",
     ROUTER: "0x...",
     STARTING_BLOCK: 800_000,
   };

   export const SEPOLIA = {
     FACTORY: "0x...",
     MARKET_FACTORY: "0x...",
     ROUTER: "0x...",
     STARTING_BLOCK: 100_000,
   };
   ```

### Phase 3: Implement Schema

1. Create the full schema as defined above in `src/schema/index.ts`

2. Generate initial migration:
   ```bash
   bunx drizzle-kit generate
   ```

### Phase 4: Implement Indexers

Implement each indexer file following the patterns above:

1. `factory.indexer.ts` - Static, 2 event types
2. `market-factory.indexer.ts` - Static, 2 event types
3. `router.indexer.ts` - Static, 6 event types
4. `sy.indexer.ts` - Factory pattern (discovers SY contracts from Factory events)
5. `yt.indexer.ts` - Factory pattern (discovers YT contracts from Factory events)
6. `market.indexer.ts` - Factory pattern (discovers Markets from MarketFactory events)

### Phase 5: Local Testing

1. **Start Docker services**
   ```bash
   docker compose up -d
   ```

2. **Run migrations**
   ```bash
   bun run db:migrate
   ```

3. **Start indexers in dev mode**
   ```bash
   bun run dev:devnet
   ```

4. **Verify data in pgAdmin** at http://localhost:5050

### Phase 6: Add Aggregate Views (Optional)

Create PostgreSQL materialized views for common aggregate queries:

```sql
-- Example: Total volume per market per day
CREATE MATERIALIZED VIEW market_daily_volume AS
SELECT
  market,
  DATE_TRUNC('day', block_timestamp) as day,
  SUM(CAST(sy_in AS NUMERIC) + CAST(pt_in AS NUMERIC)) as total_volume,
  COUNT(*) as trade_count
FROM market_swap
GROUP BY market, DATE_TRUNC('day', block_timestamp);

-- Refresh periodically or on new data
CREATE INDEX idx_mdv_market_day ON market_daily_volume(market, day);
```

---

## Package.json

```json
{
  "name": "@horizon/indexer",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bunx apibara dev",
    "dev:mainnet": "bunx apibara dev --preset mainnet",
    "dev:sepolia": "bunx apibara dev --preset sepolia",
    "dev:devnet": "bunx apibara dev --preset devnet",
    "build": "bun build ./src/indexers/*.ts --outdir ./dist",
    "typecheck": "tsc --noEmit",
    "db:generate": "bunx drizzle-kit generate",
    "db:migrate": "bunx drizzle-kit migrate",
    "db:push": "bunx drizzle-kit push",
    "db:studio": "bunx drizzle-kit studio",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "docker:logs": "docker compose logs -f"
  },
  "dependencies": {
    "@apibara/indexer": "latest",
    "@apibara/plugin-drizzle": "latest",
    "@apibara/protocol": "latest",
    "@apibara/starknet": "latest",
    "apibara": "latest",
    "drizzle-orm": "latest",
    "pg": "latest",
    "starknet": "latest"
  },
  "devDependencies": {
    "@types/pg": "latest",
    "bun-types": "latest",
    "drizzle-kit": "latest",
    "typescript": "latest"
  }
}
```

> **Note:** After initial setup, run `bun update` to lock specific versions in `bun.lockb`.

---

## Event to Table Mapping

| Contract | Event | Table Name | Indexer |
|----------|-------|------------|---------|
| Factory | YieldContractsCreated | factory_yield_contracts_created | factory.indexer.ts |
| Factory | ClassHashesUpdated | factory_class_hashes_updated | factory.indexer.ts |
| MarketFactory | MarketCreated | market_factory_market_created | market-factory.indexer.ts |
| MarketFactory | MarketClassHashUpdated | market_factory_class_hash_updated | market-factory.indexer.ts |
| SY | Deposit | sy_deposit | sy.indexer.ts |
| SY | Redeem | sy_redeem | sy.indexer.ts |
| SY | OracleRateUpdated | sy_oracle_rate_updated | sy.indexer.ts |
| YT | MintPY | yt_mint_py | yt.indexer.ts |
| YT | RedeemPY | yt_redeem_py | yt.indexer.ts |
| YT | RedeemPYPostExpiry | yt_redeem_py_post_expiry | yt.indexer.ts |
| YT | InterestClaimed | yt_interest_claimed | yt.indexer.ts |
| YT | ExpiryReached | yt_expiry_reached | yt.indexer.ts |
| Market | Mint | market_mint | market.indexer.ts |
| Market | Burn | market_burn | market.indexer.ts |
| Market | Swap | market_swap | market.indexer.ts |
| Market | ImpliedRateUpdated | market_implied_rate_updated | market.indexer.ts |
| Market | FeesCollected | market_fees_collected | market.indexer.ts |
| Router | MintPY | router_mint_py | router.indexer.ts |
| Router | RedeemPY | router_redeem_py | router.indexer.ts |
| Router | AddLiquidity | router_add_liquidity | router.indexer.ts |
| Router | RemoveLiquidity | router_remove_liquidity | router.indexer.ts |
| Router | Swap | router_swap | router.indexer.ts |
| Router | SwapYT | router_swap_yt | router.indexer.ts |

**Total: 23 events -> 23 tables -> 6 indexer files**

---

## Frontend Features Enabled

With this indexer, the frontend can:

1. **Market Discovery** - Query `market_factory_market_created` for all markets
2. **Portfolio Tracking** - Query by user address across all event tables
3. **TVL Charts** - Aggregate from `market_mint`, `market_burn` events
4. **Volume Analytics** - Sum from `market_swap` with time-series grouping
5. **Yield Tracking** - Calculate from `yt_interest_claimed` events
6. **Rate History** - Time-series from `market_implied_rate_updated`
7. **Expiry Calendar** - Filter `market_factory_market_created` by expiry

---

## References

- [Bun Documentation](https://bun.sh/docs)
- [Apibara TypeScript SDK](https://github.com/apibara/typescript-sdk)
- [Apibara DNA Protocol](https://github.com/apibara/dna)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Horizon Protocol Events](../docs/EVENTS.md)
- [Event Enrichment Spec](../docs/EVENTS_ENRICHMENT_SPEC.md)
