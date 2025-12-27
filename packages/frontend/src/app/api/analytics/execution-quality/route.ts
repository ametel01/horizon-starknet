import { desc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCacheHeaders } from '@shared/server/cache';
import { db, marketSwap, marketCurrentState } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { validateQuery, starknetAddressSchema } from '@shared/server/validations/api';

const WAD = BigInt(10) ** BigInt(18);

/**
 * Calculate price impact in basis points from ln-rate change
 */
function calculateImpactBps(lnRateBefore: bigint, lnRateAfter: bigint): number {
  const before = Number(lnRateBefore) / Number(WAD);
  const after = Number(lnRateAfter) / Number(WAD);
  // Impact in basis points (absolute change * 10000)
  return Math.abs(after - before) * 10_000;
}

/**
 * Calculate trade size in SY equivalent
 */
function calculateTradeSize(syIn: bigint, syOut: bigint, ptIn: bigint, ptOut: bigint): bigint {
  // Trade size is max of SY in/out (simpler than trying to convert PT)
  const syTotal = (syIn > 0n ? syIn : 0n) + (syOut > 0n ? syOut : 0n);
  return syTotal > 0n ? syTotal : ptIn + ptOut;
}

interface ImpactDistributionBucket {
  minBps: number;
  maxBps: number;
  count: number;
  label: string;
}

interface DailyImpactStats {
  date: string;
  medianBps: number;
  p95Bps: number;
  avgBps: number;
  swapCount: number;
}

/** Response type for GET /api/analytics/execution-quality */
export interface ExecutionQualityResponse {
  market: string;
  underlyingSymbol: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalSwaps: number;
    medianImpactBps: number;
    p95ImpactBps: number;
    avgImpactBps: number;
    maxImpactBps: number;
    avgTradeSizeSy: string;
  };
  distribution: ImpactDistributionBucket[];
  timeSeries: DailyImpactStats[];
  recentSwaps: {
    timestamp: string;
    impactBps: number;
    tradeSizeSy: string;
    direction: 'buy_pt' | 'sell_pt';
    txHash: string;
  }[];
}

const executionQualityQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

/**
 * GET /api/analytics/execution-quality
 *
 * Returns execution quality metrics for a market including:
 * - Price impact distribution (histogram)
 * - Impact statistics (median, p95, avg, max)
 * - Time series of daily impact stats
 * - Recent swap details
 *
 * Query params:
 * - market: string (required) - Market address
 * - days: number (default: 30, max: 90) - Days of history
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult;

  const searchParams = request.nextUrl.searchParams;
  const marketAddress = searchParams.get('market');

  // Validate market address
  if (!marketAddress) {
    return NextResponse.json(
      {
        market: '',
        underlyingSymbol: '',
        period: { start: '', end: '' },
        summary: {
          totalSwaps: 0,
          medianImpactBps: 0,
          p95ImpactBps: 0,
          avgImpactBps: 0,
          maxImpactBps: 0,
          avgTradeSizeSy: '0',
        },
        distribution: [],
        timeSeries: [],
        recentSwaps: [],
      },
      { status: 400 }
    );
  }

  const addressResult = starknetAddressSchema.safeParse(marketAddress);
  if (!addressResult.success) {
    return NextResponse.json(
      {
        market: marketAddress,
        underlyingSymbol: '',
        period: { start: '', end: '' },
        summary: {
          totalSwaps: 0,
          medianImpactBps: 0,
          p95ImpactBps: 0,
          avgImpactBps: 0,
          maxImpactBps: 0,
          avgTradeSizeSy: '0',
        },
        distribution: [],
        timeSeries: [],
        recentSwaps: [],
      },
      { status: 400 }
    );
  }

  // Validate query parameters
  const params = validateQuery(searchParams, executionQualityQuerySchema);
  if (params instanceof NextResponse) return params;

  const { days } = params;

  const now = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    // Get market info
    const marketInfoResult = await db
      .select()
      .from(marketCurrentState)
      .where(eq(marketCurrentState.market, marketAddress))
      .limit(1);

    const marketInfo = marketInfoResult[0];
    const underlyingSymbol = marketInfo?.underlying_symbol ?? 'Unknown';

    // Get all swaps for the market in the period
    const swaps = await db
      .select()
      .from(marketSwap)
      .where(eq(marketSwap.market, marketAddress))
      .orderBy(desc(marketSwap.block_timestamp));

    // Filter by date and calculate impacts
    interface SwapWithImpact {
      timestamp: Date;
      impactBps: number;
      tradeSizeSy: bigint;
      direction: 'buy_pt' | 'sell_pt';
      txHash: string;
      dateKey: string;
    }

    const swapsWithImpact: SwapWithImpact[] = [];

    for (const swap of swaps) {
      const timestamp = swap.block_timestamp;
      if (timestamp < since) continue;

      const lnRateBefore = BigInt(swap.implied_rate_before);
      const lnRateAfter = BigInt(swap.implied_rate_after);
      const syIn = BigInt(swap.sy_in);
      const syOut = BigInt(swap.sy_out);
      const ptIn = BigInt(swap.pt_in);
      const ptOut = BigInt(swap.pt_out);

      const impactBps = calculateImpactBps(lnRateBefore, lnRateAfter);
      const tradeSizeSy = calculateTradeSize(syIn, syOut, ptIn, ptOut);
      const direction: 'buy_pt' | 'sell_pt' = syIn > 0n ? 'buy_pt' : 'sell_pt';
      const dateKey = timestamp.toISOString().split('T')[0] ?? '';

      swapsWithImpact.push({
        timestamp,
        impactBps,
        tradeSizeSy,
        direction,
        txHash: swap.transaction_hash,
        dateKey,
      });
    }

    // Calculate summary statistics
    const totalSwaps = swapsWithImpact.length;

    if (totalSwaps === 0) {
      return NextResponse.json(
        {
          market: marketAddress,
          underlyingSymbol,
          period: { start: since.toISOString(), end: now.toISOString() },
          summary: {
            totalSwaps: 0,
            medianImpactBps: 0,
            p95ImpactBps: 0,
            avgImpactBps: 0,
            maxImpactBps: 0,
            avgTradeSizeSy: '0',
          },
          distribution: [],
          timeSeries: [],
          recentSwaps: [],
        },
        { headers: getCacheHeaders('MEDIUM') }
      );
    }

    // Sort impacts for percentile calculations
    const sortedImpacts = swapsWithImpact.map((s) => s.impactBps).sort((a, b) => a - b);

    const medianIdx = Math.floor(totalSwaps / 2);
    const p95Idx = Math.floor(totalSwaps * 0.95);

    const medianImpactBps = sortedImpacts[medianIdx] ?? 0;
    const p95ImpactBps = sortedImpacts[Math.min(p95Idx, totalSwaps - 1)] ?? 0;
    const avgImpactBps = sortedImpacts.reduce((a, b) => a + b, 0) / totalSwaps;
    const maxImpactBps = sortedImpacts[totalSwaps - 1] ?? 0;

    const totalTradeSize = swapsWithImpact.reduce((sum, s) => sum + s.tradeSizeSy, 0n);
    const avgTradeSizeSy = totalTradeSize / BigInt(totalSwaps);

    // Build distribution buckets
    const buckets: ImpactDistributionBucket[] = [
      { minBps: 0, maxBps: 5, count: 0, label: '0-5 bps' },
      { minBps: 5, maxBps: 10, count: 0, label: '5-10 bps' },
      { minBps: 10, maxBps: 25, count: 0, label: '10-25 bps' },
      { minBps: 25, maxBps: 50, count: 0, label: '25-50 bps' },
      { minBps: 50, maxBps: 100, count: 0, label: '50-100 bps' },
      { minBps: 100, maxBps: Infinity, count: 0, label: '>100 bps' },
    ];

    for (const swap of swapsWithImpact) {
      for (const bucket of buckets) {
        if (swap.impactBps >= bucket.minBps && swap.impactBps < bucket.maxBps) {
          bucket.count++;
          break;
        }
      }
    }

    // Build time series by day
    const dailyStats = new Map<string, { impacts: number[]; count: number }>();

    for (const swap of swapsWithImpact) {
      if (!dailyStats.has(swap.dateKey)) {
        dailyStats.set(swap.dateKey, { impacts: [], count: 0 });
      }
      const day = dailyStats.get(swap.dateKey);
      if (day) {
        day.impacts.push(swap.impactBps);
        day.count++;
      }
    }

    const timeSeries: DailyImpactStats[] = Array.from(dailyStats.entries())
      .map(([date, data]) => {
        const sorted = data.impacts.sort((a, b) => a - b);
        const n = sorted.length;
        const median = sorted[Math.floor(n / 2)] ?? 0;
        const p95 = sorted[Math.min(Math.floor(n * 0.95), n - 1)] ?? 0;
        const avg = sorted.reduce((a, b) => a + b, 0) / n;

        return {
          date,
          medianBps: median,
          p95Bps: p95,
          avgBps: avg,
          swapCount: data.count,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get recent swaps (most recent 20)
    const recentSwaps = swapsWithImpact.slice(0, 20).map((s) => ({
      timestamp: s.timestamp.toISOString(),
      impactBps: s.impactBps,
      tradeSizeSy: s.tradeSizeSy.toString(),
      direction: s.direction,
      txHash: s.txHash,
    }));

    return NextResponse.json(
      {
        market: marketAddress,
        underlyingSymbol,
        period: {
          start: since.toISOString(),
          end: now.toISOString(),
        },
        summary: {
          totalSwaps,
          medianImpactBps,
          p95ImpactBps,
          avgImpactBps,
          maxImpactBps,
          avgTradeSizeSy: avgTradeSizeSy.toString(),
        },
        distribution: buckets,
        timeSeries,
        recentSwaps,
      },
      { headers: getCacheHeaders('MEDIUM') }
    );
  } catch (error) {
    logError(error, { module: 'analytics/execution-quality', market: marketAddress });
    return NextResponse.json(
      {
        market: marketAddress,
        underlyingSymbol: '',
        period: { start: '', end: '' },
        summary: {
          totalSwaps: 0,
          medianImpactBps: 0,
          p95ImpactBps: 0,
          avgImpactBps: 0,
          maxImpactBps: 0,
          avgTradeSizeSy: '0',
        },
        distribution: [],
        timeSeries: [],
        recentSwaps: [],
      },
      { status: 500 }
    );
  }
}
