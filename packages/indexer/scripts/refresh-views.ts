/**
 * Refresh all materialized views
 * Run this periodically to update view data
 */

import postgres from "postgres";

import { createScriptLogger } from "../src/lib/logger";

const log = createScriptLogger("refresh-views");

async function refreshViews() {
  const databaseUrl =
    process.env["DATABASE_URL"] ?? process.env["POSTGRES_CONNECTION_STRING"];
  if (!databaseUrl) {
    log.fatal(
      "DATABASE_URL or POSTGRES_CONNECTION_STRING environment variable is required"
    );
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  try {
    log.info("Refreshing materialized views...");
    await sql`SELECT refresh_all_views()`;
    log.info("All views refreshed successfully");
  } catch (error) {
    log.fatal({ error }, "Failed to refresh views");
    process.exit(1);
  } finally {
    await sql.end();
  }
}

refreshViews();
