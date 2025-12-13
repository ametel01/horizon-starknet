/// Interface for exchange rate / index sources
/// This abstraction allows SY to work with:
/// 1. Native yield tokens that implement index() directly
/// 2. Oracle contracts that provide exchange rate for bridged tokens (like wstETH)
///
/// The index represents: assets_value = shares * index / WAD
/// For wstETH: 1 wstETH = index/WAD stETH (where index increases over time)
#[starknet::interface]
pub trait IIndexOracle<TContractState> {
    /// Returns the current exchange rate index in WAD (1e18)
    /// This value should be monotonically non-decreasing for yield-bearing assets
    fn index(self: @TContractState) -> u256;
}
