/**
 * Refresh all materialized views
 * Run this periodically to update view data
 */

import postgres from "postgres";

async function refreshViews() {
  const databaseUrl =
    process.env.DATABASE_URL ?? process.env.POSTGRES_CONNECTION_STRING;
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL or POSTGRES_CONNECTION_STRING environment variable is required",
    );
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  try {
    console.log("Refreshing materialized views...");
    await sql`SELECT refresh_all_views()`;
    console.log("All views refreshed successfully.");
  } catch (error) {
    console.error("Failed to refresh views:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

refreshViews();
