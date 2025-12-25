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
  syDeposit,
  syRedeem,
} from '@/lib/db/schema';
import { logError } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Normalize a Starknet address for database comparison.
 */
function normalizeAddressForDb(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  const padded = hex.padStart(64, '0');
  return '0x' + padded;
}

interface ValueEvent {
  type:
    | 'deposit'
    | 'withdraw'
    | 'mint_py'
    | 'redeem_py'
    | 'swap'
    | 'swap_yt'
    | 'add_liquidity'
    | 'remove_liquidity';
  timestamp: string;
  transactionHash: string;
  market?: string;
  underlyingSymbol?: string;
  // Value changes (in underlying token units, WAD scaled)
  syDelta: string; // Positive = gained, negative = spent
  ptDelta: string;
  ytDelta: string;
  lpDelta: string;
  // Exchange rate at time of event
  exchangeRate: string;
  // Calculated value in underlying terms
  valueChange: string; // Net value change from this event
}

interface PortfolioSnapshot {
  date: string;
  // Cumulative position values at this point
  totalValueSy: string; // Total value denominated in SY
  syBalance: string;
  ptBalance: string;
  ytBalance: string;
  lpBalance: string;
  // P&L tracking
  realizedPnl: string;
  unrealizedPnl: string;
  eventCount: number;
}

interface PortfolioHistoryResponse {
  address: string;
  events: ValueEvent[];
  snapshots: PortfolioSnapshot[];
  summary: {
    totalDeposited: string;
    totalWithdrawn: string;
    realizedPnl: string;
    firstActivity: string | null;
    lastActivity: string | null;
    eventCount: number;
  };
}

/**
 * GET /api/users/[address]/portfolio-history
 * Get portfolio value history for a user
 *
 * Query params:
 * - days: number - how many days of history (default 90)
 * - limit: number - max events (default 500)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<PortfolioHistoryResponse>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'USER');
  if (rateLimitResult) return rateLimitResult as NextResponse<PortfolioHistoryResponse>;

  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  // days parameter reserved for future date filtering
  const _days = parseInt(searchParams.get('days') ?? '90');
  void _days;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '500'), 1000);

  try {
    const normalizedAddress = normalizeAddressForDb(address);
    const lowerAddress = address.toLowerCase();

    // Run ALL queries in parallel for ~8x speedup
    const [deposits, syRedeems, mints, redeems, swaps, ytSwaps, addLiq, removeLiq] =
      await Promise.all([
        // Fetch SY deposit events
        db
          .select()
          .from(syDeposit)
          .where(
            or(
              sql`LOWER(${syDeposit.caller}) = ${normalizedAddress}`,
              sql`LOWER(${syDeposit.caller}) = ${lowerAddress}`,
              sql`LOWER(${syDeposit.receiver}) = ${normalizedAddress}`,
              sql`LOWER(${syDeposit.receiver}) = ${lowerAddress}`
            )
          )
          .orderBy(desc(syDeposit.block_timestamp))
          .limit(limit),

        // Fetch SY redeem events
        db
          .select()
          .from(syRedeem)
          .where(
            or(
              sql`LOWER(${syRedeem.caller}) = ${normalizedAddress}`,
              sql`LOWER(${syRedeem.caller}) = ${lowerAddress}`,
              sql`LOWER(${syRedeem.receiver}) = ${normalizedAddress}`,
              sql`LOWER(${syRedeem.receiver}) = ${lowerAddress}`
            )
          )
          .orderBy(desc(syRedeem.block_timestamp))
          .limit(limit),

        // Fetch mint events
        db
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
          .limit(limit),

        // Fetch redeem events
        db
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
          .limit(limit),

        // Fetch swap events
        db
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
          .limit(limit),

        // Fetch YT swap events
        db
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
          .limit(limit),

        // Fetch add liquidity events
        db
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
          .limit(limit),

        // Fetch remove liquidity events
        db
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
          .limit(limit),
      ]);

    // Process results into events
    const events: ValueEvent[] = [];

    // Process deposits
    for (const row of deposits) {
      events.push({
        type: 'deposit',
        timestamp: row.block_timestamp.toISOString(),
        transactionHash: row.transaction_hash,
        syDelta: row.amount_sy_minted,
        ptDelta: '0',
        ytDelta: '0',
        lpDelta: '0',
        exchangeRate: row.exchange_rate,
        valueChange: row.amount_sy_minted,
      });
    }

    // Process redeems
    for (const row of syRedeems) {
      events.push({
        type: 'withdraw',
        timestamp: row.block_timestamp.toISOString(),
        transactionHash: row.transaction_hash,
        syDelta: `-${row.amount_sy_burned}`,
        ptDelta: '0',
        ytDelta: '0',
        lpDelta: '0',
        exchangeRate: row.exchange_rate,
        valueChange: `-${row.amount_sy_burned}`,
      });
    }

    // Process mints
    for (const row of mints) {
      events.push({
        type: 'mint_py',
        timestamp: row.block_timestamp?.toISOString() ?? '',
        transactionHash: row.transaction_hash ?? '',
        syDelta: `-${row.sy_in ?? '0'}`,
        ptDelta: row.pt_out ?? '0',
        ytDelta: row.yt_out ?? '0',
        lpDelta: '0',
        exchangeRate: row.exchange_rate ?? '0',
        valueChange: '0',
      });
    }

    // Process redeems
    for (const row of redeems) {
      events.push({
        type: 'redeem_py',
        timestamp: row.block_timestamp?.toISOString() ?? '',
        transactionHash: row.transaction_hash ?? '',
        syDelta: row.sy_out ?? '0',
        ptDelta: `-${row.py_in ?? '0'}`,
        ytDelta: `-${row.py_in ?? '0'}`,
        lpDelta: '0',
        exchangeRate: row.exchange_rate ?? '0',
        valueChange: '0',
      });
    }

    // Process swaps
    for (const row of swaps) {
      const syIn = BigInt(row.sy_in ?? '0');
      const syOut = BigInt(row.sy_out ?? '0');
      const ptIn = BigInt(row.pt_in ?? '0');
      const ptOut = BigInt(row.pt_out ?? '0');
      const fee = BigInt(row.fee ?? '0');

      const event: ValueEvent = {
        type: 'swap',
        timestamp: row.block_timestamp?.toISOString() ?? '',
        transactionHash: row.transaction_hash ?? '',
        syDelta: (syOut - syIn).toString(),
        ptDelta: (ptOut - ptIn).toString(),
        ytDelta: '0',
        lpDelta: '0',
        exchangeRate: row.exchange_rate ?? '0',
        valueChange: `-${fee.toString()}`,
      };
      if (row.market) event.market = row.market;
      if (row.underlying_symbol) event.underlyingSymbol = row.underlying_symbol;
      events.push(event);
    }

    // Process YT swaps
    for (const row of ytSwaps) {
      const syIn = BigInt(row.sy_in ?? '0');
      const syOut = BigInt(row.sy_out ?? '0');
      const ytIn = BigInt(row.yt_in ?? '0');
      const ytOut = BigInt(row.yt_out ?? '0');

      const event: ValueEvent = {
        type: 'swap_yt',
        timestamp: row.block_timestamp?.toISOString() ?? '',
        transactionHash: row.transaction_hash ?? '',
        syDelta: (syOut - syIn).toString(),
        ptDelta: '0',
        ytDelta: (ytOut - ytIn).toString(),
        lpDelta: '0',
        exchangeRate: row.exchange_rate ?? '0',
        valueChange: '0',
      };
      if (row.market) event.market = row.market;
      if (row.underlying_symbol) event.underlyingSymbol = row.underlying_symbol;
      events.push(event);
    }

    // Process add liquidity
    for (const row of addLiq) {
      const event: ValueEvent = {
        type: 'add_liquidity',
        timestamp: row.block_timestamp?.toISOString() ?? '',
        transactionHash: row.transaction_hash ?? '',
        syDelta: `-${row.sy_used ?? '0'}`,
        ptDelta: `-${row.pt_used ?? '0'}`,
        ytDelta: '0',
        lpDelta: row.lp_out ?? '0',
        exchangeRate: row.exchange_rate ?? '0',
        valueChange: '0',
      };
      if (row.market) event.market = row.market;
      if (row.underlying_symbol) event.underlyingSymbol = row.underlying_symbol;
      events.push(event);
    }

    // Process remove liquidity
    for (const row of removeLiq) {
      const event: ValueEvent = {
        type: 'remove_liquidity',
        timestamp: row.block_timestamp?.toISOString() ?? '',
        transactionHash: row.transaction_hash ?? '',
        syDelta: row.sy_out ?? '0',
        ptDelta: row.pt_out ?? '0',
        ytDelta: '0',
        lpDelta: `-${row.lp_in ?? '0'}`,
        exchangeRate: row.exchange_rate ?? '0',
        valueChange: '0',
      };
      if (row.market) event.market = row.market;
      if (row.underlying_symbol) event.underlyingSymbol = row.underlying_symbol;
      events.push(event);
    }

    // Sort all events by timestamp (oldest first for cumulative calculation)
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Calculate cumulative snapshots after EACH event (for dynamic charting)
    const eventSnapshots: PortfolioSnapshot[] = [];
    let cumulativeSy = 0n;
    let cumulativePt = 0n;
    let cumulativeYt = 0n;
    let cumulativeLp = 0n;
    let totalDeposited = 0n;
    let totalWithdrawn = 0n;

    for (const event of events) {
      // Update cumulative balances
      cumulativeSy += BigInt(event.syDelta);
      cumulativePt += BigInt(event.ptDelta);
      cumulativeYt += BigInt(event.ytDelta);
      cumulativeLp += BigInt(event.lpDelta);

      // Track deposits/withdrawals for P&L
      const syDelta = BigInt(event.syDelta);
      if (event.type === 'deposit' && syDelta > 0n) {
        totalDeposited += syDelta;
      }
      if (event.type === 'withdraw' && syDelta < 0n) {
        totalWithdrawn += -syDelta;
      }

      // Calculate total value in SY terms
      // - PT ≈ SY at expiry (simplified)
      // - YT has value based on yield, simplified as ~10% of SY
      // - LP represents shares of both SY and PT reserves, so ~2x value
      const ptValueSy = cumulativePt;
      const ytValueSy = cumulativeYt / 10n;
      const lpValueSy = cumulativeLp * 2n;

      const totalValueSy = cumulativeSy + ptValueSy + ytValueSy + lpValueSy;

      // Create snapshot after each event
      eventSnapshots.push({
        date: event.timestamp,
        totalValueSy: totalValueSy.toString(),
        syBalance: cumulativeSy.toString(),
        ptBalance: cumulativePt.toString(),
        ytBalance: cumulativeYt.toString(),
        lpBalance: cumulativeLp.toString(),
        realizedPnl: '0',
        unrealizedPnl: '0',
        eventCount: 1,
      });
    }

    // Calculate summary
    const firstActivity = events.length > 0 ? (events[0]?.timestamp ?? null) : null;
    const lastActivity = events.length > 0 ? (events[events.length - 1]?.timestamp ?? null) : null;

    // Reverse events for response (most recent first)
    events.reverse();

    return NextResponse.json({
      address,
      events: events.slice(0, limit),
      snapshots: eventSnapshots,
      summary: {
        totalDeposited: totalDeposited.toString(),
        totalWithdrawn: totalWithdrawn.toString(),
        realizedPnl: '0',
        firstActivity,
        lastActivity,
        eventCount: events.length,
      },
    });
  } catch (error) {
    logError(error, { module: 'users/portfolio-history', address });
    return NextResponse.json(
      {
        address,
        events: [],
        snapshots: [],
        summary: {
          totalDeposited: '0',
          totalWithdrawn: '0',
          realizedPnl: '0',
          firstActivity: null,
          lastActivity: null,
          eventCount: 0,
        },
      },
      { status: 500 }
    );
  }
}
