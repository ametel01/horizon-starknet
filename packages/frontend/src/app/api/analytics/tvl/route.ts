import { getCacheHeaders } from '@shared/server/cache';
import { db, enrichedRouterSwap, marketCurrentState, marketSwap } from '@shared/server/db';
import { logError, logWarn } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { desc, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ----- Types -----

interface TvlDataPoint {
  date: string;
  totalSyReserve: string;
  totalPtReserve: string;
  marketCount: number;
}

interface TvlResponse {
  current: {
    totalSyReserve: string;
    totalPtReserve: string;
    marketCount: number;
  };
  history: TvlDataPoint[];
}

interface ReserveResult {
  totalSyReserve: bigint;
  totalPtReserve: bigint;
  source: 'view' | 'enriched_swap' | 'market_swap';
}

interface MarketState {
  sy_reserve: string | null;
  pt_reserve: string | null;
  is_expired: boolean | null;
}

// ----- Reserve Calculation Strategies -----

function sumReservesFromView(markets: MarketState[]): ReserveResult | null {
  let totalSyReserve = 0n;
  let totalPtReserve = 0n;
  let hasReserves = false;

  for (const market of markets) {
    const sy = BigInt(market.sy_reserve ?? '0');
    const pt = BigInt(market.pt_reserve ?? '0');
    if (sy > 0n || pt > 0n) hasReserves = true;
    totalSyReserve += sy;
    totalPtReserve += pt;
  }

  return hasReserves ? { totalSyReserve, totalPtReserve, source: 'view' } : null;
}

async function fetchReservesFromEnrichedSwaps(): Promise<ReserveResult | null> {
  const latestRouterSwaps = await db
    .select({
      market: enrichedRouterSwap.market,
      syReserve: enrichedRouterSwap.sy_reserve_after,
      ptReserve: enrichedRouterSwap.pt_reserve_after,
      blockNumber: enrichedRouterSwap.block_number,
    })
    .from(enrichedRouterSwap)
    .orderBy(desc(enrichedRouterSwap.block_number));

  const marketReserves = new Map<string, { sy: bigint; pt: bigint }>();

  for (const swap of latestRouterSwaps) {
    const market = swap.market ?? '';
    if (!market || marketReserves.has(market)) continue;

    const syRes = BigInt(swap.syReserve ?? '0');
    const ptRes = BigInt(swap.ptReserve ?? '0');
    if (syRes > 0n || ptRes > 0n) {
      marketReserves.set(market, { sy: syRes, pt: ptRes });
    }
  }

  if (marketReserves.size === 0) return null;

  let totalSyReserve = 0n;
  let totalPtReserve = 0n;
  for (const reserves of marketReserves.values()) {
    totalSyReserve += reserves.sy;
    totalPtReserve += reserves.pt;
  }

  logWarn('Used enriched_router_swap fallback', {
    module: 'analytics/tvl',
    marketCount: marketReserves.size,
  });

  return { totalSyReserve, totalPtReserve, source: 'enriched_swap' };
}

async function fetchReservesFromMarketSwaps(): Promise<ReserveResult> {
  const latestSwapsPerMarket = await db
    .select({
      market: marketSwap.market,
      syReserve: marketSwap.sy_reserve_after,
      ptReserve: marketSwap.pt_reserve_after,
    })
    .from(marketSwap)
    .where(
      sql`(${marketSwap.market}, ${marketSwap.block_number}) IN (
        SELECT market, MAX(block_number)
        FROM market_swap
        GROUP BY market
      )`
    );

  let totalSyReserve = 0n;
  let totalPtReserve = 0n;
  for (const swap of latestSwapsPerMarket) {
    totalSyReserve += BigInt(swap.syReserve);
    totalPtReserve += BigInt(swap.ptReserve);
  }

  logWarn('Used market_swap fallback', {
    module: 'analytics/tvl',
    marketCount: latestSwapsPerMarket.length,
  });

  return { totalSyReserve, totalPtReserve, source: 'market_swap' };
}

async function calculateTotalReserves(markets: MarketState[]): Promise<ReserveResult> {
  // Try strategies in order of preference
  const fromView = sumReservesFromView(markets);
  if (fromView) return fromView;

  const fromEnrichedSwaps = await fetchReservesFromEnrichedSwaps();
  if (fromEnrichedSwaps) return fromEnrichedSwaps;

  return fetchReservesFromMarketSwaps();
}

// ----- Response Helpers -----

function createEmptyResponse(): TvlResponse {
  return {
    current: { totalSyReserve: '0', totalPtReserve: '0', marketCount: 0 },
    history: [],
  };
}

function buildTvlResponse(
  reserves: ReserveResult,
  totalMarketCount: number,
  activeMarketCount: number
): TvlResponse {
  const today = new Date().toISOString().split('T')[0] ?? '';

  return {
    current: {
      totalSyReserve: reserves.totalSyReserve.toString(),
      totalPtReserve: reserves.totalPtReserve.toString(),
      marketCount: totalMarketCount,
    },
    history: [
      {
        date: today,
        totalSyReserve: reserves.totalSyReserve.toString(),
        totalPtReserve: reserves.totalPtReserve.toString(),
        marketCount: activeMarketCount,
      },
    ],
  };
}

/**
 * GET /api/analytics/tvl
 * Get protocol-wide TVL metrics
 *
 * Note: Historical TVL data requires a dedicated TVL snapshot table.
 * Currently only returns current TVL from market_current_state.
 */
export async function GET(request: NextRequest): Promise<NextResponse<TvlResponse>> {
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult as NextResponse<TvlResponse>;

  try {
    const allMarkets = await db.select().from(marketCurrentState);
    const activeMarkets = allMarkets.filter((m) => !m.is_expired);

    const reserves = await calculateTotalReserves(allMarkets);

    logWarn('TVL calculation complete', {
      module: 'analytics/tvl',
      source: reserves.source,
      totalMarkets: allMarkets.length,
      activeMarkets: activeMarkets.length,
      totalSyReserve: reserves.totalSyReserve.toString(),
      totalPtReserve: reserves.totalPtReserve.toString(),
    });

    const response = buildTvlResponse(reserves, allMarkets.length, activeMarkets.length);
    return NextResponse.json(response, { headers: getCacheHeaders('MEDIUM') });
  } catch (error) {
    logError(error, { module: 'analytics/tvl' });
    return NextResponse.json(createEmptyResponse(), { status: 500 });
  }
}
