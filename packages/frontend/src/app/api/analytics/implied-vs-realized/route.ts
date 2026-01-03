import { getCacheHeaders } from '@shared/server/cache';
import { db, marketCurrentState, marketDailyStats, oracleRateHistory } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import {
  dateRangeSchema,
  starknetAddressSchema,
  validateQuery,
} from '@shared/server/validations/api';
import { desc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const WAD = BigInt(10) ** BigInt(18);

/**
 * Convert ln-rate (WAD) to APY percentage
 */
function lnRateToApyPercent(lnRateWad: bigint): number {
  if (lnRateWad === 0n) return 0;
  const lnRate = Number(lnRateWad) / Number(WAD);
  return (Math.exp(lnRate) - 1) * 100;
}

/**
 * Calculate realized APY from exchange rate changes
 * Realized APY = (new_rate / old_rate - 1) * (365 / period_days) * 100
 */
function calculateRealizedApy(oldRateWad: bigint, newRateWad: bigint, periodDays: number): number {
  if (oldRateWad === 0n || periodDays <= 0) return 0;

  const oldRate = Number(oldRateWad) / Number(WAD);
  const newRate = Number(newRateWad) / Number(WAD);

  if (oldRate <= 0) return 0;

  const periodReturn = newRate / oldRate - 1;
  const annualized = periodReturn * (365 / periodDays);

  return annualized * 100;
}

interface ImpliedVsRealizedDataPoint {
  date: string;
  impliedApyPercent: number;
  realizedApyPercent: number;
  spreadPercent: number;
  exchangeRate: string;
}

interface ExchangeRateInfo {
  rate: bigint;
  prevRate: bigint | null;
}

/**
 * Creates an empty/error response with the given market address and status
 */
function createEmptyResponse(market: string, status: number): NextResponse {
  return NextResponse.json(
    {
      market,
      underlyingSymbol: '',
      dataPoints: [],
      summary: {
        avgImpliedApy: 0,
        avgRealizedApy: 0,
        avgSpread: 0,
        currentImpliedApy: 0,
        currentExchangeRate: '0',
      },
    },
    { status }
  );
}

/**
 * Builds a map of dates to exchange rates with previous rate tracking
 */
function buildExchangeRateMap(
  exchangeRateData: { block_timestamp: Date | null; new_rate: string | null }[]
): Map<string, ExchangeRateInfo> {
  const exchangeRateByDate = new Map<string, ExchangeRateInfo>();
  let prevRate: bigint | null = null;

  // Process exchange rates (oldest first for prev rate tracking)
  const sortedExchangeRates = [...exchangeRateData].reverse();
  for (const rate of sortedExchangeRates) {
    const dateKey = rate.block_timestamp?.toISOString().split('T')[0] ?? '';
    if (!dateKey) continue;

    const newRate = BigInt(rate.new_rate ?? '0');
    exchangeRateByDate.set(dateKey, { rate: newRate, prevRate });
    prevRate = newRate;
  }

  return exchangeRateByDate;
}

/**
 * Processes a single daily stat into a data point
 */
function processStatToDataPoint(
  stat: { day: Date | null; close_implied_rate: string | null; exchange_rate: string | null },
  since: Date,
  exchangeRateByDate: Map<string, ExchangeRateInfo>
): ImpliedVsRealizedDataPoint | null {
  const date = stat.day?.toISOString().split('T')[0] ?? '';
  if (!date || stat.day === null || stat.day < since) return null;

  const impliedApyPercent = lnRateToApyPercent(BigInt(stat.close_implied_rate ?? '0'));
  const exchangeRateWad = BigInt(stat.exchange_rate ?? '0');
  const exchangeRateInfo = exchangeRateByDate.get(date);

  let realizedApyPercent = 0;
  if (exchangeRateInfo?.prevRate !== undefined && exchangeRateInfo.prevRate !== null) {
    realizedApyPercent = calculateRealizedApy(exchangeRateInfo.prevRate, exchangeRateInfo.rate, 1);
  }

  return {
    date,
    impliedApyPercent,
    realizedApyPercent,
    spreadPercent: impliedApyPercent - realizedApyPercent,
    exchangeRate: exchangeRateWad.toString(),
  };
}

/**
 * Builds data points from daily stats and calculates running totals
 */
function buildDataPoints(
  dailyStatsData: {
    day: Date | null;
    close_implied_rate: string | null;
    exchange_rate: string | null;
  }[],
  since: Date,
  exchangeRateByDate: Map<string, ExchangeRateInfo>
): {
  dataPoints: ImpliedVsRealizedDataPoint[];
  totalImplied: number;
  totalRealized: number;
  count: number;
} {
  const dataPoints: ImpliedVsRealizedDataPoint[] = [];
  let totalImplied = 0;
  let totalRealized = 0;
  let count = 0;

  for (const stat of dailyStatsData) {
    const dataPoint = processStatToDataPoint(stat, since, exchangeRateByDate);
    if (!dataPoint) continue;

    dataPoints.push(dataPoint);
    totalImplied += dataPoint.impliedApyPercent;
    totalRealized += dataPoint.realizedApyPercent;
    count++;
  }

  // Reverse to get oldest first
  dataPoints.reverse();

  return { dataPoints, totalImplied, totalRealized, count };
}

/** Response type for GET /api/analytics/implied-vs-realized */
export interface ImpliedVsRealizedResponse {
  market: string;
  underlyingSymbol: string;
  dataPoints: ImpliedVsRealizedDataPoint[];
  summary: {
    avgImpliedApy: number;
    avgRealizedApy: number;
    avgSpread: number;
    currentImpliedApy: number;
    currentExchangeRate: string;
  };
}

/**
 * GET /api/analytics/implied-vs-realized
 *
 * Returns implied vs realized APY comparison for a market.
 *
 * Query params:
 * - market: string (required) - Market address
 * - days: number (default: 30) - Days of history
 *
 * The implied APY is from the market's ln_implied_rate.
 * The realized APY is calculated from the underlying's exchange rate changes.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult;

  const searchParams = request.nextUrl.searchParams;
  const marketAddress = searchParams.get('market');

  // Validate market address
  if (!marketAddress) return createEmptyResponse('', 400);

  const addressResult = starknetAddressSchema.safeParse(marketAddress);
  if (!addressResult.success) return createEmptyResponse(marketAddress, 400);

  // Validate query parameters
  const params = validateQuery(searchParams, dateRangeSchema);
  if (params instanceof NextResponse) return params;

  const { days } = params;

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
    if (!marketInfo) return createEmptyResponse(marketAddress, 404);

    const syAddress = marketInfo.sy ?? '';
    const underlyingSymbol = marketInfo.underlying_symbol ?? 'Unknown';

    // Fetch daily stats and exchange rate history in parallel
    const [dailyStatsData, exchangeRateData] = await Promise.all([
      db
        .select()
        .from(marketDailyStats)
        .where(eq(marketDailyStats.market, marketAddress))
        .orderBy(desc(marketDailyStats.day)),
      db
        .select()
        .from(oracleRateHistory)
        .where(eq(oracleRateHistory.sy, syAddress))
        .orderBy(desc(oracleRateHistory.block_timestamp)),
    ]);

    // Build exchange rate map and data points
    const exchangeRateByDate = buildExchangeRateMap(exchangeRateData);
    const { dataPoints, totalImplied, totalRealized, count } = buildDataPoints(
      dailyStatsData,
      since,
      exchangeRateByDate
    );

    // Calculate summary
    const avgImpliedApy = count > 0 ? totalImplied / count : 0;
    const avgRealizedApy = count > 0 ? totalRealized / count : 0;

    return NextResponse.json(
      {
        market: marketAddress,
        underlyingSymbol,
        dataPoints,
        summary: {
          avgImpliedApy,
          avgRealizedApy,
          avgSpread: avgImpliedApy - avgRealizedApy,
          currentImpliedApy: lnRateToApyPercent(BigInt(marketInfo.implied_rate ?? '0')),
          currentExchangeRate: marketInfo.exchange_rate ?? '0',
        },
      },
      { headers: getCacheHeaders('MEDIUM') }
    );
  } catch (error) {
    logError(error, { module: 'analytics/implied-vs-realized', market: marketAddress });
    return createEmptyResponse(marketAddress, 500);
  }
}
