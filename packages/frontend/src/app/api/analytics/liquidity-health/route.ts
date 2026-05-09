import { getCacheHeaders } from '@shared/server/cache';
import { db, marketCurrentState, marketSwap } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { validateQuery } from '@shared/server/validations/api';
import { desc, eq, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const WAD = BigInt(10) ** BigInt(18);

// ----- Types -----

type HealthLevel = 'excellent' | 'good' | 'fair' | 'poor';

interface MarketLiquidityHealth {
  market: string;
  underlyingSymbol: string;
  isExpired: boolean;
  tvlSy: string;
  volume24hSy: string;
  utilizationPercent: number;
  spreadProxyBps: number;
  depthScore: number;
  healthScore: number;
  healthLevel: HealthLevel;
  swapCount: number;
  maxTrade50bps: string;
}

interface MarketStateRow {
  market: string | null;
  underlying_symbol: string | null;
  is_expired: boolean | null;
  sy_reserve: string | null;
  pt_reserve: string | null;
  sy_volume_24h: string | null;
  pt_volume_24h: string | null;
}

interface SwapRow {
  block_timestamp: Date;
  implied_rate_before: string;
  implied_rate_after: string;
  sy_in: string;
  sy_out: string;
}

interface ImpactStats {
  medianBps: number;
  p95Bps: number;
}

interface HealthScoreInputs {
  depthScore: number;
  spreadScore: number;
  activityScore: number;
  impactConsistency: number;
}

interface MarketHealthContext {
  marketAddress: string;
  market: MarketStateRow;
  recentSwaps: SwapRow[];
}

interface ProtocolTotals {
  tvlSy: bigint;
  volume24hSy: bigint;
  spreadBps: number;
  healthScore: number;
}

/**
 * Response type for GET /api/analytics/liquidity-health
 */
export interface LiquidityHealthResponse {
  timestamp: string;
  period: {
    start: string;
    end: string;
  };
  /** Protocol-wide metrics */
  protocol: {
    totalTvlSy: string;
    totalVolume24hSy: string;
    avgSpreadProxyBps: number;
    avgHealthScore: number;
    marketsAnalyzed: number;
  };
  /** Per-market health metrics */
  markets: MarketLiquidityHealth[];
}

const liquidityHealthQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
});

// ----- Helper Functions -----

function getHealthLevel(score: number): HealthLevel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

function calculateImpactBps(lnRateBefore: bigint, lnRateAfter: bigint): number {
  const before = Number(lnRateBefore) / Number(WAD);
  const after = Number(lnRateAfter) / Number(WAD);
  return Math.abs(after - before) * 10_000;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx] ?? 0;
}

function calculateImpactStats(swaps: SwapRow[]): ImpactStats {
  const impacts = swaps.map((swap) =>
    calculateImpactBps(BigInt(swap.implied_rate_before), BigInt(swap.implied_rate_after))
  );
  impacts.sort((a, b) => a - b);
  return {
    medianBps: percentile(impacts, 0.5),
    p95Bps: percentile(impacts, 0.95),
  };
}

function calculateDepthScore(tvlSy: bigint, spreadProxyBps: number): number {
  const tvlScore = Math.min(Number(tvlSy) / Number(WAD) / 1000, 100);
  const spreadScore = Math.max(0, 100 - spreadProxyBps * 2);
  return Math.round(tvlScore * 0.6 + spreadScore * 0.4);
}

function calculateHealthScore(inputs: HealthScoreInputs): number {
  const { depthScore, spreadScore, activityScore, impactConsistency } = inputs;
  return Math.round(
    depthScore * 0.4 + spreadScore * 0.3 + activityScore * 0.2 + impactConsistency * 0.1
  );
}

function calculateMaxTrade50bps(
  avgTradeSize: bigint,
  spreadProxyBps: number,
  tvlSy: bigint
): bigint {
  if (spreadProxyBps > 0) {
    return (avgTradeSize * 50n) / BigInt(Math.max(1, Math.round(spreadProxyBps)));
  }
  return tvlSy / 10n;
}

function calculateAvgTradeSize(swaps: SwapRow[], tvlSy: bigint): bigint {
  if (swaps.length === 0) {
    return tvlSy / 100n;
  }
  const totalSize = swaps.reduce((sum, s) => sum + BigInt(s.sy_in) + BigInt(s.sy_out), 0n);
  return totalSize / BigInt(swaps.length);
}

function buildMarketHealth(ctx: MarketHealthContext): MarketLiquidityHealth {
  const { marketAddress, market, recentSwaps } = ctx;

  const syReserve = BigInt(market.sy_reserve ?? '0');
  const ptReserve = BigInt(market.pt_reserve ?? '0');
  const tvlSy = syReserve + ptReserve;

  const syVolume24h = BigInt(market.sy_volume_24h ?? '0');
  const ptVolume24h = BigInt(market.pt_volume_24h ?? '0');
  const volume24hSy = syVolume24h + ptVolume24h;

  const impactStats = calculateImpactStats(recentSwaps);
  const spreadProxyBps = impactStats.medianBps;
  const spreadScore = Math.max(0, 100 - spreadProxyBps * 2);

  const utilizationPercent = tvlSy > 0n ? (Number(volume24hSy) / Number(tvlSy)) * 100 : 0;
  const depthScore = calculateDepthScore(tvlSy, spreadProxyBps);
  const activityScore = recentSwaps.length > 0 ? Math.min(recentSwaps.length * 5, 100) : 0;
  const impactConsistency =
    impactStats.p95Bps > 0 && spreadProxyBps > 0
      ? Math.min(100, (spreadProxyBps / impactStats.p95Bps) * 100)
      : 50;

  const healthScore = calculateHealthScore({
    depthScore,
    spreadScore,
    activityScore,
    impactConsistency,
  });
  const avgTradeSize = calculateAvgTradeSize(recentSwaps, tvlSy);
  const maxTrade50bps = calculateMaxTrade50bps(avgTradeSize, spreadProxyBps, tvlSy);

  return {
    market: marketAddress,
    underlyingSymbol: market.underlying_symbol ?? 'Unknown',
    isExpired: market.is_expired ?? false,
    tvlSy: tvlSy.toString(),
    volume24hSy: volume24hSy.toString(),
    utilizationPercent,
    spreadProxyBps,
    depthScore,
    healthScore,
    healthLevel: getHealthLevel(healthScore),
    swapCount: recentSwaps.length,
    maxTrade50bps: maxTrade50bps.toString(),
  };
}

function createEmptyResponse(now: Date, since: Date): LiquidityHealthResponse {
  return {
    timestamp: now.toISOString(),
    period: { start: since.toISOString(), end: now.toISOString() },
    protocol: {
      totalTvlSy: '0',
      totalVolume24hSy: '0',
      avgSpreadProxyBps: 0,
      avgHealthScore: 0,
      marketsAnalyzed: 0,
    },
    markets: [],
  };
}

function buildProtocolSummary(
  totals: ProtocolTotals,
  marketCount: number
): LiquidityHealthResponse['protocol'] {
  const avgSpreadProxyBps = marketCount > 0 ? totals.spreadBps / marketCount : 0;
  const avgHealthScore = marketCount > 0 ? Math.round(totals.healthScore / marketCount) : 0;
  return {
    totalTvlSy: totals.tvlSy.toString(),
    totalVolume24hSy: totals.volume24hSy.toString(),
    avgSpreadProxyBps,
    avgHealthScore,
    marketsAnalyzed: marketCount,
  };
}

async function fetchSwapsForMarket(marketAddress: string, since: Date): Promise<SwapRow[]> {
  const swaps = await db
    .select()
    .from(marketSwap)
    .where(eq(marketSwap.market, marketAddress))
    .orderBy(desc(marketSwap.block_timestamp))
    .limit(100);

  return swaps.filter((s) => s.block_timestamp >= since);
}

async function processMarket(
  market: MarketStateRow,
  since: Date
): Promise<MarketLiquidityHealth | null> {
  const marketAddress = market.market;
  if (!marketAddress) return null;

  const recentSwaps = await fetchSwapsForMarket(marketAddress, since);
  return buildMarketHealth({ marketAddress, market, recentSwaps });
}

function accumulateTotals(health: MarketLiquidityHealth, totals: ProtocolTotals): void {
  totals.tvlSy += BigInt(health.tvlSy);
  totals.volume24hSy += BigInt(health.volume24hSy);
  totals.spreadBps += health.spreadProxyBps;
  totals.healthScore += health.healthScore;
}

/**
 * GET /api/analytics/liquidity-health
 * Returns liquidity health metrics for all markets
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult;

  const params = validateQuery(request.nextUrl.searchParams, liquidityHealthQuerySchema);
  if (params instanceof NextResponse) return params;

  const now = new Date();
  const since = new Date();
  since.setDate(since.getDate() - params.days);

  try {
    const markets = await db
      .select()
      .from(marketCurrentState)
      .orderBy(
        desc(
          sql`CAST(${marketCurrentState.sy_reserve} AS NUMERIC) + CAST(${marketCurrentState.pt_reserve} AS NUMERIC)`
        )
      );

    if (markets.length === 0) {
      return NextResponse.json(createEmptyResponse(now, since) satisfies LiquidityHealthResponse);
    }

    const marketHealths = (
      await Promise.all(markets.map((market) => processMarket(market, since)))
    ).filter((health): health is MarketLiquidityHealth => health !== null);
    const totals: ProtocolTotals = { tvlSy: 0n, volume24hSy: 0n, spreadBps: 0, healthScore: 0 };

    for (const health of marketHealths) {
      accumulateTotals(health, totals);
    }

    marketHealths.sort((a, b) => b.healthScore - a.healthScore);

    const response: LiquidityHealthResponse = {
      timestamp: now.toISOString(),
      period: { start: since.toISOString(), end: now.toISOString() },
      protocol: buildProtocolSummary(totals, marketHealths.length),
      markets: marketHealths,
    };

    return NextResponse.json(response, { headers: getCacheHeaders('MEDIUM') });
  } catch (error) {
    logError(error, { module: 'analytics/liquidity-health' });
    return NextResponse.json({ error: 'Failed to calculate liquidity health' }, { status: 500 });
  }
}
