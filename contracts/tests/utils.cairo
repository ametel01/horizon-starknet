use horizon::interfaces::i_sy::{AssetType, ISYDispatcher, ISYDispatcherTrait};
use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
use horizon::mocks::mock_erc20::IMockERC20Dispatcher;
use horizon::mocks::mock_yield_token::{IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_number_global,
    start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ClassHash, ContractAddress, SyscallResultTrait};

// ============ Test Addresses ============

pub fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}

pub fn user1() -> ContractAddress {
    'user1'.try_into().unwrap()
}

pub fn user2() -> ContractAddress {
    'user2'.try_into().unwrap()
}

pub fn alice() -> ContractAddress {
    'alice'.try_into().unwrap()
}

pub fn bob() -> ContractAddress {
    'bob'.try_into().unwrap()
}

pub fn treasury() -> ContractAddress {
    'treasury'.try_into().unwrap()
}

pub fn zero_address() -> ContractAddress {
    0.try_into().unwrap()
}

// ============ Time Constants ============

pub const CURRENT_TIME: u64 = 1000000;
pub const ONE_YEAR: u64 = 365 * 86400;
pub const ONE_MONTH: u64 = 30 * 86400;
pub const ONE_DAY: u64 = 86400;

/// Default deadline for router operations in tests (far future - effectively no deadline)
pub const DEFAULT_DEADLINE: u64 = 0xFFFFFFFFFFFFFFFF; // u64::MAX

// ============ ByteArray Helper ============

pub fn append_bytearray(ref calldata: Array<felt252>, value: felt252, len: u32) {
    calldata.append(0); // data array length
    calldata.append(value); // pending_word
    calldata.append(len.into()); // pending_word_len
}

// ============ Contract Deployment ============

/// Deploy mock ERC20 (base asset like USDC/ETH)
pub fn deploy_mock_erc20() -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'Mock USDC', 9);
    append_bytearray(ref calldata, 'USDC', 4);

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMockERC20Dispatcher { contract_address }
}

/// Deploy mock yield token (yield-bearing asset like wstETH/aUSDC)
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

/// Deploy mock yield token with default admin
pub fn deploy_mock_yield_token_default() -> (IMockERC20Dispatcher, IMockYieldTokenDispatcher) {
    let base_asset = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(base_asset.contract_address, admin());
    (base_asset, yield_token)
}

/// Deploy SY token with default single-token support (underlying for both in/out)
/// For native yield tokens, underlying == index_oracle (same address)
/// For bridged tokens, index_oracle would be a separate oracle contract
/// @param is_erc4626 Whether the index_oracle is an ERC-4626 vault
/// Defaults to AssetType::Token
pub fn deploy_sy(
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

/// Deploy SY token with explicit tokens_in and tokens_out
pub fn deploy_sy_with_tokens(
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

/// Get PT class hash for YT deployment
pub fn get_pt_class_hash() -> ClassHash {
    let contract = declare("PT").unwrap_syscall().contract_class();
    *contract.class_hash
}

/// Deploy YT token (which also deploys PT)
pub fn deploy_yt(sy: ContractAddress, pt_class_hash: ClassHash, expiry: u64) -> IYTDispatcher {
    start_cheat_block_timestamp_global(CURRENT_TIME);

    let contract = declare("YT").unwrap_syscall().contract_class();
    let mut calldata = array![];
    append_bytearray(ref calldata, 'YT Token', 8);
    append_bytearray(ref calldata, 'YT', 2);
    calldata.append(sy.into());
    calldata.append(pt_class_hash.into());
    calldata.append(expiry.into());
    calldata.append(admin().into()); // pauser
    calldata.append(treasury().into()); // treasury for post-expiry yield

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IYTDispatcher { contract_address }
}

// ============ Full Setup Functions ============

/// Deploy full stack: MockERC20 -> MockYieldToken -> SY
/// MockYieldToken serves as both underlying AND index oracle (same address)
/// Uses ERC-4626 mode since MockYieldToken implements the full ERC-4626 interface
pub fn setup_sy() -> (IMockERC20Dispatcher, IMockYieldTokenDispatcher, ISYDispatcher) {
    // Set timestamp before deploying MockYieldToken so it records correct deployment time
    start_cheat_block_timestamp_global(CURRENT_TIME);

    let base_asset = deploy_mock_erc20();
    let yield_token = deploy_mock_yield_token(base_asset.contract_address, admin());
    // For ERC-4626 tokens, underlying == index_oracle, is_erc4626 = true
    let sy = deploy_sy(yield_token.contract_address, yield_token.contract_address, true);
    (base_asset, yield_token, sy)
}

/// Deploy full stack with YT: MockERC20 -> MockYieldToken -> SY -> YT (with PT)
pub fn setup_full() -> (
    IMockERC20Dispatcher, IMockYieldTokenDispatcher, ISYDispatcher, IYTDispatcher,
) {
    let (base_asset, yield_token, sy) = setup_sy();
    let pt_class_hash = get_pt_class_hash();
    let expiry = CURRENT_TIME + ONE_YEAR;
    let yt = deploy_yt(sy.contract_address, pt_class_hash, expiry);
    (base_asset, yield_token, sy, yt)
}

/// Deploy full stack with custom expiry
pub fn setup_full_with_expiry(
    expiry: u64,
) -> (IMockERC20Dispatcher, IMockYieldTokenDispatcher, ISYDispatcher, IYTDispatcher) {
    let (base_asset, yield_token, sy) = setup_sy();
    let pt_class_hash = get_pt_class_hash();
    let yt = deploy_yt(sy.contract_address, pt_class_hash, expiry);
    (base_asset, yield_token, sy, yt)
}

// ============ Helper Functions ============

/// Mint yield token shares to a user (admin mints shares directly)
pub fn mint_yield_token_to_user(
    yield_token: IMockYieldTokenDispatcher, user: ContractAddress, amount: u256,
) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    yield_token.mint_shares(user, amount);
    stop_cheat_caller_address(yield_token.contract_address);
}

/// Set yield token index (simulate yield accrual)
/// Disables time-based yield for precise control when manually setting index
/// Also advances block number to invalidate YT's same-block cache
pub fn set_yield_index(yield_token: IMockYieldTokenDispatcher, new_index: u256) {
    start_cheat_caller_address(yield_token.contract_address, admin());
    // Disable time-based yield for precise control when manually setting index
    yield_token.set_yield_rate_bps(0);
    yield_token.set_index(new_index);
    stop_cheat_caller_address(yield_token.contract_address);

    // Advance block number to invalidate YT's same-block cache
    // Derive unique block number from index value (1e18 -> block 1001, 1.1e18 -> block 1101, etc.)
    let block_num: u64 = (new_index / 1000000000000000).try_into().unwrap_or(1000) + 1;
    start_cheat_block_number_global(block_num);
}

/// Mint yield token and deposit to SY for a user
pub fn mint_and_deposit_sy(
    yield_token: IMockYieldTokenDispatcher, sy: ISYDispatcher, user: ContractAddress, amount: u256,
) -> u256 {
    // Mint yield token to user
    mint_yield_token_to_user(yield_token, user, amount);

    // Approve and deposit
    start_cheat_caller_address(yield_token.contract_address, user);
    yield_token.approve(sy.contract_address, amount);
    stop_cheat_caller_address(yield_token.contract_address);

    start_cheat_caller_address(sy.contract_address, user);
    // deposit(receiver, token_in, amount_shares_to_deposit, min_shares_out)
    let sy_minted = sy.deposit(user, yield_token.contract_address, amount, 0);
    stop_cheat_caller_address(sy.contract_address);

    sy_minted
}

/// Mint yield token, deposit to SY, and mint PT/YT for a user
/// Uses floating SY pattern: transfer SY to YT contract, then call mint_py
pub fn mint_and_mint_py(
    yield_token: IMockYieldTokenDispatcher,
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    user: ContractAddress,
    amount: u256,
) -> (u256, u256) {
    // Get SY first
    let sy_amount = mint_and_deposit_sy(yield_token, sy, user, amount);

    // Transfer SY to YT contract (floating SY pattern)
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, sy_amount);
    stop_cheat_caller_address(sy.contract_address);

    // Mint PT/YT using floating SY (same receiver for both)
    start_cheat_caller_address(yt.contract_address, user);
    let (pt_minted, yt_minted) = yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    (pt_minted, yt_minted)
}

/// Helper for tests: transfer SY from user to YT contract and mint PT/YT
/// This wraps the floating SY pattern for tests that already have SY balance
pub fn transfer_sy_and_mint_py(
    sy: ISYDispatcher, yt: IYTDispatcher, user: ContractAddress, amount: u256,
) -> (u256, u256) {
    // Transfer SY to YT contract (floating SY pattern)
    start_cheat_caller_address(sy.contract_address, user);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Mint PT/YT using floating SY (same receiver for both)
    start_cheat_caller_address(yt.contract_address, user);
    let (pt_minted, yt_minted) = yt.mint_py(user, user);
    stop_cheat_caller_address(yt.contract_address);

    (pt_minted, yt_minted)
}

/// Helper for tests: transfer SY from user to YT contract and mint PT/YT to a different receiver
pub fn transfer_sy_and_mint_py_to(
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    caller: ContractAddress,
    receiver: ContractAddress,
    amount: u256,
) -> (u256, u256) {
    // Transfer SY to YT contract (floating SY pattern)
    start_cheat_caller_address(sy.contract_address, caller);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Mint PT/YT using floating SY (same receiver for both)
    start_cheat_caller_address(yt.contract_address, caller);
    let (pt_minted, yt_minted) = yt.mint_py(receiver, receiver);
    stop_cheat_caller_address(yt.contract_address);

    (pt_minted, yt_minted)
}

/// Helper for tests: transfer SY and mint PT/YT to distinct receivers (Pendle-style)
pub fn transfer_sy_and_mint_py_split(
    sy: ISYDispatcher,
    yt: IYTDispatcher,
    caller: ContractAddress,
    receiver_pt: ContractAddress,
    receiver_yt: ContractAddress,
    amount: u256,
) -> (u256, u256) {
    // Transfer SY to YT contract (floating SY pattern)
    start_cheat_caller_address(sy.contract_address, caller);
    sy.transfer(yt.contract_address, amount);
    stop_cheat_caller_address(sy.contract_address);

    // Mint PT to receiver_pt, YT to receiver_yt
    start_cheat_caller_address(yt.contract_address, caller);
    let (pt_minted, yt_minted) = yt.mint_py(receiver_pt, receiver_yt);
    stop_cheat_caller_address(yt.contract_address);

    (pt_minted, yt_minted)
}
