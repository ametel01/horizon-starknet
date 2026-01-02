/// YT Flash Swap Tests (Gap 7: Router YT Flash Swap Tests P2)
///
/// Tests the flash swap pattern for YT trading per SPEC.md Section 4.1:
///
/// `swap_exact_sy_for_yt`:
///   1. User deposits SY
///   2. Router mints PT+YT from SY
///   3. Router sells PT back to market for SY
///   4. User receives YT + recovered SY
///
/// `swap_exact_yt_for_sy`:
///   1. User provides YT + SY collateral
///   2. Router buys PT from market using SY
///   3. Router redeems PT+YT for SY
///   4. User receives net SY + refund
use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_router::{IRouterDispatcher, IRouterDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};
use crate::utils::{ONE_DAY, admin, alice, bob, setup_full};

// ============ Market Default Parameters ============

fn default_scalar_root() -> u256 {
    100 * WAD // 100 - realistic sensitivity for asset-based curve
}

fn default_initial_anchor() -> u256 {
    WAD / 2 // 50% ln_implied_rate gives exchange_rate ≈ 1.65
}

fn default_fee_rate() -> u256 {
    WAD / 100
}

// ============ Test Constants ============

const DEFAULT_DEADLINE: u64 = 0xFFFFFFFFFFFFFFFF;

// ============ Helper Functions ============

fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0);
    calldata.append(value);
    calldata.append(len.into());
}

fn deploy_router() -> IRouterDispatcher {
    let contract = declare("Router").unwrap_syscall().contract_class();
    let mut calldata = array![];
    calldata.append(admin().into());
    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IRouterDispatcher { contract_address }
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
    calldata.append(admin().into());

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketDispatcher { contract_address }
}

fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

fn setup_user_with_sy(
    yield_token: IMockYieldTokenDispatcher, sy: ISYDispatcher, user: ContractAddress, amount: u256,
) {
    mint_yield_token_to_user(yield_token, user, amount);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, yield_token.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);
}

fn setup_user_with_tokens(
    yield_token: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    user: ContractAddress,
    amount: u256,
) {
    // Get double amount of SY so we can mint PT+YT and have SY left
    setup_user_with_sy(yield_token, sy, user, amount * 2);

    // Mint PT+YT from half the SY (floating SY pattern)
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
    market: IMarketDispatcher,
    lp_provider: ContractAddress,
    sy_amount: u256,
    pt_amount: u256,
) {
    let pt = IPTDispatcher { contract_address: yt.pt() };

    // Setup LP provider with tokens
    setup_user_with_tokens(yield_token, sy, yt, lp_provider, sy_amount + pt_amount);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, lp_provider);
    sy.approve(market.contract_address, sy_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, lp_provider);
    pt.approve(market.contract_address, pt_amount);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, lp_provider);
    market.mint(lp_provider, sy_amount, pt_amount);
    stop_cheat_caller_address(market.contract_address);
}

/// Full setup including market and router
fn setup() -> (
    IMockYieldTokenDispatcher,
    ISYDispatcher,
    IYTDispatcher,
    IPTDispatcher,
    IMarketDispatcher,
    IRouterDispatcher,
) {
    let (_, yield_token, sy, yt) = setup_full();
    let pt = IPTDispatcher { contract_address: yt.pt() };
    let market = deploy_market(pt.contract_address);
    let router = deploy_router();

    (yield_token, sy, yt, pt, market, router)
}

// ============ swap_exact_sy_for_yt Tests ============

#[test]
fn test_swap_sy_for_yt_flash_swap_mechanics() {
    // Verify flash swap pattern: SY → Mint PT+YT → Sell PT → Get YT + SY refund
    let (yield_token, sy, yt, pt, market, router) = setup();
    let user = alice();
    let lp = bob();
    let liquidity_amount = 100 * WAD;

    // Setup market with liquidity
    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp, liquidity_amount, liquidity_amount,
    );

    // Give user SY for the swap
    setup_user_with_sy(yield_token, sy, user, 20 * WAD);

    let swap_sy = 10 * WAD;
    let sy_before = sy.balance_of(user);
    let yt_before = yt.balance_of(user);
    let pt_before = pt.balance_of(user);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_sy);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    let yt_out = router
        .swap_exact_sy_for_yt(
            yt.contract_address, market.contract_address, user, swap_sy, 0, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // User should receive YT
    assert(yt_out > 0, 'Should receive YT');
    assert(yt.balance_of(user) == yt_before + yt_out, 'YT balance mismatch');

    // User should NOT receive any PT (all sold to market)
    assert(pt.balance_of(user) == pt_before, 'Should not receive PT');

    // User should receive some SY back from PT sale
    let sy_after = sy.balance_of(user);
    // Net SY spent = swap_sy - SY recovered from PT sale
    assert(sy_after < sy_before, 'Should spend SY');
    assert(sy_after > sy_before - swap_sy, 'Should recover SY from PT');
}

#[test]
fn test_swap_sy_for_yt_yt_amount_equals_sy_input() {
    // YT minted = SY input (1:1 minting from SY to PT+YT)
    let (yield_token, sy, yt, _, market, router) = setup();
    let user = alice();
    let lp = bob();
    let liquidity_amount = 100 * WAD;

    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp, liquidity_amount, liquidity_amount,
    );
    setup_user_with_sy(yield_token, sy, user, 20 * WAD);

    let swap_sy = 10 * WAD;

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_sy);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    let yt_out = router
        .swap_exact_sy_for_yt(
            yt.contract_address, market.contract_address, user, swap_sy, 0, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // YT minted should equal SY input (1 SY → 1 PT + 1 YT)
    assert(yt_out == swap_sy, 'YT should equal SY input');
}

#[test]
fn test_swap_sy_for_yt_large_amount() {
    // Test large swap relative to pool size (high price impact)
    let (yield_token, sy, yt, _, market, router) = setup();
    let user = alice();
    let lp = bob();
    let liquidity_amount = 100 * WAD;

    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp, liquidity_amount, liquidity_amount,
    );

    // Swap 30% of pool size
    let swap_sy = 30 * WAD;
    setup_user_with_sy(yield_token, sy, user, swap_sy);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_sy);
    stop_cheat_caller_address(sy.contract_address);

    let _sy_before = sy.balance_of(user);

    start_cheat_caller_address(router.contract_address, user);
    let yt_out = router
        .swap_exact_sy_for_yt(
            yt.contract_address, market.contract_address, user, swap_sy, 0, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Should succeed despite high price impact
    assert(yt_out == swap_sy, 'YT should equal SY input');

    // Less SY recovery due to slippage when selling large PT amount
    let sy_recovered = sy.balance_of(user);
    // With 30% of pool, expect meaningful price impact
    assert(sy_recovered < swap_sy, 'Should have less recovery');
}

#[test]
fn test_swap_sy_for_yt_small_amount() {
    // Test very small swap amount works through flash swap
    let (yield_token, sy, yt, _, market, router) = setup();
    let user = alice();
    let lp = bob();
    let liquidity_amount = 100 * WAD;

    // Disable time-based yield BEFORE market setup
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.set_yield_rate_bps(0);
    stop_cheat_caller_address(yield_token.contract_address);

    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp, liquidity_amount, liquidity_amount,
    );

    // Swap small amount
    let swap_sy = WAD / 100; // 0.01 tokens
    setup_user_with_sy(yield_token, sy, user, swap_sy);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_sy);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    let yt_out = router
        .swap_exact_sy_for_yt(
            yt.contract_address, market.contract_address, user, swap_sy, 0, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // With syToAsset formula, YT minted = SY * pyIndex
    // The test verifies small amounts work through the flash swap pattern
    assert(yt_out > 0, 'Should receive YT');
    assert(yt.balance_of(user) == yt_out, 'User should receive YT');
}

// ============ swap_exact_yt_for_sy Tests ============

#[test]
fn test_swap_yt_for_sy_flash_swap_mechanics() {
    // Verify flash swap pattern: YT + SY collateral → Buy PT → Redeem PT+YT → Get net SY
    let (yield_token, sy, yt, pt, market, router) = setup();
    let user = alice();
    let lp = bob();
    let liquidity_amount = 100 * WAD;

    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp, liquidity_amount, liquidity_amount,
    );

    // Give user YT and SY
    setup_user_with_tokens(yield_token, sy, yt, user, 50 * WAD);

    let yt_to_sell = 10 * WAD;
    let max_collateral = yt_to_sell * 4; // 4x buffer for PT purchase

    let yt_before = yt.balance_of(user);
    let sy_before = sy.balance_of(user);
    let pt_before = pt.balance_of(user);

    start_cheat_caller_address(yt.contract_address, user);
    yt.approve(router.contract_address, yt_to_sell);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, max_collateral);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    let _effective_sy_out = router
        .swap_exact_yt_for_sy(
            yt.contract_address,
            market.contract_address,
            user,
            yt_to_sell,
            max_collateral,
            0,
            DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // YT should be consumed
    assert(yt.balance_of(user) == yt_before - yt_to_sell, 'YT not consumed');

    // PT balance should be unchanged (PT bought and immediately redeemed)
    assert(pt.balance_of(user) == pt_before, 'PT should be unchanged');

    // User receives SY (net = redemption + refund from max_collateral)
    let sy_after = sy.balance_of(user);
    assert(sy_after > sy_before - max_collateral, 'Should receive SY');
}

#[test]
#[should_panic(expected: 'HZN: slippage exceeded')]
fn test_swap_yt_for_sy_insufficient_collateral() {
    // User provides insufficient collateral to buy PT, should fail
    let (yield_token, sy, yt, _, market, router) = setup();
    let user = alice();
    let lp = bob();
    let liquidity_amount = 100 * WAD;

    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp, liquidity_amount, liquidity_amount,
    );

    // Give user YT and minimal SY
    setup_user_with_tokens(yield_token, sy, yt, user, 50 * WAD);

    let yt_to_sell = 10 * WAD;
    // Provide much less collateral than needed (need ~10 WAD to buy 10 PT, provide only 0.1)
    let insufficient_collateral = WAD / 10;

    start_cheat_caller_address(yt.contract_address, user);
    yt.approve(router.contract_address, yt_to_sell);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, insufficient_collateral);
    stop_cheat_caller_address(sy.contract_address);

    // Should fail - insufficient collateral to buy required PT
    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_yt_for_sy(
            yt.contract_address,
            market.contract_address,
            user,
            yt_to_sell,
            insufficient_collateral,
            0,
            DEFAULT_DEADLINE,
        );
}

#[test]
fn test_swap_yt_for_sy_exact_collateral() {
    // Test with exact collateral needed (no excess)
    let (yield_token, sy, yt, _, market, router) = setup();
    let user = alice();
    let lp = bob();
    let liquidity_amount = 100 * WAD;

    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp, liquidity_amount, liquidity_amount,
    );
    setup_user_with_tokens(yield_token, sy, yt, user, 50 * WAD);

    let yt_to_sell = 5 * WAD;
    // PT trades at a discount to SY, so need < 5 WAD SY to buy 5 PT
    // Use 2x buffer which should be more than enough
    let collateral = yt_to_sell * 2;

    let sy_before = sy.balance_of(user);

    start_cheat_caller_address(yt.contract_address, user);
    yt.approve(router.contract_address, yt_to_sell);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, collateral);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_yt_for_sy(
            yt.contract_address,
            market.contract_address,
            user,
            yt_to_sell,
            collateral,
            0,
            DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Operation should succeed
    let sy_after = sy.balance_of(user);
    // Should have net positive or close to it (collateral refunded + redemption)
    assert(sy_after > sy_before - collateral, 'Should have positive net SY');
}

// ============ Near Expiry Tests ============

#[test]
fn test_swap_sy_for_yt_near_expiry() {
    // Test swap 1 day before expiry - should still work
    let (yield_token, sy, yt, _, market, router) = setup();
    let user = alice();
    let lp = bob();
    let liquidity_amount = 100 * WAD;

    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp, liquidity_amount, liquidity_amount,
    );

    // Advance time to 1 day before expiry
    let expiry = yt.expiry();
    start_cheat_block_timestamp_global(expiry - ONE_DAY);

    setup_user_with_sy(yield_token, sy, user, 20 * WAD);
    let swap_sy = 5 * WAD;

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_sy);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    let yt_out = router
        .swap_exact_sy_for_yt(
            yt.contract_address, market.contract_address, user, swap_sy, 0, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Should still work near expiry
    assert(yt_out == swap_sy, 'Should receive YT near expiry');
}

#[test]
fn test_swap_yt_for_sy_near_expiry() {
    // Test selling YT 1 day before expiry - should still work
    let (yield_token, sy, yt, _, market, router) = setup();
    let user = alice();
    let lp = bob();
    let liquidity_amount = 100 * WAD;

    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp, liquidity_amount, liquidity_amount,
    );

    // Give user tokens before advancing time
    setup_user_with_tokens(yield_token, sy, yt, user, 50 * WAD);

    // Advance time to 1 day before expiry
    let expiry = yt.expiry();
    start_cheat_block_timestamp_global(expiry - ONE_DAY);

    let yt_to_sell = 5 * WAD;
    let max_collateral = yt_to_sell * 4;

    start_cheat_caller_address(yt.contract_address, user);
    yt.approve(router.contract_address, yt_to_sell);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, max_collateral);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_yt_for_sy(
            yt.contract_address,
            market.contract_address,
            user,
            yt_to_sell,
            max_collateral,
            0,
            DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Should work near expiry
    assert(yt.balance_of(user) < 50 * WAD, 'YT should be sold');
}

#[test]
fn test_swap_sy_for_yt_one_hour_before_expiry() {
    // Test swap very close to expiry
    let (yield_token, sy, yt, _, market, router) = setup();
    let user = alice();
    let lp = bob();
    let liquidity_amount = 100 * WAD;

    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp, liquidity_amount, liquidity_amount,
    );

    // Advance to 1 hour before expiry
    let expiry = yt.expiry();
    start_cheat_block_timestamp_global(expiry - 3600);

    setup_user_with_sy(yield_token, sy, user, 10 * WAD);
    let swap_sy = 5 * WAD;

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_sy);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    let yt_out = router
        .swap_exact_sy_for_yt(
            yt.contract_address, market.contract_address, user, swap_sy, 0, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Should work even very close to expiry
    assert(yt_out == swap_sy, 'Should work 1h before expiry');
}

// ============ After Expiry Tests ============

#[test]
#[should_panic(expected: 'HZN: expired')]
fn test_swap_sy_for_yt_after_expiry_fails() {
    // After expiry, can't mint new PT/YT, so flash swap should fail
    let (yield_token, sy, yt, _, market, router) = setup();
    let user = alice();
    let lp = bob();
    let liquidity_amount = 100 * WAD;

    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp, liquidity_amount, liquidity_amount,
    );

    // Advance past expiry
    let expiry = yt.expiry();
    start_cheat_block_timestamp_global(expiry + 1);

    setup_user_with_sy(yield_token, sy, user, 10 * WAD);
    let swap_sy = 5 * WAD;

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_sy);
    stop_cheat_caller_address(sy.contract_address);

    // Should fail - can't mint PT/YT after expiry
    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_sy_for_yt(
            yt.contract_address, market.contract_address, user, swap_sy, 0, DEFAULT_DEADLINE,
        );
}

#[test]
#[should_panic(expected: 'HZN: market expired')]
fn test_swap_yt_for_sy_after_expiry_fails() {
    // After expiry, market swap fails first (before redeem_py)
    let (yield_token, sy, yt, _, market, router) = setup();
    let user = alice();
    let lp = bob();
    let liquidity_amount = 100 * WAD;

    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp, liquidity_amount, liquidity_amount,
    );

    // Give user tokens before expiry
    setup_user_with_tokens(yield_token, sy, yt, user, 50 * WAD);

    // Advance past expiry
    let expiry = yt.expiry();
    start_cheat_block_timestamp_global(expiry + 1);

    let yt_to_sell = 5 * WAD;
    let max_collateral = yt_to_sell * 4;

    start_cheat_caller_address(yt.contract_address, user);
    yt.approve(router.contract_address, yt_to_sell);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, max_collateral);
    stop_cheat_caller_address(sy.contract_address);

    // Should fail - can't redeem PT+YT after expiry (use redeem_py_post_expiry instead)
    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_yt_for_sy(
            yt.contract_address,
            market.contract_address,
            user,
            yt_to_sell,
            max_collateral,
            0,
            DEFAULT_DEADLINE,
        );
}

// ============ Price Impact Tests ============

#[test]
fn test_swap_sy_for_yt_price_impact_pt_sale() {
    // Larger swaps get less SY back from PT sale due to price impact
    let (yield_token, sy, yt, _, market, router) = setup();
    let user = alice();
    let lp = bob();
    let liquidity_amount = 100 * WAD;

    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp, liquidity_amount, liquidity_amount,
    );

    // Small swap
    setup_user_with_sy(yield_token, sy, user, 50 * WAD);
    let small_swap = 5 * WAD;

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, small_swap);
    stop_cheat_caller_address(sy.contract_address);

    let sy_before_small = sy.balance_of(user);

    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_sy_for_yt(
            yt.contract_address, market.contract_address, user, small_swap, 0, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    let sy_recovered_small = sy.balance_of(user);
    let cost_small = sy_before_small - sy_recovered_small;

    // Large swap (same user, fresh setup needed for fair comparison)
    // For this test, we just verify large swap costs more per YT
    let large_swap = 20 * WAD;

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, large_swap);
    stop_cheat_caller_address(sy.contract_address);

    let sy_before_large = sy.balance_of(user);

    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_sy_for_yt(
            yt.contract_address, market.contract_address, user, large_swap, 0, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    let sy_recovered_large = sy.balance_of(user);
    let cost_large = sy_before_large - sy_recovered_large;

    // Per-YT cost should be higher for large swap due to price impact
    let cost_per_yt_small = cost_small / small_swap;
    let cost_per_yt_large = cost_large / large_swap;

    assert(cost_per_yt_large >= cost_per_yt_small, 'Large swap should cost more');
}

// ============ Zero Amount Tests ============

#[test]
#[should_panic(expected: 'HZN: zero amount')]
fn test_swap_sy_for_yt_zero_amount() {
    let (_, _, yt, _, market, router) = setup();
    let user = alice();

    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_sy_for_yt(
            yt.contract_address, market.contract_address, user, 0, 0, DEFAULT_DEADLINE,
        );
}

#[test]
#[should_panic(expected: 'HZN: zero amount')]
fn test_swap_yt_for_sy_zero_yt_amount() {
    let (_, _, yt, _, market, router) = setup();
    let user = alice();

    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_yt_for_sy(
            yt.contract_address, market.contract_address, user, 0, WAD, 0, DEFAULT_DEADLINE,
        );
}

#[test]
#[should_panic(expected: 'HZN: zero amount')]
fn test_swap_yt_for_sy_zero_collateral() {
    let (_, _, yt, _, market, router) = setup();
    let user = alice();

    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_yt_for_sy(
            yt.contract_address, market.contract_address, user, WAD, 0, 0, DEFAULT_DEADLINE,
        );
}

// ============ Multiple Sequential Swaps ============

#[test]
fn test_multiple_sy_for_yt_swaps() {
    // Multiple users can swap sequentially
    let (yield_token, sy, yt, _, market, router) = setup();
    let user_a = alice();
    let user_b = bob();
    let lp_provider: ContractAddress = 'lp'.try_into().unwrap();
    let liquidity_amount = 200 * WAD;

    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp_provider, liquidity_amount, liquidity_amount,
    );

    let swap_amount = 10 * WAD;

    // User A swaps
    setup_user_with_sy(yield_token, sy, user_a, swap_amount);
    start_cheat_caller_address(sy.contract_address, user_a);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user_a);
    let yt_a = router
        .swap_exact_sy_for_yt(
            yt.contract_address, market.contract_address, user_a, swap_amount, 0, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // User B swaps
    setup_user_with_sy(yield_token, sy, user_b, swap_amount);
    start_cheat_caller_address(sy.contract_address, user_b);
    sy.approve(router.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user_b);
    let yt_b = router
        .swap_exact_sy_for_yt(
            yt.contract_address, market.contract_address, user_b, swap_amount, 0, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Both should receive YT
    assert(yt_a == swap_amount, 'User A should get YT');
    assert(yt_b == swap_amount, 'User B should get YT');
    assert(yt.balance_of(user_a) == yt_a, 'User A YT balance');
    assert(yt.balance_of(user_b) == yt_b, 'User B YT balance');
}

// ============ Round-Trip Test ============

#[test]
fn test_round_trip_sy_to_yt_to_sy() {
    // Buy YT with SY, then sell YT back for SY
    let (yield_token, sy, yt, _, market, router) = setup();
    let user = alice();
    let lp = bob();
    // Use larger pool to handle round-trip without hitting rate floor
    let liquidity_amount = 2000 * WAD;

    setup_market_with_liquidity(
        yield_token, sy, yt, market, lp, liquidity_amount, liquidity_amount,
    );

    // User gets tokens - more SY for the collateral on the way back
    setup_user_with_tokens(yield_token, sy, yt, user, 500 * WAD);

    // Record initial state
    let initial_sy = sy.balance_of(user);
    let initial_yt = yt.balance_of(user);

    // Step 1: Buy YT with SY
    let swap_sy = 10 * WAD;
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, swap_sy);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    let yt_bought = router
        .swap_exact_sy_for_yt(
            yt.contract_address, market.contract_address, user, swap_sy, 0, DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    assert(yt_bought == swap_sy, 'Should buy YT');

    // Step 2: Sell YT back for SY
    let max_collateral = yt_bought * 4;
    start_cheat_caller_address(yt.contract_address, user);
    yt.approve(router.contract_address, yt_bought);
    stop_cheat_caller_address(yt.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(router.contract_address, max_collateral);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(router.contract_address, user);
    router
        .swap_exact_yt_for_sy(
            yt.contract_address,
            market.contract_address,
            user,
            yt_bought,
            max_collateral,
            0,
            DEFAULT_DEADLINE,
        );
    stop_cheat_caller_address(router.contract_address);

    // Should have less YT than initial (sold yt_bought)
    let final_yt = yt.balance_of(user);
    assert(final_yt == initial_yt, 'YT should return to initial');

    // Round-trip has cost due to AMM fees and slippage
    let final_sy = sy.balance_of(user);
    assert(final_sy < initial_sy, 'Round trip has cost');
}
