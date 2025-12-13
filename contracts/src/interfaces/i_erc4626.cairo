use starknet::ContractAddress;

/// ERC-4626 Tokenized Vault Standard Interface
/// Compatible with Nostra's nstSTRK and other ERC-4626 vaults on Starknet
#[starknet::interface]
pub trait IERC4626<TContractState> {
    // ============ ERC20 Base ============
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

    // ============ ERC-4626 Asset Info ============

    /// Returns the address of the underlying token used for the Vault
    fn asset(self: @TContractState) -> ContractAddress;

    /// Returns the total amount of the underlying asset managed by the Vault
    fn total_assets(self: @TContractState) -> u256;

    // ============ ERC-4626 Conversion Functions ============

    /// Converts a given amount of assets to shares
    fn convert_to_shares(self: @TContractState, assets: u256) -> u256;

    /// Converts a given amount of shares to assets
    fn convert_to_assets(self: @TContractState, shares: u256) -> u256;

    // ============ ERC-4626 Deposit Functions ============

    /// Returns the maximum amount of assets that can be deposited
    fn max_deposit(self: @TContractState, receiver: ContractAddress) -> u256;

    /// Returns the amount of shares that would be minted for a given deposit
    fn preview_deposit(self: @TContractState, assets: u256) -> u256;

    /// Deposits assets and mints shares to receiver
    fn deposit(ref self: TContractState, assets: u256, receiver: ContractAddress) -> u256;

    // ============ ERC-4626 Mint Functions ============

    /// Returns the maximum amount of shares that can be minted
    fn max_mint(self: @TContractState, receiver: ContractAddress) -> u256;

    /// Returns the amount of assets needed to mint a given amount of shares
    fn preview_mint(self: @TContractState, shares: u256) -> u256;

    /// Mints exact shares to receiver by depositing assets
    fn mint(ref self: TContractState, shares: u256, receiver: ContractAddress) -> u256;

    // ============ ERC-4626 Withdraw Functions ============

    /// Returns the maximum amount of assets that can be withdrawn
    fn max_withdraw(self: @TContractState, owner: ContractAddress) -> u256;

    /// Returns the amount of shares needed to withdraw a given amount of assets
    fn preview_withdraw(self: @TContractState, assets: u256) -> u256;

    /// Withdraws exact assets from owner and sends to receiver
    fn withdraw(
        ref self: TContractState, assets: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;

    // ============ ERC-4626 Redeem Functions ============

    /// Returns the maximum amount of shares that can be redeemed
    fn max_redeem(self: @TContractState, owner: ContractAddress) -> u256;

    /// Returns the amount of assets that would be received for a given redemption
    fn preview_redeem(self: @TContractState, shares: u256) -> u256;

    /// Burns shares from owner and sends assets to receiver
    fn redeem(
        ref self: TContractState, shares: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;
}

/// Minimal ERC-4626 interface for getting exchange rate only
/// Used by SY to query exchange rate from ERC-4626 vaults
#[starknet::interface]
pub trait IERC4626Minimal<TContractState> {
    /// Converts a given amount of shares to assets
    /// For exchange rate: convert_to_assets(WAD) returns assets per share in WAD
    fn convert_to_assets(self: @TContractState, shares: u256) -> u256;
}
