import { desc, or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db, syRewardsClaimed } from '@shared/server/db';
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

interface RewardClaimEvent {
  id: string;
  sy: string;
  rewardToken: string;
  amount: string;
  eventTimestamp: number;
  blockTimestamp: string;
  transactionHash: string;
}

interface RewardsResponse {
  user: string;
  totalClaims: number;
  claims: RewardClaimEvent[];
}

/**
 * GET /api/rewards/[user]
 * Returns all reward claims for a user
 *
 * Query params:
 * - limit: number - max claims to return (default: 100, max: 500)
 * - offset: number - pagination offset (default: 0)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user: string }> }
): Promise<NextResponse<RewardsResponse | { error: string }>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'USER');
  if (rateLimitResult) return rateLimitResult as NextResponse<RewardsResponse | { error: string }>;

  const { user } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  try {
    const normalizedAddress = normalizeAddressForDb(user);

    // Get reward claims for this user
    const claims = await db
      .select()
      .from(syRewardsClaimed)
      .where(
        or(
          sql`LOWER(${syRewardsClaimed.user}) = ${normalizedAddress}`,
          sql`LOWER(${syRewardsClaimed.user}) = ${user.toLowerCase()}`
        )
      )
      .orderBy(desc(syRewardsClaimed.block_timestamp))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      user,
      totalClaims: claims.length,
      claims: claims.map((claim) => ({
        id: claim._id,
        sy: claim.sy,
        rewardToken: claim.reward_token,
        amount: claim.amount,
        eventTimestamp: claim.event_timestamp,
        blockTimestamp: claim.block_timestamp.toISOString(),
        transactionHash: claim.transaction_hash,
      })),
    });
  } catch (error) {
    logError(error, { module: 'rewards/user', userAddress: user });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
