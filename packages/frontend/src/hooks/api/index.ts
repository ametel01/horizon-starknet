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

// Re-export from features for backwards compatibility
export { useIndexerHealth } from '@features/analytics';
export {
  useIndexedMarkets,
  useIndexedMarket,
  useMarketSwaps,
  useMarketTvlHistory,
  useMarketRateHistory,
} from '@features/markets';
export {
  useUserHistory,
  useUserIndexedPositions,
  useUserYield,
  useUserPositionsByAddress,
  usePortfolioHistory,
} from '@features/portfolio';
export {
  useProtocolTvl,
  useProtocolVolume,
  useProtocolFees,
  useProtocolStats,
} from '@features/analytics';
