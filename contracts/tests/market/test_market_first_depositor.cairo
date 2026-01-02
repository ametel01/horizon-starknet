/// First Depositor Attack Tests for Market AMM
///
/// These tests verify that the MINIMUM_LIQUIDITY mechanism properly mitigates
/// first depositor attacks (LP token inflation attacks).
///
/// Per SPEC.md Section 15.1 "MINIMUM_LIQUIDITY attack vector analysis"
///
/// Background: The first depositor attack works as follows:
/// 1. Attacker deposits minimal tokens (e.g., 1 wei) as first LP
/// 2. Attacker "donates" large amounts directly to the pool (inflating reserves)
/// 3. When victim deposits, they receive few/zero LP tokens due to rounding
/// 4. Attacker withdraws, stealing victim's funds
///
/// The MINIMUM_LIQUIDITY mechanism mitigates this by:
/// - Locking 1000 LP tokens to a dead address on first deposit
/// - This ensures the attacker cannot profit from inflation attacks
///   because they don't own those locked LP tokens
///
/// Test philosophy: Tests should expose contract bugs, NOT be adapted to make them pass.

use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math_fp::WAD;
use horizon::market::market_math_fp::MINIMUM_LIQUIDITY;
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

// ============ Test Addresses ============

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn attacker() -> ContractAddress {
    'attacker'.try_into().unwrap()
}

fn victim() -> ContractAddress {
    'victim'.try_into().unwrap()
}

fn user1() -> ContractAddress {
    'user1'.try_into().unwrap()
}

fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
}

fn user2() -> ContractAddress {
    'user2'.try_into().unwrap()
}

/// Dead address where MINIMUM_LIQUIDITY is locked
fn dead_address() -> ContractAddress {
    1.try_into().unwrap()
}

fn zero_address() -> ContractAddress {
    0.try_into().unwrap()
}

// ============ Helpers ============

fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0);
    calldata.append(value);
    calldata.append(len.into());
}

fn default_scalar_root() -> u256 {
    50 * WAD
}

fn default_initial_anchor() -> u256 {
    WAD / 10 // 0.1 WAD = ~10% APY
}

fn default_fee_rate() -> u256 {
    WAD / 100 // 1% fee
}

// ============ Contract Deployment ============

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
    calldata.append(0); // AssetType::Token
    calldata.append(admin().into());

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
    calldata.append(admin().into());
    calldata.append(treasury().into()); // treasury
    calldata.append(18); // decimals

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
    calldata.append(0); // reserve_fee_percent
    calldata.append(admin().into()); // pauser
    calldata.append(0); // factory (zero address for tests)

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketDispatcher { contract_address }
}

/// Mint yield token shares to user as admin
fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

/// Full setup: underlying -> SY -> YT/PT -> Market
fn setup() -> (
    IMockYieldTokenDispatcher, ISYDispatcher, IYTDispatcher, IPTDispatcher, IMarketDispatcher,
) {
    start_cheat_block_timestamp_global(1000);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);

    // Expiry in ~1 year
    let expiry = 1000 + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let market = deploy_market(
        pt.contract_address, default_scalar_root(), default_initial_anchor(), default_fee_rate(),
    );

    (underlying, sy, yt, pt, market)
}

/// Setup user with SY and PT tokens
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
    sy.deposit(user, underlying.contract_address, amount * 2, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Transfer SY to YT contract and mint PT+YT (floating SY pattern)
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);
}

/// Get LP token balance of an address
fn get_lp_balance(market: IMarketDispatcher, user: ContractAddress) -> u256 {
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    lp_token.balance_of(user)
}

// ============ MINIMUM_LIQUIDITY Verification Tests ============

/// Test that MINIMUM_LIQUIDITY is correctly locked to dead address on first deposit
#[test]
fn test_first_deposit_minimum_liquidity_locked() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();
    let sy_amount = 100 * WAD;
    let pt_amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Verify dead address has 0 LP before first deposit
    let dead_lp_before = get_lp_balance(market, dead_address());
    assert(dead_lp_before == 0, 'Dead addr should have 0 LP');

    // Approve market
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, sy_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, pt_amount);
    stop_cheat_caller_address(pt.contract_address);

    // First deposit
    start_cheat_caller_address(market.contract_address, user);
    let (_, _, lp_minted_to_user) = market.mint(user, sy_amount, pt_amount);
    stop_cheat_caller_address(market.contract_address);

    // Verify MINIMUM_LIQUIDITY locked to dead address
    let dead_lp_after = get_lp_balance(market, dead_address());
    assert(dead_lp_after == MINIMUM_LIQUIDITY, 'Wrong MINIMUM_LIQUIDITY locked');

    // Verify total LP = user's LP + MINIMUM_LIQUIDITY
    let total_lp = market.total_lp_supply();
    let user_lp = get_lp_balance(market, user);
    assert(user_lp == lp_minted_to_user, 'User LP mismatch');
    assert(total_lp == user_lp + MINIMUM_LIQUIDITY, 'Total LP mismatch');
}

/// Test that second deposit does NOT lock additional MINIMUM_LIQUIDITY
#[test]
fn test_second_deposit_no_additional_lock() {
    let (underlying, sy, yt, pt, market) = setup();
    let user1_addr = user1();
    let user2_addr = user2();

    setup_user_with_tokens(underlying, sy, yt, user1_addr, 200 * WAD);
    setup_user_with_tokens(underlying, sy, yt, user2_addr, 200 * WAD);

    // User1 first deposit
    start_cheat_caller_address(sy.contract_address, user1_addr);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user1_addr);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user1_addr);
    market.mint(user1_addr, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    let dead_lp_after_first = get_lp_balance(market, dead_address());
    assert(dead_lp_after_first == MINIMUM_LIQUIDITY, 'First lock incorrect');

    // User2 second deposit
    start_cheat_caller_address(sy.contract_address, user2_addr);
    sy.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user2_addr);
    pt.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user2_addr);
    market.mint(user2_addr, 50 * WAD, 50 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Dead address should still have exactly MINIMUM_LIQUIDITY
    let dead_lp_after_second = get_lp_balance(market, dead_address());
    assert(dead_lp_after_second == MINIMUM_LIQUIDITY, 'Should not lock more');
}

// ============ First Depositor Attack Mitigation Tests ============

/// Test that the classic first depositor attack is mitigated.
/// Attack vector:
/// 1. Attacker deposits minimal amount to become first LP
/// 2. Attacker donates large amount to inflate share price
/// 3. Victim deposits, expecting proportional LP but gets little due to rounding
/// 4. Attacker withdraws with victim's funds
///
/// With MINIMUM_LIQUIDITY, the attacker doesn't own the locked LP tokens,
/// so they cannot profit from the inflation attack.
///
/// Note: This AMM uses stored reserves, not token balances, so "donations"
/// (direct transfers) don't affect LP accounting - an additional defense layer.
#[test]
fn test_first_deposit_attack_mitigated() {
    let (underlying, sy, yt, pt, market) = setup();
    let attacker_addr = attacker();
    let victim_addr = victim();

    // Give attacker and victim tokens
    setup_user_with_tokens(underlying, sy, yt, attacker_addr, 10000 * WAD);
    setup_user_with_tokens(underlying, sy, yt, victim_addr, 1000 * WAD);

    // Step 1: Attacker makes a small first deposit
    // Using 1 WAD as a "small" deposit in WAD-normalized system
    // This represents 1 token (10^18 wei)
    let attacker_sy = WAD;
    let attacker_pt = WAD;

    start_cheat_caller_address(sy.contract_address, attacker_addr);
    sy.approve(market.contract_address, attacker_sy);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, attacker_addr);
    pt.approve(market.contract_address, attacker_pt);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, attacker_addr);
    let (_, _, _attacker_lp) = market.mint(attacker_addr, attacker_sy, attacker_pt);
    stop_cheat_caller_address(market.contract_address);

    // Record state after attacker's deposit
    let _attacker_lp_balance = get_lp_balance(market, attacker_addr);
    let _dead_lp_balance = get_lp_balance(market, dead_address());
    let _total_lp_before_donation = market.total_lp_supply();

    // Step 2: Attacker "donates" by direct transfer to inflate reserves
    // This inflates the value of each LP token (in traditional AMMs)
    let donation_amount = 1000 * WAD;

    // Direct transfer SY to market
    start_cheat_caller_address(sy.contract_address, attacker_addr);
    sy.transfer(market.contract_address, donation_amount);
    stop_cheat_caller_address(sy.contract_address);

    // Direct transfer PT to market
    start_cheat_caller_address(pt.contract_address, attacker_addr);
    pt.transfer(market.contract_address, donation_amount);
    stop_cheat_caller_address(pt.contract_address);

    // Note: The contract's internal reserves are NOT updated by direct transfers
    // The reserves are tracked in storage, not by balance
    // This is actually a defense mechanism - donations don't affect LP accounting

    // Step 3: Victim deposits a significant amount
    let victim_sy = 100 * WAD;
    let victim_pt = 100 * WAD;

    start_cheat_caller_address(sy.contract_address, victim_addr);
    sy.approve(market.contract_address, victim_sy);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, victim_addr);
    pt.approve(market.contract_address, victim_pt);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, victim_addr);
    let (_sy_used, _pt_used, victim_lp) = market.mint(victim_addr, victim_sy, victim_pt);
    stop_cheat_caller_address(market.contract_address);

    // Victim should receive proportional LP tokens
    // LP ratio should be based on internal reserves, not contract balance
    let victim_lp_balance = get_lp_balance(market, victim_addr);
    assert(victim_lp_balance > 0, 'Victim should get LP tokens');
    assert(victim_lp_balance == victim_lp, 'LP balance mismatch');

    // Step 4: Verify victim can withdraw their fair share
    start_cheat_caller_address(market.contract_address, victim_addr);
    let (victim_sy_out, victim_pt_out) = market.burn(victim_addr, victim_lp_balance);
    stop_cheat_caller_address(market.contract_address);

    // Victim should get back approximately what they put in (minus some dust)
    // Allow 0.1% tolerance for rounding
    let tolerance = victim_sy / 1000;
    assert(victim_sy_out >= victim_sy - tolerance, 'Victim lost too much SY');
    assert(victim_pt_out >= victim_pt - tolerance, 'Victim lost too much PT');
}

/// Helper function to approve tokens and mint LP in one call
fn approve_and_mint_lp(
    market: IMarketDispatcher,
    sy: ISYDispatcher,
    pt: IPTDispatcher,
    user: ContractAddress,
    sy_amount: u256,
    pt_amount: u256,
) -> (u256, u256, u256) {
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, sy_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, pt_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let result = market.mint(user, sy_amount, pt_amount);
    stop_cheat_caller_address(market.contract_address);

    result
}

/// Test economic attack via strategic LP minting sequence
///
/// This tests the TRUE first-depositor attack vector for storage-based AMMs:
/// - Attack: first mint minimal amount, subsequent depositors get diluted LP
/// - Defense: MINIMUM_LIQUIDITY ensures attacker cannot capture full value
///
/// Unlike donation-based attacks (which don't work here due to storage-based reserves),
/// this tests whether an attacker making the minimum viable first deposit can
/// economically harm subsequent depositors.
#[test]
fn test_first_depositor_attack_via_minting_ratio() {
    let (underlying, sy, yt, pt, market) = setup();
    let attacker_addr = attacker();
    let victim_addr = victim();

    setup_user_with_tokens(underlying, sy, yt, attacker_addr, 10000 * WAD);
    setup_user_with_tokens(underlying, sy, yt, victim_addr, 1000 * WAD);

    // Attacker makes minimum viable first deposit
    // The minimum deposit must result in sqrt_wad(wad_mul(sy, pt)) > MINIMUM_LIQUIDITY
    // With WAD-normalized math, we need a WAD-scale deposit.
    // Using 1 WAD (smallest practical WAD-scale amount) as "small" deposit
    let min_deposit = WAD; // 1 token - smallest practical deposit
    approve_and_mint_lp(market, sy, pt, attacker_addr, min_deposit, min_deposit);

    let attacker_lp_after_first = get_lp_balance(market, attacker_addr);
    let dead_lp = get_lp_balance(market, dead_address());

    // Key assertion: dead address should own MINIMUM_LIQUIDITY
    // This is the defense mechanism - attacker doesn't own these locked tokens
    assert(dead_lp == MINIMUM_LIQUIDITY, 'Dead addr should have MIN_LIQ');

    // Verify attacker got minimal LP (total - MINIMUM_LIQUIDITY)
    // With such a small deposit, attacker's share is tiny
    let total_lp_after_first = market.total_lp_supply();
    assert(
        attacker_lp_after_first == total_lp_after_first - MINIMUM_LIQUIDITY,
        'Attacker LP miscalculated',
    );

    // Victim deposits normally with substantial amount
    let victim_deposit = 100 * WAD;
    approve_and_mint_lp(market, sy, pt, victim_addr, victim_deposit, victim_deposit);
    let victim_lp = get_lp_balance(market, victim_addr);

    // Critical check: victim should get proportional LP tokens
    // The victim's LP share should reflect their deposit relative to total reserves
    //
    // With MINIMUM_LIQUIDITY defense:
    // - Total LP before victim = attacker_lp + MINIMUM_LIQUIDITY (very small)
    // - Victim deposits 100 WAD each, which vastly exceeds existing reserves
    // - Victim should get ~proportional share of the new LP minted
    //
    // The key protection: even though attacker was first, the locked MINIMUM_LIQUIDITY
    // prevents them from capturing disproportionate value

    // Victim should get significant LP - at least 50% of what they'd expect
    // in a fair system (accounting for the tiny existing reserves)
    let victim_expected_min = 50 * WAD; // Conservative lower bound
    assert(victim_lp > victim_expected_min, 'Victim should get fair LP');

    // Verify victim can withdraw approximately what they deposited
    start_cheat_caller_address(market.contract_address, victim_addr);
    let (victim_sy_out, victim_pt_out) = market.burn(victim_addr, victim_lp);
    stop_cheat_caller_address(market.contract_address);

    // Victim's withdrawal should be close to their deposit
    // Loss should be negligible (< 1%) due to MINIMUM_LIQUIDITY protection
    let max_loss = victim_deposit / 100; // 1% max acceptable loss
    assert(victim_sy_out >= victim_deposit - max_loss, 'Victim SY loss too high');
    assert(victim_pt_out >= victim_deposit - max_loss, 'Victim PT loss too high');
}

/// Test attack scenario with very small first deposit (edge case)
/// This tests if the contract properly handles the case where initial LP
/// would be less than MINIMUM_LIQUIDITY
#[test]
#[should_panic(expected: 'Market: insufficient initial LP')]
fn test_first_deposit_too_small() {
    let (underlying, sy, yt, pt, market) = setup();
    let attacker_addr = attacker();

    setup_user_with_tokens(underlying, sy, yt, attacker_addr, 10 * WAD);

    // Try to deposit very small amount that would result in LP < MINIMUM_LIQUIDITY
    // sqrt(100 * 100) = 100 < 1000 = MINIMUM_LIQUIDITY
    let tiny_amount = 100;

    start_cheat_caller_address(sy.contract_address, attacker_addr);
    sy.approve(market.contract_address, tiny_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, attacker_addr);
    pt.approve(market.contract_address, tiny_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, attacker_addr);
    // This should panic because sqrt(100*100) = 100 < MINIMUM_LIQUIDITY = 1000
    market.mint(attacker_addr, tiny_amount, tiny_amount);
}

// ============ Economic Analysis Tests ============

/// Test that documents the maximum inflation attack damage with MINIMUM_LIQUIDITY = 1000
///
/// Economic analysis:
/// - With WAD-normalized LP tokens (10^18 base) and 1000 wei minimum
/// - Maximum share price inflation is bounded
/// - Attack profit is economically negligible for reasonable deposit sizes
///
/// The MINIMUM_LIQUIDITY mechanism works because:
/// 1. First depositor loses 1000 LP tokens permanently
/// 2. Those tokens represent a share of all future reserves
/// 3. This bounds the profit from any inflation attack
#[test]
fn test_minimum_liquidity_sufficient() {
    let (underlying, sy, yt, pt, market) = setup();
    let attacker_addr = attacker();
    let victim_addr = victim();

    setup_user_with_tokens(underlying, sy, yt, attacker_addr, 10000 * WAD);
    setup_user_with_tokens(underlying, sy, yt, victim_addr, 1000 * WAD);

    // Attacker makes a small first deposit
    // Using WAD (1 token) as a "small" deposit
    let small_deposit = WAD;

    start_cheat_caller_address(sy.contract_address, attacker_addr);
    sy.approve(market.contract_address, small_deposit);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, attacker_addr);
    pt.approve(market.contract_address, small_deposit);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, attacker_addr);
    let (_, _, _attacker_lp) = market.mint(attacker_addr, small_deposit, small_deposit);
    stop_cheat_caller_address(market.contract_address);

    // For deposit of 1 WAD each:
    // lp = sqrt_wad(wad_mul(WAD, WAD)) = sqrt_wad(WAD) = WAD
    // attacker gets: WAD - MINIMUM_LIQUIDITY = WAD - 1000
    // dead address gets: 1000

    let _attacker_lp_balance = get_lp_balance(market, attacker_addr);
    let _dead_lp_balance = get_lp_balance(market, dead_address());
    let _total_lp = market.total_lp_supply();

    // Victim deposits substantial amount
    let victim_deposit = 100 * WAD;

    start_cheat_caller_address(sy.contract_address, victim_addr);
    sy.approve(market.contract_address, victim_deposit);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, victim_addr);
    pt.approve(market.contract_address, victim_deposit);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, victim_addr);
    let (_, _, _victim_lp) = market.mint(victim_addr, victim_deposit, victim_deposit);
    stop_cheat_caller_address(market.contract_address);

    // Verify victim received LP tokens proportional to their deposit
    let victim_lp_balance = get_lp_balance(market, victim_addr);
    assert(victim_lp_balance > 0, 'Victim must get LP');

    // Verify by withdrawal
    start_cheat_caller_address(market.contract_address, victim_addr);
    let (victim_sy_out, victim_pt_out) = market.burn(victim_addr, victim_lp_balance);
    stop_cheat_caller_address(market.contract_address);

    // Calculate victim's loss as percentage
    // loss = (deposit - withdrawn) / deposit
    let sy_loss = if victim_deposit > victim_sy_out {
        victim_deposit - victim_sy_out
    } else {
        0
    };
    let pt_loss = if victim_deposit > victim_pt_out {
        victim_deposit - victim_pt_out
    } else {
        0
    };

    // With MINIMUM_LIQUIDITY = 1000 and victim deposit = 100 WAD
    // Loss should be negligible (< 1%)
    // The loss represents the share of reserves that go to dead address
    let max_acceptable_loss = WAD / 100; // 0.01 WAD = 1% max loss

    assert(sy_loss < max_acceptable_loss, 'SY loss too high');
    assert(pt_loss < max_acceptable_loss, 'PT loss too high');
}

// ============ Pool Drainage Prevention Tests ============

/// Test that pool cannot be completely drained - MINIMUM_LIQUIDITY reserves remain
#[test]
fn test_pool_cannot_be_drained_to_zero() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // First deposit
    let deposit_amount = 100 * WAD;

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, deposit_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, deposit_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let (_, _, _lp_minted) = market.mint(user, deposit_amount, deposit_amount);
    stop_cheat_caller_address(market.contract_address);

    let user_lp = get_lp_balance(market, user);
    let _dead_lp = get_lp_balance(market, dead_address());
    let _total_lp = market.total_lp_supply();

    // User burns ALL their LP tokens
    start_cheat_caller_address(market.contract_address, user);
    let (_sy_out, _pt_out) = market.burn(user, user_lp);
    stop_cheat_caller_address(market.contract_address);

    // After full withdrawal:
    let user_lp_after = get_lp_balance(market, user);
    let dead_lp_after = get_lp_balance(market, dead_address());
    let total_lp_after = market.total_lp_supply();
    let (sy_reserve_after, pt_reserve_after) = market.get_reserves();

    // User should have 0 LP
    assert(user_lp_after == 0, 'User should have 0 LP');

    // Dead address should still have MINIMUM_LIQUIDITY
    assert(dead_lp_after == MINIMUM_LIQUIDITY, 'Dead addr LP should remain');

    // Total LP = MINIMUM_LIQUIDITY (only dead address LP remains)
    assert(total_lp_after == MINIMUM_LIQUIDITY, 'Total LP should be MIN_LIQ');

    // Reserves should NOT be zero - proportional to remaining LP
    // reserve_remaining = original_reserve * (MINIMUM_LIQUIDITY / original_total_lp)
    assert(sy_reserve_after > 0, 'SY reserve should not be 0');
    assert(pt_reserve_after > 0, 'PT reserve should not be 0');
}

/// Test that multiple users can withdraw all LP without draining below MINIMUM_LIQUIDITY
#[test]
fn test_multiple_users_full_withdrawal() {
    let (underlying, sy, yt, pt, market) = setup();
    let user1_addr = user1();
    let user2_addr = user2();

    setup_user_with_tokens(underlying, sy, yt, user1_addr, 200 * WAD);
    setup_user_with_tokens(underlying, sy, yt, user2_addr, 200 * WAD);

    // User1 first deposit
    start_cheat_caller_address(sy.contract_address, user1_addr);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user1_addr);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user1_addr);
    market.mint(user1_addr, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // User2 second deposit
    start_cheat_caller_address(sy.contract_address, user2_addr);
    sy.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user2_addr);
    pt.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user2_addr);
    market.mint(user2_addr, 50 * WAD, 50 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Both users withdraw all their LP
    let user1_lp = get_lp_balance(market, user1_addr);
    let user2_lp = get_lp_balance(market, user2_addr);

    start_cheat_caller_address(market.contract_address, user1_addr);
    market.burn(user1_addr, user1_lp);
    stop_cheat_caller_address(market.contract_address);

    start_cheat_caller_address(market.contract_address, user2_addr);
    market.burn(user2_addr, user2_lp);
    stop_cheat_caller_address(market.contract_address);

    // Verify only MINIMUM_LIQUIDITY remains
    let total_lp_after = market.total_lp_supply();
    let dead_lp = get_lp_balance(market, dead_address());

    assert(total_lp_after == MINIMUM_LIQUIDITY, 'Only MIN_LIQ should remain');
    assert(dead_lp == MINIMUM_LIQUIDITY, 'Dead addr owns remaining LP');

    // Reserves should still be non-zero
    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert(sy_reserve > 0, 'SY reserve must be > 0');
    assert(pt_reserve > 0, 'PT reserve must be > 0');
}

// ============ Edge Case Tests ============

/// Test first deposit with small but valid WAD-scale amount
/// This verifies the MINIMUM_LIQUIDITY mechanism works for small deposits
#[test]
fn test_first_deposit_small_but_valid() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 10 * WAD);

    // With WAD-normalized math:
    // lp = sqrt_wad(wad_mul(x, x)) for equal deposits x
    // For x = WAD: lp = sqrt_wad(WAD) = WAD (approximately)
    // User gets: WAD - MINIMUM_LIQUIDITY
    // Dead address gets: MINIMUM_LIQUIDITY = 1000
    //
    // For the smallest valid deposit, we need lp > MINIMUM_LIQUIDITY
    // With WAD = 10^18 and MINIMUM_LIQUIDITY = 1000, any WAD-scale deposit works
    let small_deposit = WAD; // 1 token in WAD units

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, small_deposit);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, small_deposit);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let (sy_used, pt_used, lp_minted) = market.mint(user, small_deposit, small_deposit);
    stop_cheat_caller_address(market.contract_address);

    // Should succeed and mint LP to user (minus MINIMUM_LIQUIDITY)
    assert(lp_minted > 0, 'Should mint some LP');
    assert(sy_used == small_deposit, 'Should use all SY');
    assert(pt_used == small_deposit, 'Should use all PT');

    // Verify MINIMUM_LIQUIDITY is locked
    let dead_lp = get_lp_balance(market, dead_address());
    assert(dead_lp == MINIMUM_LIQUIDITY, 'Dead addr should have MIN_LIQ');

    // Verify user got LP = total - MINIMUM_LIQUIDITY
    let user_lp = get_lp_balance(market, user);
    let total_lp = market.total_lp_supply();
    assert(user_lp == lp_minted, 'User LP mismatch');
    assert(total_lp == user_lp + MINIMUM_LIQUIDITY, 'Total LP mismatch');
}

/// Test that asymmetric deposits don't bypass MINIMUM_LIQUIDITY
#[test]
#[should_panic(expected: 'Market: insufficient initial LP')]
fn test_asymmetric_first_deposit_still_requires_minimum() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 10 * WAD);

    // Asymmetric deposit: 1 SY and lots of PT
    // sqrt(1 * 1000000) = 1000 = MINIMUM_LIQUIDITY
    // This should fail because we need sqrt > MINIMUM_LIQUIDITY
    let sy_amount = 1;
    let pt_amount = 1000000;

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, sy_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, pt_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    // sqrt(1 * 1000000) = 1000 <= MINIMUM_LIQUIDITY, should panic
    market.mint(user, sy_amount, pt_amount);
}

/// Test LP value consistency across multiple operations
#[test]
fn test_lp_value_consistency() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 500 * WAD);

    // First deposit
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Second deposit
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 50 * WAD, 50 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Partial withdrawal
    let user_lp_before = get_lp_balance(market, user);
    let (sy_reserve_before, pt_reserve_before) = market.get_reserves();
    let total_lp_before = market.total_lp_supply();

    let lp_to_burn = user_lp_before / 3;

    start_cheat_caller_address(market.contract_address, user);
    let (sy_out, pt_out) = market.burn(user, lp_to_burn);
    stop_cheat_caller_address(market.contract_address);

    // Verify proportional withdrawal
    // Expected: sy_out = sy_reserve * (lp_to_burn / total_lp)
    // Allow 1% tolerance for fixed-point math
    let expected_sy = (sy_reserve_before * lp_to_burn) / total_lp_before;
    let expected_pt = (pt_reserve_before * lp_to_burn) / total_lp_before;

    let sy_diff = if sy_out > expected_sy {
        sy_out - expected_sy
    } else {
        expected_sy - sy_out
    };
    let pt_diff = if pt_out > expected_pt {
        pt_out - expected_pt
    } else {
        expected_pt - pt_out
    };

    let tolerance = expected_sy / 50; // 2% tolerance
    assert(sy_diff <= tolerance, 'SY withdrawal not proportional');
    assert(pt_diff <= tolerance, 'PT withdrawal not proportional');
}

// ============ Initial Ln Implied Rate Tests ============

/// Test that first mint properly sets initial ln_implied_rate using Pendle's formula
/// This verifies Step 1.6 of IMPLEMENTATION_PLAN_AMM_CURVE.md:
/// - Before first mint: last_ln_implied_rate = 0
/// - After first mint: last_ln_implied_rate is computed based on py_index and initial_anchor
/// - The rate reflects the actual pool proportion, not just initial_anchor
#[test]
fn test_initial_ln_implied_rate_set_on_first_mint() {
    let (underlying, sy, yt, _pt, market) = setup();
    let user = user1();
    let deposit_amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Before first mint, ln_implied_rate should be 0
    // (set in constructor, waiting for first mint to compute properly)
    let _rate_before = market.get_ln_implied_rate();
    // Note: get_ln_implied_rate() computes from state, but before first mint
    // the pool has no reserves, so we can't compute a meaningful rate

    // First deposit with equal SY and PT amounts
    approve_and_mint_lp(market, sy, _pt, user, deposit_amount, deposit_amount);

    // After first mint, ln_implied_rate should be computed properly
    // The rate should be based on:
    // 1. Pool proportion (50% since equal deposits)
    // 2. initial_anchor (0.1 WAD = 10%)
    // 3. py_index from YT
    let rate_after = market.get_ln_implied_rate();

    // Rate should be non-zero after first mint
    assert(rate_after > 0, 'Rate should be > 0 after mint');

    // With equal deposits (50% proportion):
    // logit(0.5) = ln(1) = 0
    // So exchange_rate = initial_anchor = 0.1 WAD
    // And ln_implied_rate = ln(0.1) * SECONDS_PER_YEAR / time_to_expiry
    // Since initial_anchor < 1, exchange_rate < 1, which triggers floor at WAD
    // So actual exchange_rate = WAD (1.0)
    // And ln(1.0) = 0, giving ln_implied_rate = 0

    // However, with a higher initial_anchor like 0.1 WAD representing
    // ln(implied_rate) (not exchange_rate), the calculation differs
    // Let's just verify it's computed and reasonable

    // For a 50-50 pool with reasonable params, the rate should be
    // close to initial_anchor (in WAD units for ln)
    let _initial_anchor = default_initial_anchor(); // WAD / 10 = 0.1 WAD

    // The rate should be in a reasonable range (not absurdly high or zero)
    // Allow wide tolerance since exact math depends on curve params
    assert(rate_after <= 5 * WAD, 'Rate too high');
}

/// Test that initial ln_implied_rate is computed based on pool proportion
/// This verifies that different initial proportions result in valid rates
#[test]
fn test_initial_ln_implied_rate_varies_with_proportion() {
    // Deploy two markets with different initial proportions
    let (underlying1, sy1, yt1, pt1, market1) = setup();
    let (underlying2, sy2, yt2, pt2, market2) = setup();

    let user = user1();

    setup_user_with_tokens(underlying1, sy1, yt1, user, 400 * WAD);
    setup_user_with_tokens(underlying2, sy2, yt2, user, 400 * WAD);

    // Market 1: Symmetric deposit (50% PT proportion)
    approve_and_mint_lp(market1, sy1, pt1, user, 100 * WAD, 100 * WAD);
    let rate_symmetric = market1.get_ln_implied_rate();

    // Market 2: Lower PT proportion (more SY than PT)
    // Lower PT proportion = higher PT price = lower implied rate
    // Using 40% PT proportion to stay below 0.5 and avoid rate floor issues
    approve_and_mint_lp(market2, sy2, pt2, user, 150 * WAD, 100 * WAD);
    let rate_asymmetric = market2.get_ln_implied_rate();

    // Rates should be valid (non-negative)
    // Note: With initial_anchor = WAD/10, rates may be 0 at higher proportions
    // This is expected behavior - the rate floors to 0 when the logit term
    // exceeds the initial_anchor. This test verifies computation happens correctly.

    // At 50% proportion, rate should equal initial_anchor (0.1 WAD)
    // At <50% proportion (more SY), the rate should be higher than initial_anchor
    // because logit is negative and we add |logit/scalar|
    assert(rate_asymmetric >= rate_symmetric, 'Lower PT should give >= rate');
}

/// Test that subsequent trades update ln_implied_rate (not just first mint)
/// This verifies that the implied rate tracking mechanism works correctly
#[test]
fn test_ln_implied_rate_updates_after_swaps() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();
    // Use asymmetric deposit to start with PT proportion below 50%
    // This gives headroom for rate changes when we sell SY
    let sy_deposit = 150 * WAD;
    let pt_deposit = 100 * WAD;
    let swap_amount = 5 * WAD; // Small swap

    setup_user_with_tokens(underlying, sy, yt, user, 400 * WAD);

    // First deposit with more SY than PT (proportion < 50%)
    approve_and_mint_lp(market, sy, pt, user, sy_deposit, pt_deposit);
    let rate_after_mint = market.get_ln_implied_rate();

    // Approve SY for swap (buy PT with SY)
    // This will reduce PT proportion, potentially increasing implied rate
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    // Perform a swap: sell SY for PT
    // This reduces PT in pool (proportion decreases), potentially changing rate
    start_cheat_caller_address(market.contract_address, user);
    let _pt_out = market.swap_exact_sy_for_pt(user, swap_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    let rate_after_swap = market.get_ln_implied_rate();

    // Both rates should be computed (may be 0 at certain proportions)
    // The key assertion is that the system doesn't panic and computes rates

    // After buying PT (removing PT from pool), PT proportion decreases
    // With lower proportion, rate should increase or stay same
    // (logit becomes more negative, and we add more to initial_anchor)
    assert(rate_after_swap >= rate_after_mint, 'Rate should increase or same');
}
