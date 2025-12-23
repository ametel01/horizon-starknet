import { desc, gte } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { db, protocolDailyStats, marketDailyStats, marketFeesCollected } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

interface FeesResponse {
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
 * - days: number - how many days of history (default: 30)
 */
export async function GET(request: NextRequest): Promise<NextResponse<FeesResponse>> {
  const searchParams = request.nextUrl.searchParams;
  const days = Math.min(parseInt(searchParams.get('days') ?? '30'), 365);

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

    let total24h = BigInt(0);
    let total7d = BigInt(0);
    let total30d = BigInt(0);

    const history: FeesDataPoint[] = [];

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

    // Aggregate by market
    const marketFees = new Map<string, { fees: bigint; swaps: number }>();

    for (const stat of marketStats) {
      const market = stat.market ?? '';
      if (!market) continue;

      if (!marketFees.has(market)) {
        marketFees.set(market, {
          fees: BigInt(0),
          swaps: 0,
        });
      }

      const entry = marketFees.get(market);
      if (entry) {
        entry.fees += BigInt(stat.total_fees ?? '0');
        entry.swaps += stat.swap_count ?? 0;
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

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('[analytics/fees] Error fetching fees:', error);
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
