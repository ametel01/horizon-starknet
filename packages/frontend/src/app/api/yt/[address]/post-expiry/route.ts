import { desc, or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db, ytPostExpiryDataSet } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';

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

interface PostExpiryData {
  id: string;
  yt: string;
  pt: string;
  sy: string;
  expiry: number;
  firstPyIndex: string;
  exchangeRateAtInit: string;
  totalPtSupply: string;
  totalYtSupply: string;
  blockNumber: number;
  blockTimestamp: string;
  transactionHash: string;
}

interface PostExpiryResponse {
  ytAddress: string;
  isPostExpiry: boolean;
  data: PostExpiryData | null;
}

/**
 * GET /api/yt/[address]/post-expiry
 * Get post-expiry data for a YT contract
 *
 * Returns the PostExpiryDataSet event if the YT has entered post-expiry state.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<PostExpiryResponse>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult) return rateLimitResult as NextResponse<PostExpiryResponse>;

  const { address } = await params;

  try {
    const normalizedAddress = normalizeAddressForDb(address);

    // Build address match condition
    const addressMatch = or(
      sql`LOWER(${ytPostExpiryDataSet.yt}) = ${normalizedAddress}`,
      sql`LOWER(${ytPostExpiryDataSet.yt}) = ${address.toLowerCase()}`
    );

    // Get post-expiry data (there should be at most one per YT)
    const rows = await db
      .select()
      .from(ytPostExpiryDataSet)
      .where(addressMatch)
      .orderBy(desc(ytPostExpiryDataSet.block_timestamp))
      .limit(1);

    const row = rows[0];
    const data: PostExpiryData | null = row
      ? {
          id: row._id,
          yt: row.yt,
          pt: row.pt,
          sy: row.sy,
          expiry: row.expiry,
          firstPyIndex: row.first_py_index,
          exchangeRateAtInit: row.exchange_rate_at_init,
          totalPtSupply: row.total_pt_supply,
          totalYtSupply: row.total_yt_supply,
          blockNumber: row.block_number,
          blockTimestamp: row.block_timestamp.toISOString(),
          transactionHash: row.transaction_hash,
        }
      : null;

    return NextResponse.json({
      ytAddress: address,
      isPostExpiry: data !== null,
      data,
    });
  } catch (error) {
    logError(error, { module: 'yt/post-expiry', address });
    return NextResponse.json(
      {
        ytAddress: address,
        isPostExpiry: false,
        data: null,
      },
      { status: 500 }
    );
  }
}
