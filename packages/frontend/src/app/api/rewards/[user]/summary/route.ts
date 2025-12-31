import { or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db, userRewardHistory } from '@shared/server/db';
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

interface RewardSummary {
  sy: string;
  rewardToken: string;
  totalClaimed: string;
  claimCount: number;
  lastClaimTimestamp: string | null;
}

interface RewardsSummaryResponse {
  user: string;
  totalTokensClaimed: string;
  positionCount: number;
  positions: RewardSummary[];
}

/**
 * GET /api/rewards/[user]/summary
 * Returns aggregated reward stats for a user from the materialized view
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user: string }> }
): Promise<NextResponse<RewardsSummaryResponse | { error: string }>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'USER');
  if (rateLimitResult)
    return rateLimitResult as NextResponse<RewardsSummaryResponse | { error: string }>;

  const { user } = await params;

  try {
    const normalizedAddress = normalizeAddressForDb(user);

    // Get aggregated reward stats from the view
    const positions = await db
      .select()
      .from(userRewardHistory)
      .where(
        or(
          sql`LOWER(${userRewardHistory.user}) = ${normalizedAddress}`,
          sql`LOWER(${userRewardHistory.user}) = ${user.toLowerCase()}`
        )
      );

    // Calculate total claimed across all tokens
    let totalClaimed = BigInt(0);
    for (const pos of positions) {
      totalClaimed += BigInt(pos.total_claimed ?? '0');
    }

    return NextResponse.json({
      user,
      totalTokensClaimed: totalClaimed.toString(),
      positionCount: positions.length,
      positions: positions.map((pos) => ({
        sy: pos.sy ?? '',
        rewardToken: pos.reward_token ?? '',
        totalClaimed: pos.total_claimed ?? '0',
        claimCount: pos.claim_count ?? 0,
        lastClaimTimestamp: pos.last_claim_timestamp?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    logError(error, { module: 'rewards/summary', userAddress: user });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
