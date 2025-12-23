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
