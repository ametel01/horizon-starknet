use starknet::{ClassHash, ContractAddress};

#[starknet::interface]
pub trait IMarketFactory<TContractState> {
    /// Create a new market for a PT token
    /// @param pt The PT token address
    /// @param scalar_root Controls rate sensitivity (in WAD)
    /// @param initial_anchor Initial ln(implied rate) (in WAD)
    /// @param ln_fee_rate_root Log fee rate root (Pendle-style) in WAD
    /// @param reserve_fee_percent Reserve fee in base-100 (0-100), sent to treasury
    /// @return The address of the created market
    fn create_market(
        ref self: TContractState,
        pt: ContractAddress,
        scalar_root: u256,
        initial_anchor: u256,
        ln_fee_rate_root: u256,
        reserve_fee_percent: u8,
    ) -> ContractAddress;

    /// Get the market address for a given PT
    fn get_market(self: @TContractState, pt: ContractAddress) -> ContractAddress;

    /// Check if a market address was deployed by this factory
    fn is_valid_market(self: @TContractState, market: ContractAddress) -> bool;

    /// Get the market class hash used for deployments
    fn market_class_hash(self: @TContractState) -> ClassHash;

    /// Get the total number of markets created
    fn get_market_count(self: @TContractState) -> u32;

    /// Get all market addresses created by this factory
    /// WARNING: May exceed gas limits for large numbers of markets. Use get_markets_paginated for
    /// production.
    fn get_all_markets(self: @TContractState) -> Array<ContractAddress>;

    /// Get market addresses with pagination
    /// @param offset Starting index (0-based)
    /// @param limit Maximum number of markets to return
    /// @return Array of market addresses and whether there are more markets after this page
    fn get_markets_paginated(
        self: @TContractState, offset: u32, limit: u32,
    ) -> (Array<ContractAddress>, bool);

    /// Get market address by index (0-based)
    fn get_market_at(self: @TContractState, index: u32) -> ContractAddress;

    /// Get active (non-expired) market addresses with pagination
    /// @param offset Number of active markets to skip
    /// @param limit Maximum number of active markets to return
    /// @return Array of active market addresses and whether there are more active markets
    fn get_active_markets_paginated(
        self: @TContractState, offset: u32, limit: u32,
    ) -> (Array<ContractAddress>, bool);

    /// Set new market class hash (owner only)
    fn set_market_class_hash(ref self: TContractState, new_class_hash: ClassHash);

    /// Initialize RBAC after upgrade (one-time setup)
    fn initialize_rbac(ref self: TContractState);
}
