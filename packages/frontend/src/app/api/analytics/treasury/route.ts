import {
  db,
  marketReserveFeeTransferred,
  treasuryYieldSummary,
  ytTreasuryInterestRedeemed,
} from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { desc, gte, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ============================================================================
// YT Interest Types
// ============================================================================

interface TreasuryClaimEvent {
  id: string;
  yt: string;
  treasury: string;
  sy: string;
  amountSy: string;
  expiryIndex: string;
  currentIndex: string;
  totalYtSupply: string;
  blockNumber: number;
  blockTimestamp: string;
  transactionHash: string;
}

interface YtTreasurySummary {
  yt: string;
  treasury: string;
  totalSyClaimed: string;
  claimCount: number;
  lastClaim: string | null;
}

interface YtInterestData {
  totalSyClaimed: bigint;
  totalClaimCount: number;
  ytCount: number;
  summaryByYt: YtTreasurySummary[];
  recentClaims: TreasuryClaimEvent[];
}

// ============================================================================
// Reserve Fee Types
// ============================================================================

interface ReserveFeeTransferEvent {
  id: string;
  market: string;
  treasury: string;
  caller: string;
  amount: string;
  expiry: number;
  timestamp: number;
  blockNumber: number;
  blockTimestamp: string;
  transactionHash: string;
}

interface ReserveFeeSummary {
  market: string;
  treasury: string;
  totalAmount: string;
  transferCount: number;
  lastTransfer: string | null;
}

interface ReserveFeeHistory {
  date: string;
  totalAmount: string;
  transferCount: number;
}

interface ReserveFeeData {
  total24h: bigint;
  total7d: bigint;
  total30d: bigint;
  totalAllTime: bigint;
  transferCount: number;
  marketCount: number;
  summaryByMarket: ReserveFeeSummary[];
  recentTransfers: ReserveFeeTransferEvent[];
  history: ReserveFeeHistory[];
}

// ============================================================================
// Combined Response Type
// ============================================================================

interface TreasuryAnalyticsResponse {
  ytInterest: {
    totalSyClaimed: string;
    totalClaimCount: number;
    ytCount: number;
    summaryByYt: YtTreasurySummary[];
    recentClaims: TreasuryClaimEvent[];
  };
  reserveFees: {
    total24h: string;
    total7d: string;
    total30d: string;
    totalAllTime: string;
    transferCount: number;
    marketCount: number;
    summaryByMarket: ReserveFeeSummary[];
    recentTransfers: ReserveFeeTransferEvent[];
    history: ReserveFeeHistory[];
  };
  combinedTotalSy: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function fetchYtInterestData(limit: number): Promise<YtInterestData> {
  const summaryRows = await db.select().from(treasuryYieldSummary);

  const summaryByYt: YtTreasurySummary[] = summaryRows.map((row) => ({
    yt: row.yt ?? '',
    treasury: row.treasury ?? '',
    totalSyClaimed: row.total_sy_claimed ?? '0',
    claimCount: row.claim_count ?? 0,
    lastClaim: row.last_claim?.toISOString() ?? null,
  }));

  let totalSyClaimed = BigInt(0);
  let totalClaimCount = 0;
  const ytSet = new Set<string>();

  for (const summary of summaryRows) {
    totalSyClaimed += BigInt(summary.total_sy_claimed ?? '0');
    totalClaimCount += summary.claim_count ?? 0;
    if (summary.yt) ytSet.add(summary.yt);
  }

  const claims = await db
    .select()
    .from(ytTreasuryInterestRedeemed)
    .orderBy(desc(ytTreasuryInterestRedeemed.block_timestamp))
    .limit(limit);

  const recentClaims: TreasuryClaimEvent[] = claims.map((row) => ({
    id: row._id,
    yt: row.yt,
    treasury: row.treasury,
    sy: row.sy,
    amountSy: row.amount_sy,
    expiryIndex: row.expiry_index,
    currentIndex: row.current_index,
    totalYtSupply: row.total_yt_supply,
    blockNumber: row.block_number,
    blockTimestamp: row.block_timestamp.toISOString(),
    transactionHash: row.transaction_hash,
  }));

  return {
    totalSyClaimed,
    totalClaimCount,
    ytCount: ytSet.size,
    summaryByYt,
    recentClaims,
  };
}

interface TimeThresholds {
  oneDayAgo: Date;
  sevenDaysAgo: Date;
  thirtyDaysAgo: Date;
  historyStart: Date;
}

interface TimeTotals {
  day: bigint;
  week: bigint;
  month: bigint;
  dailyMap: Map<string, { total: bigint; count: number }>;
}

function computeTimeTotals(
  rows: { amount: string; block_timestamp: Date }[],
  thresholds: TimeThresholds
): TimeTotals {
  const totals = { day: BigInt(0), week: BigInt(0), month: BigInt(0) };
  const dailyMap = new Map<string, { total: bigint; count: number }>();

  for (const row of rows) {
    const amount = BigInt(row.amount);
    const ts = row.block_timestamp;

    if (ts >= thresholds.oneDayAgo) totals.day += amount;
    if (ts >= thresholds.sevenDaysAgo) totals.week += amount;
    if (ts >= thresholds.thirtyDaysAgo) totals.month += amount;

    if (ts >= thresholds.historyStart) {
      const dateKey = ts.toISOString().split('T')[0] ?? '';
      const dayData = dailyMap.get(dateKey);
      if (dayData) {
        dayData.total += amount;
        dayData.count += 1;
      } else {
        dailyMap.set(dateKey, { total: amount, count: 1 });
      }
    }
  }

  return { ...totals, dailyMap };
}

async function fetchReserveFeeData(limit: number, days: number): Promise<ReserveFeeData> {
  const now = new Date();
  const thresholds = {
    oneDayAgo: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    sevenDaysAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    thirtyDaysAgo: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    historyStart: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
  };

  // Use the earliest threshold for data query (supports days > 30 for history)
  const dataQueryStart =
    thresholds.historyStart < thresholds.thirtyDaysAgo
      ? thresholds.historyStart
      : thresholds.thirtyDaysAgo;

  const [marketAggregates, recentTransfersRaw, recentData] = await Promise.all([
    // DB-side aggregation for per-market totals (all-time)
    db
      .select({
        market: marketReserveFeeTransferred.market,
        treasury: marketReserveFeeTransferred.treasury,
        totalAmount: sql<string>`SUM(${marketReserveFeeTransferred.amount})`,
        transferCount: sql<number>`COUNT(*)::int`,
        lastTransfer: sql<Date>`MAX(${marketReserveFeeTransferred.block_timestamp})`,
      })
      .from(marketReserveFeeTransferred)
      .groupBy(marketReserveFeeTransferred.market, marketReserveFeeTransferred.treasury),
    // Query for recent transfers (limited to N most recent)
    db
      .select()
      .from(marketReserveFeeTransferred)
      .orderBy(desc(marketReserveFeeTransferred.block_timestamp))
      .limit(limit),
    // Query for time-based data (covers both 30-day totals and history period)
    db
      .select()
      .from(marketReserveFeeTransferred)
      .where(gte(marketReserveFeeTransferred.block_timestamp, dataQueryStart))
      .orderBy(desc(marketReserveFeeTransferred.block_timestamp)),
  ]);

  // Format recent transfers
  const recentTransfers: ReserveFeeTransferEvent[] = recentTransfersRaw.map((row) => ({
    id: row._id,
    market: row.market,
    treasury: row.treasury,
    caller: row.caller,
    amount: row.amount,
    expiry: row.expiry,
    timestamp: row.timestamp,
    blockNumber: row.block_number,
    blockTimestamp: row.block_timestamp.toISOString(),
    transactionHash: row.transaction_hash,
  }));

  // Compute time-based totals from filtered data
  const { day, week, month, dailyMap } = computeTimeTotals(recentData, thresholds);

  // Format market summaries from DB aggregates
  const summaryByMarket: ReserveFeeSummary[] = marketAggregates
    .map((row) => ({
      market: row.market,
      treasury: row.treasury,
      totalAmount: row.totalAmount ?? '0',
      transferCount: row.transferCount ?? 0,
      lastTransfer: row.lastTransfer?.toISOString() ?? null,
    }))
    .sort((a, b) => {
      const diff = BigInt(b.totalAmount) - BigInt(a.totalAmount);
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });

  // Calculate all-time total from aggregates
  let totalAllTime = BigInt(0);
  for (const row of marketAggregates) {
    totalAllTime += BigInt(row.totalAmount ?? '0');
  }

  const history: ReserveFeeHistory[] = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      totalAmount: data.total.toString(),
      transferCount: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Count unique markets (not (market, treasury) pairs)
  const uniqueMarkets = new Set(marketAggregates.map((r) => r.market));

  return {
    total24h: day,
    total7d: week,
    total30d: month,
    totalAllTime,
    transferCount: marketAggregates.reduce((sum, r) => sum + (r.transferCount ?? 0), 0),
    marketCount: uniqueMarkets.size,
    summaryByMarket,
    recentTransfers,
    history,
  };
}

function getEmptyResponse(): TreasuryAnalyticsResponse {
  return {
    ytInterest: {
      totalSyClaimed: '0',
      totalClaimCount: 0,
      ytCount: 0,
      summaryByYt: [],
      recentClaims: [],
    },
    reserveFees: {
      total24h: '0',
      total7d: '0',
      total30d: '0',
      totalAllTime: '0',
      transferCount: 0,
      marketCount: 0,
      summaryByMarket: [],
      recentTransfers: [],
      history: [],
    },
    combinedTotalSy: '0',
  };
}

// ============================================================================
// GET Handler
// ============================================================================

/**
 * GET /api/analytics/treasury
 * Get aggregated treasury analytics combining YT interest and reserve fees
 *
 * Query params:
 * - limit: number - max recent items per category (default: 50)
 * - days: number - history period for reserve fees (default: 30)
 */
export async function GET(request: NextRequest): Promise<NextResponse<TreasuryAnalyticsResponse>> {
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult as NextResponse<TreasuryAnalyticsResponse>;

  const searchParams = request.nextUrl.searchParams;

  // Parse and validate limit: must be 1-200, defaults to 50
  const parsedLimit = Number.parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = Number.isNaN(parsedLimit) || parsedLimit < 1 ? 50 : Math.min(parsedLimit, 200);

  // Parse and validate days: must be 1-365, defaults to 30
  const parsedDays = Number.parseInt(searchParams.get('days') ?? '30', 10);
  const days = Number.isNaN(parsedDays) || parsedDays < 1 ? 30 : Math.min(parsedDays, 365);

  try {
    const [ytData, reserveData] = await Promise.all([
      fetchYtInterestData(limit),
      fetchReserveFeeData(limit, days),
    ]);

    const combinedTotal = ytData.totalSyClaimed + reserveData.totalAllTime;

    return NextResponse.json({
      ytInterest: {
        totalSyClaimed: ytData.totalSyClaimed.toString(),
        totalClaimCount: ytData.totalClaimCount,
        ytCount: ytData.ytCount,
        summaryByYt: ytData.summaryByYt,
        recentClaims: ytData.recentClaims,
      },
      reserveFees: {
        total24h: reserveData.total24h.toString(),
        total7d: reserveData.total7d.toString(),
        total30d: reserveData.total30d.toString(),
        totalAllTime: reserveData.totalAllTime.toString(),
        transferCount: reserveData.transferCount,
        marketCount: reserveData.marketCount,
        summaryByMarket: reserveData.summaryByMarket,
        recentTransfers: reserveData.recentTransfers,
        history: reserveData.history,
      },
      combinedTotalSy: combinedTotal.toString(),
    });
  } catch (error) {
    logError(error, { module: 'analytics/treasury' });
    return NextResponse.json(getEmptyResponse(), { status: 500 });
  }
}
