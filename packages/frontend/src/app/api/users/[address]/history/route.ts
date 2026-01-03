import { db } from '@shared/server/db';
import {
  enrichedRouterAddLiquidity,
  enrichedRouterMintPY,
  enrichedRouterRedeemPY,
  enrichedRouterRemoveLiquidity,
  enrichedRouterSwap,
  enrichedRouterSwapYT,
} from '@shared/server/db/schema';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import type { SQL } from 'drizzle-orm';
import { desc, or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ----- Types -----

type EventType =
  | 'swap'
  | 'swap_yt'
  | 'add_liquidity'
  | 'remove_liquidity'
  | 'mint_py'
  | 'redeem_py';

interface HistoryEvent {
  id: string;
  type: EventType;
  blockNumber: number;
  blockTimestamp: string;
  transactionHash: string;
  market?: string | undefined;
  yt?: string | undefined;
  expiry?: number | undefined;
  underlyingSymbol?: string | undefined;
  amounts: Record<string, string>;
  exchangeRate?: string | undefined;
  impliedRate?: string | undefined;
}

interface HistoryResponse {
  address: string;
  events: HistoryEvent[];
  total: number;
  hasMore: boolean;
}

interface QueryParams {
  normalizedAddress: string;
  lowerAddress: string;
  limit: number;
}

// ----- Address Helpers -----

/**
 * Normalize a Starknet address for database comparison.
 * Pads the address to full 66 characters (0x + 64 hex chars) and lowercases it.
 */
function normalizeAddressForDb(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  const padded = hex.padStart(64, '0');
  return `0x${padded}`;
}

/** Build SQL condition for sender/receiver address matching */
function buildAddressCondition(
  senderCol: { name: string },
  receiverCol: { name: string },
  params: QueryParams
): SQL | undefined {
  return or(
    sql`LOWER(${senderCol}) = ${params.normalizedAddress}`,
    sql`LOWER(${senderCol}) = ${params.lowerAddress}`,
    sql`LOWER(${receiverCol}) = ${params.normalizedAddress}`,
    sql`LOWER(${receiverCol}) = ${params.lowerAddress}`
  );
}

// ----- Event Mappers -----

interface BaseRow {
  _id: string | null;
  block_number: number | null;
  block_timestamp: Date | null;
  transaction_hash: string | null;
}

function mapBaseFields(
  row: BaseRow,
  type: EventType
): Pick<HistoryEvent, 'id' | 'type' | 'blockNumber' | 'blockTimestamp' | 'transactionHash'> {
  return {
    id: row._id ?? '',
    type,
    blockNumber: row.block_number ?? 0,
    blockTimestamp: row.block_timestamp?.toISOString() ?? '',
    transactionHash: row.transaction_hash ?? '',
  };
}

interface SwapRow extends BaseRow {
  market: string | null;
  expiry: number | null;
  underlying_symbol: string | null;
  sy_in: string | null;
  pt_in: string | null;
  sy_out: string | null;
  pt_out: string | null;
  fee: string | null;
  exchange_rate: string | null;
  implied_rate_after: string | null;
}

function mapSwap(row: SwapRow): HistoryEvent {
  return {
    ...mapBaseFields(row, 'swap'),
    market: row.market ?? undefined,
    expiry: row.expiry ?? undefined,
    underlyingSymbol: row.underlying_symbol ?? undefined,
    amounts: {
      syIn: row.sy_in ?? '0',
      ptIn: row.pt_in ?? '0',
      syOut: row.sy_out ?? '0',
      ptOut: row.pt_out ?? '0',
      fee: row.fee ?? '0',
    },
    exchangeRate: row.exchange_rate ?? undefined,
    impliedRate: row.implied_rate_after ?? undefined,
  };
}

interface SwapYTRow extends BaseRow {
  market: string | null;
  yt: string | null;
  expiry: number | null;
  underlying_symbol: string | null;
  sy_in: string | null;
  yt_in: string | null;
  sy_out: string | null;
  yt_out: string | null;
  exchange_rate: string | null;
  implied_rate_after: string | null;
}

function mapSwapYT(row: SwapYTRow): HistoryEvent {
  return {
    ...mapBaseFields(row, 'swap_yt'),
    market: row.market ?? undefined,
    yt: row.yt ?? undefined,
    expiry: row.expiry ?? undefined,
    underlyingSymbol: row.underlying_symbol ?? undefined,
    amounts: {
      syIn: row.sy_in ?? '0',
      ytIn: row.yt_in ?? '0',
      syOut: row.sy_out ?? '0',
      ytOut: row.yt_out ?? '0',
    },
    exchangeRate: row.exchange_rate ?? undefined,
    impliedRate: row.implied_rate_after ?? undefined,
  };
}

interface LiquidityAddRow extends BaseRow {
  market: string | null;
  expiry: number | null;
  underlying_symbol: string | null;
  sy_used: string | null;
  pt_used: string | null;
  lp_out: string | null;
  exchange_rate: string | null;
  implied_rate: string | null;
}

function mapAddLiquidity(row: LiquidityAddRow): HistoryEvent {
  return {
    ...mapBaseFields(row, 'add_liquidity'),
    market: row.market ?? undefined,
    expiry: row.expiry ?? undefined,
    underlyingSymbol: row.underlying_symbol ?? undefined,
    amounts: {
      syUsed: row.sy_used ?? '0',
      ptUsed: row.pt_used ?? '0',
      lpOut: row.lp_out ?? '0',
    },
    exchangeRate: row.exchange_rate ?? undefined,
    impliedRate: row.implied_rate ?? undefined,
  };
}

interface LiquidityRemoveRow extends BaseRow {
  market: string | null;
  expiry: number | null;
  underlying_symbol: string | null;
  lp_in: string | null;
  sy_out: string | null;
  pt_out: string | null;
  exchange_rate: string | null;
  implied_rate: string | null;
}

function mapRemoveLiquidity(row: LiquidityRemoveRow): HistoryEvent {
  return {
    ...mapBaseFields(row, 'remove_liquidity'),
    market: row.market ?? undefined,
    expiry: row.expiry ?? undefined,
    underlyingSymbol: row.underlying_symbol ?? undefined,
    amounts: {
      lpIn: row.lp_in ?? '0',
      syOut: row.sy_out ?? '0',
      ptOut: row.pt_out ?? '0',
    },
    exchangeRate: row.exchange_rate ?? undefined,
    impliedRate: row.implied_rate ?? undefined,
  };
}

interface MintRow extends BaseRow {
  yt: string | null;
  expiry: number | null;
  sy_in: string | null;
  pt_out: string | null;
  yt_out: string | null;
  exchange_rate: string | null;
}

function mapMint(row: MintRow): HistoryEvent {
  return {
    ...mapBaseFields(row, 'mint_py'),
    yt: row.yt ?? undefined,
    expiry: row.expiry ?? undefined,
    amounts: {
      syIn: row.sy_in ?? '0',
      ptOut: row.pt_out ?? '0',
      ytOut: row.yt_out ?? '0',
    },
    exchangeRate: row.exchange_rate ?? undefined,
  };
}

interface RedeemRow extends BaseRow {
  yt: string | null;
  expiry: number | null;
  py_in: string | null;
  sy_out: string | null;
  exchange_rate: string | null;
}

function mapRedeem(row: RedeemRow): HistoryEvent {
  return {
    ...mapBaseFields(row, 'redeem_py'),
    yt: row.yt ?? undefined,
    expiry: row.expiry ?? undefined,
    amounts: {
      pyIn: row.py_in ?? '0',
      syOut: row.sy_out ?? '0',
    },
    exchangeRate: row.exchange_rate ?? undefined,
  };
}

// ----- Query Builders -----

function createUserHistoryQueries(params: QueryParams, typeFilter: string[]) {
  const shouldFetch = (type: string): boolean =>
    typeFilter.length === 0 || typeFilter.includes(type);

  return Promise.all([
    shouldFetch('swap')
      ? db
          .select()
          .from(enrichedRouterSwap)
          .where(
            buildAddressCondition(enrichedRouterSwap.sender, enrichedRouterSwap.receiver, params)
          )
          .orderBy(desc(enrichedRouterSwap.block_timestamp))
          .limit(params.limit)
      : Promise.resolve([]),
    shouldFetch('swap_yt')
      ? db
          .select()
          .from(enrichedRouterSwapYT)
          .where(
            buildAddressCondition(
              enrichedRouterSwapYT.sender,
              enrichedRouterSwapYT.receiver,
              params
            )
          )
          .orderBy(desc(enrichedRouterSwapYT.block_timestamp))
          .limit(params.limit)
      : Promise.resolve([]),
    shouldFetch('add_liquidity')
      ? db
          .select()
          .from(enrichedRouterAddLiquidity)
          .where(
            buildAddressCondition(
              enrichedRouterAddLiquidity.sender,
              enrichedRouterAddLiquidity.receiver,
              params
            )
          )
          .orderBy(desc(enrichedRouterAddLiquidity.block_timestamp))
          .limit(params.limit)
      : Promise.resolve([]),
    shouldFetch('remove_liquidity')
      ? db
          .select()
          .from(enrichedRouterRemoveLiquidity)
          .where(
            buildAddressCondition(
              enrichedRouterRemoveLiquidity.sender,
              enrichedRouterRemoveLiquidity.receiver,
              params
            )
          )
          .orderBy(desc(enrichedRouterRemoveLiquidity.block_timestamp))
          .limit(params.limit)
      : Promise.resolve([]),
    shouldFetch('mint_py')
      ? db
          .select()
          .from(enrichedRouterMintPY)
          .where(
            buildAddressCondition(
              enrichedRouterMintPY.sender,
              enrichedRouterMintPY.receiver,
              params
            )
          )
          .orderBy(desc(enrichedRouterMintPY.block_timestamp))
          .limit(params.limit)
      : Promise.resolve([]),
    shouldFetch('redeem_py')
      ? db
          .select()
          .from(enrichedRouterRedeemPY)
          .where(
            buildAddressCondition(
              enrichedRouterRedeemPY.sender,
              enrichedRouterRedeemPY.receiver,
              params
            )
          )
          .orderBy(desc(enrichedRouterRedeemPY.block_timestamp))
          .limit(params.limit)
      : Promise.resolve([]),
  ]);
}

// ----- Event Collection -----

function collectEvents(
  swaps: SwapRow[],
  ytSwaps: SwapYTRow[],
  addLiq: LiquidityAddRow[],
  removeLiq: LiquidityRemoveRow[],
  mints: MintRow[],
  redeems: RedeemRow[]
): HistoryEvent[] {
  const events: HistoryEvent[] = [
    ...swaps.map(mapSwap),
    ...ytSwaps.map(mapSwapYT),
    ...addLiq.map(mapAddLiquidity),
    ...removeLiq.map(mapRemoveLiquidity),
    ...mints.map(mapMint),
    ...redeems.map(mapRedeem),
  ];

  events.sort(
    (a, b) => new Date(b.blockTimestamp).getTime() - new Date(a.blockTimestamp).getTime()
  );
  return events;
}

function paginateEvents(
  events: HistoryEvent[],
  offset: number,
  limit: number
): { paginated: HistoryEvent[]; hasMore: boolean } {
  const paginated = events.slice(offset, offset + limit);
  const hasMore = events.length > offset + limit;
  return { paginated, hasMore };
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/[address]/history
 * Get transaction history for a user across all operations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<HistoryResponse>> {
  const rateLimitResult = await applyRateLimit(request, 'USER');
  if (rateLimitResult) return rateLimitResult as NextResponse<HistoryResponse>;

  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(Number.parseInt(searchParams.get('limit') ?? '50', 10), 100);
  const offset = Number.parseInt(searchParams.get('offset') ?? '0', 10);
  const typeFilter = searchParams.get('type')?.split(',') ?? [];

  try {
    const queryParams: QueryParams = {
      normalizedAddress: normalizeAddressForDb(address),
      lowerAddress: address.toLowerCase(),
      limit,
    };

    const [swaps, ytSwaps, addLiq, removeLiq, mints, redeems] = await createUserHistoryQueries(
      queryParams,
      typeFilter
    );

    const events = collectEvents(swaps, ytSwaps, addLiq, removeLiq, mints, redeems);
    const { paginated, hasMore } = paginateEvents(events, offset, limit);

    return NextResponse.json({
      address,
      events: paginated,
      total: paginated.length,
      hasMore,
    });
  } catch (error) {
    logError(error, { module: 'users/history', address });
    return NextResponse.json({ address, events: [], total: 0, hasMore: false }, { status: 500 });
  }
}
