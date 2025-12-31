/// Math library test module
///
/// Contains unit tests for mathematical functions:
/// - WAD (10^18) fixed-point arithmetic
/// - Fixed-point math using cairo_fp crate
/// - Market pricing formulas
/// - Pendle AMM math validation
///
/// Run with: snforge test math

pub mod test_market_math;
pub mod test_market_math_fp;
pub mod test_math;
pub mod test_math_fp;
pub mod test_pendle_amm_math;
