use starknet::ContractAddress;

/// Router interface - user-friendly entry point for all protocol operations
/// Handles approvals, slippage protection, and multi-hop operations
///
/// SECURITY: All operations include deadline parameter to prevent stale transactions
/// from executing at unfavorable prices after market conditions change.
#[starknet::interface]
pub trait IRouter<TContractState> {
    // ============ Admin Functions ============

    /// Pause all router operations (PAUSER_ROLE only)
    fn pause(ref self: TContractState);

    /// Unpause all router operations (PAUSER_ROLE only)
    fn unpause(ref self: TContractState);

    /// Initialize RBAC after upgrade (one-time setup)
    fn initialize_rbac(ref self: TContractState);

    // ============ PT/YT Minting & Redemption ============

    /// Mint PT and YT from SY tokens
    /// @param yt The YT contract address
    /// @param receiver Address to receive PT and YT
    /// @param amount_sy_in Amount of SY to deposit
    /// @param min_py_out Minimum PT/YT to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return (pt_minted, yt_minted)
    fn mint_py_from_sy(
        ref self: TContractState,
        yt: ContractAddress,
        receiver: ContractAddress,
        amount_sy_in: u256,
        min_py_out: u256,
        deadline: u64,
    ) -> (u256, u256);

    /// Redeem PT and YT for SY tokens (before expiry)
    /// @param yt The YT contract address
    /// @param receiver Address to receive SY
    /// @param amount_py_in Amount of PT/YT to redeem
    /// @param min_sy_out Minimum SY to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of SY received
    fn redeem_py_to_sy(
        ref self: TContractState,
        yt: ContractAddress,
        receiver: ContractAddress,
        amount_py_in: u256,
        min_sy_out: u256,
        deadline: u64,
    ) -> u256;

    /// Redeem PT for SY after expiry (YT not required)
    /// @param yt The YT contract address
    /// @param receiver Address to receive SY
    /// @param amount_pt_in Amount of PT to redeem
    /// @param min_sy_out Minimum SY to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of SY received
    fn redeem_pt_post_expiry(
        ref self: TContractState,
        yt: ContractAddress,
        receiver: ContractAddress,
        amount_pt_in: u256,
        min_sy_out: u256,
        deadline: u64,
    ) -> u256;

    // ============ Market Liquidity Operations ============

    /// Add liquidity to a market
    /// @param market The market address
    /// @param receiver Address to receive LP tokens
    /// @param sy_desired Amount of SY to add
    /// @param pt_desired Amount of PT to add
    /// @param min_lp_out Minimum LP tokens to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return (sy_used, pt_used, lp_minted)
    fn add_liquidity(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        sy_desired: u256,
        pt_desired: u256,
        min_lp_out: u256,
        deadline: u64,
    ) -> (u256, u256, u256);

    /// Remove liquidity from a market
    /// @param market The market address
    /// @param receiver Address to receive tokens
    /// @param lp_to_burn Amount of LP tokens to burn
    /// @param min_sy_out Minimum SY to receive (slippage protection)
    /// @param min_pt_out Minimum PT to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return (sy_out, pt_out)
    fn remove_liquidity(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        lp_to_burn: u256,
        min_sy_out: u256,
        min_pt_out: u256,
        deadline: u64,
    ) -> (u256, u256);

    /// Add liquidity using only SY (auto-swaps to balance)
    /// @param market The market address
    /// @param receiver Recipient of LP tokens
    /// @param amount_sy_in Total SY to deposit
    /// @param min_lp_out Minimum LP tokens to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return (sy_used, pt_used, lp_minted) - Actual amounts used and LP received
    fn add_liquidity_single_sy(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        amount_sy_in: u256,
        min_lp_out: u256,
        deadline: u64,
    ) -> (u256, u256, u256);

    // ============ Market Swap Operations ============

    /// Swap exact SY for PT
    /// @param market The market address
    /// @param receiver Address to receive PT
    /// @param exact_sy_in Exact amount of SY to sell
    /// @param min_pt_out Minimum PT to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of PT received
    fn swap_exact_sy_for_pt(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        exact_sy_in: u256,
        min_pt_out: u256,
        deadline: u64,
    ) -> u256;

    /// Swap exact PT for SY
    /// @param market The market address
    /// @param receiver Address to receive SY
    /// @param exact_pt_in Exact amount of PT to sell
    /// @param min_sy_out Minimum SY to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of SY received
    fn swap_exact_pt_for_sy(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        exact_pt_in: u256,
        min_sy_out: u256,
        deadline: u64,
    ) -> u256;

    /// Swap SY for exact PT
    /// @param market The market address
    /// @param receiver Address to receive PT
    /// @param exact_pt_out Exact amount of PT to receive
    /// @param max_sy_in Maximum SY to spend (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of SY spent
    fn swap_sy_for_exact_pt(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        exact_pt_out: u256,
        max_sy_in: u256,
        deadline: u64,
    ) -> u256;

    /// Swap PT for exact SY
    /// @param market The market address
    /// @param receiver Address to receive SY
    /// @param exact_sy_out Exact amount of SY to receive
    /// @param max_pt_in Maximum PT to spend (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of PT spent
    fn swap_pt_for_exact_sy(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        exact_sy_out: u256,
        max_pt_in: u256,
        deadline: u64,
    ) -> u256;

    // ============ Combined Operations ============

    /// Mint PT+YT from SY, then swap YT's worth of PT for more SY (net long PT position)
    /// This is useful for users who want to go long on PT yield
    /// @param yt The YT contract address
    /// @param market The market address
    /// @param receiver Address to receive PT
    /// @param amount_sy_in Amount of SY to start with
    /// @param min_pt_out Minimum PT to end up with
    /// @param deadline Transaction must complete before this timestamp
    /// @return (pt_out, yt_out) - PT received, YT received (user keeps both)
    fn mint_py_and_keep(
        ref self: TContractState,
        yt: ContractAddress,
        market: ContractAddress,
        receiver: ContractAddress,
        amount_sy_in: u256,
        min_pt_out: u256,
        deadline: u64,
    ) -> (u256, u256);

    /// Swap SY for PT, then redeem PT+YT for SY after buying YT from another source
    /// Simplified: just do the swap through the market
    /// @param market The market address
    /// @param receiver Address to receive PT
    /// @param amount_sy_in Amount of SY to swap
    /// @param min_pt_out Minimum PT to receive
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of PT received
    fn buy_pt_from_sy(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        amount_sy_in: u256,
        min_pt_out: u256,
        deadline: u64,
    ) -> u256;

    /// Sell PT for SY through the market
    /// @param market The market address
    /// @param receiver Address to receive SY
    /// @param amount_pt_in Amount of PT to sell
    /// @param min_sy_out Minimum SY to receive
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of SY received
    fn sell_pt_for_sy(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        amount_pt_in: u256,
        min_sy_out: u256,
        deadline: u64,
    ) -> u256;

    // ============ YT Trading Operations (via Flash Swaps) ============

    /// Buy YT using SY through the PT/SY market
    /// Mechanism: Mint PT+YT from SY, sell PT back to market, keep YT
    /// @param yt The YT contract address
    /// @param market The PT/SY market address
    /// @param receiver Address to receive YT
    /// @param exact_sy_in Exact amount of SY to spend
    /// @param min_yt_out Minimum YT to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of YT received
    fn swap_exact_sy_for_yt(
        ref self: TContractState,
        yt: ContractAddress,
        market: ContractAddress,
        receiver: ContractAddress,
        exact_sy_in: u256,
        min_yt_out: u256,
        deadline: u64,
    ) -> u256;

    /// Sell YT for SY through the PT/SY market
    /// Mechanism: Buy PT from market using caller's SY collateral, combine with YT to redeem SY
    /// @param yt The YT contract address
    /// @param market The PT/SY market address
    /// @param receiver Address to receive SY
    /// @param exact_yt_in Exact amount of YT to sell
    /// @param max_sy_collateral Maximum SY caller will provide as collateral to buy PT
    /// @param min_sy_out Minimum net SY to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of net SY received (after collateral refund)
    fn swap_exact_yt_for_sy(
        ref self: TContractState,
        yt: ContractAddress,
        market: ContractAddress,
        receiver: ContractAddress,
        exact_yt_in: u256,
        max_sy_collateral: u256,
        min_sy_out: u256,
        deadline: u64,
    ) -> u256;
}
