/**
 * Reset all indexer data - checkpoints AND event tables
 * This forces indexers to restart from their configured startingBlock with clean data
 */

import postgres from "postgres";

async function resetCheckpoints() {
  // Support both Railway's DATABASE_URL and our POSTGRES_CONNECTION_STRING
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
    // Drop all materialized views first (they depend on the tables)
    console.log("\n=== Dropping materialized views ===");
    const materializedViews = [
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

    for (const view of materializedViews) {
      try {
        await sql.unsafe(`DROP MATERIALIZED VIEW IF EXISTS ${view} CASCADE`);
        console.log(`✓ Dropped ${view}`);
      } catch (e: unknown) {
        const error = e as Error;
        console.log(`  Could not drop ${view}: ${error.message}`);
      }
    }

    // Drop the refresh function
    try {
      await sql.unsafe(`DROP FUNCTION IF EXISTS refresh_all_views()`);
      console.log(`✓ Dropped refresh_all_views function`);
    } catch (e: unknown) {
      const error = e as Error;
      console.log(`  Could not drop refresh_all_views: ${error.message}`);
    }

    // Truncate all event tables
    console.log("\n=== Truncating event tables ===");
    const eventTables = [
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

    for (const table of eventTables) {
      try {
        await sql.unsafe(`TRUNCATE ${table} CASCADE`);
        console.log(`✓ Truncated ${table}`);
      } catch (e: unknown) {
        const error = e as Error;
        if (!error.message?.includes("does not exist")) {
          console.log(`  Could not truncate ${table}: ${error.message}`);
        }
      }
    }

    // Truncate airfoil (checkpoint) tables
    console.log("\n=== Truncating checkpoint tables ===");
    const checkpointTables = [
      "airfoil.checkpoints",
      "airfoil.filters",
      "airfoil.reorg_rollback",
    ];

    for (const table of checkpointTables) {
      try {
        await sql.unsafe(`TRUNCATE ${table} CASCADE`);
        console.log(`✓ Truncated ${table}`);
      } catch (e: unknown) {
        const error = e as Error;
        if (!error.message?.includes("does not exist")) {
          console.log(`  Could not truncate ${table}: ${error.message}`);
        }
      }
    }

    console.log("\n=== Reset complete ===");
    console.log("All event data and checkpoints have been cleared.");
    console.log("Indexers will restart from their configured startingBlock.");
  } catch (error) {
    console.error("Failed to reset:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

resetCheckpoints();
