/// Test suite for Rate-Impact Fee Mechanism
///
/// Tests the dynamic fee model that adjusts fees based on how much a trade moves
/// the exchange rate. Larger trades that cause more rate impact pay higher fees,
/// protecting LPs from adverse selection.
///
/// Key formula from market_math_fp.cairo:
/// multiplier = 1 + sensitivity × |rate_after - rate_before| / rate_before
///
/// Test cases:
/// 1. Small trade → multiplier ≈ 1x (minimal impact)
/// 2. Large trade → multiplier > 1x (higher fee for LP protection)
/// 3. Multiplier capped at MAX_FEE_MULTIPLIER (2x)
/// 4. Edge case: zero rate_before returns 1x
/// 5. Integration: full swap with rate-impact fee applied

use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_market_factory::{
    IMarketFactoryDispatcher, IMarketFactoryDispatcherTrait,
};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math_fp::WAD;
use horizon::market::market_math_fp::{MAX_FEE_MULTIPLIER, calc_rate_impact_multiplier};
use horizon::mocks::mock_erc20::IMockERC20Dispatcher;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

// Constants
const SECONDS_PER_YEAR: u64 = 31_536_000;
const CURRENT_TIME: u64 = 1000;

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
    calldata.append(0);
    calldata.append(value);
    calldata.append(len.into());
}

// Default market parameters
fn default_scalar_root() -> u256 {
    100 * WAD // Realistic sensitivity for asset-based curve
}

fn default_initial_anchor() -> u256 {
    WAD // 1 WAD (minimum allowed - Pendle requires >= 1 WAD)
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

// Deploy yield token stack
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

// Deploy YT with custom expiry
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

// Deploy MarketFactory
fn deploy_market_factory() -> IMarketFactoryDispatcher {
    let market_class = declare("Market").unwrap_syscall().contract_class();
    let factory_class = declare("MarketFactory").unwrap_syscall().contract_class();

    let mut calldata = array![];
    calldata.append(admin().into()); // owner
    calldata.append((*market_class.class_hash).into());
    let zero: ContractAddress = 0.try_into().unwrap();
    calldata.append(zero.into()); // yield_contract_factory (zero = no validation)

    let (contract_address, _) = factory_class.deploy(@calldata).unwrap_syscall();
    IMarketFactoryDispatcher { contract_address }
}

// Helper: Mint yield token shares to user as admin
fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

// Setup with factory-deployed market for rate-impact tests
fn setup_with_factory(
    expiry: u64, rate_impact_sensitivity: u256,
) -> (
    IMockYieldTokenDispatcher,
    ISYDispatcher,
    IYTDispatcher,
    IPTDispatcher,
    IMarketDispatcher,
    IMarketFactoryDispatcher,
) {
    start_cheat_block_timestamp_global(CURRENT_TIME);

    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let factory = deploy_market_factory();

    // Configure factory with rate-impact sensitivity
    start_cheat_caller_address(factory.contract_address, admin());
    factory.set_default_rate_impact_sensitivity(rate_impact_sensitivity);
    stop_cheat_caller_address(factory.contract_address);

    // Create market through factory
    start_cheat_caller_address(factory.contract_address, admin());
    let market_address = factory
        .create_market(
            pt.contract_address,
            default_scalar_root(),
            default_initial_anchor(),
            default_fee_rate(),
            0, // reserve_fee_percent
            array![].span(),
        );
    stop_cheat_caller_address(factory.contract_address);

    let market = IMarketDispatcher { contract_address: market_address };

    (underlying, sy, yt, pt, market, factory)
}

// Setup user with SY and PT tokens
fn setup_user_with_tokens(
    underlying: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    user: ContractAddress,
    amount: u256,
) {
    mint_yield_token_to_user(underlying, user, amount * 2);

    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount * 2);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, underlying.contract_address, amount * 2, 0);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(yt.contract_address, user);
    yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);
}

// Add initial liquidity to market
fn add_liquidity(
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

/// Helper to check approximate equality within tolerance
fn assert_approx_eq(actual: u256, expected: u256, tolerance_bps: u256, msg: felt252) {
    let diff = if actual >= expected {
        actual - expected
    } else {
        expected - actual
    };
    // tolerance_bps is in basis points (e.g., 100 = 1%)
    let tolerance = expected * tolerance_bps / 10000;
    let tolerance = if tolerance == 0 {
        1
    } else {
        tolerance
    };
    assert(diff <= tolerance, msg);
}

// ============ Unit Tests for calc_rate_impact_multiplier ============

#[test]
fn test_rate_impact_multiplier_no_change() {
    // When rate doesn't change, multiplier should be exactly 1.0
    let rate_before = WAD; // 1.0
    let rate_after = WAD; // 1.0
    let sensitivity = WAD / 10; // 10% sensitivity

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    assert(multiplier == WAD, 'No change = 1x multiplier');
}

#[test]
fn test_rate_impact_multiplier_small_change() {
    // Small 1% rate change with 10% sensitivity
    // Expected: 1 + 0.1 * 0.01 = 1.001 (0.1% increase)
    let rate_before = WAD; // 1.0
    let rate_after = WAD + WAD / 100; // 1.01 (1% increase)
    let sensitivity = WAD / 10; // 10% sensitivity

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // multiplier = 1 + 0.1 * 0.01 = 1.001
    let expected = WAD + WAD / 1000; // 1.001
    assert_approx_eq(multiplier, expected, 10, 'Small change multiplier');
}

#[test]
fn test_rate_impact_multiplier_medium_change() {
    // 10% rate change with 50% sensitivity
    // Expected: 1 + 0.5 * 0.1 = 1.05 (5% increase)
    let rate_before = WAD; // 1.0
    let rate_after = WAD + WAD / 10; // 1.1 (10% increase)
    let sensitivity = WAD / 2; // 50% sensitivity

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // multiplier = 1 + 0.5 * 0.1 = 1.05
    let expected = WAD + WAD / 20; // 1.05
    assert_approx_eq(multiplier, expected, 10, 'Medium change multiplier');
}

#[test]
fn test_rate_impact_multiplier_large_change() {
    // 50% rate change with 100% sensitivity
    // Expected: 1 + 1.0 * 0.5 = 1.5 (50% increase)
    let rate_before = WAD; // 1.0
    let rate_after = WAD + WAD / 2; // 1.5 (50% increase)
    let sensitivity = WAD; // 100% sensitivity

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // multiplier = 1 + 1.0 * 0.5 = 1.5
    let expected = WAD + WAD / 2; // 1.5
    assert_approx_eq(multiplier, expected, 10, 'Large change multiplier');
}

#[test]
fn test_rate_impact_multiplier_capped_at_max() {
    // Very large rate change that would exceed 2x
    // 200% rate change with 100% sensitivity = 1 + 2 = 3, but capped at 2
    let rate_before = WAD; // 1.0
    let rate_after = WAD * 3; // 3.0 (200% increase)
    let sensitivity = WAD; // 100% sensitivity

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // Should be capped at MAX_FEE_MULTIPLIER (2.0 WAD)
    assert(multiplier == MAX_FEE_MULTIPLIER, 'Should cap at 2x');
}

#[test]
fn test_rate_impact_multiplier_extreme_sensitivity() {
    // Even small change with extreme sensitivity should cap
    let rate_before = WAD;
    let rate_after = WAD + WAD / 10; // 10% change
    let sensitivity = WAD * 100; // 10000% sensitivity (extreme)

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // 1 + 100 * 0.1 = 11, but capped at 2
    assert(multiplier == MAX_FEE_MULTIPLIER, 'Extreme sensitivity caps');
}

#[test]
fn test_rate_impact_multiplier_zero_rate_before() {
    // Edge case: rate_before = 0 should return 1.0 (no multiplier)
    let rate_before = 0;
    let rate_after = WAD;
    let sensitivity = WAD;

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    assert(multiplier == WAD, 'Zero rate = 1x multiplier');
}

#[test]
fn test_rate_impact_multiplier_zero_sensitivity() {
    // Zero sensitivity means no rate-impact fee (multiplier = 1.0)
    let rate_before = WAD;
    let rate_after = WAD * 2; // 100% change
    let sensitivity = 0;

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    assert(multiplier == WAD, 'Zero sensitivity = 1x');
}

#[test]
fn test_rate_impact_multiplier_rate_decrease() {
    // Rate decreasing should also trigger multiplier (uses abs_diff)
    let rate_before = WAD * 2; // 2.0
    let rate_after = WAD; // 1.0 (50% decrease)
    let sensitivity = WAD; // 100% sensitivity

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // multiplier = 1 + 1.0 * 0.5 = 1.5
    let expected = WAD + WAD / 2; // 1.5
    assert_approx_eq(multiplier, expected, 10, 'Decrease triggers multiplier');
}

#[test]
fn test_rate_impact_multiplier_small_rate_values() {
    // Test with small rate values to check precision
    let rate_before = WAD / 10; // 0.1
    let rate_after = WAD / 10 + WAD / 100; // 0.11 (10% increase)
    let sensitivity = WAD; // 100% sensitivity

    let multiplier = calc_rate_impact_multiplier(rate_before, rate_after, sensitivity);

    // multiplier = 1 + 1.0 * 0.1 = 1.1
    let expected = WAD + WAD / 10; // 1.1
    assert_approx_eq(multiplier, expected, 50, 'Small values precision');
}

// ============ Integration Tests with Market ============

#[test]
fn test_small_trade_minimal_rate_impact_fee() {
    // Small trade should have minimal rate impact, multiplier ≈ 1x
    let expiry = CURRENT_TIME + SECONDS_PER_YEAR;
    let sensitivity = WAD; // 100% sensitivity

    let (underlying, sy, yt, pt, market, _factory) = setup_with_factory(expiry, sensitivity);
    let user = user1();

    // Setup with large pool to minimize impact
    setup_user_with_tokens(underlying, sy, yt, user, 10000 * WAD);
    add_liquidity(sy, pt, market, user, 5000 * WAD, 5000 * WAD);

    // Small swap (0.1% of pool)
    let small_swap = 5 * WAD;
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, small_swap);
    stop_cheat_caller_address(pt.contract_address);

    let fees_before = market.get_total_fees_collected();

    start_cheat_caller_address(market.contract_address, user);
    let sy_out = market.swap_exact_pt_for_sy(user, small_swap, 0, array![].span());
    stop_cheat_caller_address(market.contract_address);

    let fees_after = market.get_total_fees_collected();
    let fee_collected = fees_after - fees_before;

    // Fee should be close to base fee (minimal rate-impact multiplier)
    // Base fee is ~1% of output at 1 year
    assert(sy_out > 0, 'Should get output');
    assert(fee_collected > 0, 'Should collect fees');

    // Fee should be reasonable (not excessively high)
    let max_expected_fee = sy_out / 10; // Max 10% of output
    assert(fee_collected < max_expected_fee, 'Fee should be reasonable');
}

#[test]
fn test_large_trade_higher_rate_impact_fee() {
    // Large trade should have higher rate impact → higher fees
    let expiry = CURRENT_TIME + SECONDS_PER_YEAR;
    let sensitivity = WAD; // 100% sensitivity

    let (underlying, sy, yt, pt, market, _factory) = setup_with_factory(expiry, sensitivity);
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 3000 * WAD);
    add_liquidity(sy, pt, market, user, 1000 * WAD, 1000 * WAD);

    // First: small swap for baseline
    let small_swap = 10 * WAD;
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 500 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    let fees_before_small = market.get_total_fees_collected();
    start_cheat_caller_address(market.contract_address, user);
    let sy_out_small = market.swap_exact_pt_for_sy(user, small_swap, 0, array![].span());
    stop_cheat_caller_address(market.contract_address);
    let fees_after_small = market.get_total_fees_collected();
    let small_trade_fee = fees_after_small - fees_before_small;

    // Calculate fee rate for small trade
    let small_fee_rate = if sy_out_small > 0 {
        (small_trade_fee * 10000) / sy_out_small // basis points
    } else {
        0
    };

    // Now: large swap (should have higher fee rate due to rate impact)
    let large_swap = 100 * WAD;
    let fees_before_large = market.get_total_fees_collected();
    start_cheat_caller_address(market.contract_address, user);
    let sy_out_large = market.swap_exact_pt_for_sy(user, large_swap, 0, array![].span());
    stop_cheat_caller_address(market.contract_address);
    let fees_after_large = market.get_total_fees_collected();
    let large_trade_fee = fees_after_large - fees_before_large;

    // Calculate fee rate for large trade
    let large_fee_rate = if sy_out_large > 0 {
        (large_trade_fee * 10000) / sy_out_large
    } else {
        0
    };

    // Large trade should have higher fee rate due to rate impact
    // Note: The difference depends on pool size and trade size ratio
    assert(large_trade_fee > 0, 'Large trade should have fee');
    assert(sy_out_large > 0, 'Should get output');

    // Fee rates comparison - large trade should have higher effective rate
    // Due to rate impact multiplier increasing with trade size
    assert(large_fee_rate >= small_fee_rate, 'Large trade higher fee rate');
}

#[test]
fn test_rate_impact_fee_with_zero_sensitivity() {
    // Zero sensitivity should mean no rate-impact fee adjustment
    let expiry = CURRENT_TIME + SECONDS_PER_YEAR;
    let sensitivity = 0; // No rate-impact fee

    let (underlying, sy, yt, pt, market, _factory) = setup_with_factory(expiry, sensitivity);
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 3000 * WAD);
    add_liquidity(sy, pt, market, user, 1000 * WAD, 1000 * WAD);

    // Do a large swap - should only have base fee
    let swap_amount = 100 * WAD;
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(pt.contract_address);

    let fees_before = market.get_total_fees_collected();

    start_cheat_caller_address(market.contract_address, user);
    let sy_out = market.swap_exact_pt_for_sy(user, swap_amount, 0, array![].span());
    stop_cheat_caller_address(market.contract_address);

    let fees_after = market.get_total_fees_collected();
    let fee_collected = fees_after - fees_before;

    // Fee should be based only on base fee rate (no multiplier)
    assert(sy_out > 0, 'Should get output');
    assert(fee_collected > 0, 'Should collect fees');

    // Fee should be approximately 1% of the pre-fee output
    // With zero sensitivity, fee = output * fee_rate / (1 - fee_rate)
    // For 1% fee: fee ≈ output * 0.01 / 0.99 ≈ output / 99
    let min_expected = sy_out / 200; // At least 0.5%
    let max_expected = sy_out / 20; // At most 5%
    assert(fee_collected >= min_expected, 'Fee too low');
    assert(fee_collected <= max_expected, 'Fee too high for zero sens');
}

#[test]
fn test_rate_impact_fee_both_swap_directions() {
    // Test that rate-impact fee applies to both PT→SY and SY→PT swaps
    let expiry = CURRENT_TIME + SECONDS_PER_YEAR;
    let sensitivity = WAD; // 100% sensitivity

    let (underlying, sy, yt, pt, market, _factory) = setup_with_factory(expiry, sensitivity);
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 5000 * WAD);
    add_liquidity(sy, pt, market, user, 2000 * WAD, 2000 * WAD);

    let swap_amount = 50 * WAD;

    // PT → SY swap
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(pt.contract_address);

    let fees_before_pt_sy = market.get_total_fees_collected();
    start_cheat_caller_address(market.contract_address, user);
    let _sy_out = market.swap_exact_pt_for_sy(user, swap_amount, 0, array![].span());
    stop_cheat_caller_address(market.contract_address);
    let fees_after_pt_sy = market.get_total_fees_collected();
    let pt_to_sy_fee = fees_after_pt_sy - fees_before_pt_sy;

    // SY → PT swap
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    let fees_before_sy_pt = market.get_total_fees_collected();
    start_cheat_caller_address(market.contract_address, user);
    let _pt_out = market.swap_exact_sy_for_pt(user, swap_amount, 0, array![].span());
    stop_cheat_caller_address(market.contract_address);
    let fees_after_sy_pt = market.get_total_fees_collected();
    let sy_to_pt_fee = fees_after_sy_pt - fees_before_sy_pt;

    // Both directions should collect fees
    assert(pt_to_sy_fee > 0, 'PT->SY should have fee');
    assert(sy_to_pt_fee > 0, 'SY->PT should have fee');
}

#[test]
fn test_rate_impact_fee_accumulates_correctly() {
    // Multiple trades should accumulate fees correctly
    let expiry = CURRENT_TIME + SECONDS_PER_YEAR;
    let sensitivity = WAD / 2; // 50% sensitivity

    let (underlying, sy, yt, pt, market, _factory) = setup_with_factory(expiry, sensitivity);
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 5000 * WAD);
    add_liquidity(sy, pt, market, user, 2000 * WAD, 2000 * WAD);

    let swap_amount = 20 * WAD;
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, swap_amount * 5);
    stop_cheat_caller_address(pt.contract_address);

    let fees_start = market.get_total_fees_collected();

    // Do 3 consecutive swaps
    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, swap_amount, 0, array![].span());
    stop_cheat_caller_address(market.contract_address);
    let fees_after_1 = market.get_total_fees_collected();
    let fee_1 = fees_after_1 - fees_start;

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, swap_amount, 0, array![].span());
    stop_cheat_caller_address(market.contract_address);
    let fees_after_2 = market.get_total_fees_collected();
    let fee_2 = fees_after_2 - fees_after_1;

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, swap_amount, 0, array![].span());
    stop_cheat_caller_address(market.contract_address);
    let fees_after_3 = market.get_total_fees_collected();
    let fee_3 = fees_after_3 - fees_after_2;

    // All fees should be positive
    assert(fee_1 > 0, 'Fee 1 should be positive');
    assert(fee_2 > 0, 'Fee 2 should be positive');
    assert(fee_3 > 0, 'Fee 3 should be positive');

    // Total should match sum
    let total_fees = market.get_total_fees_collected();
    assert(total_fees == fee_1 + fee_2 + fee_3, 'Fees should sum correctly');
}

#[test]
fn test_rate_impact_fee_exact_output_swap() {
    // Rate-impact fee should also apply to exact output swaps
    let expiry = CURRENT_TIME + SECONDS_PER_YEAR;
    let sensitivity = WAD; // 100% sensitivity

    let (underlying, sy, yt, pt, market, _factory) = setup_with_factory(expiry, sensitivity);
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 5000 * WAD);
    add_liquidity(sy, pt, market, user, 2000 * WAD, 2000 * WAD);

    // Exact output swap: SY for exact PT
    let exact_pt_out = 20 * WAD;
    let max_sy_in = 50 * WAD;

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, max_sy_in);
    stop_cheat_caller_address(sy.contract_address);

    let fees_before = market.get_total_fees_collected();

    start_cheat_caller_address(market.contract_address, user);
    let sy_used = market.swap_sy_for_exact_pt(user, exact_pt_out, max_sy_in, array![].span());
    stop_cheat_caller_address(market.contract_address);

    let fees_after = market.get_total_fees_collected();

    assert(sy_used > 0, 'Should use SY');
    assert(fees_after > fees_before, 'Exact output should have fee');
}

#[test]
fn test_factory_sensitivity_propagates_to_market() {
    // Verify that factory's rate_impact_sensitivity is used by market
    let expiry = CURRENT_TIME + SECONDS_PER_YEAR;
    let custom_sensitivity = WAD / 4; // 25% sensitivity

    let (underlying, sy, yt, pt, market, factory) = setup_with_factory(expiry, custom_sensitivity);
    let user = user1();

    // Verify factory has correct sensitivity
    let factory_sensitivity = factory.get_default_rate_impact_sensitivity();
    assert(factory_sensitivity == custom_sensitivity, 'Factory sensitivity mismatch');

    // Now do a swap to verify it's being used
    setup_user_with_tokens(underlying, sy, yt, user, 3000 * WAD);
    add_liquidity(sy, pt, market, user, 1000 * WAD, 1000 * WAD);

    let swap_amount = 50 * WAD;
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(pt.contract_address);

    let fees_before = market.get_total_fees_collected();

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, swap_amount, 0, array![].span());
    stop_cheat_caller_address(market.contract_address);

    let fees_after = market.get_total_fees_collected();

    // Fees should be collected (verifies the fee mechanism is working)
    assert(fees_after > fees_before, 'Should collect fees');
}

#[test]
fn test_rate_impact_fee_high_sensitivity() {
    // High sensitivity should result in higher fees
    let expiry = CURRENT_TIME + SECONDS_PER_YEAR;

    // Setup two markets with different sensitivities
    let low_sensitivity = WAD / 10; // 10%
    let high_sensitivity = WAD; // 100%

    let (underlying1, sy1, yt1, pt1, market1, _) = setup_with_factory(expiry, low_sensitivity);
    let (underlying2, sy2, yt2, pt2, market2, _) = setup_with_factory(expiry, high_sensitivity);

    let user = user1();
    let swap_amount = 100 * WAD;

    // Setup market 1
    setup_user_with_tokens(underlying1, sy1, yt1, user, 3000 * WAD);
    add_liquidity(sy1, pt1, market1, user, 1000 * WAD, 1000 * WAD);

    // Setup market 2
    setup_user_with_tokens(underlying2, sy2, yt2, user, 3000 * WAD);
    add_liquidity(sy2, pt2, market2, user, 1000 * WAD, 1000 * WAD);

    // Swap in low sensitivity market
    start_cheat_caller_address(pt1.contract_address, user);
    pt1.approve(market1.contract_address, swap_amount);
    stop_cheat_caller_address(pt1.contract_address);

    let fees_before_low = market1.get_total_fees_collected();
    start_cheat_caller_address(market1.contract_address, user);
    let sy_out_low = market1.swap_exact_pt_for_sy(user, swap_amount, 0, array![].span());
    stop_cheat_caller_address(market1.contract_address);
    let fees_after_low = market1.get_total_fees_collected();
    let fee_low = fees_after_low - fees_before_low;

    // Swap in high sensitivity market
    start_cheat_caller_address(pt2.contract_address, user);
    pt2.approve(market2.contract_address, swap_amount);
    stop_cheat_caller_address(pt2.contract_address);

    let fees_before_high = market2.get_total_fees_collected();
    start_cheat_caller_address(market2.contract_address, user);
    let sy_out_high = market2.swap_exact_pt_for_sy(user, swap_amount, 0, array![].span());
    stop_cheat_caller_address(market2.contract_address);
    let fees_after_high = market2.get_total_fees_collected();
    let fee_high = fees_after_high - fees_before_high;

    // Calculate fee rates
    let fee_rate_low = if sy_out_low > 0 {
        (fee_low * 10000) / sy_out_low
    } else {
        0
    };
    let fee_rate_high = if sy_out_high > 0 {
        (fee_high * 10000) / sy_out_high
    } else {
        0
    };

    // High sensitivity should have higher fee rate
    assert(fee_rate_high >= fee_rate_low, 'High sens should have more fee');
}
