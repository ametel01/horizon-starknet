/// Market Invariant Tests
///
/// This file tests critical market invariants that must hold regardless of the
/// sequence of operations. These invariants are derived from SPEC.md Section 15.1.
///
/// Invariants tested:
/// 1. Pool never empty: sy_reserve + pt_reserve > 0 after any operation
/// 2. Minimum liquidity: total_lp >= MINIMUM_LIQUIDITY always
/// 3. Proportion bounds: proportion in [MIN_PROPORTION, MAX_PROPORTION] post-trade
/// 4. Exchange rate floor: exchange_rate >= WAD (PT never worth more than SY)
/// 5. Non-negative fees: fees never negative
/// 6. No free value: output_amount <= economic_input_value

use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math_fp::WAD;
use horizon::market::market_math_fp::{
    MAX_PROPORTION, MINIMUM_LIQUIDITY, MIN_PROPORTION, MarketState, get_exchange_rate,
    get_market_pre_compute, get_proportion, get_time_to_expiry,
};
use horizon::mocks::mock_erc20::IMockERC20Dispatcher;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

// ============ Test Addresses ============

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn user1() -> ContractAddress {
    'user1'.try_into().unwrap()
}

fn user2() -> ContractAddress {
    'user2'.try_into().unwrap()
}

fn zero_address() -> ContractAddress {
    0.try_into().unwrap()
}

fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
}

// ============ Time Constants ============

const CURRENT_TIME: u64 = 1000000;
const ONE_YEAR: u64 = 365 * 86400;

// ============ Market Parameters ============

fn default_scalar_root() -> u256 {
    100 * WAD // 100 - realistic sensitivity for asset-based curve
}

fn default_initial_anchor() -> u256 {
    WAD / 2 // 50% ln_implied_rate gives exchange_rate ≈ 1.65
}

fn default_fee_rate() -> u256 {
    WAD / 100 // 1% fee
}

// ============ Helper Functions ============

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

fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

fn setup() -> (
    IMockYieldTokenDispatcher, ISYDispatcher, IYTDispatcher, IPTDispatcher, IMarketDispatcher,
) {
    start_cheat_block_timestamp_global(CURRENT_TIME);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);

    let expiry = CURRENT_TIME + ONE_YEAR;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let market = deploy_market(
        pt.contract_address, default_scalar_root(), default_initial_anchor(), default_fee_rate(),
    );

    (underlying, sy, yt, pt, market)
}

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

fn add_liquidity(
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

/// Build a MarketState struct from current market reserves
fn get_market_state(market: IMarketDispatcher) -> MarketState {
    let (sy_reserve, pt_reserve) = market.get_reserves();
    MarketState {
        sy_reserve,
        pt_reserve,
        total_lp: market.total_lp_supply(),
        scalar_root: market.get_scalar_root(),
        initial_anchor: market.get_initial_anchor(),
        ln_fee_rate_root: market.get_ln_fee_rate_root(),
        reserve_fee_percent: market.get_reserve_fee_percent(),
        expiry: market.expiry(),
        last_ln_implied_rate: market.get_ln_implied_rate(),
        py_index: WAD, // Use 1:1 ratio for invariant tests
        rate_impact_sensitivity: 0,
    }
}

// ============================================================================
// INVARIANT 1: Pool Never Empty After Initialization
// sy_reserve + pt_reserve > 0 after any operation (pool never empty)
// ============================================================================

#[test]
fn test_invariant_pool_not_empty_after_mint() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert(sy_reserve + pt_reserve > 0, 'INV1: pool empty after mint');
}

#[test]
fn test_invariant_pool_not_empty_after_swap() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // Perform swap
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 10 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert(sy_reserve + pt_reserve > 0, 'INV1: pool empty after swap');
}

#[test]
fn test_invariant_pool_not_empty_after_partial_burn() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    let (_, _, lp_minted) = add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // Burn half the LP
    start_cheat_caller_address(market.contract_address, user);
    market.burn(user, lp_minted / 2);
    stop_cheat_caller_address(market.contract_address);

    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert(sy_reserve + pt_reserve > 0, 'INV1: pool empty after burn');
}

#[test]
fn test_invariant_pool_not_empty_after_max_burn() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    let (_, _, lp_minted) = add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // Burn ALL user LP tokens
    start_cheat_caller_address(market.contract_address, user);
    market.burn(user, lp_minted);
    stop_cheat_caller_address(market.contract_address);

    // MINIMUM_LIQUIDITY is locked, so pool should never be fully empty
    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert(sy_reserve + pt_reserve > 0, 'INV1: pool empty after max burn');
}

// ============================================================================
// INVARIANT 2: Minimum Liquidity Guarantee
// total_lp >= MINIMUM_LIQUIDITY always
// ============================================================================

#[test]
fn test_invariant_minimum_liquidity_after_first_mint() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    let total_lp = market.total_lp_supply();
    assert(total_lp >= MINIMUM_LIQUIDITY, 'INV2: LP < MIN_LIQ after mint');
}

#[test]
fn test_invariant_minimum_liquidity_after_full_user_withdrawal() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    let (_, _, lp_minted) = add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // User burns all their LP
    start_cheat_caller_address(market.contract_address, user);
    market.burn(user, lp_minted);
    stop_cheat_caller_address(market.contract_address);

    // MINIMUM_LIQUIDITY should remain (locked to dead address)
    let total_lp = market.total_lp_supply();
    assert(total_lp >= MINIMUM_LIQUIDITY, 'INV2: LP < MIN_LIQ after burn');
}

#[test]
fn test_invariant_minimum_liquidity_with_small_initial_deposit() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    // Setup with smaller amounts
    setup_user_with_tokens(underlying, sy, yt, user, 10 * WAD);

    // Add small liquidity
    add_liquidity(market, sy, pt, user, WAD, WAD);

    let total_lp = market.total_lp_supply();
    assert(total_lp >= MINIMUM_LIQUIDITY, 'INV2: small deposit < MIN_LIQ');
}

#[test]
fn test_invariant_minimum_liquidity_multi_user_scenario() {
    let (underlying, sy, yt, pt, market) = setup();

    // User 1 adds initial liquidity
    setup_user_with_tokens(underlying, sy, yt, user1(), 200 * WAD);
    let (_, _, lp1) = add_liquidity(market, sy, pt, user1(), 100 * WAD, 100 * WAD);

    // User 2 adds more liquidity
    setup_user_with_tokens(underlying, sy, yt, user2(), 200 * WAD);
    let (_, _, lp2) = add_liquidity(market, sy, pt, user2(), 50 * WAD, 50 * WAD);

    // User 1 withdraws all
    start_cheat_caller_address(market.contract_address, user1());
    market.burn(user1(), lp1);
    stop_cheat_caller_address(market.contract_address);

    // User 2 withdraws all
    start_cheat_caller_address(market.contract_address, user2());
    market.burn(user2(), lp2);
    stop_cheat_caller_address(market.contract_address);

    // MINIMUM_LIQUIDITY should still be locked
    let total_lp = market.total_lp_supply();
    assert(total_lp >= MINIMUM_LIQUIDITY, 'INV2: multi-user < MIN_LIQ');
}

// ============================================================================
// INVARIANT 3: Proportion Bounds
// proportion always in [MIN_PROPORTION, MAX_PROPORTION] post-trade
// ============================================================================

#[test]
fn test_invariant_proportion_within_bounds_balanced() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    let state = get_market_state(market);
    let proportion = get_proportion(@state);

    assert(proportion >= MIN_PROPORTION, 'INV3: prop < MIN_PROP');
    assert(proportion <= MAX_PROPORTION, 'INV3: prop > MAX_PROP');
}

#[test]
fn test_invariant_proportion_after_pt_heavy_swap() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 500 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // Swap large amount of PT into pool (increases PT proportion)
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 50 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    let state = get_market_state(market);
    let proportion = get_proportion(@state);

    // Proportion should still be within bounds
    assert(proportion >= MIN_PROPORTION, 'INV3: PT heavy < MIN_PROP');
    assert(proportion <= MAX_PROPORTION, 'INV3: PT heavy > MAX_PROP');
}

#[test]
fn test_invariant_proportion_after_sy_heavy_swap() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 500 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // Swap moderate amount of SY into pool (decreases PT proportion)
    // Use 10% to stay within Pendle's exchange rate floor
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 10 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_sy_for_pt(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    let state = get_market_state(market);
    let proportion = get_proportion(@state);

    // Proportion should still be within bounds
    assert(proportion >= MIN_PROPORTION, 'INV3: SY heavy < MIN_PROP');
    assert(proportion <= MAX_PROPORTION, 'INV3: SY heavy > MAX_PROP');
}

/// Test asymmetric liquidity: user2 provides more PT than SY
/// Market should normalize to the limiting factor (min ratio)
#[test]
fn test_invariant_proportion_after_asymmetric_liquidity() {
    let (underlying, sy, yt, pt, market) = setup();
    let user1_addr = user1();
    let user2_addr = user2();

    setup_user_with_tokens(underlying, sy, yt, user1_addr, 400 * WAD);
    setup_user_with_tokens(underlying, sy, yt, user2_addr, 400 * WAD);

    // First deposit must be balanced (contract requires it)
    add_liquidity(market, sy, pt, user1_addr, 100 * WAD, 100 * WAD);

    // Second deposit: attempt asymmetric (more PT than SY)
    // Note: calc_mint_lp uses min ratio, so excess is refunded
    start_cheat_caller_address(sy.contract_address, user2_addr);
    sy.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user2_addr);
    pt.approve(market.contract_address, 100 * WAD); // Approve more PT
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user2_addr);
    let (sy_used, pt_used, _lp) = market.mint(user2_addr, 50 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Verify the contract normalizes to the limiting factor
    // sy_used should equal pt_used (min ratio applied)
    assert(sy_used == pt_used, 'Should use equal amounts');
    assert(sy_used == 50 * WAD, 'Should use SY amount as limit');

    let state = get_market_state(market);
    let proportion = get_proportion(@state);

    assert(proportion >= MIN_PROPORTION, 'INV3: asym < MIN_PROP');
    assert(proportion <= MAX_PROPORTION, 'INV3: asym > MAX_PROP');
}

// ============================================================================
// INVARIANT 4: Exchange Rate Floor
// exchange_rate >= WAD always (PT never worth more than SY)
// ============================================================================

#[test]
fn test_invariant_exchange_rate_floor_initial() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    let state = get_market_state(market);
    let time_to_expiry = get_time_to_expiry(market.expiry(), CURRENT_TIME);
    let comp = get_market_pre_compute(@state, time_to_expiry);

    let exchange_rate = get_exchange_rate(
        state.pt_reserve,
        comp.total_asset,
        0,
        false,
        comp.rate_scalar,
        comp.rate_anchor,
        comp.rate_anchor_is_negative,
    );

    assert(exchange_rate >= WAD, 'INV4: rate < WAD initial');
}

#[test]
fn test_invariant_exchange_rate_floor_after_swap() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // Do a swap
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 30 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 30 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    let state = get_market_state(market);
    let time_to_expiry = get_time_to_expiry(market.expiry(), CURRENT_TIME);
    let comp = get_market_pre_compute(@state, time_to_expiry);

    let exchange_rate = get_exchange_rate(
        state.pt_reserve,
        comp.total_asset,
        0,
        false,
        comp.rate_scalar,
        comp.rate_anchor,
        comp.rate_anchor_is_negative,
    );

    assert(exchange_rate >= WAD, 'INV4: rate < WAD after swap');
}

#[test]
fn test_invariant_exchange_rate_floor_near_expiry() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // Move time close to expiry (1 day before)
    let near_expiry_time = market.expiry() - 86400;
    start_cheat_block_timestamp_global(near_expiry_time);

    let state = get_market_state(market);
    let time_to_expiry = get_time_to_expiry(market.expiry(), near_expiry_time);
    let comp = get_market_pre_compute(@state, time_to_expiry);

    let exchange_rate = get_exchange_rate(
        state.pt_reserve,
        comp.total_asset,
        0,
        false,
        comp.rate_scalar,
        comp.rate_anchor,
        comp.rate_anchor_is_negative,
    );

    assert(exchange_rate >= WAD, 'INV4: rate < WAD near expiry');
}

#[test]
fn test_invariant_exchange_rate_floor_with_imbalanced_pool() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 500 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // Create imbalanced pool by swapping (use 10% to stay within rate floor)
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 10 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_sy_for_pt(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    let state = get_market_state(market);
    let time_to_expiry = get_time_to_expiry(market.expiry(), CURRENT_TIME);
    let comp = get_market_pre_compute(@state, time_to_expiry);

    let exchange_rate = get_exchange_rate(
        state.pt_reserve,
        comp.total_asset,
        0,
        false,
        comp.rate_scalar,
        comp.rate_anchor,
        comp.rate_anchor_is_negative,
    );

    // Exchange rate must always be >= 1.0 (Pendle's invariant)
    assert(exchange_rate >= WAD, 'INV4: rate < WAD imbalanced');
}

// ============================================================================
// INVARIANT 5: Non-Negative Fees
// Fees never negative
// ============================================================================

#[test]
fn test_invariant_fees_non_negative_pt_for_sy() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    let fees_before = market.get_total_fees_collected();

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 10 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    let fees_after = market.get_total_fees_collected();

    // Fees should increase or stay same, never decrease
    assert(fees_after >= fees_before, 'INV5: fees decreased PT->SY');
}

#[test]
fn test_invariant_fees_non_negative_sy_for_pt() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    let fees_before = market.get_total_fees_collected();

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 10 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_sy_for_pt(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    let fees_after = market.get_total_fees_collected();

    assert(fees_after >= fees_before, 'INV5: fees decreased SY->PT');
}

#[test]
fn test_invariant_fees_accumulate_correctly() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 500 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // Multiple swaps should accumulate fees
    let mut prev_fees = market.get_total_fees_collected();

    // Swap 1
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 20 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    let fees_1 = market.get_total_fees_collected();
    assert(fees_1 >= prev_fees, 'INV5: swap1 fees decreased');
    prev_fees = fees_1;

    // Swap 2
    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    let fees_2 = market.get_total_fees_collected();
    assert(fees_2 >= prev_fees, 'INV5: swap2 fees decreased');
}

// ============================================================================
// INVARIANT 6: No Free Value
// output_amount <= input_amount in economic terms (no arbitrage from single swap)
// ============================================================================

#[test]
fn test_invariant_no_free_value_pt_for_sy() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    let pt_in = 10 * WAD;

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, pt_in);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let sy_out = market.swap_exact_pt_for_sy(user, pt_in, 0);
    stop_cheat_caller_address(market.contract_address);

    // PT trades at a discount to SY (PT < SY), so sy_out should be less than pt_in
    // This is the core Pendle model: PT is worth less than underlying until expiry
    assert(sy_out <= pt_in, 'INV6: got more SY than PT input');
}

#[test]
fn test_invariant_no_free_value_sy_for_pt() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    let sy_in = 10 * WAD;

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, sy_in);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let pt_out = market.swap_exact_sy_for_pt(user, sy_in, 0);
    stop_cheat_caller_address(market.contract_address);

    // Since PT trades at discount, you should get MORE PT for SY
    // But after fees, pt_out should be reasonable (not infinite)
    // The invariant here is that the trade respects the exchange rate
    // For this test we verify pt_out > 0 and is bounded
    assert(pt_out > 0, 'INV6: got zero PT');
    // PT trades at discount, so pt_out should be roughly proportional
    // Max 2x is reasonable (with fees, time value, slippage)
    assert(pt_out < sy_in * 2, 'INV6: PT output too large');
}

#[test]
fn test_invariant_no_free_value_exact_output_swaps() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    let exact_pt_out = 5 * WAD;

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let sy_spent = market.swap_sy_for_exact_pt(user, exact_pt_out, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // You should spend positive SY to get PT
    assert(sy_spent > 0, 'INV6: got free PT');
    // Since PT is at discount, you should spend less SY than the PT you get
    // (economically, SY is worth more than PT before expiry)
    assert(sy_spent <= exact_pt_out, 'INV6: SY spent > PT received');
}

#[test]
fn test_invariant_no_free_value_pt_for_exact_sy() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    // Use larger pool to avoid hitting proportion bounds during binary search
    // With Pendle's 96% max proportion, binary search on smaller pools can
    // attempt PT values that exceed the bound during intermediate steps
    setup_user_with_tokens(underlying, sy, yt, user, 2000 * WAD);
    add_liquidity(market, sy, pt, user, 500 * WAD, 500 * WAD);

    let exact_sy_out = 5 * WAD;

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let pt_spent = market.swap_pt_for_exact_sy(user, exact_sy_out, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // You should spend positive PT to get SY
    assert(pt_spent > 0, 'INV6: got free SY');
    // Since PT is at discount, you should spend more PT than the SY you get
    assert(pt_spent >= exact_sy_out, 'INV6: PT spent < SY received');
}

// ============================================================================
// SLIPPAGE PROTECTION TESTS
// Verify that slippage parameters are actually enforced
// ============================================================================

/// Test that slippage protection rejects swaps with unreasonable min_sy_out
#[test]
#[should_panic(expected: 'HZN: slippage exceeded')]
fn test_slippage_protection_pt_for_sy() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    let pt_in = 10 * WAD;

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, pt_in);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    // Request unreasonably high min_sy_out (should fail)
    // Swapping 10 WAD PT cannot yield 100 WAD SY
    market.swap_exact_pt_for_sy(user, pt_in, 100 * WAD);
    // Should not reach here
}

/// Test that slippage protection rejects swaps with unreasonable min_pt_out
#[test]
#[should_panic(expected: 'HZN: slippage exceeded')]
fn test_slippage_protection_sy_for_pt() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    let sy_in = 10 * WAD;

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, sy_in);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    // Request unreasonably high min_pt_out (should fail)
    // Swapping 10 WAD SY cannot yield 100 WAD PT
    market.swap_exact_sy_for_pt(user, sy_in, 100 * WAD);
    // Should not reach here
}

/// Test that slippage protection accepts reasonable min_out
#[test]
fn test_slippage_protection_accepts_reasonable_min() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    let pt_in = 10 * WAD;

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, pt_in);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    // 1 WAD is reasonable since PT trades at discount to SY
    let sy_out = market.swap_exact_pt_for_sy(user, pt_in, WAD);
    stop_cheat_caller_address(market.contract_address);

    assert(sy_out >= WAD, 'Should meet min_sy_out');
}

// ============================================================================
// COMPOUND INVARIANT TESTS
// Test multiple invariants hold after complex sequences
// ============================================================================

#[test]
fn test_compound_invariants_after_multiple_swaps() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    // Use larger pool (1000 WAD) to handle sequential trades without hitting rate floor
    setup_user_with_tokens(underlying, sy, yt, user, 5000 * WAD);
    add_liquidity(market, sy, pt, user, 1000 * WAD, 1000 * WAD);

    // Perform multiple swaps in both directions (small relative to pool)
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 10 * WAD, 0);
    market.swap_exact_sy_for_pt(user, 8 * WAD, 0);
    market.swap_exact_pt_for_sy(user, 5 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    // Check all invariants
    let (sy_reserve, pt_reserve) = market.get_reserves();
    let total_lp = market.total_lp_supply();
    let state = get_market_state(market);
    let proportion = get_proportion(@state);
    let time_to_expiry = get_time_to_expiry(market.expiry(), CURRENT_TIME);
    let comp = get_market_pre_compute(@state, time_to_expiry);
    // get_exchange_rate takes (pt_reserve, total_asset, ...) - use comp.total_asset for asset-based
    // curve
    let exchange_rate = get_exchange_rate(
        state.pt_reserve,
        comp.total_asset,
        0,
        false,
        comp.rate_scalar,
        comp.rate_anchor,
        comp.rate_anchor_is_negative,
    );

    // INV1: Pool not empty
    assert(sy_reserve + pt_reserve > 0, 'COMPOUND: pool empty');

    // INV2: Minimum liquidity
    assert(total_lp >= MINIMUM_LIQUIDITY, 'COMPOUND: LP < MIN');

    // INV3: Proportion bounds
    assert(proportion >= MIN_PROPORTION, 'COMPOUND: prop < MIN');
    assert(proportion <= MAX_PROPORTION, 'COMPOUND: prop > MAX');

    // INV4: Exchange rate floor
    assert(exchange_rate >= WAD, 'COMPOUND: rate < WAD');
}

#[test]
fn test_compound_invariants_multi_user_operations() {
    let (underlying, sy, yt, pt, market) = setup();

    // Setup multiple users with larger amounts for bigger pool
    setup_user_with_tokens(underlying, sy, yt, user1(), 3000 * WAD);
    setup_user_with_tokens(underlying, sy, yt, user2(), 2000 * WAD);

    // User 1 adds larger liquidity (1000 WAD each side)
    let (_, _, lp1) = add_liquidity(market, sy, pt, user1(), 1000 * WAD, 1000 * WAD);

    // User 2 adds liquidity
    add_liquidity(market, sy, pt, user2(), 500 * WAD, 500 * WAD);

    // User 1 swaps (small relative to 1500 WAD pool)
    start_cheat_caller_address(pt.contract_address, user1());
    pt.approve(market.contract_address, 20 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user1());
    market.swap_exact_pt_for_sy(user1(), 20 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    // User 2 swaps in opposite direction
    start_cheat_caller_address(sy.contract_address, user2());
    sy.approve(market.contract_address, 15 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, user2());
    market.swap_exact_sy_for_pt(user2(), 15 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    // User 1 removes some liquidity
    start_cheat_caller_address(market.contract_address, user1());
    market.burn(user1(), lp1 / 2);
    stop_cheat_caller_address(market.contract_address);

    // Check all invariants still hold
    let (sy_reserve, pt_reserve) = market.get_reserves();
    let total_lp = market.total_lp_supply();
    let state = get_market_state(market);
    let proportion = get_proportion(@state);

    assert(sy_reserve + pt_reserve > 0, 'MULTI: pool empty');
    assert(total_lp >= MINIMUM_LIQUIDITY, 'MULTI: LP < MIN');
    assert(proportion >= MIN_PROPORTION, 'MULTI: prop < MIN');
    assert(proportion <= MAX_PROPORTION, 'MULTI: prop > MAX');
}

#[test]
fn test_compound_invariants_near_expiry() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);
    add_liquidity(market, sy, pt, user, 100 * WAD, 100 * WAD);

    // Move close to expiry
    let near_expiry = market.expiry() - 3600; // 1 hour before expiry
    start_cheat_block_timestamp_global(near_expiry);

    // Perform swap near expiry
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 10 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let sy_out = market.swap_exact_pt_for_sy(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    // Near expiry, PT approaches 1:1 with SY
    // sy_out should be close to 10 * WAD (minus small fee)
    // Allow 5% deviation for fees and curve effects
    let min_expected = (10 * WAD * 95) / 100;
    assert(sy_out >= min_expected, 'EXPIRY: output too low');

    // Check invariants
    let (sy_reserve, pt_reserve) = market.get_reserves();
    let state = get_market_state(market);
    let proportion = get_proportion(@state);

    assert(sy_reserve + pt_reserve > 0, 'EXPIRY: pool empty');
    assert(proportion >= MIN_PROPORTION, 'EXPIRY: prop < MIN');
    assert(proportion <= MAX_PROPORTION, 'EXPIRY: prop > MAX');
}
