use starknet::ContractAddress;

/// Mock callback contract for testing Market swap callbacks.
/// Implements IMarketSwapCallback to receive notifications after swaps.
#[starknet::contract]
pub mod MockSwapCallback {
    use horizon::interfaces::i_market_callback::IMarketSwapCallback;
    use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
    use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        /// PT magnitude from last callback
        last_pt_magnitude: u256,
        /// PT is_negative from last callback
        last_pt_is_negative: bool,
        /// SY magnitude from last callback
        last_sy_magnitude: u256,
        /// SY is_negative from last callback
        last_sy_is_negative: bool,
        /// Number of times callback was invoked
        callback_count: u256,
        /// Market address for executing swaps
        market: ContractAddress,
        /// SY token address for approvals and transfers
        sy: ContractAddress,
        /// PT token address for approvals and transfers
        pt: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, market: ContractAddress, sy: ContractAddress, pt: ContractAddress,
    ) {
        self.market.write(market);
        self.sy.write(sy);
        self.pt.write(pt);
    }

    #[abi(embed_v0)]
    impl CallbackImpl of IMarketSwapCallback<ContractState> {
        fn swap_callback(
            ref self: ContractState,
            net_pt_to_account: (u256, bool),
            net_sy_to_account: (u256, bool),
            data: Span<felt252>,
        ) {
            // Record callback was invoked
            self.callback_count.write(self.callback_count.read() + 1);

            // Store PT info
            let (pt_magnitude, pt_is_negative) = net_pt_to_account;
            self.last_pt_magnitude.write(pt_magnitude);
            self.last_pt_is_negative.write(pt_is_negative);

            // Store SY info
            let (sy_magnitude, sy_is_negative) = net_sy_to_account;
            self.last_sy_magnitude.write(sy_magnitude);
            self.last_sy_is_negative.write(sy_is_negative);
            // If data contains instructions, we could process them here.
        // For now, we just record the callback.
        // Note: This is a notification hook, not flash swap - tokens already transferred.
        }
    }

    #[abi(embed_v0)]
    impl MockSwapCallbackImpl of super::IMockSwapCallback<ContractState> {
        fn get_last_pt(self: @ContractState) -> (u256, bool) {
            (self.last_pt_magnitude.read(), self.last_pt_is_negative.read())
        }

        fn get_last_sy(self: @ContractState) -> (u256, bool) {
            (self.last_sy_magnitude.read(), self.last_sy_is_negative.read())
        }

        fn get_callback_count(self: @ContractState) -> u256 {
            self.callback_count.read()
        }

        fn market(self: @ContractState) -> ContractAddress {
            self.market.read()
        }

        fn sy(self: @ContractState) -> ContractAddress {
            self.sy.read()
        }

        fn pt(self: @ContractState) -> ContractAddress {
            self.pt.read()
        }

        fn approve_market(ref self: ContractState, amount: u256) {
            let market_addr = self.market.read();
            let sy_addr = self.sy.read();
            let pt_addr = self.pt.read();

            // Approve market to spend SY and PT
            let sy_contract = ISYDispatcher { contract_address: sy_addr };
            let pt_contract = IPTDispatcher { contract_address: pt_addr };

            sy_contract.approve(market_addr, amount);
            pt_contract.approve(market_addr, amount);
        }
    }
}

/// Interface for MockSwapCallback test functions
#[starknet::interface]
pub trait IMockSwapCallback<TContractState> {
    /// Get the PT info from last callback (magnitude, is_negative)
    fn get_last_pt(self: @TContractState) -> (u256, bool);
    /// Get the SY info from last callback (magnitude, is_negative)
    fn get_last_sy(self: @TContractState) -> (u256, bool);
    /// Get number of times callback was invoked
    fn get_callback_count(self: @TContractState) -> u256;
    /// Get market address
    fn market(self: @TContractState) -> ContractAddress;
    /// Get SY address
    fn sy(self: @TContractState) -> ContractAddress;
    /// Get PT address
    fn pt(self: @TContractState) -> ContractAddress;
    /// Approve market to spend tokens
    fn approve_market(ref self: TContractState, amount: u256);
}
