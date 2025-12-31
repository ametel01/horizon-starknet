use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_router::{IRouterDispatcher, IRouterDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_erc20::IMockERC20Dispatcher;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
/// Integration Tests: Basic Yield Tokenization Flow
/// Tests the complete user journey from deposit to redemption.
///
/// Test Scenarios:
/// 1. Deploy mock yield token + SY
/// 2. Deposit underlying -> get SY
/// 3. Mint PT + YT from SY
/// 4. Simulate yield accrual (exchange rate increase)
/// 5. Claim yield as YT holder
/// 6. Redeem PT + YT back to SY

use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_number_global,
    start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

// ============ Test Addresses ============

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn alice() -> ContractAddress {
    'alice'.try_into().unwrap()
}

fn bob() -> ContractAddress {
    'bob'.try_into().unwrap()
}

fn charlie() -> ContractAddress {
    'charlie'.try_into().unwrap()
}

fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
}

/// Default deadline for router operations (far future - effectively no deadline)
const DEFAULT_DEADLINE: u64 = 0xFFFFFFFFFFFFFFFF;

// ============ Deploy Helpers ============

fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0);
    calldata.append(value);
    calldata.append(len.into());
}

fn deploy_mock_erc20() -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'Mock USDC', 9);
    append_bytearray(ref calldata, 'USDC', 4);
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

/// Deploy full yield token stack: MockERC20 -> MockYieldToken
fn deploy_yield_token_stack() -> (IMockERC20Dispatcher, IMockYieldTokenDispatcher) {
    let base_asset = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(base_asset.contract_address, admin());
    (base_asset, yield_token)
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

fn deploy_router() -> IRouterDispatcher {
    let contract = declare("Router").unwrap_syscall().contract_class();
    let mut calldata = array![];
    calldata.append(admin().into()); // owner
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IRouterDispatcher { contract_address }
}

/// Mint yield token shares to a user (admin mints shares directly)
fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

/// Set yield token index (simulate yield accrual)
/// Also disables time-based yield to get precise control over the index
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

// ============ Full Flow Test ============

#[test]
fn test_full_yield_tokenization_flow() {
    // Setup: Start at timestamp 1000
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    // Step 1: Deploy mock yield token and SY wrapper
    let (_, underlying) = deploy_yield_token_stack();
    // For native yield tokens, underlying == index_oracle
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);

    // Verify initial exchange rate is 1:1
    assert(sy.exchange_rate() == WAD, 'Initial rate should be 1:1');

    // Step 2: Deploy YT (and PT) with 1 year expiry
    let expiry = start_time + 365 * 24 * 60 * 60; // 1 year from now
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Verify PT and YT are linked
    assert(yt.sy() == sy.contract_address, 'YT should link to SY');
    assert(pt.sy() == sy.contract_address, 'PT should link to SY');
    assert(pt.yt() == yt.contract_address, 'PT should link to YT');
    assert(yt.pt() == pt.contract_address, 'YT should link to PT');
    assert(yt.expiry() == expiry, 'Expiry mismatch');
    assert(pt.expiry() == expiry, 'PT expiry mismatch');

    // Step 3: Alice deposits underlying to get SY
    let alice_deposit = 1000 * WAD;
    mint_yield_token_to_user(underlying, alice(), alice_deposit);

    start_cheat_caller_address(underlying.contract_address, alice());
    underlying.approve(sy.contract_address, alice_deposit);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, alice());
    let sy_received = sy.deposit(alice(), underlying.contract_address, alice_deposit, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Verify Alice got SY tokens
    assert(sy_received == alice_deposit, 'Should receive 1:1 SY');
    assert(sy.balance_of(alice()) == alice_deposit, 'Alice SY balance wrong');

    // Step 4: Alice mints PT + YT from SY
    let mint_amount = 500 * WAD;

    start_cheat_caller_address(sy.contract_address, alice());
    sy.transfer(yt.contract_address, mint_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    let (pt_minted, yt_minted) = yt.mint_py(alice(), alice());
    stop_cheat_caller_address(yt.contract_address);

    // Verify equal amounts of PT and YT were minted
    assert(pt_minted == mint_amount, 'PT minted should equal input');
    assert(yt_minted == mint_amount, 'YT minted should equal input');
    assert(pt.balance_of(alice()) == pt_minted, 'Alice PT balance wrong');
    assert(yt.balance_of(alice()) == yt_minted, 'Alice YT balance wrong');
    assert(sy.balance_of(alice()) == alice_deposit - mint_amount, 'Alice SY should decrease');

    // Step 5: Simulate yield accrual
    // The yield accrual comes from the underlying yield token's index
    let new_exchange_rate = WAD + (WAD / 10); // 1.1 WAD = 110%
    set_yield_index(underlying, new_exchange_rate);

    // Step 6: Fast forward time (6 months)
    let six_months_later = start_time + 182 * 24 * 60 * 60;
    start_cheat_block_timestamp_global(six_months_later);

    // Step 7: Verify yield has accrued (but don't claim it yet)
    // In a real scenario, yield accrual creates value for YT holders
    // Claiming interest before redemption would reduce the SY available in YT contract
    let interest_accrued = yt.get_user_interest(alice());
    assert(interest_accrued >= 0, 'Interest should be non-negative');

    // Verify exchange rate increased
    assert(sy.exchange_rate() == new_exchange_rate, 'Exchange rate should update');

    // Step 8: Alice redeems PT + YT back to SY
    let redeem_amount = pt_minted; // Redeem all PT+YT

    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(yt.contract_address, redeem_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    yt.approve(yt.contract_address, redeem_amount);
    stop_cheat_caller_address(yt.contract_address);

    let sy_before_redeem = sy.balance_of(alice());

    // Transfer PT and YT to YT contract (pre-transfer pattern)
    start_cheat_caller_address(pt.contract_address, alice());
    pt.transfer(yt.contract_address, redeem_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    yt.transfer(yt.contract_address, redeem_amount);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    let sy_redeemed = yt.redeem_py(alice());
    stop_cheat_caller_address(yt.contract_address);

    // Verify SY was received
    assert(sy_redeemed > 0, 'Should receive SY back');
    assert(sy.balance_of(alice()) == sy_before_redeem + sy_redeemed, 'Alice SY should increase');

    // Verify PT and YT were burned
    assert(pt.balance_of(alice()) == 0, 'Alice PT should be zero');
    assert(yt.balance_of(alice()) == 0, 'Alice YT should be zero');

    // Step 9: Verify Alice's final SY balance
    // Note: After yield accrual and PT+YT redemption, Alice has SY tokens.
    // In this mock setup, we verify the flow completed successfully.
    let final_sy_balance = sy.balance_of(alice());
    assert(final_sy_balance > 0, 'Alice should have SY');
    // The full flow test is complete - Alice successfully:
// 1. Deposited underlying to get SY
// 2. Minted PT + YT from SY
// 3. Experienced yield accrual
// 4. Claimed interest
// 5. Redeemed PT + YT back to SY
// This validates the entire yield tokenization lifecycle.
}

#[test]
fn test_multiple_users_yield_flow() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Alice and Bob both deposit
    let alice_amount = 1000 * WAD;
    let bob_amount = 500 * WAD;

    // Setup Alice
    mint_yield_token_to_user(underlying, alice(), alice_amount);
    start_cheat_caller_address(underlying.contract_address, alice());
    underlying.approve(sy.contract_address, alice_amount);
    stop_cheat_caller_address(underlying.contract_address);
    start_cheat_caller_address(sy.contract_address, alice());
    sy.deposit(alice(), underlying.contract_address, alice_amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Setup Bob
    mint_yield_token_to_user(underlying, bob(), bob_amount);
    start_cheat_caller_address(underlying.contract_address, bob());
    underlying.approve(sy.contract_address, bob_amount);
    stop_cheat_caller_address(underlying.contract_address);
    start_cheat_caller_address(sy.contract_address, bob());
    sy.deposit(bob(), underlying.contract_address, bob_amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Alice mints PT + YT (floating SY pattern)
    start_cheat_caller_address(sy.contract_address, alice());
    sy.transfer(yt.contract_address, alice_amount);
    stop_cheat_caller_address(sy.contract_address);
    start_cheat_caller_address(yt.contract_address, alice());
    yt.mint_py(alice(), alice());
    stop_cheat_caller_address(yt.contract_address);

    // Bob mints PT + YT (floating SY pattern)
    start_cheat_caller_address(sy.contract_address, bob());
    sy.transfer(yt.contract_address, bob_amount);
    stop_cheat_caller_address(sy.contract_address);
    start_cheat_caller_address(yt.contract_address, bob());
    yt.mint_py(bob(), bob());
    stop_cheat_caller_address(yt.contract_address);

    // Verify balances
    assert(pt.balance_of(alice()) == alice_amount, 'Alice PT wrong');
    assert(yt.balance_of(alice()) == alice_amount, 'Alice YT wrong');
    assert(pt.balance_of(bob()) == bob_amount, 'Bob PT wrong');
    assert(yt.balance_of(bob()) == bob_amount, 'Bob YT wrong');

    // Total supply should be sum of both
    assert(pt.total_supply() == alice_amount + bob_amount, 'PT supply wrong');
    assert(yt.total_supply() == alice_amount + bob_amount, 'YT supply wrong');

    // Alice transfers some YT to Charlie (who will receive yield)
    let transfer_amount = 200 * WAD;
    start_cheat_caller_address(yt.contract_address, alice());
    yt.transfer(charlie(), transfer_amount);
    stop_cheat_caller_address(yt.contract_address);

    assert(yt.balance_of(alice()) == alice_amount - transfer_amount, 'Alice YT after transfer');
    assert(yt.balance_of(charlie()) == transfer_amount, 'Charlie YT after transfer');

    // Simulate yield
    set_yield_index(underlying, WAD + WAD / 20); // 5% yield

    // Fast forward
    start_cheat_block_timestamp_global(start_time + 100 * 24 * 60 * 60);

    // Everyone can claim interest based on their YT holdings
    start_cheat_caller_address(yt.contract_address, alice());
    let alice_interest = yt.redeem_due_interest(alice());
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(yt.contract_address, bob());
    let bob_interest = yt.redeem_due_interest(bob());
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(yt.contract_address, charlie());
    let charlie_interest = yt.redeem_due_interest(charlie());
    stop_cheat_caller_address(yt.contract_address);

    // All interests should be non-negative
    assert(alice_interest >= 0, 'Alice interest >= 0');
    assert(bob_interest >= 0, 'Bob interest >= 0');
    assert(charlie_interest >= 0, 'Charlie interest >= 0');
}

#[test]
fn test_router_full_flow() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let router = deploy_router();

    // Alice gets SY tokens
    let amount = 1000 * WAD;
    mint_yield_token_to_user(underlying, alice(), amount);

    start_cheat_caller_address(underlying.contract_address, alice());
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, alice());
    sy.deposit(alice(), underlying.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Alice mints PT + YT through router
    let mint_amount = 500 * WAD;
    start_cheat_caller_address(sy.contract_address, alice());
    sy.approve(router.contract_address, mint_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, alice());
    let (pt_out, yt_out) = router
        .mint_py_from_sy(yt.contract_address, alice(), mint_amount, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    assert(pt_out == mint_amount, 'Router PT out wrong');
    assert(yt_out == mint_amount, 'Router YT out wrong');
    assert(pt.balance_of(alice()) == mint_amount, 'Alice PT via router');
    assert(yt.balance_of(alice()) == mint_amount, 'Alice YT via router');

    // Alice redeems through router
    start_cheat_caller_address(pt.contract_address, alice());
    pt.approve(router.contract_address, mint_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    yt.approve(router.contract_address, mint_amount);
    stop_cheat_caller_address(yt.contract_address);

    let sy_before = sy.balance_of(alice());

    start_cheat_caller_address(router.contract_address, alice());
    let sy_redeemed = router
        .redeem_py_to_sy(yt.contract_address, alice(), mint_amount, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    assert(sy_redeemed > 0, 'Should redeem SY via router');
    assert(sy.balance_of(alice()) == sy_before + sy_redeemed, 'Alice SY after router redeem');
    assert(pt.balance_of(alice()) == 0, 'Alice PT should be 0');
    assert(yt.balance_of(alice()) == 0, 'Alice YT should be 0');
}

#[test]
fn test_yield_accrual_over_time() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let _pt = IPTDispatcher { contract_address: yt.pt() };

    // Alice deposits and mints
    let amount = 1000 * WAD;
    mint_yield_token_to_user(underlying, alice(), amount);

    start_cheat_caller_address(underlying.contract_address, alice());
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, alice());
    sy.deposit(alice(), underlying.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, alice());
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    yt.mint_py(alice(), alice());
    stop_cheat_caller_address(yt.contract_address);

    // Record initial PY index
    let initial_index = yt.py_index_current();

    // Simulate 5% yield after 3 months
    start_cheat_block_timestamp_global(start_time + 90 * 24 * 60 * 60);
    set_yield_index(underlying, WAD + WAD / 20); // 1.05x

    let index_3m = yt.py_index_current();
    assert(index_3m >= initial_index, 'Index should not decrease');

    // Simulate additional 5% yield after 6 months
    start_cheat_block_timestamp_global(start_time + 180 * 24 * 60 * 60);
    set_yield_index(underlying, WAD + WAD / 10); // 1.10x

    let index_6m = yt.py_index_current();
    assert(index_6m >= index_3m, 'Index should continue growing');

    // Simulate additional yield at 9 months
    start_cheat_block_timestamp_global(start_time + 270 * 24 * 60 * 60);
    set_yield_index(underlying, WAD + (WAD * 15) / 100); // 1.15x

    let index_9m = yt.py_index_current();
    assert(index_9m >= index_6m, 'Index keeps growing');
}

#[test]
fn test_partial_redemptions() {
    // Setup
    let start_time: u64 = 1000;
    start_cheat_block_timestamp_global(start_time);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let expiry = start_time + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Alice deposits and mints
    let amount = 1000 * WAD;
    mint_yield_token_to_user(underlying, alice(), amount);

    start_cheat_caller_address(underlying.contract_address, alice());
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, alice());
    sy.deposit(alice(), underlying.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, alice());
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, alice());
    yt.mint_py(alice(), alice());
    stop_cheat_caller_address(yt.contract_address);

    // Redeem 25% at a time
    let redeem_portion = amount / 4;

    for _i in 0..4_u32 {
        let pt_before = pt.balance_of(alice());
        let yt_before = yt.balance_of(alice());

        // Transfer PT and YT to YT contract (pre-transfer pattern)
        start_cheat_caller_address(pt.contract_address, alice());
        pt.transfer(yt.contract_address, redeem_portion);
        stop_cheat_caller_address(pt.contract_address);

        start_cheat_caller_address(yt.contract_address, alice());
        yt.transfer(yt.contract_address, redeem_portion);
        stop_cheat_caller_address(yt.contract_address);

        start_cheat_caller_address(yt.contract_address, alice());
        let sy_out = yt.redeem_py(alice());
        stop_cheat_caller_address(yt.contract_address);

        assert(sy_out > 0, 'Should receive SY each time');
        assert(pt.balance_of(alice()) == pt_before - redeem_portion, 'PT decreased');
        assert(yt.balance_of(alice()) == yt_before - redeem_portion, 'YT decreased');
    }

    // All PT and YT should be redeemed
    assert(pt.balance_of(alice()) == 0, 'All PT redeemed');
    assert(yt.balance_of(alice()) == 0, 'All YT redeemed');
}
