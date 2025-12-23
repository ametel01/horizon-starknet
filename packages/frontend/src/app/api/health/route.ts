import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db, getDatabaseInfo, isDatabaseConnected, type PoolMode } from '@/lib/db';
import { marketSwap } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: {
    connected: boolean;
    host: string | null;
    usePooler: boolean;
    poolMode: PoolMode | null;
    source: 'DATABASE_POOLER_URL' | 'DATABASE_URL' | null;
  };
  indexer: {
    lastEventTimestamp: string | null;
    lastBlockNumber: number | null;
    lagSeconds: number | null;
    error: string | null;
  };
  timestamp: string;
}

/**
 * GET /api/health
 * Health check endpoint for monitoring indexer status
 */
export async function GET(): Promise<NextResponse<HealthResponse>> {
  const dbInfo = getDatabaseInfo();
  const connected = await isDatabaseConnected();

  let lastEventTimestamp: string | null = null;
  let lastBlockNumber: number | null = null;
  let lagSeconds: number | null = null;
  let queryError: string | null = null;

  if (connected) {
    try {
      // Get most recent event to check indexer lag
      const [latestEvent] = await db
        .select({
          block_timestamp: marketSwap.block_timestamp,
          block_number: marketSwap.block_number,
        })
        .from(marketSwap)
        .orderBy(desc(marketSwap.block_timestamp))
        .limit(1);

      if (latestEvent) {
        lastEventTimestamp = latestEvent.block_timestamp.toISOString();
        lastBlockNumber = latestEvent.block_number;

        lagSeconds = Math.floor((Date.now() - latestEvent.block_timestamp.getTime()) / 1000);
      }
    } catch (error) {
      console.error('[health] Error fetching indexer status:', error);
      queryError = error instanceof Error ? error.message : 'Failed to query indexer data';
    }
  }

  // Determine health status
  let status: HealthResponse['status'] = 'healthy';
  if (!connected) {
    status = 'unhealthy';
  } else if (queryError) {
    // Can connect but can't query tables (permission issues, etc.)
    status = 'degraded';
  } else if (lagSeconds !== null && lagSeconds > 300) {
    // More than 5 minutes behind
    status = 'degraded';
  }

  return NextResponse.json({
    status,
    database: {
      connected,
      host: dbInfo.host,
      usePooler: dbInfo.usePooler,
      poolMode: dbInfo.poolMode,
      source: dbInfo.source,
    },
    indexer: {
      lastEventTimestamp,
      lastBlockNumber,
      lagSeconds,
      error: queryError,
    },
    timestamp: new Date().toISOString(),
  });
}
