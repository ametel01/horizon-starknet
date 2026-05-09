import { db, getDatabaseInfo, isDatabaseConnected, type PoolMode } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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

/** Indexer state from database query */
interface IndexerState {
  lastIndexedBlock: number | null;
  currentChainBlock: number | null;
  lagBlocks: number | null;
  error: string | null;
}

/** Empty indexer state when not connected */
const EMPTY_INDEXER_STATE: IndexerState = {
  lastIndexedBlock: null,
  currentChainBlock: null,
  lagBlocks: null,
  error: null,
};

/**
 * Determine health status based on connection and indexer state.
 * Pure function - easy to test and reason about.
 */
function deriveHealthStatus(
  connected: boolean,
  indexerState: IndexerState
): HealthResponse['status'] {
  if (!connected) return 'unhealthy';
  if (indexerState.error) return 'degraded';
  if (indexerState.lagBlocks !== null && indexerState.lagBlocks > 100) return 'degraded';
  return 'healthy';
}

/**
 * Fetch current Starknet block number from RPC
 */
async function getCurrentStarknetBlock(): Promise<number | null> {
  // @ts-expect-error TS4111
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpcUrl) return null;

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      cache: 'no-store',
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
 * Fetch indexer state from database.
 * Queries the latest indexed block and compares with chain head.
 */
async function fetchIndexerState(): Promise<IndexerState> {
  try {
    // Get the highest indexed block from airfoil.checkpoints
    const result = await db.execute<{ max_block: string | null }>(
      sql`SELECT MAX(order_key)::text as max_block FROM airfoil.checkpoints`
    );

    const row = result[0] as { max_block: string | null } | undefined;
    const lastIndexedBlock =
      row?.max_block !== null && row?.max_block !== undefined
        ? Number.parseInt(row.max_block, 10)
        : null;

    // Fetch current chain block to compare
    const currentChainBlock = await getCurrentStarknetBlock();

    const lagBlocks =
      lastIndexedBlock !== null && currentChainBlock !== null
        ? currentChainBlock - lastIndexedBlock
        : null;

    return { lastIndexedBlock, currentChainBlock, lagBlocks, error: null };
  } catch (error) {
    logError(error, { module: 'health' });
    return {
      lastIndexedBlock: null,
      currentChainBlock: null,
      lagBlocks: null,
      error: error instanceof Error ? error.message : 'Failed to query indexer data',
    };
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

  // Fetch indexer state only if connected
  const indexerState = connected ? await fetchIndexerState() : EMPTY_INDEXER_STATE;

  // Derive health status from state
  const status = deriveHealthStatus(connected, indexerState);

  return NextResponse.json({
    status,
    database: {
      connected,
      host: dbInfo.host,
      usePooler: dbInfo.usePooler,
      poolMode: dbInfo.poolMode,
      source: dbInfo.source,
    },
    indexer: indexerState,
    timestamp: new Date().toISOString(),
  });
}
