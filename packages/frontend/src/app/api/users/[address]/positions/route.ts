import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { db, userPositionsSummary, userLpPositions, marketCurrentState } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface PyPosition {
  yt: string;
  pt: string;
  sy: string;
  expiry: number;
  netPtBalance: string;
  netYtBalance: string;
  avgEntryPyIndex: string | null;
  avgEntryExchangeRate: string | null;
  totalMinted: string;
  totalRedeemed: string;
  totalInterestClaimed: string;
  firstMint: string | null;
  lastActivity: string | null;
  // Computed fields based on current rates
  isExpired: boolean;
}

interface LpPosition {
  market: string;
  expiry: number;
  sy: string;
  pt: string;
  yt: string;
  underlying: string;
  underlyingSymbol: string;
  netLpBalance: string;
  totalSyDeposited: string;
  totalPtDeposited: string;
  totalSyWithdrawn: string;
  totalPtWithdrawn: string;
  avgEntryImpliedRate: string | null;
  avgEntryExchangeRate: string | null;
  firstMint: string | null;
  lastActivity: string | null;
  // Current market state for P&L calculation
  currentImpliedRate: string | null;
  currentExchangeRate: string | null;
  isExpired: boolean;
}

interface PositionsResponse {
  address: string;
  pyPositions: PyPosition[];
  lpPositions: LpPosition[];
  summary: {
    totalPyPositions: number;
    totalLpPositions: number;
    activePyPositions: number;
    activeLpPositions: number;
  };
}

/**
 * GET /api/users/[address]/positions
 * Get aggregated positions for a user
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<PositionsResponse>> {
  const { address } = await params;
  const now = Math.floor(Date.now() / 1000);

  try {
    // Get PY positions
    const pyResults = await db
      .select()
      .from(userPositionsSummary)
      .where(eq(userPositionsSummary.user_address, address));

    const pyPositions: PyPosition[] = pyResults
      .filter((row) => {
        // Only include positions with non-zero balance
        const ptBalance = BigInt(row.net_pt_balance ?? '0');
        const ytBalance = BigInt(row.net_yt_balance ?? '0');
        return ptBalance > 0n || ytBalance > 0n;
      })
      .map((row) => ({
        yt: row.yt ?? '',
        pt: row.pt ?? '',
        sy: row.sy ?? '',
        expiry: row.expiry ?? 0,
        netPtBalance: row.net_pt_balance ?? '0',
        netYtBalance: row.net_yt_balance ?? '0',
        avgEntryPyIndex: row.avg_entry_py_index ?? null,
        avgEntryExchangeRate: row.avg_entry_exchange_rate ?? null,
        totalMinted: row.total_minted ?? '0',
        totalRedeemed: row.total_redeemed ?? '0',
        totalInterestClaimed: row.total_interest_claimed ?? '0',
        firstMint: row.first_mint?.toISOString() ?? null,
        lastActivity: row.last_activity?.toISOString() ?? null,
        isExpired: (row.expiry ?? 0) <= now,
      }));

    // Get LP positions
    const lpResults = await db
      .select()
      .from(userLpPositions)
      .where(eq(userLpPositions.user_address, address));

    // Get current market states for LP positions
    const marketAddresses = [
      ...new Set(lpResults.map((r) => r.market).filter(Boolean)),
    ] as string[];
    const firstMarket = marketAddresses[0];
    const marketStates = await db
      .select()
      .from(marketCurrentState)
      .where(
        firstMarket !== undefined
          ? eq(marketCurrentState.market, firstMarket) // TODO: use inArray when available
          : eq(marketCurrentState.market, '')
      );

    const marketStateMap = new Map(marketStates.map((m) => [m.market, m]));

    const lpPositions: LpPosition[] = lpResults
      .filter((row) => {
        const balance = BigInt(row.net_lp_balance ?? '0');
        return balance > 0n;
      })
      .map((row) => {
        const currentState = marketStateMap.get(row.market ?? '');
        return {
          market: row.market ?? '',
          expiry: row.expiry ?? 0,
          sy: row.sy ?? '',
          pt: row.pt ?? '',
          yt: row.yt ?? '',
          underlying: row.underlying ?? '',
          underlyingSymbol: row.underlying_symbol ?? '',
          netLpBalance: row.net_lp_balance ?? '0',
          totalSyDeposited: row.total_sy_deposited ?? '0',
          totalPtDeposited: row.total_pt_deposited ?? '0',
          totalSyWithdrawn: row.total_sy_withdrawn ?? '0',
          totalPtWithdrawn: row.total_pt_withdrawn ?? '0',
          avgEntryImpliedRate: row.avg_entry_implied_rate ?? null,
          avgEntryExchangeRate: row.avg_entry_exchange_rate ?? null,
          firstMint: row.first_mint?.toISOString() ?? null,
          lastActivity: row.last_activity?.toISOString() ?? null,
          currentImpliedRate: currentState?.implied_rate ?? null,
          currentExchangeRate: currentState?.exchange_rate ?? null,
          isExpired: (row.expiry ?? 0) <= now,
        };
      });

    // Calculate summary
    const activePyPositions = pyPositions.filter((p) => !p.isExpired).length;
    const activeLpPositions = lpPositions.filter((p) => !p.isExpired).length;

    return NextResponse.json({
      address,
      pyPositions,
      lpPositions,
      summary: {
        totalPyPositions: pyPositions.length,
        totalLpPositions: lpPositions.length,
        activePyPositions,
        activeLpPositions,
      },
    });
  } catch (error) {
    console.error('[users/[address]/positions] Error fetching positions:', error);
    return NextResponse.json(
      {
        address,
        pyPositions: [],
        lpPositions: [],
        summary: {
          totalPyPositions: 0,
          totalLpPositions: 0,
          activePyPositions: 0,
          activeLpPositions: 0,
        },
      },
      { status: 500 }
    );
  }
}
