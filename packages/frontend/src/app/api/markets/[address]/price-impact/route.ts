import { eq, desc, and, gte } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db, marketSwap } from '@/lib/db';
import { logError } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const WAD = BigInt(10) ** BigInt(18);

/**
 * Calculate price impact percentage from before/after rates
 * Impact = (rate_after - rate_before) / rate_before * 100
 */
function calculateImpact(rateBefore: string, rateAfter: string): number {
  const before = BigInt(rateBefore);
  const after = BigInt(rateAfter);

  if (before === 0n) return 0;

  // Calculate impact as percentage with WAD precision
  const diff = after - before;
  const impactWad = (diff * WAD * 100n) / before;

  return Number(impactWad) / Number(WAD);
}

/**
 * Get trade size in SY terms (total value moved)
 */
function getTradeSize(syIn: string, syOut: string): bigint {
  const inAmount = BigInt(syIn);
  const outAmount = BigInt(syOut);
  // Use the larger of in/out as the trade size
  return inAmount > outAmount ? inAmount : outAmount;
}

interface ImpactBucket {
  range: string;
  minSize: string;
  maxSize: string;
  count: number;
  avgImpact: number;
  minImpact: number;
  maxImpact: number;
}

interface ImpactDistribution {
  bucket: string;
  count: number;
  percentage: number;
}

interface RecentImpact {
  timestamp: string;
  impact: number;
  tradeSize: string;
  direction: 'buy_pt' | 'sell_pt';
}

interface PriceImpactResponse {
  market: string;
  totalSwaps: number;
  avgImpact: number;
  medianImpact: number;
  maxImpact: number;
  // Impact by trade size buckets
  impactBySize: ImpactBucket[];
  // Impact distribution (for histogram)
  impactDistribution: ImpactDistribution[];
  // Recent swaps with impact
  recentImpacts: RecentImpact[];
}

/**
 * GET /api/markets/[address]/price-impact
 * Get price impact statistics for a market
 *
 * Query params:
 * - days: number - lookback period (default 30)
 * - limit: number - max recent impacts to return (default 20)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<PriceImpactResponse | { error: string }>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult)
    return rateLimitResult as NextResponse<PriceImpactResponse | { error: string }>;

  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get('days') ?? '30');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);

  try {
    // Calculate the start date
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // Query market swaps with rate data
    const swaps = await db
      .select({
        blockTimestamp: marketSwap.block_timestamp,
        syIn: marketSwap.sy_in,
        syOut: marketSwap.sy_out,
        ptIn: marketSwap.pt_in,
        ptOut: marketSwap.pt_out,
        impliedRateBefore: marketSwap.implied_rate_before,
        impliedRateAfter: marketSwap.implied_rate_after,
      })
      .from(marketSwap)
      .where(and(eq(marketSwap.market, address), gte(marketSwap.block_timestamp, sinceDate)))
      .orderBy(desc(marketSwap.block_timestamp));

    if (swaps.length === 0) {
      return NextResponse.json({
        market: address,
        totalSwaps: 0,
        avgImpact: 0,
        medianImpact: 0,
        maxImpact: 0,
        impactBySize: [],
        impactDistribution: [],
        recentImpacts: [],
      });
    }

    // Calculate impacts for all swaps
    const impactData: {
      impact: number;
      tradeSize: bigint;
      timestamp: Date;
      direction: 'buy_pt' | 'sell_pt';
    }[] = [];

    for (const swap of swaps) {
      const impact = calculateImpact(swap.impliedRateBefore, swap.impliedRateAfter);
      const tradeSize = getTradeSize(swap.syIn, swap.syOut);
      const direction = BigInt(swap.syIn) > BigInt(swap.syOut) ? 'buy_pt' : 'sell_pt';

      impactData.push({
        impact: Math.abs(impact),
        tradeSize,
        timestamp: swap.blockTimestamp,
        direction,
      });
    }

    // Sort by impact for percentile calculations
    const sortedImpacts = [...impactData].sort((a, b) => a.impact - b.impact);

    // Calculate statistics
    const totalSwaps = impactData.length;
    const avgImpact = impactData.reduce((sum, d) => sum + d.impact, 0) / totalSwaps;
    const medianImpact = sortedImpacts[Math.floor(totalSwaps / 2)]?.impact ?? 0;
    const maxImpact = sortedImpacts[totalSwaps - 1]?.impact ?? 0;

    // Define size buckets (in WAD)
    const sizeBuckets = [
      { min: 0n, max: WAD / 10n, label: '< 0.1' },
      { min: WAD / 10n, max: WAD, label: '0.1 - 1' },
      { min: WAD, max: WAD * 10n, label: '1 - 10' },
      { min: WAD * 10n, max: WAD * 100n, label: '10 - 100' },
      { min: WAD * 100n, max: WAD * 1000n, label: '100 - 1K' },
      { min: WAD * 1000n, max: WAD * BigInt(1_000_000), label: '> 1K' },
    ];

    // Calculate impact by size bucket
    const impactBySize: ImpactBucket[] = sizeBuckets.map((bucket) => {
      const bucketSwaps = impactData.filter(
        (d) => d.tradeSize >= bucket.min && d.tradeSize < bucket.max
      );

      if (bucketSwaps.length === 0) {
        return {
          range: bucket.label,
          minSize: bucket.min.toString(),
          maxSize: bucket.max.toString(),
          count: 0,
          avgImpact: 0,
          minImpact: 0,
          maxImpact: 0,
        };
      }

      const impacts = bucketSwaps.map((s) => s.impact);
      return {
        range: bucket.label,
        minSize: bucket.min.toString(),
        maxSize: bucket.max.toString(),
        count: bucketSwaps.length,
        avgImpact: impacts.reduce((a, b) => a + b, 0) / impacts.length,
        minImpact: Math.min(...impacts),
        maxImpact: Math.max(...impacts),
      };
    });

    // Calculate impact distribution (histogram buckets)
    const distributionBuckets = [
      { min: 0, max: 0.01, label: '< 0.01%' },
      { min: 0.01, max: 0.05, label: '0.01-0.05%' },
      { min: 0.05, max: 0.1, label: '0.05-0.1%' },
      { min: 0.1, max: 0.25, label: '0.1-0.25%' },
      { min: 0.25, max: 0.5, label: '0.25-0.5%' },
      { min: 0.5, max: 1, label: '0.5-1%' },
      { min: 1, max: 100, label: '> 1%' },
    ];

    const impactDistribution: ImpactDistribution[] = distributionBuckets.map((bucket) => {
      const count = impactData.filter(
        (d) => d.impact >= bucket.min && d.impact < bucket.max
      ).length;
      return {
        bucket: bucket.label,
        count,
        percentage: (count / totalSwaps) * 100,
      };
    });

    // Get recent impacts
    const recentImpacts: RecentImpact[] = impactData.slice(0, limit).map((d) => ({
      timestamp: d.timestamp.toISOString(),
      impact: d.impact,
      tradeSize: d.tradeSize.toString(),
      direction: d.direction,
    }));

    return NextResponse.json({
      market: address,
      totalSwaps,
      avgImpact,
      medianImpact,
      maxImpact,
      impactBySize,
      impactDistribution,
      recentImpacts,
    });
  } catch (error) {
    logError(error, { module: 'markets/price-impact', marketAddress: address });
    return NextResponse.json({ error: 'Failed to fetch price impact data' }, { status: 500 });
  }
}
