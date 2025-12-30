/// Market Expiry Edge Case Tests
/// Tests exact-moment behavior at expiry boundary
///
/// Key scenarios tested:
/// - Swaps fail at exact expiry timestamp
/// - Swaps succeed one second before expiry
/// - Liquidity withdrawal (burn) works at and after expiry

use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math_fp::WAD;
use horizon::mocks::mock_erc20::IMockERC20Dispatcher;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

// ============ Local ERC20 Interface for LP Token ============

/// Minimal ERC20 interface for accessing LP token balance
#[starknet::interface]
pub trait IERC20<TContractState> {
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
}

// ============ Constants ============

const CURRENT_TIME: u64 = 1000;
const ONE_YEAR: u64 = 365 * 86400;

// ============ Test Addresses ============

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn user1() -> ContractAddress {
    'user1'.try_into().unwrap()
}

// ============ Helper Functions ============

fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0); // data array length
    calldata.append(value); // pending_word
    calldata.append(len.into()); // pending_word_len
}

fn default_scalar_root() -> u256 {
    50 * WAD
}

fn default_initial_anchor() -> u256 {
    WAD / 10 // ~10% APY
}

fn default_fee_rate() -> u256 {
    WAD / 100 // 1% fee
}

// ============ Deploy Functions ============

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

fn deploy_yield_token_stack() -> (IMockERC20Dispatcher, IMockYieldTokenDispatcher) {
    let underlying = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(underlying.contract_address, admin());
    (underlying, yield_token)
}

fn deploy_sy(
    underlying: ContractAddress, index_oracle: ContractAddress, is_erc4626: bool,
) -> ISYDispatcher {
    let contract = declare("SY").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'SY Token', 8);
    append_bytearray(ref calldata, 'SY', 2);
    calldata.append(underlying.into());
    calldata.append(index_oracle.into());
    calldata.append(if is_erc4626 {
        1
    } else {
        0
    });
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
    append_bytearray(ref calldata, 'YT Token', 8);
    append_bytearray(ref calldata, 'YT', 2);
    calldata.append(sy.into());
    calldata.append((*pt_class.class_hash).into());
    calldata.append(expiry.into());
    calldata.append(admin().into()); // pauser

    let (contract_address, _) = yt_class.deploy(@calldata).unwrap_syscall();
    IYTDispatcher { contract_address }
}

fn deploy_market(
    pt: ContractAddress, scalar_root: u256, initial_anchor: u256, fee_rate: u256,
) -> IMarketDispatcher {
    let contract = declare("Market").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'PT-SY LP', 8);
    append_bytearray(ref calldata, 'LP', 2);
    calldata.append(pt.into());
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

// ============ Setup Functions ============

/// Full setup: underlying -> SY -> YT/PT -> Market
fn setup() -> (
    IMockYieldTokenDispatcher, ISYDispatcher, IYTDispatcher, IPTDispatcher, IMarketDispatcher,
) {
    // Set timestamp to a known value
    start_cheat_block_timestamp_global(CURRENT_TIME);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);

    // Expiry in ~1 year
    let expiry = CURRENT_TIME + ONE_YEAR;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let market = deploy_market(
        pt.contract_address, default_scalar_root(), default_initial_anchor(), default_fee_rate(),
    );

    (underlying, sy, yt, pt, market)
}

fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

fn setup_user_with_tokens(
    underlying: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    user: ContractAddress,
    amount: u256,
) {
    // Mint underlying to user
    mint_yield_token_to_user(underlying, user, amount * 2);

    // Approve and deposit to get SY
    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount * 2);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount * 2);
    stop_cheat_caller_address(sy.contract_address);

    // Approve SY for YT contract and mint PT+YT
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);
}

/// Add liquidity to the market
fn add_liquidity(
    market: IMarketDispatcher,
    sy: ISYDispatcher,
    pt: IPTDispatcher,
    user: ContractAddress,
    sy_amount: u256,
    pt_amount: u256,
) -> u256 {
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, sy_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, pt_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let (_, _, lp_minted) = market.mint(user, sy_amount, pt_amount);
    stop_cheat_caller_address(market.contract_address);

    lp_minted
}

/// Get user's LP balance
fn get_lp_balance(market: IMarketDispatcher, user: ContractAddress) -> u256 {
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    lp_token.balance_of(user)
}

// ============ Expiry Edge Case Tests ============

/// Test that swap fails at the exact expiry timestamp
/// The market should reject all swaps at t >= expiry
#[test]
#[should_panic(expected: 'HZN: market expired')]
fn test_swap_at_exact_expiry_fails() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();
    let expiry = CURRENT_TIME + ONE_YEAR;

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // Set time to EXACT expiry
    start_cheat_block_timestamp_global(expiry);

    // Approve SY for swap
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 10 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    // This swap should fail - market is expired
    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_sy_for_pt(user, 10 * WAD, 0);
    // Should not reach here
}

/// Test that liquidity withdrawal (burn) works at expiry
/// LPs should always be able to withdraw their funds
#[test]
fn test_liquidity_withdrawal_at_expiry_succeeds() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();
    let expiry = CURRENT_TIME + ONE_YEAR;

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    let lp_balance = add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // Set time to EXACT expiry
    start_cheat_block_timestamp_global(expiry);

    // Burn should still work at expiry
    start_cheat_caller_address(market.contract_address, user);
    let (sy_out, pt_out) = market.burn(user, lp_balance);
    stop_cheat_caller_address(market.contract_address);

    assert(sy_out > 0, 'Should get SY at expiry');
    assert(pt_out > 0, 'Should get PT at expiry');
}

/// Test that swap succeeds one second before expiry
/// The last possible moment for swapping
#[test]
fn test_swap_one_second_before_expiry_succeeds() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();
    let expiry = CURRENT_TIME + ONE_YEAR;

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // One second before expiry - last valid moment
    start_cheat_block_timestamp_global(expiry - 1);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 10 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let pt_out = market.swap_exact_sy_for_pt(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    assert(pt_out > 0, 'Should swap before expiry');
}

/// Test that liquidity withdrawal works after expiry
/// Even after expiry, LPs must be able to exit
#[test]
fn test_liquidity_withdrawal_after_expiry_succeeds() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();
    let expiry = CURRENT_TIME + ONE_YEAR;

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    let lp_balance = add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // Move 1 day after expiry
    start_cheat_block_timestamp_global(expiry + 86400);

    // Burn should still work after expiry
    start_cheat_caller_address(market.contract_address, user);
    let (sy_out, pt_out) = market.burn(user, lp_balance);
    stop_cheat_caller_address(market.contract_address);

    assert(sy_out > 0, 'Should get SY after expiry');
    assert(pt_out > 0, 'Should get PT after expiry');
}

/// Test that PT-for-SY swap also fails at expiry
/// Ensure both swap directions are blocked
#[test]
#[should_panic(expected: 'HZN: market expired')]
fn test_swap_pt_for_sy_at_exact_expiry_fails() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();
    let expiry = CURRENT_TIME + ONE_YEAR;

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // Set time to EXACT expiry
    start_cheat_block_timestamp_global(expiry);

    // Approve PT for swap
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 10 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    // This swap should fail - market is expired
    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 10 * WAD, 0);
    // Should not reach here
}

/// Test that minting liquidity fails at expiry
/// No new liquidity should be added to expired markets
#[test]
#[should_panic(expected: 'HZN: market expired')]
fn test_mint_at_exact_expiry_fails() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();
    let expiry = CURRENT_TIME + ONE_YEAR;

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // First add some liquidity before expiry
    add_liquidity(market, sy, pt, user, 50 * WAD, 50 * WAD);

    // Set time to EXACT expiry
    start_cheat_block_timestamp_global(expiry);

    // Try to add more liquidity - should fail
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 50 * WAD, 50 * WAD);
    // Should not reach here
}

/// Test is_expired() view function behavior
#[test]
fn test_is_expired_boundary() {
    let (_, _, _, _, market) = setup();
    let expiry = CURRENT_TIME + ONE_YEAR;

    // Before expiry
    start_cheat_block_timestamp_global(expiry - 1);
    assert(!market.is_expired(), 'Should not be expired before');

    // At exact expiry
    start_cheat_block_timestamp_global(expiry);
    assert(market.is_expired(), 'Should be expired at expiry');

    // After expiry
    start_cheat_block_timestamp_global(expiry + 1);
    assert(market.is_expired(), 'Should be expired after');
}
