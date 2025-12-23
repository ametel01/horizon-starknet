import { eq, desc, gte } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { db, marketCurrentState, marketDailyStats } from '@/lib/db';

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
 * Query params:
 * - days: number - how many days of history (default: 30)
 */
export async function GET(request: NextRequest): Promise<NextResponse<TvlResponse>> {
  const searchParams = request.nextUrl.searchParams;
  const days = Math.min(parseInt(searchParams.get('days') ?? '30'), 365);

  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    // Get current TVL from all active markets
    const currentMarkets = await db
      .select()
      .from(marketCurrentState)
      .where(eq(marketCurrentState.is_expired, false));

    let totalSyReserve = BigInt(0);
    let totalPtReserve = BigInt(0);

    for (const market of currentMarkets) {
      totalSyReserve += BigInt(market.sy_reserve ?? '0');
      totalPtReserve += BigInt(market.pt_reserve ?? '0');
    }

    // Get historical TVL by aggregating daily stats
    const dailyStats = await db
      .select({
        day: marketDailyStats.day,
        sy_reserve: marketDailyStats.sy_reserve,
        pt_reserve: marketDailyStats.pt_reserve,
        market: marketDailyStats.market,
      })
      .from(marketDailyStats)
      .where(gte(marketDailyStats.day, since))
      .orderBy(desc(marketDailyStats.day));

    // Aggregate by day
    const dailyTvl = new Map<string, { sy: bigint; pt: bigint; markets: Set<string> }>();

    for (const stat of dailyStats) {
      const dateKey = stat.day?.toISOString().split('T')[0] ?? '';
      if (!dateKey) continue;

      if (!dailyTvl.has(dateKey)) {
        dailyTvl.set(dateKey, { sy: BigInt(0), pt: BigInt(0), markets: new Set() });
      }

      const day = dailyTvl.get(dateKey);
      if (day) {
        day.sy += BigInt(stat.sy_reserve ?? '0');
        day.pt += BigInt(stat.pt_reserve ?? '0');
        if (stat.market) {
          day.markets.add(stat.market);
        }
      }
    }

    // Convert to sorted array
    const history: TvlDataPoint[] = Array.from(dailyTvl.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        totalSyReserve: data.sy.toString(),
        totalPtReserve: data.pt.toString(),
        marketCount: data.markets.size,
      }));

    return NextResponse.json({
      current: {
        totalSyReserve: totalSyReserve.toString(),
        totalPtReserve: totalPtReserve.toString(),
        marketCount: currentMarkets.length,
      },
      history,
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
