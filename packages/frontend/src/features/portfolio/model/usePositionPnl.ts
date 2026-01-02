'use client';

import { useAccount } from '@features/wallet';
import { useQuery } from '@tanstack/react-query';

/**
 * P&L timeline data types
 * These mirror the API response from /api/portfolio/[address]/pnl-timeline
 */

export interface MintRedeemEvent {
  type: 'mint' | 'redeem';
  timestamp: string;
  yt: string;
  sy: string;
  pt: string;
  syAmount: string;
  ptAmount: string;
  ytAmount: string;
  pyIndex: string;
  exchangeRate: string;
  transactionHash: string;
}

export interface YieldClaimEvent {
  timestamp: string;
  yt: string;
  sy: string;
  amountSy: string;
  ytBalance: string;
  pyIndexAtClaim: string;
  transactionHash: string;
}

export interface PositionPnlSummary {
  yt: string;
  pt: string;
  sy: string;
  underlyingSymbol: string;
  expiry: number;
  isExpired: boolean;
  currentPtBalance: string;
  currentYtBalance: string;
  totalPtMinted: string;
  totalPtRedeemed: string;
  avgEntryPyIndex: string;
  firstMintDate: string | null;
  currentImpliedRate: string | null;
  currentPtPrice: number | null;
  entryPtPrice: number | null;
  unrealizedPnlSy: string;
  unrealizedPnlPercent: number;
  totalYieldClaimed: string;
  yieldClaimCount: number;
}

export interface TimelineDataPoint {
  date: string;
  cumulativeYieldSy: string;
  ptBalance: string;
  ytBalance: string;
  eventType: 'mint' | 'redeem' | 'claim' | null;
}

export interface PnlTimelineResponse {
  address: string;
  positions: PositionPnlSummary[];
  mintRedeemHistory: MintRedeemEvent[];
  yieldClaimHistory: YieldClaimEvent[];
  timeline: TimelineDataPoint[];
  summary: {
    totalPositions: number;
    totalUnrealizedPnlSy: string;
    totalYieldClaimedSy: string;
    overallPnlPercent: number;
  };
}

interface UsePositionPnlOptions {
  /** Number of days of history to fetch (default: 90) */
  days?: number;
  /** Refetch interval in ms (default: 60000) */
  refetchInterval?: number;
}

interface UsePositionPnlReturn {
  positions: PositionPnlSummary[];
  mintRedeemHistory: MintRedeemEvent[];
  yieldClaimHistory: YieldClaimEvent[];
  timeline: TimelineDataPoint[];
  summary: {
    totalPositions: number;
    totalUnrealizedPnlSy: string;
    totalYieldClaimedSy: string;
    overallPnlPercent: number;
  };
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

/**
 * Hook to fetch P&L timeline data for the connected wallet
 *
 * Returns position-level P&L metrics including:
 * - Entry vs current price comparison
 * - Unrealized P&L in SY terms
 * - Yield claim history
 * - Timeline of balance changes
 */
export function usePositionPnl(options: UsePositionPnlOptions = {}): UsePositionPnlReturn {
  const { address } = useAccount();
  const { days = 90, refetchInterval = 60000 } = options;

  const query = useQuery({
    queryKey: ['position-pnl', address, days],
    queryFn: async (): Promise<PnlTimelineResponse> => {
      if (!address) {
        throw new Error('No wallet connected');
      }

      const response = await fetch(`/api/portfolio/${address}/pnl-timeline?days=${String(days)}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch P&L timeline: ${response.statusText}`);
      }

      return response.json() as Promise<PnlTimelineResponse>;
    },
    enabled: !!address,
    refetchInterval,
    staleTime: 30000,
  });

  return {
    positions: query.data?.positions ?? [],
    mintRedeemHistory: query.data?.mintRedeemHistory ?? [],
    yieldClaimHistory: query.data?.yieldClaimHistory ?? [],
    timeline: query.data?.timeline ?? [],
    summary: query.data?.summary ?? {
      totalPositions: 0,
      totalUnrealizedPnlSy: '0',
      totalYieldClaimedSy: '0',
      overallPnlPercent: 0,
    },
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

interface UsePositionPnlByYtReturn {
  position: PositionPnlSummary | undefined;
  yieldHistory: YieldClaimEvent[];
  mintRedeemHistory: MintRedeemEvent[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Hook to get P&L data for a specific position (by YT address)
 */
export function usePositionPnlByYt(
  ytAddress: string | undefined,
  options: UsePositionPnlOptions = {}
): UsePositionPnlByYtReturn {
  const pnlData = usePositionPnl(options);

  const position = pnlData.positions.find((p) => p.yt.toLowerCase() === ytAddress?.toLowerCase());

  const yieldHistory = pnlData.yieldClaimHistory.filter(
    (e) => e.yt.toLowerCase() === ytAddress?.toLowerCase()
  );

  const mintRedeemHistory = pnlData.mintRedeemHistory.filter(
    (e) => e.yt.toLowerCase() === ytAddress?.toLowerCase()
  );

  return {
    position,
    yieldHistory,
    mintRedeemHistory,
    isLoading: pnlData.isLoading,
    isError: pnlData.isError,
  };
}
