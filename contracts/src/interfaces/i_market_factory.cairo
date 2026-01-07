use starknet::{ClassHash, ContractAddress};

/// Market configuration returned by get_market_config
/// @param treasury Address receiving reserve fees
/// @param ln_fee_rate_root Effective ln fee rate root (override if set, else 0 = use market
/// default)
/// @param reserve_fee_percent Reserve fee percentage (0-100)
/// @param rate_impact_sensitivity Sensitivity factor for dynamic fee based on rate impact (in WAD)
///        Higher values = larger fee increase for trades that move the rate
///        E.g., 0.1 WAD (10%) means 10% rate change → ~1% fee increase
#[derive(Copy, Drop, Serde)]
pub struct MarketConfig {
    pub treasury: ContractAddress,
    pub ln_fee_rate_root: u256,
    pub reserve_fee_percent: u8,
    pub rate_impact_sensitivity: u256,
}

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

    // ============ Fee Configuration (Pendle-style) ============

    /// Get market configuration for a specific router
    /// Returns treasury, effective ln_fee_rate_root (override or 0), and reserve_fee_percent
    /// @param market The market address
    /// @param router The router address (for per-router overrides)
    /// @return MarketConfig with treasury, ln_fee_rate_root override (0 if none),
    /// reserve_fee_percent
    fn get_market_config(
        self: @TContractState, market: ContractAddress, router: ContractAddress,
    ) -> MarketConfig;

    /// Get the treasury address
    fn get_treasury(self: @TContractState) -> ContractAddress;

    /// Get the default reserve fee percent
    fn get_default_reserve_fee_percent(self: @TContractState) -> u8;

    /// Set the treasury address (owner only)
    /// @param treasury New treasury address
    fn set_treasury(ref self: TContractState, treasury: ContractAddress);

    /// Set the default reserve fee percent (owner only)
    /// @param percent New reserve fee percent (0-100)
    fn set_default_reserve_fee_percent(ref self: TContractState, percent: u8);

    /// Set fee override for a specific router/market pair (owner only)
    /// @param router Router address
    /// @param market Market address
    /// @param ln_fee_rate_root Override ln fee rate root (must be < market's base rate, or 0 to
    /// clear)
    fn set_override_fee(
        ref self: TContractState,
        router: ContractAddress,
        market: ContractAddress,
        ln_fee_rate_root: u256,
    );

    // ============ Rate Impact Fee Configuration ============

    /// Get the default rate impact sensitivity
    /// @return Sensitivity factor in WAD (e.g., 0.1 WAD = 10% sensitivity)
    fn get_default_rate_impact_sensitivity(self: @TContractState) -> u256;

    /// Set the default rate impact sensitivity (owner only)
    /// Controls how much fees increase based on trade's rate impact
    /// @param sensitivity Sensitivity factor in WAD (0 to disable, max ~10 WAD for safety)
    fn set_default_rate_impact_sensitivity(ref self: TContractState, sensitivity: u256);
}
