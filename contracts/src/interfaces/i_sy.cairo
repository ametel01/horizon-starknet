use starknet::ContractAddress;

/// Asset type classification for SY tokens
/// Matches Pendle V2's AssetType enum for compatibility
#[derive(Drop, Serde, Copy, starknet::Store, PartialEq, Default)]
pub enum AssetType {
    /// Regular ERC20 token (e.g., stETH, wstETH, aUSDC)
    #[default]
    Token,
    /// Liquidity pool token (e.g., Curve LP, Uniswap LP)
    Liquidity,
}

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
    /// Deposit underlying yield-bearing tokens to mint SY
    /// @param receiver Address to receive the minted SY
    /// @param amount_shares_to_deposit Amount of underlying shares to deposit
    /// @param min_shares_out Minimum SY shares to receive (slippage protection)
    /// @return Amount of SY minted
    fn deposit(
        ref self: TContractState,
        receiver: ContractAddress,
        amount_shares_to_deposit: u256,
        min_shares_out: u256,
    ) -> u256;
    /// Redeem SY for underlying yield-bearing tokens
    /// @param receiver Address to receive the underlying tokens
    /// @param amount_sy_to_redeem Amount of SY to burn
    /// @param min_token_out Minimum underlying tokens to receive (slippage protection)
    /// @param burn_from_internal_balance If true, burn from contract's own balance (Router pattern)
    ///        If false, burn from caller's balance (standard pattern)
    /// @return Amount of underlying shares redeemed
    fn redeem(
        ref self: TContractState,
        receiver: ContractAddress,
        amount_sy_to_redeem: u256,
        min_token_out: u256,
        burn_from_internal_balance: bool,
    ) -> u256;
    fn exchange_rate(self: @TContractState) -> u256;
    fn underlying_asset(self: @TContractState) -> ContractAddress;

    // Multi-token support
    /// Returns all valid tokens that can be deposited to mint SY
    fn get_tokens_in(self: @TContractState) -> Span<ContractAddress>;
    /// Returns all valid tokens that can be received when redeeming SY
    fn get_tokens_out(self: @TContractState) -> Span<ContractAddress>;
    /// Check if a token can be deposited to mint SY (O(1) lookup)
    fn is_valid_token_in(self: @TContractState, token: ContractAddress) -> bool;
    /// Check if a token can be received when redeeming SY (O(1) lookup)
    fn is_valid_token_out(self: @TContractState, token: ContractAddress) -> bool;

    // Asset metadata
    /// Returns asset classification, underlying address, and decimals
    /// Matches Pendle V2's assetInfo() for compatibility
    fn asset_info(self: @TContractState) -> (AssetType, ContractAddress, u8);

    // Preview functions
    /// Preview how much SY would be minted for a given deposit amount
    /// @param amount_to_deposit Amount of underlying shares to deposit
    /// @return Amount of SY that would be minted (1:1 with underlying shares)
    fn preview_deposit(self: @TContractState, amount_to_deposit: u256) -> u256;
    /// Preview how much underlying would be returned for a given redemption
    /// @param amount_sy Amount of SY to redeem
    /// @return Amount of underlying shares that would be returned (1:1 with SY)
    fn preview_redeem(self: @TContractState, amount_sy: u256) -> u256;
}

/// Admin interface for SY pausability
#[starknet::interface]
pub trait ISYAdmin<TContractState> {
    /// Pause all SY operations (PAUSER_ROLE only)
    fn pause(ref self: TContractState);

    /// Unpause all SY operations (PAUSER_ROLE only)
    fn unpause(ref self: TContractState);
}
