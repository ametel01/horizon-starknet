# Implementation Plan: Core AMM Curve (MarketMathCore) - Section 2.1

**Source:** `docs/PENDLE_GAP_ANALYSIS_REPORT.md` Section 2.1
**Baseline cross-check:** `pendle-core-v2-public`
- `contracts/core/Market/MarketMathCore.sol`
- `contracts/core/Market/PendleMarketV6.sol`
- `contracts/core/Market/PendleMarketFactoryV6Upg.sol`
**Target files:** `contracts/src/market/market_math.cairo`, `contracts/src/market/market_math_fp.cairo`,
`contracts/src/market/amm.cairo`, `contracts/src/market/market_factory.cairo`,
`contracts/src/interfaces/i_market_factory.cairo`, `contracts/src/libraries/math.cairo`,
`contracts/src/libraries/math_fp.cairo`

---

## Accuracy corrections vs Pendle
- Use YT PYIndex (`update_py_index` / `py_index_current`) rather than SY exchange rate. Pendle gets `PYIndex` from `YT.newIndex()`.
- `reserveFeePercent` is base-100 (uint8), not WAD. Fees are split in asset terms and the reserve fee is transferred to treasury per swap.
- Fee decay uses `lnFeeRateRoot` in log space: `feeRate = exp(lnFeeRateRoot * timeToExpiry / 365d)` (no `- 1`). Fee math is asymmetric for buy vs sell.
- Pendle always reverts on `proportion > 0.96` and `exchangeRate < 1`, no optional clamping.
- Minimum liquidity is minted to `address(1)` in Pendle. Horizon already does this; no change required.
- Conversions must use `assetToSyUp()` when the net asset flow to account is negative.

---

## Priority Summary

| Gap | Priority | Complexity | Est. LOC |
|-----|----------|------------|----------|
| PYIndex integration + asset-based trade core | HIGH | High | ~220 |
| Signed netPT/netSY path + rounding parity | HIGH | High | ~140 |
| lnFeeRateRoot + reserveFeePercent + treasury wiring | HIGH | Medium | ~120 |
| Bounds enforcement (revert) | MEDIUM | Low | ~30 |
| setInitialLnImpliedRate + implied-rate update path | MEDIUM | Medium | ~60 |

---

## Step 1: PYIndex integration + asset-based trade core **COMPLETE**

### 1.1 Add PYIndex to in-memory MarketState (math only) **COMPLETE**
**Files:** `contracts/src/market/market_math_fp.cairo`, `contracts/src/market/market_math.cairo`

Add `py_index` to `MarketState` used by math helpers. This is not storage; it is populated in `amm.cairo` per call.

```cairo
pub struct MarketState {
    pub sy_reserve: u256,
    pub pt_reserve: u256,
    pub total_lp: u256,
    pub scalar_root: u256,
    pub initial_anchor: u256,
    pub ln_fee_rate_root: u256, // replaces fee_rate
    pub reserve_fee_percent: u8, // base-100
    pub expiry: u64,
    pub last_ln_implied_rate: u256,
    pub py_index: u256, // SY -> asset index (YT)
}
```

Validate: compile and update `_get_market_state()` call sites in `contracts/src/market/amm.cairo` to pass `py_index`.
Failure modes: forgetting to plumb `py_index` produces price drift vs Pendle.

### 1.2 Add asset conversion helpers + round-up division **COMPLETE**
**Files:** `contracts/src/libraries/math.cairo`, `contracts/src/libraries/math_fp.cairo`

Add `wad_div_up()` and conversion helpers in both math libraries:

```cairo
pub fn wad_div_up(a: u256, b: u256) -> u256 {
    assert(b != 0, Errors::MATH_DIVISION_BY_ZERO);
    if a == 0 { return 0; }
    (a * WAD + b - 1) / b
}

pub fn sy_to_asset(sy: u256, py_index: u256) -> u256 { wad_mul(sy, py_index) }
pub fn asset_to_sy(asset: u256, py_index: u256) -> u256 { wad_div(asset, py_index) }
pub fn asset_to_sy_up(asset: u256, py_index: u256) -> u256 { wad_div_up(asset, py_index) }
```

Validate: add a small unit test to confirm `asset_to_sy_up` rounds correctly.
Failure modes: missing round-up for negative flows causes undercharging on buys.

### 1.3 Introduce MarketPreCompute parity **COMPLETE**
**Files:** `contracts/src/market/market_math_fp.cairo`, `contracts/src/market/market_math.cairo`

Add `total_asset` + `fee_rate` to `MarketPreCompute`, and compute them with Pendle's logic:

```cairo
pub struct MarketPreCompute {
    pub rate_scalar: u256,
    pub total_asset: u256,
    pub rate_anchor: u256,
    pub rate_anchor_is_negative: bool,
    pub fee_rate: u256,
}
```

`get_market_pre_compute()` should:
- revert if `total_pt == 0` or `total_asset == 0`
- compute `rate_anchor` from `last_ln_implied_rate` + `total_asset`
- compute `fee_rate = exp(ln_fee_rate_root * timeToExpiry / SECONDS_PER_YEAR)` (no -1)

Validate: add a test that `fee_rate` matches `exp_wad(ln_fee_rate_root)` when timeToExpiry == 1y.
Failure modes: using linear fee or `-1` yields incorrect fee asymmetry.

### 1.4 Add signed trade core to mirror `calcTrade` **COMPLETE**
**Files:** `contracts/src/market/market_math_fp.cairo`, `contracts/src/market/market_math.cairo`

Introduce a small signed helper for `net_pt_to_account` and `net_asset_to_account` (magnitude + sign). Use it to implement Pendle's `calcTrade` formula, including asymmetric fee:

```cairo
// net_pt_to_account > 0 => user buys PT
if net_pt_to_account.is_positive() {
    post_fee_exchange_rate = pre_fee_exchange_rate / fee_rate;
    assert(post_fee_exchange_rate >= WAD, Errors::MARKET_RATE_BELOW_ONE);
    fee = pre_fee_asset_to_account * (WAD - fee_rate);
} else {
    fee = -((pre_fee_asset_to_account * (WAD - fee_rate)) / fee_rate);
}

net_asset_to_reserve = fee * reserve_fee_percent / 100;
net_asset_to_account = pre_fee_asset_to_account - fee;

net_sy_to_account = net_asset_to_account.is_negative()
    ? asset_to_sy_up(net_asset_to_account.abs(), py_index)
    : asset_to_sy(net_asset_to_account.abs(), py_index);
```

Validate: add golden tests for buy vs sell (fee asymmetry) at a fixed `fee_rate`.
Failure modes: sign errors will invert fee direction or leak value.

### 1.5 Map Horizon's four swap helpers to the signed trade core **COMPLETE**
**Files:** `contracts/src/market/market_math_fp.cairo`, `contracts/src/market/market_math.cairo`

- `calc_swap_exact_pt_for_sy`: `net_pt_to_account = -exact_pt_in`
- `calc_swap_sy_for_exact_pt`: solve for `net_pt_to_account = +exact_pt_out`
- `calc_swap_exact_sy_for_pt`: binary search on `net_pt_to_account` using the trade core
- `calc_swap_pt_for_exact_sy`: binary search on `net_pt_to_account` using the trade core

Validate: update existing swap tests to pass with PYIndex conversion on.
Failure modes: binary search must use asset-based math or it will drift.

### 1.6 Add `set_initial_ln_implied_rate` and update implied-rate path **COMPLETE**
**Files:** `contracts/src/market/market_math_fp.cairo`, `contracts/src/market/market_math.cairo`,
`contracts/src/market/amm.cairo`

Add a function equivalent to Pendle's `setInitialLnImpliedRate(market, index, initialAnchor, blockTime)` and call it only on first mint (when total LP == 0). Remove the constructor-time `last_ln_implied_rate = initial_anchor` shortcut.

Validate: a test that first mint sets `last_ln_implied_rate` based on `py_index` and `initial_anchor`.
Failure modes: keeping the old shortcut will desync from Pendle on day-0 markets.

---

## Step 2: Fee config + treasury wiring (PendleFactory parity)

### 2.1 Add market config to MarketFactory **COMPLETE**
**Files:** `contracts/src/market/market_factory.cairo`, `contracts/src/interfaces/i_market_factory.cairo`

Add Pendle-style config:
- `treasury: ContractAddress`
- `reserve_fee_percent: u8` (0-100)
- `overridden_fee: Map<(router, market), u256>` for per-router `ln_fee_rate_root`

Expose `get_market_config(market, router) -> (treasury, overridden_fee, reserve_fee_percent)`.

Validate: unit test that overrides are returned and default to 0.
Failure modes: override fee must be strictly less than market's base fee.

### 2.2 Switch market constructor and state to lnFeeRateRoot **COMPLETE**
**Files:** `contracts/src/market/amm.cairo`, `contracts/src/market/market_factory.cairo`

- Replace `fee_rate` with `ln_fee_rate_root` everywhere.
- Update `create_market()` signature to accept `ln_fee_rate_root`.
- Enforce `ln_fee_rate_root <= ln(1.05)` and `initial_anchor >= 1 WAD` (Pendle bounds).

Validate: test that invalid parameters revert.
Failure modes: wrong bounds allow unsafe fee curves.

### 2.3 Pull fee config per swap and transfer reserve fees immediately
**Files:** `contracts/src/market/amm.cairo`

- Build `MarketState` using the effective `ln_fee_rate_root` (overridden fee if present).
- Call the trade core to get `(net_sy_to_account, net_sy_fee, net_sy_to_reserve)`.
- Transfer `net_sy_to_reserve` directly to treasury each swap (Pendle behavior).
- Remove `total_fees_collected` or repurpose it to track LP fees only.

Validate: integration test that treasury receives reserve fee on each swap.
Failure modes: accumulating fees in-contract deviates from Pendle and breaks fee accounting.

---

## Step 3: Bounds + rounding parity

### 3.1 Enforce bounds and exchange-rate floor (no clamp)
**Files:** `contracts/src/market/market_math_fp.cairo`, `contracts/src/market/market_math.cairo`

Replace clamping with reverts:
- if `proportion > MAX_PROPORTION` revert
- if `exchange_rate < WAD` revert

Validate: tests that previously clamped cases now revert.
Failure modes: leaving clamps will still diverge from Pendle.

### 3.2 Use rawDivUp-style rounding for liquidity math
**Files:** `contracts/src/market/market_math_fp.cairo`, `contracts/src/market/market_math.cairo`

In `calc_mint_lp` and any proportional calculations, use `wad_div_up` for the "other side" amount, mirroring Pendle's `rawDivUp()`.

Validate: tests for minting when `ptDesired` or `syDesired` is just above the ratio.
Failure modes: rounding down allows minting with insufficient counterpart.

---

## Step 4: Mirror changes to `market_math.cairo`
Ensure every change in `market_math_fp.cairo` is mirrored in `market_math.cairo`, including helpers, precompute, signed trade core, and rounding behavior.

Validate: run unit tests against both math paths.
Failure modes: inconsistent math paths lead to mismatched swaps depending on configuration.

---

## Test Plan (incremental)
| Step | Tests |
|------|-------|
| Step 1.2 | `test_asset_to_sy_up_rounding` |
| Step 1.4 | `test_trade_fee_asymmetry_buy_vs_sell` |
| Step 1.5 | `test_swap_exact_sy_for_pt_matches_core` |
| Step 1.6 | `test_initial_ln_implied_rate` |
| Step 2.1 | `test_market_config_override_fee` |
| Step 2.3 | `test_reserve_fee_sent_to_treasury` |
| Step 3.1 | `test_exchange_rate_bounds_revert` |
| Step 3.2 | `test_mint_rounds_up_sy_or_pt` |

---

## Test File Mapping (checked against `contracts/tests/`)
- `test_asset_to_sy_up_rounding`: `contracts/tests/math/test_math_fp.cairo` and `contracts/tests/math/test_math.cairo`
- `test_trade_fee_asymmetry_buy_vs_sell`: `contracts/tests/math/test_market_math_fp.cairo` and `contracts/tests/math/test_market_math.cairo`
- `test_swap_exact_sy_for_pt_matches_core`: `contracts/tests/math/test_market_math_fp.cairo` and `contracts/tests/math/test_market_math.cairo`
- `test_initial_ln_implied_rate`: `contracts/tests/market/test_market_first_depositor.cairo`
- `test_market_config_override_fee`: `contracts/tests/market/test_market_factory.cairo`
- `test_reserve_fee_sent_to_treasury`: `contracts/tests/market/test_market_fees.cairo`
- `test_exchange_rate_bounds_revert`: `contracts/tests/math/test_market_math_fp.cairo` and `contracts/tests/math/test_market_math.cairo`
- `test_mint_rounds_up_sy_or_pt`: `contracts/tests/math/test_market_math_fp.cairo` and `contracts/tests/math/test_market_math.cairo`

**Naming convention check:** The repo uses suite modules (`contracts/tests/math.cairo`, `contracts/tests/market.cairo`) that import subdir files named `test_*.cairo`. Keep new tests inside existing files or add new `test_*.cairo` files and register them in the suite module. The top-level guideline (`contracts/tests/test_*.cairo`) is not consistently followed in current structure, so align with the existing subdirectory pattern for clarity.

---

## Breaking Changes
- Market constructor signature changes (`fee_rate` -> `ln_fee_rate_root`).
- MarketFactory interface and storage change (treasury + reserve fee + overrides).
- Market math functions return extra values for fee splits.
- Existing deployed markets cannot be upgraded in place.

**Migration:** Deploy new market contracts and factory; update router and front-end addresses.

---

## References
- Pendle MarketMathCore: `pendle-core-v2-public/contracts/core/Market/MarketMathCore.sol`
- Pendle Market: `pendle-core-v2-public/contracts/core/Market/PendleMarketV6.sol`
- Pendle MarketFactory: `pendle-core-v2-public/contracts/core/Market/PendleMarketFactoryV6Upg.sol`
- Gap Analysis: `docs/PENDLE_GAP_ANALYSIS_REPORT.md` Section 2.1
