import { getCacheHeaders } from '@shared/server/cache';
import { db, marketCurrentState } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { marketsQuerySchema, validateQuery } from '@shared/server/validations/api';
import { asc, desc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface MarketListItem {
  market: string;
  expiry: number;
  sy: string;
  pt: string;
  yt: string;
  underlying: string;
  underlyingSymbol: string;
  feeRate: string;
  syReserve: string;
  ptReserve: string;
  impliedRate: string;
  exchangeRate: string;
  isExpired: boolean;
  volume24h: string;
  fees24h: string;
  swaps24h: number;
  createdAt: string;
  lastActivity: string | null;
}

/** Database row type for market current state */
interface MarketRow {
  market: string | null;
  expiry: number | null;
  sy: string | null;
  pt: string | null;
  yt: string | null;
  underlying: string | null;
  underlying_symbol: string | null;
  fee_rate: string | null;
  sy_reserve: string | null;
  pt_reserve: string | null;
  implied_rate: string | null;
  exchange_rate: string | null;
  is_expired: boolean | null;
  sy_volume_24h: string | null;
  pt_volume_24h: string | null;
  fees_24h: string | null;
  swaps_24h: number | null;
  created_at: Date | null;
  last_activity: Date | null;
}

/**
 * Extracts core market identity fields from a database row
 */
function extractMarketIdentity(row: MarketRow) {
  return {
    market: row.market ?? '',
    expiry: row.expiry ?? 0,
    sy: row.sy ?? '',
    pt: row.pt ?? '',
    yt: row.yt ?? '',
    underlying: row.underlying ?? '',
    underlyingSymbol: row.underlying_symbol ?? '',
  };
}

/**
 * Extracts market state fields (rates, reserves) from a database row
 */
function extractMarketState(row: MarketRow) {
  return {
    feeRate: row.fee_rate ?? '0',
    syReserve: row.sy_reserve ?? '0',
    ptReserve: row.pt_reserve ?? '0',
    impliedRate: row.implied_rate ?? '0',
    exchangeRate: row.exchange_rate ?? '0',
    isExpired: row.is_expired ?? false,
  };
}

/**
 * Extracts market metrics (volume, fees, activity) from a database row
 */
function extractMarketMetrics(row: MarketRow) {
  const syVol = BigInt(row.sy_volume_24h ?? '0');
  const ptVol = BigInt(row.pt_volume_24h ?? '0');

  return {
    volume24h: (syVol + ptVol).toString(),
    fees24h: row.fees_24h ?? '0',
    swaps24h: row.swaps_24h ?? 0,
    createdAt: row.created_at?.toISOString() ?? '',
    lastActivity: row.last_activity?.toISOString() ?? null,
  };
}

/**
 * Maps a database row to a MarketListItem API response object
 */
function mapRowToMarketItem(row: MarketRow): MarketListItem {
  return {
    ...extractMarketIdentity(row),
    ...extractMarketState(row),
    ...extractMarketMetrics(row),
  };
}

/** Response type for GET /api/markets */
export interface MarketsResponse {
  markets: MarketListItem[];
  total: number;
}

/**
 * GET /api/markets
 * List all markets with current state
 *
 * Query params:
 * - active: 'true' | 'false' - filter by expiry status
 * - underlying: string - filter by underlying token address
 * - sort: 'volume' | 'tvl' | 'expiry' | 'created' - sort field
 * - order: 'asc' | 'desc' - sort order
 * - limit: number - max results (default 50, max 100)
 * - offset: number - pagination offset
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult;

  // Validate query parameters
  const params = validateQuery(request.nextUrl.searchParams, marketsQuerySchema);
  if (params instanceof NextResponse) return params;

  const { active, underlying, sort, order, limit, offset } = params;

  try {
    // Build query
    let query = db.select().from(marketCurrentState).$dynamic();

    // Apply filters
    if (active === true) {
      query = query.where(eq(marketCurrentState.is_expired, false));
    } else if (active === false) {
      query = query.where(eq(marketCurrentState.is_expired, true));
    }

    if (underlying) {
      query = query.where(eq(marketCurrentState.underlying, underlying));
    }

    // Apply sorting
    const orderFn = order === 'asc' ? asc : desc;
    switch (sort) {
      case 'volume':
        query = query.orderBy(orderFn(marketCurrentState.sy_volume_24h));
        break;
      case 'tvl':
        query = query.orderBy(orderFn(marketCurrentState.sy_reserve));
        break;
      case 'expiry':
        query = query.orderBy(orderFn(marketCurrentState.expiry));
        break;
      case 'created':
        query = query.orderBy(orderFn(marketCurrentState.created_at));
        break;
      default:
        query = query.orderBy(desc(marketCurrentState.sy_volume_24h));
    }

    // Apply pagination
    query = query.limit(limit).offset(offset);

    const results = await query;
    const markets = results.map(mapRowToMarketItem);

    return NextResponse.json(
      {
        markets,
        total: markets.length,
      },
      { headers: getCacheHeaders('SHORT') }
    );
  } catch (error) {
    logError(error, { module: 'markets' });
    return NextResponse.json({ markets: [], total: 0 }, { status: 500 });
  }
}
