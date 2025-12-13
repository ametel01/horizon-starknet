use starknet::ContractAddress;

/// Router interface - user-friendly entry point for all protocol operations
/// Handles approvals, slippage protection, and multi-hop operations
#[starknet::interface]
pub trait IRouter<TContractState> {
    // ============ PT/YT Minting & Redemption ============

    /// Mint PT and YT from SY tokens
    /// @param yt The YT contract address
    /// @param receiver Address to receive PT and YT
    /// @param amount_sy_in Amount of SY to deposit
    /// @param min_py_out Minimum PT/YT to receive (slippage protection)
    /// @return (pt_minted, yt_minted)
    fn mint_py_from_sy(
        ref self: TContractState,
        yt: ContractAddress,
        receiver: ContractAddress,
        amount_sy_in: u256,
        min_py_out: u256,
    ) -> (u256, u256);

    /// Redeem PT and YT for SY tokens (before expiry)
    /// @param yt The YT contract address
    /// @param receiver Address to receive SY
    /// @param amount_py_in Amount of PT/YT to redeem
    /// @param min_sy_out Minimum SY to receive (slippage protection)
    /// @return Amount of SY received
    fn redeem_py_to_sy(
        ref self: TContractState,
        yt: ContractAddress,
        receiver: ContractAddress,
        amount_py_in: u256,
        min_sy_out: u256,
    ) -> u256;

    /// Redeem PT for SY after expiry (YT not required)
    /// @param yt The YT contract address
    /// @param receiver Address to receive SY
    /// @param amount_pt_in Amount of PT to redeem
    /// @param min_sy_out Minimum SY to receive (slippage protection)
    /// @return Amount of SY received
    fn redeem_pt_post_expiry(
        ref self: TContractState,
        yt: ContractAddress,
        receiver: ContractAddress,
        amount_pt_in: u256,
        min_sy_out: u256,
    ) -> u256;

    // ============ Market Liquidity Operations ============

    /// Add liquidity to a market
    /// @param market The market address
    /// @param receiver Address to receive LP tokens
    /// @param sy_desired Amount of SY to add
    /// @param pt_desired Amount of PT to add
    /// @param min_lp_out Minimum LP tokens to receive (slippage protection)
    /// @return (sy_used, pt_used, lp_minted)
    fn add_liquidity(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        sy_desired: u256,
        pt_desired: u256,
        min_lp_out: u256,
    ) -> (u256, u256, u256);

    /// Remove liquidity from a market
    /// @param market The market address
    /// @param receiver Address to receive tokens
    /// @param lp_to_burn Amount of LP tokens to burn
    /// @param min_sy_out Minimum SY to receive (slippage protection)
    /// @param min_pt_out Minimum PT to receive (slippage protection)
    /// @return (sy_out, pt_out)
    fn remove_liquidity(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        lp_to_burn: u256,
        min_sy_out: u256,
        min_pt_out: u256,
    ) -> (u256, u256);

    // ============ Market Swap Operations ============

    /// Swap exact SY for PT
    /// @param market The market address
    /// @param receiver Address to receive PT
    /// @param exact_sy_in Exact amount of SY to sell
    /// @param min_pt_out Minimum PT to receive (slippage protection)
    /// @return Amount of PT received
    fn swap_exact_sy_for_pt(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        exact_sy_in: u256,
        min_pt_out: u256,
    ) -> u256;

    /// Swap exact PT for SY
    /// @param market The market address
    /// @param receiver Address to receive SY
    /// @param exact_pt_in Exact amount of PT to sell
    /// @param min_sy_out Minimum SY to receive (slippage protection)
    /// @return Amount of SY received
    fn swap_exact_pt_for_sy(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        exact_pt_in: u256,
        min_sy_out: u256,
    ) -> u256;

    /// Swap SY for exact PT
    /// @param market The market address
    /// @param receiver Address to receive PT
    /// @param exact_pt_out Exact amount of PT to receive
    /// @param max_sy_in Maximum SY to spend (slippage protection)
    /// @return Amount of SY spent
    fn swap_sy_for_exact_pt(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        exact_pt_out: u256,
        max_sy_in: u256,
    ) -> u256;

    /// Swap PT for exact SY
    /// @param market The market address
    /// @param receiver Address to receive SY
    /// @param exact_sy_out Exact amount of SY to receive
    /// @param max_pt_in Maximum PT to spend (slippage protection)
    /// @return Amount of PT spent
    fn swap_pt_for_exact_sy(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        exact_sy_out: u256,
        max_pt_in: u256,
    ) -> u256;

    // ============ Combined Operations ============

    /// Mint PT+YT from SY, then swap YT's worth of PT for more SY (net long PT position)
    /// This is useful for users who want to go long on PT yield
    /// @param yt The YT contract address
    /// @param market The market address
    /// @param receiver Address to receive PT
    /// @param amount_sy_in Amount of SY to start with
    /// @param min_pt_out Minimum PT to end up with
    /// @return (pt_out, yt_out) - PT received, YT received (user keeps both)
    fn mint_py_and_keep(
        ref self: TContractState,
        yt: ContractAddress,
        market: ContractAddress,
        receiver: ContractAddress,
        amount_sy_in: u256,
        min_pt_out: u256,
    ) -> (u256, u256);

    /// Swap SY for PT, then redeem PT+YT for SY after buying YT from another source
    /// Simplified: just do the swap through the market
    /// @param market The market address
    /// @param receiver Address to receive PT
    /// @param amount_sy_in Amount of SY to swap
    /// @param min_pt_out Minimum PT to receive
    /// @return Amount of PT received
    fn buy_pt_from_sy(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        amount_sy_in: u256,
        min_pt_out: u256,
    ) -> u256;

    /// Sell PT for SY through the market
    /// @param market The market address
    /// @param receiver Address to receive SY
    /// @param amount_pt_in Amount of PT to sell
    /// @param min_sy_out Minimum SY to receive
    /// @return Amount of SY received
    fn sell_pt_for_sy(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        amount_pt_in: u256,
        min_sy_out: u256,
    ) -> u256;
}
