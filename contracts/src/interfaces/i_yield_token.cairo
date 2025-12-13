use starknet::ContractAddress;

/// Interface for yield-bearing tokens (like wstETH, aUSDC, etc.)
/// This is what SY expects from its underlying yield-bearing asset.
/// The token must be non-rebasing (balances don't change, value accrues via index).
#[starknet::interface]
pub trait IYieldToken<TContractState> {
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

    /// Returns the underlying asset address (e.g., ETH for wstETH)
    fn asset(self: @TContractState) -> ContractAddress;

    /// Returns the current index (exchange rate) in WAD (1e18)
    /// This represents: assets = shares * index / WAD
    /// The index should be monotonically non-decreasing (yield accrues)
    fn index(self: @TContractState) -> u256;

    /// Convert shares to assets: assets = floor(shares * index / WAD)
    fn convert_to_assets(self: @TContractState, shares: u256) -> u256;

    /// Convert assets to shares: shares = floor(assets * WAD / index)
    fn convert_to_shares(self: @TContractState, assets: u256) -> u256;
}
