use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
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
    calldata.append(admin().into()); // pauser

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
    let sy_amount = sy.deposit(user, amount);

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
    let sy_amount = sy.deposit(owner, amount);
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
    let sy_minted = sy.deposit(user, deposit_amount);
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
    let sy_minted = sy.deposit(receiver, deposit_amount);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy.balance_of(depositor) == 0, 'Depositor should have 0');
    assert(sy.balance_of(receiver) == sy_minted, 'Receiver should have SY');
}

#[test]
#[should_panic(expected: 'SY: zero deposit')]
fn test_sy_deposit_zero() {
    let (_, _, sy) = setup();
    let user = user1();

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, 0);
}

#[test]
#[should_panic(expected: 'YT: zero address')]
fn test_sy_deposit_zero_receiver() {
    let (_, yield_token, sy) = setup();
    let user = user1();

    mint_yield_token_to_user(yield_token, user, WAD);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, WAD);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(zero_address(), WAD);
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
    sy.deposit(user, amount);

    // Redeem SY for yield token
    let shares_received = sy.redeem(user, amount);
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
    sy.deposit(redeemer, amount);

    // Redeem but send yield token to different receiver
    sy.redeem(receiver, amount);
    stop_cheat_caller_address(sy.contract_address);

    assert(yield_token.balance_of(redeemer) == 0, 'Redeemer should have 0');
    assert(yield_token.balance_of(receiver) == amount, 'Receiver has yield tkn');
}

#[test]
#[should_panic(expected: 'SY: zero redeem')]
fn test_sy_redeem_zero() {
    let (_, yield_token, sy) = setup();
    let user = user1();

    // Need some SY first
    mint_yield_token_to_user(yield_token, user, WAD);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, WAD);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, WAD);
    sy.redeem(user, 0);
}

#[test]
#[should_panic(expected: 'YT: zero address')]
fn test_sy_redeem_zero_receiver() {
    let (_, yield_token, sy) = setup();
    let user = user1();

    mint_yield_token_to_user(yield_token, user, WAD);

    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, WAD);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, WAD);
    sy.redeem(zero_address(), WAD);
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
    sy.deposit(user, WAD);
    // Try to redeem more than balance
    sy.redeem(user, 2 * WAD);
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
    sy.deposit(user, amount);

    // Redeem only half
    sy.redeem(user, amount / 2);
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
    sy.deposit(user, amount / 2);
    assert(sy.balance_of(user) == amount / 2, 'Wrong balance after 1st');

    // Second deposit
    sy.deposit(user, amount / 2);
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
    sy.deposit(user, amount);
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
    let shares_received = sy.redeem(user, amount);
    stop_cheat_caller_address(sy.contract_address);

    assert(shares_received == amount, 'Should get back same shares');
}
