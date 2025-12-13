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
}
