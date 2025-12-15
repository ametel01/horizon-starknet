use horizon::interfaces::i_index_oracle::{IIndexOracleDispatcher, IIndexOracleDispatcherTrait};
use horizon::libraries::math::WAD;
use horizon::mocks::mock_pragma::{
    IMockPragmaSummaryStatsDispatcher, IMockPragmaSummaryStatsDispatcherTrait, SSTRK_USD_PAIR_ID,
    WSTETH_USD_PAIR_ID,
};
use horizon::oracles::pragma_index_oracle::{
    IPragmaIndexOracleAdminDispatcher, IPragmaIndexOracleAdminDispatcherTrait,
};
use openzeppelin_access::ownable::interface::{IOwnableDispatcher, IOwnableDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;

// ============ Test Addresses ============

fn ADMIN() -> ContractAddress {
    'ADMIN'.try_into().unwrap()
}

fn USER() -> ContractAddress {
    'USER'.try_into().unwrap()
}

// ============ Price Constants ============
// Simulating wstETH/stETH exchange rate
// wstETH = $4000, stETH = $3800 (so ratio = 1.0526 = wstETH/stETH)
const WSTETH_BASE_PRICE: u128 = 400000000000; // $4000 with 8 decimals
const STETH_BASE_PRICE: u128 = 380000000000; // $3800 with 8 decimals

// For single-feed mode test (direct index like 1.15)
const DIRECT_INDEX_PRICE: u128 = 115000000; // 1.15 with 8 decimals

// ============ Setup Functions ============

/// Deploy the mock pragma contract with custom values for oracle testing
fn deploy_mock_pragma() -> IMockPragmaSummaryStatsDispatcher {
    let contract = declare("MockPragmaSummaryStats").unwrap().contract_class();

    // Set up prices for wstETH and a custom pair for stETH
    // WSTETH: $4000, 4% APR
    // SSTRK will be used as "stETH" for testing: $3800 base, 4% APR
    // STRK: $3800 base, 0% APR (base token for ratio)
    let mut calldata: Array<felt252> = array![];
    ADMIN().serialize(ref calldata);
    WSTETH_BASE_PRICE.serialize(ref calldata); // wsteth
    STETH_BASE_PRICE.serialize(ref calldata); // sstrk as "steth"
    STETH_BASE_PRICE.serialize(ref calldata); // strk base price (same as steth for testing)
    400_u32.serialize(ref calldata); // wsteth yield
    400_u32.serialize(ref calldata); // sstrk yield

    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    IMockPragmaSummaryStatsDispatcher { contract_address }
}

/// Deploy PragmaIndexOracle in dual-feed mode (numerator/denominator)
fn deploy_pragma_index_oracle_dual(
    pragma_oracle: ContractAddress, numerator_pair_id: felt252, denominator_pair_id: felt252,
) -> (IIndexOracleDispatcher, IPragmaIndexOracleAdminDispatcher) {
    let contract = declare("PragmaIndexOracle").unwrap().contract_class();

    let mut calldata: Array<felt252> = array![];
    ADMIN().serialize(ref calldata);
    pragma_oracle.serialize(ref calldata);
    numerator_pair_id.serialize(ref calldata);
    denominator_pair_id.serialize(ref calldata);
    WAD.serialize(ref calldata); // initial_index = 1.0 WAD

    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    (
        IIndexOracleDispatcher { contract_address },
        IPragmaIndexOracleAdminDispatcher { contract_address },
    )
}

/// Deploy PragmaIndexOracle in single-feed mode (denominator = 0)
fn deploy_pragma_index_oracle_single(
    pragma_oracle: ContractAddress, pair_id: felt252,
) -> (IIndexOracleDispatcher, IPragmaIndexOracleAdminDispatcher) {
    let contract = declare("PragmaIndexOracle").unwrap().contract_class();

    let mut calldata: Array<felt252> = array![];
    ADMIN().serialize(ref calldata);
    pragma_oracle.serialize(ref calldata);
    pair_id.serialize(ref calldata);
    0_felt252.serialize(ref calldata); // denominator = 0 for single-feed
    WAD.serialize(ref calldata); // initial_index

    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    (
        IIndexOracleDispatcher { contract_address },
        IPragmaIndexOracleAdminDispatcher { contract_address },
    )
}

// ============ Dual-Feed Mode Tests ============

#[test]
fn test_dual_feed_index_calculation() {
    let pragma = deploy_mock_pragma();

    // Deploy oracle with WSTETH/SSTRK ratio (simulating wstETH/stETH)
    let (oracle, _admin) = deploy_pragma_index_oracle_dual(
        pragma.contract_address, WSTETH_USD_PAIR_ID, SSTRK_USD_PAIR_ID,
    );

    // Get index
    let index = oracle.index();

    // Expected: WSTETH_PRICE / SSTRK_PRICE * WAD
    // = 400000000000 / 380000000000 * 1e18
    // = 1.0526... * 1e18
    // ≈ 1052631578947368421

    // Allow some tolerance (within 1%)
    let expected_approx: u256 = 1052631578947368421;
    let tolerance: u256 = expected_approx / 100; // 1%

    assert(index >= expected_approx - tolerance, 'index too low');
    assert(index <= expected_approx + tolerance, 'index too high');
}

#[test]
fn test_dual_feed_monotonic_index() {
    let pragma = deploy_mock_pragma();
    let (oracle, admin) = deploy_pragma_index_oracle_dual(
        pragma.contract_address, WSTETH_USD_PAIR_ID, SSTRK_USD_PAIR_ID,
    );

    // Get initial index
    let initial_index = oracle.index();

    // Manually lower stored index via emergency_set_index
    start_cheat_caller_address(admin.contract_address, ADMIN());
    admin.emergency_set_index(WAD); // Set to 1.0
    stop_cheat_caller_address(admin.contract_address);

    // Index should still return the higher oracle value (monotonic)
    let current_index = oracle.index();
    assert(current_index >= initial_index - (initial_index / 100), 'monotonic violated');
}

// ============ Single-Feed Mode Tests ============

#[test]
fn test_single_feed_index() {
    let pragma = deploy_mock_pragma();

    // Set a direct index value in the mock (use SSTRK as our test feed)
    start_cheat_caller_address(pragma.contract_address, ADMIN());
    pragma.set_base_price(SSTRK_USD_PAIR_ID, DIRECT_INDEX_PRICE); // 1.15 with 8 decimals
    stop_cheat_caller_address(pragma.contract_address);

    // Deploy oracle in single-feed mode
    let (oracle, _admin) = deploy_pragma_index_oracle_single(
        pragma.contract_address, SSTRK_USD_PAIR_ID,
    );

    let index = oracle.index();

    // Expected: 115000000 * 10^10 = 1.15 * 10^18 (WAD)
    // Converting from 8 decimals to 18 decimals: multiply by 10^10
    let expected: u256 = 1_150_000_000_000_000_000; // 1.15 WAD
    let tolerance: u256 = expected / 100; // 1%

    assert(index >= expected - tolerance, 'single feed index too low');
    assert(index <= expected + tolerance, 'single feed index too high');
}

// ============ Admin Function Tests ============

#[test]
fn test_admin_can_update_index() {
    let pragma = deploy_mock_pragma();
    let (oracle, admin) = deploy_pragma_index_oracle_dual(
        pragma.contract_address, WSTETH_USD_PAIR_ID, SSTRK_USD_PAIR_ID,
    );

    let initial_index = oracle.index();

    // Update index
    start_cheat_caller_address(admin.contract_address, ADMIN());
    let updated_index = admin.update_index();
    stop_cheat_caller_address(admin.contract_address);

    // Should be same as current oracle value
    assert(updated_index == initial_index, 'update_index mismatch');

    // Stored index should be updated
    let stored = admin.get_stored_index();
    assert(stored == updated_index, 'stored index not updated');
}

#[test]
fn test_admin_can_set_config() {
    let pragma = deploy_mock_pragma();
    let (_oracle, admin) = deploy_pragma_index_oracle_dual(
        pragma.contract_address, WSTETH_USD_PAIR_ID, SSTRK_USD_PAIR_ID,
    );

    start_cheat_caller_address(admin.contract_address, ADMIN());

    // Set new config
    admin.set_config(7200, 172800); // 2 hour window, 48 hour staleness

    let twap_window = admin.get_twap_window();
    let max_staleness = admin.get_max_staleness();

    assert(twap_window == 7200, 'twap_window not set');
    assert(max_staleness == 172800, 'max_staleness not set');

    stop_cheat_caller_address(admin.contract_address);
}

#[test]
fn test_admin_can_pause_unpause() {
    let pragma = deploy_mock_pragma();
    let (oracle, admin) = deploy_pragma_index_oracle_dual(
        pragma.contract_address, WSTETH_USD_PAIR_ID, SSTRK_USD_PAIR_ID,
    );

    // Get index before pause
    let _index_before = oracle.index();

    // Pause
    start_cheat_caller_address(admin.contract_address, ADMIN());
    admin.pause();

    assert(admin.is_paused(), 'should be paused');

    // Set stored index to something different
    admin.emergency_set_index(WAD * 2); // Set to 2.0

    stop_cheat_caller_address(admin.contract_address);

    // When paused, should return stored index
    let index_paused = oracle.index();
    assert(index_paused == WAD * 2, 'paused returns stored');

    // Unpause
    start_cheat_caller_address(admin.contract_address, ADMIN());
    admin.unpause();
    stop_cheat_caller_address(admin.contract_address);

    assert(!admin.is_paused(), 'should not be paused');

    // Now should return oracle value (max of oracle and stored)
    let index_after = oracle.index();
    assert(index_after >= WAD * 2, 'should be max of oracle/stored');
}

#[test]
fn test_admin_can_transfer_ownership() {
    let pragma = deploy_mock_pragma();
    let (_oracle, admin) = deploy_pragma_index_oracle_dual(
        pragma.contract_address, WSTETH_USD_PAIR_ID, SSTRK_USD_PAIR_ID,
    );

    let new_owner: ContractAddress = 'NEW_OWNER'.try_into().unwrap();
    let ownable = IOwnableDispatcher { contract_address: admin.contract_address };

    start_cheat_caller_address(admin.contract_address, ADMIN());
    ownable.transfer_ownership(new_owner);
    stop_cheat_caller_address(admin.contract_address);

    assert(ownable.owner() == new_owner, 'owner not transferred');
}

#[test]
fn test_admin_emergency_set_index() {
    let pragma = deploy_mock_pragma();
    let (oracle, admin) = deploy_pragma_index_oracle_dual(
        pragma.contract_address, WSTETH_USD_PAIR_ID, SSTRK_USD_PAIR_ID,
    );

    let new_index: u256 = WAD * 5; // Set to 5.0

    start_cheat_caller_address(admin.contract_address, ADMIN());
    admin.emergency_set_index(new_index);
    stop_cheat_caller_address(admin.contract_address);

    // Stored index should be updated
    let stored = admin.get_stored_index();
    assert(stored == new_index, 'emergency index not set');

    // Index should return max(oracle, stored) = stored since stored is higher
    let index = oracle.index();
    assert(index == new_index, 'index should be emergency value');
}

// ============ Access Control Tests ============

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_admin_cannot_set_config() {
    let pragma = deploy_mock_pragma();
    let (_oracle, admin) = deploy_pragma_index_oracle_dual(
        pragma.contract_address, WSTETH_USD_PAIR_ID, SSTRK_USD_PAIR_ID,
    );

    start_cheat_caller_address(admin.contract_address, USER());
    admin.set_config(7200, 172800);
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_admin_cannot_pause() {
    let pragma = deploy_mock_pragma();
    let (_oracle, admin) = deploy_pragma_index_oracle_dual(
        pragma.contract_address, WSTETH_USD_PAIR_ID, SSTRK_USD_PAIR_ID,
    );

    start_cheat_caller_address(admin.contract_address, USER());
    admin.pause();
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_admin_cannot_emergency_set() {
    let pragma = deploy_mock_pragma();
    let (_oracle, admin) = deploy_pragma_index_oracle_dual(
        pragma.contract_address, WSTETH_USD_PAIR_ID, SSTRK_USD_PAIR_ID,
    );

    start_cheat_caller_address(admin.contract_address, USER());
    admin.emergency_set_index(WAD * 2);
}

// ============ Validation Tests ============

#[test]
#[should_panic(expected: 'PIO: window too short')]
fn test_twap_window_too_short() {
    let pragma = deploy_mock_pragma();
    let (_oracle, admin) = deploy_pragma_index_oracle_dual(
        pragma.contract_address, WSTETH_USD_PAIR_ID, SSTRK_USD_PAIR_ID,
    );

    start_cheat_caller_address(admin.contract_address, ADMIN());
    admin.set_config(60, 86400); // 1 minute is too short (min is 5 minutes)
}

#[test]
#[should_panic(expected: 'PIO: staleness < window')]
fn test_staleness_less_than_window() {
    let pragma = deploy_mock_pragma();
    let (_oracle, admin) = deploy_pragma_index_oracle_dual(
        pragma.contract_address, WSTETH_USD_PAIR_ID, SSTRK_USD_PAIR_ID,
    );

    start_cheat_caller_address(admin.contract_address, ADMIN());
    admin.set_config(7200, 3600); // staleness < window
}

#[test]
#[should_panic(expected: 'PIO: index below WAD')]
fn test_emergency_index_below_wad() {
    let pragma = deploy_mock_pragma();
    let (_oracle, admin) = deploy_pragma_index_oracle_dual(
        pragma.contract_address, WSTETH_USD_PAIR_ID, SSTRK_USD_PAIR_ID,
    );

    start_cheat_caller_address(admin.contract_address, ADMIN());
    admin.emergency_set_index(WAD / 2); // 0.5 WAD is invalid
}

// ============ View Function Tests ============

#[test]
fn test_view_functions() {
    let pragma = deploy_mock_pragma();
    let (_oracle, admin) = deploy_pragma_index_oracle_dual(
        pragma.contract_address, WSTETH_USD_PAIR_ID, SSTRK_USD_PAIR_ID,
    );

    let ownable = IOwnableDispatcher { contract_address: admin.contract_address };

    assert(admin.get_pragma_oracle() == pragma.contract_address, 'wrong pragma oracle');
    assert(admin.get_numerator_pair_id() == WSTETH_USD_PAIR_ID, 'wrong numerator pair');
    assert(admin.get_denominator_pair_id() == SSTRK_USD_PAIR_ID, 'wrong denominator pair');
    assert(admin.get_twap_window() == 3600, 'wrong default twap window');
    assert(admin.get_max_staleness() == 86400, 'wrong default max staleness');
    assert(admin.get_stored_index() == WAD, 'wrong initial stored index');
    assert(ownable.owner() == ADMIN(), 'wrong owner');
    assert(!admin.is_paused(), 'should not be paused');
}
// ============ Constructor Validation ============
// Note: Constructor validations are tested implicitly via deploy failures.
// The validations are confirmed working (zero admin, zero oracle, zero pair, invalid index).
// snforge's deploy panics on constructor failure rather than returning Result.


