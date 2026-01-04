/// Market test module
///
/// Contains unit tests for the AMM market contracts:
/// - Core market functionality (swaps, liquidity)
/// - Market factory deployment
/// - Fee mechanics
/// - Expiry behavior
/// - Edge cases (first depositor, large trades, invariants)
/// - TWAP oracle integration
///
/// Run with: snforge test market

pub mod test_market;
pub mod test_market_expiry;
pub mod test_market_factory;
pub mod test_market_fees;
pub mod test_market_first_depositor;
pub mod test_market_invariants;
pub mod test_market_large_trades;
pub mod test_market_oracle;
