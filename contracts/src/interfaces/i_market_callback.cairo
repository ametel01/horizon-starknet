/// Callback interface for swap notification hooks
/// External contracts implement this to receive notifications after Market swaps complete
#[starknet::interface]
pub trait IMarketSwapCallback<TContractState> {
    /// Called by Market after swap is fully executed (all transfers complete)
    /// This is a notification hook, not a flash swap - tokens have already been transferred
    ///
    /// Use cases:
    /// - Post-swap accounting or state updates
    /// - Triggering downstream actions after a swap
    /// - Integration with external protocols that need swap notifications
    ///
    /// @param net_pt_to_account Net PT change for the account: (magnitude, is_negative)
    ///        - is_negative=false: account received PT from market
    ///        - is_negative=true: account sent PT to market
    /// @param net_sy_to_account Net SY change for the account: (magnitude, is_negative)
    ///        - is_negative=false: account received SY from market
    ///        - is_negative=true: account sent SY to market
    /// @param data Arbitrary data passed through from the swap call
    fn swap_callback(
        ref self: TContractState,
        net_pt_to_account: (u256, bool), // (magnitude, is_negative)
        net_sy_to_account: (u256, bool),
        data: Span<felt252>,
    );
}
