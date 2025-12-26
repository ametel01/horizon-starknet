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
 * } from '@shared/api';
 * ```
 */

// API client
export { api, ApiError } from '@shared/api';

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
  PortfolioValueEvent,
  PortfolioSnapshot,
  PortfolioHistoryResponse,
  // Analytics
  ProtocolTvlResponse,
  VolumeResponse,
  FeesResponse,
  MarketFeeBreakdown,
  FeeCollection,
} from '@shared/api/types';

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
  usePortfolioHistory,
} from './useUserData';

// Analytics hooks
export {
  useProtocolTvl,
  useProtocolVolume,
  useProtocolFees,
  useProtocolStats,
} from './useProtocolAnalytics';
