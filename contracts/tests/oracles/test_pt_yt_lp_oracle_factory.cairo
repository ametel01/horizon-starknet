use core::num::traits::Zero;
/// Tests for PT/YT/LP Oracle Factory (pt_yt_lp_oracle_factory.cairo)
///
/// Verifies factory deployment, duplicate prevention, registry lookup,
/// and oracle functionality through factory-deployed instances.
///
/// Run with: snforge test test_pt_yt_lp_oracle_factory

use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_pt_yt_lp_oracle::{
    IPtYtLpOracleDispatcher, IPtYtLpOracleDispatcherTrait, OracleType,
};
use horizon::interfaces::i_pt_yt_lp_oracle_factory::{
    IPtYtLpOracleFactoryDispatcher, IPtYtLpOracleFactoryDispatcherTrait,
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

fn deploy_factory(py_lp_oracle: ContractAddress) -> IPtYtLpOracleFactoryDispatcher {
    let oracle_class = declare("PtYtLpOracle").unwrap_syscall().contract_class();
    let factory_class = declare("PtYtLpOracleFactory").unwrap_syscall().contract_class();

    let mut calldata = array![];
    calldata.append(admin().into()); // owner
    calldata.append((*oracle_class.class_hash).into()); // oracle_class_hash
    calldata.append(py_lp_oracle.into()); // py_lp_oracle

    let (factory_address, _) = factory_class.deploy(@calldata).unwrap_syscall();
    IPtYtLpOracleFactoryDispatcher { contract_address: factory_address }
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

/// Full test setup returning all contracts + factory
fn setup() -> (
    IMockYieldTokenDispatcher,
    ISYDispatcher,
    IYTDispatcher,
    IPTDispatcher,
    IMarketDispatcher,
    IPyLpOracleDispatcher,
    IPtYtLpOracleFactoryDispatcher,
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
    let factory = deploy_factory(py_lp_oracle.contract_address);

    (yield_token, sy, yt, pt, market, py_lp_oracle, factory)
}

// ============================================
// DEPLOY ORACLE TESTS
// ============================================

#[test]
fn test_deploy_oracle() {
    let (yield_token, sy, yt, pt, market, py_lp_oracle, factory) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let oracle_addr = factory.deploy_oracle(market.contract_address, 0, OracleType::PT_TO_SY);

    // Oracle should be registered and functional
    let oracle = IPtYtLpOracleDispatcher { contract_address: oracle_addr };
    let price = oracle.get_price();
    let direct_price = py_lp_oracle.get_pt_to_sy_rate(market.contract_address, 0);

    assert(price == direct_price, 'factory oracle price mismatch');
    assert(oracle.market() == market.contract_address, 'market mismatch');
    assert(oracle.duration() == 0, 'duration mismatch');
    assert(oracle.oracle_type() == OracleType::PT_TO_SY, 'oracle_type mismatch');
    assert(oracle.py_lp_oracle() == py_lp_oracle.contract_address, 'py_lp_oracle mismatch');

    // Factory count should be 1
    assert(factory.oracle_count() == 1, 'count should be 1');
}

// ============================================
// DUPLICATE PREVENTION TESTS
// ============================================

#[test]
#[should_panic(expected: 'HZN: oracle already exists')]
fn test_deploy_duplicate_reverts() {
    let (yield_token, sy, yt, pt, market, _, factory) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // First deploy succeeds
    factory.deploy_oracle(market.contract_address, 0, OracleType::PT_TO_SY);

    // Second deploy with same (market, duration, oracle_type) should revert
    factory.deploy_oracle(market.contract_address, 0, OracleType::PT_TO_SY);
}

// ============================================
// DIFFERENT TYPES TESTS
// ============================================

#[test]
fn test_deploy_different_types() {
    let (yield_token, sy, yt, pt, market, _, factory) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Set yield index for asset-denominated oracles
    set_yield_index(yield_token, 11 * WAD / 10);

    // Deploy all 6 oracle types for the same market
    let addr1 = factory.deploy_oracle(market.contract_address, 0, OracleType::PT_TO_SY);
    let addr2 = factory.deploy_oracle(market.contract_address, 0, OracleType::YT_TO_SY);
    let addr3 = factory.deploy_oracle(market.contract_address, 0, OracleType::LP_TO_SY);
    let addr4 = factory.deploy_oracle(market.contract_address, 0, OracleType::PT_TO_ASSET);
    let addr5 = factory.deploy_oracle(market.contract_address, 0, OracleType::YT_TO_ASSET);
    let addr6 = factory.deploy_oracle(market.contract_address, 0, OracleType::LP_TO_ASSET);

    // All should be unique addresses
    assert(addr1 != addr2, 'addr1 != addr2');
    assert(addr2 != addr3, 'addr2 != addr3');
    assert(addr3 != addr4, 'addr3 != addr4');
    assert(addr4 != addr5, 'addr4 != addr5');
    assert(addr5 != addr6, 'addr5 != addr6');

    assert(factory.oracle_count() == 6, 'count should be 6');
}

// ============================================
// DIFFERENT DURATIONS TESTS
// ============================================

#[test]
fn test_deploy_different_durations() {
    let (yield_token, sy, yt, pt, market, _, factory) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    // Same market + type but different durations should succeed
    let addr_spot = factory.deploy_oracle(market.contract_address, 0, OracleType::PT_TO_SY);
    let addr_30m = factory.deploy_oracle(market.contract_address, 1800, OracleType::PT_TO_SY);
    let addr_1h = factory.deploy_oracle(market.contract_address, 3600, OracleType::PT_TO_SY);

    assert(addr_spot != addr_30m, 'spot != 30m');
    assert(addr_30m != addr_1h, '30m != 1h');
    assert(factory.oracle_count() == 3, 'count should be 3');
}

// ============================================
// REGISTRY LOOKUP TESTS
// ============================================

#[test]
fn test_get_oracle() {
    let (yield_token, sy, yt, pt, market, _, factory) = setup();
    setup_market_with_liquidity(yield_token, sy, yt, pt, market);

    let deployed_addr = factory.deploy_oracle(market.contract_address, 0, OracleType::PT_TO_SY);

    // Lookup should return the deployed address
    let found_addr = factory.get_oracle(market.contract_address, 0, OracleType::PT_TO_SY);
    assert(found_addr == deployed_addr, 'registry lookup mismatch');
}

#[test]
fn test_get_oracle_not_found() {
    let (_, _, _, _, market, _, factory) = setup();

    // Lookup for undeployed oracle should return zero address
    let found_addr = factory.get_oracle(market.contract_address, 0, OracleType::PT_TO_SY);
    let zero: ContractAddress = 0.try_into().unwrap();
    assert(found_addr == zero, 'should return zero address');
}

// ============================================
// FACTORY VIEW FUNCTION TESTS
// ============================================

#[test]
fn test_factory_view_functions() {
    let (_, _, _, _, _, py_lp_oracle, factory) = setup();

    assert(factory.py_lp_oracle() == py_lp_oracle.contract_address, 'py_lp_oracle mismatch');
    assert(factory.oracle_count() == 0, 'initial count should be 0');

    // oracle_class_hash should be non-zero
    let class_hash = factory.oracle_class_hash();
    assert(!class_hash.is_zero(), 'class hash should be non-zero');
}

// ============================================
// ZERO ADDRESS VALIDATION TESTS
// ============================================

#[test]
#[should_panic(expected: 'HZN: zero market')]
fn test_deploy_oracle_zero_market_reverts() {
    let (_, _, _, _, _, _, factory) = setup();
    let zero: ContractAddress = 0.try_into().unwrap();
    factory.deploy_oracle(zero, 0, OracleType::PT_TO_SY);
}
