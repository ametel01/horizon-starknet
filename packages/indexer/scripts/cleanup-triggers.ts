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
      "DATABASE_URL or POSTGRES_CONNECTION_STRING environment variable is required"
    );
    process.exit(1);
  }

  log.info(
    { url: databaseUrl.replace(/:[^:@]+@/, ":***@") },
    "Connecting to database..."
  );
  const sql = postgres(databaseUrl, {
    connect_timeout: 10, // 10 second connection timeout
    idle_timeout: 10,
    max_lifetime: 30,
  });

  try {
    // Verify connection works and check database
    const dbInfo = await sql<
      { db: string; schema: string }[]
    >`SELECT current_database() as db, current_schema() as schema`;
    log.info(
      { database: dbInfo[0]?.db, schema: dbInfo[0]?.schema },
      "Database connection verified"
    );

    // Check total trigger count to verify query works
    const allTriggers = await sql<{ cnt: string }[]>`
      SELECT count(*) as cnt FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public'
    `;
    log.info(
      { totalPublicTriggers: allTriggers[0]?.cnt },
      "Trigger count in public schema"
    );

    log.info("Querying for reorg triggers in pg_trigger...");

    // Query for all triggers that match the Apibara reorg pattern
    // NOTE: We must use pg_trigger, not information_schema.triggers, because
    // Apibara creates CONSTRAINT TRIGGERS which don't appear in information_schema
    const triggers = await sql<{ trigger_name: string; table_name: string }[]>`
      SELECT t.tgname as trigger_name, c.relname as table_name
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE t.tgname LIKE '%_reorg_%'
        AND n.nspname = 'public'
    `;

    log.info({ rawCount: triggers.length }, "Query completed");

    if (triggers.length === 0) {
      log.info("No reorg triggers found in database");
    } else {
      log.info(
        {
          count: triggers.length,
          triggers: triggers.map((t) => t.trigger_name),
        },
        "Found reorg triggers to drop"
      );

      for (const { trigger_name, table_name } of triggers) {
        try {
          await sql.unsafe(
            `DROP TRIGGER IF EXISTS "${trigger_name}" ON "${table_name}"`
          );
          log.info(
            { trigger: trigger_name, table: table_name },
            "Dropped trigger"
          );
        } catch (e: unknown) {
          const error = e as Error;
          log.warn(
            {
              trigger: trigger_name,
              table: table_name,
              error: error.message,
            },
            "Could not drop trigger"
          );
        }
      }

      log.info("Trigger cleanup complete");
    }
  } catch (error) {
    log.error({ error }, "Failed to cleanup triggers");
    // Don't exit with error - let the indexers try anyway
  } finally {
    await sql.end();
  }
}

cleanupTriggers();
