/// Large Trade Tests for Market AMM
///
/// These tests verify behavior when trading large amounts relative to pool reserves.
/// Per SPEC.md Section 15.1 "Binary search large trade analysis"
///
/// Test philosophy: Tests should expose contract bugs, NOT be adapted to make them pass.
/// If a test fails, the contract likely has an issue that needs fixing.

use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math_fp::WAD;
use horizon::mocks::mock_erc20::IMockERC20Dispatcher;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

// ============ Test Addresses ============

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn user1() -> ContractAddress {
    'user1'.try_into().unwrap()
}

fn user2() -> ContractAddress {
    'user2'.try_into().unwrap()
}

fn zero_address() -> ContractAddress {
    0.try_into().unwrap()
}

fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
}

// ============ Helpers ============

fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0);
    calldata.append(value);
    calldata.append(len.into());
}

fn default_scalar_root() -> u256 {
    50 * WAD
}

fn default_initial_anchor() -> u256 {
    WAD / 10 // 0.1 WAD = ~10% APY
}

fn default_fee_rate() -> u256 {
    WAD / 100 // 1% fee
}

// ============ Contract Deployment ============

fn deploy_mock_erc20() -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'MockERC20', 9);
    append_bytearray(ref calldata, 'MERC', 4);
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMockERC20Dispatcher { contract_address }
}

fn deploy_mock_yield_token(
    underlying: ContractAddress, admin_addr: ContractAddress,
) -> IMockYieldTokenDispatcher {
    let contract = declare("MockYieldToken").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'MockYieldToken', 14);
    append_bytearray(ref calldata, 'MYT', 3);
    calldata.append(underlying.into());
    calldata.append(admin_addr.into());
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMockYieldTokenDispatcher { contract_address }
}

fn deploy_yield_token_stack() -> (IMockERC20Dispatcher, IMockYieldTokenDispatcher) {
    let underlying = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(underlying.contract_address, admin());
    (underlying, yield_token)
}

fn deploy_sy(
    underlying: ContractAddress, index_oracle: ContractAddress, is_erc4626: bool,
) -> ISYDispatcher {
    let contract = declare("SY").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'SY Token', 8);
    append_bytearray(ref calldata, 'SY', 2);
    calldata.append(underlying.into());
    calldata.append(index_oracle.into());
    calldata.append(if is_erc4626 {
        1
    } else {
        0
    });
    calldata.append(0); // AssetType::Token
    calldata.append(admin().into());

    // tokens_in: single token (underlying)
    calldata.append(1);
    calldata.append(underlying.into());

    // tokens_out: single token (underlying)
    calldata.append(1);
    calldata.append(underlying.into());

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    ISYDispatcher { contract_address }
}

fn deploy_yt(sy: ContractAddress, expiry: u64) -> IYTDispatcher {
    let pt_class = declare("PT").unwrap_syscall().contract_class();
    let yt_class = declare("YT").unwrap_syscall().contract_class();

    let mut calldata = array![];
    append_bytearray(ref calldata, 'YT Token', 8);
    append_bytearray(ref calldata, 'YT', 2);
    calldata.append(sy.into());
    calldata.append((*pt_class.class_hash).into());
    calldata.append(expiry.into());
    calldata.append(admin().into());
    calldata.append(treasury().into()); // treasury

    let (contract_address, _) = yt_class.deploy(@calldata).unwrap_syscall();
    IYTDispatcher { contract_address }
}

fn deploy_market(
    pt: ContractAddress, scalar_root: u256, initial_anchor: u256, fee_rate: u256,
) -> IMarketDispatcher {
    let contract = declare("Market").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'PT-SY LP', 8);
    append_bytearray(ref calldata, 'LP', 2);
    calldata.append(pt.into());
    calldata.append(scalar_root.low.into());
    calldata.append(scalar_root.high.into());
    calldata.append(initial_anchor.low.into());
    calldata.append(initial_anchor.high.into());
    calldata.append(fee_rate.low.into());
    calldata.append(fee_rate.high.into());
    calldata.append(admin().into());

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketDispatcher { contract_address }
}

fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

// ============ Full Setup ============

fn setup() -> (
    IMockYieldTokenDispatcher, ISYDispatcher, IYTDispatcher, IPTDispatcher, IMarketDispatcher,
) {
    start_cheat_block_timestamp_global(1000);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);

    let expiry = 1000 + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let market = deploy_market(
        pt.contract_address, default_scalar_root(), default_initial_anchor(), default_fee_rate(),
    );

    (underlying, sy, yt, pt, market)
}

fn setup_user_with_tokens(
    underlying: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    user: ContractAddress,
    amount: u256,
) {
    mint_yield_token_to_user(underlying, user, amount * 2);

    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount * 2);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount * 2, 0);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);
}

fn setup_market_with_liquidity(
    underlying: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    pt: IPTDispatcher,
    market: IMarketDispatcher,
    user: ContractAddress,
    sy_amount: u256,
    pt_amount: u256,
) {
    setup_user_with_tokens(underlying, sy, yt, user, sy_amount + pt_amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, sy_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, pt_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, sy_amount, pt_amount);
    stop_cheat_caller_address(market.contract_address);
}

// ============ Large Trade Tests ============

/// Test: Swap 10% of reserve
/// Expected: Should succeed with reasonable price, converge quickly
#[test]
fn test_swap_10_percent_of_reserve_pt_for_sy() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    let reserve_size = 1000 * WAD;
    setup_market_with_liquidity(
        underlying, sy, yt, pt, market, lp_provider, reserve_size, reserve_size,
    );

    // Setup trader with PT
    setup_user_with_tokens(underlying, sy, yt, trader, 200 * WAD);

    let swap_amount = reserve_size / 10; // 10% of reserve

    start_cheat_caller_address(pt.contract_address, trader);
    pt.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(pt.contract_address);

    let sy_before = sy.balance_of(trader);

    start_cheat_caller_address(market.contract_address, trader);
    let sy_out = market.swap_exact_pt_for_sy(trader, swap_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    // Verify trade succeeded
    assert(sy_out > 0, 'Should receive SY');
    assert(sy.balance_of(trader) == sy_before + sy_out, 'SY balance mismatch');

    // Price impact should be noticeable but not extreme
    // At 10% trade size, output should be roughly 90-99% of input (accounting for fees + slippage)
    // PT trades at a discount to SY, so output should be less than input
    assert(sy_out < swap_amount, 'PT should trade at discount');
    assert(sy_out > swap_amount / 2, 'Price impact too extreme');
}

/// Test: Swap 10% of reserve (SY for PT direction)
#[test]
fn test_swap_10_percent_of_reserve_sy_for_pt() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    let reserve_size = 1000 * WAD;
    setup_market_with_liquidity(
        underlying, sy, yt, pt, market, lp_provider, reserve_size, reserve_size,
    );

    setup_user_with_tokens(underlying, sy, yt, trader, 200 * WAD);

    let swap_amount = reserve_size / 10; // 10% of reserve

    start_cheat_caller_address(sy.contract_address, trader);
    sy.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    let pt_before = pt.balance_of(trader);

    start_cheat_caller_address(market.contract_address, trader);
    let pt_out = market.swap_exact_sy_for_pt(trader, swap_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    assert(pt_out > 0, 'Should receive PT');
    assert(pt.balance_of(trader) == pt_before + pt_out, 'PT balance mismatch');

    // SY to PT: should get slightly more PT than SY spent (PT is discounted)
    // Minus fees and slippage
    assert(pt_out > swap_amount / 2, 'Output too low');
}

/// Test: Swap 50% of reserve
/// Expected: High slippage warning implied, but should still succeed
#[test]
fn test_swap_50_percent_of_reserve_pt_for_sy() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    let reserve_size = 1000 * WAD;
    setup_market_with_liquidity(
        underlying, sy, yt, pt, market, lp_provider, reserve_size, reserve_size,
    );

    setup_user_with_tokens(underlying, sy, yt, trader, 600 * WAD);

    let swap_amount = reserve_size / 2; // 50% of reserve

    start_cheat_caller_address(pt.contract_address, trader);
    pt.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(pt.contract_address);

    let sy_before = sy.balance_of(trader);

    start_cheat_caller_address(market.contract_address, trader);
    let sy_out = market.swap_exact_pt_for_sy(trader, swap_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    // Trade should succeed
    assert(sy_out > 0, 'Should receive SY');
    assert(sy.balance_of(trader) == sy_before + sy_out, 'SY balance mismatch');

    // 50% trade has significant price impact
    // Output will be significantly less than input due to slippage
    assert(sy_out < swap_amount, 'PT should trade at discount');

    // Verify reserves updated correctly
    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert(pt_reserve == reserve_size + swap_amount, 'PT reserve mismatch');
    assert(sy_reserve == reserve_size - sy_out, 'SY reserve mismatch');
}

/// Test: Swap 50% of reserve (SY for PT - uses binary search)
#[test]
fn test_swap_50_percent_of_reserve_sy_for_pt() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    let reserve_size = 1000 * WAD;
    setup_market_with_liquidity(
        underlying, sy, yt, pt, market, lp_provider, reserve_size, reserve_size,
    );

    setup_user_with_tokens(underlying, sy, yt, trader, 600 * WAD);

    let swap_amount = reserve_size / 2; // 50% of reserve

    start_cheat_caller_address(sy.contract_address, trader);
    sy.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    let pt_before = pt.balance_of(trader);

    start_cheat_caller_address(market.contract_address, trader);
    let pt_out = market.swap_exact_sy_for_pt(trader, swap_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    // Binary search should converge even for large trades
    assert(pt_out > 0, 'Should receive PT');
    assert(pt.balance_of(trader) == pt_before + pt_out, 'PT balance mismatch');
}

/// Test: Swap 90% of reserve
/// Expected: Either succeed with extreme slippage OR hit proportion limits and fail
/// This tests the boundary behavior of the AMM
#[test]
fn test_swap_90_percent_of_reserve_pt_for_sy() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    let reserve_size = 1000 * WAD;
    setup_market_with_liquidity(
        underlying, sy, yt, pt, market, lp_provider, reserve_size, reserve_size,
    );

    setup_user_with_tokens(underlying, sy, yt, trader, 1000 * WAD);

    let swap_amount = (reserve_size * 9) / 10; // 90% of reserve

    start_cheat_caller_address(pt.contract_address, trader);
    pt.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(pt.contract_address);

    let sy_before = sy.balance_of(trader);

    // This trade should work because:
    // - PT is being sold INTO the pool (PT reserve increases)
    // - SY is being withdrawn (SY reserve decreases)
    // - The check is sy_out_before_fee < sy_reserve (which should fail for 90% output)
    start_cheat_caller_address(market.contract_address, trader);
    let sy_out = market.swap_exact_pt_for_sy(trader, swap_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    // If we get here, trade succeeded
    assert(sy_out > 0, 'Should receive SY');
    assert(sy.balance_of(trader) == sy_before + sy_out, 'SY balance mismatch');

    // Output must be less than 90% of reserve (what we're trying to drain)
    // The AMM pricing should prevent draining too much
    assert(sy_out < reserve_size * 9 / 10, 'Output should be limited');
}

/// Test: Swap 90% of reserve (SY for PT - buying PT)
/// This tests whether we can drain most of the PT reserve
#[test]
fn test_swap_90_percent_of_reserve_sy_for_pt() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    let reserve_size = 1000 * WAD;
    setup_market_with_liquidity(
        underlying, sy, yt, pt, market, lp_provider, reserve_size, reserve_size,
    );

    setup_user_with_tokens(underlying, sy, yt, trader, 2000 * WAD);

    // Try to buy PT by spending 90% worth of SY
    let swap_amount = (reserve_size * 9) / 10;

    start_cheat_caller_address(sy.contract_address, trader);
    sy.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    let pt_before = pt.balance_of(trader);

    start_cheat_caller_address(market.contract_address, trader);
    let pt_out = market.swap_exact_sy_for_pt(trader, swap_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    // Trade should succeed but PT output is limited by reserve
    assert(pt_out > 0, 'Should receive PT');
    assert(pt.balance_of(trader) == pt_before + pt_out, 'PT balance mismatch');

    // PT out must be less than PT reserve (can't drain entire reserve)
    let (_, pt_reserve_after) = market.get_reserves();
    assert(pt_reserve_after > 0, 'PT reserve should not be 0');
}

/// Test: Swap exceeds reserve (trying to drain more than exists)
/// Expected: Must revert with MARKET_INSUFFICIENT_LIQUIDITY
#[test]
#[should_panic(expected: 'HZN: insufficient liquidity')]
fn test_swap_exact_sy_exceeds_pt_reserve() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    let reserve_size = 100 * WAD;
    setup_market_with_liquidity(
        underlying, sy, yt, pt, market, lp_provider, reserve_size, reserve_size,
    );

    setup_user_with_tokens(underlying, sy, yt, trader, 500 * WAD);

    // Try to get more PT than exists in the pool
    let exact_pt_wanted = reserve_size + WAD; // More than reserve

    start_cheat_caller_address(sy.contract_address, trader);
    sy.approve(market.contract_address, 500 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, trader);
    // swap_sy_for_exact_pt should check if exact_pt_out < pt_reserve
    market.swap_sy_for_exact_pt(trader, exact_pt_wanted, 500 * WAD);
}

/// Test: Swap exceeds reserve (trying to get more SY than exists)
/// Expected: Must revert with MARKET_INSUFFICIENT_LIQUIDITY
#[test]
#[should_panic(expected: 'HZN: insufficient liquidity')]
fn test_swap_exact_pt_exceeds_sy_reserve() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    let reserve_size = 100 * WAD;
    setup_market_with_liquidity(
        underlying, sy, yt, pt, market, lp_provider, reserve_size, reserve_size,
    );

    setup_user_with_tokens(underlying, sy, yt, trader, 500 * WAD);

    // Try to get more SY than exists in the pool
    let exact_sy_wanted = reserve_size + WAD;

    start_cheat_caller_address(pt.contract_address, trader);
    pt.approve(market.contract_address, 500 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, trader);
    // swap_pt_for_exact_sy should check if exact_sy_out < sy_reserve
    market.swap_pt_for_exact_sy(trader, exact_sy_wanted, 500 * WAD);
}

/// Test: Binary search convergence for large trades
/// Verify the binary search finds a valid result without infinite loops
#[test]
fn test_binary_search_convergence_large_trade() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    let reserve_size = 1000 * WAD;
    setup_market_with_liquidity(
        underlying, sy, yt, pt, market, lp_provider, reserve_size, reserve_size,
    );

    setup_user_with_tokens(underlying, sy, yt, trader, 500 * WAD);

    // Large trade that exercises binary search
    let swap_amount = reserve_size / 3; // 33% of reserve

    start_cheat_caller_address(sy.contract_address, trader);
    sy.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    let pt_before = pt.balance_of(trader);

    start_cheat_caller_address(market.contract_address, trader);
    let pt_out = market.swap_exact_sy_for_pt(trader, swap_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    // Convergence check: trade completed successfully
    assert(pt_out > 0, 'Binary search should converge');
    assert(pt.balance_of(trader) == pt_before + pt_out, 'Balance mismatch');

    // Verify result is within tolerance of optimal
    // The PT output should make sense economically (more PT than SY due to discount)
    assert(pt_out > swap_amount / 2, 'PT output too low');
}

/// Test: Binary search with adversarial input (very small amount in large pool)
#[test]
fn test_binary_search_small_trade_large_pool() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    let reserve_size = 10000 * WAD; // Very large pool
    setup_market_with_liquidity(
        underlying, sy, yt, pt, market, lp_provider, reserve_size, reserve_size,
    );

    setup_user_with_tokens(underlying, sy, yt, trader, 10 * WAD);

    // Very small trade relative to pool
    let swap_amount = WAD / 100; // 0.01 WAD

    start_cheat_caller_address(sy.contract_address, trader);
    sy.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, trader);
    let pt_out = market.swap_exact_sy_for_pt(trader, swap_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    // Small trades should still work
    assert(pt_out > 0, 'Small trade should work');
}

/// Test: Sequential large trades
/// Verify multiple large trades don't cause state corruption
#[test]
fn test_sequential_large_trades() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    let reserve_size = 1000 * WAD;
    setup_market_with_liquidity(
        underlying, sy, yt, pt, market, lp_provider, reserve_size, reserve_size,
    );

    setup_user_with_tokens(underlying, sy, yt, trader, 1000 * WAD);

    // First large trade: sell PT for SY
    let swap1 = reserve_size / 5; // 20%

    start_cheat_caller_address(pt.contract_address, trader);
    pt.approve(market.contract_address, swap1);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, trader);
    let sy_out1 = market.swap_exact_pt_for_sy(trader, swap1, 0);
    stop_cheat_caller_address(market.contract_address);

    assert(sy_out1 > 0, 'First trade should work');

    // Second large trade: sell SY for PT
    let swap2 = reserve_size / 5;

    start_cheat_caller_address(sy.contract_address, trader);
    sy.approve(market.contract_address, swap2);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, trader);
    let pt_out2 = market.swap_exact_sy_for_pt(trader, swap2, 0);
    stop_cheat_caller_address(market.contract_address);

    assert(pt_out2 > 0, 'Second trade should work');

    // Third large trade
    let swap3 = reserve_size / 5;

    start_cheat_caller_address(pt.contract_address, trader);
    pt.approve(market.contract_address, swap3);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, trader);
    let sy_out3 = market.swap_exact_pt_for_sy(trader, swap3, 0);
    stop_cheat_caller_address(market.contract_address);

    assert(sy_out3 > 0, 'Third trade should work');

    // Verify pool is still in valid state
    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert(sy_reserve > 0, 'SY reserve should be positive');
    assert(pt_reserve > 0, 'PT reserve should be positive');
}

/// Test: Trade near proportion limit (96%)
/// MAX_PROPORTION = 96%, trades pushing beyond this should be handled gracefully
#[test]
fn test_trade_approaching_max_proportion() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    // Start with unbalanced pool: more PT than SY
    let sy_reserve = 100 * WAD;
    let pt_reserve = 900 * WAD; // 90% PT proportion

    setup_user_with_tokens(underlying, sy, yt, lp_provider, 1500 * WAD);

    // Add unbalanced liquidity
    start_cheat_caller_address(sy.contract_address, lp_provider);
    sy.approve(market.contract_address, sy_reserve);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, lp_provider);
    pt.approve(market.contract_address, pt_reserve);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, lp_provider);
    market.mint(lp_provider, sy_reserve, pt_reserve);
    stop_cheat_caller_address(market.contract_address);

    setup_user_with_tokens(underlying, sy, yt, trader, 500 * WAD);

    // Try to push PT proportion even higher
    let swap_amount = 50 * WAD;

    start_cheat_caller_address(pt.contract_address, trader);
    pt.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, trader);
    // This should work but with very bad rate due to proportion limits
    let sy_out = market.swap_exact_pt_for_sy(trader, swap_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    // Trade should succeed but with poor price
    assert(sy_out > 0, 'Trade should still execute');
}

/// Test: Trade near minimum proportion (0.1%)
/// MIN_PROPORTION = 0.1%, trades pushing beyond this should be handled gracefully
#[test]
fn test_trade_approaching_min_proportion() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    // Start with unbalanced pool: more SY than PT
    let sy_reserve = 900 * WAD;
    let pt_reserve = 100 * WAD; // 10% PT proportion

    setup_user_with_tokens(underlying, sy, yt, lp_provider, 1500 * WAD);

    start_cheat_caller_address(sy.contract_address, lp_provider);
    sy.approve(market.contract_address, sy_reserve);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, lp_provider);
    pt.approve(market.contract_address, pt_reserve);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, lp_provider);
    market.mint(lp_provider, sy_reserve, pt_reserve);
    stop_cheat_caller_address(market.contract_address);

    setup_user_with_tokens(underlying, sy, yt, trader, 500 * WAD);

    // Try to buy most of the PT (pushing proportion lower)
    let swap_amount = 80 * WAD;

    start_cheat_caller_address(sy.contract_address, trader);
    sy.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, trader);
    let pt_out = market.swap_exact_sy_for_pt(trader, swap_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    // Trade should succeed
    assert(pt_out > 0, 'Trade should still execute');

    // PT out should be limited to not drain the pool
    let (_, pt_reserve_after) = market.get_reserves();
    assert(pt_reserve_after > 0, 'Should not drain PT reserve');
}

/// Test: Very large pool (millions of tokens)
/// Verify no overflow/underflow with large numbers
#[test]
fn test_large_pool_no_overflow() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    // Very large pool: 1 million tokens each
    let reserve_size = 1_000_000 * WAD;

    setup_user_with_tokens(underlying, sy, yt, lp_provider, reserve_size * 3);

    start_cheat_caller_address(sy.contract_address, lp_provider);
    sy.approve(market.contract_address, reserve_size);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, lp_provider);
    pt.approve(market.contract_address, reserve_size);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, lp_provider);
    market.mint(lp_provider, reserve_size, reserve_size);
    stop_cheat_caller_address(market.contract_address);

    setup_user_with_tokens(underlying, sy, yt, trader, 100_000 * WAD);

    // Trade 10% of the large pool
    let swap_amount = reserve_size / 10;

    start_cheat_caller_address(pt.contract_address, trader);
    pt.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, trader);
    let sy_out = market.swap_exact_pt_for_sy(trader, swap_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    assert(sy_out > 0, 'Large trade should work');
    assert(sy_out < swap_amount, 'Output < input expected');
}

/// Test: Exact output functions with large amounts
/// Tests swap_sy_for_exact_pt and swap_pt_for_exact_sy with large exact amounts
#[test]
fn test_exact_output_large_amount() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    let reserve_size = 1000 * WAD;
    setup_market_with_liquidity(
        underlying, sy, yt, pt, market, lp_provider, reserve_size, reserve_size,
    );

    setup_user_with_tokens(underlying, sy, yt, trader, 1000 * WAD);

    // Request exact 30% of PT reserve
    let exact_pt_out = (reserve_size * 3) / 10;
    let max_sy_in = reserve_size; // Generous max

    start_cheat_caller_address(sy.contract_address, trader);
    sy.approve(market.contract_address, max_sy_in);
    stop_cheat_caller_address(sy.contract_address);

    let pt_before = pt.balance_of(trader);

    start_cheat_caller_address(market.contract_address, trader);
    let sy_spent = market.swap_sy_for_exact_pt(trader, exact_pt_out, max_sy_in);
    stop_cheat_caller_address(market.contract_address);

    // Should get exactly the PT requested
    assert(pt.balance_of(trader) == pt_before + exact_pt_out, 'Should get exact PT');
    assert(sy_spent <= max_sy_in, 'Should not exceed max');
    assert(sy_spent > 0, 'Should spend some SY');
}

/// Test: Slippage protection on large trades
/// Verify slippage protection works correctly for large trades
#[test]
#[should_panic(expected: 'HZN: slippage exceeded')]
fn test_large_trade_slippage_protection() {
    let (underlying, sy, yt, pt, market) = setup();
    let lp_provider = user1();
    let trader = user2();

    let reserve_size = 1000 * WAD;
    setup_market_with_liquidity(
        underlying, sy, yt, pt, market, lp_provider, reserve_size, reserve_size,
    );

    setup_user_with_tokens(underlying, sy, yt, trader, 500 * WAD);

    // Large trade with unrealistic min_out expectation
    let swap_amount = reserve_size / 3; // 33%
    let unrealistic_min = swap_amount; // Expect 1:1, but there's fees + slippage

    start_cheat_caller_address(pt.contract_address, trader);
    pt.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, trader);
    market.swap_exact_pt_for_sy(trader, swap_amount, unrealistic_min);
}
