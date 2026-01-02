use starknet::ContractAddress;

#[starknet::interface]
pub trait IMarket<TContractState> {
    // Pool info
    fn sy(self: @TContractState) -> ContractAddress;
    fn pt(self: @TContractState) -> ContractAddress;
    fn yt(self: @TContractState) -> ContractAddress;
    fn expiry(self: @TContractState) -> u64;
    fn is_expired(self: @TContractState) -> bool;

    // Reserves & LP
    fn get_reserves(self: @TContractState) -> (u256, u256); // (sy_reserve, pt_reserve)
    fn total_lp_supply(self: @TContractState) -> u256;

    // LP operations
    fn mint(
        ref self: TContractState, receiver: ContractAddress, sy_desired: u256, pt_desired: u256,
    ) -> (u256, u256, u256); // (sy_used, pt_used, lp_minted)

    fn burn(
        ref self: TContractState, receiver: ContractAddress, lp_to_burn: u256,
    ) -> (u256, u256); // (sy_out, pt_out)

    // Swaps
    fn swap_exact_pt_for_sy(
        ref self: TContractState, receiver: ContractAddress, exact_pt_in: u256, min_sy_out: u256,
    ) -> u256;

    fn swap_sy_for_exact_pt(
        ref self: TContractState, receiver: ContractAddress, exact_pt_out: u256, max_sy_in: u256,
    ) -> u256;

    fn swap_exact_sy_for_pt(
        ref self: TContractState, receiver: ContractAddress, exact_sy_in: u256, min_pt_out: u256,
    ) -> u256;

    fn swap_pt_for_exact_sy(
        ref self: TContractState, receiver: ContractAddress, exact_sy_out: u256, max_pt_in: u256,
    ) -> u256;

    // Market state
    fn get_ln_implied_rate(self: @TContractState) -> u256;

    // Fee info
    fn get_total_fees_collected(self: @TContractState) -> u256;

    // Market parameters (read-only)
    fn get_scalar_root(self: @TContractState) -> u256;
    fn get_initial_anchor(self: @TContractState) -> u256;
    fn get_ln_fee_rate_root(self: @TContractState) -> u256;
    fn get_reserve_fee_percent(self: @TContractState) -> u8;
}

/// Admin interface for Market pausability, fee collection, and parameter updates
#[starknet::interface]
pub trait IMarketAdmin<TContractState> {
    /// Pause all market operations (PAUSER_ROLE only)
    fn pause(ref self: TContractState);

    /// Unpause all market operations (PAUSER_ROLE only)
    fn unpause(ref self: TContractState);

    /// Collect accumulated trading fees (owner only)
    /// @param receiver Address to receive the collected SY fees
    /// @return Amount of SY fees collected
    fn collect_fees(ref self: TContractState, receiver: ContractAddress) -> u256;

    /// Set the scalar root parameter (owner only)
    /// Controls rate sensitivity - higher values mean rates change more with pool imbalance
    /// Typical values: 0.01-0.5 WAD (10^16 to 5*10^17)
    /// @param new_scalar_root New scalar root value in WAD
    fn set_scalar_root(ref self: TContractState, new_scalar_root: u256);
}
