'use client';

import type { MarketData } from '@entities/market';
import type { EnhancedPosition, PortfolioSummary, PositionValue } from '@entities/position';
import {
  calculateLpValue,
  calculatePositionValue,
  calculatePtPriceInSy,
  calculateUnrealizedPnl,
  calculateYtPriceInSy,
  getCostBasis,
  getTimeToExpiry,
} from '@entities/position';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from '@features/price';
import { useAccount, useStarknet } from '@features/wallet';
import { toBigInt } from '@shared/lib';
import { fromWad, WAD_BIGINT } from '@shared/math/wad';
import { getERC20Contract, getMarketContract, getYTContract } from '@shared/starknet/contracts';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ProviderInterface } from 'starknet';

/**
 * Historical yield data per YT position from the indexed API
 */
interface YieldHistoryByYt {
  /** Total yield claimed in SY (WAD) */
  totalClaimed: bigint;
  /** Number of claims */
  claimCount: number;
}

/**
 * Response from /api/users/[address]/yield
 */
interface YieldApiResponse {
  address: string;
  totalYieldClaimed: string;
  claimHistory: Array<{
    id: string;
    yt: string;
    sy: string;
    expiry: number;
    amountSy: string;
    ytBalance: string;
    pyIndexAtClaim: string;
    exchangeRate: string;
    blockTimestamp: string;
    transactionHash: string;
  }>;
  summaryByPosition: Array<{
    yt: string;
    sy: string;
    totalClaimed: string;
    claimCount: number;
    lastClaim: string | null;
    currentYtBalance: string;
  }>;
}

/**
 * Fetch historical yield data from the indexed API
 */
async function fetchYieldHistory(userAddress: string): Promise<Map<string, YieldHistoryByYt>> {
  const map = new Map<string, YieldHistoryByYt>();

  // Basic validation - address should be a hex string
  if (!userAddress || !/^0x[0-9a-fA-F]+$/.test(userAddress)) {
    return map;
  }

  try {
    const response = await fetch(`/api/users/${encodeURIComponent(userAddress)}/yield`);
    if (!response.ok) {
      // Return empty map on error - historical data is non-critical
      return map;
    }

    const data = (await response.json()) as YieldApiResponse;

    // Build map from YT address to historical yield data
    for (const position of data.summaryByPosition) {
      const ytAddress = position.yt.toLowerCase();
      map.set(ytAddress, {
        totalClaimed: BigInt(position.totalClaimed),
        claimCount: position.claimCount,
      });
    }
  } catch {
    // Historical data is supplementary - errors are non-critical
  }

  return map;
}

/**
 * Fetch position data for a single market
 */
async function fetchMarketPositionData(
  market: MarketData,
  userAddress: string,
  provider: ProviderInterface,
  prices: Map<string, number>,
  yieldHistory: Map<string, YieldHistoryByYt>
): Promise<EnhancedPosition> {
  const syContract = getERC20Contract(market.syAddress, provider);
  const ptContract = getERC20Contract(market.ptAddress, provider);
  const ytContract = getYTContract(market.ytAddress, provider);
  const marketContract = getMarketContract(market.address, provider);

  // Fetch all balances in parallel with error handling for graceful degradation
  const [syBalanceResult, ptBalanceResult, ytBalanceResult, lpBalanceResult, claimableYieldResult] =
    await Promise.all([
      syContract.balance_of(userAddress).catch(() => BigInt(0)),
      ptContract.balance_of(userAddress).catch(() => BigInt(0)),
      ytContract.balance_of(userAddress).catch(() => BigInt(0)),
      marketContract.balance_of(userAddress).catch(() => BigInt(0)),
      ytContract.get_user_interest(userAddress).catch(() => BigInt(0)),
    ]);

  const syBalance = toBigInt(syBalanceResult);
  const ptBalance = toBigInt(ptBalanceResult);
  const ytBalance = toBigInt(ytBalanceResult);
  const lpBalance = toBigInt(lpBalanceResult);
  const claimableYield = toBigInt(claimableYieldResult);

  // Get SY price in USD - use symbol mapping for mock tokens
  const priceAddr =
    getTokenAddressForPricing(market.metadata?.yieldTokenSymbol) ??
    market.metadata?.underlyingAddress;
  const syPriceUsd = getTokenPrice(priceAddr, prices);

  // Calculate token prices
  const timeToExpiry = getTimeToExpiry(market.expiry);
  const ptPriceInSy = calculatePtPriceInSy(market.state.lnImpliedRate, timeToExpiry);
  const ytPriceInSy = calculateYtPriceInSy(market.state.lnImpliedRate, timeToExpiry);

  // Calculate position values
  const syValue = calculatePositionValue(syBalance, WAD_BIGINT, syPriceUsd);
  const ptValue = calculatePositionValue(ptBalance, ptPriceInSy, syPriceUsd);
  const ytValue = calculatePositionValue(ytBalance, ytPriceInSy, syPriceUsd);

  // Calculate LP value
  const lpCalc = calculateLpValue(
    lpBalance,
    market.state.totalLpSupply,
    market.state.syReserve,
    market.state.ptReserve,
    ptPriceInSy
  );

  const lpValue: PositionValue = {
    amount: lpBalance,
    valueInSy: lpCalc.valueInSy,
    valueUsd: fromWad(lpCalc.valueInSy).toNumber() * syPriceUsd,
  };

  // Calculate P&L for PT position
  const ptCostBasis = getCostBasis(market.address, 'pt');
  const ptPnl = calculateUnrealizedPnl(ptBalance, ptPriceInSy, ptCostBasis);

  // Calculate claimable yield in USD
  const claimableUsd = fromWad(claimableYield).toNumber() * syPriceUsd;

  // Get historical yield data for this position
  const historicalYield = yieldHistory.get(market.ytAddress.toLowerCase());
  const totalClaimed = historicalYield?.totalClaimed ?? 0n;
  const claimedUsd = fromWad(totalClaimed).toNumber() * syPriceUsd;

  // Realized P&L includes claimed yield (yield is realized when claimed)
  const realizedSy = totalClaimed;
  const realizedUsd = claimedUsd;

  // Total value
  const totalValueUsd = syValue.valueUsd + ptValue.valueUsd + ytValue.valueUsd + lpValue.valueUsd;

  // Redemption options
  const hasMatchingPtYt = ptBalance > 0n && ytBalance > 0n;
  const canRedeemPtYt = hasMatchingPtYt && !market.isExpired;
  const canRedeemPtPostExpiry = ptBalance > 0n && market.isExpired;

  return {
    market,
    sy: syValue,
    pt: ptValue,
    yt: ytValue,
    lp: lpValue,
    yield: {
      claimable: claimableYield,
      claimableUsd,
      claimed: totalClaimed,
      claimedUsd,
    },
    lpDetails: {
      sharePercent: lpCalc.sharePercent,
      underlyingSy: lpCalc.underlyingSy,
      underlyingPt: lpCalc.underlyingPt,
      fees: 0n, // LP fee tracking requires separate indexer query
    },
    pnl: {
      unrealizedSy: ptPnl.pnlSy,
      unrealizedUsd: fromWad(ptPnl.pnlSy).toNumber() * syPriceUsd,
      realizedSy,
      realizedUsd,
      totalPnlPercent: ptPnl.pnlPercent,
    },
    redemption: {
      canRedeemPtYt,
      canRedeemPtPostExpiry,
      ptRedemptionValue: ptBalance, // 1:1 at maturity
    },
    totalValueUsd,
  };
}

interface UseEnhancedPositionsOptions {
  refetchInterval?: number;
}

/**
 * Hook to fetch enhanced position data with USD values and P&L
 */
export function useEnhancedPositions(
  markets: MarketData[],
  options: UseEnhancedPositionsOptions = {}
): UseQueryResult<PortfolioSummary> {
  const { provider } = useStarknet();
  const { address } = useAccount();
  const { refetchInterval = 30000 } = options;

  // Extract unique token addresses for price fetching
  const tokenAddresses = useMemo(() => {
    const addresses = new Set<string>();
    for (const market of markets) {
      const symbol = market.metadata?.yieldTokenSymbol;
      const priceAddr = getTokenAddressForPricing(symbol) ?? market.metadata?.underlyingAddress;
      if (priceAddr) addresses.add(priceAddr);
    }
    return Array.from(addresses);
  }, [markets]);

  const { data: prices } = usePrices(tokenAddresses);

  return useQuery({
    queryKey: [
      'enhanced-positions',
      address,
      markets
        .map((m) => m.address)
        .slice()
        .sort()
        .join(','),
    ],
    queryFn: async (): Promise<PortfolioSummary> => {
      if (!address || markets.length === 0 || !prices) {
        return {
          totalValueUsd: 0,
          totalPnlUsd: 0,
          totalPnlPercent: 0,
          totalClaimableUsd: 0,
          positions: [],
        };
      }

      // Fetch historical yield data from the indexed API
      const yieldHistory = await fetchYieldHistory(address);

      // Fetch all market positions in parallel
      const positions = await Promise.all(
        markets.map((market) =>
          fetchMarketPositionData(market, address, provider, prices, yieldHistory)
        )
      );

      // Filter out empty positions
      const activePositions = positions.filter(
        (p) =>
          p.sy.amount > 0n ||
          p.pt.amount > 0n ||
          p.yt.amount > 0n ||
          p.lp.amount > 0n ||
          p.yield.claimable > 0n
      );

      // Calculate totals
      const totalValueUsd = activePositions.reduce((sum, p) => sum + p.totalValueUsd, 0);
      const totalPnlUsd = activePositions.reduce(
        (sum, p) => sum + p.pnl.unrealizedUsd + p.pnl.realizedUsd,
        0
      );
      const totalClaimableUsd = activePositions.reduce((sum, p) => sum + p.yield.claimableUsd, 0);
      const totalPnlPercent = totalValueUsd > 0 ? (totalPnlUsd / totalValueUsd) * 100 : 0;

      return {
        totalValueUsd,
        totalPnlUsd,
        totalPnlPercent,
        totalClaimableUsd,
        positions: activePositions,
      };
    },
    enabled: !!address && markets.length > 0 && !!prices,
    refetchInterval,
    staleTime: 10000,
    structuralSharing: false,
  });
}

/**
 * Hook to get portfolio totals without detailed position data
 */
export function usePortfolioTotals(markets: MarketData[]): {
  totalValueUsd: number;
  totalPnlUsd: number;
  totalClaimableUsd: number;
  isLoading: boolean;
} {
  const { data, isLoading } = useEnhancedPositions(markets);

  return useMemo(
    () => ({
      totalValueUsd: data?.totalValueUsd ?? 0,
      totalPnlUsd: data?.totalPnlUsd ?? 0,
      totalClaimableUsd: data?.totalClaimableUsd ?? 0,
      isLoading,
    }),
    [data, isLoading]
  );
}
