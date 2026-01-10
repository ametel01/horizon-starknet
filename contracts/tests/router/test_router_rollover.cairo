use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_router::{IRouterDispatcher, IRouterDispatcherTrait};
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
use crate::utils::DEFAULT_DEADLINE;

// Test addresses
fn user1() -> ContractAddress {
    'user1'.try_into().unwrap()
}

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
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
    WAD / 10
}

fn default_fee_rate() -> u256 {
    WAD / 100
}

// Deploy functions
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

fn deploy_yield_token_stack() -> IMockYieldTokenDispatcher {
    let underlying = deploy_mock_erc20();
    let admin_addr = admin();
    deploy_mock_yield_token(underlying.contract_address, admin_addr)
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
    calldata.append(treasury().into()); // treasury
    calldata.append(18); // decimals

    let (contract_address, _) = yt_class.deploy(@calldata).unwrap_syscall();
    IYTDispatcher { contract_address }
}

fn deploy_market(pt: ContractAddress) -> IMarketDispatcher {
    let contract = declare("Market").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'PT-SY LP', 8);
    append_bytearray(ref calldata, 'LP', 2);
    calldata.append(pt.into());
    calldata.append(default_scalar_root().low.into());
    calldata.append(default_scalar_root().high.into());
    calldata.append(default_initial_anchor().low.into());
    calldata.append(default_initial_anchor().high.into());
    calldata.append(default_fee_rate().low.into());
    calldata.append(default_fee_rate().high.into());
    calldata.append(0); // reserve_fee_percent
    calldata.append(admin().into()); // pauser
    calldata.append(0); // factory (zero address for tests)
    calldata.append(0); // reward_tokens array length (empty for tests)

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketDispatcher { contract_address }
}

fn deploy_router() -> IRouterDispatcher {
    let contract = declare("Router").unwrap_syscall().contract_class();
    let mut calldata = array![];
    calldata.append(admin().into()); // owner
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IRouterDispatcher { contract_address }
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

// Helper: Setup user with SY tokens
fn setup_user_with_sy(
    underlying: IMockYieldTokenDispatcher, sy: ISYDispatcher, user: ContractAddress, amount: u256,
) {
    mint_yield_token_to_user(underlying, user, amount);

    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, underlying.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);
}

// Helper: Setup user with SY and PT tokens (for market operations)
fn setup_user_with_tokens(
    underlying: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    user: ContractAddress,
    amount: u256,
) {
    // Get double amount of SY so we can mint PT+YT and have SY left
    setup_user_with_sy(underlying, sy, user, amount * 2);

    // Mint PT+YT from half the SY (floating SY pattern)
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);
}

// Full setup for single market
fn setup() -> (
    IMockYieldTokenDispatcher,
    ISYDispatcher,
    IYTDispatcher,
    IPTDispatcher,
    IMarketDispatcher,
    IRouterDispatcher,
) {
    start_cheat_block_timestamp_global(1000);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);

    let expiry = 1000 + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let market = deploy_market(pt.contract_address);
    let router = deploy_router();

    (underlying, sy, yt, pt, market, router)
}

/// Setup two markets that share the same PT (same underlying/expiry)
/// This is the scenario for rollover between markets with identical underlying assets
fn setup_two_markets_same_pt() -> (
    IMockYieldTokenDispatcher,
    ISYDispatcher,
    IYTDispatcher,
    IPTDispatcher,
    IMarketDispatcher,
    IMarketDispatcher,
    IRouterDispatcher,
) {
    start_cheat_block_timestamp_global(1000);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);

    let expiry = 1000 + 365 * 24 * 60 * 60;
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Deploy two markets for the same PT
    let market_old = deploy_market(pt.contract_address);
    let market_new = deploy_market(pt.contract_address);
    let router = deploy_router();

    (underlying, sy, yt, pt, market_old, market_new, router)
}

/// Setup two markets with different PT (different expiry)
/// This is the scenario where rollover should fail
fn setup_two_markets_different_pt() -> (
    IMockYieldTokenDispatcher,
    ISYDispatcher,
    IYTDispatcher,
    IPTDispatcher,
    IYTDispatcher,
    IPTDispatcher,
    IMarketDispatcher,
    IMarketDispatcher,
    IRouterDispatcher,
) {
    start_cheat_block_timestamp_global(1000);

    let underlying = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);

    // First expiry: 1 year
    let expiry_old = 1000 + 365 * 24 * 60 * 60;
    let yt_old = deploy_yt(sy.contract_address, expiry_old);
    let pt_old = IPTDispatcher { contract_address: yt_old.pt() };

    // Second expiry: 2 years (different PT)
    let expiry_new = 1000 + 2 * 365 * 24 * 60 * 60;
    let yt_new = deploy_yt(sy.contract_address, expiry_new);
    let pt_new = IPTDispatcher { contract_address: yt_new.pt() };

    let market_old = deploy_market(pt_old.contract_address);
    let market_new = deploy_market(pt_new.contract_address);
    let router = deploy_router();

    (underlying, sy, yt_old, pt_old, yt_new, pt_new, market_old, market_new, router)
}

// ============ Rollover LP Tests ============

#[test]
fn test_rollover_same_pt() {
    let (underlying, sy, yt, pt, market_old, market_new, router) = setup_two_markets_same_pt();
    let user = user1();
    let amount = 100 * WAD;

    // Setup user with SY and PT tokens
    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // User adds liquidity to the OLD market directly
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market_old.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market_old.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market_old.contract_address, user);
    let (_, _, lp_old_balance) = market_old.mint(user, amount, amount);
    stop_cheat_caller_address(market_old.contract_address);

    // Initialize the NEW market with some liquidity (needed for LP minting ratio)
    // We need another user or use admin to seed the new market
    let seeder: ContractAddress = 'seeder'.try_into().unwrap();
    setup_user_with_tokens(underlying, sy, yt, seeder, amount);

    start_cheat_caller_address(sy.contract_address, seeder);
    sy.approve(market_new.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, seeder);
    pt.approve(market_new.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market_new.contract_address, seeder);
    market_new.mint(seeder, amount, amount);
    stop_cheat_caller_address(market_new.contract_address);

    // Verify user has LP in old market
    let lp_old_token = IPTDispatcher { contract_address: market_old.contract_address };
    let lp_new_token = IPTDispatcher { contract_address: market_new.contract_address };
    assert(lp_old_token.balance_of(user) == lp_old_balance, 'User should have old LP');
    assert(lp_new_token.balance_of(user) == 0, 'User should have no new LP');

    // Approve router to spend old LP tokens
    start_cheat_caller_address(market_old.contract_address, user);
    lp_old_token.approve(router.contract_address, lp_old_balance);
    stop_cheat_caller_address(market_old.contract_address);

    // Rollover LP from old market to new market
    start_cheat_caller_address(router.contract_address, user);
    let lp_new = router
        .rollover_lp(
            market_old.contract_address,
            market_new.contract_address,
            lp_old_balance,
            0, // min_lp_out
            DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify migration
    assert(lp_old_token.balance_of(user) == 0, 'Old LP not burned');
    assert(lp_new_token.balance_of(user) == lp_new, 'New LP not received');
    assert(lp_new > 0, 'Should receive new LP');
}

#[test]
#[should_panic(expected: 'HZN: slippage exceeded')]
fn test_rollover_slippage_protection() {
    let (underlying, sy, yt, pt, market_old, market_new, router) = setup_two_markets_same_pt();
    let user = user1();
    let amount = 100 * WAD;

    // Setup user with SY and PT tokens
    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // User adds liquidity to the OLD market
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market_old.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market_old.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market_old.contract_address, user);
    let (_, _, lp_old_balance) = market_old.mint(user, amount, amount);
    stop_cheat_caller_address(market_old.contract_address);

    // Initialize the NEW market with some liquidity
    let seeder: ContractAddress = 'seeder'.try_into().unwrap();
    setup_user_with_tokens(underlying, sy, yt, seeder, amount);

    start_cheat_caller_address(sy.contract_address, seeder);
    sy.approve(market_new.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, seeder);
    pt.approve(market_new.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market_new.contract_address, seeder);
    market_new.mint(seeder, amount, amount);
    stop_cheat_caller_address(market_new.contract_address);

    // Approve router to spend old LP tokens
    let lp_old_token = IPTDispatcher { contract_address: market_old.contract_address };
    start_cheat_caller_address(market_old.contract_address, user);
    lp_old_token.approve(router.contract_address, lp_old_balance);
    stop_cheat_caller_address(market_old.contract_address);

    // Attempt rollover with unrealistically high min_lp_out (should fail)
    start_cheat_caller_address(router.contract_address, user);
    router
        .rollover_lp(
            market_old.contract_address,
            market_new.contract_address,
            lp_old_balance,
            lp_old_balance * 1000, // Unrealistic min_lp_out
            DEFAULT_DEADLINE,
        );
}

#[test]
#[should_panic(expected: 'HZN: rollover PT mismatch')]
fn test_rollover_different_pt_fails() {
    let (underlying, sy, yt_old, pt_old, yt_new, pt_new, market_old, market_new, router) =
        setup_two_markets_different_pt();
    let user = user1();
    let amount = 100 * WAD;

    // Setup user with SY and PT tokens for the OLD market (use old YT for minting)
    setup_user_with_sy(underlying, sy, user, amount * 2);

    // Mint PT+YT from the old YT
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt_old.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt_old.contract_address, user);
    yt_old.mint_py(user, user);
    stop_cheat_caller_address(yt_old.contract_address);

    // User adds liquidity to the OLD market
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market_old.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt_old.contract_address, user);
    pt_old.approve(market_old.contract_address, amount);
    stop_cheat_caller_address(pt_old.contract_address);

    start_cheat_caller_address(market_old.contract_address, user);
    let (_, _, lp_old_balance) = market_old.mint(user, amount, amount);
    stop_cheat_caller_address(market_old.contract_address);

    // Initialize the NEW market with some liquidity (using new PT)
    let seeder: ContractAddress = 'seeder'.try_into().unwrap();
    setup_user_with_sy(underlying, sy, seeder, amount * 2);

    // Mint PT+YT from the new YT for seeder
    start_cheat_caller_address(sy.contract_address, seeder);
    sy.transfer(yt_new.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt_new.contract_address, seeder);
    yt_new.mint_py(seeder, seeder);
    stop_cheat_caller_address(yt_new.contract_address);

    start_cheat_caller_address(sy.contract_address, seeder);
    sy.approve(market_new.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt_new.contract_address, seeder);
    pt_new.approve(market_new.contract_address, amount);
    stop_cheat_caller_address(pt_new.contract_address);

    start_cheat_caller_address(market_new.contract_address, seeder);
    market_new.mint(seeder, amount, amount);
    stop_cheat_caller_address(market_new.contract_address);

    // Approve router to spend old LP tokens
    let lp_old_token = IPTDispatcher { contract_address: market_old.contract_address };
    start_cheat_caller_address(market_old.contract_address, user);
    lp_old_token.approve(router.contract_address, lp_old_balance);
    stop_cheat_caller_address(market_old.contract_address);

    // Attempt rollover between markets with different PT (should fail)
    start_cheat_caller_address(router.contract_address, user);
    router
        .rollover_lp(
            market_old.contract_address,
            market_new.contract_address,
            lp_old_balance,
            0,
            DEFAULT_DEADLINE,
        );
}
