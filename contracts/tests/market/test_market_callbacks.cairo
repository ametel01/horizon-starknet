use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math_fp::WAD;
use horizon::mocks::mock_erc20::IMockERC20Dispatcher;
use horizon::mocks::mock_swap_callback::{
    IMockSwapCallbackDispatcher, IMockSwapCallbackDispatcherTrait,
};
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

// Test addresses
fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn user1() -> ContractAddress {
    'user1'.try_into().unwrap()
}

fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
}

// Helper to serialize ByteArray for calldata
fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0); // data array length
    calldata.append(value); // pending_word
    calldata.append(len.into()); // pending_word_len
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
    calldata.append(admin().into()); // pauser
    calldata.append(treasury().into()); // treasury
    calldata.append(18); // decimals

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
    calldata.append(admin().into()); // pauser
    calldata.append(0); // factory (zero address for tests without factory)
    calldata.append(0); // reward_tokens array length (empty for tests)

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketDispatcher { contract_address }
}

// Deploy MockSwapCallback
fn deploy_mock_swap_callback(
    market: ContractAddress, sy: ContractAddress, pt: ContractAddress,
) -> IMockSwapCallbackDispatcher {
    let contract = declare("MockSwapCallback").unwrap_syscall().contract_class();
    let mut calldata = array![];
    calldata.append(market.into());
    calldata.append(sy.into());
    calldata.append(pt.into());
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMockSwapCallbackDispatcher { contract_address }
}

// Helper: Mint yield token shares to user as admin
fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

// Full setup: underlying -> SY -> YT/PT -> Market -> MockSwapCallback
fn setup() -> (
    IMockYieldTokenDispatcher,
    ISYDispatcher,
    IYTDispatcher,
    IPTDispatcher,
    IMarketDispatcher,
    IMockSwapCallbackDispatcher,
) {
    // Set timestamp to a known value
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

    let callback_mock = deploy_mock_swap_callback(
        market.contract_address, sy.contract_address, pt.contract_address,
    );

    (underlying, sy, yt, pt, market, callback_mock)
}

// Helper: Setup user with SY and PT tokens
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

// Helper: Add initial liquidity to market
fn add_liquidity(
    sy: ISYDispatcher,
    pt: IPTDispatcher,
    market: IMarketDispatcher,
    user: ContractAddress,
    sy_amount: u256,
    pt_amount: u256,
) {
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, sy_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, pt_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, sy_amount, pt_amount);
    stop_cheat_caller_address(market.contract_address);
}

// ============ Callback Tests ============

#[test]
fn test_swap_exact_pt_for_sy_with_callback() {
    let (underlying, sy, yt, pt, market, callback_mock) = setup();
    let user = user1();

    // Setup user with tokens
    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity first
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Transfer PT to callback contract for the swap
    let swap_amount = 10 * WAD;
    start_cheat_caller_address(pt.contract_address, user);
    pt.transfer(callback_mock.contract_address, swap_amount);
    stop_cheat_caller_address(pt.contract_address);

    // Approve market from callback contract
    start_cheat_caller_address(callback_mock.contract_address, callback_mock.contract_address);
    callback_mock.approve_market(swap_amount);
    stop_cheat_caller_address(callback_mock.contract_address);

    // Verify callback count is 0 before swap
    assert(callback_mock.get_callback_count() == 0, 'Count should be 0 before');

    // Prepare callback data (non-empty to trigger callback)
    let callback_data = array![1_felt252];

    // Execute swap with callback from callback_mock contract
    start_cheat_caller_address(market.contract_address, callback_mock.contract_address);
    let sy_out = market
        .swap_exact_pt_for_sy(callback_mock.contract_address, swap_amount, 0, callback_data.span());
    stop_cheat_caller_address(market.contract_address);

    // Verify callback was invoked
    assert(callback_mock.get_callback_count() == 1, 'Callback not called');

    // Verify callback received correct PT info
    // PT was sent TO market, so is_negative=true for the account
    let (pt_magnitude, pt_is_negative) = callback_mock.get_last_pt();
    assert(pt_magnitude == swap_amount, 'Wrong PT magnitude');
    assert(pt_is_negative == true, 'PT should be negative');

    // Verify callback received correct SY info
    // SY was received FROM market, so is_negative=false
    let (sy_magnitude, sy_is_negative) = callback_mock.get_last_sy();
    assert(sy_magnitude == sy_out, 'Wrong SY magnitude');
    assert(sy_is_negative == false, 'SY should be positive');
}

#[test]
fn test_swap_exact_sy_for_pt_with_callback() {
    let (underlying, sy, yt, pt, market, callback_mock) = setup();
    let user = user1();

    // Setup user with tokens
    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Transfer SY to callback contract for the swap
    let swap_amount = 10 * WAD;
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(callback_mock.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    // Approve market from callback contract
    start_cheat_caller_address(callback_mock.contract_address, callback_mock.contract_address);
    callback_mock.approve_market(swap_amount);
    stop_cheat_caller_address(callback_mock.contract_address);

    // Verify callback count is 0 before swap
    assert(callback_mock.get_callback_count() == 0, 'Count should be 0 before');

    // Prepare callback data (non-empty to trigger callback)
    let callback_data = array![1_felt252];

    // Execute swap with callback
    start_cheat_caller_address(market.contract_address, callback_mock.contract_address);
    let pt_out = market
        .swap_exact_sy_for_pt(callback_mock.contract_address, swap_amount, 0, callback_data.span());
    stop_cheat_caller_address(market.contract_address);

    // Verify callback was invoked
    assert(callback_mock.get_callback_count() == 1, 'Callback not called');

    // Verify callback received correct SY info
    // SY was sent TO market, so is_negative=true
    let (sy_magnitude, sy_is_negative) = callback_mock.get_last_sy();
    assert(sy_magnitude == swap_amount, 'Wrong SY magnitude');
    assert(sy_is_negative == true, 'SY should be negative');

    // Verify callback received correct PT info
    // PT was received FROM market, so is_negative=false
    let (pt_magnitude, pt_is_negative) = callback_mock.get_last_pt();
    assert(pt_magnitude == pt_out, 'Wrong PT magnitude');
    assert(pt_is_negative == false, 'PT should be positive');
}

#[test]
fn test_swap_sy_for_exact_pt_with_callback() {
    let (underlying, sy, yt, pt, market, callback_mock) = setup();
    let user = user1();

    // Setup user with tokens
    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Transfer SY to callback contract (more than needed)
    let max_sy_in = 20 * WAD;
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(callback_mock.contract_address, max_sy_in);
    stop_cheat_caller_address(sy.contract_address);

    // Approve market from callback contract
    start_cheat_caller_address(callback_mock.contract_address, callback_mock.contract_address);
    callback_mock.approve_market(max_sy_in);
    stop_cheat_caller_address(callback_mock.contract_address);

    // Prepare callback data
    let callback_data = array![1_felt252];

    // Want to get exactly 5 PT
    let exact_pt_out = 5 * WAD;

    // Execute swap with callback
    start_cheat_caller_address(market.contract_address, callback_mock.contract_address);
    let sy_spent = market
        .swap_sy_for_exact_pt(
            callback_mock.contract_address, exact_pt_out, max_sy_in, callback_data.span(),
        );
    stop_cheat_caller_address(market.contract_address);

    // Verify callback was invoked
    assert(callback_mock.get_callback_count() == 1, 'Callback not called');

    // Verify callback received correct values
    let (pt_magnitude, pt_is_negative) = callback_mock.get_last_pt();
    assert(pt_magnitude == exact_pt_out, 'Wrong PT magnitude');
    assert(pt_is_negative == false, 'PT should be positive');

    let (sy_magnitude, sy_is_negative) = callback_mock.get_last_sy();
    assert(sy_magnitude == sy_spent, 'Wrong SY magnitude');
    assert(sy_is_negative == true, 'SY should be negative');
}

#[test]
fn test_swap_pt_for_exact_sy_with_callback() {
    let (underlying, sy, yt, pt, market, callback_mock) = setup();
    let user = user1();

    // Setup user with larger token amounts for this test
    setup_user_with_tokens(underlying, sy, yt, user, 2000 * WAD);

    // Add liquidity (larger pool to avoid hitting proportion bounds)
    add_liquidity(sy, pt, market, user, 500 * WAD, 500 * WAD);

    // Transfer PT to callback contract (more than needed)
    let max_pt_in = 20 * WAD;
    start_cheat_caller_address(pt.contract_address, user);
    pt.transfer(callback_mock.contract_address, max_pt_in);
    stop_cheat_caller_address(pt.contract_address);

    // Approve market from callback contract
    start_cheat_caller_address(callback_mock.contract_address, callback_mock.contract_address);
    callback_mock.approve_market(max_pt_in);
    stop_cheat_caller_address(callback_mock.contract_address);

    // Prepare callback data
    let callback_data = array![1_felt252];

    // Want to get exactly 5 SY
    let exact_sy_out = 5 * WAD;

    // Execute swap with callback
    start_cheat_caller_address(market.contract_address, callback_mock.contract_address);
    let pt_spent = market
        .swap_pt_for_exact_sy(
            callback_mock.contract_address, exact_sy_out, max_pt_in, callback_data.span(),
        );
    stop_cheat_caller_address(market.contract_address);

    // Verify callback was invoked
    assert(callback_mock.get_callback_count() == 1, 'Callback not called');

    // Verify callback received correct values
    let (sy_magnitude, sy_is_negative) = callback_mock.get_last_sy();
    assert(sy_magnitude == exact_sy_out, 'Wrong SY magnitude');
    assert(sy_is_negative == false, 'SY should be positive');

    let (pt_magnitude, pt_is_negative) = callback_mock.get_last_pt();
    assert(pt_magnitude == pt_spent, 'Wrong PT magnitude');
    assert(pt_is_negative == true, 'PT should be negative');
}

#[test]
fn test_swap_without_callback_data() {
    let (underlying, sy, yt, pt, market, callback_mock) = setup();
    let user = user1();

    // Setup user with tokens
    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Transfer PT to callback contract for the swap
    let swap_amount = 10 * WAD;
    start_cheat_caller_address(pt.contract_address, user);
    pt.transfer(callback_mock.contract_address, swap_amount);
    stop_cheat_caller_address(pt.contract_address);

    // Approve market from callback contract
    start_cheat_caller_address(callback_mock.contract_address, callback_mock.contract_address);
    callback_mock.approve_market(swap_amount);
    stop_cheat_caller_address(callback_mock.contract_address);

    // Execute swap with EMPTY callback data (no callback should be invoked)
    let empty_callback_data: Array<felt252> = array![];

    start_cheat_caller_address(market.contract_address, callback_mock.contract_address);
    market
        .swap_exact_pt_for_sy(
            callback_mock.contract_address, swap_amount, 0, empty_callback_data.span(),
        );
    stop_cheat_caller_address(market.contract_address);

    // Verify callback was NOT invoked (empty data = no callback)
    assert(callback_mock.get_callback_count() == 0, 'Callback should not be called');
}

#[test]
fn test_multiple_swaps_with_callbacks() {
    let (underlying, sy, yt, pt, market, callback_mock) = setup();
    let user = user1();

    // Setup user with tokens
    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);

    // Add liquidity
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Transfer tokens to callback contract
    let swap_amount = 10 * WAD;
    start_cheat_caller_address(pt.contract_address, user);
    pt.transfer(callback_mock.contract_address, swap_amount * 3);
    stop_cheat_caller_address(pt.contract_address);

    // Approve market from callback contract
    start_cheat_caller_address(callback_mock.contract_address, callback_mock.contract_address);
    callback_mock.approve_market(swap_amount * 3);
    stop_cheat_caller_address(callback_mock.contract_address);

    let callback_data = array![1_felt252];

    // Execute first swap
    start_cheat_caller_address(market.contract_address, callback_mock.contract_address);
    market
        .swap_exact_pt_for_sy(callback_mock.contract_address, swap_amount, 0, callback_data.span());
    stop_cheat_caller_address(market.contract_address);

    assert(callback_mock.get_callback_count() == 1, 'Should have 1 callback');

    // Execute second swap
    start_cheat_caller_address(market.contract_address, callback_mock.contract_address);
    market
        .swap_exact_pt_for_sy(callback_mock.contract_address, swap_amount, 0, callback_data.span());
    stop_cheat_caller_address(market.contract_address);

    assert(callback_mock.get_callback_count() == 2, 'Should have 2 callbacks');

    // Execute third swap
    start_cheat_caller_address(market.contract_address, callback_mock.contract_address);
    market
        .swap_exact_pt_for_sy(callback_mock.contract_address, swap_amount, 0, callback_data.span());
    stop_cheat_caller_address(market.contract_address);

    assert(callback_mock.get_callback_count() == 3, 'Should have 3 callbacks');
}

#[test]
fn test_callback_data_passed_through() {
    let (underlying, sy, yt, pt, market, callback_mock) = setup();
    let user = user1();

    // Setup user with tokens
    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Transfer PT to callback contract
    let swap_amount = 10 * WAD;
    start_cheat_caller_address(pt.contract_address, user);
    pt.transfer(callback_mock.contract_address, swap_amount);
    stop_cheat_caller_address(pt.contract_address);

    // Approve market from callback contract
    start_cheat_caller_address(callback_mock.contract_address, callback_mock.contract_address);
    callback_mock.approve_market(swap_amount);
    stop_cheat_caller_address(callback_mock.contract_address);

    // Prepare callback data with multiple elements
    let callback_data = array![
        market.contract_address.into(), sy.contract_address.into(), pt.contract_address.into(),
        123_felt252 // arbitrary data
    ];

    // Execute swap with custom callback data
    start_cheat_caller_address(market.contract_address, callback_mock.contract_address);
    market
        .swap_exact_pt_for_sy(callback_mock.contract_address, swap_amount, 0, callback_data.span());
    stop_cheat_caller_address(market.contract_address);

    // Verify callback was invoked (data was passed through)
    assert(callback_mock.get_callback_count() == 1, 'Callback not called');
}
