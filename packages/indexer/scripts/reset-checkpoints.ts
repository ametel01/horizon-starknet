/**
 * Reset all indexer checkpoints
 * This forces indexers to restart from their configured startingBlock
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
    // List ALL tables in the database
    const allTables = await sql`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `;
    console.log(`\nAll tables in database (${allTables.length}):`);
    for (const t of allTables) {
      console.log(`  - ${t.table_schema}.${t.table_name}`);
    }

    // Find checkpoint-related tables (Apibara v2 may use different names)
    const tables = await sql`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name LIKE '%checkpoint%'
         OR table_name LIKE '%apibara%'
         OR table_name LIKE '%cursor%'
         OR table_schema = 'airfoil'
      ORDER BY table_schema, table_name
    `;

    console.log(`Found ${tables.length} potential checkpoint table(s):`);
    for (const t of tables) {
      console.log(`  - ${t.table_schema}.${t.table_name}`);
    }

    if (tables.length === 0) {
      console.log("No checkpoint tables found - nothing to reset");
      await sql.end();
      return;
    }

    // Try to truncate known checkpoint tables
    const tablesToTruncate = [
      "_apibara_checkpoints",
      "airfoil.reorg_rollback",
    ];

    for (const table of tablesToTruncate) {
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

    console.log("✓ Checkpoint reset complete");
    console.log("Indexers will restart from their configured startingBlock");
  } catch (error) {
    console.error("Failed to reset checkpoints:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

resetCheckpoints();
