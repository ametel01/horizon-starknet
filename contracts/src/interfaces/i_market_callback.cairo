/// Callback interface for flash swap operations
/// External contracts implement this to receive callbacks during Market swaps
#[starknet::interface]
pub trait IMarketSwapCallback<TContractState> {
    /// Called by Market after transferring tokens to receiver
    /// Callback recipient must transfer required input tokens to Market before returning
    ///
    /// @param net_pt_to_account Net PT sent to receiver (negative if PT was input)
    /// @param net_sy_to_account Net SY sent to receiver (negative if SY was input)
    /// @param data Arbitrary data passed through from swap call
    fn swap_callback(
        ref self: TContractState,
        net_pt_to_account: (u256, bool), // (magnitude, is_negative)
        net_sy_to_account: (u256, bool),
        data: Span<felt252>,
    );
}
