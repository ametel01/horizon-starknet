import { desc, or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db, syNegativeYieldDetected, negativeYieldAlerts } from '@shared/server/db';
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

interface NegativeYieldEvent {
  id: string;
  sy: string;
  underlying: string;
  watermarkRate: string;
  currentRate: string;
  rateDropBps: string;
  eventTimestamp: number;
  blockTimestamp: string;
  transactionHash: string;
}

interface NegativeYieldSummary {
  sy: string;
  underlying: string;
  eventCount: number;
  maxDropBps: string;
  lastDetectedAt: string | null;
}

interface NegativeYieldResponse {
  sy: string;
  summary: NegativeYieldSummary | null;
  events: NegativeYieldEvent[];
}

/**
 * GET /api/sy/[address]/negative-yield
 * Returns negative yield events and summary for an SY contract
 *
 * Query params:
 * - limit: number - max events to return (default: 10, max: 50)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<NegativeYieldResponse | { error: string }>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult)
    return rateLimitResult as NextResponse<NegativeYieldResponse | { error: string }>;

  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50);

  try {
    const normalizedAddress = normalizeAddressForDb(address);

    // Get the summary from the view
    const [summary] = await db
      .select()
      .from(negativeYieldAlerts)
      .where(
        or(
          sql`LOWER(${negativeYieldAlerts.sy}) = ${normalizedAddress}`,
          sql`LOWER(${negativeYieldAlerts.sy}) = ${address.toLowerCase()}`
        )
      )
      .limit(1);

    // Get recent events
    const events = await db
      .select()
      .from(syNegativeYieldDetected)
      .where(
        or(
          sql`LOWER(${syNegativeYieldDetected.sy}) = ${normalizedAddress}`,
          sql`LOWER(${syNegativeYieldDetected.sy}) = ${address.toLowerCase()}`
        )
      )
      .orderBy(desc(syNegativeYieldDetected.block_timestamp))
      .limit(limit);

    return NextResponse.json({
      sy: address,
      summary: summary
        ? {
            sy: summary.sy ?? address,
            underlying: summary.underlying ?? '',
            eventCount: summary.event_count ?? 0,
            maxDropBps: summary.max_drop_bps ?? '0',
            lastDetectedAt: summary.last_detected_at?.toISOString() ?? null,
          }
        : null,
      events: events.map((event) => ({
        id: event._id,
        sy: event.sy,
        underlying: event.underlying,
        watermarkRate: event.watermark_rate,
        currentRate: event.current_rate,
        rateDropBps: event.rate_drop_bps,
        eventTimestamp: event.event_timestamp,
        blockTimestamp: event.block_timestamp.toISOString(),
        transactionHash: event.transaction_hash,
      })),
    });
  } catch (error) {
    logError(error, { module: 'sy/negative-yield', syAddress: address });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
