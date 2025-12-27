import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCacheHeaders } from '@shared/server/cache';
import { db, marketCurrentState } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';

const WAD = BigInt(10) ** BigInt(18);
const SECONDS_PER_YEAR = 31_536_000;

/**
 * Convert ln-rate (WAD) to APY percentage
 * APY = (e^ln_rate - 1) * 100
 */
function lnRateToApyPercent(lnRateWad: bigint): number {
  if (lnRateWad === 0n) return 0;
  const lnRate = Number(lnRateWad) / Number(WAD);
  return (Math.exp(lnRate) - 1) * 100;
}

/**
 * Calculate PT price in SY terms
 * PT price = e^(-ln_rate * time_to_expiry / SECONDS_PER_YEAR)
 */
function calculatePtPriceInSy(lnRateWad: bigint, timeToExpirySec: number): number {
  if (timeToExpirySec <= 0) return 1; // At or past expiry, PT = 1 SY
  const lnRate = Number(lnRateWad) / Number(WAD);
  const timeToExpiryYears = timeToExpirySec / SECONDS_PER_YEAR;
  return Math.exp(-lnRate * timeToExpiryYears);
}

interface YieldCurveMarket {
  address: string;
  underlyingSymbol: string;
  expiry: number;
  timeToExpiryYears: number;
  timeToExpiryDays: number;
  impliedApyPercent: number;
  ptPriceInSy: number;
  syReserve: string;
  ptReserve: string;
  tvlSy: string;
  isExpired: boolean;
}

interface YieldCurveResponse {
  markets: YieldCurveMarket[];
  timestamp: string;
}

/**
 * GET /api/analytics/yield-curve
 *
 * Returns yield curve data for all active markets.
 * Each market includes:
 * - Time to expiry (years and days)
 * - Implied APY (annualized)
 * - PT price in SY terms
 * - TVL in SY terms
 *
 * Use for plotting term structure: X = time to expiry, Y = implied APY
 */
export async function GET(request: NextRequest): Promise<NextResponse<YieldCurveResponse>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult as NextResponse<YieldCurveResponse>;

  try {
    const now = Math.floor(Date.now() / 1000);

    // Get all markets from materialized view
    const allMarkets = await db.select().from(marketCurrentState);

    const markets: YieldCurveMarket[] = [];

    for (const market of allMarkets) {
      const marketAddress = market.market ?? '';
      const expiry = market.expiry ?? 0;
      const lnImpliedRate = BigInt(market.implied_rate ?? '0');
      const syReserve = BigInt(market.sy_reserve ?? '0');
      const ptReserve = BigInt(market.pt_reserve ?? '0');

      if (!marketAddress) continue;

      const timeToExpirySec = Math.max(0, expiry - now);
      const timeToExpiryYears = timeToExpirySec / SECONDS_PER_YEAR;
      const timeToExpiryDays = timeToExpirySec / 86400;
      const isExpired = expiry <= now;

      const impliedApyPercent = lnRateToApyPercent(lnImpliedRate);
      const ptPriceInSy = calculatePtPriceInSy(lnImpliedRate, timeToExpirySec);

      // TVL in SY terms: SY reserve + PT reserve * PT price
      const ptReserveInSy = BigInt(Math.floor(Number(ptReserve) * ptPriceInSy));
      const tvlSy = syReserve + ptReserveInSy;

      markets.push({
        address: marketAddress,
        underlyingSymbol: market.underlying_symbol ?? 'Unknown',
        expiry,
        timeToExpiryYears,
        timeToExpiryDays,
        impliedApyPercent,
        ptPriceInSy,
        syReserve: syReserve.toString(),
        ptReserve: ptReserve.toString(),
        tvlSy: tvlSy.toString(),
        isExpired,
      });
    }

    // Sort by time to expiry (shortest first) for yield curve visualization
    markets.sort((a, b) => a.timeToExpiryYears - b.timeToExpiryYears);

    return NextResponse.json(
      {
        markets,
        timestamp: new Date().toISOString(),
      },
      { headers: getCacheHeaders('MEDIUM') }
    );
  } catch (error) {
    logError(error, { module: 'analytics/yield-curve' });
    return NextResponse.json(
      {
        markets: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
