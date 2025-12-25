import { eq, or, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { db, userPyPositions, marketLpPositions, marketCurrentState } from '@/lib/db';
import { logError } from '@/lib/logger';
import { applyRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Normalize a Starknet address for database comparison.
 * Pads the address to full 66 characters (0x + 64 hex chars) and lowercases it.
 */
function normalizeAddressForDb(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  const padded = hex.padStart(64, '0');
  return '0x' + padded;
}

interface PyPosition {
  yt: string;
  pt: string;
  sy: string;
  ptBalance: string;
  ytBalance: string;
  totalInterestClaimed: string;
  firstMint: string | null;
  lastActivity: string | null;
  mintCount: number;
  redeemCount: number;
  claimCount: number;
}

interface LpPosition {
  market: string;
  lpBalance: string;
  totalSyDeposited: string;
  totalPtDeposited: string;
  totalSyWithdrawn: string;
  totalPtWithdrawn: string;
  firstMint: string | null;
  lastActivity: string | null;
  mintCount: number;
  burnCount: number;
  // Current market state for display
  currentImpliedRate: string | null;
  currentExchangeRate: string | null;
  underlyingSymbol: string | null;
  expiry: number | null;
}

interface PositionsResponse {
  address: string;
  pyPositions: PyPosition[];
  lpPositions: LpPosition[];
  summary: {
    totalPyPositions: number;
    totalLpPositions: number;
  };
}

/**
 * GET /api/users/[address]/positions
 * Get aggregated positions for a user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<PositionsResponse>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'USER');
  if (rateLimitResult) return rateLimitResult as NextResponse<PositionsResponse>;

  const { address } = await params;

  try {
    // Normalize the address for comparison
    const normalizedAddress = normalizeAddressForDb(address);

    // Get PY positions
    const pyResults = await db
      .select()
      .from(userPyPositions)
      .where(
        or(
          sql`LOWER(${userPyPositions.user_address}) = ${normalizedAddress}`,
          sql`LOWER(${userPyPositions.user_address}) = ${address.toLowerCase()}`
        )
      );

    const pyPositions: PyPosition[] = pyResults
      .filter((row) => {
        // Only include positions with non-zero balance
        const ptBalance = BigInt(row.pt_balance ?? '0');
        const ytBalance = BigInt(row.yt_balance ?? '0');
        return ptBalance > 0n || ytBalance > 0n;
      })
      .map((row) => ({
        yt: row.yt ?? '',
        pt: row.pt ?? '',
        sy: row.sy ?? '',
        ptBalance: row.pt_balance ?? '0',
        ytBalance: row.yt_balance ?? '0',
        totalInterestClaimed: row.total_interest_claimed ?? '0',
        firstMint: row.first_mint?.toISOString() ?? null,
        lastActivity: row.last_activity?.toISOString() ?? null,
        mintCount: row.mint_count ?? 0,
        redeemCount: row.redeem_count ?? 0,
        claimCount: row.claim_count ?? 0,
      }));

    // Get LP positions
    const lpResults = await db
      .select()
      .from(marketLpPositions)
      .where(
        or(
          sql`LOWER(${marketLpPositions.user_address}) = ${normalizedAddress}`,
          sql`LOWER(${marketLpPositions.user_address}) = ${address.toLowerCase()}`
        )
      );

    // Get current market states for LP positions
    const marketAddresses = [
      ...new Set(lpResults.map((r) => r.market).filter(Boolean)),
    ] as string[];
    const firstMarket = marketAddresses[0];
    const marketStates = firstMarket
      ? await db.select().from(marketCurrentState).where(eq(marketCurrentState.market, firstMarket))
      : [];

    const marketStateMap = new Map(marketStates.map((m) => [m.market, m]));

    const lpPositions: LpPosition[] = lpResults
      .filter((row) => {
        const balance = BigInt(row.lp_balance ?? '0');
        return balance > 0n;
      })
      .map((row) => {
        const currentState = marketStateMap.get(row.market ?? '');
        return {
          market: row.market ?? '',
          lpBalance: row.lp_balance ?? '0',
          totalSyDeposited: row.total_sy_deposited ?? '0',
          totalPtDeposited: row.total_pt_deposited ?? '0',
          totalSyWithdrawn: row.total_sy_withdrawn ?? '0',
          totalPtWithdrawn: row.total_pt_withdrawn ?? '0',
          firstMint: row.first_mint?.toISOString() ?? null,
          lastActivity: row.last_activity?.toISOString() ?? null,
          mintCount: row.mint_count ?? 0,
          burnCount: row.burn_count ?? 0,
          currentImpliedRate: currentState?.implied_rate ?? null,
          currentExchangeRate: currentState?.exchange_rate ?? null,
          underlyingSymbol: currentState?.underlying_symbol ?? null,
          expiry: currentState?.expiry ?? null,
        };
      });

    return NextResponse.json({
      address,
      pyPositions,
      lpPositions,
      summary: {
        totalPyPositions: pyPositions.length,
        totalLpPositions: lpPositions.length,
      },
    });
  } catch (error) {
    logError(error, { module: 'users/positions', address });
    return NextResponse.json(
      {
        address,
        pyPositions: [],
        lpPositions: [],
        summary: {
          totalPyPositions: 0,
          totalLpPositions: 0,
        },
      },
      { status: 500 }
    );
  }
}
