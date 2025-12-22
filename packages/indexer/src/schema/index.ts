/**
 * Drizzle ORM schema for Horizon Protocol indexer
 *
 * Architecture: One table per event type
 * - Prevents race conditions (each indexer writes to its own table)
 * - Enables independent scaling and reorg handling
 * - Optimized indexes per event's query patterns
 *
 * Total: 23 event tables across 6 contracts
 */

import {
  bigint,
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  pgView,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ============================================================
// FACTORY EVENTS (2 tables)
// ============================================================

export const factoryYieldContractsCreated = pgTable(
  "factory_yield_contracts_created",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    // Block context
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    sy: text("sy").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data
    pt: text("pt").notNull(),
    yt: text("yt").notNull(),
    creator: text("creator").notNull(),
    // Enrichment fields
    underlying: text("underlying").notNull(),
    underlying_symbol: text("underlying_symbol").notNull(),
    initial_exchange_rate: numeric("initial_exchange_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    market_index: integer("market_index").notNull(),
  },
  (table) => [
    index("factory_ycc_sy_idx").on(table.sy),
    index("factory_ycc_expiry_idx").on(table.expiry),
    index("factory_ycc_creator_idx").on(table.creator),
    index("factory_ycc_underlying_idx").on(table.underlying),
  ],
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
  },
);

// ============================================================
// MARKET FACTORY EVENTS (2 tables)
// ============================================================

export const marketFactoryMarketCreated = pgTable(
  "market_factory_market_created",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    pt: text("pt").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data
    market: text("market").notNull(),
    creator: text("creator").notNull(),
    scalar_root: numeric("scalar_root", { precision: 78, scale: 0 }).notNull(),
    initial_anchor: numeric("initial_anchor", {
      precision: 78,
      scale: 0,
    }).notNull(),
    fee_rate: numeric("fee_rate", { precision: 78, scale: 0 }).notNull(),
    sy: text("sy").notNull(),
    yt: text("yt").notNull(),
    underlying: text("underlying").notNull(),
    underlying_symbol: text("underlying_symbol").notNull(),
    initial_exchange_rate: numeric("initial_exchange_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    market_index: integer("market_index").notNull(),
  },
  (table) => [
    index("mf_mc_pt_idx").on(table.pt),
    index("mf_mc_expiry_idx").on(table.expiry),
    index("mf_mc_market_idx").on(table.market),
    index("mf_mc_underlying_idx").on(table.underlying),
  ],
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
  },
);

// ============================================================
// SY (STANDARDIZED YIELD) EVENTS (3 tables)
// ============================================================

export const syDeposit = pgTable(
  "sy_deposit",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    caller: text("caller").notNull(),
    receiver: text("receiver").notNull(),
    underlying: text("underlying").notNull(),
    // Event data (SY contract address from event source)
    sy: text("sy").notNull(),
    amount_deposited: numeric("amount_deposited", {
      precision: 78,
      scale: 0,
    }).notNull(),
    amount_sy_minted: numeric("amount_sy_minted", {
      precision: 78,
      scale: 0,
    }).notNull(),
    exchange_rate: numeric("exchange_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    total_supply_after: numeric("total_supply_after", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("sy_deposit_caller_idx").on(table.caller),
    index("sy_deposit_receiver_idx").on(table.receiver),
    index("sy_deposit_sy_idx").on(table.sy),
    index("sy_deposit_underlying_idx").on(table.underlying),
  ],
);

export const syRedeem = pgTable(
  "sy_redeem",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    caller: text("caller").notNull(),
    receiver: text("receiver").notNull(),
    underlying: text("underlying").notNull(),
    // Event data
    sy: text("sy").notNull(),
    amount_sy_burned: numeric("amount_sy_burned", {
      precision: 78,
      scale: 0,
    }).notNull(),
    amount_redeemed: numeric("amount_redeemed", {
      precision: 78,
      scale: 0,
    }).notNull(),
    exchange_rate: numeric("exchange_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    total_supply_after: numeric("total_supply_after", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("sy_redeem_caller_idx").on(table.caller),
    index("sy_redeem_receiver_idx").on(table.receiver),
    index("sy_redeem_sy_idx").on(table.sy),
  ],
);

export const syOracleRateUpdated = pgTable(
  "sy_oracle_rate_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    sy: text("sy").notNull(),
    underlying: text("underlying").notNull(),
    // Event data
    old_rate: numeric("old_rate", { precision: 78, scale: 0 }).notNull(),
    new_rate: numeric("new_rate", { precision: 78, scale: 0 }).notNull(),
    rate_change_bps: numeric("rate_change_bps", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("sy_oru_sy_idx").on(table.sy),
    index("sy_oru_underlying_idx").on(table.underlying),
  ],
);

// ============================================================
// YT (YIELD TOKEN) EVENTS (5 tables)
// ============================================================

export const ytMintPY = pgTable(
  "yt_mint_py",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    caller: text("caller").notNull(),
    receiver: text("receiver").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data (YT contract from event source)
    yt: text("yt").notNull(),
    sy: text("sy").notNull(),
    pt: text("pt").notNull(),
    amount_sy_deposited: numeric("amount_sy_deposited", {
      precision: 78,
      scale: 0,
    }).notNull(),
    amount_py_minted: numeric("amount_py_minted", {
      precision: 78,
      scale: 0,
    }).notNull(),
    py_index: numeric("py_index", { precision: 78, scale: 0 }).notNull(),
    exchange_rate: numeric("exchange_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    total_pt_supply_after: numeric("total_pt_supply_after", {
      precision: 78,
      scale: 0,
    }).notNull(),
    total_yt_supply_after: numeric("total_yt_supply_after", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("yt_mint_caller_idx").on(table.caller),
    index("yt_mint_receiver_idx").on(table.receiver),
    index("yt_mint_expiry_idx").on(table.expiry),
    index("yt_mint_yt_idx").on(table.yt),
  ],
);

export const ytRedeemPY = pgTable(
  "yt_redeem_py",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    caller: text("caller").notNull(),
    receiver: text("receiver").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data
    yt: text("yt").notNull(),
    sy: text("sy").notNull(),
    pt: text("pt").notNull(),
    amount_py_redeemed: numeric("amount_py_redeemed", {
      precision: 78,
      scale: 0,
    }).notNull(),
    amount_sy_returned: numeric("amount_sy_returned", {
      precision: 78,
      scale: 0,
    }).notNull(),
    py_index: numeric("py_index", { precision: 78, scale: 0 }).notNull(),
    exchange_rate: numeric("exchange_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("yt_redeem_caller_idx").on(table.caller),
    index("yt_redeem_receiver_idx").on(table.receiver),
    index("yt_redeem_expiry_idx").on(table.expiry),
  ],
);

export const ytRedeemPYPostExpiry = pgTable(
  "yt_redeem_py_post_expiry",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    caller: text("caller").notNull(),
    receiver: text("receiver").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data
    yt: text("yt").notNull(),
    sy: text("sy").notNull(),
    pt: text("pt").notNull(),
    amount_pt_redeemed: numeric("amount_pt_redeemed", {
      precision: 78,
      scale: 0,
    }).notNull(),
    amount_sy_returned: numeric("amount_sy_returned", {
      precision: 78,
      scale: 0,
    }).notNull(),
    final_py_index: numeric("final_py_index", {
      precision: 78,
      scale: 0,
    }).notNull(),
    final_exchange_rate: numeric("final_exchange_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("yt_redeem_pe_caller_idx").on(table.caller),
    index("yt_redeem_pe_receiver_idx").on(table.receiver),
    index("yt_redeem_pe_expiry_idx").on(table.expiry),
  ],
);

export const ytInterestClaimed = pgTable(
  "yt_interest_claimed",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    user: text("user").notNull(),
    yt: text("yt").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data
    sy: text("sy").notNull(),
    amount_sy: numeric("amount_sy", { precision: 78, scale: 0 }).notNull(),
    yt_balance: numeric("yt_balance", { precision: 78, scale: 0 }).notNull(),
    py_index_at_claim: numeric("py_index_at_claim", {
      precision: 78,
      scale: 0,
    }).notNull(),
    exchange_rate: numeric("exchange_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("yt_ic_user_idx").on(table.user),
    index("yt_ic_yt_idx").on(table.yt),
    index("yt_ic_expiry_idx").on(table.expiry),
  ],
);

export const ytExpiryReached = pgTable(
  "yt_expiry_reached",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    market: text("market").notNull(),
    yt: text("yt").notNull(),
    pt: text("pt").notNull(),
    // Event data
    sy: text("sy").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    final_exchange_rate: numeric("final_exchange_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    final_py_index: numeric("final_py_index", {
      precision: 78,
      scale: 0,
    }).notNull(),
    total_pt_supply: numeric("total_pt_supply", {
      precision: 78,
      scale: 0,
    }).notNull(),
    total_yt_supply: numeric("total_yt_supply", {
      precision: 78,
      scale: 0,
    }).notNull(),
    sy_reserve: numeric("sy_reserve", { precision: 78, scale: 0 }).notNull(),
    pt_reserve: numeric("pt_reserve", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    index("yt_er_yt_idx").on(table.yt),
    index("yt_er_pt_idx").on(table.pt),
    index("yt_er_expiry_idx").on(table.expiry),
  ],
);

// ============================================================
// MARKET (AMM) EVENTS (5 tables)
// ============================================================

export const marketMint = pgTable(
  "market_mint",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
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
    exchange_rate: numeric("exchange_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    implied_rate: numeric("implied_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    sy_reserve_after: numeric("sy_reserve_after", {
      precision: 78,
      scale: 0,
    }).notNull(),
    pt_reserve_after: numeric("pt_reserve_after", {
      precision: 78,
      scale: 0,
    }).notNull(),
    total_lp_after: numeric("total_lp_after", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("market_mint_sender_idx").on(table.sender),
    index("market_mint_receiver_idx").on(table.receiver),
    index("market_mint_expiry_idx").on(table.expiry),
    index("market_mint_market_idx").on(table.market),
  ],
);

export const marketBurn = pgTable(
  "market_burn",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
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
    exchange_rate: numeric("exchange_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    implied_rate: numeric("implied_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    sy_reserve_after: numeric("sy_reserve_after", {
      precision: 78,
      scale: 0,
    }).notNull(),
    pt_reserve_after: numeric("pt_reserve_after", {
      precision: 78,
      scale: 0,
    }).notNull(),
    total_lp_after: numeric("total_lp_after", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("market_burn_sender_idx").on(table.sender),
    index("market_burn_receiver_idx").on(table.receiver),
    index("market_burn_expiry_idx").on(table.expiry),
    index("market_burn_market_idx").on(table.market),
  ],
);

export const marketSwap = pgTable(
  "market_swap",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
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
    implied_rate_before: numeric("implied_rate_before", {
      precision: 78,
      scale: 0,
    }).notNull(),
    implied_rate_after: numeric("implied_rate_after", {
      precision: 78,
      scale: 0,
    }).notNull(),
    exchange_rate: numeric("exchange_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    sy_reserve_after: numeric("sy_reserve_after", {
      precision: 78,
      scale: 0,
    }).notNull(),
    pt_reserve_after: numeric("pt_reserve_after", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("market_swap_sender_idx").on(table.sender),
    index("market_swap_receiver_idx").on(table.receiver),
    index("market_swap_expiry_idx").on(table.expiry),
    index("market_swap_market_idx").on(table.market),
    index("market_swap_timestamp_idx").on(table.block_timestamp),
  ],
);

export const marketImpliedRateUpdated = pgTable(
  "market_implied_rate_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    market: text("market").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Event data
    old_rate: numeric("old_rate", { precision: 78, scale: 0 }).notNull(),
    new_rate: numeric("new_rate", { precision: 78, scale: 0 }).notNull(),
    time_to_expiry: bigint("time_to_expiry", { mode: "number" }).notNull(),
    exchange_rate: numeric("exchange_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    sy_reserve: numeric("sy_reserve", { precision: 78, scale: 0 }).notNull(),
    pt_reserve: numeric("pt_reserve", { precision: 78, scale: 0 }).notNull(),
    total_lp: numeric("total_lp", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    index("market_iru_market_idx").on(table.market),
    index("market_iru_expiry_idx").on(table.expiry),
    index("market_iru_timestamp_idx").on(table.block_timestamp),
  ],
);

export const marketFeesCollected = pgTable(
  "market_fees_collected",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    collector: text("collector").notNull(),
    receiver: text("receiver").notNull(),
    market: text("market").notNull(),
    // Event data
    amount: numeric("amount", { precision: 78, scale: 0 }).notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    fee_rate: numeric("fee_rate", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    index("market_fc_collector_idx").on(table.collector),
    index("market_fc_receiver_idx").on(table.receiver),
    index("market_fc_market_idx").on(table.market),
  ],
);

// ============================================================
// ROUTER EVENTS (6 tables)
// ============================================================

export const routerMintPY = pgTable(
  "router_mint_py",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    sender: text("sender").notNull(),
    receiver: text("receiver").notNull(),
    // Event data
    yt: text("yt").notNull(),
    sy_in: numeric("sy_in", { precision: 78, scale: 0 }).notNull(),
    pt_out: numeric("pt_out", { precision: 78, scale: 0 }).notNull(),
    yt_out: numeric("yt_out", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    index("router_mint_sender_idx").on(table.sender),
    index("router_mint_receiver_idx").on(table.receiver),
    index("router_mint_yt_idx").on(table.yt),
  ],
);

export const routerRedeemPY = pgTable(
  "router_redeem_py",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    sender: text("sender").notNull(),
    receiver: text("receiver").notNull(),
    // Event data
    yt: text("yt").notNull(),
    py_in: numeric("py_in", { precision: 78, scale: 0 }).notNull(),
    sy_out: numeric("sy_out", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    index("router_redeem_sender_idx").on(table.sender),
    index("router_redeem_receiver_idx").on(table.receiver),
  ],
);

export const routerAddLiquidity = pgTable(
  "router_add_liquidity",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    sender: text("sender").notNull(),
    receiver: text("receiver").notNull(),
    // Event data
    market: text("market").notNull(),
    sy_used: numeric("sy_used", { precision: 78, scale: 0 }).notNull(),
    pt_used: numeric("pt_used", { precision: 78, scale: 0 }).notNull(),
    lp_out: numeric("lp_out", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    index("router_al_sender_idx").on(table.sender),
    index("router_al_receiver_idx").on(table.receiver),
    index("router_al_market_idx").on(table.market),
  ],
);

export const routerRemoveLiquidity = pgTable(
  "router_remove_liquidity",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    sender: text("sender").notNull(),
    receiver: text("receiver").notNull(),
    // Event data
    market: text("market").notNull(),
    lp_in: numeric("lp_in", { precision: 78, scale: 0 }).notNull(),
    sy_out: numeric("sy_out", { precision: 78, scale: 0 }).notNull(),
    pt_out: numeric("pt_out", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    index("router_rl_sender_idx").on(table.sender),
    index("router_rl_receiver_idx").on(table.receiver),
    index("router_rl_market_idx").on(table.market),
  ],
);

export const routerSwap = pgTable(
  "router_swap",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
    sender: text("sender").notNull(),
    receiver: text("receiver").notNull(),
    // Event data
    market: text("market").notNull(),
    sy_in: numeric("sy_in", { precision: 78, scale: 0 }).notNull(),
    pt_in: numeric("pt_in", { precision: 78, scale: 0 }).notNull(),
    sy_out: numeric("sy_out", { precision: 78, scale: 0 }).notNull(),
    pt_out: numeric("pt_out", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    index("router_swap_sender_idx").on(table.sender),
    index("router_swap_receiver_idx").on(table.receiver),
    index("router_swap_market_idx").on(table.market),
  ],
);

export const routerSwapYT = pgTable(
  "router_swap_yt",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    // Indexed fields (keys)
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
  (table) => [
    index("router_swap_yt_sender_idx").on(table.sender),
    index("router_swap_yt_receiver_idx").on(table.receiver),
    index("router_swap_yt_market_idx").on(table.market),
    index("router_swap_yt_yt_idx").on(table.yt),
  ],
);

// ============================================================
// ENRICHED ROUTER VIEWS (6 views)
// These views join router events with underlying contract events
// to provide full context for frontend analytics.
// ============================================================

/**
 * Enriched router swap view
 * Joins router_swap with market_swap and market_factory_market_created
 */
export const enrichedRouterSwap = pgView("enriched_router_swap", {
  _id: uuid("_id"),
  block_number: bigint("block_number", { mode: "number" }),
  block_timestamp: timestamp("block_timestamp"),
  transaction_hash: text("transaction_hash"),
  sender: text("sender"),
  receiver: text("receiver"),
  market: text("market"),
  sy_in: numeric("sy_in", { precision: 78, scale: 0 }),
  pt_in: numeric("pt_in", { precision: 78, scale: 0 }),
  sy_out: numeric("sy_out", { precision: 78, scale: 0 }),
  pt_out: numeric("pt_out", { precision: 78, scale: 0 }),
  // Enrichment fields
  expiry: bigint("expiry", { mode: "number" }),
  sy: text("sy"),
  pt: text("pt"),
  yt: text("yt"),
  underlying: text("underlying"),
  underlying_symbol: text("underlying_symbol"),
  exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }),
  implied_rate_before: numeric("implied_rate_before", {
    precision: 78,
    scale: 0,
  }),
  implied_rate_after: numeric("implied_rate_after", {
    precision: 78,
    scale: 0,
  }),
  fee: numeric("fee", { precision: 78, scale: 0 }),
  sy_reserve_after: numeric("sy_reserve_after", { precision: 78, scale: 0 }),
  pt_reserve_after: numeric("pt_reserve_after", { precision: 78, scale: 0 }),
}).existing();

/**
 * Enriched router swap YT view
 * Joins router_swap_yt with market data
 */
export const enrichedRouterSwapYT = pgView("enriched_router_swap_yt", {
  _id: uuid("_id"),
  block_number: bigint("block_number", { mode: "number" }),
  block_timestamp: timestamp("block_timestamp"),
  transaction_hash: text("transaction_hash"),
  sender: text("sender"),
  receiver: text("receiver"),
  yt: text("yt"),
  market: text("market"),
  sy_in: numeric("sy_in", { precision: 78, scale: 0 }),
  yt_in: numeric("yt_in", { precision: 78, scale: 0 }),
  sy_out: numeric("sy_out", { precision: 78, scale: 0 }),
  yt_out: numeric("yt_out", { precision: 78, scale: 0 }),
  // Enrichment fields
  expiry: bigint("expiry", { mode: "number" }),
  sy: text("sy"),
  pt: text("pt"),
  underlying: text("underlying"),
  underlying_symbol: text("underlying_symbol"),
  exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }),
  implied_rate_before: numeric("implied_rate_before", {
    precision: 78,
    scale: 0,
  }),
  implied_rate_after: numeric("implied_rate_after", {
    precision: 78,
    scale: 0,
  }),
  fee: numeric("fee", { precision: 78, scale: 0 }),
}).existing();

/**
 * Enriched router add liquidity view
 * Joins router_add_liquidity with market_mint and market creation data
 */
export const enrichedRouterAddLiquidity = pgView(
  "enriched_router_add_liquidity",
  {
    _id: uuid("_id"),
    block_number: bigint("block_number", { mode: "number" }),
    block_timestamp: timestamp("block_timestamp"),
    transaction_hash: text("transaction_hash"),
    sender: text("sender"),
    receiver: text("receiver"),
    market: text("market"),
    sy_used: numeric("sy_used", { precision: 78, scale: 0 }),
    pt_used: numeric("pt_used", { precision: 78, scale: 0 }),
    lp_out: numeric("lp_out", { precision: 78, scale: 0 }),
    // Enrichment fields
    expiry: bigint("expiry", { mode: "number" }),
    sy: text("sy"),
    pt: text("pt"),
    yt: text("yt"),
    underlying: text("underlying"),
    underlying_symbol: text("underlying_symbol"),
    exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }),
    implied_rate: numeric("implied_rate", { precision: 78, scale: 0 }),
    sy_reserve_after: numeric("sy_reserve_after", { precision: 78, scale: 0 }),
    pt_reserve_after: numeric("pt_reserve_after", { precision: 78, scale: 0 }),
    total_lp_after: numeric("total_lp_after", { precision: 78, scale: 0 }),
  },
).existing();

/**
 * Enriched router remove liquidity view
 * Joins router_remove_liquidity with market_burn and market creation data
 */
export const enrichedRouterRemoveLiquidity = pgView(
  "enriched_router_remove_liquidity",
  {
    _id: uuid("_id"),
    block_number: bigint("block_number", { mode: "number" }),
    block_timestamp: timestamp("block_timestamp"),
    transaction_hash: text("transaction_hash"),
    sender: text("sender"),
    receiver: text("receiver"),
    market: text("market"),
    lp_in: numeric("lp_in", { precision: 78, scale: 0 }),
    sy_out: numeric("sy_out", { precision: 78, scale: 0 }),
    pt_out: numeric("pt_out", { precision: 78, scale: 0 }),
    // Enrichment fields
    expiry: bigint("expiry", { mode: "number" }),
    sy: text("sy"),
    pt: text("pt"),
    yt: text("yt"),
    underlying: text("underlying"),
    underlying_symbol: text("underlying_symbol"),
    exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }),
    implied_rate: numeric("implied_rate", { precision: 78, scale: 0 }),
    sy_reserve_after: numeric("sy_reserve_after", { precision: 78, scale: 0 }),
    pt_reserve_after: numeric("pt_reserve_after", { precision: 78, scale: 0 }),
    total_lp_after: numeric("total_lp_after", { precision: 78, scale: 0 }),
  },
).existing();

/**
 * Enriched router mint PY view
 * Joins router_mint_py with yt_mint_py for full context
 */
export const enrichedRouterMintPY = pgView("enriched_router_mint_py", {
  _id: uuid("_id"),
  block_number: bigint("block_number", { mode: "number" }),
  block_timestamp: timestamp("block_timestamp"),
  transaction_hash: text("transaction_hash"),
  sender: text("sender"),
  receiver: text("receiver"),
  yt: text("yt"),
  sy_in: numeric("sy_in", { precision: 78, scale: 0 }),
  pt_out: numeric("pt_out", { precision: 78, scale: 0 }),
  yt_out: numeric("yt_out", { precision: 78, scale: 0 }),
  // Enrichment fields
  expiry: bigint("expiry", { mode: "number" }),
  sy: text("sy"),
  pt: text("pt"),
  py_index: numeric("py_index", { precision: 78, scale: 0 }),
  exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }),
  total_pt_supply_after: numeric("total_pt_supply_after", {
    precision: 78,
    scale: 0,
  }),
  total_yt_supply_after: numeric("total_yt_supply_after", {
    precision: 78,
    scale: 0,
  }),
}).existing();

/**
 * Enriched router redeem PY view
 * Joins router_redeem_py with yt_redeem_py or yt_redeem_py_post_expiry
 */
export const enrichedRouterRedeemPY = pgView("enriched_router_redeem_py", {
  _id: uuid("_id"),
  block_number: bigint("block_number", { mode: "number" }),
  block_timestamp: timestamp("block_timestamp"),
  transaction_hash: text("transaction_hash"),
  sender: text("sender"),
  receiver: text("receiver"),
  yt: text("yt"),
  py_in: numeric("py_in", { precision: 78, scale: 0 }),
  sy_out: numeric("sy_out", { precision: 78, scale: 0 }),
  // Enrichment fields
  expiry: bigint("expiry", { mode: "number" }),
  sy: text("sy"),
  pt: text("pt"),
  py_index: numeric("py_index", { precision: 78, scale: 0 }),
  exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }),
  is_post_expiry: boolean("is_post_expiry"),
}).existing();

// ============================================================
// AGGREGATED MATERIALIZED VIEWS (9 views)
// Pre-computed aggregations for frontend analytics.
// Must be refreshed periodically via: SELECT refresh_all_materialized_views();
// ============================================================

/**
 * Market daily stats - aggregated daily metrics per market
 * Use for: TVL charts, volume analytics, fee tracking
 */
export const marketDailyStats = pgView("market_daily_stats", {
  market: text("market"),
  day: timestamp("day"),
  expiry: bigint("expiry", { mode: "number" }),
  sy: text("sy"),
  pt: text("pt"),
  yt: text("yt"),
  underlying: text("underlying"),
  underlying_symbol: text("underlying_symbol"),
  sy_reserve: numeric("sy_reserve", { precision: 78, scale: 0 }),
  pt_reserve: numeric("pt_reserve", { precision: 78, scale: 0 }),
  implied_rate_close: numeric("implied_rate_close", {
    precision: 78,
    scale: 0,
  }),
  exchange_rate_close: numeric("exchange_rate_close", {
    precision: 78,
    scale: 0,
  }),
  implied_rate_open: numeric("implied_rate_open", { precision: 78, scale: 0 }),
  implied_rate_high: numeric("implied_rate_high", { precision: 78, scale: 0 }),
  implied_rate_low: numeric("implied_rate_low", { precision: 78, scale: 0 }),
  sy_volume: numeric("sy_volume", { precision: 78, scale: 0 }),
  pt_volume: numeric("pt_volume", { precision: 78, scale: 0 }),
  total_fees: numeric("total_fees", { precision: 78, scale: 0 }),
  swap_count: bigint("swap_count", { mode: "number" }),
  unique_traders: bigint("unique_traders", { mode: "number" }),
}).existing();

/**
 * Market hourly stats - granular hourly metrics for real-time charts
 */
export const marketHourlyStats = pgView("market_hourly_stats", {
  market: text("market"),
  hour: timestamp("hour"),
  sy_reserve: numeric("sy_reserve", { precision: 78, scale: 0 }),
  pt_reserve: numeric("pt_reserve", { precision: 78, scale: 0 }),
  implied_rate: numeric("implied_rate", { precision: 78, scale: 0 }),
  exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }),
  sy_volume: numeric("sy_volume", { precision: 78, scale: 0 }),
  pt_volume: numeric("pt_volume", { precision: 78, scale: 0 }),
  total_fees: numeric("total_fees", { precision: 78, scale: 0 }),
  swap_count: bigint("swap_count", { mode: "number" }),
}).existing();

/**
 * User positions summary - aggregated PT/YT positions with P&L metrics
 * Use for: Portfolio page, position tracking, yield calculations
 */
export const userPositionsSummary = pgView("user_positions_summary", {
  user_address: text("user_address"),
  yt: text("yt"),
  pt: text("pt"),
  sy: text("sy"),
  expiry: bigint("expiry", { mode: "number" }),
  net_pt_balance: numeric("net_pt_balance", { precision: 78, scale: 0 }),
  net_yt_balance: numeric("net_yt_balance", { precision: 78, scale: 0 }),
  avg_entry_py_index: numeric("avg_entry_py_index", {
    precision: 78,
    scale: 0,
  }),
  avg_entry_exchange_rate: numeric("avg_entry_exchange_rate", {
    precision: 78,
    scale: 0,
  }),
  total_minted: numeric("total_minted", { precision: 78, scale: 0 }),
  total_redeemed: numeric("total_redeemed", { precision: 78, scale: 0 }),
  total_pt_redeemed_post_expiry: numeric("total_pt_redeemed_post_expiry", {
    precision: 78,
    scale: 0,
  }),
  total_interest_claimed: numeric("total_interest_claimed", {
    precision: 78,
    scale: 0,
  }),
  first_mint: timestamp("first_mint"),
  last_activity: timestamp("last_activity"),
  mint_count: bigint("mint_count", { mode: "number" }),
  redeem_count: bigint("redeem_count", { mode: "number" }),
  claim_count: bigint("claim_count", { mode: "number" }),
}).existing();

/**
 * User LP positions - aggregated LP positions per market
 * Use for: LP portfolio, P&L tracking
 */
export const userLpPositions = pgView("user_lp_positions", {
  user_address: text("user_address"),
  market: text("market"),
  expiry: bigint("expiry", { mode: "number" }),
  sy: text("sy"),
  pt: text("pt"),
  yt: text("yt"),
  underlying: text("underlying"),
  underlying_symbol: text("underlying_symbol"),
  net_lp_balance: numeric("net_lp_balance", { precision: 78, scale: 0 }),
  total_sy_deposited: numeric("total_sy_deposited", {
    precision: 78,
    scale: 0,
  }),
  total_pt_deposited: numeric("total_pt_deposited", {
    precision: 78,
    scale: 0,
  }),
  total_sy_withdrawn: numeric("total_sy_withdrawn", {
    precision: 78,
    scale: 0,
  }),
  total_pt_withdrawn: numeric("total_pt_withdrawn", {
    precision: 78,
    scale: 0,
  }),
  avg_entry_implied_rate: numeric("avg_entry_implied_rate", {
    precision: 78,
    scale: 0,
  }),
  avg_entry_exchange_rate: numeric("avg_entry_exchange_rate", {
    precision: 78,
    scale: 0,
  }),
  avg_exit_implied_rate: numeric("avg_exit_implied_rate", {
    precision: 78,
    scale: 0,
  }),
  avg_exit_exchange_rate: numeric("avg_exit_exchange_rate", {
    precision: 78,
    scale: 0,
  }),
  first_mint: timestamp("first_mint"),
  last_activity: timestamp("last_activity"),
  mint_count: bigint("mint_count", { mode: "number" }),
  burn_count: bigint("burn_count", { mode: "number" }),
}).existing();

/**
 * Protocol daily stats - protocol-wide daily metrics
 * Use for: Dashboard, analytics page
 */
export const protocolDailyStats = pgView("protocol_daily_stats", {
  day: timestamp("day"),
  total_sy_volume: numeric("total_sy_volume", { precision: 78, scale: 0 }),
  total_pt_volume: numeric("total_pt_volume", { precision: 78, scale: 0 }),
  total_fees: numeric("total_fees", { precision: 78, scale: 0 }),
  swap_count: bigint("swap_count", { mode: "number" }),
  unique_swappers: bigint("unique_swappers", { mode: "number" }),
  total_py_minted: numeric("total_py_minted", { precision: 78, scale: 0 }),
  mint_count: bigint("mint_count", { mode: "number" }),
  unique_minters: bigint("unique_minters", { mode: "number" }),
  total_lp_minted: numeric("total_lp_minted", { precision: 78, scale: 0 }),
  lp_mint_count: bigint("lp_mint_count", { mode: "number" }),
  total_lp_burned: numeric("total_lp_burned", { precision: 78, scale: 0 }),
  lp_burn_count: bigint("lp_burn_count", { mode: "number" }),
  total_interest_claimed: numeric("total_interest_claimed", {
    precision: 78,
    scale: 0,
  }),
  interest_claim_count: bigint("interest_claim_count", { mode: "number" }),
  unique_claimers: bigint("unique_claimers", { mode: "number" }),
  unique_users: bigint("unique_users", { mode: "number" }),
}).existing();

/**
 * Market current state - latest state for each market
 * Use for: Market listings, dashboard
 */
export const marketCurrentState = pgView("market_current_state", {
  market: text("market"),
  expiry: bigint("expiry", { mode: "number" }),
  sy: text("sy"),
  pt: text("pt"),
  yt: text("yt"),
  underlying: text("underlying"),
  underlying_symbol: text("underlying_symbol"),
  fee_rate: numeric("fee_rate", { precision: 78, scale: 0 }),
  initial_exchange_rate: numeric("initial_exchange_rate", {
    precision: 78,
    scale: 0,
  }),
  created_at: timestamp("created_at"),
  sy_reserve: numeric("sy_reserve", { precision: 78, scale: 0 }),
  pt_reserve: numeric("pt_reserve", { precision: 78, scale: 0 }),
  implied_rate: numeric("implied_rate", { precision: 78, scale: 0 }),
  exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }),
  last_activity: timestamp("last_activity"),
  is_expired: boolean("is_expired"),
  volume_24h: numeric("volume_24h", { precision: 78, scale: 0 }),
  fees_24h: numeric("fees_24h", { precision: 78, scale: 0 }),
  swaps_24h: bigint("swaps_24h", { mode: "number" }),
}).existing();

/**
 * User trading stats - for leaderboards
 */
export const userTradingStats = pgView("user_trading_stats", {
  user_address: text("user_address"),
  total_swaps: bigint("total_swaps", { mode: "number" }),
  markets_traded: bigint("markets_traded", { mode: "number" }),
  total_sy_volume: numeric("total_sy_volume", { precision: 78, scale: 0 }),
  total_pt_volume: numeric("total_pt_volume", { precision: 78, scale: 0 }),
  total_fees_paid: numeric("total_fees_paid", { precision: 78, scale: 0 }),
  first_swap: timestamp("first_swap"),
  last_swap: timestamp("last_swap"),
  active_days: bigint("active_days", { mode: "number" }),
}).existing();

/**
 * Rate history - implied rate history for charts
 */
export const rateHistory = pgView("rate_history", {
  market: text("market"),
  block_timestamp: timestamp("block_timestamp"),
  block_number: bigint("block_number", { mode: "number" }),
  implied_rate_before: numeric("implied_rate_before", {
    precision: 78,
    scale: 0,
  }),
  implied_rate_after: numeric("implied_rate_after", {
    precision: 78,
    scale: 0,
  }),
  exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }),
  time_to_expiry: bigint("time_to_expiry", { mode: "number" }),
  sy_reserve: numeric("sy_reserve", { precision: 78, scale: 0 }),
  pt_reserve: numeric("pt_reserve", { precision: 78, scale: 0 }),
  total_lp: numeric("total_lp", { precision: 78, scale: 0 }),
}).existing();

/**
 * Exchange rate history - from SY oracle updates
 */
export const exchangeRateHistory = pgView("exchange_rate_history", {
  sy: text("sy"),
  underlying: text("underlying"),
  block_timestamp: timestamp("block_timestamp"),
  block_number: bigint("block_number", { mode: "number" }),
  old_rate: numeric("old_rate", { precision: 78, scale: 0 }),
  new_rate: numeric("new_rate", { precision: 78, scale: 0 }),
  rate_change_bps: numeric("rate_change_bps", { precision: 78, scale: 0 }),
}).existing();
