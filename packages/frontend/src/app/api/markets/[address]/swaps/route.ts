import { db, marketSwap, routerSwap, routerSwapYT } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
  // Fee breakdown (new events have full breakdown, legacy may only have fee)
  /** @deprecated Use totalFee instead */
  fee?: string;
  /** Total fee charged in SY (totalFee = lpFee + reserveFee) */
  totalFee?: string;
  /** Fee portion retained by LPs */
  lpFee?: string;
  /** Fee portion sent to treasury */
  reserveFee?: string;
  // Rate tracking fields (only available from market_swap)
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
 * Deduplicates swaps by transaction hash, preferring entries with rate data.
 * This handles cases where both Router.Swap and Market.Swap events are emitted for the same tx.
 */
function deduplicateSwaps(allSwaps: SwapEvent[]): SwapEvent[] {
  const seenTxHashes = new Map<string, SwapEvent>();

  for (const swap of allSwaps) {
    const existing = seenTxHashes.get(swap.transactionHash);
    if (!existing) {
      seenTxHashes.set(swap.transactionHash, swap);
      continue;
    }

    // Prefer the entry with rate data (market_swap has impliedRateBefore/After)
    const currentHasRateData = swap.impliedRateBefore && swap.impliedRateAfter;
    const existingHasRateData = existing.impliedRateBefore && existing.impliedRateAfter;
    if (currentHasRateData && !existingHasRateData) {
      seenTxHashes.set(swap.transactionHash, swap);
    }
  }

  return Array.from(seenTxHashes.values());
}

/**
 * Parses and validates the since date parameter
 */
function parseSinceDate(since: string | null): Date | null {
  if (!since) return null;
  const date = new Date(since);
  return Number.isNaN(date.getTime()) ? null : date;
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
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult as NextResponse<SwapsResponse>;

  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(Number.parseInt(searchParams.get('limit') ?? '50', 10), 100);
  const offset = Number.parseInt(searchParams.get('offset') ?? '0', 10);
  const sinceDate = parseSinceDate(searchParams.get('since'));

  try {
    // Fetch all swap types in parallel
    const [marketSwapsData, routerSwapsData, ytSwapsData] = await Promise.all([
      // 1. Query market_swap (direct AMM swaps with full data)
      db
        .select()
        .from(marketSwap)
        .where(
          sinceDate
            ? and(eq(marketSwap.market, address), gte(marketSwap.block_timestamp, sinceDate))
            : eq(marketSwap.market, address)
        )
        .orderBy(desc(marketSwap.block_timestamp)),

      // 2. Query router_swap (PT swaps through router)
      db
        .select()
        .from(routerSwap)
        .where(
          sinceDate
            ? and(eq(routerSwap.market, address), gte(routerSwap.block_timestamp, sinceDate))
            : eq(routerSwap.market, address)
        )
        .orderBy(desc(routerSwap.block_timestamp)),

      // 3. Query router_swap_yt (YT swaps through router)
      db
        .select()
        .from(routerSwapYT)
        .where(
          sinceDate
            ? and(eq(routerSwapYT.market, address), gte(routerSwapYT.block_timestamp, sinceDate))
            : eq(routerSwapYT.market, address)
        )
        .orderBy(desc(routerSwapYT.block_timestamp)),
    ]);

    // Map results to SwapEvent format
    const allSwaps: SwapEvent[] = [
      ...marketSwapsData.map((row) => ({
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
        // Fee breakdown - use new fields if available, fall back to legacy fee
        fee: row.total_fee ?? row.fee ?? undefined,
        totalFee: row.total_fee ?? row.fee ?? undefined,
        lpFee: row.lp_fee ?? undefined,
        reserveFee: row.reserve_fee ?? undefined,
        impliedRateBefore: row.implied_rate_before,
        impliedRateAfter: row.implied_rate_after,
        exchangeRate: row.exchange_rate,
      })),
      ...routerSwapsData.map((row) => ({
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
      })),
      ...ytSwapsData.map((row) => ({
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
      })),
    ];

    // Deduplicate and sort
    const dedupedSwaps = deduplicateSwaps(allSwaps);
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
