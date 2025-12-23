import { eq, desc, gte, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { db, marketDailyStats, rateHistory } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RateDataPoint {
  timestamp: string;
  impliedRate: string;
  exchangeRate: string;
  // OHLC for daily data
  open?: string;
  high?: string;
  low?: string;
  close?: string;
}

interface RatesResponse {
  market: string;
  resolution: 'tick' | 'daily';
  dataPoints: RateDataPoint[];
}

/**
 * GET /api/markets/[address]/rates
 * Get implied rate time series for a market
 *
 * Query params:
 * - resolution: 'tick' | 'daily' (default: 'daily')
 * - days: number - how many days of data (default: 30, max: 365)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<RatesResponse>> {
  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  const resolution = searchParams.get('resolution') === 'tick' ? 'tick' : 'daily';
  const days = Math.min(parseInt(searchParams.get('days') ?? '30'), 365);

  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    if (resolution === 'tick') {
      // Get raw rate updates
      const results = await db
        .select()
        .from(rateHistory)
        .where(and(eq(rateHistory.market, address), gte(rateHistory.block_timestamp, since)))
        .orderBy(desc(rateHistory.block_timestamp))
        .limit(1000); // Cap at 1000 ticks

      const dataPoints: RateDataPoint[] = results.map((row) => ({
        timestamp: row.block_timestamp?.toISOString() ?? '',
        impliedRate: row.implied_rate_after ?? '0',
        exchangeRate: row.exchange_rate ?? '0',
      }));

      return NextResponse.json({
        market: address,
        resolution: 'tick',
        dataPoints: dataPoints.reverse(), // Oldest first
      });
    } else {
      // Get daily OHLC
      const results = await db
        .select()
        .from(marketDailyStats)
        .where(and(eq(marketDailyStats.market, address), gte(marketDailyStats.day, since)))
        .orderBy(desc(marketDailyStats.day))
        .limit(days);

      const dataPoints: RateDataPoint[] = results.map((row) => ({
        timestamp: row.day?.toISOString() ?? '',
        impliedRate: row.implied_rate_close ?? '0',
        exchangeRate: row.exchange_rate_close ?? '0',
        open: row.implied_rate_open ?? '0',
        high: row.implied_rate_high ?? '0',
        low: row.implied_rate_low ?? '0',
        close: row.implied_rate_close ?? '0',
      }));

      return NextResponse.json({
        market: address,
        resolution: 'daily',
        dataPoints: dataPoints.reverse(), // Oldest first
      });
    }
  } catch (error) {
    console.error('[markets/[address]/rates] Error fetching rates:', error);
    return NextResponse.json({ market: address, resolution, dataPoints: [] }, { status: 500 });
  }
}
