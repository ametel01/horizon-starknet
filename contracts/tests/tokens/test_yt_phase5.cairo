/// Phase 5: Optional Enhancements Tests
/// Tests for same-block caching, batch operations, and claim-on-redeem
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_yield_token::IMockYieldTokenDispatcher;
use snforge_std::{
    start_cheat_block_number_global, start_cheat_block_timestamp_global, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;
use crate::utils::{
    alice, bob, mint_and_deposit_sy, mint_and_mint_py, set_yield_index, setup_full,
    transfer_py_and_redeem_multi, transfer_py_and_redeem_with_interest, user1, zero_address,
};

// ============ Setup Functions ============

fn setup() -> (IMockYieldTokenDispatcher, ISYDispatcher, IYTDispatcher) {
    let (_, yield_token, sy, yt) = setup_full();
    (yield_token, sy, yt)
}

fn setup_with_sy(
    user: ContractAddress, amount: u256,
) -> (IMockYieldTokenDispatcher, ISYDispatcher, IYTDispatcher) {
    let (yield_token, sy, yt) = setup();
    mint_and_deposit_sy(yield_token, sy, user, amount);
    (yield_token, sy, yt)
}

// ============ 5.1 Same-Block Index Caching Tests ============

#[test]
fn test_index_caching_same_block() {
    let (yield_token, sy, yt) = setup();
    let user = alice();
    let amount = 100 * WAD;

    // Setup: mint SY
    mint_and_deposit_sy(yield_token, sy, user, amount * 2);

    // Set a specific block number
    start_cheat_block_number_global(1000);

    // First mint should fetch from oracle
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Second mint in same block should use cached index
    // (we can't directly verify the cache hit, but we can verify correctness)
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Verify both mints succeeded with correct amounts
    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(user) == 2 * amount, 'Wrong PT balance');
    assert(yt.balance_of(user) == 2 * amount, 'Wrong YT balance');
}

#[test]
fn test_index_caching_different_block() {
    let (yield_token, sy, yt) = setup();
    let user = alice();
    let amount = 100 * WAD;

    mint_and_deposit_sy(yield_token, sy, user, amount * 2);

    // Block 1000 - mint at index 1.0, get 100 PT
    start_cheat_block_number_global(1000);
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    let (pt_minted_1, _) = yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Change index between blocks - 10% increase
    let new_index = WAD + WAD / 10;
    set_yield_index(yield_token, new_index);

    // Block 1001 - should fetch new index
    // At index 1.1, minting 100 SY gives 110 PT (syToAsset formula)
    start_cheat_block_number_global(1001);
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    let (pt_minted_2, _) = yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Verify both mints succeeded with correct amounts
    // First mint: 100 SY at index 1.0 = 100 PT
    // Second mint: 100 SY at index 1.1 = 110 PT (syToAsset formula)
    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(user) == pt_minted_1 + pt_minted_2, 'Wrong PT balance');
    assert(pt_minted_1 == amount, 'First mint should be 1:1');
    // Second mint at higher index gives more PT
    assert(pt_minted_2 > amount, 'Second mint should give more PT');
}

// ============ 5.2 Batch Operations Tests ============

#[test]
fn test_mint_py_multi_basic() {
    let (yield_token, sy, yt) = setup();
    let caller = user1();
    let receiver1 = alice();
    let receiver2 = bob();
    let amount1 = 100 * WAD;
    let amount2 = 50 * WAD;
    let total = amount1 + amount2;

    // Setup: mint SY to caller
    mint_and_deposit_sy(yield_token, sy, caller, total);

    // Transfer SY to YT contract (floating SY pattern)
    start_cheat_caller_address(sy.contract_address, caller);
    sy.transfer(yt.contract_address, total);
    stop_cheat_caller_address(sy.contract_address);

    // Batch mint - same receivers for both PT and YT
    start_cheat_caller_address(yt.contract_address, caller);
    let (pt_amounts, yt_amounts) = yt
        .mint_py_multi(
            array![receiver1, receiver2], array![receiver1, receiver2], array![amount1, amount2],
        );
    stop_cheat_caller_address(yt.contract_address);

    // Verify return values
    assert(pt_amounts.span().len() == 2, 'Wrong PT amounts length');
    assert(yt_amounts.span().len() == 2, 'Wrong YT amounts length');
    assert(*pt_amounts.span().at(0) == amount1, 'Wrong PT amount 1');
    assert(*pt_amounts.span().at(1) == amount2, 'Wrong PT amount 2');

    // Verify balances
    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(receiver1) == amount1, 'Wrong receiver1 PT');
    assert(pt.balance_of(receiver2) == amount2, 'Wrong receiver2 PT');
    assert(yt.balance_of(receiver1) == amount1, 'Wrong receiver1 YT');
    assert(yt.balance_of(receiver2) == amount2, 'Wrong receiver2 YT');

    // Caller should have no PT/YT (sent to receivers)
    assert(pt.balance_of(caller) == 0, 'Caller should have 0 PT');
    assert(yt.balance_of(caller) == 0, 'Caller should have 0 YT');

    // Verify SY is transferred
    assert(sy.balance_of(caller) == 0, 'Caller should have 0 SY');
    assert(sy.balance_of(yt.contract_address) == total, 'YT should hold SY');
}

#[test]
fn test_mint_py_multi_single_receiver() {
    let (yield_token, sy, yt) = setup();
    let caller = user1();
    let receiver = alice();
    let amount = 100 * WAD;

    mint_and_deposit_sy(yield_token, sy, caller, amount);

    start_cheat_caller_address(sy.contract_address, caller);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, caller);
    // mint_py_multi now takes (receivers_pt, receivers_yt, amounts)
    let (pt_amounts, yt_amounts) = yt
        .mint_py_multi(array![receiver], array![receiver], array![amount]);
    stop_cheat_caller_address(yt.contract_address);

    assert(pt_amounts.span().len() == 1, 'Wrong length');
    assert(*pt_amounts.span().at(0) == amount, 'Wrong amount');
    let _ = yt_amounts; // Silence unused warning

    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(receiver) == amount, 'Wrong PT balance');
}

#[test]
#[should_panic(expected: 'HZN: array length mismatch')]
fn test_mint_py_multi_length_mismatch() {
    let (_, _, yt) = setup();
    let caller = user1();

    start_cheat_caller_address(yt.contract_address, caller);
    // 2 PT receivers, 2 YT receivers, but only 1 amount
    yt.mint_py_multi(array![alice(), bob()], array![alice(), bob()], array![100 * WAD]);
}

#[test]
#[should_panic(expected: 'HZN: zero amount')]
fn test_mint_py_multi_empty_arrays() {
    let (_, _, yt) = setup();
    let caller = user1();

    start_cheat_caller_address(yt.contract_address, caller);
    yt.mint_py_multi(array![], array![], array![]);
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_mint_py_multi_zero_pt_receiver() {
    let (yield_token, sy, yt) = setup();
    let caller = user1();
    let amount = 100 * WAD;

    mint_and_deposit_sy(yield_token, sy, caller, amount);

    start_cheat_caller_address(sy.contract_address, caller);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, caller);
    // Zero address as PT receiver should fail
    yt.mint_py_multi(array![zero_address()], array![alice()], array![amount]);
}

#[test]
fn test_redeem_py_multi_basic() {
    let (yield_token, sy, yt) = setup();
    let caller = user1();
    let receiver1 = alice();
    let receiver2 = bob();
    let amount1 = 100 * WAD;
    let amount2 = 50 * WAD;
    let total = amount1 + amount2;

    // Setup: mint PT/YT to caller
    mint_and_mint_py(yield_token, sy, yt, caller, total);

    // Batch redeem to different receivers using floating token pattern
    let sy_amounts = transfer_py_and_redeem_multi(
        yt, caller, array![receiver1, receiver2], array![amount1, amount2],
    );

    // Verify return values
    assert(sy_amounts.len() == 2, 'Wrong SY amounts length');
    assert(*sy_amounts.at(0) == amount1, 'Wrong SY amount 1');
    assert(*sy_amounts.at(1) == amount2, 'Wrong SY amount 2');

    // Verify SY balances
    assert(sy.balance_of(receiver1) == amount1, 'Wrong receiver1 SY');
    assert(sy.balance_of(receiver2) == amount2, 'Wrong receiver2 SY');

    // Caller should have no PT/YT left (all burned)
    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(caller) == 0, 'Caller should have 0 PT');
    assert(yt.balance_of(caller) == 0, 'Caller should have 0 YT');
}

#[test]
fn test_redeem_py_multi_partial() {
    let (yield_token, sy, yt) = setup();
    let caller = user1();
    let receiver = alice();
    let mint_amount = 100 * WAD;
    let redeem_amount = 40 * WAD;

    mint_and_mint_py(yield_token, sy, yt, caller, mint_amount);

    // Partial redeem using floating token pattern
    let sy_amounts = transfer_py_and_redeem_multi(
        yt, caller, array![receiver], array![redeem_amount],
    );

    assert(*sy_amounts.at(0) == redeem_amount, 'Wrong SY amount');
    assert(sy.balance_of(receiver) == redeem_amount, 'Wrong receiver SY');

    // Caller should still have remaining PT/YT
    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(caller) == mint_amount - redeem_amount, 'Wrong remaining PT');
    assert(yt.balance_of(caller) == mint_amount - redeem_amount, 'Wrong remaining YT');
}

#[test]
#[should_panic(expected: 'HZN: expired')]
fn test_redeem_py_multi_after_expiry() {
    let (yield_token, sy, yt) = setup();
    let caller = user1();
    let amount = 100 * WAD;

    let (pt_minted, _) = mint_and_mint_py(yield_token, sy, yt, caller, amount);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // Try to redeem using floating token pattern - should fail because expired
    let pt = IPTDispatcher { contract_address: yt.pt() };
    start_cheat_caller_address(pt.contract_address, caller);
    pt.transfer(yt.contract_address, pt_minted);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, caller);
    yt.transfer(yt.contract_address, pt_minted);
    yt.redeem_py_multi(array![alice()], array![amount]);
}

// ============ 5.3 Claim-on-Redeem Tests ============

#[test]
fn test_redeem_py_with_interest_no_claim() {
    let (yield_token, sy, yt) = setup();
    let user = alice();
    let amount = 100 * WAD;

    // Mint PT/YT at index 1.0
    let (pt_minted, _) = mint_and_mint_py(yield_token, sy, yt, user, amount);

    // Accrue some interest
    let new_index = WAD + WAD / 10; // 10% yield
    set_yield_index(yield_token, new_index);

    // Redeem without claiming interest using floating token pattern
    let (sy_returned, interest_claimed) = transfer_py_and_redeem_with_interest(
        yt, user, user, pt_minted, false,
    );

    // With assetToSy formula: sy_returned = pt_minted * WAD / index
    // At index 1.1, 100 PT → ~90.9 SY
    assert(sy_returned > 0, 'Should return SY from redeem');
    assert(interest_claimed == 0, 'Should not claim interest');

    // Verify user has received SY
    assert(sy.balance_of(user) == sy_returned, 'Wrong user SY balance');
}

#[test]
fn test_redeem_py_with_interest_claim() {
    let (yield_token, sy, yt) = setup();
    let user = alice();
    let amount = 100 * WAD;

    // Mint PT/YT for user at index 1.0
    let (pt_minted, _) = mint_and_mint_py(yield_token, sy, yt, user, amount);

    // Also mint PT/YT for bob to provide additional SY in the pool for interest payments
    // In production, the yield on SY would provide these tokens; in testing we simulate
    // by having another user's deposits contribute to the pool
    let extra_for_interest = 10 * WAD;
    mint_and_mint_py(yield_token, sy, yt, bob(), extra_for_interest);

    // Accrue interest (10% yield)
    set_yield_index(yield_token, WAD + WAD / 10);

    // Force index update by checking interest (we expect some accrued)
    let expected_interest = yt.get_user_interest(user);
    assert(expected_interest > 0, 'Should have accrued interest');

    // Redeem with interest claim using floating token pattern
    let (sy_returned, interest_claimed) = transfer_py_and_redeem_with_interest(
        yt, user, user, pt_minted, true,
    );

    // Should get SY from redemption (using assetToSy) + interest
    assert(sy_returned > 0, 'Should return SY from redeem');
    assert(interest_claimed > 0, 'Should claim interest');

    // User should have total = redemption + interest
    let total = sy.balance_of(user);
    assert(total == sy_returned + interest_claimed, 'Wrong total SY');
}

#[test]
fn test_redeem_py_with_interest_partial_redemption() {
    let (yield_token, sy, yt) = setup();
    let user = alice();
    let mint_amount = 100 * WAD;
    let redeem_amount = 40 * WAD;

    // Mint at index 1.0
    let (pt_minted, _) = mint_and_mint_py(yield_token, sy, yt, user, mint_amount);

    // Accrue interest
    set_yield_index(yield_token, WAD + WAD / 10);

    // Partial redeem with interest using floating token pattern
    let (sy_returned, interest_claimed) = transfer_py_and_redeem_with_interest(
        yt, user, user, redeem_amount, true,
    );

    // With assetToSy, sy_returned = redeem_amount * WAD / 1.1
    assert(sy_returned > 0, 'Should return SY from redeem');
    assert(interest_claimed > 0, 'Should claim interest');

    // User still has remaining PT/YT
    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(user) == pt_minted - redeem_amount, 'Wrong remaining PT');
    assert(yt.balance_of(user) == pt_minted - redeem_amount, 'Wrong remaining YT');
}

#[test]
fn test_redeem_py_with_interest_no_accrued_interest() {
    let (yield_token, sy, yt) = setup();
    let user = alice();
    let amount = 100 * WAD;

    // Mint PT/YT
    let (pt_minted, _) = mint_and_mint_py(yield_token, sy, yt, user, amount);

    // No yield accrued - redeem immediately using floating token pattern
    let (sy_returned, interest_claimed) = transfer_py_and_redeem_with_interest(
        yt, user, user, pt_minted, true,
    );

    assert(sy_returned == amount, 'Wrong SY from redeem');
    assert(interest_claimed == 0, 'No interest to claim');
}

#[test]
fn test_redeem_py_with_interest_to_different_receiver() {
    let (yield_token, sy, yt) = setup();
    let caller = alice();
    let receiver = bob();
    let amount = 100 * WAD;

    // Mint PT/YT to caller at index 1.0
    let (pt_minted, _) = mint_and_mint_py(yield_token, sy, yt, caller, amount);

    // Also mint PT/YT for user1 to provide additional SY in pool for interest
    let extra_for_interest = 10 * WAD;
    mint_and_mint_py(yield_token, sy, yt, user1(), extra_for_interest);

    // Accrue interest
    set_yield_index(yield_token, WAD + WAD / 10);

    // Redeem to different receiver using floating token pattern
    let (sy_returned, interest_claimed) = transfer_py_and_redeem_with_interest(
        yt, caller, receiver, pt_minted, true,
    );

    // Receiver should get both redemption (via assetToSy) and interest
    assert(sy_returned > 0, 'Should return SY from redeem');
    assert(sy.balance_of(receiver) == sy_returned + interest_claimed, 'Receiver wrong SY');
    assert(sy.balance_of(caller) == 0, 'Caller should have 0 SY');
}

#[test]
#[should_panic(expected: 'HZN: expired')]
fn test_redeem_py_with_interest_after_expiry() {
    let (yield_token, sy, yt) = setup();
    let user = alice();
    let amount = 100 * WAD;

    let (pt_minted, _) = mint_and_mint_py(yield_token, sy, yt, user, amount);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // Try to redeem using floating token pattern - should fail because expired
    let pt = IPTDispatcher { contract_address: yt.pt() };
    start_cheat_caller_address(pt.contract_address, user);
    pt.transfer(yt.contract_address, pt_minted);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.transfer(yt.contract_address, pt_minted);
    yt.redeem_py_with_interest(user, true);
}

#[test]
#[should_panic(expected: 'HZN: no floating PT/YT')]
fn test_redeem_py_with_interest_zero_amount() {
    let (yield_token, sy, yt) = setup();
    let user = alice();

    mint_and_mint_py(yield_token, sy, yt, user, 100 * WAD);

    // With floating token pattern, calling redeem without transferring tokens should fail
    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_py_with_interest(user, true);
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_redeem_py_with_interest_zero_receiver() {
    let (yield_token, sy, yt) = setup();
    let user = alice();

    let (pt_minted, _) = mint_and_mint_py(yield_token, sy, yt, user, 100 * WAD);

    // Transfer tokens first, then try to redeem to zero address
    let pt = IPTDispatcher { contract_address: yt.pt() };
    start_cheat_caller_address(pt.contract_address, user);
    pt.transfer(yt.contract_address, pt_minted);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.transfer(yt.contract_address, pt_minted);
    yt.redeem_py_with_interest(zero_address(), true);
}

// ============ 5.4 Post-Expiry Tracking Tests (Pendle-style) ============

#[test]
fn test_post_expiry_data_not_initialized_before_expiry() {
    let (_, _, yt) = setup();

    // Before expiry, post-expiry data should not be initialized
    let (first_index, treasury_interest, is_initialized) = yt.get_post_expiry_data();
    assert(first_index == 0, 'first_py_index should be 0');
    assert(treasury_interest == 0, 'treasury interest should be 0');
    assert(!is_initialized, 'Should not be initialized');

    // Individual getters should also return 0
    assert(yt.first_py_index() == 0, 'first_py_index getter 0');
    assert(yt.total_sy_interest_for_treasury() == 0, 'treasury getter 0');
}

#[test]
fn test_post_expiry_data_initialized_on_first_call() {
    let (yield_token, sy, yt) = setup();
    let user = alice();
    let amount = 100 * WAD;

    // Mint PT/YT before expiry
    let (pt_minted, _) = mint_and_mint_py(yield_token, sy, yt, user, amount);

    // Move past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // Before any post-expiry action, data is not initialized
    assert(yt.first_py_index() == 0, 'Not yet initialized');

    // Redeem PT post-expiry - this triggers first post-expiry call
    let pt = IPTDispatcher { contract_address: yt.pt() };
    start_cheat_caller_address(pt.contract_address, user);
    pt.transfer(yt.contract_address, pt_minted);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_py_post_expiry(user);
    stop_cheat_caller_address(yt.contract_address);

    // Now post-expiry data should be initialized
    let (first_index, _, is_initialized) = yt.get_post_expiry_data();
    assert(first_index > 0, 'first_py_index should be set');
    assert(is_initialized, 'Should be initialized');

    // first_py_index should match py_index_stored (frozen at expiry)
    assert(first_index == yt.py_index_stored(), 'Should match stored index');
}

#[test]
fn test_post_expiry_first_index_captured_correctly() {
    let (yield_token, sy, yt) = setup();
    let user = alice();
    let amount = 100 * WAD;

    // Mint at initial index (1.0 WAD)
    mint_and_mint_py(yield_token, sy, yt, user, amount);

    // Increase yield index to 1.2 WAD (20% yield) before expiry
    let index_at_expiry = WAD + WAD / 5;
    set_yield_index(yield_token, index_at_expiry);

    // Move past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // Trigger post-expiry initialization using redeem_due_interest (state-modifying function)
    // py_index_current() is a view function that doesn't update state
    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    // The first_py_index should capture the index at the time of first post-expiry call
    let first_index = yt.first_py_index();
    assert(first_index == index_at_expiry, 'Wrong first_py_index captured');
}

#[test]
fn test_treasury_interest_accumulates_per_redemption() {
    let (yield_token, sy, yt) = setup();
    let user1_addr = alice();
    let user2_addr = bob();
    let amount1 = 100 * WAD;
    let amount2 = 50 * WAD;

    // Mint PT/YT for two users at index 1.0
    let (pt1, _) = mint_and_mint_py(yield_token, sy, yt, user1_addr, amount1);
    let (pt2, _) = mint_and_mint_py(yield_token, sy, yt, user2_addr, amount2);

    // Move past expiry - at this point index is still 1.0 (WAD)
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // First user redeems - this triggers post-expiry data init with index at WAD
    let pt = IPTDispatcher { contract_address: yt.pt() };
    start_cheat_caller_address(pt.contract_address, user1_addr);
    pt.transfer(yt.contract_address, pt1);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, user1_addr);
    yt.redeem_py_post_expiry(user1_addr);
    stop_cheat_caller_address(yt.contract_address);

    // At this point, expiry index is captured at WAD, and current_index == expiry_index
    // So no treasury carve-out yet
    let treasury_after_first = yt.total_sy_interest_for_treasury();
    assert(treasury_after_first == 0, 'No interest yet (same index)');

    // NOW increase index post-expiry (simulate yield accruing AFTER expiry was captured)
    // This post-expiry yield should go to treasury, not users
    let post_expiry_index = WAD + WAD / 10; // 10% post-expiry yield
    set_yield_index(yield_token, post_expiry_index);

    // Second user redeems - now current_index > expiry_index, treasury gets carve-out
    start_cheat_caller_address(pt.contract_address, user2_addr);
    pt.transfer(yt.contract_address, pt2);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, user2_addr);
    yt.redeem_py_post_expiry(user2_addr);
    stop_cheat_caller_address(yt.contract_address);

    let treasury_after_second = yt.total_sy_interest_for_treasury();
    assert(treasury_after_second > 0, 'Treasury should have interest');
}

#[test]
fn test_first_py_index_frozen_after_init() {
    let (yield_token, sy, yt) = setup();
    let user = alice();
    let amount = 100 * WAD;

    // Mint at initial index
    mint_and_mint_py(yield_token, sy, yt, user, amount);

    // Increase index before expiry to have a distinct value
    let index_before_expiry = WAD + WAD / 10; // 1.1
    set_yield_index(yield_token, index_before_expiry);

    // Move past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // Trigger initialization using redeem_due_interest (state-modifying function)
    // Note: This may claim some interest if available, but the key test is index freezing
    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    let first_captured_index = yt.first_py_index();
    // The captured index should be >= index_before_expiry (watermark pattern)
    assert(first_captured_index >= index_before_expiry, 'Should capture index at expiry');
    assert(first_captured_index > 0, 'Index should be positive');

    // Increase yield index significantly after expiry
    set_yield_index(yield_token, WAD * 2); // 100% increase

    // Trigger another state-modifying call
    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    // first_py_index should remain frozen at the originally captured value
    assert(yt.first_py_index() == first_captured_index, 'first_py_index should be frozen');
    assert(yt.py_index_stored() == first_captured_index, 'stored index should be frozen');
}

#[test]
fn test_get_post_expiry_data_complete_view() {
    let (yield_token, sy, yt) = setup();
    let user = alice();
    let amount = 100 * WAD;

    // Mint extra SY to cover potential interest payments
    // We need enough SY in the pool to pay interest when redeem_due_interest is called
    let extra_amount = 20 * WAD;
    mint_and_deposit_sy(yield_token, sy, bob(), extra_amount);

    // Transfer extra SY to YT contract and mint for bob (adds to SY reserve)
    start_cheat_caller_address(sy.contract_address, bob());
    sy.transfer(yt.contract_address, extra_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, bob());
    yt.mint_py(bob(), bob());
    stop_cheat_caller_address(yt.contract_address);

    // Now mint for the main user
    let (pt_minted, _) = mint_and_mint_py(yield_token, sy, yt, user, amount);

    // Set yield index before expiry - this will be captured as expiry index
    let expiry_index = WAD + WAD / 10;
    set_yield_index(yield_token, expiry_index);

    // Move past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // First trigger post-expiry data initialization to capture the expiry index
    // Use a state-modifying function that doesn't require transfers
    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    // Verify expiry index was captured
    let captured_expiry_index = yt.first_py_index();
    assert(captured_expiry_index == expiry_index, 'Expiry index should match');

    // NOW set post-expiry yield (this happens AFTER expiry index is frozen)
    let post_expiry_yield_index = WAD + WAD / 5;
    set_yield_index(yield_token, post_expiry_yield_index);

    // Redeem to trigger treasury carve-out (current > expiry)
    let pt = IPTDispatcher { contract_address: yt.pt() };
    start_cheat_caller_address(pt.contract_address, user);
    pt.transfer(yt.contract_address, pt_minted);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_py_post_expiry(user);
    stop_cheat_caller_address(yt.contract_address);

    // Get complete post-expiry data
    let (first_index, treasury_interest, is_initialized) = yt.get_post_expiry_data();

    // Verify all fields
    assert(is_initialized, 'Should be initialized');
    assert(first_index == captured_expiry_index, 'first_index should match');
    assert(treasury_interest > 0, 'Should have treasury interest');

    // Verify consistency with individual getters
    assert(first_index == yt.first_py_index(), 'first_index mismatch');
    assert(treasury_interest == yt.total_sy_interest_for_treasury(), 'treasury mismatch');
}

#[test]
fn test_per_user_interest_deltas_across_redemptions() {
    let (yield_token, sy, yt) = setup();
    let user1_addr = alice();
    let user2_addr = bob();
    let amount = 100 * WAD;

    // Mint PT/YT for two users at index 1.0
    mint_and_mint_py(yield_token, sy, yt, user1_addr, amount);
    mint_and_mint_py(yield_token, sy, yt, user2_addr, amount);

    // Generate yield before expiry (users should accrue this)
    let pre_expiry_index = WAD + WAD / 20; // 5% yield
    set_yield_index(yield_token, pre_expiry_index);

    // Check user interests before expiry (view function uses current oracle rate)
    let user1_interest_pre = yt.get_user_interest(user1_addr);
    let user2_interest_pre = yt.get_user_interest(user2_addr);

    // Both users should have accrued interest
    assert(user1_interest_pre > 0, 'User1 should have interest');
    assert(user2_interest_pre > 0, 'User2 should have interest');
    // Same amount minted, so same interest
    assert(user1_interest_pre == user2_interest_pre, 'Equal interest before expiry');

    // Move past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // Trigger post-expiry data init to capture the expiry index at pre_expiry_index
    start_cheat_caller_address(yt.contract_address, user1_addr);
    yt.redeem_due_interest(user1_addr);
    stop_cheat_caller_address(yt.contract_address);

    // Verify expiry index was captured at pre_expiry_index
    assert(yt.first_py_index() == pre_expiry_index, 'Should capture pre-expiry index');

    // NOW increase yield post-expiry (this goes to treasury, not users)
    let post_expiry_index = WAD + WAD / 10; // 10% total
    set_yield_index(yield_token, post_expiry_index);

    // User2's interest should still be based on frozen expiry index (not current oracle rate)
    // py_index_current() returns frozen expiry index after initialization
    let user2_interest_post = yt.get_user_interest(user2_addr);

    // Post-expiry yield shouldn't increase user interest
    // User2 didn't claim yet, but interest calculation uses frozen expiry index
    assert(user2_interest_post == user2_interest_pre, 'User2 interest should be frozen');
}
