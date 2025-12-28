/// Fuzz test module for AMM math functions
///
/// Contains property-based tests using snforge's fuzzer to verify:
/// - No panics from math overflow/underflow
/// - Output values within expected bounds
/// - Binary search convergence with adversarial inputs
/// - Edge case proportions
///
/// Run with: snforge test fuzz --fuzzer-runs 10000

pub mod fuzz_debug;
pub mod fuzz_market_math;
