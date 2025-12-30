use horizon::interfaces::i_sy::AssetType;
use starknet::ContractAddress;

/// Interface for SY tokens with integrated reward distribution
/// Extends ISY with methods for claiming and querying reward state
///
/// SYWithRewards composes:
/// - SYComponent: core deposit/redeem/exchange_rate logic
/// - RewardManagerComponent: reward token tracking and distribution
///
/// The reward system uses an index-based model:
/// - When rewards arrive, global_index increases proportionally to total supply
/// - Each user's rewards = user_balance * (global_index - user_index)
/// - Rewards are distributed on every balance-changing operation
#[starknet::interface]
pub trait ISYWithRewards<TContractState> {
    // ============ ERC20 Standard ============
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

    // ============ SY Core Functions ============
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
    /// @return Amount of underlying shares redeemed
    fn redeem(
        ref self: TContractState,
        receiver: ContractAddress,
        amount_sy_to_redeem: u256,
        min_token_out: u256,
        burn_from_internal_balance: bool,
    ) -> u256;

    /// Get the current exchange rate (assets per share in WAD)
    fn exchange_rate(self: @TContractState) -> u256;

    /// Get the underlying token address
    fn underlying_asset(self: @TContractState) -> ContractAddress;

    // ============ Multi-Token Support ============
    /// Returns all valid tokens that can be deposited to mint SY
    fn get_tokens_in(self: @TContractState) -> Span<ContractAddress>;

    /// Returns all valid tokens that can be received when redeeming SY
    fn get_tokens_out(self: @TContractState) -> Span<ContractAddress>;

    /// Check if a token can be deposited to mint SY (O(1) lookup)
    fn is_valid_token_in(self: @TContractState, token: ContractAddress) -> bool;

    /// Check if a token can be received when redeeming SY (O(1) lookup)
    fn is_valid_token_out(self: @TContractState, token: ContractAddress) -> bool;

    // ============ Asset Metadata ============
    /// Returns asset classification, underlying address, and decimals
    fn asset_info(self: @TContractState) -> (AssetType, ContractAddress, u8);

    // ============ Preview Functions ============
    /// Preview how much SY would be minted for a given deposit amount
    fn preview_deposit(self: @TContractState, amount_to_deposit: u256) -> u256;

    /// Preview how much underlying would be returned for a given redemption
    fn preview_redeem(self: @TContractState, amount_sy: u256) -> u256;

    // ============ Negative Yield Detection ============
    /// Get the exchange rate watermark (highest rate ever seen)
    /// If current exchange_rate() drops below this, negative yield has occurred
    /// @return The watermark exchange rate in WAD (10^18) precision
    fn get_exchange_rate_watermark(self: @TContractState) -> u256;

    // ============ Reward Functions (additional to ISY) ============
    /// Get all registered reward tokens
    /// @return Array of reward token addresses
    fn get_reward_tokens(self: @TContractState) -> Span<ContractAddress>;

    /// Claim all accrued rewards for a user
    /// Updates global index and user rewards before claiming
    /// @param user Address to claim rewards for
    /// @return Array of claimed amounts (one per reward token, in order)
    fn claim_rewards(ref self: TContractState, user: ContractAddress) -> Span<u256>;

    /// Get user's accrued (unclaimed) rewards for all tokens
    /// Note: Does not include pending rewards from unreflected index updates.
    /// For accurate pending rewards, call claim_rewards to trigger update first.
    /// @param user Address to query
    /// @return Array of accrued amounts (one per reward token, in order)
    fn accrued_rewards(self: @TContractState, user: ContractAddress) -> Span<u256>;

    /// Get the current global reward index for a specific token
    /// @param token Reward token address to query
    /// @return Current global index (scaled by WAD)
    fn reward_index(self: @TContractState, token: ContractAddress) -> u256;

    /// Get user's reward index for a specific token
    /// @param user User address
    /// @param token Reward token address
    /// @return User's last checkpointed index
    fn user_reward_index(
        self: @TContractState, user: ContractAddress, token: ContractAddress,
    ) -> u256;

    /// Check if a token is registered as a reward token
    fn is_reward_token(self: @TContractState, token: ContractAddress) -> bool;

    /// Get the number of registered reward tokens
    fn reward_tokens_count(self: @TContractState) -> u32;
}

/// Admin interface for SYWithRewards pausability
#[starknet::interface]
pub trait ISYWithRewardsAdmin<TContractState> {
    /// Pause all SY operations (PAUSER_ROLE only)
    fn pause(ref self: TContractState);

    /// Unpause all SY operations (PAUSER_ROLE only)
    fn unpause(ref self: TContractState);
}
