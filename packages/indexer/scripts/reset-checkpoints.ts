/**
 * Reset all indexer checkpoints
 * This forces indexers to restart from their configured startingBlock
 */

import postgres from "postgres";

async function resetCheckpoints() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const sql = postgres(databaseUrl);

  try {
    // Check if table exists
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = '_apibara_checkpoints'
    `;

    if (tables.length === 0) {
      console.log("No _apibara_checkpoints table found - nothing to reset");
      await sql.end();
      return;
    }

    // Show current checkpoints before reset
    const checkpoints = await sql`SELECT * FROM _apibara_checkpoints`;
    console.log(`Found ${checkpoints.length} checkpoint(s):`);
    for (const cp of checkpoints) {
      console.log(`  - ${cp.indexer_name}: block ${cp.order_key}`);
    }

    // Truncate the table
    await sql`TRUNCATE _apibara_checkpoints CASCADE`;
    console.log("✓ Checkpoints truncated successfully");
    console.log("Indexers will restart from their configured startingBlock");
  } catch (error) {
    console.error("Failed to reset checkpoints:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

resetCheckpoints();
