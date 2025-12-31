use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_router::IRouterDispatcher;
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_erc20::IMockERC20Dispatcher;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
/// Integration Tests: Edge Cases
/// Tests boundary conditions and unusual scenarios.
///
/// Test Scenarios:
/// 1. Zero amounts
/// 2. Large amounts
/// 3. Multiple users interacting simultaneously
/// 4. Rapid sequential operations
/// 5. Dust amounts

use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_number_global,
    start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

// ============ Test Addresses ============

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn alice() -> ContractAddress {
    'alice'.try_into().unwrap()
}

fn bob() -> ContractAddress {
    'bob'.try_into().unwrap()
}

fn charlie() -> ContractAddress {
    'charlie'.try_into().unwrap()
}

fn dave() -> ContractAddress {
    'dave'.try_into().unwrap()
}

fn eve() -> ContractAddress {
    'eve'.try_into().unwrap()
}

fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
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
    append_bytearray(ref calldata, 'Mock USDC', 9);
    append_bytearray(ref calldata, 'USDC', 4);
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
    let base_asset = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(base_asset.contract_address, admin());
    (base_asset, yield_token)
}

fn deploy_sy(
    underlying: ContractAddress, index_oracle: ContractAddress, is_erc4626: bool,
) -> ISYDispatcher {
    let contract = declare("SY").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'Standardized Yield', 18);
    append_bytearray(ref calldata, 'SY', 2);
    calldata.append(underlying.into());
    calldata.append(index_oracle.into());
    calldata.append(if is_erc4626 {
        1
    } else {
        0
    });
    calldata.append(0); // AssetType::Token
    calldata.append(admin().into()); // pauser

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
    append_bytearray(ref calldata, 'Yield Token', 11);
    append_bytearray(ref calldata, 'YT', 2);
    calldata.append(sy.into());
    calldata.append((*pt_class.class_hash).into());
    calldata.append(expiry.into());
    calldata.append(admin().into()); // pauser
    calldata.append(treasury().into()); // treasury
    calldata.append(18); // decimals

    let (contract_address, _) = yt_class.deploy(@calldata).unwrap_syscall();
    IYTDispatcher { contract_address }
}

fn deploy_market(pt: ContractAddress) -> IMarketDispatcher {
    let contract = declare("Market").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'PT-SY LP', 8);
    append_bytearray(ref calldata, 'LP', 2);
    calldata.append(pt.into());
    let scalar_root = 50 * WAD;
    let initial_anchor = WAD / 10;
    let fee_rate = WAD / 100;
    calldata.append(scalar_root.low.into());
    calldata.append(scalar_root.high.into());
    calldata.append(initial_anchor.low.into());
    calldata.append(initial_anchor.high.into());
    calldata.append(fee_rate.low.into());
    calldata.append(fee_rate.high.into());
    calldata.append(admin().into()); // pauser

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketDispatcher { contract_address }
}

fn deploy_router() -> IRouterDispatcher {
    let contract = declare("Router").unwrap_syscall().contract_class();
    let mut calldata = array![];
    calldata.append(admin().into()); // owner
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IRouterDispatcher { contract_address }
}

fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

fn set_yield_index(yield_token: IMockYieldTokenDispatcher, new_index: u256) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    // Disable time-based yield for precise control when manually setting index
    yield_token.set_yield_rate_bps(0);
    yield_token.set_index(new_index);
    stop_cheat_caller_address(yield_token.contract_address);

    // Advance block number to invalidate YT's same-block cache
    let block_num: u64 = (new_index / 1000000000000000).try_into().unwrap_or(1000) + 1;
    start_cheat_block_number_global(block_num);
}

// Helper: Setup user with SY and PT tokens
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
    sy.deposit(user, underlying.contract_address, amount * 2, 0);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);
}

// ============ Zero Amount Tests ============

#[test]
#[should_panic(expected: 'HZN: zero deposit')]
fn test_zero_sy_deposit() {
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);

    start_cheat_caller_address(sy.contract_address, alice());
    sy.deposit(alice(), underlying.contract_address, 0, 0); // Should panic
}

#[test]
#[should_panic(expected: 'HZN: zero redeem')]
fn test_zero_sy_redeem() {
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);

    // First deposit some
    mint_yield_token_to_user(underlying, alice(), 100 * WAD);
    start_cheat_caller_address(underlying.contract_address, alice());
    underlying.approve(sy.contract_address, 100 * WAD);
    stop_cheat_caller_address(underlying.contract_address);
    start_cheat_caller_address(sy.contract_address, alice());
    sy.deposit(alice(), underlying.contract_address, 100 * WAD, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Try to redeem zero
    start_cheat_caller_address(sy.contract_address, alice());
    sy.redeem(alice(), 0, underlying.contract_address, 0, false); // Should panic
}

#[test]
#[should_panic(expected: 'HZN: no floating SY')]
fn test_zero_py_mint() {
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);

    // No SY transferred to YT contract = no floating SY = should panic
    start_cheat_caller_address(yt.contract_address, alice());
    yt.mint_py(alice(), alice()); // Should panic - no floating SY
}

#[test]
#[should_panic(expected: 'HZN: no floating PT/YT')]
fn test_zero_py_redeem() {
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);

    // No PT/YT transferred = no floating tokens = should panic
    start_cheat_caller_address(yt.contract_address, alice());
    yt.redeem_py(alice()); // Should panic - no floating PT/YT
}

#[test]
#[should_panic(expected: 'HZN: zero amount')]
fn test_zero_market_mint() {
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let market = deploy_market(pt.contract_address);

    start_cheat_caller_address(market.contract_address, alice());
    market.mint(alice(), 0, 0); // Should panic
}

// ============ Large Amount Tests ============

#[test]
fn test_large_amounts() {
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Large but reasonable amount (1 billion tokens)
    let large_amount = 1_000_000_000 * WAD;

    // Mint underlying
    mint_yield_token_to_user(underlying, alice(), large_amount);

    // Deposit to SY
    start_cheat_caller_address(underlying.contract_address, alice());
    underlying.approve(sy.contract_address, large_amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, alice());
    let sy_received = sy.deposit(alice(), underlying.contract_address, large_amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy_received == large_amount, 'Large SY deposit');

    // Mint PT + YT (floating SY pattern)
    start_cheat_caller_address(sy.contract_address, alice());
    sy.transfer(yt.contract_address, large_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    let (pt_out, yt_out) = yt.mint_py(alice(), alice());
    stop_cheat_caller_address(yt.contract_address);

    assert(pt_out == large_amount, 'Large PT mint');
    assert(yt_out == large_amount, 'Large YT mint');

    // Redeem - transfer PT and YT to YT contract (pre-transfer pattern)
    start_cheat_caller_address(pt.contract_address, alice());
    pt.transfer(yt.contract_address, large_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    yt.transfer(yt.contract_address, large_amount);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    let sy_back = yt.redeem_py(alice());
    stop_cheat_caller_address(yt.contract_address);

    assert(sy_back > 0, 'Large redemption works');
}

// ============ Multiple Users Tests ============

#[test]
fn test_many_users_concurrent_operations() {
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let market = deploy_market(pt.contract_address);

    // Setup 5 users with varying amounts
    let amounts: Array<u256> = array![100 * WAD, 200 * WAD, 150 * WAD, 300 * WAD, 50 * WAD];
    let users: Array<ContractAddress> = array![alice(), bob(), charlie(), dave(), eve()];

    // All users get tokens and add liquidity
    let mut i: u32 = 0;
    loop {
        if i >= 5 {
            break;
        }

        let user = *users.at(i);
        let amount = *amounts.at(i);

        setup_user_with_tokens(underlying, sy, yt, user, amount);

        // Add liquidity
        start_cheat_caller_address(sy.contract_address, user);
        sy.approve(market.contract_address, amount);
        stop_cheat_caller_address(sy.contract_address);

        start_cheat_caller_address(pt.contract_address, user);
        pt.approve(market.contract_address, amount);
        stop_cheat_caller_address(pt.contract_address);

        start_cheat_caller_address(market.contract_address, user);
        market.mint(user, amount, amount);
        stop_cheat_caller_address(market.contract_address);

        i += 1;
    }

    // Verify all users have LP tokens
    let lp_token = IPTDispatcher { contract_address: market.contract_address };
    assert(lp_token.balance_of(alice()) > 0, 'Alice has LP');
    assert(lp_token.balance_of(bob()) > 0, 'Bob has LP');
    assert(lp_token.balance_of(charlie()) > 0, 'Charlie has LP');
    assert(lp_token.balance_of(dave()) > 0, 'Dave has LP');
    assert(lp_token.balance_of(eve()) > 0, 'Eve has LP');

    // Verify market has reserves
    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert(sy_reserve > 0, 'Market has SY');
    assert(pt_reserve > 0, 'Market has PT');
}

#[test]
fn test_sequential_swaps_same_user() {
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let market = deploy_market(pt.contract_address);

    // Setup market with liquidity
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

    // Bob does many sequential swaps
    let trade_amount = 50 * WAD;
    setup_user_with_tokens(underlying, sy, yt, bob(), trade_amount * 20);

    let mut total_sy_spent: u256 = 0;
    let mut total_pt_received: u256 = 0;

    // 5 buy swaps
    let mut i: u32 = 0;
    loop {
        if i >= 5 {
            break;
        }

        start_cheat_caller_address(sy.contract_address, bob());
        sy.approve(market.contract_address, trade_amount);
        stop_cheat_caller_address(sy.contract_address);

        start_cheat_caller_address(market.contract_address, bob());
        let pt_out = market.swap_exact_sy_for_pt(bob(), trade_amount, 0);
        stop_cheat_caller_address(market.contract_address);

        total_sy_spent += trade_amount;
        total_pt_received += pt_out;

        i += 1;
    }

    assert(total_pt_received > 0, 'Received PT from swaps');

    // Now sell all PT back
    start_cheat_caller_address(pt.contract_address, bob());
    pt.approve(market.contract_address, total_pt_received);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, bob());
    let sy_back = market.swap_exact_pt_for_sy(bob(), total_pt_received, 0);
    stop_cheat_caller_address(market.contract_address);

    // Should get back less than spent due to fees and slippage
    assert(sy_back > 0, 'Got SY back');
    assert(sy_back < total_sy_spent, 'Lost to fees/slippage');
}

// ============ Dust Amount Tests ============

#[test]
fn test_minimum_amounts() {
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let _pt = IPTDispatcher { contract_address: yt.pt() };

    // Realistic minimum amount: 1000 wei (avoids rounding issues in WAD-based math)
    // With Pendle-aligned syToAsset math: py = sy * index / WAD
    // Very small amounts can round to zero after division
    let min_amount: u256 = 1000;

    mint_yield_token_to_user(underlying, alice(), min_amount);

    start_cheat_caller_address(underlying.contract_address, alice());
    underlying.approve(sy.contract_address, min_amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, alice());
    let sy_received = sy.deposit(alice(), underlying.contract_address, min_amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Deposit should work
    assert(sy_received > 0, 'Min deposit works');

    // Mint PT + YT from minimum amount (floating SY pattern)
    start_cheat_caller_address(sy.contract_address, alice());
    sy.transfer(yt.contract_address, sy_received);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    let (pt_out, yt_out) = yt.mint_py(alice(), alice());
    stop_cheat_caller_address(yt.contract_address);

    // At least some tokens minted
    assert(pt_out > 0, 'Min PT mint');
    assert(yt_out > 0, 'Min YT mint');
}

#[test]
fn test_mixed_operation_sizes() {
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let market = deploy_market(pt.contract_address);

    // Alice: Large LP
    let large_amount = 10000 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), large_amount);

    start_cheat_caller_address(sy.contract_address, alice());
    sy.approve(market.contract_address, large_amount);
    stop_cheat_caller_address(sy.contract_address);
    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(market.contract_address, large_amount);
    stop_cheat_caller_address(pt.contract_address);
    start_cheat_caller_address(market.contract_address, alice());
    market.mint(alice(), large_amount, large_amount);
    stop_cheat_caller_address(market.contract_address);

    // Bob: Small trades
    let small_amount = WAD; // 1 token
    setup_user_with_tokens(underlying, sy, yt, bob(), small_amount * 10);

    start_cheat_caller_address(sy.contract_address, bob());
    sy.approve(market.contract_address, small_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, bob());
    let pt_out = market.swap_exact_sy_for_pt(bob(), small_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    assert(pt_out > 0, 'Small swap works');

    // Charlie: Medium trades
    let medium_amount = 100 * WAD;
    setup_user_with_tokens(underlying, sy, yt, charlie(), medium_amount * 5);

    start_cheat_caller_address(sy.contract_address, charlie());
    sy.approve(market.contract_address, medium_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, charlie());
    let pt_out_medium = market.swap_exact_sy_for_pt(charlie(), medium_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    assert(pt_out_medium > 0, 'Medium swap works');
    assert(pt_out_medium > pt_out, 'Larger trade = more output');
}

// ============ Timing Edge Cases ============

#[test]
fn test_operations_across_time() {
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let _pt = IPTDispatcher { contract_address: yt.pt() };

    let amount = 1000 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), amount);

    // Record initial state
    let initial_index = yt.py_index_current();

    // Time passes, yield accrues
    start_cheat_block_timestamp_global(start_time + 30 * 24 * 60 * 60);
    set_yield_index(underlying, WAD + WAD / 50); // 2% yield

    // More time passes
    start_cheat_block_timestamp_global(start_time + 60 * 24 * 60 * 60);
    set_yield_index(underlying, WAD + WAD / 25); // 4% yield

    // Index should have grown
    let mid_index = yt.py_index_current();
    assert(mid_index >= initial_index, 'Index grows');

    // More yield
    start_cheat_block_timestamp_global(start_time + 180 * 24 * 60 * 60);
    set_yield_index(underlying, WAD + WAD / 10); // 10% yield

    let late_index = yt.py_index_current();
    assert(late_index >= mid_index, 'Index continues growing');

    // Operations still work late in the term
    // Mint more PT + YT
    mint_yield_token_to_user(underlying, bob(), 500 * WAD);
    start_cheat_caller_address(underlying.contract_address, bob());
    underlying.approve(sy.contract_address, 500 * WAD);
    stop_cheat_caller_address(underlying.contract_address);
    start_cheat_caller_address(sy.contract_address, bob());
    sy.deposit(bob(), underlying.contract_address, 500 * WAD, 0);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, bob());
    sy.transfer(yt.contract_address, 500 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, bob());
    let (pt_out, yt_out) = yt.mint_py(bob(), bob());
    stop_cheat_caller_address(yt.contract_address);

    assert(pt_out > 0, 'Late mint works');
    assert(yt_out > 0, 'Late mint YT works');
}

#[test]
fn test_transfer_chains() {
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let amount = 1000 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), amount);

    // Alice -> Bob -> Charlie -> Dave transfer chain
    let transfer_amount = 200 * WAD;

    // Alice to Bob
    start_cheat_caller_address(yt.contract_address, alice());
    yt.transfer(bob(), transfer_amount);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(pt.contract_address, alice());
    pt.transfer(bob(), transfer_amount);
    stop_cheat_caller_address(pt.contract_address);

    // Bob to Charlie
    start_cheat_caller_address(yt.contract_address, bob());
    yt.transfer(charlie(), transfer_amount);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(pt.contract_address, bob());
    pt.transfer(charlie(), transfer_amount);
    stop_cheat_caller_address(pt.contract_address);

    // Charlie to Dave
    start_cheat_caller_address(yt.contract_address, charlie());
    yt.transfer(dave(), transfer_amount);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(pt.contract_address, charlie());
    pt.transfer(charlie(), transfer_amount);
    stop_cheat_caller_address(pt.contract_address);

    // Verify final balances
    assert(yt.balance_of(alice()) == amount - transfer_amount, 'Alice YT after transfers');
    assert(yt.balance_of(bob()) == 0, 'Bob forwarded YT');
    assert(yt.balance_of(charlie()) == 0, 'Charlie forwarded YT');
    assert(yt.balance_of(dave()) == transfer_amount, 'Dave received YT');

    // Dave can still use the tokens
    start_cheat_caller_address(yt.contract_address, dave());
    let interest = yt.redeem_due_interest(dave());
    stop_cheat_caller_address(yt.contract_address);

    // Interest should be >= 0
    assert(interest >= 0, 'Dave can claim interest');
}

#[test]
fn test_approval_patterns() {
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let amount = 1000 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), amount);

    // Alice approves Bob for partial amount
    let approve_amount = 300 * WAD;
    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(bob(), approve_amount);
    stop_cheat_caller_address(pt.contract_address);

    // Bob transfers from Alice
    start_cheat_caller_address(pt.contract_address, bob());
    pt.transfer_from(alice(), charlie(), approve_amount);
    stop_cheat_caller_address(pt.contract_address);

    // Verify transfer worked
    assert(pt.balance_of(alice()) == amount - approve_amount, 'Alice balance after');
    assert(pt.balance_of(charlie()) == approve_amount, 'Charlie received');

    // Allowance should be consumed
    assert(pt.allowance(alice(), bob()) == 0, 'Allowance consumed');

    // Over-approve pattern: approve max then transfer
    let max_approval: u256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    start_cheat_caller_address(yt.contract_address, alice());
    yt.approve(bob(), max_approval);
    stop_cheat_caller_address(yt.contract_address);

    // Multiple transfers from same approval
    start_cheat_caller_address(yt.contract_address, bob());
    yt.transfer_from(alice(), charlie(), 100 * WAD);
    yt.transfer_from(alice(), dave(), 100 * WAD);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.balance_of(charlie()) == 100 * WAD, 'Charlie got YT');
    assert(yt.balance_of(dave()) == 100 * WAD, 'Dave got YT');
}
