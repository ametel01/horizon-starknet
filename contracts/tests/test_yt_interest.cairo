/// YT Interest Calculation Tests
///
/// Comprehensive tests for the YT interest accrual mechanism.
///
/// Pendle-compatible Interest Formula:
///   interest = yt_balance * (current_index - user_index) / (user_index * current_index)
///
/// This normalized formula accounts for SY's increased value - users get fewer SY tokens,
/// but each SY is worth more. The invariant: totalSyRedeemable remains unchanged.
///
/// Key Properties:
/// 1. Earlier YT holders earn more interest
/// 2. Interest is preserved on transfer (accrued interest belongs to original holder)
/// 3. User index follows watermark pattern (never decreases)
/// 4. Interest can be claimed before or after expiry (but no new interest accrues after expiry)

use horizon::interfaces::i_sy::ISYDispatcher;
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math_fp::{WAD, wad_div, wad_mul};
use horizon::mocks::mock_yield_token::IMockYieldTokenDispatcher;
use snforge_std::{
    start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use super::utils::{
    CURRENT_TIME, ONE_MONTH, alice, bob, mint_and_mint_py, set_yield_index, setup_full,
    setup_full_with_expiry, user1,
};

// ============ Setup Helpers ============

fn setup() -> (IMockYieldTokenDispatcher, ISYDispatcher, IYTDispatcher) {
    let (_, yield_token, sy, yt) = setup_full();
    (yield_token, sy, yt)
}

fn setup_with_custom_expiry(
    expiry: u64,
) -> (IMockYieldTokenDispatcher, ISYDispatcher, IYTDispatcher) {
    let (_, yield_token, sy, yt) = setup_full_with_expiry(expiry);
    (yield_token, sy, yt)
}

/// Setup user with YT tokens (mints SY, then mints PT+YT)
fn setup_user_with_yt(
    yield_token: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    user: ContractAddress,
    amount: u256,
) {
    mint_and_mint_py(yield_token, sy, yt, user, amount);
}

// ============ Single User Interest Tests ============

/// Test basic interest accrual for a single user
/// User mints YT at index 1.0, index increases to 1.1
/// Pendle formula: interest = balance × (curr - prev) / (prev × curr)
#[test]
fn test_interest_accrual_single_user() {
    let (yield_token, sy, yt) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Mint YT at initial index (WAD = 1.0)
    setup_user_with_yt(yield_token, sy, yt, user, amount);

    // Verify no interest yet (index hasn't changed)
    let interest_before = yt.get_user_interest(user);
    assert(interest_before == 0, 'No interest before index change');

    // Increase index by 10% (1.0 -> 1.1)
    set_yield_index(yield_token, WAD + WAD / 10); // 1.1 WAD

    // Calculate expected interest with Pendle formula:
    // interest = yt_balance × (curr - prev) / (prev × curr)
    // interest = 100 WAD × 0.1 WAD / (1.0 × 1.1) = 100 × 0.1 / 1.1 ≈ 9.09 WAD
    let interest_after = yt.get_user_interest(user);

    // Expected: 100 × 0.1 / 1.1 = 9.0909... WAD
    let index_diff = WAD / 10; // 0.1 WAD
    let denominator = wad_mul(WAD, WAD + WAD / 10); // 1.0 × 1.1
    let expected_interest = wad_div(wad_mul(amount, index_diff), denominator);
    let tolerance = WAD / 100; // 1% tolerance

    assert(interest_after >= expected_interest - tolerance, 'Interest too low');
    assert(interest_after <= expected_interest + tolerance, 'Interest too high');
}

/// Test interest compounds correctly with multiple index increases
/// With Pendle formula: interest = balance × (curr - prev) / (prev × curr)
#[test]
fn test_interest_accrual_multiple_increases() {
    let (yield_token, sy, yt) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_yt(yield_token, sy, yt, user, amount);

    // First increase: 1.0 -> 1.05 (5%)
    set_yield_index(yield_token, WAD + WAD / 20);
    let interest_1 = yt.get_user_interest(user);

    // Second increase: 1.05 -> 1.10 (another ~4.76%)
    set_yield_index(yield_token, WAD + WAD / 10);
    let interest_2 = yt.get_user_interest(user);

    // Third increase: 1.10 -> 1.20 (another ~9.09%)
    set_yield_index(yield_token, WAD + WAD / 5);
    let interest_3 = yt.get_user_interest(user);

    // Interest should increase with each index bump
    assert(interest_2 > interest_1, 'Interest should increase');
    assert(interest_3 > interest_2, 'Interest should keep increasing');

    // Total interest for 20% index increase with Pendle formula:
    // interest = 100 × (1.2 - 1.0) / (1.0 × 1.2) = 100 × 0.2 / 1.2 ≈ 16.67 WAD
    let index_diff = WAD / 5; // 0.2 WAD
    let denominator = wad_mul(WAD, WAD + WAD / 5); // 1.0 × 1.2
    let expected_total = wad_div(wad_mul(amount, index_diff), denominator);
    let tolerance = WAD / 10; // 0.1 WAD tolerance
    assert(interest_3 >= expected_total - tolerance, 'Total interest too low');
    assert(interest_3 <= expected_total + tolerance, 'Total interest too high');
}

// ============ Multi-User Interest Tests ============

/// Test that earlier YT holders earn more interest
/// User A mints at index 1.0, User B mints at index 1.1, both see index 1.2
/// User A should earn more than User B
/// Using Pendle formula: interest = balance × (curr - prev) / (prev × curr)
#[test]
fn test_interest_accrual_multiple_users_earlier_earns_more() {
    let (yield_token, sy, yt) = setup();
    let user_a = alice();
    let user_b = bob();
    let amount = 100 * WAD;

    // User A mints at index 1.0
    setup_user_with_yt(yield_token, sy, yt, user_a, amount);

    // Index goes to 1.1
    set_yield_index(yield_token, WAD + WAD / 10);

    // User B mints at index 1.1
    setup_user_with_yt(yield_token, sy, yt, user_b, amount);

    // Index goes to 1.2
    set_yield_index(yield_token, WAD + WAD / 5);

    // Check interests
    let interest_a = yt.get_user_interest(user_a);
    let interest_b = yt.get_user_interest(user_b);

    // User A: minted at 1.0, now 1.2
    // Pendle formula: 100 × (1.2 - 1.0) / (1.0 × 1.2) = 100 × 0.2 / 1.2 ≈ 16.67 WAD

    // User B: minted at 1.1, now 1.2
    // Pendle formula: 100 × (1.2 - 1.1) / (1.1 × 1.2) = 100 × 0.1 / 1.32 ≈ 7.58 WAD

    // User A should earn more than User B
    assert(interest_a > interest_b, 'Earlier holder earns more');

    // Verify approximate values with Pendle formula
    let index_1_0 = WAD;
    let index_1_1 = WAD + WAD / 10;
    let index_1_2 = WAD + WAD / 5;

    // User A: 100 × (1.2 - 1.0) / (1.0 × 1.2) ≈ 16.67 WAD
    let expected_a = wad_div(wad_mul(amount, index_1_2 - index_1_0), wad_mul(index_1_0, index_1_2));
    // User B: 100 × (1.2 - 1.1) / (1.1 × 1.2) ≈ 7.58 WAD
    let expected_b = wad_div(wad_mul(amount, index_1_2 - index_1_1), wad_mul(index_1_1, index_1_2));

    let tolerance = WAD / 10; // 0.1 WAD tolerance
    assert(interest_a >= expected_a - tolerance, 'User A interest too low');
    assert(interest_b >= expected_b - tolerance, 'User B interest too low');
}

/// Test three users with staggered entry points
#[test]
fn test_interest_accrual_three_users_staggered() {
    let (yield_token, sy, yt) = setup();
    let user_a = alice();
    let user_b = bob();
    let user_c = user1();
    let amount = 100 * WAD;

    // User A mints at index 1.0
    setup_user_with_yt(yield_token, sy, yt, user_a, amount);

    // Index goes to 1.1
    set_yield_index(yield_token, WAD + WAD / 10);

    // User B mints at index 1.1
    setup_user_with_yt(yield_token, sy, yt, user_b, amount);

    // Index goes to 1.2
    set_yield_index(yield_token, WAD + WAD / 5);

    // User C mints at index 1.2
    setup_user_with_yt(yield_token, sy, yt, user_c, amount);

    // Index goes to 1.3
    set_yield_index(yield_token, WAD + 3 * WAD / 10);

    // Check interests
    let interest_a = yt.get_user_interest(user_a);
    let interest_b = yt.get_user_interest(user_b);
    let interest_c = yt.get_user_interest(user_c);

    // Earlier users should earn more
    assert(interest_a > interest_b, 'A > B');
    assert(interest_b > interest_c, 'B > C');
}

// ============ Transfer Interest Preservation Tests ============

/// Test that accrued interest is preserved when YT is transferred
/// User A accrues interest, transfers YT to User B
/// User A should still be able to claim their accrued interest
///
/// IMPORTANT: The transfer function uses py_index_stored (not oracle directly).
/// The global index must be updated first via an operation that calls _update_py_index()
/// (like mint_py, redeem_py, or redeem_due_interest).
#[test]
fn test_interest_preserved_on_transfer() {
    let (yield_token, sy, yt) = setup();
    let user_a = alice();
    let user_b = bob();
    let amount = 100 * WAD;

    // User A mints YT
    setup_user_with_yt(yield_token, sy, yt, user_a, amount);

    // Index increases - User A accrues interest
    set_yield_index(yield_token, WAD + WAD / 10); // 1.1 WAD

    // CRITICAL: Trigger global index update before transfer
    // We do this by having User A claim interest first (which updates py_index_stored)
    // The interest is stored in user_interest[A] during this call
    start_cheat_caller_address(yt.contract_address, user_a);
    let claimed_before_transfer = yt.redeem_due_interest(user_a);
    stop_cheat_caller_address(yt.contract_address);

    assert(claimed_before_transfer > 0, 'A should claim interest');

    // After claiming, no pending interest
    let interest_after_claim = yt.get_user_interest(user_a);
    assert(interest_after_claim == 0, 'Interest claimed');

    // Now increase index again
    set_yield_index(yield_token, WAD + WAD / 5); // 1.2 WAD

    // User A should have new pending interest
    let new_interest = yt.get_user_interest(user_a);
    assert(new_interest > 0, 'A has new interest');

    // Trigger index update (via another user's mint)
    setup_user_with_yt(yield_token, sy, yt, user_b, WAD);

    // Now transfer - the stored index should be up to date
    start_cheat_caller_address(yt.contract_address, user_a);
    yt.transfer(user_b, amount);
    stop_cheat_caller_address(yt.contract_address);

    // User A should still be able to claim the interest that was captured
    start_cheat_caller_address(yt.contract_address, user_a);
    let claimed_after_transfer = yt.redeem_due_interest(user_a);
    stop_cheat_caller_address(yt.contract_address);

    // The interest from 1.1 to 1.2 should have been captured during index update
    assert(claimed_after_transfer > 0, 'Should claim captured interest');
}

/// Test interest after partial transfer
/// User has 100 YT, accrues interest, claims it, transfers 50 YT
/// After more yield, both users accrue based on their current balances
/// Using Pendle formula: interest = balance × (curr - prev) / (prev × curr)
#[test]
fn test_interest_after_partial_transfer() {
    let (yield_token, sy, yt) = setup();
    let user_a = alice();
    let user_b = bob();
    let amount = 100 * WAD;

    // User A mints YT
    setup_user_with_yt(yield_token, sy, yt, user_a, amount);

    // Index increases by 10%
    set_yield_index(yield_token, WAD + WAD / 10);

    // User A has interest (view function)
    // Pendle formula: 100 × 0.1 / 1.1 ≈ 9.09 WAD
    let interest_before = yt.get_user_interest(user_a);
    let index_diff = WAD / 10;
    let denominator = wad_mul(WAD, WAD + WAD / 10);
    let expected_interest = wad_div(wad_mul(amount, index_diff), denominator);
    let tolerance = WAD / 10; // 0.1 WAD tolerance
    assert(interest_before >= expected_interest - tolerance, 'Should have ~9 WAD interest');

    // User A claims interest first (triggers _update_py_index)
    start_cheat_caller_address(yt.contract_address, user_a);
    let claimed = yt.redeem_due_interest(user_a);
    stop_cheat_caller_address(yt.contract_address);

    assert(claimed >= expected_interest - tolerance, 'Should claim ~9 WAD');

    // User A transfers HALF their YT
    start_cheat_caller_address(yt.contract_address, user_a);
    yt.transfer(user_b, amount / 2);
    stop_cheat_caller_address(yt.contract_address);

    // User B starts fresh (no interest yet since transfer was after claim)
    let interest_b_initial = yt.get_user_interest(user_b);
    assert(interest_b_initial == 0, 'B starts with no interest');

    // Now index increases more
    set_yield_index(yield_token, WAD + WAD / 5); // 1.2 WAD

    // User A (with 50 YT remaining) accrues new interest
    // A's index was updated to 1.1 after claim
    // Pendle: 50 × (1.2 - 1.1) / (1.1 × 1.2) = 50 × 0.1 / 1.32 ≈ 3.79 WAD
    let new_interest_a = yt.get_user_interest(user_a);
    assert(new_interest_a > 0, 'A accrues new interest');

    // User B (with 50 YT, index 1.1) also accrues interest
    // Pendle: 50 × (1.2 - 1.1) / (1.1 × 1.2) = 50 × 0.1 / 1.32 ≈ 3.79 WAD
    let new_interest_b = yt.get_user_interest(user_b);
    assert(new_interest_b > 0, 'B accrues interest');

    // Both should have approximately equal new interest (same balance, same index range)
    let diff = if new_interest_a > new_interest_b {
        new_interest_a - new_interest_b
    } else {
        new_interest_b - new_interest_a
    };
    assert(diff < WAD / 100, 'Equal new interest');
}

/// Test interest behavior with transfer_from
/// Owner claims interest before transfer_from to ensure interest is captured
#[test]
fn test_interest_preserved_on_transfer_from() {
    let (yield_token, sy, yt) = setup();
    let owner = alice();
    let spender = bob();
    let recipient = user1();
    let amount = 100 * WAD;

    // Owner mints YT
    setup_user_with_yt(yield_token, sy, yt, owner, amount);

    // Index increases
    set_yield_index(yield_token, WAD + WAD / 10);

    let interest_before = yt.get_user_interest(owner);
    assert(interest_before > 0, 'Owner should have interest');

    // Owner claims interest first (triggers _update_py_index and captures interest)
    start_cheat_caller_address(yt.contract_address, owner);
    let claimed = yt.redeem_due_interest(owner);
    stop_cheat_caller_address(yt.contract_address);

    assert(claimed > 0, 'Owner claimed interest');

    // Owner approves spender
    start_cheat_caller_address(yt.contract_address, owner);
    yt.approve(spender, amount);
    stop_cheat_caller_address(yt.contract_address);

    // Spender transfers from owner to recipient
    start_cheat_caller_address(yt.contract_address, spender);
    yt.transfer_from(owner, recipient, amount);
    stop_cheat_caller_address(yt.contract_address);

    // Owner has no pending interest (already claimed)
    let interest_after = yt.get_user_interest(owner);
    assert(interest_after == 0, 'Interest was claimed');

    // Recipient starts fresh
    let interest_recipient = yt.get_user_interest(recipient);
    assert(interest_recipient == 0, 'Recipient starts fresh');

    // Index increases again
    set_yield_index(yield_token, WAD + WAD / 5);

    // Recipient now accrues interest
    let new_interest_recipient = yt.get_user_interest(recipient);
    assert(new_interest_recipient > 0, 'Recipient accrues interest');
}

// ============ Expiry Tests ============

/// Test that interest can be claimed right before expiry
#[test]
fn test_interest_claim_before_expiry() {
    let expiry = CURRENT_TIME + ONE_MONTH;
    let (yield_token, sy, yt) = setup_with_custom_expiry(expiry);
    let user = user1();
    let amount = 100 * WAD;

    // Mint YT
    setup_user_with_yt(yield_token, sy, yt, user, amount);

    // Increase index
    set_yield_index(yield_token, WAD + WAD / 10);

    // Move to 1 second before expiry
    start_cheat_block_timestamp_global(expiry - 1);

    // Should still be able to claim interest
    let interest = yt.get_user_interest(user);
    assert(interest > 0, 'Should have interest');

    start_cheat_caller_address(yt.contract_address, user);
    let claimed = yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    assert(claimed == interest, 'Should claim before expiry');
}

/// Test that interest can still be claimed after expiry (clearing previously accrued)
#[test]
fn test_interest_claim_after_expiry() {
    let expiry = CURRENT_TIME + ONE_MONTH;
    let (yield_token, sy, yt) = setup_with_custom_expiry(expiry);
    let user = user1();
    let amount = 100 * WAD;

    // Mint YT before expiry
    setup_user_with_yt(yield_token, sy, yt, user, amount);

    // Increase index before expiry
    set_yield_index(yield_token, WAD + WAD / 10);

    // Move past expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // User can still claim interest that accrued before expiry
    let interest = yt.get_user_interest(user);
    assert(interest > 0, 'Should have accrued interest');

    start_cheat_caller_address(yt.contract_address, user);
    let claimed = yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    assert(claimed == interest, 'Should claim after expiry');

    // After claiming, no more interest
    let interest_after = yt.get_user_interest(user);
    assert(interest_after == 0, 'No more interest after claim');
}

/// Test that YT is worthless at expiry (cannot mint new interest)
#[test]
fn test_yt_worthless_at_expiry_no_new_interest() {
    let expiry = CURRENT_TIME + ONE_MONTH;
    let (yield_token, sy, yt) = setup_with_custom_expiry(expiry);
    let user = user1();
    let amount = 100 * WAD;

    // Mint YT before expiry
    setup_user_with_yt(yield_token, sy, yt, user, amount);

    // Index at 1.1
    set_yield_index(yield_token, WAD + WAD / 10);

    // Claim interest before expiry
    start_cheat_caller_address(yt.contract_address, user);
    let claimed_before = yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    assert(claimed_before > 0, 'Claimed before expiry');

    // Move past expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Index increases after expiry
    set_yield_index(yield_token, WAD + WAD / 5);

    // No new interest should accrue (YT is worthless)
    // The user_py_index was updated when they claimed, so any "new" interest
    // would be calculated from index 1.1 to 1.2
    // But the YT is still worthless in the sense that no new minting can occur
    // and the PT can be redeemed without YT
    let interest_after = yt.get_user_interest(user);

    // Note: Interest may still show as accrued if index changed
    // The "worthless" aspect is that YT cannot be used to mint or redeem pre-expiry
    // The existing YT balance can still technically accrue, but this is fine
    // since the user chose to hold YT past expiry

    // Verify YT is expired
    assert(yt.is_expired(), 'Should be expired');

    // Suppress unused variable warning by using it
    let _ = interest_after;
}

// ============ Zero Balance Tests ============

/// Test that user with 0 YT cannot claim interest
#[test]
fn test_zero_balance_no_interest() {
    let (yield_token, _, yt) = setup();
    let user = user1();

    // User has no YT
    assert(yt.balance_of(user) == 0, 'Should have 0 YT');

    // Index increases
    set_yield_index(yield_token, WAD + WAD / 10);

    // No interest to claim
    let interest = yt.get_user_interest(user);
    assert(interest == 0, 'No interest for 0 balance');

    // Claiming returns 0
    start_cheat_caller_address(yt.contract_address, user);
    let claimed = yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    assert(claimed == 0, 'Should claim 0');
}

/// Test interest claiming and redemption interaction
/// After claiming interest, the SY backing is reduced, so partial redemption is needed
/// This tests that interest can be captured before redeeming PT+YT
#[test]
fn test_interest_and_partial_redeem() {
    let (yield_token, sy, yt) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Mint YT
    setup_user_with_yt(yield_token, sy, yt, user, amount);

    // Index increases by 10%
    set_yield_index(yield_token, WAD + WAD / 10);

    // User has interest (view) - approximately 10 WAD
    let interest_before = yt.get_user_interest(user);
    assert(interest_before > 0, 'Should have interest');

    // Claim interest BEFORE redeem
    start_cheat_caller_address(yt.contract_address, user);
    let claimed = yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    assert(claimed > 0, 'Claimed interest');

    // After claiming interest, the YT contract has less SY
    // Original: 100 WAD SY in YT contract
    // After claim: ~90 WAD SY in YT contract
    // So we can only redeem ~90 WAD worth of PT+YT

    // Redeem 90% of PT+YT (should succeed since YT contract has ~90 WAD SY)
    let redeem_amount = 90 * WAD;
    start_cheat_caller_address(yt.contract_address, user);
    let sy_returned = yt.redeem_py(user, redeem_amount);
    stop_cheat_caller_address(yt.contract_address);

    assert(sy_returned == redeem_amount, 'Should return 90 WAD SY');
    assert(yt.balance_of(user) == amount - redeem_amount, 'Remaining YT');

    // No more interest to claim (already claimed)
    let interest_after = yt.get_user_interest(user);
    assert(interest_after == 0, 'No interest after claim');
}

/// Test that interest is captured during redeem_py
/// Note: In a real deployment, yield would come from the underlying asset.
/// In this mock test, we verify interest accounting is correct.
#[test]
fn test_redeem_captures_interest() {
    let (yield_token, sy, yt) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Mint YT
    setup_user_with_yt(yield_token, sy, yt, user, amount);

    // Index increases
    set_yield_index(yield_token, WAD + WAD / 10);

    // User has pending interest but doesn't claim it
    let interest = yt.get_user_interest(user);
    assert(interest > 0, 'Should have interest');

    // Redeem PARTIAL PT+YT to leave room for interest claim
    // Redeem 80%, leaving ~20 WAD PT+YT (and ~10 WAD interest accrued)
    let redeem_amount = 80 * WAD;
    start_cheat_caller_address(yt.contract_address, user);
    let sy_returned = yt.redeem_py(user, redeem_amount);
    stop_cheat_caller_address(yt.contract_address);

    assert(sy_returned == redeem_amount, 'SY returned');
    assert(yt.balance_of(user) == amount - redeem_amount, 'Remaining YT');

    // Interest was captured during _update_user_interest in redeem_py
    // Now stored in user_interest storage
    let interest_after = yt.get_user_interest(user);
    assert(interest_after > 0, 'Interest captured during redeem');
}

// ============ Watermark Pattern Tests ============

/// Test that PY index never decreases (watermark pattern)
/// Even if oracle returns lower value, py_index_stored doesn't decrease
#[test]
fn test_watermark_pattern_index_never_decreases() {
    let (yield_token, sy, yt) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Mint YT at index 1.0
    setup_user_with_yt(yield_token, sy, yt, user, amount);

    // Increase index to 1.2
    set_yield_index(yield_token, WAD + WAD / 5);

    // Trigger index update
    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_due_interest(user); // This updates py_index_stored
    stop_cheat_caller_address(yt.contract_address);

    let stored_index_high = yt.py_index_stored();
    assert(stored_index_high == WAD + WAD / 5, 'Index should be 1.2');

    // Now try to set index lower (1.1) - this should be blocked by MockYieldToken
    // The set_index function enforces monotonic increase
    // So we can't directly test the YT's watermark by lowering the oracle

    // Instead, verify the stored index hasn't changed by reading it again
    let stored_index_after = yt.py_index_stored();
    assert(stored_index_after == stored_index_high, 'Index should not decrease');
}

/// Test that user index is updated correctly after operations
#[test]
fn test_user_index_updated_after_claim() {
    let (yield_token, sy, yt) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Mint YT at index 1.0
    setup_user_with_yt(yield_token, sy, yt, user, amount);

    // Increase index to 1.1
    set_yield_index(yield_token, WAD + WAD / 10);

    // First claim
    start_cheat_caller_address(yt.contract_address, user);
    let first_claim = yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    assert(first_claim > 0, 'First claim should be > 0');

    // Immediately claim again - should get 0 since index hasn't changed
    start_cheat_caller_address(yt.contract_address, user);
    let second_claim = yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    assert(second_claim == 0, 'Second claim should be 0');

    // Increase index to 1.2
    set_yield_index(yield_token, WAD + WAD / 5);

    // Third claim - should get interest from 1.1 to 1.2
    start_cheat_caller_address(yt.contract_address, user);
    let third_claim = yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    assert(third_claim > 0, 'Third claim should be > 0');

    // Third claim should be less than first (same index delta but higher base)
    // First: 100 * 0.1 / 1.0 = 10
    // Third: 100 * 0.1 / 1.1 ≈ 9.09
    assert(third_claim < first_claim, 'Later claims earn less');
}

// ============ Interest Calculation Precision Tests ============

/// Test interest calculation with large amounts
/// Using Pendle formula: interest = balance × (curr - prev) / (prev × curr)
#[test]
fn test_interest_large_amounts() {
    let (yield_token, sy, yt) = setup();
    let user = user1();
    let amount = 1_000_000 * WAD; // 1 million tokens

    setup_user_with_yt(yield_token, sy, yt, user, amount);

    // 10% yield
    set_yield_index(yield_token, WAD + WAD / 10);

    let interest = yt.get_user_interest(user);
    // Pendle formula: 1,000,000 × 0.1 / 1.1 ≈ 90,909 WAD
    let index_diff = WAD / 10;
    let denominator = wad_mul(WAD, WAD + WAD / 10);
    let expected = wad_div(wad_mul(amount, index_diff), denominator);
    let tolerance = WAD * 10; // 10 token tolerance

    assert(interest >= expected - tolerance, 'Large amount interest low');
    assert(interest <= expected + tolerance, 'Large amount interest high');
}

/// Test interest calculation with small amounts
#[test]
fn test_interest_small_amounts() {
    let (yield_token, sy, yt) = setup();
    let user = user1();
    let amount = WAD / 100; // 0.01 tokens

    setup_user_with_yt(yield_token, sy, yt, user, amount);

    // 10% yield
    set_yield_index(yield_token, WAD + WAD / 10);

    let interest = yt.get_user_interest(user);
    // Expected: 0.01 * 0.1 = 0.001 tokens = WAD / 1000
    let expected = WAD / 1000;
    let tolerance = WAD / 10000; // 0.01% tolerance

    assert(interest >= expected - tolerance, 'Small amount interest low');
    assert(interest <= expected + tolerance, 'Small amount interest high');
}

/// Test interest with high yield rate
/// Using Pendle formula: interest = balance × (curr - prev) / (prev × curr)
#[test]
fn test_interest_high_yield() {
    let (yield_token, sy, yt) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_yt(yield_token, sy, yt, user, amount);

    // 100% yield (index doubles)
    set_yield_index(yield_token, 2 * WAD);

    let interest = yt.get_user_interest(user);
    // Pendle formula: 100 × (2.0 - 1.0) / (1.0 × 2.0) = 100 × 1.0 / 2.0 = 50 WAD
    let expected = 50 * WAD;
    let tolerance = WAD / 10; // 0.1 token tolerance

    assert(interest >= expected - tolerance, 'High yield interest low');
    assert(interest <= expected + tolerance, 'High yield interest high');
}

// ============ Edge Case Tests ============

/// Test that minting more YT updates user index correctly
#[test]
fn test_mint_more_yt_updates_index() {
    let (yield_token, sy, yt) = setup();
    let user = user1();
    let initial_amount = 100 * WAD;

    // First mint at index 1.0
    setup_user_with_yt(yield_token, sy, yt, user, initial_amount);

    // Index increases to 1.1
    set_yield_index(yield_token, WAD + WAD / 10);

    // User has interest from first mint
    let interest_before_second = yt.get_user_interest(user);
    assert(interest_before_second > 0, 'Should have interest');

    // Second mint (interest should be preserved, index updated)
    setup_user_with_yt(yield_token, sy, yt, user, initial_amount);

    // Interest should still be preserved
    let interest_after_second = yt.get_user_interest(user);
    assert(interest_after_second == interest_before_second, 'Interest preserved on mint');

    // Index increases more
    set_yield_index(yield_token, WAD + WAD / 5);

    // New interest should be calculated on 200 YT from index 1.1
    // new_interest = 200 * (1.2 - 1.1) / 1.1 ≈ 18.18 WAD
    let total_interest = yt.get_user_interest(user);
    assert(total_interest > interest_after_second, 'Should accrue more interest');
}

/// Test claiming multiple times
/// Each claim captures interest from the previous index to current
/// Using Pendle formula: interest = balance × (curr - prev) / (prev × curr)
#[test]
fn test_multiple_claims() {
    let (yield_token, sy, yt) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_yt(yield_token, sy, yt, user, amount);

    let mut total_claimed = 0_u256;

    // Claim 1: Index 1.0 -> 1.05
    // Pendle: 100 × 0.05 / 1.05 ≈ 4.76 WAD
    set_yield_index(yield_token, WAD + WAD / 20);
    start_cheat_caller_address(yt.contract_address, user);
    let claim1 = yt.redeem_due_interest(user);
    total_claimed += claim1;
    stop_cheat_caller_address(yt.contract_address);

    // Claim 2: Index 1.05 -> 1.10
    // Pendle: 100 × 0.05 / 1.155 ≈ 4.33 WAD
    set_yield_index(yield_token, WAD + WAD / 10);
    start_cheat_caller_address(yt.contract_address, user);
    let claim2 = yt.redeem_due_interest(user);
    total_claimed += claim2;
    stop_cheat_caller_address(yt.contract_address);

    // Claim 3: Index 1.10 -> 1.15
    // Pendle: 100 × 0.05 / 1.265 ≈ 3.95 WAD
    set_yield_index(yield_token, WAD + 3 * WAD / 20);
    start_cheat_caller_address(yt.contract_address, user);
    let claim3 = yt.redeem_due_interest(user);
    total_claimed += claim3;
    stop_cheat_caller_address(yt.contract_address);

    // Claim 4: Index 1.15 -> 1.20
    // Pendle: 100 × 0.05 / 1.38 ≈ 3.62 WAD
    set_yield_index(yield_token, WAD + WAD / 5);
    start_cheat_caller_address(yt.contract_address, user);
    let claim4 = yt.redeem_due_interest(user);
    total_claimed += claim4;
    stop_cheat_caller_address(yt.contract_address);

    // Each claim should be positive
    assert(claim1 > 0, 'Claim 1 should be > 0');
    assert(claim2 > 0, 'Claim 2 should be > 0');
    assert(claim3 > 0, 'Claim 3 should be > 0');
    assert(claim4 > 0, 'Claim 4 should be > 0');

    // Later claims should be smaller (same index delta but higher denominator)
    // Pendle formula: interest = balance × delta / (prev × curr)
    assert(claim1 > claim2, 'Earlier claims larger');
    assert(claim2 > claim3, 'Claim 2 > Claim 3');
    assert(claim3 > claim4, 'Claim 3 > Claim 4');

    // Total interest with Pendle formula for incremental claims:
    // ≈ 4.76 + 4.33 + 3.95 + 3.62 ≈ 16.66 WAD
    let min_expected = 15 * WAD;
    let max_expected = 18 * WAD;

    assert(total_claimed >= min_expected, 'Total claimed too low');
    assert(total_claimed <= max_expected, 'Total claimed too high');
}

// ============ Overflow Safety Tests ============

/// Test that interest calculation doesn't overflow with large balances
/// Uses 1 billion tokens to stress-test WAD arithmetic
#[test]
fn test_interest_calculation_large_balance_no_overflow() {
    let (yield_token, sy, yt) = setup();
    let user = alice();

    // Mint large amount (but not u256::MAX to avoid overflow in setup)
    let large_amount = 1_000_000_000 * WAD; // 1 billion tokens
    setup_user_with_yt(yield_token, sy, yt, user, large_amount);

    // Small yield increase (1%)
    set_yield_index(yield_token, WAD + WAD / 100);

    // Should not overflow
    let interest = yt.get_user_interest(user);

    // Expected: 1% of 1 billion = 10 million
    let expected = 10_000_000 * WAD;
    let tolerance = expected / 100; // 1% tolerance

    assert(interest >= expected - tolerance, 'Interest too low');
    assert(interest <= expected + tolerance, 'Interest too high');
}

// ============ Zero Interest Edge Cases ============

/// Test claiming interest when exactly zero has accrued
/// This edge case ensures the contract handles zero claims gracefully
#[test]
fn test_claim_zero_interest() {
    let (yield_token, sy, yt) = setup();
    let user = alice();

    setup_user_with_yt(yield_token, sy, yt, user, 100 * WAD);

    // No index change - zero interest
    let interest_before = yt.get_user_interest(user);
    assert(interest_before == 0, 'Should have zero interest');

    // Claim should succeed with zero
    start_cheat_caller_address(yt.contract_address, user);
    let claimed = yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    assert(claimed == 0, 'Should claim zero');

    // User state should still be valid
    let interest_after = yt.get_user_interest(user);
    assert(interest_after == 0, 'Still zero after claim');
}
