import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db, getDatabaseInfo, isDatabaseConnected } from '@/lib/db';
import { marketSwap } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: {
    connected: boolean;
    host: string | null;
  };
  indexer: {
    lastEventTimestamp: string | null;
    lastBlockNumber: number | null;
    lagSeconds: number | null;
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
    }
  }

  // Determine health status
  let status: HealthResponse['status'] = 'healthy';
  if (!connected) {
    status = 'unhealthy';
  } else if (lagSeconds !== null && lagSeconds > 300) {
    // More than 5 minutes behind
    status = 'degraded';
  }

  return NextResponse.json({
    status,
    database: {
      connected,
      host: dbInfo.host,
    },
    indexer: {
      lastEventTimestamp,
      lastBlockNumber,
      lagSeconds,
    },
    timestamp: new Date().toISOString(),
  });
}
