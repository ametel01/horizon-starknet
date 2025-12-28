/**
 * Cleanup stale reorg triggers
 *
 * The Apibara drizzle plugin creates constraint triggers for reorg handling.
 * If the indexer crashes during startup, these triggers can be left behind,
 * causing "trigger already exists" errors on subsequent starts.
 *
 * This script drops all reorg triggers to ensure a clean slate.
 */

import postgres from "postgres";

import { createScriptLogger } from "../src/lib/logger";

const log = createScriptLogger("cleanup-triggers");

async function cleanupTriggers() {
  const databaseUrl =
    process.env["DATABASE_URL"] ?? process.env["POSTGRES_CONNECTION_STRING"];
  if (!databaseUrl) {
    log.fatal(
      "DATABASE_URL or POSTGRES_CONNECTION_STRING environment variable is required",
    );
    process.exit(1);
  }

  log.info("Connecting to database...");
  const sql = postgres(databaseUrl);

  try {
    log.info("Dropping reorg triggers...");

    // Query for all triggers that match the Apibara reorg pattern
    const triggers = await sql<{ trigger_name: string; event_object_table: string }[]>`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name LIKE '%_reorg_%'
    `;

    if (triggers.length === 0) {
      log.info("No reorg triggers found");
      return;
    }

    log.info({ count: triggers.length }, "Found reorg triggers to drop");

    for (const { trigger_name, event_object_table } of triggers) {
      try {
        await sql.unsafe(
          `DROP TRIGGER IF EXISTS ${trigger_name} ON ${event_object_table}`,
        );
        log.debug({ trigger: trigger_name, table: event_object_table }, "Dropped trigger");
      } catch (e: unknown) {
        const error = e as Error;
        log.warn(
          { trigger: trigger_name, table: event_object_table, error: error.message },
          "Could not drop trigger",
        );
      }
    }

    log.info("Trigger cleanup complete");
  } catch (error) {
    log.error({ error }, "Failed to cleanup triggers");
    // Don't exit with error - let the indexers try anyway
  } finally {
    await sql.end();
  }
}

cleanupTriggers();
