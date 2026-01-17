/// Token test module
///
/// Contains unit tests for the core token contracts:
/// - SY (Standardized Yield) - wrapper for yield-bearing assets
/// - PT (Principal Token) - redeemable 1:1 at expiry
/// - YT (Yield Token) - accrues interest until expiry
/// - Reward Manager - handles reward distribution
///
/// Run with: snforge test tokens

pub mod test_pt;
pub mod test_reward_manager;
pub mod test_sy;
pub mod test_sy_with_rewards;
pub mod test_yt;
pub mod test_yt_fees;
pub mod test_yt_interest;
pub mod test_yt_phase5;
pub mod test_yt_reserve;
pub mod test_yt_rewards;
pub mod test_yt_treasury;
