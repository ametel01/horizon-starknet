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
}
