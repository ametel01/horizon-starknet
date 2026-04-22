/// Unit tests for the TWAP Oracle Library (oracle_lib.cairo)
///
/// Tests the core ring buffer logic for TWAP calculations:
/// - initialize: Creates first observation
/// - transform: Accumulates rate over time
/// - write: Ring buffer advancement with same-block no-op
/// - grow: Pre-initializes slots for warm storage
/// - observe_single: Queries cumulative values with interpolation
/// - get_surrounding_observations: Edge case handling
/// - binary_search: Ring buffer search
///
/// Run with: snforge test test_oracle_lib

use horizon::libraries::math_fp::WAD;
use horizon::libraries::oracle_lib::{self, Observation, SurroundingObservations};

// ============================================
// HELPER FUNCTIONS
// ============================================

/// Helper to check approximate equality with tolerance
fn assert_approx_eq(actual: u256, expected: u256, tolerance: u256, msg: felt252) {
    let diff = if actual >= expected {
        actual - expected
    } else {
        expected - actual
    };
    assert(diff <= tolerance, msg);
}

/// Create a simple observation for testing
fn make_observation(timestamp: u64, cumulative: u256, initialized: bool) -> Observation {
    Observation { block_timestamp: timestamp, ln_implied_rate_cumulative: cumulative, initialized }
}

// ============================================
// INITIALIZE TESTS
// ============================================

#[test]
fn test_initialize_creates_first_observation() {
    let timestamp: u64 = 1000;
    let result = oracle_lib::initialize(timestamp);

    // Verify observation
    assert(result.observation.block_timestamp == timestamp, 'wrong timestamp');
    assert(result.observation.ln_implied_rate_cumulative == 0, 'cumulative should be 0');
    assert(result.observation.initialized == true, 'should be initialized');

    // Verify cardinality values
    assert(result.cardinality == 1, 'cardinality should be 1');
    assert(result.cardinality_next == 1, 'cardinality_next should be 1');
}

#[test]
fn test_initialize_zero_timestamp() {
    let result = oracle_lib::initialize(0);

    assert(result.observation.block_timestamp == 0, 'timestamp should be 0');
    assert(result.observation.initialized == true, 'should be initialized');
}

// ============================================
// TRANSFORM TESTS
// ============================================

#[test]
fn test_transform_accumulates_rate() {
    // Given: last observation at t=100 with cumulative=0
    let last = make_observation(100, 0, true);

    // When: transform to t=200 with rate=WAD (1.0)
    let new_obs = oracle_lib::transform(last, 200, WAD);

    // Then: cumulative = 0 + WAD * 100 = 100 * WAD
    assert(new_obs.block_timestamp == 200, 'wrong timestamp');
    assert(new_obs.ln_implied_rate_cumulative == 100 * WAD, 'wrong cumulative');
    assert(new_obs.initialized == true, 'should be initialized');
}

#[test]
fn test_transform_with_existing_cumulative() {
    // Given: observation with existing cumulative
    let last = make_observation(100, 500 * WAD, true);

    // When: transform to t=150 with rate=2*WAD
    let new_obs = oracle_lib::transform(last, 150, 2 * WAD);

    // Then: cumulative = 500*WAD + 2*WAD * 50 = 500*WAD + 100*WAD = 600*WAD
    assert(new_obs.ln_implied_rate_cumulative == 600 * WAD, 'wrong cumulative');
}

#[test]
fn test_transform_same_timestamp() {
    let last = make_observation(100, 500 * WAD, true);

    // Transform with delta=0 should not change cumulative
    let new_obs = oracle_lib::transform(last, 100, WAD);

    assert(new_obs.ln_implied_rate_cumulative == 500 * WAD, 'cumulative unchanged');
}

#[test]
fn test_transform_zero_rate() {
    let last = make_observation(100, 500 * WAD, true);

    // With zero rate, cumulative stays the same
    let new_obs = oracle_lib::transform(last, 200, 0);

    assert(new_obs.ln_implied_rate_cumulative == 500 * WAD, 'cumulative unchanged');
}

#[test]
#[should_panic(expected: 'HZN: time went backwards')]
fn test_transform_time_goes_backwards() {
    let last = make_observation(200, 0, true);

    // This should panic - time cannot go backwards
    oracle_lib::transform(last, 100, WAD);
}

// ============================================
// WRITE TESTS
// ============================================

#[test]
fn test_write_advances_index() {
    let last = make_observation(100, 0, true);
    let index: u16 = 0;
    let cardinality: u16 = 10;
    let cardinality_next: u16 = 10;

    let result = oracle_lib::write(last, index, 200, WAD, cardinality, cardinality_next);

    assert(result.index == 1, 'index should advance');
    assert(result.cardinality == cardinality, 'cardinality unchanged');
    assert(result.observation.block_timestamp == 200, 'wrong timestamp');
}

#[test]
fn test_write_same_block_no_op() {
    let last = make_observation(100, 0, true);
    let index: u16 = 5;
    let cardinality: u16 = 10;
    let cardinality_next: u16 = 10;

    // Write with same timestamp should be a no-op
    let result = oracle_lib::write(last, index, 100, WAD, cardinality, cardinality_next);

    assert(result.index == index, 'index should not change');
    assert(result.cardinality == cardinality, 'cardinality unchanged');
    assert(result.observation.block_timestamp == 100, 'observation unchanged');
}

#[test]
fn test_write_wraps_around() {
    let last = make_observation(100, 0, true);
    let index: u16 = 9; // Last slot in buffer of 10
    let cardinality: u16 = 10;
    let cardinality_next: u16 = 10;

    let result = oracle_lib::write(last, index, 200, WAD, cardinality, cardinality_next);

    // Index should wrap to 0
    assert(result.index == 0, 'index should wrap to 0');
}

#[test]
fn test_write_grows_cardinality() {
    let last = make_observation(100, 0, true);
    let index: u16 = 0; // At last slot when cardinality=1
    let cardinality: u16 = 1;
    let cardinality_next: u16 = 10; // Request growth to 10

    let result = oracle_lib::write(last, index, 200, WAD, cardinality, cardinality_next);

    // Cardinality should grow since we're at the last slot
    assert(result.cardinality == cardinality_next, 'cardinality should grow');
    assert(result.index == 1, 'index should advance');
}

#[test]
fn test_write_no_growth_not_at_last_slot() {
    let last = make_observation(100, 0, true);
    let index: u16 = 5; // Not at last slot
    let cardinality: u16 = 10;
    let cardinality_next: u16 = 20; // Would like to grow

    let result = oracle_lib::write(last, index, 200, WAD, cardinality, cardinality_next);

    // Cardinality should NOT grow since we're not at the last slot
    assert(result.cardinality == cardinality, 'cardinality unchanged');
}

#[test]
#[should_panic(expected: 'HZN: oracle zero cardinality')]
fn test_write_zero_cardinality_panics() {
    let last = make_observation(100, 0, true);

    oracle_lib::write(last, 0, 200, WAD, 0, 1);
}

// ============================================
// GROW TESTS
// ============================================

#[test]
fn test_grow_creates_slots() {
    let result = oracle_lib::grow(1, 10);

    assert(result.cardinality_next == 10, 'cardinality_next should be 10');

    // Should have 9 slots to initialize (1..10)
    assert(result.slots_to_initialize.len() == 9, 'should create 9 slots');

    // Each slot should be pre-initialized with timestamp=1, initialized=false
    let mut i: u32 = 0;
    while i < result.slots_to_initialize.len() {
        let (idx, obs) = *result.slots_to_initialize.at(i);
        assert(idx == (i + 1).try_into().unwrap(), 'wrong index');
        assert(obs.block_timestamp == 1, 'timestamp should be 1');
        assert(obs.ln_implied_rate_cumulative == 0, 'cumulative should be 0');
        assert(obs.initialized == false, 'should not be initialized');
        i += 1;
    }
}

#[test]
fn test_grow_no_op_when_not_growing() {
    let result = oracle_lib::grow(10, 5);

    // Cannot shrink - should return current value
    assert(result.cardinality_next == 10, 'should stay at 10');
    assert(result.slots_to_initialize.len() == 0, 'no slots to init');
}

#[test]
fn test_grow_same_value() {
    let result = oracle_lib::grow(10, 10);

    assert(result.cardinality_next == 10, 'should stay at 10');
    assert(result.slots_to_initialize.len() == 0, 'no slots to init');
}

#[test]
#[should_panic(expected: 'HZN: oracle zero cardinality')]
fn test_grow_zero_current_panics() {
    oracle_lib::grow(0, 10);
}

// ============================================
// GET_OLDEST_OBSERVATION_INDEX TESTS
// ============================================

#[test]
fn test_get_oldest_index_wrapped_buffer() {
    // When buffer has wrapped, oldest is at (index + 1) % cardinality
    let index: u16 = 5;
    let cardinality: u16 = 10;
    let slot_initialized = true;

    let oldest = oracle_lib::get_oldest_observation_index(index, cardinality, slot_initialized);
    assert(oldest == 6, 'oldest should be 6');
}

#[test]
fn test_get_oldest_index_unwrapped_buffer() {
    // When buffer hasn't wrapped, oldest is at slot 0
    let index: u16 = 5;
    let cardinality: u16 = 10;
    let slot_initialized = false; // Candidate slot not initialized

    let oldest = oracle_lib::get_oldest_observation_index(index, cardinality, slot_initialized);
    assert(oldest == 0, 'oldest should be 0');
}

#[test]
fn test_get_oldest_index_wraps_around() {
    // When index is at last slot, candidate wraps to 0
    let index: u16 = 9;
    let cardinality: u16 = 10;
    let slot_initialized = true;

    let oldest = oracle_lib::get_oldest_observation_index(index, cardinality, slot_initialized);
    assert(oldest == 0, 'oldest should be 0');
}

#[test]
#[should_panic(expected: 'HZN: oracle zero cardinality')]
fn test_get_oldest_index_zero_cardinality() {
    oracle_lib::get_oldest_observation_index(0, 0, false);
}

// ============================================
// GET_SURROUNDING_OBSERVATIONS TESTS
// ============================================

#[test]
fn test_get_surrounding_target_equals_newest() {
    let newest = make_observation(200, 100 * WAD, true);
    let oldest = make_observation(100, 0, true);
    let ln_rate = WAD;

    let result = oracle_lib::get_surrounding_observations(200, newest, oldest, ln_rate);

    match result {
        Option::Some(surrounding) => {
            assert(surrounding.before_or_at.block_timestamp == 200, 'before_or_at wrong');
            assert(surrounding.at_or_after.block_timestamp == 200, 'at_or_after wrong');
        },
        Option::None => panic!("should return Some"),
    }
}

#[test]
fn test_get_surrounding_target_after_newest() {
    let newest = make_observation(200, 100 * WAD, true);
    let oldest = make_observation(100, 0, true);
    let ln_rate = WAD;

    // Target after newest - transform is needed
    let result = oracle_lib::get_surrounding_observations(250, newest, oldest, ln_rate);

    match result {
        Option::Some(surrounding) => {
            assert(surrounding.before_or_at.block_timestamp == 200, 'before_or_at is newest');
            assert(surrounding.at_or_after.block_timestamp == 250, 'at_or_after is target');
            // Cumulative should be interpolated: 100*WAD + WAD*50 = 150*WAD
            assert(
                surrounding.at_or_after.ln_implied_rate_cumulative == 150 * WAD, 'wrong cumulative',
            );
        },
        Option::None => panic!("should return Some"),
    }
}

#[test]
fn test_get_surrounding_target_equals_oldest() {
    let newest = make_observation(200, 100 * WAD, true);
    let oldest = make_observation(100, 0, true);
    let ln_rate = WAD;

    let result = oracle_lib::get_surrounding_observations(100, newest, oldest, ln_rate);

    match result {
        Option::Some(surrounding) => {
            assert(surrounding.before_or_at.block_timestamp == 100, 'before_or_at is oldest');
            assert(surrounding.at_or_after.block_timestamp == 100, 'at_or_after is oldest');
        },
        Option::None => panic!("should return Some"),
    }
}

#[test]
fn test_get_surrounding_target_between_returns_none() {
    let newest = make_observation(200, 100 * WAD, true);
    let oldest = make_observation(100, 0, true);
    let ln_rate = WAD;

    // Target strictly between oldest and newest - binary search needed
    let result = oracle_lib::get_surrounding_observations(150, newest, oldest, ln_rate);

    match result {
        Option::Some(_) => panic!("should return None"),
        Option::None => () // Expected
    }
}

#[test]
#[should_panic(expected: 'HZN: oracle target too old')]
fn test_get_surrounding_target_too_old() {
    let newest = make_observation(200, 100 * WAD, true);
    let oldest = make_observation(100, 0, true);
    let ln_rate = WAD;

    let _result = oracle_lib::get_surrounding_observations(50, newest, oldest, ln_rate);
}

// ============================================
// OBSERVE_SINGLE TESTS
// ============================================

#[test]
fn test_observe_single_current_time() {
    let newest = make_observation(200, 100 * WAD, true);
    let surrounding = SurroundingObservations { before_or_at: newest, at_or_after: newest };
    let ln_rate = WAD;

    // Query current time (seconds_ago == 0)
    let cumulative = oracle_lib::observe_single(200, 200, newest, ln_rate, surrounding);

    assert(cumulative == 100 * WAD, 'should return newest cumulative');
}

#[test]
fn test_observe_single_current_time_needs_transform() {
    // Newest observation is older than current time
    let newest = make_observation(150, 50 * WAD, true);
    let surrounding = SurroundingObservations { before_or_at: newest, at_or_after: newest };
    let ln_rate = WAD;

    // Current time is 200, but newest is at 150
    let cumulative = oracle_lib::observe_single(200, 200, newest, ln_rate, surrounding);

    // Should transform: 50*WAD + WAD*50 = 100*WAD
    assert(cumulative == 100 * WAD, 'should transform to current');
}

#[test]
fn test_observe_single_exact_match_before() {
    let before = make_observation(100, 0, true);
    let after = make_observation(200, 100 * WAD, true);
    let newest = after;
    let surrounding = SurroundingObservations { before_or_at: before, at_or_after: after };
    let ln_rate = WAD;

    // Query exactly at before_or_at timestamp
    let cumulative = oracle_lib::observe_single(200, 100, newest, ln_rate, surrounding);

    assert(cumulative == 0, 'should match before_or_at');
}

#[test]
fn test_observe_single_exact_match_after() {
    let before = make_observation(100, 0, true);
    let after = make_observation(200, 100 * WAD, true);
    let newest = after;
    let surrounding = SurroundingObservations { before_or_at: before, at_or_after: after };
    let ln_rate = WAD;

    // Query exactly at at_or_after timestamp
    let cumulative = oracle_lib::observe_single(200, 200, newest, ln_rate, surrounding);

    assert(cumulative == 100 * WAD, 'should match at_or_after');
}

#[test]
fn test_observe_single_interpolation() {
    let before = make_observation(100, 0, true);
    let after = make_observation(200, 100 * WAD, true);
    let newest = after;
    let surrounding = SurroundingObservations { before_or_at: before, at_or_after: after };
    let ln_rate = WAD;

    // Query at midpoint (150)
    let cumulative = oracle_lib::observe_single(200, 150, newest, ln_rate, surrounding);

    // Linear interpolation: 0 + (100*WAD - 0) * (150-100) / (200-100) = 50*WAD
    assert(cumulative == 50 * WAD, 'should interpolate to 50*WAD');
}

#[test]
#[should_panic(expected: 'HZN: oracle target in future')]
fn test_observe_single_target_in_future() {
    let newest = make_observation(200, 100 * WAD, true);
    let surrounding = SurroundingObservations { before_or_at: newest, at_or_after: newest };
    let ln_rate = WAD;

    // Target is after current time
    oracle_lib::observe_single(200, 250, newest, ln_rate, surrounding);
}

// ============================================
// OBSERVE (BATCH) TESTS
// ============================================

#[test]
fn test_observe_multiple_queries() {
    let newest = make_observation(200, 100 * WAD, true);
    let oldest = make_observation(100, 0, true);

    // Build surrounding observations for each query
    // Query 1: seconds_ago = 100 (target = 100)
    // Query 2: seconds_ago = 0 (target = 200)
    let surrounding1 = SurroundingObservations { before_or_at: oldest, at_or_after: oldest };
    let surrounding2 = SurroundingObservations { before_or_at: newest, at_or_after: newest };

    let seconds_agos: Array<u32> = array![100, 0];
    let surrounding_obs: Array<SurroundingObservations> = array![surrounding1, surrounding2];

    let results = oracle_lib::observe(
        200, seconds_agos.span(), newest, WAD, surrounding_obs.span(),
    );

    assert(results.len() == 2, 'should return 2 results');
    assert(*results.at(0) == 0, 'first should be oldest');
    assert(*results.at(1) == 100 * WAD, 'second should be newest');
}

#[test]
fn test_observe_computes_twap() {
    // TWAP = (cumulative_now - cumulative_past) / duration
    let newest = make_observation(200, 100 * WAD, true);
    let oldest = make_observation(100, 0, true);

    let surrounding_past = SurroundingObservations { before_or_at: oldest, at_or_after: oldest };
    let surrounding_now = SurroundingObservations { before_or_at: newest, at_or_after: newest };

    let seconds_agos: Array<u32> = array![100, 0];
    let surrounding_obs: Array<SurroundingObservations> = array![surrounding_past, surrounding_now];

    let results = oracle_lib::observe(
        200, seconds_agos.span(), newest, WAD, surrounding_obs.span(),
    );

    let cumulative_past = *results.at(0);
    let cumulative_now = *results.at(1);
    let duration: u256 = 100;

    let twap = (cumulative_now - cumulative_past) / duration;

    // TWAP should be WAD since rate was constant at WAD
    assert(twap == WAD, 'TWAP should be WAD');
}

#[test]
#[should_panic(expected: 'HZN: array length mismatch')]
fn test_observe_array_mismatch() {
    let newest = make_observation(200, 100 * WAD, true);

    let seconds_agos: Array<u32> = array![100, 0];
    let surrounding_obs: Array<SurroundingObservations> = array![]; // Empty - mismatch

    oracle_lib::observe(200, seconds_agos.span(), newest, WAD, surrounding_obs.span());
}

// ============================================
// BINARY_SEARCH TESTS
// ============================================

#[test]
fn test_binary_search_finds_target() {
    // Create a ring buffer with 5 observations
    // Physical layout: [obs0, obs1, obs2, obs3, obs4]
    // Logical order (if index=4): oldest=obs0, newest=obs4
    let mut observations: Array<Observation> = array![
        make_observation(100, 0, true), // slot 0
        make_observation(110, 10 * WAD, true), // slot 1
        make_observation(120, 20 * WAD, true), // slot 2
        make_observation(130, 30 * WAD, true), // slot 3
        make_observation(140, 40 * WAD, true) // slot 4 (newest)
    ];

    let index: u16 = 4;
    let cardinality: u16 = 5;

    // Search for target=115 (between obs1 and obs2)
    let result = oracle_lib::binary_search(observations.span(), 115, index, cardinality);

    assert(result.before_or_at.block_timestamp == 110, 'before should be 110');
    assert(result.at_or_after.block_timestamp == 120, 'after should be 120');
}

#[test]
fn test_binary_search_wrapped_buffer() {
    // Ring buffer that has wrapped around
    // Index = 2 means: newest at slot 2, oldest at slot 3
    // Physical: [slot0, slot1, slot2(newest), slot3(oldest), slot4]
    let observations: Array<Observation> = array![
        make_observation(180, 80 * WAD, true), // slot 0
        make_observation(190, 90 * WAD, true), // slot 1
        make_observation(200, 100 * WAD, true), // slot 2 (newest)
        make_observation(150, 50 * WAD, true), // slot 3 (oldest after wrap)
        make_observation(160, 60 * WAD, true) // slot 4
    ];

    let index: u16 = 2; // Newest at slot 2
    let cardinality: u16 = 5;

    // Search for target=175 (between slot4[160] and slot0[180])
    let result = oracle_lib::binary_search(observations.span(), 175, index, cardinality);

    assert(result.before_or_at.block_timestamp == 160, 'before should be 160');
    assert(result.at_or_after.block_timestamp == 180, 'after should be 180');
}

#[test]
#[should_panic(expected: 'HZN: oracle zero cardinality')]
fn test_binary_search_zero_cardinality() {
    let observations: Array<Observation> = array![];

    oracle_lib::binary_search(observations.span(), 100, 0, 0);
}

#[test]
#[should_panic(expected: 'HZN: invalid obs length')]
fn test_binary_search_wrong_span_length() {
    let observations: Array<Observation> = array![
        make_observation(100, 0, true), make_observation(200, 100 * WAD, true),
    ];

    // Span has 2 elements but we claim cardinality is 5
    oracle_lib::binary_search(observations.span(), 150, 1, 5);
}

// ============================================
// INTEGRATION: TWAP CALCULATION
// ============================================

#[test]
fn test_twap_calculation_constant_rate() {
    // Simulate a scenario with constant rate over time
    // Rate = WAD for 100 seconds -> TWAP = WAD

    // Initial observation
    let obs0 = make_observation(100, 0, true);

    // After 100 seconds with rate = WAD
    let obs1 = oracle_lib::transform(obs0, 200, WAD);
    assert(obs1.ln_implied_rate_cumulative == 100 * WAD, 'cumulative after 100s');

    // Calculate TWAP
    let twap = (obs1.ln_implied_rate_cumulative - obs0.ln_implied_rate_cumulative) / 100;
    assert(twap == WAD, 'TWAP should equal rate');
}

#[test]
fn test_twap_calculation_varying_rate() {
    // Two periods with different rates
    // Period 1: t=100 to t=150, rate = WAD
    // Period 2: t=150 to t=200, rate = 2*WAD

    let obs0 = make_observation(100, 0, true);
    let obs1 = oracle_lib::transform(obs0, 150, WAD); // 50 * WAD
    let obs2 = oracle_lib::transform(obs1, 200, 2 * WAD); // 50 * WAD + 50 * 2*WAD = 150*WAD

    assert(obs1.ln_implied_rate_cumulative == 50 * WAD, 'cumulative at t=150');
    assert(obs2.ln_implied_rate_cumulative == 150 * WAD, 'cumulative at t=200');

    // TWAP over full period = (150*WAD - 0) / 100 = 1.5*WAD
    let twap = (obs2.ln_implied_rate_cumulative - obs0.ln_implied_rate_cumulative) / 100;
    assert(twap == WAD + WAD / 2, 'TWAP should be 1.5*WAD');
}

#[test]
fn test_write_sequence_maintains_cumulative() {
    // Simulate multiple writes as would happen in Market
    let init_result = oracle_lib::initialize(100);

    // First write at t=200 with rate=WAD
    let write1 = oracle_lib::write(init_result.observation, 0, 200, WAD, 1, 10);
    assert(write1.observation.ln_implied_rate_cumulative == 100 * WAD, 'first write cumulative');

    // Second write at t=300 with rate=2*WAD (note: uses OLD rate)
    // The cumulative should be: 100*WAD + 2*WAD * 100 = 300*WAD
    let write2 = oracle_lib::write(write1.observation, write1.index, 300, 2 * WAD, 10, 10);
    assert(write2.observation.ln_implied_rate_cumulative == 300 * WAD, 'second write cumulative');
}
