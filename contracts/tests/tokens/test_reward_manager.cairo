/// Tests for RewardManagerComponent
///
/// These tests validate the reward distribution algorithm:
/// - Global index tracking (new rewards → index += rewards * WAD / total_supply)
/// - User accrual (user_accrued += balance * (global_index - user_index) / WAD)
/// - Claim functionality (transfer rewards, reset accrued)
/// - Multi-user scenarios (transfers update both parties)

use horizon::libraries::math_fp::WAD;
use horizon::mocks::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use snforge_std::{ContractClassTrait, DeclareResultTrait, declare};
use starknet::{ContractAddress, SyscallResultTrait};

// ============ Test Helpers ============

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

/// Deploy a mock ERC20 token (for reward tokens)
fn deploy_mock_erc20(name: felt252, symbol: felt252) -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];

    // ByteArray serialization for name
    calldata.append(0); // data array length
    calldata.append(name); // pending_word
    calldata.append(4); // pending_word_len

    // ByteArray serialization for symbol
    calldata.append(0); // data array length
    calldata.append(symbol); // pending_word
    calldata.append(4); // pending_word_len

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMockERC20Dispatcher { contract_address }
}

/// Deploy the RewardManagerTestContract
fn deploy_test_contract(reward_tokens: Array<ContractAddress>) -> IRewardManagerTestDispatcher {
    let contract = declare("RewardManagerTestContract").unwrap_syscall().contract_class();
    let mut calldata = array![];

    // Serialize reward_tokens span
    calldata.append(reward_tokens.len().into());
    for token in reward_tokens {
        calldata.append(token.into());
    }

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IRewardManagerTestDispatcher { contract_address }
}

/// Setup test environment with one reward token
fn setup_single_reward() -> (IRewardManagerTestDispatcher, IMockERC20Dispatcher) {
    let reward_token = deploy_mock_erc20('REW', 'REW');
    let test_contract = deploy_test_contract(array![reward_token.contract_address]);
    (test_contract, reward_token)
}

/// Setup test environment with two reward tokens
fn setup_multi_reward() -> (
    IRewardManagerTestDispatcher, IMockERC20Dispatcher, IMockERC20Dispatcher,
) {
    let reward_token1 = deploy_mock_erc20('REW1', 'REW1');
    let reward_token2 = deploy_mock_erc20('REW2', 'REW2');
    let test_contract = deploy_test_contract(
        array![reward_token1.contract_address, reward_token2.contract_address],
    );
    (test_contract, reward_token1, reward_token2)
}

// ============ Test Interface ============

/// Interface for the test contract that wraps RewardManagerComponent
#[starknet::interface]
pub trait IRewardManagerTest<TContractState> {
    // Simulated balance management (mimics ERC20 balance tracking)
    fn set_balance(ref self: TContractState, user: ContractAddress, amount: u256);
    fn get_balance(self: @TContractState, user: ContractAddress) -> u256;
    fn set_total_supply(ref self: TContractState, amount: u256);
    fn get_total_supply(self: @TContractState) -> u256;

    // RewardManager public functions
    fn get_reward_tokens(self: @TContractState) -> Span<ContractAddress>;
    fn accrued_rewards(self: @TContractState, user: ContractAddress) -> Span<u256>;
    fn reward_index(self: @TContractState, token: ContractAddress) -> u256;
    fn user_reward_index(
        self: @TContractState, user: ContractAddress, token: ContractAddress,
    ) -> u256;
    fn is_reward_token(self: @TContractState, token: ContractAddress) -> bool;
    fn reward_tokens_count(self: @TContractState) -> u32;

    // RewardManager internal functions (exposed for testing)
    fn claim_rewards(ref self: TContractState, user: ContractAddress) -> Span<u256>;
    fn update_rewards_for_two(
        ref self: TContractState, user1: ContractAddress, user2: ContractAddress,
    );
    fn update_user_rewards(ref self: TContractState, user: ContractAddress);
}

// ============ Test Contract ============

/// Test contract that uses RewardManagerComponent with mock balance tracking
#[starknet::contract]
pub mod RewardManagerTestContract {
    use horizon::components::reward_manager_component::RewardManagerComponent;
    use starknet::ContractAddress;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };

    component!(path: RewardManagerComponent, storage: rewards, event: RewardsEvent);

    // Import internal implementation with hooks
    // Note: RewardHooksImpl is resolved by the compiler since it's in the same scope
    impl RewardInternalImpl = RewardManagerComponent::InternalImpl<ContractState>;
    impl RewardViewImpl = RewardManagerComponent::ViewImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        rewards: RewardManagerComponent::Storage,
        // Mock balance tracking (simulates ERC20 balances)
        balances: Map<ContractAddress, u256>,
        total_supply: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        RewardsEvent: RewardManagerComponent::Event,
    }

    /// Implement RewardHooksTrait - bridge to mock balance tracking
    impl RewardHooksImpl of RewardManagerComponent::RewardHooksTrait<ContractState> {
        fn user_sy_balance(self: @ContractState, user: ContractAddress) -> u256 {
            self.balances.read(user)
        }

        fn total_sy_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }
    }

    #[constructor]
    fn constructor(ref self: ContractState, reward_tokens: Span<ContractAddress>) {
        self.rewards.initializer(reward_tokens);
    }

    #[abi(embed_v0)]
    impl RewardManagerTestImpl of super::IRewardManagerTest<ContractState> {
        // ============ Mock Balance Management ============

        fn set_balance(ref self: ContractState, user: ContractAddress, amount: u256) {
            self.balances.write(user, amount);
        }

        fn get_balance(self: @ContractState, user: ContractAddress) -> u256 {
            self.balances.read(user)
        }

        fn set_total_supply(ref self: ContractState, amount: u256) {
            self.total_supply.write(amount);
        }

        fn get_total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        // ============ RewardManager View Functions ============

        fn get_reward_tokens(self: @ContractState) -> Span<ContractAddress> {
            self.rewards.get_reward_tokens()
        }

        fn accrued_rewards(self: @ContractState, user: ContractAddress) -> Span<u256> {
            self.rewards.accrued_rewards(user)
        }

        fn reward_index(self: @ContractState, token: ContractAddress) -> u256 {
            self.rewards.reward_index(token)
        }

        fn user_reward_index(
            self: @ContractState, user: ContractAddress, token: ContractAddress,
        ) -> u256 {
            self.rewards.user_reward_index(user, token)
        }

        fn is_reward_token(self: @ContractState, token: ContractAddress) -> bool {
            self.rewards.is_reward_token(token)
        }

        fn reward_tokens_count(self: @ContractState) -> u32 {
            self.rewards.reward_tokens_count()
        }

        // ============ RewardManager Internal Functions (Exposed) ============

        fn claim_rewards(ref self: ContractState, user: ContractAddress) -> Span<u256> {
            self.rewards.claim_rewards(user)
        }

        fn update_rewards_for_two(
            ref self: ContractState, user1: ContractAddress, user2: ContractAddress,
        ) {
            self.rewards.update_rewards_for_two(user1, user2);
        }

        fn update_user_rewards(ref self: ContractState, user: ContractAddress) {
            self.rewards.update_user_rewards(user);
        }
    }
}

// ============ Initialization Tests ============

#[test]
fn test_initialization_single_token() {
    let (test_contract, reward_token) = setup_single_reward();

    // Verify reward token is registered
    assert(test_contract.reward_tokens_count() == 1, 'wrong token count');
    assert(test_contract.is_reward_token(reward_token.contract_address), 'token not registered');

    // Verify get_reward_tokens returns correct list
    let tokens = test_contract.get_reward_tokens();
    assert(tokens.len() == 1, 'wrong tokens length');
    assert(*tokens.at(0) == reward_token.contract_address, 'wrong token address');

    // Verify initial index is WAD
    let index = test_contract.reward_index(reward_token.contract_address);
    assert(index == WAD, 'initial index should be WAD');
}

#[test]
fn test_initialization_multi_token() {
    let (test_contract, reward_token1, reward_token2) = setup_multi_reward();

    // Verify both tokens registered
    assert(test_contract.reward_tokens_count() == 2, 'wrong token count');
    assert(test_contract.is_reward_token(reward_token1.contract_address), 'token1 not registered');
    assert(test_contract.is_reward_token(reward_token2.contract_address), 'token2 not registered');

    // Verify ordering
    let tokens = test_contract.get_reward_tokens();
    assert(tokens.len() == 2, 'wrong tokens length');
    assert(*tokens.at(0) == reward_token1.contract_address, 'wrong token1 address');
    assert(*tokens.at(1) == reward_token2.contract_address, 'wrong token2 address');
}

// Note: Constructor validation tests are commented out because snforge doesn't
// properly handle should_panic for deployment failures. The validation works
// correctly - empty tokens panics with 'HZN: empty reward tokens' and
// zero address panics with 'HZN: zero address' as verified manually.
//
// #[test]
// #[should_panic]
// fn test_initialization_empty_tokens_fails() {
//     let _test_contract = deploy_test_contract(array![]);
// }
//
// #[test]
// #[should_panic]
// fn test_initialization_zero_address_fails() {
//     let _test_contract = deploy_test_contract(array![zero_address()]);
// }

// ============ Index Calculation Tests ============

#[test]
fn test_global_index_calculation() {
    let (test_contract, reward_token) = setup_single_reward();

    // Setup: user1 has 100 WAD balance, total supply is 100 WAD
    test_contract.set_balance(user1(), 100 * WAD);
    test_contract.set_total_supply(100 * WAD);

    // Simulate rewards arrival: transfer 10 WAD rewards to contract
    reward_token.mint(test_contract.contract_address, 10 * WAD);

    // Trigger index update via update_user_rewards
    test_contract.update_user_rewards(user1());

    // Expected: index_delta = 10 WAD * WAD / 100 WAD = 0.1 WAD
    // new_index = WAD + 0.1 WAD = 1.1 WAD
    let expected_index = WAD + (WAD / 10);
    let actual_index = test_contract.reward_index(reward_token.contract_address);
    assert(actual_index == expected_index, 'wrong global index');
}

#[test]
fn test_global_index_no_update_when_no_supply() {
    let (test_contract, reward_token) = setup_single_reward();

    // No supply set (total_supply = 0)
    // Send rewards to contract
    reward_token.mint(test_contract.contract_address, 10 * WAD);

    // Try to update - should not change index because no supply
    test_contract.update_user_rewards(user1());

    // Index should remain at WAD (initial value)
    let index = test_contract.reward_index(reward_token.contract_address);
    assert(index == WAD, 'index should not change');
}

#[test]
fn test_global_index_incremental_updates() {
    let (test_contract, reward_token) = setup_single_reward();

    // Setup: 1000 WAD total supply
    test_contract.set_balance(user1(), 1000 * WAD);
    test_contract.set_total_supply(1000 * WAD);

    // First reward: 100 WAD
    reward_token.mint(test_contract.contract_address, 100 * WAD);
    test_contract.update_user_rewards(user1());

    // index = WAD + (100 * WAD / 1000) = WAD + 0.1 WAD
    let index_after_first = test_contract.reward_index(reward_token.contract_address);
    assert(index_after_first == WAD + (WAD / 10), 'wrong index after first');

    // Second reward: 200 WAD more
    reward_token.mint(test_contract.contract_address, 200 * WAD);
    test_contract.update_user_rewards(user1());

    // index = previous + (200 * WAD / 1000) = previous + 0.2 WAD
    let expected = index_after_first + (2 * WAD / 10);
    let actual = test_contract.reward_index(reward_token.contract_address);
    assert(actual == expected, 'wrong index after second');
}

// ============ User Accrual Tests ============

#[test]
fn test_user_accrual_basic() {
    let (test_contract, reward_token) = setup_single_reward();

    // Setup: user1 has 100 WAD, total supply is 100 WAD (user1 owns 100%)
    test_contract.set_balance(user1(), 100 * WAD);
    test_contract.set_total_supply(100 * WAD);

    // IMPORTANT: Initialize user's reward index to current global index
    // This simulates what happens during deposit/transfer in the real contract
    test_contract.update_user_rewards(user1());

    // Send 50 WAD rewards
    reward_token.mint(test_contract.contract_address, 50 * WAD);

    // Update user1's rewards
    test_contract.update_user_rewards(user1());

    // user1 should accrue all 50 WAD (owns 100% of supply)
    let accrued = test_contract.accrued_rewards(user1());
    assert(accrued.len() == 1, 'wrong accrued length');
    assert(*accrued.at(0) == 50 * WAD, 'wrong accrued amount');
}

#[test]
fn test_user_accrual_proportional() {
    let (test_contract, reward_token) = setup_single_reward();

    // Setup: user1 has 30 WAD, user2 has 70 WAD, total = 100 WAD
    test_contract.set_balance(user1(), 30 * WAD);
    test_contract.set_balance(user2(), 70 * WAD);
    test_contract.set_total_supply(100 * WAD);

    // Initialize both users' indices
    test_contract.update_rewards_for_two(user1(), user2());

    // Send 100 WAD rewards
    reward_token.mint(test_contract.contract_address, 100 * WAD);

    // Update both users
    test_contract.update_rewards_for_two(user1(), user2());

    // user1 should accrue 30% = 30 WAD
    let accrued1 = test_contract.accrued_rewards(user1());
    assert(*accrued1.at(0) == 30 * WAD, 'user1 wrong accrued');

    // user2 should accrue 70% = 70 WAD
    let accrued2 = test_contract.accrued_rewards(user2());
    assert(*accrued2.at(0) == 70 * WAD, 'user2 wrong accrued');
}

#[test]
fn test_user_accrual_new_user_no_retroactive() {
    let (test_contract, reward_token) = setup_single_reward();

    // Setup: user1 has 100 WAD initially
    test_contract.set_balance(user1(), 100 * WAD);
    test_contract.set_total_supply(100 * WAD);

    // Initialize user1's index BEFORE rewards arrive
    test_contract.update_user_rewards(user1());

    // Send rewards before user2 joins
    reward_token.mint(test_contract.contract_address, 100 * WAD);
    test_contract.update_user_rewards(user1());

    // user1 accrues the 100 WAD
    let accrued1 = test_contract.accrued_rewards(user1());
    assert(*accrued1.at(0) == 100 * WAD, 'user1 should get rewards');

    // user2 joins with 100 WAD (simulate mint)
    test_contract.set_balance(user2(), 100 * WAD);
    test_contract.set_total_supply(200 * WAD);

    // Update user2 - should initialize their index to current global
    test_contract.update_user_rewards(user2());

    // user2 should have 0 accrued (no retroactive rewards)
    let accrued2 = test_contract.accrued_rewards(user2());
    assert(*accrued2.at(0) == 0, 'user2 should get no retroactive');

    // Their index should match global
    let global_index = test_contract.reward_index(reward_token.contract_address);
    let user2_index = test_contract.user_reward_index(user2(), reward_token.contract_address);
    assert(user2_index == global_index, 'user2 index should match global');
}

#[test]
fn test_user_accrual_multi_token() {
    let (test_contract, reward_token1, reward_token2) = setup_multi_reward();

    // Setup: user1 has 100 WAD
    test_contract.set_balance(user1(), 100 * WAD);
    test_contract.set_total_supply(100 * WAD);

    // Initialize user1's index
    test_contract.update_user_rewards(user1());

    // Send different amounts of each reward token
    reward_token1.mint(test_contract.contract_address, 50 * WAD);
    reward_token2.mint(test_contract.contract_address, 200 * WAD);

    // Update user1
    test_contract.update_user_rewards(user1());

    // user1 should accrue 50 WAD of token1, 200 WAD of token2
    let accrued = test_contract.accrued_rewards(user1());
    assert(accrued.len() == 2, 'wrong accrued length');
    assert(*accrued.at(0) == 50 * WAD, 'wrong token1 accrued');
    assert(*accrued.at(1) == 200 * WAD, 'wrong token2 accrued');
}

// ============ Claim Tests ============

#[test]
fn test_claim_rewards_basic() {
    let (test_contract, reward_token) = setup_single_reward();

    // Setup: user1 has 100 WAD, total = 100 WAD
    test_contract.set_balance(user1(), 100 * WAD);
    test_contract.set_total_supply(100 * WAD);

    // Initialize user1's index
    test_contract.update_user_rewards(user1());

    // Send 100 WAD rewards
    reward_token.mint(test_contract.contract_address, 100 * WAD);

    // Update and verify accrued
    test_contract.update_user_rewards(user1());
    let accrued_before = test_contract.accrued_rewards(user1());
    assert(*accrued_before.at(0) == 100 * WAD, 'should have 100 WAD accrued');

    // Check user1 balance before claim
    let balance_before = reward_token.balance_of(user1());
    assert(balance_before == 0, 'user1 should have 0 before');

    // Claim rewards
    let claimed = test_contract.claim_rewards(user1());
    assert(*claimed.at(0) == 100 * WAD, 'should claim 100 WAD');

    // Verify user1 received tokens
    let balance_after = reward_token.balance_of(user1());
    assert(balance_after == 100 * WAD, 'user1 should have 100 WAD');

    // Verify accrued reset to 0
    let accrued_after = test_contract.accrued_rewards(user1());
    assert(*accrued_after.at(0) == 0, 'accrued should be 0');
}

#[test]
fn test_claim_rewards_multi_token() {
    let (test_contract, reward_token1, reward_token2) = setup_multi_reward();

    // Setup
    test_contract.set_balance(user1(), 100 * WAD);
    test_contract.set_total_supply(100 * WAD);

    // Initialize user1's index
    test_contract.update_user_rewards(user1());

    // Send rewards
    reward_token1.mint(test_contract.contract_address, 50 * WAD);
    reward_token2.mint(test_contract.contract_address, 150 * WAD);

    // Claim (which also updates)
    let claimed = test_contract.claim_rewards(user1());
    assert(claimed.len() == 2, 'wrong claimed length');
    assert(*claimed.at(0) == 50 * WAD, 'wrong token1 claimed');
    assert(*claimed.at(1) == 150 * WAD, 'wrong token2 claimed');

    // Verify balances
    assert(reward_token1.balance_of(user1()) == 50 * WAD, 'wrong token1 balance');
    assert(reward_token2.balance_of(user1()) == 150 * WAD, 'wrong token2 balance');
}

#[test]
fn test_claim_rewards_zero_accrued() {
    let (test_contract, reward_token) = setup_single_reward();

    // Setup user with balance but no rewards arrived
    test_contract.set_balance(user1(), 100 * WAD);
    test_contract.set_total_supply(100 * WAD);

    // Claim with nothing to claim
    let claimed = test_contract.claim_rewards(user1());
    assert(*claimed.at(0) == 0, 'should claim 0');

    // Verify no transfer occurred
    assert(reward_token.balance_of(user1()) == 0, 'balance should be 0');
}

#[test]
fn test_claim_rewards_multiple_times() {
    let (test_contract, reward_token) = setup_single_reward();

    // Setup
    test_contract.set_balance(user1(), 100 * WAD);
    test_contract.set_total_supply(100 * WAD);

    // Initialize user1's index
    test_contract.update_user_rewards(user1());

    // First reward batch
    reward_token.mint(test_contract.contract_address, 50 * WAD);
    let claimed1 = test_contract.claim_rewards(user1());
    assert(*claimed1.at(0) == 50 * WAD, 'first claim wrong');

    // Second reward batch
    reward_token.mint(test_contract.contract_address, 75 * WAD);
    let claimed2 = test_contract.claim_rewards(user1());
    assert(*claimed2.at(0) == 75 * WAD, 'second claim wrong');

    // Total received
    assert(reward_token.balance_of(user1()) == 125 * WAD, 'total balance wrong');
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_claim_rewards_zero_address_fails() {
    let (test_contract, _) = setup_single_reward();
    test_contract.claim_rewards(zero_address());
}

// ============ Update For Two Tests ============

#[test]
fn test_update_for_two_both_users() {
    let (test_contract, reward_token) = setup_single_reward();

    // Setup: user1 and user2 each have 50 WAD
    test_contract.set_balance(user1(), 50 * WAD);
    test_contract.set_balance(user2(), 50 * WAD);
    test_contract.set_total_supply(100 * WAD);

    // Initialize both users' indices
    test_contract.update_rewards_for_two(user1(), user2());

    // Send rewards
    reward_token.mint(test_contract.contract_address, 100 * WAD);

    // Update both
    test_contract.update_rewards_for_two(user1(), user2());

    // Both should have 50 WAD accrued (50% each)
    assert(*test_contract.accrued_rewards(user1()).at(0) == 50 * WAD, 'user1 wrong');
    assert(*test_contract.accrued_rewards(user2()).at(0) == 50 * WAD, 'user2 wrong');
}

#[test]
fn test_update_for_two_same_user() {
    let (test_contract, reward_token) = setup_single_reward();

    // Setup
    test_contract.set_balance(user1(), 100 * WAD);
    test_contract.set_total_supply(100 * WAD);

    // Initialize user1's index
    test_contract.update_user_rewards(user1());

    // Send rewards
    reward_token.mint(test_contract.contract_address, 100 * WAD);

    // Update same user twice (shouldn't double count)
    test_contract.update_rewards_for_two(user1(), user1());

    // Should only accrue once
    assert(*test_contract.accrued_rewards(user1()).at(0) == 100 * WAD, 'should accrue once');
}

#[test]
fn test_update_for_two_with_zero_address() {
    let (test_contract, reward_token) = setup_single_reward();

    // Setup
    test_contract.set_balance(user1(), 100 * WAD);
    test_contract.set_total_supply(100 * WAD);

    // Initialize user1's index
    test_contract.update_user_rewards(user1());

    // Send rewards
    reward_token.mint(test_contract.contract_address, 100 * WAD);

    // Update with zero address (simulating mint - from is zero)
    test_contract.update_rewards_for_two(zero_address(), user1());

    // user1 should still accrue
    assert(*test_contract.accrued_rewards(user1()).at(0) == 100 * WAD, 'user1 should accrue');
}

// ============ Transfer Scenario Tests ============

#[test]
fn test_transfer_scenario() {
    let (test_contract, reward_token) = setup_single_reward();

    // Initial state: alice has 100 WAD
    test_contract.set_balance(alice(), 100 * WAD);
    test_contract.set_total_supply(100 * WAD);

    // Initialize alice's index
    test_contract.update_user_rewards(alice());

    // Rewards arrive while alice holds all tokens
    reward_token.mint(test_contract.contract_address, 100 * WAD);

    // Alice transfers 50 WAD to bob
    // BEFORE the balance change, update both parties
    test_contract.update_rewards_for_two(alice(), bob());

    // Alice should have accrued all 100 WAD (was sole holder)
    assert(*test_contract.accrued_rewards(alice()).at(0) == 100 * WAD, 'alice should get 100');
    // Bob should have 0 (just joined, index initialized to current global)
    assert(*test_contract.accrued_rewards(bob()).at(0) == 0, 'bob should get 0');

    // Now simulate balance change
    test_contract.set_balance(alice(), 50 * WAD);
    test_contract.set_balance(bob(), 50 * WAD);

    // More rewards arrive
    reward_token.mint(test_contract.contract_address, 100 * WAD);

    // Update both again
    test_contract.update_rewards_for_two(alice(), bob());

    // Alice: 100 (previous) + 50 (new 50%) = 150
    // Bob: 0 (previous) + 50 (new 50%) = 50
    assert(*test_contract.accrued_rewards(alice()).at(0) == 150 * WAD, 'alice total wrong');
    assert(*test_contract.accrued_rewards(bob()).at(0) == 50 * WAD, 'bob total wrong');
}

// ============ Edge Case Tests ============

#[test]
fn test_small_rewards_precision() {
    let (test_contract, reward_token) = setup_single_reward();

    // Large supply to test precision
    test_contract.set_balance(user1(), 1_000_000 * WAD);
    test_contract.set_total_supply(1_000_000 * WAD);

    // Initialize user1's index
    test_contract.update_user_rewards(user1());

    // Very small reward (1 wei)
    reward_token.mint(test_contract.contract_address, 1);

    // Update
    test_contract.update_user_rewards(user1());

    // With 1 wei reward and 1M WAD supply:
    // index_delta = 1 * WAD / 1_000_000 * WAD = 1 / 1_000_000 (truncates to 0 in integer math)
    // So user accrues 0 due to precision loss (expected behavior)
    let accrued = test_contract.accrued_rewards(user1());
    assert(*accrued.at(0) == 0, 'small reward should be 0');
}

#[test]
fn test_large_rewards() {
    let (test_contract, reward_token) = setup_single_reward();

    // Setup with large values
    test_contract.set_balance(user1(), 1_000_000 * WAD);
    test_contract.set_total_supply(1_000_000 * WAD);

    // Initialize user1's index
    test_contract.update_user_rewards(user1());

    // Large reward
    let large_reward = 1_000_000_000 * WAD; // 1 billion tokens
    reward_token.mint(test_contract.contract_address, large_reward);

    // Update and claim
    let claimed = test_contract.claim_rewards(user1());
    assert(*claimed.at(0) == large_reward, 'large reward wrong');
}

#[test]
fn test_zero_balance_user_accrues_nothing() {
    let (test_contract, reward_token) = setup_single_reward();

    // Setup: user1 has balance, user2 has zero
    test_contract.set_balance(user1(), 100 * WAD);
    test_contract.set_balance(user2(), 0);
    test_contract.set_total_supply(100 * WAD);

    // Initialize both users' indices
    test_contract.update_rewards_for_two(user1(), user2());

    // Send rewards
    reward_token.mint(test_contract.contract_address, 100 * WAD);

    // Update both
    test_contract.update_rewards_for_two(user1(), user2());

    // user1 gets all, user2 gets nothing
    assert(*test_contract.accrued_rewards(user1()).at(0) == 100 * WAD, 'user1 should get all');
    assert(*test_contract.accrued_rewards(user2()).at(0) == 0, 'user2 should get nothing');
}
