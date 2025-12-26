import { sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db, getDatabaseInfo, isDatabaseConnected, type PoolMode } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';

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
    lastIndexedBlock: number | null;
    currentChainBlock: number | null;
    lagBlocks: number | null;
    error: string | null;
  };
  timestamp: string;
}

/**
 * Fetch current Starknet block number from RPC
 */
async function getCurrentStarknetBlock(): Promise<number | null> {
  const rpcUrl = process.env['NEXT_PUBLIC_RPC_URL'];
  if (!rpcUrl) return null;

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'starknet_blockNumber',
        params: [],
        id: 1,
      }),
      // Short timeout for health check
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { result?: number };
    return data.result ?? null;
  } catch {
    return null;
  }
}

/**
 * GET /api/health
 * Health check endpoint for monitoring indexer status
 *
 * Compares the latest indexed block (from airfoil.checkpoints) against
 * the current Starknet chain head to determine indexer health.
 */
export async function GET(request: NextRequest): Promise<NextResponse<HealthResponse>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'HEALTH');
  if (rateLimitResult) return rateLimitResult as NextResponse<HealthResponse>;

  const dbInfo = getDatabaseInfo();
  const connected = await isDatabaseConnected();

  let lastIndexedBlock: number | null = null;
  let currentChainBlock: number | null = null;
  let lagBlocks: number | null = null;
  let queryError: string | null = null;

  if (connected) {
    try {
      // Get the highest indexed block from airfoil.checkpoints
      // The order_key column contains the latest block number processed by each indexer
      const result = await db.execute<{ max_block: string | null }>(
        sql`SELECT MAX(order_key)::text as max_block FROM airfoil.checkpoints`
      );

      const row = result[0] as { max_block: string | null } | undefined;
      if (row?.max_block !== null && row?.max_block !== undefined) {
        lastIndexedBlock = parseInt(row.max_block, 10);
      }

      // Fetch current chain block to compare
      currentChainBlock = await getCurrentStarknetBlock();

      if (lastIndexedBlock !== null && currentChainBlock !== null) {
        lagBlocks = currentChainBlock - lastIndexedBlock;
      }
    } catch (error) {
      logError(error, { module: 'health' });
      queryError = error instanceof Error ? error.message : 'Failed to query indexer data';
    }
  }

  // Determine health status based on block lag
  let status: HealthResponse['status'] = 'healthy';
  if (!connected) {
    status = 'unhealthy';
  } else if (queryError) {
    // Can connect but can't query tables (permission issues, etc.)
    status = 'degraded';
  } else if (lagBlocks !== null && lagBlocks > 100) {
    // More than ~100 blocks behind (~8-15 minutes on Starknet)
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
      lastIndexedBlock,
      currentChainBlock,
      lagBlocks,
      error: queryError,
    },
    timestamp: new Date().toISOString(),
  });
}
