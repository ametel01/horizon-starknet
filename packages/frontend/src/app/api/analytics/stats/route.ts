import { desc, gte } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import {
  db,
  marketCurrentState,
  protocolDailyStats,
  enrichedRouterSwap,
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
    // Run ALL queries in parallel
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
      db.select().from(marketCurrentState),

      // Volume/Fees: Get daily stats from materialized view
      db
        .select()
        .from(protocolDailyStats)
        .where(gte(protocolDailyStats.day, oneDayAgo))
        .orderBy(desc(protocolDailyStats.day))
        .limit(2),

      // Swaps for volume calculation and unique users
      db.select().from(routerSwap).where(gte(routerSwap.block_timestamp, oneDayAgo)),
      db.select().from(routerSwapYT).where(gte(routerSwapYT.block_timestamp, oneDayAgo)),

      // Other operations for unique users count (use enriched views)
      db
        .select({ sender: enrichedRouterMintPY.sender })
        .from(enrichedRouterMintPY)
        .where(gte(enrichedRouterMintPY.block_timestamp, oneDayAgo)),
      db
        .select({ sender: enrichedRouterRedeemPY.sender })
        .from(enrichedRouterRedeemPY)
        .where(gte(enrichedRouterRedeemPY.block_timestamp, oneDayAgo)),
      db
        .select({ sender: enrichedRouterAddLiquidity.sender })
        .from(enrichedRouterAddLiquidity)
        .where(gte(enrichedRouterAddLiquidity.block_timestamp, oneDayAgo)),
      db
        .select({ sender: enrichedRouterRemoveLiquidity.sender })
        .from(enrichedRouterRemoveLiquidity)
        .where(gte(enrichedRouterRemoveLiquidity.block_timestamp, oneDayAgo)),
      db
        .select({ caller: syDeposit.caller })
        .from(syDeposit)
        .where(gte(syDeposit.block_timestamp, oneDayAgo)),
      db
        .select({ caller: syRedeem.caller })
        .from(syRedeem)
        .where(gte(syRedeem.block_timestamp, oneDayAgo)),
    ]);

    // Calculate TVL from market states
    let totalSyReserve = 0n;
    let totalPtReserve = 0n;

    for (const market of allMarkets) {
      totalSyReserve += BigInt(market.sy_reserve ?? '0');
      totalPtReserve += BigInt(market.pt_reserve ?? '0');
    }

    // If no reserves in view, try enriched_router_swap
    if (totalSyReserve === 0n && totalPtReserve === 0n) {
      const latestSwaps = await db
        .select({
          market: enrichedRouterSwap.market,
          syReserve: enrichedRouterSwap.sy_reserve_after,
          ptReserve: enrichedRouterSwap.pt_reserve_after,
          blockNumber: enrichedRouterSwap.block_number,
        })
        .from(enrichedRouterSwap)
        .orderBy(desc(enrichedRouterSwap.block_number))
        .limit(100);

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

    // Calculate volume and fees from swaps
    let syVolume24h = 0n;
    let ptVolume24h = 0n;
    let swapCount24h = 0;
    let fees24h = 0n;

    // Collect ALL unique users across all operations
    const uniqueUsers = new Set<string>();

    // Check if we have data from materialized view for volume/fees
    const hasViewData = dailyStats.length > 0 && dailyStats.some((s) => (s.swap_count ?? 0) > 0);

    if (hasViewData) {
      for (const stat of dailyStats) {
        syVolume24h += BigInt(stat.total_sy_volume ?? '0');
        ptVolume24h += BigInt(stat.total_pt_volume ?? '0');
        swapCount24h += stat.swap_count ?? 0;
        fees24h += BigInt(stat.total_fees ?? '0');
      }
    } else {
      // Use router swap data directly for volume
      for (const swap of routerSwaps) {
        syVolume24h += BigInt(swap.sy_in) + BigInt(swap.sy_out);
        ptVolume24h += BigInt(swap.pt_in) + BigInt(swap.pt_out);
        swapCount24h++;
      }

      for (const swap of ytSwaps) {
        syVolume24h += BigInt(swap.sy_in) + BigInt(swap.sy_out);
        swapCount24h++;
      }

      // Try to get fees from enriched view
      const enrichedSwaps = await db
        .select({ fee: enrichedRouterSwap.fee })
        .from(enrichedRouterSwap)
        .where(gte(enrichedRouterSwap.block_timestamp, oneDayAgo));

      for (const swap of enrichedSwaps) {
        fees24h += BigInt(swap.fee ?? '0');
      }
    }

    // Count unique users from ALL operations (not just swaps)
    for (const swap of routerSwaps) {
      uniqueUsers.add(swap.sender.toLowerCase());
    }
    for (const swap of ytSwaps) {
      uniqueUsers.add(swap.sender.toLowerCase());
    }
    for (const mint of mints) {
      if (mint.sender) uniqueUsers.add(mint.sender.toLowerCase());
    }
    for (const redeem of redeems) {
      if (redeem.sender) uniqueUsers.add(redeem.sender.toLowerCase());
    }
    for (const add of addLiq) {
      if (add.sender) uniqueUsers.add(add.sender.toLowerCase());
    }
    for (const remove of removeLiq) {
      if (remove.sender) uniqueUsers.add(remove.sender.toLowerCase());
    }
    for (const deposit of deposits) {
      uniqueUsers.add(deposit.caller.toLowerCase());
    }
    for (const withdrawal of withdrawals) {
      uniqueUsers.add(withdrawal.caller.toLowerCase());
    }

    return NextResponse.json({
      tvl: {
        totalSyReserve: totalSyReserve.toString(),
        totalPtReserve: totalPtReserve.toString(),
        marketCount: allMarkets.length,
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
