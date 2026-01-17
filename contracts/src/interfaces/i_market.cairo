use starknet::ContractAddress;

/// Market state returned by get_market_state.
/// Provides full state for integrations and off-chain calculations.
#[derive(Copy, Drop, Serde)]
pub struct MarketState {
    /// SY token reserve
    pub sy_reserve: u256,
    /// PT token reserve
    pub pt_reserve: u256,
    /// Total LP token supply
    pub total_lp: u256,
    /// Rate sensitivity parameter (in WAD)
    pub scalar_root: u256,
    /// Initial anchor for exchange rate (in WAD)
    pub initial_anchor: u256,
    /// Log fee rate root (Pendle-style)
    pub ln_fee_rate_root: u256,
    /// Reserve fee in base-100 (0-100), sent to treasury
    pub reserve_fee_percent: u8,
    /// Market expiry timestamp
    pub expiry: u64,
    /// Cached ln(implied rate) for anchor calculation
    pub last_ln_implied_rate: u256,
    /// SY -> asset index from YT (fetched per-call)
    pub py_index: u256,
}

/// Oracle state returned by get_oracle_state.
/// Provides the data needed for TWAP calculations.
#[derive(Copy, Drop, Serde)]
pub struct OracleState {
    /// Last cached ln(implied rate)
    pub last_ln_implied_rate: u256,
    /// Current observation index in the ring buffer
    pub observation_index: u16,
    /// Active buffer size (how many slots contain valid observations)
    pub observation_cardinality: u16,
    /// Target buffer size (will grow to this when index wraps)
    pub observation_cardinality_next: u16,
}

#[starknet::interface]
pub trait IMarket<TContractState> {
    // Pool info
    fn sy(self: @TContractState) -> ContractAddress;
    fn pt(self: @TContractState) -> ContractAddress;
    fn yt(self: @TContractState) -> ContractAddress;
    fn expiry(self: @TContractState) -> u64;
    fn is_expired(self: @TContractState) -> bool;

    // Reserves & LP
    fn get_reserves(self: @TContractState) -> (u256, u256); // (sy_reserve, pt_reserve)
    fn total_lp_supply(self: @TContractState) -> u256;

    // LP operations
    fn mint(
        ref self: TContractState, receiver: ContractAddress, sy_desired: u256, pt_desired: u256,
    ) -> (u256, u256, u256); // (sy_used, pt_used, lp_minted)

    fn burn(
        ref self: TContractState, receiver: ContractAddress, lp_to_burn: u256,
    ) -> (u256, u256); // (sy_out, pt_out)

    /// Burn LP tokens with separate receivers for SY and PT
    /// @param receiver_sy Address to receive SY
    /// @param receiver_pt Address to receive PT
    /// @param lp_to_burn Amount of LP tokens to burn
    /// @return (sy_out, pt_out) Amounts sent to receivers
    fn burn_with_receivers(
        ref self: TContractState,
        receiver_sy: ContractAddress,
        receiver_pt: ContractAddress,
        lp_to_burn: u256,
    ) -> (u256, u256);

    // Swaps
    fn swap_exact_pt_for_sy(
        ref self: TContractState,
        receiver: ContractAddress,
        exact_pt_in: u256,
        min_sy_out: u256,
        callback_data: Span<felt252> // Empty span = no callback
    ) -> u256;

    fn swap_sy_for_exact_pt(
        ref self: TContractState,
        receiver: ContractAddress,
        exact_pt_out: u256,
        max_sy_in: u256,
        callback_data: Span<felt252> // Empty span = no callback
    ) -> u256;

    fn swap_exact_sy_for_pt(
        ref self: TContractState,
        receiver: ContractAddress,
        exact_sy_in: u256,
        min_pt_out: u256,
        callback_data: Span<felt252> // Empty span = no callback
    ) -> u256;

    fn swap_pt_for_exact_sy(
        ref self: TContractState,
        receiver: ContractAddress,
        exact_sy_out: u256,
        max_pt_in: u256,
        callback_data: Span<felt252> // Empty span = no callback
    ) -> u256;

    // Market state
    fn get_ln_implied_rate(self: @TContractState) -> u256;

    /// Get full market state for integrations
    /// Returns reserves, parameters, and current py_index for off-chain calculations
    fn get_market_state(self: @TContractState) -> MarketState;

    // Fee info (LP fees only - reserve fees are sent to treasury immediately)
    fn get_total_fees_collected(self: @TContractState) -> u256;

    // Factory address (for querying fee config and treasury)
    fn factory(self: @TContractState) -> ContractAddress;

    // Market parameters (read-only)
    fn get_scalar_root(self: @TContractState) -> u256;
    fn get_initial_anchor(self: @TContractState) -> u256;
    fn get_ln_fee_rate_root(self: @TContractState) -> u256;
    fn get_reserve_fee_percent(self: @TContractState) -> u8;
}

/// Admin interface for Market pausability, fee collection, and parameter updates
#[starknet::interface]
pub trait IMarketAdmin<TContractState> {
    /// Pause all market operations (PAUSER_ROLE only)
    fn pause(ref self: TContractState);

    /// Unpause all market operations (PAUSER_ROLE only)
    fn unpause(ref self: TContractState);

    /// Reset LP fee counter and emit analytics event (owner only)
    /// Note: In Pendle-style fee model, LP fees stay in pool reserves (no transfer).
    /// Reserve fees are sent to treasury immediately during swaps.
    /// This function is for analytics tracking only - it resets the counter and emits an event.
    /// @param receiver Address recorded in the event (no actual transfer occurs)
    /// @return Amount of LP fees tracked since last reset
    fn collect_fees(ref self: TContractState, receiver: ContractAddress) -> u256;

    /// Set the scalar root parameter (owner only)
    /// Controls rate sensitivity - higher values mean rates change more with pool imbalance
    /// Typical values: 0.01-0.5 WAD (10^16 to 5*10^17)
    /// @param new_scalar_root New scalar root value in WAD
    fn set_scalar_root(ref self: TContractState, new_scalar_root: u256);

    /// Reconcile reserve accounting with actual token balances
    /// Recovers tokens accidentally sent to the contract by donating excess to reserves
    /// This benefits LPs by increasing the value of their LP tokens
    /// Can only be called by admin (DEFAULT_ADMIN_ROLE)
    fn skim(ref self: TContractState);
}

/// TWAP Oracle interface for Market
/// Provides methods to query TWAP data and manage observation buffer
#[starknet::interface]
pub trait IMarketOracle<TContractState> {
    /// Query cumulative ln(implied rate) values at multiple time offsets.
    /// Used for TWAP calculations: TWAP = (cumulative_now - cumulative_past) / duration
    /// @param seconds_agos Array of time offsets from current block (e.g., [3600, 0] for 1-hour
    /// TWAP)
    /// @return Array of cumulative values, one per seconds_ago entry
    fn observe(self: @TContractState, seconds_agos: Array<u32>) -> Array<u256>;

    /// Pre-allocate observation buffer slots to reduce gas costs during swaps.
    /// Only grows the buffer - cannot shrink.
    /// @param cardinality_next Target buffer size
    fn increase_observations_cardinality_next(ref self: TContractState, cardinality_next: u16);

    /// Read a single observation from the ring buffer.
    /// @param index Physical slot index (0..cardinality)
    /// @return (block_timestamp, ln_implied_rate_cumulative, initialized)
    fn get_observation(self: @TContractState, index: u16) -> (u64, u256, bool);

    /// Get the oracle state needed for external TWAP calculations.
    /// @return OracleState containing last_ln_implied_rate and buffer indices
    fn get_oracle_state(self: @TContractState) -> OracleState;
}
