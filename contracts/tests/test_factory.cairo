use core::num::traits::Zero;
use horizon::interfaces::i_factory::{IFactoryDispatcher, IFactoryDispatcherTrait};
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
use starknet::{ClassHash, ContractAddress, SyscallResultTrait};

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

fn zero_class_hash() -> ClassHash {
    0.try_into().unwrap()
}

// Helper to serialize ByteArray for calldata
fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0); // data array length
    calldata.append(value); // pending_word
    calldata.append(len.into()); // pending_word_len
}

// Time constants
const CURRENT_TIME: u64 = 1000000;
const ONE_YEAR: u64 = 365 * 86400;

// Deploy mock ERC20
fn deploy_mock_erc20() -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'Mock USDC', 10);
    append_bytearray(ref calldata, 'USDC', 4);

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

// Deploy yield token stack (MockERC20 + MockYieldToken)
fn deploy_yield_token_stack() -> IMockYieldTokenDispatcher {
    let underlying = deploy_mock_erc20();
    let admin_addr = admin();
    deploy_mock_yield_token(underlying.contract_address, admin_addr)
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

// Get class hashes for YT and PT
fn get_class_hashes() -> (ClassHash, ClassHash) {
    let yt_contract = declare("YT").unwrap_syscall().contract_class();
    let pt_contract = declare("PT").unwrap_syscall().contract_class();
    (*yt_contract.class_hash, *pt_contract.class_hash)
}

// Deploy Factory
fn deploy_factory(yt_class_hash: ClassHash, pt_class_hash: ClassHash) -> IFactoryDispatcher {
    start_cheat_block_timestamp_global(CURRENT_TIME);

    let contract = declare("Factory").unwrap_syscall().contract_class();
    let mut calldata = array![];
    calldata.append(admin().into()); // owner
    calldata.append(yt_class_hash.into());
    calldata.append(pt_class_hash.into());

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IFactoryDispatcher { contract_address }
}

// Helper to mint yield token shares to user as admin
fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    let admin_addr = admin();
    start_cheat_caller_address(yield_token.contract_address, admin_addr);
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

// Full setup
fn setup() -> (IMockYieldTokenDispatcher, ISYDispatcher, IFactoryDispatcher) {
    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let (yt_class_hash, pt_class_hash) = get_class_hashes();
    let factory = deploy_factory(yt_class_hash, pt_class_hash);
    (underlying, sy, factory)
}

// ============ Constructor Tests ============

#[test]
fn test_factory_constructor() {
    let (yt_class_hash, pt_class_hash) = get_class_hashes();
    let _factory = deploy_factory(yt_class_hash, pt_class_hash);
    // Factory deployed successfully if we reach here
}

// ============ Create Yield Contracts Tests ============

#[test]
fn test_factory_create_yield_contracts() {
    let (_, sy, factory) = setup();
    let expiry = CURRENT_TIME + ONE_YEAR;

    let (pt_addr, yt_addr) = factory.create_yield_contracts(sy.contract_address, expiry);

    // Verify addresses are non-zero
    assert(!pt_addr.is_zero(), 'PT should be deployed');
    assert(!yt_addr.is_zero(), 'YT should be deployed');

    // Verify PT and YT are properly linked
    let pt = IPTDispatcher { contract_address: pt_addr };
    let yt = IYTDispatcher { contract_address: yt_addr };

    assert(pt.sy() == sy.contract_address, 'PT wrong SY');
    assert(pt.yt() == yt_addr, 'PT wrong YT');
    assert(pt.expiry() == expiry, 'PT wrong expiry');

    assert(yt.sy() == sy.contract_address, 'YT wrong SY');
    assert(yt.pt() == pt_addr, 'YT wrong PT');
    assert(yt.expiry() == expiry, 'YT wrong expiry');
}

#[test]
fn test_factory_registry_lookup() {
    let (_, sy, factory) = setup();
    let expiry = CURRENT_TIME + ONE_YEAR;

    // Before creation, lookups should return zero
    assert(factory.get_pt(sy.contract_address, expiry).is_zero(), 'PT should be zero');
    assert(factory.get_yt(sy.contract_address, expiry).is_zero(), 'YT should be zero');

    // Create contracts
    let (pt_addr, yt_addr) = factory.create_yield_contracts(sy.contract_address, expiry);

    // After creation, lookups should return correct addresses
    assert(factory.get_pt(sy.contract_address, expiry) == pt_addr, 'Wrong PT lookup');
    assert(factory.get_yt(sy.contract_address, expiry) == yt_addr, 'Wrong YT lookup');
}

#[test]
fn test_factory_valid_pt_yt() {
    let (_, sy, factory) = setup();
    let expiry = CURRENT_TIME + ONE_YEAR;

    let (pt_addr, yt_addr) = factory.create_yield_contracts(sy.contract_address, expiry);

    // Deployed contracts should be valid
    assert(factory.is_valid_pt(pt_addr), 'PT should be valid');
    assert(factory.is_valid_yt(yt_addr), 'YT should be valid');

    // Random addresses should not be valid
    let random_addr: ContractAddress = 'random'.try_into().unwrap();
    assert(!factory.is_valid_pt(random_addr), 'Random PT should be invalid');
    assert(!factory.is_valid_yt(random_addr), 'Random YT should be invalid');
}

#[test]
fn test_factory_create_multiple_expiries() {
    let (_, sy, factory) = setup();
    let expiry1 = CURRENT_TIME + ONE_YEAR;
    let expiry2 = CURRENT_TIME + 2 * ONE_YEAR;

    // Create contracts for two different expiries
    let (pt1, yt1) = factory.create_yield_contracts(sy.contract_address, expiry1);
    let (pt2, yt2) = factory.create_yield_contracts(sy.contract_address, expiry2);

    // All should be different addresses
    assert(pt1 != pt2, 'PT1 should differ from PT2');
    assert(yt1 != yt2, 'YT1 should differ from YT2');

    // All should be valid
    assert(factory.is_valid_pt(pt1), 'PT1 should be valid');
    assert(factory.is_valid_pt(pt2), 'PT2 should be valid');
    assert(factory.is_valid_yt(yt1), 'YT1 should be valid');
    assert(factory.is_valid_yt(yt2), 'YT2 should be valid');

    // Lookups should return correct addresses
    assert(factory.get_pt(sy.contract_address, expiry1) == pt1, 'Wrong PT1');
    assert(factory.get_pt(sy.contract_address, expiry2) == pt2, 'Wrong PT2');
    assert(factory.get_yt(sy.contract_address, expiry1) == yt1, 'Wrong YT1');
    assert(factory.get_yt(sy.contract_address, expiry2) == yt2, 'Wrong YT2');
}

#[test]
fn test_factory_create_multiple_sy_tokens() {
    let underlying1 = deploy_yield_token_stack();
    let underlying2 = deploy_yield_token_stack();
    let sy1 = deploy_sy(underlying1.contract_address, underlying1.contract_address, true);
    let sy2 = deploy_sy(underlying2.contract_address, underlying2.contract_address, true);
    let (yt_class_hash, pt_class_hash) = get_class_hashes();
    let factory = deploy_factory(yt_class_hash, pt_class_hash);

    let expiry = CURRENT_TIME + ONE_YEAR;

    // Create contracts for two different SY tokens
    let (pt1, yt1) = factory.create_yield_contracts(sy1.contract_address, expiry);
    let (pt2, yt2) = factory.create_yield_contracts(sy2.contract_address, expiry);

    // All should be different addresses
    assert(pt1 != pt2, 'PT1 should differ from PT2');
    assert(yt1 != yt2, 'YT1 should differ from YT2');

    // Verify SY linkage
    let pt1_dispatcher = IPTDispatcher { contract_address: pt1 };
    let pt2_dispatcher = IPTDispatcher { contract_address: pt2 };
    assert(pt1_dispatcher.sy() == sy1.contract_address, 'PT1 wrong SY');
    assert(pt2_dispatcher.sy() == sy2.contract_address, 'PT2 wrong SY');
}

#[test]
#[should_panic(expected: 'HZN: pair already exists')]
fn test_factory_create_duplicate() {
    let (_, sy, factory) = setup();
    let expiry = CURRENT_TIME + ONE_YEAR;

    // First creation should succeed
    factory.create_yield_contracts(sy.contract_address, expiry);

    // Second creation with same SY and expiry should fail
    factory.create_yield_contracts(sy.contract_address, expiry);
}

#[test]
#[should_panic(expected: 'HZN: invalid expiry')]
fn test_factory_create_past_expiry() {
    let (_, sy, factory) = setup();
    let expiry = CURRENT_TIME - 1; // Past expiry

    factory.create_yield_contracts(sy.contract_address, expiry);
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_factory_create_zero_sy() {
    let (_, _, factory) = setup();
    let expiry = CURRENT_TIME + ONE_YEAR;

    factory.create_yield_contracts(zero_address(), expiry);
}

// ============ Integration Tests ============

#[test]
fn test_factory_created_contracts_are_functional() {
    let (underlying, sy, factory) = setup();
    let user = user1();
    let amount = 100 * WAD;
    let expiry = CURRENT_TIME + ONE_YEAR;

    // Create yield contracts
    let (pt_addr, yt_addr) = factory.create_yield_contracts(sy.contract_address, expiry);
    let yt = IYTDispatcher { contract_address: yt_addr };
    let pt = IPTDispatcher { contract_address: pt_addr };

    // Setup: mint underlying, deposit to SY
    mint_yield_token_to_user(underlying, user, amount);
    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount);
    sy.approve(yt_addr, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Mint PY using factory-created YT
    start_cheat_caller_address(yt_addr, user);
    let (pt_minted, yt_minted) = yt.mint_py(user, amount);
    stop_cheat_caller_address(yt_addr);

    // Verify minting worked
    assert(pt_minted == amount, 'Wrong PT minted');
    assert(yt_minted == amount, 'Wrong YT minted');
    assert(pt.balance_of(user) == amount, 'Wrong PT balance');
    assert(yt.balance_of(user) == amount, 'Wrong YT balance');

    // Redeem PY
    start_cheat_caller_address(yt_addr, user);
    let sy_returned = yt.redeem_py(user, amount);
    stop_cheat_caller_address(yt_addr);

    assert(sy_returned == amount, 'Wrong SY returned');
    assert(pt.balance_of(user) == 0, 'PT should be 0');
    assert(yt.balance_of(user) == 0, 'YT should be 0');
    assert(sy.balance_of(user) == amount, 'User should have SY');
}

#[test]
fn test_factory_post_expiry_redemption() {
    let (underlying, sy, factory) = setup();
    let user = user1();
    let amount = 100 * WAD;
    let expiry = CURRENT_TIME + ONE_YEAR;

    // Create and setup
    let (pt_addr, yt_addr) = factory.create_yield_contracts(sy.contract_address, expiry);
    let yt = IYTDispatcher { contract_address: yt_addr };
    let pt = IPTDispatcher { contract_address: pt_addr };

    mint_yield_token_to_user(underlying, user, amount);
    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount);
    sy.approve(yt_addr, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt_addr, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt_addr);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(expiry + 1);

    // Redeem PT post-expiry (YT is worthless)
    start_cheat_caller_address(yt_addr, user);
    let sy_returned = yt.redeem_py_post_expiry(user, amount);
    stop_cheat_caller_address(yt_addr);

    assert(sy_returned == amount, 'Wrong SY post-expiry');
    assert(pt.balance_of(user) == 0, 'PT should be burned');
    // YT remains but is worthless
    assert(yt.balance_of(user) == amount, 'YT should remain');
}
