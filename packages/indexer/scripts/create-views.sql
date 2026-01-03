-- Create materialized views for Horizon Protocol indexer
-- Run this after the base tables are created by Drizzle migrations

-- Drop existing views first to allow schema changes
DROP MATERIALIZED VIEW IF EXISTS market_current_state CASCADE;
DROP MATERIALIZED VIEW IF EXISTS protocol_daily_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS user_trading_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS rate_history CASCADE;
DROP MATERIALIZED VIEW IF EXISTS oracle_rate_history CASCADE;
DROP MATERIALIZED VIEW IF EXISTS market_daily_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS market_hourly_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS user_py_positions CASCADE;
DROP MATERIALIZED VIEW IF EXISTS market_lp_positions CASCADE;

-- Drop YT Interest analytics views (Phase 5)
DROP MATERIALIZED VIEW IF EXISTS yt_fee_analytics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS treasury_yield_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS batch_operations_summary CASCADE;
DROP VIEW IF EXISTS redeem_with_interest_analytics CASCADE;

-- Drop enriched router views
DROP VIEW IF EXISTS enriched_router_swap CASCADE;
DROP VIEW IF EXISTS enriched_router_swap_yt CASCADE;
DROP VIEW IF EXISTS enriched_router_add_liquidity CASCADE;
DROP VIEW IF EXISTS enriched_router_remove_liquidity CASCADE;
DROP VIEW IF EXISTS enriched_router_mint_py CASCADE;
DROP VIEW IF EXISTS enriched_router_redeem_py CASCADE;

-- ============================================================================
-- MARKET CURRENT STATE
-- Latest state for each market (for listings, dashboard)
-- Uses router events as fallback when market events aren't available
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS market_current_state AS
WITH market_info AS (
  SELECT
    m.market,
    m.sy,
    m.pt,
    m.expiry,
    m.ln_fee_rate_root,
    m.initial_exchange_rate,
    m.block_timestamp as created_at,
    y.yt,
    y.underlying,
    y.underlying_symbol
  FROM market_factory_market_created m
  LEFT JOIN factory_yield_contracts_created y ON m.sy = y.sy AND m.pt = y.pt
),
-- Primary source: market_swap events (if market indexer is running)
latest_swap AS (
  SELECT DISTINCT ON (market)
    market,
    implied_rate_after as implied_rate,
    exchange_rate,
    sy_reserve_after as sy_reserve,
    pt_reserve_after as pt_reserve,
    block_timestamp as last_activity
  FROM market_swap
  ORDER BY market, block_number DESC
),
latest_mint AS (
  SELECT DISTINCT ON (market)
    market,
    sy_reserve_after as sy_reserve,
    pt_reserve_after as pt_reserve,
    implied_rate,
    block_timestamp as last_activity
  FROM market_mint
  ORDER BY market, block_number DESC
),
latest_implied_rate AS (
  SELECT DISTINCT ON (market)
    market,
    sy_reserve,
    pt_reserve,
    total_lp,
    new_rate as implied_rate,
    exchange_rate,
    block_timestamp as last_activity
  FROM market_implied_rate_updated
  ORDER BY market, block_number DESC
),
-- Fallback: Calculate reserves from router liquidity events
router_liquidity_totals AS (
  SELECT
    market,
    COALESCE(SUM(sy_used), 0) as total_sy_added,
    COALESCE(SUM(pt_used), 0) as total_pt_added,
    COALESCE(SUM(lp_out), 0) as total_lp_minted,
    MAX(block_timestamp) as last_add
  FROM router_add_liquidity
  GROUP BY market
),
router_liquidity_removed AS (
  SELECT
    market,
    COALESCE(SUM(sy_out), 0) as total_sy_removed,
    COALESCE(SUM(pt_out), 0) as total_pt_removed,
    COALESCE(SUM(lp_in), 0) as total_lp_burned,
    MAX(block_timestamp) as last_remove
  FROM router_remove_liquidity
  GROUP BY market
),
router_reserves AS (
  SELECT
    COALESCE(a.market, r.market) as market,
    COALESCE(a.total_sy_added, 0) - COALESCE(r.total_sy_removed, 0) as sy_reserve,
    COALESCE(a.total_pt_added, 0) - COALESCE(r.total_pt_removed, 0) as pt_reserve,
    COALESCE(a.total_lp_minted, 0) - COALESCE(r.total_lp_burned, 0) as total_lp,
    GREATEST(a.last_add, r.last_remove) as last_activity
  FROM router_liquidity_totals a
  FULL OUTER JOIN router_liquidity_removed r ON a.market = r.market
),
-- Volume from market_swap (if available)
volume_24h_market AS (
  SELECT
    market,
    COALESCE(SUM(sy_in), 0) + COALESCE(SUM(sy_out), 0) as sy_volume_24h,
    COALESCE(SUM(pt_in), 0) + COALESCE(SUM(pt_out), 0) as pt_volume_24h,
    COALESCE(SUM(total_fee), 0) as fees_24h,
    COALESCE(SUM(lp_fee), 0) as lp_fees_24h,
    COALESCE(SUM(reserve_fee), 0) as reserve_fees_24h,
    COUNT(*) as swaps_24h
  FROM market_swap
  WHERE block_timestamp >= NOW() - INTERVAL '24 hours'
  GROUP BY market
),
-- Fallback: Volume from router_swap (always available)
volume_24h_router AS (
  SELECT
    market,
    COALESCE(SUM(sy_in), 0) + COALESCE(SUM(sy_out), 0) as sy_volume_24h,
    COALESCE(SUM(pt_in), 0) + COALESCE(SUM(pt_out), 0) as pt_volume_24h,
    COUNT(*) as swaps_24h
  FROM router_swap
  WHERE block_timestamp >= NOW() - INTERVAL '24 hours'
  GROUP BY market
),
-- YT swap volume (router only)
volume_24h_router_yt AS (
  SELECT
    market,
    COALESCE(SUM(sy_in), 0) + COALESCE(SUM(sy_out), 0) as sy_volume_24h,
    COUNT(*) as swaps_24h
  FROM router_swap_yt
  WHERE block_timestamp >= NOW() - INTERVAL '24 hours'
  GROUP BY market
)
SELECT
  mi.market,
  mi.expiry,
  mi.sy,
  mi.pt,
  mi.yt,
  mi.underlying,
  mi.underlying_symbol,
  mi.ln_fee_rate_root,
  mi.initial_exchange_rate,
  mi.created_at,
  -- Reserves: prioritize swap/mint (correct parsing), then implied_rate, then router
  -- Note: implied_rate table had incorrect parsing before indexer fix - use as fallback
  COALESCE(ls.sy_reserve, lm.sy_reserve, lir.sy_reserve, rr.sy_reserve, 0) as sy_reserve,
  COALESCE(ls.pt_reserve, lm.pt_reserve, lir.pt_reserve, rr.pt_reserve, 0) as pt_reserve,
  COALESCE(lir.total_lp, rr.total_lp, 0) as total_lp,
  COALESCE(ls.implied_rate, lir.implied_rate, lm.implied_rate, 0) as implied_rate,
  COALESCE(ls.exchange_rate, lir.exchange_rate, mi.initial_exchange_rate) as exchange_rate,
  GREATEST(ls.last_activity, lm.last_activity, lir.last_activity, rr.last_activity, mi.created_at) as last_activity,
  (mi.expiry <= EXTRACT(EPOCH FROM NOW())) as is_expired,
  -- Volume: prefer market events, fallback to router
  COALESCE(vm.sy_volume_24h, vr.sy_volume_24h, 0) + COALESCE(vry.sy_volume_24h, 0) as sy_volume_24h,
  COALESCE(vm.pt_volume_24h, vr.pt_volume_24h, 0) as pt_volume_24h,
  COALESCE(vm.sy_volume_24h, vr.sy_volume_24h, 0) + COALESCE(vry.sy_volume_24h, 0) + COALESCE(vm.pt_volume_24h, vr.pt_volume_24h, 0) as volume_24h,
  -- Fees: use market fees if available, else estimate from volume * ln_fee_rate_root
  COALESCE(
    vm.fees_24h,
    ((COALESCE(vr.sy_volume_24h, 0) + COALESCE(vry.sy_volume_24h, 0)) * mi.ln_fee_rate_root / 1000000000000000000)
  ) as fees_24h,
  COALESCE(vm.swaps_24h, vr.swaps_24h, 0) + COALESCE(vry.swaps_24h, 0) as swaps_24h
FROM market_info mi
LEFT JOIN latest_swap ls ON mi.market = ls.market
LEFT JOIN latest_mint lm ON mi.market = lm.market
LEFT JOIN latest_implied_rate lir ON mi.market = lir.market
LEFT JOIN router_reserves rr ON mi.market = rr.market
LEFT JOIN volume_24h_market vm ON mi.market = vm.market
LEFT JOIN volume_24h_router vr ON mi.market = vr.market
LEFT JOIN volume_24h_router_yt vry ON mi.market = vry.market;

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_current_state_market
  ON market_current_state(market);

-- ============================================================================
-- PROTOCOL DAILY STATS
-- Protocol-wide daily metrics (for dashboard, analytics)
-- Uses router events as primary source for volume/swaps
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS protocol_daily_stats AS
WITH -- Market swap stats (if market indexer is running)
market_swap_stats AS (
  SELECT
    DATE_TRUNC('day', block_timestamp) as day,
    COALESCE(SUM(sy_in), 0) + COALESCE(SUM(sy_out), 0) as total_sy_volume,
    COALESCE(SUM(pt_in), 0) + COALESCE(SUM(pt_out), 0) as total_pt_volume,
    COALESCE(SUM(total_fee), 0) as total_fees,
    COALESCE(SUM(lp_fee), 0) as total_lp_fees,
    COALESCE(SUM(reserve_fee), 0) as total_reserve_fees,
    COUNT(*) as swap_count,
    COUNT(DISTINCT sender) as unique_swappers
  FROM market_swap
  GROUP BY DATE_TRUNC('day', block_timestamp)
),
-- Router PT swap stats (always available)
router_swap_stats AS (
  SELECT
    DATE_TRUNC('day', block_timestamp) as day,
    COALESCE(SUM(sy_in), 0) + COALESCE(SUM(sy_out), 0) as total_sy_volume,
    COALESCE(SUM(pt_in), 0) + COALESCE(SUM(pt_out), 0) as total_pt_volume,
    COUNT(*) as swap_count,
    COUNT(DISTINCT sender) as unique_swappers
  FROM router_swap
  GROUP BY DATE_TRUNC('day', block_timestamp)
),
-- Router YT swap stats
router_swap_yt_stats AS (
  SELECT
    DATE_TRUNC('day', block_timestamp) as day,
    COALESCE(SUM(sy_in), 0) + COALESCE(SUM(sy_out), 0) as total_sy_volume,
    COUNT(*) as swap_count,
    COUNT(DISTINCT sender) as unique_swappers
  FROM router_swap_yt
  GROUP BY DATE_TRUNC('day', block_timestamp)
),
-- Combined swap stats: prefer market_swap, fallback to router
swap_stats AS (
  SELECT
    COALESCE(ms.day, rs.day, rsy.day) as day,
    COALESCE(ms.total_sy_volume, rs.total_sy_volume, 0) + COALESCE(rsy.total_sy_volume, 0) as total_sy_volume,
    COALESCE(ms.total_pt_volume, rs.total_pt_volume, 0) as total_pt_volume,
    COALESCE(ms.total_fees, 0) as total_fees,
    COALESCE(ms.total_lp_fees, 0) as total_lp_fees,
    COALESCE(ms.total_reserve_fees, 0) as total_reserve_fees,
    COALESCE(ms.swap_count, rs.swap_count, 0) + COALESCE(rsy.swap_count, 0) as swap_count,
    GREATEST(COALESCE(ms.unique_swappers, rs.unique_swappers, 0), COALESCE(rsy.unique_swappers, 0)) as unique_swappers
  FROM market_swap_stats ms
  FULL OUTER JOIN router_swap_stats rs ON ms.day = rs.day
  FULL OUTER JOIN router_swap_yt_stats rsy ON COALESCE(ms.day, rs.day) = rsy.day
),
mint_stats AS (
  SELECT
    DATE_TRUNC('day', block_timestamp) as day,
    COALESCE(SUM(sy_in), 0) as total_py_minted,
    COUNT(*) as mint_count,
    COUNT(DISTINCT receiver) as unique_minters
  FROM router_mint_py
  GROUP BY DATE_TRUNC('day', block_timestamp)
),
lp_mint_stats AS (
  SELECT
    DATE_TRUNC('day', block_timestamp) as day,
    COALESCE(SUM(lp_out), 0) as total_lp_minted,
    COUNT(*) as lp_mint_count
  FROM router_add_liquidity
  GROUP BY DATE_TRUNC('day', block_timestamp)
),
lp_burn_stats AS (
  SELECT
    DATE_TRUNC('day', block_timestamp) as day,
    COALESCE(SUM(lp_in), 0) as total_lp_burned,
    COUNT(*) as lp_burn_count
  FROM router_remove_liquidity
  GROUP BY DATE_TRUNC('day', block_timestamp)
),
interest_stats AS (
  SELECT
    DATE_TRUNC('day', block_timestamp) as day,
    COALESCE(SUM(amount_sy), 0) as total_interest_claimed,
    COUNT(*) as interest_claim_count,
    COUNT(DISTINCT "user") as unique_claimers
  FROM yt_interest_claimed
  GROUP BY DATE_TRUNC('day', block_timestamp)
),
all_days AS (
  SELECT day FROM swap_stats WHERE day IS NOT NULL
  UNION SELECT day FROM mint_stats
  UNION SELECT day FROM lp_mint_stats
  UNION SELECT day FROM lp_burn_stats
  UNION SELECT day FROM interest_stats
),
unique_users_per_day AS (
  SELECT day, COUNT(DISTINCT user_addr) as unique_users FROM (
    SELECT DATE_TRUNC('day', block_timestamp) as day, sender as user_addr FROM router_swap
    UNION ALL
    SELECT DATE_TRUNC('day', block_timestamp), sender FROM router_swap_yt
    UNION ALL
    SELECT DATE_TRUNC('day', block_timestamp), receiver FROM router_mint_py
    UNION ALL
    SELECT DATE_TRUNC('day', block_timestamp), receiver FROM router_add_liquidity
    UNION ALL
    SELECT DATE_TRUNC('day', block_timestamp), "user" FROM yt_interest_claimed
  ) all_users
  GROUP BY day
)
SELECT
  d.day,
  COALESCE(s.total_sy_volume, 0) as total_sy_volume,
  COALESCE(s.total_pt_volume, 0) as total_pt_volume,
  COALESCE(s.total_fees, 0) as total_fees,
  COALESCE(s.total_lp_fees, 0) as total_lp_fees,
  COALESCE(s.total_reserve_fees, 0) as total_reserve_fees,
  COALESCE(s.swap_count, 0) as swap_count,
  COALESCE(s.unique_swappers, 0) as unique_swappers,
  COALESCE(m.total_py_minted, 0) as total_py_minted,
  COALESCE(m.mint_count, 0) as mint_count,
  COALESCE(m.unique_minters, 0) as unique_minters,
  COALESCE(lm.total_lp_minted, 0) as total_lp_minted,
  COALESCE(lm.lp_mint_count, 0) as lp_mint_count,
  COALESCE(lb.total_lp_burned, 0) as total_lp_burned,
  COALESCE(lb.lp_burn_count, 0) as lp_burn_count,
  COALESCE(i.total_interest_claimed, 0) as total_interest_claimed,
  COALESCE(i.interest_claim_count, 0) as interest_claim_count,
  COALESCE(i.unique_claimers, 0) as unique_claimers,
  COALESCE(u.unique_users, 0) as unique_users
FROM all_days d
LEFT JOIN swap_stats s ON d.day = s.day
LEFT JOIN mint_stats m ON d.day = m.day
LEFT JOIN lp_mint_stats lm ON d.day = lm.day
LEFT JOIN lp_burn_stats lb ON d.day = lb.day
LEFT JOIN interest_stats i ON d.day = i.day
LEFT JOIN unique_users_per_day u ON d.day = u.day
ORDER BY d.day DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_protocol_daily_stats_day
  ON protocol_daily_stats(day);

-- ============================================================================
-- USER TRADING STATS
-- For leaderboards
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS user_trading_stats AS
SELECT
  sender as user_address,
  COUNT(*) as total_swaps,
  COUNT(DISTINCT market) as markets_traded,
  COALESCE(SUM(sy_in), 0) + COALESCE(SUM(sy_out), 0) as total_sy_volume,
  COALESCE(SUM(pt_in), 0) + COALESCE(SUM(pt_out), 0) as total_pt_volume,
  COALESCE(SUM(total_fee), 0) as total_fees_paid,
  COALESCE(SUM(lp_fee), 0) as total_lp_fees_paid,
  COALESCE(SUM(reserve_fee), 0) as total_reserve_fees_paid,
  MIN(block_timestamp) as first_swap,
  MAX(block_timestamp) as last_swap,
  COUNT(DISTINCT DATE_TRUNC('day', block_timestamp)) as active_days
FROM market_swap
GROUP BY sender;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_trading_stats_user
  ON user_trading_stats(user_address);

-- ============================================================================
-- RATE HISTORY
-- Implied rate history for charts (from market_implied_rate_updated)
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS rate_history AS
SELECT
  iru.market,
  iru.block_timestamp,
  iru.block_number,
  iru.old_rate as implied_rate_before,
  iru.new_rate as implied_rate_after,
  iru.exchange_rate,
  iru.time_to_expiry,
  iru.sy_reserve,
  iru.pt_reserve,
  iru.total_lp
FROM market_implied_rate_updated iru
ORDER BY market, block_number;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_history_market_block
  ON rate_history(market, block_number);

-- ============================================================================
-- ORACLE RATE HISTORY
-- SY exchange rate changes
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS oracle_rate_history AS
SELECT
  sy,
  block_timestamp,
  block_number,
  old_rate,
  new_rate,
  CASE
    WHEN old_rate > 0 THEN ((new_rate - old_rate) * 10000 / old_rate)
    ELSE 0
  END as rate_change_bps
FROM sy_oracle_rate_updated
ORDER BY sy, block_number;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_oracle_rate_history_sy_block
  ON oracle_rate_history(sy, block_number);

-- ============================================================================
-- MARKET DAILY STATS
-- Per-market daily aggregates
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS market_daily_stats AS
SELECT
  ms.market,
  mc.expiry,
  DATE_TRUNC('day', ms.block_timestamp) as day,
  MIN(ms.implied_rate_before) as min_implied_rate,
  MAX(ms.implied_rate_after) as max_implied_rate,
  -- Use last value as close
  (ARRAY_AGG(ms.implied_rate_after ORDER BY ms.block_number DESC))[1] as close_implied_rate,
  (ARRAY_AGG(ms.exchange_rate ORDER BY ms.block_number DESC))[1] as exchange_rate,
  COALESCE(SUM(ms.sy_in), 0) + COALESCE(SUM(ms.sy_out), 0) as sy_volume,
  COALESCE(SUM(ms.pt_in), 0) + COALESCE(SUM(ms.pt_out), 0) as pt_volume,
  COALESCE(SUM(ms.total_fee), 0) as total_fees,
  COALESCE(SUM(ms.lp_fee), 0) as lp_fees,
  COALESCE(SUM(ms.reserve_fee), 0) as reserve_fees,
  COUNT(*) as swap_count,
  COUNT(DISTINCT ms.sender) as unique_traders
FROM market_swap ms
LEFT JOIN market_factory_market_created mc ON ms.market = mc.market
GROUP BY ms.market, mc.expiry, DATE_TRUNC('day', ms.block_timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_daily_stats_market_day
  ON market_daily_stats(market, day);

-- ============================================================================
-- MARKET HOURLY STATS
-- Per-market hourly aggregates (for recent activity)
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS market_hourly_stats AS
SELECT
  ms.market,
  mc.expiry,
  DATE_TRUNC('hour', ms.block_timestamp) as hour,
  MIN(ms.implied_rate_before) as min_implied_rate,
  MAX(ms.implied_rate_after) as max_implied_rate,
  (ARRAY_AGG(ms.implied_rate_after ORDER BY ms.block_number DESC))[1] as close_implied_rate,
  (ARRAY_AGG(ms.exchange_rate ORDER BY ms.block_number DESC))[1] as exchange_rate,
  COALESCE(SUM(ms.sy_in), 0) + COALESCE(SUM(ms.sy_out), 0) as sy_volume,
  COALESCE(SUM(ms.pt_in), 0) + COALESCE(SUM(ms.pt_out), 0) as pt_volume,
  COALESCE(SUM(ms.total_fee), 0) as total_fees,
  COALESCE(SUM(ms.lp_fee), 0) as lp_fees,
  COALESCE(SUM(ms.reserve_fee), 0) as reserve_fees,
  COUNT(*) as swap_count
FROM market_swap ms
LEFT JOIN market_factory_market_created mc ON ms.market = mc.market
WHERE ms.block_timestamp >= NOW() - INTERVAL '7 days'
GROUP BY ms.market, mc.expiry, DATE_TRUNC('hour', ms.block_timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_hourly_stats_market_hour
  ON market_hourly_stats(market, hour);

-- ============================================================================
-- USER PY POSITIONS
-- User PT/YT holdings
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS user_py_positions AS
WITH mints AS (
  SELECT
    m.receiver as user_address,
    m.yt,
    y.sy,
    y.pt,
    SUM(m.pt_out) as total_pt_minted,
    SUM(m.yt_out) as total_yt_minted,
    MIN(m.block_timestamp) as first_mint,
    MAX(m.block_timestamp) as last_activity,
    COUNT(*) as mint_count
  FROM router_mint_py m
  LEFT JOIN factory_yield_contracts_created y ON m.yt = y.yt
  GROUP BY m.receiver, m.yt, y.sy, y.pt
),
redeems AS (
  SELECT
    receiver as user_address,
    yt,
    SUM(py_in) as total_pt_redeemed,
    SUM(py_in) as total_yt_redeemed,
    COUNT(*) as redeem_count
  FROM router_redeem_py
  GROUP BY receiver, yt
),
claims AS (
  SELECT
    "user" as user_address,
    yt,
    SUM(amount_sy) as total_interest_claimed,
    COUNT(*) as claim_count
  FROM yt_interest_claimed
  GROUP BY "user", yt
)
SELECT
  m.user_address,
  m.yt,
  m.sy,
  m.pt,
  m.total_pt_minted - COALESCE(r.total_pt_redeemed, 0) as pt_balance,
  m.total_yt_minted - COALESCE(r.total_yt_redeemed, 0) as yt_balance,
  COALESCE(c.total_interest_claimed, 0) as total_interest_claimed,
  m.first_mint,
  GREATEST(m.last_activity,
    (SELECT MAX(block_timestamp) FROM router_redeem_py WHERE receiver = m.user_address AND yt = m.yt),
    (SELECT MAX(block_timestamp) FROM yt_interest_claimed WHERE "user" = m.user_address AND yt = m.yt)
  ) as last_activity,
  m.mint_count,
  COALESCE(r.redeem_count, 0) as redeem_count,
  COALESCE(c.claim_count, 0) as claim_count
FROM mints m
LEFT JOIN redeems r ON m.user_address = r.user_address AND m.yt = r.yt
LEFT JOIN claims c ON m.user_address = c.user_address AND m.yt = c.yt;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_py_positions_user_yt
  ON user_py_positions(user_address, yt);

-- ============================================================================
-- MARKET LP POSITIONS
-- User LP positions per market
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS market_lp_positions AS
WITH adds AS (
  SELECT
    receiver as user_address,
    market,
    SUM(lp_out) as total_lp_added,
    SUM(sy_used) as total_sy_added,
    SUM(pt_used) as total_pt_added,
    MIN(block_timestamp) as first_mint,
    MAX(block_timestamp) as last_activity,
    COUNT(*) as mint_count
  FROM router_add_liquidity
  GROUP BY receiver, market
),
removes AS (
  SELECT
    receiver as user_address,
    market,
    SUM(lp_in) as total_lp_removed,
    SUM(sy_out) as total_sy_removed,
    SUM(pt_out) as total_pt_removed,
    COUNT(*) as burn_count
  FROM router_remove_liquidity
  GROUP BY receiver, market
)
SELECT
  a.user_address,
  a.market,
  a.total_lp_added - COALESCE(r.total_lp_removed, 0) as lp_balance,
  a.total_sy_added as total_sy_deposited,
  a.total_pt_added as total_pt_deposited,
  COALESCE(r.total_sy_removed, 0) as total_sy_withdrawn,
  COALESCE(r.total_pt_removed, 0) as total_pt_withdrawn,
  a.first_mint,
  GREATEST(a.last_activity,
    (SELECT MAX(block_timestamp) FROM router_remove_liquidity WHERE receiver = a.user_address AND market = a.market)
  ) as last_activity,
  a.mint_count,
  COALESCE(r.burn_count, 0) as burn_count
FROM adds a
LEFT JOIN removes r ON a.user_address = r.user_address AND a.market = r.market;

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_lp_positions_user_market
  ON market_lp_positions(user_address, market);

-- ============================================================================
-- YT INTEREST ANALYTICS VIEWS (Phase 5)
-- Views for fee rate tracking, treasury yields, and batch operations
-- ============================================================================

-- YT Fee Analytics
-- Tracks current fee rate per YT and rate change history
CREATE MATERIALIZED VIEW IF NOT EXISTS yt_fee_analytics AS
SELECT
  yt,
  -- Most recent rate (current fee rate)
  (ARRAY_AGG(new_rate ORDER BY block_number DESC))[1] as current_fee_rate,
  -- First rate (initial fee rate)
  (ARRAY_AGG(old_rate ORDER BY block_number ASC))[1] as initial_fee_rate,
  COUNT(*) as rate_change_count,
  MIN(block_timestamp) as first_change,
  MAX(block_timestamp) as last_change,
  -- Rate change trend (positive = increases, negative = decreases)
  SUM(CASE WHEN new_rate > old_rate THEN 1 ELSE -1 END) as net_change_direction
FROM yt_interest_fee_rate_set
GROUP BY yt;

CREATE UNIQUE INDEX IF NOT EXISTS idx_yt_fee_analytics_yt
  ON yt_fee_analytics(yt);

-- Treasury Yield Summary
-- Aggregates total treasury claims per YT
CREATE MATERIALIZED VIEW IF NOT EXISTS treasury_yield_summary AS
SELECT
  yt,
  treasury,
  sy,
  SUM(amount_sy) as total_sy_claimed,
  COUNT(*) as claim_count,
  MIN(block_timestamp) as first_claim,
  MAX(block_timestamp) as last_claim,
  -- Average claim size
  AVG(amount_sy) as avg_claim_size,
  -- Track index progression (latest values)
  (ARRAY_AGG(current_index ORDER BY block_number DESC))[1] as latest_index,
  (ARRAY_AGG(total_yt_supply ORDER BY block_number DESC))[1] as latest_yt_supply
FROM yt_treasury_interest_redeemed
GROUP BY yt, treasury, sy;

CREATE UNIQUE INDEX IF NOT EXISTS idx_treasury_yield_summary_yt_treasury
  ON treasury_yield_summary(yt, treasury);

-- Batch Operations Summary
-- Aggregates batch mint/redeem activity per caller
CREATE MATERIALIZED VIEW IF NOT EXISTS batch_operations_summary AS
WITH batch_mints AS (
  SELECT
    caller,
    yt,
    expiry,
    SUM(total_sy_deposited) as total_batch_minted_sy,
    SUM(total_py_minted) as total_batch_minted_py,
    SUM(receiver_count) as total_mint_receivers,
    COUNT(*) as batch_mint_count,
    MIN(block_timestamp) as first_batch_mint,
    MAX(block_timestamp) as last_batch_mint
  FROM yt_mint_py_multi
  GROUP BY caller, yt, expiry
),
batch_redeems AS (
  SELECT
    caller,
    yt,
    expiry,
    SUM(total_py_redeemed) as total_batch_redeemed_py,
    SUM(total_sy_returned) as total_batch_redeemed_sy,
    SUM(receiver_count) as total_redeem_receivers,
    COUNT(*) as batch_redeem_count,
    MIN(block_timestamp) as first_batch_redeem,
    MAX(block_timestamp) as last_batch_redeem
  FROM yt_redeem_py_multi
  GROUP BY caller, yt, expiry
)
SELECT
  COALESCE(m.caller, r.caller) as caller,
  COALESCE(m.yt, r.yt) as yt,
  COALESCE(m.expiry, r.expiry) as expiry,
  COALESCE(m.total_batch_minted_sy, 0) as total_batch_minted_sy,
  COALESCE(m.total_batch_minted_py, 0) as total_batch_minted_py,
  COALESCE(m.total_mint_receivers, 0) as total_mint_receivers,
  COALESCE(m.batch_mint_count, 0) as batch_mint_count,
  COALESCE(r.total_batch_redeemed_py, 0) as total_batch_redeemed_py,
  COALESCE(r.total_batch_redeemed_sy, 0) as total_batch_redeemed_sy,
  COALESCE(r.total_redeem_receivers, 0) as total_redeem_receivers,
  COALESCE(r.batch_redeem_count, 0) as batch_redeem_count,
  COALESCE(m.batch_mint_count, 0) + COALESCE(r.batch_redeem_count, 0) as total_batch_operations,
  LEAST(m.first_batch_mint, r.first_batch_redeem) as first_batch_operation,
  GREATEST(m.last_batch_mint, r.last_batch_redeem) as last_batch_operation
FROM batch_mints m
FULL OUTER JOIN batch_redeems r
  ON m.caller = r.caller AND m.yt = r.yt AND m.expiry = r.expiry;

CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_operations_summary_caller_yt_expiry
  ON batch_operations_summary(caller, yt, expiry);

-- Redeem With Interest Analytics
-- Regular view for tracking redemptions that also claimed interest
-- Shows interest percentage of total SY received
CREATE OR REPLACE VIEW redeem_with_interest_analytics AS
SELECT
  r._id,
  r.block_number,
  r.block_timestamp,
  r.transaction_hash,
  r.yt,
  r.caller,
  r.receiver,
  r.expiry,
  r.amount_py_redeemed,
  r.amount_sy_from_redeem,
  r.amount_interest_claimed,
  -- Total SY received (redeem + interest)
  (r.amount_sy_from_redeem + r.amount_interest_claimed) as total_sy_received,
  -- Interest as percentage of total (in basis points for precision)
  CASE
    WHEN (r.amount_sy_from_redeem + r.amount_interest_claimed) > 0
    THEN (r.amount_interest_claimed * 10000 / (r.amount_sy_from_redeem + r.amount_interest_claimed))
    ELSE 0
  END as interest_percentage_bps,
  -- Join with factory to get context
  ycc.sy,
  ycc.pt,
  ycc.underlying,
  ycc.underlying_symbol
FROM yt_redeem_py_with_interest r
LEFT JOIN factory_yield_contracts_created ycc ON r.yt = ycc.yt
ORDER BY r.block_timestamp DESC;

-- ============================================================================
-- ENRICHED ROUTER VIEWS (6 views)
-- Regular views that join router events with underlying contract events
-- for transaction history display
-- ============================================================================

-- Enriched Router Swap
-- Joins router_swap with market_swap and market metadata
CREATE OR REPLACE VIEW enriched_router_swap AS
SELECT
  rs._id,
  rs.block_number,
  rs.block_timestamp,
  rs.transaction_hash,
  rs.sender,
  rs.receiver,
  rs.market,
  rs.sy_in,
  rs.pt_in,
  rs.sy_out,
  rs.pt_out,
  -- Enrichment from market_factory_market_created
  mc.expiry,
  mc.sy,
  mc.pt,
  mc.yt,
  mc.underlying,
  mc.underlying_symbol,
  -- Enrichment from market_swap (same transaction)
  ms.exchange_rate,
  ms.implied_rate_before,
  ms.implied_rate_after,
  ms.total_fee,
  ms.lp_fee,
  ms.reserve_fee,
  ms.sy_reserve_after,
  ms.pt_reserve_after
FROM router_swap rs
LEFT JOIN market_factory_market_created mc ON rs.market = mc.market
LEFT JOIN market_swap ms ON rs.transaction_hash = ms.transaction_hash
  AND rs.market = ms.market;

-- Enriched Router Swap YT
-- Joins router_swap_yt with market metadata
CREATE OR REPLACE VIEW enriched_router_swap_yt AS
SELECT
  rsy._id,
  rsy.block_number,
  rsy.block_timestamp,
  rsy.transaction_hash,
  rsy.sender,
  rsy.receiver,
  rsy.yt,
  rsy.market,
  rsy.sy_in,
  rsy.yt_in,
  rsy.sy_out,
  rsy.yt_out,
  -- Enrichment from market_factory_market_created
  mc.expiry,
  mc.sy,
  mc.pt,
  mc.underlying,
  mc.underlying_symbol,
  -- Enrichment from market_swap (same transaction for underlying PT swap)
  ms.exchange_rate,
  ms.implied_rate_before,
  ms.implied_rate_after,
  ms.total_fee,
  ms.lp_fee,
  ms.reserve_fee
FROM router_swap_yt rsy
LEFT JOIN market_factory_market_created mc ON rsy.market = mc.market
LEFT JOIN market_swap ms ON rsy.transaction_hash = ms.transaction_hash
  AND rsy.market = ms.market;

-- Enriched Router Add Liquidity
-- Joins router_add_liquidity with market_mint and market metadata
CREATE OR REPLACE VIEW enriched_router_add_liquidity AS
SELECT
  ral._id,
  ral.block_number,
  ral.block_timestamp,
  ral.transaction_hash,
  ral.sender,
  ral.receiver,
  ral.market,
  ral.sy_used,
  ral.pt_used,
  ral.lp_out,
  -- Enrichment from market_factory_market_created
  mc.expiry,
  mc.sy,
  mc.pt,
  mc.yt,
  mc.underlying,
  mc.underlying_symbol,
  -- Enrichment from market_mint (same transaction)
  mm.exchange_rate,
  mm.implied_rate,
  mm.sy_reserve_after,
  mm.pt_reserve_after,
  mm.total_lp_after
FROM router_add_liquidity ral
LEFT JOIN market_factory_market_created mc ON ral.market = mc.market
LEFT JOIN market_mint mm ON ral.transaction_hash = mm.transaction_hash
  AND ral.market = mm.market;

-- Enriched Router Remove Liquidity
-- Joins router_remove_liquidity with market_burn and market metadata
CREATE OR REPLACE VIEW enriched_router_remove_liquidity AS
SELECT
  rrl._id,
  rrl.block_number,
  rrl.block_timestamp,
  rrl.transaction_hash,
  rrl.sender,
  rrl.receiver,
  rrl.market,
  rrl.lp_in,
  rrl.sy_out,
  rrl.pt_out,
  -- Enrichment from market_factory_market_created
  mc.expiry,
  mc.sy,
  mc.pt,
  mc.yt,
  mc.underlying,
  mc.underlying_symbol,
  -- Enrichment from market_burn (same transaction)
  mb.exchange_rate,
  mb.implied_rate,
  mb.sy_reserve_after,
  mb.pt_reserve_after,
  mb.total_lp_after
FROM router_remove_liquidity rrl
LEFT JOIN market_factory_market_created mc ON rrl.market = mc.market
LEFT JOIN market_burn mb ON rrl.transaction_hash = mb.transaction_hash
  AND rrl.market = mb.market;

-- Enriched Router Mint PY
-- Joins router_mint_py with yt_mint_py for full context
CREATE OR REPLACE VIEW enriched_router_mint_py AS
SELECT
  rmp._id,
  rmp.block_number,
  rmp.block_timestamp,
  rmp.transaction_hash,
  rmp.sender,
  rmp.receiver,
  rmp.yt,
  rmp.sy_in,
  rmp.pt_out,
  rmp.yt_out,
  -- Enrichment from yt_mint_py (same transaction)
  ymp.expiry,
  ymp.sy,
  ymp.pt,
  ymp.py_index,
  ymp.exchange_rate,
  ymp.total_pt_supply_after,
  ymp.total_yt_supply_after
FROM router_mint_py rmp
LEFT JOIN yt_mint_py ymp ON rmp.transaction_hash = ymp.transaction_hash
  AND rmp.yt = ymp.yt;

-- Enriched Router Redeem PY
-- Joins router_redeem_py with yt_redeem_py or yt_redeem_py_post_expiry
CREATE OR REPLACE VIEW enriched_router_redeem_py AS
SELECT
  rrp._id,
  rrp.block_number,
  rrp.block_timestamp,
  rrp.transaction_hash,
  rrp.sender,
  rrp.receiver,
  rrp.yt,
  rrp.py_in,
  rrp.sy_out,
  -- Enrichment from yt_redeem_py (same transaction) or yt_redeem_py_post_expiry
  COALESCE(yrp.expiry, yrpe.expiry) as expiry,
  COALESCE(yrp.sy, yrpe.sy) as sy,
  COALESCE(yrp.pt, yrpe.pt) as pt,
  COALESCE(yrp.py_index, yrpe.final_py_index) as py_index,
  COALESCE(yrp.exchange_rate, yrpe.final_exchange_rate) as exchange_rate,
  (yrpe._id IS NOT NULL) as is_post_expiry
FROM router_redeem_py rrp
LEFT JOIN yt_redeem_py yrp ON rrp.transaction_hash = yrp.transaction_hash
  AND rrp.yt = yrp.yt
LEFT JOIN yt_redeem_py_post_expiry yrpe ON rrp.transaction_hash = yrpe.transaction_hash
  AND rrp.yt = yrpe.yt;

-- ============================================================================
-- REFRESH FUNCTION
-- Call this periodically (e.g., every minute via pg_cron)
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_all_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY market_current_state;
  REFRESH MATERIALIZED VIEW CONCURRENTLY protocol_daily_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_trading_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY rate_history;
  REFRESH MATERIALIZED VIEW CONCURRENTLY oracle_rate_history;
  REFRESH MATERIALIZED VIEW CONCURRENTLY market_daily_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY market_hourly_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_py_positions;
  REFRESH MATERIALIZED VIEW CONCURRENTLY market_lp_positions;
  -- YT Interest analytics views (Phase 5)
  REFRESH MATERIALIZED VIEW CONCURRENTLY yt_fee_analytics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY treasury_yield_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY batch_operations_summary;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO PUBLIC;
