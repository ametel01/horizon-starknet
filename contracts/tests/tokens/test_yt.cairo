use core::num::traits::Zero;
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use crate::utils::{
    CURRENT_TIME, ONE_YEAR, admin, alice, bob, mint_and_deposit_sy, mint_and_mint_py,
    mint_yield_token_to_user, set_yield_index, setup_full, transfer_pt_and_redeem_post_expiry,
    transfer_py_and_redeem, user1, user2, zero_address,
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

    // Mint yield token and deposit to SY
    mint_and_deposit_sy(yield_token, sy, user, amount);

    (yield_token, sy, yt)
}

// ============ Constructor Tests ============

#[test]
fn test_yt_constructor() {
    let (_, sy, yt) = setup();
    let expiry = CURRENT_TIME + ONE_YEAR;

    assert(yt.name() == "YT Token", 'Wrong name');
    assert(yt.symbol() == "YT", 'Wrong symbol');
    assert(yt.decimals() == 18, 'Wrong decimals');
    assert(yt.total_supply() == 0, 'Wrong initial supply');
    assert(yt.sy() == sy.contract_address, 'Wrong SY address');
    assert(yt.expiry() == expiry, 'Wrong expiry');
    assert(!yt.pt().is_zero(), 'PT should be deployed');
}

#[test]
fn test_yt_pt_is_properly_linked() {
    let (_, sy, yt) = setup();

    // Get PT dispatcher
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Verify PT is linked to correct SY and YT
    assert(pt.sy() == sy.contract_address, 'PT wrong SY');
    assert(pt.yt() == yt.contract_address, 'PT wrong YT');
    assert(pt.expiry() == yt.expiry(), 'PT wrong expiry');
}

#[test]
fn test_yt_is_expired_false() {
    let (_, _, yt) = setup();
    assert(!yt.is_expired(), 'Should not be expired');
}

#[test]
fn test_yt_is_expired_true() {
    let (_, _, yt) = setup();
    let expiry = yt.expiry();

    start_cheat_block_timestamp_global(expiry + 1);

    assert(yt.is_expired(), 'Should be expired');
}

#[test]
fn test_yt_py_index_initialized() {
    let (_, sy, yt) = setup();

    // Initial PY index should match SY exchange rate
    let sy_rate = sy.exchange_rate();
    let py_index = yt.py_index_stored();

    assert(py_index == sy_rate, 'PY index should match SY rate');
}

// ============ Mint PY Tests ============

#[test]
fn test_yt_mint_py() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    // Transfer SY to YT contract (floating SY pattern)
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Mint PY using floating SY (same receiver for both PT and YT)
    start_cheat_caller_address(yt.contract_address, user);
    let (pt_minted, yt_minted) = yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Verify equal amounts of PT and YT
    assert(pt_minted == amount, 'Wrong PT amount');
    assert(yt_minted == amount, 'Wrong YT amount');

    // Verify balances
    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(user) == amount, 'Wrong PT balance');
    assert(yt.balance_of(user) == amount, 'Wrong YT balance');

    // SY should be transferred to YT contract
    assert(sy.balance_of(user) == 0, 'User should have 0 SY');
    assert(sy.balance_of(yt.contract_address) == amount, 'YT should hold SY');
}

#[test]
fn test_yt_mint_py_to_different_receiver() {
    let depositor = user1();
    let receiver = user2();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(depositor, amount);

    start_cheat_caller_address(sy.contract_address, depositor);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Mint with same receiver for both PT and YT (standard use case)
    start_cheat_caller_address(yt.contract_address, depositor);
    yt.mint_py(receiver, receiver);
    stop_cheat_caller_address(yt.contract_address);

    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(depositor) == 0, 'Depositor should have 0 PT');
    assert(pt.balance_of(receiver) == amount, 'Receiver should have PT');
    assert(yt.balance_of(depositor) == 0, 'Depositor should have 0 YT');
    assert(yt.balance_of(receiver) == amount, 'Receiver should have YT');
}

#[test]
fn test_yt_mint_py_split_receivers() {
    let depositor = user1();
    let pt_receiver = user2();
    let yt_receiver = admin();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(depositor, amount);

    start_cheat_caller_address(sy.contract_address, depositor);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Mint PT to pt_receiver, YT to yt_receiver (Pendle-style split receivers)
    start_cheat_caller_address(yt.contract_address, depositor);
    yt.mint_py(pt_receiver, yt_receiver);
    stop_cheat_caller_address(yt.contract_address);

    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(depositor) == 0, 'Depositor should have 0 PT');
    assert(pt.balance_of(pt_receiver) == amount, 'PT receiver should have PT');
    assert(pt.balance_of(yt_receiver) == 0, 'YT receiver should have 0 PT');
    assert(yt.balance_of(depositor) == 0, 'Depositor should have 0 YT');
    assert(yt.balance_of(pt_receiver) == 0, 'PT receiver should have 0 YT');
    assert(yt.balance_of(yt_receiver) == amount, 'YT receiver should have YT');
}

#[test]
fn test_yt_mint_py_multiple_times() {
    let user = user1();
    let amount = 100 * WAD;
    let (yield_token, sy, yt) = setup_with_sy(user, amount);

    // Mint more yield token for additional deposits
    mint_yield_token_to_user(yield_token, user, amount);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, yield_token.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // First mint (transfer and mint)
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Second mint (transfer and mint)
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(user) == 2 * amount, 'Wrong total PT');
    assert(yt.balance_of(user) == 2 * amount, 'Wrong total YT');
}

#[test]
#[should_panic(expected: 'HZN: expired')]
fn test_yt_mint_py_after_expiry() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
}

#[test]
#[should_panic(expected: 'HZN: no floating SY')]
fn test_yt_mint_py_zero_amount() {
    let user = user1();
    let (_, _, yt) = setup();

    // No SY transferred = no floating SY
    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_yt_mint_py_zero_pt_receiver() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(zero_address(), user);
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_yt_mint_py_zero_yt_receiver() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, zero_address());
}

// ============ Redeem PY Tests ============

#[test]
fn test_yt_redeem_py() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    // Mint PY first
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Redeem PY using floating token pattern
    let sy_returned = transfer_py_and_redeem(yt, user, user, amount);

    assert(sy_returned == amount, 'Wrong SY returned');

    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(user) == 0, 'PT should be burned');
    assert(yt.balance_of(user) == 0, 'YT should be burned');
    assert(sy.balance_of(user) == amount, 'User should have SY back');
}

#[test]
fn test_yt_redeem_py_partial() {
    let user = user1();
    let amount = 100 * WAD;
    let redeem_amount = 40 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Partial redeem using floating token pattern
    transfer_py_and_redeem(yt, user, user, redeem_amount);

    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(user) == amount - redeem_amount, 'Wrong remaining PT');
    assert(yt.balance_of(user) == amount - redeem_amount, 'Wrong remaining YT');
    assert(sy.balance_of(user) == redeem_amount, 'Wrong SY balance');
}

#[test]
fn test_yt_redeem_py_to_different_receiver() {
    let user = user1();
    let receiver = user2();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Redeem to different receiver using floating token pattern
    transfer_py_and_redeem(yt, user, receiver, amount);

    assert(sy.balance_of(user) == 0, 'User should have 0 SY');
    assert(sy.balance_of(receiver) == amount, 'Receiver should have SY');
}

#[test]
#[should_panic(expected: 'HZN: expired')]
fn test_yt_redeem_py_after_expiry() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // Try to redeem after expiry - should fail
    transfer_py_and_redeem(yt, user, user, amount);
}

#[test]
#[should_panic(expected: 'HZN: no floating PT/YT')]
fn test_yt_redeem_py_no_floating() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);

    // Try to redeem without pre-transferring PT/YT - should fail
    yt.redeem_py(user);
}

// ============ Redeem PY Post Expiry Tests ============

#[test]
fn test_yt_redeem_py_post_expiry() {
    let user = user1();
    let amount = 100 * WAD;
    let (yield_token, sy, yt) = setup_with_sy(user, amount);

    // Disable time-based yield for precise 1:1 math at index 1.0 WAD
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.set_yield_rate_bps(0);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    let (pt_minted, _) = yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // Redeem all PT using floating token pattern (YT is worthless post-expiry)
    let sy_returned = transfer_pt_and_redeem_post_expiry(yt, user, user, pt_minted);

    // With index=1.0 WAD, assetToSy gives back the same SY amount
    assert(sy_returned == amount, 'Wrong SY returned');

    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(user) == 0, 'PT should be burned');
    // YT remains (worthless but not burned)
    assert(yt.balance_of(user) == pt_minted, 'YT should remain');
    assert(sy.balance_of(user) == amount, 'User should have SY');
}

#[test]
fn test_yt_redeem_py_post_expiry_partial() {
    let user = user1();
    let amount = 100 * WAD;
    let (yield_token, sy, yt) = setup_with_sy(user, amount);

    // Disable time-based yield for precise math
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.set_yield_rate_bps(0);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    let (pt_minted, _) = yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // Redeem 60% of PT using floating token pattern
    let redeem_amount = pt_minted * 60 / 100;
    let sy_returned = transfer_pt_and_redeem_post_expiry(yt, user, user, redeem_amount);

    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(user) == pt_minted - redeem_amount, 'Wrong remaining PT');
    // With index=1.0 WAD, SY returned should equal the PT redeemed
    assert(sy.balance_of(user) == sy_returned, 'Wrong SY balance');
}

#[test]
#[should_panic(expected: 'HZN: not expired')]
fn test_yt_redeem_py_post_expiry_before_expiry() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    let (pt_minted, _) = yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Try to redeem post-expiry before actual expiry - should fail
    transfer_pt_and_redeem_post_expiry(yt, user, user, pt_minted);
}

#[test]
#[should_panic(expected: 'HZN: no floating PT')]
fn test_yt_redeem_py_post_expiry_no_floating() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // Try to redeem without pre-transferring PT - should fail
    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_py_post_expiry(user);
}

// ============ Interest/Yield Tests ============

#[test]
fn test_yt_get_user_interest_no_yield() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // No exchange rate change = no interest
    let interest = yt.get_user_interest(user);
    assert(interest == 0, 'Should have no interest');
}

#[test]
fn test_yt_redeem_due_interest_zero() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);

    // Claim with no yield accrued
    let claimed = yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    assert(claimed == 0, 'Should claim 0');
}

// ============ ERC20 Tests ============

#[test]
fn test_yt_transfer() {
    let sender = user1();
    let recipient = user2();
    let amount = 100 * WAD;
    let transfer_amount = 40 * WAD;
    let (_, sy, yt) = setup_with_sy(sender, amount);

    start_cheat_caller_address(sy.contract_address, sender);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, sender);
    yt.mint_py(sender, sender);

    // Transfer YT
    let result = yt.transfer(recipient, transfer_amount);
    stop_cheat_caller_address(yt.contract_address);

    assert(result, 'Transfer should succeed');
    assert(yt.balance_of(sender) == amount - transfer_amount, 'Wrong sender balance');
    assert(yt.balance_of(recipient) == transfer_amount, 'Wrong recipient balance');
}

#[test]
fn test_yt_approve() {
    let owner = user1();
    let spender = user2();
    let amount = 1000_u256;
    let (_, _, yt) = setup();

    start_cheat_caller_address(yt.contract_address, owner);
    let result = yt.approve(spender, amount);
    stop_cheat_caller_address(yt.contract_address);

    assert(result, 'Approve should succeed');
    assert(yt.allowance(owner, spender) == amount, 'Wrong allowance');
}

#[test]
fn test_yt_transfer_from() {
    let owner = user1();
    let spender = user2();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(owner, amount);

    start_cheat_caller_address(sy.contract_address, owner);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, owner);
    yt.mint_py(owner, owner);
    yt.approve(spender, 50 * WAD);
    stop_cheat_caller_address(yt.contract_address);

    // Spender transfers from owner
    start_cheat_caller_address(yt.contract_address, spender);
    let result = yt.transfer_from(owner, spender, 30 * WAD);
    stop_cheat_caller_address(yt.contract_address);

    assert(result, 'TransferFrom should succeed');
    assert(yt.balance_of(owner) == 70 * WAD, 'Wrong owner balance');
    assert(yt.balance_of(spender) == 30 * WAD, 'Wrong spender balance');
    assert(yt.allowance(owner, spender) == 20 * WAD, 'Wrong remaining allowance');
}

#[test]
#[should_panic(expected: 'ERC20: insufficient allowance')]
fn test_yt_transfer_from_insufficient_allowance() {
    let owner = user1();
    let spender = user2();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(owner, amount);

    start_cheat_caller_address(sy.contract_address, owner);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, owner);
    yt.mint_py(owner, owner);
    yt.approve(spender, 10 * WAD);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(yt.contract_address, spender);
    yt.transfer_from(owner, spender, 50 * WAD); // More than allowance
}

// ============ Index Tests ============

#[test]
fn test_yt_py_index_current() {
    let (_, sy, yt) = setup();

    let py_index = yt.py_index_current();
    let sy_rate = sy.exchange_rate();

    assert(py_index == sy_rate, 'Current index should match SY');
}

#[test]
fn test_yt_py_index_stored() {
    let (_, _, yt) = setup();

    let stored = yt.py_index_stored();
    assert(stored == WAD, 'Stored should be WAD');
}

// ============ Invariant Tests ============

/// CRITICAL INVARIANT: PT supply must ALWAYS equal YT supply
/// This is fundamental to the tokenomics model - PT and YT are always minted/burned in pairs
#[test]
fn test_invariant_pt_yt_supply_equality() {
    let (yield_token, sy, yt) = setup();
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Initially both zero
    assert(pt.total_supply() == yt.total_supply(), 'Initial supplies equal');
    assert(pt.total_supply() == 0, 'Initial supply is zero');

    // After mint
    let user = alice();
    mint_and_mint_py(yield_token, sy, yt, user, 100 * WAD);
    assert(pt.total_supply() == yt.total_supply(), 'After mint equal');

    // After partial redeem (before expiry) using floating token pattern
    transfer_py_and_redeem(yt, user, user, 30 * WAD);
    assert(pt.total_supply() == yt.total_supply(), 'After redeem equal');

    // After interest claim (should not affect supply)
    set_yield_index(yield_token, WAD + WAD / 10);
    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);
    assert(pt.total_supply() == yt.total_supply(), 'After interest equal');
}

// ============ Expiry Behavior Tests ============

/// Test that YT can still be transferred after expiry
/// (even though it's worthless, transfers should work)
#[test]
fn test_yt_transfer_after_expiry() {
    let (yield_token, sy, yt) = setup();
    let expiry = CURRENT_TIME + ONE_YEAR;

    let user_a = alice();
    let user_b = bob();

    mint_and_mint_py(yield_token, sy, yt, user_a, 100 * WAD);

    // Move past expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Transfer should still work
    start_cheat_caller_address(yt.contract_address, user_a);
    yt.transfer(user_b, 50 * WAD);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.balance_of(user_a) == 50 * WAD, 'A balance correct');
    assert(yt.balance_of(user_b) == 50 * WAD, 'B balance correct');
}

/// Test that YT yield is capped at expiry - post-expiry index changes don't affect YT holders
/// The expiry index is captured on first call after expiry, and subsequent changes are ignored
#[test]
fn test_yt_interest_claim_after_expiry() {
    let (yield_token, sy, yt) = setup();
    let expiry = CURRENT_TIME + ONE_YEAR;

    let user = alice();
    mint_and_mint_py(yield_token, sy, yt, user, 100 * WAD);

    // Accrue some interest before expiry (10% yield from set_index)
    // Note: set_yield_index disables time-based yield for precise control
    set_yield_index(yield_token, WAD + WAD / 10);

    // Move past expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // First call after expiry captures the expiry index
    start_cheat_caller_address(yt.contract_address, user);
    let claimed = yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    // With 10% yield, Pendle interest formula gives: balance × (curr - prev) / (prev × curr)
    // = 100 WAD × 0.1 / 1.1 ≈ 9.09 WAD (slightly less than 10% due to the formula)
    assert(claimed >= 9 * WAD, 'Should get yield');
    assert(claimed <= 10 * WAD, 'Yield should be capped');

    // Now index increases after expiry (but expiry index already captured)
    set_yield_index(yield_token, WAD + WAD / 5);

    // Second claim after expiry - should get nothing (expiry index already captured)
    start_cheat_caller_address(yt.contract_address, user);
    let post_capture_claimed = yt.redeem_due_interest(user);
    stop_cheat_caller_address(yt.contract_address);

    // No additional interest after expiry index is captured
    assert(post_capture_claimed == 0, 'No post-capture interest');
}

// ============ Section: update_py_index() Tests (Item 4 from discrepancies) ============
// Tests for the Pendle-style state-modifying index update function

/// Test that update_py_index() returns the current index
#[test]
fn test_update_py_index_returns_current_index() {
    let (yield_token, sy, yt) = setup();
    let user = user1();

    // Set initial index and mint some PY
    set_yield_index(yield_token, WAD);
    mint_and_deposit_sy(yield_token, sy, user, 100 * WAD);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    // Check initial stored index
    let stored = yt.py_index_stored();
    assert(stored == WAD, 'Initial stored index');

    // Call update_py_index (should return same value since index hasn't changed)
    start_cheat_caller_address(yt.contract_address, user);
    let updated = yt.update_py_index();
    stop_cheat_caller_address(yt.contract_address);

    assert(updated == WAD, 'update returns current index');
}

/// Test that update_py_index() updates stored index when rate increases
#[test]
fn test_update_py_index_updates_stored_on_increase() {
    let (yield_token, sy, yt) = setup();
    let user = user1();

    // Initial setup
    mint_and_mint_py(yield_token, sy, yt, user, 100 * WAD);

    let initial_stored = yt.py_index_stored();

    // Increase yield index by 10%
    let new_rate = WAD + WAD / 10;
    set_yield_index(yield_token, new_rate);

    // Call update_py_index to trigger state update
    start_cheat_caller_address(yt.contract_address, user);
    let updated = yt.update_py_index();
    stop_cheat_caller_address(yt.contract_address);

    // Stored index should be updated
    let after_stored = yt.py_index_stored();
    assert(updated == new_rate, 'update returns new index');
    assert(after_stored == new_rate, 'stored index updated');
    assert(after_stored > initial_stored, 'index increased');
}

/// Test that update_py_index() maintains watermark pattern (never decreases)
/// Verifies stored index only increases with successive calls
#[test]
fn test_update_py_index_watermark_pattern() {
    let (yield_token, sy, yt) = setup();
    let user = user1();

    // Initial setup
    mint_and_mint_py(yield_token, sy, yt, user, 100 * WAD);

    let initial_index = yt.py_index_stored();

    // First increase
    set_yield_index(yield_token, WAD + WAD / 10); // 1.1 WAD

    start_cheat_caller_address(yt.contract_address, user);
    let first_update = yt.update_py_index();
    stop_cheat_caller_address(yt.contract_address);

    assert(first_update > initial_index, 'first update increases');

    // Second increase
    set_yield_index(yield_token, WAD + WAD / 5); // 1.2 WAD

    start_cheat_caller_address(yt.contract_address, user);
    let second_update = yt.update_py_index();
    stop_cheat_caller_address(yt.contract_address);

    assert(second_update > first_update, 'second update increases');

    // Multiple calls with same rate should maintain watermark
    start_cheat_caller_address(yt.contract_address, user);
    let third_update = yt.update_py_index();
    stop_cheat_caller_address(yt.contract_address);

    assert(third_update == second_update, 'watermark maintained');

    // Stored index should be the highest seen
    let final_stored = yt.py_index_stored();
    assert(final_stored == second_update, 'stored equals highest');
}

/// Test that update_py_index() captures expiry index on first call after expiry
#[test]
fn test_update_py_index_captures_expiry() {
    let (yield_token, sy, yt) = setup();
    let expiry = CURRENT_TIME + ONE_YEAR;
    let user = user1();

    // Initial setup
    mint_and_mint_py(yield_token, sy, yt, user, 100 * WAD);

    // Move past expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // First call should capture expiry index
    start_cheat_caller_address(yt.contract_address, user);
    let captured = yt.update_py_index();
    stop_cheat_caller_address(yt.contract_address);

    let first_py_index = yt.first_py_index();
    assert(first_py_index > 0, 'Expiry index captured');
    assert(first_py_index == captured, 'Captured matches returned');

    // Increase index after expiry
    set_yield_index(yield_token, WAD * 2);

    // Second call should return frozen expiry index
    start_cheat_caller_address(yt.contract_address, user);
    let second = yt.update_py_index();
    stop_cheat_caller_address(yt.contract_address);

    assert(second == first_py_index, 'Returns frozen index post exp');
}

/// Test that py_index_current() (view) and update_py_index() (mut) return same value
#[test]
fn test_view_and_update_index_consistency() {
    let (yield_token, sy, yt) = setup();
    let user = user1();

    // Initial setup
    mint_and_mint_py(yield_token, sy, yt, user, 100 * WAD);

    // Increase index
    set_yield_index(yield_token, WAD + WAD / 10);

    // View function should return the expected index
    let view_index = yt.py_index_current();

    // Mutating function should return the same
    start_cheat_caller_address(yt.contract_address, user);
    let update_index = yt.update_py_index();
    stop_cheat_caller_address(yt.contract_address);

    assert(view_index == update_index, 'View and update consistent');
}
