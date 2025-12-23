import { eq, desc, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import {
  enrichedRouterSwap,
  enrichedRouterSwapYT,
  enrichedRouterAddLiquidity,
  enrichedRouterRemoveLiquidity,
  enrichedRouterMintPY,
  enrichedRouterRedeemPY,
} from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

interface HistoryEvent {
  id: string;
  type: 'swap' | 'swap_yt' | 'add_liquidity' | 'remove_liquidity' | 'mint_py' | 'redeem_py';
  blockNumber: number;
  blockTimestamp: string;
  transactionHash: string;
  market?: string | undefined;
  yt?: string | undefined;
  expiry?: number | undefined;
  underlyingSymbol?: string | undefined;
  // Amounts depend on type
  amounts: Record<string, string>;
  // Rates at the time of transaction
  exchangeRate?: string | undefined;
  impliedRate?: string | undefined;
}

interface HistoryResponse {
  address: string;
  events: HistoryEvent[];
  total: number;
  hasMore: boolean;
}

/**
 * GET /api/users/[address]/history
 * Get transaction history for a user across all operations
 *
 * Query params:
 * - type: comma-separated list of event types to filter
 * - limit: number - max results (default 50, max 100)
 * - offset: number - pagination offset
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<HistoryResponse>> {
  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0');
  const typeFilter = searchParams.get('type')?.split(',') ?? [];

  try {
    const events: HistoryEvent[] = [];

    // Fetch each type of event (or all if no filter)
    const shouldFetch = (type: string): boolean =>
      typeFilter.length === 0 || typeFilter.includes(type);

    // Swap events
    if (shouldFetch('swap')) {
      const swaps = await db
        .select()
        .from(enrichedRouterSwap)
        .where(or(eq(enrichedRouterSwap.sender, address), eq(enrichedRouterSwap.receiver, address)))
        .orderBy(desc(enrichedRouterSwap.block_timestamp))
        .limit(limit);

      events.push(
        ...swaps.map((row) => ({
          id: row._id ?? '',
          type: 'swap' as const,
          blockNumber: row.block_number ?? 0,
          blockTimestamp: row.block_timestamp?.toISOString() ?? '',
          transactionHash: row.transaction_hash ?? '',
          market: row.market ?? undefined,
          expiry: row.expiry ?? undefined,
          underlyingSymbol: row.underlying_symbol ?? undefined,
          amounts: {
            syIn: row.sy_in ?? '0',
            ptIn: row.pt_in ?? '0',
            syOut: row.sy_out ?? '0',
            ptOut: row.pt_out ?? '0',
            fee: row.fee ?? '0',
          },
          exchangeRate: row.exchange_rate ?? undefined,
          impliedRate: row.implied_rate_after ?? undefined,
        }))
      );
    }

    // YT Swap events
    if (shouldFetch('swap_yt')) {
      const ytSwaps = await db
        .select()
        .from(enrichedRouterSwapYT)
        .where(
          or(eq(enrichedRouterSwapYT.sender, address), eq(enrichedRouterSwapYT.receiver, address))
        )
        .orderBy(desc(enrichedRouterSwapYT.block_timestamp))
        .limit(limit);

      events.push(
        ...ytSwaps.map((row) => ({
          id: row._id ?? '',
          type: 'swap_yt' as const,
          blockNumber: row.block_number ?? 0,
          blockTimestamp: row.block_timestamp?.toISOString() ?? '',
          transactionHash: row.transaction_hash ?? '',
          market: row.market ?? undefined,
          yt: row.yt ?? undefined,
          expiry: row.expiry ?? undefined,
          underlyingSymbol: row.underlying_symbol ?? undefined,
          amounts: {
            syIn: row.sy_in ?? '0',
            ytIn: row.yt_in ?? '0',
            syOut: row.sy_out ?? '0',
            ytOut: row.yt_out ?? '0',
          },
          exchangeRate: row.exchange_rate ?? undefined,
          impliedRate: row.implied_rate_after ?? undefined,
        }))
      );
    }

    // Add liquidity events
    if (shouldFetch('add_liquidity')) {
      const addLiq = await db
        .select()
        .from(enrichedRouterAddLiquidity)
        .where(
          or(
            eq(enrichedRouterAddLiquidity.sender, address),
            eq(enrichedRouterAddLiquidity.receiver, address)
          )
        )
        .orderBy(desc(enrichedRouterAddLiquidity.block_timestamp))
        .limit(limit);

      events.push(
        ...addLiq.map((row) => ({
          id: row._id ?? '',
          type: 'add_liquidity' as const,
          blockNumber: row.block_number ?? 0,
          blockTimestamp: row.block_timestamp?.toISOString() ?? '',
          transactionHash: row.transaction_hash ?? '',
          market: row.market ?? undefined,
          expiry: row.expiry ?? undefined,
          underlyingSymbol: row.underlying_symbol ?? undefined,
          amounts: {
            syUsed: row.sy_used ?? '0',
            ptUsed: row.pt_used ?? '0',
            lpOut: row.lp_out ?? '0',
          },
          exchangeRate: row.exchange_rate ?? undefined,
          impliedRate: row.implied_rate ?? undefined,
        }))
      );
    }

    // Remove liquidity events
    if (shouldFetch('remove_liquidity')) {
      const removeLiq = await db
        .select()
        .from(enrichedRouterRemoveLiquidity)
        .where(
          or(
            eq(enrichedRouterRemoveLiquidity.sender, address),
            eq(enrichedRouterRemoveLiquidity.receiver, address)
          )
        )
        .orderBy(desc(enrichedRouterRemoveLiquidity.block_timestamp))
        .limit(limit);

      events.push(
        ...removeLiq.map((row) => ({
          id: row._id ?? '',
          type: 'remove_liquidity' as const,
          blockNumber: row.block_number ?? 0,
          blockTimestamp: row.block_timestamp?.toISOString() ?? '',
          transactionHash: row.transaction_hash ?? '',
          market: row.market ?? undefined,
          expiry: row.expiry ?? undefined,
          underlyingSymbol: row.underlying_symbol ?? undefined,
          amounts: {
            lpIn: row.lp_in ?? '0',
            syOut: row.sy_out ?? '0',
            ptOut: row.pt_out ?? '0',
          },
          exchangeRate: row.exchange_rate ?? undefined,
          impliedRate: row.implied_rate ?? undefined,
        }))
      );
    }

    // Mint PY events
    if (shouldFetch('mint_py')) {
      const mints = await db
        .select()
        .from(enrichedRouterMintPY)
        .where(
          or(eq(enrichedRouterMintPY.sender, address), eq(enrichedRouterMintPY.receiver, address))
        )
        .orderBy(desc(enrichedRouterMintPY.block_timestamp))
        .limit(limit);

      events.push(
        ...mints.map((row) => ({
          id: row._id ?? '',
          type: 'mint_py' as const,
          blockNumber: row.block_number ?? 0,
          blockTimestamp: row.block_timestamp?.toISOString() ?? '',
          transactionHash: row.transaction_hash ?? '',
          yt: row.yt ?? undefined,
          expiry: row.expiry ?? undefined,
          amounts: {
            syIn: row.sy_in ?? '0',
            ptOut: row.pt_out ?? '0',
            ytOut: row.yt_out ?? '0',
          },
          exchangeRate: row.exchange_rate ?? undefined,
        }))
      );
    }

    // Redeem PY events
    if (shouldFetch('redeem_py')) {
      const redeems = await db
        .select()
        .from(enrichedRouterRedeemPY)
        .where(
          or(
            eq(enrichedRouterRedeemPY.sender, address),
            eq(enrichedRouterRedeemPY.receiver, address)
          )
        )
        .orderBy(desc(enrichedRouterRedeemPY.block_timestamp))
        .limit(limit);

      events.push(
        ...redeems.map((row) => ({
          id: row._id ?? '',
          type: 'redeem_py' as const,
          blockNumber: row.block_number ?? 0,
          blockTimestamp: row.block_timestamp?.toISOString() ?? '',
          transactionHash: row.transaction_hash ?? '',
          yt: row.yt ?? undefined,
          expiry: row.expiry ?? undefined,
          amounts: {
            pyIn: row.py_in ?? '0',
            syOut: row.sy_out ?? '0',
          },
          exchangeRate: row.exchange_rate ?? undefined,
        }))
      );
    }

    // Sort all events by timestamp and apply pagination
    events.sort(
      (a, b) => new Date(b.blockTimestamp).getTime() - new Date(a.blockTimestamp).getTime()
    );

    const paginatedEvents = events.slice(offset, offset + limit);
    const hasMore = events.length > offset + limit;

    return NextResponse.json({
      address,
      events: paginatedEvents,
      total: paginatedEvents.length,
      hasMore,
    });
  } catch (error) {
    console.error('[users/[address]/history] Error fetching history:', error);
    return NextResponse.json({ address, events: [], total: 0, hasMore: false }, { status: 500 });
  }
}
