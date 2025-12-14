use starknet::ContractAddress;

/// DataType enum matching Pragma's interface
/// Used to specify which type of price data to fetch
#[derive(Drop, Copy, Serde, starknet::Store, Default)]
pub enum DataType {
    /// Spot price entry with pair_id
    #[default]
    SpotEntry: felt252,
    /// Future price entry with (pair_id, expiration_timestamp)
    FutureEntry: (felt252, u64),
}

/// AggregationMode enum matching Pragma's interface
/// Specifies how to aggregate multiple data points
#[derive(Drop, Copy, Serde)]
pub enum AggregationMode {
    /// Use median value
    Median,
    /// Use mean value
    Mean,
    /// Error state
    Error,
}

/// Interface for Pragma's Summary Stats contract
/// Used for fetching TWAP (Time Weighted Average Price) data
#[starknet::interface]
pub trait IPragmaSummaryStats<TContractState> {
    /// Calculate Time Weighted Average Price (TWAP)
    ///
    /// # Arguments
    /// * `data_type` - Type of data to fetch (SpotEntry or FutureEntry with pair_id)
    /// * `aggregation_mode` - How to aggregate data points (Median or Mean)
    /// * `time` - Duration of the TWAP window in seconds
    /// * `start_time` - Start timestamp of the TWAP window
    ///
    /// # Returns
    /// * `(u128, u32)` - (price, decimals) where actual_price = price / 10^decimals
    fn calculate_twap(
        self: @TContractState,
        data_type: DataType,
        aggregation_mode: AggregationMode,
        time: u64,
        start_time: u64,
    ) -> (u128, u32);

    /// Get the underlying oracle contract address
    fn get_oracle_address(self: @TContractState) -> ContractAddress;
}

/// Known Pragma pair IDs
pub mod PairIds {
    /// wstETH/USD pair ID
    pub const WSTETH_USD: felt252 = 412383036120118613857092;
    /// sSTRK/USD pair ID (staked STRK)
    pub const SSTRK_USD: felt252 = 1537084272803954643780;
    /// STRK/USD pair ID
    pub const STRK_USD: felt252 = 6004514686061859652;
    /// ETH/USD pair ID
    pub const ETH_USD: felt252 = 19514442401534788;
}
