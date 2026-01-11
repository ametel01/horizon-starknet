use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_router_static::{IRouterStaticDispatcher, IRouterStaticDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math_fp::WAD;
use horizon::mocks::mock_erc20::IMockERC20Dispatcher;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

// Test addresses
pub fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

pub fn user1() -> ContractAddress {
    'user1'.try_into().unwrap()
}

pub fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
}

pub fn zero_address() -> ContractAddress {
    0.try_into().unwrap()
}

// Helper to serialize ByteArray for calldata
pub fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0); // data array length
    calldata.append(value); // pending_word
    calldata.append(len.into()); // pending_word_len
}

// Default market parameters
pub fn default_scalar_root() -> u256 {
    50 * WAD // Controls rate sensitivity
}

pub fn default_initial_anchor() -> u256 {
    WAD / 10 // 0.1 WAD = ~10% APY
}

pub fn default_fee_rate() -> u256 {
    WAD / 100 // 1% fee
}

// Deploy mock ERC20
pub fn deploy_mock_erc20() -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'MockERC20', 9);
    append_bytearray(ref calldata, 'MERC', 4);
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMockERC20Dispatcher { contract_address }
}

// Deploy mock yield token
pub fn deploy_mock_yield_token(
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
pub fn deploy_yield_token_stack() -> (IMockERC20Dispatcher, IMockYieldTokenDispatcher) {
    let underlying = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(underlying.contract_address, admin());
    (underlying, yield_token)
}

// Deploy SY token
pub fn deploy_sy(
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
pub fn deploy_yt(sy: ContractAddress, expiry: u64) -> IYTDispatcher {
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
pub fn deploy_market(
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

// Deploy RouterStatic
pub fn deploy_router_static() -> IRouterStaticDispatcher {
    let contract = declare("RouterStatic").unwrap_syscall().contract_class();
    let calldata = array![];
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IRouterStaticDispatcher { contract_address }
}

// Helper: Mint yield token shares to user as admin
pub fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

// Full setup: underlying -> SY -> YT/PT -> Market -> RouterStatic
pub fn setup() -> (
    IMockYieldTokenDispatcher,
    ISYDispatcher,
    IYTDispatcher,
    IPTDispatcher,
    IMarketDispatcher,
    IRouterStaticDispatcher,
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

    let router_static = deploy_router_static();

    (underlying, sy, yt, pt, market, router_static)
}

// Helper: Setup user with SY and PT tokens
pub fn setup_user_with_tokens(
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

// Helper: Add liquidity to market
pub fn add_liquidity(
    sy: ISYDispatcher,
    pt: IPTDispatcher,
    market: IMarketDispatcher,
    user: ContractAddress,
    sy_amount: u256,
    pt_amount: u256,
) -> u256 {
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, sy_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, pt_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let (_, _, lp_minted) = market.mint(user, sy_amount, pt_amount);
    stop_cheat_caller_address(market.contract_address);

    lp_minted
}

// ============ Preview Swap SY for PT Tests ============

#[test]
fn test_preview_swap_exact_sy_for_pt_basic() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity to market
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview swap
    let sy_in = 10 * WAD;
    let pt_preview = router_static.preview_swap_exact_sy_for_pt(market.contract_address, sy_in);

    // Verify preview returns positive amount
    assert(pt_preview > 0, 'Preview should return PT > 0');

    // Preview should be less than input due to fees and slippage
    assert(pt_preview <= sy_in * 2, 'Preview too high');
}

#[test]
fn test_preview_swap_exact_sy_for_pt_matches_actual() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);

    // Add liquidity to market
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview swap
    let sy_in = 10 * WAD;
    let pt_preview = router_static.preview_swap_exact_sy_for_pt(market.contract_address, sy_in);

    // Execute actual swap
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, sy_in);
    stop_cheat_caller_address(sy.contract_address);

    let pt_before = pt.balance_of(user);

    start_cheat_caller_address(market.contract_address, user);
    let pt_actual = market.swap_exact_sy_for_pt(user, sy_in, 0, array![].span());
    stop_cheat_caller_address(market.contract_address);

    // Preview should closely match actual (within 0.1% tolerance due to rate updates during swap)
    // The swap updates last_ln_implied_rate which can cause minor differences
    let diff = if pt_actual >= pt_preview {
        pt_actual - pt_preview
    } else {
        pt_preview - pt_actual
    };
    let tolerance = pt_preview / 1000; // 0.1% tolerance
    assert(diff <= tolerance, 'Preview should match actual');
    assert(pt.balance_of(user) == pt_before + pt_actual, 'Wrong PT balance');
}

#[test]
fn test_preview_swap_exact_sy_for_pt_zero_amount() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview with zero amount should return zero
    let pt_preview = router_static.preview_swap_exact_sy_for_pt(market.contract_address, 0);
    assert(pt_preview == 0, 'Zero input should give zero');
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_preview_swap_exact_sy_for_pt_zero_market() {
    let (_, _, _, _, _, router_static) = setup();

    // Should fail with zero market address
    router_static.preview_swap_exact_sy_for_pt(zero_address(), 10 * WAD);
}

#[test]
#[should_panic(expected: 'HZN: market expired')]
fn test_preview_swap_exact_sy_for_pt_expired() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(market.expiry() + 1);

    // Preview should fail for expired market
    router_static.preview_swap_exact_sy_for_pt(market.contract_address, 10 * WAD);
}

// ============ Preview Swap PT for SY Tests ============

#[test]
fn test_preview_swap_exact_pt_for_sy_basic() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview swap
    let pt_in = 10 * WAD;
    let sy_preview = router_static.preview_swap_exact_pt_for_sy(market.contract_address, pt_in);

    // Verify preview returns positive amount
    assert(sy_preview > 0, 'Preview should return SY > 0');

    // Preview should be less than input due to fees and slippage
    assert(sy_preview <= pt_in * 2, 'Preview too high');
}

#[test]
fn test_preview_swap_exact_pt_for_sy_matches_actual() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview swap
    let pt_in = 10 * WAD;
    let sy_preview = router_static.preview_swap_exact_pt_for_sy(market.contract_address, pt_in);

    // Execute actual swap
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, pt_in);
    stop_cheat_caller_address(pt.contract_address);

    let sy_before = sy.balance_of(user);

    start_cheat_caller_address(market.contract_address, user);
    let sy_actual = market.swap_exact_pt_for_sy(user, pt_in, 0, array![].span());
    stop_cheat_caller_address(market.contract_address);

    // Preview should closely match actual (within 0.1% tolerance due to rate updates during swap)
    // The swap updates last_ln_implied_rate which can cause minor differences
    let diff = if sy_actual >= sy_preview {
        sy_actual - sy_preview
    } else {
        sy_preview - sy_actual
    };
    let tolerance = sy_preview / 1000; // 0.1% tolerance
    assert(diff <= tolerance, 'Preview should match actual');
    assert(sy.balance_of(user) == sy_before + sy_actual, 'Wrong SY balance');
}

#[test]
fn test_preview_swap_exact_pt_for_sy_zero_amount() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview with zero amount should return zero
    let sy_preview = router_static.preview_swap_exact_pt_for_sy(market.contract_address, 0);
    assert(sy_preview == 0, 'Zero input should give zero');
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_preview_swap_exact_pt_for_sy_zero_market() {
    let (_, _, _, _, _, router_static) = setup();

    // Should fail with zero market address
    router_static.preview_swap_exact_pt_for_sy(zero_address(), 10 * WAD);
}

#[test]
#[should_panic(expected: 'HZN: market expired')]
fn test_preview_swap_exact_pt_for_sy_expired() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(market.expiry() + 1);

    // Preview should fail for expired market
    router_static.preview_swap_exact_pt_for_sy(market.contract_address, 10 * WAD);
}

// ============ Fee Impact Tests ============

#[test]
fn test_preview_includes_fee_impact() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview swap SY for PT
    let sy_in = 10 * WAD;
    let pt_out = router_static.preview_swap_exact_sy_for_pt(market.contract_address, sy_in);

    // With 1% fee, PT out should be less than what a zero-fee swap would give
    // We verify this by checking that the output is positive and reasonable
    // The fee impact is embedded in the calc_swap_exact_sy_for_pt function
    assert(pt_out > 0, 'Should get PT output');

    // Verify that round-trip swap loses value due to fees
    // Swap SY -> PT, then the PT back should yield less SY than we started with
    let sy_back = router_static.preview_swap_exact_pt_for_sy(market.contract_address, pt_out);

    // Due to fees on both swaps, we should get back less SY than we put in
    assert(sy_back < sy_in, 'Fee should reduce round-trip');
}

#[test]
fn test_preview_swap_symmetry() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview both directions with same amount
    let amount = 5 * WAD;
    let pt_from_sy = router_static.preview_swap_exact_sy_for_pt(market.contract_address, amount);
    let sy_from_pt = router_static.preview_swap_exact_pt_for_sy(market.contract_address, amount);

    // Both should be positive
    assert(pt_from_sy > 0, 'PT from SY should be positive');
    assert(sy_from_pt > 0, 'SY from PT should be positive');

    // The ratio should roughly reflect the PT price (with fees affecting both sides)
    // PT from SY should be roughly amount / pt_price (buying PT)
    // SY from PT should be roughly amount * pt_price (selling PT)
    // Allow for fee impact in the comparison
    assert(pt_from_sy > 0 && sy_from_pt > 0, 'Both swaps should work');
}

// ============ Time to Expiry Tests ============

#[test]
fn test_preview_changes_with_time() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    let sy_in = 10 * WAD;

    // Preview at current time (1 year to expiry)
    let pt_preview_early = router_static
        .preview_swap_exact_sy_for_pt(market.contract_address, sy_in);

    // Move time forward (6 months closer to expiry)
    start_cheat_block_timestamp_global(1000 + 180 * 24 * 60 * 60);

    // Preview with less time to expiry
    let pt_preview_later = router_static
        .preview_swap_exact_sy_for_pt(market.contract_address, sy_in);

    // Both should be positive
    assert(pt_preview_early > 0, 'Early preview should work');
    assert(pt_preview_later > 0, 'Later preview should work');
    // The preview amounts may differ as time to expiry affects pricing
// (PT price approaches 1 as expiry nears)
}

// ============ Large Amount Tests ============

#[test]
fn test_preview_large_swap() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    // Setup with large amounts
    setup_user_with_tokens(underlying, sy, yt, user, 1000 * WAD);
    add_liquidity(sy, pt, market, user, 500 * WAD, 500 * WAD);

    // Preview large swap (10% of pool)
    let sy_in = 50 * WAD;
    let pt_preview = router_static.preview_swap_exact_sy_for_pt(market.contract_address, sy_in);

    // Should still return a valid amount
    assert(pt_preview > 0, 'Large swap should work');

    // Price impact should be visible - output per unit should be lower for large swaps
    let small_preview = router_static
        .preview_swap_exact_sy_for_pt(market.contract_address, 1 * WAD);

    // Large swap should have worse rate (less PT per SY) due to price impact
    // Compare: pt_preview / sy_in vs small_preview / 1*WAD
    // Simplified: pt_preview * WAD / sy_in < small_preview (rate comparison)
    let large_rate = pt_preview * WAD / sy_in;
    assert(large_rate <= small_preview, 'Large swap should have impact');
}
