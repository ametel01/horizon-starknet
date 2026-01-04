/// Integration tests for Market TWAP Oracle functionality
///
/// Tests the Market contract's TWAP oracle integration:
/// - Constructor initializes observation correctly
/// - Swaps and mints write observations
/// - observe() computes TWAP correctly
/// - increase_observations_cardinality_next() grows buffer
/// - get_oracle_state() returns correct values
/// - Same-block operations don't create duplicate observations
///
/// Run with: snforge test test_market_oracle

use horizon::interfaces::i_market::{
    IMarketDispatcher, IMarketDispatcherTrait, IMarketOracleDispatcher,
    IMarketOracleDispatcherTrait,
};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math_fp::WAD;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

// ============================================
// TEST SETUP
// ============================================

// Test addresses
fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn user1() -> ContractAddress {
    'user1'.try_into().unwrap()
}

fn user2() -> ContractAddress {
    'user2'.try_into().unwrap()
}

fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
}

// Initial timestamp for tests
const INITIAL_TIME: u64 = 1000;
const ONE_HOUR: u64 = 3600;
const ONE_DAY: u64 = 86400;
const ONE_YEAR: u64 = 365 * 86400;

// Helper to serialize ByteArray for calldata
fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0);
    calldata.append(value);
    calldata.append(len.into());
}

// Default market parameters
fn default_scalar_root() -> u256 {
    50 * WAD
}

fn default_initial_anchor() -> u256 {
    WAD / 10 // 10% APY
}

fn default_fee_rate() -> u256 {
    WAD / 100 // 1% fee
}

// Deploy mock ERC20
fn deploy_mock_erc20() -> starknet::ContractAddress {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'MockERC20', 9);
    append_bytearray(ref calldata, 'MERC', 4);
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    contract_address
}

// Deploy mock yield token
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

// Deploy SY token
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

    calldata.append(1);
    calldata.append(underlying.into());
    calldata.append(1);
    calldata.append(underlying.into());

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    ISYDispatcher { contract_address }
}

// Deploy YT (which deploys PT internally)
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

// Deploy Market
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
    calldata.append(admin().into());
    calldata.append(0); // factory (zero for standalone)

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketDispatcher { contract_address }
}

// Helper: Mint yield token shares to user as admin
fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

// Full setup
fn setup() -> (
    IMockYieldTokenDispatcher, ISYDispatcher, IYTDispatcher, IPTDispatcher, IMarketDispatcher,
) {
    start_cheat_block_timestamp_global(INITIAL_TIME);

    let underlying_addr = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(underlying_addr, admin());
    let sy = deploy_sy(yield_token.contract_address, yield_token.contract_address, true);

    let expiry = INITIAL_TIME + ONE_YEAR;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let market = deploy_market(
        pt.contract_address, default_scalar_root(), default_initial_anchor(), default_fee_rate(),
    );

    (yield_token, sy, yt, pt, market)
}

// Helper: Setup user with SY and PT tokens
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

// ============================================
// CONSTRUCTOR TESTS
// ============================================

#[test]
fn test_constructor_initializes_observation() {
    let (_, _, _, _, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };

    // Check oracle state
    let state = oracle.get_oracle_state();
    assert(state.observation_cardinality == 1, 'cardinality should be 1');
    assert(state.observation_cardinality_next == 1, 'cardinality_next should be 1');
    assert(state.observation_index == 0, 'index should be 0');
    assert(state.last_ln_implied_rate == 0, 'initial rate should be 0');

    // Check first observation
    let (ts, cumulative, initialized) = oracle.get_observation(0);
    assert(ts == INITIAL_TIME, 'wrong timestamp');
    assert(cumulative == 0, 'cumulative should be 0');
    assert(initialized == true, 'should be initialized');
}

// ============================================
// FIRST MINT TESTS
// ============================================

#[test]
fn test_first_mint_writes_observation() {
    let (yield_token, sy, yt, pt, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };
    let user = user1();

    setup_user_with_tokens(yield_token, sy, yt, user, 200 * WAD);

    // Increase cardinality to allow index advancement
    // (with cardinality=1, index wraps: (0+1)%1=0)
    oracle.increase_observations_cardinality_next(10);

    // Check state before mint
    let state_before = oracle.get_oracle_state();
    assert(state_before.observation_index == 0, 'index before should be 0');

    // Read initial observation
    let (init_ts, _, _) = oracle.get_observation(0);
    assert(init_ts == INITIAL_TIME, 'init ts should be INITIAL_TIME');

    // Advance time
    start_cheat_block_timestamp_global(INITIAL_TIME + ONE_HOUR);

    // First mint
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Check state after mint
    let state_after = oracle.get_oracle_state();

    // First mint should set initial implied rate
    assert(state_after.last_ln_implied_rate > 0, 'rate should be set');

    // Verify observation index advanced (new observation was written)
    assert(state_after.observation_index > state_before.observation_index, 'index should advance');

    // Read the new observation directly and verify it has correct values
    let (obs_ts, _, obs_initialized) = oracle.get_observation(state_after.observation_index);
    assert(obs_initialized, 'obs should be initialized');
    assert(obs_ts == INITIAL_TIME + ONE_HOUR, 'obs timestamp wrong');

    // Note: cumulative may still be 0 after first mint because:
    // cumulative += old_rate * time_delta, and old_rate = 0 before first mint
    // The important thing is that rate is now set for future observations
    assert(state_after.last_ln_implied_rate > 0, 'rate should be set after mint');
}

// ============================================
// SWAP OBSERVATION TESTS
// ============================================

#[test]
fn test_swap_writes_observation() {
    let (yield_token, sy, yt, pt, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };
    let user = user1();

    setup_user_with_tokens(yield_token, sy, yt, user, 300 * WAD);

    // Increase cardinality to allow index advancement
    // (with cardinality=1, index wraps: (0+1)%1=0)
    oracle.increase_observations_cardinality_next(10);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Advance time before recording state (so mint observation is written)
    start_cheat_block_timestamp_global(INITIAL_TIME + ONE_HOUR);

    let state_before = oracle.get_oracle_state();
    let rate_before = state_before.last_ln_implied_rate;
    let index_before = state_before.observation_index;

    // Read cumulative at current index before swap
    let (_, cumulative_before, _) = oracle.get_observation(index_before);

    // Advance time and swap
    start_cheat_block_timestamp_global(INITIAL_TIME + 2 * ONE_HOUR);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 10 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    // Rate should have changed
    let state_after = oracle.get_oracle_state();
    let rate_after = state_after.last_ln_implied_rate;
    assert(rate_after != rate_before, 'rate should change');

    // Observation index should advance when time passes
    assert(state_after.observation_index > index_before, 'index should advance');

    // Read the new observation and verify cumulative increased
    let (obs_ts, obs_cumulative, obs_initialized) = oracle
        .get_observation(state_after.observation_index);
    assert(obs_initialized, 'obs should be initialized');
    assert(obs_ts == INITIAL_TIME + 2 * ONE_HOUR, 'obs timestamp wrong');
    assert(obs_cumulative > cumulative_before, 'cumulative should increase');
}

#[test]
fn test_same_block_swap_no_new_observation() {
    let (yield_token, sy, yt, pt, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };
    let user = user1();

    setup_user_with_tokens(yield_token, sy, yt, user, 400 * WAD);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    let state_after_mint = oracle.get_oracle_state();
    let index_after_mint = state_after_mint.observation_index;

    // Two swaps in same block should not advance index
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 20 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 5 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    let state_after_swap1 = oracle.get_oracle_state();
    assert(state_after_swap1.observation_index == index_after_mint, 'index should not change');

    // Another swap in same block
    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 5 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    let state_after_swap2 = oracle.get_oracle_state();
    assert(state_after_swap2.observation_index == index_after_mint, 'index still unchanged');
}

// ============================================
// OBSERVE TESTS
// ============================================

#[test]
fn test_observe_returns_cumulative_values() {
    let (yield_token, sy, yt, pt, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };
    let user = user1();

    setup_user_with_tokens(yield_token, sy, yt, user, 300 * WAD);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Advance time
    start_cheat_block_timestamp_global(INITIAL_TIME + ONE_HOUR);

    // Query observe for seconds_ago = 0 (current time)
    let seconds_agos: Array<u32> = array![0];
    let cumulatives = oracle.observe(seconds_agos);

    assert(cumulatives.len() == 1, 'should return 1 value');
    // Cumulative should be positive since time has passed with positive rate
    let cumulative = *cumulatives.at(0);
    assert(cumulative > 0, 'cumulative should be positive');
}

#[test]
fn test_observe_computes_twap() {
    let (yield_token, sy, yt, pt, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };
    let user = user1();

    setup_user_with_tokens(yield_token, sy, yt, user, 300 * WAD);

    // Add liquidity at t=INITIAL_TIME
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Advance time by 1 hour
    let current_time = INITIAL_TIME + ONE_HOUR;
    start_cheat_block_timestamp_global(current_time);

    // Query observe with [1800, 0] (30 min ago and now)
    let seconds_agos: Array<u32> = array![1800, 0];
    let cumulatives = oracle.observe(seconds_agos);

    assert(cumulatives.len() == 2, 'should return 2 values');

    let cumulative_past = *cumulatives.at(0);
    let cumulative_now = *cumulatives.at(1);

    // TWAP = (cumulative_now - cumulative_past) / duration
    let duration: u256 = 1800;
    let twap = if cumulative_now > cumulative_past {
        (cumulative_now - cumulative_past) / duration
    } else {
        0
    };

    // TWAP should be positive (market has positive implied rate)
    assert(twap > 0, 'TWAP should be positive');
}

// ============================================
// CARDINALITY GROWTH TESTS
// ============================================

#[test]
fn test_increase_cardinality() {
    let (_, _, _, _, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };

    let state_before = oracle.get_oracle_state();
    assert(state_before.observation_cardinality_next == 1, 'initial cardinality_next is 1');

    // Increase cardinality
    oracle.increase_observations_cardinality_next(100);

    let state_after = oracle.get_oracle_state();
    assert(state_after.observation_cardinality_next == 100, 'cardinality_next should be 100');
    // Actual cardinality doesn't change until buffer wraps
    assert(state_after.observation_cardinality == 1, 'cardinality unchanged');
}

#[test]
fn test_increase_cardinality_no_shrink() {
    let (_, _, _, _, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };

    // First increase to 100
    oracle.increase_observations_cardinality_next(100);

    // Try to shrink to 50 (should be no-op)
    oracle.increase_observations_cardinality_next(50);

    let state = oracle.get_oracle_state();
    assert(state.observation_cardinality_next == 100, 'should not shrink');
}

#[test]
#[should_panic(expected: 'HZN: cardinality exceeds max')]
fn test_increase_cardinality_max_exceeded() {
    let (_, _, _, _, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };

    // Try to set cardinality above MAX_CARDINALITY (8760)
    oracle.increase_observations_cardinality_next(10000);
}

// ============================================
// GET_OBSERVATION TESTS
// ============================================

#[test]
fn test_get_observation() {
    let (_, _, _, _, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };

    let (ts, cumulative, initialized) = oracle.get_observation(0);

    assert(ts == INITIAL_TIME, 'wrong timestamp');
    assert(cumulative == 0, 'cumulative should be 0');
    assert(initialized == true, 'should be initialized');
}

#[test]
#[should_panic(expected: 'HZN: oracle idx out of bounds')]
fn test_get_observation_out_of_bounds() {
    let (_, _, _, _, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };

    // Index 1 is out of bounds when cardinality is 1
    oracle.get_observation(1);
}

// ============================================
// ORACLE STATE TESTS
// ============================================

#[test]
fn test_get_oracle_state() {
    let (yield_token, sy, yt, pt, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };
    let user = user1();

    // Initial state
    let state = oracle.get_oracle_state();
    assert(state.observation_index == 0, 'initial index is 0');
    assert(state.observation_cardinality == 1, 'initial cardinality is 1');
    assert(state.observation_cardinality_next == 1, 'initial next is 1');
    assert(state.last_ln_implied_rate == 0, 'initial rate is 0');

    // Add liquidity to set rate
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

    // State after mint
    let state_after = oracle.get_oracle_state();
    assert(state_after.last_ln_implied_rate > 0, 'rate should be set');
}

// ============================================
// CUMULATIVE ACCUMULATION TESTS
// ============================================

#[test]
fn test_cumulative_increases_with_time() {
    let (yield_token, sy, yt, pt, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };
    let user = user1();

    setup_user_with_tokens(yield_token, sy, yt, user, 300 * WAD);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Query at time T
    let seconds_agos_t1: Array<u32> = array![0];
    let cumulative_t1 = *oracle.observe(seconds_agos_t1).at(0);

    // Advance time by 1 hour
    start_cheat_block_timestamp_global(INITIAL_TIME + 2 * ONE_HOUR);

    // Query at time T + 1 hour
    let seconds_agos_t2: Array<u32> = array![0];
    let cumulative_t2 = *oracle.observe(seconds_agos_t2).at(0);

    // Cumulative should increase (time passed * rate)
    assert(cumulative_t2 > cumulative_t1, 'cumulative should increase');
}

// ============================================
// MULTI-SWAP TWAP TESTS
// ============================================

#[test]
fn test_twap_after_multiple_swaps() {
    let (yield_token, sy, yt, pt, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };
    let user = user1();

    setup_user_with_tokens(yield_token, sy, yt, user, 500 * WAD);

    // Increase cardinality to support history
    oracle.increase_observations_cardinality_next(100);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // First swap at t+1h
    start_cheat_block_timestamp_global(INITIAL_TIME + ONE_HOUR);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 30 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    // Second swap at t+2h
    start_cheat_block_timestamp_global(INITIAL_TIME + 2 * ONE_HOUR);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    // Third swap at t+3h
    start_cheat_block_timestamp_global(INITIAL_TIME + 3 * ONE_HOUR);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    // Query TWAP over last 2 hours
    let seconds_agos: Array<u32> = array![7200, 0]; // 2 hours ago, now
    let cumulatives = oracle.observe(seconds_agos);

    let cumulative_past = *cumulatives.at(0);
    let cumulative_now = *cumulatives.at(1);

    // Cumulative MUST increase over time - this is not optional
    assert(cumulative_now > cumulative_past, 'cumulative must increase');

    // TWAP = delta_cumulative / delta_time
    let twap = (cumulative_now - cumulative_past) / 7200;
    assert(twap > 0, 'TWAP should be positive');

    // Verify we have multiple distinct observations (not just interpolated)
    let state = oracle.get_oracle_state();
    assert(state.observation_index >= 3, 'should have 3+ observations');
}

// ============================================
// EDGE CASE TESTS
// ============================================

#[test]
fn test_observe_zero_seconds_ago() {
    let (yield_token, sy, yt, pt, market) = setup();
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };
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

    // Advance time
    start_cheat_block_timestamp_global(INITIAL_TIME + ONE_HOUR);

    // Query with seconds_ago = 0
    let seconds_agos: Array<u32> = array![0];
    let cumulatives = oracle.observe(seconds_agos);

    // Should return current cumulative
    assert(cumulatives.len() == 1, 'should return 1 value');
    assert(*cumulatives.at(0) > 0, 'cumulative should be > 0');
}

#[test]
#[should_panic(expected: 'HZN: oracle target too old')]
fn test_observe_target_too_old() {
    // Use a larger initial time to avoid underflow issues
    let large_initial_time: u64 = 1000000;
    start_cheat_block_timestamp_global(large_initial_time);

    let underlying_addr = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(underlying_addr, admin());
    let sy = deploy_sy(yield_token.contract_address, yield_token.contract_address, true);
    let expiry = large_initial_time + ONE_YEAR;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let market = deploy_market(
        pt.contract_address, default_scalar_root(), default_initial_anchor(), default_fee_rate(),
    );
    let oracle = IMarketOracleDispatcher { contract_address: market.contract_address };
    let user = user1();

    // Setup user and add liquidity
    mint_yield_token_to_user(yield_token, user, 400 * WAD);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, 400 * WAD);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, yield_token.contract_address, 400 * WAD, 0);
    sy.transfer(yt.contract_address, 200 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Advance time by 1 hour
    start_cheat_block_timestamp_global(large_initial_time + ONE_HOUR);

    // Try to query 2 hours ago (timestamp = large_initial_time - ONE_HOUR)
    // which is before the market was created, so target is too old
    let seconds_agos: Array<u32> = array![2 * ONE_HOUR.try_into().unwrap()];
    oracle.observe(seconds_agos);
}
