use horizon::interfaces::i_market::IMarketDispatcherTrait;
use horizon::interfaces::i_pt::IPTDispatcherTrait;
use horizon::interfaces::i_router_static::IRouterStaticDispatcherTrait;
use horizon::interfaces::i_sy::ISYDispatcherTrait;
use horizon::libraries::math_fp::WAD;
use snforge_std::{
    start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address,
};

// Re-use setup helpers from swap preview tests
use super::test_router_static_swap_preview::{
    add_liquidity, setup, setup_user_with_tokens, user1, zero_address,
};

// ============ Preview Add Liquidity Single SY Tests ============

#[test]
fn test_preview_add_liquidity_single_sy_basic() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);

    // Add initial liquidity to market
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview add liquidity with single SY
    let sy_in = 20 * WAD;
    let lp_preview = router_static.preview_add_liquidity_single_sy(market.contract_address, sy_in);

    // Verify preview returns positive amount
    assert(lp_preview > 0, 'Preview should return LP > 0');
}

#[test]
fn test_preview_add_liquidity_single_sy_matches_actual() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 400 * WAD);

    // Add initial liquidity to market
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview add liquidity
    let sy_in = 20 * WAD;
    let lp_preview = router_static.preview_add_liquidity_single_sy(market.contract_address, sy_in);

    // Execute actual add liquidity single SY manually:
    // 1. Calculate optimal SY to swap
    // 2. Swap some SY for PT
    // 3. Add liquidity with remaining SY + received PT

    // Get reserves to calculate swap amount
    let (reserves_sy, reserves_pt) = market.get_reserves();

    // Binary search for optimal swap amount (simplified approximation)
    // We'll use an approximate ratio based on reserves
    let sy_to_swap = sy_in * reserves_pt / (reserves_sy + reserves_pt + sy_in);

    // Approve and swap SY for PT
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, sy_to_swap);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let pt_received = market.swap_exact_sy_for_pt(user, sy_to_swap, 0, array![].span());
    stop_cheat_caller_address(market.contract_address);

    // Add liquidity with remaining SY and received PT
    let sy_for_lp = sy_in - sy_to_swap;

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, sy_for_lp);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, pt_received);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let (_, _, lp_actual) = market.mint(user, sy_for_lp, pt_received);
    stop_cheat_caller_address(market.contract_address);

    // Preview should be in same ballpark as actual (allowing for approximation differences)
    // The preview uses binary search which may find a different optimal point
    assert(lp_preview > 0, 'Preview should be positive');
    assert(lp_actual > 0, 'Actual should be positive');

    // Allow 20% tolerance due to different optimization approaches
    let lower_bound = lp_actual * 80 / 100;
    let upper_bound = lp_actual * 120 / 100;
    assert(lp_preview >= lower_bound && lp_preview <= upper_bound, 'Preview should be close');
}

#[test]
fn test_preview_add_liquidity_single_sy_zero_amount() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview with zero amount should return zero
    let lp_preview = router_static.preview_add_liquidity_single_sy(market.contract_address, 0);
    assert(lp_preview == 0, 'Zero input should give zero');
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_preview_add_liquidity_single_sy_zero_market() {
    let (_, _, _, _, _, router_static) = setup();

    // Should fail with zero market address
    router_static.preview_add_liquidity_single_sy(zero_address(), 10 * WAD);
}

#[test]
#[should_panic(expected: 'HZN: market expired')]
fn test_preview_add_liquidity_single_sy_expired() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(market.expiry() + 1);

    // Preview should fail for expired market
    router_static.preview_add_liquidity_single_sy(market.contract_address, 10 * WAD);
}

#[test]
fn test_preview_add_liquidity_single_sy_empty_pool() {
    let (_, _, _, _, market, router_static) = setup();

    // Preview on empty pool should return 0 (can't add single-sided to empty pool)
    let lp_preview = router_static
        .preview_add_liquidity_single_sy(market.contract_address, 10 * WAD);
    assert(lp_preview == 0, 'Empty pool should return 0');
}

// ============ Preview Remove Liquidity Single SY Tests ============

#[test]
fn test_preview_remove_liquidity_single_sy_basic() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);

    // Add liquidity to market
    let lp_amount = add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview remove liquidity to single SY
    let lp_in = lp_amount / 4; // Remove 25% of LP
    let sy_preview = router_static
        .preview_remove_liquidity_single_sy(market.contract_address, lp_in);

    // Verify preview returns positive amount
    assert(sy_preview > 0, 'Preview should return SY > 0');
}

#[test]
fn test_preview_remove_liquidity_single_sy_matches_actual() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 400 * WAD);

    // Add liquidity to market
    let lp_amount = add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview remove liquidity
    let lp_in = lp_amount / 4; // Remove 25% of LP
    let sy_preview = router_static
        .preview_remove_liquidity_single_sy(market.contract_address, lp_in);

    // Execute actual remove liquidity single SY manually:
    // 1. Burn LP to get SY + PT
    // 2. Swap PT for SY

    // Burn LP (Market burns from caller's balance)
    start_cheat_caller_address(market.contract_address, user);
    let (sy_from_burn, pt_from_burn) = market.burn(user, lp_in);
    stop_cheat_caller_address(market.contract_address);

    // Swap PT for SY
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, pt_from_burn);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let sy_from_swap = market.swap_exact_pt_for_sy(user, pt_from_burn, 0, array![].span());
    stop_cheat_caller_address(market.contract_address);

    let sy_actual = sy_from_burn + sy_from_swap;

    // Preview should closely match actual (within 1% tolerance)
    // The preview adjusts state for LP burn before simulating swap
    let diff = if sy_actual >= sy_preview {
        sy_actual - sy_preview
    } else {
        sy_preview - sy_actual
    };
    let tolerance = sy_preview / 100; // 1% tolerance
    assert(diff <= tolerance, 'Preview should match actual');
}

#[test]
fn test_preview_remove_liquidity_single_sy_zero_amount() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview with zero amount should return zero
    let sy_preview = router_static.preview_remove_liquidity_single_sy(market.contract_address, 0);
    assert(sy_preview == 0, 'Zero input should give zero');
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_preview_remove_liquidity_single_sy_zero_market() {
    let (_, _, _, _, _, router_static) = setup();

    // Should fail with zero market address
    router_static.preview_remove_liquidity_single_sy(zero_address(), 10 * WAD);
}

#[test]
fn test_preview_remove_liquidity_single_sy_expired() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);

    // Add liquidity to market
    let lp_amount = add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(market.expiry() + 1);

    // Preview should still work for expired market (PT redeems 1:1)
    let lp_in = lp_amount / 4;
    let sy_preview = router_static
        .preview_remove_liquidity_single_sy(market.contract_address, lp_in);

    // Should return positive amount (burn returns SY + PT, both count as SY equivalent)
    assert(sy_preview > 0, 'Expired preview should work');
}

// ============ Liquidity Preview Consistency Tests ============

#[test]
fn test_liquidity_add_remove_round_trip() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 400 * WAD);

    // Add initial liquidity
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Preview adding liquidity with SY
    let sy_in = 20 * WAD;
    let lp_preview = router_static.preview_add_liquidity_single_sy(market.contract_address, sy_in);

    // Preview removing that LP back to SY
    let sy_back = router_static
        .preview_remove_liquidity_single_sy(market.contract_address, lp_preview);

    // Due to fees on both operations, we should get back less SY than we put in
    assert(sy_back < sy_in, 'Round trip should lose value');
    assert(sy_back > 0, 'Should get some SY back');

    // Should get back at least 80% of original (fees + slippage)
    let min_expected = sy_in * 80 / 100;
    assert(sy_back >= min_expected, 'Too much value lost');
}

#[test]
fn test_liquidity_preview_scales_proportionally() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 500 * WAD);

    // Add initial liquidity
    add_liquidity(sy, pt, market, user, 200 * WAD, 200 * WAD);

    // Preview small add
    let small_sy = 10 * WAD;
    let small_lp = router_static.preview_add_liquidity_single_sy(market.contract_address, small_sy);

    // Preview larger add
    let large_sy = 20 * WAD;
    let large_lp = router_static.preview_add_liquidity_single_sy(market.contract_address, large_sy);

    // Larger input should yield more LP
    assert(large_lp > small_lp, 'Larger input -> more LP');

    // But not quite 2x due to price impact
    assert(large_lp < small_lp * 2, 'Price impact expected');
}

#[test]
fn test_remove_liquidity_preview_scales_proportionally() {
    let (underlying, sy, yt, pt, market, router_static) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 500 * WAD);

    // Add liquidity to market
    let lp_amount = add_liquidity(sy, pt, market, user, 200 * WAD, 200 * WAD);

    // Preview small remove
    let small_lp = lp_amount / 10;
    let small_sy = router_static
        .preview_remove_liquidity_single_sy(market.contract_address, small_lp);

    // Preview larger remove
    let large_lp = lp_amount / 5;
    let large_sy = router_static
        .preview_remove_liquidity_single_sy(market.contract_address, large_lp);

    // Larger LP input should yield more SY
    assert(large_sy > small_sy, 'Larger LP -> more SY');

    // But not quite 2x due to price impact on the PT->SY swap
    assert(large_sy < small_sy * 2, 'Price impact expected');
}
