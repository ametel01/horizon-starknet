import { eq, desc, and, gte } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { db, marketSwap } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface SwapEvent {
  id: string;
  blockNumber: number;
  blockTimestamp: string;
  transactionHash: string;
  sender: string;
  receiver: string;
  ptIn: string;
  syIn: string;
  ptOut: string;
  syOut: string;
  fee: string;
  impliedRateBefore: string;
  impliedRateAfter: string;
  exchangeRate: string;
}

interface SwapsResponse {
  swaps: SwapEvent[];
  total: number;
  hasMore: boolean;
}

/**
 * GET /api/markets/[address]/swaps
 * Get swap history for a market
 *
 * Query params:
 * - limit: number - max results (default 50, max 100)
 * - offset: number - pagination offset
 * - since: ISO date string - filter swaps after this date
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<SwapsResponse>> {
  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0');
  const since = searchParams.get('since');

  try {
    // Build conditions
    const conditions = [eq(marketSwap.market, address)];

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        conditions.push(gte(marketSwap.block_timestamp, sinceDate));
      }
    }

    const results = await db
      .select()
      .from(marketSwap)
      .where(and(...conditions))
      .orderBy(desc(marketSwap.block_timestamp))
      .limit(limit + 1) // Fetch one extra to check hasMore
      .offset(offset);

    const hasMore = results.length > limit;
    const swaps: SwapEvent[] = results.slice(0, limit).map((row) => ({
      id: row._id,
      blockNumber: row.block_number,
      blockTimestamp: row.block_timestamp.toISOString(),
      transactionHash: row.transaction_hash,
      sender: row.sender,
      receiver: row.receiver,
      ptIn: row.pt_in,
      syIn: row.sy_in,
      ptOut: row.pt_out,
      syOut: row.sy_out,
      fee: row.fee,
      impliedRateBefore: row.implied_rate_before,
      impliedRateAfter: row.implied_rate_after,
      exchangeRate: row.exchange_rate,
    }));

    return NextResponse.json({
      swaps,
      total: swaps.length,
      hasMore,
    });
  } catch (error) {
    console.error('[markets/[address]/swaps] Error fetching swaps:', error);
    return NextResponse.json({ swaps: [], total: 0, hasMore: false }, { status: 500 });
  }
}
