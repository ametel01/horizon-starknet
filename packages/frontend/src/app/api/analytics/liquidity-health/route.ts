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

/**
 * Health score levels
 */
type HealthLevel = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * Liquidity health metrics for a single market
 */
interface MarketLiquidityHealth {
  market: string;
  underlyingSymbol: string;
  isExpired: boolean;
  /** TVL in SY terms (WAD string) */
  tvlSy: string;
  /** 24h volume in SY terms (WAD string) */
  volume24hSy: string;
  /** Utilization = volume / TVL */
  utilizationPercent: number;
  /** Spread proxy - median price impact of recent swaps (bps) */
  spreadProxyBps: number;
  /** Depth score - normalized 0-100 based on TVL and spread */
  depthScore: number;
  /** Overall health score 0-100 */
  healthScore: number;
  /** Health level classification */
  healthLevel: HealthLevel;
  /** Number of swaps in analysis period */
  swapCount: number;
  /** Estimated max trade size (SY) for 50bps impact */
  maxTrade50bps: string;
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
  /** Number of days to analyze for spread calculation */
  days: z.coerce.number().int().min(1).max(30).default(7),
});

/**
 * Calculate health level from score
 */
function getHealthLevel(score: number): HealthLevel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

/**
 * Calculate price impact in basis points from ln-rate change
 */
function calculateImpactBps(lnRateBefore: bigint, lnRateAfter: bigint): number {
  const before = Number(lnRateBefore) / Number(WAD);
  const after = Number(lnRateAfter) / Number(WAD);
  return Math.abs(after - before) * 10_000;
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx] ?? 0;
}

/**
 * GET /api/analytics/liquidity-health
 *
 * Returns liquidity health metrics for all markets including:
 * - Spread proxy (median price impact)
 * - Depth score
 * - Overall health score
 * - Utilization metrics
 *
 * Query params:
 * - days: number (default: 7, max: 30) - Days to analyze for spread
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult;

  const searchParams = request.nextUrl.searchParams;

  // Validate query parameters
  const params = validateQuery(searchParams, liquidityHealthQuerySchema);
  if (params instanceof NextResponse) return params;

  const { days } = params;

  const now = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    // Get all active markets
    const markets = await db
      .select()
      .from(marketCurrentState)
      .orderBy(
        desc(
          sql`CAST(${marketCurrentState.sy_reserve} AS NUMERIC) + CAST(${marketCurrentState.pt_reserve} AS NUMERIC)`
        )
      );

    if (markets.length === 0) {
      return NextResponse.json({
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
      } satisfies LiquidityHealthResponse);
    }

    // Calculate health metrics for each market
    const marketHealths: MarketLiquidityHealth[] = [];
    let totalTvlSy = 0n;
    let totalVolume24hSy = 0n;
    let totalSpreadBps = 0;
    let totalHealthScore = 0;

    for (const market of markets) {
      const marketAddress = market.market;
      if (!marketAddress) continue;

      // Calculate TVL
      const syReserve = BigInt(market.sy_reserve ?? '0');
      const ptReserve = BigInt(market.pt_reserve ?? '0');
      const tvlSy = syReserve + ptReserve;

      // Get 24h volume from current state (SY + PT volume)
      const syVolume24h = BigInt(market.sy_volume_24h ?? '0');
      const ptVolume24h = BigInt(market.pt_volume_24h ?? '0');
      const volume24hSy = syVolume24h + ptVolume24h;

      // Get recent swaps for spread calculation
      const swaps = await db
        .select()
        .from(marketSwap)
        .where(eq(marketSwap.market, marketAddress))
        .orderBy(desc(marketSwap.block_timestamp))
        .limit(100);

      // Filter to analysis period
      const recentSwaps = swaps.filter((s) => s.block_timestamp >= since);

      // Calculate spread proxy (median impact)
      const impacts: number[] = [];
      for (const swap of recentSwaps) {
        const impact = calculateImpactBps(
          BigInt(swap.implied_rate_before),
          BigInt(swap.implied_rate_after)
        );
        impacts.push(impact);
      }
      impacts.sort((a, b) => a - b);

      const spreadProxyBps = percentile(impacts, 0.5);
      const p95ImpactBps = percentile(impacts, 0.95);

      // Calculate utilization
      const utilizationPercent = tvlSy > 0n ? (Number(volume24hSy) / Number(tvlSy)) * 100 : 0;

      // Calculate depth score (0-100)
      // Higher TVL and lower spread = higher score
      const tvlScore = Math.min(Number(tvlSy) / Number(WAD) / 1000, 100); // 1000 SY = 100 points
      const spreadScore = Math.max(0, 100 - spreadProxyBps * 2); // Lower spread = higher score
      const depthScore = Math.round(tvlScore * 0.6 + spreadScore * 0.4);

      // Calculate overall health score
      // Factors: depth, spread, activity
      const activityScore = recentSwaps.length > 0 ? Math.min(recentSwaps.length * 5, 100) : 0;
      const impactConsistency =
        p95ImpactBps > 0 && spreadProxyBps > 0
          ? Math.min(100, (spreadProxyBps / p95ImpactBps) * 100)
          : 50;

      const healthScore = Math.round(
        depthScore * 0.4 + spreadScore * 0.3 + activityScore * 0.2 + impactConsistency * 0.1
      );

      // Estimate max trade for 50bps impact
      // Rough approximation: if current spread is X bps, 50bps allows ~(50/X) times that volume
      const avgTradeSize =
        recentSwaps.length > 0
          ? recentSwaps.reduce((sum, s) => {
              const syTotal = BigInt(s.sy_in) + BigInt(s.sy_out);
              return sum + syTotal;
            }, 0n) / BigInt(recentSwaps.length)
          : tvlSy / 100n;

      const maxTrade50bps =
        spreadProxyBps > 0
          ? (avgTradeSize * 50n) / BigInt(Math.max(1, Math.round(spreadProxyBps)))
          : tvlSy / 10n;

      const isExpired = market.is_expired ?? false;

      marketHealths.push({
        market: marketAddress,
        underlyingSymbol: market.underlying_symbol ?? 'Unknown',
        isExpired,
        tvlSy: tvlSy.toString(),
        volume24hSy: volume24hSy.toString(),
        utilizationPercent,
        spreadProxyBps,
        depthScore,
        healthScore,
        healthLevel: getHealthLevel(healthScore),
        swapCount: recentSwaps.length,
        maxTrade50bps: maxTrade50bps.toString(),
      });

      // Accumulate protocol totals
      totalTvlSy += tvlSy;
      totalVolume24hSy += volume24hSy;
      totalSpreadBps += spreadProxyBps;
      totalHealthScore += healthScore;
    }

    // Calculate protocol averages
    const marketsAnalyzed = marketHealths.length;
    const avgSpreadProxyBps = marketsAnalyzed > 0 ? totalSpreadBps / marketsAnalyzed : 0;
    const avgHealthScore = marketsAnalyzed > 0 ? totalHealthScore / marketsAnalyzed : 0;

    // Sort markets by health score (best first)
    marketHealths.sort((a, b) => b.healthScore - a.healthScore);

    const response: LiquidityHealthResponse = {
      timestamp: now.toISOString(),
      period: {
        start: since.toISOString(),
        end: now.toISOString(),
      },
      protocol: {
        totalTvlSy: totalTvlSy.toString(),
        totalVolume24hSy: totalVolume24hSy.toString(),
        avgSpreadProxyBps,
        avgHealthScore: Math.round(avgHealthScore),
        marketsAnalyzed,
      },
      markets: marketHealths,
    };

    return NextResponse.json(response, { headers: getCacheHeaders('MEDIUM') });
  } catch (error) {
    logError(error, { module: 'analytics/liquidity-health' });
    return NextResponse.json({ error: 'Failed to calculate liquidity health' }, { status: 500 });
  }
}
