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
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
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

    // Yield claiming
    fn redeem_due_interest(ref self: TContractState, user: ContractAddress) -> u256;
    fn get_user_interest(self: @TContractState, user: ContractAddress) -> u256;
}
