import { getCacheHeaders } from '@shared/server/cache';
import {
  db,
  enrichedRouterAddLiquidity,
  enrichedRouterMintPY,
  enrichedRouterRedeemPY,
  enrichedRouterRemoveLiquidity,
  enrichedRouterSwap,
  enrichedRouterSwapYT,
  marketCurrentState,
  protocolDailyStats,
  routerSwap,
  routerSwapYT,
  syDeposit,
  syRedeem,
} from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { desc, gte } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Query timeout in milliseconds (10 seconds)
const QUERY_TIMEOUT_MS = 10_000;

/**
 * Wrap a promise with a timeout. Returns null if the query times out.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = QUERY_TIMEOUT_MS
): Promise<T | null> {
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

interface StatsResponse {
  tvl: {
    totalSyReserve: string;
    totalPtReserve: string;
    marketCount: number;
  };
  volume24h: {
    syVolume: string;
    ptVolume: string;
    swapCount: number;
    uniqueUsers: number;
  };
  fees24h: string;
}

// ----- Internal Types -----

interface TvlResult {
  totalSyReserve: bigint;
  totalPtReserve: bigint;
  marketCount: number;
}

interface VolumeFeesResult {
  syVolume: bigint;
  ptVolume: bigint;
  swapCount: number;
  fees: bigint;
}

interface MarketState {
  sy_reserve: string | null;
  pt_reserve: string | null;
}

interface DailyStat {
  total_sy_volume: string | null;
  total_pt_volume: string | null;
  swap_count: number | null;
  total_fees: string | null;
}

interface RouterSwapRecord {
  sender: string;
  sy_in: string;
  sy_out: string;
  pt_in: string;
  pt_out: string;
}

interface YtSwapRecord {
  sender: string;
  sy_in: string;
  sy_out: string;
}

// ----- Helper Functions -----

function sumBigInt(values: (string | null)[]): bigint {
  return values.reduce((acc, v) => acc + BigInt(v ?? '0'), 0n);
}

/** Fallback: get reserves from latest swaps per market */
async function fetchReservesFromSwaps(): Promise<{ sy: bigint; pt: bigint }> {
  const latestSwaps = await withTimeout(
    db
      .select({
        market: enrichedRouterSwap.market,
        syReserve: enrichedRouterSwap.sy_reserve_after,
        ptReserve: enrichedRouterSwap.pt_reserve_after,
        blockNumber: enrichedRouterSwap.block_number,
      })
      .from(enrichedRouterSwap)
      .orderBy(desc(enrichedRouterSwap.block_number))
      .limit(100)
  );

  if (!latestSwaps) return { sy: 0n, pt: 0n };

  // Keep only first (latest) swap per market
  const marketReserves = new Map<string, { sy: bigint; pt: bigint }>();
  for (const swap of latestSwaps) {
    const market = swap.market ?? '';
    if (!market || marketReserves.has(market)) continue;
    marketReserves.set(market, {
      sy: BigInt(swap.syReserve ?? '0'),
      pt: BigInt(swap.ptReserve ?? '0'),
    });
  }

  let sy = 0n;
  let pt = 0n;
  for (const reserves of marketReserves.values()) {
    sy += reserves.sy;
    pt += reserves.pt;
  }
  return { sy, pt };
}

/** Calculate TVL from market states, with fallback to enriched swaps */
async function calculateTvl(markets: MarketState[] | null): Promise<TvlResult> {
  const marketsData = markets ?? [];
  let totalSyReserve = sumBigInt(marketsData.map((m) => m.sy_reserve));
  let totalPtReserve = sumBigInt(marketsData.map((m) => m.pt_reserve));

  if (totalSyReserve === 0n && totalPtReserve === 0n) {
    const fallback = await fetchReservesFromSwaps();
    totalSyReserve = fallback.sy;
    totalPtReserve = fallback.pt;
  }

  return { totalSyReserve, totalPtReserve, marketCount: marketsData.length };
}

/** Calculate volume/fees from materialized view */
function aggregateFromDailyStats(stats: DailyStat[]): VolumeFeesResult {
  let syVolume = 0n;
  let ptVolume = 0n;
  let swapCount = 0;
  let fees = 0n;

  for (const stat of stats) {
    syVolume += BigInt(stat.total_sy_volume ?? '0');
    ptVolume += BigInt(stat.total_pt_volume ?? '0');
    swapCount += stat.swap_count ?? 0;
    fees += BigInt(stat.total_fees ?? '0');
  }

  return { syVolume, ptVolume, swapCount, fees };
}

/** Calculate volume from raw swap events */
function aggregateSwapVolume(
  ptSwaps: RouterSwapRecord[],
  ytSwaps: YtSwapRecord[]
): Omit<VolumeFeesResult, 'fees'> {
  let syVolume = 0n;
  let ptVolume = 0n;
  let swapCount = 0;

  for (const swap of ptSwaps) {
    syVolume += BigInt(swap.sy_in) + BigInt(swap.sy_out);
    ptVolume += BigInt(swap.pt_in) + BigInt(swap.pt_out);
    swapCount++;
  }

  for (const swap of ytSwaps) {
    syVolume += BigInt(swap.sy_in) + BigInt(swap.sy_out);
    swapCount++;
  }

  return { syVolume, ptVolume, swapCount };
}

/** Fetch fees from enriched swap views */
async function fetchFeesFromEnrichedSwaps(oneDayAgo: Date): Promise<bigint> {
  const [enrichedSwaps, enrichedYtSwaps] = await Promise.all([
    db
      .select({ fee: enrichedRouterSwap.fee })
      .from(enrichedRouterSwap)
      .where(gte(enrichedRouterSwap.block_timestamp, oneDayAgo)),
    db
      .select({ fee: enrichedRouterSwapYT.fee })
      .from(enrichedRouterSwapYT)
      .where(gte(enrichedRouterSwapYT.block_timestamp, oneDayAgo)),
  ]);

  return sumBigInt([...enrichedSwaps.map((s) => s.fee), ...enrichedYtSwaps.map((s) => s.fee)]);
}

/** Collect unique users from all operation types */
function collectUniqueUsers(
  ptSwaps: { sender: string }[],
  ytSwaps: { sender: string }[],
  mints: { sender: string | null }[] | null,
  redeems: { sender: string | null }[] | null,
  addLiq: { sender: string | null }[] | null,
  removeLiq: { sender: string | null }[] | null,
  deposits: { caller: string }[] | null,
  withdrawals: { caller: string }[] | null
): Set<string> {
  const users = new Set<string>();

  const addSenders = (records: { sender: string }[]) => {
    for (const r of records) users.add(r.sender.toLowerCase());
  };

  const addOptionalSenders = (records: { sender: string | null }[] | null) => {
    for (const r of records ?? []) {
      if (r.sender) users.add(r.sender.toLowerCase());
    }
  };

  const addCallers = (records: { caller: string }[] | null) => {
    for (const r of records ?? []) users.add(r.caller.toLowerCase());
  };

  addSenders(ptSwaps);
  addSenders(ytSwaps);
  addOptionalSenders(mints);
  addOptionalSenders(redeems);
  addOptionalSenders(addLiq);
  addOptionalSenders(removeLiq);
  addCallers(deposits);
  addCallers(withdrawals);

  return users;
}

function createEmptyResponse(): StatsResponse {
  return {
    tvl: { totalSyReserve: '0', totalPtReserve: '0', marketCount: 0 },
    volume24h: { syVolume: '0', ptVolume: '0', swapCount: 0, uniqueUsers: 0 },
    fees24h: '0',
  };
}

// ----- Query Builders -----

function createParallelQueries(oneDayAgo: Date) {
  return Promise.all([
    withTimeout(db.select().from(marketCurrentState)),
    withTimeout(
      db
        .select()
        .from(protocolDailyStats)
        .where(gte(protocolDailyStats.day, oneDayAgo))
        .orderBy(desc(protocolDailyStats.day))
        .limit(2)
    ),
    withTimeout(db.select().from(routerSwap).where(gte(routerSwap.block_timestamp, oneDayAgo))),
    withTimeout(db.select().from(routerSwapYT).where(gte(routerSwapYT.block_timestamp, oneDayAgo))),
    withTimeout(
      db
        .select({ sender: enrichedRouterMintPY.sender })
        .from(enrichedRouterMintPY)
        .where(gte(enrichedRouterMintPY.block_timestamp, oneDayAgo))
    ),
    withTimeout(
      db
        .select({ sender: enrichedRouterRedeemPY.sender })
        .from(enrichedRouterRedeemPY)
        .where(gte(enrichedRouterRedeemPY.block_timestamp, oneDayAgo))
    ),
    withTimeout(
      db
        .select({ sender: enrichedRouterAddLiquidity.sender })
        .from(enrichedRouterAddLiquidity)
        .where(gte(enrichedRouterAddLiquidity.block_timestamp, oneDayAgo))
    ),
    withTimeout(
      db
        .select({ sender: enrichedRouterRemoveLiquidity.sender })
        .from(enrichedRouterRemoveLiquidity)
        .where(gte(enrichedRouterRemoveLiquidity.block_timestamp, oneDayAgo))
    ),
    withTimeout(
      db
        .select({ caller: syDeposit.caller })
        .from(syDeposit)
        .where(gte(syDeposit.block_timestamp, oneDayAgo))
    ),
    withTimeout(
      db
        .select({ caller: syRedeem.caller })
        .from(syRedeem)
        .where(gte(syRedeem.block_timestamp, oneDayAgo))
    ),
  ]);
}

// ----- Route Handler -----

/**
 * GET /api/analytics/stats
 * Get combined protocol stats in a single optimized call
 */
export async function GET(request: NextRequest): Promise<NextResponse<StatsResponse>> {
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult as NextResponse<StatsResponse>;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const [
      allMarkets,
      dailyStats,
      ptSwaps,
      ytSwaps,
      mints,
      redeems,
      addLiq,
      removeLiq,
      deposits,
      withdrawals,
    ] = await createParallelQueries(oneDayAgo);

    // Calculate TVL (with fallback if market states empty)
    const tvl = await calculateTvl(allMarkets);

    // Calculate volume/fees from best available source
    const dailyStatsData = dailyStats ?? [];
    const ptSwapsData = ptSwaps ?? [];
    const ytSwapsData = ytSwaps ?? [];
    const hasViewData =
      dailyStatsData.length > 0 && dailyStatsData.some((s) => (s.swap_count ?? 0) > 0);

    let volumeFees: VolumeFeesResult;
    if (hasViewData) {
      volumeFees = aggregateFromDailyStats(dailyStatsData);
    } else {
      const volume = aggregateSwapVolume(ptSwapsData, ytSwapsData);
      const fees = await fetchFeesFromEnrichedSwaps(oneDayAgo);
      volumeFees = { ...volume, fees };
    }

    // Collect unique users across all operations
    const uniqueUsers = collectUniqueUsers(
      ptSwapsData,
      ytSwapsData,
      mints,
      redeems,
      addLiq,
      removeLiq,
      deposits,
      withdrawals
    );

    return NextResponse.json(
      {
        tvl: {
          totalSyReserve: tvl.totalSyReserve.toString(),
          totalPtReserve: tvl.totalPtReserve.toString(),
          marketCount: tvl.marketCount,
        },
        volume24h: {
          syVolume: volumeFees.syVolume.toString(),
          ptVolume: volumeFees.ptVolume.toString(),
          swapCount: volumeFees.swapCount,
          uniqueUsers: uniqueUsers.size,
        },
        fees24h: volumeFees.fees.toString(),
      },
      { headers: getCacheHeaders('MEDIUM') }
    );
  } catch (error) {
    logError(error, { module: 'analytics/stats' });
    return NextResponse.json(createEmptyResponse(), { status: 500 });
  }
}
