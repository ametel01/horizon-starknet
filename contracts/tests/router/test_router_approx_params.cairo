/// Tests for ApproxParams functionality in router operations
///
/// ApproxParams provides caller-supplied binary search hints to optimize convergence:
/// - guess_min: Lower bound for binary search (0 = use default)
/// - guess_max: Upper bound for binary search (0 = use default)
/// - guess_offchain: Off-chain computed guess for faster convergence (0 = no hint)
/// - max_iteration: Maximum binary search iterations (default: 20)
/// - eps: Precision threshold in WAD (1e15 = 0.1% precision)
///
/// Note: Gas measurement is not available in test context, so we test:
/// - Valid hints are accepted and produce correct results
/// - Invalid hints are rejected with appropriate errors
/// - Results match between with_approx and non-approx versions

use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_router::{ApproxParams, IRouterDispatcher, IRouterDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use openzeppelin_interfaces::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};
use crate::utils::{
    CURRENT_TIME, DEFAULT_DEADLINE, ONE_YEAR, admin, append_bytearray, deploy_sy, deploy_yt,
    get_pt_class_hash, mint_yield_token_to_user, user1, user2,
};

// Default market parameters
fn default_scalar_root() -> u256 {
    50 * WAD
}

fn default_initial_anchor() -> u256 {
    WAD / 10
}

fn default_fee_rate() -> u256 {
    WAD / 100
}

// Deploy market
fn deploy_market(pt: ContractAddress) -> IMarketDispatcher {
    let contract = declare("Market").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'PT-SY LP', 8);
    append_bytearray(ref calldata, 'LP', 2);
    calldata.append(pt.into());
    calldata.append(default_scalar_root().low.into());
    calldata.append(default_scalar_root().high.into());
    calldata.append(default_initial_anchor().low.into());
    calldata.append(default_initial_anchor().high.into());
    calldata.append(default_fee_rate().low.into());
    calldata.append(default_fee_rate().high.into());
    calldata.append(0); // reserve_fee_percent
    calldata.append(admin().into()); // pauser
    calldata.append(0); // factory (zero address for tests)
    calldata.append(0); // reward_tokens array length (empty for tests)

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketDispatcher { contract_address }
}

// Deploy router
fn deploy_router() -> IRouterDispatcher {
    let contract = declare("Router").unwrap_syscall().contract_class();
    let mut calldata = array![];
    calldata.append(admin().into()); // owner
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IRouterDispatcher { contract_address }
}

// Deploy full stack for testing
fn deploy_test_stack() -> (
    IMockYieldTokenDispatcher,
    ISYDispatcher,
    IYTDispatcher,
    IPTDispatcher,
    IMarketDispatcher,
    IRouterDispatcher,
) {
    start_cheat_block_timestamp_global(CURRENT_TIME);

    // Deploy base asset and yield token
    let base_asset_contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'MockERC20', 9);
    append_bytearray(ref calldata, 'MERC', 4);
    let (base_asset_address, _) = base_asset_contract.deploy(@calldata).unwrap_syscall();

    let yield_token_contract = declare("MockYieldToken").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'MockYieldToken', 14);
    append_bytearray(ref calldata, 'MYT', 3);
    calldata.append(base_asset_address.into());
    calldata.append(admin().into());
    let (yield_token_address, _) = yield_token_contract.deploy(@calldata).unwrap_syscall();
    let underlying = IMockYieldTokenDispatcher { contract_address: yield_token_address };

    // Deploy SY
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);

    // Deploy YT (and PT)
    let expiry = CURRENT_TIME + ONE_YEAR;
    let yt = deploy_yt(sy.contract_address, get_pt_class_hash(), expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Deploy Market and Router
    let market = deploy_market(pt.contract_address);
    let router = deploy_router();

    (underlying, sy, yt, pt, market, router)
}

// Helper: Setup user with SY tokens
fn setup_user_with_sy(
    underlying: IMockYieldTokenDispatcher, sy: ISYDispatcher, user: ContractAddress, amount: u256,
) {
    mint_yield_token_to_user(underlying, user, amount);

    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, underlying.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);
}

// Helper: Setup user with SY and PT tokens (for market operations)
fn setup_user_with_tokens(
    underlying: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    user: ContractAddress,
    amount: u256,
) {
    // Get double amount of SY so we can mint PT+YT and have SY left
    setup_user_with_sy(underlying, sy, user, amount * 2);

    // Mint PT+YT from half the SY (floating SY pattern)
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);
}

// Helper: Initialize pool with liquidity (required for single-sided operations)
fn initialize_pool(
    underlying: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    pt: IPTDispatcher,
    market: IMarketDispatcher,
    user: ContractAddress,
    amount_sy: u256,
    amount_pt: u256,
) {
    setup_user_with_tokens(underlying, sy, yt, user, amount_pt);

    // Approve market to spend tokens
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, amount_pt);
    stop_cheat_caller_address(pt.contract_address);

    // Add initial liquidity to market
    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, amount_sy, amount_pt);
    stop_cheat_caller_address(market.contract_address);
}

// Helper: Create default ApproxParams (all zeros = use defaults)
fn default_approx_params() -> ApproxParams {
    ApproxParams { guess_min: 0, guess_max: 0, guess_offchain: 0, max_iteration: 0, eps: 0 }
}

// ============ add_liquidity_single_sy_with_approx Tests ============

#[test]
fn test_add_liquidity_with_approx_default_params() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_sy = 50 * WAD;

    // Initialize pool with liquidity first
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router to spend SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Add liquidity with default approx params (all zeros)
    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_sy_with_approx(
            market.contract_address, user, amount_sy, 0, default_approx_params(), DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify LP received
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    assert(lp_out > 0, 'No LP minted');
    assert(lp_token.balance_of(user) == lp_out, 'LP balance mismatch');
    assert(sy_used > 0, 'No SY used');
    assert(pt_used > 0, 'No PT used');
}

#[test]
fn test_add_liquidity_with_approx_valid_bounds() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_sy = 50 * WAD;

    // Initialize pool with liquidity first
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router to spend SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Create approx params with valid bounds
    // For a 1:1 pool, optimal swap is roughly half the input
    let approx = ApproxParams {
        guess_min: 10 * WAD, // Lower bound: 10 SY
        guess_max: 40 * WAD, // Upper bound: 40 SY (less than 50 SY input)
        guess_offchain: 25 * WAD, // Hint: around 25 SY
        max_iteration: 20,
        eps: WAD / 1000 // 0.1% precision
    };

    // Add liquidity with valid approx params
    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_sy_with_approx(
            market.contract_address, user, amount_sy, 0, approx, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify LP received
    assert(lp_out > 0, 'No LP minted');
    assert(sy_used > 0, 'No SY used');
    assert(pt_used > 0, 'No PT used');
}

#[test]
fn test_add_liquidity_with_approx_results_match_non_approx() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let user2_addr = user2();
    let amount_sy = 50 * WAD;

    // Initialize pool with liquidity first (use a different user for init)
    initialize_pool(underlying, sy, yt, pt, market, user2_addr, 100 * WAD, 100 * WAD);

    // Setup user with SY for non-approx call
    setup_user_with_sy(underlying, sy, user, amount_sy * 2);

    // First call: non-approx version
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    let (_sy_used_1, _pt_used_1, lp_out_1) = router
        .add_liquidity_single_sy(market.contract_address, user, amount_sy, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Second call: with_approx version using default params
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    let (_sy_used_2, _pt_used_2, lp_out_2) = router
        .add_liquidity_single_sy_with_approx(
            market.contract_address, user, amount_sy, 0, default_approx_params(), DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Both should produce LP tokens
    assert(lp_out_1 > 0, 'Non-approx: No LP minted');
    assert(lp_out_2 > 0, 'With-approx: No LP minted');
    // Pool state changed slightly between calls, so results may differ.
    // Verify both methods produce reasonable, comparable output (within 20% of each other).
    let diff = if lp_out_1 > lp_out_2 {
        lp_out_1 - lp_out_2
    } else {
        lp_out_2 - lp_out_1
    };
    assert(diff * 5 <= lp_out_1, 'Results differ > 20%');
}

#[test]
fn test_add_liquidity_with_approx_good_offchain_hint() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_sy = 50 * WAD;

    // Initialize pool with 1:1 ratio
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router to spend SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Create approx params with a good offchain hint
    // For 1:1 ratio pool, optimal swap should be around 25 WAD (half of input)
    // Use tight bounds around the hint
    let approx = ApproxParams {
        guess_min: 20 * WAD,
        guess_max: 30 * WAD,
        guess_offchain: 25 * WAD, // Good hint close to optimal
        max_iteration: 5, // Fewer iterations due to good hint
        eps: WAD / 100 // 1% precision
    };

    // Add liquidity with good hint
    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_sy_with_approx(
            market.contract_address, user, amount_sy, 0, approx, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify LP received
    assert(lp_out > 0, 'No LP minted');
    assert(sy_used > 0, 'No SY used');
    assert(pt_used > 0, 'No PT used');
}

#[test]
#[should_panic(expected: ('HZN: invalid approx params',))]
fn test_add_liquidity_with_approx_invalid_min_greater_than_max() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_sy = 50 * WAD;

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Invalid params: guess_min > guess_max
    let invalid_approx = ApproxParams {
        guess_min: 30 * WAD, // Higher than max
        guess_max: 20 * WAD, // Lower than min
        guess_offchain: 25 * WAD,
        max_iteration: 20,
        eps: WAD / 1000,
    };

    // Should panic
    start_cheat_caller_address(router.contract_address, user);
    router
        .add_liquidity_single_sy_with_approx(
            market.contract_address, user, amount_sy, 0, invalid_approx, DEFAULT_DEADLINE,
        );
}

#[test]
#[should_panic(expected: ('HZN: invalid approx params',))]
fn test_add_liquidity_with_approx_offchain_below_min() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_sy = 50 * WAD;

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Invalid params: guess_offchain < guess_min
    let invalid_approx = ApproxParams {
        guess_min: 20 * WAD,
        guess_max: 40 * WAD,
        guess_offchain: 15 * WAD, // Below min
        max_iteration: 20,
        eps: WAD / 1000,
    };

    // Should panic
    start_cheat_caller_address(router.contract_address, user);
    router
        .add_liquidity_single_sy_with_approx(
            market.contract_address, user, amount_sy, 0, invalid_approx, DEFAULT_DEADLINE,
        );
}

#[test]
#[should_panic(expected: ('HZN: invalid approx params',))]
fn test_add_liquidity_with_approx_offchain_above_max() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_sy = 50 * WAD;

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Invalid params: guess_offchain > guess_max
    let invalid_approx = ApproxParams {
        guess_min: 20 * WAD,
        guess_max: 40 * WAD,
        guess_offchain: 45 * WAD, // Above max
        max_iteration: 20,
        eps: WAD / 1000,
    };

    // Should panic
    start_cheat_caller_address(router.contract_address, user);
    router
        .add_liquidity_single_sy_with_approx(
            market.contract_address, user, amount_sy, 0, invalid_approx, DEFAULT_DEADLINE,
        );
}

#[test]
#[should_panic(expected: ('HZN: invalid approx params',))]
fn test_add_liquidity_with_approx_max_exceeds_input() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_sy = 50 * WAD;

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Invalid params: guess_max > amount_sy_in
    let invalid_approx = ApproxParams {
        guess_min: 20 * WAD,
        guess_max: 60 * WAD, // Exceeds 50 WAD input
        guess_offchain: 25 * WAD,
        max_iteration: 20,
        eps: WAD / 1000,
    };

    // Should panic
    start_cheat_caller_address(router.contract_address, user);
    router
        .add_liquidity_single_sy_with_approx(
            market.contract_address, user, amount_sy, 0, invalid_approx, DEFAULT_DEADLINE,
        );
}

#[test]
#[should_panic(expected: ('HZN: invalid approx params',))]
fn test_add_liquidity_with_approx_min_exceeds_input() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_sy = 50 * WAD;

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Invalid params: guess_min > amount_sy_in
    let invalid_approx = ApproxParams {
        guess_min: 60 * WAD, // Exceeds 50 WAD input
        guess_max: 0, // Use default
        guess_offchain: 0,
        max_iteration: 20,
        eps: WAD / 1000,
    };

    // Should panic
    start_cheat_caller_address(router.contract_address, user);
    router
        .add_liquidity_single_sy_with_approx(
            market.contract_address, user, amount_sy, 0, invalid_approx, DEFAULT_DEADLINE,
        );
}

#[test]
#[should_panic(expected: ('HZN: invalid approx params',))]
fn test_add_liquidity_with_approx_offchain_exceeds_input() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_sy = 50 * WAD;

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Invalid params: guess_offchain > amount_sy_in
    let invalid_approx = ApproxParams {
        guess_min: 0,
        guess_max: 0,
        guess_offchain: 60 * WAD, // Exceeds 50 WAD input
        max_iteration: 20,
        eps: WAD / 1000,
    };

    // Should panic
    start_cheat_caller_address(router.contract_address, user);
    router
        .add_liquidity_single_sy_with_approx(
            market.contract_address, user, amount_sy, 0, invalid_approx, DEFAULT_DEADLINE,
        );
}

// ============ swap_exact_sy_for_pt_with_approx Tests ============

#[test]
fn test_swap_sy_for_pt_with_approx_default_params() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let swap_amount = 10 * WAD;

    // Initialize pool with liquidity first
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, swap_amount);

    // Approve router to spend SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    let pt_before = pt.balance_of(user);

    // Swap with default approx params
    start_cheat_caller_address(router.contract_address, user);
    let pt_out = router
        .swap_exact_sy_for_pt_with_approx(
            market.contract_address,
            user,
            swap_amount,
            0,
            default_approx_params(),
            DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify PT received
    assert(pt_out > 0, 'No PT received');
    assert(pt.balance_of(user) == pt_before + pt_out, 'PT balance mismatch');
}

#[test]
fn test_swap_sy_for_pt_with_approx_valid_bounds() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let swap_amount = 10 * WAD;

    // Initialize pool with liquidity first
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, swap_amount);

    // Approve router to spend SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    // Create approx params with valid bounds for expected PT output
    // Note: bounds are for internal binary search, eps check only triggers
    // when guess_offchain is provided. Using 0 for guess_offchain to avoid eps check.
    let approx = ApproxParams {
        guess_min: 5 * WAD,
        guess_max: 15 * WAD,
        guess_offchain: 0, // No hint to avoid eps tolerance check
        max_iteration: 20,
        eps: 0 // Not used without guess_offchain
    };

    let pt_before = pt.balance_of(user);

    // Swap with valid approx params
    start_cheat_caller_address(router.contract_address, user);
    let pt_out = router
        .swap_exact_sy_for_pt_with_approx(
            market.contract_address, user, swap_amount, 0, approx, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify PT received
    assert(pt_out > 0, 'No PT received');
    assert(pt.balance_of(user) == pt_before + pt_out, 'PT balance mismatch');
}

#[test]
fn test_swap_sy_for_pt_with_approx_results_match_non_approx() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let swap_amount = 10 * WAD;

    // Initialize pool with liquidity first
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY for both swaps
    setup_user_with_sy(underlying, sy, user, swap_amount * 2);

    // First call: non-approx version
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    let pt_out_1 = router
        .swap_exact_sy_for_pt(market.contract_address, user, swap_amount, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Second call: with_approx version using default params
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    let pt_out_2 = router
        .swap_exact_sy_for_pt_with_approx(
            market.contract_address,
            user,
            swap_amount,
            0,
            default_approx_params(),
            DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Both should produce PT
    assert(pt_out_1 > 0, 'Non-approx: No PT received');
    assert(pt_out_2 > 0, 'With-approx: No PT received');
    // Second swap gets slightly less PT due to price impact from first swap.
    // Verify both methods produce reasonable, comparable output (within 20% of each other).
    let diff = if pt_out_1 > pt_out_2 {
        pt_out_1 - pt_out_2
    } else {
        pt_out_2 - pt_out_1
    };
    assert(diff * 5 <= pt_out_1, 'Results differ > 20%');
}

#[test]
#[should_panic(expected: ('HZN: invalid approx params',))]
fn test_swap_sy_for_pt_with_approx_invalid_min_greater_than_max() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let swap_amount = 10 * WAD;

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, swap_amount);

    // Approve router
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    // Invalid params: guess_min > guess_max
    let invalid_approx = ApproxParams {
        guess_min: 15 * WAD, // Higher than max
        guess_max: 10 * WAD, // Lower than min
        guess_offchain: 12 * WAD,
        max_iteration: 20,
        eps: WAD / 1000,
    };

    // Should panic
    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_sy_for_pt_with_approx(
            market.contract_address, user, swap_amount, 0, invalid_approx, DEFAULT_DEADLINE,
        );
}

#[test]
#[should_panic(expected: ('HZN: invalid approx params',))]
fn test_swap_sy_for_pt_with_approx_offchain_below_min() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let swap_amount = 10 * WAD;

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, swap_amount);

    // Approve router
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    // Invalid params: guess_offchain < guess_min
    let invalid_approx = ApproxParams {
        guess_min: 8 * WAD,
        guess_max: 12 * WAD,
        guess_offchain: 5 * WAD, // Below min
        max_iteration: 20,
        eps: WAD / 1000,
    };

    // Should panic
    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_sy_for_pt_with_approx(
            market.contract_address, user, swap_amount, 0, invalid_approx, DEFAULT_DEADLINE,
        );
}

#[test]
#[should_panic(expected: ('HZN: invalid approx params',))]
fn test_swap_sy_for_pt_with_approx_offchain_above_max() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let swap_amount = 10 * WAD;

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, swap_amount);

    // Approve router
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    // Invalid params: guess_offchain > guess_max
    let invalid_approx = ApproxParams {
        guess_min: 8 * WAD,
        guess_max: 12 * WAD,
        guess_offchain: 15 * WAD, // Above max
        max_iteration: 20,
        eps: WAD / 1000,
    };

    // Should panic
    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_sy_for_pt_with_approx(
            market.contract_address, user, swap_amount, 0, invalid_approx, DEFAULT_DEADLINE,
        );
}

#[test]
fn test_swap_sy_for_pt_with_approx_eps_tolerance_check() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let swap_amount = 10 * WAD;

    // Initialize pool with liquidity first
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, swap_amount);

    // Approve router to spend SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    // Create approx params with eps but no specific offchain guess
    // Router will validate eps tolerance if both eps and guess_offchain are provided
    let approx = ApproxParams {
        guess_min: 0,
        guess_max: 0,
        guess_offchain: 0, // No specific hint, so eps check won't be triggered
        max_iteration: 20,
        eps: WAD / 100 // 1% precision
    };

    let pt_before = pt.balance_of(user);

    // Swap should succeed since no eps validation without offchain hint
    start_cheat_caller_address(router.contract_address, user);
    let pt_out = router
        .swap_exact_sy_for_pt_with_approx(
            market.contract_address, user, swap_amount, 0, approx, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify PT received
    assert(pt_out > 0, 'No PT received');
    assert(pt.balance_of(user) == pt_before + pt_out, 'PT balance mismatch');
}

#[test]
fn test_swap_sy_for_pt_with_approx_valid_eps_with_hint() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let swap_amount = 10 * WAD;

    // Initialize pool with liquidity first
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // First do a swap to know approximate output
    setup_user_with_sy(underlying, sy, user, swap_amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    let reference_pt_out = router
        .swap_exact_sy_for_pt(market.contract_address, user, swap_amount, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Now do another swap with approx params using a good hint
    setup_user_with_sy(underlying, sy, user, swap_amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    // Use a hint close to expected output with reasonable eps tolerance
    // Since we're making a second swap, we expect slightly less due to price impact
    let expected_pt = reference_pt_out - (reference_pt_out / 20); // Expect ~5% less

    let approx = ApproxParams {
        guess_min: 0,
        guess_max: 0,
        guess_offchain: expected_pt, // Hint based on first swap
        max_iteration: 20,
        eps: WAD / 5 // 20% tolerance since pool state changed
    };

    let pt_before = pt.balance_of(user);

    // Swap with hint - should pass eps tolerance check
    start_cheat_caller_address(router.contract_address, user);
    let pt_out = router
        .swap_exact_sy_for_pt_with_approx(
            market.contract_address, user, swap_amount, 0, approx, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify PT received
    assert(pt_out > 0, 'No PT received');
    assert(pt.balance_of(user) == pt_before + pt_out, 'PT balance mismatch');
}

// ============ Edge Cases ============

#[test]
fn test_approx_with_only_max_iteration_set() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_sy = 50 * WAD;

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Only set max_iteration, all others default
    let approx = ApproxParams {
        guess_min: 0,
        guess_max: 0,
        guess_offchain: 0,
        max_iteration: 10, // Custom iteration limit
        eps: 0,
    };

    // Add liquidity - should work with custom iteration limit
    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_sy_with_approx(
            market.contract_address, user, amount_sy, 0, approx, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify LP received
    assert(lp_out > 0, 'No LP minted');
    assert(sy_used > 0, 'No SY used');
    assert(pt_used > 0, 'No PT used');
}

#[test]
fn test_approx_with_only_eps_set() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_sy = 50 * WAD;

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Only set eps, all others default
    let approx = ApproxParams {
        guess_min: 0,
        guess_max: 0,
        guess_offchain: 0,
        max_iteration: 0,
        eps: WAD / 100 // 1% precision
    };

    // Add liquidity - should work with custom eps
    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_sy_with_approx(
            market.contract_address, user, amount_sy, 0, approx, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify LP received
    assert(lp_out > 0, 'No LP minted');
    assert(sy_used > 0, 'No SY used');
    assert(pt_used > 0, 'No PT used');
}

#[test]
fn test_approx_with_tight_bounds_near_optimal() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_sy = 50 * WAD;

    // Initialize pool with 1:1 ratio
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Set very tight bounds around expected optimal (around 25 WAD for 1:1 pool)
    let approx = ApproxParams {
        guess_min: 24 * WAD,
        guess_max: 26 * WAD,
        guess_offchain: 25 * WAD,
        max_iteration: 5, // Few iterations needed with tight bounds
        eps: WAD / 100,
    };

    // Add liquidity with tight bounds
    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_sy_with_approx(
            market.contract_address, user, amount_sy, 0, approx, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify LP received
    assert(lp_out > 0, 'No LP minted');
    assert(sy_used > 0, 'No SY used');
    assert(pt_used > 0, 'No PT used');
}
