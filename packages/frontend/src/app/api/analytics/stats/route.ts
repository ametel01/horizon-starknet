import { desc, gte } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import {
  db,
  marketCurrentState,
  protocolDailyStats,
  enrichedRouterSwap,
  enrichedRouterSwapYT,
  routerSwap,
  routerSwapYT,
  enrichedRouterMintPY,
  enrichedRouterRedeemPY,
  enrichedRouterAddLiquidity,
  enrichedRouterRemoveLiquidity,
  syDeposit,
  syRedeem,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

// Query timeout in milliseconds (10 seconds)
const QUERY_TIMEOUT_MS = 10_000;

/**
 * Wrap a promise with a timeout. Returns null if the query times out.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = QUERY_TIMEOUT_MS): Promise<T | null> {
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

interface StatsResponse {
  tvl: {
    totalSyReserve: string;
    totalPtReserve: string;
    marketCount: number;
  };
  volume24h: {
    syVolume: string;
    ptVolume: string;
    swapCount: number;
    uniqueUsers: number;
  };
  fees24h: string;
}

/**
 * GET /api/analytics/stats
 * Get combined protocol stats in a single optimized call
 */
export async function GET(_request: NextRequest): Promise<NextResponse<StatsResponse>> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // Run ALL queries in parallel with timeouts
    // Each query returns null if it times out, allowing partial results
    const [
      allMarkets,
      dailyStats,
      routerSwaps,
      ytSwaps,
      mints,
      redeems,
      addLiq,
      removeLiq,
      deposits,
      withdrawals,
    ] = await Promise.all([
      // TVL: Get market states
      withTimeout(db.select().from(marketCurrentState)),

      // Volume/Fees: Get daily stats from materialized view
      withTimeout(
        db
          .select()
          .from(protocolDailyStats)
          .where(gte(protocolDailyStats.day, oneDayAgo))
          .orderBy(desc(protocolDailyStats.day))
          .limit(2)
      ),

      // Swaps for volume calculation and unique users
      withTimeout(db.select().from(routerSwap).where(gte(routerSwap.block_timestamp, oneDayAgo))),
      withTimeout(db.select().from(routerSwapYT).where(gte(routerSwapYT.block_timestamp, oneDayAgo))),

      // Other operations for unique users count (use enriched views)
      withTimeout(
        db
          .select({ sender: enrichedRouterMintPY.sender })
          .from(enrichedRouterMintPY)
          .where(gte(enrichedRouterMintPY.block_timestamp, oneDayAgo))
      ),
      withTimeout(
        db
          .select({ sender: enrichedRouterRedeemPY.sender })
          .from(enrichedRouterRedeemPY)
          .where(gte(enrichedRouterRedeemPY.block_timestamp, oneDayAgo))
      ),
      withTimeout(
        db
          .select({ sender: enrichedRouterAddLiquidity.sender })
          .from(enrichedRouterAddLiquidity)
          .where(gte(enrichedRouterAddLiquidity.block_timestamp, oneDayAgo))
      ),
      withTimeout(
        db
          .select({ sender: enrichedRouterRemoveLiquidity.sender })
          .from(enrichedRouterRemoveLiquidity)
          .where(gte(enrichedRouterRemoveLiquidity.block_timestamp, oneDayAgo))
      ),
      withTimeout(
        db
          .select({ caller: syDeposit.caller })
          .from(syDeposit)
          .where(gte(syDeposit.block_timestamp, oneDayAgo))
      ),
      withTimeout(
        db
          .select({ caller: syRedeem.caller })
          .from(syRedeem)
          .where(gte(syRedeem.block_timestamp, oneDayAgo))
      ),
    ]);

    // Calculate TVL from market states (handle null for timed out queries)
    let totalSyReserve = 0n;
    let totalPtReserve = 0n;
    const marketsData = allMarkets ?? [];

    for (const market of marketsData) {
      totalSyReserve += BigInt(market.sy_reserve ?? '0');
      totalPtReserve += BigInt(market.pt_reserve ?? '0');
    }

    // If no reserves in view, try enriched_router_swap
    if (totalSyReserve === 0n && totalPtReserve === 0n) {
      const latestSwaps = await withTimeout(
        db
          .select({
            market: enrichedRouterSwap.market,
            syReserve: enrichedRouterSwap.sy_reserve_after,
            ptReserve: enrichedRouterSwap.pt_reserve_after,
            blockNumber: enrichedRouterSwap.block_number,
          })
          .from(enrichedRouterSwap)
          .orderBy(desc(enrichedRouterSwap.block_number))
          .limit(100)
      );

      if (latestSwaps) {
        const marketReserves = new Map<string, { sy: bigint; pt: bigint }>();
        for (const swap of latestSwaps) {
          const market = swap.market ?? '';
          if (!market || marketReserves.has(market)) continue;
          marketReserves.set(market, {
            sy: BigInt(swap.syReserve ?? '0'),
            pt: BigInt(swap.ptReserve ?? '0'),
          });
        }

        for (const reserves of marketReserves.values()) {
          totalSyReserve += reserves.sy;
          totalPtReserve += reserves.pt;
        }
      }
    }

    // Calculate volume and fees from swaps (handle null for timed out queries)
    let syVolume24h = 0n;
    let ptVolume24h = 0n;
    let swapCount24h = 0;
    let fees24h = 0n;

    // Collect ALL unique users across all operations
    const uniqueUsers = new Set<string>();

    // Use safe arrays that default to empty if query timed out
    const dailyStatsData = dailyStats ?? [];
    const routerSwapsData = routerSwaps ?? [];
    const ytSwapsData = ytSwaps ?? [];

    // Check if we have data from materialized view for volume/fees
    const hasViewData = dailyStatsData.length > 0 && dailyStatsData.some((s) => (s.swap_count ?? 0) > 0);

    if (hasViewData) {
      for (const stat of dailyStatsData) {
        syVolume24h += BigInt(stat.total_sy_volume ?? '0');
        ptVolume24h += BigInt(stat.total_pt_volume ?? '0');
        swapCount24h += stat.swap_count ?? 0;
        fees24h += BigInt(stat.total_fees ?? '0');
      }
    } else {
      // Use router swap data directly for volume
      for (const swap of routerSwapsData) {
        syVolume24h += BigInt(swap.sy_in) + BigInt(swap.sy_out);
        ptVolume24h += BigInt(swap.pt_in) + BigInt(swap.pt_out);
        swapCount24h++;
      }

      for (const swap of ytSwapsData) {
        syVolume24h += BigInt(swap.sy_in) + BigInt(swap.sy_out);
        swapCount24h++;
      }

      // Try to get fees from enriched views (both PT swaps and YT swaps)
      const [enrichedSwaps, enrichedYtSwaps] = await Promise.all([
        db
          .select({ fee: enrichedRouterSwap.fee })
          .from(enrichedRouterSwap)
          .where(gte(enrichedRouterSwap.block_timestamp, oneDayAgo)),
        db
          .select({ fee: enrichedRouterSwapYT.fee })
          .from(enrichedRouterSwapYT)
          .where(gte(enrichedRouterSwapYT.block_timestamp, oneDayAgo)),
      ]);

      if (enrichedSwaps) {
        for (const swap of enrichedSwaps) {
          fees24h += BigInt(swap.fee ?? '0');
        }
      }
      for (const swap of enrichedYtSwaps) {
        fees24h += BigInt(swap.fee ?? '0');
      }
    }

    // Count unique users from ALL operations (not just swaps)
    // Handle null for timed out queries by defaulting to empty arrays
    const mintsData = mints ?? [];
    const redeemsData = redeems ?? [];
    const addLiqData = addLiq ?? [];
    const removeLiqData = removeLiq ?? [];
    const depositsData = deposits ?? [];
    const withdrawalsData = withdrawals ?? [];

    for (const swap of routerSwapsData) {
      uniqueUsers.add(swap.sender.toLowerCase());
    }
    for (const swap of ytSwapsData) {
      uniqueUsers.add(swap.sender.toLowerCase());
    }
    for (const mint of mintsData) {
      if (mint.sender) uniqueUsers.add(mint.sender.toLowerCase());
    }
    for (const redeem of redeemsData) {
      if (redeem.sender) uniqueUsers.add(redeem.sender.toLowerCase());
    }
    for (const add of addLiqData) {
      if (add.sender) uniqueUsers.add(add.sender.toLowerCase());
    }
    for (const remove of removeLiqData) {
      if (remove.sender) uniqueUsers.add(remove.sender.toLowerCase());
    }
    for (const deposit of depositsData) {
      uniqueUsers.add(deposit.caller.toLowerCase());
    }
    for (const withdrawal of withdrawalsData) {
      uniqueUsers.add(withdrawal.caller.toLowerCase());
    }

    return NextResponse.json({
      tvl: {
        totalSyReserve: totalSyReserve.toString(),
        totalPtReserve: totalPtReserve.toString(),
        marketCount: marketsData.length,
      },
      volume24h: {
        syVolume: syVolume24h.toString(),
        ptVolume: ptVolume24h.toString(),
        swapCount: swapCount24h,
        uniqueUsers: uniqueUsers.size,
      },
      fees24h: fees24h.toString(),
    });
  } catch (error) {
    console.error('[analytics/stats] Error fetching stats:', error);
    return NextResponse.json(
      {
        tvl: { totalSyReserve: '0', totalPtReserve: '0', marketCount: 0 },
        volume24h: { syVolume: '0', ptVolume: '0', swapCount: 0, uniqueUsers: 0 },
        fees24h: '0',
      },
      { status: 500 }
    );
  }
}
