/**
 * Create materialized views for Horizon Protocol indexer
 * Run this after the base tables are created by Drizzle migrations
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import postgres from "postgres";

import { createScriptLogger } from "../src/lib/logger";

const log = createScriptLogger("create-views");

const VIEWS = [
  "market_current_state",
  "protocol_daily_stats",
  "user_trading_stats",
  "rate_history",
  "oracle_rate_history",
  "market_daily_stats",
  "market_hourly_stats",
  "user_py_positions",
  "market_lp_positions",
  // Phase 5: YT Interest analytics views
  "yt_fee_analytics",
  "treasury_yield_summary",
  "batch_operations_summary",
  // Note: redeem_with_interest_analytics is a regular view, not materialized
];

async function createViews() {
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
    // Read the SQL file
    const sqlPath = join(import.meta.dir, "create-views.sql");
    const sqlContent = readFileSync(sqlPath, "utf-8");

    log.info("Creating materialized views...");

    // Execute the SQL
    await sql.unsafe(sqlContent);

    log.info({ views: VIEWS }, "Materialized views created successfully");

    // Do an initial non-concurrent refresh (required when views are empty)
    log.info("Performing initial refresh of all views (non-concurrent)...");
    await sql`REFRESH MATERIALIZED VIEW market_current_state`;
    await sql`REFRESH MATERIALIZED VIEW protocol_daily_stats`;
    await sql`REFRESH MATERIALIZED VIEW user_trading_stats`;
    await sql`REFRESH MATERIALIZED VIEW rate_history`;
    await sql`REFRESH MATERIALIZED VIEW oracle_rate_history`;
    await sql`REFRESH MATERIALIZED VIEW market_daily_stats`;
    await sql`REFRESH MATERIALIZED VIEW market_hourly_stats`;
    await sql`REFRESH MATERIALIZED VIEW user_py_positions`;
    await sql`REFRESH MATERIALIZED VIEW market_lp_positions`;
    // Phase 5: YT Interest analytics views
    await sql`REFRESH MATERIALIZED VIEW yt_fee_analytics`;
    await sql`REFRESH MATERIALIZED VIEW treasury_yield_summary`;
    await sql`REFRESH MATERIALIZED VIEW batch_operations_summary`;
    log.info("Initial refresh complete");
  } catch (error) {
    // Check if error is because views already exist
    const errorMessage = (error as Error).message;
    if (errorMessage.includes("already exists")) {
      log.info("Views already exist, skipping creation");
    } else {
      log.fatal({ error }, "Failed to create views");
      process.exit(1);
    }
  } finally {
    await sql.end();
  }
}

createViews();
