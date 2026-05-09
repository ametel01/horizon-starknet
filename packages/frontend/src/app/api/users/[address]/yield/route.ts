import { db, userPyPositions, ytInterestClaimed } from '@shared/server/db';
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

interface YieldClaimEvent {
  id: string;
  yt: string;
  sy: string;
  expiry: number;
  amountSy: string;
  ytBalance: string;
  pyIndexAtClaim: string;
  exchangeRate: string;
  blockTimestamp: string;
  transactionHash: string;
}

interface YieldSummary {
  yt: string;
  sy: string;
  totalClaimed: string;
  claimCount: number;
  lastClaim: string | null;
  currentYtBalance: string;
}

interface YieldResponse {
  address: string;
  totalYieldClaimed: string;
  claimHistory: YieldClaimEvent[];
  summaryByPosition: YieldSummary[];
}

type YieldClaimRow = typeof ytInterestClaimed.$inferSelect;
type UserPyPositionRow = typeof userPyPositions.$inferSelect;

interface YieldQueryParams {
  days: string | null;
  limit: number;
}

function parseYieldQuery(searchParams: URLSearchParams): YieldQueryParams {
  return {
    days: searchParams.get('days'),
    limit: Math.min(Number.parseInt(searchParams.get('limit') ?? '100', 10), 500),
  };
}

function getClaimAddressMatch(normalizedAddress: string, address: string) {
  return or(
    sql`LOWER(${ytInterestClaimed.user}) = ${normalizedAddress}`,
    sql`LOWER(${ytInterestClaimed.user}) = ${address}`
  );
}

function getPositionAddressMatch(normalizedAddress: string, address: string) {
  return or(
    sql`LOWER(${userPyPositions.user_address}) = ${normalizedAddress}`,
    sql`LOWER(${userPyPositions.user_address}) = ${address}`
  );
}

function getClaimConditions(
  queryParams: YieldQueryParams,
  normalizedAddress: string,
  address: string
) {
  const addressMatch = getClaimAddressMatch(normalizedAddress, address);
  if (!queryParams.days) return addressMatch;

  return and(
    addressMatch,
    gte(
      ytInterestClaimed.block_timestamp,
      new Date(Date.now() - Number.parseInt(queryParams.days, 10) * 86400000)
    )
  );
}

async function fetchClaimRows(
  queryParams: YieldQueryParams,
  normalizedAddress: string,
  address: string
) {
  return db
    .select()
    .from(ytInterestClaimed)
    .where(getClaimConditions(queryParams, normalizedAddress, address))
    .orderBy(desc(ytInterestClaimed.block_timestamp))
    .limit(queryParams.limit);
}

function mapClaimHistory(claims: YieldClaimRow[]): YieldClaimEvent[] {
  return claims.map((row) => ({
    id: row._id,
    yt: row.yt,
    sy: row.sy,
    expiry: row.expiry,
    amountSy: row.amount_sy,
    ytBalance: row.yt_balance,
    pyIndexAtClaim: row.py_index_at_claim,
    exchangeRate: row.exchange_rate,
    blockTimestamp: row.block_timestamp.toISOString(),
    transactionHash: row.transaction_hash,
  }));
}

function calculateTotalYieldClaimed(claims: YieldClaimRow[]): string {
  let totalYieldClaimed = 0n;
  for (const claim of claims) {
    totalYieldClaimed += BigInt(claim.amount_sy);
  }
  return totalYieldClaimed.toString();
}

async function fetchPositionRows(normalizedAddress: string, address: string) {
  return db
    .select()
    .from(userPyPositions)
    .where(getPositionAddressMatch(normalizedAddress, address));
}

function mapYieldSummary(row: UserPyPositionRow): YieldSummary | null {
  const totalClaimed = BigInt(row.total_interest_claimed ?? '0');
  const ytBalance = BigInt(row.yt_balance ?? '0');
  if (totalClaimed === 0n && ytBalance === 0n) return null;

  return {
    yt: row.yt ?? '',
    sy: row.sy ?? '',
    totalClaimed: row.total_interest_claimed ?? '0',
    claimCount: row.claim_count ?? 0,
    lastClaim: row.last_activity?.toISOString() ?? null,
    currentYtBalance: row.yt_balance ?? '0',
  };
}

function mapSummaryByPosition(positions: UserPyPositionRow[]): YieldSummary[] {
  const summaries: YieldSummary[] = [];
  for (const row of positions) {
    const summary = mapYieldSummary(row);
    if (summary) summaries.push(summary);
  }
  return summaries;
}

function createEmptyYieldResponse(address: string): YieldResponse {
  return {
    address,
    totalYieldClaimed: '0',
    claimHistory: [],
    summaryByPosition: [],
  };
}

/**
 * GET /api/users/[address]/yield
 * Get yield earned/claimed for a user
 *
 * Query params:
 * - days: number - how many days of history (default: all)
 * - limit: number - max claim events (default: 100)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<YieldResponse>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'USER');
  if (rateLimitResult) return rateLimitResult as NextResponse<YieldResponse>;

  const { address } = await params;
  const queryParams = parseYieldQuery(request.nextUrl.searchParams);

  try {
    // Normalize the address for comparison
    const normalizedAddress = normalizeAddressForDb(address);
    const lowerAddress = address.toLowerCase();

    const [claims, positions] = await Promise.all([
      fetchClaimRows(queryParams, normalizedAddress, lowerAddress),
      fetchPositionRows(normalizedAddress, lowerAddress),
    ]);

    return NextResponse.json({
      address,
      totalYieldClaimed: calculateTotalYieldClaimed(claims),
      claimHistory: mapClaimHistory(claims),
      summaryByPosition: mapSummaryByPosition(positions),
    });
  } catch (error) {
    logError(error, { module: 'users/yield', address });
    return NextResponse.json(createEmptyYieldResponse(address), { status: 500 });
  }
}
