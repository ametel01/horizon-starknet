// SPDX-License-Identifier: BSL-1.1
// TWAP Oracle Library - Pendle OracleLib.sol port for Starknet
//
// This library implements a ring buffer of observations for computing
// Time-Weighted Average Price (TWAP) of the ln(implied rate).
//
// Key design decisions:
// - Uses u64 for timestamps (Starknet native) vs Pendle's uint32
// - Uses u256 for cumulative values (Cairo native) vs Pendle's uint216
// - Observation buffer is a Map<u16, Observation> stored in the market contract
// - Cairo storage model: functions return values, caller handles storage writes
//   (unlike Solidity where libraries can take storage references)

use super::errors::Errors;

/// A single observation in the TWAP ring buffer.
///
/// Each observation records:
/// - The block timestamp when it was written
/// - The cumulative ln(implied rate) up to that point
/// - Whether this slot has been initialized
///
/// The cumulative value follows the formula:
/// `ln_implied_rate_cumulative += ln_implied_rate * (current_timestamp - last_timestamp)`
#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Observation {
    /// Block timestamp when this observation was recorded
    pub block_timestamp: u64,
    /// Cumulative ln(implied rate) * time, used for TWAP calculation
    pub ln_implied_rate_cumulative: u256,
    /// Whether this observation slot has been initialized with real data
    pub initialized: bool,
}

/// Result of the initialize operation.
/// Contains the observation to write to slot 0 and the initial cardinality values.
#[derive(Copy, Drop)]
pub struct InitializeResult {
    /// Observation to write to slot 0
    pub observation: Observation,
    /// Initial cardinality (always 1)
    pub cardinality: u16,
    /// Initial cardinality_next (always 1)
    pub cardinality_next: u16,
}

/// Creates the initial observation for the TWAP buffer.
///
/// This should be called once during market construction to establish the baseline
/// for TWAP calculations. The cumulative value starts at 0.
///
/// # Arguments
/// * `timestamp` - The block timestamp at market creation
///
/// # Returns
/// * `InitializeResult` containing:
///   - observation: Write this to `observations[0]`
///   - cardinality: Write this to `observation_cardinality` (always 1)
///   - cardinality_next: Write this to `observation_cardinality_next` (always 1)
///
/// # Usage (in market contract)
/// ```cairo
/// let result = oracle_lib::initialize(timestamp);
/// self.observations.write(0_u16, result.observation);
/// self.observation_index.write(0_u16);
/// self.observation_cardinality.write(result.cardinality);
/// self.observation_cardinality_next.write(result.cardinality_next);
/// ```
///
/// # Pendle Reference
/// Mirrors `OracleLib.initialize()` from PendleMarketV6
pub fn initialize(timestamp: u64) -> InitializeResult {
    InitializeResult {
        observation: Observation {
            block_timestamp: timestamp, ln_implied_rate_cumulative: 0, initialized: true,
        },
        cardinality: 1_u16,
        cardinality_next: 1_u16,
    }
}

/// Transforms an observation to a new timestamp by accumulating the time-weighted rate.
///
/// This is the core accumulator function for TWAP calculation. It computes:
/// `new_cumulative = last.cumulative + ln_implied_rate * (block_timestamp - last.block_timestamp)`
///
/// The cumulative value is NOT divided by WAD - it stores `rate × time` directly.
/// When computing TWAP: `(cumulative_now - cumulative_past) / duration` gives the average rate.
///
/// # Arguments
/// * `last` - The previous observation to transform from
/// * `block_timestamp` - The target timestamp for the new observation
/// * `ln_implied_rate` - The ln(implied rate) in WAD scale (10^18)
///
/// # Returns
/// * New `Observation` at `block_timestamp` with updated cumulative value
///
/// # Panics
/// * If `block_timestamp < last.block_timestamp` (time went backwards - invariant violation)
///
/// # Example
/// ```cairo
/// // Given: last observation at t=100 with cumulative=0, rate=WAD (1.0)
/// // Transform to t=200 (delta = 100 seconds)
/// // Result: cumulative = 0 + WAD * 100 = 100 * 10^18
/// let new_obs = transform(last, 200, WAD);
/// assert(new_obs.ln_implied_rate_cumulative == WAD * 100);
/// ```
///
/// # Pendle Reference
/// Mirrors `OracleLib.transform()` - pure function for cumulative calculation
pub fn transform(last: Observation, block_timestamp: u64, ln_implied_rate: u256) -> Observation {
    // Safety: time must not go backwards
    assert(block_timestamp >= last.block_timestamp, 'HZN: time went backwards');

    // Calculate time delta (safe because of assertion above)
    let time_delta: u256 = (block_timestamp - last.block_timestamp).into();

    // Accumulate: cumulative += rate * time_delta
    // Note: No WAD division here - cumulative stores rate*time directly
    let new_cumulative = last.ln_implied_rate_cumulative + (ln_implied_rate * time_delta);

    Observation { block_timestamp, ln_implied_rate_cumulative: new_cumulative, initialized: true }
}

/// Result of the write operation.
/// Contains the observation to write and updated buffer state.
#[derive(Copy, Drop)]
pub struct WriteResult {
    /// The observation to write to the buffer
    pub observation: Observation,
    /// Updated observation index (where to write)
    pub index: u16,
    /// Updated cardinality (may have grown)
    pub cardinality: u16,
}

/// Writes a new observation to the ring buffer if timestamp has changed.
///
/// This function implements the core ring buffer write logic:
/// 1. Same-block no-op: If last observation was at same timestamp, return unchanged
/// 2. Cardinality growth: If buffer is full and can grow, expand it
/// 3. Index advancement: Move to next slot in ring buffer (with wrap-around)
/// 4. Transform: Create new observation with accumulated rate
///
/// # Arguments
/// * `last` - The most recent observation (caller reads from `observations[index]`)
/// * `index` - Current observation index
/// * `block_timestamp` - Current block timestamp
/// * `ln_implied_rate` - The STORED (old) ln(implied rate) - CRITICAL: must be value BEFORE update
/// * `cardinality` - Current ring buffer size (active slots)
/// * `cardinality_next` - Target ring buffer size (grows when index wraps)
///
/// # Returns
/// * `WriteResult` containing:
///   - observation: Write to `observations[result.index]`
///   - index: New index value (write to `observation_index`)
///   - cardinality: New cardinality (write to `observation_cardinality`)
///
/// # Usage (in market contract)
/// ```cairo
/// let last = self.observations.read(self.observation_index.read());
/// let old_rate = self.last_ln_implied_rate.read();  // MUST use stored rate!
/// let result = oracle_lib::write(
///     last,
///     self.observation_index.read(),
///     timestamp,
///     old_rate,
///     self.observation_cardinality.read(),
///     self.observation_cardinality_next.read(),
/// );
/// self.observations.write(result.index, result.observation);
/// self.observation_index.write(result.index);
/// self.observation_cardinality.write(result.cardinality);
/// // NOW safe to update rate
/// self.last_ln_implied_rate.write(new_rate);
/// ```
///
/// # Critical Ordering
/// MUST be called BEFORE updating `last_ln_implied_rate`. The cumulative
/// calculation uses the old rate for the time period that just ended.
///
/// # Pendle Reference
/// Mirrors `OracleLib.write()` - ring buffer advancement with same-block no-op
pub fn write(
    last: Observation,
    index: u16,
    block_timestamp: u64,
    ln_implied_rate: u256,
    cardinality: u16,
    cardinality_next: u16,
) -> WriteResult {
    // Guard: cardinality must be > 0 (oracle must be initialized)
    assert(cardinality > 0, Errors::ORACLE_ZERO_CARDINALITY);

    // Same-block no-op: if we've already written this block, skip
    // Returns unchanged values - caller can always write, it's a no-op
    if last.block_timestamp == block_timestamp {
        return WriteResult { observation: last, index, cardinality };
    }

    // Check if we can grow cardinality
    // Growth happens when: buffer can grow AND we're at the last slot
    let new_cardinality = if cardinality_next > cardinality && index == cardinality - 1 {
        cardinality_next
    } else {
        cardinality
    };

    // Advance index with wrap-around in ring buffer
    let new_index = (index + 1) % new_cardinality;

    // Transform creates new observation with accumulated rate
    let new_observation = transform(last, block_timestamp, ln_implied_rate);

    WriteResult { observation: new_observation, index: new_index, cardinality: new_cardinality }
}

/// Two observations surrounding a target timestamp.
/// Used for interpolation when querying past cumulative values.
#[derive(Copy, Drop)]
pub struct SurroundingObservations {
    /// Observation at or before the target timestamp
    pub before_or_at: Observation,
    /// Observation at or after the target timestamp
    pub at_or_after: Observation,
}

/// Computes the cumulative ln(implied rate) at a specific target timestamp.
///
/// This is the core query function for TWAP calculations. It handles three cases:
/// 1. `target == time` (seconds_ago == 0): Transform newest observation to current time
/// 2. `target` matches an observation exactly: Return that observation's cumulative
/// 3. Otherwise: Linearly interpolate between surrounding observations
///
/// # Arguments
/// * `time` - Current block timestamp
/// * `target` - The timestamp to query (typically `time - seconds_ago`)
/// * `newest` - The most recent observation (from `observations[index]`)
/// * `ln_implied_rate` - Current stored ln(implied rate)
/// * `surrounding` - Two observations bracketing `target` (from `get_surrounding_observations`)
///
/// # Returns
/// * Cumulative ln(implied rate) at `target` timestamp
///
/// # Usage (in market contract)
/// ```cairo
/// // For seconds_ago == 0 (current time query)
/// let cumulative = oracle_lib::observe_single(
///     time, time, newest, rate,
///     SurroundingObservations { before_or_at: newest, at_or_after: newest }
/// );
///
/// // For seconds_ago > 0 (past query)
/// let target = time - seconds_ago;
/// let surrounding = get_surrounding_observations(...);
/// let cumulative = oracle_lib::observe_single(time, target, newest, rate, surrounding);
/// ```
///
/// # TWAP Calculation Example
/// ```cairo
/// // Query observe([3600, 0]) for 1-hour TWAP
/// let cumulative_now = observe_single(time, time, ...);      // seconds_ago = 0
/// let cumulative_past = observe_single(time, time - 3600, ...);  // seconds_ago = 3600
/// let twap = (cumulative_now - cumulative_past) / 3600;
/// ```
///
/// # Panics
/// * If `target > time` (can't query the future)
/// * If `target < surrounding.before_or_at.block_timestamp` (target too old for surrounding)
///
/// # Pendle Reference
/// Mirrors `OracleLib.observeSingle()` - cumulative value lookup with interpolation
pub fn observe_single(
    time: u64,
    target: u64,
    newest: Observation,
    ln_implied_rate: u256,
    surrounding: SurroundingObservations,
) -> u256 {
    // Guard: target must be <= time (can't query the future)
    assert(target <= time, Errors::ORACLE_TARGET_IN_FUTURE);
    // Guard: target must be >= before_or_at timestamp (surrounding must bracket target)
    assert(target >= surrounding.before_or_at.block_timestamp, Errors::ORACLE_TARGET_TOO_OLD);

    // Case 1: Querying current time (seconds_ago == 0)
    // Transform newest observation to current timestamp if needed
    if target == time {
        if newest.block_timestamp != time {
            // Observation not at current time - transform it forward
            return transform(newest, time, ln_implied_rate).ln_implied_rate_cumulative;
        }
        // Observation already at current time
        return newest.ln_implied_rate_cumulative;
    }

    // Case 2: Exact match with before_or_at observation
    if target == surrounding.before_or_at.block_timestamp {
        return surrounding.before_or_at.ln_implied_rate_cumulative;
    }

    // Case 3: Exact match with at_or_after observation
    if target == surrounding.at_or_after.block_timestamp {
        return surrounding.at_or_after.ln_implied_rate_cumulative;
    }

    // Case 4: Linear interpolation between surrounding observations
    // Formula: before.cumulative + (delta_cumulative * target_offset / total_time_span)
    let observation_time_delta: u256 = (surrounding.at_or_after.block_timestamp
        - surrounding.before_or_at.block_timestamp)
        .into();
    let target_delta: u256 = (target - surrounding.before_or_at.block_timestamp).into();
    let cumulative_delta = surrounding.at_or_after.ln_implied_rate_cumulative
        - surrounding.before_or_at.ln_implied_rate_cumulative;

    surrounding.before_or_at.ln_implied_rate_cumulative
        + (cumulative_delta * target_delta / observation_time_delta)
}

/// Observes cumulative values for multiple time offsets.
///
/// This is the batch query function that returns cumulative values for each
/// `seconds_ago` offset. The market contract implements the actual `observe`
/// entrypoint using this helper.
///
/// # Arguments
/// * `time` - Current block timestamp
/// * `seconds_agos` - Span of time offsets to query
/// * `newest` - Most recent observation
/// * `ln_implied_rate` - Current stored rate
/// * `surrounding_observations` - Pre-computed surrounding observations for each query
///   (caller uses `get_surrounding_observations` to find these)
///
/// # Returns
/// * Array of cumulative values, one per `seconds_ago` entry
///
/// # Panics
/// * If `seconds_agos.len() != surrounding_observations.len()`
/// * If any `seconds_ago > time` (target would be in the future / underflow)
///
/// # Note on Cairo Storage Model
/// Since Cairo libraries cannot access contract storage, the caller (market contract)
/// must pre-compute `surrounding_observations` using `get_surrounding_observations`
/// for each `seconds_ago` before calling this function.
///
/// # Pendle Reference
/// Mirrors `OracleLib.observe()` - batch cumulative lookup
pub fn observe(
    time: u64,
    seconds_agos: Span<u32>,
    newest: Observation,
    ln_implied_rate: u256,
    surrounding_observations: Span<SurroundingObservations>,
) -> Array<u256> {
    assert(seconds_agos.len() == surrounding_observations.len(), 'HZN: array length mismatch');

    let mut results: Array<u256> = ArrayTrait::new();
    let mut i: usize = 0;

    while i < seconds_agos.len() {
        let seconds_ago: u64 = (*seconds_agos.at(i)).into();
        // Guard: seconds_ago must not exceed current time (target would be in the future)
        assert(seconds_ago <= time, Errors::ORACLE_TARGET_IN_FUTURE);
        let target = time - seconds_ago;
        let surrounding = *surrounding_observations.at(i);

        let cumulative = observe_single(time, target, newest, ln_implied_rate, surrounding);
        results.append(cumulative);

        i += 1;
    }

    results
}

/// Gets surrounding observations for a target timestamp.
///
/// This function handles the common cases without requiring binary search:
/// 1. `target >= newest.timestamp`: Returns (newest, transform(newest, target, rate))
/// 2. `target == oldest.timestamp`: Returns (oldest, oldest)
///
/// Returns `None` if binary search is needed (target strictly between oldest and newest).
///
/// # Arguments
/// * `target` - The timestamp to query
/// * `newest` - Most recent observation (from `observations[index]`)
/// * `oldest` - Oldest observation in buffer (see `get_oldest_observation_index`)
/// * `ln_implied_rate` - Current stored rate (for transforms when target > newest)
///
/// # Returns
/// * `Option::Some(SurroundingObservations)` if resolved without search
/// * `Option::None` if binary search needed (target between oldest and newest)
///
/// # Panics
/// * If `target < oldest.block_timestamp` (HZN: target too old)
///
/// # Usage (in market contract)
/// ```cairo
/// let newest = self.observations.read(self.observation_index.read());
/// let oldest_idx = oracle_lib::get_oldest_observation_index(index, cardinality, ...);
/// let oldest = self.observations.read(oldest_idx);
/// let rate = self.last_ln_implied_rate.read();
///
/// match oracle_lib::get_surrounding_observations(target, newest, oldest, rate) {
///     Option::Some(surrounding) => surrounding,
///     Option::None => {
///         // Need binary search - read all observations and call binary_search
///         let all_obs = read_all_observations(...);
///         oracle_lib::binary_search(all_obs, target, index, cardinality)
///     }
/// }
/// ```
///
/// # Pendle Reference
/// Mirrors `OracleLib.getSurroundingObservations()` edge case handling
pub fn get_surrounding_observations(
    target: u64, newest: Observation, oldest: Observation, ln_implied_rate: u256,
) -> Option<SurroundingObservations> {
    // Validate: target must not be older than our history
    assert(target >= oldest.block_timestamp, Errors::ORACLE_TARGET_TOO_OLD);

    // Case 1: target at or after newest observation
    // This is the common case for recent TWAP queries (e.g., last 30min)
    if target >= newest.block_timestamp {
        if target == newest.block_timestamp {
            // Exact match - both surrounding observations are the same
            return Option::Some(
                SurroundingObservations { before_or_at: newest, at_or_after: newest },
            );
        }
        // Target is between newest observation and current time
        // Transform newest forward to get the at_or_after observation
        return Option::Some(
            SurroundingObservations {
                before_or_at: newest, at_or_after: transform(newest, target, ln_implied_rate),
            },
        );
    }

    // Case 2: target exactly at oldest observation
    if target == oldest.block_timestamp {
        return Option::Some(SurroundingObservations { before_or_at: oldest, at_or_after: oldest });
    }

    // Case 3: target is strictly between oldest and newest
    // Binary search is required to find the surrounding observations
    Option::None
}

/// Gets the physical index of the oldest observation in the ring buffer.
///
/// The oldest observation is at `(index + 1) % cardinality`, but if that slot
/// is uninitialized (buffer hasn't wrapped yet), the oldest is at slot 0.
///
/// # Arguments
/// * `index` - Current observation index (points to newest)
/// * `cardinality` - Active buffer size
/// * `slot_initialized` - Whether the slot at `(index + 1) % cardinality` is initialized
///
/// # Returns
/// * Physical index of the oldest observation
///
/// # Usage (in market contract)
/// ```cairo
/// let candidate_idx = (index + 1) % cardinality;
/// let candidate = self.observations.read(candidate_idx);
/// let oldest_idx = oracle_lib::get_oldest_observation_index(index, cardinality,
/// candidate.initialized);
/// let oldest = self.observations.read(oldest_idx);
/// ```
pub fn get_oldest_observation_index(index: u16, cardinality: u16, slot_initialized: bool) -> u16 {
    // Guard: cardinality must be > 0 (oracle must be initialized)
    assert(cardinality > 0, Errors::ORACLE_ZERO_CARDINALITY);

    let candidate = (index + 1) % cardinality;
    if slot_initialized {
        candidate
    } else {
        // Buffer hasn't wrapped yet - oldest is at slot 0
        0
    }
}

/// Result of the grow operation.
/// Contains the new cardinality_next and slots to pre-initialize.
#[derive(Drop)]
pub struct GrowResult {
    /// New cardinality_next value (write to `observation_cardinality_next`)
    pub cardinality_next: u16,
    /// Slots to pre-initialize for warm storage
    /// Caller should write each observation to `observations[index]`
    pub slots_to_initialize: Array<(u16, Observation)>,
}

/// Pre-initializes observation slots to reduce storage costs during swaps.
///
/// This function expands the observation buffer capacity by pre-writing "empty"
/// observations to new slots. This ensures that when real observations are written
/// during swaps, the storage slots are already "warm" (previously written).
///
/// # Arguments
/// * `current` - Current `observation_cardinality_next` value
/// * `next` - Desired new cardinality
///
/// # Returns
/// * `GrowResult` containing:
///   - cardinality_next: New value (write to `observation_cardinality_next`)
///   - slots_to_initialize: Array of (index, observation) pairs to write
///
/// # Behavior
/// - No-op if `next <= current` (can't shrink)
/// - Pre-initializes slots `[current, next)` with `{timestamp: 1, cumulative: 0, initialized:
/// false}`
///
/// # Panics
/// * If `current == 0` (oracle not initialized)
///
/// # Usage (in market contract)
/// ```cairo
/// fn increase_observations_cardinality_next(ref self: ContractState, cardinality_next: u16) {
///     let current_next = self.observation_cardinality_next.read();
///     let result = oracle_lib::grow(current_next, cardinality_next);
///
///     // Write pre-initialized observations
///     for (idx, obs) in result.slots_to_initialize {
///         self.observations.write(idx, obs);
///     };
///
///     // Update cardinality_next if changed
///     if result.cardinality_next != current_next {
///         self.observation_cardinality_next.write(result.cardinality_next);
///     }
/// }
/// ```
///
/// # Why timestamp = 1?
/// Using 1 instead of 0 distinguishes "pre-initialized but unused" from "never written".
/// The `initialized = false` flag tells binary search to skip these slots.
///
/// # Pendle Reference
/// Mirrors `OracleLib.grow()` - storage slot pre-warming
pub fn grow(current: u16, next: u16) -> GrowResult {
    // Oracle must be initialized (cardinality_next >= 1)
    assert(current > 0, Errors::ORACLE_ZERO_CARDINALITY);

    // No-op: can't shrink, only grow
    if next <= current {
        return GrowResult { cardinality_next: current, slots_to_initialize: ArrayTrait::new() };
    }

    // Pre-initialize slots [current, next) with placeholder observations
    let mut slots: Array<(u16, Observation)> = ArrayTrait::new();
    let mut i: u16 = current;

    while i < next {
        slots
            .append(
                (
                    i,
                    Observation {
                        // timestamp=1 marks slot as pre-initialized (vs 0 for never-touched)
                        block_timestamp: 1,
                        ln_implied_rate_cumulative: 0, // initialized=false tells binary search to skip this slot
                        initialized: false,
                    },
                ),
            );
        i += 1;
    }

    GrowResult { cardinality_next: next, slots_to_initialize: slots }
}

/// Binary search to find surrounding observations in a ring buffer.
///
/// This function is called when `get_surrounding_observations` returns `None`,
/// indicating the target is strictly between the oldest and newest observations.
///
/// The ring buffer maps logical indices to physical storage slots:
/// - Logical 0 = oldest observation at physical slot `(index + 1) % cardinality`
/// - Logical `cardinality - 1` = newest observation at physical slot `index`
///
/// # Arguments
/// * `observations` - Span of all observations, indexed by physical slot (0..cardinality)
/// * `target` - Timestamp to find (must satisfy: oldest.ts < target < newest.ts)
/// * `index` - Physical slot of newest observation
/// * `cardinality` - Active buffer size
///
/// # Returns
/// * `SurroundingObservations` where `before.ts <= target <= after.ts`
///
/// # Panics
/// * If search fails (indicates corrupted state or invalid precondition)
/// * If `cardinality == 0`
/// * If `observations.len() != cardinality` (span size must match buffer size exactly)
///
/// # Precondition
/// Caller must verify `oldest.block_timestamp < target < newest.block_timestamp`
/// before calling this function. Use `get_surrounding_observations` first.
///
/// # Usage (in market contract)
/// ```cairo
/// // Only call if get_surrounding_observations returned None
/// let mut all_obs: Array<Observation> = ArrayTrait::new();
/// let mut i: u16 = 0;
/// while i < cardinality {
///     all_obs.append(self.observations.read(i));
///     i += 1;
/// };
/// let surrounding = oracle_lib::binary_search(all_obs.span(), target, index, cardinality);
/// ```
///
/// # Pendle Reference
/// Mirrors `OracleLib.binarySearch()` - ring buffer binary search
pub fn binary_search(
    observations: Span<Observation>, target: u64, index: u16, cardinality: u16,
) -> SurroundingObservations {
    assert(cardinality > 0, Errors::ORACLE_ZERO_CARDINALITY);

    // Guard: observations span must have exactly cardinality elements
    // The ring buffer arithmetic assumes physical indices 0..cardinality
    assert(observations.len() == cardinality.into(), Errors::ORACLE_INVALID_OBS_LENGTH);

    // Physical index of oldest observation
    let oldest_slot: u32 = ((index + 1) % cardinality).into();
    let cardinality_u32: u32 = cardinality.into();

    // Binary search in logical index space
    // l=0 corresponds to oldest, l=cardinality-1 corresponds to newest
    let mut l: u32 = 0;
    let mut r: u32 = cardinality_u32 - 1;

    loop {
        // Convergence check
        assert(l <= r, 'HZN: binary search failed');

        let mid: u32 = (l + r) / 2;

        // Convert logical index to physical slot
        let physical_mid: u32 = (oldest_slot + mid) % cardinality_u32;
        let before_or_at = *observations.at(physical_mid);

        // Skip uninitialized slots (search right)
        if !before_or_at.initialized {
            l = mid + 1;
            continue;
        }

        // Get the next observation (at_or_after)
        let physical_next: u32 = (physical_mid + 1) % cardinality_u32;
        let at_or_after = *observations.at(physical_next);

        // Check if target is in the bracket [before_or_at.ts, at_or_after.ts]
        let target_after_before = target >= before_or_at.block_timestamp;
        let target_before_after = target <= at_or_after.block_timestamp;

        if target_after_before && target_before_after {
            // Found the surrounding observations
            break SurroundingObservations { before_or_at, at_or_after };
        }

        // Narrow the search range
        if target < before_or_at.block_timestamp {
            // Target is before this observation - search left
            assert(mid > 0, 'HZN: search underflow');
            r = mid - 1;
        } else {
            // Target is after at_or_after - search right
            l = mid + 1;
        }
    }
}
