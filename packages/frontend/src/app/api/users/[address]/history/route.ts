import { desc, or, sql } from 'drizzle-orm';
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
import { logError } from '@/lib/logger';

/**
 * Normalize a Starknet address for database comparison.
 * Pads the address to full 66 characters (0x + 64 hex chars) and lowercases it.
 */
function normalizeAddressForDb(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  const padded = hex.padStart(64, '0');
  return '0x' + padded;
}

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
  amounts: Record<string, string>;
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
    const normalizedAddress = normalizeAddressForDb(address);
    const lowerAddress = address.toLowerCase();

    const shouldFetch = (type: string): boolean =>
      typeFilter.length === 0 || typeFilter.includes(type);

    // Run ALL queries in parallel for ~6x speedup
    const [swaps, ytSwaps, addLiq, removeLiq, mints, redeems] = await Promise.all([
      shouldFetch('swap')
        ? db
            .select()
            .from(enrichedRouterSwap)
            .where(
              or(
                sql`LOWER(${enrichedRouterSwap.sender}) = ${normalizedAddress}`,
                sql`LOWER(${enrichedRouterSwap.sender}) = ${lowerAddress}`,
                sql`LOWER(${enrichedRouterSwap.receiver}) = ${normalizedAddress}`,
                sql`LOWER(${enrichedRouterSwap.receiver}) = ${lowerAddress}`
              )
            )
            .orderBy(desc(enrichedRouterSwap.block_timestamp))
            .limit(limit)
        : Promise.resolve([]),

      shouldFetch('swap_yt')
        ? db
            .select()
            .from(enrichedRouterSwapYT)
            .where(
              or(
                sql`LOWER(${enrichedRouterSwapYT.sender}) = ${normalizedAddress}`,
                sql`LOWER(${enrichedRouterSwapYT.sender}) = ${lowerAddress}`,
                sql`LOWER(${enrichedRouterSwapYT.receiver}) = ${normalizedAddress}`,
                sql`LOWER(${enrichedRouterSwapYT.receiver}) = ${lowerAddress}`
              )
            )
            .orderBy(desc(enrichedRouterSwapYT.block_timestamp))
            .limit(limit)
        : Promise.resolve([]),

      shouldFetch('add_liquidity')
        ? db
            .select()
            .from(enrichedRouterAddLiquidity)
            .where(
              or(
                sql`LOWER(${enrichedRouterAddLiquidity.sender}) = ${normalizedAddress}`,
                sql`LOWER(${enrichedRouterAddLiquidity.sender}) = ${lowerAddress}`,
                sql`LOWER(${enrichedRouterAddLiquidity.receiver}) = ${normalizedAddress}`,
                sql`LOWER(${enrichedRouterAddLiquidity.receiver}) = ${lowerAddress}`
              )
            )
            .orderBy(desc(enrichedRouterAddLiquidity.block_timestamp))
            .limit(limit)
        : Promise.resolve([]),

      shouldFetch('remove_liquidity')
        ? db
            .select()
            .from(enrichedRouterRemoveLiquidity)
            .where(
              or(
                sql`LOWER(${enrichedRouterRemoveLiquidity.sender}) = ${normalizedAddress}`,
                sql`LOWER(${enrichedRouterRemoveLiquidity.sender}) = ${lowerAddress}`,
                sql`LOWER(${enrichedRouterRemoveLiquidity.receiver}) = ${normalizedAddress}`,
                sql`LOWER(${enrichedRouterRemoveLiquidity.receiver}) = ${lowerAddress}`
              )
            )
            .orderBy(desc(enrichedRouterRemoveLiquidity.block_timestamp))
            .limit(limit)
        : Promise.resolve([]),

      shouldFetch('mint_py')
        ? db
            .select()
            .from(enrichedRouterMintPY)
            .where(
              or(
                sql`LOWER(${enrichedRouterMintPY.sender}) = ${normalizedAddress}`,
                sql`LOWER(${enrichedRouterMintPY.sender}) = ${lowerAddress}`,
                sql`LOWER(${enrichedRouterMintPY.receiver}) = ${normalizedAddress}`,
                sql`LOWER(${enrichedRouterMintPY.receiver}) = ${lowerAddress}`
              )
            )
            .orderBy(desc(enrichedRouterMintPY.block_timestamp))
            .limit(limit)
        : Promise.resolve([]),

      shouldFetch('redeem_py')
        ? db
            .select()
            .from(enrichedRouterRedeemPY)
            .where(
              or(
                sql`LOWER(${enrichedRouterRedeemPY.sender}) = ${normalizedAddress}`,
                sql`LOWER(${enrichedRouterRedeemPY.sender}) = ${lowerAddress}`,
                sql`LOWER(${enrichedRouterRedeemPY.receiver}) = ${normalizedAddress}`,
                sql`LOWER(${enrichedRouterRedeemPY.receiver}) = ${lowerAddress}`
              )
            )
            .orderBy(desc(enrichedRouterRedeemPY.block_timestamp))
            .limit(limit)
        : Promise.resolve([]),
    ]);

    const events: HistoryEvent[] = [];

    // Process swaps
    for (const row of swaps) {
      events.push({
        id: row._id ?? '',
        type: 'swap',
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
      });
    }

    // Process YT swaps
    for (const row of ytSwaps) {
      events.push({
        id: row._id ?? '',
        type: 'swap_yt',
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
      });
    }

    // Process add liquidity
    for (const row of addLiq) {
      events.push({
        id: row._id ?? '',
        type: 'add_liquidity',
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
      });
    }

    // Process remove liquidity
    for (const row of removeLiq) {
      events.push({
        id: row._id ?? '',
        type: 'remove_liquidity',
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
      });
    }

    // Process mints
    for (const row of mints) {
      events.push({
        id: row._id ?? '',
        type: 'mint_py',
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
      });
    }

    // Process redeems
    for (const row of redeems) {
      events.push({
        id: row._id ?? '',
        type: 'redeem_py',
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
      });
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
    logError(error, { module: 'users/history', address });
    return NextResponse.json({ address, events: [], total: 0, hasMore: false }, { status: 500 });
  }
}
