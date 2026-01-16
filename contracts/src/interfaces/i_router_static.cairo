use starknet::ContractAddress;

/// Input parameters for preview_swap_exact_token_for_pt
/// Since aggregators cannot be called in view context, the caller must provide
/// the estimated SY amount from off-chain aggregator quote simulation.
#[derive(Drop, Serde)]
pub struct TokenToSyEstimate {
    /// Input token address
    pub token: ContractAddress,
    /// Amount of input token
    pub amount: u256,
    /// Estimated SY amount after aggregator swap and deposit
    /// For underlying tokens: use SY.preview_deposit(amount)
    /// For other tokens: get quote from aggregator off-chain, then preview_deposit
    pub estimated_sy_amount: u256,
}

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

    /// Get the LP token value in PT terms
    /// This calculates how much PT each LP token represents when all value is converted to PT
    /// @param market The market address to query
    /// @return LP value in PT terms (WAD scaled)
    fn get_lp_to_pt_rate(self: @TContractState, market: ContractAddress) -> u256;

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

    /// Preview PT output for swapping any token to PT via aggregator
    /// Since aggregators cannot be called in view context, the frontend must:
    /// 1. Get aggregator quote off-chain (token -> underlying)
    /// 2. Call SY.preview_deposit() with the underlying amount
    /// 3. Pass the estimated SY amount in the estimate parameter
    /// This function then calculates the expected PT output from that SY amount.
    /// @param market The market address for PT/SY swaps
    /// @param estimate Token input with pre-calculated SY estimate from aggregator
    /// @return Expected PT output (before slippage, includes market fees)
    fn preview_swap_exact_token_for_pt(
        self: @TContractState, market: ContractAddress, estimate: TokenToSyEstimate,
    ) -> u256;
}
