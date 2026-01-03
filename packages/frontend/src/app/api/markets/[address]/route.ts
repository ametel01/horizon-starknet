import { db, marketCurrentState, marketDailyStats } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { desc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ----- Types -----

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

interface MarketCurrentStateRow {
  market: string | null;
  expiry: number | null;
  sy: string | null;
  pt: string | null;
  yt: string | null;
  underlying: string | null;
  underlying_symbol: string | null;
  ln_fee_rate_root: string | null;
  initial_exchange_rate: string | null;
  created_at: Date | null;
  sy_reserve: string | null;
  pt_reserve: string | null;
  implied_rate: string | null;
  exchange_rate: string | null;
  is_expired: boolean | null;
  last_activity: Date | null;
  sy_volume_24h: string | null;
  pt_volume_24h: string | null;
  fees_24h: string | null;
  swaps_24h: number | null;
}

interface DailyStatsRow {
  sy_volume: string | null;
  total_fees: string | null;
  swap_count: number | null;
  unique_traders: number | null;
}

interface Stats7d {
  volume: bigint;
  fees: bigint;
  swapCount: number;
  uniqueTraders: Set<number>;
}

// ----- Helper Functions -----

function buildMarketInfo(current: MarketCurrentStateRow): MarketDetailResponse['market'] {
  return {
    address: current.market ?? '',
    expiry: current.expiry ?? 0,
    sy: current.sy ?? '',
    pt: current.pt ?? '',
    yt: current.yt ?? '',
    underlying: current.underlying ?? '',
    underlyingSymbol: current.underlying_symbol ?? '',
    feeRate: current.ln_fee_rate_root ?? '0',
    initialExchangeRate: current.initial_exchange_rate ?? '0',
    createdAt: current.created_at?.toISOString() ?? '',
  };
}

function buildCurrentState(current: MarketCurrentStateRow): MarketDetailResponse['currentState'] {
  return {
    syReserve: current.sy_reserve ?? '0',
    ptReserve: current.pt_reserve ?? '0',
    impliedRate: current.implied_rate ?? '0',
    exchangeRate: current.exchange_rate ?? '0',
    isExpired: current.is_expired ?? false,
    lastActivity: current.last_activity?.toISOString() ?? null,
  };
}

function buildStats24h(current: MarketCurrentStateRow): MarketDetailResponse['stats24h'] {
  const syVolume = BigInt(current.sy_volume_24h ?? '0');
  const ptVolume = BigInt(current.pt_volume_24h ?? '0');
  return {
    volume: (syVolume + ptVolume).toString(),
    fees: current.fees_24h ?? '0',
    swapCount: current.swaps_24h ?? 0,
  };
}

function aggregateDailyStats(dailyStats: DailyStatsRow[]): Stats7d {
  let volume = 0n;
  let fees = 0n;
  let swapCount = 0;
  const uniqueTraders = new Set<number>();

  for (const day of dailyStats) {
    volume += BigInt(day.sy_volume ?? '0');
    fees += BigInt(day.total_fees ?? '0');
    swapCount += day.swap_count ?? 0;
    const traders = day.unique_traders;
    if (typeof traders === 'number') {
      uniqueTraders.add(traders);
    }
  }

  return { volume, fees, swapCount, uniqueTraders };
}

function buildStats7d(stats: Stats7d): MarketDetailResponse['stats7d'] {
  return {
    volume: stats.volume.toString(),
    fees: stats.fees.toString(),
    swapCount: stats.swapCount,
    uniqueTraders: stats.uniqueTraders.size,
  };
}

function buildResponse(current: MarketCurrentStateRow, stats7d: Stats7d): MarketDetailResponse {
  return {
    market: buildMarketInfo(current),
    currentState: buildCurrentState(current),
    stats24h: buildStats24h(current),
    stats7d: buildStats7d(stats7d),
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
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) {
    return rateLimitResult as NextResponse<MarketDetailResponse | { error: string }>;
  }

  const { address } = await params;

  try {
    const [current] = await db
      .select()
      .from(marketCurrentState)
      .where(eq(marketCurrentState.market, address))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    const dailyStats = await db
      .select()
      .from(marketDailyStats)
      .where(eq(marketDailyStats.market, address))
      .orderBy(desc(marketDailyStats.day))
      .limit(7);

    const stats7d = aggregateDailyStats(dailyStats);
    return NextResponse.json(buildResponse(current, stats7d));
  } catch (error) {
    logError(error, { module: 'markets/detail', marketAddress: address });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
