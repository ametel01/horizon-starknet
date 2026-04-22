# 6. Oracle System Gaps

**CRITICAL: This is one of Horizon's principal weak points** - the oracle architecture fundamentally differs from Pendle's and blocks key DeFi integrations.

## 6.1 Oracle Architecture: Two Different Systems

Pendle's oracle infrastructure serves **two distinct purposes** that Horizon partially implements:

**Reference (Pendle V2 code):** [SYBase.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/core/StandardizedYield/SYBase.sol), [IIndexOracle.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/interfaces/IIndexOracle.sol), [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol), [PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol), [PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol), [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol)

| Oracle Type | Purpose | Pendle V2 | Horizon | Status |
|-------------|---------|-----------|---------|--------|
| **Yield Index Oracle** | SY exchange rate (asset → shares) | `SYBase` + `IIndexOracle` ([SYBase.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/core/StandardizedYield/SYBase.sol), [IIndexOracle.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/interfaces/IIndexOracle.sol)) | `PragmaIndexOracle` ([contracts/src/oracles/pragma_index_oracle.cairo](../contracts/src/oracles/pragma_index_oracle.cairo)) | ✅ 75% |
| **Market TWAP Oracle** | PT/YT/LP token pricing | Market + oracle libs ([PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol), [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol), [PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol), [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol)) | ✅ `oracle_lib.cairo` + `py_lp_oracle.cairo` ([contracts/src/libraries/oracle_lib.cairo](../contracts/src/libraries/oracle_lib.cairo), [contracts/src/oracles/py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo)) | ✅ ~95% |

**Key Insight:** These are complementary systems, not alternatives. Pendle has BOTH and Horizon now has BOTH.

---

## 6.2 Yield Index Oracle (Horizon: 75% Implemented)

**What it does:** Provides the exchange rate for yield-bearing assets (e.g., "1 wstETH = 1.18 stETH")

**Reference (Pendle V2 code):** [SYBase.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/core/StandardizedYield/SYBase.sol), [IIndexOracle.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/interfaces/IIndexOracle.sol). **Horizon reference:** [contracts/src/oracles/pragma_index_oracle.cairo](../contracts/src/oracles/pragma_index_oracle.cairo)

| Feature | Pendle V2 (reference) | Horizon | Status |
|---------|-----------|---------|--------|
| ERC-4626 direct | `SYBase` uses ERC-4626 `convertToAssets` ([SYBase.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/core/StandardizedYield/SYBase.sol)) | ✅ `is_erc4626` flag | ✅ |
| Custom oracle adapter | `IIndexOracle` adapter interface ([IIndexOracle.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/interfaces/IIndexOracle.sol)) | `PragmaIndexOracle` | ✅ |
| TWAP window | Adapter-specific (no standard config in `IIndexOracle`) ([IIndexOracle.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/interfaces/IIndexOracle.sol)) | Configurable (default 1hr) | ✅ **Horizon exceeds** |
| Staleness check | Adapter-specific (no standard config in `IIndexOracle`) ([IIndexOracle.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/interfaces/IIndexOracle.sol)) | `max_staleness` (default 24hr) | ✅ **Horizon exceeds** |
| Watermark (monotonic) | Oracle-specific expectation via `index()` ([IIndexOracle.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/interfaces/IIndexOracle.sol)) | ✅ `stored_index` | ✅ **Horizon exceeds** |
| Single-feed mode | Adapter-specific | ✅ `denominator_pair_id = 0` | ✅ **Horizon exceeds** |
| Dual-feed ratio mode | Adapter-specific | ✅ `numerator/denominator` | ✅ **Horizon exceeds** |
| Emergency pause | Adapter-specific | ✅ `PAUSER_ROLE` | ✅ **Horizon exceeds** |
| Emergency index override | Adapter-specific | ✅ `emergency_set_index()` | ✅ **Horizon exceeds** |
| RBAC for config changes | Adapter-specific | ✅ `OPERATOR_ROLE` | ✅ **Horizon exceeds** |
| Pragma integration | N/A (EVM) | ✅ Native | ✅ (Starknet-specific) |
| Rich events | Adapter-specific | ✅ `IndexUpdated`, `ConfigUpdated` | ✅ **Horizon exceeds** |

**Pendle note:** `IIndexOracle` only standardizes `index()`; TWAP window, staleness, and pause semantics are adapter-specific and not centralized.

**Horizon's PragmaIndexOracle Advantages:**

1. **Dual-Feed Ratio Mode** - Supports calculating ratios from two USD-denominated prices:
```cairo
// Horizon - calculate wstETH/stETH from WSTETH/USD ÷ STETH/USD
if denominator_pair == 0 {
    // Single-feed mode: convert price directly to index
    self._price_to_wad(num_price, num_decimals)
} else {
    // Dual-feed mode: calculate ratio
    self._calculate_ratio_wad(num_price, num_decimals, denom_price, denom_decimals)
}
```

2. **Full RBAC System** - Granular access control:
```cairo
// Horizon - role-based permissions
OPERATOR_ROLE: set_config (TWAP window, staleness)
PAUSER_ROLE: pause/unpause oracle
DEFAULT_ADMIN_ROLE: emergency_set_index (can only increase)
```

3. **Monotonic Watermark Enforcement** - Index can only increase, preventing yield theft:
```cairo
// Horizon - prevents decreasing index
assert(new_index >= old_index, 'HZN: cannot decrease index');
```

---

## 6.3 Market TWAP Oracle (Horizon: ~95% Implemented)

**What it does:** Provides manipulation-resistant TWAP prices for PT, YT, and LP tokens themselves.

**Horizon Implementation:** The TWAP oracle system is now fully implemented across three key files:

| File | Purpose | Size |
|------|---------|------|
| [`libraries/oracle_lib.cairo`](../contracts/src/libraries/oracle_lib.cairo) | Core TWAP library with ring buffer, binary search | 672 lines |
| [`market/amm.cairo`](../contracts/src/market/amm.cairo) (IMarketOracle) | Oracle storage and interface | 1773 lines total |
| [`oracles/py_lp_oracle.cairo`](../contracts/src/oracles/py_lp_oracle.cairo) | PT/YT/LP price helpers | 319 lines |

---

### 6.3.1 oracle_lib.cairo - TWAP Library

Core library for Time-Weighted Average Price calculations. Implements a circular buffer (ring buffer) of observations storing cumulative ln(implied rate). This is a direct port of Pendle's [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol) adapted for Cairo's storage model.

**Key Components:**

| Component | Type | Description |
|-----------|------|-------------|
| `Observation` | struct | `{ block_timestamp: u64, ln_implied_rate_cumulative: u256, initialized: bool }` - Single observation in the ring buffer |
| `InitializeResult` | struct | Return type for `initialize()` with observation and initial cardinality values |
| `WriteResult` | struct | Return type for `write()` with new observation, index, and cardinality |
| `SurroundingObservations` | struct | Two observations bracketing a target timestamp for interpolation |
| `GrowResult` | struct | Return type for `grow()` with new cardinality and slots to pre-initialize |

**Core Functions:**

| Function | Signature | Purpose |
|----------|-----------|---------|
| `initialize()` | `fn(timestamp: u64) -> InitializeResult` | Create first observation at market creation (slot 0) |
| `transform()` | `fn(last: Observation, block_timestamp: u64, ln_implied_rate: u256) -> Observation` | Accumulate rate over time delta: `cumulative += rate × Δt` |
| `write()` | `fn(last, index, timestamp, rate, cardinality, cardinality_next) -> WriteResult` | Add new observation, handle buffer wraparound, same-block no-op |
| `observe_single()` | `fn(time, target, newest, rate, surrounding) -> u256` | Query cumulative value at specific timestamp (with interpolation) |
| `observe()` | `fn(time, seconds_agos, newest, rate, surrounding_observations) -> Array<u256>` | Batch query for multiple timestamps |
| `get_surrounding_observations()` | `fn(target, newest, oldest, rate) -> Option<SurroundingObservations>` | Find bracketing observations (returns None if binary search needed) |
| `get_oldest_observation_index()` | `fn(index, cardinality, slot_initialized) -> u16` | Get physical index of oldest observation in ring buffer |
| `binary_search()` | `fn(observations, target, index, cardinality) -> SurroundingObservations` | Find surrounding observations when target is between oldest and newest |
| `grow()` | `fn(current: u16, next: u16) -> GrowResult` | Expand buffer capacity by pre-initializing slots |

**TWAP Calculation Flow:**

```
1. On every swap: write() adds new observation to ring buffer
   └─ Accumulates: cumulative += ln_implied_rate × time_delta

2. To query TWAP over duration D:
   └─ observe([D, 0]) returns [cumulative_past, cumulative_now]
   └─ TWAP = (cumulative_now - cumulative_past) / D

3. For past queries (seconds_ago > 0):
   └─ get_surrounding_observations() finds bracket
   └─ If None: binary_search() on ring buffer
   └─ observe_single() interpolates between surrounding observations
```

**Cairo-Specific Design:**

Unlike Solidity libraries that can take storage references, Cairo functions return values and the caller handles storage writes:

```cairo
// In Market contract - caller manages all storage
let result = oracle_lib::write(last, index, timestamp, old_rate, cardinality, cardinality_next);
self.observations.write(result.index, result.observation);
self.observation_index.write(result.index);
self.observation_cardinality.write(result.cardinality);
```

**Usage:** Called by Market contract ([amm.cairo](../contracts/src/market/amm.cairo)) on every swap to update observations. The `IMarketOracle` trait exposes `observe()` and `increase_observations_cardinality_next()` as external entrypoints.

**Tests:** Comprehensive coverage in [`contracts/tests/market/test_market_oracle.cairo`](../contracts/tests/market/test_market_oracle.cairo) (861 lines)

---

### 6.3.2 py_lp_oracle.cairo - PT/YT/LP Oracle Helper

Pre-deployed oracle contract providing Pendle-style TWAP queries for token pricing.
Stateless contract that queries Market's observation buffer.

**Reference (Pendle V2):** [PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol), [PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol), [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol)

**Horizon Implementation:** [`contracts/src/oracles/py_lp_oracle.cairo`](../contracts/src/oracles/py_lp_oracle.cairo) (319 lines)

**Functions:**

| Function | Description |
|----------|-------------|
| `get_pt_to_sy_rate(market, duration)` | PT price in SY terms using TWAP |
| `get_pt_to_asset_rate(market, duration)` | PT price in underlying asset terms |
| `get_yt_to_sy_rate(market, duration)` | YT price in SY terms |
| `get_yt_to_asset_rate(market, duration)` | YT price in underlying asset terms |
| `get_lp_to_sy_rate(market, duration)` | LP token price in SY terms |
| `get_lp_to_asset_rate(market, duration)` | LP token price in underlying asset terms |
| `get_ln_implied_rate_twap(market, duration)` | Raw TWAP of ln(implied rate) |
| `check_oracle_state(market, duration)` | Verify oracle readiness for queries |

**Formulas:**

- **PT to SY:** `exp(-ln_rate_twap * time_to_expiry / SECONDS_PER_YEAR)`
- **YT to SY:** `WAD - PT_to_SY` (before expiry), `0` (after expiry)
- **LP to SY:** `(SY_reserve + PT_reserve * PT_to_SY) / total_LP`
- **Asset rates:** Apply SY exchange rate with Pendle-style index adjustment:
  - If `sy_index >= py_index`: `rate_in_asset = rate_in_sy * sy_index / WAD`
  - If `sy_index < py_index`: `rate_in_asset = rate_in_sy * sy_index / py_index`

**Oracle Readiness Check:**

The `check_oracle_state()` function verifies TWAP query feasibility:
1. Calculates required cardinality: `(duration / MIN_BLOCK_TIME) + 1` where `MIN_BLOCK_TIME = 10`
2. Checks if `observation_cardinality_next >= cardinality_required`
3. Verifies oldest observation is at least `duration` seconds old

**Return Type:** `OracleReadinessState` struct with fields:
- `increase_cardinality_required: bool`
- `cardinality_required: u16`
- `oldest_observation_satisfied: bool`

**Tests:** Comprehensive coverage in [`contracts/tests/oracles/test_py_lp_oracle.cairo`](../contracts/tests/oracles/test_py_lp_oracle.cairo) (843 lines)

---

**Why it matters:** This oracle enables:
- Using PT as collateral in lending protocols (Aave, Compound forks)
- Using LP tokens as collateral
- DeFi derivatives and structured products
- External price feeds and aggregators

| Feature | Pendle V2 (reference) | Horizon (contracts/src) | Status |
|---------|-----------|---------|--------|
| Observation buffer | `OracleLib.Observation[65_535]` | `oracle_lib::Observation` struct + `Map<u16, Observation>` in market | ✅ Implemented |
| `lnImpliedRateCumulative` | `Observation.lnImpliedRateCumulative` (`uint216`) | `Observation.ln_implied_rate_cumulative` (`u256`) | ✅ Implemented |
| `observe(uint32[] secondsAgos)` | Market TWAP via `observations.observe` | `IMarketOracle::observe()` at `amm.cairo:1376-1435` | ✅ Implemented |
| `increaseObservationsCardinalityNext(uint16)` | Buffer expansion via `observations.grow` | `IMarketOracle::increase_observations_cardinality_next()` at `amm.cairo:1439-1456` | ✅ Implemented |
| `getOracleState(market, duration)` | Readiness check in PendlePYLpOracle | `PyLpOracle::check_oracle_state()` at `py_lp_oracle.cairo:152-205` | ✅ Implemented |
| `getPtToSyRate(duration)` | PendlePYOracleLib.getPtToSyRate | `PyLpOracle::get_pt_to_sy_rate()` at `py_lp_oracle.cairo:47-62` | ✅ Implemented |
| `getPtToAssetRate(duration)` | PendlePYOracleLib.getPtToAssetRate | `PyLpOracle::get_pt_to_asset_rate()` at `py_lp_oracle.cairo:117-122` | ✅ Implemented |
| `getYtToSyRate(duration)` | PendlePYOracleLib.getYtToSyRate | `PyLpOracle::get_yt_to_sy_rate()` at `py_lp_oracle.cairo:67-85` | ✅ Implemented |
| `getYtToAssetRate(duration)` | PendlePYOracleLib.getYtToAssetRate | `PyLpOracle::get_yt_to_asset_rate()` at `py_lp_oracle.cairo:125-130` | ✅ Implemented |
| `getLpToSyRate(duration)` | PendleLpOracleLib.getLpToSyRate | `PyLpOracle::get_lp_to_sy_rate()` at `py_lp_oracle.cairo:91-109` | ✅ Implemented |
| `getLpToAssetRate(duration)` | PendleLpOracleLib.getLpToAssetRate | `PyLpOracle::get_lp_to_asset_rate()` at `py_lp_oracle.cairo:139-144` | ✅ Implemented |
| Pre-deployed oracle contract | `PendlePYLpOracle` | `PyLpOracle` contract at `py_lp_oracle.cairo` | ✅ Implemented |
| MAX_CARDINALITY | 65,535 | 8,760 (1 year of hourly observations) at `amm.cairo:69` | ✅ Implemented |
| Test coverage | Various test files | 861 lines in `tests/market/test_market_oracle.cairo` | ✅ Implemented |
| Chainlink wrapper | `PendleChainlinkOracle` / `PendleChainlinkOracleWithQuote` | ❌ None | 🟡 Optional |
| `latestRoundData()` compatibility | Chainlink-style interface | ❌ None | 🟡 Optional |
| Reentrancy guard check | `_checkMarketReentrancy` in PendleLpOracleLib | ❌ None (Cairo's execution model provides inherent protection) | 🟢 N/A |

**Horizon now has full Market TWAP Oracle functionality**, enabling PT/YT/LP tokens to be used as collateral in lending protocols and other DeFi integrations.

---

## 6.4 Using the Market TWAP Oracle

This section documents the workflow for using the Market TWAP oracle for integrations.

### Initialization (happens at market creation)

When a market is created, the TWAP oracle is automatically initialized:

```cairo
// In Market constructor (amm.cairo:389-395)
let timestamp = get_block_timestamp();
let init_result = oracle_lib::initialize(timestamp);
self.observations.write(0_u16, init_result.observation);
self.observation_index.write(0_u16);
self.observation_cardinality.write(init_result.cardinality);
self.observation_cardinality_next.write(init_result.cardinality_next);
```

This sets up the ring buffer with an initial observation and cardinality of 1.

### Expanding Cardinality (optional, for longer TWAP windows)

The default cardinality is 1, which only supports very short TWAP windows. To enable longer TWAP durations (e.g., 30 minutes, 1 hour), expand the observation buffer:

```cairo
let oracle = IMarketOracleDispatcher { contract_address: market };
oracle.increase_observations_cardinality_next(desired_cardinality);
```

**Note:** Cardinality expansion takes effect after the next trade/liquidity operation that writes a new observation.

### Querying TWAP

Use the `PyLpOracle` contract to query manipulation-resistant TWAP prices:

```cairo
let py_lp_oracle = IPyLpOracleDispatcher { contract_address: oracle_address };

// Get PT price in terms of SY (30-minute TWAP)
let pt_rate = py_lp_oracle.get_pt_to_sy_rate(market, 1800);

// Get PT price in terms of underlying asset
let pt_asset_rate = py_lp_oracle.get_pt_to_asset_rate(market, 1800);

// Get LP price in terms of SY
let lp_rate = py_lp_oracle.get_lp_to_sy_rate(market, 1800);

// Get YT price in terms of SY
let yt_rate = py_lp_oracle.get_yt_to_sy_rate(market, 1800);
```

### Checking Oracle Readiness

Before querying TWAP, verify the oracle has sufficient historical data:

```cairo
let state = py_lp_oracle.check_oracle_state(market, duration);
// Check state.oldest_observation_satisfied and !state.increase_cardinality_required
```

**OracleReadinessState fields:**
- `increase_cardinality_required`: true if buffer needs to be grown
- `cardinality_required`: minimum cardinality needed for duration
- `oldest_observation_satisfied`: true if oldest observation is old enough

### Integration Example (Lending Protocol)

```cairo
// In a lending protocol's price oracle
fn get_pt_collateral_value(market: ContractAddress, pt_amount: u256) -> u256 {
    let oracle = IPyLpOracleDispatcher { contract_address: self.py_lp_oracle.read() };

    // Check oracle is ready for 30-minute TWAP
    let state = oracle.check_oracle_state(market, 1800);
    assert(!state.increase_cardinality_required, 'Cardinality too low');
    assert(state.oldest_observation_satisfied, 'Oracle not ready');

    // Get manipulation-resistant PT price
    let pt_to_asset_rate = oracle.get_pt_to_asset_rate(market, 1800);

    // Calculate collateral value
    wad_mul(pt_amount, pt_to_asset_rate)
}
```

---

## 6.5 Oracle System Summary

| Oracle Component | Pendle V2 (reference) | Horizon (contracts/src) | Implementation Priority |
|-----------------|-----------|---------|------------------------|
| Yield Index Oracle | `SYBase` + `IIndexOracle` ([SYBase.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/core/StandardizedYield/SYBase.sol), [IIndexOracle.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/interfaces/IIndexOracle.sol)) | ✅ `PragmaIndexOracle` ([contracts/src/oracles/pragma_index_oracle.cairo](../contracts/src/oracles/pragma_index_oracle.cairo)) | Done |
| Market Observation Buffer | `OracleLib.Observation[65_535]` ([OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol)) | ✅ `oracle_lib::Observation` + `Map<u16, Observation>` in [amm.cairo](../contracts/src/market/amm.cairo) | Done |
| PT TWAP Functions | `PendlePYOracleLib.getPtToSyRate/getPtToAssetRate` ([PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol)) | ✅ `get_pt_to_sy_rate()`, `get_pt_to_asset_rate()` in [py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo) | Done |
| YT TWAP Functions | `PendlePYOracleLib.getYtToSyRate/getYtToAssetRate` ([PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol)) | ✅ `get_yt_to_sy_rate()`, `get_yt_to_asset_rate()` in [py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo) | Done |
| LP TWAP Functions | `PendleLpOracleLib.getLpToSyRate/getLpToAssetRate` ([PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol)) | ✅ `get_lp_to_sy_rate()`, `get_lp_to_asset_rate()` in [py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo) | Done |
| Oracle State Check | `getOracleState` in [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol) | ✅ `check_oracle_state()` in [py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo) | Done |
| Pre-deployed Oracle | [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol) | ✅ `PyLpOracle` contract in [py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo) | Done |
| getLnImpliedRateTwap | `getOracleState` return in [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol) | ✅ `get_ln_implied_rate_twap()` in [py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo) | Done |
| Chainlink/Pragma Wrapper | [PendleChainlinkOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracle.sol) / [PendleChainlinkOracleWithQuote.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleWithQuote.sol) | ❌ None | 🟡 Optional |
| Oracle Factory | [PendleChainlinkOracleFactory.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleFactory.sol) | ❌ None | 🟡 Optional |

**Implementation:** [`contracts/src/oracles/py_lp_oracle.cairo`](../contracts/src/oracles/py_lp_oracle.cairo)
**Tests:** [`contracts/tests/oracles/test_py_lp_oracle.cairo`](../contracts/tests/oracles/test_py_lp_oracle.cairo) (843 lines)

**Total Oracle Gaps: 2** (0 CRITICAL, 0 HIGH, 2 OPTIONAL)

**Oracle Capabilities:**
- ✅ PT can be used as collateral in lending protocols
- ✅ LP can be used as collateral in lending protocols
- ✅ Manipulation-resistant TWAP price feeds for external integrations
- ✅ Ready for Aave, Compound, and fork integrations
- ✅ Can build derivatives or structured products on Horizon tokens

---
