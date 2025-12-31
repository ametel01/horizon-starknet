/// Tests for SYWithRewards contract
///
/// These tests validate the integration of SYComponent + RewardManagerComponent:
/// - Deposit triggers reward updates for the receiver
/// - Redeem triggers reward updates for the burner
/// - Transfer triggers reward updates for both sender and receiver
/// - Claim rewards works correctly after various operations
/// - All base SY functionality works unchanged

use horizon::interfaces::i_sy::AssetType;
use horizon::interfaces::i_sy_with_rewards::{
    ISYWithRewardsAdminDispatcher, ISYWithRewardsAdminDispatcherTrait, ISYWithRewardsDispatcher,
    ISYWithRewardsDispatcherTrait,
};
use horizon::libraries::math_fp::WAD;
use horizon::mocks::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
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

fn alice() -> ContractAddress {
    'alice'.try_into().unwrap()
}

fn bob() -> ContractAddress {
    'bob'.try_into().unwrap()
}

fn zero_address() -> ContractAddress {
    0.try_into().unwrap()
}

// ============ Time Constants ============

const CURRENT_TIME: u64 = 1000000;

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

/// Deploy SYWithRewards token
fn deploy_sy_with_rewards(
    underlying: ContractAddress,
    index_oracle: ContractAddress,
    is_erc4626: bool,
    reward_tokens: Array<ContractAddress>,
) -> ISYWithRewardsDispatcher {
    let contract = declare("SYWithRewards").unwrap_syscall().contract_class();
    let mut calldata = array![];

    // Name and symbol
    append_bytearray(ref calldata, 'SYRewards', 9);
    append_bytearray(ref calldata, 'SYR', 3);

    // Core SY params
    calldata.append(underlying.into());
    calldata.append(index_oracle.into());
    calldata.append(if is_erc4626 {
        1
    } else {
        0
    });

    // AssetType::Token = 0
    calldata.append(0);

    // Pauser
    calldata.append(admin().into());

    // tokens_in (just underlying)
    calldata.append(1); // length
    calldata.append(underlying.into());

    // tokens_out (just underlying)
    calldata.append(1); // length
    calldata.append(underlying.into());

    // reward_tokens
    calldata.append(reward_tokens.len().into());
    for token in reward_tokens {
        calldata.append(token.into());
    }

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    ISYWithRewardsDispatcher { contract_address }
}

// ============ Setup Functions ============

/// Setup basic test environment: underlying -> yield token -> SYWithRewards + reward token
fn setup_single_reward() -> (
    IMockERC20Dispatcher, // base asset
    IMockYieldTokenDispatcher, // yield token (underlying for SY)
    ISYWithRewardsDispatcher, // SYWithRewards
    IMockERC20Dispatcher // reward token
) {
    start_cheat_block_timestamp_global(CURRENT_TIME);

    let base_asset = deploy_mock_erc20('BASE', 'BASE');
    let yield_token = deploy_mock_yield_token(base_asset.contract_address, admin());
    let reward_token = deploy_mock_erc20('REW', 'REW');

    let sy = deploy_sy_with_rewards(
        yield_token.contract_address,
        yield_token.contract_address, // ERC-4626 vault
        true,
        array![reward_token.contract_address],
    );

    (base_asset, yield_token, sy, reward_token)
}

/// Setup with multiple reward tokens
fn setup_multi_reward() -> (
    IMockERC20Dispatcher, // base asset
    IMockYieldTokenDispatcher, // yield token
    ISYWithRewardsDispatcher, // SYWithRewards
    IMockERC20Dispatcher, // reward token 1
    IMockERC20Dispatcher // reward token 2
) {
    start_cheat_block_timestamp_global(CURRENT_TIME);

    let base_asset = deploy_mock_erc20('BASE', 'BASE');
    let yield_token = deploy_mock_yield_token(base_asset.contract_address, admin());
    let reward_token1 = deploy_mock_erc20('REW1', 'REW1');
    let reward_token2 = deploy_mock_erc20('REW2', 'REW2');

    let sy = deploy_sy_with_rewards(
        yield_token.contract_address,
        yield_token.contract_address,
        true,
        array![reward_token1.contract_address, reward_token2.contract_address],
    );

    (base_asset, yield_token, sy, reward_token1, reward_token2)
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
    yield_token: IMockYieldTokenDispatcher,
    sy: ISYWithRewardsDispatcher,
    user: ContractAddress,
    amount: u256,
) -> u256 {
    // Mint yield token to user
    mint_yield_token_to_user(yield_token, user, amount);

    // Approve and deposit
    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    let sy_minted = sy.deposit(user, yield_token.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    sy_minted
}

/// Send reward tokens to the SY contract (simulates reward distribution)
fn send_rewards(reward_token: IMockERC20Dispatcher, sy: ISYWithRewardsDispatcher, amount: u256) {
    // Mint reward tokens directly to the SY contract
    start_cheat_caller_address(reward_token.contract_address, admin());
    reward_token.mint(sy.contract_address, amount);
    stop_cheat_caller_address(reward_token.contract_address);
}

// ============ Basic Functionality Tests ============

#[test]
fn test_deploy_sy_with_rewards() {
    let (_, _, sy, reward_token) = setup_single_reward();

    // Check reward tokens registered
    assert(sy.reward_tokens_count() == 1, 'wrong reward count');

    let tokens = sy.get_reward_tokens();
    assert(*tokens.at(0) == reward_token.contract_address, 'wrong reward token');
    assert(sy.is_reward_token(reward_token.contract_address), 'not registered');
}

#[test]
fn test_deploy_multi_reward_tokens() {
    let (_, _, sy, reward1, reward2) = setup_multi_reward();

    assert(sy.reward_tokens_count() == 2, 'wrong reward count');
    assert(sy.is_reward_token(reward1.contract_address), 'reward1 not registered');
    assert(sy.is_reward_token(reward2.contract_address), 'reward2 not registered');
}

#[test]
fn test_sy_core_deposit() {
    let (_, yield_token, sy, _) = setup_single_reward();
    let amount = 1000 * WAD;

    let sy_minted = mint_and_deposit_sy(yield_token, sy, user1(), amount);

    assert(sy_minted == amount, 'wrong sy minted');
    assert(sy.balance_of(user1()) == amount, 'wrong balance');
    assert(sy.total_supply() == amount, 'wrong total supply');
}

#[test]
fn test_sy_core_redeem() {
    let (_, yield_token, sy, _) = setup_single_reward();
    let amount = 1000 * WAD;

    // Deposit first
    mint_and_deposit_sy(yield_token, sy, user1(), amount);

    // Redeem half
    let redeem_amount = 500 * WAD;
    start_cheat_caller_address(sy.contract_address, user1());
    let redeemed = sy.redeem(user1(), redeem_amount, yield_token.contract_address, 0, false);
    stop_cheat_caller_address(sy.contract_address);

    assert(redeemed == redeem_amount, 'wrong redeem amount');
    assert(sy.balance_of(user1()) == amount - redeem_amount, 'wrong balance after');
}

#[test]
fn test_sy_core_transfer() {
    let (_, yield_token, sy, _) = setup_single_reward();
    let amount = 1000 * WAD;

    mint_and_deposit_sy(yield_token, sy, user1(), amount);

    // Transfer half to user2
    let transfer_amount = 500 * WAD;
    start_cheat_caller_address(sy.contract_address, user1());
    let success = sy.transfer(user2(), transfer_amount);
    stop_cheat_caller_address(sy.contract_address);

    assert(success, 'transfer failed');
    assert(sy.balance_of(user1()) == amount - transfer_amount, 'wrong user1 balance');
    assert(sy.balance_of(user2()) == transfer_amount, 'wrong user2 balance');
}

// ============ Reward Distribution Tests ============

#[test]
fn test_rewards_accrue_after_deposit() {
    let (_, yield_token, sy, reward_token) = setup_single_reward();

    // User1 deposits
    let amount = 1000 * WAD;
    mint_and_deposit_sy(yield_token, sy, user1(), amount);

    // Send rewards to SY contract
    let reward_amount = 100 * WAD;
    send_rewards(reward_token, sy, reward_amount);

    // Claim rewards for user1
    start_cheat_caller_address(sy.contract_address, user1());
    let claimed = sy.claim_rewards(user1());
    stop_cheat_caller_address(sy.contract_address);

    // User1 should get all rewards (only holder)
    assert(claimed.len() == 1, 'wrong claimed length');
    assert(*claimed.at(0) == reward_amount, 'wrong claimed amount');
}

#[test]
fn test_rewards_proportional_to_balance() {
    let (_, yield_token, sy, reward_token) = setup_single_reward();

    // User1 deposits 75%, user2 deposits 25%
    mint_and_deposit_sy(yield_token, sy, user1(), 750 * WAD);
    mint_and_deposit_sy(yield_token, sy, user2(), 250 * WAD);

    // Send rewards
    let reward_amount = 100 * WAD;
    send_rewards(reward_token, sy, reward_amount);

    // Claim for both users
    start_cheat_caller_address(sy.contract_address, user1());
    let claimed1 = sy.claim_rewards(user1());
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user2());
    let claimed2 = sy.claim_rewards(user2());
    stop_cheat_caller_address(sy.contract_address);

    // User1: 75% of rewards, User2: 25% of rewards
    assert(*claimed1.at(0) == 75 * WAD, 'user1 wrong rewards');
    assert(*claimed2.at(0) == 25 * WAD, 'user2 wrong rewards');
}

#[test]
fn test_rewards_update_on_transfer() {
    let (_, yield_token, sy, reward_token) = setup_single_reward();

    // User1 deposits all
    let amount = 1000 * WAD;
    mint_and_deposit_sy(yield_token, sy, user1(), amount);

    // Send first batch of rewards
    send_rewards(reward_token, sy, 100 * WAD);

    // User1 transfers half to user2
    // This should trigger reward update for both users
    start_cheat_caller_address(sy.contract_address, user1());
    sy.transfer(user2(), 500 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    // Send second batch of rewards
    send_rewards(reward_token, sy, 100 * WAD);

    // Claim for both
    start_cheat_caller_address(sy.contract_address, user1());
    let claimed1 = sy.claim_rewards(user1());
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user2());
    let claimed2 = sy.claim_rewards(user2());
    stop_cheat_caller_address(sy.contract_address);

    // User1: 100 (all of first batch) + 50 (half of second batch) = 150
    // User2: 0 (none of first batch) + 50 (half of second batch) = 50
    assert(*claimed1.at(0) == 150 * WAD, 'user1 wrong rewards');
    assert(*claimed2.at(0) == 50 * WAD, 'user2 wrong rewards');
}

#[test]
fn test_no_retroactive_rewards_for_new_depositor() {
    let (_, yield_token, sy, reward_token) = setup_single_reward();

    // User1 deposits
    mint_and_deposit_sy(yield_token, sy, user1(), 1000 * WAD);

    // Send rewards before user2 deposits
    send_rewards(reward_token, sy, 100 * WAD);

    // User2 deposits after rewards
    mint_and_deposit_sy(yield_token, sy, user2(), 1000 * WAD);

    // Claim for both
    start_cheat_caller_address(sy.contract_address, user1());
    let claimed1 = sy.claim_rewards(user1());
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user2());
    let claimed2 = sy.claim_rewards(user2());
    stop_cheat_caller_address(sy.contract_address);

    // User1 gets all rewards, user2 gets none
    assert(*claimed1.at(0) == 100 * WAD, 'user1 wrong rewards');
    assert(*claimed2.at(0) == 0, 'user2 should get nothing');
}

#[test]
fn test_rewards_accrue_after_redeem() {
    let (_, yield_token, sy, reward_token) = setup_single_reward();

    // Two users deposit
    mint_and_deposit_sy(yield_token, sy, user1(), 500 * WAD);
    mint_and_deposit_sy(yield_token, sy, user2(), 500 * WAD);

    // Send first batch
    send_rewards(reward_token, sy, 100 * WAD);

    // User1 redeems all - should update their rewards first
    start_cheat_caller_address(sy.contract_address, user1());
    sy.redeem(user1(), 500 * WAD, yield_token.contract_address, 0, false);
    stop_cheat_caller_address(sy.contract_address);

    // Send second batch
    send_rewards(reward_token, sy, 100 * WAD);

    // Claim for both
    start_cheat_caller_address(sy.contract_address, user1());
    let claimed1 = sy.claim_rewards(user1());
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user2());
    let claimed2 = sy.claim_rewards(user2());
    stop_cheat_caller_address(sy.contract_address);

    // User1: 50 (half of first batch, balance was 500/1000)
    // User2: 50 (half of first batch) + 100 (all of second batch, only holder) = 150
    assert(*claimed1.at(0) == 50 * WAD, 'user1 wrong rewards');
    assert(*claimed2.at(0) == 150 * WAD, 'user2 wrong rewards');
}

#[test]
fn test_multi_reward_tokens() {
    let (_, yield_token, sy, reward1, reward2) = setup_multi_reward();

    // User deposits
    mint_and_deposit_sy(yield_token, sy, user1(), 1000 * WAD);

    // Send different amounts of each reward token
    send_rewards(reward1, sy, 100 * WAD);
    send_rewards(reward2, sy, 200 * WAD);

    // Claim
    start_cheat_caller_address(sy.contract_address, user1());
    let claimed = sy.claim_rewards(user1());
    stop_cheat_caller_address(sy.contract_address);

    assert(claimed.len() == 2, 'wrong claimed length');
    assert(*claimed.at(0) == 100 * WAD, 'wrong reward1');
    assert(*claimed.at(1) == 200 * WAD, 'wrong reward2');
}

#[test]
fn test_claim_twice_returns_zero() {
    let (_, yield_token, sy, reward_token) = setup_single_reward();

    mint_and_deposit_sy(yield_token, sy, user1(), 1000 * WAD);
    send_rewards(reward_token, sy, 100 * WAD);

    // First claim
    start_cheat_caller_address(sy.contract_address, user1());
    let claimed1 = sy.claim_rewards(user1());
    stop_cheat_caller_address(sy.contract_address);

    assert(*claimed1.at(0) == 100 * WAD, 'first claim wrong');

    // Second claim without new rewards
    start_cheat_caller_address(sy.contract_address, user1());
    let claimed2 = sy.claim_rewards(user1());
    stop_cheat_caller_address(sy.contract_address);

    assert(*claimed2.at(0) == 0, 'second claim should be zero');
}

#[test]
fn test_accrued_rewards_view() {
    let (_, yield_token, sy, reward_token) = setup_single_reward();

    mint_and_deposit_sy(yield_token, sy, user1(), 1000 * WAD);
    send_rewards(reward_token, sy, 100 * WAD);

    // Update user's rewards without claiming
    start_cheat_caller_address(sy.contract_address, user1());
    // Just do a zero transfer to trigger update
    sy.transfer(user1(), 0);
    stop_cheat_caller_address(sy.contract_address);

    // Check accrued (view function)
    let accrued = sy.accrued_rewards(user1());
    assert(*accrued.at(0) == 100 * WAD, 'wrong accrued');
}

#[test]
fn test_reward_index_increases() {
    let (_, yield_token, sy, reward_token) = setup_single_reward();

    let initial_index = sy.reward_index(reward_token.contract_address);
    assert(initial_index == WAD, 'initial index not WAD');

    mint_and_deposit_sy(yield_token, sy, user1(), 1000 * WAD);
    send_rewards(reward_token, sy, 100 * WAD);

    // Trigger index update
    start_cheat_caller_address(sy.contract_address, user1());
    sy.claim_rewards(user1());
    stop_cheat_caller_address(sy.contract_address);

    let new_index = sy.reward_index(reward_token.contract_address);
    // new_index = WAD + (100 * WAD * WAD) / (1000 * WAD) = WAD + 0.1 * WAD = 1.1 * WAD
    assert(new_index > initial_index, 'index did not increase');
    assert(new_index == WAD + (100 * WAD * WAD) / (1000 * WAD), 'wrong new index');
}

#[test]
fn test_user_reward_index_tracks_global() {
    let (_, yield_token, sy, reward_token) = setup_single_reward();

    mint_and_deposit_sy(yield_token, sy, user1(), 1000 * WAD);

    // User's index should be set to global after deposit
    let user_index = sy.user_reward_index(user1(), reward_token.contract_address);
    let global_index = sy.reward_index(reward_token.contract_address);
    assert(user_index == global_index, 'user index not synced');
}

// ============ Edge Cases ============

#[test]
fn test_rewards_during_zero_supply_go_to_first_depositor() {
    let (_, yield_token, sy, reward_token) = setup_single_reward();

    // User1 deposits and redeems all - supply goes to 0
    mint_and_deposit_sy(yield_token, sy, user1(), 1000 * WAD);
    start_cheat_caller_address(sy.contract_address, user1());
    sy.redeem(user1(), 1000 * WAD, yield_token.contract_address, 0, false);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy.total_supply() == 0, 'supply should be zero');

    // Send rewards while no holders exist
    // These rewards accumulate until next deposit
    send_rewards(reward_token, sy, 100 * WAD);

    // User2 deposits - becomes first holder after zero-supply period
    mint_and_deposit_sy(yield_token, sy, user2(), 1000 * WAD);

    // Claim for user2
    start_cheat_caller_address(sy.contract_address, user2());
    let claimed = sy.claim_rewards(user2());
    stop_cheat_caller_address(sy.contract_address);

    // User2 gets all rewards that accumulated during zero-supply period
    // This is intentional: rewards are not "lost" but go to whoever deposits first
    // after the zero-supply period. The global index updates after user2's balance exists.
    assert(*claimed.at(0) == 100 * WAD, 'user2 gets accumulated rewards');
}

#[test]
fn test_exchange_rate_unchanged() {
    let (_, yield_token, sy, _) = setup_single_reward();

    // Exchange rate should work normally
    let rate = sy.exchange_rate();
    assert(rate == WAD, 'initial rate not WAD');

    // Set yield
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.set_index(2 * WAD); // 100% yield
    stop_cheat_caller_address(yield_token.contract_address);

    let new_rate = sy.exchange_rate();
    assert(new_rate == 2 * WAD, 'rate not updated');
}

#[test]
fn test_underlying_asset() {
    let (_, yield_token, sy, _) = setup_single_reward();

    assert(sy.underlying_asset() == yield_token.contract_address, 'wrong underlying');
}

#[test]
fn test_tokens_in_out() {
    let (_, yield_token, sy, _) = setup_single_reward();

    let tokens_in = sy.get_tokens_in();
    let tokens_out = sy.get_tokens_out();

    assert(tokens_in.len() == 1, 'wrong tokens_in len');
    assert(*tokens_in.at(0) == yield_token.contract_address, 'wrong token_in');

    assert(tokens_out.len() == 1, 'wrong tokens_out len');
    assert(*tokens_out.at(0) == yield_token.contract_address, 'wrong token_out');
}

#[test]
fn test_asset_info() {
    let (_, yield_token, sy, _) = setup_single_reward();

    let (asset_type, underlying, decimals) = sy.asset_info();

    assert(asset_type == AssetType::Token, 'wrong asset type');
    assert(underlying == yield_token.contract_address, 'wrong underlying');
    assert(decimals == 18, 'wrong decimals');
}

#[test]
fn test_preview_functions() {
    let (_, _, sy, _) = setup_single_reward();

    // 1:1 for SY
    assert(sy.preview_deposit(100 * WAD) == 100 * WAD, 'wrong preview deposit');
    assert(sy.preview_redeem(100 * WAD) == 100 * WAD, 'wrong preview redeem');
}

// ============ Complex Scenarios ============

#[test]
fn test_multiple_deposits_same_user() {
    let (_, yield_token, sy, reward_token) = setup_single_reward();

    // First deposit
    mint_and_deposit_sy(yield_token, sy, user1(), 500 * WAD);

    // Send rewards
    send_rewards(reward_token, sy, 50 * WAD);

    // Second deposit (should update rewards first)
    mint_and_deposit_sy(yield_token, sy, user1(), 500 * WAD);

    // Send more rewards
    send_rewards(reward_token, sy, 100 * WAD);

    // Claim
    start_cheat_caller_address(sy.contract_address, user1());
    let claimed = sy.claim_rewards(user1());
    stop_cheat_caller_address(sy.contract_address);

    // 50 (first batch, only holder) + 100 (second batch, only holder) = 150
    assert(*claimed.at(0) == 150 * WAD, 'wrong claimed');
}

#[test]
fn test_transfer_to_new_user() {
    let (_, yield_token, sy, reward_token) = setup_single_reward();

    // User1 deposits
    mint_and_deposit_sy(yield_token, sy, user1(), 1000 * WAD);

    // Send rewards
    send_rewards(reward_token, sy, 100 * WAD);

    // Transfer to alice (new user, never interacted before)
    start_cheat_caller_address(sy.contract_address, user1());
    sy.transfer(alice(), 500 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    // User1 should have accrued all rewards from before transfer
    start_cheat_caller_address(sy.contract_address, user1());
    let claimed1 = sy.claim_rewards(user1());
    stop_cheat_caller_address(sy.contract_address);

    assert(*claimed1.at(0) == 100 * WAD, 'user1 wrong rewards');

    // Alice should have nothing yet
    start_cheat_caller_address(sy.contract_address, alice());
    let claimed_alice = sy.claim_rewards(alice());
    stop_cheat_caller_address(sy.contract_address);

    assert(*claimed_alice.at(0) == 0, 'alice should have nothing');
}

#[test]
fn test_transfer_from() {
    let (_, yield_token, sy, reward_token) = setup_single_reward();

    // User1 deposits
    mint_and_deposit_sy(yield_token, sy, user1(), 1000 * WAD);

    // Send rewards
    send_rewards(reward_token, sy, 100 * WAD);

    // User1 approves alice to transfer
    start_cheat_caller_address(sy.contract_address, user1());
    sy.approve(alice(), 500 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    // Alice transfers from user1 to bob
    start_cheat_caller_address(sy.contract_address, alice());
    sy.transfer_from(user1(), bob(), 500 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    // User1's rewards should be locked in (updated before transfer)
    start_cheat_caller_address(sy.contract_address, user1());
    let claimed1 = sy.claim_rewards(user1());
    stop_cheat_caller_address(sy.contract_address);

    assert(*claimed1.at(0) == 100 * WAD, 'user1 wrong rewards');
}

// ============ Pausable Transfer Tests (Gap 4.1) ============

/// Helper to get admin dispatcher for pause/unpause operations
fn get_admin_dispatcher(sy: ISYWithRewardsDispatcher) -> ISYWithRewardsAdminDispatcher {
    ISYWithRewardsAdminDispatcher { contract_address: sy.contract_address }
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn test_sy_with_rewards_transfer_blocked_when_paused() {
    let (_, yield_token, sy, _) = setup_single_reward();
    let user = user1();
    let recipient = user2();
    let amount = 100 * WAD;

    // Mint yield token and deposit to get SY
    mint_and_deposit_sy(yield_token, sy, user, amount);

    // Verify user has SY
    assert(sy.balance_of(user) == amount, 'User should have SY');

    // Pause the contract (admin has PAUSER_ROLE)
    let admin_dispatcher = get_admin_dispatcher(sy);
    start_cheat_caller_address(sy.contract_address, admin());
    admin_dispatcher.pause();
    stop_cheat_caller_address(sy.contract_address);

    // Try to transfer - should fail because paused
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(recipient, amount);
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn test_sy_with_rewards_transfer_from_blocked_when_paused() {
    let (_, yield_token, sy, _) = setup_single_reward();
    let owner = user1();
    let spender = user2();
    let amount = 100 * WAD;

    // Mint yield token and deposit to get SY
    mint_and_deposit_sy(yield_token, sy, owner, amount);

    // Approve spender
    start_cheat_caller_address(sy.contract_address, owner);
    sy.approve(spender, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Pause the contract
    let admin_dispatcher = get_admin_dispatcher(sy);
    start_cheat_caller_address(sy.contract_address, admin());
    admin_dispatcher.pause();
    stop_cheat_caller_address(sy.contract_address);

    // Try to transfer_from - should fail because paused
    start_cheat_caller_address(sy.contract_address, spender);
    sy.transfer_from(owner, spender, amount);
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn test_sy_with_rewards_deposit_blocked_when_paused() {
    let (_, yield_token, sy, _) = setup_single_reward();
    let user = user1();
    let amount = 100 * WAD;

    // Mint yield token to user
    mint_yield_token_to_user(yield_token, user, amount);

    // Approve SY contract
    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    // Pause the contract
    let admin_dispatcher = get_admin_dispatcher(sy);
    start_cheat_caller_address(sy.contract_address, admin());
    admin_dispatcher.pause();
    stop_cheat_caller_address(sy.contract_address);

    // Try to deposit - should fail because paused
    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, yield_token.contract_address, amount, 0);
}

#[test]
fn test_sy_with_rewards_transfer_works_after_unpause() {
    let (_, yield_token, sy, _) = setup_single_reward();
    let user = user1();
    let recipient = user2();
    let amount = 100 * WAD;

    // Mint yield token and deposit to get SY
    mint_and_deposit_sy(yield_token, sy, user, amount);

    // Pause the contract
    let admin_dispatcher = get_admin_dispatcher(sy);
    start_cheat_caller_address(sy.contract_address, admin());
    admin_dispatcher.pause();
    stop_cheat_caller_address(sy.contract_address);

    // Unpause the contract
    start_cheat_caller_address(sy.contract_address, admin());
    admin_dispatcher.unpause();
    stop_cheat_caller_address(sy.contract_address);

    // Now transfer should work
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(recipient, amount);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy.balance_of(user) == 0, 'User should have 0');
    assert(sy.balance_of(recipient) == amount, 'Recipient should have SY');
}

#[test]
fn test_sy_with_rewards_redeem_works_when_paused() {
    // Redemptions are ALWAYS allowed, even when paused.
    // This ensures users can always exit their positions during emergencies.
    let (_, yield_token, sy, _) = setup_single_reward();
    let user = user1();
    let amount = 100 * WAD;

    // Mint yield token and deposit to get SY
    mint_and_deposit_sy(yield_token, sy, user, amount);

    // Verify user has SY
    assert(sy.balance_of(user) == amount, 'User should have SY');

    // Pause the contract
    let admin_dispatcher = get_admin_dispatcher(sy);
    start_cheat_caller_address(sy.contract_address, admin());
    admin_dispatcher.pause();
    stop_cheat_caller_address(sy.contract_address);

    // Redeem should work even when paused - users must be able to exit
    start_cheat_caller_address(sy.contract_address, user);
    let shares_received = sy.redeem(user, amount, yield_token.contract_address, 0, false);
    stop_cheat_caller_address(sy.contract_address);

    assert(shares_received == amount, 'Redeem should work when paused');
    assert(sy.balance_of(user) == 0, 'SY should be burned');
    assert(yield_token.balance_of(user) == amount, 'User should have yield token');
}
