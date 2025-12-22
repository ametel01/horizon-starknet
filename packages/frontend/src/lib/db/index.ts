/**
 * Database connection for indexed event data
 *
 * This module provides a Drizzle ORM connection to the PostgreSQL database
 * populated by the Horizon indexer. It should only be used in server-side
 * code (API routes, Server Components, Server Actions).
 *
 * @example
 * ```typescript
 * import { db } from '@/lib/db';
 * import { marketDailyStats } from '@/lib/db/schema';
 *
 * const stats = await db.select().from(marketDailyStats).limit(10);
 * ```
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

// Re-export schema for convenience
export * from './schema';

// Validate environment variable
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Don't throw immediately - allow build to complete
  // Runtime will fail if DATABASE_URL is not set
  console.warn('[db] DATABASE_URL not set - database queries will fail');
}

/**
 * PostgreSQL client with connection pooling settings optimized for serverless
 *
 * - max: 1 connection per serverless instance (scales horizontally)
 * - idle_timeout: 20 seconds before closing idle connections
 * - connect_timeout: 10 seconds to establish connection
 */
const client = postgres(connectionString ?? '', {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // Required for some connection poolers (PgBouncer, Supabase)
});

/**
 * Drizzle ORM database instance
 *
 * Use this for all database queries. The schema is automatically loaded
 * from the indexer package.
 */
export const db = drizzle(client, { schema });

/**
 * Check if database connection is available
 * Useful for health checks
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
 * Get database connection info for debugging
 */
export function getDatabaseInfo(): { configured: boolean; host: string | null } {
  if (!connectionString) {
    return { configured: false, host: null };
  }
  try {
    const url = new URL(connectionString);
    return { configured: true, host: url.host };
  } catch {
    return { configured: true, host: 'invalid-url' };
  }
}
