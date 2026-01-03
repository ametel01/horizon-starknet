import { calcSwapExactPtForSy, calcSwapExactSyForPt, type MarketState } from '@shared/math/amm';
import { WAD_BIGINT } from '@shared/math/wad';
import { getCacheHeaders } from '@shared/server/cache';
import { db, marketCurrentState, marketFactoryMarketCreated } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { starknetAddressSchema, validateQuery } from '@shared/server/validations/api';
import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Depth point - price impact at a specific trade size
 */
interface DepthPoint {
  /** Trade size in SY (WAD string) */
  tradeSizeSy: string;
  /** Trade size as percentage of TVL */
  tradeSizePercent: number;
  /** Price impact in basis points */
  impactBps: number;
  /** Effective price (SY per PT) */
  effectivePrice: string;
  /** Output amount */
  outputAmount: string;
}

/**
 * Response type for GET /api/analytics/depth-curve
 */
export interface DepthCurveResponse {
  market: string;
  underlyingSymbol: string;
  timestamp: string;
  /** Current market state */
  state: {
    syReserve: string;
    ptReserve: string;
    totalLp: string;
    lnImpliedRate: string;
    spotPricePtSy: string;
    tvlSy: string;
  };
  /** Buy PT (sell SY) depth curve */
  buyPtCurve: DepthPoint[];
  /** Sell PT (buy SY) depth curve */
  sellPtCurve: DepthPoint[];
  /** Summary metrics */
  summary: {
    /** Trade size (% of TVL) that causes 0.5% slippage */
    slippage50bpsSize: number;
    /** Trade size (% of TVL) that causes 1% slippage */
    slippage100bpsSize: number;
    /** Maximum trade size simulated */
    maxTradeSize: string;
  };
}

const depthCurveQuerySchema = z.object({
  /** Number of points on the curve */
  points: z.coerce.number().int().min(5).max(50).default(20),
  /** Maximum trade size as % of TVL */
  maxPercent: z.coerce.number().min(0.1).max(50).default(10),
});

/**
 * Build MarketState from database records
 */
function buildMarketState(
  current: typeof marketCurrentState.$inferSelect,
  created: typeof marketFactoryMarketCreated.$inferSelect | undefined
): MarketState {
  return {
    syReserve: BigInt(current.sy_reserve ?? '0'),
    ptReserve: BigInt(current.pt_reserve ?? '0'),
    totalLp: BigInt(current.total_lp ?? '0'),
    scalarRoot: BigInt(created?.scalar_root ?? '1000000000000000000'), // Default 1 WAD
    initialAnchor: BigInt(created?.initial_anchor ?? '1000000000000000000'),
    feeRate: BigInt(current.ln_fee_rate_root ?? '3000000000000000'), // Default 0.3%
    expiry: BigInt(current.expiry ?? 0),
    lastLnImpliedRate: BigInt(current.implied_rate ?? '0'),
  };
}

/**
 * Try to calculate a single buy PT depth point.
 * Returns null if calculation fails or inputs are invalid.
 */
function tryCalculateBuyPtPoint(
  state: MarketState,
  tradeSizeSy: bigint,
  percent: number
): DepthPoint | null {
  try {
    const result = calcSwapExactSyForPt(state, tradeSizeSy);
    return {
      tradeSizeSy: tradeSizeSy.toString(),
      tradeSizePercent: percent,
      impactBps: result.priceImpact * 10000,
      effectivePrice: result.effectivePrice.toString(),
      outputAmount: result.amountOut.toString(),
    };
  } catch {
    return null;
  }
}

/**
 * Try to calculate a single sell PT depth point.
 * Converts SY trade size to PT amount using spot price estimate.
 * Returns null if calculation fails or PT amount exceeds reserves.
 */
function tryCalculateSellPtPoint(
  state: MarketState,
  tradeSizeSy: bigint,
  percent: number
): DepthPoint | null {
  // Use spot price to estimate PT amount
  const spotPtPrice =
    state.lastLnImpliedRate > 0n
      ? WAD_BIGINT - (state.lastLnImpliedRate * WAD_BIGINT) / (100n * WAD_BIGINT)
      : WAD_BIGINT;
  const ptAmount = spotPtPrice > 0n ? (tradeSizeSy * WAD_BIGINT) / spotPtPrice : tradeSizeSy;

  if (ptAmount >= state.ptReserve) {
    return null;
  }

  try {
    const result = calcSwapExactPtForSy(state, ptAmount);
    return {
      tradeSizeSy: tradeSizeSy.toString(),
      tradeSizePercent: percent,
      impactBps: result.priceImpact * 10000,
      effectivePrice: result.effectivePrice.toString(),
      outputAmount: result.amountOut.toString(),
    };
  } catch {
    return null;
  }
}

/**
 * Calculate depth curve points for a given direction
 */
function calculateDepthCurve(
  state: MarketState,
  tvlSy: bigint,
  isBuyPt: boolean,
  numPoints: number,
  maxPercent: number
): DepthPoint[] {
  const points: DepthPoint[] = [];
  const calculatePoint = isBuyPt ? tryCalculateBuyPtPoint : tryCalculateSellPtPoint;

  for (let i = 1; i <= numPoints; i++) {
    const percent = (maxPercent * i) / numPoints;
    const tradeSizeSy = (tvlSy * BigInt(Math.round(percent * 100))) / 10000n;

    if (tradeSizeSy === 0n) continue;

    const point = calculatePoint(state, tradeSizeSy, percent);
    if (point) {
      points.push(point);
    }
  }

  return points;
}

/**
 * Find trade size that causes a specific slippage level
 */
function findSlippageSize(curve: DepthPoint[], targetBps: number): number {
  for (const point of curve) {
    if (point.impactBps >= targetBps) {
      return point.tradeSizePercent;
    }
  }
  // If we never hit the target, return max percent
  return curve.length > 0 ? (curve[curve.length - 1]?.tradeSizePercent ?? 0) : 0;
}

/**
 * GET /api/analytics/depth-curve
 *
 * Simulates price impact at various trade sizes using AMM math.
 * Returns depth curves for both buy and sell directions.
 *
 * Query params:
 * - market: string (required) - Market address
 * - points: number (default: 20, max: 50) - Number of curve points
 * - maxPercent: number (default: 10, max: 50) - Max trade size as % of TVL
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult;

  const searchParams = request.nextUrl.searchParams;
  const marketAddress = searchParams.get('market');

  // Validate market address
  if (!marketAddress) {
    return NextResponse.json({ error: 'Market address is required' }, { status: 400 });
  }

  const addressResult = starknetAddressSchema.safeParse(marketAddress);
  if (!addressResult.success) {
    return NextResponse.json({ error: 'Invalid market address' }, { status: 400 });
  }

  // Validate query parameters
  const params = validateQuery(searchParams, depthCurveQuerySchema);
  if (params instanceof NextResponse) return params;

  const { points, maxPercent } = params;

  try {
    // Get current market state
    const currentResult = await db
      .select()
      .from(marketCurrentState)
      .where(eq(marketCurrentState.market, marketAddress))
      .limit(1);

    const current = currentResult[0];
    if (!current) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    // Get market creation data for scalar_root and initial_anchor
    const createdResult = await db
      .select()
      .from(marketFactoryMarketCreated)
      .where(eq(marketFactoryMarketCreated.market, marketAddress))
      .limit(1);

    const created = createdResult[0];
    const underlyingSymbol = current.underlying_symbol ?? 'Unknown';

    // Build market state
    const state = buildMarketState(current, created);

    // Calculate TVL in SY terms
    const syReserve = state.syReserve;
    const ptReserve = state.ptReserve;
    const tvlSy = syReserve + ptReserve; // Simplified TVL

    if (tvlSy === 0n) {
      return NextResponse.json({
        market: marketAddress,
        underlyingSymbol,
        timestamp: new Date().toISOString(),
        state: {
          syReserve: '0',
          ptReserve: '0',
          totalLp: '0',
          lnImpliedRate: '0',
          spotPricePtSy: String(WAD_BIGINT),
          tvlSy: '0',
        },
        buyPtCurve: [],
        sellPtCurve: [],
        summary: {
          slippage50bpsSize: 0,
          slippage100bpsSize: 0,
          maxTradeSize: '0',
        },
      } satisfies DepthCurveResponse);
    }

    // Calculate spot PT price
    const spotPricePtSy = WAD_BIGINT; // Simplified - actual calculation would use getPtPrice

    // Generate depth curves
    const buyPtCurve = calculateDepthCurve(state, tvlSy, true, points, maxPercent);
    const sellPtCurve = calculateDepthCurve(state, tvlSy, false, points, maxPercent);

    // Calculate summary metrics
    const slippage50bpsSize = Math.min(
      findSlippageSize(buyPtCurve, 50),
      findSlippageSize(sellPtCurve, 50)
    );
    const slippage100bpsSize = Math.min(
      findSlippageSize(buyPtCurve, 100),
      findSlippageSize(sellPtCurve, 100)
    );

    const maxTradeSize = (tvlSy * BigInt(Math.round(maxPercent * 100))) / 10000n;

    const response: DepthCurveResponse = {
      market: marketAddress,
      underlyingSymbol,
      timestamp: new Date().toISOString(),
      state: {
        syReserve: syReserve.toString(),
        ptReserve: ptReserve.toString(),
        totalLp: state.totalLp.toString(),
        lnImpliedRate: state.lastLnImpliedRate.toString(),
        spotPricePtSy: spotPricePtSy.toString(),
        tvlSy: tvlSy.toString(),
      },
      buyPtCurve,
      sellPtCurve,
      summary: {
        slippage50bpsSize,
        slippage100bpsSize,
        maxTradeSize: maxTradeSize.toString(),
      },
    };

    return NextResponse.json(response, { headers: getCacheHeaders('MEDIUM') });
  } catch (error) {
    logError(error, { module: 'analytics/depth-curve', market: marketAddress });
    return NextResponse.json({ error: 'Failed to calculate depth curve' }, { status: 500 });
  }
}
