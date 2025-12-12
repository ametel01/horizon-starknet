use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;
use yield_tokenization::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
use yield_tokenization::libraries::math::WAD;
use yield_tokenization::mocks::mock_yield_token::{
    IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait,
};

// Test addresses
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
// ByteArray = { data: Array<bytes31>, pending_word: felt252, pending_word_len: u32 }
// For short strings (< 31 bytes): data_len=0, pending_word=string, pending_word_len=len
fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0); // data array length (0 for short strings)
    calldata.append(value); // pending_word
    calldata.append(len.into()); // pending_word_len
}

// Deploy mock yield token
fn deploy_mock_yield_token() -> IMockYieldTokenDispatcher {
    let contract = declare("MockYieldToken").unwrap().contract_class();
    let mut calldata = array![];
    // name: "MockYieldToken" (14 chars)
    append_bytearray(ref calldata, 'MockYieldToken', 14);
    // symbol: "MYT" (3 chars)
    append_bytearray(ref calldata, 'MYT', 3);

    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    IMockYieldTokenDispatcher { contract_address }
}

// Deploy SY token
fn deploy_sy(underlying: ContractAddress, initial_exchange_rate: u256) -> ISYDispatcher {
    let contract = declare("SY").unwrap().contract_class();
    let mut calldata = array![];
    // name: "SY Token" (8 chars)
    append_bytearray(ref calldata, 'SY Token', 8);
    // symbol: "SY" (2 chars)
    append_bytearray(ref calldata, 'SY', 2);
    // underlying address
    calldata.append(underlying.into());
    // initial_exchange_rate (u256 = 2 felts: low, high)
    calldata.append(initial_exchange_rate.low.into());
    calldata.append(initial_exchange_rate.high.into());

    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    ISYDispatcher { contract_address }
}

// Deploy both tokens with initial setup
fn setup() -> (IMockYieldTokenDispatcher, ISYDispatcher) {
    let underlying = deploy_mock_yield_token();
    let sy = deploy_sy(underlying.contract_address, WAD); // 1:1 exchange rate
    (underlying, sy)
}

// ============ Constructor Tests ============

#[test]
fn test_sy_constructor() {
    let (underlying, sy) = setup();

    assert(sy.name() == "SY Token", 'Wrong name');
    assert(sy.symbol() == "SY", 'Wrong symbol');
    assert(sy.decimals() == 18, 'Wrong decimals');
    assert(sy.total_supply() == 0, 'Wrong initial supply');
    assert(sy.exchange_rate() == WAD, 'Wrong exchange rate');
    assert(sy.underlying_asset() == underlying.contract_address, 'Wrong underlying');
}

#[test]
fn test_sy_constructor_custom_exchange_rate() {
    let underlying = deploy_mock_yield_token();
    let custom_rate = 2 * WAD; // 2:1 exchange rate
    let sy = deploy_sy(underlying.contract_address, custom_rate);

    assert(sy.exchange_rate() == custom_rate, 'Wrong custom exchange rate');
}

// ============ ERC20 Tests ============

#[test]
fn test_sy_transfer() {
    let (underlying, sy) = setup();
    let user = user1();
    let recipient = user2();
    let amount = 100 * WAD;

    // Mint underlying to user and approve SY
    underlying.mint(user, amount);
    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

    // Deposit to get SY tokens
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
    let (underlying, sy) = setup();
    let owner = user1();
    let spender = user2();
    let amount = 100 * WAD;

    // Setup: mint underlying, approve, deposit
    underlying.mint(owner, amount);
    start_cheat_caller_address(underlying.contract_address, owner);
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

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
    let (underlying, sy) = setup();
    let user = user1();
    let deposit_amount = 100 * WAD;

    // Mint underlying to user
    underlying.mint(user, deposit_amount);
    assert(underlying.balance_of(user) == deposit_amount, 'Mint failed');

    // Approve SY contract to spend underlying
    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, deposit_amount);
    stop_cheat_caller_address(underlying.contract_address);

    // Deposit underlying to get SY
    start_cheat_caller_address(sy.contract_address, user);
    let sy_minted = sy.deposit(user, deposit_amount);
    stop_cheat_caller_address(sy.contract_address);

    // With 1:1 exchange rate, should get equal amount of SY
    assert(sy_minted == deposit_amount, 'Wrong SY minted');
    assert(sy.balance_of(user) == deposit_amount, 'Wrong SY balance');
    assert(sy.total_supply() == deposit_amount, 'Wrong total supply');
    assert(underlying.balance_of(user) == 0, 'Underlying not transferred');
}

#[test]
fn test_sy_deposit_with_exchange_rate() {
    let underlying = deploy_mock_yield_token();
    let exchange_rate = 2 * WAD; // 1 SY = 2 underlying
    let sy = deploy_sy(underlying.contract_address, exchange_rate);
    let user = user1();
    let deposit_amount = 100 * WAD;

    // Mint and approve
    underlying.mint(user, deposit_amount);
    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, deposit_amount);
    stop_cheat_caller_address(underlying.contract_address);

    // Deposit
    start_cheat_caller_address(sy.contract_address, user);
    let sy_minted = sy.deposit(user, deposit_amount);
    stop_cheat_caller_address(sy.contract_address);

    // With 2:1 exchange rate, 100 underlying = 50 SY
    assert(sy_minted == 50 * WAD, 'Wrong SY for 2:1 rate');
    assert(sy.balance_of(user) == 50 * WAD, 'Wrong balance for 2:1');
}

#[test]
fn test_sy_deposit_to_different_receiver() {
    let (underlying, sy) = setup();
    let depositor = user1();
    let receiver = user2();
    let deposit_amount = 100 * WAD;

    underlying.mint(depositor, deposit_amount);
    start_cheat_caller_address(underlying.contract_address, depositor);
    underlying.approve(sy.contract_address, deposit_amount);
    stop_cheat_caller_address(underlying.contract_address);

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
    let (_, sy) = setup();
    let user = user1();

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, 0);
}

#[test]
#[should_panic(expected: 'YT: zero address')]
fn test_sy_deposit_zero_receiver() {
    let (underlying, sy) = setup();
    let user = user1();

    underlying.mint(user, WAD);
    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, WAD);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(zero_address(), WAD);
}

// ============ Redeem Tests ============

#[test]
fn test_sy_redeem_1_to_1() {
    let (underlying, sy) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Setup: deposit first
    underlying.mint(user, amount);
    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount);

    // Redeem SY for underlying
    let underlying_received = sy.redeem(user, amount);
    stop_cheat_caller_address(sy.contract_address);

    // With 1:1 exchange rate, should get equal amount back
    assert(underlying_received == amount, 'Wrong underlying received');
    assert(sy.balance_of(user) == 0, 'SY should be burned');
    assert(sy.total_supply() == 0, 'Total supply should be 0');
    assert(underlying.balance_of(user) == amount, 'Should have underlying back');
}

#[test]
fn test_sy_redeem_with_exchange_rate() {
    let underlying = deploy_mock_yield_token();
    let exchange_rate = 2 * WAD; // 1 SY = 2 underlying
    let sy = deploy_sy(underlying.contract_address, exchange_rate);
    let user = user1();
    let deposit_amount = 100 * WAD;

    // Setup: deposit
    underlying.mint(user, deposit_amount);
    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, deposit_amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    let sy_minted = sy.deposit(user, deposit_amount); // 50 SY

    // Redeem all SY
    let underlying_received = sy.redeem(user, sy_minted);
    stop_cheat_caller_address(sy.contract_address);

    // With 2:1 exchange rate, 50 SY = 100 underlying
    assert(underlying_received == deposit_amount, 'Wrong redeem amount');
}

#[test]
fn test_sy_redeem_to_different_receiver() {
    let (underlying, sy) = setup();
    let redeemer = user1();
    let receiver = user2();
    let amount = 100 * WAD;

    // Setup: deposit
    underlying.mint(redeemer, amount);
    start_cheat_caller_address(underlying.contract_address, redeemer);
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, redeemer);
    sy.deposit(redeemer, amount);

    // Redeem but send underlying to different receiver
    sy.redeem(receiver, amount);
    stop_cheat_caller_address(sy.contract_address);

    assert(underlying.balance_of(redeemer) == 0, 'Redeemer should have 0');
    assert(underlying.balance_of(receiver) == amount, 'Receiver should have underlying');
}

#[test]
#[should_panic(expected: 'SY: zero redeem')]
fn test_sy_redeem_zero() {
    let (underlying, sy) = setup();
    let user = user1();

    // Need some SY first
    underlying.mint(user, WAD);
    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, WAD);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, WAD);
    sy.redeem(user, 0);
}

#[test]
#[should_panic(expected: 'YT: zero address')]
fn test_sy_redeem_zero_receiver() {
    let (underlying, sy) = setup();
    let user = user1();

    underlying.mint(user, WAD);
    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, WAD);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, WAD);
    sy.redeem(zero_address(), WAD);
}

#[test]
#[should_panic(expected: 'ERC20: insufficient balance')]
fn test_sy_redeem_insufficient_balance() {
    let (underlying, sy) = setup();
    let user = user1();

    underlying.mint(user, WAD);
    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, WAD);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, WAD);
    // Try to redeem more than balance
    sy.redeem(user, 2 * WAD);
}

// ============ Partial Deposit/Redeem Tests ============

#[test]
fn test_sy_partial_redeem() {
    let (underlying, sy) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // Setup: deposit
    underlying.mint(user, amount);
    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount);

    // Redeem only half
    sy.redeem(user, amount / 2);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy.balance_of(user) == amount / 2, 'Wrong remaining SY');
    assert(underlying.balance_of(user) == amount / 2, 'Wrong underlying balance');
}

#[test]
fn test_sy_multiple_deposits() {
    let (underlying, sy) = setup();
    let user = user1();
    let amount = 100 * WAD;

    // First deposit
    underlying.mint(user, amount);
    start_cheat_caller_address(underlying.contract_address, user);
    underlying.approve(sy.contract_address, amount);
    stop_cheat_caller_address(underlying.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    sy.deposit(user, amount / 2);
    assert(sy.balance_of(user) == amount / 2, 'Wrong balance after 1st');

    // Second deposit
    sy.deposit(user, amount / 2);
    stop_cheat_caller_address(sy.contract_address);

    assert(sy.balance_of(user) == amount, 'Wrong balance after 2nd');
    assert(sy.total_supply() == amount, 'Wrong total supply');
}
