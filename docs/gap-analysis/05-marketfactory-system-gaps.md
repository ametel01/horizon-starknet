# 5. MarketFactory System Gaps

## 5.1 PendleMarketFactoryV6Upg Comparison

**Implementation Status: 95%** (Core market deployment works; treasury/fee infrastructure fully implemented; only governance integration remaining)

**Reference:** Pendle's `PendleMarketFactoryV6Upg.sol` from [pendle-core-v2-public](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketFactoryV6Upg.sol)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Create market from PT | `createNewMarket(PT, scalarRoot, initialAnchor, lnFeeRateRoot)` | `create_market(pt, scalar_root, initial_anchor, fee_rate)` | ✅ |
| Validate markets | `isValidMarket(market)` | `is_valid_market(market)` | ✅ |
| Get all markets | `EnumerableSet allMarkets` | `get_all_markets()` | ✅ |
| Upgradeable | ✅ | ✅ `UpgradeableComponent` | ✅ |
| Owner-only admin | `onlyOwner` modifier | `assert_only_owner()` | ✅ |
| Parameter validation | `lnFeeRateRoot <= maxLnFeeRateRoot`, `initialAnchor >= minInitialAnchor` | MIN/MAX_SCALAR_ROOT, MAX_INITIAL_ANCHOR, MAX_FEE_RATE | ✅ |
| Enriched events | Basic `CreateNewMarket` | Rich `MarketCreated` | ✅ **Horizon exceeds** |
| RBAC integration | ❌ Owner only | ✅ `AccessControlComponent` | ✅ **Horizon exceeds** |
| Market pagination | ❌ None | ✅ `get_markets_paginated()` | ✅ **Horizon exceeds** |
| Active markets filter | ❌ None | ✅ `get_active_markets_paginated()` | ✅ **Horizon exceeds** |
| Market by index | ❌ None | ✅ `get_market_at(index)` | ✅ **Horizon exceeds** |
| Class hash updates | ❌ Immutable | ✅ `set_market_class_hash()` + event | ✅ **Horizon exceeds** |
| `treasury` address | ✅ Configurable | ✅ `treasury` | Implemented (line 95) |
| `reserveFeePercent` | ✅ Up to 100% | ✅ `default_reserve_fee_percent` | Implemented (line 97) |
| `set_treasury()` | ✅ Owner-protected | ✅ | Implemented (line 507) |
| `set_default_reserve_fee_percent()` | ✅ Owner-protected | ✅ | Implemented (line 517) |
| `get_market_config(market, router)` | ✅ Returns treasury, fees | ✅ | Implemented (lines 484-493) |
| Router fee overrides | `overriddenFee` mapping | ✅ `overridden_fee` | Implemented (line 100) |
| `set_override_fee()` | ✅ Owner-protected | ✅ | Implemented (lines 531-556) |
| `vePendle` integration | ✅ Immutable reference | ❌ None | 🟡 Future |
| `gaugeController` integration | ✅ Immutable reference | ❌ None | 🟡 Future |
| `yieldContractFactory` reference | ✅ Immutable | ❌ None | 🟡 MEDIUM |
| `VERSION` constant | `VERSION = 6` | ❌ None | 🟢 LOW |
| `minInitialAnchor` | `PMath.IONE` | ❌ Only MAX check | 🟢 LOW |
| Split-code factory | ✅ Gas optimization | deploy_syscall with salt | ⚠️ Different |

**Returns:** `MarketConfig { treasury, ln_fee_rate_root, reserve_fee_percent }`

---

**✅ IMPLEMENTED - Protocol Fee Infrastructure:**

Horizon now fully implements Pendle-style protocol fee infrastructure in `market_factory.cairo`:

```cairo
// Horizon - factory manages market fee configuration (lines 93-100)
treasury: ContractAddress,                           // Fee destination
default_reserve_fee_percent: u8,                     // % of fees to protocol (max 100)
overridden_fee: Map<(ContractAddress, ContractAddress), u256>, // Router fee overrides

fn set_treasury(ref self: ContractState, treasury: ContractAddress) // line 507
fn set_default_reserve_fee_percent(ref self: ContractState, percent: u8) // line 517

// Markets query factory for fee config (lines 484-493)
fn get_market_config(self: @ContractState, market: ContractAddress, router: ContractAddress) -> MarketConfig {
    MarketConfig { treasury, ln_fee_rate_root, reserve_fee_percent }
}
```

**Implementation:** Markets call `factory.get_market_config()` to retrieve treasury address and fee configuration. Reserve fees are transferred to treasury immediately during swaps via `_transfer_reserve_fee_to_treasury()`.

---

**✅ IMPLEMENTED - Router Fee Overrides:**

Horizon now supports router-specific fee overrides in `market_factory.cairo`:

```cairo
// Horizon - router-specific fee overrides (lines 531-556)
fn set_override_fee(
    ref self: ContractState,
    router: ContractAddress,
    market: ContractAddress,
    ln_fee_rate_root: u256,  // 0 to clear override
) {
    // Validates market is deployed by this factory
    // Validates override is less than market's base fee
    self.overridden_fee.write((router, market), ln_fee_rate_root);
    self.emit(OverrideFeeSet { router, market, ln_fee_rate_root });
}
```

**Implementation:** Partner integrators (AVNU, Fibrous, etc.) can receive reduced fees. The `get_market_config()` function returns the override fee for the router/market pair, and markets use this in `_get_state_for_swap()` to apply effective fee rates.

---

**Gap Detail - Governance Integration (Future):**

Pendle's MarketFactory integrates with governance infrastructure:
```solidity
// Pendle - immutable governance references
address public immutable vePendle;        // Vote-escrow token
address public immutable gaugeController; // Emission controller

// Markets can query these for boost calculations, emission rates, etc.
```

Horizon has no governance integration:
```cairo
// Horizon - no governance infrastructure
// Markets operate independently without veToken or gauge system
```

**Impact:** Cannot implement LP boost mechanics, emission distributions, or governance-weighted fees. This is explicitly Phase 4 on Horizon's roadmap.

---

## 5.2 Horizon MarketFactory Advantages

Horizon's MarketFactory exceeds Pendle in several areas:

**1. Comprehensive Market Enumeration:**
```cairo
// Horizon - pagination and filtering for indexers/frontends
fn get_markets_paginated(offset: u32, limit: u32) -> (Array<ContractAddress>, bool);
fn get_active_markets_paginated(offset: u32, limit: u32) -> (Array<ContractAddress>, bool);
fn get_market_at(index: u32) -> ContractAddress;
fn get_market_count() -> u32;
```

Pendle only provides `EnumerableSet` for all markets, no pagination or active filtering.

**2. Rich Event Data:**
```cairo
// Horizon - comprehensive event for indexers
pub struct MarketCreated {
    pub pt: ContractAddress,
    pub expiry: u64,
    pub market: ContractAddress,
    pub creator: ContractAddress,
    pub scalar_root: u256,
    pub initial_anchor: u256,
    pub fee_rate: u256,
    pub sy: ContractAddress,
    pub yt: ContractAddress,
    pub underlying: ContractAddress,
    pub underlying_symbol: ByteArray,
    pub initial_exchange_rate: u256,
    pub timestamp: u64,
    pub market_index: u32,
}
```

**3. Parameter Validation Bounds:**
```cairo
// Horizon - explicit bounds prevent misconfiguration
const MIN_SCALAR_ROOT: u256 = 1_000_000_000_000_000_000; // 1 WAD
const MAX_SCALAR_ROOT: u256 = 1_000_000_000_000_000_000_000; // 1000 WAD
const MAX_INITIAL_ANCHOR: u256 = 4_600_000_000_000_000_000; // ~4.6 WAD
const MAX_FEE_RATE: u256 = 100_000_000_000_000_000; // 10%
```

**4. Class Hash Updates:**
```cairo
// Horizon - can update deployment template
fn set_market_class_hash(ref self: ContractState, new_class_hash: ClassHash) {
    self.ownable.assert_only_owner();
    self.emit(MarketClassHashUpdated { old_class_hash, new_class_hash });
}
```

---
