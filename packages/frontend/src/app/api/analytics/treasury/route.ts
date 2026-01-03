import {
  db,
  marketReserveFeeTransferred,
  treasuryYieldSummary,
  ytTreasuryInterestRedeemed,
} from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { desc } from 'drizzle-orm';
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

interface TransferRow {
  _id: string;
  block_number: number;
  block_timestamp: Date;
  transaction_hash: string;
  market: string;
  treasury: string;
  caller: string;
  amount: string;
  expiry: number;
  timestamp: number;
}

function processTransferRow(
  row: TransferRow,
  thresholds: { oneDayAgo: Date; sevenDaysAgo: Date; thirtyDaysAgo: Date; historyStart: Date },
  totals: { allTime: bigint; day: bigint; week: bigint; month: bigint },
  marketSet: Set<string>,
  marketSummaryMap: Map<
    string,
    { treasury: string; total: bigint; count: number; lastTransfer: Date | null }
  >,
  dailyMap: Map<string, { total: bigint; count: number }>
): { allTime: bigint; day: bigint; week: bigint; month: bigint } {
  const amount = BigInt(row.amount);
  const ts = row.block_timestamp;

  const newTotals = { ...totals, allTime: totals.allTime + amount };
  marketSet.add(row.market);

  if (ts >= thresholds.oneDayAgo) newTotals.day = totals.day + amount;
  if (ts >= thresholds.sevenDaysAgo) newTotals.week = totals.week + amount;
  if (ts >= thresholds.thirtyDaysAgo) newTotals.month = totals.month + amount;

  const existing = marketSummaryMap.get(row.market);
  if (existing) {
    existing.total += amount;
    existing.count += 1;
    if (!existing.lastTransfer || ts > existing.lastTransfer) existing.lastTransfer = ts;
  } else {
    marketSummaryMap.set(row.market, {
      treasury: row.treasury,
      total: amount,
      count: 1,
      lastTransfer: ts,
    });
  }

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

  return newTotals;
}

async function fetchReserveFeeData(limit: number, days: number): Promise<ReserveFeeData> {
  const now = new Date();
  const thresholds = {
    oneDayAgo: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    sevenDaysAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    thirtyDaysAgo: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    historyStart: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
  };

  const allTransfers = await db
    .select()
    .from(marketReserveFeeTransferred)
    .orderBy(desc(marketReserveFeeTransferred.block_timestamp));

  const recentTransfers: ReserveFeeTransferEvent[] = allTransfers.slice(0, limit).map((row) => ({
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

  const marketSet = new Set<string>();
  const marketSummaryMap = new Map<
    string,
    { treasury: string; total: bigint; count: number; lastTransfer: Date | null }
  >();
  const dailyMap = new Map<string, { total: bigint; count: number }>();

  let totals = { allTime: BigInt(0), day: BigInt(0), week: BigInt(0), month: BigInt(0) };

  for (const row of allTransfers) {
    totals = processTransferRow(row, thresholds, totals, marketSet, marketSummaryMap, dailyMap);
  }

  const summaryByMarket: ReserveFeeSummary[] = Array.from(marketSummaryMap.entries())
    .map(([market, data]) => ({
      market,
      treasury: data.treasury,
      totalAmount: data.total.toString(),
      transferCount: data.count,
      lastTransfer: data.lastTransfer?.toISOString() ?? null,
    }))
    .sort((a, b) => Number(BigInt(b.totalAmount) - BigInt(a.totalAmount)));

  const history: ReserveFeeHistory[] = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      totalAmount: data.total.toString(),
      transferCount: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    total24h: totals.day,
    total7d: totals.week,
    total30d: totals.month,
    totalAllTime: totals.allTime,
    transferCount: allTransfers.length,
    marketCount: marketSet.size,
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
  const limit = Math.min(Number.parseInt(searchParams.get('limit') ?? '50', 10), 200);
  const days = Math.min(Number.parseInt(searchParams.get('days') ?? '30', 10), 365);

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
