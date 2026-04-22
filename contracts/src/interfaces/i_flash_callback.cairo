/// Callback interface for flash PT+YT operations
/// External contracts implement this to receive PT+YT in a flash loan pattern
#[starknet::interface]
pub trait IFlashCallback<TContractState> {
    /// Called by YT contract during flash PT+YT operations
    /// The callback receiver must return the required SY to the YT contract
    ///
    /// Use cases:
    /// - Arbitrage between PT/YT and external markets
    /// - Leveraged yield strategies
    /// - Atomic liquidations
    ///
    /// @param pt_amount Amount of PT flash-minted
    /// @param yt_amount Amount of YT flash-minted
    /// @param data Arbitrary data passed through from the flash call
    fn flash_callback(
        ref self: TContractState, pt_amount: u256, yt_amount: u256, data: Span<felt252>,
    );
}
