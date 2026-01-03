import { getCacheHeaders } from '@shared/server/cache';
import {
  db,
  enrichedRouterSwap,
  enrichedRouterSwapYT,
  marketDailyStats,
  marketFeesCollected,
  protocolDailyStats,
} from '@shared/server/db';
import { logError, logWarn } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { analyticsFeesQuerySchema, validateQuery } from '@shared/server/validations/api';
import { desc, gte } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface FeesDataPoint {
  date: string;
  totalFees: string;
  swapCount: number;
}

interface MarketFeeBreakdown {
  market: string;
  underlyingSymbol: string;
  totalFees: string;
  swapCount: number;
  avgFeePerSwap: string;
}

/** Response type for GET /api/analytics/fees */
export interface FeesResponse {
  total24h: string;
  total7d: string;
  total30d: string;
  history: FeesDataPoint[];
  byMarket: MarketFeeBreakdown[];
  recentCollections: {
    market: string;
    collector: string;
    receiver: string;
    amount: string;
    timestamp: string;
    transactionHash: string;
  }[];
}

// ----- Internal Types -----

interface DateThresholds {
  since: Date;
  oneDayAgo: Date;
  sevenDaysAgo: Date;
  thirtyDaysAgo: Date;
}

interface PeriodTotals {
  total24h: bigint;
  total7d: bigint;
  total30d: bigint;
}

interface AggregatedFees {
  totals: PeriodTotals;
  history: FeesDataPoint[];
  marketFees: Map<string, { fees: bigint; swaps: number }>;
}

// ----- Pure Helper Functions -----

function createDateThresholds(days: number): DateThresholds {
  const now = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);

  return {
    since,
    oneDayAgo: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    sevenDaysAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    thirtyDaysAgo: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
  };
}

function addToTotals(totals: PeriodTotals, fee: bigint, timestamp: Date, th: DateThresholds): void {
  if (timestamp >= th.oneDayAgo) totals.total24h += fee;
  if (timestamp >= th.sevenDaysAgo) totals.total7d += fee;
  if (timestamp >= th.thirtyDaysAgo) totals.total30d += fee;
}

function addToMarketMap(
  marketFees: Map<string, { fees: bigint; swaps: number }>,
  market: string,
  fee: bigint
): void {
  if (!market) return;
  const entry = marketFees.get(market) ?? { fees: 0n, swaps: 0 };
  entry.fees += fee;
  entry.swaps++;
  marketFees.set(market, entry);
}

function addToDailyMap(
  dailyFees: Map<string, { fees: bigint; swaps: number }>,
  dateKey: string,
  fee: bigint
): void {
  const entry = dailyFees.get(dateKey) ?? { fees: 0n, swaps: 0 };
  entry.fees += fee;
  entry.swaps++;
  dailyFees.set(dateKey, entry);
}

function dailyMapToHistory(
  dailyFees: Map<string, { fees: bigint; swaps: number }>
): FeesDataPoint[] {
  return Array.from(dailyFees.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      date,
      totalFees: data.fees.toString(),
      swapCount: data.swaps,
    }));
}

function marketMapToBreakdown(
  marketFees: Map<string, { fees: bigint; swaps: number }>
): MarketFeeBreakdown[] {
  return Array.from(marketFees.entries())
    .map(([market, data]) => ({
      market,
      underlyingSymbol: '',
      totalFees: data.fees.toString(),
      swapCount: data.swaps,
      avgFeePerSwap: data.swaps > 0 ? (data.fees / BigInt(data.swaps)).toString() : '0',
    }))
    .sort((a, b) => {
      const feesA = BigInt(a.totalFees);
      const feesB = BigInt(b.totalFees);
      return feesB > feesA ? 1 : feesB < feesA ? -1 : 0;
    })
    .slice(0, 10);
}

function createEmptyResponse(): FeesResponse {
  return {
    total24h: '0',
    total7d: '0',
    total30d: '0',
    history: [],
    byMarket: [],
    recentCollections: [],
  };
}

// ----- Data Source Functions -----

interface ProtocolDailyStat {
  day: Date | null;
  total_fees: string | null;
  swap_count: number | null;
}

/** Aggregate fees from pre-computed materialized view (happy path) */
async function aggregateFromMaterializedView(
  dailyStats: ProtocolDailyStat[],
  th: DateThresholds
): Promise<AggregatedFees> {
  const totals: PeriodTotals = { total24h: 0n, total7d: 0n, total30d: 0n };
  const history: FeesDataPoint[] = [];

  for (const stat of dailyStats) {
    const statDate = stat.day ?? new Date(0);
    const fees = BigInt(stat.total_fees ?? '0');

    history.push({
      date: statDate.toISOString().split('T')[0] ?? '',
      totalFees: stat.total_fees ?? '0',
      swapCount: stat.swap_count ?? 0,
    });

    addToTotals(totals, fees, statDate, th);
  }

  history.reverse(); // Oldest first

  // Get fees by market (last 30 days)
  const marketStats = await db
    .select()
    .from(marketDailyStats)
    .where(gte(marketDailyStats.day, th.thirtyDaysAgo));

  const marketFees = new Map<string, { fees: bigint; swaps: number }>();
  for (const stat of marketStats) {
    const market = stat.market ?? '';
    if (!market) continue;

    const entry = marketFees.get(market) ?? { fees: 0n, swaps: 0 };
    entry.fees += BigInt(stat.total_fees ?? '0');
    entry.swaps += stat.swap_count ?? 0;
    marketFees.set(market, entry);
  }

  return { totals, history, marketFees };
}

interface SwapRecord {
  total_fee: string | null;
  market: string | null;
  block_timestamp: Date | null;
}

/** Process a single swap record into aggregates */
function processSwapRecord(
  swap: SwapRecord,
  totals: PeriodTotals,
  dailyFees: Map<string, { fees: bigint; swaps: number }>,
  marketFees: Map<string, { fees: bigint; swaps: number }>,
  th: DateThresholds
): void {
  const fee = BigInt(swap.total_fee ?? '0');
  const market = swap.market ?? '';
  const timestamp = swap.block_timestamp ?? new Date(0);
  const dateKey = timestamp.toISOString().split('T')[0] ?? '';

  addToDailyMap(dailyFees, dateKey, fee);
  addToTotals(totals, fee, timestamp, th);
  addToMarketMap(marketFees, market, fee);
}

/** Aggregate fees from raw swap events (fallback when materialized view is empty) */
async function aggregateFromSwapEvents(th: DateThresholds): Promise<AggregatedFees> {
  logWarn('Using fallback query from enriched_router_swap', { module: 'analytics/fees' });

  const [ptSwaps, ytSwaps] = await Promise.all([
    db.select().from(enrichedRouterSwap).where(gte(enrichedRouterSwap.block_timestamp, th.since)),
    db
      .select()
      .from(enrichedRouterSwapYT)
      .where(gte(enrichedRouterSwapYT.block_timestamp, th.since)),
  ]);

  const totals: PeriodTotals = { total24h: 0n, total7d: 0n, total30d: 0n };
  const dailyFees = new Map<string, { fees: bigint; swaps: number }>();
  const marketFees = new Map<string, { fees: bigint; swaps: number }>();

  for (const swap of ptSwaps) {
    processSwapRecord(swap, totals, dailyFees, marketFees, th);
  }

  for (const swap of ytSwaps) {
    processSwapRecord(swap, totals, dailyFees, marketFees, th);
  }

  return { totals, history: dailyMapToHistory(dailyFees), marketFees };
}

/** Fetch recent fee collection events */
async function fetchRecentCollections(): Promise<FeesResponse['recentCollections']> {
  const rows = await db
    .select()
    .from(marketFeesCollected)
    .orderBy(desc(marketFeesCollected.block_timestamp))
    .limit(10);

  return rows.map((row) => ({
    market: row.market,
    collector: row.collector,
    receiver: row.receiver,
    amount: row.amount,
    timestamp: row.block_timestamp.toISOString(),
    transactionHash: row.transaction_hash,
  }));
}

// ----- Route Handler -----

/**
 * GET /api/analytics/fees
 * Get protocol-wide fee metrics
 *
 * Query params:
 * - days: number - how many days of history (default: 30, max: 365)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult;

  const params = validateQuery(request.nextUrl.searchParams, analyticsFeesQuerySchema);
  if (params instanceof NextResponse) return params;

  const th = createDateThresholds(params.days);

  try {
    // Try materialized view first
    const dailyStats = await db
      .select()
      .from(protocolDailyStats)
      .where(gte(protocolDailyStats.day, th.since))
      .orderBy(desc(protocolDailyStats.day));

    const hasDataFromView =
      dailyStats.length > 0 && dailyStats.some((s) => (s.swap_count ?? 0) > 0);

    const { totals, history, marketFees } = hasDataFromView
      ? await aggregateFromMaterializedView(dailyStats, th)
      : await aggregateFromSwapEvents(th);

    const [byMarket, recentCollections] = await Promise.all([
      Promise.resolve(marketMapToBreakdown(marketFees)),
      fetchRecentCollections(),
    ]);

    return NextResponse.json(
      {
        total24h: totals.total24h.toString(),
        total7d: totals.total7d.toString(),
        total30d: totals.total30d.toString(),
        history,
        byMarket,
        recentCollections,
      },
      { headers: getCacheHeaders('MEDIUM') }
    );
  } catch (error) {
    logError(error, { module: 'analytics/fees' });
    return NextResponse.json(createEmptyResponse(), { status: 500 });
  }
}
