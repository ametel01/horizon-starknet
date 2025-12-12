use starknet::ContractAddress;

#[starknet::interface]
pub trait IFactory<TContractState> {
    fn create_yield_contracts(
        ref self: TContractState, sy: ContractAddress, expiry: u64,
    ) -> (ContractAddress, ContractAddress); // (PT, YT)

    fn get_pt(self: @TContractState, sy: ContractAddress, expiry: u64) -> ContractAddress;
    fn get_yt(self: @TContractState, sy: ContractAddress, expiry: u64) -> ContractAddress;
    fn is_valid_pt(self: @TContractState, pt: ContractAddress) -> bool;
    fn is_valid_yt(self: @TContractState, yt: ContractAddress) -> bool;
}
