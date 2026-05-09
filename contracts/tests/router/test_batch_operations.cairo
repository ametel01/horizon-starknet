/// Tests for Router batch operations
///
/// Tests:
/// - redeem_due_interest_and_rewards: Batch claim interest from YTs and rewards from markets

use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_router::{IRouterDispatcher, IRouterDispatcherTrait};
use horizon::interfaces::i_sy::ISYDispatcherTrait;
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math::WAD;
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};
use crate::utils::{
    admin, append_bytearray, mint_and_deposit_sy, set_yield_index, setup_full, treasury, user1,
    user2, zero_address,
};

// ============ Helper Functions ============

fn default_scalar_root() -> u256 {
    50 * WAD
}

fn default_initial_anchor() -> u256 {
    WAD / 10
}

fn default_fee_rate() -> u256 {
    WAD / 100
}

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

fn deploy_router() -> IRouterDispatcher {
    let contract = declare("Router").unwrap_syscall().contract_class();
    let mut calldata = array![];
    calldata.append(admin().into()); // owner
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IRouterDispatcher { contract_address }
}

// ============ redeem_due_interest_and_rewards Tests ============

#[test]
fn test_batch_redeem_empty_arrays() {
    let (_, _, _, _) = setup_full();
    let router = deploy_router();
    let user = user1();

    // Call with empty arrays - should succeed with zero results
    start_cheat_caller_address(router.contract_address, user);
    let (total_interest, rewards) = router
        .redeem_due_interest_and_rewards(user, array![].span(), array![].span());
    stop_cheat_caller_address(router.contract_address);

    assert(total_interest == 0, 'Should have zero interest');
    assert(rewards.len() == 0, 'Should have no rewards');
}

#[test]
fn test_batch_redeem_single_yt_no_interest() {
    let (_, yield_token, sy, yt) = setup_full();
    let router = deploy_router();
    let user = user1();

    // Mint some YT for user (which will accrue interest)
    let amount = 100 * WAD;
    mint_and_deposit_sy(yield_token, sy, user, amount);

    // Transfer SY to YT and mint PT/YT
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Immediately redeem interest - should be 0 since no yield accrued yet
    start_cheat_caller_address(router.contract_address, user);
    let (total_interest, rewards) = router
        .redeem_due_interest_and_rewards(user, array![yt.contract_address].span(), array![].span());
    stop_cheat_caller_address(router.contract_address);

    // No time has passed, so no interest should have accrued
    assert(total_interest == 0, 'Should have zero interest');
    assert(rewards.len() == 0, 'Should have no rewards');
}

#[test]
fn test_batch_redeem_single_yt_with_interest() {
    let (_, yield_token, sy, yt) = setup_full();
    let router = deploy_router();
    let user = user1();

    // Mint some YT for user
    let amount = 100 * WAD;
    mint_and_deposit_sy(yield_token, sy, user, amount);

    // Transfer SY to YT and mint PT/YT
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Simulate yield accrual by increasing the index
    let new_index = WAD * 11 / 10; // 10% yield
    set_yield_index(yield_token, new_index);

    let sy_before = sy.balance_of(user);

    // Redeem interest through router
    start_cheat_caller_address(router.contract_address, user);
    let (total_interest, rewards) = router
        .redeem_due_interest_and_rewards(user, array![yt.contract_address].span(), array![].span());
    stop_cheat_caller_address(router.contract_address);

    // User should have received interest
    let sy_after = sy.balance_of(user);
    assert(total_interest > 0, 'Should have interest');
    assert(sy_after > sy_before, 'SY balance should increase');
    assert(sy_after - sy_before == total_interest, 'Interest mismatch');
    assert(rewards.len() == 0, 'Should have no rewards');
}

#[test]
fn test_batch_redeem_multiple_yts() {
    let (_, yield_token, sy, yt1) = setup_full();

    // Deploy a second YT with different expiry
    let pt_class = declare("PT").unwrap_syscall().contract_class();
    let yt_class = declare("YT").unwrap_syscall().contract_class();
    let expiry2 = yt1.expiry() + 365 * 86400; // 1 year later

    let mut calldata = array![];
    append_bytearray(ref calldata, 'YT Token 2', 10);
    append_bytearray(ref calldata, 'YT2', 3);
    calldata.append(sy.contract_address.into());
    calldata.append((*pt_class.class_hash).into());
    calldata.append(expiry2.into());
    calldata.append(admin().into());
    calldata.append(treasury().into());
    calldata.append(18);
    // Reward tokens (empty span for standard deployment)
    let empty_reward_tokens: Array<ContractAddress> = array![];
    Serde::serialize(@empty_reward_tokens, ref calldata);

    let (yt2_address, _) = yt_class.deploy(@calldata).unwrap_syscall();
    let yt2 = IYTDispatcher { contract_address: yt2_address };

    let router = deploy_router();
    let user = user1();

    // Mint YT for user in both positions
    let amount = 100 * WAD;

    // First YT
    mint_and_deposit_sy(yield_token, sy, user, amount);
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt1.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);
    start_cheat_caller_address(yt1.contract_address, user);
    yt1.mint_py(user, user);
    stop_cheat_caller_address(yt1.contract_address);

    // Second YT
    mint_and_deposit_sy(yield_token, sy, user, amount);
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt2.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);
    start_cheat_caller_address(yt2.contract_address, user);
    yt2.mint_py(user, user);
    stop_cheat_caller_address(yt2.contract_address);

    // Simulate yield accrual
    let new_index = WAD * 11 / 10; // 10% yield
    set_yield_index(yield_token, new_index);

    let sy_before = sy.balance_of(user);

    // Redeem interest from both YTs through router
    start_cheat_caller_address(router.contract_address, user);
    let (total_interest, rewards) = router
        .redeem_due_interest_and_rewards(
            user, array![yt1.contract_address, yt2.contract_address].span(), array![].span(),
        );
    stop_cheat_caller_address(router.contract_address);

    // User should have received interest from both
    let sy_after = sy.balance_of(user);
    assert(total_interest > 0, 'Should have interest');
    assert(sy_after > sy_before, 'SY balance should increase');
    assert(sy_after - sy_before == total_interest, 'Interest mismatch');
    assert(rewards.len() == 0, 'Should have no rewards');
}

#[test]
fn test_batch_redeem_with_market() {
    let (_, yield_token, sy, yt) = setup_full();
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let market = deploy_market(pt.contract_address);
    let router = deploy_router();
    let user = user1();

    // Setup user with tokens and provide liquidity
    let amount = 100 * WAD;
    mint_and_deposit_sy(yield_token, sy, user, amount * 2);

    // Mint PT/YT
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);
    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Add liquidity to market
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Simulate yield accrual
    let new_index = WAD * 11 / 10;
    set_yield_index(yield_token, new_index);

    // Redeem interest and rewards through router
    start_cheat_caller_address(router.contract_address, user);
    let (total_interest, rewards) = router
        .redeem_due_interest_and_rewards(
            user, array![yt.contract_address].span(), array![market.contract_address].span(),
        );
    stop_cheat_caller_address(router.contract_address);

    // Should have interest from YT
    assert(total_interest > 0, 'Should have interest');
    // Market rewards array should be present (even if empty - no reward tokens configured)
    assert(rewards.len() == 1, 'Should have 1 market result');
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_batch_redeem_zero_user() {
    let (_, _, _, _) = setup_full();
    let router = deploy_router();

    start_cheat_caller_address(router.contract_address, user1());
    router.redeem_due_interest_and_rewards(zero_address(), array![].span(), array![].span());
}

#[test]
fn test_batch_redeem_different_user() {
    let (_, yield_token, sy, yt) = setup_full();
    let router = deploy_router();
    let user = user1();
    let claimer = user2();

    // Mint YT for user
    let amount = 100 * WAD;
    mint_and_deposit_sy(yield_token, sy, user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Simulate yield accrual
    let new_index = WAD * 11 / 10;
    set_yield_index(yield_token, new_index);

    let user_sy_before = sy.balance_of(user);
    let claimer_sy_before = sy.balance_of(claimer);

    // Another user (claimer) calls the function to claim for user
    // Interest should go to the user, not the claimer
    start_cheat_caller_address(router.contract_address, claimer);
    let (total_interest, _) = router
        .redeem_due_interest_and_rewards(user, array![yt.contract_address].span(), array![].span());
    stop_cheat_caller_address(router.contract_address);

    // User should have received the interest
    let user_sy_after = sy.balance_of(user);
    let claimer_sy_after = sy.balance_of(claimer);
    assert(total_interest > 0, 'Should have interest');
    assert(user_sy_after == user_sy_before + total_interest, 'User should get interest');
    // Claimer should not receive anything
    assert(claimer_sy_after == claimer_sy_before, 'Claimer should get nothing');
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_batch_redeem_zero_yt_address() {
    let (_, _, _, _) = setup_full();
    let router = deploy_router();
    let user = user1();

    start_cheat_caller_address(router.contract_address, user);
    router.redeem_due_interest_and_rewards(user, array![zero_address()].span(), array![].span());
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_batch_redeem_zero_market_address() {
    let (_, _, _, _) = setup_full();
    let router = deploy_router();
    let user = user1();

    start_cheat_caller_address(router.contract_address, user);
    router.redeem_due_interest_and_rewards(user, array![].span(), array![zero_address()].span());
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn test_batch_redeem_when_paused() {
    let (_, _, _, yt) = setup_full();
    let router = deploy_router();
    let user = user1();

    // Pause the router
    start_cheat_caller_address(router.contract_address, admin());
    router.pause();
    stop_cheat_caller_address(router.contract_address);

    // Attempt to redeem when paused should fail
    start_cheat_caller_address(router.contract_address, user);
    router
        .redeem_due_interest_and_rewards(user, array![yt.contract_address].span(), array![].span());
}
