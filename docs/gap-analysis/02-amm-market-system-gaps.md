# 2. AMM/Market System Gaps

## 2.1 Core AMM Curve (MarketMathCore)

**Implementation Status: 100%** (Core curve math, PYIndex integration, Pendle-style fee decay + reserve split, bounds/rounding parity, signed math, and initial implied-rate initialization implemented)

**Reference:** Pendle's `MarketMathCore.sol` from [pendle-core-v2-public](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/MarketMathCore.sol)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Logit-based curve | `ln(p/(1-p))/scalar + anchor` | Same formula | ✅ |
| Rate scalar time decay | `scalarRoot * 365d / timeToExpiry` | Same formula | ✅ |
| Rate anchor continuity | Anchor derived from `lastLnImpliedRate` each trade | Same pattern | ✅ |
| `MINIMUM_LIQUIDITY` | 1000 | 1000 | ✅ |
| `MAX_MARKET_PROPORTION` | 96% | 96% (FP + WAD) | ✅ |
| Proportion bound enforcement | Revert if `proportion > MAX_MARKET_PROPORTION` | Revert (`MARKET_PROPORTION_TOO_HIGH`) | ✅ |
| Exchange-rate lower bound | Revert if `exchangeRate < 1` | Revert (`MARKET_RATE_BELOW_ONE`) | ✅ |
| PT price convergence | Approaches 1 at expiry | Approaches 1 at expiry | ✅ |
| Dual math implementations | N/A | WAD + cubit FP | ✅ **Horizon exceeds** |
| Swap variants in core math | 2 wrappers (exact PT in / exact PT out) | 4 (all combinations) | ✅ **Horizon exceeds** |
| PYIndex integration | `syToAsset()`, `assetToSy()`, `assetToSyUp()` | ✅ Asset-based via `py_index` | ✅ |
| Reserve fee splitting | `reserveFeePercent`, `netSyToReserve` | ✅ `net_sy_to_reserve` + `reserve_fee_percent` | ✅ |
| Treasury address | `address treasury` in MarketState | ✅ Factory treasury queried by Market | ✅ |
| Initial liquidity recipient | `MINIMUM_LIQUIDITY` to reserve (treasury) | Treasury if set; dead address fallback | ✅ |
| Signed integer arithmetic | `int256` for netPtToAccount | ✅ `SignedValue` (mag + sign) | ✅ |
| Fee formula | `exp(lnFeeRateRoot * timeToExpiry / 365d)` | ✅ `get_fee_rate()` with exp | ✅ |
| Rounding protection | `rawDivUp()` on sy/pt used; `assetToSyUp()` for negative | ✅ `asset_to_sy_up()` on negative | ✅ |
| `setInitialLnImpliedRate()` | Explicit init using `PYIndex` + `initialAnchor` | ✅ `set_initial_ln_implied_rate()` in first mint | ✅ |

---

**Authoritative Flow (Code-Verified):**

- `contracts/src/market/amm.cairo` is the on-chain entry point for swaps/mints/burns and calls
  `contracts/src/market/market_math_fp.cairo` for all pricing math.
- `contracts/src/market/market_math.cairo` mirrors the curve in WAD and is used in tests/off-chain
  checks; it is kept in parity with the FP path.

---

**Implementation Detail - PYIndex Integration (COMPLETED):**

Horizon now mirrors Pendle's asset-based math. `MarketState` carries `py_index`, and core math
converts SY to asset value before pricing, then converts back using `asset_to_sy`/`asset_to_sy_up`.

Code-verified:
- `contracts/src/market/market_math.cairo`: `MarketState.py_index`, `sy_to_asset` in `get_proportion`,
  `asset_to_sy`/`asset_to_sy_up` in trade output conversion.
- `contracts/src/market/market_math_fp.cairo`: same asset-based flow for the FP math path.
- `contracts/src/market/amm.cairo`: `_get_market_state*` loads `py_index` from YT (`update_py_index` for
  swaps, `py_index_current` for views).

**Result:** PT pricing is based on underlying asset value (Pendle-equivalent), not raw SY balance.

---

**Implementation Detail - Reserve Fee System + Treasury Wiring (COMPLETED):**

Horizon now splits fees into LP + reserve portions and wires treasury via MarketFactory, matching
Pendle's fee flow.

Code-verified:
- `contracts/src/market/market_math.cairo` and `contracts/src/market/market_math_fp.cairo`:
  `MarketState.reserve_fee_percent` and trade outputs include `net_sy_fee` + `net_sy_to_reserve`.
- `contracts/src/market/market_factory.cairo`:
  `treasury`, `default_reserve_fee_percent`, per-router `ln_fee_rate_root` overrides, and
  `get_market_config()` returning `{ treasury, ln_fee_rate_root, reserve_fee_percent }`.
- `contracts/src/market/amm.cairo`:
  `_get_market_state_with_effective_fee()` pulls factory config (router overrides + default reserve
  fee), `_get_effective_reserve_fee()` checks treasury, and `_transfer_reserve_fee_to_treasury()`
  transfers reserve fees immediately and emits `ReserveFeeTransferred`.

**Result:** Reserve fees are carved out of trades and sent to treasury (if configured). When the
factory or treasury is zero, the reserve portion stays in the pool as LP fees (Pendle-compatible
fallback semantics).

**See:** `market_math.cairo:317, 410-432` and `amm.cairo:554-569, 638-653, 721-736, 804-819, 1208-1275`

| Feature | Status | Implementation |
|---------|--------|----------------|
| Reserve fee splitting | ✅ Implemented | `net_sy_to_reserve` in trade outputs |
| Fee transfer to treasury | ✅ Implemented | `_transfer_reserve_fee_to_treasury()` |
| ReserveFeeTransferred event | ✅ Implemented | Emitted on every swap |
| Effective fee calculation | ✅ Implemented | `_get_effective_reserve_fee()` |

---

**Implementation Detail - Bounds + Rounding Parity (COMPLETED):**

Pendle's hard bounds and rounding behavior are now enforced in both FP and WAD paths.

Code-verified:
- `contracts/src/market/market_math_fp.cairo` + `contracts/src/market/market_math.cairo`:
  `MAX_PROPORTION` hard-asserted in `get_rate_anchor`, `get_exchange_rate`, and
  `get_ln_implied_rate`; exchange rate reverts if `< 1`.
- Signed anchor handling via `(rate_anchor, rate_anchor_is_negative)` aligns with Pendle's signed
  arithmetic in logit/anchor composition.
- `asset_to_sy_up()` is used when net asset to account is negative (rounding against the trader).
- Exact-output paths assert infeasible trades via `MARKET_INFEASIBLE_TRADE`.

**Result:** Horizon now rejects out-of-bounds trades and matches Pendle's rounding bias.

---

**Implementation Detail - Minimum Liquidity Recipient (COMPLETED):**

Pendle mints `MINIMUM_LIQUIDITY` to the reserve (treasury) on first mint:
```solidity
// Pendle - protocol gets LP tokens on add liquidity
function addLiquidityCore(...) returns (
    int256 lpToReserve,   // LP to protocol treasury
    int256 lpToAccount,   // LP to user
    int256 syUsed,
    int256 ptUsed
) {
    if (market.totalLp == 0) {
        lpToAccount = sqrt(sy * pt) - MINIMUM_LIQUIDITY;
        lpToReserve = MINIMUM_LIQUIDITY;  // Protocol gets minimum
    }
    // ...
    market.totalLp += lpToAccount + lpToReserve;
}
```

Horizon mints `MINIMUM_LIQUIDITY` to treasury when configured (factory-backed markets),
falling back to a dead address if treasury is unset:
```cairo
// Horizon - first mint locks MINIMUM_LIQUIDITY to treasury (or dead address fallback)
if is_first_mint {
    let recipient = self._get_minimum_liquidity_recipient();
    self.erc20.mint(recipient, MINIMUM_LIQUIDITY);
}
```

**Result:** Factory-backed markets now match Pendle by minting the minimum liquidity to
treasury. Standalone markets (no factory/treasury) still lock it to a dead address.

---

## 2.2 TWAP Oracle (Implemented)

The Market TWAP Oracle is implemented in three key files:

| File | Purpose | Size |
|------|---------|------|
| [`libraries/oracle_lib.cairo`](../contracts/src/libraries/oracle_lib.cairo) | Core TWAP library with ring buffer, binary search | ~670 lines |
| [`market/amm.cairo`](../contracts/src/market/amm.cairo) (IMarketOracle) | Oracle storage and interface | ~110 lines |
| [`oracles/py_lp_oracle.cairo`](../contracts/src/oracles/py_lp_oracle.cairo) | PT/YT/LP price helpers | ~320 lines |

**Implementation Status: ~95%**

| Feature | Status | Location |
|---------|--------|----------|
| Observation struct | ✅ | `oracle_lib.cairo:26-33` |
| initialize() | ✅ | `oracle_lib.cairo:72-80` |
| transform() | ✅ | `oracle_lib.cairo:112-124` |
| write() | ✅ | `oracle_lib.cairo:185-217` |
| observe_single() | ✅ | `oracle_lib.cairo:274-318` |
| observe() batch | ✅ | `oracle_lib.cairo:348-374` |
| get_surrounding_observations() | ✅ | `oracle_lib.cairo:416-448` |
| get_oldest_observation_index() | ✅ | `oracle_lib.cairo:471-482` |
| binary_search() | ✅ | `oracle_lib.cairo:615-672` |
| grow() | ✅ | `oracle_lib.cairo:542-572` |
| IMarketOracle.observe() | ✅ | `amm.cairo:1003-1062` |
| increase_observations_cardinality_next() | ✅ | `amm.cairo:1066-1083` |
| get_oracle_state() | ✅ | `amm.cairo:1097-1104` |
| get_observation() | ✅ | `amm.cairo:1088-1093` |
| MAX_CARDINALITY = 8760 | ✅ | `amm.cairo:38` |
| PyLpOracle.get_pt_to_sy_rate() | ✅ | `py_lp_oracle.cairo:47-75` |
| PyLpOracle.get_yt_to_sy_rate() | ✅ | `py_lp_oracle.cairo:77-100` |
| PyLpOracle.get_lp_to_sy_rate() | ✅ | `py_lp_oracle.cairo:102-140` |
| PyLpOracle.get_pt_to_asset_rate() | ✅ | `py_lp_oracle.cairo:142-175` |
| PyLpOracle.get_yt_to_asset_rate() | ✅ | `py_lp_oracle.cairo:177-210` |
| PyLpOracle.get_lp_to_asset_rate() | ✅ | `py_lp_oracle.cairo:212-260` |
| PyLpOracle.get_oracle_state() | ✅ | `py_lp_oracle.cairo:262-290` |
| Test coverage | ✅ | 860 lines in `tests/market/test_market_oracle.cairo` |
| Chainlink adapter | ❌ | Not implemented (optional for DeFi integrations) |

**Remaining Gap (~5%):**
- **Chainlink-style adapters** (`latestRoundData()` compatibility) - Optional for integration with protocols expecting Chainlink interface
- **Reentrancy guard check** in oracle queries - Low priority, Cairo's execution model provides inherent protection

**Architecture Notes:**
- Uses u64 timestamps (Starknet native) vs Pendle's uint32
- Uses u256 for cumulative values (Cairo native) vs Pendle's uint216
- Ring buffer stored as `Map<u16, Observation>` in market contract
- Maximum cardinality capped at 8760 (1 year of hourly observations)

---

## 2.3 Fee System

**Implementation Status: 85%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Fee collection | Auto-compounded to LPs | ✅ Auto-compounded (stays in sy_reserve) | ✅ |
| Fee reinvestment | Into SY side of pool | ✅ LP fees remain in pool reserves | ✅ |
| Protocol fee split | 80% voters / 20% LPs | ❌ 100% to treasury (no governance) | 🟡 Phase 4 |
| Dynamic fee rate | Rate-impact adjustment | ⚠️ Time-decay only | 🟡 Phase 2 |

**Implementation Detail - Fee Auto-Compounding:** ✅ IMPLEMENTED

Horizon matches Pendle's fee model - LP fees stay in pool reserves:
```cairo
// Horizon - LP fees auto-compound (amm.cairo:560)
// Note: sy_reserve is reduced by ONLY (sy_out + actual_reserve_fee)
// LP fee portion (total_fee - reserve_fee) stays in the pool
self.sy_reserve.write(self.sy_reserve.read() - sy_out - actual_reserve_fee);

// Reserve fee goes to treasury immediately
self._transfer_reserve_fee_to_treasury(sy_contract, treasury, actual_reserve_fee, caller);
```

**Result:** LP fees compound automatically. When LPs burn LP tokens, they receive a proportional
share of the grown reserves (including accumulated LP fees).

**Note:** The `collect_fees()` function at `amm.cairo:922` is for **analytics only** - it resets
a counter and emits an event but does NOT transfer funds. LP fees are already embedded in reserves.

**Test Evidence:** `test_market_fees.cairo:520-522` verifies LP fees stay in pool (receiver balance unchanged).

---

## 2.4 LP Token & Liquidity Operations

**Implementation Status: 75%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Market is LP token | ✅ | ✅ | ✅ |
| MINIMUM_LIQUIDITY | 1000 | 1000 | ✅ |
| First depositor protection | Stored reserves | Stored reserves | ✅ |
| Add/remove liquidity | Both tokens | Both tokens | ✅ |
| Single-sided add | Via router | ❌ Missing | 🟡 MEDIUM |
| Transfer liquidity | Between markets | ❌ Missing | 🟡 MEDIUM |
| Rollover PT | Old market → new | ❌ Missing | 🟡 MEDIUM |

---

## 2.5 Market Contract (PendleMarketV6)

**Implementation Status: 85%** (Core liquidity/swap works + TWAP oracle implemented; remaining: RewardManager/PendleGauge, flash callbacks)

**Reference (Pendle V2 code):** [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol) (market contract) and [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol) (TWAP observations)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Market is LP token | ✅ (PendleERC20, nonReentrant transfer/transferFrom) | ✅ (ERC20Component) | ✅ |
| mint() add liquidity | ✅ | ✅ | ✅ |
| burn() remove liquidity | ✅ | ✅ | ✅ |
| swapExactPtForSy | ✅ | ✅ swap_exact_pt_for_sy | ✅ |
| swapSyForExactPt | ✅ | ✅ swap_sy_for_exact_pt | ✅ |
| 4 swap function variants | 2 in Market (optional callback) | 4 explicit functions | ✅ **Horizon exceeds** |
| Emergency pause | ❌ No pause | ✅ PAUSER_ROLE | ✅ **Horizon exceeds** |
| Admin scalar adjustment | ❌ Immutable | ✅ set_scalar_root() | ✅ **Horizon exceeds** |
| Rich swap events | Basic | Detailed (rate before/after, exchange rate) | ✅ **Horizon exceeds** |
| TWAP observation buffer | `OracleLib.Observation[65_535]` ([OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol)) | ✅ `oracle_lib::Observation` + `Map<u16, Observation>` (8,760 slots) | ✅ |
| observe(secondsAgos[]) | `observations.observe` ([PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol)) | ✅ `IMarketOracle::observe()` | ✅ |
| increaseObservationsCardinalityNext | `observations.grow` ([PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol)) | ✅ `increase_observations_cardinality_next()` | ✅ |
| RewardManager integration | Via PendleGauge parent | ❌ None | 🔴 HIGH |
| redeemRewards(user) | ✅ | ❌ None | 🔴 HIGH |
| getRewardTokens() | ✅ | ❌ None | 🔴 HIGH |
| Swap callback hook | `IPMarketSwapCallback` via `bytes data` | ❌ None (transfer_from + direct transfer) | 🟡 MEDIUM |
| skim() balance reconciliation | ✅ | ❌ None | 🟡 MEDIUM |
| Token transfer pattern | Pre-transfer + balance checks | Pulls via `transfer_from` | 🟡 MEDIUM |
| Separate burn receivers | (receiverSy, receiverPt) | Single receiver | 🟡 MEDIUM |
| Storage packing | int128/uint96/uint16 | u256 per field | 🟡 MEDIUM (gas) |
| Fee config from factory | getMarketConfig() | Stored in contract | 🟡 MEDIUM |
| notExpired modifier | ✅ Modifier pattern | assert(!is_expired()) | ✅ Equivalent |
| nonReentrant | ✅ Modifier | ❌ No reentrancy guard | ⚠️ Different approach |
| readState(router) | External view | ❌ Not exposed (internal only) | 🟢 LOW |

---

**~~Gap Detail - TWAP Observation Buffer (CRITICAL):~~** ✅ IMPLEMENTED

**Reference (Pendle V2 code):** [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol)

Horizon now has full TWAP infrastructure matching Pendle's architecture:
```cairo
// Horizon - full TWAP implementation (oracle_lib.cairo + amm.cairo)
struct Observation {
    block_timestamp: u64,
    ln_implied_rate_cumulative: u256,
    initialized: bool,
}

// 8,760-slot ring buffer (1 year of hourly observations)
observations: Map<u16, Observation>,
observation_index: u16,
observation_cardinality: u16,
observation_cardinality_next: u16,

// IMarketOracle trait - observe() and increase_observations_cardinality_next()
```

**Implementation files:**
- [`contracts/src/libraries/oracle_lib.cairo`](../contracts/src/libraries/oracle_lib.cairo) - Core TWAP library (~670 lines)
- [`contracts/src/market/amm.cairo`](../contracts/src/market/amm.cairo) - Oracle storage and IMarketOracle interface
- [`contracts/src/oracles/py_lp_oracle.cairo`](../contracts/src/oracles/py_lp_oracle.cairo) - PT/YT/LP price helpers (~320 lines)

### IMarketOracle Interface

The Market contract implements `IMarketOracle` providing TWAP functionality:

```cairo
trait IMarketOracle<TContractState> {
    /// Query cumulative ln(implied rate) values at multiple time offsets.
    /// Used for TWAP calculations: TWAP = (cumulative_now - cumulative_past) / duration
    fn observe(self: @TContractState, seconds_agos: Array<u32>) -> Array<u256>;

    /// Pre-allocate observation buffer slots to reduce gas costs during swaps.
    fn increase_observations_cardinality_next(ref self: TContractState, cardinality_next: u16);

    /// Read a single observation from the ring buffer.
    /// Returns (block_timestamp, ln_implied_rate_cumulative, initialized)
    fn get_observation(self: @TContractState, index: u16) -> (u64, u256, bool);

    /// Get the oracle state needed for external TWAP calculations.
    /// Returns OracleState containing last_ln_implied_rate and buffer indices
    fn get_oracle_state(self: @TContractState) -> OracleState;
}
```

**Usage:** Use `IMarketOracleDispatcher` to query TWAP data from external contracts.

---

**Gap Detail - RewardManager/PendleGauge Integration (HIGH):**

Pendle's Market inherits from PendleGauge for LP reward distribution:
```solidity
// Pendle - Market inherits reward functionality
contract PendleMarketV6 is PendleGauge, ... {
    function redeemRewards(address user)
        external returns (uint256[] memory rewardAmounts) {
        // Inherited from PendleGauge
        _updateAndDistributeRewards(user);
        return _doTransferOutRewards(user, user);
    }

    function getRewardTokens() external view returns (address[] memory) {
        return _getRewardTokens();
    }
}
```

Horizon has no reward infrastructure:
```cairo
// Horizon - no reward tracking in Market
// LPs cannot earn external incentives
impl MarketImpl of IMarket<ContractState> {
    // Only trading functions, no reward claiming
}
```

**Impact:** Cannot run LP incentive programs (PENDLE-style emissions), partner reward distribution, or multi-token yield farming.

---

**Gap Detail - Flash Swap Callback (MEDIUM):**

Pendle swaps support a callback pattern for flash operations:
```solidity
// Pendle - callback for flash swaps
function swapExactPtForSy(
    address receiver,
    uint256 exactPtIn,
    bytes calldata data  // ← Callback data
) external nonReentrant notExpired returns (uint256 netSyOut, uint256 netSyFee) {
    // ... execute swap ...
    if (data.length > 0) {
        IPSwapCallback(msg.sender).swapCallback(
            netPtToAccount, netSyToAccount, data
        );
    }
}
```

Horizon uses direct transfers:
```cairo
// Horizon - direct transfer pattern
fn swap_exact_pt_for_sy(
    ref self: ContractState,
    receiver: ContractAddress,
    exact_pt_in: u256,
    min_sy_out: u256,  // No callback data
) -> u256 {
    // Transfer PT from caller first
    pt_contract.transfer_from(caller, get_contract_address(), exact_pt_in);
    // Then transfer SY to receiver
    sy_contract.transfer(receiver, sy_out);
}
```

**Impact:** Cannot implement atomic arbitrage strategies, composable flash swaps, or callback-based integrations. Horizon's 4 explicit swap functions mitigate this by covering all input/output combinations.

---

**Gap Detail - skim() Balance Reconciliation (MEDIUM):**

Pendle has skim() to handle unexpected token deposits:
```solidity
// Pendle - force-sync reserves with actual balances
function skim() external nonReentrant {
    // Reconcile any "donated" or accidentally sent tokens
    (uint256 syBalance, uint256 ptBalance) = _getBalances();
    // Update reserves to match actual balances
}
```

Horizon relies on exact accounting:
```cairo
// Horizon - no skim, relies on tracked reserves
self.sy_reserve.write(self.sy_reserve.read() + sy_used);
self.pt_reserve.write(self.pt_reserve.read() + pt_used);
// If someone transfers tokens directly, they're lost
```

**Impact:** Tokens accidentally sent to the contract cannot be recovered or accounted for. Minor concern for protocol operation but affects edge cases.

---

**Gap Detail - Separate Burn Receivers (MEDIUM):**

Pendle allows different receivers for SY and PT when removing liquidity:
```solidity
// Pendle - separate receivers
function burn(
    address receiverSy,   // SY goes here
    address receiverPt,   // PT goes here
    uint256 netLpToBurn
) external returns (uint256 netSyOut, uint256 netPtOut);
```

Horizon uses single receiver:
```cairo
// Horizon - single receiver for both
fn burn(
    ref self: ContractState,
    receiver: ContractAddress,  // Both SY and PT go here
    lp_to_burn: u256,
) -> (u256, u256)
```

**Impact:** More complex LP exit strategies (e.g., send PT to one wallet, SY to another) require additional transactions.

---
