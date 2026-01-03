/**
 * Reset all indexer data - checkpoints AND event tables
 * This forces indexers to restart from their configured startingBlock with clean data
 */

import postgres from "postgres";

import { createScriptLogger } from "../src/lib/logger";

const log = createScriptLogger("reset-checkpoints");

const MATERIALIZED_VIEWS = [
  "market_current_state",
  "protocol_daily_stats",
  "user_trading_stats",
  "rate_history",
  "oracle_rate_history",
  "market_daily_stats",
  "market_hourly_stats",
  "user_py_positions",
  "market_lp_positions",
];

const EVENT_TABLES = [
  // Factory
  "factory_yield_contracts_created",
  "factory_class_hashes_updated",
  // Market Factory
  "market_factory_market_created",
  "market_factory_class_hash_updated",
  // SY
  "sy_deposit",
  "sy_redeem",
  "sy_oracle_rate_updated",
  // YT
  "yt_mint_py",
  "yt_redeem_py",
  "yt_redeem_py_post_expiry",
  "yt_interest_claimed",
  "yt_expiry_reached",
  // Market
  "market_mint",
  "market_burn",
  "market_swap",
  "market_implied_rate_updated",
  "market_fees_collected",
  // Router
  "router_mint_py",
  "router_redeem_py",
  "router_add_liquidity",
  "router_remove_liquidity",
  "router_swap",
  "router_swap_yt",
];

const CHECKPOINT_TABLES = [
  "airfoil.checkpoints",
  "airfoil.filters",
  "airfoil.reorg_rollback",
];

type Sql = ReturnType<typeof postgres>;

/**
 * Drop materialized views and the refresh function.
 */
async function dropViewsAndRefreshFunction(sql: Sql): Promise<void> {
  log.info("Dropping materialized views...");
  for (const view of MATERIALIZED_VIEWS) {
    try {
      await sql.unsafe(`DROP MATERIALIZED VIEW IF EXISTS ${view} CASCADE`);
      log.debug({ view }, "Dropped view");
    } catch (e: unknown) {
      const error = e as Error;
      log.warn({ view, error: error.message }, "Could not drop view");
    }
  }

  try {
    await sql.unsafe("DROP FUNCTION IF EXISTS refresh_all_views()");
    log.debug("Dropped refresh_all_views function");
  } catch (e: unknown) {
    const error = e as Error;
    log.warn({ error: error.message }, "Could not drop refresh_all_views");
  }
}

/**
 * Truncate a list of tables, optionally ignoring "does not exist" errors.
 */
async function truncateTables(
  sql: Sql,
  tables: readonly string[],
  description: string,
  ignoreMissing: boolean
): Promise<void> {
  log.info(`Truncating ${description}...`);
  for (const table of tables) {
    try {
      await sql.unsafe(`TRUNCATE ${table} CASCADE`);
      log.debug({ table }, "Truncated table");
    } catch (e: unknown) {
      const error = e as Error;
      const isMissingTable = error.message?.includes("does not exist");
      if (!ignoreMissing || !isMissingTable) {
        log.warn({ table, error: error.message }, "Could not truncate table");
      }
    }
  }
}

async function resetCheckpoints() {
  // Support both Railway's DATABASE_URL and our POSTGRES_CONNECTION_STRING
  const databaseUrl =
    process.env["DATABASE_URL"] ?? process.env["POSTGRES_CONNECTION_STRING"];
  if (!databaseUrl) {
    log.fatal(
      "DATABASE_URL or POSTGRES_CONNECTION_STRING environment variable is required"
    );
    process.exit(1);
  }

  log.info("Connecting to database...");
  const sql = postgres(databaseUrl);

  try {
    await dropViewsAndRefreshFunction(sql);
    await truncateTables(sql, EVENT_TABLES, "event tables", true);
    await truncateTables(sql, CHECKPOINT_TABLES, "checkpoint tables", true);

    log.info(
      "Reset complete. All event data and checkpoints cleared. Indexers will restart from startingBlock."
    );
  } catch (error) {
    log.fatal({ error }, "Failed to reset");
    process.exit(1);
  } finally {
    await sql.end();
  }
}

resetCheckpoints();
