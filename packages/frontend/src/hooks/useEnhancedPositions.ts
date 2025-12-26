'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { uint256, type ProviderInterface } from 'starknet';

import { getCostBasis, calculateUnrealizedPnl } from '@/lib/position/pnl';
import {
  calculatePtPriceInSy,
  calculateYtPriceInSy,
  calculateLpValue,
  calculatePositionValue,
  getTimeToExpiry,
} from '@/lib/position/value';
import type { MarketData } from '@/types/market';
import type { EnhancedPosition, PortfolioSummary, PositionValue } from '@/types/position';
import { WAD_BIGINT, fromWad } from '@shared/math/wad';
import { getERC20Contract, getMarketContract, getYTContract } from '@shared/starknet/contracts';

import { useAccount } from './useAccount';
import { getTokenAddressForPricing, getTokenPrice, usePrices } from './usePrices';
import { useStarknet } from './useStarknet';

// Helper to convert Uint256 or bigint to bigint
function toBigInt(value: bigint | { low: bigint; high: bigint }): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  return uint256.uint256ToBN(value);
}

/**
 * Fetch position data for a single market
 */
async function fetchMarketPositionData(
  market: MarketData,
  userAddress: string,
  provider: ProviderInterface,
  prices: Map<string, number>
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

  const syBalance = toBigInt(syBalanceResult as bigint | { low: bigint; high: bigint });
  const ptBalance = toBigInt(ptBalanceResult as bigint | { low: bigint; high: bigint });
  const ytBalance = toBigInt(ytBalanceResult as bigint | { low: bigint; high: bigint });
  const lpBalance = toBigInt(lpBalanceResult as bigint | { low: bigint; high: bigint });
  const claimableYield = toBigInt(claimableYieldResult as bigint | { low: bigint; high: bigint });

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
      claimed: 0n, // TODO: Track historical claims
      claimedUsd: 0,
    },
    lpDetails: {
      sharePercent: lpCalc.sharePercent,
      underlyingSy: lpCalc.underlyingSy,
      underlyingPt: lpCalc.underlyingPt,
      fees: 0n, // TODO: Track accrued fees
    },
    pnl: {
      unrealizedSy: ptPnl.pnlSy,
      unrealizedUsd: fromWad(ptPnl.pnlSy).toNumber() * syPriceUsd,
      realizedSy: 0n, // TODO: Track realized P&L
      realizedUsd: 0,
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
    queryKey: ['enhanced-positions', address, [...markets.map((m) => m.address)].sort().join(',')],
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

      // Fetch all market positions in parallel
      const positions = await Promise.all(
        markets.map((market) => fetchMarketPositionData(market, address, provider, prices))
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
