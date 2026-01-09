# 4. Factory System Gaps

## 4.1 YieldContractFactory Comparison

**Implementation Status: 70%** (Core deployment works; missing protocol fee infrastructure)

**Reference:** Pendle's `PendleYieldContractFactoryUpg.sol` from [pendle-core-v2-public](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/YieldContracts/PendleYieldContractFactoryUpg.sol)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Create PT/YT pair | `createYieldContract(SY, expiry, doCacheIndexSameBlock)` | `create_yield_contracts(sy, expiry)` | ✅ |
| Get PT/YT by (SY, expiry) | `getPT`, `getYT` mappings | `get_pt`, `get_yt` | ✅ |
| Validate deployed tokens | `isPT`, `isYT` mappings | `is_valid_pt`, `is_valid_yt` | ✅ |
| Upgradeable | `BoringOwnableUpgradeableV2` | `UpgradeableComponent` | ✅ |
| Owner-only admin | `onlyOwner` modifier | `assert_only_owner()` | ✅ |
| Enriched events | Basic `CreateYieldContract` | Rich `YieldContractsCreated` | ✅ **Horizon exceeds** |
| RBAC integration | ❌ Owner only | ✅ `AccessControlComponent` | ✅ **Horizon exceeds** |
| Class hash updates | ❌ None | ✅ `set_class_hashes()` + event | ✅ **Horizon exceeds** |
| `interestFeeRate` | Up to 20%, configurable | ❌ None | 🔴 HIGH |
| `rewardFeeRate` | Up to 20%, configurable | ❌ None | 🔴 HIGH |
| `treasury` address | Configurable fee destination | ✅ `treasury` stored + passed to YT | ✅ |
| `setInterestFeeRate()` | Owner-protected | ❌ None | 🔴 HIGH |
| `setRewardFeeRate()` | Owner-protected | ❌ None | 🔴 HIGH |
| `setTreasury()` | Owner-protected | ✅ `set_treasury()` | ✅ |
| `expiryDivisor` | Expiry must be divisible | ❌ Only checks future | 🟡 MEDIUM |
| `setExpiryDivisor()` | Owner-protected | ❌ None | 🟡 MEDIUM |
| `doCacheIndexSameBlock` | Same-block index caching | Always-on cache in YT | ⚠️ Different |
| `VERSION` constant | `VERSION = 6` | ❌ None | 🟢 LOW |
| Deterministic addresses | Create2 for PT | deploy_syscall with salt | ⚠️ Different |

---

**Gap Detail - Protocol Fee Infrastructure (HIGH):**

Pendle's factory configures protocol fees that are applied across all deployed yield contracts:
```solidity
// Pendle - protocol fee configuration
uint128 public interestFeeRate;  // Fee on YT interest (max 20%)
uint128 public rewardFeeRate;    // Fee on external rewards (max 20%)
address public treasury;          // Fee destination

function setInterestFeeRate(uint128 newInterestFeeRate) public onlyOwner {
    if (newInterestFeeRate > MAX_INTEREST_FEE_RATE) revert Errors.FeeRateExceeded();
    interestFeeRate = newInterestFeeRate;
    emit SetInterestFeeRate(newInterestFeeRate);
}

function setRewardFeeRate(uint128 newRewardFeeRate) public onlyOwner {
    if (newRewardFeeRate > MAX_REWARD_FEE_RATE) revert Errors.FeeRateExceeded();
    rewardFeeRate = newRewardFeeRate;
    emit SetRewardFeeRate(newRewardFeeRate);
}
```

Horizon does not implement factory-level fee schedules; interest fees are configured per YT and
reward fees are still missing:
```cairo
// Horizon - fee config lives in YT, not the factory
fn set_interest_fee_rate(ref self: ContractState, rate: u256)
treasury: ContractAddress
```

**Impact:** Protocol can collect interest fees on a per-YT basis, but lacks a centralized fee
schedule and any reward fee capture.

---

**Gap Detail - Expiry Divisor (MEDIUM):**

Pendle enforces expiry standardization:
```solidity
// Pendle - expiries must be divisible by divisor
uint96 public expiryDivisor;  // e.g., 604800 = 1 week

function createYieldContract(address SY, uint32 expiry, bool doCacheIndexSameBlock) {
    if (expiry % expiryDivisor != 0) revert Errors.InvalidExpiry(expiry);
    // ...
}
```

Horizon only checks if expiry is in the future:
```cairo
// Horizon - any future expiry is valid
assert(expiry > get_block_timestamp(), Errors::FACTORY_INVALID_EXPIRY);
```

**Impact:** Without divisor, markets may be created with arbitrary expiries (e.g., 1698432123), making liquidity fragmented. Standardized expiries (e.g., weekly, monthly) help concentrate liquidity.

---

**Gap Detail - Same-Block Index Caching (MEDIUM):**

Pendle passes a caching hint to YT deployment:
```solidity
// Pendle - optimization for same-block operations
function createYieldContract(
    address SY,
    uint32 expiry,
    bool doCacheIndexSameBlock  // ← Passed to YT
) external returns (address PT, address YT) {
    // YT can use cached index if multiple operations in same block
}
```

Horizon doesn't have this optimization:
```cairo
// Horizon - no same-block caching
fn create_yield_contracts(
    ref self: ContractState,
    sy: ContractAddress,
    expiry: u64,
    // No caching parameter
) -> (ContractAddress, ContractAddress)
```

**Impact:** Minor gas optimization for batch operations in the same block.

---

## 4.2 Horizon Factory Advantages

Horizon's factory exceeds Pendle in several areas:

**1. Enriched Event Data:**
```cairo
// Horizon - rich event for indexers
#[derive(Drop, starknet::Event)]
pub struct YieldContractsCreated {
    #[key]
    pub sy: ContractAddress,
    #[key]
    pub expiry: u64,
    pub pt: ContractAddress,
    pub yt: ContractAddress,
    pub creator: ContractAddress,
    // Enrichment fields for indexer
    pub underlying: ContractAddress,
    pub underlying_symbol: ByteArray,
    pub initial_exchange_rate: u256,
    pub timestamp: u64,
    pub market_index: u32,
}
```

Pendle's event is simpler:
```solidity
// Pendle - basic event
event CreateYieldContract(
    address indexed SY,
    uint32 indexed expiry,
    address PT,
    address YT
);
```

**2. Class Hash Updates with Events:**
```cairo
// Horizon - can update deployment templates
fn set_class_hashes(
    ref self: ContractState,
    yt_class_hash: ClassHash,
    pt_class_hash: ClassHash,
) {
    self.ownable.assert_only_owner();
    self.emit(ClassHashesUpdated { yt_class_hash, pt_class_hash });
}
```

**3. RBAC Integration:**
```cairo
// Horizon - role-based access control
component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);
self.access_control._grant_role(DEFAULT_ADMIN_ROLE, owner);
```

---
