/// Integration tests for PT/YT/LP Oracle Helper (py_lp_oracle.cairo)
///
/// Tests the oracle helper contract that calculates TWAP prices:
/// - PT/YT/LP rates in SY terms (duration=0 uses spot, >0 uses TWAP)
/// - PT/YT/LP rates in asset terms (adjusts for SY exchange rate)
/// - check_oracle_state() for readiness verification
/// - Cardinality requirement calculations
///
/// Run with: snforge test test_py_lp_oracle

use horizon::interfaces::i_market::{
    IMarketDispatcher, IMarketDispatcherTrait, IMarketOracleDispatcher,
    IMarketOracleDispatcherTrait,
};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_py_lp_oracle::{IPyLpOracleDispatcher, IPyLpOracleDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math_fp::WAD;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_number_global,
    start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

// ============================================
// TEST SETUP
// ============================================

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn user1() -> ContractAddress {
    'user1'.try_into().unwrap()
}

fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
}

const INITIAL_TIME: u64 = 1000;
const ONE_HOUR: u64 = 3600;
const ONE_DAY: u64 = 86400;
const ONE_YEAR: u64 = 365 * 86400;

fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0);
    calldata.append(value);
    calldata.append(len.into());
}

fn default_scalar_root() -> u256 {
    50 * WAD
}

fn default_initial_anchor() -> u256 {
    WAD / 10
}

fn default_fee_rate() -> u256 {
    WAD / 100
}

fn deploy_mock_erc20() -> ContractAddress {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'MockERC20', 9);
    append_bytearray(ref calldata, 'MERC', 4);
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    contract_address
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
    calldata.append(0);
    calldata.append(admin().into());
    calldata.append(1);
    calldata.append(underlying.into());
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
    calldata.append(treasury().into());
    calldata.append(18);

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
    calldata.append(0);
    calldata.append(admin().into());
    calldata.append(0);

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketDispatcher { contract_address }
}

fn deploy_py_lp_oracle() -> IPyLpOracleDispatcher {
    let contract = declare("PyLpOracle").unwrap_syscall().contract_class();
    let calldata = array![];
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IPyLpOracleDispatcher { contract_address }
}

fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

fn set_yield_index(yield_token: IMockYieldTokenDispatcher, new_index: u256) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.set_yield_rate_bps(0);
    yield_token.set_index(new_index);
    stop_cheat_caller_address(yield_token.contract_address);

    let block_num: u64 = (new_index / 1000000000000000).try_into().unwrap_or(1000) + 1;
    start_cheat_block_number_global(block_num);
}

/// Full test setup
fn setup() -> (
    IMockYieldTokenDispatcher,
    ISYDispatcher,
    IYTDispatcher,
    IPTDispatcher,
    IMarketDispatcher,
    IPyLpOracleDispatcher,
) {
    start_cheat_block_timestamp_global(INITIAL_TIME);

    let underlying = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(underlying, admin());
    let sy = deploy_sy(yield_token.contract_address, yield_token.contract_address, true);

    let expiry = INITIAL_TIME + ONE_YEAR;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let market = deploy_market(
        pt.contract_address, default_scalar_root(), default_initial_anchor(), default_fee_rate(),
    );

    let py_lp_oracle = deploy_py_lp_oracle();

    (yield_token, sy, yt, pt, market, py_lp_oracle)
}

fn setup_user_with_tokens(
    yield_token: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    user: ContractAddress,
    amount: u256,
) {
    mint_yield_token_to_user(yield_token, user, amount * 2);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount * 2);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, yield_token.contract_address, amount * 2, 0);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);
}

fn setup_market_with_liquidity(
    yield_token: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    pt: IPTDispatcher,
    market: IMarketDispatcher,
) {
    let user = user1();
    setup_user_with_tokens(yield_token, sy, yt, user, 200 * WAD);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);
}

// ============================================
// PT TO SY RATE TESTS
// ============================================

#[test]
fn test_get_pt_to_sy_rate_duration_zero() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Duration 0 should use spot rate
    let pt_rate = oracle.get_pt_to_sy_rate(market.contract_address, 0);

    // PT price should be < WAD (PT trades at discount before expiry)
    assert(pt_rate > 0, 'PT rate should be > 0');
    assert(pt_rate < WAD, 'PT rate should be < WAD');
}

#[test]
fn test_get_pt_to_sy_rate_after_expiry() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Move past expiry
    start_cheat_block_timestamp_global(INITIAL_TIME + ONE_YEAR + ONE_DAY);

    let pt_rate = oracle.get_pt_to_sy_rate(market.contract_address, 0);

    // After expiry, PT = 1 SY
    assert(pt_rate == WAD, 'PT should be 1:1 after expiry');
}

#[test]
fn test_get_pt_to_sy_rate_with_twap() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    let market_oracle = IMarketOracleDispatcher { contract_address: market.contract_address };
    let user = user1();

    // Increase cardinality for TWAP support
    market_oracle.increase_observations_cardinality_next(100);

    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Record rate at T=0
    let spot_rate_t0 = oracle.get_pt_to_sy_rate(market.contract_address, 0);

    // Do a swap at T+30min to change the rate and create a new observation
    start_cheat_block_timestamp_global(INITIAL_TIME + 1800);
    setup_user_with_tokens(yield_token, sy, yt, user, 50 * WAD);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 20 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 15 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    // Do another swap at T+1h to create more history
    start_cheat_block_timestamp_global(INITIAL_TIME + ONE_HOUR);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 5 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    // Record spot rate after swaps (at T+1h)
    let spot_rate_t1 = oracle.get_pt_to_sy_rate(market.contract_address, 0);

    // The spot rate should have changed from t0 to t1
    assert(spot_rate_t1 != spot_rate_t0, 'spot rate should change');

    // Query with 30-minute TWAP (covers T+30min to T+1h)
    let twap_rate = oracle.get_pt_to_sy_rate(market.contract_address, 1800);

    // TWAP should be positive and less than WAD
    assert(twap_rate > 0, 'PT rate should be > 0');
    assert(twap_rate < WAD, 'PT rate should be < WAD');

    // Verify we actually have multiple observations (not just interpolated)
    let state = market_oracle.get_oracle_state();
    assert(state.observation_index >= 2, 'should have 2+ observations');
}

// ============================================
// YT TO SY RATE TESTS
// ============================================

#[test]
fn test_get_yt_to_sy_rate_before_expiry() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let yt_rate = oracle.get_yt_to_sy_rate(market.contract_address, 0);

    // YT = WAD - PT before expiry
    let pt_rate = oracle.get_pt_to_sy_rate(market.contract_address, 0);
    let expected_yt = WAD - pt_rate;

    assert(yt_rate == expected_yt, 'YT should be WAD - PT');
}

#[test]
fn test_get_yt_to_sy_rate_after_expiry() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Move past expiry
    start_cheat_block_timestamp_global(INITIAL_TIME + ONE_YEAR + ONE_DAY);

    let yt_rate = oracle.get_yt_to_sy_rate(market.contract_address, 0);

    // After expiry, YT is worthless
    assert(yt_rate == 0, 'YT should be 0 after expiry');
}

// ============================================
// LP TO SY RATE TESTS
// ============================================

#[test]
fn test_get_lp_to_sy_rate() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let lp_rate = oracle.get_lp_to_sy_rate(market.contract_address, 0);

    // LP should have positive value
    assert(lp_rate > 0, 'LP rate should be > 0');

    // With 100 SY + 100 PT reserves and ~100 LP, LP value should be around 2 WAD
    // (since PT trades close to 1:1 with initial_anchor at 10% APY)
    assert(lp_rate > WAD / 2, 'LP rate should be substantial');
}

#[test]
fn test_get_lp_to_sy_rate_empty_pool() {
    let (_, _, _, _, market, oracle) = setup();

    // Empty pool should return WAD (default 1:1)
    let lp_rate = oracle.get_lp_to_sy_rate(market.contract_address, 0);

    assert(lp_rate == WAD, 'empty pool returns WAD');
}

// ============================================
// ASSET-DENOMINATED RATE TESTS
// ============================================

#[test]
fn test_get_pt_to_asset_rate() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Set yield index to 1.1 (10% yield)
    set_yield_index(yield_token, 11 * WAD / 10);

    let pt_to_asset = oracle.get_pt_to_asset_rate(market.contract_address, 0);
    let pt_to_sy = oracle.get_pt_to_sy_rate(market.contract_address, 0);

    // Asset rate should be higher than SY rate (multiplied by exchange rate)
    assert(pt_to_asset > pt_to_sy, 'asset rate > SY rate');
}

#[test]
fn test_get_yt_to_asset_rate() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    set_yield_index(yield_token, 11 * WAD / 10);

    let yt_to_asset = oracle.get_yt_to_asset_rate(market.contract_address, 0);
    let yt_to_sy = oracle.get_yt_to_sy_rate(market.contract_address, 0);

    // Asset rate should be higher (multiplied by exchange rate)
    assert(yt_to_asset > yt_to_sy, 'asset rate > SY rate');
}

#[test]
fn test_get_lp_to_asset_rate() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    set_yield_index(yield_token, 11 * WAD / 10);

    let lp_to_asset = oracle.get_lp_to_asset_rate(market.contract_address, 0);
    let lp_to_sy = oracle.get_lp_to_sy_rate(market.contract_address, 0);

    // Asset rate should be higher (multiplied by exchange rate)
    assert(lp_to_asset > lp_to_sy, 'asset rate > SY rate');
}

// ============================================
// CHECK ORACLE STATE TESTS
// ============================================

#[test]
fn test_check_oracle_state_initial() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Initial state: cardinality=1, only 1 observation
    let state = oracle.check_oracle_state(market.contract_address, ONE_HOUR.try_into().unwrap());

    // With cardinality=1 and short history, increase is required
    assert(state.increase_cardinality_required == true, 'should need more cardinality');

    // Required cardinality for 1 hour (3600s / 10s min_block_time + 1 = 361)
    assert(state.cardinality_required > 1, 'should need > 1');

    // Oldest observation is not old enough (we just created it)
    assert(state.oldest_observation_satisfied == false, 'oldest not satisfied');
}

#[test]
fn test_check_oracle_state_after_increase() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    let market_oracle = IMarketOracleDispatcher { contract_address: market.contract_address };

    // Increase cardinality before adding liquidity
    market_oracle.increase_observations_cardinality_next(500);

    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let state = oracle.check_oracle_state(market.contract_address, ONE_HOUR.try_into().unwrap());

    // Now cardinality should be sufficient for 1 hour
    // 3600s / 10s = 360 + 1 = 361 needed, we have 500
    assert(state.increase_cardinality_required == false, 'should not need increase');
}

#[test]
fn test_check_oracle_state_oldest_satisfied() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    let market_oracle = IMarketOracleDispatcher { contract_address: market.contract_address };

    market_oracle.increase_observations_cardinality_next(500);
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Advance time by more than the requested duration
    start_cheat_block_timestamp_global(INITIAL_TIME + 2 * ONE_HOUR);

    // Query 30 minutes TWAP - oldest observation from INITIAL_TIME should be old enough
    let state = oracle.check_oracle_state(market.contract_address, 1800);

    // After 2 hours, 30 min history should be satisfied
    assert(state.oldest_observation_satisfied == true, 'oldest should be satisfied');
}

#[test]
fn test_check_oracle_state_short_duration() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Very short duration (10 seconds) - should need minimal cardinality
    let state = oracle.check_oracle_state(market.contract_address, 10);

    // Should need 2 observations for any TWAP
    assert(state.cardinality_required == 2, 'should need 2 for minimal');
}

// ============================================
// GET_LN_IMPLIED_RATE_TWAP TESTS
// ============================================

#[test]
fn test_get_ln_implied_rate_twap_duration_zero() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    let market_oracle = IMarketOracleDispatcher { contract_address: market.contract_address };

    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Duration 0 should return stored rate
    let twap = oracle.get_ln_implied_rate_twap(market.contract_address, 0);
    let state = market_oracle.get_oracle_state();

    assert(twap == state.last_ln_implied_rate, 'should equal stored rate');
}

#[test]
fn test_get_ln_implied_rate_twap_non_zero_duration() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    let market_oracle = IMarketOracleDispatcher { contract_address: market.contract_address };
    let user = user1();

    market_oracle.increase_observations_cardinality_next(100);
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Record spot rate at T=0
    let spot_rate_t0 = market_oracle.get_oracle_state().last_ln_implied_rate;

    // Create new observation at T+30min by doing a swap
    start_cheat_block_timestamp_global(INITIAL_TIME + 1800);
    setup_user_with_tokens(yield_token, sy, yt, user, 30 * WAD);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 15 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    // Create another observation at T+1h
    start_cheat_block_timestamp_global(INITIAL_TIME + ONE_HOUR);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 5 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    // Record spot rate after swaps
    let spot_rate_t1 = market_oracle.get_oracle_state().last_ln_implied_rate;

    // Spot rate should have changed (swaps affect implied rate)
    assert(spot_rate_t1 != spot_rate_t0, 'spot rate should change');

    // Query TWAP over last 30 minutes
    let twap = oracle.get_ln_implied_rate_twap(market.contract_address, 1800);

    // TWAP should be positive
    assert(twap > 0, 'TWAP should be > 0');

    // Verify we have multiple observations
    let state = market_oracle.get_oracle_state();
    assert(state.observation_index >= 2, 'should have 2+ observations');
}

// ============================================
// PT + YT = WAD INVARIANT TESTS
// ============================================

#[test]
fn test_pt_plus_yt_equals_wad() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let pt_rate = oracle.get_pt_to_sy_rate(market.contract_address, 0);
    let yt_rate = oracle.get_yt_to_sy_rate(market.contract_address, 0);

    // PT + YT should equal WAD (principal token + yield token = 1 SY worth)
    assert(pt_rate + yt_rate == WAD, 'PT + YT should equal WAD');
}

#[test]
fn test_pt_plus_yt_equals_wad_with_twap() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    let market_oracle = IMarketOracleDispatcher { contract_address: market.contract_address };
    let user = user1();

    market_oracle.increase_observations_cardinality_next(100);
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Build real observation history with swaps at different times
    start_cheat_block_timestamp_global(INITIAL_TIME + 1800);
    setup_user_with_tokens(yield_token, sy, yt, user, 30 * WAD);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 15 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    start_cheat_block_timestamp_global(INITIAL_TIME + ONE_HOUR);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 5 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    // Verify we built real history
    let state = market_oracle.get_oracle_state();
    assert(state.observation_index >= 2, 'should have 2+ observations');

    let pt_rate = oracle.get_pt_to_sy_rate(market.contract_address, 1800);
    let yt_rate = oracle.get_yt_to_sy_rate(market.contract_address, 1800);

    // Invariant should hold for TWAP rates too
    assert(pt_rate + yt_rate == WAD, 'PT + YT should equal WAD');
}

// ============================================
// TIME PROGRESSION TESTS
// ============================================

#[test]
fn test_pt_price_increases_toward_expiry() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let pt_rate_early = oracle.get_pt_to_sy_rate(market.contract_address, 0);

    // Advance 6 months
    start_cheat_block_timestamp_global(INITIAL_TIME + ONE_YEAR / 2);

    let pt_rate_mid = oracle.get_pt_to_sy_rate(market.contract_address, 0);

    // PT price should increase as we approach expiry
    // (less time to expiry = less discounting)
    assert(pt_rate_mid > pt_rate_early, 'PT should increase toward exp');
}

#[test]
fn test_yt_price_decreases_toward_expiry() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let yt_rate_early = oracle.get_yt_to_sy_rate(market.contract_address, 0);

    // Advance 6 months
    start_cheat_block_timestamp_global(INITIAL_TIME + ONE_YEAR / 2);

    let yt_rate_mid = oracle.get_yt_to_sy_rate(market.contract_address, 0);

    // YT price should decrease (less yield remaining)
    assert(yt_rate_mid < yt_rate_early, 'YT should decrease toward exp');
}

// ============================================
// EDGE CASES
// ============================================

#[test]
fn test_rates_with_high_yield_index() {
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Set high yield index (2x - 100% yield)
    set_yield_index(yield_token, 2 * WAD);

    let pt_to_asset = oracle.get_pt_to_asset_rate(market.contract_address, 0);
    let pt_to_sy = oracle.get_pt_to_sy_rate(market.contract_address, 0);

    // With 2x index, asset rate should be ~2x SY rate
    // Using approximate check since there might be rounding
    let expected_min = pt_to_sy * 19 / 10; // 1.9x
    assert(pt_to_asset >= expected_min, 'asset rate should be ~2x SY');
}

#[test]
fn test_lp_rate_bounds() {
    // Test LP rate against independent economic bounds, not the same formula
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let lp_to_sy = oracle.get_lp_to_sy_rate(market.contract_address, 0);
    let (sy_reserve, pt_reserve) = market.get_reserves();
    let total_lp = market.total_lp_supply();
    let pt_price = oracle.get_pt_to_sy_rate(market.contract_address, 0);

    // LOWER BOUND: LP value >= (sy_reserve + pt_reserve * pt_price) / total_lp
    // Since PT is discounted (pt_price < WAD), LP gets minimum value from this
    // This is the fair value - LP should be at least this much
    let pt_value_discounted = pt_reserve * pt_price / WAD;
    let fair_value_in_sy = sy_reserve + pt_value_discounted;
    let lower_bound = fair_value_in_sy * WAD / total_lp;
    // Allow 1% tolerance for fixed-point precision
    assert(lp_to_sy >= lower_bound * 99 / 100, 'LP below fair value');

    // UPPER BOUND: LP value <= (sy_reserve + pt_reserve) / total_lp
    // Even if PT=WAD (at expiry), LP can't exceed this
    let max_value_in_sy = sy_reserve + pt_reserve;
    let upper_bound = max_value_in_sy * WAD / total_lp;
    assert(lp_to_sy <= upper_bound, 'LP above max value');

    // PT DISCOUNT REFLECTED: Since pt_price < WAD, LP rate should be less than upper_bound
    // This ensures the PT discount is actually applied, not ignored
    assert(pt_price < WAD, 'PT should be discounted');
    assert(lp_to_sy < upper_bound, 'PT discount not applied');
}

#[test]
fn test_lp_rate_responds_to_reserves() {
    // Test that LP rate changes correctly when reserves change
    let (yield_token, sy, yt, pt, market, oracle) = setup();
    let user = user1();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let lp_rate_before = oracle.get_lp_to_sy_rate(market.contract_address, 0);

    // Add more liquidity (increases reserves proportionally)
    setup_user_with_tokens(yield_token, sy, yt, user, 60 * WAD);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 50 * WAD, 50 * WAD);
    stop_cheat_caller_address(market.contract_address);

    let lp_rate_after = oracle.get_lp_to_sy_rate(market.contract_address, 0);

    // LP rate should stay similar (proportional add doesn't change per-LP value much)
    // Allow 5% tolerance for rate changes due to proportional adds
    let diff = if lp_rate_after > lp_rate_before {
        lp_rate_after - lp_rate_before
    } else {
        lp_rate_before - lp_rate_after
    };
    let tolerance = lp_rate_before / 20;
    assert(diff <= tolerance, 'LP rate unstable on add');
}
