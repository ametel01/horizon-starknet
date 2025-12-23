/**
 * React Query hooks for indexer API endpoints
 *
 * These hooks fetch data from the indexer database via API routes,
 * providing historical data, aggregated metrics, and analytics.
 *
 * @example
 * ```tsx
 * import {
 *   useIndexedMarkets,
 *   useUserHistory,
 *   useProtocolTvl,
 * } from '@/hooks/api';
 * ```
 */

// Shared utilities
export { ApiError, apiFetch } from './fetcher';

// Types
export type {
  // Health
  HealthResponse,
  // Markets
  IndexedMarket,
  MarketDetailResponse,
  MarketsResponse,
  SwapEvent,
  SwapsResponse,
  TvlResponse,
  RatesResponse,
  // Users
  HistoryEvent,
  HistoryResponse,
  PyPosition,
  LpPosition,
  PositionsResponse,
  YieldClaimEvent,
  YieldSummary,
  YieldResponse,
  // Analytics
  ProtocolTvlResponse,
  VolumeResponse,
  FeesResponse,
  MarketFeeBreakdown,
  FeeCollection,
} from './types';

// Health hook
export { useIndexerHealth } from './useIndexerHealth';

// Market hooks
export { useIndexedMarkets, useIndexedMarket } from './useIndexedMarkets';
export { useMarketSwaps, useMarketTvlHistory, useMarketRateHistory } from './useMarketHistory';

// User hooks
export {
  useUserHistory,
  useUserIndexedPositions,
  useUserYield,
  useUserPositionsByAddress,
} from './useUserData';

// Analytics hooks
export {
  useProtocolTvl,
  useProtocolVolume,
  useProtocolFees,
  useProtocolStats,
} from './useProtocolAnalytics';
