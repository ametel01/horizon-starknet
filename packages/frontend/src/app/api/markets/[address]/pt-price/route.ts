import { desc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCacheHeaders } from '@shared/server/cache';
import { db, marketDailyStats, marketCurrentState } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import {
  validateQuery,
  validateParam,
  starknetAddressSchema,
  dateRangeSchema,
} from '@shared/server/validations/api';

const WAD = BigInt(10) ** BigInt(18);
const SECONDS_PER_YEAR = 31_536_000;

/**
 * Calculate PT price in SY terms from ln-rate and time to expiry
 * PT price = e^(-ln_rate * time_to_expiry / SECONDS_PER_YEAR)
 */
function calculatePtPriceInSy(lnRateWad: bigint, timeToExpirySec: number): number {
  if (timeToExpirySec <= 0) return 1; // At or past expiry, PT = 1 SY
  const lnRate = Number(lnRateWad) / Number(WAD);
  const timeToExpiryYears = timeToExpirySec / SECONDS_PER_YEAR;
  return Math.exp(-lnRate * timeToExpiryYears);
}

/**
 * Convert ln-rate (WAD) to APY percentage
 */
function lnRateToApyPercent(lnRateWad: bigint): number {
  if (lnRateWad === 0n) return 0;
  const lnRate = Number(lnRateWad) / Number(WAD);
  return (Math.exp(lnRate) - 1) * 100;
}

interface PtPriceDataPoint {
  date: string;
  ptPriceInSy: number;
  impliedApyPercent: number;
  timeToExpiryDays: number;
  exchangeRate: string;
}

/** Response type for GET /api/markets/[address]/pt-price */
export interface PtPriceResponse {
  market: string;
  underlyingSymbol: string;
  expiry: number;
  isExpired: boolean;
  currentPtPrice: number;
  currentImpliedApy: number;
  daysToExpiry: number;
  dataPoints: PtPriceDataPoint[];
}

/**
 * GET /api/markets/[address]/pt-price
 *
 * Returns PT price history for a market, useful for visualizing
 * PT's convergence to par (1.0) as maturity approaches.
 *
 * Query params:
 * - days: number (default: 90) - Days of history
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ address: string }> }
): Promise<NextResponse> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult;

  const { address } = await props.params;

  // Validate address parameter
  const validatedAddress = validateParam(address, starknetAddressSchema, 'address');
  if (validatedAddress instanceof NextResponse) {
    return validatedAddress;
  }

  // Validate query parameters
  const params = validateQuery(request.nextUrl.searchParams, dateRangeSchema);
  if (params instanceof NextResponse) return params;

  const { days } = params;

  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    // Get market info including expiry
    const marketInfoResult = await db
      .select()
      .from(marketCurrentState)
      .where(eq(marketCurrentState.market, address))
      .limit(1);

    const marketInfo = marketInfoResult[0];
    if (!marketInfo) {
      return NextResponse.json(
        {
          market: address,
          underlyingSymbol: '',
          expiry: 0,
          isExpired: true,
          currentPtPrice: 1,
          currentImpliedApy: 0,
          daysToExpiry: 0,
          dataPoints: [],
        },
        { status: 404 }
      );
    }

    const expiry = marketInfo.expiry ?? 0;
    const underlyingSymbol = marketInfo.underlying_symbol ?? 'Unknown';
    const now = Math.floor(Date.now() / 1000);
    const isExpired = expiry <= now;
    const timeToExpirySec = Math.max(0, expiry - now);
    const daysToExpiry = timeToExpirySec / 86400;

    // Calculate current PT price
    const currentLnRate = BigInt(marketInfo.implied_rate ?? '0');
    const currentPtPrice = calculatePtPriceInSy(currentLnRate, timeToExpirySec);
    const currentImpliedApy = lnRateToApyPercent(currentLnRate);

    // Get daily stats for historical PT prices
    const dailyStatsData = await db
      .select()
      .from(marketDailyStats)
      .where(eq(marketDailyStats.market, address))
      .orderBy(desc(marketDailyStats.day));

    const dataPoints: PtPriceDataPoint[] = [];

    for (const stat of dailyStatsData) {
      const date = stat.day?.toISOString().split('T')[0] ?? '';
      if (!date || stat.day === null || stat.day < since) continue;

      // Calculate time to expiry at this date
      const statTimestamp = Math.floor(stat.day.getTime() / 1000);
      const timeToExpiryAtDate = Math.max(0, expiry - statTimestamp);
      const timeToExpiryDays = timeToExpiryAtDate / 86400;

      const lnRate = BigInt(stat.close_implied_rate ?? '0');
      const ptPriceInSy = calculatePtPriceInSy(lnRate, timeToExpiryAtDate);
      const impliedApyPercent = lnRateToApyPercent(lnRate);

      dataPoints.push({
        date,
        ptPriceInSy,
        impliedApyPercent,
        timeToExpiryDays,
        exchangeRate: stat.exchange_rate ?? '0',
      });
    }

    // Reverse to get oldest first
    dataPoints.reverse();

    return NextResponse.json(
      {
        market: address,
        underlyingSymbol,
        expiry,
        isExpired,
        currentPtPrice,
        currentImpliedApy,
        daysToExpiry,
        dataPoints,
      },
      { headers: getCacheHeaders('MEDIUM') }
    );
  } catch (error) {
    logError(error, { module: 'markets/pt-price', market: address });
    return NextResponse.json(
      {
        market: address,
        underlyingSymbol: '',
        expiry: 0,
        isExpired: true,
        currentPtPrice: 1,
        currentImpliedApy: 0,
        daysToExpiry: 0,
        dataPoints: [],
      },
      { status: 500 }
    );
  }
}
