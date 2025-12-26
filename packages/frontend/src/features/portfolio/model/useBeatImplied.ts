'use client';

import { useQuery } from '@tanstack/react-query';

import { useAccount } from '@features/wallet';

/**
 * Beat Implied data types
 * These mirror the API response from /api/portfolio/[address]/beat-implied
 */

export interface BeatImpliedPosition {
  yt: string;
  pt: string;
  sy: string;
  underlyingSymbol: string;
  expiry: number;
  isExpired: boolean;
  entryDate: string;
  entryImpliedApy: number;
  entryPtPrice: number;
  holdingDays: number;
  currentImpliedApy: number;
  currentPtPrice: number;
  realizedApy: number;
  beatImplied: number;
  beatCurrent: number;
  performanceRating: 'excellent' | 'good' | 'neutral' | 'poor';
  ptBalance: string;
}

export interface BeatImpliedSummary {
  totalPositions: number;
  avgBeatImplied: number;
  avgRealizedApy: number;
  avgEntryApy: number;
  positionsBeating: number;
  positionsLagging: number;
  overallScore: 'excellent' | 'good' | 'neutral' | 'poor';
}

export interface BeatImpliedResponse {
  address: string;
  positions: BeatImpliedPosition[];
  summary: BeatImpliedSummary;
}

interface UseBeatImpliedOptions {
  /** Refetch interval in ms (default: 60000) */
  refetchInterval?: number;
}

interface UseBeatImpliedReturn {
  positions: BeatImpliedPosition[];
  summary: BeatImpliedSummary;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

/**
 * Hook to fetch "Beat Implied" score for the connected wallet
 *
 * Compares the user's realized returns against the implied APY
 * at the time they entered each position. A positive "beat implied"
 * score means the position has outperformed the market's expectation.
 */
export function useBeatImplied(options: UseBeatImpliedOptions = {}): UseBeatImpliedReturn {
  const { address } = useAccount();
  const { refetchInterval = 60000 } = options;

  const query = useQuery({
    queryKey: ['beat-implied', address],
    queryFn: async (): Promise<BeatImpliedResponse> => {
      if (!address) {
        throw new Error('No wallet connected');
      }

      const response = await fetch(`/api/portfolio/${address}/beat-implied`);

      if (!response.ok) {
        throw new Error(`Failed to fetch beat implied data: ${response.statusText}`);
      }

      return response.json() as Promise<BeatImpliedResponse>;
    },
    enabled: !!address,
    refetchInterval,
    staleTime: 30000,
  });

  return {
    positions: query.data?.positions ?? [],
    summary: query.data?.summary ?? {
      totalPositions: 0,
      avgBeatImplied: 0,
      avgRealizedApy: 0,
      avgEntryApy: 0,
      positionsBeating: 0,
      positionsLagging: 0,
      overallScore: 'neutral' as const,
    },
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Get score color class based on performance rating
 */
export function getScoreColor(score: 'excellent' | 'good' | 'neutral' | 'poor'): string {
  switch (score) {
    case 'excellent':
      return 'text-primary';
    case 'good':
      return 'text-chart-2';
    case 'neutral':
      return 'text-muted-foreground';
    case 'poor':
      return 'text-destructive';
  }
}

/**
 * Get background color class based on performance rating
 */
export function getScoreBgColor(score: 'excellent' | 'good' | 'neutral' | 'poor'): string {
  switch (score) {
    case 'excellent':
      return 'bg-primary/10';
    case 'good':
      return 'bg-chart-2/10';
    case 'neutral':
      return 'bg-muted';
    case 'poor':
      return 'bg-destructive/10';
  }
}
