# 4. Factory System Gaps

## 4.1 YieldContractFactory Comparison

**Implementation Status: 80%** (Core deployment works; missing centralized factory fee schedules and expiry divisor)

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
| `interestFeeRate` (factory) | Up to 20%, configurable at factory | ❌ None at factory | 🟡 MEDIUM |
| `interestFeeRate` (YT) | Configured per YT from factory | ✅ Per-YT `interest_fee_rate` (max 50%) | ✅ |
| `rewardFeeRate` | Up to 20%, configurable | ❌ None | 🔴 HIGH |
| `treasury` address | Configurable fee destination | ✅ `treasury` stored + passed to YT | ✅ |
| `setInterestFeeRate()` (factory) | Owner-protected, factory-level | ❌ None at factory | 🟡 MEDIUM |
| `setInterestFeeRate()` (YT) | N/A | ✅ Per-YT admin function | ✅ |
| `setRewardFeeRate()` | Owner-protected | ❌ None | 🔴 HIGH |
| `setTreasury()` | Owner-protected | ✅ `set_treasury()` | ✅ |
| `expiryDivisor` | Expiry must be divisible | ❌ Only checks future | 🟡 MEDIUM |
| `setExpiryDivisor()` | Owner-protected | ❌ None | 🟡 MEDIUM |
| `doCacheIndexSameBlock` | Same-block index caching parameter | ✅ Always-on caching in YT | ✅ **Different but implemented** |
| `VERSION` constant | `VERSION = 6` | ❌ None | 🟢 LOW |
| Deterministic addresses | Create2 for PT | deploy_syscall with salt | ⚠️ Different |

---

**Gap Detail - Factory-Level Fee Configuration (MEDIUM):**

Pendle's factory configures protocol fees that are applied across all deployed yield contracts:
```solidity
// Pendle - protocol fee configuration at factory level
uint128 public interestFeeRate;  // Fee on YT interest (max 20%)
uint128 public rewardFeeRate;    // Fee on external rewards (max 20%)
address public treasury;          // Fee destination

function setInterestFeeRate(uint128 newInterestFeeRate) public onlyOwner {
    if (newInterestFeeRate > MAX_INTEREST_FEE_RATE) revert Errors.FeeRateExceeded();
    interestFeeRate = newInterestFeeRate;
    emit SetInterestFeeRate(newInterestFeeRate);
}
```

Horizon implements interest fees at the YT level rather than the factory level:
```cairo
// Horizon YT - per-contract fee configuration (yt.cairo:1369-1386)
fn set_interest_fee_rate(ref self: ContractState, rate: u256) {
    self.access_control.assert_only_role(DEFAULT_ADMIN_ROLE);
    // Max 50% fee (0.5e18 = 500000000000000000)
    assert(rate <= 500000000000000000, Errors::YT_INVALID_FEE_RATE);
    let old_rate = self.interest_fee_rate.read();
    self.interest_fee_rate.write(rate);
    self.emit(InterestFeeRateSet { ... });
}
```

**Impact:** Protocol can collect interest fees but must configure each YT individually. Lacks centralized fee schedule from factory.

---

**Gap Detail - Reward Fee Rate (HIGH):**

Pendle captures fees on external reward token distributions:
```solidity
// Pendle - reward fee configuration
uint128 public rewardFeeRate;    // Fee on external rewards (max 20%)

function setRewardFeeRate(uint128 newRewardFeeRate) public onlyOwner {
    if (newRewardFeeRate > MAX_REWARD_FEE_RATE) revert Errors.FeeRateExceeded();
    rewardFeeRate = newRewardFeeRate;
    emit SetRewardFeeRate(newRewardFeeRate);
}
```

Horizon does not implement reward fee functionality anywhere in the codebase.

**Impact:** No protocol fee capture on external reward distributions.

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
// Horizon factory.cairo:178 - any future expiry is valid
assert(expiry > get_block_timestamp(), Errors::FACTORY_INVALID_EXPIRY);
```

**Impact:** Without divisor, markets may be created with arbitrary expiries (e.g., 1698432123), making liquidity fragmented. Standardized expiries (e.g., weekly, monthly) help concentrate liquidity.

---

**Gap Detail - Same-Block Index Caching (IMPLEMENTED DIFFERENTLY):**

Pendle passes a caching hint to YT deployment:
```solidity
// Pendle - optimization for same-block operations
function createYieldContract(
    address SY,
    uint32 expiry,
    bool doCacheIndexSameBlock  // ← Passed to YT
) external returns (address PT, address YT);
```

Horizon implements same-block caching directly in YT, always enabled:
```cairo
// Horizon yt.cairo:97-101 - always-on same-block caching
// Same-block index caching: block number of last index fetch
last_index_block: u64,
// Same-block index caching: cached index value from last fetch
cached_index: u256,

// Horizon yt.cairo:1428-1434 - cache check in _update_py_index
let current_block = get_block_info().unbox().block_number;
let cached_block = self.last_index_block.read();
if current_block == cached_block && self.cached_index.read() > 0 {
    // Cache hit - use cached index (already stored)
    return;
}
```

**Impact:** Same optimization achieved, but always enabled rather than configurable per-deployment. This is functionally equivalent for gas optimization.

---

## 4.2 Horizon Factory Advantages

Horizon's factory exceeds Pendle in several areas:

**1. Enriched Event Data:**
```cairo
// Horizon factory.cairo:96-111 - rich event for indexers
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
// Horizon factory.cairo:311-322 - can update deployment templates
fn set_class_hashes(
    ref self: ContractState,
    yt_class_hash: ClassHash,
    pt_class_hash: ClassHash,
) {
    self.ownable.assert_only_owner();
    assert(!yt_class_hash.is_zero(), Errors::ZERO_ADDRESS);
    assert(!pt_class_hash.is_zero(), Errors::ZERO_ADDRESS);
    self.yt_class_hash.write(yt_class_hash);
    self.pt_class_hash.write(pt_class_hash);
    self.emit(ClassHashesUpdated { yt_class_hash, pt_class_hash });
}
```

**3. RBAC Integration:**
```cairo
// Horizon factory.cairo:29-30 - role-based access control
component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);

// Horizon factory.cairo:154-156 - roles initialized in constructor
self.access_control.initializer();
self.access_control._grant_role(DEFAULT_ADMIN_ROLE, owner);
```

**4. SYWithRewards Deployment:**
```cairo
// Horizon factory.cairo:358-442 - deploy reward-enabled SY contracts
fn deploy_sy_with_rewards(
    ref self: ContractState,
    name: ByteArray,
    symbol: ByteArray,
    underlying: ContractAddress,
    index_oracle: ContractAddress,
    is_erc4626: bool,
    asset_type: AssetType,
    pauser: ContractAddress,
    tokens_in: Span<ContractAddress>,
    tokens_out: Span<ContractAddress>,
    reward_tokens: Span<ContractAddress>,
    salt: felt252,
) -> ContractAddress
```

---
