import { desc, gte } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { getCacheHeaders } from '@/lib/cache';
import {
  db,
  protocolDailyStats,
  marketDailyStats,
  marketFeesCollected,
  enrichedRouterSwap,
  enrichedRouterSwapYT,
} from '@/lib/db';
import { logError } from '@/lib/logger';
import { validateQuery, analyticsFeesQuerySchema } from '@/lib/validations/api';

interface FeesDataPoint {
  date: string;
  totalFees: string;
  swapCount: number;
}

interface MarketFeeBreakdown {
  market: string;
  underlyingSymbol: string;
  totalFees: string;
  swapCount: number;
  avgFeePerSwap: string;
}

/** Response type for GET /api/analytics/fees */
export interface FeesResponse {
  total24h: string;
  total7d: string;
  total30d: string;
  history: FeesDataPoint[];
  byMarket: MarketFeeBreakdown[];
  recentCollections: {
    market: string;
    collector: string;
    receiver: string;
    amount: string;
    timestamp: string;
    transactionHash: string;
  }[];
}

/**
 * GET /api/analytics/fees
 * Get protocol-wide fee metrics
 *
 * Query params:
 * - days: number - how many days of history (default: 30, max: 365)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Validate query parameters
  const params = validateQuery(request.nextUrl.searchParams, analyticsFeesQuerySchema);
  if (params instanceof NextResponse) return params;

  const { days } = params;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    // Get protocol daily stats for totals and history
    const dailyStats = await db
      .select()
      .from(protocolDailyStats)
      .where(gte(protocolDailyStats.day, since))
      .orderBy(desc(protocolDailyStats.day));

    // Check if we have data from the materialized view
    const hasDataFromView =
      dailyStats.length > 0 && dailyStats.some((s) => (s.swap_count ?? 0) > 0);

    let total24h = BigInt(0);
    let total7d = BigInt(0);
    let total30d = BigInt(0);

    const history: FeesDataPoint[] = [];
    const marketFees = new Map<string, { fees: bigint; swaps: number }>();

    if (hasDataFromView) {
      // Use the materialized view data
      for (const stat of dailyStats) {
        const statDate = stat.day ?? new Date(0);
        const fees = BigInt(stat.total_fees ?? '0');

        history.push({
          date: statDate.toISOString().split('T')[0] ?? '',
          totalFees: stat.total_fees ?? '0',
          swapCount: stat.swap_count ?? 0,
        });

        if (statDate >= oneDayAgo) {
          total24h += fees;
        }
        if (statDate >= sevenDaysAgo) {
          total7d += fees;
        }
        if (statDate >= thirtyDaysAgo) {
          total30d += fees;
        }
      }

      history.reverse(); // Oldest first

      // Get fees by market (last 30 days)
      const marketStats = await db
        .select()
        .from(marketDailyStats)
        .where(gte(marketDailyStats.day, thirtyDaysAgo));

      for (const stat of marketStats) {
        const market = stat.market ?? '';
        if (!market) continue;

        if (!marketFees.has(market)) {
          marketFees.set(market, { fees: BigInt(0), swaps: 0 });
        }

        const entry = marketFees.get(market);
        if (entry) {
          entry.fees += BigInt(stat.total_fees ?? '0');
          entry.swaps += stat.swap_count ?? 0;
        }
      }
    } else {
      // Fallback: Query enriched_router_swap and enriched_router_swap_yt views (have fee data from market events)
      console.warn('[analytics/fees] Using fallback query from enriched_router_swap');

      // Query both PT swaps and YT swaps in parallel
      const [ptSwaps, ytSwaps] = await Promise.all([
        db.select().from(enrichedRouterSwap).where(gte(enrichedRouterSwap.block_timestamp, since)),
        db
          .select()
          .from(enrichedRouterSwapYT)
          .where(gte(enrichedRouterSwapYT.block_timestamp, since)),
      ]);

      // Aggregate by day for history
      const dailyFees = new Map<string, { fees: bigint; swaps: number }>();

      // Process PT swaps
      for (const swap of ptSwaps) {
        const fee = BigInt(swap.fee ?? '0');
        const market = swap.market ?? '';
        const timestamp = swap.block_timestamp ?? new Date(0);
        const dateKey = timestamp.toISOString().split('T')[0] ?? '';

        // Aggregate by day
        if (!dailyFees.has(dateKey)) {
          dailyFees.set(dateKey, { fees: BigInt(0), swaps: 0 });
        }
        const dayEntry = dailyFees.get(dateKey);
        if (dayEntry) {
          dayEntry.fees += fee;
          dayEntry.swaps++;
        }

        // Aggregate totals
        if (timestamp >= oneDayAgo) {
          total24h += fee;
        }
        if (timestamp >= sevenDaysAgo) {
          total7d += fee;
        }
        if (timestamp >= thirtyDaysAgo) {
          total30d += fee;
        }

        // Aggregate by market
        if (market) {
          if (!marketFees.has(market)) {
            marketFees.set(market, { fees: BigInt(0), swaps: 0 });
          }
          const entry = marketFees.get(market);
          if (entry) {
            entry.fees += fee;
            entry.swaps++;
          }
        }
      }

      // Process YT swaps (also generate fees via internal PT sale)
      for (const swap of ytSwaps) {
        const fee = BigInt(swap.fee ?? '0');
        const market = swap.market ?? '';
        const timestamp = swap.block_timestamp ?? new Date(0);
        const dateKey = timestamp.toISOString().split('T')[0] ?? '';

        // Aggregate by day
        if (!dailyFees.has(dateKey)) {
          dailyFees.set(dateKey, { fees: BigInt(0), swaps: 0 });
        }
        const dayEntry = dailyFees.get(dateKey);
        if (dayEntry) {
          dayEntry.fees += fee;
          dayEntry.swaps++;
        }

        // Aggregate totals
        if (timestamp >= oneDayAgo) {
          total24h += fee;
        }
        if (timestamp >= sevenDaysAgo) {
          total7d += fee;
        }
        if (timestamp >= thirtyDaysAgo) {
          total30d += fee;
        }

        // Aggregate by market
        if (market) {
          if (!marketFees.has(market)) {
            marketFees.set(market, { fees: BigInt(0), swaps: 0 });
          }
          const entry = marketFees.get(market);
          if (entry) {
            entry.fees += fee;
            entry.swaps++;
          }
        }
      }

      // Convert daily aggregates to history array (sorted oldest first)
      const sortedDays = Array.from(dailyFees.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      for (const [date, data] of sortedDays) {
        history.push({
          date,
          totalFees: data.fees.toString(),
          swapCount: data.swaps,
        });
      }
    }

    const byMarket: MarketFeeBreakdown[] = Array.from(marketFees.entries())
      .map(([market, data]) => ({
        market,
        underlyingSymbol: '', // Would need join with marketCurrentState
        totalFees: data.fees.toString(),
        swapCount: data.swaps,
        avgFeePerSwap: data.swaps > 0 ? (data.fees / BigInt(data.swaps)).toString() : '0',
      }))
      .sort((a, b) => {
        const feesA = BigInt(a.totalFees);
        const feesB = BigInt(b.totalFees);
        return feesB > feesA ? 1 : feesB < feesA ? -1 : 0;
      })
      .slice(0, 10); // Top 10 markets

    // Get recent fee collections
    const recentCollections = await db
      .select()
      .from(marketFeesCollected)
      .orderBy(desc(marketFeesCollected.block_timestamp))
      .limit(10);

    return NextResponse.json(
      {
        total24h: total24h.toString(),
        total7d: total7d.toString(),
        total30d: total30d.toString(),
        history,
        byMarket,
        recentCollections: recentCollections.map((row) => ({
          market: row.market,
          collector: row.collector,
          receiver: row.receiver,
          amount: row.amount,
          timestamp: row.block_timestamp.toISOString(),
          transactionHash: row.transaction_hash,
        })),
      },
      { headers: getCacheHeaders('MEDIUM') }
    );
  } catch (error) {
    logError(error, { module: 'analytics/fees' });
    return NextResponse.json(
      {
        total24h: '0',
        total7d: '0',
        total30d: '0',
        history: [],
        byMarket: [],
        recentCollections: [],
      },
      { status: 500 }
    );
  }
}
