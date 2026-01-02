use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math_fp::WAD;
use horizon::mocks::mock_erc20::IMockERC20Dispatcher;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_number_global,
    start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

/// Helper to check approximate equality (within 1% tolerance)
fn assert_approx_eq(actual: u256, expected: u256, msg: felt252) {
    let diff = if actual >= expected {
        actual - expected
    } else {
        expected - actual
    };
    // Allow 1% tolerance (100 basis points) for fixed-point precision differences
    let tolerance = expected / 100;
    let tolerance = if tolerance == 0 {
        1
    } else {
        tolerance
    };
    assert(diff <= tolerance, msg);
}

// Test addresses
fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

fn user1() -> ContractAddress {
    'user1'.try_into().unwrap()
}

fn user2() -> ContractAddress {
    'user2'.try_into().unwrap()
}

fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
}

fn zero_address() -> ContractAddress {
    0.try_into().unwrap()
}

// Helper to serialize ByteArray for calldata
fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0); // data array length
    calldata.append(value); // pending_word
    calldata.append(len.into()); // pending_word_len
}

// Default market parameters
fn default_scalar_root() -> u256 {
    50 * WAD // Controls rate sensitivity
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

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMarketDispatcher { contract_address }
}

// Helper: Mint yield token shares to user as admin
fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

// Helper: Set yield index as admin
fn set_yield_index(yield_token: IMockYieldTokenDispatcher, new_index: u256) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    // Disable time-based yield for precise control when manually setting index
    yield_token.set_yield_rate_bps(0);
    yield_token.set_index(new_index);
    stop_cheat_caller_address(yield_token.contract_address);

    // Advance block number to invalidate YT's same-block cache
    let block_num: u64 = (new_index / 1000000000000000).try_into().unwrap_or(1000) + 1;
    start_cheat_block_number_global(block_num);
}

// Full setup: underlying -> SY -> YT/PT -> Market
fn setup() -> (
    IMockYieldTokenDispatcher, ISYDispatcher, IYTDispatcher, IPTDispatcher, IMarketDispatcher,
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

    (underlying, sy, yt, pt, market)
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

// ============ Constructor Tests ============

#[test]
fn test_market_constructor() {
    let (_, sy, yt, pt, market) = setup();

    assert(market.sy() == sy.contract_address, 'Wrong SY');
    assert(market.pt() == pt.contract_address, 'Wrong PT');
    assert(market.yt() == yt.contract_address, 'Wrong YT');
    assert(market.expiry() == yt.expiry(), 'Wrong expiry');
    assert(!market.is_expired(), 'Should not be expired');

    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert(sy_reserve == 0, 'SY reserve should be 0');
    assert(pt_reserve == 0, 'PT reserve should be 0');
    assert(market.total_lp_supply() == 0, 'LP supply should be 0');
}

// ============ Mint (Add Liquidity) Tests ============

#[test]
fn test_market_mint_initial() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();
    let sy_amount = 100 * WAD;
    let pt_amount = 100 * WAD;

    // Setup user with tokens
    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Approve market to spend tokens
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, sy_amount);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, pt_amount);
    stop_cheat_caller_address(pt.contract_address);

    // Add liquidity
    start_cheat_caller_address(market.contract_address, user);
    let (sy_used, pt_used, lp_minted) = market.mint(user, sy_amount, pt_amount);
    stop_cheat_caller_address(market.contract_address);

    // Verify results
    assert(sy_used == sy_amount, 'Wrong SY used');
    assert(pt_used == pt_amount, 'Wrong PT used');
    assert(lp_minted > 0, 'LP should be minted');

    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert(sy_reserve == sy_amount, 'Wrong SY reserve');
    assert(pt_reserve == pt_amount, 'Wrong PT reserve');
    // total_lp includes MINIMUM_LIQUIDITY (1000) locked to dead address
    assert(market.total_lp_supply() == lp_minted + 1000, 'Wrong LP supply');
}

#[test]
fn test_market_mint_subsequent() {
    let (underlying, sy, yt, pt, market) = setup();
    let user1_addr = user1();
    let user2_addr = user2();

    // Setup both users with tokens
    setup_user_with_tokens(underlying, sy, yt, user1_addr, 200 * WAD);
    setup_user_with_tokens(underlying, sy, yt, user2_addr, 200 * WAD);

    // User1 adds initial liquidity
    start_cheat_caller_address(sy.contract_address, user1_addr);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user1_addr);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user1_addr);
    let (_, _, _) = market.mint(user1_addr, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // User2 adds more liquidity
    start_cheat_caller_address(sy.contract_address, user2_addr);
    sy.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user2_addr);
    pt.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user2_addr);
    let (sy_used2, pt_used2, lp2) = market.mint(user2_addr, 50 * WAD, 50 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Verify user2 got proportional LP tokens
    assert(sy_used2 == 50 * WAD, 'Wrong SY used');
    assert(pt_used2 == 50 * WAD, 'Wrong PT used');
    // LP = sqrt_wad(wad_mul(100*WAD, 100*WAD)) = 100 * WAD (WAD-normalized)
    // lp1 ≈ 100 * WAD - MINIMUM_LIQUIDITY, total_lp ≈ 100 * WAD
    // For second mint with 50*WAD each:
    // ratio = wad_div(50*WAD, 100*WAD) = 0.5 * WAD
    // lp2 = wad_mul(0.5*WAD, 100*WAD) = 50 * WAD
    // Use approximate equality due to fixed-point precision differences
    assert_approx_eq(lp2, 50 * WAD, 'Wrong LP ratio');
}

#[test]
#[should_panic(expected: 'HZN: market expired')]
fn test_market_mint_expired() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 100 * WAD);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(market.expiry() + 1);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 50 * WAD, 50 * WAD);
}

#[test]
#[should_panic(expected: 'HZN: zero amount')]
fn test_market_mint_zero_amount() {
    let (_, _, _, _, market) = setup();
    let user = user1();

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 0, 0);
}

// ============ Burn (Remove Liquidity) Tests ============

#[test]
fn test_market_burn() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let (_, _, lp_minted) = market.mint(user, 100 * WAD, 100 * WAD);

    // Get balances before burn
    let sy_before = sy.balance_of(user);
    let pt_before = pt.balance_of(user);

    // Remove all user's liquidity (note: MINIMUM_LIQUIDITY=1000 is locked to dead address)
    let (sy_out, pt_out) = market.burn(user, lp_minted);
    stop_cheat_caller_address(market.contract_address);

    // LP = sqrt_wad(wad_mul(100*WAD, 100*WAD)) = 100 * WAD (WAD-normalized)
    // lp_minted = 100*WAD - 1000, total_lp = 100*WAD
    // ratio = lp_minted / total_lp ≈ 1 - 10^-17 (essentially 1)
    // sy_out ≈ 100*WAD (locked amount is negligible with WAD-normalized LP)
    // Use approximate equality due to fixed-point precision differences
    assert_approx_eq(sy_out, 100 * WAD, 'Wrong SY returned');
    assert_approx_eq(pt_out, 100 * WAD, 'Wrong PT returned');

    // Verify balances updated
    assert_approx_eq(sy.balance_of(user), sy_before + sy_out, 'Wrong SY balance');
    assert_approx_eq(pt.balance_of(user), pt_before + pt_out, 'Wrong PT balance');

    // Verify reserves are nearly empty (locked amount negligible with WAD-normalized LP)
    let (sy_reserve, pt_reserve) = market.get_reserves();
    // With WAD-normalized LP, locked reserve is tiny: 100*WAD * (1000/100*WAD) ≈ 1000
    // Allow slightly higher threshold (1200) for fixed-point precision differences
    assert(sy_reserve <= 1200, 'SY reserve should be minimal');
    assert(pt_reserve <= 1200, 'PT reserve should be minimal');
}

#[test]
fn test_market_burn_partial() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let (_, _, lp_minted) = market.mint(user, 100 * WAD, 100 * WAD);

    // Remove half of user's liquidity
    // LP = sqrt_wad(wad_mul(100*WAD, 100*WAD)) = 100 * WAD (WAD-normalized)
    // lp_minted ≈ 100 * WAD - 1000
    // lp_burn = lp_minted / 2 ≈ 50 * WAD
    let (sy_out, pt_out) = market.burn(user, lp_minted / 2);
    stop_cheat_caller_address(market.contract_address);

    // ratio = lp_burn / total_lp ≈ 0.5
    // sy_out ≈ 100*WAD * 0.5 = 50*WAD
    // Use approximate equality due to fixed-point precision differences
    assert_approx_eq(sy_out, 50 * WAD, 'Wrong SY returned');
    assert_approx_eq(pt_out, 50 * WAD, 'Wrong PT returned');

    // Verify remaining reserves: 100*WAD - sy_out ≈ 50*WAD
    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert_approx_eq(sy_reserve, 50 * WAD, 'Wrong SY reserve');
    assert_approx_eq(pt_reserve, 50 * WAD, 'Wrong PT reserve');
}

#[test]
fn test_market_burn_after_expiry() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    let (_, _, lp_minted) = market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(market.expiry() + 1);

    // Should still be able to burn after expiry
    start_cheat_caller_address(market.contract_address, user);
    let (sy_out, pt_out) = market.burn(user, lp_minted);
    stop_cheat_caller_address(market.contract_address);

    // LP = sqrt_wad(wad_mul(100*WAD, 100*WAD)) = 100 * WAD (WAD-normalized)
    // lp_minted ≈ 100*WAD - 1000, total_lp = 100*WAD
    // sy_out ≈ 100*WAD (locked amount negligible)
    // Use approximate equality due to fixed-point precision differences
    assert_approx_eq(sy_out, 100 * WAD, 'Should get SY back');
    assert_approx_eq(pt_out, 100 * WAD, 'Should get PT back');
}

// ============ Swap Tests ============

#[test]
fn test_swap_exact_pt_for_sy() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity first
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Swap PT for SY
    let swap_amount = 10 * WAD;
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(pt.contract_address);

    let sy_before = sy.balance_of(user);

    start_cheat_caller_address(market.contract_address, user);
    let sy_out = market.swap_exact_pt_for_sy(user, swap_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    // Verify received SY
    assert(sy_out > 0, 'Should receive SY');
    assert(sy.balance_of(user) == sy_before + sy_out, 'Wrong SY balance');

    // Verify reserves updated
    let (sy_reserve, pt_reserve) = market.get_reserves();
    assert(pt_reserve == 100 * WAD + swap_amount, 'Wrong PT reserve');
    assert(sy_reserve == 100 * WAD - sy_out, 'Wrong SY reserve');
}

#[test]
fn test_swap_exact_sy_for_pt() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Swap SY for PT
    let swap_amount = 10 * WAD;
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, swap_amount);
    stop_cheat_caller_address(sy.contract_address);

    let pt_before = pt.balance_of(user);

    start_cheat_caller_address(market.contract_address, user);
    let pt_out = market.swap_exact_sy_for_pt(user, swap_amount, 0);
    stop_cheat_caller_address(market.contract_address);

    // Verify received PT
    assert(pt_out > 0, 'Should receive PT');
    assert(pt.balance_of(user) == pt_before + pt_out, 'Wrong PT balance');
}

#[test]
fn test_swap_sy_for_exact_pt() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Want to get exactly 5 PT
    let exact_pt_out = 5 * WAD;
    let max_sy_in = 10 * WAD; // Generous max

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, max_sy_in);
    stop_cheat_caller_address(sy.contract_address);

    let pt_before = pt.balance_of(user);
    let sy_before = sy.balance_of(user);

    start_cheat_caller_address(market.contract_address, user);
    let sy_spent = market.swap_sy_for_exact_pt(user, exact_pt_out, max_sy_in);
    stop_cheat_caller_address(market.contract_address);

    // Verify got exact PT
    assert(pt.balance_of(user) == pt_before + exact_pt_out, 'Should get exact PT');
    // Verify spent SY
    assert(sy.balance_of(user) == sy_before - sy_spent, 'Wrong SY spent');
    assert(sy_spent <= max_sy_in, 'Exceeded max SY');
}

#[test]
fn test_swap_pt_for_exact_sy() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    // Use larger pool to avoid hitting proportion bounds during binary search
    // With Pendle's 96% max proportion, smaller pools can hit the bound
    setup_user_with_tokens(underlying, sy, yt, user, 2000 * WAD);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 500 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 500 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 500 * WAD, 500 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Want to get exactly 5 SY
    let exact_sy_out = 5 * WAD;
    let max_pt_in = 10 * WAD;

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, max_pt_in);
    stop_cheat_caller_address(pt.contract_address);

    let sy_before = sy.balance_of(user);
    let pt_before = pt.balance_of(user);

    start_cheat_caller_address(market.contract_address, user);
    let pt_spent = market.swap_pt_for_exact_sy(user, exact_sy_out, max_pt_in);
    stop_cheat_caller_address(market.contract_address);

    // Verify got exact SY
    assert(sy.balance_of(user) == sy_before + exact_sy_out, 'Should get exact SY');
    // Verify spent PT
    assert(pt.balance_of(user) == pt_before - pt_spent, 'Wrong PT spent');
    assert(pt_spent <= max_pt_in, 'Exceeded max PT');
}

// ============ Slippage Protection Tests ============

#[test]
#[should_panic(expected: 'HZN: slippage exceeded')]
fn test_swap_slippage_exceeded() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Try to swap with unrealistic min_out
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    // Expect at least 100 WAD SY for 1 WAD PT - should fail
    market.swap_exact_pt_for_sy(user, WAD, 100 * WAD);
}

// ============ Expiry Tests ============

#[test]
#[should_panic(expected: 'HZN: market expired')]
fn test_swap_after_expiry() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Fast forward past expiry
    start_cheat_block_timestamp_global(market.expiry() + 1);

    // Swap should fail
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, WAD, 0);
}

// ============ Implied Rate Tests ============

#[test]
fn test_get_ln_implied_rate() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 200 * WAD);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // Get implied rate
    let ln_rate = market.get_ln_implied_rate();

    // Should be non-zero
    assert(ln_rate > 0, 'Rate should be positive');
}

#[test]
fn test_implied_rate_changes_with_swap() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);

    // Add liquidity
    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(user, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    let rate_before = market.get_ln_implied_rate();

    // Do a swap - sell PT for SY
    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 20 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.swap_exact_pt_for_sy(user, 20 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    let rate_after = market.get_ln_implied_rate();

    // Rate should have changed (more PT in pool = higher proportion = lower rate)
    assert(rate_after != rate_before, 'Rate should change');
}

// ============ Edge Cases ============

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_mint_zero_receiver() {
    let (underlying, sy, yt, pt, market) = setup();
    let user = user1();

    setup_user_with_tokens(underlying, sy, yt, user, 100 * WAD);

    start_cheat_caller_address(sy.contract_address, user);
    sy.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user);
    pt.approve(market.contract_address, 50 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user);
    market.mint(zero_address(), 50 * WAD, 50 * WAD);
}

#[test]
fn test_multiple_users_swap() {
    let (underlying, sy, yt, pt, market) = setup();
    let user1_addr = user1();
    let user2_addr = user2();

    // Setup both users
    setup_user_with_tokens(underlying, sy, yt, user1_addr, 200 * WAD);
    setup_user_with_tokens(underlying, sy, yt, user2_addr, 200 * WAD);

    // User1 adds liquidity
    start_cheat_caller_address(sy.contract_address, user1_addr);
    sy.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(sy.contract_address);

    start_cheat_caller_address(pt.contract_address, user1_addr);
    pt.approve(market.contract_address, 100 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user1_addr);
    market.mint(user1_addr, 100 * WAD, 100 * WAD);
    stop_cheat_caller_address(market.contract_address);

    // User2 swaps
    start_cheat_caller_address(pt.contract_address, user2_addr);
    pt.approve(market.contract_address, 10 * WAD);
    stop_cheat_caller_address(pt.contract_address);

    start_cheat_caller_address(market.contract_address, user2_addr);
    let sy_out = market.swap_exact_pt_for_sy(user2_addr, 10 * WAD, 0);
    stop_cheat_caller_address(market.contract_address);

    assert(sy_out > 0, 'User2 should get SY');

    // User1 can still remove liquidity (partial)
    start_cheat_caller_address(market.contract_address, user1_addr);
    let lp_balance = market.total_lp_supply();
    let (sy_back, pt_back) = market.burn(user1_addr, lp_balance / 2);
    stop_cheat_caller_address(market.contract_address);

    assert(sy_back > 0, 'User1 should get SY');
    assert(pt_back > 0, 'User1 should get PT');
}
