import { db } from '@shared/server/db';
import {
  enrichedRouterAddLiquidity,
  enrichedRouterMintPY,
  enrichedRouterRedeemPY,
  enrichedRouterRemoveLiquidity,
  enrichedRouterSwap,
  enrichedRouterSwapYT,
  syDeposit,
  syRedeem,
} from '@shared/server/db/schema';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import type { SQL } from 'drizzle-orm';
import { desc, or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ----- Types -----

type EventType =
  | 'deposit'
  | 'withdraw'
  | 'mint_py'
  | 'redeem_py'
  | 'swap'
  | 'swap_yt'
  | 'add_liquidity'
  | 'remove_liquidity';

interface ValueEvent {
  type: EventType;
  timestamp: string;
  transactionHash: string;
  market?: string | undefined;
  underlyingSymbol?: string | undefined;
  syDelta: string;
  ptDelta: string;
  ytDelta: string;
  lpDelta: string;
  exchangeRate: string;
  valueChange: string;
}

interface PortfolioSnapshot {
  date: string;
  totalValueSy: string;
  syBalance: string;
  ptBalance: string;
  ytBalance: string;
  lpBalance: string;
  realizedPnl: string;
  unrealizedPnl: string;
  eventCount: number;
}

interface PortfolioHistoryResponse {
  address: string;
  events: ValueEvent[];
  snapshots: PortfolioSnapshot[];
  summary: {
    totalDeposited: string;
    totalWithdrawn: string;
    realizedPnl: string;
    firstActivity: string | null;
    lastActivity: string | null;
    eventCount: number;
  };
}

interface QueryParams {
  normalizedAddress: string;
  lowerAddress: string;
  limit: number;
}

// ----- Helper Functions -----

function normalizeAddressForDb(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  const padded = hex.padStart(64, '0');
  return `0x${padded}`;
}

function buildCallerReceiverCondition(
  callerCol: { name: string },
  receiverCol: { name: string },
  params: QueryParams
): SQL | undefined {
  return or(
    sql`LOWER(${callerCol}) = ${params.normalizedAddress}`,
    sql`LOWER(${callerCol}) = ${params.lowerAddress}`,
    sql`LOWER(${receiverCol}) = ${params.normalizedAddress}`,
    sql`LOWER(${receiverCol}) = ${params.lowerAddress}`
  );
}

function buildSenderReceiverCondition(
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

function createEmptyResponse(address: string): PortfolioHistoryResponse {
  return {
    address,
    events: [],
    snapshots: [],
    summary: {
      totalDeposited: '0',
      totalWithdrawn: '0',
      realizedPnl: '0',
      firstActivity: null,
      lastActivity: null,
      eventCount: 0,
    },
  };
}

// ----- Event Mappers -----

interface DepositRow {
  block_timestamp: Date;
  transaction_hash: string;
  amount_sy_minted: string;
  exchange_rate: string;
}

function mapDeposit(row: DepositRow): ValueEvent {
  return {
    type: 'deposit',
    timestamp: row.block_timestamp.toISOString(),
    transactionHash: row.transaction_hash,
    syDelta: row.amount_sy_minted,
    ptDelta: '0',
    ytDelta: '0',
    lpDelta: '0',
    exchangeRate: row.exchange_rate,
    valueChange: row.amount_sy_minted,
  };
}

interface RedeemRow {
  block_timestamp: Date;
  transaction_hash: string;
  amount_sy_burned: string;
  exchange_rate: string;
}

function mapWithdraw(row: RedeemRow): ValueEvent {
  return {
    type: 'withdraw',
    timestamp: row.block_timestamp.toISOString(),
    transactionHash: row.transaction_hash,
    syDelta: `-${row.amount_sy_burned}`,
    ptDelta: '0',
    ytDelta: '0',
    lpDelta: '0',
    exchangeRate: row.exchange_rate,
    valueChange: `-${row.amount_sy_burned}`,
  };
}

interface MintRow {
  block_timestamp: Date | null;
  transaction_hash: string | null;
  sy_in: string | null;
  pt_out: string | null;
  yt_out: string | null;
  exchange_rate: string | null;
}

function mapMintPY(row: MintRow): ValueEvent {
  return {
    type: 'mint_py',
    timestamp: row.block_timestamp?.toISOString() ?? '',
    transactionHash: row.transaction_hash ?? '',
    syDelta: `-${row.sy_in ?? '0'}`,
    ptDelta: row.pt_out ?? '0',
    ytDelta: row.yt_out ?? '0',
    lpDelta: '0',
    exchangeRate: row.exchange_rate ?? '0',
    valueChange: '0',
  };
}

interface RedeemPYRow {
  block_timestamp: Date | null;
  transaction_hash: string | null;
  sy_out: string | null;
  py_in: string | null;
  exchange_rate: string | null;
}

function mapRedeemPY(row: RedeemPYRow): ValueEvent {
  return {
    type: 'redeem_py',
    timestamp: row.block_timestamp?.toISOString() ?? '',
    transactionHash: row.transaction_hash ?? '',
    syDelta: row.sy_out ?? '0',
    ptDelta: `-${row.py_in ?? '0'}`,
    ytDelta: `-${row.py_in ?? '0'}`,
    lpDelta: '0',
    exchangeRate: row.exchange_rate ?? '0',
    valueChange: '0',
  };
}

interface SwapRow {
  block_timestamp: Date | null;
  transaction_hash: string | null;
  sy_in: string | null;
  sy_out: string | null;
  pt_in: string | null;
  pt_out: string | null;
  fee: string | null;
  exchange_rate: string | null;
  market: string | null;
  underlying_symbol: string | null;
}

function mapSwap(row: SwapRow): ValueEvent {
  const syIn = BigInt(row.sy_in ?? '0');
  const syOut = BigInt(row.sy_out ?? '0');
  const ptIn = BigInt(row.pt_in ?? '0');
  const ptOut = BigInt(row.pt_out ?? '0');
  const fee = BigInt(row.fee ?? '0');

  return {
    type: 'swap',
    timestamp: row.block_timestamp?.toISOString() ?? '',
    transactionHash: row.transaction_hash ?? '',
    syDelta: (syOut - syIn).toString(),
    ptDelta: (ptOut - ptIn).toString(),
    ytDelta: '0',
    lpDelta: '0',
    exchangeRate: row.exchange_rate ?? '0',
    valueChange: `-${fee.toString()}`,
    market: row.market ?? undefined,
    underlyingSymbol: row.underlying_symbol ?? undefined,
  };
}

interface SwapYTRow {
  block_timestamp: Date | null;
  transaction_hash: string | null;
  sy_in: string | null;
  sy_out: string | null;
  yt_in: string | null;
  yt_out: string | null;
  exchange_rate: string | null;
  market: string | null;
  underlying_symbol: string | null;
}

function mapSwapYT(row: SwapYTRow): ValueEvent {
  const syIn = BigInt(row.sy_in ?? '0');
  const syOut = BigInt(row.sy_out ?? '0');
  const ytIn = BigInt(row.yt_in ?? '0');
  const ytOut = BigInt(row.yt_out ?? '0');

  return {
    type: 'swap_yt',
    timestamp: row.block_timestamp?.toISOString() ?? '',
    transactionHash: row.transaction_hash ?? '',
    syDelta: (syOut - syIn).toString(),
    ptDelta: '0',
    ytDelta: (ytOut - ytIn).toString(),
    lpDelta: '0',
    exchangeRate: row.exchange_rate ?? '0',
    valueChange: '0',
    market: row.market ?? undefined,
    underlyingSymbol: row.underlying_symbol ?? undefined,
  };
}

interface AddLiqRow {
  block_timestamp: Date | null;
  transaction_hash: string | null;
  sy_used: string | null;
  pt_used: string | null;
  lp_out: string | null;
  exchange_rate: string | null;
  market: string | null;
  underlying_symbol: string | null;
}

function mapAddLiquidity(row: AddLiqRow): ValueEvent {
  return {
    type: 'add_liquidity',
    timestamp: row.block_timestamp?.toISOString() ?? '',
    transactionHash: row.transaction_hash ?? '',
    syDelta: `-${row.sy_used ?? '0'}`,
    ptDelta: `-${row.pt_used ?? '0'}`,
    ytDelta: '0',
    lpDelta: row.lp_out ?? '0',
    exchangeRate: row.exchange_rate ?? '0',
    valueChange: '0',
    market: row.market ?? undefined,
    underlyingSymbol: row.underlying_symbol ?? undefined,
  };
}

interface RemoveLiqRow {
  block_timestamp: Date | null;
  transaction_hash: string | null;
  sy_out: string | null;
  pt_out: string | null;
  lp_in: string | null;
  exchange_rate: string | null;
  market: string | null;
  underlying_symbol: string | null;
}

function mapRemoveLiquidity(row: RemoveLiqRow): ValueEvent {
  return {
    type: 'remove_liquidity',
    timestamp: row.block_timestamp?.toISOString() ?? '',
    transactionHash: row.transaction_hash ?? '',
    syDelta: row.sy_out ?? '0',
    ptDelta: row.pt_out ?? '0',
    ytDelta: '0',
    lpDelta: `-${row.lp_in ?? '0'}`,
    exchangeRate: row.exchange_rate ?? '0',
    valueChange: '0',
    market: row.market ?? undefined,
    underlyingSymbol: row.underlying_symbol ?? undefined,
  };
}

// ----- Query Builder -----

function createPortfolioHistoryQueries(params: QueryParams) {
  return Promise.all([
    db
      .select()
      .from(syDeposit)
      .where(buildCallerReceiverCondition(syDeposit.caller, syDeposit.receiver, params))
      .orderBy(desc(syDeposit.block_timestamp))
      .limit(params.limit),
    db
      .select()
      .from(syRedeem)
      .where(buildCallerReceiverCondition(syRedeem.caller, syRedeem.receiver, params))
      .orderBy(desc(syRedeem.block_timestamp))
      .limit(params.limit),
    db
      .select()
      .from(enrichedRouterMintPY)
      .where(
        buildSenderReceiverCondition(
          enrichedRouterMintPY.sender,
          enrichedRouterMintPY.receiver,
          params
        )
      )
      .orderBy(desc(enrichedRouterMintPY.block_timestamp))
      .limit(params.limit),
    db
      .select()
      .from(enrichedRouterRedeemPY)
      .where(
        buildSenderReceiverCondition(
          enrichedRouterRedeemPY.sender,
          enrichedRouterRedeemPY.receiver,
          params
        )
      )
      .orderBy(desc(enrichedRouterRedeemPY.block_timestamp))
      .limit(params.limit),
    db
      .select()
      .from(enrichedRouterSwap)
      .where(
        buildSenderReceiverCondition(enrichedRouterSwap.sender, enrichedRouterSwap.receiver, params)
      )
      .orderBy(desc(enrichedRouterSwap.block_timestamp))
      .limit(params.limit),
    db
      .select()
      .from(enrichedRouterSwapYT)
      .where(
        buildSenderReceiverCondition(
          enrichedRouterSwapYT.sender,
          enrichedRouterSwapYT.receiver,
          params
        )
      )
      .orderBy(desc(enrichedRouterSwapYT.block_timestamp))
      .limit(params.limit),
    db
      .select()
      .from(enrichedRouterAddLiquidity)
      .where(
        buildSenderReceiverCondition(
          enrichedRouterAddLiquidity.sender,
          enrichedRouterAddLiquidity.receiver,
          params
        )
      )
      .orderBy(desc(enrichedRouterAddLiquidity.block_timestamp))
      .limit(params.limit),
    db
      .select()
      .from(enrichedRouterRemoveLiquidity)
      .where(
        buildSenderReceiverCondition(
          enrichedRouterRemoveLiquidity.sender,
          enrichedRouterRemoveLiquidity.receiver,
          params
        )
      )
      .orderBy(desc(enrichedRouterRemoveLiquidity.block_timestamp))
      .limit(params.limit),
  ]);
}

// ----- Event Collection -----

function collectValueEvents(
  deposits: DepositRow[],
  syRedeems: RedeemRow[],
  mints: MintRow[],
  redeems: RedeemPYRow[],
  swaps: SwapRow[],
  ytSwaps: SwapYTRow[],
  addLiq: AddLiqRow[],
  removeLiq: RemoveLiqRow[]
): ValueEvent[] {
  const events: ValueEvent[] = [
    ...deposits.map(mapDeposit),
    ...syRedeems.map(mapWithdraw),
    ...mints.map(mapMintPY),
    ...redeems.map(mapRedeemPY),
    ...swaps.map(mapSwap),
    ...ytSwaps.map(mapSwapYT),
    ...addLiq.map(mapAddLiquidity),
    ...removeLiq.map(mapRemoveLiquidity),
  ];

  // Sort oldest first for cumulative calculation
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return events;
}

// ----- Snapshot Calculation -----

interface SnapshotResult {
  snapshots: PortfolioSnapshot[];
  totalDeposited: bigint;
  totalWithdrawn: bigint;
}

function calculateSnapshots(events: ValueEvent[]): SnapshotResult {
  const snapshots: PortfolioSnapshot[] = [];
  let cumulativeSy = 0n;
  let cumulativePt = 0n;
  let cumulativeYt = 0n;
  let cumulativeLp = 0n;
  let totalDeposited = 0n;
  let totalWithdrawn = 0n;

  for (const event of events) {
    cumulativeSy += BigInt(event.syDelta);
    cumulativePt += BigInt(event.ptDelta);
    cumulativeYt += BigInt(event.ytDelta);
    cumulativeLp += BigInt(event.lpDelta);

    const syDelta = BigInt(event.syDelta);
    if (event.type === 'deposit' && syDelta > 0n) {
      totalDeposited += syDelta;
    }
    if (event.type === 'withdraw' && syDelta < 0n) {
      totalWithdrawn += -syDelta;
    }

    // Calculate total value in SY terms (simplified valuation)
    const ptValueSy = cumulativePt;
    const ytValueSy = cumulativeYt / 10n;
    const lpValueSy = cumulativeLp * 2n;
    const totalValueSy = cumulativeSy + ptValueSy + ytValueSy + lpValueSy;

    snapshots.push({
      date: event.timestamp,
      totalValueSy: totalValueSy.toString(),
      syBalance: cumulativeSy.toString(),
      ptBalance: cumulativePt.toString(),
      ytBalance: cumulativeYt.toString(),
      lpBalance: cumulativeLp.toString(),
      realizedPnl: '0',
      unrealizedPnl: '0',
      eventCount: 1,
    });
  }

  return { snapshots, totalDeposited, totalWithdrawn };
}

// ----- Summary Builder -----

function buildSummary(
  events: ValueEvent[],
  snapshotResult: SnapshotResult
): PortfolioHistoryResponse['summary'] {
  const firstActivity = events.length > 0 ? (events[0]?.timestamp ?? null) : null;
  const lastActivity = events.length > 0 ? (events[events.length - 1]?.timestamp ?? null) : null;

  return {
    totalDeposited: snapshotResult.totalDeposited.toString(),
    totalWithdrawn: snapshotResult.totalWithdrawn.toString(),
    realizedPnl: '0',
    firstActivity,
    lastActivity,
    eventCount: events.length,
  };
}

/**
 * GET /api/users/[address]/portfolio-history
 * Get portfolio value history for a user
 *
 * Query params:
 * - days: number - how many days of history (default 90)
 * - limit: number - max events (default 500)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<PortfolioHistoryResponse>> {
  const rateLimitResult = await applyRateLimit(request, 'USER');
  if (rateLimitResult) return rateLimitResult as NextResponse<PortfolioHistoryResponse>;

  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(Number.parseInt(searchParams.get('limit') ?? '500', 10), 1000);

  try {
    const queryParams: QueryParams = {
      normalizedAddress: normalizeAddressForDb(address),
      lowerAddress: address.toLowerCase(),
      limit,
    };

    const [deposits, syRedeems, mints, redeems, swaps, ytSwaps, addLiq, removeLiq] =
      await createPortfolioHistoryQueries(queryParams);

    const events = collectValueEvents(
      deposits,
      syRedeems,
      mints,
      redeems,
      swaps,
      ytSwaps,
      addLiq,
      removeLiq
    );
    const snapshotResult = calculateSnapshots(events);

    // Reverse events for response (most recent first)
    const reversedEvents = [...events].reverse();

    return NextResponse.json({
      address,
      events: reversedEvents.slice(0, limit),
      snapshots: snapshotResult.snapshots,
      summary: buildSummary(events, snapshotResult),
    });
  } catch (error) {
    logError(error, { module: 'users/portfolio-history', address });
    return NextResponse.json(createEmptyResponse(address), { status: 500 });
  }
}
