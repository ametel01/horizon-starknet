import { db, syRewardStats } from '@shared/server/db';
import { logError } from '@shared/server/logger';
import { applyRateLimit } from '@shared/server/rate-limit';
import { or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Normalize a Starknet address for database comparison.
 */
function normalizeAddressForDb(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  const padded = hex.padStart(64, '0');
  return `0x${padded}`;
}

interface RewardApyData {
  rewardToken: string;
  rewardsLast7Days: string;
  avgTotalSupply: string;
  updateCount: number;
  /**
   * Raw annualized reward ratio: (rewards / supply) * (365/7)
   *
   * WARNING: This is NOT a true APY! It divides reward tokens by SY tokens
   * without price conversion. To get actual APY, consumers must:
   * 1. Get reward token price and decimals
   * 2. Get SY token price and decimals
   * 3. Compute: (rewardValue_USD / supplyValue_USD) * (365/7)
   *
   * This field is provided for consumers who have access to price data.
   * Without price adjustment, this value can be off by orders of magnitude.
   */
  rawRewardRatio: string;
}

interface RewardApyResponse {
  sy: string;
  rewardTokens: RewardApyData[];
}

/**
 * Calculate raw annualized reward ratio from 7-day data.
 * Ratio = (rewardsLast7Days / avgTotalSupply) * (365 / 7)
 *
 * NOTE: This is NOT a true APY - it divides different token types without
 * price/decimal adjustment. See RewardApyData.rawRewardRatio for details.
 *
 * Returns "0" if totalSupply is 0 or insufficient data.
 */
function calculateRawRewardRatio(rewardsLast7Days: string, avgTotalSupply: string): string {
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
 * Returns reward stats and raw ratio for an SY contract
 *
 * Uses the 7-day rolling window from sy_reward_stats view.
 * Note: rawRewardRatio requires price data to convert to true APY.
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

    // Get stats data from the view (we compute APY from this)
    const apyData = await db
      .select()
      .from(syRewardStats)
      .where(
        or(
          sql`LOWER(${syRewardStats.sy}) = ${normalizedAddress}`,
          sql`LOWER(${syRewardStats.sy}) = ${address.toLowerCase()}`
        )
      );

    return NextResponse.json({
      sy: address,
      rewardTokens: apyData.map((data) => ({
        rewardToken: data.reward_token ?? '',
        rewardsLast7Days: data.rewards_last_7_days ?? '0',
        avgTotalSupply: data.avg_total_supply ?? '0',
        updateCount: data.update_count ?? 0,
        rawRewardRatio: calculateRawRewardRatio(
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
