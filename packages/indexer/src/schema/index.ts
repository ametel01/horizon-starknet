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
  index,
  integer,
  numeric,
  pgTable,
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
  },
  (table) => [
    index("factory_ycc_sy_idx").on(table.sy),
    index("factory_ycc_expiry_idx").on(table.expiry),
    index("factory_ycc_creator_idx").on(table.creator),
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
