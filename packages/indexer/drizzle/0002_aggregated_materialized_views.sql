-- Aggregated Materialized Views Migration
-- These materialized views provide pre-computed aggregations for frontend analytics.
-- They should be refreshed periodically (e.g., every 5-15 minutes) via cron job.

-- ============================================================
-- MARKET DAILY SNAPSHOTS
-- ============================================================
-- Aggregated daily stats per market for TVL charts, volume, fees

CREATE MATERIALIZED VIEW IF NOT EXISTS market_daily_stats AS
SELECT
  ms.market,
  date_trunc('day', ms.block_timestamp) AS day,
  -- Market metadata (from first record of the day)
  mc.expiry,
  mc.sy,
  mc.pt,
  mc.yt,
  mc.underlying,
  mc.underlying_symbol,
  -- Reserve snapshots (end of day values)
  (
    SELECT sy_reserve_after FROM market_swap sub
    WHERE sub.market = ms.market
      AND date_trunc('day', sub.block_timestamp) = date_trunc('day', ms.block_timestamp)
    ORDER BY sub.block_timestamp DESC, sub.block_number DESC
    LIMIT 1
  ) AS sy_reserve,
  (
    SELECT pt_reserve_after FROM market_swap sub
    WHERE sub.market = ms.market
      AND date_trunc('day', sub.block_timestamp) = date_trunc('day', ms.block_timestamp)
    ORDER BY sub.block_timestamp DESC, sub.block_number DESC
    LIMIT 1
  ) AS pt_reserve,
  -- Rate snapshots (end of day)
  (
    SELECT implied_rate_after FROM market_swap sub
    WHERE sub.market = ms.market
      AND date_trunc('day', sub.block_timestamp) = date_trunc('day', ms.block_timestamp)
    ORDER BY sub.block_timestamp DESC, sub.block_number DESC
    LIMIT 1
  ) AS implied_rate_close,
  (
    SELECT exchange_rate FROM market_swap sub
    WHERE sub.market = ms.market
      AND date_trunc('day', sub.block_timestamp) = date_trunc('day', ms.block_timestamp)
    ORDER BY sub.block_timestamp DESC, sub.block_number DESC
    LIMIT 1
  ) AS exchange_rate_close,
  -- Rate OHLC (open, high, low, close)
  (
    SELECT implied_rate_before FROM market_swap sub
    WHERE sub.market = ms.market
      AND date_trunc('day', sub.block_timestamp) = date_trunc('day', ms.block_timestamp)
    ORDER BY sub.block_timestamp ASC, sub.block_number ASC
    LIMIT 1
  ) AS implied_rate_open,
  MAX(CAST(ms.implied_rate_after AS numeric)) AS implied_rate_high,
  MIN(CAST(ms.implied_rate_after AS numeric)) AS implied_rate_low,
  -- Volume metrics
  SUM(CAST(ms.sy_in AS numeric) + CAST(ms.sy_out AS numeric)) AS sy_volume,
  SUM(CAST(ms.pt_in AS numeric) + CAST(ms.pt_out AS numeric)) AS pt_volume,
  SUM(CAST(ms.fee AS numeric)) AS total_fees,
  COUNT(*) AS swap_count,
  COUNT(DISTINCT ms.sender) AS unique_traders
FROM market_swap ms
LEFT JOIN market_factory_market_created mc ON ms.market = mc.market
GROUP BY ms.market, date_trunc('day', ms.block_timestamp), mc.expiry, mc.sy, mc.pt, mc.yt, mc.underlying, mc.underlying_symbol;

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_daily_stats_market_day
  ON market_daily_stats(market, day);
CREATE INDEX IF NOT EXISTS idx_market_daily_stats_day
  ON market_daily_stats(day);

-- ============================================================
-- MARKET HOURLY SNAPSHOTS
-- ============================================================
-- More granular hourly stats for real-time charts

CREATE MATERIALIZED VIEW IF NOT EXISTS market_hourly_stats AS
SELECT
  ms.market,
  date_trunc('hour', ms.block_timestamp) AS hour,
  -- End of hour snapshots
  (
    SELECT sy_reserve_after FROM market_swap sub
    WHERE sub.market = ms.market
      AND date_trunc('hour', sub.block_timestamp) = date_trunc('hour', ms.block_timestamp)
    ORDER BY sub.block_timestamp DESC, sub.block_number DESC
    LIMIT 1
  ) AS sy_reserve,
  (
    SELECT pt_reserve_after FROM market_swap sub
    WHERE sub.market = ms.market
      AND date_trunc('hour', sub.block_timestamp) = date_trunc('hour', ms.block_timestamp)
    ORDER BY sub.block_timestamp DESC, sub.block_number DESC
    LIMIT 1
  ) AS pt_reserve,
  (
    SELECT implied_rate_after FROM market_swap sub
    WHERE sub.market = ms.market
      AND date_trunc('hour', sub.block_timestamp) = date_trunc('hour', ms.block_timestamp)
    ORDER BY sub.block_timestamp DESC, sub.block_number DESC
    LIMIT 1
  ) AS implied_rate,
  (
    SELECT exchange_rate FROM market_swap sub
    WHERE sub.market = ms.market
      AND date_trunc('hour', sub.block_timestamp) = date_trunc('hour', ms.block_timestamp)
    ORDER BY sub.block_timestamp DESC, sub.block_number DESC
    LIMIT 1
  ) AS exchange_rate,
  -- Volume metrics
  SUM(CAST(ms.sy_in AS numeric) + CAST(ms.sy_out AS numeric)) AS sy_volume,
  SUM(CAST(ms.pt_in AS numeric) + CAST(ms.pt_out AS numeric)) AS pt_volume,
  SUM(CAST(ms.fee AS numeric)) AS total_fees,
  COUNT(*) AS swap_count
FROM market_swap ms
GROUP BY ms.market, date_trunc('hour', ms.block_timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_hourly_stats_market_hour
  ON market_hourly_stats(market, hour);
CREATE INDEX IF NOT EXISTS idx_market_hourly_stats_hour
  ON market_hourly_stats(hour);

-- ============================================================
-- USER POSITIONS SUMMARY
-- ============================================================
-- Aggregated user positions across all token types

CREATE MATERIALIZED VIEW IF NOT EXISTS user_positions_summary AS
WITH
-- PT/YT mints (user receives PT+YT)
py_mints AS (
  SELECT
    receiver AS user_address,
    yt,
    pt,
    sy,
    expiry,
    SUM(CAST(amount_py_minted AS numeric)) AS total_minted,
    -- Entry metrics for P&L calculation
    SUM(CAST(amount_py_minted AS numeric) * CAST(py_index AS numeric)) / NULLIF(SUM(CAST(amount_py_minted AS numeric)), 0) AS avg_entry_py_index,
    SUM(CAST(amount_py_minted AS numeric) * CAST(exchange_rate AS numeric)) / NULLIF(SUM(CAST(amount_py_minted AS numeric)), 0) AS avg_entry_exchange_rate,
    MIN(block_timestamp) AS first_mint,
    MAX(block_timestamp) AS last_mint,
    COUNT(*) AS mint_count
  FROM yt_mint_py
  GROUP BY receiver, yt, pt, sy, expiry
),
-- PT/YT redeems (user burns PT+YT)
py_redeems AS (
  SELECT
    caller AS user_address,
    yt,
    pt,
    sy,
    expiry,
    SUM(CAST(amount_py_redeemed AS numeric)) AS total_redeemed,
    MAX(block_timestamp) AS last_redeem,
    COUNT(*) AS redeem_count
  FROM yt_redeem_py
  GROUP BY caller, yt, pt, sy, expiry
),
-- Post-expiry PT redeems
py_post_expiry_redeems AS (
  SELECT
    caller AS user_address,
    yt,
    pt,
    sy,
    expiry,
    SUM(CAST(amount_pt_redeemed AS numeric)) AS total_pt_redeemed_post_expiry,
    MAX(block_timestamp) AS last_post_expiry_redeem
  FROM yt_redeem_py_post_expiry
  GROUP BY caller, yt, pt, sy, expiry
),
-- Interest claimed
interest_claims AS (
  SELECT
    "user" AS user_address,
    yt,
    sy,
    expiry,
    SUM(CAST(amount_sy AS numeric)) AS total_interest_claimed,
    COUNT(*) AS claim_count,
    MAX(block_timestamp) AS last_claim
  FROM yt_interest_claimed
  GROUP BY "user", yt, sy, expiry
)
SELECT
  COALESCE(m.user_address, r.user_address, pe.user_address) AS user_address,
  COALESCE(m.yt, r.yt, pe.yt) AS yt,
  COALESCE(m.pt, r.pt, pe.pt) AS pt,
  COALESCE(m.sy, r.sy, pe.sy) AS sy,
  COALESCE(m.expiry, r.expiry, pe.expiry) AS expiry,
  -- Position balances (net of mints - redeems)
  COALESCE(m.total_minted, 0) - COALESCE(r.total_redeemed, 0) - COALESCE(pe.total_pt_redeemed_post_expiry, 0) AS net_pt_balance,
  COALESCE(m.total_minted, 0) - COALESCE(r.total_redeemed, 0) AS net_yt_balance,
  -- Entry metrics for P&L
  m.avg_entry_py_index,
  m.avg_entry_exchange_rate,
  -- Activity stats
  COALESCE(m.total_minted, 0) AS total_minted,
  COALESCE(r.total_redeemed, 0) AS total_redeemed,
  COALESCE(pe.total_pt_redeemed_post_expiry, 0) AS total_pt_redeemed_post_expiry,
  COALESCE(ic.total_interest_claimed, 0) AS total_interest_claimed,
  -- Timestamps
  m.first_mint,
  GREATEST(m.last_mint, r.last_redeem, pe.last_post_expiry_redeem, ic.last_claim) AS last_activity,
  -- Counts
  COALESCE(m.mint_count, 0) AS mint_count,
  COALESCE(r.redeem_count, 0) AS redeem_count,
  COALESCE(ic.claim_count, 0) AS claim_count
FROM py_mints m
FULL OUTER JOIN py_redeems r ON m.user_address = r.user_address AND m.yt = r.yt
FULL OUTER JOIN py_post_expiry_redeems pe ON COALESCE(m.user_address, r.user_address) = pe.user_address AND COALESCE(m.yt, r.yt) = pe.yt
LEFT JOIN interest_claims ic ON COALESCE(m.user_address, r.user_address, pe.user_address) = ic.user_address AND COALESCE(m.yt, r.yt, pe.yt) = ic.yt;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_positions_user_yt
  ON user_positions_summary(user_address, yt);
CREATE INDEX IF NOT EXISTS idx_user_positions_user
  ON user_positions_summary(user_address);
CREATE INDEX IF NOT EXISTS idx_user_positions_expiry
  ON user_positions_summary(expiry);

-- ============================================================
-- USER LP POSITIONS SUMMARY
-- ============================================================
-- Aggregated LP positions per user per market

CREATE MATERIALIZED VIEW IF NOT EXISTS user_lp_positions AS
WITH
lp_mints AS (
  SELECT
    receiver AS user_address,
    market,
    SUM(CAST(lp_amount AS numeric)) AS total_lp_minted,
    SUM(CAST(sy_amount AS numeric)) AS total_sy_deposited,
    SUM(CAST(pt_amount AS numeric)) AS total_pt_deposited,
    -- Entry metrics
    SUM(CAST(lp_amount AS numeric) * CAST(implied_rate AS numeric)) / NULLIF(SUM(CAST(lp_amount AS numeric)), 0) AS avg_entry_implied_rate,
    SUM(CAST(lp_amount AS numeric) * CAST(exchange_rate AS numeric)) / NULLIF(SUM(CAST(lp_amount AS numeric)), 0) AS avg_entry_exchange_rate,
    MIN(block_timestamp) AS first_mint,
    MAX(block_timestamp) AS last_mint,
    COUNT(*) AS mint_count
  FROM market_mint
  GROUP BY receiver, market
),
lp_burns AS (
  SELECT
    sender AS user_address,
    market,
    SUM(CAST(lp_amount AS numeric)) AS total_lp_burned,
    SUM(CAST(sy_amount AS numeric)) AS total_sy_withdrawn,
    SUM(CAST(pt_amount AS numeric)) AS total_pt_withdrawn,
    -- Exit metrics
    SUM(CAST(lp_amount AS numeric) * CAST(implied_rate AS numeric)) / NULLIF(SUM(CAST(lp_amount AS numeric)), 0) AS avg_exit_implied_rate,
    SUM(CAST(lp_amount AS numeric) * CAST(exchange_rate AS numeric)) / NULLIF(SUM(CAST(lp_amount AS numeric)), 0) AS avg_exit_exchange_rate,
    MAX(block_timestamp) AS last_burn,
    COUNT(*) AS burn_count
  FROM market_burn
  GROUP BY sender, market
)
SELECT
  COALESCE(m.user_address, b.user_address) AS user_address,
  COALESCE(m.market, b.market) AS market,
  mc.expiry,
  mc.sy,
  mc.pt,
  mc.yt,
  mc.underlying,
  mc.underlying_symbol,
  -- Net LP balance
  COALESCE(m.total_lp_minted, 0) - COALESCE(b.total_lp_burned, 0) AS net_lp_balance,
  -- Deposited/withdrawn
  COALESCE(m.total_sy_deposited, 0) AS total_sy_deposited,
  COALESCE(m.total_pt_deposited, 0) AS total_pt_deposited,
  COALESCE(b.total_sy_withdrawn, 0) AS total_sy_withdrawn,
  COALESCE(b.total_pt_withdrawn, 0) AS total_pt_withdrawn,
  -- Entry/exit rates for P&L
  m.avg_entry_implied_rate,
  m.avg_entry_exchange_rate,
  b.avg_exit_implied_rate,
  b.avg_exit_exchange_rate,
  -- Activity
  m.first_mint,
  GREATEST(m.last_mint, b.last_burn) AS last_activity,
  COALESCE(m.mint_count, 0) AS mint_count,
  COALESCE(b.burn_count, 0) AS burn_count
FROM lp_mints m
FULL OUTER JOIN lp_burns b ON m.user_address = b.user_address AND m.market = b.market
LEFT JOIN market_factory_market_created mc ON COALESCE(m.market, b.market) = mc.market;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_lp_positions_user_market
  ON user_lp_positions(user_address, market);
CREATE INDEX IF NOT EXISTS idx_user_lp_positions_user
  ON user_lp_positions(user_address);
CREATE INDEX IF NOT EXISTS idx_user_lp_positions_market
  ON user_lp_positions(market);

-- ============================================================
-- PROTOCOL DAILY STATS
-- ============================================================
-- Protocol-wide daily metrics for dashboard

CREATE MATERIALIZED VIEW IF NOT EXISTS protocol_daily_stats AS
WITH
daily_swaps AS (
  SELECT
    date_trunc('day', block_timestamp) AS day,
    SUM(CAST(sy_in AS numeric) + CAST(sy_out AS numeric)) AS total_sy_volume,
    SUM(CAST(pt_in AS numeric) + CAST(pt_out AS numeric)) AS total_pt_volume,
    SUM(CAST(fee AS numeric)) AS total_fees,
    COUNT(*) AS swap_count,
    COUNT(DISTINCT sender) AS unique_swappers
  FROM market_swap
  GROUP BY date_trunc('day', block_timestamp)
),
daily_mints AS (
  SELECT
    date_trunc('day', block_timestamp) AS day,
    SUM(CAST(amount_py_minted AS numeric)) AS total_py_minted,
    COUNT(*) AS mint_count,
    COUNT(DISTINCT receiver) AS unique_minters
  FROM yt_mint_py
  GROUP BY date_trunc('day', block_timestamp)
),
daily_lp AS (
  SELECT
    date_trunc('day', mm.block_timestamp) AS day,
    SUM(CAST(mm.lp_amount AS numeric)) AS total_lp_minted,
    COUNT(*) AS lp_mint_count
  FROM market_mint mm
  GROUP BY date_trunc('day', mm.block_timestamp)
),
daily_lp_burns AS (
  SELECT
    date_trunc('day', mb.block_timestamp) AS day,
    SUM(CAST(mb.lp_amount AS numeric)) AS total_lp_burned,
    COUNT(*) AS lp_burn_count
  FROM market_burn mb
  GROUP BY date_trunc('day', mb.block_timestamp)
),
daily_interest AS (
  SELECT
    date_trunc('day', block_timestamp) AS day,
    SUM(CAST(amount_sy AS numeric)) AS total_interest_claimed,
    COUNT(*) AS claim_count,
    COUNT(DISTINCT "user") AS unique_claimers
  FROM yt_interest_claimed
  GROUP BY date_trunc('day', block_timestamp)
)
SELECT
  COALESCE(s.day, m.day, l.day, lb.day, i.day) AS day,
  -- Volume
  COALESCE(s.total_sy_volume, 0) AS total_sy_volume,
  COALESCE(s.total_pt_volume, 0) AS total_pt_volume,
  COALESCE(s.total_fees, 0) AS total_fees,
  -- Swap activity
  COALESCE(s.swap_count, 0) AS swap_count,
  COALESCE(s.unique_swappers, 0) AS unique_swappers,
  -- Mint activity
  COALESCE(m.total_py_minted, 0) AS total_py_minted,
  COALESCE(m.mint_count, 0) AS mint_count,
  COALESCE(m.unique_minters, 0) AS unique_minters,
  -- LP activity
  COALESCE(l.total_lp_minted, 0) AS total_lp_minted,
  COALESCE(l.lp_mint_count, 0) AS lp_mint_count,
  COALESCE(lb.total_lp_burned, 0) AS total_lp_burned,
  COALESCE(lb.lp_burn_count, 0) AS lp_burn_count,
  -- Interest
  COALESCE(i.total_interest_claimed, 0) AS total_interest_claimed,
  COALESCE(i.claim_count, 0) AS interest_claim_count,
  COALESCE(i.unique_claimers, 0) AS unique_claimers,
  -- Unique users (across all activities)
  (SELECT COUNT(DISTINCT u) FROM (
    SELECT sender AS u FROM market_swap WHERE date_trunc('day', block_timestamp) = COALESCE(s.day, m.day, l.day, lb.day, i.day)
    UNION SELECT receiver FROM yt_mint_py WHERE date_trunc('day', block_timestamp) = COALESCE(s.day, m.day, l.day, lb.day, i.day)
    UNION SELECT receiver FROM market_mint WHERE date_trunc('day', block_timestamp) = COALESCE(s.day, m.day, l.day, lb.day, i.day)
  ) users) AS unique_users
FROM daily_swaps s
FULL OUTER JOIN daily_mints m ON s.day = m.day
FULL OUTER JOIN daily_lp l ON COALESCE(s.day, m.day) = l.day
FULL OUTER JOIN daily_lp_burns lb ON COALESCE(s.day, m.day, l.day) = lb.day
FULL OUTER JOIN daily_interest i ON COALESCE(s.day, m.day, l.day, lb.day) = i.day
ORDER BY day;

CREATE UNIQUE INDEX IF NOT EXISTS idx_protocol_daily_stats_day
  ON protocol_daily_stats(day);

-- ============================================================
-- MARKET CURRENT STATE
-- ============================================================
-- Latest state for each market (for dashboard/listings)

CREATE MATERIALIZED VIEW IF NOT EXISTS market_current_state AS
SELECT DISTINCT ON (mc.market)
  mc.market,
  mc.expiry,
  mc.sy,
  mc.pt,
  mc.yt,
  mc.underlying,
  mc.underlying_symbol,
  mc.fee_rate,
  mc.initial_exchange_rate,
  mc.block_timestamp AS created_at,
  -- Latest state from most recent swap
  latest.sy_reserve_after AS sy_reserve,
  latest.pt_reserve_after AS pt_reserve,
  latest.implied_rate_after AS implied_rate,
  latest.exchange_rate,
  latest.block_timestamp AS last_activity,
  -- Check if expired
  (mc.expiry <= EXTRACT(EPOCH FROM NOW())) AS is_expired,
  -- 24h volume (from daily stats)
  COALESCE(daily.sy_volume, 0) AS volume_24h,
  COALESCE(daily.total_fees, 0) AS fees_24h,
  COALESCE(daily.swap_count, 0) AS swaps_24h
FROM market_factory_market_created mc
LEFT JOIN LATERAL (
  SELECT sy_reserve_after, pt_reserve_after, implied_rate_after, exchange_rate, block_timestamp
  FROM market_swap
  WHERE market = mc.market
  ORDER BY block_timestamp DESC, block_number DESC
  LIMIT 1
) latest ON true
LEFT JOIN LATERAL (
  SELECT sy_volume, total_fees, swap_count
  FROM market_daily_stats
  WHERE market = mc.market AND day = date_trunc('day', NOW())
  LIMIT 1
) daily ON true
ORDER BY mc.market, mc.block_timestamp DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_current_state_market
  ON market_current_state(market);
CREATE INDEX IF NOT EXISTS idx_market_current_state_expiry
  ON market_current_state(expiry);
CREATE INDEX IF NOT EXISTS idx_market_current_state_underlying
  ON market_current_state(underlying);

-- ============================================================
-- LEADERBOARD - TOP TRADERS
-- ============================================================
-- Aggregated trading stats per user for leaderboards

CREATE MATERIALIZED VIEW IF NOT EXISTS user_trading_stats AS
SELECT
  sender AS user_address,
  COUNT(*) AS total_swaps,
  COUNT(DISTINCT market) AS markets_traded,
  SUM(CAST(sy_in AS numeric) + CAST(sy_out AS numeric)) AS total_sy_volume,
  SUM(CAST(pt_in AS numeric) + CAST(pt_out AS numeric)) AS total_pt_volume,
  SUM(CAST(fee AS numeric)) AS total_fees_paid,
  MIN(block_timestamp) AS first_swap,
  MAX(block_timestamp) AS last_swap,
  -- Activity streak
  COUNT(DISTINCT date_trunc('day', block_timestamp)) AS active_days
FROM market_swap
GROUP BY sender;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_trading_stats_user
  ON user_trading_stats(user_address);
CREATE INDEX IF NOT EXISTS idx_user_trading_stats_volume
  ON user_trading_stats(total_sy_volume DESC);

-- ============================================================
-- RATE HISTORY (for charts)
-- ============================================================
-- Implied rate and exchange rate history from rate update events

CREATE MATERIALIZED VIEW IF NOT EXISTS rate_history AS
SELECT
  market,
  block_timestamp,
  block_number,
  old_rate AS implied_rate_before,
  new_rate AS implied_rate_after,
  exchange_rate,
  time_to_expiry,
  sy_reserve,
  pt_reserve,
  total_lp
FROM market_implied_rate_updated
ORDER BY market, block_timestamp;

CREATE INDEX IF NOT EXISTS idx_rate_history_market_time
  ON rate_history(market, block_timestamp);

-- ============================================================
-- EXCHANGE RATE HISTORY (from SY oracle updates)
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS exchange_rate_history AS
SELECT
  sy,
  underlying,
  block_timestamp,
  block_number,
  old_rate,
  new_rate,
  rate_change_bps
FROM sy_oracle_rate_updated
ORDER BY sy, block_timestamp;

CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_sy_time
  ON exchange_rate_history(sy, block_timestamp);

-- ============================================================
-- COMMENTS & REFRESH INSTRUCTIONS
-- ============================================================

COMMENT ON MATERIALIZED VIEW market_daily_stats IS 'Daily aggregated stats per market. Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY market_daily_stats;';
COMMENT ON MATERIALIZED VIEW market_hourly_stats IS 'Hourly aggregated stats per market. Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY market_hourly_stats;';
COMMENT ON MATERIALIZED VIEW user_positions_summary IS 'User PT/YT positions with P&L metrics. Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY user_positions_summary;';
COMMENT ON MATERIALIZED VIEW user_lp_positions IS 'User LP positions per market. Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY user_lp_positions;';
COMMENT ON MATERIALIZED VIEW protocol_daily_stats IS 'Protocol-wide daily metrics. Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY protocol_daily_stats;';
COMMENT ON MATERIALIZED VIEW market_current_state IS 'Current state of each market. Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY market_current_state;';
COMMENT ON MATERIALIZED VIEW user_trading_stats IS 'User trading stats for leaderboards. Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY user_trading_stats;';
COMMENT ON MATERIALIZED VIEW rate_history IS 'Implied rate history for charts. Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY rate_history;';
COMMENT ON MATERIALIZED VIEW exchange_rate_history IS 'Exchange rate history from oracle. Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY exchange_rate_history;';

-- ============================================================
-- REFRESH FUNCTION
-- ============================================================
-- Call this function periodically to refresh all materialized views

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
  -- Refresh in dependency order
  REFRESH MATERIALIZED VIEW CONCURRENTLY market_hourly_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY market_daily_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY market_current_state;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_positions_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_lp_positions;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_trading_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY protocol_daily_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY rate_history;
  REFRESH MATERIALIZED VIEW CONCURRENTLY exchange_rate_history;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_all_materialized_views() IS 'Refreshes all materialized views. Call via: SELECT refresh_all_materialized_views(); Recommended: every 5-15 minutes via pg_cron or external scheduler.';
