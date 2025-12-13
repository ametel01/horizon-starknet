use starknet::ContractAddress;

#[starknet::interface]
pub trait IMarketFactory<TContractState> {
    /// Create a new market for a PT token
    /// @param pt The PT token address
    /// @param scalar_root Controls rate sensitivity (in WAD)
    /// @param initial_anchor Initial ln(implied rate) (in WAD)
    /// @param fee_rate Fee rate in WAD (e.g., 0.01 WAD = 1%)
    /// @return The address of the created market
    fn create_market(
        ref self: TContractState,
        pt: ContractAddress,
        scalar_root: u256,
        initial_anchor: u256,
        fee_rate: u256,
    ) -> ContractAddress;

    /// Get the market address for a given PT
    fn get_market(self: @TContractState, pt: ContractAddress) -> ContractAddress;

    /// Check if a market address was deployed by this factory
    fn is_valid_market(self: @TContractState, market: ContractAddress) -> bool;

    /// Get the market class hash used for deployments
    fn market_class_hash(self: @TContractState) -> starknet::ClassHash;

    /// Get the total number of markets created
    fn get_market_count(self: @TContractState) -> u32;

    /// Get all market addresses created by this factory
    fn get_all_markets(self: @TContractState) -> Array<ContractAddress>;

    /// Get market address by index (0-based)
    fn get_market_at(self: @TContractState, index: u32) -> ContractAddress;
}
