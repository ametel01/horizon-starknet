/**
 * Re-export schema from indexer package
 *
 * This provides type-safe access to all indexed tables and views.
 * The schema is maintained in packages/indexer/src/schema/index.ts
 */

// Event tables
export {
  // Factory events
  factoryYieldContractsCreated,
  factoryClassHashesUpdated,
  // Market Factory events
  marketFactoryMarketCreated,
  marketFactoryClassHashUpdated,
  // SY events
  syDeposit,
  syRedeem,
  syOracleRateUpdated,
  // YT events
  ytMintPY,
  ytRedeemPY,
  ytRedeemPYPostExpiry,
  ytInterestClaimed,
  ytExpiryReached,
  // Market events
  marketMint,
  marketBurn,
  marketSwap,
  marketImpliedRateUpdated,
  marketFeesCollected,
  // Router events
  routerMintPY,
  routerRedeemPY,
  routerAddLiquidity,
  routerRemoveLiquidity,
  routerSwap,
  routerSwapYT,
  // Enriched router views
  enrichedRouterSwap,
  enrichedRouterSwapYT,
  enrichedRouterAddLiquidity,
  enrichedRouterRemoveLiquidity,
  enrichedRouterMintPY,
  enrichedRouterRedeemPY,
  // Aggregated materialized views
  marketDailyStats,
  marketHourlyStats,
  userPositionsSummary,
  userLpPositions,
  protocolDailyStats,
  marketCurrentState,
  userTradingStats,
  rateHistory,
  exchangeRateHistory,
} from '@indexer/schema';
