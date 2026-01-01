/**
 * Database schema for indexed event data
 *
 * This file defines the schema for querying the indexer database.
 * It mirrors the schema from packages/indexer/src/schema/index.ts
 * but uses the frontend's drizzle-orm instance to avoid type conflicts.
 *
 * IMPORTANT: Keep this in sync with the indexer schema!
 */

import {
  bigint,
  boolean,
  numeric,
  pgTable,
  pgView,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// ============================================================
// EVENT TABLES
// ============================================================

// Factory Events
export const factoryYieldContractsCreated = pgTable('factory_yield_contracts_created', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  sy: text('sy').notNull(),
  expiry: bigint('expiry', { mode: 'number' }).notNull(),
  pt: text('pt').notNull(),
  yt: text('yt').notNull(),
  creator: text('creator').notNull(),
});

// Market Factory Events
export const marketFactoryMarketCreated = pgTable('market_factory_market_created', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  pt: text('pt').notNull(),
  expiry: bigint('expiry', { mode: 'number' }).notNull(),
  market: text('market').notNull(),
  creator: text('creator').notNull(),
  scalar_root: numeric('scalar_root', { precision: 78, scale: 0 }).notNull(),
  initial_anchor: numeric('initial_anchor', { precision: 78, scale: 0 }).notNull(),
  fee_rate: numeric('fee_rate', { precision: 78, scale: 0 }).notNull(),
  sy: text('sy').notNull(),
  yt: text('yt').notNull(),
  underlying: text('underlying').notNull(),
  underlying_symbol: text('underlying_symbol').notNull(),
  initial_exchange_rate: numeric('initial_exchange_rate', { precision: 78, scale: 0 }).notNull(),
  market_index: bigint('market_index', { mode: 'number' }).notNull(),
});

// Market Events
export const marketSwap = pgTable('market_swap', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  sender: text('sender').notNull(),
  receiver: text('receiver').notNull(),
  expiry: bigint('expiry', { mode: 'number' }).notNull(),
  market: text('market').notNull(),
  sy: text('sy').notNull(),
  pt: text('pt').notNull(),
  pt_in: numeric('pt_in', { precision: 78, scale: 0 }).notNull(),
  sy_in: numeric('sy_in', { precision: 78, scale: 0 }).notNull(),
  pt_out: numeric('pt_out', { precision: 78, scale: 0 }).notNull(),
  sy_out: numeric('sy_out', { precision: 78, scale: 0 }).notNull(),
  fee: numeric('fee', { precision: 78, scale: 0 }).notNull(),
  implied_rate_before: numeric('implied_rate_before', { precision: 78, scale: 0 }).notNull(),
  implied_rate_after: numeric('implied_rate_after', { precision: 78, scale: 0 }).notNull(),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }).notNull(),
  sy_reserve_after: numeric('sy_reserve_after', { precision: 78, scale: 0 }).notNull(),
  pt_reserve_after: numeric('pt_reserve_after', { precision: 78, scale: 0 }).notNull(),
});

export const marketFeesCollected = pgTable('market_fees_collected', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  collector: text('collector').notNull(),
  receiver: text('receiver').notNull(),
  market: text('market').notNull(),
  amount: numeric('amount', { precision: 78, scale: 0 }).notNull(),
  expiry: bigint('expiry', { mode: 'number' }).notNull(),
  fee_rate: numeric('fee_rate', { precision: 78, scale: 0 }).notNull(),
});

// SY Events
export const syDeposit = pgTable('sy_deposit', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  caller: text('caller').notNull(),
  receiver: text('receiver').notNull(),
  underlying: text('underlying').notNull(),
  sy: text('sy').notNull(),
  amount_deposited: numeric('amount_deposited', { precision: 78, scale: 0 }).notNull(),
  amount_sy_minted: numeric('amount_sy_minted', { precision: 78, scale: 0 }).notNull(),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }).notNull(),
  total_supply_after: numeric('total_supply_after', { precision: 78, scale: 0 }).notNull(),
});

export const syRedeem = pgTable('sy_redeem', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  caller: text('caller').notNull(),
  receiver: text('receiver').notNull(),
  underlying: text('underlying').notNull(),
  sy: text('sy').notNull(),
  amount_sy_burned: numeric('amount_sy_burned', { precision: 78, scale: 0 }).notNull(),
  amount_redeemed: numeric('amount_redeemed', { precision: 78, scale: 0 }).notNull(),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }).notNull(),
  total_supply_after: numeric('total_supply_after', { precision: 78, scale: 0 }).notNull(),
});

export const syOracleRateUpdated = pgTable('sy_oracle_rate_updated', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  sy: text('sy').notNull(),
  underlying: text('underlying').notNull(),
  old_rate: numeric('old_rate', { precision: 78, scale: 0 }).notNull(),
  new_rate: numeric('new_rate', { precision: 78, scale: 0 }).notNull(),
  rate_change_bps: numeric('rate_change_bps', { precision: 78, scale: 0 }).notNull(),
});

// YT Events
export const ytInterestClaimed = pgTable('yt_interest_claimed', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  user: text('user').notNull(),
  yt: text('yt').notNull(),
  expiry: bigint('expiry', { mode: 'number' }).notNull(),
  sy: text('sy').notNull(),
  amount_sy: numeric('amount_sy', { precision: 78, scale: 0 }).notNull(),
  yt_balance: numeric('yt_balance', { precision: 78, scale: 0 }).notNull(),
  py_index_at_claim: numeric('py_index_at_claim', { precision: 78, scale: 0 }).notNull(),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }).notNull(),
});

// Router Events
export const routerSwap = pgTable('router_swap', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  sender: text('sender').notNull(),
  receiver: text('receiver').notNull(),
  market: text('market').notNull(),
  sy_in: numeric('sy_in', { precision: 78, scale: 0 }).notNull(),
  pt_in: numeric('pt_in', { precision: 78, scale: 0 }).notNull(),
  sy_out: numeric('sy_out', { precision: 78, scale: 0 }).notNull(),
  pt_out: numeric('pt_out', { precision: 78, scale: 0 }).notNull(),
});

export const routerSwapYT = pgTable('router_swap_yt', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  sender: text('sender').notNull(),
  receiver: text('receiver').notNull(),
  yt: text('yt').notNull(),
  market: text('market').notNull(),
  sy_in: numeric('sy_in', { precision: 78, scale: 0 }).notNull(),
  yt_in: numeric('yt_in', { precision: 78, scale: 0 }).notNull(),
  sy_out: numeric('sy_out', { precision: 78, scale: 0 }).notNull(),
  yt_out: numeric('yt_out', { precision: 78, scale: 0 }).notNull(),
});

// ============================================================
// ENRICHED ROUTER VIEWS
// ============================================================

export const enrichedRouterSwap = pgView('enriched_router_swap', {
  _id: uuid('_id'),
  block_number: bigint('block_number', { mode: 'number' }),
  block_timestamp: timestamp('block_timestamp'),
  transaction_hash: text('transaction_hash'),
  sender: text('sender'),
  receiver: text('receiver'),
  market: text('market'),
  sy_in: numeric('sy_in', { precision: 78, scale: 0 }),
  pt_in: numeric('pt_in', { precision: 78, scale: 0 }),
  sy_out: numeric('sy_out', { precision: 78, scale: 0 }),
  pt_out: numeric('pt_out', { precision: 78, scale: 0 }),
  expiry: bigint('expiry', { mode: 'number' }),
  sy: text('sy'),
  pt: text('pt'),
  yt: text('yt'),
  underlying: text('underlying'),
  underlying_symbol: text('underlying_symbol'),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }),
  implied_rate_before: numeric('implied_rate_before', { precision: 78, scale: 0 }),
  implied_rate_after: numeric('implied_rate_after', { precision: 78, scale: 0 }),
  fee: numeric('fee', { precision: 78, scale: 0 }),
  sy_reserve_after: numeric('sy_reserve_after', { precision: 78, scale: 0 }),
  pt_reserve_after: numeric('pt_reserve_after', { precision: 78, scale: 0 }),
}).existing();

export const enrichedRouterSwapYT = pgView('enriched_router_swap_yt', {
  _id: uuid('_id'),
  block_number: bigint('block_number', { mode: 'number' }),
  block_timestamp: timestamp('block_timestamp'),
  transaction_hash: text('transaction_hash'),
  sender: text('sender'),
  receiver: text('receiver'),
  yt: text('yt'),
  market: text('market'),
  sy_in: numeric('sy_in', { precision: 78, scale: 0 }),
  yt_in: numeric('yt_in', { precision: 78, scale: 0 }),
  sy_out: numeric('sy_out', { precision: 78, scale: 0 }),
  yt_out: numeric('yt_out', { precision: 78, scale: 0 }),
  expiry: bigint('expiry', { mode: 'number' }),
  sy: text('sy'),
  pt: text('pt'),
  underlying: text('underlying'),
  underlying_symbol: text('underlying_symbol'),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }),
  implied_rate_before: numeric('implied_rate_before', { precision: 78, scale: 0 }),
  implied_rate_after: numeric('implied_rate_after', { precision: 78, scale: 0 }),
  fee: numeric('fee', { precision: 78, scale: 0 }),
}).existing();

export const enrichedRouterAddLiquidity = pgView('enriched_router_add_liquidity', {
  _id: uuid('_id'),
  block_number: bigint('block_number', { mode: 'number' }),
  block_timestamp: timestamp('block_timestamp'),
  transaction_hash: text('transaction_hash'),
  sender: text('sender'),
  receiver: text('receiver'),
  market: text('market'),
  sy_used: numeric('sy_used', { precision: 78, scale: 0 }),
  pt_used: numeric('pt_used', { precision: 78, scale: 0 }),
  lp_out: numeric('lp_out', { precision: 78, scale: 0 }),
  expiry: bigint('expiry', { mode: 'number' }),
  sy: text('sy'),
  pt: text('pt'),
  yt: text('yt'),
  underlying: text('underlying'),
  underlying_symbol: text('underlying_symbol'),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }),
  implied_rate: numeric('implied_rate', { precision: 78, scale: 0 }),
  sy_reserve_after: numeric('sy_reserve_after', { precision: 78, scale: 0 }),
  pt_reserve_after: numeric('pt_reserve_after', { precision: 78, scale: 0 }),
  total_lp_after: numeric('total_lp_after', { precision: 78, scale: 0 }),
}).existing();

export const enrichedRouterRemoveLiquidity = pgView('enriched_router_remove_liquidity', {
  _id: uuid('_id'),
  block_number: bigint('block_number', { mode: 'number' }),
  block_timestamp: timestamp('block_timestamp'),
  transaction_hash: text('transaction_hash'),
  sender: text('sender'),
  receiver: text('receiver'),
  market: text('market'),
  lp_in: numeric('lp_in', { precision: 78, scale: 0 }),
  sy_out: numeric('sy_out', { precision: 78, scale: 0 }),
  pt_out: numeric('pt_out', { precision: 78, scale: 0 }),
  expiry: bigint('expiry', { mode: 'number' }),
  sy: text('sy'),
  pt: text('pt'),
  yt: text('yt'),
  underlying: text('underlying'),
  underlying_symbol: text('underlying_symbol'),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }),
  implied_rate: numeric('implied_rate', { precision: 78, scale: 0 }),
  sy_reserve_after: numeric('sy_reserve_after', { precision: 78, scale: 0 }),
  pt_reserve_after: numeric('pt_reserve_after', { precision: 78, scale: 0 }),
  total_lp_after: numeric('total_lp_after', { precision: 78, scale: 0 }),
}).existing();

export const enrichedRouterMintPY = pgView('enriched_router_mint_py', {
  _id: uuid('_id'),
  block_number: bigint('block_number', { mode: 'number' }),
  block_timestamp: timestamp('block_timestamp'),
  transaction_hash: text('transaction_hash'),
  sender: text('sender'),
  receiver: text('receiver'),
  yt: text('yt'),
  sy_in: numeric('sy_in', { precision: 78, scale: 0 }),
  pt_out: numeric('pt_out', { precision: 78, scale: 0 }),
  yt_out: numeric('yt_out', { precision: 78, scale: 0 }),
  expiry: bigint('expiry', { mode: 'number' }),
  sy: text('sy'),
  pt: text('pt'),
  py_index: numeric('py_index', { precision: 78, scale: 0 }),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }),
  total_pt_supply_after: numeric('total_pt_supply_after', { precision: 78, scale: 0 }),
  total_yt_supply_after: numeric('total_yt_supply_after', { precision: 78, scale: 0 }),
}).existing();

export const enrichedRouterRedeemPY = pgView('enriched_router_redeem_py', {
  _id: uuid('_id'),
  block_number: bigint('block_number', { mode: 'number' }),
  block_timestamp: timestamp('block_timestamp'),
  transaction_hash: text('transaction_hash'),
  sender: text('sender'),
  receiver: text('receiver'),
  yt: text('yt'),
  py_in: numeric('py_in', { precision: 78, scale: 0 }),
  sy_out: numeric('sy_out', { precision: 78, scale: 0 }),
  expiry: bigint('expiry', { mode: 'number' }),
  sy: text('sy'),
  pt: text('pt'),
  py_index: numeric('py_index', { precision: 78, scale: 0 }),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }),
  is_post_expiry: boolean('is_post_expiry'),
}).existing();

// ============================================================
// AGGREGATED MATERIALIZED VIEWS
// ============================================================

export const marketDailyStats = pgView('market_daily_stats', {
  market: text('market'),
  day: timestamp('day'),
  min_implied_rate: numeric('min_implied_rate', { precision: 78, scale: 0 }),
  max_implied_rate: numeric('max_implied_rate', { precision: 78, scale: 0 }),
  close_implied_rate: numeric('close_implied_rate', { precision: 78, scale: 0 }),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }),
  sy_volume: numeric('sy_volume', { precision: 78, scale: 0 }),
  pt_volume: numeric('pt_volume', { precision: 78, scale: 0 }),
  total_fees: numeric('total_fees', { precision: 78, scale: 0 }),
  swap_count: bigint('swap_count', { mode: 'number' }),
  unique_traders: bigint('unique_traders', { mode: 'number' }),
}).existing();

export const marketHourlyStats = pgView('market_hourly_stats', {
  market: text('market'),
  hour: timestamp('hour'),
  min_implied_rate: numeric('min_implied_rate', { precision: 78, scale: 0 }),
  max_implied_rate: numeric('max_implied_rate', { precision: 78, scale: 0 }),
  close_implied_rate: numeric('close_implied_rate', { precision: 78, scale: 0 }),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }),
  sy_volume: numeric('sy_volume', { precision: 78, scale: 0 }),
  pt_volume: numeric('pt_volume', { precision: 78, scale: 0 }),
  total_fees: numeric('total_fees', { precision: 78, scale: 0 }),
  swap_count: bigint('swap_count', { mode: 'number' }),
}).existing();

export const userPyPositions = pgView('user_py_positions', {
  user_address: text('user_address'),
  yt: text('yt'),
  sy: text('sy'),
  pt: text('pt'),
  pt_balance: numeric('pt_balance', { precision: 78, scale: 0 }),
  yt_balance: numeric('yt_balance', { precision: 78, scale: 0 }),
  total_interest_claimed: numeric('total_interest_claimed', { precision: 78, scale: 0 }),
  first_mint: timestamp('first_mint'),
  last_activity: timestamp('last_activity'),
  mint_count: bigint('mint_count', { mode: 'number' }),
  redeem_count: bigint('redeem_count', { mode: 'number' }),
  claim_count: bigint('claim_count', { mode: 'number' }),
}).existing();

export const marketLpPositions = pgView('market_lp_positions', {
  user_address: text('user_address'),
  market: text('market'),
  lp_balance: numeric('lp_balance', { precision: 78, scale: 0 }),
  total_sy_deposited: numeric('total_sy_deposited', { precision: 78, scale: 0 }),
  total_pt_deposited: numeric('total_pt_deposited', { precision: 78, scale: 0 }),
  total_sy_withdrawn: numeric('total_sy_withdrawn', { precision: 78, scale: 0 }),
  total_pt_withdrawn: numeric('total_pt_withdrawn', { precision: 78, scale: 0 }),
  first_mint: timestamp('first_mint'),
  last_activity: timestamp('last_activity'),
  mint_count: bigint('mint_count', { mode: 'number' }),
  burn_count: bigint('burn_count', { mode: 'number' }),
}).existing();

export const protocolDailyStats = pgView('protocol_daily_stats', {
  day: timestamp('day'),
  total_sy_volume: numeric('total_sy_volume', { precision: 78, scale: 0 }),
  total_pt_volume: numeric('total_pt_volume', { precision: 78, scale: 0 }),
  total_fees: numeric('total_fees', { precision: 78, scale: 0 }),
  swap_count: bigint('swap_count', { mode: 'number' }),
  unique_swappers: bigint('unique_swappers', { mode: 'number' }),
  total_py_minted: numeric('total_py_minted', { precision: 78, scale: 0 }),
  mint_count: bigint('mint_count', { mode: 'number' }),
  unique_minters: bigint('unique_minters', { mode: 'number' }),
  total_lp_minted: numeric('total_lp_minted', { precision: 78, scale: 0 }),
  lp_mint_count: bigint('lp_mint_count', { mode: 'number' }),
  total_lp_burned: numeric('total_lp_burned', { precision: 78, scale: 0 }),
  lp_burn_count: bigint('lp_burn_count', { mode: 'number' }),
  total_interest_claimed: numeric('total_interest_claimed', { precision: 78, scale: 0 }),
  interest_claim_count: bigint('interest_claim_count', { mode: 'number' }),
  unique_claimers: bigint('unique_claimers', { mode: 'number' }),
  unique_users: bigint('unique_users', { mode: 'number' }),
}).existing();

export const marketCurrentState = pgView('market_current_state', {
  market: text('market'),
  expiry: bigint('expiry', { mode: 'number' }),
  sy: text('sy'),
  pt: text('pt'),
  yt: text('yt'),
  underlying: text('underlying'),
  underlying_symbol: text('underlying_symbol'),
  fee_rate: numeric('fee_rate', { precision: 78, scale: 0 }),
  initial_exchange_rate: numeric('initial_exchange_rate', { precision: 78, scale: 0 }),
  created_at: timestamp('created_at'),
  sy_reserve: numeric('sy_reserve', { precision: 78, scale: 0 }),
  pt_reserve: numeric('pt_reserve', { precision: 78, scale: 0 }),
  total_lp: numeric('total_lp', { precision: 78, scale: 0 }),
  implied_rate: numeric('implied_rate', { precision: 78, scale: 0 }),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }),
  last_activity: timestamp('last_activity'),
  is_expired: boolean('is_expired'),
  sy_volume_24h: numeric('sy_volume_24h', { precision: 78, scale: 0 }),
  pt_volume_24h: numeric('pt_volume_24h', { precision: 78, scale: 0 }),
  fees_24h: numeric('fees_24h', { precision: 78, scale: 0 }),
  swaps_24h: bigint('swaps_24h', { mode: 'number' }),
}).existing();

export const userTradingStats = pgView('user_trading_stats', {
  user_address: text('user_address'),
  total_swaps: bigint('total_swaps', { mode: 'number' }),
  markets_traded: bigint('markets_traded', { mode: 'number' }),
  total_sy_volume: numeric('total_sy_volume', { precision: 78, scale: 0 }),
  total_pt_volume: numeric('total_pt_volume', { precision: 78, scale: 0 }),
  total_fees_paid: numeric('total_fees_paid', { precision: 78, scale: 0 }),
  first_swap: timestamp('first_swap'),
  last_swap: timestamp('last_swap'),
  active_days: bigint('active_days', { mode: 'number' }),
}).existing();

export const rateHistory = pgView('rate_history', {
  market: text('market'),
  block_timestamp: timestamp('block_timestamp'),
  block_number: bigint('block_number', { mode: 'number' }),
  implied_rate_before: numeric('implied_rate_before', { precision: 78, scale: 0 }),
  implied_rate_after: numeric('implied_rate_after', { precision: 78, scale: 0 }),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }),
  time_to_expiry: bigint('time_to_expiry', { mode: 'number' }),
  sy_reserve: numeric('sy_reserve', { precision: 78, scale: 0 }),
  pt_reserve: numeric('pt_reserve', { precision: 78, scale: 0 }),
  total_lp: numeric('total_lp', { precision: 78, scale: 0 }),
}).existing();

export const oracleRateHistory = pgView('oracle_rate_history', {
  sy: text('sy'),
  block_timestamp: timestamp('block_timestamp'),
  block_number: bigint('block_number', { mode: 'number' }),
  old_rate: numeric('old_rate', { precision: 78, scale: 0 }),
  new_rate: numeric('new_rate', { precision: 78, scale: 0 }),
  rate_change_bps: numeric('rate_change_bps', { precision: 78, scale: 0 }),
}).existing();

// ============================================================
// PHASE 4: SY MONITORING TABLES (5 tables)
// ============================================================

// Negative Yield Detection (monitoring)
export const syNegativeYieldDetected = pgTable('sy_negative_yield_detected', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  sy: text('sy').notNull(),
  underlying: text('underlying').notNull(),
  watermark_rate: numeric('watermark_rate', { precision: 78, scale: 0 }).notNull(),
  current_rate: numeric('current_rate', { precision: 78, scale: 0 }).notNull(),
  rate_drop_bps: numeric('rate_drop_bps', { precision: 78, scale: 0 }).notNull(),
  event_timestamp: bigint('event_timestamp', { mode: 'number' }).notNull(),
});

// Pause State Tracking
export const syPauseState = pgTable('sy_pause_state', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  sy: text('sy').notNull(),
  account: text('account').notNull(),
  is_paused: boolean('is_paused').notNull(),
});

// Rewards Claimed (SYWithRewards)
export const syRewardsClaimed = pgTable('sy_rewards_claimed', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  user: text('user').notNull(),
  reward_token: text('reward_token').notNull(),
  sy: text('sy').notNull(),
  amount: numeric('amount', { precision: 78, scale: 0 }).notNull(),
  event_timestamp: bigint('event_timestamp', { mode: 'number' }).notNull(),
});

// Reward Index Updated (for APY calculation)
export const syRewardIndexUpdated = pgTable('sy_reward_index_updated', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  reward_token: text('reward_token').notNull(),
  sy: text('sy').notNull(),
  old_index: numeric('old_index', { precision: 78, scale: 0 }).notNull(),
  new_index: numeric('new_index', { precision: 78, scale: 0 }).notNull(),
  rewards_added: numeric('rewards_added', { precision: 78, scale: 0 }).notNull(),
  total_supply: numeric('total_supply', { precision: 78, scale: 0 }).notNull(),
  event_timestamp: bigint('event_timestamp', { mode: 'number' }).notNull(),
});

// Reward Token Added (registry)
export const syRewardTokenAdded = pgTable('sy_reward_token_added', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  reward_token: text('reward_token').notNull(),
  sy: text('sy').notNull(),
  token_index: bigint('token_index', { mode: 'number' }).notNull(),
  event_timestamp: bigint('event_timestamp', { mode: 'number' }).notNull(),
});

// ============================================================
// PHASE 4: SY MONITORING VIEWS (4 views)
// ============================================================

// User Reward History View
export const userRewardHistory = pgView('user_reward_history', {
  user: text('user'),
  sy: text('sy'),
  reward_token: text('reward_token'),
  total_claimed: numeric('total_claimed', { precision: 78, scale: 0 }),
  claim_count: bigint('claim_count', { mode: 'number' }),
  last_claim_timestamp: timestamp('last_claim_timestamp'),
}).existing();

// SY Current Pause State View
export const syCurrentPauseState = pgView('sy_current_pause_state', {
  sy: text('sy'),
  is_paused: boolean('is_paused'),
  last_updated_at: timestamp('last_updated_at'),
  last_updated_by: text('last_updated_by'),
}).existing();

// Negative Yield Alerts View
export const negativeYieldAlerts = pgView('negative_yield_alerts', {
  sy: text('sy'),
  underlying: text('underlying'),
  event_count: bigint('event_count', { mode: 'number' }),
  max_drop_bps: numeric('max_drop_bps', { precision: 78, scale: 0 }),
  last_detected_at: timestamp('last_detected_at'),
}).existing();

// SY Reward APY View
export const syRewardApy = pgView('sy_reward_apy', {
  sy: text('sy'),
  reward_token: text('reward_token'),
  rewards_last_7_days: numeric('rewards_last_7_days', { precision: 78, scale: 0 }),
  avg_total_supply: numeric('avg_total_supply', { precision: 78, scale: 0 }),
  update_count: bigint('update_count', { mode: 'number' }),
}).existing();

// ============================================================
// PHASE 5: YT INTEREST SYSTEM TABLES (7 tables)
// ============================================================

// PostExpiryDataSet: emitted once when post-expiry data is initialized
export const ytPostExpiryDataSet = pgTable('yt_post_expiry_data_set', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  yt: text('yt').notNull(),
  pt: text('pt').notNull(),
  sy: text('sy').notNull(),
  expiry: bigint('expiry', { mode: 'number' }).notNull(),
  first_py_index: numeric('first_py_index', { precision: 78, scale: 0 }).notNull(),
  exchange_rate_at_init: numeric('exchange_rate_at_init', { precision: 78, scale: 0 }).notNull(),
  total_pt_supply: numeric('total_pt_supply', { precision: 78, scale: 0 }).notNull(),
  total_yt_supply: numeric('total_yt_supply', { precision: 78, scale: 0 }).notNull(),
});

// PyIndexUpdated: emitted when PY index changes
export const ytPyIndexUpdated = pgTable('yt_py_index_updated', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  yt: text('yt').notNull(),
  old_index: numeric('old_index', { precision: 78, scale: 0 }).notNull(),
  new_index: numeric('new_index', { precision: 78, scale: 0 }).notNull(),
  exchange_rate: numeric('exchange_rate', { precision: 78, scale: 0 }).notNull(),
  index_block_number: bigint('index_block_number', { mode: 'number' }).notNull(),
});

// TreasuryInterestRedeemed: admin claims post-expiry yield
export const ytTreasuryInterestRedeemed = pgTable('yt_treasury_interest_redeemed', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  yt: text('yt').notNull(),
  treasury: text('treasury').notNull(),
  amount_sy: numeric('amount_sy', { precision: 78, scale: 0 }).notNull(),
  sy: text('sy').notNull(),
  expiry_index: numeric('expiry_index', { precision: 78, scale: 0 }).notNull(),
  current_index: numeric('current_index', { precision: 78, scale: 0 }).notNull(),
  total_yt_supply: numeric('total_yt_supply', { precision: 78, scale: 0 }).notNull(),
});

// InterestFeeRateSet: admin changes fee rate
export const ytInterestFeeRateSet = pgTable('yt_interest_fee_rate_set', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  yt: text('yt').notNull(),
  old_rate: numeric('old_rate', { precision: 78, scale: 0 }).notNull(),
  new_rate: numeric('new_rate', { precision: 78, scale: 0 }).notNull(),
});

// MintPYMulti: batch minting
export const ytMintPYMulti = pgTable('yt_mint_py_multi', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  caller: text('caller').notNull(),
  expiry: bigint('expiry', { mode: 'number' }).notNull(),
  yt: text('yt').notNull(),
  total_sy_deposited: numeric('total_sy_deposited', { precision: 78, scale: 0 }).notNull(),
  total_py_minted: numeric('total_py_minted', { precision: 78, scale: 0 }).notNull(),
  receiver_count: bigint('receiver_count', { mode: 'number' }).notNull(),
});

// RedeemPYMulti: batch redemption
export const ytRedeemPYMulti = pgTable('yt_redeem_py_multi', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  caller: text('caller').notNull(),
  expiry: bigint('expiry', { mode: 'number' }).notNull(),
  yt: text('yt').notNull(),
  total_py_redeemed: numeric('total_py_redeemed', { precision: 78, scale: 0 }).notNull(),
  total_sy_returned: numeric('total_sy_returned', { precision: 78, scale: 0 }).notNull(),
  receiver_count: bigint('receiver_count', { mode: 'number' }).notNull(),
});

// RedeemPYWithInterest: combined redeem + claim
export const ytRedeemPYWithInterest = pgTable('yt_redeem_py_with_interest', {
  _id: uuid('_id').primaryKey(),
  block_number: bigint('block_number', { mode: 'number' }).notNull(),
  block_timestamp: timestamp('block_timestamp').notNull(),
  transaction_hash: text('transaction_hash').notNull(),
  caller: text('caller').notNull(),
  receiver: text('receiver').notNull(),
  expiry: bigint('expiry', { mode: 'number' }).notNull(),
  yt: text('yt').notNull(),
  amount_py_redeemed: numeric('amount_py_redeemed', { precision: 78, scale: 0 }).notNull(),
  amount_sy_from_redeem: numeric('amount_sy_from_redeem', { precision: 78, scale: 0 }).notNull(),
  amount_interest_claimed: numeric('amount_interest_claimed', {
    precision: 78,
    scale: 0,
  }).notNull(),
});

// ============================================================
// PHASE 5: YT INTEREST SYSTEM VIEWS (4 views)
// ============================================================

// Tracks current fee rate per YT and rate change history
export const ytFeeAnalytics = pgView('yt_fee_analytics', {
  yt: text('yt'),
  current_fee_rate: numeric('current_fee_rate', { precision: 78, scale: 0 }),
  rate_change_count: bigint('rate_change_count', { mode: 'number' }),
  last_change: timestamp('last_change'),
}).existing();

// Aggregates total treasury claims per YT
export const treasuryYieldSummary = pgView('treasury_yield_summary', {
  yt: text('yt'),
  treasury: text('treasury'),
  total_sy_claimed: numeric('total_sy_claimed', { precision: 78, scale: 0 }),
  claim_count: bigint('claim_count', { mode: 'number' }),
  last_claim: timestamp('last_claim'),
}).existing();

// Aggregates batch mint/redeem activity per caller
export const batchOperationsSummary = pgView('batch_operations_summary', {
  caller: text('caller'),
  total_batch_minted_sy: numeric('total_batch_minted_sy', { precision: 78, scale: 0 }),
  total_batch_minted_py: numeric('total_batch_minted_py', { precision: 78, scale: 0 }),
  total_batch_redeemed_sy: numeric('total_batch_redeemed_sy', { precision: 78, scale: 0 }),
  total_receivers_served: bigint('total_receivers_served', { mode: 'number' }),
  batch_operation_count: bigint('batch_operation_count', { mode: 'number' }),
}).existing();

// Tracks redemptions that also claimed interest
export const redeemWithInterestAnalytics = pgView('redeem_with_interest_analytics', {
  yt: text('yt'),
  caller: text('caller'),
  receiver: text('receiver'),
  expiry: bigint('expiry', { mode: 'number' }),
  amount_py_redeemed: numeric('amount_py_redeemed', { precision: 78, scale: 0 }),
  amount_sy_from_redeem: numeric('amount_sy_from_redeem', { precision: 78, scale: 0 }),
  amount_interest_claimed: numeric('amount_interest_claimed', { precision: 78, scale: 0 }),
  block_timestamp: timestamp('block_timestamp'),
  interest_percentage: numeric('interest_percentage', { precision: 78, scale: 0 }),
}).existing();
