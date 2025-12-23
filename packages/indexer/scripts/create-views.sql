-- Create materialized views for Horizon Protocol indexer
-- Run this after the base tables are created by Drizzle migrations

-- ============================================================================
-- MARKET CURRENT STATE
-- Latest state for each market (for listings, dashboard)
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS market_current_state AS
WITH market_info AS (
  SELECT
    m.market,
    m.sy,
    m.pt,
    m.expiry,
    m.fee_rate,
    m.initial_exchange_rate,
    m.block_timestamp as created_at,
    y.yt,
    y.underlying,
    y.underlying_symbol
  FROM market_factory_market_created m
  LEFT JOIN factory_yield_contracts_created y ON m.sy = y.sy AND m.pt = y.pt
),
latest_swap AS (
  SELECT DISTINCT ON (market)
    market,
    implied_rate_after as implied_rate,
    exchange_rate,
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
volume_24h AS (
  SELECT
    market,
    COALESCE(SUM(sy_in), 0) + COALESCE(SUM(sy_out), 0) as sy_volume_24h,
    COALESCE(SUM(pt_in), 0) + COALESCE(SUM(pt_out), 0) as pt_volume_24h,
    COALESCE(SUM(fee), 0) as fees_24h,
    COUNT(*) as swaps_24h
  FROM market_swap
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
  mi.fee_rate,
  mi.initial_exchange_rate,
  mi.created_at,
  COALESCE(lir.sy_reserve, lm.sy_reserve, 0) as sy_reserve,
  COALESCE(lir.pt_reserve, lm.pt_reserve, 0) as pt_reserve,
  COALESCE(lir.total_lp, 0) as total_lp,
  COALESCE(ls.implied_rate, lir.implied_rate, lm.implied_rate, 0) as implied_rate,
  COALESCE(ls.exchange_rate, lir.exchange_rate, mi.initial_exchange_rate) as exchange_rate,
  GREATEST(ls.last_activity, lm.last_activity, lir.last_activity, mi.created_at) as last_activity,
  (mi.expiry <= EXTRACT(EPOCH FROM NOW())) as is_expired,
  COALESCE(v.sy_volume_24h, 0) as sy_volume_24h,
  COALESCE(v.pt_volume_24h, 0) as pt_volume_24h,
  COALESCE(v.fees_24h, 0) as fees_24h,
  COALESCE(v.swaps_24h, 0) as swaps_24h
FROM market_info mi
LEFT JOIN latest_swap ls ON mi.market = ls.market
LEFT JOIN latest_mint lm ON mi.market = lm.market
LEFT JOIN latest_implied_rate lir ON mi.market = lir.market
LEFT JOIN volume_24h v ON mi.market = v.market;

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_current_state_market
  ON market_current_state(market);

-- ============================================================================
-- PROTOCOL DAILY STATS
-- Protocol-wide daily metrics (for dashboard, analytics)
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS protocol_daily_stats AS
WITH swap_stats AS (
  SELECT
    DATE_TRUNC('day', block_timestamp) as day,
    COALESCE(SUM(sy_in), 0) + COALESCE(SUM(sy_out), 0) as total_sy_volume,
    COALESCE(SUM(pt_in), 0) + COALESCE(SUM(pt_out), 0) as total_pt_volume,
    COALESCE(SUM(fee), 0) as total_fees,
    COUNT(*) as swap_count,
    COUNT(DISTINCT sender) as unique_swappers
  FROM market_swap
  GROUP BY DATE_TRUNC('day', block_timestamp)
),
mint_stats AS (
  SELECT
    DATE_TRUNC('day', block_timestamp) as day,
    COALESCE(SUM(sy_used), 0) as total_py_minted,
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
    COALESCE(SUM(interest_out), 0) as total_interest_claimed,
    COUNT(*) as interest_claim_count,
    COUNT(DISTINCT user_address) as unique_claimers
  FROM yt_interest_claimed
  GROUP BY DATE_TRUNC('day', block_timestamp)
),
all_days AS (
  SELECT day FROM swap_stats
  UNION SELECT day FROM mint_stats
  UNION SELECT day FROM lp_mint_stats
  UNION SELECT day FROM lp_burn_stats
  UNION SELECT day FROM interest_stats
),
unique_users_per_day AS (
  SELECT day, COUNT(DISTINCT user_address) as unique_users FROM (
    SELECT DATE_TRUNC('day', block_timestamp) as day, sender as user_address FROM market_swap
    UNION ALL
    SELECT DATE_TRUNC('day', block_timestamp), receiver FROM router_mint_py
    UNION ALL
    SELECT DATE_TRUNC('day', block_timestamp), receiver FROM router_add_liquidity
    UNION ALL
    SELECT DATE_TRUNC('day', block_timestamp), user_address FROM yt_interest_claimed
  ) all_users
  GROUP BY day
)
SELECT
  d.day,
  COALESCE(s.total_sy_volume, 0) as total_sy_volume,
  COALESCE(s.total_pt_volume, 0) as total_pt_volume,
  COALESCE(s.total_fees, 0) as total_fees,
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
  COALESCE(SUM(fee), 0) as total_fees_paid,
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

CREATE INDEX IF NOT EXISTS idx_rate_history_market_block
  ON rate_history(market, block_number DESC);

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

CREATE INDEX IF NOT EXISTS idx_oracle_rate_history_sy_block
  ON oracle_rate_history(sy, block_number DESC);

-- ============================================================================
-- MARKET DAILY STATS
-- Per-market daily aggregates
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS market_daily_stats AS
SELECT
  market,
  DATE_TRUNC('day', block_timestamp) as day,
  MIN(implied_rate_before) as min_implied_rate,
  MAX(implied_rate_after) as max_implied_rate,
  -- Use last value as close
  (ARRAY_AGG(implied_rate_after ORDER BY block_number DESC))[1] as close_implied_rate,
  (ARRAY_AGG(exchange_rate ORDER BY block_number DESC))[1] as exchange_rate,
  COALESCE(SUM(sy_in), 0) + COALESCE(SUM(sy_out), 0) as sy_volume,
  COALESCE(SUM(pt_in), 0) + COALESCE(SUM(pt_out), 0) as pt_volume,
  COALESCE(SUM(fee), 0) as total_fees,
  COUNT(*) as swap_count,
  COUNT(DISTINCT sender) as unique_traders
FROM market_swap
GROUP BY market, DATE_TRUNC('day', block_timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_daily_stats_market_day
  ON market_daily_stats(market, day);

-- ============================================================================
-- MARKET HOURLY STATS
-- Per-market hourly aggregates (for recent activity)
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS market_hourly_stats AS
SELECT
  market,
  DATE_TRUNC('hour', block_timestamp) as hour,
  MIN(implied_rate_before) as min_implied_rate,
  MAX(implied_rate_after) as max_implied_rate,
  (ARRAY_AGG(implied_rate_after ORDER BY block_number DESC))[1] as close_implied_rate,
  (ARRAY_AGG(exchange_rate ORDER BY block_number DESC))[1] as exchange_rate,
  COALESCE(SUM(sy_in), 0) + COALESCE(SUM(sy_out), 0) as sy_volume,
  COALESCE(SUM(pt_in), 0) + COALESCE(SUM(pt_out), 0) as pt_volume,
  COALESCE(SUM(fee), 0) as total_fees,
  COUNT(*) as swap_count
FROM market_swap
WHERE block_timestamp >= NOW() - INTERVAL '7 days'
GROUP BY market, DATE_TRUNC('hour', block_timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_hourly_stats_market_hour
  ON market_hourly_stats(market, hour);

-- ============================================================================
-- USER PY POSITIONS
-- User PT/YT holdings
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS user_py_positions AS
WITH mints AS (
  SELECT
    receiver as user_address,
    yt,
    sy,
    pt,
    SUM(pt_amount) as total_pt_minted,
    SUM(yt_amount) as total_yt_minted,
    MIN(block_timestamp) as first_mint,
    MAX(block_timestamp) as last_activity,
    COUNT(*) as mint_count
  FROM router_mint_py
  GROUP BY receiver, yt, sy, pt
),
redeems AS (
  SELECT
    receiver as user_address,
    yt,
    SUM(pt_amount) as total_pt_redeemed,
    SUM(yt_amount) as total_yt_redeemed,
    COUNT(*) as redeem_count
  FROM router_redeem_py
  GROUP BY receiver, yt
),
claims AS (
  SELECT
    user_address,
    yt,
    SUM(interest_out) as total_interest_claimed,
    COUNT(*) as claim_count
  FROM yt_interest_claimed
  GROUP BY user_address, yt
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
    (SELECT MAX(block_timestamp) FROM yt_interest_claimed WHERE user_address = m.user_address AND yt = m.yt)
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
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO PUBLIC;
