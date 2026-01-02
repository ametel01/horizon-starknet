import { getCacheHeaders } from '@shared/server/cache';
import { db, protocolDailyStats, routerSwap, routerSwapYT } from '@shared/server/db';
import { logError, logWarn } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { analyticsVolumeQuerySchema, validateQuery } from '@shared/server/validations/api';
import { desc, gte } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface VolumeDataPoint {
  date: string;
  syVolume: string;
  ptVolume: string;
  swapCount: number;
  uniqueSwappers: number;
}

/** Response type for GET /api/analytics/volume */
export interface VolumeResponse {
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
 * - days: number - how many days of history (default: 30, max: 365)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult;

  // Validate query parameters
  const params = validateQuery(request.nextUrl.searchParams, analyticsVolumeQuerySchema);
  if (params instanceof NextResponse) return params;

  const { days } = params;

  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    // First try the materialized view
    const dailyStats = await db
      .select()
      .from(protocolDailyStats)
      .where(gte(protocolDailyStats.day, since))
      .orderBy(desc(protocolDailyStats.day));

    // Check if we have data from the materialized view
    const hasDataFromView =
      dailyStats.length > 0 && dailyStats.some((s) => (s.swap_count ?? 0) > 0);

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

    if (hasDataFromView) {
      // Use the materialized view data
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

      // Reverse to get oldest first (materialized view returns in DESC order)
      history.reverse();
    } else {
      // Fallback: Query raw router_swap and router_swap_yt events directly
      logWarn('Using fallback query from router_swap', { module: 'analytics/volume' });

      // Get PT swaps from router
      const ptSwaps = await db
        .select()
        .from(routerSwap)
        .where(gte(routerSwap.block_timestamp, since));

      // Get YT swaps from router
      const ytSwaps = await db
        .select()
        .from(routerSwapYT)
        .where(gte(routerSwapYT.block_timestamp, since));

      const uniqueSenders24h = new Set<string>();
      const uniqueSenders7d = new Set<string>();

      // Aggregate by day for history
      const dailyVolume = new Map<
        string,
        { syVol: bigint; ptVol: bigint; swaps: number; senders: Set<string> }
      >();

      // Process PT swaps
      for (const swap of ptSwaps) {
        const timestamp = swap.block_timestamp;
        const dateKey = timestamp.toISOString().split('T')[0] ?? '';
        const syVol = BigInt(swap.sy_in) + BigInt(swap.sy_out);
        const ptVol = BigInt(swap.pt_in) + BigInt(swap.pt_out);

        // Aggregate by day
        if (!dailyVolume.has(dateKey)) {
          dailyVolume.set(dateKey, { syVol: 0n, ptVol: 0n, swaps: 0, senders: new Set() });
        }
        const dayEntry = dailyVolume.get(dateKey);
        if (dayEntry) {
          dayEntry.syVol += syVol;
          dayEntry.ptVol += ptVol;
          dayEntry.swaps++;
          dayEntry.senders.add(swap.sender);
        }

        if (timestamp >= oneDayAgo) {
          syVolume24h += syVol;
          ptVolume24h += ptVol;
          swapCount24h++;
          uniqueSenders24h.add(swap.sender);
        }

        if (timestamp >= sevenDaysAgo) {
          syVolume7d += syVol;
          ptVolume7d += ptVol;
          swapCount7d++;
          uniqueSenders7d.add(swap.sender);
        }
      }

      // Process YT swaps (add SY volume, YT doesn't contribute to PT volume)
      for (const swap of ytSwaps) {
        const timestamp = swap.block_timestamp;
        const dateKey = timestamp.toISOString().split('T')[0] ?? '';
        const syVol = BigInt(swap.sy_in) + BigInt(swap.sy_out);

        // Aggregate by day
        if (!dailyVolume.has(dateKey)) {
          dailyVolume.set(dateKey, { syVol: 0n, ptVol: 0n, swaps: 0, senders: new Set() });
        }
        const dayEntry = dailyVolume.get(dateKey);
        if (dayEntry) {
          dayEntry.syVol += syVol;
          dayEntry.swaps++;
          dayEntry.senders.add(swap.sender);
        }

        if (timestamp >= oneDayAgo) {
          syVolume24h += syVol;
          swapCount24h++;
          uniqueSenders24h.add(swap.sender);
        }

        if (timestamp >= sevenDaysAgo) {
          syVolume7d += syVol;
          swapCount7d++;
          uniqueSenders7d.add(swap.sender);
        }
      }

      uniqueSwappers24h = uniqueSenders24h.size;

      // Convert daily aggregates to history array (sorted oldest first)
      const sortedDays = Array.from(dailyVolume.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      for (const [date, data] of sortedDays) {
        history.push({
          date,
          syVolume: data.syVol.toString(),
          ptVolume: data.ptVol.toString(),
          swapCount: data.swaps,
          uniqueSwappers: data.senders.size,
        });
      }
    }

    return NextResponse.json(
      {
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
      },
      { headers: getCacheHeaders('MEDIUM') }
    );
  } catch (error) {
    logError(error, { module: 'analytics/volume' });
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
