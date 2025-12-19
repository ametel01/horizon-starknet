use core::num::traits::Zero;
use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_market_factory::{
    IMarketFactoryDispatcher, IMarketFactoryDispatcherTrait,
};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_erc20::IMockERC20Dispatcher;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

// Test addresses
fn user1() -> ContractAddress {
    'user1'.try_into().unwrap()
}

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn zero_address() -> ContractAddress {
    0.try_into().unwrap()
}

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
    WAD / 10 // 0.1 WAD = ~10% APY
}

fn default_fee_rate() -> u256 {
    WAD / 100 // 1% fee
}

// Deploy mock ERC20
fn deploy_mock_erc20() -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'MockERC20', 9);
    append_bytearray(ref calldata, 'MERC', 4);
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMockERC20Dispatcher { contract_address }
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

// Deploy yield token stack (MockERC20 -> MockYieldToken)
fn deploy_yield_token_stack() -> (IMockERC20Dispatcher, IMockYieldTokenDispatcher) {
    let underlying = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(underlying.contract_address, admin());
    (underlying, yield_token)
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

    let (contract_address, _) = yt_class.deploy(@calldata).unwrap_syscall();
    IYTDispatcher { contract_address }
}

// Deploy MarketFactory
fn deploy_market_factory() -> IMarketFactoryDispatcher {
    let market_class = declare("Market").unwrap_syscall().contract_class();
    let factory_class = declare("MarketFactory").unwrap_syscall().contract_class();

    let mut calldata = array![];
    calldata.append(admin().into()); // owner
    calldata.append((*market_class.class_hash).into());

    let (contract_address, _) = factory_class.deploy(@calldata).unwrap_syscall();
    IMarketFactoryDispatcher { contract_address }
}

// Helper to mint yield token shares to user as admin
fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

// Full setup: underlying -> SY -> YT/PT -> MarketFactory
fn setup() -> (
    IMockYieldTokenDispatcher,
    ISYDispatcher,
    IYTDispatcher,
    IPTDispatcher,
    IMarketFactoryDispatcher,
) {
    // Set timestamp
    start_cheat_block_timestamp_global(1000);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);

    // Expiry in ~1 year
    let expiry = 1000 + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let factory = deploy_market_factory();

    (underlying, sy, yt, pt, factory)
}

// ============ Constructor Tests ============

#[test]
fn test_market_factory_constructor() {
    let factory = deploy_market_factory();

    // Market class hash should be set
    let class_hash = factory.market_class_hash();
    assert(!class_hash.is_zero(), 'Class hash should be set');
}

// ============ Create Market Tests ============

#[test]
fn test_market_factory_create_market() {
    let (_, sy, _, pt, factory) = setup();

    let market_addr = factory
        .create_market(
            pt.contract_address,
            default_scalar_root(),
            default_initial_anchor(),
            default_fee_rate(),
        );

    // Verify market was created
    assert(!market_addr.is_zero(), 'Market should be created');

    // Verify market is registered
    let registered = factory.get_market(pt.contract_address);
    assert(registered == market_addr, 'Market should be registered');

    // Verify market is valid
    assert(factory.is_valid_market(market_addr), 'Should be valid market');

    // Verify market properties
    let market = IMarketDispatcher { contract_address: market_addr };
    assert(market.pt() == pt.contract_address, 'Wrong PT');
    assert(market.sy() == sy.contract_address, 'Wrong SY');
    assert(market.expiry() == pt.expiry(), 'Wrong expiry');
}

#[test]
fn test_market_factory_create_multiple_markets() {
    start_cheat_block_timestamp_global(1000);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let factory = deploy_market_factory();

    // Create PT/YT pairs with different expiries
    let expiry1 = 1000 + 30 * 24 * 60 * 60; // 30 days
    let expiry2 = 1000 + 90 * 24 * 60 * 60; // 90 days

    let yt1 = deploy_yt(sy.contract_address, expiry1);
    let pt1 = IPTDispatcher { contract_address: yt1.pt() };

    let yt2 = deploy_yt(sy.contract_address, expiry2);
    let pt2 = IPTDispatcher { contract_address: yt2.pt() };

    // Create markets for both PTs
    let market1 = factory
        .create_market(
            pt1.contract_address,
            default_scalar_root(),
            default_initial_anchor(),
            default_fee_rate(),
        );
    let market2 = factory
        .create_market(
            pt2.contract_address,
            default_scalar_root(),
            default_initial_anchor(),
            default_fee_rate(),
        );

    // Verify both markets were created
    assert(!market1.is_zero(), 'Market1 should be created');
    assert(!market2.is_zero(), 'Market2 should be created');
    assert(market1 != market2, 'Markets should be different');

    // Verify both are registered and valid
    assert(factory.get_market(pt1.contract_address) == market1, 'Market1 not registered');
    assert(factory.get_market(pt2.contract_address) == market2, 'Market2 not registered');
    assert(factory.is_valid_market(market1), 'Market1 not valid');
    assert(factory.is_valid_market(market2), 'Market2 not valid');
}

#[test]
#[should_panic(expected: 'MktFactory: already exists')]
fn test_market_factory_create_duplicate() {
    let (_, _, _, pt, factory) = setup();

    // Create first market
    factory
        .create_market(
            pt.contract_address,
            default_scalar_root(),
            default_initial_anchor(),
            default_fee_rate(),
        );

    // Try to create another market for same PT - should fail
    factory
        .create_market(
            pt.contract_address,
            default_scalar_root(),
            default_initial_anchor(),
            default_fee_rate(),
        );
}

#[test]
#[should_panic(expected: 'YT: zero address')]
fn test_market_factory_create_zero_pt() {
    let factory = deploy_market_factory();

    factory
        .create_market(
            zero_address(), default_scalar_root(), default_initial_anchor(), default_fee_rate(),
        );
}

#[test]
#[should_panic(expected: 'Market: expired')]
fn test_market_factory_create_expired_pt() {
    let (_, _, _, pt, factory) = setup();

    // Fast forward past expiry
    start_cheat_block_timestamp_global(pt.expiry() + 1);

    factory
        .create_market(
            pt.contract_address,
            default_scalar_root(),
            default_initial_anchor(),
            default_fee_rate(),
        );
}

// ============ Registry Tests ============

#[test]
fn test_market_factory_get_market_not_found() {
    let factory = deploy_market_factory();

    let result = factory.get_market(user1());
    assert(result.is_zero(), 'Should return zero');
}

#[test]
fn test_market_factory_is_valid_market_false() {
    let factory = deploy_market_factory();

    // Random address should not be valid
    assert(!factory.is_valid_market(user1()), 'Should not be valid');
}

// ============ Market Functionality Tests ============

#[test]
fn test_created_market_is_functional() {
    let (underlying, sy, yt, pt, factory) = setup();
    let user = user1();

    // Create market
    let market_addr = factory
        .create_market(
            pt.contract_address,
            default_scalar_root(),
            default_initial_anchor(),
            default_fee_rate(),
        );
    let market = IMarketDispatcher { contract_address: market_addr };

    // Setup user with tokens
    let amount = 100 * WAD;
    mint_yield_token_to_user(underlying, user, amount * 2);

    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount * 2);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount * 2);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);

    // Approve market to spend tokens
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market_addr, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market_addr, amount);
    stop_cheat_caller_address(pt.contract_address);

    // Add liquidity
    start_cheat_caller_address(market_addr, user);
    let (sy_used, pt_used, lp_minted) = market.mint(user, 50 * WAD, 50 * WAD);
    stop_cheat_caller_address(market_addr);

    // Verify liquidity was added
    assert(sy_used == 50 * WAD, 'Wrong SY used');
    assert(pt_used == 50 * WAD, 'Wrong PT used');
    assert(lp_minted > 0, 'LP should be minted');

    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert(sy_reserve == 50 * WAD, 'Wrong SY reserve');
    assert(pt_reserve == 50 * WAD, 'Wrong PT reserve');
}

#[test]
fn test_market_factory_different_parameters() {
    start_cheat_block_timestamp_global(1000);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let factory = deploy_market_factory();

    // Create PT/YT pairs with different expiries
    let expiry1 = 1000 + 30 * 24 * 60 * 60;
    let expiry2 = 1000 + 90 * 24 * 60 * 60;

    let yt1 = deploy_yt(sy.contract_address, expiry1);
    let pt1 = IPTDispatcher { contract_address: yt1.pt() };

    let yt2 = deploy_yt(sy.contract_address, expiry2);
    let pt2 = IPTDispatcher { contract_address: yt2.pt() };

    // Create markets with different parameters
    let scalar1 = 30 * WAD;
    let anchor1 = WAD / 20; // 5% APY
    let fee1 = WAD / 200; // 0.5% fee

    let scalar2 = 100 * WAD;
    let anchor2 = WAD / 5; // 20% APY
    let fee2 = WAD / 50; // 2% fee

    let market1 = factory.create_market(pt1.contract_address, scalar1, anchor1, fee1);
    let market2 = factory.create_market(pt2.contract_address, scalar2, anchor2, fee2);

    // Both markets should be created and functional
    assert(!market1.is_zero(), 'Market1 should exist');
    assert(!market2.is_zero(), 'Market2 should exist');

    // Verify they're different addresses
    assert(market1 != market2, 'Markets should differ');
}

// ============ Edge Cases ============

#[test]
fn test_market_factory_large_parameters() {
    let (_, _, _, pt, factory) = setup();

    // Use large (but valid) scalar and anchor values
    // scalar_root max: 1000 WAD, anchor max: ~4.6 WAD, fee max: 0.1 WAD (10%)
    let large_scalar = 1000 * WAD; // Maximum allowed scalar
    let large_anchor = 4 * WAD + (WAD / 2); // 4.5 WAD (within ~4.6 max)
    let large_fee = WAD / 10; // 10% fee (maximum allowed)

    let market_addr = factory
        .create_market(pt.contract_address, large_scalar, large_anchor, large_fee);

    assert(!market_addr.is_zero(), 'Should create market');
    assert(factory.is_valid_market(market_addr), 'Should be valid');
}

#[test]
fn test_market_factory_small_parameters() {
    let (_, _, _, pt, factory) = setup();

    // Use small (but valid) scalar and anchor values
    // scalar_root min: 1 WAD, anchor min: 0, fee min: 0
    let small_scalar = WAD; // 1 WAD (minimum allowed)
    let small_anchor = WAD / 1000; // 0.001 WAD (small but valid anchor)
    let small_fee = WAD / 10000; // 0.01% fee (small but valid)

    let market_addr = factory
        .create_market(pt.contract_address, small_scalar, small_anchor, small_fee);

    assert(!market_addr.is_zero(), 'Should create market');
    assert(factory.is_valid_market(market_addr), 'Should be valid');
}

#[test]
fn test_market_factory_zero_fee() {
    let (_, _, _, pt, factory) = setup();

    // Create market with zero fee
    let market_addr = factory
        .create_market(pt.contract_address, default_scalar_root(), default_initial_anchor(), 0);

    assert(!market_addr.is_zero(), 'Should create market');
    assert(factory.is_valid_market(market_addr), 'Should be valid');
}

// ============ Parameter Validation Tests ============

#[test]
#[should_panic(expected: 'MktFactory: invalid scalar')]
fn test_market_factory_scalar_too_small() {
    let (_, _, _, pt, factory) = setup();

    // scalar_root below minimum (1 WAD)
    let invalid_scalar = WAD / 2; // 0.5 WAD - below minimum
    factory.create_market(pt.contract_address, invalid_scalar, default_initial_anchor(), WAD / 100);
}

#[test]
#[should_panic(expected: 'MktFactory: invalid scalar')]
fn test_market_factory_scalar_too_large() {
    let (_, _, _, pt, factory) = setup();

    // scalar_root above maximum (1000 WAD)
    let invalid_scalar = 1001 * WAD; // Above maximum
    factory.create_market(pt.contract_address, invalid_scalar, default_initial_anchor(), WAD / 100);
}

#[test]
#[should_panic(expected: 'MktFactory: invalid anchor')]
fn test_market_factory_anchor_too_large() {
    let (_, _, _, pt, factory) = setup();

    // initial_anchor above maximum (~4.6 WAD)
    let invalid_anchor = 5 * WAD; // 5 WAD - above ~4.6 max
    factory.create_market(pt.contract_address, default_scalar_root(), invalid_anchor, WAD / 100);
}

#[test]
#[should_panic(expected: 'MktFactory: invalid fee')]
fn test_market_factory_fee_too_large() {
    let (_, _, _, pt, factory) = setup();

    // fee_rate above maximum (10% = 0.1 WAD)
    let invalid_fee = WAD / 5; // 20% fee - above 10% max
    factory
        .create_market(
            pt.contract_address, default_scalar_root(), default_initial_anchor(), invalid_fee,
        );
}
