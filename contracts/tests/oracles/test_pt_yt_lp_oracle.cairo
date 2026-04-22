/// Tests for PT/YT/LP Oracle Wrapper (pt_yt_lp_oracle.cairo)
///
/// Verifies that each oracle instance correctly delegates to PyLpOracle
/// for all six oracle types, and that view functions return constructor values.
///
/// Run with: snforge test test_pt_yt_lp_oracle

use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_pt_yt_lp_oracle::{
    IPtYtLpOracleDispatcher, IPtYtLpOracleDispatcherTrait, OracleType,
};
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
// TEST SETUP (reuses test_py_lp_oracle pattern)
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
    let empty_reward_tokens: Array<ContractAddress> = array![];
    Serde::serialize(@empty_reward_tokens, ref calldata);

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
    calldata.append(0); // reward_tokens: empty span

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketDispatcher { contract_address }
}

fn deploy_py_lp_oracle() -> IPyLpOracleDispatcher {
    let contract = declare("PyLpOracle").unwrap_syscall().contract_class();
    let calldata = array![];
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IPyLpOracleDispatcher { contract_address }
}

fn deploy_pt_yt_lp_oracle(
    py_lp_oracle: ContractAddress, market: ContractAddress, duration: u32, oracle_type: OracleType,
) -> IPtYtLpOracleDispatcher {
    let contract = declare("PtYtLpOracle").unwrap_syscall().contract_class();
    let mut calldata = array![];
    calldata.append(py_lp_oracle.into());
    calldata.append(market.into());
    calldata.append(duration.into());
    Serde::serialize(@oracle_type, ref calldata);
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IPtYtLpOracleDispatcher { contract_address }
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

/// Full test setup returning all contracts needed for oracle wrapper tests
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

// ============================================
// PT_TO_SY ORACLE TESTS
// ============================================

#[test]
fn test_pt_to_sy_oracle() {
    let (yield_token, sy, yt, pt, market, py_lp_oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let oracle = deploy_pt_yt_lp_oracle(
        py_lp_oracle.contract_address, market.contract_address, 0, OracleType::PT_TO_SY,
    );

    let wrapper_price = oracle.get_price();
    let direct_price = py_lp_oracle.get_pt_to_sy_rate(market.contract_address, 0);

    assert(wrapper_price == direct_price, 'PT_TO_SY price mismatch');
    assert(wrapper_price > 0, 'price should be > 0');
    assert(wrapper_price < WAD, 'PT price should be < WAD');
}

// ============================================
// YT_TO_SY ORACLE TESTS
// ============================================

#[test]
fn test_yt_to_sy_oracle() {
    let (yield_token, sy, yt, pt, market, py_lp_oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let oracle = deploy_pt_yt_lp_oracle(
        py_lp_oracle.contract_address, market.contract_address, 0, OracleType::YT_TO_SY,
    );

    let wrapper_price = oracle.get_price();
    let direct_price = py_lp_oracle.get_yt_to_sy_rate(market.contract_address, 0);

    assert(wrapper_price == direct_price, 'YT_TO_SY price mismatch');
    assert(wrapper_price > 0, 'YT price should be > 0');
}

// ============================================
// LP_TO_SY ORACLE TESTS
// ============================================

#[test]
fn test_lp_to_sy_oracle() {
    let (yield_token, sy, yt, pt, market, py_lp_oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let oracle = deploy_pt_yt_lp_oracle(
        py_lp_oracle.contract_address, market.contract_address, 0, OracleType::LP_TO_SY,
    );

    let wrapper_price = oracle.get_price();
    let direct_price = py_lp_oracle.get_lp_to_sy_rate(market.contract_address, 0);

    assert(wrapper_price == direct_price, 'LP_TO_SY price mismatch');
    assert(wrapper_price > 0, 'LP price should be > 0');
}

// ============================================
// ASSET-DENOMINATED ORACLE TESTS
// ============================================

#[test]
fn test_pt_to_asset_oracle() {
    let (yield_token, sy, yt, pt, market, py_lp_oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Set yield index to 1.1 (10% yield)
    set_yield_index(yield_token, 11 * WAD / 10);

    let oracle = deploy_pt_yt_lp_oracle(
        py_lp_oracle.contract_address, market.contract_address, 0, OracleType::PT_TO_ASSET,
    );

    let wrapper_price = oracle.get_price();
    let direct_price = py_lp_oracle.get_pt_to_asset_rate(market.contract_address, 0);

    assert(wrapper_price == direct_price, 'PT_TO_ASSET price mismatch');
    // Asset rate should be higher than SY rate due to exchange rate
    let pt_to_sy = py_lp_oracle.get_pt_to_sy_rate(market.contract_address, 0);
    assert(wrapper_price > pt_to_sy, 'asset rate > SY rate');
}

#[test]
fn test_yt_to_asset_oracle() {
    let (yield_token, sy, yt, pt, market, py_lp_oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    set_yield_index(yield_token, 11 * WAD / 10);

    let oracle = deploy_pt_yt_lp_oracle(
        py_lp_oracle.contract_address, market.contract_address, 0, OracleType::YT_TO_ASSET,
    );

    let wrapper_price = oracle.get_price();
    let direct_price = py_lp_oracle.get_yt_to_asset_rate(market.contract_address, 0);

    assert(wrapper_price == direct_price, 'YT_TO_ASSET price mismatch');
}

#[test]
fn test_lp_to_asset_oracle() {
    let (yield_token, sy, yt, pt, market, py_lp_oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    set_yield_index(yield_token, 11 * WAD / 10);

    let oracle = deploy_pt_yt_lp_oracle(
        py_lp_oracle.contract_address, market.contract_address, 0, OracleType::LP_TO_ASSET,
    );

    let wrapper_price = oracle.get_price();
    let direct_price = py_lp_oracle.get_lp_to_asset_rate(market.contract_address, 0);

    assert(wrapper_price == direct_price, 'LP_TO_ASSET price mismatch');
}

// ============================================
// PRICE RESPONSE TESTS
// ============================================

#[test]
fn test_get_price_response() {
    let (yield_token, sy, yt, pt, market, py_lp_oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let oracle = deploy_pt_yt_lp_oracle(
        py_lp_oracle.contract_address, market.contract_address, 0, OracleType::PT_TO_SY,
    );

    let response = oracle.get_price_response();

    assert(response.price > 0, 'price should be > 0');
    assert(response.decimals == 18, 'decimals should be 18');
    assert(response.last_updated == INITIAL_TIME, 'timestamp mismatch');
    assert(response.oracle_type == OracleType::PT_TO_SY, 'oracle type mismatch');

    // Price should match get_price()
    let direct_price = oracle.get_price();
    assert(response.price == direct_price, 'response.price != get_price()');
}

// ============================================
// VIEW FUNCTION TESTS
// ============================================

#[test]
fn test_view_functions() {
    let (yield_token, sy, yt, pt, market, py_lp_oracle) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let duration: u32 = 1800;
    let oracle = deploy_pt_yt_lp_oracle(
        py_lp_oracle.contract_address, market.contract_address, duration, OracleType::LP_TO_ASSET,
    );

    assert(oracle.market() == market.contract_address, 'market mismatch');
    assert(oracle.duration() == duration, 'duration mismatch');
    assert(oracle.oracle_type() == OracleType::LP_TO_ASSET, 'oracle_type mismatch');
    assert(oracle.py_lp_oracle() == py_lp_oracle.contract_address, 'py_lp_oracle mismatch');
}
// NOTE: Constructor zero-address validation is defense-in-depth tested through
// the factory's deploy_oracle path (see test_pt_yt_lp_oracle_factory.cairo).
// snforge cannot catch constructor panics from ContractClass::deploy().


