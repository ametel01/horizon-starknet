use starknet::ContractAddress;

/// Standard interface for external swap aggregator routers (AVNU, Fibrous, etc.)
/// The Horizon router calls this interface to swap arbitrary tokens through aggregators.
///
/// This interface defines the minimal swap function that aggregators must implement
/// to be compatible with Horizon's token input/output operations.
#[starknet::interface]
pub trait IAggregatorRouter<TContractState> {
    /// Execute a token swap through the aggregator
    ///
    /// @param token_in Address of the input token to swap from
    /// @param token_out Address of the output token to swap to
    /// @param amount_in Amount of input tokens to swap
    /// @param min_amount_out Minimum output tokens to receive (slippage protection)
    /// @param receiver Address to receive the output tokens
    /// @param calldata Additional calldata for aggregator-specific parameters (routes, pools, etc.)
    /// @return Amount of output tokens received
    fn swap(
        ref self: TContractState,
        token_in: ContractAddress,
        token_out: ContractAddress,
        amount_in: u256,
        min_amount_out: u256,
        receiver: ContractAddress,
        calldata: Span<felt252>,
    ) -> u256;
}
