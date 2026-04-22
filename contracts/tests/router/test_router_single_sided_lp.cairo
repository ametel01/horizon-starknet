use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_router::{IRouterDispatcher, IRouterDispatcherTrait};
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

// Deploy market (not in utils.cairo)
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

// Deploy router (not in utils.cairo)
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

// ============ Single-Sided Liquidity Tests ============

#[test]
fn test_add_liquidity_single_sy() {
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

    // Get initial balances
    let sy_balance_before = sy.balance_of(user);

    // Add single-sided liquidity
    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_sy(market.contract_address, user, amount_sy, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Verify LP received
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    assert(lp_out > 0, 'No LP minted');
    assert(lp_token.balance_of(user) == lp_out, 'LP balance mismatch');

    // Verify both SY and PT were used (single-sided means we swap some SY to PT)
    assert(sy_used > 0, 'No SY used');
    assert(pt_used > 0, 'No PT used');
    assert(sy_used <= amount_sy, 'Used more SY than input');

    // Verify SY balance decreased
    let sy_balance_after = sy.balance_of(user);
    assert(sy_balance_before - sy_balance_after <= amount_sy, 'SY balance check failed');
}

#[test]
fn test_add_liquidity_single_pt() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_pt = 50 * WAD;

    // Initialize pool with liquidity first
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with PT tokens
    setup_user_with_tokens(underlying, sy, yt, user, amount_pt);

    // Approve router to spend PT
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(router.contract_address, amount_pt);
    stop_cheat_caller_address(pt.contract_address);

    // Get initial balances
    let pt_balance_before = pt.balance_of(user);

    // Add single-sided liquidity
    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_pt(market.contract_address, user, amount_pt, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Verify LP received
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    assert(lp_out > 0, 'No LP minted');
    assert(lp_token.balance_of(user) == lp_out, 'LP balance mismatch');

    // Verify both SY and PT were used (single-sided means we swap some PT to SY)
    assert(sy_used > 0, 'No SY used');
    assert(pt_used > 0, 'No PT used');
    assert(pt_used <= amount_pt, 'Used more PT than input');

    // Verify PT balance decreased
    let pt_balance_after = pt.balance_of(user);
    assert(pt_balance_before - pt_balance_after <= amount_pt, 'PT balance check failed');
}

#[test]
#[should_panic(expected: ('HZN: slippage exceeded',))]
fn test_single_sided_slippage_protection() {
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

    // Try to add liquidity with unrealistically high min_lp_out (should fail)
    start_cheat_caller_address(router.contract_address, user);
    router
        .add_liquidity_single_sy(
            market.contract_address, user, amount_sy, amount_sy * 1000, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);
}

#[test]
fn test_single_sided_dust_returned() {
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

    // Get initial balances
    let sy_balance_before = sy.balance_of(user);
    let pt_balance_before = pt.balance_of(user);

    // Add single-sided liquidity
    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, _pt_used, lp_out) = router
        .add_liquidity_single_sy(market.contract_address, user, amount_sy, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Get final balances
    let sy_balance_after = sy.balance_of(user);
    let pt_balance_after = pt.balance_of(user);

    // Verify LP received
    assert(lp_out > 0, 'No LP minted');

    // Verify dust is returned correctly:
    // - SY: User should have paid exactly sy_used (rest returned as dust)
    // - PT: Any PT dust from the swap should be returned to user
    let sy_consumed = sy_balance_before - sy_balance_after;
    assert(sy_consumed == sy_used, 'SY dust not returned');
    // PT dust (if any) should be returned - user started with 0, may receive dust back
    assert(pt_balance_after >= pt_balance_before, 'PT dust not returned');
}

#[test]
fn test_single_sided_optimal_ratio() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_sy = 50 * WAD;

    // Initialize pool with 1:1 ratio
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Get initial reserves
    let (sy_reserve_before, _pt_reserve_before) = market.get_reserves();

    // Setup user with SY
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Add single-sided liquidity
    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_sy(market.contract_address, user, amount_sy, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Verify LP received
    assert(lp_out > 0, 'No LP minted');

    // Verify both SY and PT were consumed (proving swap happened)
    assert(sy_used > 0, 'No SY used');
    assert(pt_used > 0, 'No PT used');
    assert(sy_used <= amount_sy, 'Used more SY than input');

    // Get pool reserves after adding liquidity
    let (sy_reserve_after, _pt_reserve_after) = market.get_reserves();

    // Verify SY reserve increased (we deposited SY)
    // Note: PT reserve might decrease because we swap SY->PT first
    assert(sy_reserve_after > sy_reserve_before, 'SY reserve not increased');

    // Verify total LP supply increased (liquidity was added)
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    assert(lp_token.total_supply() > sy_reserve_before, 'LP supply not increased');
}

#[test]
#[should_panic(expected: ('HZN: insufficient liquidity',))]
fn test_single_sided_empty_pool() {
    let (underlying, sy, _yt, _pt, market, router) = deploy_test_stack();
    let user = user1();
    let amount_sy = 50 * WAD;

    // Setup user with SY but DON'T initialize the pool
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Try to add single-sided liquidity to empty pool (should fail)
    start_cheat_caller_address(router.contract_address, user);
    router.add_liquidity_single_sy(market.contract_address, user, amount_sy, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);
}

#[test]
#[should_panic(expected: ('HZN: deadline exceeded',))]
fn test_single_sided_deadline() {
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

    // Advance time past deadline
    start_cheat_block_timestamp_global(2000);

    // Try to add liquidity with expired deadline (should fail)
    start_cheat_caller_address(router.contract_address, user);
    router
        .add_liquidity_single_sy(
            market.contract_address, user, amount_sy, 0, 1500,
        ); // deadline: 1500 < current: 2000
    stop_cheat_caller_address(router.contract_address);
}

// ============ Remove Liquidity Single-Sided Tests ============

#[test]
fn test_remove_liquidity_single_pt() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();

    // Initialize pool with liquidity first
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY and add liquidity to get LP tokens
    let amount_sy = 50 * WAD;
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router to spend SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Add single-sided liquidity to get LP tokens
    start_cheat_caller_address(router.contract_address, user);
    let (_sy_used, _pt_used, lp_out) = router
        .add_liquidity_single_sy(market.contract_address, user, amount_sy, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    assert(lp_out > 0, 'No LP minted');

    // Get initial balances before remove liquidity
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    let lp_balance_before = lp_token.balance_of(user);
    let pt_balance_before = pt.balance_of(user);

    // Approve router to spend LP tokens
    start_cheat_caller_address(market.contract_address, user);
    lp_token.approve(router.contract_address, lp_out);
    stop_cheat_caller_address(market.contract_address);

    // Remove liquidity single-sided to PT
    start_cheat_caller_address(router.contract_address, user);
    let total_pt_out = router
        .remove_liquidity_single_pt(market.contract_address, user, lp_out, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Verify PT received
    assert(total_pt_out > 0, 'No PT received');

    // Verify LP tokens were burned
    let lp_balance_after = lp_token.balance_of(user);
    assert(lp_balance_after == lp_balance_before - lp_out, 'LP not burned');

    // Verify PT balance increased
    let pt_balance_after = pt.balance_of(user);
    assert(pt_balance_after == pt_balance_before + total_pt_out, 'PT balance mismatch');
}

#[test]
#[should_panic(expected: ('HZN: slippage exceeded',))]
fn test_remove_liquidity_single_pt_slippage() {
    let (underlying, sy, yt, _pt, market, router) = deploy_test_stack();
    let user = user1();

    // Initialize pool with liquidity first
    initialize_pool(underlying, sy, yt, _pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY and add liquidity to get LP tokens
    let amount_sy = 50 * WAD;
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router to spend SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Add single-sided liquidity to get LP tokens
    start_cheat_caller_address(router.contract_address, user);
    let (_sy_used, _pt_used, lp_out) = router
        .add_liquidity_single_sy(market.contract_address, user, amount_sy, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Approve router to spend LP tokens
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    start_cheat_caller_address(market.contract_address, user);
    lp_token.approve(router.contract_address, lp_out);
    stop_cheat_caller_address(market.contract_address);

    // Try to remove liquidity with unrealistically high min_pt_out (should fail)
    start_cheat_caller_address(router.contract_address, user);
    router
        .remove_liquidity_single_pt(
            market.contract_address, user, lp_out, lp_out * 1000, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);
}

#[test]
fn test_remove_liquidity_single_sy() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();

    // Initialize pool with liquidity first
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY and add liquidity to get LP tokens
    let amount_sy = 50 * WAD;
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router to spend SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Add single-sided liquidity to get LP tokens
    start_cheat_caller_address(router.contract_address, user);
    let (_sy_used, _pt_used, lp_out) = router
        .add_liquidity_single_sy(market.contract_address, user, amount_sy, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    assert(lp_out > 0, 'No LP minted');

    // Get initial balances before remove liquidity
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    let lp_balance_before = lp_token.balance_of(user);
    let sy_balance_before = sy.balance_of(user);

    // Approve router to spend LP tokens
    start_cheat_caller_address(market.contract_address, user);
    lp_token.approve(router.contract_address, lp_out);
    stop_cheat_caller_address(market.contract_address);

    // Remove liquidity single-sided to SY
    start_cheat_caller_address(router.contract_address, user);
    let total_sy_out = router
        .remove_liquidity_single_sy(market.contract_address, user, lp_out, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Verify SY received
    assert(total_sy_out > 0, 'No SY received');

    // Verify LP tokens were burned
    let lp_balance_after = lp_token.balance_of(user);
    assert(lp_balance_after == lp_balance_before - lp_out, 'LP not burned');

    // Verify SY balance increased
    let sy_balance_after = sy.balance_of(user);
    assert(sy_balance_after == sy_balance_before + total_sy_out, 'SY balance mismatch');
}

#[test]
#[should_panic(expected: ('HZN: slippage exceeded',))]
fn test_remove_liquidity_single_sy_slippage() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();

    // Initialize pool with liquidity first
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY and add liquidity to get LP tokens
    let amount_sy = 50 * WAD;
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router to spend SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Add single-sided liquidity to get LP tokens
    start_cheat_caller_address(router.contract_address, user);
    let (_sy_used, _pt_used, lp_out) = router
        .add_liquidity_single_sy(market.contract_address, user, amount_sy, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Approve router to spend LP tokens
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    start_cheat_caller_address(market.contract_address, user);
    lp_token.approve(router.contract_address, lp_out);
    stop_cheat_caller_address(market.contract_address);

    // Try to remove liquidity with unrealistically high min_sy_out (should fail)
    start_cheat_caller_address(router.contract_address, user);
    router
        .remove_liquidity_single_sy(
            market.contract_address, user, lp_out, lp_out * 1000, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);
}

#[test]
#[should_panic(expected: ('HZN: deadline exceeded',))]
fn test_remove_liquidity_single_pt_deadline() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();

    // Initialize pool with liquidity first
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY and add liquidity to get LP tokens
    let amount_sy = 50 * WAD;
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router to spend SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Add single-sided liquidity to get LP tokens
    start_cheat_caller_address(router.contract_address, user);
    let (_sy_used, _pt_used, lp_out) = router
        .add_liquidity_single_sy(market.contract_address, user, amount_sy, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Approve router to spend LP tokens
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    start_cheat_caller_address(market.contract_address, user);
    lp_token.approve(router.contract_address, lp_out);
    stop_cheat_caller_address(market.contract_address);

    // Advance time past deadline
    start_cheat_block_timestamp_global(2000);

    // Try to remove liquidity with expired deadline (should fail)
    start_cheat_caller_address(router.contract_address, user);
    router
        .remove_liquidity_single_pt(
            market.contract_address, user, lp_out, 0, 1500,
        ); // deadline: 1500 < current: 2000
    stop_cheat_caller_address(router.contract_address);
}

#[test]
#[should_panic(expected: ('HZN: deadline exceeded',))]
fn test_remove_liquidity_single_sy_deadline() {
    let (underlying, sy, yt, pt, market, router) = deploy_test_stack();
    let user = user1();

    // Initialize pool with liquidity first
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup user with SY and add liquidity to get LP tokens
    let amount_sy = 50 * WAD;
    setup_user_with_sy(underlying, sy, user, amount_sy);

    // Approve router to spend SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Add single-sided liquidity to get LP tokens
    start_cheat_caller_address(router.contract_address, user);
    let (_sy_used, _pt_used, lp_out) = router
        .add_liquidity_single_sy(market.contract_address, user, amount_sy, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Approve router to spend LP tokens
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    start_cheat_caller_address(market.contract_address, user);
    lp_token.approve(router.contract_address, lp_out);
    stop_cheat_caller_address(market.contract_address);

    // Advance time past deadline
    start_cheat_block_timestamp_global(2000);

    // Try to remove liquidity with expired deadline (should fail)
    start_cheat_caller_address(router.contract_address, user);
    router
        .remove_liquidity_single_sy(
            market.contract_address, user, lp_out, 0, 1500,
        ); // deadline: 1500 < current: 2000
    stop_cheat_caller_address(router.contract_address);
}
