import { desc, gte } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { db, protocolDailyStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface VolumeDataPoint {
  date: string;
  syVolume: string;
  ptVolume: string;
  swapCount: number;
  uniqueSwappers: number;
}

interface VolumeResponse {
  total24h: {
    syVolume: string;
    ptVolume: string;
    swapCount: number;
    uniqueSwappers: number;
  };
  total7d: {
    syVolume: string;
    ptVolume: string;
    swapCount: number;
  };
  history: VolumeDataPoint[];
}

/**
 * GET /api/analytics/volume
 * Get protocol-wide volume metrics
 *
 * Query params:
 * - days: number - how many days of history (default: 30)
 */
export async function GET(request: NextRequest): Promise<NextResponse<VolumeResponse>> {
  const searchParams = request.nextUrl.searchParams;
  const days = Math.min(parseInt(searchParams.get('days') ?? '30'), 365);

  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    const dailyStats = await db
      .select()
      .from(protocolDailyStats)
      .where(gte(protocolDailyStats.day, since))
      .orderBy(desc(protocolDailyStats.day));

    // Calculate totals
    let syVolume24h = BigInt(0);
    let ptVolume24h = BigInt(0);
    let swapCount24h = 0;
    let uniqueSwappers24h = 0;

    let syVolume7d = BigInt(0);
    let ptVolume7d = BigInt(0);
    let swapCount7d = 0;

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const history: VolumeDataPoint[] = [];

    for (const stat of dailyStats) {
      const statDate = stat.day ?? new Date(0);

      // Build history array
      history.push({
        date: statDate.toISOString().split('T')[0] ?? '',
        syVolume: stat.total_sy_volume ?? '0',
        ptVolume: stat.total_pt_volume ?? '0',
        swapCount: stat.swap_count ?? 0,
        uniqueSwappers: stat.unique_swappers ?? 0,
      });

      // 24h totals
      if (statDate >= oneDayAgo) {
        syVolume24h += BigInt(stat.total_sy_volume ?? '0');
        ptVolume24h += BigInt(stat.total_pt_volume ?? '0');
        swapCount24h += stat.swap_count ?? 0;
        uniqueSwappers24h = Math.max(uniqueSwappers24h, stat.unique_swappers ?? 0);
      }

      // 7d totals
      if (statDate >= sevenDaysAgo) {
        syVolume7d += BigInt(stat.total_sy_volume ?? '0');
        ptVolume7d += BigInt(stat.total_pt_volume ?? '0');
        swapCount7d += stat.swap_count ?? 0;
      }
    }

    // Reverse to get oldest first
    history.reverse();

    return NextResponse.json({
      total24h: {
        syVolume: syVolume24h.toString(),
        ptVolume: ptVolume24h.toString(),
        swapCount: swapCount24h,
        uniqueSwappers: uniqueSwappers24h,
      },
      total7d: {
        syVolume: syVolume7d.toString(),
        ptVolume: ptVolume7d.toString(),
        swapCount: swapCount7d,
      },
      history,
    });
  } catch (error) {
    console.error('[analytics/volume] Error fetching volume:', error);
    return NextResponse.json(
      {
        total24h: { syVolume: '0', ptVolume: '0', swapCount: 0, uniqueSwappers: 0 },
        total7d: { syVolume: '0', ptVolume: '0', swapCount: 0 },
        history: [],
      },
      { status: 500 }
    );
  }
}
