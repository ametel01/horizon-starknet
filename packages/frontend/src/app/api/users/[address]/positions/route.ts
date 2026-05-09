import { db, marketCurrentState, marketLpPositions, userPyPositions } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { inArray, or, sql } from 'drizzle-orm';
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

type PyPositionRow = typeof userPyPositions.$inferSelect;
type LpPositionRow = typeof marketLpPositions.$inferSelect;
type MarketStateRow = typeof marketCurrentState.$inferSelect;

function getUserAddressMatch(
  column: typeof userPyPositions.user_address | typeof marketLpPositions.user_address,
  normalizedAddress: string,
  address: string
) {
  return or(sql`LOWER(${column}) = ${normalizedAddress}`, sql`LOWER(${column}) = ${address}`);
}

async function fetchPyPositionRows(normalizedAddress: string, address: string) {
  return db
    .select()
    .from(userPyPositions)
    .where(getUserAddressMatch(userPyPositions.user_address, normalizedAddress, address));
}

async function fetchLpPositionRows(normalizedAddress: string, address: string) {
  return db
    .select()
    .from(marketLpPositions)
    .where(getUserAddressMatch(marketLpPositions.user_address, normalizedAddress, address));
}

function mapPyPosition(row: PyPositionRow): PyPosition | null {
  const ptBalance = BigInt(row.pt_balance ?? '0');
  const ytBalance = BigInt(row.yt_balance ?? '0');
  if (ptBalance === 0n && ytBalance === 0n) return null;

  return {
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
  };
}

function mapPyPositions(rows: PyPositionRow[]): PyPosition[] {
  const positions: PyPosition[] = [];
  for (const row of rows) {
    const position = mapPyPosition(row);
    if (position) positions.push(position);
  }
  return positions;
}

function collectMarketAddresses(lpRows: LpPositionRow[]): string[] {
  const marketAddresses = new Set<string>();
  for (const row of lpRows) {
    if (row.market) marketAddresses.add(row.market);
  }
  return Array.from(marketAddresses);
}

async function fetchMarketStateMap(
  marketAddresses: string[]
): Promise<Map<string, MarketStateRow>> {
  if (marketAddresses.length === 0) return new Map();

  const marketStates = await db
    .select()
    .from(marketCurrentState)
    .where(inArray(marketCurrentState.market, marketAddresses));

  const marketStateMap = new Map<string, MarketStateRow>();
  for (const marketState of marketStates) {
    if (marketState.market) {
      marketStateMap.set(marketState.market, marketState);
    }
  }
  return marketStateMap;
}

function getLpMarketFields(row: LpPositionRow) {
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
  };
}

function getLpStateFields(currentState: MarketStateRow | undefined) {
  return {
    currentImpliedRate: currentState?.implied_rate ?? null,
    currentExchangeRate: currentState?.exchange_rate ?? null,
    underlyingSymbol: currentState?.underlying_symbol ?? null,
    expiry: currentState?.expiry ?? null,
  };
}

function mapLpPosition(
  row: LpPositionRow,
  marketStateMap: Map<string, MarketStateRow>
): LpPosition | null {
  const balance = BigInt(row.lp_balance ?? '0');
  if (balance === 0n) return null;

  const currentState = marketStateMap.get(row.market ?? '');
  return {
    ...getLpMarketFields(row),
    ...getLpStateFields(currentState),
  };
}

function mapLpPositions(
  rows: LpPositionRow[],
  marketStateMap: Map<string, MarketStateRow>
): LpPosition[] {
  const positions: LpPosition[] = [];
  for (const row of rows) {
    const position = mapLpPosition(row, marketStateMap);
    if (position) positions.push(position);
  }
  return positions;
}

function createPositionsResponse(
  address: string,
  pyPositions: PyPosition[],
  lpPositions: LpPosition[]
): PositionsResponse {
  return {
    address,
    pyPositions,
    lpPositions,
    summary: {
      totalPyPositions: pyPositions.length,
      totalLpPositions: lpPositions.length,
    },
  };
}

function createEmptyPositionsResponse(address: string): PositionsResponse {
  return createPositionsResponse(address, [], []);
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
    const lowerAddress = address.toLowerCase();

    const [pyResults, lpResults] = await Promise.all([
      fetchPyPositionRows(normalizedAddress, lowerAddress),
      fetchLpPositionRows(normalizedAddress, lowerAddress),
    ]);
    const marketStateMap = await fetchMarketStateMap(collectMarketAddresses(lpResults));
    const response = createPositionsResponse(
      address,
      mapPyPositions(pyResults),
      mapLpPositions(lpResults, marketStateMap)
    );

    return NextResponse.json(response);
  } catch (error) {
    logError(error, { module: 'users/positions', address });
    return NextResponse.json(createEmptyPositionsResponse(address), { status: 500 });
  }
}
