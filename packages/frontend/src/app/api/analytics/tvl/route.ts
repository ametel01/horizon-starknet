import { NextRequest, NextResponse } from 'next/server';

import { db, marketCurrentState } from '@/lib/db';

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

    // Sum reserves from all markets (not just active)
    for (const market of allMarkets) {
      totalSyReserve += BigInt(market.sy_reserve ?? '0');
      totalPtReserve += BigInt(market.pt_reserve ?? '0');
    }

    // Log for debugging
    console.log(
      `[analytics/tvl] Found ${allMarkets.length} total markets, ${currentMarkets.length} active`
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
