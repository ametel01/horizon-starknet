// Rewards feature model - hooks for SYWithRewards reward distribution
export { useRewardTokens } from './useRewardTokens';
export {
  useAccruedRewards,
  useHasClaimableRewards,
  useTotalAccruedRewards,
  type AccruedReward,
} from './useAccruedRewards';
export { useClaimRewards, useClaimAllRewards } from './useClaimRewards';
export { usePortfolioRewards, type SyRewards, type PortfolioRewards } from './usePortfolioRewards';

// Indexed reward history (from API/database)
export {
  useRewardHistory,
  useRewardSummary,
  type RewardClaimEvent,
  type RewardsHistoryResponse,
  type RewardSummary,
  type RewardsSummaryResponse,
} from './useRewardHistory';

// Indexed reward APY calculation
export {
  useRewardApy,
  useTotalRewardApy,
  type RewardApyData,
  type RewardApyResponse,
} from './useRewardApy';
