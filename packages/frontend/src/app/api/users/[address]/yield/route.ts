import { db, userPyPositions, ytInterestClaimed } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { and, desc, gte, or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Normalize a Starknet address for database comparison.
 * Pads the address to full 66 characters (0x + 64 hex chars) and lowercases it.
 */
function normalizeAddressForDb(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  const padded = hex.padStart(64, '0');
  return `0x${padded}`;
}

interface YieldClaimEvent {
  id: string;
  yt: string;
  sy: string;
  expiry: number;
  amountSy: string;
  ytBalance: string;
  pyIndexAtClaim: string;
  exchangeRate: string;
  blockTimestamp: string;
  transactionHash: string;
}

interface YieldSummary {
  yt: string;
  sy: string;
  totalClaimed: string;
  claimCount: number;
  lastClaim: string | null;
  currentYtBalance: string;
}

interface YieldResponse {
  address: string;
  totalYieldClaimed: string;
  claimHistory: YieldClaimEvent[];
  summaryByPosition: YieldSummary[];
}

/**
 * GET /api/users/[address]/yield
 * Get yield earned/claimed for a user
 *
 * Query params:
 * - days: number - how many days of history (default: all)
 * - limit: number - max claim events (default: 100)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<YieldResponse>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'USER');
  if (rateLimitResult) return rateLimitResult as NextResponse<YieldResponse>;

  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  const days = searchParams.get('days');
  const limit = Math.min(Number.parseInt(searchParams.get('limit') ?? '100', 10), 500);

  try {
    // Normalize the address for comparison
    const normalizedAddress = normalizeAddressForDb(address);

    // Build address match condition
    const addressMatch = or(
      sql`LOWER(${ytInterestClaimed.user}) = ${normalizedAddress}`,
      sql`LOWER(${ytInterestClaimed.user}) = ${address.toLowerCase()}`
    );

    // Build conditions
    const conditions = days
      ? and(
          addressMatch,
          gte(
            ytInterestClaimed.block_timestamp,
            new Date(Date.now() - Number.parseInt(days, 10) * 86400000)
          )
        )
      : addressMatch;

    // Get claim history
    const claims = await db
      .select()
      .from(ytInterestClaimed)
      .where(conditions)
      .orderBy(desc(ytInterestClaimed.block_timestamp))
      .limit(limit);

    const claimHistory: YieldClaimEvent[] = claims.map((row) => ({
      id: row._id,
      yt: row.yt,
      sy: row.sy,
      expiry: row.expiry,
      amountSy: row.amount_sy,
      ytBalance: row.yt_balance,
      pyIndexAtClaim: row.py_index_at_claim,
      exchangeRate: row.exchange_rate,
      blockTimestamp: row.block_timestamp.toISOString(),
      transactionHash: row.transaction_hash,
    }));

    // Calculate total yield claimed
    let totalYieldClaimed = BigInt(0);
    for (const claim of claims) {
      totalYieldClaimed += BigInt(claim.amount_sy);
    }

    // Get summary by position from materialized view
    const positions = await db
      .select()
      .from(userPyPositions)
      .where(
        or(
          sql`LOWER(${userPyPositions.user_address}) = ${normalizedAddress}`,
          sql`LOWER(${userPyPositions.user_address}) = ${address.toLowerCase()}`
        )
      );

    const summaryByPosition: YieldSummary[] = positions
      .filter(
        (p) => BigInt(p.total_interest_claimed ?? '0') > 0n || BigInt(p.yt_balance ?? '0') > 0n
      )
      .map((row) => ({
        yt: row.yt ?? '',
        sy: row.sy ?? '',
        totalClaimed: row.total_interest_claimed ?? '0',
        claimCount: row.claim_count ?? 0,
        lastClaim: row.last_activity?.toISOString() ?? null,
        currentYtBalance: row.yt_balance ?? '0',
      }));

    return NextResponse.json({
      address,
      totalYieldClaimed: totalYieldClaimed.toString(),
      claimHistory,
      summaryByPosition,
    });
  } catch (error) {
    logError(error, { module: 'users/yield', address });
    return NextResponse.json(
      {
        address,
        totalYieldClaimed: '0',
        claimHistory: [],
        summaryByPosition: [],
      },
      { status: 500 }
    );
  }
}
