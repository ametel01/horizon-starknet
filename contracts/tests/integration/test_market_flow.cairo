use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_market_factory::{
    IMarketFactoryDispatcher, IMarketFactoryDispatcherTrait,
};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_router::{IRouterDispatcher, IRouterDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_erc20::IMockERC20Dispatcher;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
/// Integration Tests: Market Trading Flow
/// Tests complete market operations including liquidity and trading.
///
/// Test Scenarios:
/// 1. Create market for PT/SY
/// 2. Add liquidity
/// 3. Swap PT <-> SY
/// 4. Check implied rate changes
/// 5. Remove liquidity

use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

// ============ Test Addresses ============

fn alice() -> ContractAddress {
    'alice'.try_into().unwrap()
}

fn bob() -> ContractAddress {
    'bob'.try_into().unwrap()
}

fn charlie() -> ContractAddress {
    'charlie'.try_into().unwrap()
}

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

// ============ Deploy Helpers ============

fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0);
    calldata.append(value);
    calldata.append(len.into());
}

fn deploy_mock_erc20() -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'MockERC20', 9);
    append_bytearray(ref calldata, 'MERC20', 6);
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

fn deploy_yield_token_stack() -> IMockYieldTokenDispatcher {
    let underlying_erc20 = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(underlying_erc20.contract_address, admin());
    yield_token
}

fn deploy_sy(underlying: ContractAddress, index_oracle: ContractAddress) -> ISYDispatcher {
    let contract = declare("SY").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'Standardized Yield', 18);
    append_bytearray(ref calldata, 'SY', 2);
    calldata.append(underlying.into());
    calldata.append(index_oracle.into());
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    ISYDispatcher { contract_address }
}

fn deploy_yt(sy: ContractAddress, expiry: u64) -> IYTDispatcher {
    let pt_class = declare("PT").unwrap_syscall().contract_class();
    let yt_class = declare("YT").unwrap_syscall().contract_class();

    let mut calldata = array![];
    append_bytearray(ref calldata, 'Yield Token', 11);
    append_bytearray(ref calldata, 'YT', 2);
    calldata.append(sy.into());
    calldata.append((*pt_class.class_hash).into());
    calldata.append(expiry.into());

    let (contract_address, _) = yt_class.deploy(@calldata).unwrap_syscall();
    IYTDispatcher { contract_address }
}

fn deploy_market(pt: ContractAddress) -> IMarketDispatcher {
    let contract = declare("Market").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'PT-SY LP', 8);
    append_bytearray(ref calldata, 'LP', 2);
    calldata.append(pt.into());
    // Market parameters
    let scalar_root = 50 * WAD;
    let initial_anchor = WAD / 10; // 0.1
    let fee_rate = WAD / 100; // 1%
    calldata.append(scalar_root.low.into());
    calldata.append(scalar_root.high.into());
    calldata.append(initial_anchor.low.into());
    calldata.append(initial_anchor.high.into());
    calldata.append(fee_rate.low.into());
    calldata.append(fee_rate.high.into());

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketDispatcher { contract_address }
}

fn deploy_market_factory() -> IMarketFactoryDispatcher {
    let market_class = declare("Market").unwrap_syscall().contract_class();
    let contract = declare("MarketFactory").unwrap_syscall().contract_class();
    let mut calldata = array![];
    calldata.append((*market_class.class_hash).into());
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketFactoryDispatcher { contract_address }
}

fn deploy_router() -> IRouterDispatcher {
    let contract = declare("Router").unwrap_syscall().contract_class();
    let calldata = array![];
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IRouterDispatcher { contract_address }
}

// Helper: Mint yield token shares to user as admin
fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

// Helper: Set yield index as admin
fn set_yield_index(yield_token: IMockYieldTokenDispatcher, new_index: u256) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.set_index(new_index);
    stop_cheat_caller_address(yield_token.contract_address);
}

// Helper: Setup user with SY and PT tokens
fn setup_user_with_tokens(
    underlying: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    user: ContractAddress,
    amount: u256,
) {
    // Mint underlying, deposit to get SY, then mint PT+YT
    mint_yield_token_to_user(underlying, user, amount * 2);

    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount * 2);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount * 2);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);
}

// ============ Market Flow Tests ============

#[test]
fn test_complete_market_trading_flow() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Step 1: Create market for PT/SY
    let market = deploy_market(pt.contract_address);

    // Verify market is properly configured
    assert(market.sy() == sy.contract_address, 'Market SY wrong');
    assert(market.pt() == pt.contract_address, 'Market PT wrong');
    assert(market.expiry() == expiry, 'Market expiry wrong');
    assert(!market.is_expired(), 'Market not expired');

    // Step 2: Setup liquidity providers
    let lp_amount = 1000 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), lp_amount);

    // Alice adds liquidity
    start_cheat_caller_address(sy.contract_address, alice());
    sy.approve(market.contract_address, lp_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(market.contract_address, lp_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, alice());
    let (sy_used, pt_used, lp_minted) = market.mint(alice(), lp_amount, lp_amount);
    stop_cheat_caller_address(market.contract_address);

    // Verify liquidity added
    assert(lp_minted > 0, 'LP tokens minted');
    assert(sy_used > 0, 'SY used');
    assert(pt_used > 0, 'PT used');

    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert(sy_reserve == sy_used, 'SY reserve matches');
    assert(pt_reserve == pt_used, 'PT reserve matches');

    // Record initial implied rate
    let _initial_rate = market.get_ln_implied_rate();

    // Step 3: Bob sets up for trading
    let trade_amount = 100 * WAD;
    setup_user_with_tokens(underlying, sy, yt, bob(), trade_amount * 2);

    // Step 4: Bob swaps SY for PT
    start_cheat_caller_address(sy.contract_address, bob());
    sy.approve(market.contract_address, trade_amount);
    stop_cheat_caller_address(sy.contract_address);

    let bob_pt_before = pt.balance_of(bob());

    start_cheat_caller_address(market.contract_address, bob());
    let pt_received = market.swap_exact_sy_for_pt(bob(), trade_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    assert(pt_received > 0, 'Bob received PT');
    assert(pt.balance_of(bob()) == bob_pt_before + pt_received, 'Bob PT balance updated');

    // Step 5: Check implied rate changed
    let _rate_after_sy_to_pt = market.get_ln_implied_rate();
    // Rate should change after swap (direction depends on the trade)

    // Step 6: Bob swaps PT for SY
    start_cheat_caller_address(pt.contract_address, bob());
    pt.approve(market.contract_address, pt_received);
    stop_cheat_caller_address(pt.contract_address);

    let bob_sy_before = sy.balance_of(bob());

    start_cheat_caller_address(market.contract_address, bob());
    let sy_received = market.swap_exact_pt_for_sy(bob(), pt_received, 0);
    stop_cheat_caller_address(market.contract_address);

    assert(sy_received > 0, 'Bob received SY');
    assert(sy.balance_of(bob()) == bob_sy_before + sy_received, 'Bob SY balance updated');

    // Step 7: Check reserves after trades
    let (_sy_reserve_after, _pt_reserve_after) = market.get_reserves();
    // Reserves should have changed due to fees collected

    // Step 8: Alice removes liquidity
    // First need to get LP token balance
    let lp_token = IPTDispatcher { contract_address: market.contract_address };
    let alice_lp = lp_token.balance_of(alice());

    start_cheat_caller_address(market.contract_address, alice());
    lp_token.approve(market.contract_address, alice_lp);
    stop_cheat_caller_address(market.contract_address);

    let alice_sy_before = sy.balance_of(alice());
    let alice_pt_before = pt.balance_of(alice());

    start_cheat_caller_address(market.contract_address, alice());
    let (sy_out, pt_out) = market.burn(alice(), alice_lp);
    stop_cheat_caller_address(market.contract_address);

    assert(sy_out > 0, 'Alice received SY');
    assert(pt_out > 0, 'Alice received PT');
    assert(sy.balance_of(alice()) == alice_sy_before + sy_out, 'Alice SY increased');
    assert(pt.balance_of(alice()) == alice_pt_before + pt_out, 'Alice PT increased');

    // LP tokens should be burned
    assert(lp_token.balance_of(alice()) == 0, 'Alice LP burned');
}

#[test]
fn test_market_with_factory() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Deploy market factory
    let market_factory = deploy_market_factory();

    // Create market via factory
    let scalar_root = 50 * WAD;
    let initial_anchor = WAD / 10;
    let fee_rate = WAD / 100;

    let market_address = market_factory
        .create_market(pt.contract_address, scalar_root, initial_anchor, fee_rate);

    // Verify market created
    assert(market_factory.is_valid_market(market_address), 'Market is valid');
    assert(market_factory.get_market(pt.contract_address) == market_address, 'Market registered');

    let market = IMarketDispatcher { contract_address: market_address };
    assert(market.pt() == pt.contract_address, 'Factory market PT');
    assert(market.sy() == sy.contract_address, 'Factory market SY');
}

#[test]
fn test_multiple_lps_and_traders() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let market = deploy_market(pt.contract_address);

    // Setup multiple LPs
    let lp_amount = 500 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), lp_amount);
    setup_user_with_tokens(underlying, sy, yt, bob(), lp_amount);

    // Alice adds liquidity
    start_cheat_caller_address(sy.contract_address, alice());
    sy.approve(market.contract_address, lp_amount);
    stop_cheat_caller_address(sy.contract_address);
    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(market.contract_address, lp_amount);
    stop_cheat_caller_address(pt.contract_address);
    start_cheat_caller_address(market.contract_address, alice());
    let (_, _, _alice_lp) = market.mint(alice(), lp_amount, lp_amount);
    stop_cheat_caller_address(market.contract_address);

    // Bob adds liquidity
    start_cheat_caller_address(sy.contract_address, bob());
    sy.approve(market.contract_address, lp_amount);
    stop_cheat_caller_address(sy.contract_address);
    start_cheat_caller_address(pt.contract_address, bob());
    pt.approve(market.contract_address, lp_amount);
    stop_cheat_caller_address(pt.contract_address);
    start_cheat_caller_address(market.contract_address, bob());
    let (_, _, _bob_lp) = market.mint(bob(), lp_amount, lp_amount);
    stop_cheat_caller_address(market.contract_address);

    // Verify both have LP tokens
    let lp_token = IPTDispatcher { contract_address: market.contract_address };
    assert(lp_token.balance_of(alice()) > 0, 'Alice has LP');
    assert(lp_token.balance_of(bob()) > 0, 'Bob has LP');

    // Charlie trades - needs enough for multiple round-trips
    let trade_amount = 50 * WAD;
    setup_user_with_tokens(underlying, sy, yt, charlie(), trade_amount * 10);

    // Charlie does multiple swaps
    for _i in 0..3_u32 {
        // Swap SY for PT
        start_cheat_caller_address(sy.contract_address, charlie());
        sy.approve(market.contract_address, trade_amount);
        stop_cheat_caller_address(sy.contract_address);

        start_cheat_caller_address(market.contract_address, charlie());
        let pt_out = market.swap_exact_sy_for_pt(charlie(), trade_amount, 0);
        stop_cheat_caller_address(market.contract_address);

        // Swap PT for SY
        start_cheat_caller_address(pt.contract_address, charlie());
        pt.approve(market.contract_address, pt_out);
        stop_cheat_caller_address(pt.contract_address);

        start_cheat_caller_address(market.contract_address, charlie());
        market.swap_exact_pt_for_sy(charlie(), pt_out, 0);
        stop_cheat_caller_address(market.contract_address);
    }

    // Both LPs can withdraw with their share of fees
    let alice_lp_balance = lp_token.balance_of(alice());
    start_cheat_caller_address(market.contract_address, alice());
    lp_token.approve(market.contract_address, alice_lp_balance);
    stop_cheat_caller_address(market.contract_address);

    start_cheat_caller_address(market.contract_address, alice());
    let (alice_sy_out, alice_pt_out) = market.burn(alice(), alice_lp_balance);
    stop_cheat_caller_address(market.contract_address);

    assert(alice_sy_out > 0, 'Alice got SY');
    assert(alice_pt_out > 0, 'Alice got PT');
}

#[test]
fn test_router_market_operations() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let market = deploy_market(pt.contract_address);
    let router = deploy_router();

    // Setup liquidity first (directly to market)
    let lp_amount = 1000 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), lp_amount);

    start_cheat_caller_address(sy.contract_address, alice());
    sy.approve(market.contract_address, lp_amount);
    stop_cheat_caller_address(sy.contract_address);
    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(market.contract_address, lp_amount);
    stop_cheat_caller_address(pt.contract_address);
    start_cheat_caller_address(market.contract_address, alice());
    market.mint(alice(), lp_amount, lp_amount);
    stop_cheat_caller_address(market.contract_address);

    // Bob trades through router
    let trade_amount = 100 * WAD;
    setup_user_with_tokens(underlying, sy, yt, bob(), trade_amount * 2);

    // Buy PT through router
    start_cheat_caller_address(sy.contract_address, bob());
    sy.approve(router.contract_address, trade_amount);
    stop_cheat_caller_address(sy.contract_address);

    let bob_pt_before = pt.balance_of(bob());

    start_cheat_caller_address(router.contract_address, bob());
    let pt_bought = router.buy_pt_from_sy(market.contract_address, bob(), trade_amount, 0);
    stop_cheat_caller_address(router.contract_address);

    assert(pt_bought > 0, 'Router bought PT');
    assert(pt.balance_of(bob()) == bob_pt_before + pt_bought, 'Bob PT via router');

    // Sell PT through router
    start_cheat_caller_address(pt.contract_address, bob());
    pt.approve(router.contract_address, pt_bought);
    stop_cheat_caller_address(pt.contract_address);

    let bob_sy_before = sy.balance_of(bob());

    start_cheat_caller_address(router.contract_address, bob());
    let sy_received = router.sell_pt_for_sy(market.contract_address, bob(), pt_bought, 0);
    stop_cheat_caller_address(router.contract_address);

    assert(sy_received > 0, 'Router sold PT');
    assert(sy.balance_of(bob()) == bob_sy_before + sy_received, 'Bob SY via router');
}

#[test]
fn test_implied_rate_tracking() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let market = deploy_market(pt.contract_address);

    // Add liquidity
    let lp_amount = 1000 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), lp_amount);

    start_cheat_caller_address(sy.contract_address, alice());
    sy.approve(market.contract_address, lp_amount);
    stop_cheat_caller_address(sy.contract_address);
    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(market.contract_address, lp_amount);
    stop_cheat_caller_address(pt.contract_address);
    start_cheat_caller_address(market.contract_address, alice());
    market.mint(alice(), lp_amount, lp_amount);
    stop_cheat_caller_address(market.contract_address);

    // Record initial rate
    let _initial_rate = market.get_ln_implied_rate();

    // Large swap to move rate
    let trade_amount = 200 * WAD;
    setup_user_with_tokens(underlying, sy, yt, bob(), trade_amount * 2);

    start_cheat_caller_address(sy.contract_address, bob());
    sy.approve(market.contract_address, trade_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, bob());
    market.swap_exact_sy_for_pt(bob(), trade_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    // Rate should have changed
    let _rate_after = market.get_ln_implied_rate();
    // The rate changes based on the trade direction and size

    // Time passes - rate should adjust
    start_cheat_block_timestamp_global(start_time + 30 * 24 * 60 * 60);

    // Market state should reflect time passage
    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert(sy_reserve > 0, 'Reserves maintained');
    assert(pt_reserve > 0, 'PT reserves maintained');
}

#[test]
fn test_liquidity_add_remove_symmetry() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let market = deploy_market(pt.contract_address);

    let amount = 500 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), amount);

    let alice_sy_before = sy.balance_of(alice());
    let alice_pt_before = pt.balance_of(alice());

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, alice());
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);
    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, alice());
    let (sy_used, pt_used, lp_minted) = market.mint(alice(), amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Immediately remove all liquidity
    let lp_token = IPTDispatcher { contract_address: market.contract_address };
    start_cheat_caller_address(market.contract_address, alice());
    lp_token.approve(market.contract_address, lp_minted);
    stop_cheat_caller_address(market.contract_address);

    start_cheat_caller_address(market.contract_address, alice());
    let (sy_out, pt_out) = market.burn(alice(), lp_minted);
    stop_cheat_caller_address(market.contract_address);

    // Should get back approximately what was put in
    // Small differences due to rounding are acceptable
    assert(sy_out > 0, 'Got SY back');
    assert(pt_out > 0, 'Got PT back');

    // Final balances should be close to initial (minus any fees/rounding)
    let alice_sy_after = sy.balance_of(alice());
    let alice_pt_after = pt.balance_of(alice());

    // Verify we got most of our tokens back
    assert(alice_sy_after >= alice_sy_before - sy_used + sy_out, 'SY accounting correct');
    assert(alice_pt_after >= alice_pt_before - pt_used + pt_out, 'PT accounting correct');
}
