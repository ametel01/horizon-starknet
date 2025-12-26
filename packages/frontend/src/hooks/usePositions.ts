'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { uint256, type ProviderInterface } from 'starknet';

import type { MarketData } from '@entities/market';
import { getERC20Contract, getMarketContract, getYTContract } from '@shared/starknet/contracts';

import { useAccount } from './useAccount';
import { useStarknet } from './useStarknet';

// Helper to convert Uint256 or bigint to bigint
function toBigInt(value: bigint | { low: bigint; high: bigint }): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  // Handle Uint256 struct
  return uint256.uint256ToBN(value);
}

export interface TokenPosition {
  address: string;
  symbol: string;
  balance: bigint;
  type: 'sy' | 'pt' | 'yt' | 'lp';
}

export interface MarketPosition {
  market: MarketData;
  syBalance: bigint;
  ptBalance: bigint;
  ytBalance: bigint;
  lpBalance: bigint;
  claimableYield: bigint;
  canRedeemPtYt: boolean; // Has both PT and YT to redeem before expiry
  canRedeemPtPostExpiry: boolean; // Has PT and market is expired
  // LP position details
  lpSharePercent: number; // User's share of pool as percentage
  lpValueSy: bigint; // User's share of SY reserves
  lpValuePt: bigint; // User's share of PT reserves
}

export interface PortfolioData {
  positions: MarketPosition[];
  totalClaimableYield: bigint;
  hasClaimableYield: boolean;
  hasRedeemablePositions: boolean;
}

async function fetchMarketPosition(
  market: MarketData,
  userAddress: string,
  provider: ProviderInterface
): Promise<MarketPosition> {
  const syContract = getERC20Contract(market.syAddress, provider);
  const ptContract = getERC20Contract(market.ptAddress, provider);
  const ytContract = getYTContract(market.ytAddress, provider);
  const marketContract = getMarketContract(market.address, provider);

  // Fetch all balances in parallel using typed contract calls
  const [syBalanceResult, ptBalanceResult, ytBalanceResult, lpBalanceResult, claimableYieldResult] =
    await Promise.all([
      syContract.balance_of(userAddress),
      ptContract.balance_of(userAddress),
      ytContract.balance_of(userAddress),
      marketContract.balance_of(userAddress),
      ytContract.get_user_interest(userAddress).catch(() => BigInt(0)),
    ]);

  const syBalance = toBigInt(syBalanceResult as bigint | { low: bigint; high: bigint });
  const ptBalance = toBigInt(ptBalanceResult as bigint | { low: bigint; high: bigint });
  const ytBalance = toBigInt(ytBalanceResult as bigint | { low: bigint; high: bigint });
  const lpBalance = toBigInt(lpBalanceResult as bigint | { low: bigint; high: bigint });
  const claimableYield = toBigInt(claimableYieldResult as bigint | { low: bigint; high: bigint });

  // Determine redemption options
  const hasMatchingPtYt = ptBalance > BigInt(0) && ytBalance > BigInt(0);
  const canRedeemPtYt = hasMatchingPtYt && !market.isExpired;
  const canRedeemPtPostExpiry = ptBalance > BigInt(0) && market.isExpired;

  // Calculate LP position value
  const totalLpSupply = market.state.totalLpSupply;
  let lpSharePercent = 0;
  let lpValueSy = BigInt(0);
  let lpValuePt = BigInt(0);

  if (lpBalance > BigInt(0) && totalLpSupply > BigInt(0)) {
    // Calculate share as percentage
    lpSharePercent = Number((lpBalance * BigInt(10000)) / totalLpSupply) / 100;

    // Calculate user's share of reserves
    lpValueSy = (lpBalance * market.state.syReserve) / totalLpSupply;
    lpValuePt = (lpBalance * market.state.ptReserve) / totalLpSupply;
  }

  return {
    market,
    syBalance,
    ptBalance,
    ytBalance,
    lpBalance,
    claimableYield,
    canRedeemPtYt,
    canRedeemPtPostExpiry,
    lpSharePercent,
    lpValueSy,
    lpValuePt,
  };
}

interface UsePositionsOptions {
  refetchInterval?: number;
}

export function usePositions(
  markets: MarketData[],
  options: UsePositionsOptions = {}
): UseQueryResult<PortfolioData> {
  const { provider } = useStarknet();
  const { address } = useAccount();
  const { refetchInterval = 30000 } = options;

  return useQuery({
    queryKey: ['positions', address, markets.map((m) => m.address).join(',')],
    queryFn: async (): Promise<PortfolioData> => {
      if (!address || markets.length === 0) {
        return {
          positions: [],
          totalClaimableYield: BigInt(0),
          hasClaimableYield: false,
          hasRedeemablePositions: false,
        };
      }

      // Fetch all market positions in parallel
      const positions = await Promise.all(
        markets.map((market) => fetchMarketPosition(market, address, provider))
      );

      // Calculate totals
      const totalClaimableYield = positions.reduce(
        (sum, pos) => sum + pos.claimableYield,
        BigInt(0)
      );

      const hasClaimableYield = totalClaimableYield > BigInt(0);
      const hasRedeemablePositions = positions.some(
        (pos) => pos.canRedeemPtYt || pos.canRedeemPtPostExpiry
      );

      return {
        positions,
        totalClaimableYield,
        hasClaimableYield,
        hasRedeemablePositions,
      };
    },
    enabled: !!address && markets.length > 0,
    refetchInterval,
    staleTime: 10000,
    // Disable structural sharing to prevent BigInt serialization issues
    structuralSharing: false,
  });
}

/**
 * Hook to check if user has any positions in a specific market
 */
export function useHasPosition(market: MarketData | undefined): boolean {
  const { provider } = useStarknet();
  const { address } = useAccount();

  const { data } = useQuery({
    queryKey: ['hasPosition', address, market?.address],
    queryFn: async (): Promise<boolean> => {
      if (!address || !market) return false;

      const position = await fetchMarketPosition(market, address, provider);
      return (
        position.syBalance > BigInt(0) ||
        position.ptBalance > BigInt(0) ||
        position.ytBalance > BigInt(0) ||
        position.lpBalance > BigInt(0)
      );
    },
    enabled: !!address && !!market,
    staleTime: 30000,
  });

  return data ?? false;
}
