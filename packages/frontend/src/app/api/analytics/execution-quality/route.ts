import { getCacheHeaders } from '@shared/server/cache';
import { db, marketCurrentState, marketSwap } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { starknetAddressSchema, validateQuery } from '@shared/server/validations/api';
import { desc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// ----- Constants -----

const WAD = BigInt(10) ** BigInt(18);

// ----- Types -----

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

interface SwapWithImpact {
  timestamp: Date;
  impactBps: number;
  tradeSizeSy: bigint;
  direction: 'buy_pt' | 'sell_pt';
  txHash: string;
  dateKey: string;
}

interface SwapRow {
  block_timestamp: Date;
  implied_rate_before: string;
  implied_rate_after: string;
  sy_in: string;
  sy_out: string;
  pt_in: string;
  pt_out: string;
  transaction_hash: string;
}

// ----- Math Helpers -----

function calculateImpactBps(lnRateBefore: bigint, lnRateAfter: bigint): number {
  const before = Number(lnRateBefore) / Number(WAD);
  const after = Number(lnRateAfter) / Number(WAD);
  return Math.abs(after - before) * 10_000;
}

function calculateTradeSize(syIn: bigint, syOut: bigint, ptIn: bigint, ptOut: bigint): bigint {
  const syTotal = (syIn > 0n ? syIn : 0n) + (syOut > 0n ? syOut : 0n);
  return syTotal > 0n ? syTotal : ptIn + ptOut;
}

function calculatePercentile(sortedValues: number[], percentile: number): number {
  const idx = Math.floor(sortedValues.length * percentile);
  return sortedValues[Math.min(idx, sortedValues.length - 1)] ?? 0;
}

function calculateMedian(sortedValues: number[]): number {
  return sortedValues[Math.floor(sortedValues.length / 2)] ?? 0;
}

function calculateAverage(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

// ----- Swap Processing -----

function mapSwapToImpact(swap: SwapRow): SwapWithImpact {
  const syIn = BigInt(swap.sy_in);
  const syOut = BigInt(swap.sy_out);
  const ptIn = BigInt(swap.pt_in);
  const ptOut = BigInt(swap.pt_out);

  return {
    timestamp: swap.block_timestamp,
    impactBps: calculateImpactBps(
      BigInt(swap.implied_rate_before),
      BigInt(swap.implied_rate_after)
    ),
    tradeSizeSy: calculateTradeSize(syIn, syOut, ptIn, ptOut),
    direction: syIn > 0n ? 'buy_pt' : 'sell_pt',
    txHash: swap.transaction_hash,
    dateKey: swap.block_timestamp.toISOString().split('T')[0] ?? '',
  };
}

function filterAndMapSwaps(swaps: SwapRow[], since: Date): SwapWithImpact[] {
  return swaps.filter((swap) => swap.block_timestamp >= since).map(mapSwapToImpact);
}

// ----- Statistics Helpers -----

interface SummaryStats {
  totalSwaps: number;
  medianImpactBps: number;
  p95ImpactBps: number;
  avgImpactBps: number;
  maxImpactBps: number;
  avgTradeSizeSy: bigint;
}

function calculateSummaryStats(swaps: SwapWithImpact[]): SummaryStats {
  const sortedImpacts = swaps.map((s) => s.impactBps).sort((a, b) => a - b);
  const totalTradeSize = swaps.reduce((sum, s) => sum + s.tradeSizeSy, 0n);

  return {
    totalSwaps: swaps.length,
    medianImpactBps: calculateMedian(sortedImpacts),
    p95ImpactBps: calculatePercentile(sortedImpacts, 0.95),
    avgImpactBps: calculateAverage(sortedImpacts),
    maxImpactBps: sortedImpacts[sortedImpacts.length - 1] ?? 0,
    avgTradeSizeSy: swaps.length > 0 ? totalTradeSize / BigInt(swaps.length) : 0n,
  };
}

// ----- Distribution Helpers -----

function createDistributionBuckets(): ImpactDistributionBucket[] {
  return [
    { minBps: 0, maxBps: 5, count: 0, label: '0-5 bps' },
    { minBps: 5, maxBps: 10, count: 0, label: '5-10 bps' },
    { minBps: 10, maxBps: 25, count: 0, label: '10-25 bps' },
    { minBps: 25, maxBps: 50, count: 0, label: '25-50 bps' },
    { minBps: 50, maxBps: 100, count: 0, label: '50-100 bps' },
    { minBps: 100, maxBps: Number.POSITIVE_INFINITY, count: 0, label: '>100 bps' },
  ];
}

function buildDistribution(swaps: SwapWithImpact[]): ImpactDistributionBucket[] {
  const buckets = createDistributionBuckets();

  for (const swap of swaps) {
    const bucket = buckets.find((b) => swap.impactBps >= b.minBps && swap.impactBps < b.maxBps);
    if (bucket) bucket.count++;
  }

  return buckets;
}

// ----- Time Series Helpers -----

function buildDailyTimeSeries(swaps: SwapWithImpact[]): DailyImpactStats[] {
  const dailyStats = new Map<string, number[]>();

  for (const swap of swaps) {
    const existing = dailyStats.get(swap.dateKey) ?? [];
    existing.push(swap.impactBps);
    dailyStats.set(swap.dateKey, existing);
  }

  return Array.from(dailyStats.entries())
    .map(([date, impacts]) => {
      const sorted = impacts.sort((a, b) => a - b);
      return {
        date,
        medianBps: calculateMedian(sorted),
        p95Bps: calculatePercentile(sorted, 0.95),
        avgBps: calculateAverage(sorted),
        swapCount: impacts.length,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ----- Response Helpers -----

function createEmptyResponse(
  market: string,
  underlyingSymbol: string,
  period: { start: string; end: string }
): ExecutionQualityResponse {
  return {
    market,
    underlyingSymbol,
    period,
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
  };
}

function formatRecentSwaps(swaps: SwapWithImpact[], limit: number) {
  return swaps.slice(0, limit).map((s) => ({
    timestamp: s.timestamp.toISOString(),
    impactBps: s.impactBps,
    tradeSizeSy: s.tradeSizeSy.toString(),
    direction: s.direction,
    txHash: s.txHash,
  }));
}

function buildSuccessResponse(
  marketAddress: string,
  underlyingSymbol: string,
  period: { start: string; end: string },
  swaps: SwapWithImpact[]
): ExecutionQualityResponse {
  const stats = calculateSummaryStats(swaps);
  return {
    market: marketAddress,
    underlyingSymbol,
    period,
    summary: {
      totalSwaps: stats.totalSwaps,
      medianImpactBps: stats.medianImpactBps,
      p95ImpactBps: stats.p95ImpactBps,
      avgImpactBps: stats.avgImpactBps,
      maxImpactBps: stats.maxImpactBps,
      avgTradeSizeSy: stats.avgTradeSizeSy.toString(),
    },
    distribution: buildDistribution(swaps),
    timeSeries: buildDailyTimeSeries(swaps),
    recentSwaps: formatRecentSwaps(swaps, 20),
  };
}

// ----- Validation Helpers -----

interface ValidationResult {
  marketAddress: string;
  days: number;
}

const executionQualityQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

function validateRequestParams(searchParams: URLSearchParams): ValidationResult | NextResponse {
  const marketAddress = searchParams.get('market');
  const emptyPeriod = { start: '', end: '' };

  if (!marketAddress) {
    return NextResponse.json(createEmptyResponse('', '', emptyPeriod), { status: 400 });
  }

  const addressResult = starknetAddressSchema.safeParse(marketAddress);
  if (!addressResult.success) {
    return NextResponse.json(createEmptyResponse(marketAddress, '', emptyPeriod), { status: 400 });
  }

  const params = validateQuery(searchParams, executionQualityQuerySchema);
  if (params instanceof NextResponse) return params;

  return { marketAddress, days: params.days };
}

function calculatePeriod(days: number): { since: Date; period: { start: string; end: string } } {
  const now = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);
  return {
    since,
    period: { start: since.toISOString(), end: now.toISOString() },
  };
}

// ----- Database Queries -----

async function fetchMarketData(marketAddress: string) {
  return Promise.all([
    db
      .select()
      .from(marketCurrentState)
      .where(eq(marketCurrentState.market, marketAddress))
      .limit(1),
    db
      .select()
      .from(marketSwap)
      .where(eq(marketSwap.market, marketAddress))
      .orderBy(desc(marketSwap.block_timestamp)),
  ]);
}

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
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult;

  const validation = validateRequestParams(request.nextUrl.searchParams);
  if (validation instanceof NextResponse) return validation;

  const { marketAddress, days } = validation;
  const { since, period } = calculatePeriod(days);

  try {
    const [marketInfoResult, swaps] = await fetchMarketData(marketAddress);
    const underlyingSymbol = marketInfoResult[0]?.underlying_symbol ?? 'Unknown';
    const swapsWithImpact = filterAndMapSwaps(swaps, since);

    if (swapsWithImpact.length === 0) {
      return NextResponse.json(createEmptyResponse(marketAddress, underlyingSymbol, period), {
        headers: getCacheHeaders('MEDIUM'),
      });
    }

    const response = buildSuccessResponse(marketAddress, underlyingSymbol, period, swapsWithImpact);
    return NextResponse.json(response, { headers: getCacheHeaders('MEDIUM') });
  } catch (error) {
    logError(error, { module: 'analytics/execution-quality', market: marketAddress });
    return NextResponse.json(createEmptyResponse(marketAddress, '', { start: '', end: '' }), {
      status: 500,
    });
  }
}
