use horizon::mocks::mock_pragma::{
    AggregationMode, DataType, IMockPragmaSummaryStatsDispatcher,
    IMockPragmaSummaryStatsDispatcherTrait, SSTRK_USD_PAIR_ID, WSTETH_USD_PAIR_ID,
};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp_global,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ContractAddress, SyscallResultTrait};

fn ADMIN() -> ContractAddress {
    'ADMIN'.try_into().unwrap()
}

/// Deploy the mock pragma contract with default test values
fn deploy_mock_pragma() -> IMockPragmaSummaryStatsDispatcher {
    let contract = declare("MockPragmaSummaryStats").unwrap_syscall().contract_class();

    // Default test values:
    // WSTETH: $4000 base price, 4% APR
    // SSTRK: $0.50 base price, 8% APR
    // STRK: $0.50 base price, 0% APR (base token)
    let wsteth_base_price: u128 = 400000000000; // $4000 with 8 decimals
    let sstrk_base_price: u128 = 50000000; // $0.50 with 8 decimals
    let strk_base_price: u128 = 50000000; // $0.50 with 8 decimals
    let wsteth_yield_bps: u32 = 400; // 4% APR
    let sstrk_yield_bps: u32 = 800; // 8% APR

    let mut calldata: Array<felt252> = array![];
    ADMIN().serialize(ref calldata);
    wsteth_base_price.serialize(ref calldata);
    sstrk_base_price.serialize(ref calldata);
    strk_base_price.serialize(ref calldata);
    wsteth_yield_bps.serialize(ref calldata);
    sstrk_yield_bps.serialize(ref calldata);

    let (contract_address, _) = contract.deploy(@calldata).unwrap_syscall();
    IMockPragmaSummaryStatsDispatcher { contract_address }
}

#[test]
fn test_initial_prices() {
    let pragma = deploy_mock_pragma();

    // Check base prices are set correctly
    let wsteth_price = pragma.get_base_price(WSTETH_USD_PAIR_ID);
    let sstrk_price = pragma.get_base_price(SSTRK_USD_PAIR_ID);

    assert(wsteth_price == 400000000000, 'wrong wsteth base price');
    assert(sstrk_price == 50000000, 'wrong sstrk base price');
}

#[test]
fn test_initial_yield_rates() {
    let pragma = deploy_mock_pragma();

    // Check yield rates are set correctly
    let wsteth_rate = pragma.get_annual_yield_rate_bps(WSTETH_USD_PAIR_ID);
    let sstrk_rate = pragma.get_annual_yield_rate_bps(SSTRK_USD_PAIR_ID);

    assert(wsteth_rate == 400, 'wrong wsteth yield rate');
    assert(sstrk_rate == 800, 'wrong sstrk yield rate');
}

#[test]
fn test_twap_at_deployment() {
    let pragma = deploy_mock_pragma();

    // At deployment time (no time elapsed), TWAP should equal base price
    let data_type = DataType::SpotEntry(SSTRK_USD_PAIR_ID);
    let aggregation_mode = AggregationMode::Median;

    // Query TWAP for a 1-hour window starting at deployment
    let deployment_ts = pragma.get_deployment_timestamp();
    let (twap, decimals) = pragma.calculate_twap(data_type, aggregation_mode, 3600, deployment_ts);

    assert(decimals == 8, 'wrong decimals');
    // At deployment, the TWAP should be close to base price
    // With midpoint at deployment_ts + 1800 seconds, yield should be minimal
    assert(twap >= 50000000, 'twap too low');
    assert(twap < 50001000, 'twap too high'); // Allow small yield accrual
}

#[test]
fn test_twap_increases_over_time() {
    let pragma = deploy_mock_pragma();

    let data_type = DataType::SpotEntry(SSTRK_USD_PAIR_ID);
    let aggregation_mode = AggregationMode::Median;
    let deployment_ts = pragma.get_deployment_timestamp();

    // Advance time by 6 months (15768000 seconds)
    let six_months_later = deployment_ts + 15768000;
    start_cheat_block_timestamp_global(six_months_later);

    let (twap, decimals) = pragma.calculate_twap(data_type, aggregation_mode, 3600, 0);

    // Expected: base_price * (1 + 8% * 0.5) = 50000000 * 1.04 = 52000000
    // Yield accrual = base * rate * time / (10000 * year)
    // = 50000000 * 800 * 15768000 / (10000 * 31536000)
    // = 2000000
    // So TWAP should be ~52000000

    assert(decimals == 8, 'wrong decimals');
    assert(twap > 50000000, 'twap should increase');
    // Allow some tolerance for the calculation
    assert(twap >= 51900000, 'twap too low after 6mo');
    assert(twap <= 52100000, 'twap too high after 6mo');
}

#[test]
fn test_twap_one_year_full_yield() {
    let pragma = deploy_mock_pragma();

    let data_type = DataType::SpotEntry(SSTRK_USD_PAIR_ID);
    let aggregation_mode = AggregationMode::Median;
    let deployment_ts = pragma.get_deployment_timestamp();

    // Advance time by 1 year (31536000 seconds)
    let one_year_later = deployment_ts + 31536000;
    start_cheat_block_timestamp_global(one_year_later);

    let (twap, _) = pragma.calculate_twap(data_type, aggregation_mode, 3600, 0);

    // Expected: base_price * (1 + 8%) = 50000000 * 1.08 = 54000000
    assert(twap >= 53900000, 'twap too low after 1yr');
    assert(twap <= 54100000, 'twap too high after 1yr');
}

#[test]
fn test_wsteth_yield_accrual() {
    let pragma = deploy_mock_pragma();

    let data_type = DataType::SpotEntry(WSTETH_USD_PAIR_ID);
    let aggregation_mode = AggregationMode::Median;
    let deployment_ts = pragma.get_deployment_timestamp();

    // Advance time by 1 year (31536000 seconds)
    let one_year_later = deployment_ts + 31536000;
    start_cheat_block_timestamp_global(one_year_later);

    let (twap, decimals) = pragma.calculate_twap(data_type, aggregation_mode, 3600, 0);

    // Expected: $4000 * (1 + 4%) = $4160 = 416000000000 with 8 decimals
    assert(decimals == 8, 'wrong decimals');
    assert(twap >= 415900000000, 'wsteth twap too low');
    assert(twap <= 416100000000, 'wsteth twap too high');
}

#[test]
fn test_admin_can_set_base_price() {
    let pragma = deploy_mock_pragma();

    // Set a new base price for SSTRK
    start_cheat_caller_address(pragma.contract_address, ADMIN());

    pragma.set_base_price(SSTRK_USD_PAIR_ID, 100000000); // $1.00

    let new_price = pragma.get_base_price(SSTRK_USD_PAIR_ID);
    assert(new_price == 100000000, 'price not updated');

    stop_cheat_caller_address(pragma.contract_address);
}

#[test]
fn test_admin_can_set_yield_rate() {
    let pragma = deploy_mock_pragma();

    start_cheat_caller_address(pragma.contract_address, ADMIN());

    pragma.set_annual_yield_rate_bps(SSTRK_USD_PAIR_ID, 1000); // 10% APR

    let new_rate = pragma.get_annual_yield_rate_bps(SSTRK_USD_PAIR_ID);
    assert(new_rate == 1000, 'rate not updated');

    stop_cheat_caller_address(pragma.contract_address);
}

#[test]
#[should_panic(expected: 'MPSS: not admin')]
fn test_non_admin_cannot_set_price() {
    let pragma = deploy_mock_pragma();

    // Try to set price as non-admin
    let non_admin: ContractAddress = 'NON_ADMIN'.try_into().unwrap();
    start_cheat_caller_address(pragma.contract_address, non_admin);

    pragma.set_base_price(SSTRK_USD_PAIR_ID, 100000000);
}

#[test]
#[should_panic(expected: 'MPSS: unknown pair')]
fn test_unknown_pair_fails() {
    let pragma = deploy_mock_pragma();

    let unknown_pair: felt252 = 'UNKNOWN/USD';
    let data_type = DataType::SpotEntry(unknown_pair);
    let aggregation_mode = AggregationMode::Median;

    pragma.calculate_twap(data_type, aggregation_mode, 3600, 0);
}

#[test]
fn test_future_entry_data_type() {
    let pragma = deploy_mock_pragma();

    // Test that FutureEntry also works (extracts pair_id correctly)
    let data_type = DataType::FutureEntry((SSTRK_USD_PAIR_ID, 0));
    let aggregation_mode = AggregationMode::Median;
    let deployment_ts = pragma.get_deployment_timestamp();

    let (twap, decimals) = pragma.calculate_twap(data_type, aggregation_mode, 3600, deployment_ts);

    assert(decimals == 8, 'wrong decimals');
    assert(twap >= 50000000, 'twap too low');
}

#[test]
fn test_zero_yield_rate() {
    let pragma = deploy_mock_pragma();

    // Set yield rate to 0
    start_cheat_caller_address(pragma.contract_address, ADMIN());
    pragma.set_annual_yield_rate_bps(SSTRK_USD_PAIR_ID, 0);
    stop_cheat_caller_address(pragma.contract_address);

    let data_type = DataType::SpotEntry(SSTRK_USD_PAIR_ID);
    let aggregation_mode = AggregationMode::Median;
    let deployment_ts = pragma.get_deployment_timestamp();

    // Even 1 year later, price should stay at base
    let start_time = deployment_ts + 31536000;
    let (twap, _) = pragma.calculate_twap(data_type, aggregation_mode, 3600, start_time);

    // With 0% yield, TWAP should equal base price
    assert(twap == 50000000, 'twap should equal base');
}
