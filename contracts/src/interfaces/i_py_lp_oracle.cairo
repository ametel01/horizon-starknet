use starknet::ContractAddress;

/// Oracle readiness state for TWAP calculations.
/// Used to determine if a market has sufficient observation history.
#[derive(Copy, Drop, Serde)]
pub struct OracleReadinessState {
    /// Whether the cardinality needs to be increased to support the requested duration
    pub increase_cardinality_required: bool,
    /// The cardinality required to support the requested duration
    pub cardinality_required: u16,
    /// Whether the oldest observation is old enough to support the requested duration
    pub oldest_observation_satisfied: bool,
}

/// Interface for PT/YT/LP Oracle Helper.
/// Provides Pendle-style TWAP oracle functionality for pricing PT, YT, and LP tokens.
///
/// This oracle uses the Market's TWAP of ln(implied rate) to calculate
/// manipulation-resistant prices for PT, YT, and LP tokens.
///
/// Usage:
/// - Use `get_*_to_sy_rate` functions for prices in SY terms
/// - Use `get_*_to_asset_rate` functions for prices in underlying asset terms
/// - Use `check_oracle_state` before querying to ensure sufficient history
///
/// Reference: Pendle's PendlePYOracleLib.sol and PendleLpOracleLib.sol
#[starknet::interface]
pub trait IPyLpOracle<TContractState> {
    // ============ SY-denominated rates ============

    /// Get PT price in SY terms using TWAP.
    /// PT price = exp(-ln_implied_rate_twap * time_to_expiry / SECONDS_PER_YEAR)
    ///
    /// @param market The market contract address
    /// @param duration TWAP window in seconds (0 = use spot rate)
    /// @return PT price in SY terms (WAD scale)
    fn get_pt_to_sy_rate(self: @TContractState, market: ContractAddress, duration: u32) -> u256;

    /// Get YT price in SY terms using TWAP.
    /// Before expiry: YT price = WAD - PT price (since PT + YT = 1 SY)
    /// After expiry: YT price = 0
    ///
    /// @param market The market contract address
    /// @param duration TWAP window in seconds (0 = use spot rate)
    /// @return YT price in SY terms (WAD scale)
    fn get_yt_to_sy_rate(self: @TContractState, market: ContractAddress, duration: u32) -> u256;

    /// Get LP token price in SY terms using TWAP.
    /// LP value = (SY_reserve + PT_reserve * PT_price) / total_LP
    ///
    /// @param market The market contract address
    /// @param duration TWAP window in seconds (0 = use spot rate)
    /// @return LP token price in SY terms (WAD scale)
    fn get_lp_to_sy_rate(self: @TContractState, market: ContractAddress, duration: u32) -> u256;

    // ============ Asset-denominated rates ============

    /// Get PT price in underlying asset terms using TWAP.
    /// Adjusts for the SY/asset exchange rate and handles index discrepancies.
    ///
    /// @param market The market contract address
    /// @param duration TWAP window in seconds (0 = use spot rate)
    /// @return PT price in asset terms (WAD scale)
    fn get_pt_to_asset_rate(self: @TContractState, market: ContractAddress, duration: u32) -> u256;

    /// Get YT price in underlying asset terms using TWAP.
    /// Adjusts for the SY/asset exchange rate and handles index discrepancies.
    ///
    /// @param market The market contract address
    /// @param duration TWAP window in seconds (0 = use spot rate)
    /// @return YT price in asset terms (WAD scale)
    fn get_yt_to_asset_rate(self: @TContractState, market: ContractAddress, duration: u32) -> u256;

    /// Get LP token price in underlying asset terms using TWAP.
    /// Adjusts for the SY/asset exchange rate.
    ///
    /// @param market The market contract address
    /// @param duration TWAP window in seconds (0 = use spot rate)
    /// @return LP token price in asset terms (WAD scale)
    fn get_lp_to_asset_rate(self: @TContractState, market: ContractAddress, duration: u32) -> u256;

    // ============ Oracle state checking ============

    /// Check if the oracle has sufficient history for the requested duration.
    /// Should be called before querying prices to ensure data availability.
    ///
    /// @param market The market contract address
    /// @param duration TWAP window in seconds
    /// @return OracleReadinessState containing:
    ///   - increase_cardinality_required: true if buffer needs to be grown
    ///   - cardinality_required: minimum cardinality needed for duration
    ///   - oldest_observation_satisfied: true if oldest observation is old enough
    fn check_oracle_state(
        self: @TContractState, market: ContractAddress, duration: u32,
    ) -> OracleReadinessState;

    // ============ Helper functions ============

    /// Get the TWAP ln(implied rate) for a given duration.
    /// This is the raw TWAP value used internally for price calculations.
    ///
    /// @param market The market contract address
    /// @param duration TWAP window in seconds (0 = use spot rate)
    /// @return TWAP ln(implied rate) in WAD scale
    fn get_ln_implied_rate_twap(
        self: @TContractState, market: ContractAddress, duration: u32,
    ) -> u256;
}
