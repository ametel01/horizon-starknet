use starknet::ContractAddress;

/// Oracle type for PT/YT/LP price feeds.
/// Determines which pricing function the oracle wrapper delegates to.
#[derive(Copy, Drop, Serde, PartialEq, starknet::Store)]
#[allow(starknet::store_no_default_variant)]
pub enum OracleType {
    PT_TO_SY,
    YT_TO_SY,
    LP_TO_SY,
    PT_TO_ASSET,
    YT_TO_ASSET,
    LP_TO_ASSET,
}

/// Standardized price feed response for DeFi composability.
/// Other protocols can consume this struct to integrate Horizon oracle prices.
#[derive(Copy, Drop, Serde)]
pub struct PriceFeedResponse {
    /// WAD-scale price (18 decimals)
    pub price: u256,
    /// Always 18 (WAD standard)
    pub decimals: u32,
    /// block_timestamp at time of query
    pub last_updated: u64,
    /// Which price type this feed returns
    pub oracle_type: OracleType,
}

/// Interface for a per-market PT/YT/LP oracle instance.
/// Each instance is immutably configured for one (market, duration, oracle_type) combination
/// and returns price data in a standardized format.
///
/// Reference: Pendle's PendleChainlinkOracle.sol
#[starknet::interface]
pub trait IPtYtLpOracle<TContractState> {
    /// Get the current price from this oracle instance.
    fn get_price(self: @TContractState) -> u256;

    /// Get full price response with metadata.
    fn get_price_response(self: @TContractState) -> PriceFeedResponse;

    /// View: market this oracle is configured for.
    fn market(self: @TContractState) -> ContractAddress;

    /// View: TWAP duration in seconds (0 = spot).
    fn duration(self: @TContractState) -> u32;

    /// View: oracle type (PT_TO_SY, YT_TO_ASSET, etc.).
    fn oracle_type(self: @TContractState) -> OracleType;

    /// View: underlying PyLpOracle helper address.
    fn py_lp_oracle(self: @TContractState) -> ContractAddress;
}
