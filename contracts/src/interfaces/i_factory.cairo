use horizon::interfaces::i_sy::AssetType;
use starknet::{ClassHash, ContractAddress};

#[starknet::interface]
pub trait IFactory<TContractState> {
    fn create_yield_contracts(
        ref self: TContractState, sy: ContractAddress, expiry: u64,
    ) -> (ContractAddress, ContractAddress); // (PT, YT)

    fn get_pt(self: @TContractState, sy: ContractAddress, expiry: u64) -> ContractAddress;
    fn get_yt(self: @TContractState, sy: ContractAddress, expiry: u64) -> ContractAddress;
    fn is_valid_pt(self: @TContractState, pt: ContractAddress) -> bool;
    fn is_valid_yt(self: @TContractState, yt: ContractAddress) -> bool;

    /// Get the YT class hash used for deployments
    fn yt_class_hash(self: @TContractState) -> ClassHash;

    /// Get the PT class hash used for deployments
    fn pt_class_hash(self: @TContractState) -> ClassHash;

    /// Set new class hashes for PT/YT deployments (owner only)
    fn set_class_hashes(
        ref self: TContractState, yt_class_hash: ClassHash, pt_class_hash: ClassHash,
    );

    /// Initialize RBAC after upgrade (one-time setup)
    fn initialize_rbac(ref self: TContractState);

    // ============ SYWithRewards Support ============

    /// Get the SYWithRewards class hash used for deployments
    fn sy_with_rewards_class_hash(self: @TContractState) -> ClassHash;

    /// Set the SYWithRewards class hash (owner only)
    fn set_sy_with_rewards_class_hash(ref self: TContractState, class_hash: ClassHash);

    /// Deploy a new SYWithRewards contract
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param underlying The underlying yield-bearing token
    /// @param index_oracle The index source (same as underlying for ERC-4626, or oracle)
    /// @param is_erc4626 Whether the index_oracle is an ERC-4626 vault
    /// @param asset_type Asset classification (Token or Liquidity)
    /// @param pauser Address with PAUSER_ROLE for emergency pause
    /// @param tokens_in Valid tokens for deposit
    /// @param tokens_out Valid tokens for redemption
    /// @param reward_tokens Reward tokens to track
    /// @param salt Unique salt for deterministic deployment
    /// @return The deployed SYWithRewards contract address
    fn deploy_sy_with_rewards(
        ref self: TContractState,
        name: ByteArray,
        symbol: ByteArray,
        underlying: ContractAddress,
        index_oracle: ContractAddress,
        is_erc4626: bool,
        asset_type: AssetType,
        pauser: ContractAddress,
        tokens_in: Span<ContractAddress>,
        tokens_out: Span<ContractAddress>,
        reward_tokens: Span<ContractAddress>,
        salt: felt252,
    ) -> ContractAddress;

    /// Check if an SY address was deployed by this factory
    fn is_valid_sy(self: @TContractState, sy: ContractAddress) -> bool;

    // ============ Treasury Support ============

    /// Get the treasury address for protocol fee collection and post-expiry yield
    fn treasury(self: @TContractState) -> ContractAddress;

    /// Set the treasury address (owner only)
    fn set_treasury(ref self: TContractState, treasury: ContractAddress);

    // ============ Fee Rate Management ============

    /// Get the reward fee rate (in WAD, 10^18 = 100%)
    fn get_reward_fee_rate(self: @TContractState) -> u256;

    /// Set the reward fee rate (owner only)
    /// @param rate Fee rate in WAD (e.g., 3% = 0.03 * 10^18)
    fn set_reward_fee_rate(ref self: TContractState, rate: u256);

    /// Get the default interest fee rate (in WAD, 10^18 = 100%)
    fn get_default_interest_fee_rate(self: @TContractState) -> u256;

    /// Set the default interest fee rate (owner only)
    /// @param rate Fee rate in WAD (e.g., 3% = 0.03 * 10^18)
    fn set_default_interest_fee_rate(ref self: TContractState, rate: u256);
}
