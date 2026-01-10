/// Test suite for Market Reward Distribution
///
/// Tests the LP reward accrual and claiming mechanism:
/// - Reward token initialization on market creation
/// - Reward distribution via token transfers to market
/// - Reward accrual over time proportional to LP position
/// - Reward claiming by individual users
/// - LP transfer interactions (both users' rewards update)
/// - Multiple reward tokens simultaneously
/// - Edge cases (no LP, zero rewards, etc.)
///
/// Key mechanics:
/// - Rewards are distributed proportionally to LP token holdings
/// - Global index tracks cumulative rewards per LP share
/// - User index tracks user's last checkpoint
/// - Accrued = LP_balance * (global_index - user_index)

use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::libraries::math_fp::WAD;
use horizon::market::amm::Market::{IMarketRewardsDispatcher, IMarketRewardsDispatcherTrait};
use horizon::mocks::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use openzeppelin_interfaces::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

// Constants
const SECONDS_PER_YEAR: u64 = 31_536_000; // 365 * 24 * 60 * 60
const CURRENT_TIME: u64 = 1000;

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

// Helper to serialize ByteArray for calldata
fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0); // data array length
    calldata.append(value); // pending_word
    calldata.append(len.into()); // pending_word_len
}

// Default market parameters
fn default_scalar_root() -> u256 {
    100 * WAD // 100 - realistic sensitivity for asset-based curve
}

fn default_initial_anchor() -> u256 {
    WAD / 2 // 50% ln_implied_rate gives exchange_rate ≈ 1.65
}

fn default_fee_rate() -> u256 {
    WAD / 100 // 1% fee
}

// Deploy mock ERC20
fn deploy_mock_erc20(name: felt252, symbol: felt252) -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, name, 9);
    append_bytearray(ref calldata, symbol, 4);
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
    let underlying = deploy_mock_erc20('MockERC20', 'MERC');
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

// Deploy Market with reward tokens
fn deploy_market(
    pt: ContractAddress,
    scalar_root: u256,
    initial_anchor: u256,
    fee_rate: u256,
    reward_tokens: Span<ContractAddress>,
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
    calldata.append(admin().into()); // pauser (becomes owner)
    calldata.append(0); // factory (zero address for tests)

    // reward_tokens array
    calldata.append(reward_tokens.len().into());
    for token in reward_tokens {
        calldata.append((*token).into());
    }

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

// Setup market with reward tokens
fn setup_market_with_rewards(
    reward_tokens: Span<ContractAddress>,
) -> (
    IMockYieldTokenDispatcher,
    ISYDispatcher,
    IYTDispatcher,
    IPTDispatcher,
    IMarketDispatcher,
    IMarketRewardsDispatcher,
) {
    start_cheat_block_timestamp_global(CURRENT_TIME);

    let expiry = CURRENT_TIME + SECONDS_PER_YEAR;
    let (_, underlying) = deploy_yield_token_stack();
    let sy = deploy_sy(underlying.contract_address, underlying.contract_address, true);
    let yt = deploy_yt(sy.contract_address, expiry);
    let pt = IPTDispatcher { contract_address: yt.pt() };

    let market = deploy_market(
        pt.contract_address,
        default_scalar_root(),
        default_initial_anchor(),
        default_fee_rate(),
        reward_tokens,
    );

    let market_rewards = IMarketRewardsDispatcher { contract_address: market.contract_address };

    (underlying, sy, yt, pt, market, market_rewards)
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

// ============ Reward Tests ============

#[test]
fn test_reward_initialization() {
    // Deploy a reward token
    let reward_token = deploy_mock_erc20('REWARD', 'RWD');

    // Setup market with reward token
    let reward_tokens = array![reward_token.contract_address].span();
    let (_, _, _, _, _, market_rewards) = setup_market_with_rewards(reward_tokens);

    // Verify reward tokens are set correctly
    let tokens = market_rewards.get_reward_tokens();
    assert(tokens.len() == 1, 'Should have 1 reward token');
    assert(*tokens.at(0) == reward_token.contract_address, 'Wrong reward token address');
    assert(
        market_rewards.is_reward_token(reward_token.contract_address), 'Should be reward token',
    );
    assert(market_rewards.reward_tokens_count() == 1, 'Count should be 1');

    // Verify initial reward index is WAD (as per RewardManager design)
    assert(market_rewards.reward_index(reward_token.contract_address) == WAD, 'Initial index != WAD');
}

#[test]
fn test_reward_distribution() {
    // Deploy a reward token
    let reward_token = deploy_mock_erc20('REWARD', 'RWD');

    // Setup market with reward token
    let reward_tokens = array![reward_token.contract_address].span();
    let (underlying, sy, yt, pt, market, market_rewards) = setup_market_with_rewards(
        reward_tokens,
    );

    let user = user1();
    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);

    // Add liquidity to get LP tokens
    let lp_amount = add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);
    assert(lp_amount > 0, 'Should have LP tokens');

    // Send rewards to market
    let reward_amount = 1000 * WAD;
    start_cheat_caller_address(reward_token.contract_address, admin());
    reward_token.mint(admin(), reward_amount);
    reward_token.transfer(market.contract_address, reward_amount);
    stop_cheat_caller_address(reward_token.contract_address);

    // Check reward index hasn't updated yet (needs user interaction)
    let index_before = market_rewards.reward_index(reward_token.contract_address);

    // Trigger reward update by claiming (even though nothing accrued yet for user)
    start_cheat_caller_address(market.contract_address, user);
    let _claimed = market_rewards.claim_rewards(user);
    stop_cheat_caller_address(market.contract_address);

    // After claiming, index should have updated
    let index_after = market_rewards.reward_index(reward_token.contract_address);
    assert(index_after > index_before, 'Index should have increased');
}

#[test]
fn test_reward_accrual() {
    // Deploy a reward token
    let reward_token = deploy_mock_erc20('REWARD', 'RWD');

    // Setup market with reward token
    let reward_tokens = array![reward_token.contract_address].span();
    let (underlying, sy, yt, pt, market, market_rewards) = setup_market_with_rewards(
        reward_tokens,
    );

    let user = user1();
    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);

    // Add liquidity to get LP tokens - this initializes user's reward index to WAD
    let _lp_amount = add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Now send rewards to market (AFTER user has LP)
    let reward_amount = 1000 * WAD;
    start_cheat_caller_address(reward_token.contract_address, admin());
    reward_token.mint(admin(), reward_amount);
    reward_token.transfer(market.contract_address, reward_amount);
    stop_cheat_caller_address(reward_token.contract_address);

    // Check accrued rewards before any update - should still be 0 (not updated yet)
    let accrued_before = market_rewards.accrued_rewards(user);
    assert(accrued_before.len() == 1, 'Should have 1 accrued entry');
    // Note: accrued might be 0 here because accrued_rewards() doesn't trigger an update

    // Trigger reward update by claiming
    start_cheat_caller_address(market.contract_address, user);
    let claimed = market_rewards.claim_rewards(user);
    stop_cheat_caller_address(market.contract_address);

    // User should have claimed the reward proportional to their LP (minus MINIMUM_LIQUIDITY)
    // MINIMUM_LIQUIDITY (1000) goes to address 0, so user gets (lp_supply - 1000) / lp_supply
    assert(claimed.len() == 1, 'Should have claimed 1 token');
    // Due to MINIMUM_LIQUIDITY, user gets slightly less than full rewards
    assert(*claimed.at(0) > 0, 'Should claim rewards');
    assert(*claimed.at(0) < reward_amount, 'Gets less than all (MIN_LIQ)');

    // After claiming, accrued should be zero
    let accrued_after = market_rewards.accrued_rewards(user);
    assert(*accrued_after.at(0) == 0, 'Accrued should be 0 after claim');
}

#[test]
fn test_reward_claiming() {
    // Deploy a reward token
    let reward_token = deploy_mock_erc20('REWARD', 'RWD');

    // Setup market with reward token
    let reward_tokens = array![reward_token.contract_address].span();
    let (underlying, sy, yt, pt, market, market_rewards) = setup_market_with_rewards(
        reward_tokens,
    );

    let user = user1();
    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);

    // Add liquidity to get LP tokens - this initializes user's reward index
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Now send rewards to market (AFTER user has LP)
    let reward_amount = 1000 * WAD;
    start_cheat_caller_address(reward_token.contract_address, admin());
    reward_token.mint(admin(), reward_amount);
    reward_token.transfer(market.contract_address, reward_amount);
    stop_cheat_caller_address(reward_token.contract_address);

    // Check user balance before claiming
    let balance_before = reward_token.balance_of(user);

    // Claim rewards
    start_cheat_caller_address(market.contract_address, user);
    let claimed = market_rewards.claim_rewards(user);
    stop_cheat_caller_address(market.contract_address);

    // Check user balance after claiming
    let balance_after = reward_token.balance_of(user);
    let claimed_amount = *claimed.at(0);
    assert(balance_after == balance_before + claimed_amount, 'Balance should increase');
    // Due to MINIMUM_LIQUIDITY going to address 0, user gets slightly less than all rewards
    assert(claimed_amount > 0, 'Should claim some rewards');
    assert(claimed_amount < reward_amount, 'Gets less than all (MIN_LIQ)');
}

#[test]
fn test_reward_transfer() {
    // Deploy a reward token
    let reward_token = deploy_mock_erc20('REWARD', 'RWD');

    // Setup market with reward token
    let reward_tokens = array![reward_token.contract_address].span();
    let (underlying, sy, yt, pt, market, market_rewards) = setup_market_with_rewards(
        reward_tokens,
    );

    let user1_addr = user1();
    let user2_addr = user2();

    setup_user_with_tokens(underlying, sy, yt, user1_addr, 300 * WAD);
    setup_user_with_tokens(underlying, sy, yt, user2_addr, 300 * WAD);

    // User1 adds liquidity
    let lp_amount = add_liquidity(sy, pt, market, user1_addr, 100 * WAD, 100 * WAD);

    // Send rewards to market
    let reward_amount = 1000 * WAD;
    start_cheat_caller_address(reward_token.contract_address, admin());
    reward_token.mint(admin(), reward_amount);
    reward_token.transfer(market.contract_address, reward_amount);
    stop_cheat_caller_address(reward_token.contract_address);

    // User1 transfers half their LP to user2
    let market_lp = IERC20Dispatcher { contract_address: market.contract_address };
    start_cheat_caller_address(market.contract_address, user1_addr);
    market_lp.transfer(user2_addr, lp_amount / 2);
    stop_cheat_caller_address(market.contract_address);

    // Check that both users have LP tokens
    assert(market_lp.balance_of(user1_addr) == lp_amount / 2, 'User1 should have half LP');
    assert(market_lp.balance_of(user2_addr) == lp_amount / 2, 'User2 should have half LP');

    // Both users should have updated reward indices after transfer
    let user1_index = market_rewards.user_reward_index(user1_addr, reward_token.contract_address);
    let user2_index = market_rewards.user_reward_index(user2_addr, reward_token.contract_address);
    assert(user1_index > 0, 'User1 index should be updated');
    assert(user2_index > 0, 'User2 index should be updated');

    // User1 should have accrued rewards from before transfer
    let user1_accrued = market_rewards.accrued_rewards(user1_addr);
    assert(*user1_accrued.at(0) > 0, 'User1 should have accrued');

    // User2 should start with 0 accrued (just received LP)
    let user2_accrued = market_rewards.accrued_rewards(user2_addr);
    assert(*user2_accrued.at(0) == 0, 'User2 should have 0 accrued');
}

#[test]
fn test_multiple_reward_tokens() {
    // Deploy two reward tokens
    let reward_token1 = deploy_mock_erc20('REWARD1', 'RWD1');
    let reward_token2 = deploy_mock_erc20('REWARD2', 'RWD2');

    // Setup market with both reward tokens
    let reward_tokens = array![
        reward_token1.contract_address, reward_token2.contract_address,
    ]
        .span();
    let (underlying, sy, yt, pt, market, market_rewards) = setup_market_with_rewards(
        reward_tokens,
    );

    let user = user1();
    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);

    // Add liquidity to get LP tokens
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Send both types of rewards to market
    let reward_amount1 = 1000 * WAD;
    let reward_amount2 = 500 * WAD;

    start_cheat_caller_address(reward_token1.contract_address, admin());
    reward_token1.mint(admin(), reward_amount1);
    reward_token1.transfer(market.contract_address, reward_amount1);
    stop_cheat_caller_address(reward_token1.contract_address);

    start_cheat_caller_address(reward_token2.contract_address, admin());
    reward_token2.mint(admin(), reward_amount2);
    reward_token2.transfer(market.contract_address, reward_amount2);
    stop_cheat_caller_address(reward_token2.contract_address);

    // Claim both rewards
    start_cheat_caller_address(market.contract_address, user);
    let claimed = market_rewards.claim_rewards(user);
    stop_cheat_caller_address(market.contract_address);

    // Should have claimed both reward types (minus MINIMUM_LIQUIDITY share)
    assert(claimed.len() == 2, 'Should claim 2 tokens');
    let claimed1 = *claimed.at(0);
    let claimed2 = *claimed.at(1);
    assert(claimed1 > 0 && claimed1 < reward_amount1, 'Claimed reward1 minus MIN');
    assert(claimed2 > 0 && claimed2 < reward_amount2, 'Claimed reward2 minus MIN');

    // Verify balances
    assert(reward_token1.balance_of(user) == claimed1, 'User has reward1 balance');
    assert(reward_token2.balance_of(user) == claimed2, 'User has reward2 balance');
}

#[test]
fn test_no_rewards_before_lp() {
    // Deploy a reward token
    let reward_token = deploy_mock_erc20('REWARD', 'RWD');

    // Setup market with reward token
    let reward_tokens = array![reward_token.contract_address].span();
    let (underlying, sy, yt, pt, market, market_rewards) = setup_market_with_rewards(
        reward_tokens,
    );

    // Send rewards to market BEFORE any LP is minted
    let reward_amount = 1000 * WAD;
    start_cheat_caller_address(reward_token.contract_address, admin());
    reward_token.mint(admin(), reward_amount);
    reward_token.transfer(market.contract_address, reward_amount);
    stop_cheat_caller_address(reward_token.contract_address);

    let user = user1();
    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);

    // Now add liquidity (first LP provider)
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Claim rewards - rewards sent before LP existed are NOT claimable
    // This is expected behavior: rewards only distribute when supply > 0
    start_cheat_caller_address(market.contract_address, user);
    let claimed = market_rewards.claim_rewards(user);
    stop_cheat_caller_address(market.contract_address);

    // User should NOT get the early rewards (they were sent when supply == 0)
    assert(*claimed.at(0) == 0, 'Early rewards not claimable');
}

#[test]
fn test_claim_zero_rewards() {
    // Deploy a reward token
    let reward_token = deploy_mock_erc20('REWARD', 'RWD');

    // Setup market with reward token
    let reward_tokens = array![reward_token.contract_address].span();
    let (underlying, sy, yt, pt, market, market_rewards) = setup_market_with_rewards(
        reward_tokens,
    );

    let user = user1();
    setup_user_with_tokens(underlying, sy, yt, user, 300 * WAD);

    // Add liquidity to get LP tokens
    add_liquidity(sy, pt, market, user, 100 * WAD, 100 * WAD);

    // Claim rewards without sending any rewards (should not fail)
    start_cheat_caller_address(market.contract_address, user);
    let claimed = market_rewards.claim_rewards(user);
    stop_cheat_caller_address(market.contract_address);

    // Should return 0 for the reward token
    assert(claimed.len() == 1, 'Should have 1 claimed entry');
    assert(*claimed.at(0) == 0, 'Should claim 0 rewards');

    // User balance should be unchanged
    assert(reward_token.balance_of(user) == 0, 'User should have 0 balance');
}
