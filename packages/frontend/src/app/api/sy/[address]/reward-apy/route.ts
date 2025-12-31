import { or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db, syRewardApy } from '@shared/server/db';
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

interface RewardApyData {
  rewardToken: string;
  rewardsLast7Days: string;
  avgTotalSupply: string;
  updateCount: number;
  /** Annualized APY as a decimal string (e.g., "0.05" for 5%) */
  estimatedApy: string;
}

interface RewardApyResponse {
  sy: string;
  rewardTokens: RewardApyData[];
}

/**
 * Calculate estimated APY from 7-day reward data.
 * APY = (rewardsLast7Days / avgTotalSupply) * (365 / 7)
 *
 * Returns "0" if totalSupply is 0 or insufficient data.
 */
function calculateEstimatedApy(rewardsLast7Days: string, avgTotalSupply: string): string {
  const rewards = BigInt(rewardsLast7Days);
  const supply = BigInt(avgTotalSupply);

  if (supply === 0n || rewards === 0n) {
    return '0';
  }

  // Calculate APY with WAD precision (10^18)
  // APY = (rewards / supply) * (365 / 7)
  // We use fixed-point math: (rewards * 365 * 10^18) / (supply * 7)
  const WAD = 10n ** 18n;
  const annualizedRewards = (rewards * 365n * WAD) / (supply * 7n);

  // Convert to decimal string (divide by WAD)
  const wholePart = annualizedRewards / WAD;
  const fractionalPart = annualizedRewards % WAD;
  const fractionalStr = fractionalPart.toString().padStart(18, '0');

  return `${wholePart.toString()}.${fractionalStr}`;
}

/**
 * GET /api/sy/[address]/reward-apy
 * Returns reward APY calculation for an SY contract
 *
 * Uses the 7-day rolling window from sy_reward_apy view
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<RewardApyResponse | { error: string }>> {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'PUBLIC');
  if (rateLimitResult)
    return rateLimitResult as NextResponse<RewardApyResponse | { error: string }>;

  const { address } = await params;

  try {
    const normalizedAddress = normalizeAddressForDb(address);

    // Get APY data from the view
    const apyData = await db
      .select()
      .from(syRewardApy)
      .where(
        or(
          sql`LOWER(${syRewardApy.sy}) = ${normalizedAddress}`,
          sql`LOWER(${syRewardApy.sy}) = ${address.toLowerCase()}`
        )
      );

    return NextResponse.json({
      sy: address,
      rewardTokens: apyData.map((data) => ({
        rewardToken: data.reward_token ?? '',
        rewardsLast7Days: data.rewards_last_7_days ?? '0',
        avgTotalSupply: data.avg_total_supply ?? '0',
        updateCount: data.update_count ?? 0,
        estimatedApy: calculateEstimatedApy(
          data.rewards_last_7_days ?? '0',
          data.avg_total_supply ?? '0'
        ),
      })),
    });
  } catch (error) {
    logError(error, { module: 'sy/reward-apy', syAddress: address });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
