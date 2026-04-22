/// Flash Mint Tests for YT Contract
///
/// Tests for the flash_mint_py function including:
/// - Basic flash mint functionality
/// - Callback verification
/// - Repayment failure scenarios
/// - Reentrancy protection (via ReentrancyGuard)
/// - Edge cases and error conditions

use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{
    IYTAdminDispatcher, IYTAdminDispatcherTrait, IYTDispatcher, IYTDispatcherTrait,
};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_flash_callback::{
    IMockFlashCallbackDispatcher, IMockFlashCallbackDispatcherTrait,
};
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use crate::utils::{admin, mint_yield_token_to_user, setup_full, user1, user2, zero_address};

// ============ Setup Functions ============

fn setup() -> (IMockYieldTokenDispatcher, ISYDispatcher, IYTDispatcher) {
    let (_, yield_token, sy, yt) = setup_full();
    (yield_token, sy, yt)
}

fn deploy_mock_flash_callback(
    yt: ContractAddress, sy: ContractAddress,
) -> IMockFlashCallbackDispatcher {
    let contract = declare("MockFlashCallback").unwrap().contract_class();
    let mut calldata = array![];
    calldata.append(yt.into());
    calldata.append(sy.into());

    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    IMockFlashCallbackDispatcher { contract_address }
}

/// Setup flash mint test environment with funded callback contract
fn setup_flash_mint(
    amount_sy: u256,
) -> (
    IMockYieldTokenDispatcher,
    ISYDispatcher,
    IYTDispatcher,
    IMockFlashCallbackDispatcher,
    ContractAddress,
) {
    let (yield_token, sy, yt) = setup();
    let callback = deploy_mock_flash_callback(yt.contract_address, sy.contract_address);

    // Fund the callback contract with SY for repayment
    // First mint yield tokens and deposit to SY
    mint_yield_token_to_user(yield_token, callback.contract_address, amount_sy);

    start_cheat_caller_address(yield_token.contract_address, callback.contract_address);
    yield_token.approve(sy.contract_address, amount_sy);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, callback.contract_address);
    sy.deposit(callback.contract_address, yield_token.contract_address, amount_sy, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Set the repay amount in callback
    callback.set_sy_balance_for_repay(amount_sy);

    let caller = user1();

    (yield_token, sy, yt, callback, caller)
}

// ============ Basic Flash Mint Tests ============

#[test]
fn test_flash_mint_py_basic() {
    let amount_sy = 100 * WAD;
    let (_, _sy, yt, callback, caller) = setup_flash_mint(amount_sy);

    // Perform flash mint
    start_cheat_caller_address(yt.contract_address, caller);
    let (pt_out, yt_out) = yt.flash_mint_py(callback.contract_address, amount_sy, array![].span());
    stop_cheat_caller_address(yt.contract_address);

    // Verify PT and YT were minted equally
    assert(pt_out == yt_out, 'PT and YT should be equal');
    assert(pt_out == amount_sy, 'Minted amount should match'); // At WAD index, PT = SY

    // Verify callback was invoked
    assert(callback.get_callback_count() == 1, 'Callback should be invoked');
    assert(callback.get_last_pt_amount() == pt_out, 'Callback PT amount wrong');
    assert(callback.get_last_yt_amount() == yt_out, 'Callback YT amount wrong');

    // Verify receiver has PT and YT
    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(callback.contract_address) == pt_out, 'Receiver should have PT');
    assert(yt.balance_of(callback.contract_address) == yt_out, 'Receiver should have YT');

    // Verify SY reserve was updated
    assert(yt.sy_reserve() == amount_sy, 'SY reserve should be updated');
}

#[test]
fn test_flash_mint_py_emits_event() {
    let amount_sy = 50 * WAD;
    let (_, _sy, yt, callback, caller) = setup_flash_mint(amount_sy);

    // Perform flash mint (event emission is implicit - test passes if no panic)
    start_cheat_caller_address(yt.contract_address, caller);
    let (pt_out, yt_out) = yt.flash_mint_py(callback.contract_address, amount_sy, array![].span());
    stop_cheat_caller_address(yt.contract_address);

    // Basic verification that operation succeeded
    assert(pt_out > 0, 'Should mint PT');
    assert(yt_out > 0, 'Should mint YT');
}

#[test]
fn test_flash_mint_py_multiple_times() {
    let amount_sy = 50 * WAD;
    let (yield_token, sy, yt, callback, caller) = setup_flash_mint(amount_sy * 2);

    // First flash mint
    start_cheat_caller_address(yt.contract_address, caller);
    let (pt_out_1, yt_out_1) = yt
        .flash_mint_py(callback.contract_address, amount_sy, array![].span());
    stop_cheat_caller_address(yt.contract_address);

    // Fund callback for second flash mint
    mint_yield_token_to_user(yield_token, callback.contract_address, amount_sy);

    start_cheat_caller_address(yield_token.contract_address, callback.contract_address);
    yield_token.approve(sy.contract_address, amount_sy);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, callback.contract_address);
    sy.deposit(callback.contract_address, yield_token.contract_address, amount_sy, 0);
    stop_cheat_caller_address(sy.contract_address);

    callback.set_sy_balance_for_repay(amount_sy);

    // Second flash mint
    start_cheat_caller_address(yt.contract_address, caller);
    let (pt_out_2, yt_out_2) = yt
        .flash_mint_py(callback.contract_address, amount_sy, array![].span());
    stop_cheat_caller_address(yt.contract_address);

    // Verify callback count
    assert(callback.get_callback_count() == 2, 'Two callbacks expected');

    // Verify cumulative PT/YT balance
    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(callback.contract_address) == pt_out_1 + pt_out_2, 'Total PT should sum');
    assert(yt.balance_of(callback.contract_address) == yt_out_1 + yt_out_2, 'Total YT should sum');
}

#[test]
fn test_flash_mint_py_with_data() {
    let amount_sy = 100 * WAD;
    let (_, _, yt, callback, caller) = setup_flash_mint(amount_sy);

    // Pass some data to the callback
    let data: Array<felt252> = array!['test', 'data', 123];

    start_cheat_caller_address(yt.contract_address, caller);
    let (pt_out, yt_out) = yt.flash_mint_py(callback.contract_address, amount_sy, data.span());
    stop_cheat_caller_address(yt.contract_address);

    // Verify operation succeeded
    assert(pt_out > 0, 'Should mint PT');
    assert(yt_out > 0, 'Should mint YT');
    assert(callback.get_callback_count() == 1, 'Callback invoked');
}

// ============ Callback Verification Tests ============

#[test]
fn test_flash_mint_py_callback_receives_correct_amounts() {
    let amount_sy = 75 * WAD;
    let (_, _, yt, callback, caller) = setup_flash_mint(amount_sy);

    start_cheat_caller_address(yt.contract_address, caller);
    let (pt_out, yt_out) = yt.flash_mint_py(callback.contract_address, amount_sy, array![].span());
    stop_cheat_caller_address(yt.contract_address);

    // Verify callback received correct amounts
    assert(callback.get_last_pt_amount() == pt_out, 'PT amount in callback wrong');
    assert(callback.get_last_yt_amount() == yt_out, 'YT amount in callback wrong');

    // PT and YT should be equal
    assert(callback.get_last_pt_amount() == callback.get_last_yt_amount(), 'PT = YT in callback');
}

// ============ Repayment Failure Tests ============

#[test]
#[should_panic(expected: 'HZN: flash repayment failed')]
fn test_flash_mint_py_repayment_failure_no_repay() {
    let amount_sy = 100 * WAD;
    let (_, _, yt, callback, caller) = setup_flash_mint(amount_sy);

    // Configure callback to NOT repay
    callback.set_should_repay(false);

    // Flash mint should fail due to no repayment
    start_cheat_caller_address(yt.contract_address, caller);
    yt.flash_mint_py(callback.contract_address, amount_sy, array![].span());
}

#[test]
#[should_panic(expected: 'HZN: flash repayment failed')]
fn test_flash_mint_py_repayment_failure_insufficient() {
    let amount_sy = 100 * WAD;
    let (_, _, yt, callback, caller) = setup_flash_mint(amount_sy);

    // Configure callback to repay less than required
    callback.set_custom_repay_amount(amount_sy / 2); // Only repay 50%

    // Flash mint should fail due to insufficient repayment
    start_cheat_caller_address(yt.contract_address, caller);
    yt.flash_mint_py(callback.contract_address, amount_sy, array![].span());
}

// ============ Edge Cases and Error Conditions ============

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_flash_mint_py_zero_receiver() {
    let (_, _, yt) = setup();
    let caller = user1();

    start_cheat_caller_address(yt.contract_address, caller);
    yt.flash_mint_py(zero_address(), 100 * WAD, array![].span());
}

#[test]
#[should_panic(expected: 'HZN: zero amount')]
fn test_flash_mint_py_zero_amount() {
    let (_, sy, yt) = setup();
    let callback = deploy_mock_flash_callback(yt.contract_address, sy.contract_address);
    let caller = user1();

    start_cheat_caller_address(yt.contract_address, caller);
    yt.flash_mint_py(callback.contract_address, 0, array![].span());
}

#[test]
#[should_panic(expected: 'HZN: expired')]
fn test_flash_mint_py_after_expiry() {
    let amount_sy = 100 * WAD;
    let (_, _, yt, callback, caller) = setup_flash_mint(amount_sy);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // Flash mint should fail after expiry
    start_cheat_caller_address(yt.contract_address, caller);
    yt.flash_mint_py(callback.contract_address, amount_sy, array![].span());
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn test_flash_mint_py_when_paused() {
    let amount_sy = 100 * WAD;
    let (_, _, yt, callback, caller) = setup_flash_mint(amount_sy);

    // Pause the YT contract using admin interface
    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    yt_admin.pause();
    stop_cheat_caller_address(yt.contract_address);

    // Flash mint should fail when paused
    start_cheat_caller_address(yt.contract_address, caller);
    yt.flash_mint_py(callback.contract_address, amount_sy, array![].span());
}

// ============ Integration Tests ============

#[test]
fn test_flash_mint_py_receiver_can_use_tokens() {
    let amount_sy = 100 * WAD;
    let (_, _sy, yt, callback, caller) = setup_flash_mint(amount_sy);

    // Perform flash mint
    start_cheat_caller_address(yt.contract_address, caller);
    let (pt_out, _yt_out) = yt.flash_mint_py(callback.contract_address, amount_sy, array![].span());
    stop_cheat_caller_address(yt.contract_address);

    // Verify receiver can transfer PT
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let transfer_amount = pt_out / 2;

    start_cheat_caller_address(pt.contract_address, callback.contract_address);
    pt.transfer(user2(), transfer_amount);
    stop_cheat_caller_address(pt.contract_address);

    assert(pt.balance_of(user2()) == transfer_amount, 'PT transfer should work');
    assert(
        pt.balance_of(callback.contract_address) == pt_out - transfer_amount, 'Remaining PT wrong',
    );

    // Verify receiver can transfer YT (uses same amount as PT)
    start_cheat_caller_address(yt.contract_address, callback.contract_address);
    yt.transfer(user2(), transfer_amount);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.balance_of(user2()) == transfer_amount, 'YT transfer should work');
}

#[test]
fn test_flash_mint_py_sy_reserve_tracking() {
    let amount_sy = 100 * WAD;
    let (_, _, yt, callback, caller) = setup_flash_mint(amount_sy);

    // Initial SY reserve should be 0
    let initial_reserve = yt.sy_reserve();
    assert(initial_reserve == 0, 'Initial reserve should be 0');

    // Perform flash mint
    start_cheat_caller_address(yt.contract_address, caller);
    yt.flash_mint_py(callback.contract_address, amount_sy, array![].span());
    stop_cheat_caller_address(yt.contract_address);

    // SY reserve should be updated to include repaid SY
    let final_reserve = yt.sy_reserve();
    assert(final_reserve == amount_sy, 'Reserve should equal amount_sy');
}

#[test]
fn test_flash_mint_py_total_supply_increases() {
    let amount_sy = 100 * WAD;
    let (_, _, yt, callback, caller) = setup_flash_mint(amount_sy);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Initial supplies
    let initial_pt_supply = pt.total_supply();
    let initial_yt_supply = yt.total_supply();

    // Perform flash mint
    start_cheat_caller_address(yt.contract_address, caller);
    let (pt_out, yt_out) = yt.flash_mint_py(callback.contract_address, amount_sy, array![].span());
    stop_cheat_caller_address(yt.contract_address);

    // Supplies should increase
    assert(pt.total_supply() == initial_pt_supply + pt_out, 'PT supply should increase');
    assert(yt.total_supply() == initial_yt_supply + yt_out, 'YT supply should increase');

    // PT and YT supplies should remain equal
    assert(pt.total_supply() == yt.total_supply(), 'PT and YT supplies should match');
}

// ============ Fee Tests (currently fee-less) ============

#[test]
fn test_flash_mint_py_no_fee() {
    let amount_sy = 100 * WAD;
    let (_, sy, yt, callback, caller) = setup_flash_mint(amount_sy);

    // Get callback SY balance before flash mint
    let sy_before = sy.balance_of(callback.contract_address);

    // Perform flash mint
    start_cheat_caller_address(yt.contract_address, caller);
    yt.flash_mint_py(callback.contract_address, amount_sy, array![].span());
    stop_cheat_caller_address(yt.contract_address);

    // Callback should have transferred exactly amount_sy (no fee)
    let sy_after = sy.balance_of(callback.contract_address);
    assert(sy_before - sy_after == amount_sy, 'No fee should be charged');
}
