import { eq, desc } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { db, marketCurrentState, marketDailyStats } from '@/lib/db';
import { logError } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface MarketDetailResponse {
  market: {
    address: string;
    expiry: number;
    sy: string;
    pt: string;
    yt: string;
    underlying: string;
    underlyingSymbol: string;
    feeRate: string;
    initialExchangeRate: string;
    createdAt: string;
  };
  currentState: {
    syReserve: string;
    ptReserve: string;
    impliedRate: string;
    exchangeRate: string;
    isExpired: boolean;
    lastActivity: string | null;
  };
  stats24h: {
    volume: string;
    fees: string;
    swapCount: number;
  };
  stats7d: {
    volume: string;
    fees: string;
    swapCount: number;
    uniqueTraders: number;
  };
}

/**
 * GET /api/markets/[address]
 * Get detailed market information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<MarketDetailResponse | { error: string }>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult)
    return rateLimitResult as NextResponse<MarketDetailResponse | { error: string }>;

  const { address } = await params;

  try {
    // Get current market state
    const [current] = await db
      .select()
      .from(marketCurrentState)
      .where(eq(marketCurrentState.market, address))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    // Get 7-day stats
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyStats = await db
      .select()
      .from(marketDailyStats)
      .where(eq(marketDailyStats.market, address))
      .orderBy(desc(marketDailyStats.day))
      .limit(7);

    // Aggregate 7-day stats
    let volume7d = BigInt(0);
    let fees7d = BigInt(0);
    let swapCount7d = 0;
    const uniqueTraders = new Set<number>();

    for (const day of dailyStats) {
      volume7d += BigInt(day.sy_volume ?? '0');
      fees7d += BigInt(day.total_fees ?? '0');
      swapCount7d += day.swap_count ?? 0;
      const traders = day.unique_traders;
      if (typeof traders === 'number') {
        uniqueTraders.add(traders);
      }
    }

    return NextResponse.json({
      market: {
        address: current.market ?? '',
        expiry: current.expiry ?? 0,
        sy: current.sy ?? '',
        pt: current.pt ?? '',
        yt: current.yt ?? '',
        underlying: current.underlying ?? '',
        underlyingSymbol: current.underlying_symbol ?? '',
        feeRate: current.fee_rate ?? '0',
        initialExchangeRate: current.initial_exchange_rate ?? '0',
        createdAt: current.created_at?.toISOString() ?? '',
      },
      currentState: {
        syReserve: current.sy_reserve ?? '0',
        ptReserve: current.pt_reserve ?? '0',
        impliedRate: current.implied_rate ?? '0',
        exchangeRate: current.exchange_rate ?? '0',
        isExpired: current.is_expired ?? false,
        lastActivity: current.last_activity?.toISOString() ?? null,
      },
      stats24h: {
        volume: (
          BigInt(current.sy_volume_24h ?? '0') + BigInt(current.pt_volume_24h ?? '0')
        ).toString(),
        fees: current.fees_24h ?? '0',
        swapCount: current.swaps_24h ?? 0,
      },
      stats7d: {
        volume: volume7d.toString(),
        fees: fees7d.toString(),
        swapCount: swapCount7d,
        uniqueTraders: uniqueTraders.size,
      },
    });
  } catch (error) {
    logError(error, { module: 'markets/detail', marketAddress: address });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
