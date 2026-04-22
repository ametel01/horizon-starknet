import { getCacheHeaders } from '@shared/server/cache';
import { db, protocolDailyStats, routerSwap, routerSwapYT } from '@shared/server/db';
import { logError, logWarn } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { analyticsVolumeQuerySchema, validateQuery } from '@shared/server/validations/api';
import { desc, gte } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ----- Types -----

interface VolumeDataPoint {
  date: string;
  syVolume: string;
  ptVolume: string;
  swapCount: number;
  uniqueSwappers: number;
}

/** Response type for GET /api/analytics/volume */
export interface VolumeResponse {
  total24h: {
    syVolume: string;
    ptVolume: string;
    swapCount: number;
    uniqueSwappers: number;
  };
  total7d: {
    syVolume: string;
    ptVolume: string;
    swapCount: number;
  };
  history: VolumeDataPoint[];
}

interface DateThresholds {
  since: Date;
  oneDayAgo: Date;
  sevenDaysAgo: Date;
}

interface PeriodTotals {
  syVolume24h: bigint;
  ptVolume24h: bigint;
  swapCount24h: number;
  uniqueSwappers24h: number;
  syVolume7d: bigint;
  ptVolume7d: bigint;
  swapCount7d: number;
}

interface DailyAggregate {
  syVol: bigint;
  ptVol: bigint;
  swaps: number;
  senders: Set<string>;
}

interface AggregationResult {
  totals: PeriodTotals;
  history: VolumeDataPoint[];
}

// ----- Helper Functions -----

function createDateThresholds(days: number): DateThresholds {
  const now = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);
  return {
    since,
    oneDayAgo: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    sevenDaysAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
  };
}

function createEmptyTotals(): PeriodTotals {
  return {
    syVolume24h: 0n,
    ptVolume24h: 0n,
    swapCount24h: 0,
    uniqueSwappers24h: 0,
    syVolume7d: 0n,
    ptVolume7d: 0n,
    swapCount7d: 0,
  };
}

function createEmptyResponse(): VolumeResponse {
  return {
    total24h: { syVolume: '0', ptVolume: '0', swapCount: 0, uniqueSwappers: 0 },
    total7d: { syVolume: '0', ptVolume: '0', swapCount: 0 },
    history: [],
  };
}

// ----- Materialized View Aggregation -----

interface DailyStat {
  day: Date | null;
  total_sy_volume: string | null;
  total_pt_volume: string | null;
  swap_count: number | null;
  unique_swappers: number | null;
}

function aggregateFromMaterializedView(
  dailyStats: DailyStat[],
  th: DateThresholds
): AggregationResult {
  const totals = createEmptyTotals();
  const history: VolumeDataPoint[] = [];

  for (const stat of dailyStats) {
    const statDate = stat.day ?? new Date(0);
    const syVol = BigInt(stat.total_sy_volume ?? '0');
    const ptVol = BigInt(stat.total_pt_volume ?? '0');
    const swapCount = stat.swap_count ?? 0;
    const uniqueSwappers = stat.unique_swappers ?? 0;

    history.push({
      date: statDate.toISOString().split('T')[0] ?? '',
      syVolume: stat.total_sy_volume ?? '0',
      ptVolume: stat.total_pt_volume ?? '0',
      swapCount,
      uniqueSwappers,
    });

    if (statDate >= th.oneDayAgo) {
      totals.syVolume24h += syVol;
      totals.ptVolume24h += ptVol;
      totals.swapCount24h += swapCount;
      totals.uniqueSwappers24h = Math.max(totals.uniqueSwappers24h, uniqueSwappers);
    }

    if (statDate >= th.sevenDaysAgo) {
      totals.syVolume7d += syVol;
      totals.ptVolume7d += ptVol;
      totals.swapCount7d += swapCount;
    }
  }

  history.reverse(); // Oldest first
  return { totals, history };
}

// ----- Fallback Swap Aggregation -----

function getOrCreateDailyEntry(
  dailyVolume: Map<string, DailyAggregate>,
  dateKey: string
): DailyAggregate {
  let entry = dailyVolume.get(dateKey);
  if (!entry) {
    entry = { syVol: 0n, ptVol: 0n, swaps: 0, senders: new Set() };
    dailyVolume.set(dateKey, entry);
  }
  return entry;
}

interface SwapRecord {
  block_timestamp: Date;
  sender: string;
  sy_in: string;
  sy_out: string;
}

interface PtSwapRecord extends SwapRecord {
  pt_in: string;
  pt_out: string;
}

function processPtSwap(
  swap: PtSwapRecord,
  totals: PeriodTotals,
  dailyVolume: Map<string, DailyAggregate>,
  uniqueSenders24h: Set<string>,
  uniqueSenders7d: Set<string>,
  th: DateThresholds
): void {
  const timestamp = swap.block_timestamp;
  const dateKey = timestamp.toISOString().split('T')[0] ?? '';
  const syVol = BigInt(swap.sy_in) + BigInt(swap.sy_out);
  const ptVol = BigInt(swap.pt_in) + BigInt(swap.pt_out);

  const dayEntry = getOrCreateDailyEntry(dailyVolume, dateKey);
  dayEntry.syVol += syVol;
  dayEntry.ptVol += ptVol;
  dayEntry.swaps++;
  dayEntry.senders.add(swap.sender);

  if (timestamp >= th.oneDayAgo) {
    totals.syVolume24h += syVol;
    totals.ptVolume24h += ptVol;
    totals.swapCount24h++;
    uniqueSenders24h.add(swap.sender);
  }

  if (timestamp >= th.sevenDaysAgo) {
    totals.syVolume7d += syVol;
    totals.ptVolume7d += ptVol;
    totals.swapCount7d++;
    uniqueSenders7d.add(swap.sender);
  }
}

function processYtSwap(
  swap: SwapRecord,
  totals: PeriodTotals,
  dailyVolume: Map<string, DailyAggregate>,
  uniqueSenders24h: Set<string>,
  uniqueSenders7d: Set<string>,
  th: DateThresholds
): void {
  const timestamp = swap.block_timestamp;
  const dateKey = timestamp.toISOString().split('T')[0] ?? '';
  const syVol = BigInt(swap.sy_in) + BigInt(swap.sy_out);

  const dayEntry = getOrCreateDailyEntry(dailyVolume, dateKey);
  dayEntry.syVol += syVol;
  dayEntry.swaps++;
  dayEntry.senders.add(swap.sender);

  if (timestamp >= th.oneDayAgo) {
    totals.syVolume24h += syVol;
    totals.swapCount24h++;
    uniqueSenders24h.add(swap.sender);
  }

  if (timestamp >= th.sevenDaysAgo) {
    totals.syVolume7d += syVol;
    totals.swapCount7d++;
    uniqueSenders7d.add(swap.sender);
  }
}

function dailyAggregateToHistory(dailyVolume: Map<string, DailyAggregate>): VolumeDataPoint[] {
  return Array.from(dailyVolume.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      date,
      syVolume: data.syVol.toString(),
      ptVolume: data.ptVol.toString(),
      swapCount: data.swaps,
      uniqueSwappers: data.senders.size,
    }));
}

async function aggregateFromSwapEvents(th: DateThresholds): Promise<AggregationResult> {
  logWarn('Using fallback query from router_swap', { module: 'analytics/volume' });

  const [ptSwaps, ytSwaps] = await Promise.all([
    db.select().from(routerSwap).where(gte(routerSwap.block_timestamp, th.since)),
    db.select().from(routerSwapYT).where(gte(routerSwapYT.block_timestamp, th.since)),
  ]);

  const totals = createEmptyTotals();
  const dailyVolume = new Map<string, DailyAggregate>();
  const uniqueSenders24h = new Set<string>();
  const uniqueSenders7d = new Set<string>();

  for (const swap of ptSwaps) {
    processPtSwap(swap, totals, dailyVolume, uniqueSenders24h, uniqueSenders7d, th);
  }

  for (const swap of ytSwaps) {
    processYtSwap(swap, totals, dailyVolume, uniqueSenders24h, uniqueSenders7d, th);
  }

  totals.uniqueSwappers24h = uniqueSenders24h.size;

  return { totals, history: dailyAggregateToHistory(dailyVolume) };
}

// ----- Response Builder -----

function buildResponse(result: AggregationResult): VolumeResponse {
  const { totals, history } = result;
  return {
    total24h: {
      syVolume: totals.syVolume24h.toString(),
      ptVolume: totals.ptVolume24h.toString(),
      swapCount: totals.swapCount24h,
      uniqueSwappers: totals.uniqueSwappers24h,
    },
    total7d: {
      syVolume: totals.syVolume7d.toString(),
      ptVolume: totals.ptVolume7d.toString(),
      swapCount: totals.swapCount7d,
    },
    history,
  };
}

/**
 * GET /api/analytics/volume
 * Get protocol-wide volume metrics
 *
 * Query params:
 * - days: number - how many days of history (default: 30, max: 365)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult;

  const params = validateQuery(request.nextUrl.searchParams, analyticsVolumeQuerySchema);
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

    const result = hasDataFromView
      ? aggregateFromMaterializedView(dailyStats, th)
      : await aggregateFromSwapEvents(th);

    return NextResponse.json(buildResponse(result), { headers: getCacheHeaders('MEDIUM') });
  } catch (error) {
    logError(error, { module: 'analytics/volume' });
    return NextResponse.json(createEmptyResponse(), { status: 500 });
  }
}
