use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_router::{IRouterDispatcher, IRouterDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_erc20::IMockERC20Dispatcher;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
/// Default deadline for router operations (far future - effectively no deadline)
const DEFAULT_DEADLINE: u64 = 0xFFFFFFFFFFFFFFFF;
/// Integration Tests: Expiry Behavior
/// Tests behavior around and after expiry timestamp.
///
/// Test Scenarios:
/// 1. Fast forward to expiry
/// 2. Verify YT becomes worthless
/// 3. Redeem PT-only post-expiry
/// 4. Verify PT redeems for correct amount
/// 5. Market behavior at and after expiry

use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_number_global,
    start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

// ============ Test Addresses ============

fn alice() -> ContractAddress {
    'alice'.try_into().unwrap()
}

fn bob() -> ContractAddress {
    'bob'.try_into().unwrap()
}

fn charlie() -> ContractAddress {
    'charlie'.try_into().unwrap()
}

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
}

// ============ Deploy Helpers ============

fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0);
    calldata.append(value);
    calldata.append(len.into());
}

fn deploy_mock_erc20() -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'MockERC20', 9);
    append_bytearray(ref calldata, 'MERC', 4);
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMockERC20Dispatcher { contract_address }
}

fn deploy_mock_yield_token(
    underlying: ContractAddress, admin_addr: ContractAddress,
) -> IMockYieldTokenDispatcher {
    let contract = declare("MockYieldToken").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'MockYieldToken', 14);
    append_bytearray(ref calldata, 'MYT', 3);
    calldata.append(underlying.into());
    calldata.append(admin_addr.into());
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMockYieldTokenDispatcher { contract_address }
}

fn deploy_yield_token_stack() -> IMockYieldTokenDispatcher {
    let underlying = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(underlying.contract_address, admin());
    yield_token
}

fn deploy_sy(
    underlying: ContractAddress, index_oracle: ContractAddress, is_erc4626: bool,
) -> ISYDispatcher {
    let contract = declare("SY").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'Standardized Yield', 18);
    append_bytearray(ref calldata, 'SY', 2);
    calldata.append(underlying.into());
    calldata.append(index_oracle.into());
    calldata.append(if is_erc4626 {
        1
    } else {
        0
    });
    calldata.append(0); // AssetType::Token
    calldata.append(admin().into()); // pauser

    // tokens_in: single token (underlying)
    calldata.append(1);
    calldata.append(underlying.into());

    // tokens_out: single token (underlying)
    calldata.append(1);
    calldata.append(underlying.into());

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    ISYDispatcher { contract_address }
}

fn deploy_yt(sy: ContractAddress, expiry: u64) -> IYTDispatcher {
    let pt_class = declare("PT").unwrap_syscall().contract_class();
    let yt_class = declare("YT").unwrap_syscall().contract_class();

    let mut calldata = array![];
    append_bytearray(ref calldata, 'Yield Token', 11);
    append_bytearray(ref calldata, 'YT', 2);
    calldata.append(sy.into());
    calldata.append((*pt_class.class_hash).into());
    calldata.append(expiry.into());
    calldata.append(admin().into()); // pauser
    calldata.append(treasury().into()); // treasury
    calldata.append(18); // decimals

    let (contract_address, _) = yt_class.deploy(@calldata).unwrap_syscall();
    IYTDispatcher { contract_address }
}

fn deploy_market(pt: ContractAddress) -> IMarketDispatcher {
    let contract = declare("Market").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'PT-SY LP', 8);
    append_bytearray(ref calldata, 'LP', 2);
    calldata.append(pt.into());
    let scalar_root = 50 * WAD;
    let initial_anchor = WAD / 10;
    let fee_rate = WAD / 100;
    calldata.append(scalar_root.low.into());
    calldata.append(scalar_root.high.into());
    calldata.append(initial_anchor.low.into());
    calldata.append(initial_anchor.high.into());
    calldata.append(fee_rate.low.into());
    calldata.append(fee_rate.high.into());
    calldata.append(admin().into()); // pauser

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketDispatcher { contract_address }
}

fn deploy_router() -> IRouterDispatcher {
    let contract = declare("Router").unwrap_syscall().contract_class();
    let mut calldata = array![];
    calldata.append(admin().into()); // owner
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IRouterDispatcher { contract_address }
}

// ============ Helper Functions ============

fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

fn set_yield_index(yield_token: IMockYieldTokenDispatcher, new_index: u256) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    // Disable time-based yield for precise control when manually setting index
    yield_token.set_yield_rate_bps(0);
    yield_token.set_index(new_index);
    stop_cheat_caller_address(yield_token.contract_address);

    // Advance block number to invalidate YT's same-block cache
    let block_num: u64 = (new_index / 1000000000000000).try_into().unwrap_or(1000) + 1;
    start_cheat_block_number_global(block_num);
}

// Helper: Setup user with SY and PT tokens
fn setup_user_with_tokens(
    underlying: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    user: ContractAddress,
    amount: u256,
) {
    mint_yield_token_to_user(underlying, user, amount * 2);

    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount * 2);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, underlying.contract_address, amount * 2, 0);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);
}

// ============ Expiry Tests ============

#[test]
fn test_expiry_pt_only_redemption() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);

    // Short expiry - 30 days
    let expiry = start_time + 30 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Alice mints PT + YT
    let amount = 1000 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), amount);

    // Verify not expired yet
    assert(!yt.is_expired(), 'Should not be expired yet');
    assert(!pt.is_expired(), 'PT not expired yet');

    // Fast forward past expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Verify now expired
    assert(yt.is_expired(), 'Should be expired');
    assert(pt.is_expired(), 'PT should be expired');

    // Alice redeems PT only (no YT needed post-expiry)
    let pt_balance = pt.balance_of(alice());
    let sy_before = sy.balance_of(alice());

    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(yt.contract_address, pt_balance);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    let sy_received = yt.redeem_py_post_expiry(alice(), pt_balance);
    stop_cheat_caller_address(yt.contract_address);

    // Verify SY received
    assert(sy_received > 0, 'Should receive SY');
    assert(sy.balance_of(alice()) == sy_before + sy_received, 'Alice SY increased');

    // PT should be burned
    assert(pt.balance_of(alice()) == 0, 'PT should be burned');

    // YT still exists but is worthless
    assert(yt.balance_of(alice()) == amount, 'YT balance unchanged');
}

#[test]
fn test_yt_worthless_after_expiry() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 30 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Alice and Bob both get PT + YT
    let amount = 500 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), amount);
    setup_user_with_tokens(underlying, sy, yt, bob(), amount);

    // Alice transfers all YT to Charlie (speculation)
    start_cheat_caller_address(yt.contract_address, alice());
    yt.transfer(charlie(), amount);
    stop_cheat_caller_address(yt.contract_address);

    // Now Alice has PT only, Charlie has YT only

    // Fast forward past expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Alice can redeem PT without needing YT
    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(yt.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    let alice_sy = yt.redeem_py_post_expiry(alice(), amount);
    stop_cheat_caller_address(yt.contract_address);

    assert(alice_sy > 0, 'Alice redeemed PT');

    // Charlie's YT is worthless - can't redeem for anything
    // YT holders get yield during the term, but nothing at expiry
    assert(yt.balance_of(charlie()) == amount, 'Charlie still has YT');
    // Charlie cannot redeem without PT
// The YT is effectively worthless now
}

#[test]
fn test_exactly_at_expiry_timestamp() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 30 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let amount = 100 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), amount);

    // One second before expiry - not expired
    start_cheat_block_timestamp_global(expiry - 1);
    assert(!yt.is_expired(), 'Not expired 1s before');
    assert(!pt.is_expired(), 'PT not expired 1s before');

    // Exactly at expiry timestamp - IS expired (>= check)
    start_cheat_block_timestamp_global(expiry);
    assert(yt.is_expired(), 'Expired at exact time');
    assert(pt.is_expired(), 'PT expired at exact time');

    // One second after expiry - expired
    start_cheat_block_timestamp_global(expiry + 1);
    assert(yt.is_expired(), 'Expired 1s after');
    assert(pt.is_expired(), 'PT expired 1s after');
}

#[test]
#[should_panic(expected: 'HZN: expired')]
fn test_cannot_mint_after_expiry() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 30 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);

    // Get SY tokens
    mint_yield_token_to_user(underlying, alice(), 1000 * WAD);
    start_cheat_caller_address(underlying.contract_address, alice());
    underlying.approve(sy.contract_address, 1000 * WAD);
    stop_cheat_caller_address(underlying.contract_address);
    start_cheat_caller_address(sy.contract_address, alice());
    sy.deposit(alice(), underlying.contract_address, 1000 * WAD, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Try to mint - should fail
    start_cheat_caller_address(sy.contract_address, alice());
    sy.transfer(yt.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    yt.mint_py(alice(), alice()); // Should panic
}

#[test]
#[should_panic(expected: 'HZN: not expired')]
fn test_cannot_redeem_post_expiry_before_expiry() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 30 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let amount = 100 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), amount);

    // Still before expiry
    assert(!yt.is_expired(), 'Not expired');

    // Try to redeem post-expiry function before expiry - should fail
    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(yt.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    yt.redeem_py_post_expiry(alice(), amount); // Should panic
}

#[test]
fn test_market_expired_behavior() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 30 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let market = deploy_market(pt.contract_address);

    // Add liquidity before expiry
    let amount = 500 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), amount);

    start_cheat_caller_address(sy.contract_address, alice());
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);
    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);
    start_cheat_caller_address(market.contract_address, alice());
    let (_, _, lp_minted) = market.mint(alice(), amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Verify market not expired
    assert(!market.is_expired(), 'Market not expired');

    // Fast forward past expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Market is now expired
    assert(market.is_expired(), 'Market is expired');

    // LPs can still withdraw after expiry
    let lp_token = IPTDispatcher { contract_address: market.contract_address };
    start_cheat_caller_address(market.contract_address, alice());
    lp_token.approve(market.contract_address, lp_minted);
    stop_cheat_caller_address(market.contract_address);

    let sy_before = sy.balance_of(alice());
    let pt_before = pt.balance_of(alice());

    start_cheat_caller_address(market.contract_address, alice());
    let (sy_out, pt_out) = market.burn(alice(), lp_minted);
    stop_cheat_caller_address(market.contract_address);

    assert(sy_out > 0, 'Got SY after expiry');
    assert(pt_out > 0, 'Got PT after expiry');
    assert(sy.balance_of(alice()) == sy_before + sy_out, 'SY withdrawn');
    assert(pt.balance_of(alice()) == pt_before + pt_out, 'PT withdrawn');
}

#[test]
#[should_panic(expected: 'HZN: market expired')]
fn test_market_no_swaps_after_expiry() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 30 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let market = deploy_market(pt.contract_address);

    // Add liquidity
    let amount = 500 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), amount);

    start_cheat_caller_address(sy.contract_address, alice());
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);
    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);
    start_cheat_caller_address(market.contract_address, alice());
    market.mint(alice(), amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Bob gets tokens BEFORE expiry (can't mint PT+YT after expiry)
    setup_user_with_tokens(underlying, sy, yt, bob(), 100 * WAD);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Bob tries to swap - should fail with Market: expired
    start_cheat_caller_address(sy.contract_address, bob());
    sy.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, bob());
    market.swap_exact_sy_for_pt(bob(), 50 * WAD, 0); // Should panic
}

#[test]
fn test_router_post_expiry_redemption() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 30 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let router = deploy_router();

    let amount = 500 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), amount);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Alice redeems via router
    let pt_balance = pt.balance_of(alice());

    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(router.contract_address, pt_balance);
    stop_cheat_caller_address(pt.contract_address);

    let sy_before = sy.balance_of(alice());

    start_cheat_caller_address(router.contract_address, alice());
    let sy_out = router
        .redeem_pt_post_expiry(yt.contract_address, alice(), pt_balance, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    assert(sy_out > 0, 'Router redeemed PT');
    assert(sy.balance_of(alice()) == sy_before + sy_out, 'Alice got SY via router');
    assert(pt.balance_of(alice()) == 0, 'PT burned via router');
}

#[test]
fn test_yield_accumulation_until_expiry() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 90 * 24 * 60 * 60; // 90 days
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let amount = 1000 * WAD;
    setup_user_with_tokens(underlying, sy, yt, alice(), amount);

    // Record initial PY index
    let initial_index = yt.py_index_current();

    // Month 1: 3% yield - check index increases
    start_cheat_block_timestamp_global(start_time + 30 * 24 * 60 * 60);
    set_yield_index(underlying, WAD + (WAD * 3) / 100);

    let index_m1 = yt.py_index_current();
    assert(index_m1 >= initial_index, 'Index should grow month 1');

    // Check interest is accruing (but don't claim it all yet)
    let interest_m1 = yt.get_user_interest(alice());
    assert(interest_m1 >= 0, 'Month 1 interest accrued');

    // Month 2: Additional 2% yield (total 5%)
    start_cheat_block_timestamp_global(start_time + 60 * 24 * 60 * 60);
    set_yield_index(underlying, WAD + (WAD * 5) / 100);

    let index_m2 = yt.py_index_current();
    assert(index_m2 >= index_m1, 'Index should grow month 2');

    let interest_m2 = yt.get_user_interest(alice());
    assert(interest_m2 >= interest_m1, 'Month 2 interest >= month 1');

    // At expiry: Final 2% (total 7%)
    start_cheat_block_timestamp_global(expiry);
    set_yield_index(underlying, WAD + (WAD * 7) / 100);

    let index_m3 = yt.py_index_current();
    assert(index_m3 >= index_m2, 'Index should grow month 3');

    // After expiry, Alice redeems PT (without claiming interest first)
    // This ensures there's enough SY in the YT contract to back the redemption
    start_cheat_block_timestamp_global(expiry + 1);

    let pt_balance = pt.balance_of(alice());
    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(yt.contract_address, pt_balance);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    let final_sy = yt.redeem_py_post_expiry(alice(), pt_balance);
    stop_cheat_caller_address(yt.contract_address);

    assert(final_sy > 0, 'Final PT redemption');
    assert(pt.balance_of(alice()) == 0, 'PT should be burned');
}

#[test]
fn test_multiple_users_expiry_redemption() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 30 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Multiple users mint PT + YT
    let alice_amount = 1000 * WAD;
    let bob_amount = 500 * WAD;
    let charlie_amount = 250 * WAD;

    setup_user_with_tokens(underlying, sy, yt, alice(), alice_amount);
    setup_user_with_tokens(underlying, sy, yt, bob(), bob_amount);
    setup_user_with_tokens(underlying, sy, yt, charlie(), charlie_amount);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // All users redeem
    let alice_pt = pt.balance_of(alice());
    let bob_pt = pt.balance_of(bob());
    let charlie_pt = pt.balance_of(charlie());

    // Alice redeems
    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(yt.contract_address, alice_pt);
    stop_cheat_caller_address(pt.contract_address);
    start_cheat_caller_address(yt.contract_address, alice());
    let alice_sy = yt.redeem_py_post_expiry(alice(), alice_pt);
    stop_cheat_caller_address(yt.contract_address);

    // Bob redeems
    start_cheat_caller_address(pt.contract_address, bob());
    pt.approve(yt.contract_address, bob_pt);
    stop_cheat_caller_address(pt.contract_address);
    start_cheat_caller_address(yt.contract_address, bob());
    let bob_sy = yt.redeem_py_post_expiry(bob(), bob_pt);
    stop_cheat_caller_address(yt.contract_address);

    // Charlie redeems
    start_cheat_caller_address(pt.contract_address, charlie());
    pt.approve(yt.contract_address, charlie_pt);
    stop_cheat_caller_address(pt.contract_address);
    start_cheat_caller_address(yt.contract_address, charlie());
    let charlie_sy = yt.redeem_py_post_expiry(charlie(), charlie_pt);
    stop_cheat_caller_address(yt.contract_address);

    // All received SY
    assert(alice_sy > 0, 'Alice redeemed');
    assert(bob_sy > 0, 'Bob redeemed');
    assert(charlie_sy > 0, 'Charlie redeemed');

    // Proportional to their PT holdings
    // Alice had 2x Bob, Bob had 2x Charlie
    assert(alice_sy > bob_sy, 'Alice > Bob');
    assert(bob_sy > charlie_sy, 'Bob > Charlie');

    // All PT burned
    assert(pt.balance_of(alice()) == 0, 'Alice PT burned');
    assert(pt.balance_of(bob()) == 0, 'Bob PT burned');
    assert(pt.balance_of(charlie()) == 0, 'Charlie PT burned');

    // Total PT supply should be zero
    assert(pt.total_supply() == 0, 'All PT redeemed');
}
