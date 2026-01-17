# Consolidated Gap Analysis - Pending Items Only

> **Generated:** 2026-01-17
> **Source:** All documents in `/docs/gap-analysis/`
> **Purpose:** Single view of what's still missing in Horizon vs Pendle V2

---

## Priority 0 - Critical (Blocks Integrations)

### P0-1: Multi-Reward YT

| Attribute | Details |
|-----------|---------|
| **Category** | Core Tokens |
| **Impact** | HIGH - Blocks reward token integrations |
| **Description** | Cannot support GLP-style tokens with rewards (ETH, esGMX), Pendle pools with emissions, or assets with native staking rewards beyond yield |

**Missing Functions:**
```cairo
fn redeem_due_interest_and_rewards(
    user: ContractAddress,
    do_redeem_interest: bool,
    do_redeem_rewards: bool,
) -> (u256, Span<u256>)  // (interest_out, rewards_out)

fn get_reward_tokens() -> Span<ContractAddress>
```

**Note:** The Router already has `redeem_due_interest_and_rewards` at `router.cairo:471-476` which claims interest from YTs and rewards from Markets, but YT itself lacks multi-reward support.

**Pendle V2 Reference:**
- [`InterestManagerYT.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/YieldContracts/InterestManagerYT.sol) - Combined interest + rewards
- [`RewardManager.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/RewardManager/RewardManager.sol) - Multi-token reward tracking

**Horizon Implementation:**
| File | Changes Required |
|------|------------------|
| `contracts/src/tokens/yt.cairo` | Add `RewardManagerComponent` (like Market does at line 76), add reward storage, implement reward tracking in YT |
| `contracts/src/interfaces/i_yt.cairo` | Add reward-related functions: `get_reward_tokens()`, `claim_rewards()`, `redeem_due_interest_and_rewards()` |

**Implementation Approach:**
1. Import `RewardManagerComponent` in YT contract (component already exists at `contracts/src/components/reward_manager_component.cairo`)
2. Add component storage: `reward_manager: RewardManagerComponent::Storage`
3. Hook reward updates into YT's `_update_user_interest` function (track rewards on transfers like Market does)
4. Implement combined `redeem_due_interest_and_rewards()` that calls both interest and reward claims
5. Forward `get_reward_tokens()` and `claim_rewards()` to component

**Existing Pattern (reference):**
```cairo
// From amm.cairo:76 - Market already uses RewardManagerComponent
component!(path: RewardManagerComponent, storage: reward_manager, event: RewardManagerEvent);
```

---

## Priority 1 - High (User Experience)

### P1-1: Factory rewardFeeRate

| Attribute | Details |
|-----------|---------|
| **Category** | Factory |
| **Impact** | HIGH - No protocol fee capture on external reward distributions |

**Pendle V2 Reference:**
- [`PendleYieldContractFactoryUpg.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/YieldContracts/PendleYieldContractFactoryUpg.sol) lines 40-50

```solidity
uint128 public rewardFeeRate;  // Fee on external rewards (max 20%)
uint128 public constant MAX_REWARD_FEE_RATE = 2e17; // 20%
```

**Horizon Implementation:**
| File | Line | Changes Required |
|------|------|------------------|
| `contracts/src/factory.cairo` | After line 76 (treasury) | Add `reward_fee_rate: u256` storage |
| `contracts/src/factory.cairo` | New function | Add `set_reward_fee_rate(rate: u256)` with MAX validation |
| `contracts/src/factory.cairo` | New function | Add `get_reward_fee_rate() -> u256` view |
| `contracts/src/interfaces/i_factory.cairo` | Interface | Add trait functions |

**Implementation:**
```cairo
// Storage (after line 76)
reward_fee_rate: u256,  // WAD-scaled, max 0.2e18 (20%)

// Constants
const MAX_REWARD_FEE_RATE: u256 = 200_000_000_000_000_000; // 20%

// Admin function
fn set_reward_fee_rate(ref self: ContractState, rate: u256) {
    self.ownable.assert_only_owner();
    assert(rate <= MAX_REWARD_FEE_RATE, Errors::FACTORY_INVALID_FEE_RATE);
    self.reward_fee_rate.write(rate);
    self.emit(RewardFeeRateSet { rate });
}
```

---

### P1-2: Factory setRewardFeeRate()

Covered in P1-1 above.

---

### P1-3: Factory interestFeeRate (Factory Level)

| Attribute | Details |
|-----------|---------|
| **Category** | Factory |
| **Impact** | MEDIUM - Per-YT exists but no centralized factory-level default fee schedule |

**Current State:** YT has per-contract `interest_fee_rate` at `yt.cairo:96` with admin setter at lines 1369-1374 (max 50%).

**Pendle V2 Reference:**
- [`PendleYieldContractFactoryUpg.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/YieldContracts/PendleYieldContractFactoryUpg.sol) lines 35-39

**Horizon Implementation:**
| File | Line | Changes Required |
|------|------|------------------|
| `contracts/src/factory.cairo` | After line 76 | Add `default_interest_fee_rate: u256` storage |
| `contracts/src/factory.cairo` | `create_yield_contracts()` around line 207 | Pass fee rate to YT constructor calldata |
| `contracts/src/tokens/yt.cairo` | Constructor | Accept and set initial `interest_fee_rate` from factory |

**Implementation:**
```cairo
// Factory storage
default_interest_fee_rate: u256,  // WAD-scaled, max 0.5e18 (50%) to match YT max

// In create_yield_contracts(), add to YT constructor calldata after decimals (line 231)
let interest_fee_rate = self.default_interest_fee_rate.read();
yt_calldata.append(interest_fee_rate.low.into());
yt_calldata.append(interest_fee_rate.high.into());
```

---

### P1-4: Factory setInterestFeeRate() (Factory Level)

| File | Changes Required |
|------|------------------|
| `contracts/src/factory.cairo` | Add `set_default_interest_fee_rate(rate: u256)` admin function |
| `contracts/src/interfaces/i_factory.cairo` | Add to interface |

```cairo
fn set_default_interest_fee_rate(ref self: ContractState, rate: u256) {
    self.ownable.assert_only_owner();
    assert(rate <= MAX_INTEREST_FEE_RATE, Errors::FACTORY_INVALID_FEE_RATE);
    self.default_interest_fee_rate.write(rate);
    self.emit(InterestFeeRateSet { rate });
}
```

---

## Priority 2 - Medium (Feature Completeness)

### Router Gaps

#### P2-R1: addLiquidityDualTokenAndPt

| Attribute | Details |
|-----------|---------|
| **Description** | Mixed deposits: token via aggregator + PT simultaneously |
| **Impact** | Minor UX gap for advanced liquidity provision |

**Pendle V2 Reference:**
- [`ActionAddRemoveLiqV3.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/router/ActionAddRemoveLiqV3.sol) - `addLiquidityDualTokenAndPt`

**Horizon Implementation:**
| File | Changes Required |
|------|------------------|
| `contracts/src/router.cairo` | New function after `add_liquidity_single_token` (line 565) |
| `contracts/src/interfaces/i_router.cairo` | Add to `IRouter` trait |

```cairo
fn add_liquidity_dual_token_and_pt(
    ref self: ContractState,
    market: ContractAddress,
    receiver: ContractAddress,
    input: TokenInput,      // Token to convert to SY via aggregator
    pt_amount: u256,        // PT to add directly
    min_lp_out: u256,
    deadline: u64,
) -> u256
```

**Flow:**
1. Swap input token → underlying via aggregator
2. Deposit underlying → SY
3. Call `market.mint(receiver, sy_amount, pt_amount)`

---

#### P2-R2: removeLiquidityDualTokenAndPt

| Attribute | Details |
|-----------|---------|
| **Description** | Mixed withdrawals: receive token + PT separately |

**Horizon Implementation:**
| File | Changes Required |
|------|------------------|
| `contracts/src/router.cairo` | New function after `remove_liquidity_single_token` (line 603) |

```cairo
fn remove_liquidity_dual_token_and_pt(
    ref self: ContractState,
    market: ContractAddress,
    receiver: ContractAddress,
    lp_to_burn: u256,
    output: TokenOutput,    // Swap SY portion to this token
    min_pt_out: u256,
    deadline: u64,
) -> (u256, u256)  // (token_out, pt_out)
```

---

#### P2-R3: swapTokensToTokens

| Attribute | Details |
|-----------|---------|
| **Description** | General aggregator routing not involving PT/YT |
| **Impact** | Convenience function - users can call aggregators directly |

**Horizon Implementation:**
| File | Changes Required |
|------|------------------|
| `contracts/src/router.cairo` | New function |

```cairo
fn swap_tokens_to_tokens(
    ref self: ContractState,
    input: TokenInput,
    output: TokenOutput,
    receiver: ContractAddress,
    deadline: u64,
) -> u256
```

---

#### P2-R4: LimitOrderData Integration

| Attribute | Details |
|-----------|---------|
| **Description** | On-chain limit orders, maker order matching during swaps |
| **Impact** | Cannot implement advanced trading strategies |

**Pendle V2 Reference:**
- [`ActionSwapPTV3.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/router/ActionSwapPTV3.sol) - Limit order params in swaps
- [`IPLimitRouter.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/interfaces/IPLimitRouter.sol)

**Horizon Implementation:**
| File | Changes Required |
|------|------------------|
| `contracts/src/interfaces/i_router.cairo` | Add `LimitOrderData` struct |
| `contracts/src/router.cairo` | Add limit order matching logic to swap functions |
| New file: `contracts/src/limit_router.cairo` | Separate limit order infrastructure |

```cairo
struct LimitOrderData {
    limit_router: ContractAddress,
    eps_skip_market: u256,  // Skip market if limit price better
    normal_fills: Span<FillOrderParams>,
    flash_fills: Span<FillOrderParams>,
}

struct FillOrderParams {
    order: LimitOrder,
    signature: Span<felt252>,
    make_fill_amount: u256,
}
```

**Note:** This is a significant feature requiring separate limit order book infrastructure.

---

#### P2-R5: boostMarkets

| Attribute | Details |
|-----------|---------|
| **Description** | Gauge boost in batch |
| **Impact** | N/A without governance system (Phase 4 dependency) |

**Blocked by:** Governance system (P4)

---

#### P2-R6: Permit Signatures

| Attribute | Details |
|-----------|---------|
| **Description** | EIP-2612 gasless approvals |
| **Impact** | N/A for Starknet (different signature model) |

**Note:** Starknet uses account abstraction with native multicall. Users can batch approve + swap in single transaction via wallet. The Router already has `multicall()` at line 233.

---

### Factory Gaps

#### P2-F1: expiryDivisor

| Attribute | Details |
|-----------|---------|
| **Description** | Without divisor, markets may be created with arbitrary expiries, fragmenting liquidity |
| **Impact** | Standardized expiry dates (weekly, monthly) concentrate liquidity |

**Pendle V2 Reference:**
- [`PendleYieldContractFactoryUpg.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/YieldContracts/PendleYieldContractFactoryUpg.sol) lines 45-48

```solidity
uint96 public expiryDivisor;  // e.g., 604800 = 1 week

function createYieldContract(..., uint32 expiry, ...) {
    if (expiry % expiryDivisor != 0) revert Errors.InvalidExpiry(expiry);
}
```

**Horizon Implementation:**
| File | Line | Changes Required |
|------|------|------------------|
| `contracts/src/factory.cairo` | Storage section after line 76 | Add `expiry_divisor: u64` |
| `contracts/src/factory.cairo` | Line ~178 in `create_yield_contracts` | Add validation `assert(expiry % divisor == 0, ...)` |
| `contracts/src/factory.cairo` | New function | Add `set_expiry_divisor(divisor: u64)` admin function |

```cairo
// Storage
expiry_divisor: u64,  // e.g., 604800 = 1 week, 0 = disabled

// In create_yield_contracts() after line 178
let divisor = self.expiry_divisor.read();
if divisor > 0 {
    assert(expiry % divisor == 0, Errors::FACTORY_INVALID_EXPIRY_DIVISOR);
}
```

---

#### P2-F2: setExpiryDivisor()

Covered in P2-F1 above.

---

### MarketFactory Gaps

#### P2-MF1: yieldContractFactory Reference

| Attribute | Details |
|-----------|---------|
| **Description** | Cross-factory queries for validation |

**Pendle V2 Reference:**
- [`PendleMarketFactoryV6Upg.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketFactoryV6Upg.sol) - Immutable `yieldContractFactory`

**Horizon Implementation:**
| File | Line | Changes Required |
|------|------|------------------|
| `contracts/src/market/market_factory.cairo` | Storage section after line 106 | Add `yield_contract_factory: ContractAddress` |
| `contracts/src/market/market_factory.cairo` | Constructor at line 182 | Accept and store factory address |
| `contracts/src/market/market_factory.cairo` | `create_market()` at line 212 | Optionally validate PT was deployed by linked factory |

```cairo
// Storage
yield_contract_factory: ContractAddress,

// Validation in create_market()
let factory = IFactoryDispatcher { contract_address: self.yield_contract_factory.read() };
assert(factory.is_valid_pt(pt), Errors::MARKET_FACTORY_INVALID_PT);
```

---

### YT Gaps

#### P2-YT1: YT Flash Mint

| Attribute | Details |
|-----------|---------|
| **Description** | Flash mint pattern for atomic operations |
| **Impact** | Advanced composability for arbitrage and atomic strategies |

**Pendle V2 Reference:**
- [`PendleYieldToken.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/YieldContracts/PendleYieldToken.sol) - Flash mint callback

**Horizon Implementation:**
| File | Changes Required |
|------|------------------|
| `contracts/src/tokens/yt.cairo` | Add `flash_mint_py()` function with callback |
| `contracts/src/interfaces/i_yt.cairo` | Add to interface |
| New file: `contracts/src/interfaces/i_flash_callback.cairo` | Flash callback interface |

```cairo
#[starknet::interface]
trait IFlashCallback<TContractState> {
    fn flash_callback(
        ref self: TContractState,
        pt_amount: u256,
        yt_amount: u256,
        data: Span<felt252>,
    );
}

// In YT contract
fn flash_mint_py(
    ref self: ContractState,
    receiver: ContractAddress,
    amount_sy: u256,
    data: Span<felt252>,
) -> (u256, u256) {
    // 1. Mint PT + YT to receiver
    // 2. Call receiver.flash_callback(pt, yt, data)
    // 3. Verify SY was transferred in to cover mint
}
```

---

### Market Gaps

#### P2-M1: Storage Packing

| Attribute | Details |
|-----------|---------|
| **Description** | Using u256 per field vs Pendle's int128/uint96/uint16 |
| **Impact** | Gas optimization - reduces storage reads/writes |

**Pendle V2 Reference:**
- [`PendleMarketV6.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol) - Packed MarketState

```solidity
struct MarketState {
    int256 totalPt;
    int256 totalSy;
    int256 totalLp;
    address treasury;
    int256 scalarRoot;
    uint256 expiry;
    uint256 lnFeeRateRoot;
    // ...packed into fewer slots
}
```

**Horizon Implementation:**
| File | Changes Required |
|------|------------------|
| `contracts/src/market/amm.cairo` | Storage section (lines 106-144) | Analyze and pack related fields |

**Note:** Cairo storage model differs from EVM. Packing benefits depend on Starknet's storage pricing model. Consider packing after profiling actual gas costs.

---

#### P2-M2: Token Transfer Pattern

| Attribute | Details |
|-----------|---------|
| **Description** | Uses `transfer_from` pulls vs Pendle's pre-transfer + balance checks |
| **Impact** | Different MEV characteristics, gas costs |

**Current Pattern (Horizon):**
```cairo
// Pull tokens from caller
sy_dispatcher.transfer_from(caller, self_addr, amount);
```

**Pendle Pattern:**
```solidity
// Caller pre-transfers, market checks balance delta
uint256 balBefore = SY.balanceOf(address(this));
// ... (caller transferred tokens before call)
uint256 netSyIn = SY.balanceOf(address(this)) - balBefore;
```

**Note:** YT contract already uses the "floating token" pattern (pre-transfer + balance delta) - see `mint_py`, `redeem_py` functions which consume "floating" SY/PT/YT. Market uses pull pattern for simpler UX via Router. This is an intentional design choice.

**Decision:** Current pattern is acceptable. Document difference.

---

### Oracle Gaps (Optional)

#### P2-O1: Chainlink/Pragma Wrapper

| Attribute | Details |
|-----------|---------|
| **Description** | `latestRoundData()` compatibility for DeFi integrations expecting Chainlink interface |
| **Impact** | Optional - enables integration with protocols expecting Chainlink format |

**Current State:** Horizon has `PragmaIndexOracle` at `contracts/src/oracles/pragma_index_oracle.cairo` which is a generic Pragma oracle adapter, and `PyLpOracle` at `contracts/src/oracles/py_lp_oracle.cairo` for PT/YT/LP TWAP pricing.

**Pendle V2 Reference:**
- [`PendleChainlinkOracle.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracle.sol)

**Horizon Implementation:**
| File | Changes Required |
|------|------------------|
| New file: `contracts/src/oracles/pragma_pt_oracle.cairo` | Pragma-compatible wrapper for PT prices |

```cairo
#[starknet::interface]
trait IPragmaCompatibleOracle<TContractState> {
    fn get_data_median(self: @TContractState, data_type: DataType) -> PragmaPricesResponse;
}

#[starknet::contract]
mod PragmaPtOracle {
    // Wraps PyLpOracle TWAP in Pragma-compatible format
    fn get_data_median(...) {
        let pt_rate = py_lp_oracle.get_pt_to_sy_rate(market, duration);
        // Format as PragmaPricesResponse
    }
}
```

---

#### P2-O2: Oracle Factory

| Attribute | Details |
|-----------|---------|
| **Description** | Factory for deploying oracle instances per market |
| **Impact** | Optional - convenience for deploying many oracle wrappers |

**Pendle V2 Reference:**
- [`PendleChainlinkOracleFactory.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleFactory.sol)

**Horizon Implementation:**
| File | Changes Required |
|------|------------------|
| New file: `contracts/src/oracles/oracle_factory.cairo` | Deploy oracle instances |

---

## Priority 3 - Low

| Gap | Category | File | Notes |
|-----|----------|------|-------|
| PT VERSION constant | Core Tokens | `contracts/src/tokens/pt.cairo` | Add `const VERSION: felt252 = 1;` |
| YT UserInterest struct packing | Core Tokens | `contracts/src/tokens/yt.cairo:81-83` | Combine `user_py_index` + `user_interest` Maps into single packed struct Map |
| Factory VERSION constant | Factory | `contracts/src/factory.cairo` | Add `const VERSION: felt252 = 1;` |
| MarketFactory VERSION constant | MarketFactory | `contracts/src/market/market_factory.cairo` | Add `const VERSION: felt252 = 1;` |
| `readState(router)` external view | Market | `contracts/src/market/amm.cairo` | Market has internal `_get_market_state()` at line 1488 and view variant at line 1514, but no external view exposing full state. Consider adding `get_market_state() -> MarketState` to `IMarket` |
| Cross-chain operations | Router | N/A | LayerZero/bridge support (Starknet-only focus) |

**Note:** PT reentrancy guard exposure removed from gap list - PT does not use ReentrancyGuardComponent (unlike YT which has it at line 36-37).

---

## Priority 4 - Future (Phase 4 - Governance)

All governance features are intentionally deferred to Phase 4.

| Gap | Description | Pendle Reference |
|-----|-------------|------------------|
| **veToken system** | Vote-locked governance token | [`VotingEscrowPendle.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/LiquidityMining/VotingEscrow/VotingEscrowPendle.sol) |
| **Gauge contracts** | Embedded in markets for LP incentives | [`PendleGauge.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/LiquidityMining/PendleGauge.sol) |
| **VotingController** | Epoch-based voting for emission allocation | [`VotingController.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/LiquidityMining/VotingController/VotingController.sol) |
| **GaugeController** | Emission streaming to gauges | [`GaugeController.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/LiquidityMining/GaugeController.sol) |
| **LP boost formula** | `min(LP, 0.4*LP + 0.6*(totalLP*userVe/totalVe))` | Gauge contracts |
| **Fee distribution** | 80% voters / 20% LPs split | Voting controller |
| **vePendle integration** | MarketFactory governance integration | MarketFactory |
| **gaugeController integration** | MarketFactory emission distribution | MarketFactory |

**Horizon Implementation (Phase 4):**
```
contracts/src/governance/
├── ve_token.cairo           # Vote-locked token
├── voting_controller.cairo  # Epoch voting
├── gauge_controller.cairo   # Emission distribution
└── gauge.cairo              # Market gauge
```

---

## Summary

| Priority | Count | Key Items |
|----------|-------|-----------|
| **Critical (P0)** | 1 | Multi-reward YT |
| **High (P1)** | 4 | Factory fee infrastructure |
| **Medium (P2)** | 14 | Router features, factory expiry, storage |
| **Low (P3)** | 6 | Versioning, minor compatibility |
| **Future (P4)** | 8 | Governance system |

**Total Remaining Gaps: 33**

---

## Implementation Order Recommendation

1. **P0-1: Multi-Reward YT** - Unblocks reward token integrations
2. **P1-1/P1-2: Factory rewardFeeRate** - Protocol revenue
3. **P1-3/P1-4: Factory interestFeeRate** - Centralized fee management
4. **P2-F1: expiryDivisor** - Standardize expiry dates
5. **P2-R1/P2-R2: Dual token liquidity** - UX improvement
6. **P2-YT1: Flash mint** - Composability
7. **P2-R4: Limit orders** - Advanced trading (larger scope)
8. **P4: Governance** - Phase 4 milestone
