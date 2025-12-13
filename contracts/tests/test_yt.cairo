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
use super::utils::{
    CURRENT_TIME, ONE_YEAR, mint_and_deposit_sy, mint_yield_token_to_user, setup_full, user1, user2,
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

    // Approve YT to spend SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Mint PY
    start_cheat_caller_address(yt.contract_address, user);
    let (pt_minted, yt_minted) = yt.mint_py(user, amount);
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
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, depositor);
    yt.mint_py(receiver, amount);
    stop_cheat_caller_address(yt.contract_address);

    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(depositor) == 0, 'Depositor should have 0 PT');
    assert(pt.balance_of(receiver) == amount, 'Receiver should have PT');
    assert(yt.balance_of(depositor) == 0, 'Depositor should have 0 YT');
    assert(yt.balance_of(receiver) == amount, 'Receiver should have YT');
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
    sy.deposit(user, amount);
    sy.approve(yt.contract_address, 2 * amount);
    stop_cheat_caller_address(sy.contract_address);

    // First mint
    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);

    // Second mint
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(user) == 2 * amount, 'Wrong total PT');
    assert(yt.balance_of(user) == 2 * amount, 'Wrong total YT');
}

#[test]
#[should_panic(expected: 'YT: expired')]
fn test_yt_mint_py_after_expiry() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
}

#[test]
#[should_panic(expected: 'YT: zero amount')]
fn test_yt_mint_py_zero_amount() {
    let user = user1();
    let (_, _, yt) = setup();

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, 0);
}

#[test]
#[should_panic(expected: 'YT: zero address')]
fn test_yt_mint_py_zero_receiver() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(zero_address(), amount);
}

// ============ Redeem PY Tests ============

#[test]
fn test_yt_redeem_py() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    // Mint PY first
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);

    // Redeem PY
    let sy_returned = yt.redeem_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

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
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);

    // Partial redeem
    yt.redeem_py(user, redeem_amount);
    stop_cheat_caller_address(yt.contract_address);

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
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    yt.redeem_py(receiver, amount);
    stop_cheat_caller_address(yt.contract_address);

    assert(sy.balance_of(user) == 0, 'User should have 0 SY');
    assert(sy.balance_of(receiver) == amount, 'Receiver should have SY');
}

#[test]
#[should_panic(expected: 'YT: expired')]
fn test_yt_redeem_py_after_expiry() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_py(user, amount);
}

#[test]
#[should_panic(expected: 'YT: zero amount')]
fn test_yt_redeem_py_zero_amount() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    yt.redeem_py(user, 0);
}

// ============ Redeem PY Post Expiry Tests ============

#[test]
fn test_yt_redeem_py_post_expiry() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // Redeem PT only (YT is worthless)
    start_cheat_caller_address(yt.contract_address, user);
    let sy_returned = yt.redeem_py_post_expiry(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    assert(sy_returned == amount, 'Wrong SY returned');

    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(user) == 0, 'PT should be burned');
    // YT remains (worthless but not burned)
    assert(yt.balance_of(user) == amount, 'YT should remain');
    assert(sy.balance_of(user) == amount, 'User should have SY');
}

#[test]
fn test_yt_redeem_py_post_expiry_partial() {
    let user = user1();
    let amount = 100 * WAD;
    let redeem_amount = 60 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_block_timestamp_global(yt.expiry() + 1);

    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_py_post_expiry(user, redeem_amount);
    stop_cheat_caller_address(yt.contract_address);

    let pt = IPTDispatcher { contract_address: yt.pt() };
    assert(pt.balance_of(user) == amount - redeem_amount, 'Wrong remaining PT');
    assert(sy.balance_of(user) == redeem_amount, 'Wrong SY balance');
}

#[test]
#[should_panic(expected: 'YT: not expired')]
fn test_yt_redeem_py_post_expiry_before_expiry() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);

    // Try to redeem post-expiry before actual expiry
    yt.redeem_py_post_expiry(user, amount);
}

#[test]
#[should_panic(expected: 'YT: zero amount')]
fn test_yt_redeem_py_post_expiry_zero_amount() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_block_timestamp_global(yt.expiry() + 1);

    start_cheat_caller_address(yt.contract_address, user);
    yt.redeem_py_post_expiry(user, 0);
}

// ============ Interest/Yield Tests ============

#[test]
fn test_yt_get_user_interest_no_yield() {
    let user = user1();
    let amount = 100 * WAD;
    let (_, sy, yt) = setup_with_sy(user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
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
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);

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
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, sender);
    yt.mint_py(sender, amount);

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
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, owner);
    yt.mint_py(owner, amount);
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
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, owner);
    yt.mint_py(owner, amount);
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
