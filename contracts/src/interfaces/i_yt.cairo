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
    /// Redeem PT + YT for SY (before expiry)
    /// SY returned = assetToSy(index, pyAmount) = pyAmount * WAD / index
    /// @param receiver Address to receive SY
    /// @param amount_py Amount of PT and YT to burn (in asset terms)
    /// @return Amount of SY returned
    fn redeem_py(
        ref self: TContractState, receiver: ContractAddress, amount_py_to_redeem: u256,
    ) -> u256;
    fn redeem_py_post_expiry(
        ref self: TContractState, receiver: ContractAddress, amount_pt: u256,
    ) -> u256;

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
    fn redeem_py_with_interest(
        ref self: TContractState, receiver: ContractAddress, amount_py: u256, redeem_interest: bool,
    ) -> (u256, u256);

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
