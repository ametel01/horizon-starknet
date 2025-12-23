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

    // Do an initial refresh
    console.log("\nPerforming initial refresh of all views...");
    await sql`SELECT refresh_all_views()`;
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
