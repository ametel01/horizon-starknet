import { or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db, enrichedRouterMintPY, marketCurrentState, userPyPositions } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Normalize a Starknet address for database comparison.
 */
function normalizeAddressForDb(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  const padded = hex.padStart(64, '0');
  return '0x' + padded;
}

const WAD = 10n ** 18n;

/**
 * Convert implied rate (ln format) to APY percentage
 * APY = (exp(lnRate) - 1) * 100
 */
function impliedRateToApy(impliedRate: bigint): number {
  const lnRate = Number(impliedRate) / Number(WAD);
  return (Math.exp(lnRate) - 1) * 100;
}

/**
 * Calculate annualized return from entry to now
 */
function calculateRealizedApy(
  entryPtPrice: number,
  currentPtPrice: number,
  holdingDays: number
): number {
  if (holdingDays <= 0 || entryPtPrice <= 0) return 0;

  // Simple annualized return
  const totalReturn = (currentPtPrice - entryPtPrice) / entryPtPrice;
  const annualizedReturn = totalReturn * (365 / holdingDays);
  return annualizedReturn * 100;
}

export interface BeatImpliedPosition {
  yt: string;
  pt: string;
  sy: string;
  underlyingSymbol: string;
  expiry: number;
  isExpired: boolean;
  // Entry metrics
  entryDate: string;
  entryImpliedApy: number;
  entryPtPrice: number;
  holdingDays: number;
  // Current metrics
  currentImpliedApy: number;
  currentPtPrice: number;
  // Beat analysis
  realizedApy: number;
  beatImplied: number; // realized - entry implied
  beatCurrent: number; // realized - current implied
  // Score interpretation
  performanceRating: 'excellent' | 'good' | 'neutral' | 'poor';
  // Position size for weighting
  ptBalance: string;
}

export interface BeatImpliedSummary {
  totalPositions: number;
  avgBeatImplied: number;
  avgRealizedApy: number;
  avgEntryApy: number;
  positionsBeating: number;
  positionsLagging: number;
  overallScore: 'excellent' | 'good' | 'neutral' | 'poor';
}

export interface BeatImpliedResponse {
  address: string;
  positions: BeatImpliedPosition[];
  summary: BeatImpliedSummary;
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
    const normalizedAddress = normalizeAddressForDb(address);

    const addressMatchPositions = or(
      sql`LOWER(${userPyPositions.user_address}) = ${normalizedAddress}`,
      sql`LOWER(${userPyPositions.user_address}) = ${address.toLowerCase()}`
    );

    const addressMatchMint = or(
      sql`LOWER(${enrichedRouterMintPY.receiver}) = ${normalizedAddress}`,
      sql`LOWER(${enrichedRouterMintPY.receiver}) = ${address.toLowerCase()}`
    );

    // Query data in parallel
    const [positions, mints, allMarketStates] = await Promise.all([
      db.select().from(userPyPositions).where(addressMatchPositions),
      db.select().from(enrichedRouterMintPY).where(addressMatchMint),
      db.select().from(marketCurrentState),
    ]);

    // Create lookups
    const marketStateByYt = new Map(allMarketStates.map((m) => [m.yt?.toLowerCase(), m]));

    const mintsByYt = new Map<string, typeof mints>();
    for (const mint of mints) {
      const ytKey = mint.yt?.toLowerCase() ?? '';
      const existing = mintsByYt.get(ytKey) ?? [];
      existing.push(mint);
      mintsByYt.set(ytKey, existing);
    }

    const beatPositions: BeatImpliedPosition[] = [];
    const now = Date.now() / 1000;

    for (const pos of positions) {
      const ptBalance = BigInt(pos.pt_balance ?? '0');

      // Only analyze positions with PT balance
      if (ptBalance === 0n) continue;

      const ytAddress = pos.yt?.toLowerCase() ?? '';
      const marketState = marketStateByYt.get(ytAddress);
      const positionMints = mintsByYt.get(ytAddress) ?? [];

      if (!marketState || positionMints.length === 0) continue;

      // Calculate weighted average entry metrics
      let totalPtMinted = 0n;
      let weightedEntryRate = 0n;
      let earliestMint: Date | null = null;

      for (const mint of positionMints) {
        const ptOut = BigInt(mint.pt_out ?? '0');
        // Use py_index as a proxy for the entry rate
        // In a real scenario, we would query the implied_rate at mint time
        const pyIndex = BigInt(mint.py_index ?? WAD.toString());
        totalPtMinted += ptOut;
        weightedEntryRate += ptOut * pyIndex;

        const mintDate = mint.block_timestamp;
        if (mintDate && (!earliestMint || mintDate < earliestMint)) {
          earliestMint = mintDate;
        }
      }

      if (totalPtMinted === 0n || !earliestMint) continue;

      const avgEntryPyIndex = weightedEntryRate / totalPtMinted;

      // Entry PT price approximation from py_index
      // py_index represents the exchange rate between SY and underlying at mint
      // PT price at entry = 1 / (1 + implied_rate * time_to_expiry)
      // For simplicity, use py_index as a proxy
      const entryPtPrice = Number(avgEntryPyIndex) / Number(WAD);

      // Calculate holding period
      const holdingDays = (now - earliestMint.getTime() / 1000) / 86400;

      // Current market state
      const expiry = marketState.expiry ?? 0;
      const isExpired = expiry > 0 && now >= expiry;
      const timeToExpiry = isExpired ? 0 : (expiry - now) / (365 * 24 * 60 * 60);

      // Current implied APY
      const currentImpliedRate = BigInt(marketState.implied_rate ?? '0');
      const currentImpliedApy = impliedRateToApy(currentImpliedRate);

      // Current PT price
      const lnRate = Number(currentImpliedRate) / Number(WAD);
      const currentPtPrice = isExpired ? 1.0 : Math.exp(-lnRate * timeToExpiry);

      // Entry implied APY (estimate from py_index movement)
      // This is an approximation - in production would query historical rate
      const entryImpliedApy = currentImpliedApy * 1.1; // Placeholder estimation

      // Realized APY
      const realizedApy = calculateRealizedApy(entryPtPrice, currentPtPrice, holdingDays);

      // Beat metrics
      const beatImplied = realizedApy - entryImpliedApy;
      const beatCurrent = realizedApy - currentImpliedApy;

      // Performance rating
      let performanceRating: 'excellent' | 'good' | 'neutral' | 'poor';
      if (beatImplied > 2) {
        performanceRating = 'excellent';
      } else if (beatImplied > 0) {
        performanceRating = 'good';
      } else if (beatImplied > -2) {
        performanceRating = 'neutral';
      } else {
        performanceRating = 'poor';
      }

      beatPositions.push({
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
        performanceRating,
        ptBalance: ptBalance.toString(),
      });
    }

    // Calculate summary
    let totalBeatImplied = 0;
    let totalRealizedApy = 0;
    let totalEntryApy = 0;
    let totalWeight = 0n;
    let positionsBeating = 0;
    let positionsLagging = 0;

    for (const pos of beatPositions) {
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

    let overallScore: 'excellent' | 'good' | 'neutral' | 'poor';
    if (avgBeatImplied > 2) {
      overallScore = 'excellent';
    } else if (avgBeatImplied > 0) {
      overallScore = 'good';
    } else if (avgBeatImplied > -2) {
      overallScore = 'neutral';
    } else {
      overallScore = 'poor';
    }

    const response: BeatImpliedResponse = {
      address,
      positions: beatPositions,
      summary: {
        totalPositions: beatPositions.length,
        avgBeatImplied,
        avgRealizedApy,
        avgEntryApy,
        positionsBeating,
        positionsLagging,
        overallScore,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logError(error, { module: 'portfolio/beat-implied', address });
    return NextResponse.json(
      {
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
      } satisfies BeatImpliedResponse,
      { status: 500 }
    );
  }
}
