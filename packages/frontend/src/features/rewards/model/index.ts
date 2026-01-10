// Rewards feature model - hooks for SYWithRewards reward distribution

export {
  type AccruedReward,
  useAccruedRewards,
  useHasClaimableRewards,
  useTotalAccruedRewards,
} from './useAccruedRewards';
export { useClaimAllRewards, useClaimRewards } from './useClaimRewards';
export {
  type MarketAccruedReward,
  useHasClaimableMarketRewards,
  useMarketAccruedRewards,
  useTotalMarketAccruedRewards,
} from './useMarketAccruedRewards';
export { useMarketRewardTokens } from './useMarketRewardTokens';
export { type PortfolioRewards, type SyRewards, usePortfolioRewards } from './usePortfolioRewards';
// Indexed reward APY calculation
export {
  type RewardApyData,
  type RewardApyResponse,
  useRewardApy,
  useTotalRewardApy,
} from './useRewardApy';

// Indexed reward history (from API/database)
export {
  type RewardClaimEvent,
  type RewardSummary,
  type RewardsHistoryResponse,
  type RewardsSummaryResponse,
  useRewardHistory,
  useRewardSummary,
} from './useRewardHistory';
export { useRewardTokens } from './useRewardTokens';
