use starknet::ContractAddress;

#[starknet::interface]
pub trait IYT<TContractState> {
    // ERC20 standard
    fn name(self: @TContractState) -> ByteArray;
    fn symbol(self: @TContractState) -> ByteArray;
    fn decimals(self: @TContractState) -> u8;
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;

    // YT-specific
    fn sy(self: @TContractState) -> ContractAddress;
    fn pt(self: @TContractState) -> ContractAddress;
    fn expiry(self: @TContractState) -> u64;
    fn is_expired(self: @TContractState) -> bool;

    // Core operations
    fn mint_py(
        ref self: TContractState, receiver: ContractAddress, amount_sy_to_mint: u256,
    ) -> (u256, u256);
    fn redeem_py(
        ref self: TContractState, receiver: ContractAddress, amount_py_to_redeem: u256,
    ) -> u256;
    fn redeem_py_post_expiry(
        ref self: TContractState, receiver: ContractAddress, amount_pt: u256,
    ) -> u256;

    // Index tracking
    fn py_index_current(self: @TContractState) -> u256;
    fn py_index_stored(self: @TContractState) -> u256;

    // Reserve tracking
    fn sy_reserve(self: @TContractState) -> u256;
    fn get_floating_sy(self: @TContractState) -> u256;

    // Yield claiming
    fn redeem_due_interest(ref self: TContractState, user: ContractAddress) -> u256;
    fn get_user_interest(self: @TContractState, user: ContractAddress) -> u256;

    // Treasury
    fn treasury(self: @TContractState) -> ContractAddress;
    fn get_post_expiry_treasury_interest(self: @TContractState) -> u256;

    // Protocol fee
    fn interest_fee_rate(self: @TContractState) -> u256;
}

/// Admin interface for YT pausability and treasury management
#[starknet::interface]
pub trait IYTAdmin<TContractState> {
    /// Pause all YT operations (PAUSER_ROLE only)
    fn pause(ref self: TContractState);

    /// Unpause all YT operations (PAUSER_ROLE only)
    fn unpause(ref self: TContractState);

    /// Claim post-expiry yield for treasury (DEFAULT_ADMIN_ROLE only)
    /// After expiry, any yield that accrues is redirected to treasury.
    /// @return Amount of SY transferred to treasury
    fn redeem_post_expiry_interest_for_treasury(ref self: TContractState) -> u256;

    /// Set the protocol fee rate on interest claims (DEFAULT_ADMIN_ROLE only)
    /// Rate is WAD-scaled (e.g., 0.03e18 = 3%), max 50% (0.5e18)
    fn set_interest_fee_rate(ref self: TContractState, rate: u256);
}
