import { createQuery } from '@tanstack/solid-query';
import { type Accessor, createMemo } from 'solid-js';
import type { MarketData } from '@/features/markets';
import { useAccount, useStarknet } from '@/features/wallet';

import { fetchMarketPosition, type MarketPosition, type PortfolioData } from './usePositions';

/**
 * Portfolio summary with aggregate values
 */
export interface PortfolioSummary {
  /** Total number of markets with positions */
  marketCount: number;
  /** Total SY balance across all markets */
  totalSyBalance: bigint;
  /** Total PT balance across all markets */
  totalPtBalance: bigint;
  /** Total YT balance across all markets */
  totalYtBalance: bigint;
  /** Total LP balance across all markets */
  totalLpBalance: bigint;
  /** Total claimable yield across all markets */
  totalClaimableYield: bigint;
  /** Whether user has any claimable yield */
  hasClaimableYield: boolean;
  /** Whether user has any redeemable positions */
  hasRedeemablePositions: boolean;
  /** Individual market positions */
  positions: MarketPosition[];
}

/**
 * Query key factory for portfolio queries
 */
export const portfolioKeys = {
  all: ['portfolio'] as const,
  user: (address: string | null) => [...portfolioKeys.all, 'user', address] as const,
  summary: (address: string | null, marketAddresses: string[]) =>
    [...portfolioKeys.user(address), 'summary', marketAddresses.join(',')] as const,
};

interface UsePortfolioOptions {
  refetchInterval?: number;
  /** Only include positions with non-zero balances */
  activeOnly?: boolean;
}

export interface UsePortfolioReturn {
  summary: Accessor<PortfolioSummary>;
  isLoading: Accessor<boolean>;
  isError: Accessor<boolean>;
  refetch: () => void;
}

/**
 * Hook to fetch complete portfolio data for the connected user.
 * Aggregates positions across all provided markets and computes summary statistics.
 *
 * Uses @tanstack/solid-query for caching and background updates.
 *
 * @param markets - Accessor to array of markets to check for positions
 * @param options - Configuration options
 * @returns Portfolio summary with positions and aggregate values
 *
 * @example
 * ```typescript
 * const { markets } = useDashboardMarkets();
 * const { summary, isLoading } = usePortfolio(markets);
 *
 * return (
 *   <Show when={!isLoading()}>
 *     <div>Total Claimable: {formatWad(summary().totalClaimableYield)}</div>
 *     <div>Markets with positions: {summary().marketCount}</div>
 *   </Show>
 * );
 * ```
 */
export function usePortfolio(
  markets: Accessor<MarketData[]>,
  options: UsePortfolioOptions = {}
): UsePortfolioReturn {
  const { provider } = useStarknet();
  const { address } = useAccount();
  const { refetchInterval = 30000, activeOnly = true } = options;

  const query = createQuery(() => ({
    queryKey: portfolioKeys.summary(
      address(),
      markets().map((m) => m.address)
    ),
    queryFn: async (): Promise<PortfolioData> => {
      const userAddress = address();
      const marketList = markets();

      if (!userAddress || marketList.length === 0) {
        return {
          positions: [],
          totalClaimableYield: BigInt(0),
          hasClaimableYield: false,
          hasRedeemablePositions: false,
        };
      }

      // Fetch all market positions in parallel
      const positions = await Promise.all(
        marketList.map((market) => fetchMarketPosition(market, userAddress, provider))
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
    enabled: !!address() && markets().length > 0,
    refetchInterval,
    staleTime: 10000,
    structuralSharing: false,
  }));

  const summary = createMemo((): PortfolioSummary => {
    const data = query.data;

    if (!data) {
      return {
        marketCount: 0,
        totalSyBalance: BigInt(0),
        totalPtBalance: BigInt(0),
        totalYtBalance: BigInt(0),
        totalLpBalance: BigInt(0),
        totalClaimableYield: BigInt(0),
        hasClaimableYield: false,
        hasRedeemablePositions: false,
        positions: [],
      };
    }

    // Filter positions if activeOnly is set
    const filteredPositions = activeOnly
      ? data.positions.filter(
          (p) =>
            p.syBalance > BigInt(0) ||
            p.ptBalance > BigInt(0) ||
            p.ytBalance > BigInt(0) ||
            p.lpBalance > BigInt(0) ||
            p.claimableYield > BigInt(0)
        )
      : data.positions;

    // Calculate aggregate totals
    const totalSyBalance = filteredPositions.reduce((sum, p) => sum + p.syBalance, BigInt(0));
    const totalPtBalance = filteredPositions.reduce((sum, p) => sum + p.ptBalance, BigInt(0));
    const totalYtBalance = filteredPositions.reduce((sum, p) => sum + p.ytBalance, BigInt(0));
    const totalLpBalance = filteredPositions.reduce((sum, p) => sum + p.lpBalance, BigInt(0));

    return {
      marketCount: filteredPositions.length,
      totalSyBalance,
      totalPtBalance,
      totalYtBalance,
      totalLpBalance,
      totalClaimableYield: data.totalClaimableYield,
      hasClaimableYield: data.hasClaimableYield,
      hasRedeemablePositions: data.hasRedeemablePositions,
      positions: filteredPositions,
    };
  });

  return {
    summary,
    isLoading: createMemo(() => query.isLoading),
    isError: createMemo(() => query.isError),
    refetch: () => query.refetch(),
  };
}
