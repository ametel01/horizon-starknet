import { eq, desc, gte, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { db, marketDailyStats, marketHourlyStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface TvlDataPoint {
  timestamp: string;
  syReserve: string;
  ptReserve: string;
  totalLp?: string;
  volume?: string;
  fees?: string;
}

interface TvlResponse {
  market: string;
  resolution: 'hourly' | 'daily';
  dataPoints: TvlDataPoint[];
}

/**
 * GET /api/markets/[address]/tvl
 * Get TVL time series for a market
 *
 * Query params:
 * - resolution: 'hourly' | 'daily' (default: 'daily')
 * - days: number - how many days of data (default: 30, max: 365)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<TvlResponse>> {
  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  const resolution = searchParams.get('resolution') === 'hourly' ? 'hourly' : 'daily';
  const days = Math.min(parseInt(searchParams.get('days') ?? '30'), 365);

  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    if (resolution === 'hourly') {
      const results = await db
        .select()
        .from(marketHourlyStats)
        .where(and(eq(marketHourlyStats.market, address), gte(marketHourlyStats.hour, since)))
        .orderBy(desc(marketHourlyStats.hour))
        .limit(days * 24);

      const dataPoints: TvlDataPoint[] = results.map((row) => ({
        timestamp: row.hour?.toISOString() ?? '',
        syReserve: row.sy_reserve ?? '0',
        ptReserve: row.pt_reserve ?? '0',
        volume: row.sy_volume ?? '0',
        fees: row.total_fees ?? '0',
      }));

      return NextResponse.json({
        market: address,
        resolution: 'hourly',
        dataPoints: dataPoints.reverse(), // Oldest first
      });
    } else {
      const results = await db
        .select()
        .from(marketDailyStats)
        .where(and(eq(marketDailyStats.market, address), gte(marketDailyStats.day, since)))
        .orderBy(desc(marketDailyStats.day))
        .limit(days);

      const dataPoints: TvlDataPoint[] = results.map((row) => ({
        timestamp: row.day?.toISOString() ?? '',
        syReserve: row.sy_reserve ?? '0',
        ptReserve: row.pt_reserve ?? '0',
        volume: row.sy_volume ?? '0',
        fees: row.total_fees ?? '0',
      }));

      return NextResponse.json({
        market: address,
        resolution: 'daily',
        dataPoints: dataPoints.reverse(), // Oldest first
      });
    }
  } catch (error) {
    console.error('[markets/[address]/tvl] Error fetching TVL:', error);
    return NextResponse.json({ market: address, resolution, dataPoints: [] }, { status: 500 });
  }
}
