import {
  db,
  enrichedRouterMintPY,
  enrichedRouterRedeemPY,
  marketCurrentState,
  userPyPositions,
  ytInterestClaimed,
} from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import type { SQL } from 'drizzle-orm';
import { and, desc, gte, or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ----- Constants -----

const WAD = 10n ** 18n;

// ----- Address Helpers -----

function normalizeAddressForDb(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  const padded = hex.padStart(64, '0');
  return `0x${padded}`;
}

interface AddressParams {
  normalizedAddress: string;
  lowerAddress: string;
}

function buildAddressCondition(column: { name: string }, params: AddressParams): SQL | undefined {
  return or(
    sql`LOWER(${column}) = ${params.normalizedAddress}`,
    sql`LOWER(${column}) = ${params.lowerAddress}`
  );
}

// ----- Math Helpers -----

function calculatePtPriceFromRate(impliedRate: bigint, timeToExpiryYears: number): number {
  const lnRate = Number(impliedRate) / Number(WAD);
  return Math.exp(-lnRate * timeToExpiryYears);
}

export interface MintRedeemEvent {
  type: 'mint' | 'redeem';
  timestamp: string;
  yt: string;
  sy: string;
  pt: string;
  syAmount: string;
  ptAmount: string;
  ytAmount: string;
  pyIndex: string;
  exchangeRate: string;
  transactionHash: string;
}

export interface YieldClaimEvent {
  timestamp: string;
  yt: string;
  sy: string;
  amountSy: string;
  ytBalance: string;
  pyIndexAtClaim: string;
  transactionHash: string;
}

export interface PositionPnlSummary {
  yt: string;
  pt: string;
  sy: string;
  underlyingSymbol: string;
  expiry: number;
  isExpired: boolean;
  // Current holdings
  currentPtBalance: string;
  currentYtBalance: string;
  // Entry metrics
  totalPtMinted: string;
  totalPtRedeemed: string;
  avgEntryPyIndex: string;
  firstMintDate: string | null;
  // Current market state
  currentImpliedRate: string | null;
  currentPtPrice: number | null;
  entryPtPrice: number | null;
  // P&L
  unrealizedPnlSy: string;
  unrealizedPnlPercent: number;
  // Yield earned
  totalYieldClaimed: string;
  yieldClaimCount: number;
}

export interface TimelineDataPoint {
  date: string;
  cumulativeYieldSy: string;
  ptBalance: string;
  ytBalance: string;
  eventType: 'mint' | 'redeem' | 'claim' | null;
}

export interface PnlTimelineResponse {
  address: string;
  positions: PositionPnlSummary[];
  mintRedeemHistory: MintRedeemEvent[];
  yieldClaimHistory: YieldClaimEvent[];
  timeline: TimelineDataPoint[];
  summary: {
    totalPositions: number;
    totalUnrealizedPnlSy: string;
    totalYieldClaimedSy: string;
    overallPnlPercent: number;
  };
}

// ----- Internal Types -----

interface MintRow {
  block_timestamp: Date | null;
  yt: string | null;
  sy: string | null;
  pt: string | null;
  sy_in: string | null;
  pt_out: string | null;
  yt_out: string | null;
  py_index: string | null;
  exchange_rate: string | null;
  transaction_hash: string | null;
}

interface RedeemRow {
  block_timestamp: Date | null;
  yt: string | null;
  sy: string | null;
  pt: string | null;
  sy_out: string | null;
  py_in: string | null;
  py_index: string | null;
  exchange_rate: string | null;
  transaction_hash: string | null;
}

interface ClaimRow {
  block_timestamp: Date;
  yt: string;
  sy: string;
  amount_sy: string;
  yt_balance: string;
  py_index_at_claim: string;
  transaction_hash: string;
}

interface PositionRow {
  yt: string | null;
  pt: string | null;
  sy: string | null;
  pt_balance: string | null;
  yt_balance: string | null;
  first_mint: Date | null;
  total_interest_claimed: string | null;
  claim_count: number | null;
}

interface MarketState {
  yt: string | null;
  expiry: number | null;
  implied_rate: string | null;
  underlying_symbol: string | null;
}

interface EntryMetrics {
  totalPtMinted: bigint;
  avgEntryPyIndex: bigint;
  entryPtPrice: number | null;
}

interface PnlMetrics {
  unrealizedPnlSy: bigint;
  unrealizedPnlPercent: number;
}

interface PnlAccumulator {
  totalUnrealizedPnl: bigint;
  totalYieldClaimed: bigint;
  totalEntryValue: bigint;
}

interface TimelineEvent {
  date: string;
  type: 'mint' | 'redeem' | 'claim';
  yt: string;
  amount: string;
  yieldAmount: string;
}

// ----- Mappers -----

function mapMint(row: MintRow): MintRedeemEvent {
  return {
    type: 'mint',
    timestamp: row.block_timestamp?.toISOString() ?? '',
    yt: row.yt ?? '',
    sy: row.sy ?? '',
    pt: row.pt ?? '',
    syAmount: row.sy_in ?? '0',
    ptAmount: row.pt_out ?? '0',
    ytAmount: row.yt_out ?? '0',
    pyIndex: row.py_index ?? '0',
    exchangeRate: row.exchange_rate ?? '0',
    transactionHash: row.transaction_hash ?? '',
  };
}

function mapRedeem(row: RedeemRow): MintRedeemEvent {
  return {
    type: 'redeem',
    timestamp: row.block_timestamp?.toISOString() ?? '',
    yt: row.yt ?? '',
    sy: row.sy ?? '',
    pt: row.pt ?? '',
    syAmount: row.sy_out ?? '0',
    ptAmount: row.py_in ?? '0',
    ytAmount: row.py_in ?? '0',
    pyIndex: row.py_index ?? '0',
    exchangeRate: row.exchange_rate ?? '0',
    transactionHash: row.transaction_hash ?? '',
  };
}

function mapClaim(row: ClaimRow): YieldClaimEvent {
  return {
    timestamp: row.block_timestamp.toISOString(),
    yt: row.yt,
    sy: row.sy,
    amountSy: row.amount_sy,
    ytBalance: row.yt_balance,
    pyIndexAtClaim: row.py_index_at_claim,
    transactionHash: row.transaction_hash,
  };
}

// ----- Position Analysis Helpers -----

function calculateEntryMetrics(positionMints: MintRow[]): EntryMetrics {
  let totalPtMinted = 0n;
  let weightedPyIndex = 0n;

  for (const mint of positionMints) {
    const ptOut = BigInt(mint.pt_out ?? '0');
    const pyIndex = BigInt(mint.py_index ?? '0');
    totalPtMinted += ptOut;
    weightedPyIndex += ptOut * pyIndex;
  }

  const avgEntryPyIndex = totalPtMinted > 0n ? weightedPyIndex / totalPtMinted : 0n;
  const entryPtPrice = totalPtMinted > 0n ? Number(avgEntryPyIndex) / Number(WAD) : null;

  return { totalPtMinted, avgEntryPyIndex, entryPtPrice };
}

function calculateCurrentPtPrice(
  marketState: MarketState | undefined,
  isExpired: boolean,
  timeToExpiry: number
): number | null {
  if (!marketState?.implied_rate) return null;
  const impliedRate = BigInt(marketState.implied_rate);
  return isExpired ? 1.0 : calculatePtPriceFromRate(impliedRate, timeToExpiry);
}

function calculatePnl(
  currentPtPrice: number | null,
  entryPtPrice: number | null,
  ptBalance: bigint
): PnlMetrics {
  if (currentPtPrice === null || entryPtPrice === null || ptBalance === 0n) {
    return { unrealizedPnlSy: 0n, unrealizedPnlPercent: 0 };
  }

  const currentValue = (BigInt(Math.floor(currentPtPrice * Number(WAD))) * ptBalance) / WAD;
  const entryValue = (BigInt(Math.floor(entryPtPrice * Number(WAD))) * ptBalance) / WAD;
  const unrealizedPnlSy = currentValue - entryValue;
  const unrealizedPnlPercent =
    entryValue > 0n ? (Number(unrealizedPnlSy) / Number(entryValue)) * 100 : 0;

  return { unrealizedPnlSy, unrealizedPnlPercent };
}

function calculateTotalRedeemed(positionRedeems: RedeemRow[]): bigint {
  return positionRedeems.reduce((sum, r) => sum + BigInt(r.py_in ?? '0'), 0n);
}

interface MarketTiming {
  expiry: number;
  isExpired: boolean;
  timeToExpiry: number;
}

function getMarketTiming(marketState: MarketState | undefined, now: number): MarketTiming {
  const expiry = marketState?.expiry ?? 0;
  const isExpired = expiry > 0 && now >= expiry;
  const timeToExpiry = isExpired ? 0 : (expiry - now) / (365 * 24 * 60 * 60);
  return { expiry, isExpired, timeToExpiry };
}

function calculateEntryValue(entryPtPrice: number | null, ptBalance: bigint): bigint {
  if (entryPtPrice === null || ptBalance === 0n) return 0n;
  return (BigInt(Math.floor(entryPtPrice * Number(WAD))) * ptBalance) / WAD;
}

function filterByYt<T extends { yt: string | null }>(items: T[], ytAddress: string): T[] {
  return items.filter((item) => item.yt?.toLowerCase() === ytAddress);
}

interface PositionAnalysisContext {
  pos: PositionRow;
  positionMints: MintRow[];
  positionRedeems: RedeemRow[];
  marketState: MarketState | undefined;
  timing: MarketTiming;
}

function buildPositionSummary(
  ctx: PositionAnalysisContext,
  ptBalance: bigint,
  ytBalance: bigint,
  entry: EntryMetrics,
  currentPtPrice: number | null,
  pnl: PnlMetrics
): PositionPnlSummary {
  const { pos, positionRedeems, marketState, timing } = ctx;
  const totalPtRedeemed = calculateTotalRedeemed(positionRedeems);
  const posYieldClaimed = BigInt(pos.total_interest_claimed ?? '0');

  return {
    yt: pos.yt ?? '',
    pt: pos.pt ?? '',
    sy: pos.sy ?? '',
    underlyingSymbol: marketState?.underlying_symbol ?? 'Unknown',
    expiry: timing.expiry,
    isExpired: timing.isExpired,
    currentPtBalance: ptBalance.toString(),
    currentYtBalance: ytBalance.toString(),
    totalPtMinted: entry.totalPtMinted.toString(),
    totalPtRedeemed: totalPtRedeemed.toString(),
    avgEntryPyIndex: entry.avgEntryPyIndex.toString(),
    firstMintDate: pos.first_mint?.toISOString() ?? null,
    currentImpliedRate: marketState?.implied_rate ?? null,
    currentPtPrice,
    entryPtPrice: entry.entryPtPrice,
    unrealizedPnlSy: pnl.unrealizedPnlSy.toString(),
    unrealizedPnlPercent: pnl.unrealizedPnlPercent,
    totalYieldClaimed: posYieldClaimed.toString(),
    yieldClaimCount: pos.claim_count ?? 0,
  };
}

function analyzePosition(ctx: PositionAnalysisContext): {
  summary: PositionPnlSummary;
  pnl: PnlMetrics;
  entryValue: bigint;
} | null {
  const { pos, positionMints, marketState, timing } = ctx;

  const ptBalance = BigInt(pos.pt_balance ?? '0');
  const ytBalance = BigInt(pos.yt_balance ?? '0');
  if (ptBalance === 0n && ytBalance === 0n) return null;

  const entry = calculateEntryMetrics(positionMints);
  const currentPtPrice = calculateCurrentPtPrice(
    marketState,
    timing.isExpired,
    timing.timeToExpiry
  );
  const pnl = calculatePnl(currentPtPrice, entry.entryPtPrice, ptBalance);
  const entryValue = calculateEntryValue(entry.entryPtPrice, ptBalance);
  const summary = buildPositionSummary(ctx, ptBalance, ytBalance, entry, currentPtPrice, pnl);

  return { summary, pnl, entryValue };
}

// ----- Timeline Helpers -----

function buildTimelineEvents(
  mintRedeemHistory: MintRedeemEvent[],
  yieldClaimHistory: YieldClaimEvent[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [
    ...mintRedeemHistory.map((e) => ({
      date: e.timestamp,
      type: e.type,
      yt: e.yt,
      amount: e.type === 'mint' ? e.ptAmount : `-${e.ptAmount}`,
      yieldAmount: '0',
    })),
    ...yieldClaimHistory.map((e) => ({
      date: e.timestamp,
      type: 'claim' as const,
      yt: e.yt,
      amount: '0',
      yieldAmount: e.amountSy,
    })),
  ];

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function accumulateTimeline(events: TimelineEvent[]): TimelineDataPoint[] {
  let cumulativeYield = 0n;
  const balancesByYt = new Map<string, { pt: bigint; yt: bigint }>();

  return events.map((event) => {
    if (event.type === 'claim') {
      cumulativeYield += BigInt(event.yieldAmount);
    } else {
      const ytKey = event.yt.toLowerCase();
      const current = balancesByYt.get(ytKey) ?? { pt: 0n, yt: 0n };
      const delta = BigInt(event.amount);
      current.pt += delta;
      current.yt += delta;
      balancesByYt.set(ytKey, current);
    }

    let totalPt = 0n;
    let totalYt = 0n;
    for (const bal of balancesByYt.values()) {
      totalPt += bal.pt;
      totalYt += bal.yt;
    }

    return {
      date: event.date,
      cumulativeYieldSy: cumulativeYield.toString(),
      ptBalance: totalPt.toString(),
      ytBalance: totalYt.toString(),
      eventType: event.type,
    };
  });
}

// ----- Query Builder -----

function createPnlTimelineQueries(params: AddressParams, cutoffDate: Date) {
  return Promise.all([
    db
      .select()
      .from(enrichedRouterMintPY)
      .where(
        and(
          buildAddressCondition(enrichedRouterMintPY.receiver, params),
          gte(enrichedRouterMintPY.block_timestamp, cutoffDate)
        )
      )
      .orderBy(desc(enrichedRouterMintPY.block_timestamp))
      .limit(500),
    db
      .select()
      .from(enrichedRouterRedeemPY)
      .where(
        and(
          buildAddressCondition(enrichedRouterRedeemPY.sender, params),
          gte(enrichedRouterRedeemPY.block_timestamp, cutoffDate)
        )
      )
      .orderBy(desc(enrichedRouterRedeemPY.block_timestamp))
      .limit(500),
    db
      .select()
      .from(ytInterestClaimed)
      .where(
        and(
          buildAddressCondition(ytInterestClaimed.user, params),
          gte(ytInterestClaimed.block_timestamp, cutoffDate)
        )
      )
      .orderBy(desc(ytInterestClaimed.block_timestamp))
      .limit(500),
    db
      .select()
      .from(userPyPositions)
      .where(buildAddressCondition(userPyPositions.user_address, params)),
    db.select().from(marketCurrentState),
  ]);
}

// ----- Response Helpers -----

function createEmptyResponse(address: string): PnlTimelineResponse {
  return {
    address,
    positions: [],
    mintRedeemHistory: [],
    yieldClaimHistory: [],
    timeline: [],
    summary: {
      totalPositions: 0,
      totalUnrealizedPnlSy: '0',
      totalYieldClaimedSy: '0',
      overallPnlPercent: 0,
    },
  };
}

/**
 * GET /api/portfolio/[address]/pnl-timeline
 * Get P&L timeline data for a user's positions
 *
 * Query params:
 * - days: number - how many days of history (default: 90)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse> {
  const rateLimitResult = await applyRateLimit(request, 'USER');
  if (rateLimitResult) return rateLimitResult;

  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  const days = Number.parseInt(searchParams.get('days') ?? '90', 10);
  const cutoffDate = new Date(Date.now() - days * 86400000);

  try {
    const addressParams: AddressParams = {
      normalizedAddress: normalizeAddressForDb(address),
      lowerAddress: address.toLowerCase(),
    };

    const [mints, redeems, claims, positions, allMarketStates] = await createPnlTimelineQueries(
      addressParams,
      cutoffDate
    );

    const marketStateByYt = new Map(allMarketStates.map((m) => [m.yt?.toLowerCase(), m]));
    const now = Date.now() / 1000;

    // Transform events
    const mintRedeemHistory = [...mints.map(mapMint), ...redeems.map(mapRedeem)].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const yieldClaimHistory = claims.map(mapClaim);

    // Analyze positions and accumulate totals
    const positionSummaries: PositionPnlSummary[] = [];
    const acc: PnlAccumulator = {
      totalUnrealizedPnl: 0n,
      totalYieldClaimed: 0n,
      totalEntryValue: 0n,
    };

    for (const pos of positions) {
      const ytAddress = pos.yt?.toLowerCase() ?? '';
      const marketState = marketStateByYt.get(ytAddress);
      const timing = getMarketTiming(marketState, now);

      const result = analyzePosition({
        pos,
        positionMints: filterByYt(mints, ytAddress),
        positionRedeems: filterByYt(redeems, ytAddress),
        marketState,
        timing,
      });
      if (!result) continue;

      positionSummaries.push(result.summary);
      acc.totalUnrealizedPnl += result.pnl.unrealizedPnlSy;
      acc.totalYieldClaimed += BigInt(result.summary.totalYieldClaimed);
      acc.totalEntryValue += result.entryValue;
    }

    // Build timeline
    const timelineEvents = buildTimelineEvents(mintRedeemHistory, yieldClaimHistory);
    const timeline = accumulateTimeline(timelineEvents);

    const overallPnlPercent =
      acc.totalEntryValue > 0n
        ? (Number(acc.totalUnrealizedPnl + acc.totalYieldClaimed) / Number(acc.totalEntryValue)) *
          100
        : 0;

    return NextResponse.json({
      address,
      positions: positionSummaries,
      mintRedeemHistory,
      yieldClaimHistory,
      timeline,
      summary: {
        totalPositions: positionSummaries.length,
        totalUnrealizedPnlSy: acc.totalUnrealizedPnl.toString(),
        totalYieldClaimedSy: acc.totalYieldClaimed.toString(),
        overallPnlPercent,
      },
    } satisfies PnlTimelineResponse);
  } catch (error) {
    logError(error, { module: 'portfolio/pnl-timeline', address });
    return NextResponse.json(createEmptyResponse(address), { status: 500 });
  }
}
