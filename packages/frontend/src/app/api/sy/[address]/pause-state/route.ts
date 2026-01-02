import { db, syCurrentPauseState } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { or, sql } from 'drizzle-orm';
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

interface PauseStateResponse {
  sy: string;
  isPaused: boolean;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
}

/**
 * GET /api/sy/[address]/pause-state
 * Returns current pause state for an SY contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<PauseStateResponse | { error: string }>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult)
    return rateLimitResult as NextResponse<PauseStateResponse | { error: string }>;

  const { address } = await params;

  try {
    const normalizedAddress = normalizeAddressForDb(address);

    // Query the current pause state view
    const [current] = await db
      .select()
      .from(syCurrentPauseState)
      .where(
        or(
          sql`LOWER(${syCurrentPauseState.sy}) = ${normalizedAddress}`,
          sql`LOWER(${syCurrentPauseState.sy}) = ${address.toLowerCase()}`
        )
      )
      .limit(1);

    if (!current) {
      // No pause state recorded means the contract has never been paused/unpaused
      // Default to not paused
      return NextResponse.json({
        sy: address,
        isPaused: false,
        lastUpdatedAt: null,
        lastUpdatedBy: null,
      });
    }

    return NextResponse.json({
      sy: current.sy ?? address,
      isPaused: current.is_paused ?? false,
      lastUpdatedAt: current.last_updated_at?.toISOString() ?? null,
      lastUpdatedBy: current.last_updated_by ?? null,
    });
  } catch (error) {
    logError(error, { module: 'sy/pause-state', syAddress: address });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
