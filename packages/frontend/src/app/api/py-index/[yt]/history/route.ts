import { desc, or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db, ytPyIndexUpdated } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Normalize a Starknet address for database comparison.
 * Pads the address to full 66 characters (0x + 64 hex chars) and lowercases it.
 */
function normalizeAddressForDb(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  const padded = hex.padStart(64, '0');
  return '0x' + padded;
}

interface PyIndexUpdate {
  id: string;
  yt: string;
  oldIndex: string;
  newIndex: string;
  exchangeRate: string;
  indexBlockNumber: number;
  blockNumber: number;
  blockTimestamp: string;
  transactionHash: string;
}

interface PyIndexHistoryResponse {
  ytAddress: string;
  currentIndex: string | null;
  updateCount: number;
  history: PyIndexUpdate[];
}

/**
 * GET /api/py-index/[yt]/history
 * Get PY index update history for a YT contract
 *
 * Query params:
 * - limit: number - max history events (default: 100)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ yt: string }> }
): Promise<NextResponse<PyIndexHistoryResponse>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult as NextResponse<PyIndexHistoryResponse>;

  const { yt: ytAddress } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);

  try {
    const normalizedAddress = normalizeAddressForDb(ytAddress);

    // Build address match condition
    const addressMatch = or(
      sql`LOWER(${ytPyIndexUpdated.yt}) = ${normalizedAddress}`,
      sql`LOWER(${ytPyIndexUpdated.yt}) = ${ytAddress.toLowerCase()}`
    );

    // Get PY index update history
    const rows = await db
      .select()
      .from(ytPyIndexUpdated)
      .where(addressMatch)
      .orderBy(desc(ytPyIndexUpdated.block_timestamp))
      .limit(limit);

    const history: PyIndexUpdate[] = rows.map((row) => ({
      id: row._id,
      yt: row.yt,
      oldIndex: row.old_index,
      newIndex: row.new_index,
      exchangeRate: row.exchange_rate,
      indexBlockNumber: row.index_block_number,
      blockNumber: row.block_number,
      blockTimestamp: row.block_timestamp.toISOString(),
      transactionHash: row.transaction_hash,
    }));

    // Get the most recent index (current index)
    const latestRow = rows[0];
    const currentIndex = latestRow ? latestRow.new_index : null;

    return NextResponse.json({
      ytAddress,
      currentIndex,
      updateCount: history.length,
      history,
    });
  } catch (error) {
    logError(error, { module: 'py-index/history', ytAddress });
    return NextResponse.json(
      {
        ytAddress,
        currentIndex: null,
        updateCount: 0,
        history: [],
      },
      { status: 500 }
    );
  }
}
