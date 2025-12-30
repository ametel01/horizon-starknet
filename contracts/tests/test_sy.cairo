use horizon::interfaces::i_sy::{
    AssetType, ISYAdminDispatcher, ISYAdminDispatcherTrait, ISYDispatcher, ISYDispatcherTrait,
};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_erc20::IMockERC20Dispatcher;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

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

fn zero_address() -> ContractAddress {
    0.try_into().unwrap()
}

// Helper to serialize ByteArray for calldata
fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0); // data array length
    calldata.append(value); // pending_word
    calldata.append(len.into()); // pending_word_len
}

// Deploy mock ERC20 (base asset like USDC/ETH)
fn deploy_mock_erc20() -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'Mock USDC', 9);
    append_bytearray(ref calldata, 'USDC', 4);

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMockERC20Dispatcher { contract_address }
}

// Deploy mock yield token (yield-bearing asset like wstETH/aUSDC)
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

// Deploy SY token with default single-token support (underlying for both in/out)
fn deploy_sy(
    underlying: ContractAddress, index_oracle: ContractAddress, is_erc4626: bool,
) -> ISYDispatcher {
    deploy_sy_with_tokens(
        underlying,
        index_oracle,
        is_erc4626,
        AssetType::Token,
        array![underlying],
        array![underlying],
    )
}

// Deploy SY token with explicit tokens_in and tokens_out
fn deploy_sy_with_tokens(
    underlying: ContractAddress,
    index_oracle: ContractAddress,
    is_erc4626: bool,
    asset_type: AssetType,
    tokens_in: Array<ContractAddress>,
    tokens_out: Array<ContractAddress>,
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
    // Serialize AssetType enum (0 = Token, 1 = Liquidity)
    calldata.append(match asset_type {
        AssetType::Token => 0,
        AssetType::Liquidity => 1,
    });
    calldata.append(admin().into()); // pauser

    // Serialize tokens_in span
    calldata.append(tokens_in.len().into());
    for token in tokens_in {
        calldata.append(token.into());
    }

    // Serialize tokens_out span
    calldata.append(tokens_out.len().into());
    for token in tokens_out {
        calldata.append(token.into());
    }

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    ISYDispatcher { contract_address }
}

// Deploy full stack: MockERC20 -> MockYieldToken -> SY
// For native yield tokens, underlying == index_oracle (same address)
fn setup() -> (IMockERC20Dispatcher, IMockYieldTokenDispatcher, ISYDispatcher) {
    let base_asset = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(base_asset.contract_address, admin());
    let sy = deploy_sy(yield_token.contract_address, yield_token.contract_address, true);
    (base_asset, yield_token, sy)
}

// Helper to mint yield token shares to a user (admin mints shares directly)
fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

// ============ Constructor Tests ============

#[test]
fn test_sy_constructor() {
    let (_, yield_token, sy) = setup();

    assert(sy.name() == "SY Token", 'Wrong name');
    assert(sy.symbol() == "SY", 'Wrong symbol');
    assert(sy.decimals() == 18, 'Wrong decimals');
    assert(sy.total_supply() == 0, 'Wrong initial supply');
    assert(sy.exchange_rate() == WAD, 'Wrong exchange rate');
    assert(sy.underlying_asset() == yield_token.contract_address, 'Wrong underlying');
}

#[test]
fn test_sy_exchange_rate_from_underlying() {
    let (_, yield_token, sy) = setup();

    // Initial index is WAD (1:1)
    assert(sy.exchange_rate() == WAD, 'Initial rate should be WAD');

    // Simulate yield accrual by setting index on yield token
    let new_index = 2 * WAD; // 2:1 (100% yield)
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.set_index(new_index);
    stop_cheat_caller_address(yield_token.contract_address);

    // SY should now reflect the new exchange rate
    assert(sy.exchange_rate() == new_index, 'Rate should match underlying');
}

// ============ ERC20 Tests ============

#[test]
fn test_sy_transfer() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let recipient = user2();
    let amount = 100 * WAD;

    // Mint yield token shares to user
    mint_yield_token_to_user(yield_token, user, amount);

    // Approve SY contract and deposit
    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    let sy_amount = sy.deposit(user, amount, 0);

    // Transfer SY to recipient
    sy.transfer(recipient, sy_amount / 2);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy.balance_of(user) == sy_amount / 2, 'Wrong user balance');
    assert(sy.balance_of(recipient) == sy_amount / 2, 'Wrong recipient balance');
}

#[test]
fn test_sy_approve_and_transfer_from() {
    let (_, yield_token, sy) = setup();
    let owner = user1();
    let spender = user2();
    let amount = 100 * WAD;

    // Setup: mint yield token, approve, deposit
    mint_yield_token_to_user(yield_token, owner, amount);

    start_cheat_caller_address(yield_token.contract_address, owner);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, owner);
    let sy_amount = sy.deposit(owner, amount, 0);
    sy.approve(spender, sy_amount);
    stop_cheat_caller_address(sy.contract_address);

    // Transfer from owner to spender using allowance
    start_cheat_caller_address(sy.contract_address, spender);
    sy.transfer_from(owner, spender, sy_amount);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy.balance_of(owner) == 0, 'Wrong owner balance');
    assert(sy.balance_of(spender) == sy_amount, 'Wrong spender balance');
}

// ============ Deposit Tests ============

#[test]
fn test_sy_deposit_1_to_1() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let deposit_amount = 100 * WAD;

    // Mint yield token to user
    mint_yield_token_to_user(yield_token, user, deposit_amount);
    assert(yield_token.balance_of(user) == deposit_amount, 'Mint failed');

    // Approve SY contract to spend yield token
    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, deposit_amount);
    stop_cheat_caller_address(yield_token.contract_address);

    // Deposit yield token to get SY
    start_cheat_caller_address(sy.contract_address, user);
    let sy_minted = sy.deposit(user, deposit_amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // SY is 1:1 with underlying shares
    assert(sy_minted == deposit_amount, 'Wrong SY minted');
    assert(sy.balance_of(user) == deposit_amount, 'Wrong SY balance');
    assert(sy.total_supply() == deposit_amount, 'Wrong total supply');
    assert(yield_token.balance_of(user) == 0, 'Yield token not transferred');
}

#[test]
fn test_sy_deposit_to_different_receiver() {
    let (_, yield_token, sy) = setup();
    let depositor = user1();
    let receiver = user2();
    let deposit_amount = 100 * WAD;

    mint_yield_token_to_user(yield_token, depositor, deposit_amount);

    start_cheat_caller_address(yield_token.contract_address, depositor);
    yield_token.approve(sy.contract_address, deposit_amount);
    stop_cheat_caller_address(yield_token.contract_address);

    // Deposit but send SY to different receiver
    start_cheat_caller_address(sy.contract_address, depositor);
    let sy_minted = sy.deposit(receiver, deposit_amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy.balance_of(depositor) == 0, 'Depositor should have 0');
    assert(sy.balance_of(receiver) == sy_minted, 'Receiver should have SY');
}

#[test]
#[should_panic(expected: 'HZN: zero deposit')]
fn test_sy_deposit_zero() {
    let (_, _, sy) = setup();
    let user = user1();

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, 0, 0);
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_sy_deposit_zero_receiver() {
    let (_, yield_token, sy) = setup();
    let user = user1();

    mint_yield_token_to_user(yield_token, user, WAD);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, WAD);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(zero_address(), WAD, 0);
}

// ============ Redeem Tests ============

#[test]
fn test_sy_redeem_1_to_1() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Setup: deposit first
    mint_yield_token_to_user(yield_token, user, amount);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount, 0);

    // Redeem SY for yield token
    let shares_received = sy.redeem(user, amount, 0, false);
    stop_cheat_caller_address(sy.contract_address);

    // SY is 1:1 with underlying shares
    assert(shares_received == amount, 'Wrong shares received');
    assert(sy.balance_of(user) == 0, 'SY should be burned');
    assert(sy.total_supply() == 0, 'Total supply should be 0');
    assert(yield_token.balance_of(user) == amount, 'Should have yield token back');
}

#[test]
fn test_sy_redeem_to_different_receiver() {
    let (_, yield_token, sy) = setup();
    let redeemer = user1();
    let receiver = user2();
    let amount = 100 * WAD;

    // Setup: deposit
    mint_yield_token_to_user(yield_token, redeemer, amount);

    start_cheat_caller_address(yield_token.contract_address, redeemer);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, redeemer);
    sy.deposit(redeemer, amount, 0);

    // Redeem but send yield token to different receiver
    sy.redeem(receiver, amount, 0, false);
    stop_cheat_caller_address(sy.contract_address);

    assert(yield_token.balance_of(redeemer) == 0, 'Redeemer should have 0');
    assert(yield_token.balance_of(receiver) == amount, 'Receiver has yield tkn');
}

#[test]
#[should_panic(expected: 'HZN: zero redeem')]
fn test_sy_redeem_zero() {
    let (_, yield_token, sy) = setup();
    let user = user1();

    // Need some SY first
    mint_yield_token_to_user(yield_token, user, WAD);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, WAD);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, WAD, 0);
    sy.redeem(user, 0, 0, false);
}

#[test]
#[should_panic(expected: 'HZN: zero address')]
fn test_sy_redeem_zero_receiver() {
    let (_, yield_token, sy) = setup();
    let user = user1();

    mint_yield_token_to_user(yield_token, user, WAD);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, WAD);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, WAD, 0);
    sy.redeem(zero_address(), WAD, 0, false);
}

#[test]
#[should_panic(expected: 'ERC20: insufficient balance')]
fn test_sy_redeem_insufficient_balance() {
    let (_, yield_token, sy) = setup();
    let user = user1();

    mint_yield_token_to_user(yield_token, user, WAD);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, WAD);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, WAD, 0);
    // Try to redeem more than balance
    sy.redeem(user, 2 * WAD, 0, false);
}

// ============ Partial Deposit/Redeem Tests ============

#[test]
fn test_sy_partial_redeem() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Setup: deposit
    mint_yield_token_to_user(yield_token, user, amount);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount, 0);

    // Redeem only half
    sy.redeem(user, amount / 2, 0, false);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy.balance_of(user) == amount / 2, 'Wrong remaining SY');
    assert(yield_token.balance_of(user) == amount / 2, 'Wrong yield token balance');
}

#[test]
fn test_sy_multiple_deposits() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Mint yield token
    mint_yield_token_to_user(yield_token, user, amount);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    // First deposit
    sy.deposit(user, amount / 2, 0);
    assert(sy.balance_of(user) == amount / 2, 'Wrong balance after 1st');

    // Second deposit
    sy.deposit(user, amount / 2, 0);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy.balance_of(user) == amount, 'Wrong balance after 2nd');
    assert(sy.total_supply() == amount, 'Wrong total supply');
}

// ============ Yield Accrual Tests ============

#[test]
fn test_sy_exchange_rate_increases_with_yield() {
    let (_, yield_token, sy) = setup();

    // Initial exchange rate
    let initial_rate = sy.exchange_rate();
    assert(initial_rate == WAD, 'Initial rate wrong');

    // Simulate 10% yield
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.set_index(WAD + WAD / 10); // 1.1 WAD
    stop_cheat_caller_address(yield_token.contract_address);

    // Exchange rate should reflect the yield
    let new_rate = sy.exchange_rate();
    assert(new_rate == WAD + WAD / 10, 'Rate should be 1.1 WAD');
}

#[test]
fn test_sy_yield_accrual_with_deposit() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // User deposits yield token
    mint_yield_token_to_user(yield_token, user, amount);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // SY balance is 1:1 with deposited shares
    assert(sy.balance_of(user) == amount, 'SY balance wrong');

    // Simulate 50% yield
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.set_index(WAD + WAD / 2); // 1.5 WAD
    stop_cheat_caller_address(yield_token.contract_address);

    // SY balance unchanged (non-rebasing), but exchange rate increased
    assert(sy.balance_of(user) == amount, 'SY balance should not change');
    assert(sy.exchange_rate() == WAD + WAD / 2, 'Exchange rate should be 1.5');

    // When user redeems, they get back same number of shares (yield token)
    // but those shares are now worth more in terms of the base asset
    start_cheat_caller_address(sy.contract_address, user);
    let shares_received = sy.redeem(user, amount, 0, false);
    stop_cheat_caller_address(sy.contract_address);

    assert(shares_received == amount, 'Should get back same shares');
}

// ============ Multi-Token Support Tests ============

#[test]
fn test_sy_get_tokens_in_out_single() {
    let (_, yield_token, sy) = setup();

    // Default setup uses single token for both in and out
    let tokens_in = sy.get_tokens_in();
    let tokens_out = sy.get_tokens_out();

    assert(tokens_in.len() == 1, 'Should have 1 token_in');
    assert(tokens_out.len() == 1, 'Should have 1 token_out');
    assert(*tokens_in.at(0) == yield_token.contract_address, 'token_in should be underlying');
    assert(*tokens_out.at(0) == yield_token.contract_address, 'token_out should be underlying');
}

#[test]
fn test_sy_get_tokens_in_out_multiple() {
    let base_asset = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(base_asset.contract_address, admin());

    // Create additional mock tokens for multi-token support
    let token2: ContractAddress = 'token2'.try_into().unwrap();
    let token3: ContractAddress = 'token3'.try_into().unwrap();

    let tokens_in = array![yield_token.contract_address, token2, token3];
    let tokens_out = array![yield_token.contract_address, token2];

    let sy = deploy_sy_with_tokens(
        yield_token.contract_address,
        yield_token.contract_address,
        true,
        AssetType::Token,
        tokens_in,
        tokens_out,
    );

    let result_in = sy.get_tokens_in();
    let result_out = sy.get_tokens_out();

    assert(result_in.len() == 3, 'Should have 3 tokens_in');
    assert(result_out.len() == 2, 'Should have 2 tokens_out');
    assert(*result_in.at(0) == yield_token.contract_address, 'First token_in wrong');
    assert(*result_in.at(1) == token2, 'Second token_in wrong');
    assert(*result_in.at(2) == token3, 'Third token_in wrong');
    assert(*result_out.at(0) == yield_token.contract_address, 'First token_out wrong');
    assert(*result_out.at(1) == token2, 'Second token_out wrong');
}
// Note: Constructor validation for empty tokens_in/out and zero addresses
// is tested manually. snforge's #[should_panic] doesn't work with contract
// deployment failures, and the VM wraps errors in a way that prevents
// Result-based error handling. The validation code is present in sy.cairo
// constructor (lines 206-224) and works correctly.

// ============ Token Validation Tests ============

#[test]
fn test_sy_is_valid_token_in_single() {
    let (_, yield_token, sy) = setup();

    // Underlying token should be valid
    assert(sy.is_valid_token_in(yield_token.contract_address), 'underlying should be valid in');

    // Random address should not be valid
    let random_addr: ContractAddress = 'random'.try_into().unwrap();
    assert(!sy.is_valid_token_in(random_addr), 'random should be invalid in');

    // Zero address should not be valid
    assert(!sy.is_valid_token_in(zero_address()), 'zero should be invalid in');
}

#[test]
fn test_sy_is_valid_token_out_single() {
    let (_, yield_token, sy) = setup();

    // Underlying token should be valid
    assert(sy.is_valid_token_out(yield_token.contract_address), 'underlying should be valid out');

    // Random address should not be valid
    let random_addr: ContractAddress = 'random'.try_into().unwrap();
    assert(!sy.is_valid_token_out(random_addr), 'random should be invalid out');

    // Zero address should not be valid
    assert(!sy.is_valid_token_out(zero_address()), 'zero should be invalid out');
}

#[test]
fn test_sy_is_valid_token_multiple() {
    let base_asset = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(base_asset.contract_address, admin());

    // Create additional tokens for multi-token support
    let token2: ContractAddress = 'token2'.try_into().unwrap();
    let token3: ContractAddress = 'token3'.try_into().unwrap();

    // tokens_in: underlying, token2, token3
    // tokens_out: underlying, token2 (token3 NOT in tokens_out)
    let tokens_in = array![yield_token.contract_address, token2, token3];
    let tokens_out = array![yield_token.contract_address, token2];

    let sy = deploy_sy_with_tokens(
        yield_token.contract_address,
        yield_token.contract_address,
        true,
        AssetType::Token,
        tokens_in,
        tokens_out,
    );

    // Verify tokens_in
    assert(sy.is_valid_token_in(yield_token.contract_address), 'underlying valid in');
    assert(sy.is_valid_token_in(token2), 'token2 valid in');
    assert(sy.is_valid_token_in(token3), 'token3 valid in');

    // Verify tokens_out
    assert(sy.is_valid_token_out(yield_token.contract_address), 'underlying valid out');
    assert(sy.is_valid_token_out(token2), 'token2 valid out');
    assert(!sy.is_valid_token_out(token3), 'token3 NOT valid out');

    // Random address should be invalid for both
    let random_addr: ContractAddress = 'random'.try_into().unwrap();
    assert(!sy.is_valid_token_in(random_addr), 'random invalid in');
    assert(!sy.is_valid_token_out(random_addr), 'random invalid out');
}

// ============ Asset Info Tests ============

#[test]
fn test_sy_asset_info_token() {
    let (_, yield_token, sy) = setup();

    let (asset_type, underlying, decimals) = sy.asset_info();

    // Default setup uses AssetType::Token
    assert(asset_type == AssetType::Token, 'should be Token type');
    assert(underlying == yield_token.contract_address, 'wrong underlying');
    assert(decimals == 18, 'wrong decimals');
}

#[test]
fn test_sy_asset_info_liquidity() {
    let base_asset = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(base_asset.contract_address, admin());

    // Deploy SY with AssetType::Liquidity (simulating an LP token)
    let sy = deploy_sy_with_tokens(
        yield_token.contract_address,
        yield_token.contract_address,
        true,
        AssetType::Liquidity,
        array![yield_token.contract_address],
        array![yield_token.contract_address],
    );

    let (asset_type, underlying, decimals) = sy.asset_info();

    assert(asset_type == AssetType::Liquidity, 'should be Liquidity type');
    assert(underlying == yield_token.contract_address, 'wrong underlying');
    assert(decimals == 18, 'wrong decimals');
}

// ============ Slippage Protection Tests ============

#[test]
#[should_panic(expected: 'HZN: insufficient shares out')]
fn test_deposit_slippage_reverts() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let deposit_amount = 100 * WAD;

    // Mint yield token to user
    mint_yield_token_to_user(yield_token, user, deposit_amount);

    // Approve SY contract
    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, deposit_amount);
    stop_cheat_caller_address(yield_token.contract_address);

    // Deposit with min_shares_out higher than possible output (SY is 1:1)
    // Requesting 200 WAD when depositing 100 WAD should fail
    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, deposit_amount, 200 * WAD);
}

#[test]
#[should_panic(expected: 'HZN: insufficient token out')]
fn test_redeem_slippage_reverts() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Setup: deposit first
    mint_yield_token_to_user(yield_token, user, amount);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount, 0);

    // Redeem with min_token_out higher than possible output (SY is 1:1)
    // Requesting 200 WAD when redeeming 100 WAD should fail
    sy.redeem(user, amount, 200 * WAD, false);
}

#[test]
fn test_deposit_with_slippage_protection() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let deposit_amount = 100 * WAD;

    // Mint yield token to user
    mint_yield_token_to_user(yield_token, user, deposit_amount);

    // Approve SY contract
    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, deposit_amount);
    stop_cheat_caller_address(yield_token.contract_address);

    // Deposit with exact min_shares_out (SY is 1:1)
    start_cheat_caller_address(sy.contract_address, user);
    let sy_minted = sy.deposit(user, deposit_amount, deposit_amount);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy_minted == deposit_amount, 'SY minted matches');
    assert(sy.balance_of(user) == deposit_amount, 'Balance correct');
}

#[test]
fn test_redeem_with_slippage_protection() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Setup: deposit first
    mint_yield_token_to_user(yield_token, user, amount);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount, 0);

    // Redeem with exact min_token_out (SY is 1:1)
    let shares_received = sy.redeem(user, amount, amount, false);
    stop_cheat_caller_address(sy.contract_address);

    assert(shares_received == amount, 'Shares received matches');
    assert(sy.balance_of(user) == 0, 'SY burned');
    assert(yield_token.balance_of(user) == amount, 'Got tokens back');
}

// ============ Internal Balance Redemption Tests ============

#[test]
fn test_redeem_from_internal_balance() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Mint and deposit to get SY
    mint_yield_token_to_user(yield_token, user, amount);
    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy.balance_of(user) == amount, 'SY minted');

    // Transfer SY to the SY contract (simulating Router pattern)
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(sy.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy.balance_of(user) == 0, 'User has no SY');
    assert(sy.balance_of(sy.contract_address) == amount, 'Contract has SY');

    // Now redeem with burn_from_internal_balance=true
    // Any caller can trigger the redeem since we burn from contract's balance
    start_cheat_caller_address(sy.contract_address, user);
    let shares_received = sy.redeem(user, amount, 0, true);
    stop_cheat_caller_address(sy.contract_address);

    assert(shares_received == amount, 'Shares received');
    assert(sy.balance_of(sy.contract_address) == 0, 'Contract SY burned');
    assert(yield_token.balance_of(user) == amount, 'User got tokens');
}

#[test]
#[should_panic(expected: 'ERC20: insufficient balance')]
fn test_redeem_from_internal_balance_insufficient() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Mint and deposit to get SY (to user, not contract)
    mint_yield_token_to_user(yield_token, user, amount);
    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Try to redeem from internal balance without transferring to contract first
    // Contract has 0 SY balance, so this should fail
    start_cheat_caller_address(sy.contract_address, user);
    sy.redeem(user, amount, 0, true); // Should panic
}

#[test]
fn test_redeem_to_different_receiver_from_internal_balance() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let receiver = user2();
    let amount = 100 * WAD;

    // Setup: mint, deposit, get SY
    mint_yield_token_to_user(yield_token, user, amount);
    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Transfer SY to contract
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(sy.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Redeem to different receiver from internal balance
    start_cheat_caller_address(sy.contract_address, user);
    let shares_received = sy.redeem(receiver, amount, 0, true);
    stop_cheat_caller_address(sy.contract_address);

    assert(shares_received == amount, 'Shares received');
    assert(yield_token.balance_of(user) == 0, 'User got nothing');
    assert(yield_token.balance_of(receiver) == amount, 'Receiver got tokens');
}

// ============ Preview Function Tests ============

#[test]
fn test_preview_deposit_matches_deposit() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let deposit_amount = 100 * WAD;

    // Preview should return expected SY output (1:1)
    let preview = sy.preview_deposit(deposit_amount);
    assert(preview == deposit_amount, 'Preview should equal input');

    // Now actually deposit and verify it matches
    mint_yield_token_to_user(yield_token, user, deposit_amount);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, deposit_amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    let actual_sy_minted = sy.deposit(user, deposit_amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    assert(actual_sy_minted == preview, 'Actual should match preview');
}

#[test]
fn test_preview_redeem_matches_redeem() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Setup: deposit first to get SY
    mint_yield_token_to_user(yield_token, user, amount);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Preview should return expected underlying output (1:1)
    let preview = sy.preview_redeem(amount);
    assert(preview == amount, 'Preview should equal input');

    // Now actually redeem and verify it matches
    start_cheat_caller_address(sy.contract_address, user);
    let actual_shares_received = sy.redeem(user, amount, 0, false);
    stop_cheat_caller_address(sy.contract_address);

    assert(actual_shares_received == preview, 'Actual should match preview');
}

#[test]
fn test_preview_deposit_zero() {
    let (_, _, sy) = setup();

    // Preview of zero should return zero
    let preview = sy.preview_deposit(0);
    assert(preview == 0, 'Preview of 0 should be 0');
}

#[test]
fn test_preview_redeem_zero() {
    let (_, _, sy) = setup();

    // Preview of zero should return zero
    let preview = sy.preview_redeem(0);
    assert(preview == 0, 'Preview of 0 should be 0');
}

#[test]
fn test_preview_large_amounts() {
    let (_, _, sy) = setup();

    // Preview should handle large amounts (close to u256 max)
    let large_amount = 1_000_000_000 * WAD; // 1 billion tokens

    let deposit_preview = sy.preview_deposit(large_amount);
    let redeem_preview = sy.preview_redeem(large_amount);

    assert(deposit_preview == large_amount, 'Large deposit preview wrong');
    assert(redeem_preview == large_amount, 'Large redeem preview wrong');
}

// ============ Pausable Transfer Tests (Gap 4.1) ============

/// Helper to get admin dispatcher for pause/unpause operations
fn get_admin(sy: ISYDispatcher) -> ISYAdminDispatcher {
    ISYAdminDispatcher { contract_address: sy.contract_address }
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn test_sy_transfer_blocked_when_paused() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let recipient = user2();
    let amount = 100 * WAD;

    // Mint yield token and deposit to get SY
    mint_yield_token_to_user(yield_token, user, amount);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Verify user has SY
    assert(sy.balance_of(user) == amount, 'User should have SY');

    // Pause the contract (admin has PAUSER_ROLE)
    let admin_dispatcher = get_admin(sy);
    start_cheat_caller_address(sy.contract_address, admin());
    admin_dispatcher.pause();
    stop_cheat_caller_address(sy.contract_address);

    // Try to transfer - should fail because paused
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(recipient, amount);
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn test_sy_transfer_from_blocked_when_paused() {
    let (_, yield_token, sy) = setup();
    let owner = user1();
    let spender = user2();
    let amount = 100 * WAD;

    // Setup: mint, deposit, approve
    mint_yield_token_to_user(yield_token, owner, amount);

    start_cheat_caller_address(yield_token.contract_address, owner);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, owner);
    sy.deposit(owner, amount, 0);
    sy.approve(spender, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Pause the contract
    let admin_dispatcher = get_admin(sy);
    start_cheat_caller_address(sy.contract_address, admin());
    admin_dispatcher.pause();
    stop_cheat_caller_address(sy.contract_address);

    // Try to transfer_from - should fail because paused
    start_cheat_caller_address(sy.contract_address, spender);
    sy.transfer_from(owner, spender, amount);
}

#[test]
#[should_panic(expected: 'Pausable: paused')]
fn test_sy_deposit_blocked_when_paused() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Mint yield token to user
    mint_yield_token_to_user(yield_token, user, amount);

    // Approve SY contract
    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    // Pause the contract
    let admin_dispatcher = get_admin(sy);
    start_cheat_caller_address(sy.contract_address, admin());
    admin_dispatcher.pause();
    stop_cheat_caller_address(sy.contract_address);

    // Try to deposit - should fail because paused
    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount, 0);
}

#[test]
fn test_sy_transfer_works_after_unpause() {
    let (_, yield_token, sy) = setup();
    let user = user1();
    let recipient = user2();
    let amount = 100 * WAD;

    // Mint yield token and deposit to get SY
    mint_yield_token_to_user(yield_token, user, amount);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Pause the contract
    let admin_dispatcher = get_admin(sy);
    start_cheat_caller_address(sy.contract_address, admin());
    admin_dispatcher.pause();
    stop_cheat_caller_address(sy.contract_address);

    // Unpause the contract
    start_cheat_caller_address(sy.contract_address, admin());
    admin_dispatcher.unpause();
    stop_cheat_caller_address(sy.contract_address);

    // Now transfer should work
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(recipient, amount);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy.balance_of(user) == 0, 'User should have 0');
    assert(sy.balance_of(recipient) == amount, 'Recipient should have SY');
}

#[test]
fn test_sy_redeem_works_when_paused() {
    // Redemptions are ALWAYS allowed, even when paused.
    // This ensures users can always exit their positions during emergencies.
    let (_, yield_token, sy) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Setup: deposit first to get SY
    mint_yield_token_to_user(yield_token, user, amount);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    // Pause the contract
    let admin_dispatcher = get_admin(sy);
    start_cheat_caller_address(sy.contract_address, admin());
    admin_dispatcher.pause();
    stop_cheat_caller_address(sy.contract_address);

    // Redeem should work even when paused - users must be able to exit
    start_cheat_caller_address(sy.contract_address, user);
    let shares_received = sy.redeem(user, amount, 0, false);
    stop_cheat_caller_address(sy.contract_address);

    assert(shares_received == amount, 'Redeem should work when paused');
    assert(sy.balance_of(user) == 0, 'SY should be burned');
    assert(yield_token.balance_of(user) == amount, 'User should have yield token');
}
