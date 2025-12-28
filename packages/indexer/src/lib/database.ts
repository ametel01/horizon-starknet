/**
 * Shared database configuration for all indexers
 *
 * Configures connection pool settings for optimal performance with Railway PostgreSQL.
 * Provides pool management with graceful shutdown support.
 */

import { Pool } from "pg";

import { logger } from "./logger";
import { registerCleanup } from "./shutdown";

import type { Logger } from "./logger";
import type { PoolConfig } from "pg";

const log: Logger = logger.child({ module: "database" });

/**
 * PostgreSQL connection pool configuration
 *
 * Pool size considerations:
 * - Railway's Hobby plan: max 20 connections
 * - Railway's Pro plan: max 100+ connections
 * - With 6 parallel indexers, each gets ~3 connections on Hobby, ~16 on Pro
 *
 * Adjust these values based on your Railway plan and observed performance.
 */
export const poolConfig: PoolConfig = {
  // Maximum connections per indexer (6 indexers × max = total connections)
  // For Railway Hobby (20 max): use 3
  // For Railway Pro (100+ max): use 10-15
  max: Number(process.env["PG_POOL_MAX"]) || 10,

  // Minimum connections to keep open
  min: Number(process.env["PG_POOL_MIN"]) || 2,

  // How long a client can sit idle before being closed (ms)
  idleTimeoutMillis: 30000,

  // How long to wait for a connection from the pool (ms)
  connectionTimeoutMillis: 10000,

  // Keep connections alive with periodic queries
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

/**
 * Singleton database pool instance
 */
let pool: Pool | null = null;

/**
 * Track whether cleanup has been registered
 */
let cleanupRegistered = false;

/**
 * Get or create the database connection pool
 *
 * The pool is lazily initialized on first call and reused thereafter.
 * Cleanup is automatically registered with the shutdown handler.
 *
 * @returns The database connection pool
 * @throws Error if POSTGRES_CONNECTION_STRING is not set
 */
export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env["POSTGRES_CONNECTION_STRING"];
  if (!connectionString) {
    throw new Error(
      "POSTGRES_CONNECTION_STRING environment variable is required",
    );
  }

  pool = new Pool({
    connectionString,
    ...poolConfig,
  });

  // Register error handler to prevent unhandled rejections
  pool.on("error", (err) => {
    log.error({ err }, "Unexpected pool error");
  });

  log.info(
    {
      max: poolConfig.max,
      min: poolConfig.min,
      idleTimeoutMillis: poolConfig.idleTimeoutMillis,
    },
    "Database pool created",
  );

  // Register cleanup with shutdown handler (only once)
  if (!cleanupRegistered) {
    registerCleanup("database-pool", async () => {
      if (pool) {
        await pool.end();
        pool = null;
        log.info("Database pool closed");
      }
    });
    cleanupRegistered = true;
  }

  return pool;
}

/**
 * Check database connection health
 *
 * Attempts to acquire a connection and execute a simple query.
 * Use this on startup to fail fast if the database is unavailable.
 *
 * @throws Error if the database is not reachable
 */
export async function checkDatabaseConnection(): Promise<void> {
  const currentPool = getPool();

  try {
    const client = await currentPool.connect();
    try {
      await client.query("SELECT 1");
      log.info("Database connection verified");
    } finally {
      client.release();
    }
  } catch (err) {
    log.fatal({ err }, "Database connection check failed");
    throw err;
  }
}

/**
 * Get database pool statistics
 *
 * Useful for monitoring and diagnostics.
 *
 * @returns Pool statistics or null if pool not initialized
 */
export function getPoolStats(): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
} | null {
  if (!pool) {
    return null;
  }

  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

/**
 * Close the database pool manually
 *
 * Normally the pool is closed via the shutdown handler, but this can be
 * used for manual cleanup in tests or specific scenarios.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    log.info("Database pool closed manually");
  }
}

/**
 * Get drizzle database options with pool configuration
 */
export function getDrizzleOptions<TSchema extends Record<string, unknown>>(
  schema: TSchema,
): {
  type: "node-postgres";
  connectionString: string;
  poolConfig: PoolConfig;
  schema: TSchema;
} {
  const connectionString = process.env["POSTGRES_CONNECTION_STRING"];
  if (!connectionString) {
    throw new Error(
      "POSTGRES_CONNECTION_STRING environment variable is required",
    );
  }
  return {
    type: "node-postgres" as const,
    connectionString,
    poolConfig,
    schema,
  };
}
