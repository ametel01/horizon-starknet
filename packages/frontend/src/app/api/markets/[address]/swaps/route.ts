import { eq, desc, and, gte } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { db, marketSwap, routerSwap, routerSwapYT } from '@/lib/db';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface SwapEvent {
  id: string;
  type: 'pt' | 'yt';
  blockNumber: number;
  blockTimestamp: string;
  transactionHash: string;
  sender: string;
  receiver: string;
  // PT swap fields
  ptIn: string;
  syIn: string;
  ptOut: string;
  syOut: string;
  // YT swap fields (only for type: 'yt')
  ytIn?: string;
  ytOut?: string;
  // Optional fields (may not be available for router swaps)
  fee?: string;
  impliedRateBefore?: string;
  impliedRateAfter?: string;
  exchangeRate?: string;
}

interface SwapsResponse {
  swaps: SwapEvent[];
  total: number;
  hasMore: boolean;
}

/**
 * GET /api/markets/[address]/swaps
 * Get swap history for a market (includes PT and YT swaps)
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
    const allSwaps: SwapEvent[] = [];

    // Build date condition
    const sinceDate = since ? new Date(since) : null;
    const isValidSinceDate = sinceDate && !isNaN(sinceDate.getTime());

    // 1. Query market_swap (direct AMM swaps with full data)
    const marketConditions = [eq(marketSwap.market, address)];
    if (isValidSinceDate) {
      marketConditions.push(gte(marketSwap.block_timestamp, sinceDate));
    }

    const marketSwaps = await db
      .select()
      .from(marketSwap)
      .where(and(...marketConditions))
      .orderBy(desc(marketSwap.block_timestamp));

    allSwaps.push(
      ...marketSwaps.map((row) => ({
        id: row._id,
        type: 'pt' as const,
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
      }))
    );

    // 2. Query router_swap (PT swaps through router)
    const routerConditions = [eq(routerSwap.market, address)];
    if (isValidSinceDate) {
      routerConditions.push(gte(routerSwap.block_timestamp, sinceDate));
    }

    const routerSwaps = await db
      .select()
      .from(routerSwap)
      .where(and(...routerConditions))
      .orderBy(desc(routerSwap.block_timestamp));

    allSwaps.push(
      ...routerSwaps.map((row) => ({
        id: row._id,
        type: 'pt' as const,
        blockNumber: row.block_number,
        blockTimestamp: row.block_timestamp.toISOString(),
        transactionHash: row.transaction_hash,
        sender: row.sender,
        receiver: row.receiver,
        ptIn: row.pt_in,
        syIn: row.sy_in,
        ptOut: row.pt_out,
        syOut: row.sy_out,
      }))
    );

    // 3. Query router_swap_yt (YT swaps through router)
    const ytConditions = [eq(routerSwapYT.market, address)];
    if (isValidSinceDate) {
      ytConditions.push(gte(routerSwapYT.block_timestamp, sinceDate));
    }

    const ytSwaps = await db
      .select()
      .from(routerSwapYT)
      .where(and(...ytConditions))
      .orderBy(desc(routerSwapYT.block_timestamp));

    allSwaps.push(
      ...ytSwaps.map((row) => ({
        id: row._id,
        type: 'yt' as const,
        blockNumber: row.block_number,
        blockTimestamp: row.block_timestamp.toISOString(),
        transactionHash: row.transaction_hash,
        sender: row.sender,
        receiver: row.receiver,
        ptIn: '0',
        syIn: row.sy_in,
        ptOut: '0',
        syOut: row.sy_out,
        ytIn: row.yt_in,
        ytOut: row.yt_out,
      }))
    );

    // Deduplicate by transaction hash, preferring entries with rate data (from market_swap)
    // This handles cases where both Router.Swap and Market.Swap events are emitted for the same tx
    const seenTxHashes = new Map<string, SwapEvent>();
    for (const swap of allSwaps) {
      const existing = seenTxHashes.get(swap.transactionHash);
      if (!existing) {
        seenTxHashes.set(swap.transactionHash, swap);
      } else {
        // Prefer the entry with rate data (market_swap has impliedRateBefore/After)
        const existingHasRateData = existing.impliedRateBefore && existing.impliedRateAfter;
        const currentHasRateData = swap.impliedRateBefore && swap.impliedRateAfter;
        if (currentHasRateData && !existingHasRateData) {
          seenTxHashes.set(swap.transactionHash, swap);
        }
      }
    }
    const dedupedSwaps = Array.from(seenTxHashes.values());

    // Sort all swaps by timestamp (descending)
    dedupedSwaps.sort(
      (a, b) => new Date(b.blockTimestamp).getTime() - new Date(a.blockTimestamp).getTime()
    );

    // Apply pagination
    const paginatedSwaps = dedupedSwaps.slice(offset, offset + limit + 1);
    const hasMore = paginatedSwaps.length > limit;
    const swaps = paginatedSwaps.slice(0, limit);

    return NextResponse.json({
      swaps,
      total: swaps.length,
      hasMore,
    });
  } catch (error) {
    logError(error, { module: 'markets/swaps', marketAddress: address });
    return NextResponse.json({ swaps: [], total: 0, hasMore: false }, { status: 500 });
  }
}
