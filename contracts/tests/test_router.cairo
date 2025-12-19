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
use super::utils::DEFAULT_DEADLINE;

// Test addresses
fn user1() -> ContractAddress {
    'user1'.try_into().unwrap()
}

fn user2() -> ContractAddress {
    'user2'.try_into().unwrap()
}

fn zero_address() -> ContractAddress {
    0.try_into().unwrap()
}

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
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

// Full setup
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

// Helper: Setup user with SY tokens
fn setup_user_with_sy(
    underlying: IMockYieldTokenDispatcher, sy: ISYDispatcher, user: ContractAddress, amount: u256,
) {
    mint_yield_token_to_user(underlying, user, amount);

    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount);
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

    // Mint PT+YT from half the SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, amount);
    stop_cheat_caller_address(yt.contract_address);
}

// ============ Mint PY Tests ============

#[test]
fn test_router_mint_py_from_sy() {
    let (underlying, sy, yt, pt, _, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_sy(underlying, sy, user, amount);

    // Approve router to spend SY
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Mint PT+YT through router
    start_cheat_caller_address(router.contract_address, user);
    let (pt_out, yt_out) = router
        .mint_py_from_sy(yt.contract_address, user, amount, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Verify tokens received
    assert(pt_out > 0, 'Should receive PT');
    assert(yt_out > 0, 'Should receive YT');
    assert(pt.balance_of(user) == pt_out, 'Wrong PT balance');
    assert(yt.balance_of(user) == yt_out, 'Wrong YT balance');
}

#[test]
fn test_router_mint_py_to_different_receiver() {
    let (underlying, sy, yt, pt, _, router) = setup();
    let sender = user1();
    let receiver = user2();
    let amount = 100 * WAD;

    setup_user_with_sy(underlying, sy, sender, amount);

    start_cheat_caller_address(sy.contract_address, sender);
    sy.approve(router.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, sender);
    let (pt_out, yt_out) = router
        .mint_py_from_sy(yt.contract_address, receiver, amount, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Verify tokens went to receiver
    assert(pt.balance_of(sender) == 0, 'Sender should have no PT');
    assert(pt.balance_of(receiver) == pt_out, 'Receiver should have PT');
    assert(yt.balance_of(receiver) == yt_out, 'Receiver should have YT');
}

#[test]
#[should_panic(expected: 'Router: slippage exceeded')]
fn test_router_mint_py_slippage() {
    let (underlying, sy, yt, _, _, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_sy(underlying, sy, user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Request more PT than possible
    start_cheat_caller_address(router.contract_address, user);
    router.mint_py_from_sy(yt.contract_address, user, amount, amount * 10, DEFAULT_DEADLINE);
}

// ============ Redeem PY Tests ============

#[test]
fn test_router_redeem_py_to_sy() {
    let (underlying, sy, yt, pt, _, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // Approve router to spend PT and YT
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(router.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.approve(router.contract_address, amount);
    stop_cheat_caller_address(yt.contract_address);

    let sy_before = sy.balance_of(user);

    // Redeem through router
    start_cheat_caller_address(router.contract_address, user);
    let sy_out = router.redeem_py_to_sy(yt.contract_address, user, amount, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Verify SY received
    assert(sy_out > 0, 'Should receive SY');
    assert(sy.balance_of(user) == sy_before + sy_out, 'Wrong SY balance');
}

#[test]
fn test_router_redeem_pt_post_expiry() {
    let (underlying, sy, yt, pt, _, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(yt.expiry() + 1);

    // Approve router to spend PT
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(router.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    let sy_before = sy.balance_of(user);

    // Redeem PT only (post expiry)
    start_cheat_caller_address(router.contract_address, user);
    let sy_out = router
        .redeem_pt_post_expiry(yt.contract_address, user, amount, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    assert(sy_out > 0, 'Should receive SY');
    assert(sy.balance_of(user) == sy_before + sy_out, 'Wrong SY balance');
}

// ============ Add Liquidity Tests ============

#[test]
fn test_router_add_liquidity() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // Approve router to spend SY and PT
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(router.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    // Add liquidity through router
    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity(market.contract_address, user, amount, amount, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Verify liquidity added
    assert(lp_out > 0, 'Should receive LP');
    assert(sy_used <= amount, 'Used too much SY');
    assert(pt_used <= amount, 'Used too much PT');

    // Verify LP tokens received (total includes MINIMUM_LIQUIDITY=1000 locked to dead address)
    assert(market.total_lp_supply() == lp_out + 1000, 'Wrong LP supply');
}

#[test]
#[should_panic(expected: 'Router: slippage exceeded')]
fn test_router_add_liquidity_slippage() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(router.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    // Request unrealistic min_lp_out
    start_cheat_caller_address(router.contract_address, user);
    router
        .add_liquidity(
            market.contract_address, user, amount, amount, amount * 1000, DEFAULT_DEADLINE,
        );
}

// ============ Remove Liquidity Tests ============

#[test]
fn test_router_remove_liquidity() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // First add liquidity directly to market
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let (_, _, lp_minted) = market.mint(user, amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Approve router to spend LP tokens (market is LP token)
    start_cheat_caller_address(market.contract_address, user);
    // Use PT interface for approve since Market has same interface
    let lp_token = IPTDispatcher { contract_address: market.contract_address };
    lp_token.approve(router.contract_address, lp_minted);
    stop_cheat_caller_address(market.contract_address);

    let sy_before = sy.balance_of(user);
    let pt_before = pt.balance_of(user);

    // Remove liquidity through router
    start_cheat_caller_address(router.contract_address, user);
    let (sy_out, pt_out) = router
        .remove_liquidity(market.contract_address, user, lp_minted, 0, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Verify tokens received
    assert(sy_out > 0, 'Should receive SY');
    assert(pt_out > 0, 'Should receive PT');
    assert(sy.balance_of(user) == sy_before + sy_out, 'Wrong SY balance');
    assert(pt.balance_of(user) == pt_before + pt_out, 'Wrong PT balance');
}

// ============ Swap Tests ============

#[test]
fn test_router_swap_exact_sy_for_pt() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // Add liquidity to market first
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Get more SY for swapping (user used all SY for liquidity)
    setup_user_with_sy(underlying, sy, user, 20 * WAD);

    // Now swap through router
    let swap_amount = 10 * WAD;
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    let pt_before = pt.balance_of(user);

    start_cheat_caller_address(router.contract_address, user);
    let pt_out = router
        .swap_exact_sy_for_pt(market.contract_address, user, swap_amount, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    assert(pt_out > 0, 'Should receive PT');
    assert(pt.balance_of(user) == pt_before + pt_out, 'Wrong PT balance');
}

#[test]
fn test_router_swap_exact_pt_for_sy() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // Add liquidity to market
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Mint more PT for swapping
    setup_user_with_sy(underlying, sy, user, 50 * WAD);
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, 50 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, 50 * WAD);
    stop_cheat_caller_address(yt.contract_address);

    // Swap PT for SY through router
    let swap_amount = 10 * WAD;
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(pt.contract_address);

    let sy_before = sy.balance_of(user);

    start_cheat_caller_address(router.contract_address, user);
    let sy_out = router
        .swap_exact_pt_for_sy(market.contract_address, user, swap_amount, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    assert(sy_out > 0, 'Should receive SY');
    assert(sy.balance_of(user) == sy_before + sy_out, 'Wrong SY balance');
}

#[test]
fn test_router_swap_sy_for_exact_pt() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // Add liquidity to market
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Get more SY for swapping (user used all SY for liquidity)
    setup_user_with_sy(underlying, sy, user, 30 * WAD);

    // Swap for exact PT
    let exact_pt_out = 5 * WAD;
    let max_sy_in = 20 * WAD;

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, max_sy_in);
    stop_cheat_caller_address(sy.contract_address);

    let pt_before = pt.balance_of(user);

    start_cheat_caller_address(router.contract_address, user);
    let sy_spent = router
        .swap_sy_for_exact_pt(
            market.contract_address, user, exact_pt_out, max_sy_in, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    assert(sy_spent <= max_sy_in, 'Spent too much SY');
    assert(pt.balance_of(user) == pt_before + exact_pt_out, 'Should get exact PT');
}

#[test]
fn test_router_swap_pt_for_exact_sy() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // Add liquidity to market
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Mint more PT
    setup_user_with_sy(underlying, sy, user, 50 * WAD);
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, 50 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, 50 * WAD);
    stop_cheat_caller_address(yt.contract_address);

    // Swap PT for exact SY
    let exact_sy_out = 5 * WAD;
    let max_pt_in = 20 * WAD;

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(router.contract_address, max_pt_in);
    stop_cheat_caller_address(pt.contract_address);

    let sy_before = sy.balance_of(user);

    start_cheat_caller_address(router.contract_address, user);
    let pt_spent = router
        .swap_pt_for_exact_sy(
            market.contract_address, user, exact_sy_out, max_pt_in, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    assert(pt_spent <= max_pt_in, 'Spent too much PT');
    assert(sy.balance_of(user) == sy_before + exact_sy_out, 'Should get exact SY');
}

// ============ Combined Operations Tests ============

#[test]
fn test_router_buy_pt_from_sy() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // Add liquidity first
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Get more SY for buying PT (user used all SY for liquidity)
    setup_user_with_sy(underlying, sy, user, 20 * WAD);

    // Buy PT with SY
    let sy_in = 10 * WAD;
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, sy_in);
    stop_cheat_caller_address(sy.contract_address);

    let pt_before = pt.balance_of(user);

    start_cheat_caller_address(router.contract_address, user);
    let pt_out = router.buy_pt_from_sy(market.contract_address, user, sy_in, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    assert(pt_out > 0, 'Should receive PT');
    assert(pt.balance_of(user) == pt_before + pt_out, 'Wrong PT balance');
}

#[test]
fn test_router_sell_pt_for_sy() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Mint more PT
    setup_user_with_sy(underlying, sy, user, 50 * WAD);
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, 50 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, 50 * WAD);
    stop_cheat_caller_address(yt.contract_address);

    // Sell PT for SY
    let pt_in = 10 * WAD;
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(router.contract_address, pt_in);
    stop_cheat_caller_address(pt.contract_address);

    let sy_before = sy.balance_of(user);

    start_cheat_caller_address(router.contract_address, user);
    let sy_out = router.sell_pt_for_sy(market.contract_address, user, pt_in, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    assert(sy_out > 0, 'Should receive SY');
    assert(sy.balance_of(user) == sy_before + sy_out, 'Wrong SY balance');
}

// ============ Edge Cases ============

#[test]
#[should_panic(expected: 'YT: zero address')]
fn test_router_mint_py_zero_yt() {
    let (_, _, _, _, _, router) = setup();
    let user = user1();

    start_cheat_caller_address(router.contract_address, user);
    router.mint_py_from_sy(zero_address(), user, WAD, 0, DEFAULT_DEADLINE);
}

#[test]
#[should_panic(expected: 'YT: zero address')]
fn test_router_mint_py_zero_receiver() {
    let (_, _, yt, _, _, router) = setup();
    let user = user1();

    start_cheat_caller_address(router.contract_address, user);
    router.mint_py_from_sy(yt.contract_address, zero_address(), WAD, 0, DEFAULT_DEADLINE);
}

#[test]
#[should_panic(expected: 'YT: zero amount')]
fn test_router_mint_py_zero_amount() {
    let (_, _, yt, _, _, router) = setup();
    let user = user1();

    start_cheat_caller_address(router.contract_address, user);
    router.mint_py_from_sy(yt.contract_address, user, 0, 0, DEFAULT_DEADLINE);
}

// ============ YT Swap Tests ============

#[test]
fn test_router_swap_exact_sy_for_yt() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // Add liquidity to market first
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Get more SY for swapping
    setup_user_with_sy(underlying, sy, user, 20 * WAD);

    // Swap SY for YT through router
    let swap_amount = 10 * WAD;
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    let yt_before = yt.balance_of(user);
    let sy_before = sy.balance_of(user);

    start_cheat_caller_address(router.contract_address, user);
    let yt_out = router
        .swap_exact_sy_for_yt(
            yt.contract_address, market.contract_address, user, swap_amount, 0, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify YT received
    assert(yt_out > 0, 'Should receive YT');
    assert(yt.balance_of(user) == yt_before + yt_out, 'Wrong YT balance');

    // User should have received some SY back from PT sale
    // Net SY spent = swap_amount - SY_from_PT_sale
    // So final SY should be >= sy_before - swap_amount (some SY recovered)
    let sy_after = sy.balance_of(user);
    assert(sy_after >= sy_before - swap_amount, 'SY recovery failed');
}

#[test]
fn test_router_swap_exact_sy_for_yt_to_receiver() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let sender = user1();
    let receiver = user2();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, sender, amount);

    // Add liquidity to market
    start_cheat_caller_address(sy.contract_address, sender);
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, sender);
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, sender);
    market.mint(sender, amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Get more SY for swapping
    setup_user_with_sy(underlying, sy, sender, 20 * WAD);

    let swap_amount = 10 * WAD;
    start_cheat_caller_address(sy.contract_address, sender);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    let sender_yt_before = yt.balance_of(sender);
    let receiver_yt_before = yt.balance_of(receiver);

    start_cheat_caller_address(router.contract_address, sender);
    let yt_out = router
        .swap_exact_sy_for_yt(
            yt.contract_address,
            market.contract_address,
            receiver,
            swap_amount,
            0,
            DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify tokens went to receiver, not sender
    assert(yt.balance_of(receiver) == receiver_yt_before + yt_out, 'Receiver should have YT');
    assert(yt.balance_of(sender) == sender_yt_before, 'Sender YT unchanged');
}

#[test]
#[should_panic(expected: 'Router: slippage exceeded')]
fn test_router_swap_exact_sy_for_yt_slippage() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // Add liquidity to market
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, amount, amount);
    stop_cheat_caller_address(market.contract_address);

    setup_user_with_sy(underlying, sy, user, 20 * WAD);

    let swap_amount = 10 * WAD;
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    // Request unrealistic min_yt_out
    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_sy_for_yt(
            yt.contract_address,
            market.contract_address,
            user,
            swap_amount,
            swap_amount * 100,
            DEFAULT_DEADLINE,
        );
}

#[test]
fn test_router_swap_exact_yt_for_sy() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // Add liquidity to market
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Get more SY and mint more YT for selling
    setup_user_with_sy(underlying, sy, user, 50 * WAD);
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, 30 * WAD); // Only mint 30 WAD worth, keep 20 WAD for collateral
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, 30 * WAD);
    stop_cheat_caller_address(yt.contract_address);

    // Swap YT for SY through router
    // User needs to approve both YT and SY (collateral)
    // Router uses max_sy_for_pt = exact_yt_in * 4 internally to handle AMM curve and fees
    let yt_to_sell = 5 * WAD;
    let collateral_sy = yt_to_sell * 4; // 4x multiplier to match router's internal calculation

    start_cheat_caller_address(yt.contract_address, user);
    yt.approve(router.contract_address, yt_to_sell);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, collateral_sy);
    stop_cheat_caller_address(sy.contract_address);

    let sy_before = sy.balance_of(user);
    let yt_before = yt.balance_of(user);

    start_cheat_caller_address(router.contract_address, user);
    let sy_out = router
        .swap_exact_yt_for_sy(
            yt.contract_address,
            market.contract_address,
            user,
            yt_to_sell,
            yt_to_sell * 4,
            0,
            DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify YT sold
    assert(yt.balance_of(user) == yt_before - yt_to_sell, 'Wrong YT balance');

    // Verify operation completed
    // Note: sy_out is the effective gain from selling YT (sy_from_redemption - sy_spent_on_pt)
    // This can be 0 or positive. In high implied yield markets, selling YT may not be profitable.
    // The user still receives net_sy_out = sy_from_redemption + refund, which is positive.
    let sy_after = sy.balance_of(user);
    // User should receive back at least their refund + redemption, minus collateral provided
    // The change should be >= sy_out (effective gain, can be 0 in unprofitable markets)
    assert(sy_after >= sy_before - collateral_sy + sy_out, 'SY balance incorrect');
}

#[test]
fn test_router_swap_exact_yt_for_sy_to_receiver() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let sender = user1();
    let receiver = user2();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, sender, amount);

    // Add liquidity to market
    start_cheat_caller_address(sy.contract_address, sender);
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, sender);
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, sender);
    market.mint(sender, amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Get more SY and mint more YT, keeping some SY for collateral
    setup_user_with_sy(underlying, sy, sender, 50 * WAD);
    start_cheat_caller_address(sy.contract_address, sender);
    sy.approve(yt.contract_address, 30 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, sender);
    yt.mint_py(sender, 30 * WAD);
    stop_cheat_caller_address(yt.contract_address);

    let yt_to_sell = 5 * WAD;
    let collateral_sy = yt_to_sell * 4; // 4x multiplier to match router

    start_cheat_caller_address(yt.contract_address, sender);
    yt.approve(router.contract_address, yt_to_sell);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(sy.contract_address, sender);
    sy.approve(router.contract_address, collateral_sy);
    stop_cheat_caller_address(sy.contract_address);

    let receiver_sy_before = sy.balance_of(receiver);

    start_cheat_caller_address(router.contract_address, sender);
    router
        .swap_exact_yt_for_sy(
            yt.contract_address,
            market.contract_address,
            receiver,
            yt_to_sell,
            collateral_sy,
            0,
            DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify receiver got SY
    assert(sy.balance_of(receiver) > receiver_sy_before, 'Receiver should have SY');
}

#[test]
#[should_panic(expected: 'Router: slippage exceeded')]
fn test_router_swap_exact_yt_for_sy_slippage() {
    let (underlying, sy, yt, pt, market, router) = setup();
    let user = user1();
    let amount = 100 * WAD;

    setup_user_with_tokens(underlying, sy, yt, user, amount);

    // Add liquidity to market
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, amount, amount);
    stop_cheat_caller_address(market.contract_address);

    // Get more SY and mint more YT, keeping some for collateral
    setup_user_with_sy(underlying, sy, user, 50 * WAD);
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(yt.contract_address, 30 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, 30 * WAD);
    stop_cheat_caller_address(yt.contract_address);

    let yt_to_sell = 5 * WAD;
    let collateral_sy = yt_to_sell * 4; // 4x multiplier to match router

    start_cheat_caller_address(yt.contract_address, user);
    yt.approve(router.contract_address, yt_to_sell);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, collateral_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Request unrealistic min_sy_out
    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_yt_for_sy(
            yt.contract_address,
            market.contract_address,
            user,
            yt_to_sell,
            collateral_sy,
            yt_to_sell * 100,
            DEFAULT_DEADLINE,
        );
}
