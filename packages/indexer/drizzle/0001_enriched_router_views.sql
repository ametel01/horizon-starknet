-- Enriched Router Views Migration
-- These views join router events with underlying contract events to provide full context
-- for frontend analytics without requiring additional RPC calls.

-- ============================================================
-- ENRICHED ROUTER SWAP VIEW
-- ============================================================
-- Joins router_swap with market_swap (same transaction) and market_factory_market_created
-- to get: expiry, sy, pt, exchange_rate, implied_rate, fee

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
  ms.fee,
  ms.sy_reserve_after,
  ms.pt_reserve_after
FROM router_swap rs
LEFT JOIN market_factory_market_created mc ON rs.market = mc.market
LEFT JOIN market_swap ms ON rs.transaction_hash = ms.transaction_hash
  AND rs.market = ms.market;

-- ============================================================
-- ENRICHED ROUTER SWAP YT VIEW
-- ============================================================
-- Joins router_swap_yt with market data and yt data

CREATE OR REPLACE VIEW enriched_router_swap_yt AS
SELECT
  rsyt._id,
  rsyt.block_number,
  rsyt.block_timestamp,
  rsyt.transaction_hash,
  rsyt.sender,
  rsyt.receiver,
  rsyt.yt,
  rsyt.market,
  rsyt.sy_in,
  rsyt.yt_in,
  rsyt.sy_out,
  rsyt.yt_out,
  -- Enrichment from market_factory_market_created
  mc.expiry,
  mc.sy,
  mc.pt,
  mc.underlying,
  mc.underlying_symbol,
  -- Enrichment from market_swap (same transaction, for rate context)
  ms.exchange_rate,
  ms.implied_rate_before,
  ms.implied_rate_after,
  ms.fee
FROM router_swap_yt rsyt
LEFT JOIN market_factory_market_created mc ON rsyt.market = mc.market
LEFT JOIN market_swap ms ON rsyt.transaction_hash = ms.transaction_hash
  AND rsyt.market = ms.market;

-- ============================================================
-- ENRICHED ROUTER ADD LIQUIDITY VIEW
-- ============================================================
-- Joins router_add_liquidity with market_mint (same transaction) and market creation data

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

-- ============================================================
-- ENRICHED ROUTER REMOVE LIQUIDITY VIEW
-- ============================================================
-- Joins router_remove_liquidity with market_burn (same transaction) and market creation data

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

-- ============================================================
-- ENRICHED ROUTER MINT PY VIEW
-- ============================================================
-- Joins router_mint_py with yt_mint_py (same transaction) for full context

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

-- ============================================================
-- ENRICHED ROUTER REDEEM PY VIEW
-- ============================================================
-- Joins router_redeem_py with yt_redeem_py or yt_redeem_py_post_expiry (same transaction)

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
  -- Enrichment from yt_redeem_py (same transaction, pre-expiry)
  COALESCE(yrp.expiry, yrpe.expiry) as expiry,
  COALESCE(yrp.sy, yrpe.sy) as sy,
  COALESCE(yrp.pt, yrpe.pt) as pt,
  COALESCE(yrp.py_index, yrpe.final_py_index) as py_index,
  COALESCE(yrp.exchange_rate, yrpe.final_exchange_rate) as exchange_rate,
  -- Flag to indicate post-expiry redemption
  CASE WHEN yrpe._id IS NOT NULL THEN true ELSE false END as is_post_expiry
FROM router_redeem_py rrp
LEFT JOIN yt_redeem_py yrp ON rrp.transaction_hash = yrp.transaction_hash
  AND rrp.yt = yrp.yt
LEFT JOIN yt_redeem_py_post_expiry yrpe ON rrp.transaction_hash = yrpe.transaction_hash
  AND rrp.yt = yrpe.yt;

-- ============================================================
-- INDEXES FOR VIEW PERFORMANCE
-- ============================================================
-- These indexes improve JOIN performance for the enriched views

-- Index on market_factory_market_created.market for faster lookups
CREATE INDEX IF NOT EXISTS idx_mf_mc_market_lookup ON market_factory_market_created(market);

-- Composite indexes for transaction_hash + market/yt joins
CREATE INDEX IF NOT EXISTS idx_market_swap_tx_market ON market_swap(transaction_hash, market);
CREATE INDEX IF NOT EXISTS idx_market_mint_tx_market ON market_mint(transaction_hash, market);
CREATE INDEX IF NOT EXISTS idx_market_burn_tx_market ON market_burn(transaction_hash, market);
CREATE INDEX IF NOT EXISTS idx_yt_mint_py_tx_yt ON yt_mint_py(transaction_hash, yt);
CREATE INDEX IF NOT EXISTS idx_yt_redeem_py_tx_yt ON yt_redeem_py(transaction_hash, yt);
CREATE INDEX IF NOT EXISTS idx_yt_redeem_py_pe_tx_yt ON yt_redeem_py_post_expiry(transaction_hash, yt);

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON VIEW enriched_router_swap IS 'Router swap events enriched with market context (expiry, tokens, rates, fees)';
COMMENT ON VIEW enriched_router_swap_yt IS 'Router YT swap events enriched with market context';
COMMENT ON VIEW enriched_router_add_liquidity IS 'Router add liquidity events enriched with market state';
COMMENT ON VIEW enriched_router_remove_liquidity IS 'Router remove liquidity events enriched with market state';
COMMENT ON VIEW enriched_router_mint_py IS 'Router mint PY events enriched with YT contract data';
COMMENT ON VIEW enriched_router_redeem_py IS 'Router redeem PY events enriched with redemption context';
