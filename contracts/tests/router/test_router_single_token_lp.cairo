/// Tests for single-token LP operations (add_liquidity_single_token, remove_liquidity_single_token)
///
/// These tests focus on:
/// - Basic functionality of single-token liquidity operations through aggregator
/// - LP ratio calculation edge cases with token conversion
/// - Slippage protection for aggregator-based LP operations
/// - Round-trip scenarios (add + remove)

use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_router::{
    IRouterDispatcher, IRouterDispatcherTrait, SwapData, TokenInput, TokenOutput,
};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_aggregator::{IMockAggregatorDispatcher, IMockAggregatorDispatcherTrait};
use horizon::mocks::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use horizon::mocks::mock_yield_token::IMockYieldTokenDispatcher;
use openzeppelin_interfaces::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};
use crate::utils::{
    CURRENT_TIME, DEFAULT_DEADLINE, ONE_YEAR, admin, append_bytearray, deploy_sy, deploy_yt,
    get_pt_class_hash, user1, user2,
};

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

// Deploy market
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
    calldata.append(0); // reward_tokens array length

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketDispatcher { contract_address }
}

// Deploy router
fn deploy_router() -> IRouterDispatcher {
    let contract = declare("Router").unwrap_syscall().contract_class();
    let mut calldata = array![];
    calldata.append(admin().into()); // owner
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IRouterDispatcher { contract_address }
}

// Deploy mock aggregator
fn deploy_mock_aggregator() -> IMockAggregatorDispatcher {
    let contract = declare("MockAggregator").unwrap_syscall().contract_class();
    let (contract_address, _) = contract.deploy(@array![]).unwrap_syscall();
    IMockAggregatorDispatcher { contract_address }
}

// Deploy external token (separate from yield token system)
fn deploy_external_token() -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'External Token', 14);
    append_bytearray(ref calldata, 'EXT', 3);
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMockERC20Dispatcher { contract_address }
}

// Deploy full stack for token aggregation testing
// Uses MockERC20 as underlying (not ERC4626) for MockAggregator compatibility
fn deploy_test_stack() -> (
    IMockERC20Dispatcher, // underlying (simple ERC20 token that SY wraps)
    IMockYieldTokenDispatcher, // yield_token (used for yield index oracle only)
    ISYDispatcher,
    IYTDispatcher,
    IPTDispatcher,
    IMarketDispatcher,
    IRouterDispatcher,
    IMockAggregatorDispatcher,
    IMockERC20Dispatcher // external_token (separate token for aggregator swaps)
) {
    start_cheat_block_timestamp_global(CURRENT_TIME);

    // Deploy underlying asset (simple MockERC20 - compatible with MockAggregator.mint)
    let underlying_contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'Underlying', 10);
    append_bytearray(ref calldata, 'UNDR', 4);
    let (underlying_address, _) = underlying_contract.deploy(@calldata).unwrap_syscall();
    let underlying = IMockERC20Dispatcher { contract_address: underlying_address };

    // Deploy yield token for index oracle (needed for SY exchange rate calculations)
    // Uses underlying as its base asset
    let yield_token_contract = declare("MockYieldToken").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'MockYieldToken', 14);
    append_bytearray(ref calldata, 'MYT', 3);
    calldata.append(underlying_address.into());
    calldata.append(admin().into());
    let (yield_token_address, _) = yield_token_contract.deploy(@calldata).unwrap_syscall();
    let yield_token = IMockYieldTokenDispatcher { contract_address: yield_token_address };

    // Deploy SY with underlying as deposit token, yield_token as index oracle
    // is_erc4626 = false since underlying is plain ERC20
    let sy = deploy_sy(underlying_address, yield_token_address, false);

    // Deploy YT (and PT)
    let expiry = CURRENT_TIME + ONE_YEAR;
    let yt = deploy_yt(sy.contract_address, get_pt_class_hash(), expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Deploy Market and Router
    let market = deploy_market(pt.contract_address);
    let router = deploy_router();

    // Deploy mock aggregator
    let aggregator = deploy_mock_aggregator();

    // Deploy external token (separate from the yield token system)
    let external_token = deploy_external_token();

    (underlying, yield_token, sy, yt, pt, market, router, aggregator, external_token)
}

// Helper: Setup user with SY tokens (using MockERC20 underlying)
fn setup_user_with_sy(
    underlying: IMockERC20Dispatcher, sy: ISYDispatcher, user: ContractAddress, amount: u256,
) {
    // Mint underlying tokens to user
    underlying.mint(user, amount);

    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, underlying.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);
}

// Helper: Setup user with SY and PT tokens (for market operations)
fn setup_user_with_tokens(
    underlying: IMockERC20Dispatcher,
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

// Helper: Initialize pool with liquidity
// Note: This helper creates max(amount_sy, amount_pt) of both SY and PT
// to ensure we have enough tokens for any ratio
fn initialize_pool(
    underlying: IMockERC20Dispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    pt: IPTDispatcher,
    market: IMarketDispatcher,
    user: ContractAddress,
    amount_sy: u256,
    amount_pt: u256,
) {
    // Create enough tokens for the larger of the two amounts
    let max_amount = if amount_sy > amount_pt {
        amount_sy
    } else {
        amount_pt
    };
    setup_user_with_tokens(underlying, sy, yt, user, max_amount);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, amount_sy);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, amount_pt);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, amount_sy, amount_pt);
    stop_cheat_caller_address(market.contract_address);
}

// Helper: Setup aggregator exchange rates for token <-> underlying swaps
fn setup_aggregator_rates(
    aggregator: IMockAggregatorDispatcher,
    external_token: ContractAddress,
    underlying: ContractAddress,
    rate_in: u256, // external -> underlying rate (WAD)
    rate_out: u256 // underlying -> external rate (WAD)
) {
    // Set exchange rate: external_token -> underlying
    aggregator.set_exchange_rate(external_token, underlying, rate_in);
    // Set exchange rate: underlying -> external_token
    aggregator.set_exchange_rate(underlying, external_token, rate_out);
}

// Helper: Mint external tokens to user
fn mint_external_token_to_user(
    external_token: IMockERC20Dispatcher, user: ContractAddress, amount: u256,
) {
    external_token.mint(user, amount);
}

// ============ add_liquidity_single_token Tests ============

#[test]
fn test_add_liquidity_single_token_basic() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup aggregator rates (1:1)
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, WAD, WAD,
    );

    // Mint external tokens to user
    let token_amount = 20 * WAD;
    mint_external_token_to_user(external_token, user, token_amount);

    // Approve router
    start_cheat_caller_address(external_token.contract_address, user);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    let lp_before = lp_token.balance_of(user);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    // Execute add_liquidity_single_token
    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_token(market.contract_address, user, input, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Verify LP received
    assert(lp_out > 0, 'No LP received');
    assert(lp_token.balance_of(user) == lp_before + lp_out, 'LP balance mismatch');

    // Verify both SY and PT were used
    assert(sy_used > 0, 'No SY used');
    assert(pt_used > 0, 'No PT used');

    // Verify external token was spent
    assert(external_token.balance_of(user) == 0, 'External token not spent');
}

#[test]
fn test_add_liquidity_single_token_to_receiver() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let sender = user1();
    let receiver = user2();

    // Initialize pool with a different user
    let lp_provider: ContractAddress = 'lp_provider'.try_into().unwrap();
    initialize_pool(underlying, sy, yt, pt, market, lp_provider, 100 * WAD, 100 * WAD);

    // Setup aggregator rates
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, WAD, WAD,
    );

    // Mint external tokens to sender
    let token_amount = 20 * WAD;
    mint_external_token_to_user(external_token, sender, token_amount);

    // Approve router
    start_cheat_caller_address(external_token.contract_address, sender);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    let sender_lp_before = lp_token.balance_of(sender);
    let receiver_lp_before = lp_token.balance_of(receiver);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    // Execute with receiver
    start_cheat_caller_address(router.contract_address, sender);
    let (_, _, lp_out) = router
        .add_liquidity_single_token(market.contract_address, receiver, input, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Verify LP went to receiver, not sender
    assert(lp_token.balance_of(sender) == sender_lp_before, 'Sender LP should not change');
    assert(lp_token.balance_of(receiver) == receiver_lp_before + lp_out, 'Receiver should have LP');
}

#[test]
#[should_panic(expected: ('HZN: slippage exceeded',))]
fn test_add_liquidity_single_token_slippage_protection() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup aggregator rates
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, WAD, WAD,
    );

    // Mint and approve
    let token_amount = 20 * WAD;
    mint_external_token_to_user(external_token, user, token_amount);

    start_cheat_caller_address(external_token.contract_address, user);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    // Try with unrealistic min_lp_out (should fail)
    start_cheat_caller_address(router.contract_address, user);
    router
        .add_liquidity_single_token(
            market.contract_address, user, input, token_amount * 1000, DEFAULT_DEADLINE,
        );
}

#[test]
#[should_panic(expected: ('HZN: deadline exceeded',))]
fn test_add_liquidity_single_token_deadline() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup aggregator rates
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, WAD, WAD,
    );

    // Mint and approve
    let token_amount = 20 * WAD;
    mint_external_token_to_user(external_token, user, token_amount);

    start_cheat_caller_address(external_token.contract_address, user);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    // Advance time past deadline
    start_cheat_block_timestamp_global(CURRENT_TIME + 1000);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    // Try with expired deadline
    start_cheat_caller_address(router.contract_address, user);
    router
        .add_liquidity_single_token(
            market.contract_address, user, input, 0, CURRENT_TIME + 500,
        ); // deadline passed
}

// ============ remove_liquidity_single_token Tests ============

#[test]
fn test_remove_liquidity_single_token_basic() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup aggregator rates
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, WAD, WAD,
    );

    // First add liquidity to get LP tokens
    let token_amount = 20 * WAD;
    mint_external_token_to_user(external_token, user, token_amount);

    start_cheat_caller_address(external_token.contract_address, user);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    let (_, _, lp_out) = router
        .add_liquidity_single_token(market.contract_address, user, input, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    assert(lp_out > 0, 'No LP from add');

    // Now remove liquidity single token
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    let external_before = external_token.balance_of(user);

    // Approve router to spend LP
    start_cheat_caller_address(market.contract_address, user);
    lp_token.approve(router.contract_address, lp_out);
    stop_cheat_caller_address(market.contract_address);

    let output = TokenOutput {
        token: external_token.contract_address,
        min_amount: 0,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    // Execute remove_liquidity_single_token
    start_cheat_caller_address(router.contract_address, user);
    let token_out = router
        .remove_liquidity_single_token(
            market.contract_address, user, lp_out, output, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify external token received
    assert(token_out > 0, 'No token received');
    assert(
        external_token.balance_of(user) == external_before + token_out, 'Token balance mismatch',
    );

    // Verify LP was burned
    assert(lp_token.balance_of(user) == 0, 'LP not burned');
}

#[test]
fn test_remove_liquidity_single_token_to_receiver() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let sender = user1();
    let receiver = user2();

    // Initialize pool
    let lp_provider: ContractAddress = 'lp_provider'.try_into().unwrap();
    initialize_pool(underlying, sy, yt, pt, market, lp_provider, 100 * WAD, 100 * WAD);

    // Setup aggregator rates
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, WAD, WAD,
    );

    // Add liquidity for sender to get LP tokens
    let token_amount = 20 * WAD;
    mint_external_token_to_user(external_token, sender, token_amount);

    start_cheat_caller_address(external_token.contract_address, sender);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, sender);
    let (_, _, lp_out) = router
        .add_liquidity_single_token(market.contract_address, sender, input, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Approve router to spend LP
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    start_cheat_caller_address(market.contract_address, sender);
    lp_token.approve(router.contract_address, lp_out);
    stop_cheat_caller_address(market.contract_address);

    let sender_token_before = external_token.balance_of(sender);
    let receiver_token_before = external_token.balance_of(receiver);

    let output = TokenOutput {
        token: external_token.contract_address,
        min_amount: 0,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    // Remove liquidity to receiver
    start_cheat_caller_address(router.contract_address, sender);
    let token_out = router
        .remove_liquidity_single_token(
            market.contract_address, receiver, lp_out, output, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify tokens went to receiver
    assert(external_token.balance_of(sender) == sender_token_before, 'Sender token should not chg');
    assert(
        external_token.balance_of(receiver) == receiver_token_before + token_out,
        'Receiver should have token',
    );
}

#[test]
#[should_panic(expected: ('MockAggregator: slippage',))]
fn test_remove_liquidity_single_token_slippage_protection() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup aggregator rates
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, WAD, WAD,
    );

    // Add liquidity to get LP tokens
    let token_amount = 20 * WAD;
    mint_external_token_to_user(external_token, user, token_amount);

    start_cheat_caller_address(external_token.contract_address, user);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    let (_, _, lp_out) = router
        .add_liquidity_single_token(market.contract_address, user, input, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Approve router to spend LP
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    start_cheat_caller_address(market.contract_address, user);
    lp_token.approve(router.contract_address, lp_out);
    stop_cheat_caller_address(market.contract_address);

    // Request unrealistic min_amount (should fail)
    let output = TokenOutput {
        token: external_token.contract_address,
        min_amount: token_amount * 1000, // unrealistic
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    router
        .remove_liquidity_single_token(
            market.contract_address, user, lp_out, output, DEFAULT_DEADLINE,
        );
}

#[test]
#[should_panic(expected: ('HZN: deadline exceeded',))]
fn test_remove_liquidity_single_token_deadline() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup aggregator rates
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, WAD, WAD,
    );

    // Add liquidity to get LP tokens
    let token_amount = 20 * WAD;
    mint_external_token_to_user(external_token, user, token_amount);

    start_cheat_caller_address(external_token.contract_address, user);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    let (_, _, lp_out) = router
        .add_liquidity_single_token(market.contract_address, user, input, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Approve router to spend LP
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    start_cheat_caller_address(market.contract_address, user);
    lp_token.approve(router.contract_address, lp_out);
    stop_cheat_caller_address(market.contract_address);

    // Advance time past deadline
    start_cheat_block_timestamp_global(CURRENT_TIME + 1000);

    let output = TokenOutput {
        token: external_token.contract_address,
        min_amount: 0,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    // Try with expired deadline
    start_cheat_caller_address(router.contract_address, user);
    router
        .remove_liquidity_single_token(
            market.contract_address, user, lp_out, output, CURRENT_TIME + 500,
        ); // deadline passed
}

// ============ LP Ratio Calculation Edge Cases ============

#[test]
fn test_single_token_lp_with_favorable_exchange_rate() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup favorable rate: 1 external = 2 underlying
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, 2 * WAD, WAD / 2,
    );

    let token_amount = 10 * WAD;
    mint_external_token_to_user(external_token, user, token_amount);

    start_cheat_caller_address(external_token.contract_address, user);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_token(market.contract_address, user, input, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // With 2:1 rate, we should get more LP than with 1:1 rate
    // The underlying amount should be doubled from the token amount
    assert(lp_out > 0, 'No LP received');
    assert(sy_used > 0, 'No SY used');
    assert(pt_used > 0, 'No PT used');
}

#[test]
fn test_single_token_lp_with_unfavorable_exchange_rate() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup unfavorable rate: 1 external = 0.5 underlying
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, WAD / 2, 2 * WAD,
    );

    let token_amount = 10 * WAD;
    mint_external_token_to_user(external_token, user, token_amount);

    start_cheat_caller_address(external_token.contract_address, user);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_token(market.contract_address, user, input, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // With 0.5:1 rate, we should still get LP but less
    assert(lp_out > 0, 'No LP received');
    assert(sy_used > 0, 'No SY used');
    assert(pt_used > 0, 'No PT used');
}

#[test]
fn test_single_token_lp_round_trip() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    // Initialize pool
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup 1:1 rates
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, WAD, WAD,
    );

    // Add liquidity
    let token_amount = 20 * WAD;
    mint_external_token_to_user(external_token, user, token_amount);
    let initial_balance = external_token.balance_of(user);

    start_cheat_caller_address(external_token.contract_address, user);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    let (_, _, lp_out) = router
        .add_liquidity_single_token(market.contract_address, user, input, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Remove liquidity
    let lp_token = IERC20Dispatcher { contract_address: market.contract_address };
    start_cheat_caller_address(market.contract_address, user);
    lp_token.approve(router.contract_address, lp_out);
    stop_cheat_caller_address(market.contract_address);

    let output = TokenOutput {
        token: external_token.contract_address,
        min_amount: 0,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    let token_out = router
        .remove_liquidity_single_token(
            market.contract_address, user, lp_out, output, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Verify round-trip: should recover most of the tokens (minus fees)
    let final_balance = external_token.balance_of(user);
    assert(token_out > 0, 'No token out');
    assert(final_balance > 0, 'Final balance is zero');
    // Due to multiple swaps (token->underlying, SY<->PT for LP, then reverse), fees compound
    // Single-token LP round-trip has higher slippage than direct operations
    // We expect at least 70% recovery after all fees and slippage
    assert(final_balance > initial_balance * 70 / 100, 'Too much loss in round trip');
}

#[test]
fn test_single_token_lp_small_amount() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    // Initialize pool with large liquidity
    initialize_pool(underlying, sy, yt, pt, market, user2(), 1000 * WAD, 1000 * WAD);

    // Setup 1:1 rates
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, WAD, WAD,
    );

    // Add small amount of liquidity
    let token_amount = WAD / 10; // 0.1 tokens
    mint_external_token_to_user(external_token, user, token_amount);

    start_cheat_caller_address(external_token.contract_address, user);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_token(market.contract_address, user, input, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Should still work with small amounts
    assert(lp_out > 0, 'No LP received for small amount');
    assert(sy_used > 0, 'No SY used for small amount');
    assert(pt_used > 0, 'No PT used for small amount');
}

#[test]
fn test_single_token_lp_large_amount() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    // Initialize pool with moderate liquidity
    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    // Setup 1:1 rates
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, WAD, WAD,
    );

    // Add large amount of liquidity (half of pool)
    let token_amount = 50 * WAD;
    mint_external_token_to_user(external_token, user, token_amount);

    start_cheat_caller_address(external_token.contract_address, user);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_token(market.contract_address, user, input, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Should work with large amounts (significant price impact expected)
    assert(lp_out > 0, 'No LP received for large amount');
    assert(sy_used > 0, 'No SY used for large amount');
    assert(pt_used > 0, 'No PT used for large amount');
}

// ============ Validation Tests ============

#[test]
#[should_panic(expected: ('HZN: zero address',))]
fn test_add_liquidity_single_token_zero_market() {
    let (_, _, _, _, _, _, router, aggregator, external_token) = deploy_test_stack();
    let user = user1();
    let zero_address: ContractAddress = 0.try_into().unwrap();

    let input = TokenInput {
        token: external_token.contract_address,
        amount: WAD,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    router.add_liquidity_single_token(zero_address, user, input, 0, DEFAULT_DEADLINE);
}

#[test]
#[should_panic(expected: ('HZN: zero address',))]
fn test_add_liquidity_single_token_zero_receiver() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();
    let zero_address: ContractAddress = 0.try_into().unwrap();

    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: WAD,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    router
        .add_liquidity_single_token(
            market.contract_address, zero_address, input, 0, DEFAULT_DEADLINE,
        );
}

#[test]
#[should_panic(expected: ('HZN: zero amount',))]
fn test_add_liquidity_single_token_zero_amount() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: 0, // zero amount
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    router.add_liquidity_single_token(market.contract_address, user, input, 0, DEFAULT_DEADLINE);
}

#[test]
#[should_panic(expected: ('HZN: invalid aggregator',))]
fn test_add_liquidity_single_token_zero_aggregator() {
    let (underlying, _, sy, yt, pt, market, router, _, external_token) = deploy_test_stack();
    let user = user1();
    let zero_address: ContractAddress = 0.try_into().unwrap();

    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: WAD,
        swap_data: SwapData { aggregator: zero_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    router.add_liquidity_single_token(market.contract_address, user, input, 0, DEFAULT_DEADLINE);
}

#[test]
#[should_panic(expected: ('HZN: zero amount',))]
fn test_remove_liquidity_single_token_zero_lp() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    initialize_pool(underlying, sy, yt, pt, market, user2(), 100 * WAD, 100 * WAD);

    let output = TokenOutput {
        token: external_token.contract_address,
        min_amount: 0,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    router
        .remove_liquidity_single_token(
            market.contract_address, user, 0, output, DEFAULT_DEADLINE,
        ); // zero LP
}

// ============ Imbalanced Pool Tests ============

#[test]
fn test_single_token_lp_imbalanced_pool_more_sy() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    // Initialize pool with imbalanced ratio (more SY than PT)
    // Pool will have 150 SY and 50 PT
    initialize_pool(underlying, sy, yt, pt, market, user2(), 150 * WAD, 50 * WAD);

    // Setup 1:1 rates
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, WAD, WAD,
    );

    let token_amount = 20 * WAD;
    mint_external_token_to_user(external_token, user, token_amount);

    start_cheat_caller_address(external_token.contract_address, user);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_token(market.contract_address, user, input, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Should handle imbalanced pool correctly
    assert(lp_out > 0, 'No LP received');
    assert(sy_used > 0, 'No SY used');
    assert(pt_used > 0, 'No PT used');
}

#[test]
fn test_single_token_lp_imbalanced_pool_more_pt() {
    let (underlying, _, sy, yt, pt, market, router, aggregator, external_token) =
        deploy_test_stack();
    let user = user1();

    // Initialize pool with imbalanced ratio (more PT)
    initialize_pool(underlying, sy, yt, pt, market, user2(), 50 * WAD, 200 * WAD);

    // Setup 1:1 rates
    setup_aggregator_rates(
        aggregator, external_token.contract_address, underlying.contract_address, WAD, WAD,
    );

    let token_amount = 20 * WAD;
    mint_external_token_to_user(external_token, user, token_amount);

    start_cheat_caller_address(external_token.contract_address, user);
    external_token.approve(router.contract_address, token_amount);
    stop_cheat_caller_address(external_token.contract_address);

    let input = TokenInput {
        token: external_token.contract_address,
        amount: token_amount,
        swap_data: SwapData { aggregator: aggregator.contract_address, calldata: array![].span() },
    };

    start_cheat_caller_address(router.contract_address, user);
    let (sy_used, pt_used, lp_out) = router
        .add_liquidity_single_token(market.contract_address, user, input, 0, DEFAULT_DEADLINE);
    stop_cheat_caller_address(router.contract_address);

    // Should handle imbalanced pool correctly
    assert(lp_out > 0, 'No LP received');
    assert(sy_used > 0, 'No SY used');
    assert(pt_used > 0, 'No PT used');
}
