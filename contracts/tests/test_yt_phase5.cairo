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
use super::utils::{
    alice, bob, mint_and_deposit_sy, mint_and_mint_py, set_yield_index, setup_full, user1,
    zero_address,
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

    // Batch redeem to different receivers
    start_cheat_caller_address(yt.contract_address, caller);
    let sy_amounts = yt.redeem_py_multi(array![receiver1, receiver2], array![amount1, amount2]);
    stop_cheat_caller_address(yt.contract_address);

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

    start_cheat_caller_address(yt.contract_address, caller);
    let sy_amounts = yt.redeem_py_multi(array![receiver], array![redeem_amount]);
    stop_cheat_caller_address(yt.contract_address);

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

    mint_and_mint_py(yield_token, sy, yt, caller, amount);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    start_cheat_caller_address(yt.contract_address, caller);
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

    // Redeem without claiming interest
    start_cheat_caller_address(yt.contract_address, user);
    let (sy_returned, interest_claimed) = yt.redeem_py_with_interest(user, pt_minted, false);
    stop_cheat_caller_address(yt.contract_address);

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

    // Redeem with interest claim
    start_cheat_caller_address(yt.contract_address, user);
    let (sy_returned, interest_claimed) = yt.redeem_py_with_interest(user, pt_minted, true);
    stop_cheat_caller_address(yt.contract_address);

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

    // Partial redeem with interest
    start_cheat_caller_address(yt.contract_address, user);
    let (sy_returned, interest_claimed) = yt.redeem_py_with_interest(user, redeem_amount, true);
    stop_cheat_caller_address(yt.contract_address);

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
    mint_and_mint_py(yield_token, sy, yt, user, amount);

    // No yield accrued - redeem immediately
    start_cheat_caller_address(yt.contract_address, user);
    let (sy_returned, interest_claimed) = yt.redeem_py_with_interest(user, amount, true);
    stop_cheat_caller_address(yt.contract_address);

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

    // Redeem to different receiver
    start_cheat_caller_address(yt.contract_address, caller);
    let (sy_returned, interest_claimed) = yt.redeem_py_with_interest(receiver, pt_minted, true);
    stop_cheat_caller_address(yt.contract_address);

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

    mint_and_mint_py(yield_token, sy, yt, user, amount);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_py_with_interest(user, amount, true);
}

#[test]
#[should_panic(expected: 'HZN: zero amount')]
fn test_redeem_py_with_interest_zero_amount() {
    let (yield_token, sy, yt) = setup();
    let user = alice();

    mint_and_mint_py(yield_token, sy, yt, user, 100 * WAD);

    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_py_with_interest(user, 0, true);
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_redeem_py_with_interest_zero_receiver() {
    let (yield_token, sy, yt) = setup();
    let user = alice();

    mint_and_mint_py(yield_token, sy, yt, user, 100 * WAD);

    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_py_with_interest(zero_address(), 100 * WAD, true);
}
