# TWAP Oracle Implementation Plan (Compressed)

**Based on:** `TWAP_ORACLE_INTEGRATION_SPEC.md`
**Authoritative refs:** Pendle `OracleLib.sol`, `PendleMarketV6.sol`, `PendlePYOracleLib.sol`, `PendleLpOracleLib.sol`, `PendlePYLpOracle.sol`

---

## Phase 0: Pre-flight (context lock) ✅ COMPLETE

### Checklist
- [x] Confirm current market uses `market_math_fp` and stores only `last_ln_implied_rate`
- [x] Decide library placement: `contracts/src/libraries/oracle_lib.cairo`
- [x] Verify market upgradeability status

### Verified Findings

**1. Storage layout** (`contracts/src/market/amm.cairo:61-93`):
```cairo
#[storage]
struct Storage {
    // OpenZeppelin components (substorage v0)
    erc20, src5, access_control, pausable, ownable,
    // Token addresses
    sy, pt, yt, factory,
    // Pool reserves
    sy_reserve: u256,
    pt_reserve: u256,
    // Market parameters
    scalar_root: u256,
    initial_anchor: u256,
    ln_fee_rate_root: u256,
    reserve_fee_percent: u8,
    // Expiry info
    expiry: u64,
    // Cached implied rate (line 90)
    last_ln_implied_rate: u256,
    // LP fees (line 92) - LAST FIELD
    lp_fees_collected: u256,
    // >>> NEW ORACLE FIELDS GO HERE <<<
}
```

**2. market_math_fp imports** (`amm.cairo:19-23`):
- `MINIMUM_LIQUIDITY`, `MarketState`, `calc_*` functions
- `get_ln_implied_rate`, `get_time_to_expiry`, `set_initial_ln_implied_rate`

**3. Libraries module** (`contracts/src/lib.cairo:20-25`):
- Current exports: `errors`, `math`, `math_fp`, `roles`
- Add: `oracle_lib` after `math_fp`

**4. Market upgradeability** (`amm.cairo:5`):
- **Explicitly non-upgradeable**: "Deployed per-PT via MarketFactory, new markets use new class hash"
- Uses: ERC20, SRC5, AccessControl, Pausable, Ownable components
- **No UpgradeableComponent** - confirmed by absence in imports

### Critical Constraints
- New storage fields should be appended after `lp_fees_collected` (line 92) for clarity
- **Note:** All contracts will be redeployed fresh - no backward compatibility concerns
- TWAP-enabled markets require fresh deployments via MarketFactory

### Failure modes
- Using non-`Store` derive on Observation struct → prevents storage writes

---

## Phase 1: Oracle library (Pendle OracleLib parity) **COMPLETE**

### 1.1 Create `contracts/src/libraries/oracle_lib.cairo` **COMPLETE**

Add `Observation` struct:
```cairo
#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Observation {
    pub block_timestamp: u64, // Pendle uses uint32; Cairo keeps u64
    pub ln_implied_rate_cumulative: u256, // Pendle uses uint216
    pub initialized: bool,
}
```

Validation:
- `scarb build`

Failure modes:
- Using non-`Store` fields prevents storage writes.

### 1.2 Implement `initialize` (writes slot 0) **COMPLETE**

Signature:
```cairo
pub fn initialize(
    ref observations: Map<u16, Observation>,
    timestamp: u64,
) -> (u16, u16);
```
Behavior:
- Write `observations[0] = {timestamp, 0, true}`.
- Return `(1, 1)`.

Validation:
- Unit test: `initialize(1000)` writes slot 0 and returns `(1, 1)`.

Failure modes:
- Returning an `Observation` instead of writing to storage (deviates from Pendle flow).

### 1.3 Implement `transform` **COMPLETE**

Key formula:
```
ln_implied_rate_cumulative += ln_implied_rate * (block_timestamp - last.block_timestamp)
```

Validation:
- Unit test: `transform(last{ts:100,cum:0}, 200, WAD)` -> `cum = WAD * 100`.

Failure modes:
- Underflow if `block_timestamp < last.block_timestamp` (should revert or assert).

### 1.4 Implement `write` (same-block no-op + growth) **COMPLETE**

Signature:
```cairo
pub fn write(
    ref observations: Map<u16, Observation>,
    index: u16,
    block_timestamp: u64,
    ln_implied_rate: u256, // MUST be stored (old) rate
    cardinality: u16,
    cardinality_next: u16,
) -> (u16, u16);
```
Behavior:
- Read `last = observations[index]`.
- If `last.block_timestamp == block_timestamp`, return `(index, cardinality)`.
- If `cardinality_next > cardinality && index == cardinality - 1`, bump `cardinality`.
- Advance index with modulo and write `transform(last, block_timestamp, ln_implied_rate)`.

Validation:
- Unit test: same-block write is no-op.
- Unit test: growth when index hits `cardinality - 1`.

Failure modes:
- Using `new_rate` instead of stored `old_rate` breaks TWAP.
- Writing observation after updating `last_ln_implied_rate` breaks cumulative values.

### 1.5 Implement `observeSingle` + `observe` **COMPLETE**

Key Pendle behavior:
- `secondsAgo == 0` returns cumulative at `time` (transform if needed).
- Target between newest observation and now must interpolate using `transform(last, target, ln_implied_rate)`.
- Revert on `cardinality == 0` or `target < oldest`.

Validation:
- Unit test: target between newest and now returns correct interpolated cumulative.
- Unit test: `observe([duration, 0])` -> TWAP = `(cumulative_now - cumulative_past) / duration`.

Failure modes:
- Interpolating to `time` instead of `target` produces wrong TWAP.

### 1.6 Implement `binarySearch` + `getSurroundingObservations` **COMPLETE**

Pendle parity:
- Use stored newest observation (no transform) for `beforeOrAt`.
- If `target >= newest.block_timestamp`, return `(newest, transform(newest, target, ln_implied_rate))`.
- Oldest is `(index + 1) % cardinality`; fallback to slot 0 if uninitialized.

Validation:
- Unit test: `target` older than oldest -> revert `ORACLE_TARGET_TOO_OLD`.
- Unit test: `target` after newest -> returns transformed at-or-after.

Failure modes:
- Using `time` instead of `target` in `transform`.

### 1.7 Implement `grow` **COMPLETE**

Signature:
```cairo
pub fn grow(
    ref observations: Map<u16, Observation>,
    current: u16,
    next: u16,
) -> u16;
```
Behavior:
- Revert if `current == 0`.
- No-op if `next <= current`.
- Pre-initialize slots `[current, next)` with `{timestamp:1, cum:0, initialized:false}`.

Validation:
- Unit test: grow(1,10) writes slots 1..9 with `initialized=false`.

Failure modes:
- Skipping pre-init causes cold SSTORE costs during swaps.

### 1.8 Add oracle errors **COMPLETE**

**File:** `contracts/src/libraries/errors.cairo`
```cairo
// Oracle errors
pub const ORACLE_ZERO_CARDINALITY: felt252 = 'HZN: oracle zero cardinality';
pub const ORACLE_TARGET_TOO_OLD: felt252 = 'HZN: oracle target too old';
pub const ORACLE_UNINITIALIZED: felt252 = 'HZN: oracle uninitialized';
```

Validation:
- `scarb build`

### 1.9 Export library **COMPLETE**

**File:** `contracts/src/lib.cairo`
Add under `pub mod libraries { ... }`:
```cairo
pub mod oracle_lib;
```

Validation:
- `scarb build`

---

## Phase 2: Market integration (TWAP storage + entrypoints) **COMPLETE**

### 2.1 Append storage fields **COMPLETE**

**File:** `contracts/src/market/amm.cairo`
Append to `Storage` (after existing fields):
```cairo
// TWAP oracle
observations: Map<u16, Observation>,
observation_index: u16,
observation_cardinality: u16,
observation_cardinality_next: u16,
```

Validation:
- `scarb build`
- Manual: verify new fields are appended (no reorder).

Failure modes:
- Storage reordering breaks existing deployments.

### 2.2 Constructor initialization **COMPLETE**

Add:
```cairo
let timestamp = get_block_timestamp();
let (cardinality, cardinality_next) = oracle_lib::initialize(ref self.observations, timestamp);
self.observation_index.write(0);
self.observation_cardinality.write(cardinality);
self.observation_cardinality_next.write(cardinality_next);
```

Validation:
- Unit test: cardinality == 1, observation[0].initialized == true.

### 2.3 `_update_implied_rate` ordering (critical) **COMPLETE**

Update to:
```cairo
let timestamp = get_block_timestamp();
let old_rate = self.last_ln_implied_rate.read();
...
let (new_index, new_cardinality) = oracle_lib::write(
    ref self.observations,
    self.observation_index.read(),
    timestamp,
    old_rate,
    self.observation_cardinality.read(),
    self.observation_cardinality_next.read(),
);
self.observation_index.write(new_index);
self.observation_cardinality.write(new_cardinality);

if new_rate != old_rate { self.last_ln_implied_rate.write(new_rate); }
```

Validation:
- Unit test: cumulative increases by `old_rate * delta`.
- Unit test: same-block no-op keeps index unchanged.

Failure modes:
- Writing after `last_ln_implied_rate` update corrupts TWAP.

### 2.4 `_set_initial_ln_implied_rate` **COMPLETE**

Write observation with stored rate (expected 0) before setting initial rate:
```cairo
let timestamp = get_block_timestamp();
let old_rate = self.last_ln_implied_rate.read();
let (new_index, new_cardinality) = oracle_lib::write(... old_rate ...);
self.last_ln_implied_rate.write(initial_rate);
```

Validation:
- Unit test: first mint yields 2 observations (slot 0 init + first write).

### 2.5 Market entrypoints **COMPLETE**

**Add to `IMarket` + `MarketImpl`:**
```cairo
fn observe(self: @TContractState, seconds_agos: Array<u32>) -> Array<u256>;
fn increase_observations_cardinality_next(ref self: TContractState, cardinality_next: u16);
fn observations(self: @TContractState, index: u16) -> (u64, u256, bool);
fn _storage(self: @TContractState) -> (u256, u16, u16, u16); // last_ln_implied_rate + oracle fields
```

Implementation notes:
- `observe` passes `self.last_ln_implied_rate.read()` as the current rate.
- `increase_observations_cardinality_next` uses:
  ```cairo
  let current_next = self.observation_cardinality_next.read();
  let new_next = oracle_lib::grow(ref self.observations, current_next, cardinality_next);
  if new_next != current_next { self.observation_cardinality_next.write(new_next); }
  ```
- `observations(index)` returns `(block_timestamp, ln_implied_rate_cumulative, initialized)`.
- `_storage()` returns the fields needed by the oracle helper (not full market state).

Validation:
- Unit test: `observe([duration, 0])` returns 2 values and TWAP matches formula.
- Unit test: `increase_observations_cardinality_next` only grows.

Failure modes:
- Using `observation_cardinality` instead of `observation_cardinality_next` when growing.
- Returning `new_rate` instead of stored `last_ln_implied_rate` for duration=0.

### 2.6 Update `contracts/src/interfaces/i_market.cairo` **COMPLETE**

Ensure interface signatures match the new entrypoints and types exactly.

Validation:
- `scarb build`

---

## Phase 3: PT/YT/LP oracle helper **COMPLETE**
 
### 3.1 Interface **COMPLETE**

**File:** `contracts/src/interfaces/i_py_lp_oracle.cairo` (NEW)
Expose Pendle-style methods:
- `get_pt_to_sy_rate(market, duration)`
- `get_yt_to_sy_rate(market, duration)`
- `get_lp_to_sy_rate(market, duration)`
- `get_pt_to_asset_rate(market, duration)`
- `get_yt_to_asset_rate(market, duration)`
- `get_lp_to_asset_rate(market, duration)`
- `get_oracle_state(market, duration) -> (bool increase_required, u16 cardinality_required, bool oldest_observation_satisfied)`

Validation:
- `scarb build`

### 3.2 Implementation **COMPLETE**

**File:** `contracts/src/oracles/py_lp_oracle.cairo` (NEW)

Core helpers:
- `get_market_ln_implied_rate(market, duration)`:
  - If `duration == 0`, use `market._storage().last_ln_implied_rate`.
  - Else: `observe([duration, 0])` and compute `(cumulative_now - cumulative_past) / duration`.

PT/YT rates:
- `pt_to_sy = market_math_fp::get_pt_price(ln_rate, time_to_expiry)`.
- `yt_to_sy = (expiry > now) ? WAD - pt_to_sy : 0`.

Asset rates (Pendle parity):
- `sy_index = ISY(exchange_rate)`.
- `py_index = IYT(py_index_current)`.
- If `sy_index >= py_index` use raw; else scale by `sy_index / py_index` (same as Pendle).

LP rates:
- Build `MarketState` from market getters + `py_index`.
- Use `market_math_fp::get_market_pre_compute` + TWAP ln rate to replicate
  Pendle `PendleLpOracleLib._getLpToAssetRateRaw` flow.

Oracle state:
- Store `block_cycle_numerator` in oracle storage (default >= 1000).
- `cardinality_required = (duration * 1000 + block_cycle_numerator - 1) / block_cycle_numerator + 1`.
- Fetch `(index, cardinality)` from `market._storage()`; get oldest observation via `market.observations((index + 1) % cardinality)` (fallback to 0 if uninitialized).

Validation:
- Unit test: `duration=0` uses stored `last_ln_implied_rate`.
- Unit test: `get_oracle_state` matches Pendle formula and oldest check.
- Integration: PT/YT/LP rates match Pendle formula for identical inputs.

Failure modes:
- Using `get_ln_implied_rate()` (recomputed) instead of stored value for duration=0.
- Using heuristic block time instead of Pendle `block_cycle_numerator` formula.

---

## Phase 4: Tests and validation **COMPLETE**

### 4.1 `contracts/tests/math/test_oracle_lib.cairo` **COMPLETE** (42 tests)
- initialize, transform, write (same-block), grow, observe (interpolation + too-old).
- Binary search tests for ring buffer navigation.
- TWAP calculation tests for constant and varying rates.

### 4.2 `contracts/tests/market/test_market_oracle.cairo` **COMPLETE** (16 tests)
- constructor initializes observation.
- swaps/mints write observations.
- `observe([duration, 0])` computes TWAP.
- Same-block no-op behavior.
- Cardinality growth tests.

### 4.3 `contracts/tests/oracles/test_py_lp_oracle.cairo` **COMPLETE** (22 tests)
- PT/YT/LP rate paths (duration=0 and non-zero).
- `get_oracle_state` cardinality + oldest checks.
- PT + YT = WAD invariant verification.
- Asset-denominated rate tests with yield index adjustments.
- Time progression tests (PT increases, YT decreases toward expiry).

Validation:
- ✅ `snforge test test_oracle_lib` - 42 passed
- ✅ `snforge test test_market_oracle` - 16 passed
- ✅ `snforge test test_py_lp_oracle` - 22 passed
- ✅ Total oracle-related tests: **109 passed**

---

## File summary

| File | Action | Status |
|------|--------|--------|
| `contracts/src/libraries/oracle_lib.cairo` | CREATE | ✅ |
| `contracts/src/libraries/errors.cairo` | MODIFY | ✅ |
| `contracts/src/lib.cairo` | MODIFY | ✅ |
| `contracts/src/market/amm.cairo` | MODIFY | ✅ |
| `contracts/src/interfaces/i_market.cairo` | MODIFY | ✅ |
| `contracts/src/oracles/py_lp_oracle.cairo` | CREATE | ✅ |
| `contracts/src/interfaces/i_py_lp_oracle.cairo` | CREATE | ✅ |
| `contracts/tests/math/test_oracle_lib.cairo` | CREATE | ✅ |
| `contracts/tests/market/test_market_oracle.cairo` | CREATE | ✅ |
| `contracts/tests/oracles/test_py_lp_oracle.cairo` | CREATE | ✅ |
| `contracts/tests/math.cairo` | MODIFY | ✅ |
| `contracts/tests/market.cairo` | MODIFY | ✅ |
| `contracts/tests/oracles.cairo` | MODIFY | ✅ |
