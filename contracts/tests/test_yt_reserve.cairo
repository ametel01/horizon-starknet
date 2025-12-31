use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_yield_token::IMockYieldTokenDispatcher;
use snforge_std::{
    start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use super::utils::{alice, bob, mint_and_deposit_sy, set_yield_index, setup_full, user1};

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

// ============ sy_reserve Basic Tests ============

#[test]
fn test_sy_reserve_initial() {
    let (_, _, yt) = setup();

    // Initial reserve should be zero
    assert(yt.sy_reserve() == 0, 'Initial reserve should be 0');
}

#[test]
fn test_sy_reserve_after_mint() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    // Approve and mint PY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    // Reserve should equal amount deposited
    assert(yt.sy_reserve() == amount, 'Reserve should equal mint amt');
}

#[test]
fn test_sy_reserve_after_multiple_mints() {
    let user = user1();
    let amount = 100 * WAD;
    let (_yield_token, sy, yt) = setup_with_sy(user, 2 * amount);

    // Approve for both mints
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, 2 * amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.sy_reserve() == amount, 'Reserve after first mint');

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.sy_reserve() == 2 * amount, 'Reserve after second mint');
}

// ============ sy_reserve Redemption Tests ============

#[test]
fn test_sy_reserve_after_redeem_py() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    // Mint PY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.sy_reserve() == amount, 'Reserve after mint');

    // Redeem half
    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_py(user, 50 * WAD);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.sy_reserve() == 50 * WAD, 'Reserve after partial redeem');
}

#[test]
fn test_sy_reserve_after_full_redeem() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    yt.redeem_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.sy_reserve() == 0, 'Reserve should be 0 after full');
}

#[test]
fn test_sy_reserve_after_redeem_py_post_expiry() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.sy_reserve() == amount, 'Reserve before expiry');

    // Move past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // Redeem PT post expiry
    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_py_post_expiry(user, 60 * WAD);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.sy_reserve() == 40 * WAD, 'Reserve after post-expiry');
}

// ============ sy_reserve Interest Tests ============

#[test]
fn test_sy_reserve_after_interest_claim() {
    let user = user1();
    let amount = 100 * WAD;
    let (yield_token, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    let reserve_before = yt.sy_reserve();
    assert(reserve_before == amount, 'Reserve after mint');

    // Increase yield index by 10%
    set_yield_index(yield_token, WAD + WAD / 10);

    // Claim interest
    start_cheat_caller_address(yt.contract_address, user);
    let claimed = yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    // Reserve should decrease by claimed amount
    let reserve_after = yt.sy_reserve();
    assert(reserve_after == reserve_before - claimed, 'Reserve decreased by interest');
}

// ============ get_floating_sy Tests ============

#[test]
fn test_get_floating_sy_zero_initially() {
    let (_, _, yt) = setup();

    // No floating SY when nothing deposited
    assert(yt.get_floating_sy() == 0, 'No floating SY initially');
}

#[test]
fn test_get_floating_sy_zero_after_normal_mint() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    // After normal mint, no floating SY
    assert(yt.get_floating_sy() == 0, 'No floating after normal mint');
}

#[test]
fn test_get_floating_sy_after_direct_transfer() {
    let user = user1();
    let amount = 100 * WAD;
    let donation = 25 * WAD;
    let (_yield_token, sy, yt) = setup_with_sy(user, amount + donation);

    // Mint PY with normal amount
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    // Direct SY transfer to YT contract (donation)
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, donation);
    stop_cheat_caller_address(sy.contract_address);

    // Floating SY should equal donation amount
    assert(yt.get_floating_sy() == donation, 'Floating equals donation');

    // Reserve unchanged
    assert(yt.sy_reserve() == amount, 'Reserve unchanged');
}

#[test]
fn test_get_floating_sy_multiple_donations() {
    let user_a = alice();
    let user_b = bob();
    let amount = 100 * WAD;
    let donation1 = 10 * WAD;
    let donation2 = 15 * WAD;

    let (yield_token, sy, yt) = setup();

    // Give both users SY
    mint_and_deposit_sy(yield_token, sy, user_a, amount + donation1);
    mint_and_deposit_sy(yield_token, sy, user_b, donation2);

    // User A mints PY
    start_cheat_caller_address(sy.contract_address, user_a);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user_a);
    yt.mint_py(user_a, amount);
    stop_cheat_caller_address(yt.contract_address);

    // User A donates
    start_cheat_caller_address(sy.contract_address, user_a);
    sy.transfer(yt.contract_address, donation1);
    stop_cheat_caller_address(sy.contract_address);

    assert(yt.get_floating_sy() == donation1, 'Floating after first donation');

    // User B donates
    start_cheat_caller_address(sy.contract_address, user_b);
    sy.transfer(yt.contract_address, donation2);
    stop_cheat_caller_address(sy.contract_address);

    assert(yt.get_floating_sy() == donation1 + donation2, 'Floating after both donations');
}

// ============ Invariant Tests ============

#[test]
fn test_sy_reserve_invariant_actual_ge_reserve() {
    let user = user1();
    let amount = 100 * WAD;
    let (yield_token, sy, yt) = setup_with_sy(user, amount);

    // Mint
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    // actual >= reserve
    let actual = sy.balance_of(yt.contract_address);
    let reserved = yt.sy_reserve();
    assert(actual >= reserved, 'Invariant: actual >= reserve');

    // Partial redeem
    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_py(user, 30 * WAD);
    stop_cheat_caller_address(yt.contract_address);

    let actual2 = sy.balance_of(yt.contract_address);
    let reserved2 = yt.sy_reserve();
    assert(actual2 >= reserved2, 'Invariant after redeem');

    // Yield accrual
    set_yield_index(yield_token, WAD + WAD / 10);

    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    let actual3 = sy.balance_of(yt.contract_address);
    let reserved3 = yt.sy_reserve();
    assert(actual3 >= reserved3, 'Invariant after interest');
}

#[test]
fn test_sy_reserve_equals_balance_no_donations() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    // With no donations, actual == reserve
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    let actual = sy.balance_of(yt.contract_address);
    let reserved = yt.sy_reserve();
    assert(actual == reserved, 'No donations: actual == reserve');
    assert(yt.get_floating_sy() == 0, 'No floating without donations');
}
