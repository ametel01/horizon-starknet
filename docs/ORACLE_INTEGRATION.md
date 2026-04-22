# Oracle Integration

This document describes how the Horizon Protocol integrates with oracles for price feeds and exchange rate data.

## Overview

Horizon Protocol uses a **two-tier pull-based oracle system** powered by Pragma Network:

| Oracle | Purpose | Contract |
|--------|---------|----------|
| **Index Oracle** | Exchange rates for SY tokens (e.g., wstETH/stETH) | `PragmaIndexOracle` |
| **PT/YT/LP Oracle** | Token pricing using Market TWAP | `PyLpOracle` |

---

## 1. Index Oracle (PragmaIndexOracle)

**Location:** `contracts/src/oracles/pragma_index_oracle.cairo`
**Interface:** `contracts/src/interfaces/i_index_oracle.cairo`

The Index Oracle provides monotonically-increasing exchange rate indexes for yield-bearing assets.

### How It Works

1. Fetches TWAP from Pragma's `calculate_twap()` function
2. Converts from Pragma's 8-decimal format to 18-decimal WAD
3. For dual-feed mode: calculates `(numerator / denominator) * WAD`
4. Returns `max(oracle_value, stored_watermark)` to prevent yield theft

### Operating Modes

**Single-Feed Mode** (`denominator_pair_id = 0`):
- Directly converts a Pragma price feed to WAD format
- Example: Direct exchange rate like 1.15 WAD

**Dual-Feed Mode** (both numerator and denominator specified):
- Calculates ratio: `(numerator_price / denominator_price) * WAD`
- Example: `wstETH/USD ÷ stETH/USD = wstETH/stETH ratio`

### Monotonic Watermark Pattern

The oracle implements a safety mechanism at line 200-211:

```cairo
fn index(self: @ContractState) -> u256 {
    max(self._fetch_oracle_index(), self.stored_index.read())
}
```

This ensures:
- Exchange rates never decrease from the contract's perspective
- YT holders don't lose accrued yield if oracle temporarily reports lower values
- Protection against oracle manipulation attacks

### Constructor Parameters

```cairo
fn constructor(
    ref self: ContractState,
    owner: ContractAddress,
    pragma_oracle: ContractAddress,   // Pragma SummaryStats contract address
    numerator_pair_id: felt252,       // Primary price feed pair ID
    denominator_pair_id: felt252,     // Secondary pair (0 = single-feed mode)
    initial_index: u256,              // Starting exchange rate (must be >= WAD)
)
```

### Configuration Defaults

| Parameter | Default | Minimum |
|-----------|---------|---------|
| TWAP Window | 3600s (1 hour) | 300s (5 minutes) |
| Max Staleness | 86400s (24 hours) | - |

### Admin Functions

| Function | Required Role | Purpose |
|----------|---------------|---------|
| `update_index()` | OPERATOR | Persist current oracle value to storage |
| `set_config(twap_window, max_staleness)` | OPERATOR | Change TWAP parameters |
| `pause()` / `unpause()` | PAUSER | Freeze oracle at current value |
| `emergency_set_index(value)` | DEFAULT_ADMIN | Manual override for emergencies |
| `initialize_rbac()` | Owner | Bootstrap RBAC after upgrade |

---

## 2. PT/YT/LP Oracle (PyLpOracle)

**Location:** `contracts/src/oracles/py_lp_oracle.cairo`
**Interface:** `contracts/src/interfaces/i_py_lp_oracle.cairo`

A **stateless helper contract** that calculates manipulation-resistant TWAP prices for Principal, Yield, and LP tokens using the Market's internal observation buffer.

### Pricing Formulas

**PT to SY** (line 55):
```
PT_price = exp(-ln_rate_twap * time_to_expiry / SECONDS_PER_YEAR)
```
- At expiry: PT = 1 SY
- Implements Pendle v2's time-decay model

**YT to SY** (line 75):
```
YT_price = WAD - PT_price   (before expiry)
YT_price = 0                (after expiry)
```
- Uses complementary property: PT + YT = 1 SY

**LP to SY** (line 100):
```
LP_value = (SY_reserve + PT_reserve * PT_to_SY) / total_LP
```

### TWAP Query Mechanism

**Duration = 0 (Spot Rate)**:
- Returns `market.get_oracle_state().last_ln_implied_rate`
- Instant lookup from Market storage

**Duration > 0 (TWAP)**:
- Calls `market.observe([duration, 0])`
- Calculates: `(cumulative_now - cumulative_past) / duration`

### Oracle Readiness Check

Before using TWAP, verify the Market has sufficient observation history:

```cairo
fn check_oracle_state(market, duration) -> OracleReadinessState {
    // Returns:
    // - increase_cardinality_required: Buffer needs growth
    // - cardinality_required: Minimum slots needed
    // - oldest_observation_satisfied: Oldest observation is old enough
}
```

Required cardinality formula: `(duration / MIN_BLOCK_TIME) + 1`
Where `MIN_BLOCK_TIME = 10 seconds`

---

## 3. Oracle Library (oracle_lib)

**Location:** `contracts/src/libraries/oracle_lib.cairo`

Provides ring buffer implementation for TWAP calculations (Pendle-style):

| Function | Purpose |
|----------|---------|
| `initialize()` | Create initial observation |
| `write()` | Write new observation to buffer |
| `transform()` | Accumulate `ln(rate) * time` |
| `observe_single()` | Query cumulative value at timestamp |
| `observe()` | Batch query for multiple timestamps |
| `binary_search()` | Search ring buffer for target |
| `grow()` | Pre-warm storage slots for cardinality |

### Data Structures

```cairo
struct Observation {
    block_timestamp: u64,
    ln_implied_rate_cumulative: i256,
    initialized: bool,
}
```

---

## 4. Pragma Integration

### Interface

**Location:** `contracts/src/interfaces/i_pragma_summary_stats.cairo`

```cairo
fn calculate_twap(
    data_type: DataType,
    aggregation_mode: AggregationMode,
    time: u64,
    start_time: u64,
) -> (u128, u32);  // Returns (price, decimals)
```

### Known Pair IDs

| Asset | Pair ID |
|-------|---------|
| WSTETH_USD | `412383036120118613857092` |
| SSTRK_USD | `1537084272803954643780` |
| STRK_USD | `6004514686061859652` |
| ETH_USD | `19514442401534788` |

### DataType Enum

```cairo
enum DataType {
    SpotEntry: felt252,                    // Spot price by pair_id
    FutureEntry: (felt252, u64),           // Future price by (pair_id, expiration)
}
```

### AggregationMode Enum

```cairo
enum AggregationMode {
    Median,
    Mean,
}
```

---

## 5. Price Update Mechanism

Horizon uses a **pull-based model** - no external keeper is required.

### Update Flow

1. **Pragma Network** continuously publishes price data on-chain (external infrastructure)
2. When any Horizon contract calls `oracle.index()`:
   - Fetches TWAP from Pragma over configured window
   - Applies monotonic watermark
   - Returns the price

### Manual Update (Optional)

For caching purposes, operators can explicitly persist values:

```cairo
// Persists current oracle value to storage
operator.call: update_index()
```

### Staleness Protection

- TWAP uses configured time window (default: 1 hour)
- Oracle reverts if data is older than `max_staleness` (default: 24 hours)
- Pragma's internal staleness checks also apply

---

## 6. Integration with SY Tokens

SY tokens read exchange rates via `contracts/src/components/sy_component.cairo`:

```cairo
fn _exchange_rate(self: @ComponentState<TContractState>) -> u256 {
    if self.is_erc4626.read() {
        // ERC-4626 mode: call vault.convert_to_assets(WAD)
        IERC4626Dispatcher { contract_address: self.oracle.read() }
            .convert_to_assets(WAD)
    } else {
        // Oracle mode: fetch from PragmaIndexOracle
        IIndexOracleDispatcher { contract_address: self.oracle.read() }
            .index()
    }
}
```

### Two Modes

| Mode | When to Use | Example |
|------|-------------|---------|
| **ERC-4626** | Underlying vault implements ERC-4626 | nstSTRK from Nostra |
| **Oracle** | Custom yield-bearing asset | wstETH via Pragma |

---

## 7. Deployment

### Class Declaration

```bash
# In deploy/scripts/deploy.sh
PRAGMA_INDEX_ORACLE_CLASS_HASH=$(declare_class "PragmaIndexOracle" ...)
PY_LP_ORACLE_CLASS_HASH=$(declare_class "PyLpOracle" ...)
```

### PyLpOracle Deployment

PyLpOracle is stateless and deployed once per network:

```bash
PY_LP_ORACLE_ADDRESS=$(deploy_contract "$PY_LP_ORACLE_CLASS_HASH" "PyLpOracle" ...)
```

### PragmaIndexOracle Deployment

Deploy one instance per yield-bearing asset:

```bash
deploy_contract "$PRAGMA_INDEX_ORACLE_CLASS_HASH" "PragmaIndexOracle-wstETH" \
    "$OWNER" \
    "$PRAGMA_SUMMARY_STATS_ADDRESS" \
    "$WSTETH_USD_PAIR_ID" \
    "$STETH_USD_PAIR_ID" \    # 0 for single-feed
    "$INITIAL_INDEX"
```

### Post-Deployment RBAC Setup

After deployment or upgrade:

```cairo
// Grant roles to appropriate addresses
owner.call: initialize_rbac()
```

### Environment Variables

Stored in `.env.<network>` and `deploy/addresses/<network>.json`:

- `PRAGMA_INDEX_ORACLE_CLASS_HASH`
- `PY_LP_ORACLE_CLASS_HASH`
- `PY_LP_ORACLE_ADDRESS`

---

## 8. Testing

### Mock Oracle

**Location:** `contracts/src/mocks/mock_pragma.cairo`

Simulates time-based yield accrual for testing:

```cairo
price(t) = base_price * (1 + yield_rate * time_elapsed / SECONDS_PER_YEAR)
```

**Default configurations:**

| Pair | Base Price | Annual Yield |
|------|------------|--------------|
| WSTETH_USD | $4000 | 4% APY |
| SSTRK_USD | $0.50 | 8% APY |
| STRK_USD | $0.50 | 0% APY |

### Test Commands

```bash
# Run all oracle tests
cd contracts && snforge test oracle

# Run specific test file
cd contracts && snforge test test_pragma_index_oracle
cd contracts && snforge test test_py_lp_oracle
cd contracts && snforge test test_mock_pragma
```

### Local Development

```bash
make dev-up        # Uses mock oracle
make dev-fork      # Uses real Pragma mainnet oracle via fork
```

---

## 9. Security Considerations

### Manipulation Resistance

- **TWAP**: Time-weighted averages prevent flash loan attacks
- **Monotonic Watermark**: Prevents temporary price drops from stealing yield
- **Staleness Checks**: Rejects outdated price data

### Emergency Controls

| Control | Purpose |
|---------|---------|
| `pause()` | Freeze oracle at current value |
| `emergency_set_index()` | Manual override (admin only) |

### Access Control

All admin functions are protected by RBAC:

- `DEFAULT_ADMIN_ROLE`: Full control, emergency functions
- `OPERATOR_ROLE`: Configuration updates, index updates
- `PAUSER_ROLE`: Pause/unpause functionality

---

## 10. Related Documentation

- [Pendle V2 Specs](./PENDLE-V2-SPECS.md) - Original AMM curve specifications
- [Oracle System Gaps](./gap-analysis/06-oracle-system-gaps.md) - Gap analysis vs Pendle
- [Upgrade RBAC](./UPGRADE_RBAC.md) - Role-based access control details
