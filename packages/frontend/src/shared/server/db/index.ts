/**
 * Database connection for indexed event data
 *
 * This module provides a Drizzle ORM connection to the PostgreSQL database
 * populated by the Horizon indexer. It should only be used in server-side
 * code (API routes, Server Components, Server Actions).
 *
 * ## Connection Pooler Support (Recommended for Production)
 *
 * This module supports connection poolers like PgBouncer, Supabase Pooler,
 * and Neon's pooler. Using a pooler is recommended for serverless deployments
 * to handle connection limits efficiently.
 *
 * ### Environment Variables
 *
 * - `DATABASE_POOLER_URL`: Connection string for pooled connections (preferred)
 * - `DATABASE_URL`: Direct connection string (fallback)
 *
 * The module will automatically use `DATABASE_POOLER_URL` if available,
 * falling back to `DATABASE_URL`. Pooler-specific settings are auto-detected
 * from URL parameters.
 *
 * ### Example URLs
 *
 * ```bash
 * # PgBouncer
 * DATABASE_POOLER_URL=postgres://user:pass@pgbouncer.host:6543/db?pgbouncer=true
 *
 * # Supabase Pooler (Transaction mode)
 * DATABASE_POOLER_URL=postgres://user:pass@db.project.supabase.co:6543/postgres?pgbouncer=true
 *
 * # Neon Pooler
 * DATABASE_POOLER_URL=postgres://user:pass@ep-cool-name-pooler.region.aws.neon.tech/db?sslmode=require
 *
 * # Direct connection (development)
 * DATABASE_URL=postgres://user:pass@localhost:5432/horizon_indexer
 * ```
 *
 * @example
 * ```typescript
 * import { db } from '@shared/server/db';
 * import { marketDailyStats } from '@shared/server/db/schema';
 *
 * const stats = await db.select().from(marketDailyStats).limit(10);
 * ```
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

// Re-export schema for convenience
export * from './schema';

// ============================================================================
// Connection Configuration
// ============================================================================

/**
 * Get the database connection string.
 * Prefers DATABASE_POOLER_URL over DATABASE_URL for pooled connections.
 */
function getConnectionString(): string | undefined {
  return process.env['DATABASE_POOLER_URL'] ?? process.env['DATABASE_URL'];
}

/**
 * Detect if the connection string is for a pooler.
 * Checks for common pooler indicators in the URL.
 */
function isPoolerConnection(url: string): boolean {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;

    // Check for explicit pooler parameters
    if (params.has('pgbouncer')) return true;
    if (params.get('connection_limit') !== null) return true;

    // Check for common pooler hostnames
    const host = parsed.hostname.toLowerCase();
    if (host.includes('pooler')) return true;
    if (host.includes('pgbouncer')) return true;

    // Check for pooler ports (6543 is common for PgBouncer/Supabase)
    if (parsed.port === '6543') return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Connection pool mode detection
 */
export type PoolMode = 'transaction' | 'session' | 'statement';

/**
 * Detect the pool mode from URL parameters.
 * Defaults to 'transaction' for pooled connections.
 */
function detectPoolMode(url: string): PoolMode | null {
  try {
    const parsed = new URL(url);
    const mode = parsed.searchParams.get('pool_mode');
    if (mode === 'session' || mode === 'transaction' || mode === 'statement') {
      return mode;
    }
    // Default to transaction mode for poolers (most common)
    return isPoolerConnection(url) ? 'transaction' : null;
  } catch {
    return null;
  }
}

// Get connection configuration
const connectionString = getConnectionString();
const usePooler = connectionString ? isPoolerConnection(connectionString) : false;
const poolMode = connectionString ? detectPoolMode(connectionString) : null;

if (!connectionString) {
  // Don't throw immediately - allow build to complete
  // Runtime will fail if neither DATABASE_POOLER_URL nor DATABASE_URL is set
  console.warn('[db] No database URL configured - database queries will fail');
  console.warn('[db] Set DATABASE_POOLER_URL (recommended) or DATABASE_URL');
}

// ============================================================================
// PostgreSQL Client Configuration
// ============================================================================

/**
 * PostgreSQL client configuration optimized for the connection type.
 *
 * For pooled connections (PgBouncer, Supabase, Neon):
 * - prepare: false - Required for transaction/statement pooling modes
 * - max: 1 - Let the pooler handle connection scaling
 * - idle_timeout: 0 - Keep connections alive (pooler manages lifecycle)
 * - fetch_types: false - Skip type fetching (faster cold starts)
 *
 * For direct connections:
 * - prepare: true - Use prepared statements for performance
 * - max: 1 - Single connection per serverless instance
 * - idle_timeout: 20 - Close idle connections to free resources
 */
const clientOptions: postgres.Options<Record<string, never>> = usePooler
  ? {
      // Pooler-optimized settings
      max: 1,
      idle_timeout: 0, // Pooler manages connection lifecycle
      connect_timeout: 10,
      prepare: false, // Required for PgBouncer transaction/statement mode
      fetch_types: false, // Skip type fetching for faster cold starts
    }
  : {
      // Direct connection settings
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // Keep false for compatibility, can enable for direct connections
    };

const client = postgres(connectionString ?? '', clientOptions);

/**
 * Drizzle ORM database instance
 *
 * Use this for all database queries. The schema is automatically loaded
 * and provides full type safety.
 */
export const db = drizzle(client, { schema });

// ============================================================================
// Health Check & Debugging Utilities
// ============================================================================

/**
 * Database connection information for health checks and debugging
 */
export interface DatabaseInfo {
  /** Whether a database URL is configured */
  configured: boolean;
  /** Database host (sanitized, no credentials) */
  host: string | null;
  /** Whether using a connection pooler */
  usePooler: boolean;
  /** Detected pool mode (transaction, session, statement) */
  poolMode: PoolMode | null;
  /** Which environment variable is being used */
  source: 'DATABASE_POOLER_URL' | 'DATABASE_URL' | null;
}

/**
 * Check if database connection is available.
 * Useful for health check endpoints.
 *
 * @returns true if database is reachable
 */
export async function isDatabaseConnected(): Promise<boolean> {
  if (!connectionString) {
    return false;
  }
  try {
    await client`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Get database connection info for debugging and health checks.
 * Credentials are not exposed.
 *
 * @returns Connection information object
 */
export function getDatabaseInfo(): DatabaseInfo {
  if (!connectionString) {
    return {
      configured: false,
      host: null,
      usePooler: false,
      poolMode: null,
      source: null,
    };
  }

  try {
    const url = new URL(connectionString);
    const source = process.env['DATABASE_POOLER_URL'] ? 'DATABASE_POOLER_URL' : 'DATABASE_URL';

    return {
      configured: true,
      host: url.host,
      usePooler,
      poolMode,
      source,
    };
  } catch {
    return {
      configured: true,
      host: 'invalid-url',
      usePooler: false,
      poolMode: null,
      source: null,
    };
  }
}

/**
 * Get a summary string of the database configuration.
 * Useful for logging on startup.
 *
 * @returns Human-readable configuration summary
 */
export function getDatabaseConfigSummary(): string {
  const info = getDatabaseInfo();

  if (!info.configured) {
    return 'Database not configured';
  }

  const parts = [`host=${info.host ?? 'unknown'}`, info.usePooler ? 'pooler=yes' : 'pooler=no'];

  if (info.poolMode) {
    parts.push(`mode=${info.poolMode}`);
  }

  if (info.source) {
    parts.push(`source=${info.source}`);
  }

  return parts.join(', ');
}
