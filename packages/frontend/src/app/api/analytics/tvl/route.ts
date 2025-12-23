import { desc, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { db, marketCurrentState, marketSwap, enrichedRouterSwap } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface TvlDataPoint {
  date: string;
  totalSyReserve: string;
  totalPtReserve: string;
  marketCount: number;
}

interface TvlResponse {
  current: {
    totalSyReserve: string;
    totalPtReserve: string;
    marketCount: number;
  };
  history: TvlDataPoint[];
}

/**
 * GET /api/analytics/tvl
 * Get protocol-wide TVL metrics
 *
 * Note: Historical TVL data requires a dedicated TVL snapshot table.
 * Currently only returns current TVL from market_current_state.
 */
export async function GET(_request: NextRequest): Promise<NextResponse<TvlResponse>> {
  try {
    // Get current TVL from all markets (including expired for total count)
    const allMarkets = await db.select().from(marketCurrentState);
    const currentMarkets = allMarkets.filter((m) => !m.is_expired);

    let totalSyReserve = BigInt(0);
    let totalPtReserve = BigInt(0);

    // Check if we have reserves from the materialized view
    const hasReservesFromView = allMarkets.some(
      (m) => BigInt(m.sy_reserve ?? '0') > 0n || BigInt(m.pt_reserve ?? '0') > 0n
    );

    if (hasReservesFromView) {
      // Sum reserves from the materialized view
      for (const market of allMarkets) {
        totalSyReserve += BigInt(market.sy_reserve ?? '0');
        totalPtReserve += BigInt(market.pt_reserve ?? '0');
      }
    } else {
      // Fallback 1: Try enriched_router_swap view (has reserves from market events)
      // Get latest swap per market from the enriched view
      const latestRouterSwaps = await db
        .select({
          market: enrichedRouterSwap.market,
          syReserve: enrichedRouterSwap.sy_reserve_after,
          ptReserve: enrichedRouterSwap.pt_reserve_after,
          blockNumber: enrichedRouterSwap.block_number,
        })
        .from(enrichedRouterSwap)
        .orderBy(desc(enrichedRouterSwap.block_number));

      // Get latest per market
      const marketReserves = new Map<string, { sy: bigint; pt: bigint }>();
      for (const swap of latestRouterSwaps) {
        const market = swap.market ?? '';
        if (!market || marketReserves.has(market)) continue;

        const syRes = BigInt(swap.syReserve ?? '0');
        const ptRes = BigInt(swap.ptReserve ?? '0');
        if (syRes > 0n || ptRes > 0n) {
          marketReserves.set(market, { sy: syRes, pt: ptRes });
        }
      }

      // If we found reserves from router swaps, use them
      if (marketReserves.size > 0) {
        for (const reserves of marketReserves.values()) {
          totalSyReserve += reserves.sy;
          totalPtReserve += reserves.pt;
        }
        console.warn(
          `[analytics/tvl] Used enriched_router_swap fallback, found ${String(marketReserves.size)} markets`
        );
      } else {
        // Fallback 2: Try direct market_swap events
        const latestSwapsPerMarket = await db
          .select({
            market: marketSwap.market,
            syReserve: marketSwap.sy_reserve_after,
            ptReserve: marketSwap.pt_reserve_after,
          })
          .from(marketSwap)
          .where(
            sql`(${marketSwap.market}, ${marketSwap.block_number}) IN (
              SELECT market, MAX(block_number)
              FROM market_swap
              GROUP BY market
            )`
          );

        for (const swap of latestSwapsPerMarket) {
          totalSyReserve += BigInt(swap.syReserve);
          totalPtReserve += BigInt(swap.ptReserve);
        }

        console.warn(
          `[analytics/tvl] Used market_swap fallback, found ${String(latestSwapsPerMarket.length)} markets`
        );
      }
    }

    // Log for debugging
    console.warn(
      `[analytics/tvl] Found ${String(allMarkets.length)} total markets, ${String(currentMarkets.length)} active, TVL: SY=${totalSyReserve.toString()}, PT=${totalPtReserve.toString()}`
    );

    // Return current TVL (historical TVL would require a snapshot table)
    const today = new Date().toISOString().split('T')[0] ?? '';

    return NextResponse.json({
      current: {
        totalSyReserve: totalSyReserve.toString(),
        totalPtReserve: totalPtReserve.toString(),
        marketCount: allMarkets.length, // Show total markets, not just active
      },
      history: [
        {
          date: today,
          totalSyReserve: totalSyReserve.toString(),
          totalPtReserve: totalPtReserve.toString(),
          marketCount: currentMarkets.length,
        },
      ],
    });
  } catch (error) {
    console.error('[analytics/tvl] Error fetching TVL:', error);
    return NextResponse.json(
      {
        current: { totalSyReserve: '0', totalPtReserve: '0', marketCount: 0 },
        history: [],
      },
      { status: 500 }
    );
  }
}
