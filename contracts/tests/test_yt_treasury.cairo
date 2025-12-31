/// Tests for YT Post-Expiry Treasury functionality
///
/// This module tests the post-expiry yield redirection mechanism:
/// - After YT expiry, any yield that accrues on the underlying SY is captured for treasury
/// - This prevents "orphaned" yield from being locked forever
/// - Treasury can claim this accumulated interest via admin function

use horizon::interfaces::i_sy::ISYDispatcherTrait;
use horizon::interfaces::i_yt::{IYTAdminDispatcher, IYTAdminDispatcherTrait, IYTDispatcherTrait};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_yield_token::IMockYieldTokenDispatcherTrait;
use snforge_std::{
    start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address,
};

// Import test utilities
use super::utils::{
    CURRENT_TIME, ONE_MONTH, ONE_YEAR, admin, mint_and_mint_py, set_yield_index,
    setup_full_with_expiry, treasury, user1,
};

// ============================================================================
// View Function Tests
// ============================================================================

#[test]
fn test_treasury_view_returns_correct_address() {
    let (_, _, _, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);
    assert(yt.treasury() == treasury(), 'Wrong treasury address');
}

#[test]
fn test_get_post_expiry_treasury_interest_zero_before_expiry() {
    let (_, yield_token, sy, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);

    // Mint some YT
    mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);

    // Increase yield by 10%
    set_yield_index(yield_token, WAD + WAD / 10);

    // Before expiry, treasury interest should be 0
    let interest = yt.get_post_expiry_treasury_interest();
    assert(interest == 0, 'Should be 0 before expiry');
}

#[test]
fn test_get_post_expiry_treasury_interest_zero_at_expiry_no_growth() {
    let expiry = CURRENT_TIME + ONE_MONTH;
    let (_, yield_token, sy, yt) = setup_full_with_expiry(expiry);

    // Mint some YT
    mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);

    // Move to expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Trigger expiry index capture by calling a state-changing function
    start_cheat_caller_address(yt.contract_address, user1());
    yt.redeem_due_interest(user1());
    stop_cheat_caller_address(yt.contract_address);

    // No yield growth after expiry means no treasury interest
    let interest = yt.get_post_expiry_treasury_interest();
    assert(interest == 0, 'Should be 0 with no growth');
}

#[test]
fn test_get_post_expiry_treasury_interest_calculates_correctly() {
    let expiry = CURRENT_TIME + ONE_MONTH;
    let (_, yield_token, sy, yt) = setup_full_with_expiry(expiry);

    // Disable time-based yield first to ensure expiry index is exactly 1.0 WAD
    // (MockYieldToken has 5% APR default which would add ~0.4% over 30 days)
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.set_yield_rate_bps(0);
    stop_cheat_caller_address(yield_token.contract_address);

    // Mint 100 YT at 1.0 index
    let (_, yt_amount) = mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);
    assert(yt_amount == 100 * WAD, 'Wrong YT amount');

    // Move to expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Trigger expiry index capture by calling a state-changing function
    // With time-based yield disabled, expiry index should be exactly 1.0 WAD
    start_cheat_caller_address(yt.contract_address, user1());
    yt.redeem_due_interest(user1());
    stop_cheat_caller_address(yt.contract_address);

    // Increase yield by 10% post-expiry (matching redemption test approach)
    let new_index = WAD + WAD / 10;
    set_yield_index(yield_token, new_index);

    // There should now be non-zero treasury interest
    let actual_interest = yt.get_post_expiry_treasury_interest();
    assert(actual_interest > 0, 'Should have interest');

    // The interest should be approximately 10% of total YT supply
    // Formula: total_yt × (current - expiry) / expiry
    // = 100 WAD × (1.1 WAD - 1.0 WAD) / 1.0 WAD = 100 WAD × 0.1 = 10 WAD
    let expected_interest = 10 * WAD;
    let diff = if actual_interest > expected_interest {
        actual_interest - expected_interest
    } else {
        expected_interest - actual_interest
    };
    // Allow 0.1% tolerance (same as redemption test)
    assert(diff < WAD / 1000, 'Wrong treasury interest calc');
}

// ============================================================================
// Redemption Tests
// ============================================================================

#[test]
fn test_redeem_post_expiry_interest_for_treasury_success() {
    let expiry = CURRENT_TIME + ONE_MONTH;
    let (_, yield_token, sy, yt) = setup_full_with_expiry(expiry);

    // Disable time-based yield first to ensure expiry index is exactly 1.0 WAD
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.set_yield_rate_bps(0);
    stop_cheat_caller_address(yield_token.contract_address);

    // Mint 100 YT at 1.0 index
    mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);

    // Move to expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Trigger expiry index capture by claiming interest (calls _update_py_index)
    // With time-based yield disabled, expiry index should be exactly 1.0 WAD
    start_cheat_caller_address(yt.contract_address, user1());
    yt.redeem_due_interest(user1());
    stop_cheat_caller_address(yt.contract_address);

    // Increase yield by 10% post-expiry
    let new_index = WAD + WAD / 10;
    set_yield_index(yield_token, new_index);

    // Get treasury's initial SY balance
    let initial_balance = sy.balance_of(treasury());

    // Redeem as admin
    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    let redeemed = yt_admin.redeem_post_expiry_interest_for_treasury();
    stop_cheat_caller_address(yt.contract_address);

    // Verify treasury received SY
    let final_balance = sy.balance_of(treasury());
    assert(final_balance > initial_balance, 'Treasury should receive SY');
    assert(redeemed > 0, 'Should have redeemed interest');

    // Verify the amount is approximately correct (10 SY)
    let expected = 10 * WAD;
    let diff = if redeemed > expected {
        redeemed - expected
    } else {
        expected - redeemed
    };
    assert(diff < WAD / 1000, 'Wrong redemption amount');
}

#[test]
fn test_redeem_post_expiry_interest_multiple_claims() {
    let expiry = CURRENT_TIME + ONE_MONTH;
    let (_, yield_token, sy, yt) = setup_full_with_expiry(expiry);

    // Mint 100 YT at 1.0 index
    mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);

    // Move to expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Trigger expiry index capture by claiming interest
    start_cheat_caller_address(yt.contract_address, user1());
    yt.redeem_due_interest(user1());
    stop_cheat_caller_address(yt.contract_address);

    // Increase yield by 10% post-expiry
    set_yield_index(yield_token, WAD + WAD / 10);

    // First claim
    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    let first_claim = yt_admin.redeem_post_expiry_interest_for_treasury();
    stop_cheat_caller_address(yt.contract_address);

    assert(first_claim > 0, 'First claim should be positive');

    // Second claim with same index should return 0
    start_cheat_caller_address(yt.contract_address, admin());
    let second_claim = yt_admin.redeem_post_expiry_interest_for_treasury();
    stop_cheat_caller_address(yt.contract_address);

    assert(second_claim == 0, 'Second claim should be 0');

    // Increase yield by another 10%
    set_yield_index(yield_token, WAD + WAD / 5); // 1.2 total

    // Third claim should capture the new yield
    start_cheat_caller_address(yt.contract_address, admin());
    let third_claim = yt_admin.redeem_post_expiry_interest_for_treasury();
    stop_cheat_caller_address(yt.contract_address);

    assert(third_claim > 0, 'Third claim should be positive');
}

#[test]
fn test_redeem_post_expiry_interest_zero_when_no_growth() {
    let expiry = CURRENT_TIME + ONE_MONTH;
    let (_, yield_token, sy, yt) = setup_full_with_expiry(expiry);

    // Mint 100 YT
    mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);

    // Move to expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Trigger expiry index capture by claiming interest
    start_cheat_caller_address(yt.contract_address, user1());
    yt.redeem_due_interest(user1());
    stop_cheat_caller_address(yt.contract_address);

    // No post-expiry yield growth

    // Redeem as admin
    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    let redeemed = yt_admin.redeem_post_expiry_interest_for_treasury();
    stop_cheat_caller_address(yt.contract_address);

    assert(redeemed == 0, 'Should return 0 with no growth');
}

// ============================================================================
// Access Control Tests
// ============================================================================

#[test]
#[should_panic(expected: 'Caller is missing role')]
fn test_redeem_post_expiry_interest_non_admin_reverts() {
    let expiry = CURRENT_TIME + ONE_MONTH;
    let (_, yield_token, sy, yt) = setup_full_with_expiry(expiry);

    // Mint some YT
    mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);

    // Move to expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Try to redeem as non-admin
    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, user1());
    yt_admin.redeem_post_expiry_interest_for_treasury();
    // Should panic
}

#[test]
#[should_panic(expected: 'HZN: not expired')]
fn test_redeem_post_expiry_interest_before_expiry_reverts() {
    let expiry = CURRENT_TIME + ONE_YEAR;
    let (_, yield_token, sy, yt) = setup_full_with_expiry(expiry);

    // Mint some YT
    mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);

    // Stay before expiry and try to redeem
    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    yt_admin.redeem_post_expiry_interest_for_treasury();
    // Should panic
}

// ============================================================================
// Edge Case Tests
// ============================================================================

#[test]
fn test_post_expiry_interest_with_zero_yt_supply() {
    let expiry = CURRENT_TIME + ONE_MONTH;
    let (_, _, _, yt) = setup_full_with_expiry(expiry);

    // Don't mint any YT

    // Move to expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // No YT minted means no interest
    let interest = yt.get_post_expiry_treasury_interest();
    assert(interest == 0, 'Should be 0 with no YT');
}

#[test]
fn test_post_expiry_interest_updates_sy_reserve() {
    let expiry = CURRENT_TIME + ONE_MONTH;
    let (_, yield_token, sy, yt) = setup_full_with_expiry(expiry);

    // Mint 100 YT
    mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);

    // Move to expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Trigger expiry index capture by claiming interest
    start_cheat_caller_address(yt.contract_address, user1());
    yt.redeem_due_interest(user1());
    stop_cheat_caller_address(yt.contract_address);

    // Get the expiry index and increase yield by 10% post-expiry
    let expiry_index = yt.py_index_current();
    set_yield_index(yield_token, expiry_index + expiry_index / 10);

    // Get reserve AFTER expiry capture but BEFORE treasury claim
    let initial_reserve = yt.sy_reserve();

    // Redeem treasury interest
    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    let redeemed = yt_admin.redeem_post_expiry_interest_for_treasury();
    stop_cheat_caller_address(yt.contract_address);

    assert(redeemed > 0, 'Should have redeemed interest');

    // Verify sy_reserve was updated
    let final_reserve = yt.sy_reserve();
    assert(final_reserve == initial_reserve - redeemed, 'sy_reserve not updated');
}
