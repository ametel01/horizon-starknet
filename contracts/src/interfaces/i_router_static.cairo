use starknet::ContractAddress;

/// Market information struct for frontend display
#[derive(Drop, Serde)]
pub struct MarketInfo {
    pub sy: ContractAddress,
    pub pt: ContractAddress,
    pub yt: ContractAddress,
    pub expiry: u64,
    pub is_expired: bool,
    pub sy_reserve: u256,
    pub pt_reserve: u256,
    pub total_lp: u256,
    pub ln_implied_rate: u256,
    pub pt_to_sy_rate: u256,
    pub lp_to_sy_rate: u256,
    pub scalar_root: u256,
    pub ln_fee_rate_root: u256,
}

/// RouterStatic interface for read-only preview functions
/// All functions are view-only and do not modify state
#[starknet::interface]
pub trait IRouterStatic<TContractState> {
    /// Get the current PT/SY exchange rate from a market
    /// This is the instantaneous rate at which PT trades for SY
    /// @param market The market address to query
    /// @return Exchange rate in WAD (1e18 = 1:1)
    fn get_pt_to_sy_rate(self: @TContractState, market: ContractAddress) -> u256;

    /// Get the LP token value in SY terms
    /// This calculates how much SY + PT (converted to SY equivalent) each LP token represents
    /// @param market The market address to query
    /// @return LP value in SY terms (WAD scaled)
    fn get_lp_to_sy_rate(self: @TContractState, market: ContractAddress) -> u256;

    /// Preview the PT output for an exact SY input swap
    /// @param market The market address
    /// @param sy_in Amount of SY to swap
    /// @return Expected PT output (before slippage, includes fees)
    fn preview_swap_exact_sy_for_pt(
        self: @TContractState, market: ContractAddress, sy_in: u256,
    ) -> u256;

    /// Preview the SY output for an exact PT input swap
    /// @param market The market address
    /// @param pt_in Amount of PT to swap
    /// @return Expected SY output (before slippage, includes fees)
    fn preview_swap_exact_pt_for_sy(
        self: @TContractState, market: ContractAddress, pt_in: u256,
    ) -> u256;

    /// Preview LP output for adding liquidity with only SY
    /// This simulates the add_liquidity_single_sy flow:
    /// 1. Swap some SY for PT to get the right ratio
    /// 2. Add liquidity with remaining SY + received PT
    /// @param market The market address
    /// @param sy_in Total amount of SY to use
    /// @return Expected LP tokens to receive
    fn preview_add_liquidity_single_sy(
        self: @TContractState, market: ContractAddress, sy_in: u256,
    ) -> u256;

    /// Preview SY output for removing liquidity to single SY
    /// This simulates the remove_liquidity_single_sy flow:
    /// 1. Burn LP to get SY + PT
    /// 2. Swap all PT for SY
    /// @param market The market address
    /// @param lp_in Amount of LP tokens to burn
    /// @return Expected SY output
    fn preview_remove_liquidity_single_sy(
        self: @TContractState, market: ContractAddress, lp_in: u256,
    ) -> u256;

    /// Get comprehensive market state for frontend display
    /// @param market The market address
    /// @return MarketInfo struct with all relevant market data
    fn get_market_info(self: @TContractState, market: ContractAddress) -> MarketInfo;
}
