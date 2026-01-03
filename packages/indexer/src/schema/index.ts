/**
 * Drizzle ORM schema for Horizon Protocol indexer
 *
 * Architecture: One table per event type
 * - Prevents race conditions (each indexer writes to its own table)
 * - Enables independent scaling and reorg handling
 * - Optimized indexes per event's query patterns
 *
 * Total: 33 event tables across 6 contracts
 * (includes 4 new AMM fee tables for reserve fee tracking)
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
  uniqueIndex,
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
    event_index: integer("event_index").notNull(),
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
    uniqueIndex("factory_ycc_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const factoryClassHashesUpdated = pgTable(
  "factory_class_hashes_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    yt_class_hash: text("yt_class_hash").notNull(),
    pt_class_hash: text("pt_class_hash").notNull(),
  },
  (table) => [
    uniqueIndex("factory_chu_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// ============================================================
// MARKET FACTORY EVENTS (5 tables)
// 2 core + 3 AMM fee management tables
// ============================================================

export const marketFactoryMarketCreated = pgTable(
  "market_factory_market_created",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    ln_fee_rate_root: numeric("ln_fee_rate_root", {
      precision: 78,
      scale: 0,
    }).notNull(),
    reserve_fee_percent: integer("reserve_fee_percent").notNull(),
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
    uniqueIndex("mf_mc_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const marketFactoryClassHashUpdated = pgTable(
  "market_factory_class_hash_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    old_class_hash: text("old_class_hash").notNull(),
    new_class_hash: text("new_class_hash").notNull(),
  },
  (table) => [
    uniqueIndex("mf_chu_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const marketFactoryTreasuryUpdated = pgTable(
  "market_factory_treasury_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    old_treasury: text("old_treasury").notNull(),
    new_treasury: text("new_treasury").notNull(),
  },
  (table) => [
    uniqueIndex("mf_tu_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const marketFactoryDefaultReserveFeeUpdated = pgTable(
  "market_factory_default_reserve_fee_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    old_percent: integer("old_percent").notNull(),
    new_percent: integer("new_percent").notNull(),
  },
  (table) => [
    uniqueIndex("mf_drfu_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const marketFactoryOverrideFeeSet = pgTable(
  "market_factory_override_fee_set",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    router: text("router").notNull(),
    market: text("market").notNull(),
    ln_fee_rate_root: numeric("ln_fee_rate_root", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("mf_ofs_router_idx").on(table.router),
    index("mf_ofs_market_idx").on(table.market),
    uniqueIndex("mf_ofs_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// ============================================================
// SY (STANDARDIZED YIELD) EVENTS (8 tables)
// 3 core tables + 5 Phase 4 monitoring tables
// ============================================================

export const syDeposit = pgTable(
  "sy_deposit",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    index("sy_deposit_timestamp_idx").on(table.block_timestamp),
    uniqueIndex("sy_deposit_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const syRedeem = pgTable(
  "sy_redeem",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    index("sy_redeem_timestamp_idx").on(table.block_timestamp),
    uniqueIndex("sy_redeem_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const syOracleRateUpdated = pgTable(
  "sy_oracle_rate_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    uniqueIndex("sy_oru_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// Phase 4: Negative Yield Detection (monitoring)
// Source: contracts/src/components/sy_component.cairo:143-158
export const syNegativeYieldDetected = pgTable(
  "sy_negative_yield_detected",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Indexed fields (keys)
    sy: text("sy").notNull(),
    underlying: text("underlying").notNull(),
    // Event data
    watermark_rate: numeric("watermark_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    current_rate: numeric("current_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    rate_drop_bps: numeric("rate_drop_bps", {
      precision: 78,
      scale: 0,
    }).notNull(),
    event_timestamp: bigint("event_timestamp", { mode: "number" }).notNull(),
  },
  (table) => [
    index("sy_nyd_sy_idx").on(table.sy),
    index("sy_nyd_underlying_idx").on(table.underlying),
    index("sy_nyd_timestamp_idx").on(table.block_timestamp),
    uniqueIndex("sy_nyd_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// Phase 4: Pause State Tracking
// Source: OpenZeppelin PausableComponent (Paused/Unpaused events)
export const syPauseState = pgTable(
  "sy_pause_state",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Contract address (derived from event source)
    sy: text("sy").notNull(),
    // Event data
    account: text("account").notNull(), // Who triggered pause/unpause
    is_paused: boolean("is_paused").notNull(), // true = Paused, false = Unpaused
  },
  (table) => [
    index("sy_ps_sy_idx").on(table.sy),
    index("sy_ps_timestamp_idx").on(table.block_timestamp),
    uniqueIndex("sy_ps_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// Phase 4: Rewards Claimed (SYWithRewards)
// Source: contracts/src/components/reward_manager_component.cairo:85-94
export const syRewardsClaimed = pgTable(
  "sy_rewards_claimed",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Indexed fields (keys)
    user: text("user").notNull(),
    reward_token: text("reward_token").notNull(),
    // SYWithRewards contract (derived from event source)
    sy: text("sy").notNull(),
    // Event data
    amount: numeric("amount", { precision: 78, scale: 0 }).notNull(),
    event_timestamp: bigint("event_timestamp", { mode: "number" }).notNull(),
  },
  (table) => [
    index("sy_rc_user_idx").on(table.user),
    index("sy_rc_sy_idx").on(table.sy),
    index("sy_rc_token_idx").on(table.reward_token),
    index("sy_rc_timestamp_idx").on(table.block_timestamp),
    uniqueIndex("sy_rc_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// Phase 4: Reward Index Updated (for APY calculation)
// Source: contracts/src/components/reward_manager_component.cairo:96-106
export const syRewardIndexUpdated = pgTable(
  "sy_reward_index_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Indexed fields (keys)
    reward_token: text("reward_token").notNull(),
    // SYWithRewards contract (derived from event source)
    sy: text("sy").notNull(),
    // Event data
    old_index: numeric("old_index", { precision: 78, scale: 0 }).notNull(),
    new_index: numeric("new_index", { precision: 78, scale: 0 }).notNull(),
    rewards_added: numeric("rewards_added", {
      precision: 78,
      scale: 0,
    }).notNull(),
    total_supply: numeric("total_supply", {
      precision: 78,
      scale: 0,
    }).notNull(),
    event_timestamp: bigint("event_timestamp", { mode: "number" }).notNull(),
  },
  (table) => [
    index("sy_riu_sy_idx").on(table.sy),
    index("sy_riu_token_idx").on(table.reward_token),
    index("sy_riu_timestamp_idx").on(table.block_timestamp),
    uniqueIndex("sy_riu_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// Phase 4: Reward Token Added (registry)
// Source: contracts/src/components/reward_manager_component.cairo:108-115
export const syRewardTokenAdded = pgTable(
  "sy_reward_token_added",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Indexed fields (keys)
    reward_token: text("reward_token").notNull(),
    // SYWithRewards contract (derived from event source)
    sy: text("sy").notNull(),
    // Event data
    token_index: integer("token_index").notNull(), // Index in reward tokens array
    event_timestamp: bigint("event_timestamp", { mode: "number" }).notNull(),
  },
  (table) => [
    index("sy_rta_sy_idx").on(table.sy),
    index("sy_rta_token_idx").on(table.reward_token),
    uniqueIndex("sy_rta_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
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
    event_index: integer("event_index").notNull(),
    // Indexed fields (keys)
    caller: text("caller").notNull(),
    receiver_pt: text("receiver_pt").notNull(),
    receiver_yt: text("receiver_yt").notNull(),
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
    index("yt_mint_receiver_pt_idx").on(table.receiver_pt),
    index("yt_mint_receiver_yt_idx").on(table.receiver_yt),
    index("yt_mint_expiry_idx").on(table.expiry),
    index("yt_mint_yt_idx").on(table.yt),
    uniqueIndex("yt_mint_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const ytRedeemPY = pgTable(
  "yt_redeem_py",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    uniqueIndex("yt_redeem_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const ytRedeemPYPostExpiry = pgTable(
  "yt_redeem_py_post_expiry",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    uniqueIndex("yt_redeem_pe_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const ytInterestClaimed = pgTable(
  "yt_interest_claimed",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    uniqueIndex("yt_ic_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const ytExpiryReached = pgTable(
  "yt_expiry_reached",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    uniqueIndex("yt_er_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// PostExpiryDataSet: emitted once when post-expiry data is initialized
export const ytPostExpiryDataSet = pgTable(
  "yt_post_expiry_data_set",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Keys: [selector, yt, pt]
    yt: text("yt").notNull(),
    pt: text("pt").notNull(),
    // Data fields
    sy: text("sy").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    first_py_index: numeric("first_py_index", {
      precision: 78,
      scale: 0,
    }).notNull(),
    exchange_rate_at_init: numeric("exchange_rate_at_init", {
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
  },
  (table) => [
    index("yt_peds_yt_idx").on(table.yt),
    index("yt_peds_pt_idx").on(table.pt),
    uniqueIndex("yt_peds_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// PyIndexUpdated: emitted when PY index changes
export const ytPyIndexUpdated = pgTable(
  "yt_py_index_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Keys: [selector, yt]
    yt: text("yt").notNull(),
    // Data fields
    old_index: numeric("old_index", { precision: 78, scale: 0 }).notNull(),
    new_index: numeric("new_index", { precision: 78, scale: 0 }).notNull(),
    exchange_rate: numeric("exchange_rate", {
      precision: 78,
      scale: 0,
    }).notNull(),
    index_block_number: bigint("index_block_number", {
      mode: "number",
    }).notNull(),
  },
  (table) => [
    index("yt_piu_yt_idx").on(table.yt),
    index("yt_piu_block_idx").on(table.index_block_number),
    uniqueIndex("yt_piu_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// TreasuryInterestRedeemed: admin claims post-expiry yield
export const ytTreasuryInterestRedeemed = pgTable(
  "yt_treasury_interest_redeemed",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Keys: [selector, yt, treasury]
    yt: text("yt").notNull(),
    treasury: text("treasury").notNull(),
    // Data fields
    amount_sy: numeric("amount_sy", { precision: 78, scale: 0 }).notNull(),
    sy: text("sy").notNull(),
    expiry_index: numeric("expiry_index", {
      precision: 78,
      scale: 0,
    }).notNull(),
    current_index: numeric("current_index", {
      precision: 78,
      scale: 0,
    }).notNull(),
    total_yt_supply: numeric("total_yt_supply", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("yt_tir_yt_idx").on(table.yt),
    index("yt_tir_treasury_idx").on(table.treasury),
    uniqueIndex("yt_tir_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// InterestFeeRateSet: admin changes fee rate
export const ytInterestFeeRateSet = pgTable(
  "yt_interest_fee_rate_set",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Keys: [selector, yt]
    yt: text("yt").notNull(),
    // Data fields
    old_rate: numeric("old_rate", { precision: 78, scale: 0 }).notNull(),
    new_rate: numeric("new_rate", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    index("yt_ifrs_yt_idx").on(table.yt),
    uniqueIndex("yt_ifrs_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// MintPYMulti: batch minting
export const ytMintPYMulti = pgTable(
  "yt_mint_py_multi",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Keys: [selector, caller, expiry]
    caller: text("caller").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Data fields (yt derived from event.address)
    yt: text("yt").notNull(),
    total_sy_deposited: numeric("total_sy_deposited", {
      precision: 78,
      scale: 0,
    }).notNull(),
    total_py_minted: numeric("total_py_minted", {
      precision: 78,
      scale: 0,
    }).notNull(),
    receiver_count: integer("receiver_count").notNull(),
  },
  (table) => [
    index("yt_mpm_caller_idx").on(table.caller),
    index("yt_mpm_expiry_idx").on(table.expiry),
    index("yt_mpm_yt_idx").on(table.yt),
    uniqueIndex("yt_mpm_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// RedeemPYMulti: batch redemption
export const ytRedeemPYMulti = pgTable(
  "yt_redeem_py_multi",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Keys: [selector, caller, expiry]
    caller: text("caller").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Data fields
    yt: text("yt").notNull(),
    total_py_redeemed: numeric("total_py_redeemed", {
      precision: 78,
      scale: 0,
    }).notNull(),
    total_sy_returned: numeric("total_sy_returned", {
      precision: 78,
      scale: 0,
    }).notNull(),
    receiver_count: integer("receiver_count").notNull(),
  },
  (table) => [
    index("yt_rpm_caller_idx").on(table.caller),
    index("yt_rpm_expiry_idx").on(table.expiry),
    index("yt_rpm_yt_idx").on(table.yt),
    uniqueIndex("yt_rpm_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// RedeemPYWithInterest: combined redeem + claim
export const ytRedeemPYWithInterest = pgTable(
  "yt_redeem_py_with_interest",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Keys: [selector, caller, receiver, expiry]
    caller: text("caller").notNull(),
    receiver: text("receiver").notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    // Data fields
    yt: text("yt").notNull(),
    amount_py_redeemed: numeric("amount_py_redeemed", {
      precision: 78,
      scale: 0,
    }).notNull(),
    amount_sy_from_redeem: numeric("amount_sy_from_redeem", {
      precision: 78,
      scale: 0,
    }).notNull(),
    amount_interest_claimed: numeric("amount_interest_claimed", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("yt_rpwi_caller_idx").on(table.caller),
    index("yt_rpwi_receiver_idx").on(table.receiver),
    index("yt_rpwi_expiry_idx").on(table.expiry),
    index("yt_rpwi_yt_idx").on(table.yt),
    uniqueIndex("yt_rpwi_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

// ============================================================
// MARKET (AMM) EVENTS (7 tables)
// 6 core + 1 reserve fee transfer table
// ============================================================

export const marketMint = pgTable(
  "market_mint",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    uniqueIndex("market_mint_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const marketBurn = pgTable(
  "market_burn",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    uniqueIndex("market_burn_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const marketSwap = pgTable(
  "market_swap",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    // Fee columns - total_fee is the sum of lp_fee + reserve_fee
    // Note: 'fee' column kept nullable for historical data compatibility (deprecated)
    fee: numeric("fee", { precision: 78, scale: 0 }),
    total_fee: numeric("total_fee", { precision: 78, scale: 0 }),
    lp_fee: numeric("lp_fee", { precision: 78, scale: 0 }),
    reserve_fee: numeric("reserve_fee", { precision: 78, scale: 0 }),
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
    uniqueIndex("market_swap_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const marketImpliedRateUpdated = pgTable(
  "market_implied_rate_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    uniqueIndex("market_iru_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const marketFeesCollected = pgTable(
  "market_fees_collected",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Indexed fields (keys)
    collector: text("collector").notNull(),
    receiver: text("receiver").notNull(),
    market: text("market").notNull(),
    // Event data
    amount: numeric("amount", { precision: 78, scale: 0 }).notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    ln_fee_rate_root: numeric("ln_fee_rate_root", {
      precision: 78,
      scale: 0,
    }).notNull(),
  },
  (table) => [
    index("market_fc_collector_idx").on(table.collector),
    index("market_fc_receiver_idx").on(table.receiver),
    index("market_fc_market_idx").on(table.market),
    uniqueIndex("market_fc_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const marketScalarRootUpdated = pgTable(
  "market_scalar_root_updated",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Indexed fields (keys)
    market: text("market").notNull(),
    // Event data
    old_value: numeric("old_value", { precision: 78, scale: 0 }).notNull(),
    new_value: numeric("new_value", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => [
    index("market_sru_market_idx").on(table.market),
    index("market_sru_timestamp_idx").on(table.block_timestamp),
    uniqueIndex("market_sru_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const marketReserveFeeTransferred = pgTable(
  "market_reserve_fee_transferred",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
    // Indexed fields (keys)
    market: text("market").notNull(),
    treasury: text("treasury").notNull(),
    caller: text("caller").notNull(),
    // Event data
    amount: numeric("amount", { precision: 78, scale: 0 }).notNull(),
    expiry: bigint("expiry", { mode: "number" }).notNull(),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  },
  (table) => [
    index("market_rft_market_idx").on(table.market),
    index("market_rft_treasury_idx").on(table.treasury),
    index("market_rft_caller_idx").on(table.caller),
    index("market_rft_expiry_idx").on(table.expiry),
    uniqueIndex("market_rft_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
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
    event_index: integer("event_index").notNull(),
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
    index("router_mint_timestamp_idx").on(table.block_timestamp),
    uniqueIndex("router_mint_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const routerRedeemPY = pgTable(
  "router_redeem_py",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    index("router_redeem_timestamp_idx").on(table.block_timestamp),
    uniqueIndex("router_redeem_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const routerAddLiquidity = pgTable(
  "router_add_liquidity",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    index("router_al_timestamp_idx").on(table.block_timestamp),
    uniqueIndex("router_al_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const routerRemoveLiquidity = pgTable(
  "router_remove_liquidity",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    index("router_rl_timestamp_idx").on(table.block_timestamp),
    uniqueIndex("router_rl_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const routerSwap = pgTable(
  "router_swap",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    index("router_swap_timestamp_idx").on(table.block_timestamp),
    uniqueIndex("router_swap_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
);

export const routerSwapYT = pgTable(
  "router_swap_yt",
  {
    _id: uuid("_id").primaryKey().defaultRandom(),
    block_number: bigint("block_number", { mode: "number" }).notNull(),
    block_timestamp: timestamp("block_timestamp").notNull(),
    transaction_hash: text("transaction_hash").notNull(),
    event_index: integer("event_index").notNull(),
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
    index("router_swap_yt_timestamp_idx").on(table.block_timestamp),
    uniqueIndex("router_swap_yt_event_key").on(
      table.block_number,
      table.transaction_hash,
      table.event_index
    ),
  ]
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
  total_fee: numeric("total_fee", { precision: 78, scale: 0 }),
  lp_fee: numeric("lp_fee", { precision: 78, scale: 0 }),
  reserve_fee: numeric("reserve_fee", { precision: 78, scale: 0 }),
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
  total_fee: numeric("total_fee", { precision: 78, scale: 0 }),
  lp_fee: numeric("lp_fee", { precision: 78, scale: 0 }),
  reserve_fee: numeric("reserve_fee", { precision: 78, scale: 0 }),
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
  }
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
  }
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
  lp_fees: numeric("lp_fees", { precision: 78, scale: 0 }),
  reserve_fees: numeric("reserve_fees", { precision: 78, scale: 0 }),
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
  lp_fees: numeric("lp_fees", { precision: 78, scale: 0 }),
  reserve_fees: numeric("reserve_fees", { precision: 78, scale: 0 }),
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
  total_lp_fees: numeric("total_lp_fees", { precision: 78, scale: 0 }),
  total_reserve_fees: numeric("total_reserve_fees", {
    precision: 78,
    scale: 0,
  }),
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
  ln_fee_rate_root: numeric("ln_fee_rate_root", { precision: 78, scale: 0 }),
  initial_exchange_rate: numeric("initial_exchange_rate", {
    precision: 78,
    scale: 0,
  }),
  created_at: timestamp("created_at"),
  sy_reserve: numeric("sy_reserve", { precision: 78, scale: 0 }),
  pt_reserve: numeric("pt_reserve", { precision: 78, scale: 0 }),
  total_lp: numeric("total_lp", { precision: 78, scale: 0 }),
  implied_rate: numeric("implied_rate", { precision: 78, scale: 0 }),
  exchange_rate: numeric("exchange_rate", { precision: 78, scale: 0 }),
  last_activity: timestamp("last_activity"),
  is_expired: boolean("is_expired"),
  sy_volume_24h: numeric("sy_volume_24h", { precision: 78, scale: 0 }),
  pt_volume_24h: numeric("pt_volume_24h", { precision: 78, scale: 0 }),
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
  total_lp_fees_paid: numeric("total_lp_fees_paid", {
    precision: 78,
    scale: 0,
  }),
  total_reserve_fees_paid: numeric("total_reserve_fees_paid", {
    precision: 78,
    scale: 0,
  }),
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

// ============================================================
// PHASE 4: SY MONITORING VIEWS (4 views)
// Views for negative yield alerts, pause state, and rewards
// ============================================================

/**
 * User Reward History View
 * Aggregates reward claims per user per SY per reward token
 * Use for: Portfolio page, reward claim history
 */
export const userRewardHistory = pgView("user_reward_history", {
  user: text("user"),
  sy: text("sy"),
  reward_token: text("reward_token"),
  total_claimed: numeric("total_claimed", { precision: 78, scale: 0 }),
  claim_count: bigint("claim_count", { mode: "number" }),
  last_claim_timestamp: timestamp("last_claim_timestamp"),
}).existing();

/**
 * SY Current Pause State View
 * Latest pause state for each SY contract
 * Use for: Market cards, warning banners
 */
export const syCurrentPauseState = pgView("sy_current_pause_state", {
  sy: text("sy"),
  is_paused: boolean("is_paused"),
  last_updated_at: timestamp("last_updated_at"),
  last_updated_by: text("last_updated_by"),
}).existing();

/**
 * Negative Yield Alerts View
 * Aggregated negative yield events per SY
 * Use for: Monitoring dashboard, alert banners
 */
export const negativeYieldAlerts = pgView("negative_yield_alerts", {
  sy: text("sy"),
  underlying: text("underlying"),
  event_count: bigint("event_count", { mode: "number" }),
  max_drop_bps: numeric("max_drop_bps", { precision: 78, scale: 0 }),
  last_detected_at: timestamp("last_detected_at"),
}).existing();

/**
 * SY Reward APY View
 * Rolling 7-day reward APY calculation per SY per reward token
 * Use for: APY display on market cards
 */
export const syRewardApy = pgView("sy_reward_apy", {
  sy: text("sy"),
  reward_token: text("reward_token"),
  rewards_last_7_days: numeric("rewards_last_7_days", {
    precision: 78,
    scale: 0,
  }),
  avg_total_supply: numeric("avg_total_supply", { precision: 78, scale: 0 }),
  update_count: bigint("update_count", { mode: "number" }),
}).existing();

// ============================================================
// PHASE 5: YT INTEREST ANALYTICS VIEWS (4 views)
// Views for fee rate tracking, treasury yields, and batch operations
// ============================================================

/**
 * YT Fee Analytics View
 * Tracks current fee rate per YT and rate change history
 * Use for: Fee rate display, governance monitoring
 */
export const ytFeeAnalytics = pgView("yt_fee_analytics", {
  yt: text("yt"),
  current_fee_rate: numeric("current_fee_rate", { precision: 78, scale: 0 }),
  initial_fee_rate: numeric("initial_fee_rate", { precision: 78, scale: 0 }),
  rate_change_count: bigint("rate_change_count", { mode: "number" }),
  first_change: timestamp("first_change"),
  last_change: timestamp("last_change"),
  net_change_direction: bigint("net_change_direction", { mode: "number" }),
}).existing();

/**
 * Treasury Yield Summary View
 * Aggregates total treasury claims per YT
 * Use for: Treasury analytics, protocol revenue tracking
 */
export const treasuryYieldSummary = pgView("treasury_yield_summary", {
  yt: text("yt"),
  treasury: text("treasury"),
  sy: text("sy"),
  total_sy_claimed: numeric("total_sy_claimed", { precision: 78, scale: 0 }),
  claim_count: bigint("claim_count", { mode: "number" }),
  first_claim: timestamp("first_claim"),
  last_claim: timestamp("last_claim"),
  avg_claim_size: numeric("avg_claim_size", { precision: 78, scale: 0 }),
  latest_index: numeric("latest_index", { precision: 78, scale: 0 }),
  latest_yt_supply: numeric("latest_yt_supply", { precision: 78, scale: 0 }),
}).existing();

/**
 * Batch Operations Summary View
 * Aggregates batch mint/redeem activity per caller
 * Use for: Whale tracking, batch operation analytics
 */
export const batchOperationsSummary = pgView("batch_operations_summary", {
  caller: text("caller"),
  yt: text("yt"),
  expiry: bigint("expiry", { mode: "number" }),
  total_batch_minted_sy: numeric("total_batch_minted_sy", {
    precision: 78,
    scale: 0,
  }),
  total_batch_minted_py: numeric("total_batch_minted_py", {
    precision: 78,
    scale: 0,
  }),
  total_mint_receivers: bigint("total_mint_receivers", { mode: "number" }),
  batch_mint_count: bigint("batch_mint_count", { mode: "number" }),
  total_batch_redeemed_py: numeric("total_batch_redeemed_py", {
    precision: 78,
    scale: 0,
  }),
  total_batch_redeemed_sy: numeric("total_batch_redeemed_sy", {
    precision: 78,
    scale: 0,
  }),
  total_redeem_receivers: bigint("total_redeem_receivers", { mode: "number" }),
  batch_redeem_count: bigint("batch_redeem_count", { mode: "number" }),
  total_batch_operations: bigint("total_batch_operations", { mode: "number" }),
  first_batch_operation: timestamp("first_batch_operation"),
  last_batch_operation: timestamp("last_batch_operation"),
}).existing();

/**
 * Redeem With Interest Analytics View
 * Tracks redemptions that also claimed interest
 * Use for: User transaction history, interest tracking
 */
export const redeemWithInterestAnalytics = pgView(
  "redeem_with_interest_analytics",
  {
    _id: uuid("_id"),
    block_number: bigint("block_number", { mode: "number" }),
    block_timestamp: timestamp("block_timestamp"),
    transaction_hash: text("transaction_hash"),
    yt: text("yt"),
    caller: text("caller"),
    receiver: text("receiver"),
    expiry: bigint("expiry", { mode: "number" }),
    amount_py_redeemed: numeric("amount_py_redeemed", {
      precision: 78,
      scale: 0,
    }),
    amount_sy_from_redeem: numeric("amount_sy_from_redeem", {
      precision: 78,
      scale: 0,
    }),
    amount_interest_claimed: numeric("amount_interest_claimed", {
      precision: 78,
      scale: 0,
    }),
    total_sy_received: numeric("total_sy_received", {
      precision: 78,
      scale: 0,
    }),
    interest_percentage_bps: numeric("interest_percentage_bps", {
      precision: 78,
      scale: 0,
    }),
    sy: text("sy"),
    pt: text("pt"),
    underlying: text("underlying"),
    underlying_symbol: text("underlying_symbol"),
  }
).existing();
