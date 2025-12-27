/**
 * Shared database configuration for all indexers
 *
 * Configures connection pool settings for optimal performance with Railway PostgreSQL
 */

import type { PoolConfig } from "pg";

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
