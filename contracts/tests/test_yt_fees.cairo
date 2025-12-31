/// Tests for YT Protocol Fee on Interest functionality
///
/// This module tests the protocol fee mechanism for interest claims:
/// - Admin can set fee rate (WAD-scaled, max 50%)
/// - Fee is deducted from interest claims and sent to treasury
/// - Fee rate changes emit events

use horizon::interfaces::i_sy::ISYDispatcherTrait;
use horizon::interfaces::i_yt::{IYTAdminDispatcher, IYTAdminDispatcherTrait, IYTDispatcherTrait};
use horizon::libraries::math::WAD;
use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};

// Import test utilities
use super::utils::{
    CURRENT_TIME, ONE_YEAR, admin, mint_and_mint_py, set_yield_index, setup_full_with_expiry,
    treasury, user1,
};

// Fee rate constants for testing
const FEE_3_PERCENT: u256 = 30000000000000000; // 0.03e18 = 3%
const FEE_10_PERCENT: u256 = 100000000000000000; // 0.10e18 = 10%
const FEE_50_PERCENT: u256 = 500000000000000000; // 0.50e18 = 50% (max allowed)
const FEE_51_PERCENT: u256 = 510000000000000000; // 0.51e18 = 51% (exceeds max)

// ============================================================================
// View Function Tests
// ============================================================================

#[test]
fn test_interest_fee_rate_default_zero() {
    let (_, _, _, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);
    assert(yt.interest_fee_rate() == 0, 'Default fee should be 0');
}

#[test]
fn test_interest_fee_rate_returns_set_value() {
    let (_, _, _, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);

    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    yt_admin.set_interest_fee_rate(FEE_3_PERCENT);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.interest_fee_rate() == FEE_3_PERCENT, 'Wrong fee rate');
}

// ============================================================================
// Set Fee Rate Tests
// ============================================================================

#[test]
fn test_set_interest_fee_rate_success() {
    let (_, _, _, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);

    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    yt_admin.set_interest_fee_rate(FEE_10_PERCENT);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.interest_fee_rate() == FEE_10_PERCENT, 'Fee not set correctly');
}

#[test]
fn test_set_interest_fee_rate_max_allowed() {
    let (_, _, _, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);

    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    yt_admin.set_interest_fee_rate(FEE_50_PERCENT);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.interest_fee_rate() == FEE_50_PERCENT, 'Max fee not set');
}

#[test]
fn test_set_interest_fee_rate_zero() {
    let (_, _, _, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);

    // First set a fee
    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    yt_admin.set_interest_fee_rate(FEE_10_PERCENT);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.interest_fee_rate() == FEE_10_PERCENT, 'Fee not set');

    // Then set to zero
    start_cheat_caller_address(yt.contract_address, admin());
    yt_admin.set_interest_fee_rate(0);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.interest_fee_rate() == 0, 'Fee should be 0');
}

#[test]
#[should_panic(expected: 'HZN: invalid fee rate')]
fn test_set_interest_fee_rate_exceeds_max_reverts() {
    let (_, _, _, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);

    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    yt_admin.set_interest_fee_rate(FEE_51_PERCENT);
    // Should panic
}

#[test]
#[should_panic(expected: 'Caller is missing role')]
fn test_set_interest_fee_rate_non_admin_reverts() {
    let (_, _, _, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);

    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, user1());
    yt_admin.set_interest_fee_rate(FEE_3_PERCENT);
    // Should panic
}

// ============================================================================
// Interest Claim with Fee Tests
// ============================================================================

#[test]
fn test_redeem_interest_with_fee_deducts_correctly() {
    let (_, yield_token, sy, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);

    // Set 3% fee
    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    yt_admin.set_interest_fee_rate(FEE_3_PERCENT);
    stop_cheat_caller_address(yt.contract_address);

    // Mint 100 YT at 1.0 index
    mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);

    // Increase yield by 10% (user should earn ~9.09 SY with Pendle formula)
    set_yield_index(yield_token, WAD + WAD / 10);

    // Get initial balances
    let user_initial = sy.balance_of(user1());
    let treasury_initial = sy.balance_of(treasury());

    // Claim interest
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed = yt.redeem_due_interest(user1());
    stop_cheat_caller_address(yt.contract_address);

    // Verify user received interest minus fee
    let user_final = sy.balance_of(user1());
    let user_received = user_final - user_initial;
    assert(user_received == claimed, 'Claimed amount mismatch');

    // Verify treasury received fee
    let treasury_final = sy.balance_of(treasury());
    let treasury_received = treasury_final - treasury_initial;
    assert(treasury_received > 0, 'Treasury should receive fee');

    // The fee should be approximately 3% of total interest
    // Total interest ~9.09 SY, fee ~0.27 SY, user gets ~8.82 SY
    // Let's verify the ratio: treasury / (user + treasury) should be ~3%
    let total = user_received + treasury_received;
    // fee_ratio = treasury_received * WAD / total should be ~0.03 WAD
    let fee_ratio = treasury_received * WAD / total;
    let diff = if fee_ratio > FEE_3_PERCENT {
        fee_ratio - FEE_3_PERCENT
    } else {
        FEE_3_PERCENT - fee_ratio
    };
    // Allow 0.1% tolerance
    assert(diff < WAD / 1000, 'Wrong fee ratio');
}

#[test]
fn test_redeem_interest_with_zero_fee() {
    let (_, yield_token, sy, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);

    // Fee is 0 by default

    // Mint 100 YT at 1.0 index
    mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);

    // Increase yield by 10%
    set_yield_index(yield_token, WAD + WAD / 10);

    // Get initial balances
    let user_initial = sy.balance_of(user1());
    let treasury_initial = sy.balance_of(treasury());

    // Claim interest
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed = yt.redeem_due_interest(user1());
    stop_cheat_caller_address(yt.contract_address);

    // Verify user received full interest
    let user_final = sy.balance_of(user1());
    let user_received = user_final - user_initial;
    assert(user_received == claimed, 'Claimed amount mismatch');
    assert(claimed > 0, 'Should have claimed interest');

    // Verify treasury received nothing
    let treasury_final = sy.balance_of(treasury());
    assert(treasury_final == treasury_initial, 'Treasury should get nothing');
}

#[test]
fn test_redeem_interest_with_max_fee() {
    let (_, yield_token, sy, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);

    // Set 50% fee (max)
    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    yt_admin.set_interest_fee_rate(FEE_50_PERCENT);
    stop_cheat_caller_address(yt.contract_address);

    // Mint 100 YT at 1.0 index
    mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);

    // Increase yield by 10%
    set_yield_index(yield_token, WAD + WAD / 10);

    // Get initial balances
    let user_initial = sy.balance_of(user1());
    let treasury_initial = sy.balance_of(treasury());

    // Claim interest
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed = yt.redeem_due_interest(user1());
    stop_cheat_caller_address(yt.contract_address);

    // Verify user received half of interest
    let user_final = sy.balance_of(user1());
    let user_received = user_final - user_initial;
    assert(user_received == claimed, 'Claimed amount mismatch');

    // Verify treasury received the other half
    let treasury_final = sy.balance_of(treasury());
    let treasury_received = treasury_final - treasury_initial;

    // User and treasury should receive approximately equal amounts
    let diff = if user_received > treasury_received {
        user_received - treasury_received
    } else {
        treasury_received - user_received
    };
    // Allow 0.1% tolerance
    assert(diff < WAD / 1000, 'Should be 50/50 split');
}

#[test]
fn test_redeem_interest_fee_updates_sy_reserve() {
    let (_, yield_token, sy, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);

    // Set 10% fee
    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    yt_admin.set_interest_fee_rate(FEE_10_PERCENT);
    stop_cheat_caller_address(yt.contract_address);

    // Mint 100 YT
    mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);

    // Increase yield by 10%
    set_yield_index(yield_token, WAD + WAD / 10);

    // Get initial reserve
    let initial_reserve = yt.sy_reserve();

    // Claim interest
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed = yt.redeem_due_interest(user1());
    stop_cheat_caller_address(yt.contract_address);

    // Get treasury's received amount
    let treasury_received = sy.balance_of(treasury());

    // Total outflow = claimed (user) + treasury_received (fee)
    let total_outflow = claimed + treasury_received;

    // Verify sy_reserve was updated correctly
    let final_reserve = yt.sy_reserve();
    assert(final_reserve == initial_reserve - total_outflow, 'sy_reserve not updated');
}

// ============================================================================
// Edge Case Tests
// ============================================================================

#[test]
fn test_redeem_zero_interest_with_fee_set() {
    let (_, yield_token, sy, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);

    // Set 10% fee
    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    yt_admin.set_interest_fee_rate(FEE_10_PERCENT);
    stop_cheat_caller_address(yt.contract_address);

    // Mint YT but don't increase yield
    mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);

    // Get initial balances
    let user_initial = sy.balance_of(user1());
    let treasury_initial = sy.balance_of(treasury());

    // Claim interest (should be 0)
    start_cheat_caller_address(yt.contract_address, user1());
    let claimed = yt.redeem_due_interest(user1());
    stop_cheat_caller_address(yt.contract_address);

    // Verify nothing was transferred
    assert(claimed == 0, 'Should claim 0');
    assert(sy.balance_of(user1()) == user_initial, 'User balance changed');
    assert(sy.balance_of(treasury()) == treasury_initial, 'Treasury balance changed');
}

#[test]
fn test_fee_change_applies_to_next_claim() {
    let (_, yield_token, sy, yt) = setup_full_with_expiry(CURRENT_TIME + ONE_YEAR);

    // Mint 100 YT
    mint_and_mint_py(yield_token, sy, yt, user1(), 100 * WAD);

    // Increase yield by 10%
    set_yield_index(yield_token, WAD + WAD / 10);

    // First claim with 0% fee
    start_cheat_caller_address(yt.contract_address, user1());
    let _first_claim = yt.redeem_due_interest(user1());
    stop_cheat_caller_address(yt.contract_address);

    let treasury_after_first = sy.balance_of(treasury());
    assert(treasury_after_first == 0, 'Treasury should be 0');

    // Set 10% fee
    let yt_admin = IYTAdminDispatcher { contract_address: yt.contract_address };
    start_cheat_caller_address(yt.contract_address, admin());
    yt_admin.set_interest_fee_rate(FEE_10_PERCENT);
    stop_cheat_caller_address(yt.contract_address);

    // Increase yield by another 10% (1.1 -> 1.21)
    set_yield_index(yield_token, WAD + WAD / 5 + WAD / 100); // 1.21

    // Second claim should have 10% fee
    start_cheat_caller_address(yt.contract_address, user1());
    let second_claim = yt.redeem_due_interest(user1());
    stop_cheat_caller_address(yt.contract_address);

    let treasury_after_second = sy.balance_of(treasury());
    assert(treasury_after_second > 0, 'Treasury should receive fee');

    // Fee should be ~10% of second claim's gross interest
    // second_claim is net, treasury_after_second is fee
    // fee_ratio = treasury / (user + treasury)
    let fee_ratio = treasury_after_second * WAD / (second_claim + treasury_after_second);
    let diff = if fee_ratio > FEE_10_PERCENT {
        fee_ratio - FEE_10_PERCENT
    } else {
        FEE_10_PERCENT - fee_ratio
    };
    assert(diff < WAD / 100, 'Wrong fee ratio on second claim');
}
