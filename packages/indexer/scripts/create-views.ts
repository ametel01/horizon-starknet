/**
 * Create materialized views for Horizon Protocol indexer
 * Run this after the base tables are created by Drizzle migrations
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

async function createViews() {
  const databaseUrl =
    process.env.DATABASE_URL ?? process.env.POSTGRES_CONNECTION_STRING;
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL or POSTGRES_CONNECTION_STRING environment variable is required",
    );
    process.exit(1);
  }

  console.log("Connecting to database...");
  const sql = postgres(databaseUrl);

  try {
    // Read the SQL file
    const sqlPath = join(import.meta.dir, "create-views.sql");
    const sqlContent = readFileSync(sqlPath, "utf-8");

    console.log("Creating materialized views...");

    // Execute the SQL
    await sql.unsafe(sqlContent);

    console.log("Materialized views created successfully:");
    console.log("  - market_current_state");
    console.log("  - protocol_daily_stats");
    console.log("  - user_trading_stats");
    console.log("  - rate_history");
    console.log("  - oracle_rate_history");
    console.log("  - market_daily_stats");
    console.log("  - market_hourly_stats");
    console.log("  - user_py_positions");
    console.log("  - market_lp_positions");
    console.log("  - refresh_all_views() function");

    // Do an initial non-concurrent refresh (required when views are empty)
    console.log("\nPerforming initial refresh of all views (non-concurrent)...");
    await sql`REFRESH MATERIALIZED VIEW market_current_state`;
    await sql`REFRESH MATERIALIZED VIEW protocol_daily_stats`;
    await sql`REFRESH MATERIALIZED VIEW user_trading_stats`;
    await sql`REFRESH MATERIALIZED VIEW rate_history`;
    await sql`REFRESH MATERIALIZED VIEW oracle_rate_history`;
    await sql`REFRESH MATERIALIZED VIEW market_daily_stats`;
    await sql`REFRESH MATERIALIZED VIEW market_hourly_stats`;
    await sql`REFRESH MATERIALIZED VIEW user_py_positions`;
    await sql`REFRESH MATERIALIZED VIEW market_lp_positions`;
    console.log("Initial refresh complete.");
  } catch (error) {
    // Check if error is because views already exist
    const errorMessage = (error as Error).message;
    if (errorMessage.includes("already exists")) {
      console.log("Views already exist, skipping creation.");
    } else {
      console.error("Failed to create views:", error);
      process.exit(1);
    }
  } finally {
    await sql.end();
  }
}

createViews();
