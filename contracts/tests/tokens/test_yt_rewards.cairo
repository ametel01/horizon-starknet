/// Tests for YT reward tracking
///
/// These tests validate the integration of YT contract with RewardManagerComponent:
/// - Initialization with reward tokens
/// - Reward accrual based on YT balance
/// - Reward updates on transfer (ERC20 hooks)
/// - Claim rewards functionality
/// - Combined interest + rewards claim (redeem_due_interest_and_rewards)
/// - Multi-reward token support

use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math_fp::WAD;
use horizon::mocks::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_number_global,
    start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ClassHash, ContractAddress, SyscallResultTrait};

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

fn alice() -> ContractAddress {
    'alice'.try_into().unwrap()
}

fn bob() -> ContractAddress {
    'bob'.try_into().unwrap()
}

fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
}

fn zero_address() -> ContractAddress {
    0.try_into().unwrap()
}

// ============ Time Constants ============

const CURRENT_TIME: u64 = 1000000;
const ONE_YEAR: u64 = 365 * 86400;

// ============ ByteArray Helper ============

fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0); // data array length
    calldata.append(value); // pending_word
    calldata.append(len.into()); // pending_word_len
}

// ============ Contract Deployment ============

/// Deploy a mock ERC20 token (for reward tokens or underlying)
fn deploy_mock_erc20(name: felt252, symbol: felt252) -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, name, 4);
    append_bytearray(ref calldata, symbol, 4);

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMockERC20Dispatcher { contract_address }
}

/// Deploy mock yield token (yield-bearing asset like wstETH/aUSDC)
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

/// Deploy SY token
fn deploy_sy(underlying: ContractAddress, index_oracle: ContractAddress) -> ISYDispatcher {
    let contract = declare("SY").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'SY Token', 8);
    append_bytearray(ref calldata, 'SY', 2);
    calldata.append(underlying.into());
    calldata.append(index_oracle.into());
    calldata.append(1); // is_erc4626 = true
    calldata.append(0); // AssetType::Token = 0
    calldata.append(admin().into()); // pauser

    // tokens_in (just underlying)
    calldata.append(1); // length
    calldata.append(underlying.into());

    // tokens_out (just underlying)
    calldata.append(1); // length
    calldata.append(underlying.into());

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    ISYDispatcher { contract_address }
}

/// Get PT class hash for YT deployment
fn get_pt_class_hash() -> ClassHash {
    let contract = declare("PT").unwrap_syscall().contract_class();
    *contract.class_hash
}

/// Deploy YT token with reward tokens
fn deploy_yt_with_rewards(
    sy: ContractAddress,
    pt_class_hash: ClassHash,
    expiry: u64,
    reward_tokens: Array<ContractAddress>,
) -> IYTDispatcher {
    let contract = declare("YT").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'YT Token', 8);
    append_bytearray(ref calldata, 'YT', 2);
    calldata.append(sy.into());
    calldata.append(pt_class_hash.into());
    calldata.append(expiry.into());
    calldata.append(admin().into()); // pauser
    calldata.append(treasury().into()); // treasury
    calldata.append(18); // decimals

    // Reward tokens
    Serde::serialize(@reward_tokens, ref calldata);

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IYTDispatcher { contract_address }
}

// ============ Setup Functions ============

/// Setup basic test environment with single reward token
fn setup_single_reward() -> (
    IMockERC20Dispatcher, // base asset
    IMockYieldTokenDispatcher, // yield token (underlying for SY)
    ISYDispatcher, // SY token
    IYTDispatcher, // YT token
    IMockERC20Dispatcher // reward token
) {
    start_cheat_block_timestamp_global(CURRENT_TIME);

    let base_asset = deploy_mock_erc20('BASE', 'BASE');
    let yield_token = deploy_mock_yield_token(base_asset.contract_address, admin());
    let sy = deploy_sy(yield_token.contract_address, yield_token.contract_address);

    let reward_token = deploy_mock_erc20('REW', 'REW');
    let pt_class_hash = get_pt_class_hash();
    let expiry = CURRENT_TIME + ONE_YEAR;
    let yt = deploy_yt_with_rewards(
        sy.contract_address, pt_class_hash, expiry, array![reward_token.contract_address],
    );

    (base_asset, yield_token, sy, yt, reward_token)
}

/// Setup with multiple reward tokens
fn setup_multi_reward() -> (
    IMockERC20Dispatcher, // base asset
    IMockYieldTokenDispatcher, // yield token
    ISYDispatcher, // SY token
    IYTDispatcher, // YT token
    IMockERC20Dispatcher, // reward token 1
    IMockERC20Dispatcher // reward token 2
) {
    start_cheat_block_timestamp_global(CURRENT_TIME);

    let base_asset = deploy_mock_erc20('BASE', 'BASE');
    let yield_token = deploy_mock_yield_token(base_asset.contract_address, admin());
    let sy = deploy_sy(yield_token.contract_address, yield_token.contract_address);

    let reward_token1 = deploy_mock_erc20('REW1', 'REW1');
    let reward_token2 = deploy_mock_erc20('REW2', 'REW2');
    let pt_class_hash = get_pt_class_hash();
    let expiry = CURRENT_TIME + ONE_YEAR;
    let yt = deploy_yt_with_rewards(
        sy.contract_address,
        pt_class_hash,
        expiry,
        array![reward_token1.contract_address, reward_token2.contract_address],
    );

    (base_asset, yield_token, sy, yt, reward_token1, reward_token2)
}

/// Setup with no reward tokens (for comparison)
fn setup_no_rewards() -> (
    IMockERC20Dispatcher, IMockYieldTokenDispatcher, ISYDispatcher, IYTDispatcher,
) {
    start_cheat_block_timestamp_global(CURRENT_TIME);

    let base_asset = deploy_mock_erc20('BASE', 'BASE');
    let yield_token = deploy_mock_yield_token(base_asset.contract_address, admin());
    let sy = deploy_sy(yield_token.contract_address, yield_token.contract_address);

    let pt_class_hash = get_pt_class_hash();
    let expiry = CURRENT_TIME + ONE_YEAR;
    let yt = deploy_yt_with_rewards(sy.contract_address, pt_class_hash, expiry, array![]);

    (base_asset, yield_token, sy, yt)
}

// ============ Helper Functions ============

/// Mint yield token shares to a user
fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

/// Mint yield token and deposit to SY for a user
fn mint_and_deposit_sy(
    yield_token: IMockYieldTokenDispatcher, sy: ISYDispatcher, user: ContractAddress, amount: u256,
) -> u256 {
    mint_yield_token_to_user(yield_token, user, amount);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    let sy_minted = sy.deposit(user, yield_token.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    sy_minted
}

/// Mint PT/YT for a user (deposit SY and mint)
fn mint_py_for_user(
    yield_token: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    user: ContractAddress,
    amount: u256,
) -> (u256, u256) {
    // Get SY first
    let sy_amount = mint_and_deposit_sy(yield_token, sy, user, amount);

    // Transfer SY to YT contract (floating SY pattern)
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, sy_amount);
    stop_cheat_caller_address(sy.contract_address);

    // Mint PT/YT
    start_cheat_caller_address(yt.contract_address, user);
    let (pt_minted, yt_minted) = yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    (pt_minted, yt_minted)
}

/// Send reward tokens to the YT contract (simulates reward distribution)
fn send_rewards(reward_token: IMockERC20Dispatcher, yt: IYTDispatcher, amount: u256) {
    start_cheat_caller_address(reward_token.contract_address, admin());
    reward_token.mint(yt.contract_address, amount);
    stop_cheat_caller_address(reward_token.contract_address);
}

/// Set yield token index (simulate yield accrual)
fn set_yield_index(yield_token: IMockYieldTokenDispatcher, new_index: u256) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.set_yield_rate_bps(0);
    yield_token.set_index(new_index);
    stop_cheat_caller_address(yield_token.contract_address);

    // Advance block number to invalidate cache
    let block_num: u64 = (new_index / 1000000000000000).try_into().unwrap_or(1000) + 1;
    start_cheat_block_number_global(block_num);
}

// ============ Initialization Tests ============

#[test]
fn test_yt_deploy_with_single_reward_token() {
    let (_, _, _, yt, reward_token) = setup_single_reward();

    // Verify reward token is registered
    let tokens = yt.get_reward_tokens();
    assert(tokens.len() == 1, 'wrong reward count');
    assert(*tokens.at(0) == reward_token.contract_address, 'wrong reward token');
}

#[test]
fn test_yt_deploy_with_multiple_reward_tokens() {
    let (_, _, _, yt, reward1, reward2) = setup_multi_reward();

    let tokens = yt.get_reward_tokens();
    assert(tokens.len() == 2, 'wrong reward count');
    assert(*tokens.at(0) == reward1.contract_address, 'wrong reward token 1');
    assert(*tokens.at(1) == reward2.contract_address, 'wrong reward token 2');
}

#[test]
fn test_yt_deploy_without_reward_tokens() {
    let (_, _, _, yt) = setup_no_rewards();

    let tokens = yt.get_reward_tokens();
    assert(tokens.len() == 0, 'should have no rewards');
}

// ============ Basic Reward Accrual Tests ============

#[test]
fn test_rewards_accrue_after_mint_py() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    // User1 mints PT/YT
    let amount = 1000 * WAD;
    mint_py_for_user(yield_token, sy, yt, user1(), amount);

    // Verify user has YT
    assert(yt.balance_of(user1()) > 0, 'user should have YT');

    // Send rewards to YT contract
    let reward_amount = 100 * WAD;
    send_rewards(reward_token, yt, reward_amount);

    // Claim rewards for user1
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed = yt.claim_rewards(user1());
    stop_cheat_caller_address(yt.contract_address);

    // User1 should get all rewards (only YT holder)
    assert(claimed.len() == 1, 'wrong claimed length');
    assert(*claimed.at(0) == reward_amount, 'wrong claimed amount');
}

#[test]
fn test_rewards_proportional_to_yt_balance() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    // User1 mints 75% of total
    mint_py_for_user(yield_token, sy, yt, user1(), 750 * WAD);
    // User2 mints 25% of total
    mint_py_for_user(yield_token, sy, yt, user2(), 250 * WAD);

    // Send rewards
    let reward_amount = 100 * WAD;
    send_rewards(reward_token, yt, reward_amount);

    // Claim for both users
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed1 = yt.claim_rewards(user1());
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(yt.contract_address, user2());
    let claimed2 = yt.claim_rewards(user2());
    stop_cheat_caller_address(yt.contract_address);

    // User1: 75% of rewards, User2: 25% of rewards
    assert(*claimed1.at(0) == 75 * WAD, 'user1 wrong rewards');
    assert(*claimed2.at(0) == 25 * WAD, 'user2 wrong rewards');
}

// ============ Transfer Reward Tracking Tests ============

#[test]
fn test_rewards_update_on_yt_transfer() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    // User1 mints all PT/YT
    let amount = 1000 * WAD;
    mint_py_for_user(yield_token, sy, yt, user1(), amount);

    // Send first batch of rewards
    send_rewards(reward_token, yt, 100 * WAD);

    // User1 transfers half YT to user2
    // ERC20 hook should trigger reward update for both
    start_cheat_caller_address(yt.contract_address, user1());
    yt.transfer(user2(), yt.balance_of(user1()) / 2);
    stop_cheat_caller_address(yt.contract_address);

    // Send second batch of rewards
    send_rewards(reward_token, yt, 100 * WAD);

    // Claim for both
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed1 = yt.claim_rewards(user1());
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(yt.contract_address, user2());
    let claimed2 = yt.claim_rewards(user2());
    stop_cheat_caller_address(yt.contract_address);

    // User1: 100 (all of first batch) + 50 (half of second batch) = 150
    // User2: 0 (none of first batch) + 50 (half of second batch) = 50
    assert(*claimed1.at(0) == 150 * WAD, 'user1 wrong rewards');
    assert(*claimed2.at(0) == 50 * WAD, 'user2 wrong rewards');
}

#[test]
fn test_no_retroactive_rewards_for_new_yt_holder() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    // User1 mints first
    mint_py_for_user(yield_token, sy, yt, user1(), 1000 * WAD);

    // Send rewards before user2 enters
    send_rewards(reward_token, yt, 100 * WAD);

    // User2 mints after rewards sent
    mint_py_for_user(yield_token, sy, yt, user2(), 1000 * WAD);

    // Claim for both
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed1 = yt.claim_rewards(user1());
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(yt.contract_address, user2());
    let claimed2 = yt.claim_rewards(user2());
    stop_cheat_caller_address(yt.contract_address);

    // User1 gets all rewards, user2 gets none
    assert(*claimed1.at(0) == 100 * WAD, 'user1 wrong rewards');
    assert(*claimed2.at(0) == 0, 'user2 should get nothing');
}

// ============ Claim Rewards Tests ============

#[test]
fn test_claim_twice_returns_zero() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    mint_py_for_user(yield_token, sy, yt, user1(), 1000 * WAD);
    send_rewards(reward_token, yt, 100 * WAD);

    // First claim
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed1 = yt.claim_rewards(user1());
    stop_cheat_caller_address(yt.contract_address);

    assert(*claimed1.at(0) == 100 * WAD, 'first claim wrong');

    // Second claim without new rewards
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed2 = yt.claim_rewards(user1());
    stop_cheat_caller_address(yt.contract_address);

    assert(*claimed2.at(0) == 0, 'second claim should be zero');
}

#[test]
fn test_claim_for_user_with_no_yt() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    // User1 has YT
    mint_py_for_user(yield_token, sy, yt, user1(), 1000 * WAD);

    // Send rewards
    send_rewards(reward_token, yt, 100 * WAD);

    // User2 claims without any YT
    start_cheat_caller_address(yt.contract_address, user2());
    let claimed = yt.claim_rewards(user2());
    stop_cheat_caller_address(yt.contract_address);

    assert(claimed.len() == 1, 'wrong length');
    assert(*claimed.at(0) == 0, 'should be zero');
}

// ============ Multi-Reward Token Tests ============

#[test]
fn test_multi_reward_tokens_claim() {
    let (_, yield_token, sy, yt, reward1, reward2) = setup_multi_reward();

    // User mints
    mint_py_for_user(yield_token, sy, yt, user1(), 1000 * WAD);

    // Send different amounts of each reward token
    send_rewards(reward1, yt, 100 * WAD);
    send_rewards(reward2, yt, 200 * WAD);

    // Claim
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed = yt.claim_rewards(user1());
    stop_cheat_caller_address(yt.contract_address);

    assert(claimed.len() == 2, 'wrong claimed length');
    assert(*claimed.at(0) == 100 * WAD, 'wrong reward1');
    assert(*claimed.at(1) == 200 * WAD, 'wrong reward2');
}

#[test]
fn test_multi_reward_proportional_distribution() {
    let (_, yield_token, sy, yt, reward1, reward2) = setup_multi_reward();

    // User1: 60%, User2: 40%
    mint_py_for_user(yield_token, sy, yt, user1(), 600 * WAD);
    mint_py_for_user(yield_token, sy, yt, user2(), 400 * WAD);

    // Send rewards
    send_rewards(reward1, yt, 100 * WAD);
    send_rewards(reward2, yt, 200 * WAD);

    // Claim for both
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed1 = yt.claim_rewards(user1());
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(yt.contract_address, user2());
    let claimed2 = yt.claim_rewards(user2());
    stop_cheat_caller_address(yt.contract_address);

    // User1: 60% of each reward
    assert(*claimed1.at(0) == 60 * WAD, 'user1 wrong reward1');
    assert(*claimed1.at(1) == 120 * WAD, 'user1 wrong reward2');

    // User2: 40% of each reward
    assert(*claimed2.at(0) == 40 * WAD, 'user2 wrong reward1');
    assert(*claimed2.at(1) == 80 * WAD, 'user2 wrong reward2');
}

// ============ Combined Interest + Rewards Tests ============

#[test]
fn test_redeem_due_interest_and_rewards_both() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    // User mints PT/YT
    let amount = 1000 * WAD;
    mint_py_for_user(yield_token, sy, yt, user1(), amount);

    // Simulate yield accrual by increasing exchange rate
    set_yield_index(yield_token, WAD + WAD / 10); // 10% yield

    // Send reward tokens
    let reward_amount = 50 * WAD;
    send_rewards(reward_token, yt, reward_amount);

    // Get initial SY balance
    let sy_balance_before = sy.balance_of(user1());
    let reward_balance_before = reward_token.balance_of(user1());

    // Redeem both interest and rewards
    start_cheat_caller_address(yt.contract_address, user1());
    let (interest_out, rewards_out) = yt.redeem_due_interest_and_rewards(user1(), true, true);
    stop_cheat_caller_address(yt.contract_address);

    // Verify interest was claimed (should be > 0 due to yield)
    assert(interest_out > 0, 'interest should be > 0');

    // Verify rewards were claimed
    assert(rewards_out.len() == 1, 'wrong rewards length');
    assert(*rewards_out.at(0) == reward_amount, 'wrong reward amount');

    // Verify balances increased
    assert(sy.balance_of(user1()) > sy_balance_before, 'SY not received');
    assert(
        reward_token.balance_of(user1()) == reward_balance_before + reward_amount,
        'reward not received',
    );
}

#[test]
fn test_redeem_due_interest_and_rewards_interest_only() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    // User mints PT/YT
    mint_py_for_user(yield_token, sy, yt, user1(), 1000 * WAD);

    // Simulate yield accrual
    set_yield_index(yield_token, WAD + WAD / 10); // 10% yield

    // Send reward tokens
    send_rewards(reward_token, yt, 50 * WAD);

    // Redeem interest only (do_rewards = false)
    start_cheat_caller_address(yt.contract_address, user1());
    let (interest_out, rewards_out) = yt.redeem_due_interest_and_rewards(user1(), true, false);
    stop_cheat_caller_address(yt.contract_address);

    // Verify interest was claimed
    assert(interest_out > 0, 'interest should be > 0');

    // Verify rewards were NOT claimed (empty array)
    assert(rewards_out.len() == 0, 'rewards should be empty');

    // Verify rewards still claimable
    start_cheat_caller_address(yt.contract_address, user1());
    let later_rewards = yt.claim_rewards(user1());
    stop_cheat_caller_address(yt.contract_address);

    assert(*later_rewards.at(0) == 50 * WAD, 'rewards should still exist');
}

#[test]
fn test_redeem_due_interest_and_rewards_rewards_only() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    // User mints PT/YT
    mint_py_for_user(yield_token, sy, yt, user1(), 1000 * WAD);

    // Simulate yield accrual
    set_yield_index(yield_token, WAD + WAD / 10); // 10% yield

    // Send reward tokens
    let reward_amount = 50 * WAD;
    send_rewards(reward_token, yt, reward_amount);

    // Get pending interest before
    let pending_interest_before = yt.get_user_interest(user1());

    // Redeem rewards only (do_interest = false)
    start_cheat_caller_address(yt.contract_address, user1());
    let (interest_out, rewards_out) = yt.redeem_due_interest_and_rewards(user1(), false, true);
    stop_cheat_caller_address(yt.contract_address);

    // Verify interest was NOT claimed
    assert(interest_out == 0, 'interest should be 0');

    // Verify rewards were claimed
    assert(*rewards_out.at(0) == reward_amount, 'wrong reward amount');

    // Verify interest still claimable
    let pending_interest_after = yt.get_user_interest(user1());
    assert(pending_interest_after >= pending_interest_before, 'interest should still exist');
}

#[test]
fn test_redeem_due_interest_and_rewards_neither() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    // User mints PT/YT
    mint_py_for_user(yield_token, sy, yt, user1(), 1000 * WAD);

    // Simulate yield and rewards
    set_yield_index(yield_token, WAD + WAD / 10);
    send_rewards(reward_token, yt, 50 * WAD);

    // Redeem neither (both false)
    start_cheat_caller_address(yt.contract_address, user1());
    let (interest_out, rewards_out) = yt.redeem_due_interest_and_rewards(user1(), false, false);
    stop_cheat_caller_address(yt.contract_address);

    // Both should be zero/empty
    assert(interest_out == 0, 'interest should be 0');
    assert(rewards_out.len() == 0, 'rewards should be empty');
}

// ============ Edge Cases ============

#[test]
fn test_rewards_when_yt_supply_goes_to_zero() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    // User1 mints and then redeems all (PT+YT)
    let (pt_amount, yt_amount) = mint_py_for_user(yield_token, sy, yt, user1(), 1000 * WAD);
    assert(pt_amount == yt_amount, 'pt != yt');

    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Transfer PT and YT to YT contract and redeem
    start_cheat_caller_address(pt.contract_address, user1());
    pt.transfer(yt.contract_address, pt_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, user1());
    yt.transfer(yt.contract_address, yt_amount);
    yt.redeem_py(user1());
    stop_cheat_caller_address(yt.contract_address);

    // Supply should be zero
    assert(yt.total_supply() == 0, 'supply should be zero');

    // Send rewards while no holders exist
    send_rewards(reward_token, yt, 100 * WAD);

    // User2 mints after rewards sent
    mint_py_for_user(yield_token, sy, yt, user2(), 1000 * WAD);

    // User2 should get the rewards (first holder after zero-supply)
    start_cheat_caller_address(yt.contract_address, user2());
    let claimed = yt.claim_rewards(user2());
    stop_cheat_caller_address(yt.contract_address);

    assert(*claimed.at(0) == 100 * WAD, 'user2 should get rewards');
}

#[test]
fn test_rewards_with_yt_burn_on_redeem() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    // User1 and User2 both mint
    mint_py_for_user(yield_token, sy, yt, user1(), 500 * WAD);
    let (pt_amount2, yt_amount2) = mint_py_for_user(yield_token, sy, yt, user2(), 500 * WAD);

    // Send first batch of rewards
    send_rewards(reward_token, yt, 100 * WAD);

    let pt = IPTDispatcher { contract_address: yt.pt() };

    // User2 redeems all their PT+YT - this should update their rewards first
    start_cheat_caller_address(pt.contract_address, user2());
    pt.transfer(yt.contract_address, pt_amount2);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, user2());
    yt.transfer(yt.contract_address, yt_amount2);
    yt.redeem_py(user2());
    stop_cheat_caller_address(yt.contract_address);

    // Send second batch of rewards
    send_rewards(reward_token, yt, 100 * WAD);

    // Claim for both
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed1 = yt.claim_rewards(user1());
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(yt.contract_address, user2());
    let claimed2 = yt.claim_rewards(user2());
    stop_cheat_caller_address(yt.contract_address);

    // User1: 50 (half of first batch) + 100 (all of second batch, only holder) = 150
    // User2: 50 (half of first batch, captured before burn) + 0 = 50
    assert(*claimed1.at(0) == 150 * WAD, 'user1 wrong rewards');
    assert(*claimed2.at(0) == 50 * WAD, 'user2 wrong rewards');
}

#[test]
fn test_transfer_from_updates_rewards() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    // User1 mints
    mint_py_for_user(yield_token, sy, yt, user1(), 1000 * WAD);
    let yt_balance = yt.balance_of(user1());

    // Send rewards
    send_rewards(reward_token, yt, 100 * WAD);

    // User1 approves alice
    start_cheat_caller_address(yt.contract_address, user1());
    yt.approve(alice(), yt_balance / 2);
    stop_cheat_caller_address(yt.contract_address);

    // Alice transfers from user1 to bob (uses transfer_from)
    start_cheat_caller_address(yt.contract_address, alice());
    yt.transfer_from(user1(), bob(), yt_balance / 2);
    stop_cheat_caller_address(yt.contract_address);

    // User1's rewards should be locked in (updated before transfer)
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed1 = yt.claim_rewards(user1());
    stop_cheat_caller_address(yt.contract_address);

    assert(*claimed1.at(0) == 100 * WAD, 'user1 wrong rewards');

    // Bob shouldn't have any rewards from before transfer
    start_cheat_caller_address(yt.contract_address, bob());
    let claimed_bob = yt.claim_rewards(bob());
    stop_cheat_caller_address(yt.contract_address);

    assert(*claimed_bob.at(0) == 0, 'bob should have nothing');
}

#[test]
fn test_multiple_mints_same_user_rewards() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    // First mint
    mint_py_for_user(yield_token, sy, yt, user1(), 500 * WAD);

    // Send rewards
    send_rewards(reward_token, yt, 50 * WAD);

    // Second mint (should update rewards first via ERC20 hooks)
    mint_py_for_user(yield_token, sy, yt, user1(), 500 * WAD);

    // Send more rewards
    send_rewards(reward_token, yt, 100 * WAD);

    // Claim
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed = yt.claim_rewards(user1());
    stop_cheat_caller_address(yt.contract_address);

    // 50 (first batch, only holder) + 100 (second batch, only holder) = 150
    assert(*claimed.at(0) == 150 * WAD, 'wrong claimed amount');
}

// ============ Reward Token Verification ============

#[test]
fn test_reward_tokens_actually_transferred_on_claim() {
    let (_, yield_token, sy, yt, reward_token) = setup_single_reward();

    mint_py_for_user(yield_token, sy, yt, user1(), 1000 * WAD);

    let reward_amount = 100 * WAD;
    send_rewards(reward_token, yt, reward_amount);

    // Check balances before
    let user_balance_before = reward_token.balance_of(user1());
    let yt_balance_before = reward_token.balance_of(yt.contract_address);

    // Claim
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed = yt.claim_rewards(user1());
    stop_cheat_caller_address(yt.contract_address);

    // Check balances after
    let user_balance_after = reward_token.balance_of(user1());
    let yt_balance_after = reward_token.balance_of(yt.contract_address);

    // Verify tokens actually moved
    assert(user_balance_after == user_balance_before + reward_amount, 'user balance wrong');
    assert(yt_balance_after == yt_balance_before - reward_amount, 'yt balance wrong');
    assert(*claimed.at(0) == reward_amount, 'claimed amount wrong');
}
