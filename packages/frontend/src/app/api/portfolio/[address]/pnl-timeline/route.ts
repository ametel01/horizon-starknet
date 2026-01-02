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
import { and, desc, gte, or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Normalize a Starknet address for database comparison.
 * Pads the address to full 66 characters (0x + 64 hex chars) and lowercases it.
 */
function normalizeAddressForDb(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  const padded = hex.padStart(64, '0');
  return `0x${padded}`;
}

const WAD = 10n ** 18n;

/**
 * Calculate PT price from implied rate and time to expiry
 * PT price = exp(-lnRate * timeToExpiryYears)
 */
function calculatePtPriceFromRate(impliedRate: bigint, timeToExpiryYears: number): number {
  // lnRate is stored as WAD
  const lnRate = Number(impliedRate) / Number(WAD);
  // PT price = exp(-lnRate * timeToExpiry)
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
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'USER');
  if (rateLimitResult) return rateLimitResult;

  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  const days = Number.parseInt(searchParams.get('days') ?? '90', 10);
  const cutoffDate = new Date(Date.now() - days * 86400000);

  try {
    const normalizedAddress = normalizeAddressForDb(address);

    // Build address match conditions
    const addressMatchMint = or(
      sql`LOWER(${enrichedRouterMintPY.receiver}) = ${normalizedAddress}`,
      sql`LOWER(${enrichedRouterMintPY.receiver}) = ${address.toLowerCase()}`
    );

    const addressMatchRedeem = or(
      sql`LOWER(${enrichedRouterRedeemPY.sender}) = ${normalizedAddress}`,
      sql`LOWER(${enrichedRouterRedeemPY.sender}) = ${address.toLowerCase()}`
    );

    const addressMatchClaim = or(
      sql`LOWER(${ytInterestClaimed.user}) = ${normalizedAddress}`,
      sql`LOWER(${ytInterestClaimed.user}) = ${address.toLowerCase()}`
    );

    const addressMatchPositions = or(
      sql`LOWER(${userPyPositions.user_address}) = ${normalizedAddress}`,
      sql`LOWER(${userPyPositions.user_address}) = ${address.toLowerCase()}`
    );

    // Query all data in parallel
    const [mints, redeems, claims, positions, allMarketStates] = await Promise.all([
      // Mint events
      db
        .select()
        .from(enrichedRouterMintPY)
        .where(and(addressMatchMint, gte(enrichedRouterMintPY.block_timestamp, cutoffDate)))
        .orderBy(desc(enrichedRouterMintPY.block_timestamp))
        .limit(500),

      // Redeem events
      db
        .select()
        .from(enrichedRouterRedeemPY)
        .where(and(addressMatchRedeem, gte(enrichedRouterRedeemPY.block_timestamp, cutoffDate)))
        .orderBy(desc(enrichedRouterRedeemPY.block_timestamp))
        .limit(500),

      // Yield claims
      db
        .select()
        .from(ytInterestClaimed)
        .where(and(addressMatchClaim, gte(ytInterestClaimed.block_timestamp, cutoffDate)))
        .orderBy(desc(ytInterestClaimed.block_timestamp))
        .limit(500),

      // Current positions
      db
        .select()
        .from(userPyPositions)
        .where(addressMatchPositions),

      // All market states for rate lookup
      db
        .select()
        .from(marketCurrentState),
    ]);

    // Create market state lookup
    const marketStateByYt = new Map(allMarketStates.map((m) => [m.yt?.toLowerCase(), m]));

    // Transform mint events
    const mintRedeemHistory: MintRedeemEvent[] = [
      ...mints.map((m) => ({
        type: 'mint' as const,
        timestamp: m.block_timestamp?.toISOString() ?? '',
        yt: m.yt ?? '',
        sy: m.sy ?? '',
        pt: m.pt ?? '',
        syAmount: m.sy_in ?? '0',
        ptAmount: m.pt_out ?? '0',
        ytAmount: m.yt_out ?? '0',
        pyIndex: m.py_index ?? '0',
        exchangeRate: m.exchange_rate ?? '0',
        transactionHash: m.transaction_hash ?? '',
      })),
      ...redeems.map((r) => ({
        type: 'redeem' as const,
        timestamp: r.block_timestamp?.toISOString() ?? '',
        yt: r.yt ?? '',
        sy: r.sy ?? '',
        pt: r.pt ?? '',
        syAmount: r.sy_out ?? '0',
        ptAmount: r.py_in ?? '0',
        ytAmount: r.py_in ?? '0',
        pyIndex: r.py_index ?? '0',
        exchangeRate: r.exchange_rate ?? '0',
        transactionHash: r.transaction_hash ?? '',
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Transform yield claims
    const yieldClaimHistory: YieldClaimEvent[] = claims.map((c) => ({
      timestamp: c.block_timestamp.toISOString(),
      yt: c.yt,
      sy: c.sy,
      amountSy: c.amount_sy,
      ytBalance: c.yt_balance,
      pyIndexAtClaim: c.py_index_at_claim,
      transactionHash: c.transaction_hash,
    }));

    // Calculate position summaries
    const positionSummaries: PositionPnlSummary[] = [];
    let totalUnrealizedPnl = 0n;
    let totalYieldClaimed = 0n;
    let totalEntryValue = 0n;

    for (const pos of positions) {
      const ptBalance = BigInt(pos.pt_balance ?? '0');
      const ytBalance = BigInt(pos.yt_balance ?? '0');

      // Skip positions with zero balance
      if (ptBalance === 0n && ytBalance === 0n) continue;

      const ytAddress = pos.yt?.toLowerCase() ?? '';
      const marketState = marketStateByYt.get(ytAddress);

      // Get mints for this position to calculate entry metrics
      const positionMints = mints.filter((m) => m.yt?.toLowerCase() === ytAddress);

      let totalPtMinted = 0n;
      let weightedPyIndex = 0n;
      for (const mint of positionMints) {
        const ptOut = BigInt(mint.pt_out ?? '0');
        const pyIndex = BigInt(mint.py_index ?? '0');
        totalPtMinted += ptOut;
        weightedPyIndex += ptOut * pyIndex;
      }

      const avgEntryPyIndex = totalPtMinted > 0n ? weightedPyIndex / totalPtMinted : 0n;

      // Calculate entry PT price (approximation based on py_index)
      const entryPtPrice = totalPtMinted > 0n ? Number(avgEntryPyIndex) / Number(WAD) : null;

      // Current market metrics
      const now = Date.now() / 1000;
      const expiry = marketState?.expiry ?? 0;
      const isExpired = expiry > 0 && now >= expiry;
      const timeToExpiry = isExpired ? 0 : (expiry - now) / (365 * 24 * 60 * 60);

      let currentPtPrice: number | null = null;
      if (marketState?.implied_rate) {
        const impliedRate = BigInt(marketState.implied_rate);
        currentPtPrice = isExpired ? 1.0 : calculatePtPriceFromRate(impliedRate, timeToExpiry);
      }

      // Calculate unrealized P&L for PT
      let unrealizedPnlSy = 0n;
      let unrealizedPnlPercent = 0;
      if (currentPtPrice !== null && entryPtPrice !== null && ptBalance > 0n) {
        const currentValue = (BigInt(Math.floor(currentPtPrice * Number(WAD))) * ptBalance) / WAD;
        const entryValue = (BigInt(Math.floor(entryPtPrice * Number(WAD))) * ptBalance) / WAD;
        unrealizedPnlSy = currentValue - entryValue;
        unrealizedPnlPercent =
          entryValue > 0n ? (Number(unrealizedPnlSy) / Number(entryValue)) * 100 : 0;
        totalUnrealizedPnl += unrealizedPnlSy;
        totalEntryValue += entryValue;
      }

      // Get total redeemed
      const positionRedeems = redeems.filter((r) => r.yt?.toLowerCase() === ytAddress);
      const totalPtRedeemed = positionRedeems.reduce((sum, r) => sum + BigInt(r.py_in ?? '0'), 0n);

      // Yield claimed for this position
      const posYieldClaimed = BigInt(pos.total_interest_claimed ?? '0');
      totalYieldClaimed += posYieldClaimed;

      positionSummaries.push({
        yt: pos.yt ?? '',
        pt: pos.pt ?? '',
        sy: pos.sy ?? '',
        underlyingSymbol: marketState?.underlying_symbol ?? 'Unknown',
        expiry: expiry,
        isExpired,
        currentPtBalance: ptBalance.toString(),
        currentYtBalance: ytBalance.toString(),
        totalPtMinted: totalPtMinted.toString(),
        totalPtRedeemed: totalPtRedeemed.toString(),
        avgEntryPyIndex: avgEntryPyIndex.toString(),
        firstMintDate: pos.first_mint?.toISOString() ?? null,
        currentImpliedRate: marketState?.implied_rate ?? null,
        currentPtPrice,
        entryPtPrice,
        unrealizedPnlSy: unrealizedPnlSy.toString(),
        unrealizedPnlPercent,
        totalYieldClaimed: posYieldClaimed.toString(),
        yieldClaimCount: pos.claim_count ?? 0,
      });
    }

    // Build timeline
    const allEvents = [
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
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Accumulate timeline
    let cumulativeYield = 0n;
    const balancesByYt = new Map<string, { pt: bigint; yt: bigint }>();

    const timeline: TimelineDataPoint[] = allEvents.map((event) => {
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

      // Sum all balances
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

    // Calculate overall P&L percent
    const overallPnlPercent =
      totalEntryValue > 0n
        ? (Number(totalUnrealizedPnl + totalYieldClaimed) / Number(totalEntryValue)) * 100
        : 0;

    const response: PnlTimelineResponse = {
      address,
      positions: positionSummaries,
      mintRedeemHistory,
      yieldClaimHistory,
      timeline,
      summary: {
        totalPositions: positionSummaries.length,
        totalUnrealizedPnlSy: totalUnrealizedPnl.toString(),
        totalYieldClaimedSy: totalYieldClaimed.toString(),
        overallPnlPercent,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logError(error, { module: 'portfolio/pnl-timeline', address });
    return NextResponse.json(
      {
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
      } satisfies PnlTimelineResponse,
      { status: 500 }
    );
  }
}
