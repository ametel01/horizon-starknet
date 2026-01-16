use starknet::ContractAddress;

/// Data for executing a swap through an external aggregator
/// @param aggregator Address of the swap aggregator contract
/// @param calldata Encoded calldata to pass to the aggregator
#[derive(Drop, Serde, Clone)]
pub struct SwapData {
    pub aggregator: ContractAddress,
    pub calldata: Span<felt252>,
}

/// Represents an input token to be swapped to SY via an aggregator
/// @param token Address of the input ERC20 token
/// @param amount Amount of token to swap
/// @param swap_data Data for executing the swap (aggregator and calldata)
#[derive(Drop, Serde, Clone)]
pub struct TokenInput {
    pub token: ContractAddress,
    pub amount: u256,
    pub swap_data: SwapData,
}

/// Represents an output token to receive after swapping from SY via an aggregator
/// @param token Address of the output ERC20 token
/// @param min_amount Minimum amount of token to receive (slippage protection)
/// @param swap_data Data for executing the swap (aggregator and calldata)
#[derive(Drop, Serde, Clone)]
pub struct TokenOutput {
    pub token: ContractAddress,
    pub min_amount: u256,
    pub swap_data: SwapData,
}

/// Represents a single call in a multicall batch
/// @param to Target contract address
/// @param selector Function selector to call
/// @param calldata Serialized function arguments
#[derive(Drop, Serde)]
pub struct Call {
    pub to: ContractAddress,
    pub selector: felt252,
    pub calldata: Span<felt252>,
}

/// Approximation parameters for binary search in swap/liquidity calculations
/// Matches Pendle's ApproxParams design for caller-provided search hints
/// @param guess_min Lower bound for binary search (0 = use default)
/// @param guess_max Upper bound for binary search (0 = use default)
/// @param guess_offchain Off-chain computed guess for faster convergence (0 = no hint)
/// @param max_iteration Maximum binary search iterations (default: 20)
/// @param eps Precision threshold in WAD (1e15 = 0.1% precision)
#[derive(Drop, Serde, Copy)]
pub struct ApproxParams {
    pub guess_min: u256,
    pub guess_max: u256,
    pub guess_offchain: u256,
    pub max_iteration: u256,
    pub eps: u256,
}

/// Router interface - user-friendly entry point for all protocol operations
/// Handles approvals, slippage protection, and multi-hop operations
///
/// SECURITY: All operations include deadline parameter to prevent stale transactions
/// from executing at unfavorable prices after market conditions change.
#[starknet::interface]
pub trait IRouter<TContractState> {
    // ============ Multicall ============

    /// Execute multiple calls to this router in a single transaction
    /// SECURITY: Only allows calls to self (this router) to prevent arbitrary external calls
    /// @param calls Array of calls to execute (all must target this router)
    /// @return Array of return data from each call
    fn multicall(ref self: TContractState, calls: Span<Call>) -> Array<Span<felt252>>;

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

    /// Add liquidity using only PT (auto-swaps to balance)
    /// @param market The market address
    /// @param receiver Recipient of LP tokens
    /// @param amount_pt_in Total PT to deposit
    /// @param min_lp_out Minimum LP tokens to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return (sy_used, pt_used, lp_minted) - Actual amounts used and LP received
    fn add_liquidity_single_pt(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        amount_pt_in: u256,
        min_lp_out: u256,
        deadline: u64,
    ) -> (u256, u256, u256);

    /// Remove liquidity and receive only SY (auto-swaps PT to SY)
    /// @param market The market address
    /// @param receiver Address to receive SY tokens
    /// @param lp_to_burn Amount of LP tokens to burn
    /// @param min_sy_out Minimum SY to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of SY received
    fn remove_liquidity_single_sy(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        lp_to_burn: u256,
        min_sy_out: u256,
        deadline: u64,
    ) -> u256;

    /// Remove liquidity and receive only PT (auto-swaps SY to PT)
    /// @param market The market address
    /// @param receiver Address to receive PT tokens
    /// @param lp_to_burn Amount of LP tokens to burn
    /// @param min_pt_out Minimum PT to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of PT received
    fn remove_liquidity_single_pt(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        lp_to_burn: u256,
        min_pt_out: u256,
        deadline: u64,
    ) -> u256;

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

    /// Swap exact SY for PT with caller-provided binary search hints
    /// Uses ApproxParams to optimize binary search convergence
    /// Falls back to default binary search when hints are invalid (zero values)
    /// @param market The market address
    /// @param receiver Address to receive PT
    /// @param exact_sy_in Exact amount of SY to sell
    /// @param min_pt_out Minimum PT to receive (slippage protection)
    /// @param approx Binary search hints for optimized convergence
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of PT received
    fn swap_exact_sy_for_pt_with_approx(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        exact_sy_in: u256,
        min_pt_out: u256,
        approx: ApproxParams,
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

    // ============ LP Rollover Operations ============

    /// Rollover LP position from one market to another with the same PT
    /// Burns LP in old market, uses SY+PT to add liquidity in new market
    /// Note: Both markets must share the same SY (underlying) and PT
    /// This is useful for migrating between markets with identical tokens
    /// For cross-expiry rollovers, PT must first be redeemed/converted separately
    /// @param market_old Old market address
    /// @param market_new New market address
    /// @param lp_to_rollover Amount of LP to migrate
    /// @param min_lp_out Minimum LP to receive in new market
    /// @param deadline Transaction deadline
    /// @return lp_new Amount of LP received in new market
    fn rollover_lp(
        ref self: TContractState,
        market_old: ContractAddress,
        market_new: ContractAddress,
        lp_to_rollover: u256,
        min_lp_out: u256,
        deadline: u64,
    ) -> u256;

    // ============ Batch Operations ============

    /// Claim all pending interest from YT tokens and rewards from markets
    /// Iterates through provided YT and market arrays, claiming for the user
    /// @param user Address to claim interest and rewards for
    /// @param yts Array of YT contract addresses to claim interest from
    /// @param markets Array of market addresses to claim rewards from
    /// @return (total_interest, rewards_per_market) - Total SY interest claimed and rewards array
    fn redeem_due_interest_and_rewards(
        ref self: TContractState,
        user: ContractAddress,
        yts: Span<ContractAddress>,
        markets: Span<ContractAddress>,
    ) -> (u256, Array<Span<u256>>);

    // ============ Aggregator Swap Operations ============

    /// Swap any token for PT through an external aggregator
    /// Flow: token_in -> aggregator -> underlying -> SY deposit -> market swap -> PT
    /// @param market The market address for PT/SY swaps
    /// @param receiver Address to receive PT
    /// @param input Token input with aggregator swap data
    /// @param min_pt_out Minimum PT to receive (final slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of PT received
    fn swap_exact_token_for_pt(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        input: TokenInput,
        min_pt_out: u256,
        deadline: u64,
    ) -> u256;

    /// Swap PT for any token through an external aggregator
    /// Flow: PT -> market swap -> SY -> SY redeem -> underlying -> aggregator -> token_out
    /// @param market The market address for PT/SY swaps
    /// @param receiver Address to receive output token
    /// @param exact_pt_in Exact amount of PT to sell
    /// @param output Token output with aggregator swap data and min amount
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of output token received
    fn swap_exact_pt_for_token(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        exact_pt_in: u256,
        output: TokenOutput,
        deadline: u64,
    ) -> u256;

    /// Swap any token for YT through an external aggregator
    /// Flow: token_in -> aggregator -> underlying -> SY deposit -> mint PT+YT -> sell PT -> YT
    /// @param yt The YT contract address
    /// @param market The market address for PT/SY swaps
    /// @param receiver Address to receive YT
    /// @param input Token input with aggregator swap data
    /// @param min_yt_out Minimum YT to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of YT received
    fn swap_exact_token_for_yt(
        ref self: TContractState,
        yt: ContractAddress,
        market: ContractAddress,
        receiver: ContractAddress,
        input: TokenInput,
        min_yt_out: u256,
        deadline: u64,
    ) -> u256;

    /// Swap YT for any token through an external aggregator
    /// Flow: YT + collateral -> buy PT -> redeem PT+YT -> SY -> redeem -> underlying -> aggregator
    /// -> token_out
    /// @param yt The YT contract address
    /// @param market The market address for PT/SY swaps
    /// @param receiver Address to receive output token
    /// @param exact_yt_in Exact amount of YT to sell
    /// @param max_sy_collateral Maximum SY caller will provide as collateral to buy PT
    /// @param output Token output with aggregator swap data and min amount
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of output token received
    fn swap_exact_yt_for_token(
        ref self: TContractState,
        yt: ContractAddress,
        market: ContractAddress,
        receiver: ContractAddress,
        exact_yt_in: u256,
        max_sy_collateral: u256,
        output: TokenOutput,
        deadline: u64,
    ) -> u256;

    // ============ Aggregator Liquidity Operations ============

    /// Add liquidity using any token through an external aggregator
    /// Flow: token_in -> aggregator -> underlying -> SY deposit -> add_liquidity_single_sy -> LP
    /// @param market The market address
    /// @param receiver Address to receive LP tokens
    /// @param input Token input with aggregator swap data
    /// @param min_lp_out Minimum LP tokens to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return (sy_used, pt_used, lp_minted) - Actual amounts used and LP received
    fn add_liquidity_single_token(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        input: TokenInput,
        min_lp_out: u256,
        deadline: u64,
    ) -> (u256, u256, u256);

    /// Add liquidity using any token while keeping YT through an external aggregator
    /// Flow: token_in -> aggregator -> underlying -> SY deposit -> mint PT+YT -> add liquidity with
    /// PT -> keep YT
    /// @param market The market address
    /// @param receiver Address to receive LP tokens and YT
    /// @param input Token input with aggregator swap data
    /// @param min_lp_out Minimum LP tokens to receive (slippage protection)
    /// @param min_yt_out Minimum YT tokens to receive (slippage protection)
    /// @param deadline Transaction must complete before this timestamp
    /// @return (lp_minted, yt_received) - LP tokens minted and YT tokens kept
    fn add_liquidity_single_token_keep_yt(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        input: TokenInput,
        min_lp_out: u256,
        min_yt_out: u256,
        deadline: u64,
    ) -> (u256, u256);

    /// Remove liquidity and receive any token through an external aggregator
    /// Flow: LP -> burn -> SY + PT -> swap PT for SY -> redeem SY -> underlying -> aggregator ->
    /// token_out
    /// @param market The market address
    /// @param receiver Address to receive output token
    /// @param lp_to_burn Amount of LP tokens to burn
    /// @param output Token output with aggregator swap data and min amount
    /// @param deadline Transaction must complete before this timestamp
    /// @return Amount of output token received
    fn remove_liquidity_single_token(
        ref self: TContractState,
        market: ContractAddress,
        receiver: ContractAddress,
        lp_to_burn: u256,
        output: TokenOutput,
        deadline: u64,
    ) -> u256;
}
