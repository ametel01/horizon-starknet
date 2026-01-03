# TWAP Oracle Integration Specification (Research Notes)

**Status:** Research complete | **Priority:** CRITICAL
**Gap Reference:** `docs/PENDLE_GAP_ANALYSIS_REPORT.md` Section 2.2

---

## 0. Scope and Sources (authoritative)

All statements below are derived from the code linked here.

**Horizon (verified in repo)**
- `contracts/src/market/amm.cairo`
- `contracts/src/interfaces/i_market.cairo`
- `contracts/src/oracles/pragma_index_oracle.cairo`

**Pendle (authoritative references)**
- `OracleLib.sol`: https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol
- `PendleMarketV6.sol`: https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol
- `IPMarket.sol`: https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/interfaces/IPMarket.sol
- `PendlePYOracleLib.sol`: https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol
- `PendleLpOracleLib.sol`: https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol
- `PendlePYLpOracle.sol`: https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol
- Optional adapters:
  - https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleFactory.sol
  - https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracle.sol
  - https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleWithQuote.sol

---

## 1. Observed Horizon State (verified)

- Market storage has only a spot `last_ln_implied_rate`; no observation buffer exists in `contracts/src/market/amm.cairo`.
- `_update_implied_rate` updates the spot value only when the rate changes and does not record any history.
- `IMarket` exposes no `observe`, `increaseObservationsCardinalityNext`, or `observations` view helpers in `contracts/src/interfaces/i_market.cairo`.
- The only oracle contract is `PragmaIndexOracle` (SY index TWAP adapter), not a market TWAP source (`contracts/src/oracles/pragma_index_oracle.cairo`).
- There is no PT/YT/LP TWAP helper contract in `contracts/src/oracles`.

Evidence (short excerpt from `contracts/src/market/amm.cairo`):
```cairo
struct Storage {
    // ...
    last_ln_implied_rate: u256,
    // ...
}

fn _update_implied_rate(ref self: ContractState) {
    let old_rate = self.last_ln_implied_rate.read();
    let state = self._get_market_state();
    let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());
    let new_rate = get_ln_implied_rate(@state, time_to_expiry);

    if new_rate != old_rate {
        self.last_ln_implied_rate.write(new_rate);
        // emits ImpliedRateUpdated
    }
}
```

---

## 2. Pendle Baseline (verified behavior)

### 2.1 Observation buffer (OracleLib + PendleMarketV6)

From `OracleLib.sol` and `PendleMarketV6.sol`:
- `Observation` fields are `uint32 blockTimestamp`, `uint216 lnImpliedRateCumulative`, `bool initialized`.
- `initialize()` writes slot 0 and returns `(cardinality=1, cardinalityNext=1)`.
- `write()`:
  - uses the **previous stored** `lastLnImpliedRate` and `block.timestamp` to update cumulative values,
  - skips writes when the same timestamp is seen again,
  - grows cardinality when `cardinalityNext > cardinality` and the index reaches the end.
- `observe()`:
  - returns cumulative values for each `secondsAgo`,
  - linearly interpolates between surrounding observations,
  - reverts `OracleZeroCardinality` if uninitialized or `OracleTargetTooOld` when the target is older than the oldest observation.
- `grow()` pre-initializes slots with `blockTimestamp = 1` and `initialized = false` to avoid fresh SSTORE costs during swaps.

Pendle market usage:
- `PendleMarketV6` calls `observations.initialize(uint32(block.timestamp))` in the constructor.
- `_writeState` calls `observations.write(...)` **before** updating `_storage.lastLnImpliedRate`, then persists the new rate.
- `observe(uint32[] secondsAgos)` and `increaseObservationsCardinalityNext(uint16)` are public.

### 2.2 PT/YT/LP TWAP helpers (PendlePYOracleLib + PendleLpOracleLib)

From `PendlePYOracleLib.sol` and `PendleLpOracleLib.sol`:
- `getMarketLnImpliedRate(duration)` calls `market.observe([duration, 0])` and computes:
  `(cumulative[1] - cumulative[0]) / duration`.
- `duration == 0` reads `market._storage().lastLnImpliedRate` directly.
- PT/YT rates use `MarketMathCore._getExchangeRateFromImpliedRate` and SY/PY index guards.
- LP rates use `readState`, `getMarketLnImpliedRate`, and a hypothetical trade to approximate LP value.

From `PendlePYLpOracle.sol`:
- `getOracleState` computes required cardinality using `blockCycleNumerator` and checks the oldest observation timestamp.
- The oracle records one observation per timestamp (this is why `blockCycleNumerator >= 1000`).

---

## 3. Gap Summary (Horizon vs Pendle)

- No observation ring buffer or OracleLib-equivalent helpers in the market contract.
- No market `observe` or `increaseObservationsCardinalityNext` entrypoints.
- No `observations(index)` / `_storage()` view helpers expected by Pendle oracle wrappers.
- No PT/YT/LP TWAP helpers or wrapper contract.

---

## 4. Integration Requirements (Pendle parity, no assumptions)

### 4.1 Market storage + initialization
- Add observation storage and metadata to `contracts/src/market/amm.cairo`:
  - `observations` (ring buffer keyed by `u16` or fixed array equivalent)
  - `observation_index`, `observation_cardinality`, `observation_cardinality_next`
- Initialize the buffer from the constructor using Pendle semantics:
  - `initialize(timestamp)` yields `(cardinality=1, cardinalityNext=1)` and writes slot 0.

### 4.2 State write path (critical for correctness)
- On every state update that currently calls `_update_implied_rate`, also call `oracle_lib.write` using:
  - current block timestamp,
  - **stored** `last_ln_implied_rate` (previous value),
  - current index/cardinality values.
- Mirror Pendle ordering: write observation first, then overwrite `last_ln_implied_rate`.
- Preserve the "same-block no-op" behavior.

### 4.3 Market API surface (to match Pendle helpers)
- Add `observe(seconds_agos: Array<u32>) -> Array<u256>` with OracleLib-compatible semantics.
- Add `increase_observations_cardinality_next(cardinality_next: u16)` (public, not admin-only, to match Pendle).
- Add `observations(index)` and `_storage()` view equivalents if `PYLpOracle` parity is required.

### 4.4 Oracle library port
- Implement `oracle_lib.cairo` to mirror `OracleLib.sol`:
  - `transform`, `write`, `observeSingle`, `observe`, `binarySearch`, `getSurroundingObservations`, `grow`.
- Keep the same error cases (`OracleZeroCardinality`, `OracleTargetTooOld`).
- Pendle uses `uint32` timestamps and `uint96/uint216` rate fields; Cairo can store `u64/u256` but must preserve the same math and overflow assumptions.

### 4.5 PT/YT/LP oracle helpers
- Implement `py_lp_oracle.cairo` equivalent to `PendlePYOracleLib` + `PendleLpOracleLib` and wrap it in a `PendlePYLpOracle`-style contract.
- Preserve `observe([duration, 0])` ordering and the `duration == 0` spot path.
- Use existing Horizon math (`market_math.get_pt_price` and related helpers) as the analog to Pendle's `MarketMathCore._getExchangeRateFromImpliedRate`.
- If implementing `getOracleState`, match Pendle's `blockCycleNumerator` and cardinality sizing formula.

---

## 5. Optional adapters (separate from the core gap)

- Chainlink-style adapters are optional and can follow the Pendle reference implementations listed above.

---

## 6. Minimal acceptance checklist (post-implementation)

- `observe()` matches OracleLib interpolation and reverts when history is too old.
- `increaseObservationsCardinalityNext()` grows buffers without corrupting observations.
- PT/YT/LP TWAP rates match Pendle formulas for identical inputs.
