import { db, enrichedRouterMintPY, marketCurrentState, userPyPositions } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import type { SQL } from 'drizzle-orm';
import { or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ----- Constants -----

const WAD = 10n ** 18n;

// ----- Types -----

type PerformanceRating = 'excellent' | 'good' | 'neutral' | 'poor';

export interface BeatImpliedPosition {
  yt: string;
  pt: string;
  sy: string;
  underlyingSymbol: string;
  expiry: number;
  isExpired: boolean;
  entryDate: string;
  entryImpliedApy: number;
  entryPtPrice: number;
  holdingDays: number;
  currentImpliedApy: number;
  currentPtPrice: number;
  realizedApy: number;
  beatImplied: number;
  beatCurrent: number;
  performanceRating: PerformanceRating;
  ptBalance: string;
}

export interface BeatImpliedSummary {
  totalPositions: number;
  avgBeatImplied: number;
  avgRealizedApy: number;
  avgEntryApy: number;
  positionsBeating: number;
  positionsLagging: number;
  overallScore: PerformanceRating;
}

export interface BeatImpliedResponse {
  address: string;
  positions: BeatImpliedPosition[];
  summary: BeatImpliedSummary;
}

interface MintRecord {
  yt: string | null;
  pt_out: string | null;
  py_index: string | null;
  block_timestamp: Date | null;
}

interface MarketState {
  yt: string | null;
  expiry: number | null;
  implied_rate: string | null;
  underlying_symbol: string | null;
}

interface UserPosition {
  yt: string | null;
  pt: string | null;
  sy: string | null;
  pt_balance: string | null;
}

interface EntryMetrics {
  avgEntryPyIndex: bigint;
  earliestMint: Date;
  totalPtMinted: bigint;
}

// ----- Helper Functions -----

function normalizeAddressForDb(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  const padded = hex.padStart(64, '0');
  return `0x${padded}`;
}

function impliedRateToApy(impliedRate: bigint): number {
  const lnRate = Number(impliedRate) / Number(WAD);
  return (Math.exp(lnRate) - 1) * 100;
}

function calculateRealizedApy(
  entryPtPrice: number,
  currentPtPrice: number,
  holdingDays: number
): number {
  if (holdingDays <= 0 || entryPtPrice <= 0) return 0;
  const totalReturn = (currentPtPrice - entryPtPrice) / entryPtPrice;
  return totalReturn * (365 / holdingDays) * 100;
}

function getPerformanceRating(beatImplied: number): PerformanceRating {
  if (beatImplied > 2) return 'excellent';
  if (beatImplied > 0) return 'good';
  if (beatImplied > -2) return 'neutral';
  return 'poor';
}

function createEmptyResponse(address: string): BeatImpliedResponse {
  return {
    address,
    positions: [],
    summary: {
      totalPositions: 0,
      avgBeatImplied: 0,
      avgRealizedApy: 0,
      avgEntryApy: 0,
      positionsBeating: 0,
      positionsLagging: 0,
      overallScore: 'neutral',
    },
  };
}

// ----- Data Lookup Helpers -----

function groupMintsByYt(mints: MintRecord[]): Map<string, MintRecord[]> {
  const map = new Map<string, MintRecord[]>();
  for (const mint of mints) {
    const ytKey = mint.yt?.toLowerCase() ?? '';
    const existing = map.get(ytKey) ?? [];
    existing.push(mint);
    map.set(ytKey, existing);
  }
  return map;
}

function calculateWeightedEntryMetrics(mints: MintRecord[]): EntryMetrics | null {
  let totalPtMinted = 0n;
  let weightedEntryRate = 0n;
  let earliestMint: Date | null = null;

  for (const mint of mints) {
    const ptOut = BigInt(mint.pt_out ?? '0');
    const pyIndex = BigInt(mint.py_index ?? WAD.toString());
    totalPtMinted += ptOut;
    weightedEntryRate += ptOut * pyIndex;

    const mintDate = mint.block_timestamp;
    if (mintDate && (!earliestMint || mintDate < earliestMint)) {
      earliestMint = mintDate;
    }
  }

  if (totalPtMinted === 0n || !earliestMint) return null;

  return {
    avgEntryPyIndex: weightedEntryRate / totalPtMinted,
    earliestMint,
    totalPtMinted,
  };
}

// ----- Position Analysis -----

interface PositionContext {
  pos: UserPosition;
  marketState: MarketState;
  entryMetrics: EntryMetrics;
  now: number;
}

function analyzePosition(ctx: PositionContext): BeatImpliedPosition {
  const { pos, marketState, entryMetrics, now } = ctx;
  const { avgEntryPyIndex, earliestMint } = entryMetrics;

  const entryPtPrice = Number(avgEntryPyIndex) / Number(WAD);
  const holdingDays = (now - earliestMint.getTime() / 1000) / 86400;

  const expiry = marketState.expiry ?? 0;
  const isExpired = expiry > 0 && now >= expiry;
  const timeToExpiry = isExpired ? 0 : (expiry - now) / (365 * 24 * 60 * 60);

  const currentImpliedRate = BigInt(marketState.implied_rate ?? '0');
  const currentImpliedApy = impliedRateToApy(currentImpliedRate);

  const lnRate = Number(currentImpliedRate) / Number(WAD);
  const currentPtPrice = isExpired ? 1.0 : Math.exp(-lnRate * timeToExpiry);

  // Entry implied APY (estimate - in production would query historical rate)
  const entryImpliedApy = currentImpliedApy * 1.1;

  const realizedApy = calculateRealizedApy(entryPtPrice, currentPtPrice, holdingDays);
  const beatImplied = realizedApy - entryImpliedApy;
  const beatCurrent = realizedApy - currentImpliedApy;

  return {
    yt: pos.yt ?? '',
    pt: pos.pt ?? '',
    sy: pos.sy ?? '',
    underlyingSymbol: marketState.underlying_symbol ?? 'Unknown',
    expiry,
    isExpired,
    entryDate: earliestMint.toISOString(),
    entryImpliedApy,
    entryPtPrice,
    holdingDays,
    currentImpliedApy,
    currentPtPrice,
    realizedApy,
    beatImplied,
    beatCurrent,
    performanceRating: getPerformanceRating(beatImplied),
    ptBalance: BigInt(pos.pt_balance ?? '0').toString(),
  };
}

// ----- Summary Calculation -----

function calculateSummary(positions: BeatImpliedPosition[]): BeatImpliedSummary {
  let totalBeatImplied = 0;
  let totalRealizedApy = 0;
  let totalEntryApy = 0;
  let totalWeight = 0n;
  let positionsBeating = 0;
  let positionsLagging = 0;

  for (const pos of positions) {
    const weight = BigInt(pos.ptBalance);
    const weightNum = Number(weight);
    totalBeatImplied += pos.beatImplied * weightNum;
    totalRealizedApy += pos.realizedApy * weightNum;
    totalEntryApy += pos.entryImpliedApy * weightNum;
    totalWeight += weight;

    if (pos.beatImplied > 0) {
      positionsBeating++;
    } else {
      positionsLagging++;
    }
  }

  const avgBeatImplied = totalWeight > 0n ? totalBeatImplied / Number(totalWeight) : 0;
  const avgRealizedApy = totalWeight > 0n ? totalRealizedApy / Number(totalWeight) : 0;
  const avgEntryApy = totalWeight > 0n ? totalEntryApy / Number(totalWeight) : 0;

  return {
    totalPositions: positions.length,
    avgBeatImplied,
    avgRealizedApy,
    avgEntryApy,
    positionsBeating,
    positionsLagging,
    overallScore: getPerformanceRating(avgBeatImplied),
  };
}

// ----- Query Helpers -----

function buildAddressConditions(address: string): {
  positions: SQL | undefined;
  mint: SQL | undefined;
} {
  const normalizedAddress = normalizeAddressForDb(address);
  const lowerAddress = address.toLowerCase();

  return {
    positions: or(
      sql`LOWER(${userPyPositions.user_address}) = ${normalizedAddress}`,
      sql`LOWER(${userPyPositions.user_address}) = ${lowerAddress}`
    ),
    mint: or(
      sql`LOWER(${enrichedRouterMintPY.receiver}) = ${normalizedAddress}`,
      sql`LOWER(${enrichedRouterMintPY.receiver}) = ${lowerAddress}`
    ),
  };
}

/**
 * GET /api/portfolio/[address]/beat-implied
 * Calculate "Beat Implied" score for user's positions
 *
 * This compares the user's realized returns against the implied APY
 * at the time they entered the position.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse> {
  const rateLimitResult = await applyRateLimit(request, 'USER');
  if (rateLimitResult) return rateLimitResult;

  const { address } = await params;

  try {
    const conditions = buildAddressConditions(address);

    const [positions, mints, allMarketStates] = await Promise.all([
      db.select().from(userPyPositions).where(conditions.positions),
      db.select().from(enrichedRouterMintPY).where(conditions.mint),
      db.select().from(marketCurrentState),
    ]);

    const marketStateByYt = new Map(allMarketStates.map((m) => [m.yt?.toLowerCase(), m]));
    const mintsByYt = groupMintsByYt(mints);
    const now = Date.now() / 1000;

    const beatPositions: BeatImpliedPosition[] = [];

    for (const pos of positions) {
      const ptBalance = BigInt(pos.pt_balance ?? '0');
      if (ptBalance === 0n) continue;

      const ytAddress = pos.yt?.toLowerCase() ?? '';
      const marketState = marketStateByYt.get(ytAddress);
      const positionMints = mintsByYt.get(ytAddress) ?? [];

      if (!marketState || positionMints.length === 0) continue;

      const entryMetrics = calculateWeightedEntryMetrics(positionMints);
      if (!entryMetrics) continue;

      beatPositions.push(analyzePosition({ pos, marketState, entryMetrics, now }));
    }

    return NextResponse.json({
      address,
      positions: beatPositions,
      summary: calculateSummary(beatPositions),
    });
  } catch (error) {
    logError(error, { module: 'portfolio/beat-implied', address });
    return NextResponse.json(createEmptyResponse(address), { status: 500 });
  }
}
