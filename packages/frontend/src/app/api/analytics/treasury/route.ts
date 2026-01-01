import { desc } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db, treasuryYieldSummary, ytTreasuryInterestRedeemed } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';

export const dynamic = 'force-dynamic';

interface TreasuryClaimEvent {
  id: string;
  yt: string;
  treasury: string;
  sy: string;
  amountSy: string;
  expiryIndex: string;
  currentIndex: string;
  totalYtSupply: string;
  blockNumber: number;
  blockTimestamp: string;
  transactionHash: string;
}

interface YtTreasurySummary {
  yt: string;
  treasury: string;
  totalSyClaimed: string;
  claimCount: number;
  lastClaim: string | null;
}

interface TreasuryAnalyticsResponse {
  totalSyClaimed: string;
  totalClaimCount: number;
  ytCount: number;
  summaryByYt: YtTreasurySummary[];
  recentClaims: TreasuryClaimEvent[];
}

/**
 * GET /api/analytics/treasury
 * Get aggregated treasury analytics across all YTs
 *
 * Query params:
 * - limit: number - max recent claims (default: 50)
 */
export async function GET(request: NextRequest): Promise<NextResponse<TreasuryAnalyticsResponse>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult as NextResponse<TreasuryAnalyticsResponse>;

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

  try {
    // Get summary from materialized view
    const summaryRows = await db.select().from(treasuryYieldSummary);

    const summaryByYt: YtTreasurySummary[] = summaryRows.map((row) => ({
      yt: row.yt ?? '',
      treasury: row.treasury ?? '',
      totalSyClaimed: row.total_sy_claimed ?? '0',
      claimCount: row.claim_count ?? 0,
      lastClaim: row.last_claim?.toISOString() ?? null,
    }));

    // Calculate aggregated totals
    let totalSyClaimed = BigInt(0);
    let totalClaimCount = 0;
    const ytSet = new Set<string>();

    for (const summary of summaryRows) {
      totalSyClaimed += BigInt(summary.total_sy_claimed ?? '0');
      totalClaimCount += summary.claim_count ?? 0;
      if (summary.yt) {
        ytSet.add(summary.yt);
      }
    }

    // Get recent claim events
    const claims = await db
      .select()
      .from(ytTreasuryInterestRedeemed)
      .orderBy(desc(ytTreasuryInterestRedeemed.block_timestamp))
      .limit(limit);

    const recentClaims: TreasuryClaimEvent[] = claims.map((row) => ({
      id: row._id,
      yt: row.yt,
      treasury: row.treasury,
      sy: row.sy,
      amountSy: row.amount_sy,
      expiryIndex: row.expiry_index,
      currentIndex: row.current_index,
      totalYtSupply: row.total_yt_supply,
      blockNumber: row.block_number,
      blockTimestamp: row.block_timestamp.toISOString(),
      transactionHash: row.transaction_hash,
    }));

    return NextResponse.json({
      totalSyClaimed: totalSyClaimed.toString(),
      totalClaimCount,
      ytCount: ytSet.size,
      summaryByYt,
      recentClaims,
    });
  } catch (error) {
    logError(error, { module: 'analytics/treasury' });
    return NextResponse.json(
      {
        totalSyClaimed: '0',
        totalClaimCount: 0,
        ytCount: 0,
        summaryByYt: [],
        recentClaims: [],
      },
      { status: 500 }
    );
  }
}
