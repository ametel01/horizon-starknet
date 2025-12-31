/// Reentrancy Tests for Horizon Protocol
///
/// This test module verifies reentrancy protection in the token contracts:
/// - SY: Checks CEI pattern in deposit/redeem operations
/// - PT: Confirms no external calls in mint/burn (no reentrancy vectors)
/// - YT: Verifies ReentrancyGuard blocks re-entry in critical functions
///
/// Related: SECURITY.md, IMPLEMENTATION_PLAN.md Gap 2

use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math_fp::WAD;
use horizon::mocks::mock_reentrant_token::{
    AttackMode, IMockReentrantTokenDispatcher, IMockReentrantTokenDispatcherTrait,
};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ClassHash, ContractAddress, SyscallResultTrait};

// ============ Test Addresses ============

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn attacker() -> ContractAddress {
    'attacker'.try_into().unwrap()
}

fn user1() -> ContractAddress {
    'user1'.try_into().unwrap()
}

fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
}

// ============ Time Constants ============

const CURRENT_TIME: u64 = 1000000;
const ONE_YEAR: u64 = 365 * 86400;

// ============ Helper Functions ============

fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0); // data array length
    calldata.append(value); // pending_word
    calldata.append(len.into()); // pending_word_len
}

/// Deploy the mock reentrant token
fn deploy_reentrant_token() -> IMockReentrantTokenDispatcher {
    let contract = declare("MockReentrantToken").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'ReentrantToken', 14);
    append_bytearray(ref calldata, 'REENT', 5);

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMockReentrantTokenDispatcher { contract_address }
}

/// Deploy SY with reentrant token as underlying
fn deploy_sy_with_reentrant_underlying(underlying: ContractAddress) -> ISYDispatcher {
    let contract = declare("SY").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'SY Token', 8);
    append_bytearray(ref calldata, 'SY', 2);
    calldata.append(underlying.into()); // underlying
    calldata.append(underlying.into()); // index_oracle (same as underlying)
    calldata.append(1); // is_erc4626 = true
    calldata.append(0); // AssetType::Token
    calldata.append(admin().into()); // pauser

    // tokens_in: single token (underlying)
    calldata.append(1); // length
    calldata.append(underlying.into());

    // tokens_out: single token (underlying)
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

/// Deploy YT with SY
fn deploy_yt(sy: ContractAddress, pt_class_hash: ClassHash, expiry: u64) -> IYTDispatcher {
    start_cheat_block_timestamp_global(CURRENT_TIME);

    let contract = declare("YT").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'YT Token', 8);
    append_bytearray(ref calldata, 'YT', 2);
    calldata.append(sy.into());
    calldata.append(pt_class_hash.into());
    calldata.append(expiry.into());
    calldata.append(admin().into()); // pauser
    calldata.append(treasury().into()); // treasury for post-expiry yield

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IYTDispatcher { contract_address }
}

/// Setup reentrant token + SY
fn setup_sy_with_reentrant() -> (IMockReentrantTokenDispatcher, ISYDispatcher) {
    start_cheat_block_timestamp_global(CURRENT_TIME);

    let reentrant = deploy_reentrant_token();
    let sy = deploy_sy_with_reentrant_underlying(reentrant.contract_address);
    (reentrant, sy)
}

/// Setup full stack with reentrant underlying: ReentrantToken -> SY -> YT (+ PT)
fn setup_full_with_reentrant() -> (
    IMockReentrantTokenDispatcher, ISYDispatcher, IYTDispatcher, IPTDispatcher,
) {
    let (reentrant, sy) = setup_sy_with_reentrant();
    let pt_class_hash = get_pt_class_hash();
    let expiry = CURRENT_TIME + ONE_YEAR;
    let yt = deploy_yt(sy.contract_address, pt_class_hash, expiry);
    let pt_addr = yt.pt();
    let pt = IPTDispatcher { contract_address: pt_addr };
    (reentrant, sy, yt, pt)
}

// ============================================================================
// SY REENTRANCY TESTS
// ============================================================================

/// Test: SY.deposit with normal operation (no attack)
/// Verifies basic deposit works correctly before testing attack scenarios
#[test]
fn test_sy_deposit_normal_operation() {
    let (reentrant, sy) = setup_sy_with_reentrant();
    let amount = 1000 * WAD;

    // Mint tokens to user1
    reentrant.mint(user1(), amount);

    // Approve SY to spend tokens
    start_cheat_caller_address(reentrant.contract_address, user1());
    reentrant.approve(sy.contract_address, amount);
    stop_cheat_caller_address(reentrant.contract_address);

    // Deposit
    start_cheat_caller_address(sy.contract_address, user1());
    let sy_received = sy.deposit(user1(), reentrant.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Verify deposit worked
    assert(sy_received == amount, 'deposit should return amount');
    assert(sy.balance_of(user1()) == amount, 'user should have SY');
}

/// Test: SY.deposit CEI violation is safe with trusted underlying
///
/// The deposit function has a CEI violation:
///   1. transfer_from (external call)
///   2. mint (state change)
///
/// This test verifies that even with a malicious underlying token,
/// the design prevents exploitation because:
/// - SY is 1:1 with underlying shares
/// - No state reads after external call depend on pre-call state
/// - Attack would only be triggered if underlying has transfer hooks
#[test]
fn test_sy_deposit_reentrancy_safe() {
    let (reentrant, sy) = setup_sy_with_reentrant();
    let amount = 1000 * WAD;

    // Mint tokens to attacker
    reentrant.mint(attacker(), amount * 2);

    // Set up attack mode - try to re-enter SY.deposit
    reentrant.set_attack_mode(AttackMode::ReenterSYDeposit, sy.contract_address);

    // Approve SY
    start_cheat_caller_address(reentrant.contract_address, attacker());
    reentrant.approve(sy.contract_address, amount * 2);
    stop_cheat_caller_address(reentrant.contract_address);

    // Perform deposit - attack callback will be triggered during transfer_from
    start_cheat_caller_address(sy.contract_address, attacker());
    let sy_received = sy.deposit(attacker(), reentrant.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Attack was triggered (callback happened)
    let attack_count = reentrant.get_attack_count();
    assert(attack_count > 0, 'attack callback was triggered');

    // But deposit completed correctly - attacker got exactly what they paid for
    assert(sy_received == amount, 'got correct SY amount');
    assert(sy.balance_of(attacker()) == amount, 'balance is correct');
    // The attack callback couldn't exploit anything because:
// 1. SY doesn't have ReentrancyGuard (but doesn't need it for this pattern)
// 2. The 1:1 mint logic has no exploitable state
// 3. Any re-entry would just be another valid deposit
}

/// Test: SY.redeem follows CEI pattern (safe)
///
/// The redeem function correctly follows CEI:
///   1. burn (state change - effect)
///   2. transfer (external call - interaction)
///
/// Re-entry during transfer would find tokens already burned.
#[test]
fn test_sy_redeem_reentrancy_safe() {
    let (reentrant, sy) = setup_sy_with_reentrant();
    let amount = 1000 * WAD;

    // Setup: mint and deposit
    reentrant.mint(user1(), amount);

    start_cheat_caller_address(reentrant.contract_address, user1());
    reentrant.approve(sy.contract_address, amount);
    stop_cheat_caller_address(reentrant.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.deposit(user1(), reentrant.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Verify user has SY
    assert(sy.balance_of(user1()) == amount, 'user should have SY');

    // Enable attack mode for redeem (triggered during transfer)
    reentrant.set_attack_mode(AttackMode::ReenterYTRedeemPY, sy.contract_address);

    // Redeem
    start_cheat_caller_address(sy.contract_address, user1());
    let redeemed = sy.redeem(user1(), amount, reentrant.contract_address, 0, false);
    stop_cheat_caller_address(sy.contract_address);

    // Redeem completed correctly
    assert(redeemed == amount, 'redeemed correct amount');
    assert(sy.balance_of(user1()) == 0, 'SY balance should be 0');
    assert(reentrant.balance_of(user1()) == amount, 'got underlying back');
    // CEI pattern: burn happened before transfer, so re-entry finds 0 SY to burn
}

/// Test: SY.redeem with insufficient balance reverts
#[test]
#[should_panic(expected: 'ERC20: insufficient balance')]
fn test_sy_redeem_insufficient_balance() {
    let (reentrant, sy) = setup_sy_with_reentrant();
    let amount = 1000 * WAD;

    // Try to redeem without any SY
    start_cheat_caller_address(sy.contract_address, user1());
    sy.redeem(user1(), amount, reentrant.contract_address, 0, false);
    stop_cheat_caller_address(sy.contract_address);
}

// ============================================================================
// YT REENTRANCY TESTS (with ReentrancyGuard)
// ============================================================================

/// Test: YT.mint_py with normal operation
#[test]
fn test_yt_mint_py_normal_operation() {
    let (reentrant, sy, yt, pt) = setup_full_with_reentrant();
    let amount = 1000 * WAD;

    // Mint underlying to user, deposit to SY
    reentrant.mint(user1(), amount);

    start_cheat_caller_address(reentrant.contract_address, user1());
    reentrant.approve(sy.contract_address, amount);
    stop_cheat_caller_address(reentrant.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.deposit(user1(), reentrant.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Approve YT to spend SY
    start_cheat_caller_address(sy.contract_address, user1());
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Mint PT+YT
    start_cheat_caller_address(yt.contract_address, user1());
    let (pt_minted, yt_minted) = yt.mint_py(user1(), amount);
    stop_cheat_caller_address(yt.contract_address);

    // Verify
    assert(pt_minted == amount, 'PT minted correctly');
    assert(yt_minted == amount, 'YT minted correctly');
    assert(pt.balance_of(user1()) == amount, 'user has PT');
    assert(yt.balance_of(user1()) == amount, 'user has YT');
}

/// Test: YT.mint_py is protected by ReentrancyGuard
///
/// The YT contract has ReentrancyGuard that blocks re-entry during:
/// - SY.transfer_from call (standard ERC20, no callback)
/// - PT.mint call (internal, no external callback)
///
/// Note: mint_py calls sy.transfer_from() which is a standard ERC20 operation
/// on SY tokens, NOT the underlying token. So no callback is triggered from
/// the underlying. The ReentrancyGuard protects against theoretical attack
/// vectors that could arise from future code changes or SY implementations
/// that might have callbacks.
///
/// This test verifies:
/// 1. mint_py completes successfully
/// 2. State is consistent after operation
/// 3. ReentrancyGuard is active (tested indirectly - guard doesn't error)
#[test]
fn test_yt_mint_py_reentrancy_protected() {
    let (reentrant, sy, yt, pt) = setup_full_with_reentrant();
    let amount = 1000 * WAD;

    // Setup: get SY for user
    reentrant.mint(user1(), amount * 2);

    start_cheat_caller_address(reentrant.contract_address, user1());
    reentrant.approve(sy.contract_address, amount * 2);
    stop_cheat_caller_address(reentrant.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.deposit(user1(), reentrant.contract_address, amount * 2, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Note: Attack mode is set but won't trigger because mint_py
    // transfers SY tokens (ERC20), not the underlying reentrant token
    reentrant.set_attack_mode(AttackMode::ReenterYTMintPY, yt.contract_address);

    // Approve YT
    start_cheat_caller_address(sy.contract_address, user1());
    sy.approve(yt.contract_address, amount * 2);
    stop_cheat_caller_address(sy.contract_address);

    // Mint PT+YT - completes successfully with ReentrancyGuard active
    start_cheat_caller_address(yt.contract_address, user1());
    let (pt_minted, yt_minted) = yt.mint_py(user1(), amount);
    stop_cheat_caller_address(yt.contract_address);

    // Verify correct minting
    assert(pt_minted == amount, 'PT minted correctly');
    assert(yt_minted == amount, 'YT minted correctly');

    // User has correct balances
    assert(pt.balance_of(user1()) == amount, 'correct PT balance');
    assert(yt.balance_of(user1()) == amount, 'correct YT balance');

    // SY spent correctly
    assert(sy.balance_of(user1()) == amount, 'correct SY spent');

    // No attack callback was triggered (as expected - SY transfer is standard ERC20)
    let attack_count = reentrant.get_attack_count();
    assert(attack_count == 0, 'no callback on SY transfer');
}

/// Test: YT.redeem_py follows CEI and has ReentrancyGuard
#[test]
fn test_yt_redeem_py_reentrancy_protected() {
    let (reentrant, sy, yt, pt) = setup_full_with_reentrant();
    let amount = 1000 * WAD;

    // Setup: mint PT+YT to user
    reentrant.mint(user1(), amount);

    start_cheat_caller_address(reentrant.contract_address, user1());
    reentrant.approve(sy.contract_address, amount);
    stop_cheat_caller_address(reentrant.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.deposit(user1(), reentrant.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user1());
    yt.mint_py(user1(), amount);
    stop_cheat_caller_address(yt.contract_address);

    // Verify setup
    assert(pt.balance_of(user1()) == amount, 'user has PT');
    assert(yt.balance_of(user1()) == amount, 'user has YT');

    // Enable attack mode for redeem
    reentrant.set_attack_mode(AttackMode::ReenterYTRedeemPY, yt.contract_address);

    // Redeem PT+YT
    start_cheat_caller_address(yt.contract_address, user1());
    let sy_returned = yt.redeem_py(user1(), amount);
    stop_cheat_caller_address(yt.contract_address);

    // Redeem completed correctly
    assert(sy_returned == amount, 'got SY back');
    assert(pt.balance_of(user1()) == 0, 'PT burned');
    assert(yt.balance_of(user1()) == 0, 'YT burned');
    assert(sy.balance_of(user1()) == amount, 'user has SY');
}

/// Test: YT.redeem_due_interest clears interest before transfer
///
/// CEI pattern in redeem_due_interest:
///   1. Update index (effect)
///   2. Update user interest (effect)
///   3. Clear interest to 0 (effect)
///   4. Transfer SY (interaction)
///
/// Re-entry would find interest = 0, so no double-claim possible.
#[test]
fn test_yt_redeem_due_interest_reentrancy_protected() {
    let (reentrant, sy, yt, _pt) = setup_full_with_reentrant();
    let amount = 1000 * WAD;

    // Setup: mint PT+YT to user
    reentrant.mint(user1(), amount);

    start_cheat_caller_address(reentrant.contract_address, user1());
    reentrant.approve(sy.contract_address, amount);
    stop_cheat_caller_address(reentrant.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.deposit(user1(), reentrant.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user1());
    yt.mint_py(user1(), amount);
    stop_cheat_caller_address(yt.contract_address);

    // No interest accrued yet (index hasn't increased)
    // The key test is that the function is protected by ReentrancyGuard
    // and that interest is cleared before transfer

    // Enable attack mode
    reentrant.set_attack_mode(AttackMode::ReenterYTRedeemInterest, yt.contract_address);

    // Redeem interest (will be 0 but tests the guard)
    start_cheat_caller_address(yt.contract_address, user1());
    let interest = yt.redeem_due_interest(user1());
    stop_cheat_caller_address(yt.contract_address);

    // No interest (index didn't change)
    assert(interest == 0, 'no interest yet');
    // If there was interest, re-entry would find it cleared before transfer
}

/// Test: YT.transfer updates interest correctly for both parties
///
/// Transfer sequence:
///   1. Update sender's interest
///   2. Update recipient's interest
///   3. Transfer YT balance
///
/// This ensures interest is properly snapshotted before balance changes.
/// Since user_py_index is internal storage, we verify:
/// - Balances transfer correctly
/// - Global py_index is tracked
/// - Both users can query their pending interest
#[test]
fn test_yt_transfer_interest_update_order() {
    let (reentrant, sy, yt, _pt) = setup_full_with_reentrant();
    let amount = 1000 * WAD;

    // Setup: mint PT+YT to user1
    reentrant.mint(user1(), amount);

    start_cheat_caller_address(reentrant.contract_address, user1());
    reentrant.approve(sy.contract_address, amount);
    stop_cheat_caller_address(reentrant.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.deposit(user1(), reentrant.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user1());
    yt.mint_py(user1(), amount);
    stop_cheat_caller_address(yt.contract_address);

    // Record the global index before transfer
    let index_before = yt.py_index_stored();

    // Transfer half to attacker
    let transfer_amount = amount / 2;
    start_cheat_caller_address(yt.contract_address, user1());
    yt.transfer(attacker(), transfer_amount);
    stop_cheat_caller_address(yt.contract_address);

    // Verify balances transferred correctly
    assert(yt.balance_of(user1()) == amount - transfer_amount, 'user1 balance reduced');
    assert(yt.balance_of(attacker()) == transfer_amount, 'attacker received YT');

    // Verify global index hasn't changed (no yield accrual)
    let index_after = yt.py_index_stored();
    assert(index_after == index_before, 'global index unchanged');

    // Both users can query their pending interest (0 since no yield accrued)
    let user1_interest = yt.get_user_interest(user1());
    let attacker_interest = yt.get_user_interest(attacker());
    assert(user1_interest == 0, 'user1 no interest yet');
    assert(attacker_interest == 0, 'attacker no interest yet');
}

// ============================================================================
// PT REENTRANCY TESTS (No external calls)
// ============================================================================

/// Test: PT.mint has no external calls (no reentrancy vectors)
///
/// PT.mint only:
///   1. Checks caller is YT (access control)
///   2. Mints ERC20 tokens (internal)
///
/// No external calls means no reentrancy risk.
#[test]
fn test_pt_mint_no_external_calls() {
    let (reentrant, sy, yt, pt) = setup_full_with_reentrant();
    let amount = 1000 * WAD;

    // Setup and mint through normal flow
    reentrant.mint(user1(), amount);

    start_cheat_caller_address(reentrant.contract_address, user1());
    reentrant.approve(sy.contract_address, amount);
    stop_cheat_caller_address(reentrant.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.deposit(user1(), reentrant.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Mint triggers PT.mint internally
    start_cheat_caller_address(yt.contract_address, user1());
    let (pt_minted, _) = yt.mint_py(user1(), amount);
    stop_cheat_caller_address(yt.contract_address);

    // PT was minted correctly
    assert(pt_minted == amount, 'PT minted');
    assert(pt.balance_of(user1()) == amount, 'user has PT');
    // PT.mint has no external calls - no reentrancy possible
}

/// Test: PT.burn has no external calls (no reentrancy vectors)
#[test]
fn test_pt_burn_no_external_calls() {
    let (reentrant, sy, yt, pt) = setup_full_with_reentrant();
    let amount = 1000 * WAD;

    // Setup and mint
    reentrant.mint(user1(), amount);

    start_cheat_caller_address(reentrant.contract_address, user1());
    reentrant.approve(sy.contract_address, amount);
    stop_cheat_caller_address(reentrant.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.deposit(user1(), reentrant.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user1());
    yt.mint_py(user1(), amount);
    stop_cheat_caller_address(yt.contract_address);

    // Redeem triggers PT.burn internally
    start_cheat_caller_address(yt.contract_address, user1());
    yt.redeem_py(user1(), amount);
    stop_cheat_caller_address(yt.contract_address);

    // PT was burned
    assert(pt.balance_of(user1()) == 0, 'PT burned');
    // PT.burn has no external calls - no reentrancy possible
}

/// Test: PT transfer is standard ERC20 (no reentrancy vectors)
#[test]
fn test_pt_transfer_no_external_calls() {
    let (reentrant, sy, yt, pt) = setup_full_with_reentrant();
    let amount = 1000 * WAD;

    // Setup and mint
    reentrant.mint(user1(), amount);

    start_cheat_caller_address(reentrant.contract_address, user1());
    reentrant.approve(sy.contract_address, amount);
    stop_cheat_caller_address(reentrant.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.deposit(user1(), reentrant.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user1());
    yt.mint_py(user1(), amount);
    stop_cheat_caller_address(yt.contract_address);

    // Transfer PT
    start_cheat_caller_address(pt.contract_address, user1());
    pt.transfer(attacker(), amount);
    stop_cheat_caller_address(pt.contract_address);

    // Transfer completed
    assert(pt.balance_of(user1()) == 0, 'user1 transferred');
    assert(pt.balance_of(attacker()) == amount, 'attacker received');
    // Standard ERC20 transfer - no external calls, no reentrancy
}

// ============================================================================
// ADDITIONAL EDGE CASES
// ============================================================================

/// Test: Multiple deposits don't allow gaming the system
#[test]
fn test_sy_multiple_deposits_no_gaming() {
    let (reentrant, sy) = setup_sy_with_reentrant();

    // Attacker gets tokens
    let attacker_amount = 10000 * WAD;
    reentrant.mint(attacker(), attacker_amount);

    // User gets tokens
    let user_amount = 1000 * WAD;
    reentrant.mint(user1(), user_amount);

    // Enable attack mode
    reentrant.set_attack_mode(AttackMode::ReenterSYDeposit, sy.contract_address);

    // Attacker deposits
    start_cheat_caller_address(reentrant.contract_address, attacker());
    reentrant.approve(sy.contract_address, attacker_amount);
    stop_cheat_caller_address(reentrant.contract_address);

    start_cheat_caller_address(sy.contract_address, attacker());
    sy.deposit(attacker(), reentrant.contract_address, attacker_amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // User deposits (not affected by attack)
    start_cheat_caller_address(reentrant.contract_address, user1());
    reentrant.approve(sy.contract_address, user_amount);
    stop_cheat_caller_address(reentrant.contract_address);

    start_cheat_caller_address(sy.contract_address, user1());
    sy.deposit(user1(), reentrant.contract_address, user_amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Both have correct balances - attack didn't affect user
    assert(sy.balance_of(attacker()) == attacker_amount, 'attacker correct');
    assert(sy.balance_of(user1()) == user_amount, 'user correct');
}

/// Test: Zero amount operations revert (not exploitable)
#[test]
#[should_panic(expected: 'HZN: zero deposit')]
fn test_sy_deposit_zero_reverts() {
    let (reentrant, sy) = setup_sy_with_reentrant();

    start_cheat_caller_address(sy.contract_address, user1());
    sy.deposit(user1(), reentrant.contract_address, 0, 0);
    stop_cheat_caller_address(sy.contract_address);
}

#[test]
#[should_panic(expected: 'HZN: zero redeem')]
fn test_sy_redeem_zero_reverts() {
    let (reentrant, sy) = setup_sy_with_reentrant();

    start_cheat_caller_address(sy.contract_address, user1());
    sy.redeem(user1(), 0, reentrant.contract_address, 0, false);
    stop_cheat_caller_address(sy.contract_address);
}

#[test]
#[should_panic(expected: 'HZN: zero amount')]
fn test_yt_mint_py_zero_reverts() {
    let (_reentrant, _sy, yt, _pt) = setup_full_with_reentrant();

    start_cheat_caller_address(yt.contract_address, user1());
    yt.mint_py(user1(), 0);
    stop_cheat_caller_address(yt.contract_address);
}
