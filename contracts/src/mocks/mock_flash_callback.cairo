use starknet::ContractAddress;

/// Mock callback contract for testing YT flash mint operations.
/// Implements IFlashCallback to receive PT+YT and repay SY.
#[starknet::contract]
pub mod MockFlashCallback {
    use horizon::interfaces::i_flash_callback::IFlashCallback;
    use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::ContractAddress;

    #[storage]
    struct Storage {
        /// YT contract address for flash mint operations
        yt: ContractAddress,
        /// SY token address for repayment
        sy: ContractAddress,
        /// Last PT amount received in callback
        last_pt_amount: u256,
        /// Last YT amount received in callback
        last_yt_amount: u256,
        /// Number of times callback was invoked
        callback_count: u256,
        /// Whether to repay the SY (for testing repayment failure)
        should_repay: bool,
        /// Custom repay amount (0 means use expected amount)
        custom_repay_amount: u256,
        /// Amount of SY to hold for repayment
        sy_balance_for_repay: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, yt: ContractAddress, sy: ContractAddress) {
        self.yt.write(yt);
        self.sy.write(sy);
        self.should_repay.write(true);
    }

    #[abi(embed_v0)]
    impl FlashCallbackImpl of IFlashCallback<ContractState> {
        fn flash_callback(
            ref self: ContractState, pt_amount: u256, yt_amount: u256, data: Span<felt252>,
        ) {
            // Record callback info
            self.callback_count.write(self.callback_count.read() + 1);
            self.last_pt_amount.write(pt_amount);
            self.last_yt_amount.write(yt_amount);

            // Repay SY if configured to do so
            if self.should_repay.read() {
                let sy_addr = self.sy.read();
                let yt_addr = self.yt.read();
                let sy = ISYDispatcher { contract_address: sy_addr };

                // Determine repay amount
                let custom = self.custom_repay_amount.read();
                let repay_amount = if custom > 0 {
                    custom
                } else {
                    // Flash mint uses syToAsset, so to get SY back we need assetToSy
                    // The flash mint function expects amount_sy to be repaid
                    // Data could contain the expected SY amount, but we'll use balance for now
                    self.sy_balance_for_repay.read()
                };

                if repay_amount > 0 {
                    sy.transfer(yt_addr, repay_amount);
                }
            }
        }
    }

    #[abi(embed_v0)]
    impl MockFlashCallbackImpl of super::IMockFlashCallback<ContractState> {
        fn get_last_pt_amount(self: @ContractState) -> u256 {
            self.last_pt_amount.read()
        }

        fn get_last_yt_amount(self: @ContractState) -> u256 {
            self.last_yt_amount.read()
        }

        fn get_callback_count(self: @ContractState) -> u256 {
            self.callback_count.read()
        }

        fn yt(self: @ContractState) -> ContractAddress {
            self.yt.read()
        }

        fn sy(self: @ContractState) -> ContractAddress {
            self.sy.read()
        }

        fn set_should_repay(ref self: ContractState, should_repay: bool) {
            self.should_repay.write(should_repay);
        }

        fn set_custom_repay_amount(ref self: ContractState, amount: u256) {
            self.custom_repay_amount.write(amount);
        }

        fn set_sy_balance_for_repay(ref self: ContractState, amount: u256) {
            self.sy_balance_for_repay.write(amount);
        }

        fn fund_sy(ref self: ContractState, amount: u256) {
            // This is called externally to give the callback contract SY for repayment
            // The actual transfer is done by the test setup
            self.sy_balance_for_repay.write(amount);
        }
    }
}

/// Interface for MockFlashCallback test functions
#[starknet::interface]
pub trait IMockFlashCallback<TContractState> {
    /// Get the PT amount from last callback
    fn get_last_pt_amount(self: @TContractState) -> u256;
    /// Get the YT amount from last callback
    fn get_last_yt_amount(self: @TContractState) -> u256;
    /// Get number of times callback was invoked
    fn get_callback_count(self: @TContractState) -> u256;
    /// Get YT address
    fn yt(self: @TContractState) -> ContractAddress;
    /// Get SY address
    fn sy(self: @TContractState) -> ContractAddress;
    /// Set whether to repay SY (for testing repayment failure)
    fn set_should_repay(ref self: TContractState, should_repay: bool);
    /// Set custom repay amount (0 means use expected amount)
    fn set_custom_repay_amount(ref self: TContractState, amount: u256);
    /// Set the SY balance amount for repayment
    fn set_sy_balance_for_repay(ref self: TContractState, amount: u256);
    /// Fund the callback contract with SY for repayment
    fn fund_sy(ref self: TContractState, amount: u256);
}
