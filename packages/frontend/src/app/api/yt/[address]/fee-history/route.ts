import { desc, or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db, ytFeeAnalytics, ytInterestFeeRateSet } from '@shared/server/db';
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

interface FeeRateChange {
  id: string;
  yt: string;
  oldRate: string;
  newRate: string;
  blockNumber: number;
  blockTimestamp: string;
  transactionHash: string;
}

interface FeeAnalytics {
  yt: string;
  currentFeeRate: string | null;
  rateChangeCount: number;
  lastChange: string | null;
}

interface FeeHistoryResponse {
  ytAddress: string;
  analytics: FeeAnalytics | null;
  history: FeeRateChange[];
}

/**
 * GET /api/yt/[address]/fee-history
 * Get fee rate history and analytics for a YT contract
 *
 * Query params:
 * - limit: number - max history events (default: 50)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<FeeHistoryResponse>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult as NextResponse<FeeHistoryResponse>;

  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

  try {
    const normalizedAddress = normalizeAddressForDb(address);

    // Build address match condition
    const addressMatch = or(
      sql`LOWER(${ytInterestFeeRateSet.yt}) = ${normalizedAddress}`,
      sql`LOWER(${ytInterestFeeRateSet.yt}) = ${address.toLowerCase()}`
    );

    // Get fee rate change history
    const changes = await db
      .select()
      .from(ytInterestFeeRateSet)
      .where(addressMatch)
      .orderBy(desc(ytInterestFeeRateSet.block_timestamp))
      .limit(limit);

    const history: FeeRateChange[] = changes.map((row) => ({
      id: row._id,
      yt: row.yt,
      oldRate: row.old_rate,
      newRate: row.new_rate,
      blockNumber: row.block_number,
      blockTimestamp: row.block_timestamp.toISOString(),
      transactionHash: row.transaction_hash,
    }));

    // Get analytics from materialized view
    const analyticsMatch = or(
      sql`LOWER(${ytFeeAnalytics.yt}) = ${normalizedAddress}`,
      sql`LOWER(${ytFeeAnalytics.yt}) = ${address.toLowerCase()}`
    );

    const analyticsRows = await db.select().from(ytFeeAnalytics).where(analyticsMatch).limit(1);

    const analyticsRow = analyticsRows[0];
    const analytics: FeeAnalytics | null = analyticsRow
      ? {
          yt: analyticsRow.yt ?? address,
          currentFeeRate: analyticsRow.current_fee_rate,
          rateChangeCount: analyticsRow.rate_change_count ?? 0,
          lastChange: analyticsRow.last_change?.toISOString() ?? null,
        }
      : null;

    return NextResponse.json({
      ytAddress: address,
      analytics,
      history,
    });
  } catch (error) {
    logError(error, { module: 'yt/fee-history', address });
    return NextResponse.json(
      {
        ytAddress: address,
        analytics: null,
        history: [],
      },
      { status: 500 }
    );
  }
}
