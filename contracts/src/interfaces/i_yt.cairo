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
    /// Mint PT + YT by consuming floating SY (pre-transferred to this contract)
    /// Caller must transfer SY to YT contract before calling this function.
    /// PY amount = syToAsset(index, floatingSyAmount) = floatingSyAmount * index / WAD
    /// @param receiver_pt Address to receive minted PT
    /// @param receiver_yt Address to receive minted YT
    /// @return (amount_pt, amount_yt) in asset terms (not SY terms)
    fn mint_py(
        ref self: TContractState, receiver_pt: ContractAddress, receiver_yt: ContractAddress,
    ) -> (u256, u256);
    /// Redeem PT + YT for SY (before expiry) using floating tokens
    /// Caller must transfer PT and YT to YT contract before calling.
    /// SY returned = assetToSy(index, pyAmount) = pyAmount * WAD / index
    /// @param receiver Address to receive SY
    /// @return Amount of SY returned
    fn redeem_py(ref self: TContractState, receiver: ContractAddress) -> u256;
    /// Redeem PT for SY after expiry using floating PT
    /// Caller must transfer PT to YT contract before calling.
    /// Post-expiry interest is carved out per-redemption and sent to treasury.
    /// @param receiver Address to receive SY
    /// @return Amount of SY returned to user
    fn redeem_py_post_expiry(ref self: TContractState, receiver: ContractAddress) -> u256;

    // Batch operations
    /// Batch mint PT + YT for multiple receivers using floating SY
    /// Total floating SY is split according to the amounts array
    /// @param receivers_pt Addresses to receive PT
    /// @param receivers_yt Addresses to receive YT
    /// @param amounts SY amounts for each entry (must sum to floating SY)
    fn mint_py_multi(
        ref self: TContractState,
        receivers_pt: Array<ContractAddress>,
        receivers_yt: Array<ContractAddress>,
        amounts: Array<u256>,
    ) -> (Array<u256>, Array<u256>);
    fn redeem_py_multi(
        ref self: TContractState, receivers: Array<ContractAddress>, amounts: Array<u256>,
    ) -> Array<u256>;

    // Convenience operations
    /// Redeem PT + YT for SY with optional interest claim using floating tokens
    /// Caller must transfer PT and YT to YT contract before calling.
    fn redeem_py_with_interest(
        ref self: TContractState, receiver: ContractAddress, redeem_interest: bool,
    ) -> (u256, u256);

    // Index tracking
    fn py_index_current(self: @TContractState) -> u256;
    fn py_index_stored(self: @TContractState) -> u256;
    /// Update and return the current PY index (Pendle-style pyIndexCurrent)
    /// Unlike py_index_current() which is view-only, this function:
    /// - Fetches the current exchange rate from SY
    /// - Updates py_index_stored if the rate is higher (watermark pattern)
    /// - Emits PyIndexUpdated event when index changes
    /// - Updates same-block cache
    /// After expiry, captures and freezes the expiry index on first call.
    /// @return The current PY index
    fn update_py_index(ref self: TContractState) -> u256;

    // Reserve tracking
    fn sy_reserve(self: @TContractState) -> u256;
    fn get_floating_sy(self: @TContractState) -> u256;
    fn get_floating_pt(self: @TContractState) -> u256;
    fn get_floating_yt(self: @TContractState) -> u256;

    // Yield claiming
    fn redeem_due_interest(ref self: TContractState, user: ContractAddress) -> u256;
    fn get_user_interest(self: @TContractState, user: ContractAddress) -> u256;

    // Reward token claiming (multi-reward support)
    /// Claim accrued reward tokens for a user
    /// @param user Address to claim rewards for
    /// @return Array of claimed amounts (one per reward token)
    fn claim_rewards(ref self: TContractState, user: ContractAddress) -> Span<u256>;

    /// Combined atomic claim of interest and rewards
    /// Allows claiming both in a single transaction for gas efficiency
    /// @param user Address to claim for
    /// @param do_interest If true, claims accrued interest (SY)
    /// @param do_rewards If true, claims accrued reward tokens
    /// @return (interest_amount, reward_amounts) - interest in SY, rewards per token
    fn redeem_due_interest_and_rewards(
        ref self: TContractState, user: ContractAddress, do_interest: bool, do_rewards: bool,
    ) -> (u256, Span<u256>);

    /// Get all registered reward tokens
    /// @return Array of reward token addresses
    fn get_reward_tokens(self: @TContractState) -> Span<ContractAddress>;

    // Treasury
    fn treasury(self: @TContractState) -> ContractAddress;
    fn get_post_expiry_treasury_interest(self: @TContractState) -> u256;

    // Protocol fee
    fn interest_fee_rate(self: @TContractState) -> u256;

    // Post-expiry tracking (Pendle-style)
    /// Get the PY index captured at first post-expiry action (Pendle: firstPYIndex)
    /// Returns 0 if expiry hasn't been reached or first post-expiry action hasn't occurred
    fn first_py_index(self: @TContractState) -> u256;
    /// Get total SY interest accumulated for treasury since expiry (Pendle:
    /// totalSyInterestForTreasury)
    /// This is post-expiry yield carved out from redemptions and redirected to treasury
    fn total_sy_interest_for_treasury(self: @TContractState) -> u256;
    /// Get complete post-expiry data in one call
    /// Returns (first_py_index, total_sy_interest_for_treasury, is_post_expiry_initialized)
    fn get_post_expiry_data(self: @TContractState) -> (u256, u256, bool);
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
