/// Router test module
///
/// Contains unit tests for the Router contract:
/// - Core router operations (deposit, mint, redeem)
/// - YT swap functionality
/// - Slippage protection
///
/// Run with: snforge test router

pub mod test_batch_operations;
pub mod test_router;
pub mod test_router_rollover;
pub mod test_router_single_sided_lp;
pub mod test_router_token_aggregation;
pub mod test_router_yt_swaps;
