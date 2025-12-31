/// Integration test module
///
/// Contains end-to-end tests that verify the complete flow of the protocol:
/// - Full yield tokenization flow (deposit -> mint PY -> yield accrual -> redemption)
/// - Expiry scenarios (pre-expiry and post-expiry behavior)
/// - Edge cases and boundary conditions
/// - Market flow tests
///
/// Run with: snforge test integration

pub mod test_edge_cases;
pub mod test_expiry;
pub mod test_full_flow;
pub mod test_market_flow;
