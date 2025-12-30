use starknet::ContractAddress;

#[starknet::interface]
pub trait ISY<TContractState> {
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

    // SY-specific
    fn deposit(
        ref self: TContractState, receiver: ContractAddress, amount_shares_to_deposit: u256,
    ) -> u256;
    fn redeem(
        ref self: TContractState, receiver: ContractAddress, amount_sy_to_redeem: u256,
    ) -> u256;
    fn exchange_rate(self: @TContractState) -> u256;
    fn underlying_asset(self: @TContractState) -> ContractAddress;

    // Multi-token support
    /// Returns all valid tokens that can be deposited to mint SY
    fn get_tokens_in(self: @TContractState) -> Span<ContractAddress>;
    /// Returns all valid tokens that can be received when redeeming SY
    fn get_tokens_out(self: @TContractState) -> Span<ContractAddress>;
}

/// Admin interface for SY pausability
#[starknet::interface]
pub trait ISYAdmin<TContractState> {
    /// Pause all SY operations (PAUSER_ROLE only)
    fn pause(ref self: TContractState);

    /// Unpause all SY operations (PAUSER_ROLE only)
    fn unpause(ref self: TContractState);
}
