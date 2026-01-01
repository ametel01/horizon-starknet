# Horizon Protocol vs Pendle V2: Comprehensive Gap Analysis Report

> **Date:** 2025-12-31 (Updated)
> **Scope:** Deep code analysis of Horizon Protocol implementation against Pendle V2 specifications
> **Status:** Horizon Alpha on Starknet Mainnet
>
> **Change Log:**
> - 2025-12-31: ✅ **Section 1.1 SY (Standardized Yield) Wrapper marked COMPLETE (95%)** - All major gaps implemented: slippage protection, burnFromInternalBalance, reentrancy guard, multi-token support (getTokensIn/Out, isValidToken), assetInfo, previewDeposit/Redeem, pausable transfers, negative yield watermark, SYWithRewards with RewardManagerComponent

---

## Executive Summary

Horizon Protocol implements **~65% of Pendle V2's core functionality**, focusing on yield tokenization primitives while omitting advanced governance and composability features. The protocol is production-ready for its stated alpha scope. **The SY (Standardized Yield) wrapper is now at 95% parity** with Pendle's SYBase, including full reward distribution via SYWithRewards.

### Key Findings

| Category | Parity Level | Critical Gaps |
|----------|--------------|---------------|
| **Core Tokenization (SY/PT/YT)** | 85% | ✅ SY: 95% complete (multi-token, rewards, slippage, assetInfo all implemented); Remaining: multi-reward YT |
| **AMM/Market** | 60% | PYIndex integration, reserve fee system, TWAP oracle (6 gaps), RewardManager/PendleGauge, flash callbacks |
| **Router** | 55% | Single-sided liquidity (7 functions), token aggregation (8 functions), batch operations |
| **Factory** | 70% | Protocol fee infrastructure (interestFeeRate, rewardFeeRate, treasury), expiryDivisor |
| **MarketFactory** | 65% | Protocol fee infrastructure (treasury, reserveFeePercent), router fee overrides, getMarketConfig |
| **Oracle System** | 35% | Market TWAP (CRITICAL), PT/LP price oracles, Chainlink/Pragma wrapper |
| **Governance/Rewards** | 0% | Complete absence |

---

## Table of Contents

1. [Core Token System Gaps](#1-core-token-system-gaps)
2. [AMM/Market System Gaps](#2-ammmarket-system-gaps)
3. [Router & Flash Swap Gaps](#3-router--flash-swap-gaps)
4. [Factory System Gaps](#4-factory-system-gaps)
5. [MarketFactory System Gaps](#5-marketfactory-system-gaps)
6. [Oracle System Gaps](#6-oracle-system-gaps)
7. [Governance & Incentive Gaps](#7-governance--incentive-gaps)
8. [Implementation Priority Matrix](#8-implementation-priority-matrix)
9. [Detailed Feature Comparison](#9-detailed-feature-comparison)
10. [Code Location Reference](#10-code-location-reference)

---

## 1. Core Token System Gaps

### 1.1 SY (Standardized Yield) Wrapper

**Implementation Status: 95%** ✅ COMPLETE (Core features + slippage, rewards, multi-token all implemented)

**Reference:** Pendle's `SYBase.sol` from [Pendle-SY-Public](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/core/StandardizedYield/SYBase.sol)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Exchange rate | `exchangeRate()` | `exchange_rate()` | ✅ |
| Deposit/Withdraw | 1:1 or asset-based | 1:1 with shares | ✅ |
| ERC-4626 support | Native | `is_erc4626` flag | ✅ |
| Custom oracle | via adapters | `IIndexOracle` | ✅ |
| Dual oracle source | N/A | ERC-4626 OR custom oracle | ✅ **Horizon exceeds** |
| OracleRateUpdated event | ❌ None | ✅ Emits on rate change | ✅ **Horizon exceeds** |
| Built-in upgradeability | Separate `SYBaseUpg` variant | ✅ Via UpgradeableComponent | ✅ **Horizon exceeds** |
| Slippage protection | `minSharesOut`, `minTokenOut` | ✅ `min_shares_out`, `min_token_out` params | ✅ |
| burnFromInternalBalance | ✅ For Router patterns | ✅ `burn_from_internal_balance` param | ✅ |
| Reentrancy guard | `nonReentrant` modifier | ✅ ReentrancyGuardComponent | ✅ |
| `getTokensIn()` / `getTokensOut()` | Returns supported tokens | ✅ `get_tokens_in()`, `get_tokens_out()` | ✅ |
| `isValidTokenIn/Out()` | Token validation | ✅ O(1) lookup via maps | ✅ |
| `assetInfo()` | Returns (AssetType, address, decimals) | ✅ Matches Pendle interface | ✅ |
| `previewDeposit/Redeem()` | External view functions | ✅ External view functions | ✅ |
| EIP-2612 Permit | `PendleERC20Permit` | ❌ No permit support | 🟡 MEDIUM (N/A for Starknet) |
| Native ETH support | `receive() external payable` | ❌ No ETH | 🟢 LOW (Starknet-specific) |
| `getRewardTokens()` | Lists claimable rewards | ✅ Via SYWithRewards | ✅ |
| `claimRewards()` | Claims external rewards | ✅ Via SYWithRewards | ✅ |
| `SYBaseWithRewards` | Full reward distribution | ✅ SYWithRewards contract + RewardManagerComponent | ✅ |
| Pausable transfers | `_beforeTokenTransfer` pauses all | ✅ Blocks mints AND transfers (allows redemptions) | ✅ **Horizon exceeds** |
| Negative yield watermark | In SY contract | ✅ `get_exchange_rate_watermark()` + NegativeYieldDetected event | ✅ |

**~~Gap Detail - Slippage Protection:~~** ✅ IMPLEMENTED

Horizon now matches Pendle's slippage protection:
```cairo
// Horizon - slippage protection implemented (sy.cairo:285-294)
fn deposit(
    ref self: ContractState,
    receiver: ContractAddress,
    amount_shares_to_deposit: u256,
    min_shares_out: u256,  // ← Reverts if output < minimum
) -> u256

fn redeem(
    ref self: ContractState,
    receiver: ContractAddress,
    amount_sy_to_redeem: u256,
    min_token_out: u256,  // ← Slippage protection for redemptions
    burn_from_internal_balance: bool,
) -> u256
```

**Tests:** `test_deposit_slippage_reverts`, `test_redeem_slippage_reverts`, `test_deposit_with_slippage_protection`, `test_redeem_with_slippage_protection`

---

**~~Gap Detail - burnFromInternalBalance:~~** ✅ IMPLEMENTED

Horizon now matches Pendle's pattern:
```cairo
// Horizon - burn from internal balance implemented (sy_component.cairo:357-364)
fn redeem(
    ref self: ComponentState<TContractState>,
    receiver: ContractAddress,
    amount_sy_to_redeem: u256,
    min_token_out: u256,
    burn_from_internal_balance: bool,  // ← Router pattern supported
) -> u256 {
    let burn_from = if burn_from_internal_balance {
        get_contract_address()  // Burn from contract's own balance
    } else {
        caller  // Standard pattern: burn from caller
    };
    // ...
}
```

**Tests:** `test_redeem_from_internal_balance`, `test_redeem_from_internal_balance_insufficient`, `test_redeem_to_different_receiver_from_internal_balance`

---

**~~Gap Detail - Multi-Token Support:~~** ✅ IMPLEMENTED

Horizon now fully supports multi-token SY wrappers:
```cairo
// Horizon - multi-token support implemented (sy_component.cairo:75-82, 506-541)
#[storage]
pub struct Storage {
    // Multi-token support: valid tokens for deposit
    pub tokens_in: Map<u32, ContractAddress>,
    pub tokens_in_count: u32,
    // Multi-token support: valid tokens for redemption
    pub tokens_out: Map<u32, ContractAddress>,
    pub tokens_out_count: u32,
    // O(1) token validation maps
    pub valid_tokens_in: Map<ContractAddress, bool>,
    pub valid_tokens_out: Map<ContractAddress, bool>,
}

// View functions matching Pendle interface
fn get_tokens_in(self: @ComponentState<TContractState>) -> Span<ContractAddress>
fn get_tokens_out(self: @ComponentState<TContractState>) -> Span<ContractAddress>
fn is_valid_token_in(self: @ComponentState<TContractState>, token: ContractAddress) -> bool
fn is_valid_token_out(self: @ComponentState<TContractState>, token: ContractAddress) -> bool
```

**Tests:** `test_sy_get_tokens_in_out_single`, `test_sy_get_tokens_in_out_multiple`, `test_sy_is_valid_token_in_single`, `test_sy_is_valid_token_out_single`, `test_sy_is_valid_token_multiple`

---

**~~Gap Detail - Reward System (SYBaseWithRewards):~~** ✅ IMPLEMENTED

Horizon now has a complete reward system via `SYWithRewards` contract + `RewardManagerComponent`:
```cairo
// Horizon - SYWithRewards contract (sy_with_rewards.cairo:47-77)
// Composes: SYComponent + RewardManagerComponent
component!(path: SYComponent, storage: sy, event: SYEvent);
component!(path: RewardManagerComponent, storage: rewards, event: RewardsEvent);

// Reward hooks triggered on every ERC20 transfer (sy_with_rewards.cairo:175-178)
fn before_update(ref self: ..., from: ContractAddress, recipient: ContractAddress, amount: u256) {
    // Update rewards for both parties BEFORE balance changes
    let mut contract = self.get_contract_mut();
    contract.rewards.update_rewards_for_two(from, recipient);
}

// ISYWithRewards interface (i_sy_with_rewards.cairo:93-128)
fn get_reward_tokens(self: @TContractState) -> Span<ContractAddress>;
fn claim_rewards(ref self: TContractState, user: ContractAddress) -> Span<u256>;
fn accrued_rewards(self: @TContractState, user: ContractAddress) -> Span<u256>;
fn reward_index(self: @TContractState, token: ContractAddress) -> u256;
fn user_reward_index(self: @TContractState, user: ContractAddress, token: ContractAddress) -> u256;
fn is_reward_token(self: @TContractState, token: ContractAddress) -> bool;
fn reward_tokens_count(self: @TContractState) -> u32;
```

**Tests:** (in `test_sy_with_rewards.cairo`) `test_preview_functions`, `test_user_reward_index_tracks_global`, `test_claim_twice_returns_zero`, `test_no_retroactive_rewards_for_new_depositor`, `test_tokens_in_out` (82 total SY tests passing)

---

### 1.2 YT (Yield Token) Interest System

**Implementation Status: 70%** (Core interest mechanics work; formula differs from Pendle's `InterestManagerYT`)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| PY Index watermark | Monotonic | Monotonic | ✅ |
| Per-user interest tracking | ✅ | ✅ | ✅ |
| Transfer hooks | Update both parties | Update both parties | ✅ |
| Post-expiry index freeze | `postExpiry.firstPYIndex` | `py_index_at_expiry` | ✅ |
| Interest claim | `redeemDueInterest()` | `redeem_due_interest()` | ✅ |
| Interest formula | `bal × Δidx / (prev × curr)` | `bal × Δidx / prev` | 🟡 MEDIUM (see below) |
| UserInterest struct packing | `{uint128 idx, uint128 accrued}` | Two separate Maps | 🟢 LOW |
| Two-user distribution | `_distributeInterestForTwo()` | Separate calls | ✅ Equivalent |
| Multi-reward claiming | `redeemDueInterestAndRewards()` | ❌ Missing | 🔴 HIGH |
| Reward token registry | `getRewardTokens()` | ❌ Missing | 🔴 HIGH |
| syReserve tracking | Tracks SY balance for accounting | ❌ Missing | 🟡 MEDIUM |
| Post-expiry treasury | Interest → protocol treasury | ❌ Interest locked | 🟡 MEDIUM |
| Protocol fee on interest | Via factory `_doTransferOutInterest()` | ❌ Missing | 🟡 MEDIUM |
| Same-block index caching | `doCacheIndexSameBlock` | ❌ Missing | 🟢 LOW |
| Batch mint/redeem | `mintPYMulti()`, `redeemPYMulti()` | ❌ Missing | 🟢 LOW |
| Claim interest on redeem | `redeemPY(redeemInterest=true)` | ❌ Separate call required | 🟢 LOW |
| Flash mint | Supported | ❌ Missing | 🟡 MEDIUM |

**Gap Detail - Multi-Reward Support:**

Pendle YT tracks both interest AND external rewards:
```solidity
// Pendle - separate interest and rewards
function redeemDueInterestAndRewards(
    address user,
    bool doRedeemInterest,
    bool doRedeemRewards
) external returns (uint256 interestOut, uint256[] memory rewardsOut);
```

Horizon only tracks interest from SY appreciation:
```cairo
// Horizon - interest only
fn redeem_due_interest(user: ContractAddress) -> u256
// Storage: single u256 per user
user_interest: Map<ContractAddress, u256>
```

**Impact:** Cannot support GLP-style tokens (rewards: ETH, esGMX), Pendle pools with PENDLE emissions, or any asset with native staking rewards beyond yield.

---

**Gap Detail - syReserve Tracking:**

Pendle tracks the SY reserve to detect "floating" SY (donations or accidental transfers):
```solidity
// Pendle - tracks reserve for accurate accounting
uint128 public syReserve;  // Expected SY balance

function _getFloatingSy() internal view returns (uint256) {
    return IStandardizedYield(SY).balanceOf(address(this)) - syReserve;
}
```

Horizon relies on actual SY balance without reserve tracking:
```cairo
// Horizon - no reserve concept
// Direct transfer from SY balance without floating detection
let success = sy.transfer(receiver, amount_sy);
```

**Impact:** Cannot detect and handle unexpected SY deposits. Minor accounting concern.

---

**Gap Detail - Post-Expiry Treasury:**

Pendle redirects post-expiry interest to the protocol treasury:
```solidity
// Pendle - post-expiry interest goes to treasury
struct PostExpiryData {
    uint128 firstPYIndex;              // Frozen index at expiry
    uint128 totalSyInterestForTreasury; // Accumulated post-expiry yield
    // ...
}

function redeemInterestAndRewardsPostExpiryForTreasury() external;
```

Horizon freezes the index at expiry but doesn't capture ongoing yield:
```cairo
// Horizon - index frozen, but post-expiry yield is effectively locked
if self.py_index_at_expiry.read() == 0 {
    self.py_index_at_expiry.write(current_index);  // Freeze
}
// Any SY appreciation after expiry stays in the contract forever
```

**Impact:** Post-expiry yield from underlying assets (e.g., stETH continues earning) is locked in the contract rather than flowing to protocol treasury or LPs.

---

**Gap Detail - Interest Calculation Formula Difference:**

Pendle uses a **normalized interest formula** from `InterestManagerYT`:
```solidity
// Pendle - normalizes interest to current SY value
interestFromYT = (principal × (currentIndex - prevIndex)) / (prevIndex × currentIndex)
// Simplifies to: interest = balance × indexGrowth / currentIndex
```

Horizon uses a **simpler absolute formula**:
```cairo
// Horizon - absolute interest calculation
new_interest = wad_div(wad_mul(yt_balance, index_diff), user_index)
// Simplifies to: interest = balance × indexGrowth
```

**Concrete Example** (100 YT, index grows from 1.0 to 1.1 = 10% yield):
- **Pendle**: `100 × 0.1 / (1.0 × 1.1) = 100 × 0.1 / 1.1 = ~9.09 SY`
- **Horizon**: `100 × 0.1 / 1.0 = 10.0 SY`

**Why the difference?** Pendle's formula maintains the invariant that "totalSyRedeemable will not change over time" - the division by `currentIndex` accounts for SY's increased value. Horizon's simpler approach gives ~10% more interest in this example.

**Impact:** Economic divergence from Pendle. Horizon users receive slightly more SY tokens as interest, but those tokens are worth more in underlying terms due to the higher index. The NET economic value is arguably the same, but accounting differs. This is a **design choice** rather than a bug, but should be documented for users.

---

### 1.3 PT (Principal Token)

**Implementation Status: 95%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| 1:1 redemption at expiry | ✅ | ✅ | ✅ |
| Only YT can mint/burn | ✅ | `assert_only_yt()` | ✅ |
| Circular reference init | Via factory | Via `initialize_yt()` | ✅ |
| Standard ERC20 | ✅ | ✅ | ✅ |
| Emergency pause | ❌ Not pausable | ✅ PAUSER_ROLE | ✅ **Horizon exceeds** |
| VERSION constant | `VERSION = 6` | ❌ None | 🟢 LOW |
| Reentrancy guard exposure | `reentrancyGuardEntered()` | ❌ None | 🟢 LOW |

**Horizon exceeds Pendle in emergency controls** - PT mint can be paused in emergencies via PAUSER_ROLE.

**Minor gaps:** VERSION constant and reentrancy guard exposure are useful for integrations and on-chain versioning but not critical for core functionality.

---

## 2. AMM/Market System Gaps

### 2.1 Core AMM Curve (MarketMathCore)

**Implementation Status: 70%** (Core curve math works; missing PYIndex integration + Pendle fee mechanics; bounds/initialization behavior diverges)

**Reference:** Pendle's `MarketMathCore.sol` from [pendle-core-v2-public](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/MarketMathCore.sol)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Logit-based curve | `ln(p/(1-p))/scalar + anchor` | Same formula | ✅ |
| Rate scalar time decay | `scalarRoot * 365d / timeToExpiry` | Same formula | ✅ |
| Rate anchor continuity | Anchor derived from `lastLnImpliedRate` each trade | Same pattern | ✅ |
| `MINIMUM_LIQUIDITY` | 1000 | 1000 | ✅ |
| `MAX_MARKET_PROPORTION` | 96% | 96% (FP used by Market), 99.9% (WAD path) | ⚠️ Inconsistent |
| Proportion bound enforcement | Revert if `proportion > MAX_MARKET_PROPORTION` | Clamp to `MAX_PROPORTION` (no revert) | 🟡 MEDIUM |
| Exchange-rate lower bound | Revert if `exchangeRate < 1` | Floor to 1 (no revert) | 🟡 MEDIUM |
| PT price convergence | Approaches 1 at expiry | Approaches 1 at expiry | ✅ |
| Dual math implementations | N/A | WAD + cubit FP | ✅ **Horizon exceeds** |
| Swap variants in core math | 2 wrappers (exact PT in / exact PT out) | 4 (all combinations) | ✅ **Horizon exceeds** |
| PYIndex integration | `syToAsset()`, `assetToSy()`, `assetToSyUp()` | ❌ Direct SY only | 🔴 HIGH |
| Reserve fee splitting | `reserveFeePercent`, `netSyToReserve` | ❌ Single fee bucket | 🔴 HIGH |
| Treasury address | `address treasury` in MarketState | ❌ None | 🟡 MEDIUM |
| Initial liquidity recipient | `MINIMUM_LIQUIDITY` to reserve (treasury) | Burned to zero address | 🟡 MEDIUM |
| Signed integer arithmetic | `int256` for netPtToAccount | ❌ `u256` only | 🟡 MEDIUM |
| Fee formula | `exp(lnFeeRateRoot * timeToExpiry / 365d)` | Linear decay | 🟡 MEDIUM |
| Rounding protection | `rawDivUp()` on sy/pt used; `assetToSyUp()` for negative | ❌ Standard division | 🟢 LOW |
| `setInitialLnImpliedRate()` | Explicit init using `PYIndex` + `initialAnchor` | ❌ Direct `last_ln_implied_rate` set | 🟢 LOW |

---

**Gap Detail - PYIndex Integration (HIGH):**

Pendle's MarketMathCore operates in **asset** (underlying) terms, not raw SY terms:
```solidity
// Pendle - converts SY to asset value before calculations
function getMarketPreCompute(...) {
    res.totalAsset = index.syToAsset(market.totalSy);  // ← Key conversion
    // All pricing uses totalAsset, not totalSy
}

function calcTrade(...) {
    int256 preFeeExchangeRate = _getExchangeRate(
        market.totalPt,
        comp.totalAsset,  // ← Asset value, not SY
        ...
    );
    // Convert back to SY for output (round up on negative)
    netSyToAccount = netAssetToAccount < 0
        ? index.assetToSyUp(netAssetToAccount)
        : index.assetToSy(netAssetToAccount);
}
```

Horizon works directly with SY values without asset conversion:
```cairo
// Horizon - works in SY terms only
let exchange_rate = get_exchange_rate(
    *state.pt_reserve,
    *state.sy_reserve,  // ← Raw SY, not asset value
    ...
);
```

**Impact:** Economic difference in how the AMM prices PT. Pendle prices PT against the **underlying value** of SY (accounting for SY appreciation), while Horizon prices PT against raw SY tokens. This matters when SY has grown significantly - Pendle's approach ensures consistent economic behavior regardless of when the market was created.

---

**Gap Detail - Reserve Fee System (HIGH):**

Pendle splits fees between LPs and protocol treasury:
```solidity
// Pendle - MarketState includes fee infrastructure
struct MarketState {
    address treasury;              // Protocol treasury address
    uint256 lnFeeRateRoot;         // Fee rate parameter (log form)
    uint256 reserveFeePercent;     // % of fees to reserve (base 100)
    // ...
}

// Trade returns three values
function calcTrade(...) returns (
    int256 netSyToAccount,   // Amount to trader
    int256 netSyFee,         // Total fee collected
    int256 netSyToReserve    // Fee portion to treasury
) {
    int256 netAssetToReserve = (fee * market.reserveFeePercent.Int()) / 100;
    // ...
}
```

Horizon has a simpler single-bucket fee model:
```cairo
// Horizon - all fees to one bucket, owner-collected
fn calc_swap_exact_pt_for_sy(...) -> (u256, u256) {  // (output, fee)
    let fee = wad_mul(sy_out_before_fee, adjusted_fee_rate);
    // Fee stays in pool or accumulated for owner collection
    (sy_out, fee)
}
```

**Impact:** No protocol revenue sharing mechanism. All fees either stay with LPs or go to owner. Pendle's model allows configurable fee distribution (e.g., 80% LPs / 20% treasury).

---

**Gap Detail - Minimum Liquidity Recipient (MEDIUM):**

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

Horizon gives all LP to user (except MINIMUM_LIQUIDITY burned):
```cairo
// Horizon - all LP to user
fn calc_mint_lp(...) -> (u256, u256, u256, bool) {  // (lp_to_mint, sy_used, pt_used, is_first)
    if *state.total_lp == 0 {
        let lp_to_user = lp - MINIMUM_LIQUIDITY;
        // MINIMUM_LIQUIDITY is burned to zero address, not sent to treasury
        return (lp_to_user, sy_amount, pt_amount, true);
    }
}
```

**Impact:** Pendle accrues a small protocol-owned LP position at market creation; Horizon permanently burns it instead.

---

**Gap Detail - Proportion/Exchange-Rate Bounds (MEDIUM):**

Pendle reverts when bounds are exceeded:
```solidity
if (proportion > MAX_MARKET_PROPORTION) {
    revert Errors.MarketProportionTooHigh(proportion, MAX_MARKET_PROPORTION);
}
if (exchangeRate < PMath.IONE) revert Errors.MarketExchangeRateBelowOne(exchangeRate);
```

Horizon clamps and floors instead of reverting:
```cairo
let clamped_proportion = max(MIN_PROPORTION, min(MAX_PROPORTION, new_proportion));
// ...
let exchange_rate = max(exchange_rate, WAD);
```

**Impact:** Horizon permits trades that Pendle would reject, pricing them at boundary values. This changes tail-risk behavior and can allow deeper imbalances.

---

**Gap Detail - Fee Decay Formula (MEDIUM):**

Pendle uses **exponential** fee decay via log-space parameters:
```solidity
// Pendle - exponential decay
// lnFeeRateRoot is stored in log space
function _getExchangeRateFromImpliedRate(uint256 lnImpliedRate, uint256 timeToExpiry)
    returns (int256 exchangeRate)
{
    uint256 rt = (lnImpliedRate * timeToExpiry) / IMPLIED_RATE_TIME;
    exchangeRate = LogExpMath.exp(rt.Int());
}
// Fee uses the same helper:
// feeRate = e^(lnFeeRateRoot * timeToExpiry / IMPLIED_RATE_TIME)
```

Horizon uses **linear** fee decay:
```cairo
// Horizon - linear decay
fn get_time_adjusted_fee_rate(fee_rate: u256, time_to_expiry: u64) -> u256 {
    wad_div(wad_mul(fee_rate, time_to_expiry_u256), SECONDS_PER_YEAR)
    // Result: feeRate * timeToExpiry / year
}
```

**Impact:** Different fee economics near expiry. Linear is simpler but not mathematically equivalent to Pendle's continuous compounding approach.

---

**Gap Detail - Signed Integer Arithmetic (MEDIUM):**

Pendle uses signed integers for bidirectional trades:
```solidity
// Pendle - single function handles both buy and sell
function executeTradeCore(
    MarketState memory market,
    PYIndex index,
    int256 netPtToAccount,  // Positive = buy PT, Negative = sell PT
    uint256 blockTime
) {
    // Single code path with signed arithmetic
    market.totalPt = market.totalPt.subNoNeg(netPtToAccount);
    market.totalSy = market.totalSy.subNoNeg(netSyToAccount + netSyToReserve);
}
```

Horizon uses unsigned integers with separate handling:
```cairo
// Horizon - separate functions for each direction
fn calc_swap_exact_pt_for_sy(...)   // Sell PT
fn calc_swap_exact_sy_for_pt(...)   // Buy PT
fn calc_swap_sy_for_exact_pt(...)   // Buy exact PT
fn calc_swap_pt_for_exact_sy(...)   // Sell for exact SY

// With explicit direction flags
let new_pt_reserve = if is_pt_out {
    pt_reserve - net_pt_change
} else {
    pt_reserve + net_pt_change
};
```

**Impact:** Functionally equivalent at the core math layer. Pendle exposes only exact PT in/out in `MarketMathCore` and relies on router-level flows for other exact-output paths; Horizon implements all four variants directly.

---

### 2.2 TWAP Oracle (Critical Gap)

**Implementation Status: 0%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Observation ring buffer | 65,535 max slots (uint16), grow via `increaseObservationsCardinalityNext` | ❌ None | 🔴 CRITICAL |
| `lnImpliedRateCumulative` | Per-observation cumulative (`uint216`) | ❌ None | 🔴 CRITICAL |
| `observe(secondsAgos[])` | Market-level oracle (`uint216[]`) | ❌ None | 🔴 CRITICAL |
| PT/YT TWAP helpers | `PendlePYOracleLib` / `PendlePYLpOracle` | ❌ None | 🔴 CRITICAL |
| LP TWAP helpers | `PendleLpOracleLib` / `PendlePYLpOracle` | ❌ None | 🔴 CRITICAL |
| Chainlink adapter | `PendleChainlinkOracleFactory` (+ `PendleChainlinkOracle`) | ❌ None | 🔴 HIGH |

Pendle splits TWAP into **market-level observations** (`observe`, `increaseObservationsCardinalityNext`) and
**oracle helpers** (`PendlePYOracleLib`, `PendleLpOracleLib`, `PendlePYLpOracle`) that derive PT/YT/LP rates from
`lnImpliedRateCumulative`.

**Impact:**
- **Cannot integrate with lending protocols** (Aave, Compound forks require TWAP)
- **No manipulation resistance** for PT/LP prices
- **DeFi composability blocked** until implemented

**Recommended Implementation:**
```cairo
// Market contract additions (Pendle-style OracleLib)
struct Observation {
    block_timestamp: u64,
    ln_implied_rate_cumulative: u256,
    initialized: bool,
}

observations: LegacyMap<u32, Observation>  // ring buffer (up to 65_535)
observations_index: u16
observations_cardinality: u16
observations_cardinality_next: u16

fn increase_observations_cardinality_next(cardinality_next: u16)
fn observe(seconds_agos: Span<u32>) -> Span<u256>  // returns lnImpliedRateCumulative
fn write_observation(block_timestamp: u64, ln_implied_rate: u256)

// Oracle helpers (PendlePYOracleLib / PendleLpOracleLib analogs)
fn get_pt_to_sy_rate(market: ContractAddress, duration: u32) -> u256
fn get_yt_to_sy_rate(market: ContractAddress, duration: u32) -> u256
fn get_lp_to_sy_rate(market: ContractAddress, duration: u32) -> u256
```

**Draft Skeleton (Cairo, OracleLib-style):**
```cairo
// Minimal structure only; mirrors Pendle/Uniswap V3 style APIs.
struct Observation {
    block_timestamp: u64,
    ln_implied_rate_cumulative: u256,
    initialized: bool,
}

fn oracle_initialize(time: u64) -> (u16, u16) {
    // observations[0] = Observation { time, 0, true }
    (1, 1)
}

fn oracle_transform(last: Observation, time: u64, ln_implied_rate: u256) -> Observation {
    // last.cumulative + ln_implied_rate * (time - last.time)
    Observation { block_timestamp: time, ln_implied_rate_cumulative: 0, initialized: true }
}

fn oracle_write(
    index: u16,
    time: u64,
    ln_implied_rate: u256,
    cardinality: u16,
    cardinality_next: u16,
) -> (u16, u16) {
    // if same block, no-op; else write new observation and update ring index
    (index, cardinality)
}

fn oracle_grow(current: u16, next: u16) -> u16 {
    // pre-fill slots to avoid storage spikes
    current
}

fn oracle_observe_single(
    time: u64,
    seconds_ago: u32,
    ln_implied_rate: u256,
    index: u16,
    cardinality: u16,
) -> u256 {
    // binary search around target timestamp and interpolate cumulative
    0
}

fn oracle_observe(
    time: u64,
    seconds_agos: Span<u32>,
    ln_implied_rate: u256,
    index: u16,
    cardinality: u16,
) -> Span<u256> {
    // map over seconds_agos -> observe_single
    Span::<u256> { span: array![] }
}
```

---

### 2.3 Fee System

**Implementation Status: 40%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Fee collection | Auto-compounded to LPs | Accumulated, owner-collects | 🔴 HIGH |
| Fee reinvestment | Into SY side of pool | ❌ None | 🔴 HIGH |
| Protocol fee split | 80% voters / 20% LPs | ❌ None | 🟡 MEDIUM |
| Dynamic fee rate | Based on rate impact | Fixed rate | 🟡 MEDIUM |

**Gap Detail - Fee Auto-Compounding:**

Pendle automatically reinvests fees into the pool:
```solidity
// Pendle - fees compound into reserves
totalSy += feeInSy;  // Directly adds to LP holdings
```

Horizon collects fees separately:
```cairo
// Horizon - fees accumulate in separate bucket
self.total_fees_collected.write(self.total_fees_collected.read() + fee);
// Must be manually collected by owner
```

**Impact:** LPs miss out on ~0.5-2% annual returns from fee compounding.

---

### 2.4 LP Token & Liquidity Operations

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

### 2.5 Market Contract (PendleMarketV6)

**Implementation Status: 60%** (Core liquidity/swap works; missing TWAP oracle, rewards, flash callbacks)

**Reference:** Pendle's `PendleMarketV6.sol` from [pendle-core-v2-public](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Market is LP token | ✅ (PendleERC20 + permit) | ✅ (ERC20Component) | ✅ |
| mint() add liquidity | ✅ | ✅ | ✅ |
| burn() remove liquidity | ✅ | ✅ | ✅ |
| swapExactPtForSy | ✅ | ✅ swap_exact_pt_for_sy | ✅ |
| swapSyForExactPt | ✅ | ✅ swap_sy_for_exact_pt | ✅ |
| 4 swap function variants | 2 in Market (optional callback) | 4 explicit functions | ✅ **Horizon exceeds** |
| Emergency pause | ❌ No pause | ✅ PAUSER_ROLE | ✅ **Horizon exceeds** |
| Admin scalar adjustment | ❌ Immutable | ✅ set_scalar_root() | ✅ **Horizon exceeds** |
| Rich swap events | Basic | Detailed (rate before/after, exchange rate) | ✅ **Horizon exceeds** |
| TWAP observation buffer | 65,535 slots | ❌ None | 🔴 CRITICAL |
| observe(secondsAgos[]) | ✅ | ❌ None | 🔴 CRITICAL |
| increaseObservationsCardinalityNext | ✅ | ❌ None | 🔴 CRITICAL |
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
| readState(router) | External view | _get_market_state() internal | 🟢 LOW |

---

**Gap Detail - TWAP Observation Buffer (CRITICAL):**

Pendle's Market contract has a built-in Uniswap V3-style TWAP oracle:
```solidity
// Pendle - 65,535-slot observation ring buffer
OracleLib.Observation[65_535] public observations;

struct MarketStorage {
    int128 totalPt;
    int128 totalSy;
    uint96 lastLnImpliedRate;
    uint16 observationIndex;          // Current position
    uint16 observationCardinality;    // Initialized slots
    uint16 observationCardinalityNext; // Target cardinality
}

// Retrieve historical cumulative rates
function observe(uint32[] memory secondsAgos)
    external view returns (uint216[] memory lnImpliedRateCumulative);

// Expand observation buffer
function increaseObservationsCardinalityNext(uint16 cardinalityNext) external;
```

Horizon has no TWAP infrastructure:
```cairo
// Horizon - no observations
struct Storage {
    last_ln_implied_rate: u256,  // Only current rate, no history
    // No observation buffer, index, or cardinality
}
```

**Impact:** Cannot provide manipulation-resistant price feeds. Lending protocols (Aave, Compound forks) require TWAP for collateral valuation. This is the #1 blocker for DeFi composability.

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

## 3. Router & Flash Swap Gaps

### 3.1 Router Architecture

**Implementation Status: 55%** (Core operations work; missing advanced features)

**Reference:** Pendle's Router contracts from [pendle-core-v2-public](https://github.com/pendle-finance/pendle-core-v2-public/tree/main/contracts/router)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Architecture | Diamond/Proxy with facets | Monolithic contract | ⚠️ Different |
| Contract count | 11+ action contracts | 1 router.cairo | ⚠️ Simpler |
| Upgradeability | Facet-based modular | Single class upgrade | ⚠️ Less modular |
| ReentrancyGuard | Via modifier | ReentrancyGuardComponent | ✅ |
| Emergency pause | ❌ No pause | ✅ PAUSER_ROLE | ✅ **Horizon exceeds** |
| RBAC system | ❌ Owner only | ✅ AccessControlComponent | ✅ **Horizon exceeds** |
| Deadline enforcement | ✅ | ✅ | ✅ |
| Slippage protection | ✅ min_out params | ✅ min_out params | ✅ |

**Pendle Router Contracts:**
- `PendleRouterV4.sol` - Main proxy with selector routing
- `ActionSimple.sol` - Simplified swap/liquidity (no limit orders)
- `ActionSwapPTV3.sol` - PT swaps with ApproxParams, LimitOrderData
- `ActionSwapYTV3.sol` - YT swaps with flash mechanics
- `ActionAddRemoveLiqV3.sol` - Extensive liquidity operations
- `ActionMiscV3.sol` - multicall, boostMarkets, reward redemption
- `ActionCrossChain.sol` - Cross-chain messaging
- `CallbackHelper.sol` - Flash swap callback infrastructure

---

### 3.2 Core Router Functions

**Implementation Status: 85%** (All basic operations implemented)

| Function | Pendle V2 | Horizon | Status |
|----------|-----------|---------|--------|
| `mintPyFromSy` | ✅ | `mint_py_from_sy` | ✅ |
| `redeemPyToSy` | ✅ | `redeem_py_to_sy` | ✅ |
| `redeemPyPostExpiry` | ✅ | `redeem_pt_post_expiry` | ✅ |
| `addLiquidity` | ✅ | `add_liquidity` | ✅ |
| `removeLiquidity` | ✅ | `remove_liquidity` | ✅ |
| `swapExactPtForSy` | ✅ | `swap_exact_pt_for_sy` | ✅ |
| `swapExactSyForPt` | ✅ | `swap_exact_sy_for_pt` | ✅ |
| `swapSyForExactPt` | ✅ | `swap_sy_for_exact_pt` | ✅ |
| `swapPtForExactSy` | ✅ | `swap_pt_for_exact_sy` | ✅ |
| `swapExactSyForYt` | ✅ | `swap_exact_sy_for_yt` | ✅ |
| `swapExactYtForSy` | ✅ | `swap_exact_yt_for_sy` | ✅ |
| Convenience wrappers | N/A | `buy_pt_from_sy`, `sell_pt_for_sy`, `mint_py_and_keep` | ✅ **Horizon exceeds** |

---

### 3.3 YT Flash Swap Pattern

**Implementation Status: Implemented (Different Approach)**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| YT swap via PT market | Flash callback | Mint → Sell PT pattern | ⚠️ Different |
| Buy YT | Flash borrow SY | `swap_exact_sy_for_yt` | ✅ Works |
| Sell YT | Flash mechanism | `swap_exact_yt_for_sy` | ✅ Works |

**Horizon's YT Swap Pattern:**
```
Buy YT (swap_exact_sy_for_yt):
1. Transfer SY from user → Router
2. Mint PT+YT from all SY
3. Sell all PT back to market for SY
4. User receives: YT + recovered SY

Sell YT (swap_exact_yt_for_sy):
1. Transfer YT from user → Router
2. Transfer SY collateral from user
3. Buy exact PT from market using SY
4. Redeem PT+YT for SY
5. User receives: net SY (redemption - collateral + refund)
```

This is functionally equivalent but uses different mechanics than Pendle's flash callback pattern.

---

### 3.4 Single-Sided Liquidity (Major Gap)

**Implementation Status: 0%**

Pendle's `ActionAddRemoveLiqV3.sol` provides extensive single-sided liquidity operations:

| Function | Pendle V2 | Horizon | Status |
|----------|-----------|---------|--------|
| `addLiquiditySinglePt` | ✅ | ❌ None | 🔴 HIGH |
| `addLiquiditySingleSy` | ✅ | ❌ None | 🔴 HIGH |
| `addLiquiditySingleToken` | ✅ | ❌ None | 🔴 HIGH |
| `addLiquiditySingleTokenKeepYt` | ✅ | ❌ None | 🟡 MEDIUM |
| `removeLiquiditySinglePt` | ✅ | ❌ None | 🔴 HIGH |
| `removeLiquiditySingleSy` | ✅ | ❌ None | 🔴 HIGH |
| `removeLiquiditySingleToken` | ✅ | ❌ None | 🔴 HIGH |
| `addLiquidityDualTokenAndPt` | ✅ | ❌ None | 🟡 MEDIUM |
| `removeLiquidityDualTokenAndPt` | ✅ | ❌ None | 🟡 MEDIUM |

**Gap Detail - Single-Sided Liquidity:**

Pendle allows adding liquidity with just PT or SY (the other side is synthesized internally):
```solidity
// Pendle - add liquidity with only PT
function addLiquiditySinglePt(
    address receiver,
    address market,
    uint256 netPtIn,
    uint256 minLpOut,
    ApproxParams calldata guessPtSwapToSy,  // Binary search params
    LimitOrderData calldata limit
) external returns (uint256 netLpOut, uint256 netSyFee);

// Pendle - add with arbitrary token via aggregator
function addLiquiditySingleToken(
    address receiver,
    address market,
    uint256 minLpOut,
    ApproxParams calldata guessPtReceivedFromSy,
    TokenInput calldata input,  // Aggregator routing data
    LimitOrderData calldata limit
) external payable returns (uint256 netLpOut, uint256 netSyFee, uint256 netSyInterm);
```

Horizon requires both SY and PT:
```cairo
// Horizon - requires both tokens
fn add_liquidity(
    market: ContractAddress,
    receiver: ContractAddress,
    sy_desired: u256,
    pt_desired: u256,
    min_lp_out: u256,
    deadline: u64,
) -> (u256, u256, u256)
```

**Impact:** Users must hold both SY and PT to provide liquidity. Cannot one-click LP from any token. Major UX barrier for new users.

---

### 3.5 Token Aggregation & Routing (Major Gap)

**Implementation Status: 0%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| `TokenInput` struct | Token + aggregator swap data | ❌ None | 🔴 HIGH |
| `TokenOutput` struct | Token + aggregator swap data | ❌ None | 🔴 HIGH |
| `swapExactTokenForPt` | Any token → PT | ❌ None | 🔴 HIGH |
| `swapExactPtForToken` | PT → any token | ❌ None | 🔴 HIGH |
| `swapExactTokenForYt` | Any token → YT | ❌ None | 🔴 HIGH |
| `swapExactYtForToken` | YT → any token | ❌ None | 🔴 HIGH |
| `swapTokensToTokens` | General aggregator routing | ❌ None | 🔴 HIGH |
| Aggregator integration | Kyber, 1inch, etc. | ❌ None | 🔴 HIGH |

**Gap Detail - TokenInput/TokenOutput:**

Pendle's router accepts arbitrary tokens and routes through aggregators:
```solidity
// Pendle - TokenInput allows any input token
struct TokenInput {
    address tokenIn;           // Any ERC20
    uint256 netTokenIn;        // Amount
    address tokenMintSy;       // Intermediate token for SY
    address pendleSwap;        // Aggregator address
    SwapData swapData;         // Aggregator calldata
}

function swapExactTokenForPt(
    address receiver,
    address market,
    uint256 minPtOut,
    ApproxParams calldata guessPtOut,
    TokenInput calldata input,  // ← Flexible input
    LimitOrderData calldata limit
) external payable returns (uint256 netPtOut, uint256 netSyFee, uint256 netSyInterm);
```

Horizon only accepts SY or PT directly:
```cairo
// Horizon - SY or PT only
fn swap_exact_sy_for_pt(market, receiver, exact_sy_in, min_pt_out, deadline) -> u256
fn swap_exact_pt_for_sy(market, receiver, exact_pt_in, min_sy_out, deadline) -> u256
```

**Impact:** Users must convert tokens to SY/PT manually before using Horizon. Critical UX gap for mainstream adoption.

---

### 3.6 ApproxParams (Binary Search Parameters)

**Implementation Status: Partial**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| ApproxParams struct | guessMin, guessMax, maxIteration, eps | Internal only | ⚠️ Hidden |
| Caller-provided hints | ✅ Frontend can optimize | ❌ Fixed internal | 🟡 MEDIUM |
| Binary search iterations | Configurable (5-20) | Fixed (100) | 🟡 MEDIUM |
| Epsilon tolerance | Configurable | Fixed 0.01% | 🟡 MEDIUM |

**Gap Detail:**

Pendle allows callers to provide binary search hints:
```solidity
// Pendle - caller can guide binary search
struct ApproxParams {
    uint256 guessMin;       // Lower bound hint
    uint256 guessMax;       // Upper bound hint
    uint256 guessOffchain;  // Offchain calculation
    uint256 maxIteration;   // Max search iterations
    uint256 eps;            // Tolerance (1e15 = 0.1%)
}
```

Horizon uses fixed internal binary search:
```cairo
// Horizon - fixed parameters
const MAX_ITERATIONS: u32 = 100;
const CONVERGENCE_THRESHOLD: u256 = 100_000_000_000_000; // 0.01%
```

**Impact:** Pendle frontends can provide optimized guesses from off-chain calculations, reducing gas costs. Horizon always runs full binary search.

---

### 3.7 Limit Order Integration

**Implementation Status: 0%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| `LimitOrderData` struct | On-chain limit orders | ❌ None | 🟡 MEDIUM |
| Maker order matching | In swap execution | ❌ None | 🟡 MEDIUM |
| Limit order router | Separate infrastructure | ❌ None | 🟡 MEDIUM |

**Gap Detail:**

Pendle swaps can fill against on-chain limit orders:
```solidity
// Pendle - limit order data in every swap
struct LimitOrderData {
    address limitRouter;
    uint256 epsSkipMarket;  // Skip market if limit price better
    FillOrderParams[] normalFills;
    FillOrderParams[] flashFills;
    bytes optData;
}

function swapExactSyForPt(
    ...,
    LimitOrderData calldata limit  // ← Optional limit order matching
) external returns (uint256 netPtOut, uint256 netSyFee);
```

**Impact:** Cannot implement advanced trading strategies like limit orders or maker-taker dynamics.

---

### 3.8 Batch Operations (multicall)

**Implementation Status: 0%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| `multicall(Call3[])` | Batched operations | ❌ None | 🟡 MEDIUM |
| Atomic multi-action | Single tx for complex ops | ❌ None | 🟡 MEDIUM |
| `boostMarkets()` | Gauge boost in batch | ❌ None | 🟡 MEDIUM |
| `redeemDueInterestAndRewards()` | Combined redemption | ❌ None | 🟡 MEDIUM |

**Gap Detail:**

Pendle supports batched operations:
```solidity
// Pendle - execute multiple calls atomically
function multicall(Call3[] calldata calls)
    external payable returns (Result[] memory res);

// Combined interest + rewards redemption
function redeemDueInterestAndRewards(
    address user,
    address[] calldata sys,     // SY contracts
    address[] calldata yts,     // YT contracts
    address[] calldata markets  // Market contracts
) external;
```

**Impact:** Users must submit separate transactions for each operation. Higher gas costs and worse UX.

---

### 3.9 RouterStatic (Preview Functions)

**Implementation Status: 0%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| `getLpToSyRate` | View function | ❌ None | 🟡 MEDIUM |
| `getPtToSyRate` | View function | ❌ None | 🟡 MEDIUM |
| `addLiquiditySingleSyStatic` | Preview | ❌ None | 🟡 MEDIUM |
| `swapExactPtForSyStatic` | Preview | ❌ None | 🟡 MEDIUM |
| Gas-free quotes | Via static calls | ❌ Must simulate | 🟡 MEDIUM |

**Impact:** Frontend must simulate transactions; no gas-efficient quote functions.

---

### 3.10 Cross-Chain Operations

**Implementation Status: 0%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| `ActionCrossChain.sol` | Cross-chain messaging | ❌ None | 🟢 LOW (Starknet-only) |
| LayerZero integration | Bridge support | ❌ None | 🟢 LOW |

**Impact:** Low priority since Horizon is Starknet-native. Cross-chain would enable bridging between Starknet and EVM chains.

---

### 3.11 Permit Signatures

**Implementation Status: 0%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| EIP-2612 Permit | Gasless approvals | ❌ None | 🟡 MEDIUM |
| `permit()` in swaps | Single-tx approve+swap | ❌ None | 🟡 MEDIUM |

**Impact:** Users must approve tokens in separate transaction before swapping.

---

## 4. Factory System Gaps

### 4.1 YieldContractFactory Comparison

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
| `treasury` address | Configurable fee destination | ❌ None | 🔴 HIGH |
| `setInterestFeeRate()` | Owner-protected | ❌ None | 🔴 HIGH |
| `setRewardFeeRate()` | Owner-protected | ❌ None | 🔴 HIGH |
| `setTreasury()` | Owner-protected | ❌ None | 🔴 HIGH |
| `expiryDivisor` | Expiry must be divisible | ❌ Only checks future | 🟡 MEDIUM |
| `setExpiryDivisor()` | Owner-protected | ❌ None | 🟡 MEDIUM |
| `doCacheIndexSameBlock` | Same-block index caching | ❌ None | 🟡 MEDIUM |
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

Horizon has no protocol fee infrastructure:
```cairo
// Horizon - no fee configuration at factory level
// All interest goes to YT holders, no protocol cut
```

**Impact:** Protocol cannot capture revenue from interest or rewards. Essential for sustainable protocol economics.

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

### 4.2 Horizon Factory Advantages

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

## 5. MarketFactory System Gaps

### 5.1 PendleMarketFactoryV6Upg Comparison

**Implementation Status: 65%** (Core market deployment works; missing protocol fee infrastructure and governance integration)

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
| `treasury` address | ✅ Configurable | ❌ None | 🔴 HIGH |
| `reserveFeePercent` | ✅ Up to 100% | ❌ None | 🔴 HIGH |
| `setTreasuryAndFeeReserve()` | ✅ Owner-protected | ❌ None | 🔴 HIGH |
| `getMarketConfig(market, router)` | ✅ Returns treasury, fees | ❌ None | 🔴 HIGH |
| Router fee overrides | `overriddenFee` mapping | ❌ None | 🔴 HIGH |
| `setOverriddenFee(router, market, fee)` | ✅ Owner-protected | ❌ None | 🔴 HIGH |
| `vePendle` integration | ✅ Immutable reference | ❌ None | 🟡 Future |
| `gaugeController` integration | ✅ Immutable reference | ❌ None | 🟡 Future |
| `yieldContractFactory` reference | ✅ Immutable | ❌ None | 🟡 MEDIUM |
| `VERSION` constant | `VERSION = 6` | ❌ None | 🟢 LOW |
| `minInitialAnchor` | `PMath.IONE` | ❌ Only MAX check | 🟢 LOW |
| Split-code factory | ✅ Gas optimization | deploy_syscall with salt | ⚠️ Different |

---

**Gap Detail - Protocol Fee Infrastructure (HIGH):**

Pendle's MarketFactory manages market-level protocol fees:
```solidity
// Pendle - factory manages market fee configuration
address public treasury;           // Fee destination
uint8 public reserveFeePercent;    // % of fees to protocol (max 100)

function setTreasuryAndFeeReserve(
    address newTreasury,
    uint8 newReserveFeePercent
) public onlyOwner {
    if (newReserveFeePercent > maxReserveFeePercent) revert Errors.FeeExceeded();
    treasury = newTreasury;
    reserveFeePercent = newReserveFeePercent;
    emit NewTreasuryAndFeeReserve(newTreasury, newReserveFeePercent);
}

// Markets query factory for fee config
function getMarketConfig(address market, address router)
    external view returns (
        address _treasury,
        uint80 _overriddenFee,
        uint8 _reserveFeePercent
    )
{
    return (treasury, overriddenFee[router][market], reserveFeePercent);
}
```

Horizon has no market-level protocol fee infrastructure:
```cairo
// Horizon - markets have fees but no protocol revenue sharing
fn create_market(..., fee_rate: u256) -> ContractAddress {
    // fee_rate is passed to market but no treasury/reserve system
}
```

**Impact:** Protocol cannot capture revenue from market trading fees. Markets operate independently without centralized fee management.

---

**Gap Detail - Router Fee Overrides (HIGH):**

Pendle allows different fee rates for different routers/aggregators:
```solidity
// Pendle - router-specific fee overrides
mapping(address => mapping(address => uint80)) internal overriddenFee;

function setOverriddenFee(
    address router,
    address market,
    uint80 newFee
) public onlyOwner {
    // Override fee must be less than market's base fee
    if (newFee > IPMarket(market).getLnFeeRateRoot() && newFee > 0)
        revert Errors.InvalidFee();
    overriddenFee[router][market] = newFee;
    emit SetOverriddenFee(router, market, newFee);
}
```

Horizon has no router-specific fee overrides:
```cairo
// Horizon - same fees for all callers
// No mechanism to give preferred rates to partner aggregators
```

**Impact:** Cannot offer reduced fees to partner integrators (AVNU, Fibrous, etc.) or implement tiered fee structures.

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

### 5.2 Horizon MarketFactory Advantages

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

## 6. Oracle System Gaps

**CRITICAL: This is one of Horizon's principal weak points** - the oracle architecture fundamentally differs from Pendle's and blocks key DeFi integrations.

### 6.1 Oracle Architecture: Two Different Systems

Pendle's oracle infrastructure serves **two distinct purposes** that Horizon partially implements:

| Oracle Type | Purpose | Pendle V2 | Horizon | Status |
|-------------|---------|-----------|---------|--------|
| **Yield Index Oracle** | SY exchange rate (asset → shares) | Various adapters | `PragmaIndexOracle` | ✅ 75% |
| **Market TWAP Oracle** | PT/YT/LP token pricing | Built into Market | ❌ None | 🔴 CRITICAL 0% |

**Key Insight:** These are complementary systems, not alternatives. Pendle has BOTH. Horizon only has the first.

---

### 6.2 Yield Index Oracle (Horizon: 75% Implemented)

**What it does:** Provides the exchange rate for yield-bearing assets (e.g., "1 wstETH = 1.18 stETH")

**Reference:** Horizon's `PragmaIndexOracle` at `src/oracles/pragma_index_oracle.cairo`

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| ERC-4626 direct | `convert_to_assets()` | ✅ `is_erc4626` flag | ✅ |
| Custom oracle adapter | Various implementations | `PragmaIndexOracle` | ✅ |
| TWAP window | Configurable | Configurable (default 1hr) | ✅ |
| Staleness check | ✅ | `max_staleness` (default 24hr) | ✅ |
| Watermark (monotonic) | ✅ | ✅ `stored_index` | ✅ |
| Single-feed mode | ✅ | ✅ `denominator_pair_id = 0` | ✅ |
| Dual-feed ratio mode | ❌ None | ✅ `numerator/denominator` | ✅ **Horizon exceeds** |
| Emergency pause | ❌ None | ✅ `PAUSER_ROLE` | ✅ **Horizon exceeds** |
| Emergency index override | ❌ None | ✅ `emergency_set_index()` | ✅ **Horizon exceeds** |
| RBAC for config changes | ❌ Owner only | ✅ `OPERATOR_ROLE` | ✅ **Horizon exceeds** |
| Pragma integration | ❌ None (EVM) | ✅ Native | ✅ (Starknet-specific) |
| Chainlink integration | ✅ Native | ❌ None | 🟡 MEDIUM |
| Oracle factory | ✅ `PendleChainlinkOracleFactory` | ❌ Manual deployment | 🟡 MEDIUM |
| Rich events | ❌ Basic | ✅ `IndexUpdated`, `ConfigUpdated` | ✅ **Horizon exceeds** |

**Horizon's PragmaIndexOracle Advantages:**

1. **Dual-Feed Ratio Mode** - Supports calculating ratios from two USD-denominated prices:
```cairo
// Horizon - calculate wstETH/stETH from WSTETH/USD ÷ STETH/USD
if denominator_pair_id != 0 {
    let ratio = (num_price * denom_scale * WAD) / (denom_price * num_scale);
    return ratio;
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

### 6.3 Market TWAP Oracle (Horizon: 0% - CRITICAL GAP)

**What it does:** Provides manipulation-resistant TWAP prices for PT, YT, and LP tokens themselves

**Reference:** Pendle's `PendlePYLpOracle.sol`, `PendlePYOracleLib.sol`, `PendleLpOracleLib.sol`

**Why it matters:** This oracle is REQUIRED for:
- Using PT as collateral in lending protocols (Aave, Compound forks)
- Using LP tokens as collateral
- DeFi derivatives and structured products
- External price feeds and aggregators

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Observation buffer | 65,535 slots | ❌ None | 🔴 CRITICAL |
| `lnImpliedRateCumulative` | ✅ Accumulated | ❌ None | 🔴 CRITICAL |
| `observe(secondsAgos[])` | ✅ Historical rates | ❌ None | 🔴 CRITICAL |
| `increaseObservationsCardinalityNext()` | ✅ Buffer expansion | ❌ None | 🔴 CRITICAL |
| `getOracleState(market, duration)` | ✅ Readiness check | ❌ None | 🔴 CRITICAL |
| `getPtToSyRate(duration)` | ✅ PT TWAP | ❌ None | 🔴 CRITICAL |
| `getPtToAssetRate(duration)` | ✅ PT to underlying | ❌ None | 🔴 CRITICAL |
| `getYtToSyRate(duration)` | ✅ YT TWAP | ❌ None | 🔴 CRITICAL |
| `getYtToAssetRate(duration)` | ✅ YT to underlying | ❌ None | 🔴 CRITICAL |
| `getLpToSyRate(duration)` | ✅ LP TWAP | ❌ None | 🔴 CRITICAL |
| `getLpToAssetRate(duration)` | ✅ LP to underlying | ❌ None | 🔴 CRITICAL |
| Pre-deployed oracle contract | ✅ `PendlePYLpOracle` | ❌ None | 🔴 HIGH |
| Chainlink wrapper | ✅ `PendleChainlinkOracle` | ❌ None | 🔴 HIGH |
| `latestRoundData()` compatibility | ✅ Chainlink interface | ❌ None | 🔴 HIGH |
| Reentrancy guard check | ✅ `_checkMarketReentrancy()` | ❌ None | 🟡 MEDIUM |
| SY/PY index adjustment | ✅ For insolvency | ❌ None | 🟡 MEDIUM |

---

**Gap Detail - Pendle's TWAP Oracle Architecture:**

Pendle's Market TWAP is inspired by UniswapV3 but uses **implied rate** instead of price:

```solidity
// Pendle - Market stores observations (in MarketStorage)
struct MarketStorage {
    int128 totalPt;
    int128 totalSy;
    uint96 lastLnImpliedRate;              // Current implied rate (log form)
    uint16 observationIndex;               // Ring buffer position
    uint16 observationCardinality;         // Initialized slots
    uint16 observationCardinalityNext;     // Target expansion
}

// Each observation stores cumulative ln(impliedRate)
struct Observation {
    uint32 blockTimestamp;
    uint216 lnImpliedRateCumulative;       // Running sum
    bool initialized;
}

OracleLib.Observation[65_535] public observations;
```

**TWAP Calculation Flow:**

```
1. lnImpliedRate = (cumulative₁ - cumulative₀) / (t₁ - t₀)

2. impliedRate = e^(lnImpliedRate)

3. assetToPtPrice = impliedRate^(timeToMaturity / oneYear)

4. ptToAssetPrice = 1 / assetToPtPrice
```

**Why Geometric Mean?** The geometric mean (via log-space averaging) is more manipulation-resistant than arithmetic mean and properly handles compound interest dynamics.

---

**Gap Detail - Oracle Initialization Requirements:**

Lending protocols require specific cardinality based on TWAP duration:

| Chain | Block Time | 15min TWAP Cardinality | 30min TWAP Cardinality |
|-------|-----------|------------------------|------------------------|
| Ethereum | ~12s | 85 | 165 |
| Arbitrum | ~0.26s | 900 | 1,800 |
| Starknet | ~3-6s | ~180-360 | ~360-720 |

```solidity
// Pendle - initialize oracle before use
IPMarket(market).increaseObservationsCardinalityNext(cardinalityRequired);
// Then wait `duration` seconds for data accumulation
```

---

**Gap Detail - PT as Collateral Requirements:**

From Pendle's documentation, using PT as lending collateral requires:

```
Liquidation capacity = dCap × cRatio × k × f × (1+p)

Where:
- dCap: Debt cap for PT collateral
- cRatio: Collateral factor (e.g., 0.75)
- k: Liquidation threshold fraction (~0.30)
- f: Liquidation portion (typically 50%)
- p: Price impact tolerance (5-10%)
```

**Without Market TWAP, Horizon PT cannot be used as collateral in ANY lending protocol.**

---

**Gap Detail - LP Oracle Additional Complexity:**

LP pricing requires additional calculations beyond PT:

```solidity
// Pendle - LP oracle considers market state
function _getLpToAssetRateRaw() {
    if (market.isExpired()) {
        // Post-expiry: 1 PT = 1 asset
        return totalAsset + totalPt;
    } else {
        // Pre-expiry: complex calculation using implied rate
        uint256 assetFromPt = totalPt * getExchangeRateFromImpliedRate(...);
        return totalAsset + assetFromPt;
    }
}
```

---

### 6.4 Recommended Implementation for Horizon

**Phase 1: Market Observation Buffer (CRITICAL)**

```cairo
// Add to Market contract storage
struct Observation {
    timestamp: u64,
    ln_implied_rate_cumulative: u256,
    initialized: bool,
}

observations: LegacyMap<u32, Observation>,  // Ring buffer
observation_index: u32,                      // Current position
observation_cardinality: u32,                // Initialized slots
observation_cardinality_next: u32,           // Target cardinality
```

**Phase 2: Core Oracle Functions**

```cairo
// Market contract additions
fn increase_observations_cardinality_next(ref self, cardinality: u32);
fn observe(self, seconds_agos: Span<u32>) -> Span<u256>;

// Library functions (PtOracleLib equivalent)
fn get_pt_to_sy_rate(market: ContractAddress, duration: u32) -> u256;
fn get_pt_to_asset_rate(market: ContractAddress, duration: u32) -> u256;
fn get_yt_to_sy_rate(market: ContractAddress, duration: u32) -> u256;
fn get_lp_to_sy_rate(market: ContractAddress, duration: u32) -> u256;
fn get_oracle_state(market: ContractAddress, duration: u32)
    -> (bool /* needs_init */, bool /* has_sufficient_data */);
```

**Phase 3: External Oracle Wrapper**

```cairo
// Pre-deployed oracle contract (like PendlePYLpOracle)
#[starknet::contract]
pub mod HorizonPtLpOracle {
    fn get_pt_to_sy_rate(market: ContractAddress, duration: u32) -> u256;
    fn get_lp_to_sy_rate(market: ContractAddress, duration: u32) -> u256;
    fn get_oracle_state(market: ContractAddress, duration: u32) -> OracleState;

    // For Pragma/Chainlink compatibility wrapper
    fn get_latest_pt_price(market: ContractAddress, duration: u32) -> u256;
}
```

---

### 6.5 Oracle System Summary

| Oracle Component | Pendle V2 | Horizon | Implementation Priority |
|-----------------|-----------|---------|------------------------|
| Yield Index Oracle | ✅ Various | ✅ `PragmaIndexOracle` | Done |
| Market Observation Buffer | ✅ 65k slots | ❌ None | Priority 0 (CRITICAL) |
| PT TWAP Functions | ✅ Full suite | ❌ None | Priority 0 (CRITICAL) |
| LP TWAP Functions | ✅ Full suite | ❌ None | Priority 0 (CRITICAL) |
| Oracle State Check | ✅ `getOracleState()` | ❌ None | Priority 0 (CRITICAL) |
| Pre-deployed Oracle | ✅ `PendlePYLpOracle` | ❌ None | Priority 1 (HIGH) |
| Chainlink/Pragma Wrapper | ✅ `PendleChainlinkOracle` | ❌ None | Priority 1 (HIGH) |
| Oracle Factory | ✅ `PendleChainlinkOracleFactory` | ❌ None | Priority 2 (MEDIUM) |

**Total Oracle Gaps: 18** (8 CRITICAL, 6 HIGH, 4 MEDIUM)

**Blocking Impact:**
- ❌ Cannot use PT as collateral in lending protocols
- ❌ Cannot use LP as collateral in lending protocols
- ❌ No manipulation-resistant price feeds for external integrations
- ❌ Blocked from Aave, Compound, and fork integrations
- ❌ Cannot build derivatives or structured products on Horizon tokens

---

## 7. Governance & Incentive Gaps

### 7.1 Overall Status: 0% Implemented

**No governance or incentive infrastructure exists in Horizon v1.**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| vePENDLE token | Vote-locked governance | ❌ None | 🔴 Future |
| Gauge contracts | Embedded in markets | ❌ None | 🔴 Future |
| VotingController | Epoch-based voting | ❌ None | 🔴 Future |
| GaugeController | Emission streaming | ❌ None | 🔴 Future |
| LP boost formula | `min(LP, 0.4*LP + 0.6*(totalLP*userVe/totalVe))` | ❌ None | 🔴 Future |
| Fee distribution | 80% voters / 20% LPs | ❌ Owner-only | 🔴 Future |
| Multi-reward tokens | Per gauge | ❌ None | 🔴 Future |

### 7.2 Current Admin Structure

Horizon uses centralized admin control:

| Control | Mechanism | Risk Level |
|---------|-----------|------------|
| Fee collection | Owner-only `collect_fees()` | Centralized |
| Parameter changes | Owner-only `set_scalar_root()` | Centralized |
| Emergency pause | PAUSER_ROLE | Acceptable |
| Contract upgrades | Owner-only | Centralized |

**Roles Defined:**
- `DEFAULT_ADMIN_ROLE`: Full administrative control
- `PAUSER_ROLE`: Emergency pause only
- `OPERATOR_ROLE`: Defined but unused

### 7.3 Intentional Design Decision

From SPEC.md:
> **"Simplicity is intentional."** v1 is deliberately minimal and expandable.

Governance is explicitly **Phase 4** on the roadmap:
- Phase 1: Core tokenization (current)
- Phase 2: Advanced trading features
- Phase 3: Limit orders, fee distribution
- Phase 4: veToken system, gauge voting

---

## 8. Implementation Priority Matrix

### 8.1 Priority 0 - Critical (Blocks Integrations)

| Gap | Impact | Effort | Blocking |
|-----|--------|--------|----------|
| **Market Observation Buffer** | TWAP foundation | High | All PT/LP oracles |
| **lnImpliedRateCumulative** | TWAP calculation | High | All price feeds |
| **observe(secondsAgos[])** | Historical rate query | High | Lending protocols |
| **increaseObservationsCardinalityNext()** | Buffer expansion | Medium | Oracle initialization |
| **getOracleState(market, duration)** | Readiness check | Medium | Integration safety |
| **getPtToSyRate/getPtToAssetRate** | PT TWAP price | High | PT as collateral |
| **getLpToSyRate/getLpToAssetRate** | LP TWAP price | High | LP as collateral |
| **getYtToSyRate/getYtToAssetRate** | YT TWAP price | Medium | YT derivatives |
| **Pre-deployed Oracle Contract** | External access | Medium | DeFi integrations |
| **Pragma/Chainlink Wrapper** | Standard interface | Medium | Oracle aggregators |

### 8.2 Priority 1 - High (User Experience)

| Gap | Impact | Effort | Affected Users |
|-----|--------|--------|----------------|
| **Single-Sided Liquidity** | One-click LP from PT or SY | High | All LPs |
| **Token Aggregation (TokenInput/Output)** | Trade from any token | High | All users |
| **Aggregator Integration (AVNU, etc)** | Volume, discovery | High | All users |
| **addLiquiditySingleToken** | LP from any token | High | New users |
| **swapExactTokenForPt/Yt** | Buy PT/YT from any token | High | All traders |
| **PYIndex Integration** | AMM prices underlying, not raw SY | High | All traders, LPs |
| **Reserve Fee System** | Protocol revenue sharing | Medium | Protocol treasury |
| **RewardManager/PendleGauge** | LP incentive programs, yield farming | High | All LPs |
| **Factory Protocol Fees** | interestFeeRate, rewardFeeRate, treasury | Medium | Protocol treasury |
| **MarketFactory Protocol Fees** | treasury, reserveFeePercent, setTreasuryAndFeeReserve() | Medium | Protocol treasury |
| **MarketFactory Router Fee Overrides** | overriddenFee, setOverriddenFee(), getMarketConfig() | Medium | Aggregator partners |
| **SY Multi-Token Support** | Curve LP, Yearn vaults | Medium | Yield seekers |
| **SY assetInfo()** | Risk assessment, integrations | Low | Integrators |
| **Fee Auto-Compounding** | LP returns -1-2% annually | Medium | LPs |
| **Multi-Reward YT** | GLP, staking tokens | Medium | Yield seekers |
| **RouterStatic** | Frontend quotes | Low | All users |

### 8.3 Priority 2 - Medium (Feature Completeness)

| Gap | Impact | Effort |
|-----|--------|--------|
| ApproxParams (caller hints) | Frontend gas optimization | Medium |
| LimitOrderData integration | Advanced trading | Medium |
| multicall batching | Gas savings, UX | Medium |
| addLiquiditySingleTokenKeepYt | Convenience pattern | Medium |
| addLiquidityDualTokenAndPt | Mixed deposits | Medium |
| removeLiquidityDualTokenAndPt | Mixed withdrawals | Medium |
| Flash swap callback | Atomic arbitrage, composability | Medium |
| skim() balance reconciliation | Token recovery | Low |
| Separate burn receivers | LP exit flexibility | Low |
| Storage packing | Gas optimization | Medium |
| Fee config from factory | Centralized management | Low |
| Treasury address in MarketState | Fee destination | Low |
| LP fee on add liquidity | Protocol LP capture | Low |
| Exponential fee formula | Pendle economic parity | Medium |
| Signed integer arithmetic | Code elegance | Medium |
| SY slippage protection | Direct call safety | Low |
| SY burnFromInternalBalance | Router efficiency | Low |
| SY reentrancy guard | Explicit protection | Low |
| SY EIP-2612 Permit | Gasless approvals | Medium |
| SY reward system | Multi-reward assets | High |
| Asset type classification | Risk assessment | Low |
| Permit signatures | UX improvement | Low |
| Batch operations (boostMarkets, etc) | Gas efficiency | Medium |
| redeemDueInterestAndRewards | Combined redemption | Medium |
| Post-expiry treasury | Captures ongoing yield | Low |
| syReserve tracking | Floating SY detection | Low |
| Protocol fee on interest | Protocol revenue | Low |
| Interest formula alignment | Pendle parity | Low |
| Factory expiryDivisor | Standardized expiry dates | Low |
| Factory doCacheIndexSameBlock | Same-block optimization | Low |
| Factory VERSION constant | Contract versioning | Low |
| MarketFactory yieldContractFactory reference | Cross-factory queries | Low |
| MarketFactory VERSION constant | Contract versioning | Low |
| MarketFactory minInitialAnchor validation | Parameter bounds | Low |

### 8.4 Priority 3 - Future (Ecosystem)

| Gap | Impact | Effort |
|-----|--------|--------|
| veToken system | Governance | Very High |
| Gauge contracts | LP incentives | Very High |
| Voting controller | Emission allocation | Very High |
| Fee distribution | Protocol economics | High |
| MarketFactory vePendle integration | LP boost mechanics | Very High |
| MarketFactory gaugeController integration | Emission distribution | Very High |

---

## 9. Detailed Feature Comparison

### 9.1 Complete Feature Matrix

```
FEATURE                              PENDLE V2    HORIZON      GAP LEVEL
═══════════════════════════════════════════════════════════════════════════

CORE TOKENS
  SY exchange_rate()                    ✓            ✓         None
  SY deposit/redeem                     ✓            ✓         None
  SY dual oracle support                ✗            ✓         None (EXCEEDS)
  SY OracleRateUpdated event            ✗            ✓         None (EXCEEDS)
  SY built-in upgradeability            ✗            ✓         None (EXCEEDS)
  SY slippage protection                ✓            ✓         None ✅ IMPLEMENTED
  SY burnFromInternalBalance            ✓            ✓         None ✅ IMPLEMENTED
  SY reentrancy guard                   ✓            ✓         None ✅ IMPLEMENTED
  SY getTokensIn/Out()                  ✓            ✓         None ✅ IMPLEMENTED
  SY isValidTokenIn/Out()               ✓            ✓         None ✅ IMPLEMENTED
  SY assetInfo()                        ✓            ✓         None ✅ IMPLEMENTED
  SY previewDeposit/Redeem()            ✓            ✓         None ✅ IMPLEMENTED
  SY EIP-2612 Permit                    ✓            ✗         N/A (Starknet)
  SY native ETH support                 ✓            ✗         N/A (Starknet)
  SY getRewardTokens()                  ✓            ✓         None ✅ (SYWithRewards)
  SY claimRewards()                     ✓            ✓         None ✅ (SYWithRewards)
  SY SYBaseWithRewards                  ✓            ✓         None ✅ IMPLEMENTED
  SY pausable transfers                 ✓            ✓         None (EXCEEDS) ✅
  SY negative yield watermark           ✓            ✓         None ✅ IMPLEMENTED
  PT 1:1 redemption                     ✓            ✓         None
  PT only-YT-mints                      ✓            ✓         None
  PT emergency pause                    ✗            ✓         None (EXCEEDS)
  PT VERSION constant                   ✓            ✗         LOW
  PT reentrancy guard exposure          ✓            ✗         LOW
  YT interest tracking                  ✓            ✓         None
  YT post-expiry index freeze           ✓            ✓         None
  YT interest formula                   normalized   absolute  MEDIUM (design choice)
  YT UserInterest struct packing        ✓            ✗         LOW
  YT multi-reward                       ✓            ✗         HIGH
  YT syReserve tracking                 ✓            ✗         MEDIUM
  YT post-expiry treasury               ✓            ✗         MEDIUM
  YT protocol fee on interest           ✓            ✗         MEDIUM
  YT same-block index caching           ✓            ✗         LOW
  YT batch mint/redeem                  ✓            ✗         LOW
  YT claim interest on redeem           ✓            ✗         LOW
  YT flash mint                         ✓            ✗         MEDIUM

AMM/MARKET (MarketMathCore)
  Logit-based curve                     ✓            ✓         None
  Rate scalar time decay                ✓            ✓         None
  Rate anchor continuity                ✓            ✓         None
  MINIMUM_LIQUIDITY                     ✓            ✓         None
  MAX_MARKET_PROPORTION (96%)           ✓            ✓         None
  Binary search for swaps               ✓            ✓         None
  Dual math implementations             ✗            ✓         None (EXCEEDS)
  4 swap function variants              ✗            ✓         None (EXCEEDS)
  PYIndex integration                   ✓            ✗         HIGH
  Reserve fee splitting                 ✓            ✗         HIGH
  Fee collection                        Auto-compound Manual   HIGH
  Treasury address                      ✓            ✗         MEDIUM
  LP fee on add liquidity               ✓            ✗         MEDIUM
  Fee formula (exponential)             ✓            Linear    MEDIUM
  Signed integer arithmetic             ✓            u256      MEDIUM
  Rounding protection (rawDivUp)        ✓            ✗         LOW
  setInitialLnImpliedRate()             ✓            ✗         LOW
  TWAP oracle                           ✓            ✗         CRITICAL
  Observation buffer                    ✓            ✗         CRITICAL
  PT/LP price oracle                    ✓            ✗         CRITICAL

MARKET CONTRACT (PendleMarketV6)
  mint() add liquidity                  ✓            ✓         None
  burn() remove liquidity               ✓            ✓         None
  swap functions                        ✓            ✓         None
  Emergency pause                       ✗            ✓         None (EXCEEDS)
  Admin scalar adjustment               ✗            ✓         None (EXCEEDS)
  Rich event emissions                  Basic        Detailed  None (EXCEEDS)
  TWAP observation buffer (65k)         ✓            ✗         CRITICAL
  observe(secondsAgos[])                ✓            ✗         CRITICAL
  increaseObservationsCardinality       ✓            ✗         CRITICAL
  RewardManager/PendleGauge             ✓            ✗         HIGH
  redeemRewards(user)                   ✓            ✗         HIGH
  getRewardTokens()                     ✓            ✗         HIGH
  Flash swap callback                   ✓            ✗         MEDIUM
  skim() balance reconciliation         ✓            ✗         MEDIUM
  Separate burn receivers               ✓            Single    MEDIUM
  Storage packing                       ✓            u256      MEDIUM (gas)
  Fee config from factory               ✓            In-contract MEDIUM

ROUTER ARCHITECTURE
  Diamond/Proxy pattern                 ✓            Monolithic⚠️ Different
  11+ action contracts                  ✓            1 router  ⚠️ Simpler
  Emergency pause                       ✗            ✓         None (EXCEEDS)
  RBAC system                           ✗            ✓         None (EXCEEDS)
  ReentrancyGuard                       ✓            ✓         None
  Deadline enforcement                  ✓            ✓         None
  Slippage protection                   ✓            ✓         None

ROUTER CORE FUNCTIONS
  Mint PT+YT                            ✓            ✓         None
  Redeem PT+YT                          ✓            ✓         None
  Post-expiry redeem                    ✓            ✓         None
  PT/SY swaps (4 variants)              ✓            ✓         None
  YT swaps                              ✓            ✓         None
  Convenience wrappers                  ✗            ✓         None (EXCEEDS)
  YT flash mechanism                    Callback     Mint+Sell ⚠️ Different

SINGLE-SIDED LIQUIDITY
  addLiquiditySinglePt                  ✓            ✗         HIGH
  addLiquiditySingleSy                  ✓            ✗         HIGH
  addLiquiditySingleToken               ✓            ✗         HIGH
  addLiquiditySingleTokenKeepYt         ✓            ✗         MEDIUM
  removeLiquiditySinglePt               ✓            ✗         HIGH
  removeLiquiditySingleSy               ✓            ✗         HIGH
  removeLiquiditySingleToken            ✓            ✗         HIGH
  addLiquidityDualTokenAndPt            ✓            ✗         MEDIUM
  removeLiquidityDualTokenAndPt         ✓            ✗         MEDIUM

TOKEN AGGREGATION
  TokenInput struct                     ✓            ✗         HIGH
  TokenOutput struct                    ✓            ✗         HIGH
  swapExactTokenForPt                   ✓            ✗         HIGH
  swapExactPtForToken                   ✓            ✗         HIGH
  swapExactTokenForYt                   ✓            ✗         HIGH
  swapExactYtForToken                   ✓            ✗         HIGH
  swapTokensToTokens                    ✓            ✗         HIGH
  Aggregator integration (AVNU etc)     ✓            ✗         HIGH

ADVANCED ROUTER
  ApproxParams (caller hints)           ✓            Internal  MEDIUM
  LimitOrderData                        ✓            ✗         MEDIUM
  multicall batching                    ✓            ✗         MEDIUM
  boostMarkets                          ✓            ✗         MEDIUM
  redeemDueInterestAndRewards           ✓            ✗         MEDIUM
  RouterStatic previews                 ✓            ✗         MEDIUM
  Permit signatures                     ✓            ✗         MEDIUM
  Cross-chain operations                ✓            ✗         LOW

FACTORY (YieldContractFactory)
  Create PT/YT pair                     ✓            ✓         None
  Get PT/YT by (SY, expiry)             ✓            ✓         None
  Validate deployed tokens              ✓            ✓         None
  Upgradeable                           ✓            ✓         None
  Enriched events                       Basic        Rich      None (EXCEEDS)
  RBAC integration                      ✗            ✓         None (EXCEEDS)
  Class hash updates                    ✗            ✓         None (EXCEEDS)
  interestFeeRate                       ✓            ✗         HIGH
  rewardFeeRate                         ✓            ✗         HIGH
  treasury address                      ✓            ✗         HIGH
  setInterestFeeRate()                  ✓            ✗         HIGH
  setRewardFeeRate()                    ✓            ✗         HIGH
  setTreasury()                         ✓            ✗         HIGH
  expiryDivisor                         ✓            ✗         MEDIUM
  setExpiryDivisor()                    ✓            ✗         MEDIUM
  doCacheIndexSameBlock                 ✓            ✗         MEDIUM
  VERSION constant                      ✓            ✗         LOW

MARKET FACTORY (PendleMarketFactoryV6Upg)
  Create market from PT                  ✓            ✓         None
  Validate markets                       ✓            ✓         None
  Get all markets                        ✓            ✓         None
  Upgradeable                            ✓            ✓         None
  Parameter validation                   ✓            ✓         None
  Enriched events                        Basic        Rich      None (EXCEEDS)
  RBAC integration                       ✗            ✓         None (EXCEEDS)
  Market pagination                      ✗            ✓         None (EXCEEDS)
  Active markets filter                  ✗            ✓         None (EXCEEDS)
  Market by index                        ✗            ✓         None (EXCEEDS)
  Class hash updates                     ✗            ✓         None (EXCEEDS)
  treasury address                       ✓            ✗         HIGH
  reserveFeePercent                      ✓            ✗         HIGH
  setTreasuryAndFeeReserve()             ✓            ✗         HIGH
  getMarketConfig(market, router)        ✓            ✗         HIGH
  Router fee overrides                   ✓            ✗         HIGH
  setOverriddenFee()                     ✓            ✗         HIGH
  vePendle integration                   ✓            ✗         Future
  gaugeController integration            ✓            ✗         Future
  yieldContractFactory reference         ✓            ✗         MEDIUM
  VERSION constant                       ✓            ✗         LOW
  minInitialAnchor validation            ✓            ✗         LOW

ORACLE SYSTEM (Two Distinct Types)

YIELD INDEX ORACLE (SY Exchange Rate)
  ERC-4626 native                       ✓            ✓         None
  Custom oracle interface               ✓            ✓         None
  TWAP window                           ✓            ✓         None
  Staleness check                       ✓            ✓         None
  Monotonic watermark                   ✓            ✓         None
  Single-feed mode                      ✓            ✓         None
  Dual-feed ratio mode                  ✗            ✓         None (EXCEEDS)
  Emergency pause                       ✗            ✓         None (EXCEEDS)
  Emergency index override              ✗            ✓         None (EXCEEDS)
  RBAC for config changes               ✗            ✓         None (EXCEEDS)
  Rich events (IndexUpdated)            ✗            ✓         None (EXCEEDS)
  Pragma integration                    N/A          ✓         N/A (Starknet)
  Chainlink integration                 ✓            ✗         MEDIUM
  Oracle factory                        ✓            ✗         MEDIUM

MARKET TWAP ORACLE (PT/YT/LP Pricing)
  Observation buffer (65k slots)        ✓            ✗         CRITICAL
  lnImpliedRateCumulative               ✓            ✗         CRITICAL
  observe(secondsAgos[])                ✓            ✗         CRITICAL
  increaseObservationsCardinalityNext   ✓            ✗         CRITICAL
  getOracleState(market, duration)      ✓            ✗         CRITICAL
  getPtToSyRate(duration)               ✓            ✗         CRITICAL
  getPtToAssetRate(duration)            ✓            ✗         CRITICAL
  getYtToSyRate(duration)               ✓            ✗         CRITICAL
  getYtToAssetRate(duration)            ✓            ✗         CRITICAL
  getLpToSyRate(duration)               ✓            ✗         CRITICAL
  getLpToAssetRate(duration)            ✓            ✗         CRITICAL
  Pre-deployed oracle contract          ✓            ✗         HIGH
  Chainlink wrapper (latestRoundData)   ✓            ✗         HIGH
  Reentrancy guard check                ✓            ✗         MEDIUM
  SY/PY index adjustment                ✓            ✗         MEDIUM
  Oracle factory                        ✓            ✗         MEDIUM

GOVERNANCE
  veToken                               ✓            ✗         Future
  Gauge contracts                       ✓            ✗         Future
  Voting controller                     ✓            ✗         Future
  Gauge controller                      ✓            ✗         Future
  LP boost                              ✓            ✗         Future
  Fee distribution                      ✓            ✗         Future
  Multi-reward gauges                   ✓            ✗         Future
```

### 9.2 Parity Summary

| Category | Implementation | Gap Count | Critical Gaps | Notes |
|----------|---------------|-----------|---------------|-------|
| Core Tokens | 85% | 17 | 2 (multi-reward YT) | ✅ **SY: 95% complete** (2 gaps: EIP-2612 Permit N/A, native ETH N/A); YT: 12 gaps; PT: 2 gaps; Horizon exceeds in 7 areas |
| AMM/Market | 60% | 24 | 8 (PYIndex, reserve fees, TWAP×6) | MarketMath: 9 gaps; Market contract: 11 gaps (6 CRITICAL/HIGH, 5 MEDIUM); Horizon exceeds in 5 areas |
| Router | 55% | 29 | 14 (single-sided×7, token aggregation×8) | Core ops: 85%; Missing: single-sided liquidity, token aggregation, batch ops; Horizon exceeds in 3 areas (pause, RBAC, wrappers) |
| Factory | 70% | 10 | 6 (interestFeeRate, rewardFeeRate, treasury, setters) | Core deployment: 100%; Missing: protocol fee infrastructure; Horizon exceeds in 3 areas (enriched events, RBAC, class hash updates) |
| MarketFactory | 65% | 12 | 6 (treasury, reserveFeePercent, router overrides, getMarketConfig) | Core deployment: 100%; Missing: protocol fee infrastructure, router fee overrides; Horizon exceeds in 6 areas (pagination, active filter, events, RBAC) |
| Oracle | 35% | 18 | 8 CRITICAL (Market TWAP buffer, observe(), PT/YT/LP rate functions) | Yield Index Oracle: 75% with 5 areas Horizon EXCEEDS; Market TWAP Oracle: 0% - complete absence blocks lending integrations |
| Governance | 0% | 7 | All (by design) | |

---

## 10. Code Location Reference

### 10.1 Horizon Contract Files

| Contract | Location | Lines |
|----------|----------|-------|
| SY Token | `contracts/src/tokens/sy.cairo` | ~407 |
| SY Component | `contracts/src/components/sy_component.cairo` | ~577 |
| SYWithRewards | `contracts/src/tokens/sy_with_rewards.cairo` | ~300+ |
| RewardManager Component | `contracts/src/components/reward_manager_component.cairo` | ~400+ |
| ISY Interface | `contracts/src/interfaces/i_sy.cairo` | ~99 |
| ISYWithRewards Interface | `contracts/src/interfaces/i_sy_with_rewards.cairo` | ~140 |
| PT Token | `contracts/src/tokens/pt.cairo` | ~246 |
| YT Token | `contracts/src/tokens/yt.cairo` | ~722 |
| Market AMM | `contracts/src/market/amm.cairo` | ~900 |
| Market Math | `contracts/src/market/market_math.cairo` | ~752 |
| Market Math FP | `contracts/src/market/market_math_fp.cairo` | ~647 |
| Market Factory | `contracts/src/market/market_factory.cairo` | ~429 |
| Factory | `contracts/src/factory.cairo` | ~308 |
| Router | `contracts/src/router.cairo` | ~900 |
| Pragma Oracle | `contracts/src/oracles/pragma_index_oracle.cairo` | ~450 |

### 10.2 Key Code Locations for Gap Implementation

| Gap | Target File | Suggested Location |
|-----|-------------|-------------------|
| **Oracle Gaps (CRITICAL)** | | |
| Observation Buffer | `market/amm.cairo` | New storage: `observations: LegacyMap<u32, Observation>`, `observation_index`, `observation_cardinality` |
| lnImpliedRateCumulative | `market/amm.cairo` | Track cumulative ln(impliedRate) on each swap |
| observe(secondsAgos[]) | `market/amm.cairo` | New function returning historical cumulative rates |
| increaseObservationsCardinalityNext | `market/amm.cairo` | New function to expand observation buffer |
| getOracleState | `market/amm.cairo` | New view function checking oracle readiness |
| PT Rate Functions | New file | `oracles/pt_oracle_lib.cairo`: `get_pt_to_sy_rate()`, `get_pt_to_asset_rate()` |
| YT Rate Functions | New file | `oracles/yt_oracle_lib.cairo`: `get_yt_to_sy_rate()`, `get_yt_to_asset_rate()` |
| LP Rate Functions | New file | `oracles/lp_oracle_lib.cairo`: `get_lp_to_sy_rate()`, `get_lp_to_asset_rate()` |
| Pre-deployed Oracle | New file | `oracles/horizon_pt_lp_oracle.cairo`: centralized oracle contract |
| Pragma Wrapper | New file | `oracles/pragma_pt_oracle.cairo`: Pragma-compatible interface for PT prices |
| **Market Gaps** | | |
| RewardManager/PendleGauge | `market/amm.cairo` + new `rewards/` | Inherit reward tracking, add redeemRewards() |
| Flash swap callback | `market/amm.cairo` | Add `data: Span<felt252>` param + callback logic |
| skim() | `market/amm.cairo` | New admin function |
| Separate burn receivers | `market/amm.cairo` | Update burn() signature |
| **Token Gaps** | | |
| Multi-reward YT | `tokens/yt.cairo` | Extend storage + claim |
| Chainlink Adapter | New file | `oracles/chainlink_adapter.cairo` |
| **Router Gaps** | | |
| Single-sided liquidity | `router.cairo` | New `add_liquidity_single_pt()`, `add_liquidity_single_sy()`, `add_liquidity_single_token()` |
| Token aggregation | `router.cairo` + interfaces | New `TokenInput/TokenOutput` structs, aggregator callback |
| swapExactTokenForPt | `router.cairo` | New function + aggregator integration |
| ApproxParams | `router.cairo` | Expose binary search params to callers |
| multicall | `router.cairo` | New `multicall(calls: Span<Call>)` function |
| RouterStatic | New file | `router_static.cairo` for view functions |
| Permit signatures | `router.cairo` | Add permit param to swap functions |
| redeemDueInterestAndRewards | `router.cairo` | Combined redemption across contracts |
| **Factory Gaps** | | |
| Protocol fee infrastructure | `factory.cairo` | Add `interest_fee_rate`, `reward_fee_rate`, `treasury` storage |
| setInterestFeeRate | `factory.cairo` | New admin function with MAX_FEE_RATE validation |
| setRewardFeeRate | `factory.cairo` | New admin function with MAX_FEE_RATE validation |
| setTreasury | `factory.cairo` | New admin function |
| expiryDivisor | `factory.cairo` | Add `expiry_divisor` storage + validation in `create_yield_contracts()` |
| doCacheIndexSameBlock | `factory.cairo` + `yt.cairo` | Pass caching hint to YT constructor |
| **MarketFactory Gaps** | | |
| Protocol fee infrastructure | `market/market_factory.cairo` | Add `treasury`, `reserve_fee_percent` storage |
| setTreasuryAndFeeReserve | `market/market_factory.cairo` | New admin function with fee validation |
| Router fee overrides | `market/market_factory.cairo` | Add `overridden_fee: Map<(router, market), u80>` |
| setOverriddenFee | `market/market_factory.cairo` | New admin function with fee validation |
| getMarketConfig | `market/market_factory.cairo` | New view function returning treasury, fees |
| yieldContractFactory reference | `market/market_factory.cairo` | Add immutable factory address |
| **Governance Gaps** | | |
| Gauge System | New files | `gauge/` directory |

---

## Appendix A: Test Coverage for Existing Features

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `test_market.cairo` | ~50 | Core AMM operations |
| `test_market_fees.cairo` | 16 | Fee decay mechanics |
| `test_market_invariants.cairo` | 4 | Pool invariants |
| `test_market_large_trades.cairo` | 16 | Binary search edge cases |
| `test_market_first_depositor.cairo` | 10 | First depositor attack |
| `test_yt_interest.cairo` | 20 | Interest calculation |
| `test_router_yt_swaps.cairo` | 18 | Flash swap pattern |
| `test_sy.cairo` | 54 | SY wrapper (deposit, redeem, slippage, multi-token, pausable, watermark) |
| `test_sy_with_rewards.cairo` | 28 | SY reward distribution |
| `test_reward_manager.cairo` | ~20 | RewardManagerComponent |
| `test_pragma_index_oracle.cairo` | ~20 | Oracle adapter |
| `fuzz/fuzz_market_math.cairo` | 20 (256 runs each) | AMM math |

**Total: ~600+ passing tests** (82 SY-related tests alone)

---

## Appendix B: Implementation Roadmap Suggestion

### Phase 1: Critical (DeFi Composability - Oracle Focus)
**This is Horizon's principal weak point - must be prioritized**

1. **Market Observation Buffer** - Add storage for observation ring buffer (65k slots)
2. **lnImpliedRateCumulative** - Track cumulative ln(impliedRate) on each swap
3. **observe(secondsAgos[])** - Function to query historical cumulative rates
4. **increaseObservationsCardinalityNext()** - Buffer expansion for oracle initialization
5. **getOracleState(market, duration)** - Readiness check for integrations
6. **getPtToSyRate/getPtToAssetRate** - PT TWAP price functions (critical for PT collateral)
7. **getLpToSyRate/getLpToAssetRate** - LP TWAP price functions (critical for LP collateral)
8. **getYtToSyRate** - YT TWAP price functions
9. **Pre-deployed HorizonPtLpOracle** - External oracle contract for easy integration
10. **Pragma/Chainlink Wrapper** - Standard interface for oracle aggregators
11. RouterStatic for frontend quotes

### Phase 2: High Priority (User Experience)
1. **Single-sided liquidity operations** (addLiquiditySinglePt/Sy/Token)
2. **Token aggregation** (TokenInput/Output + AVNU/Fibrous integration)
3. **swapExactTokenForPt/Yt** functions
4. **Factory protocol fees** (interestFeeRate, rewardFeeRate, treasury)
5. **MarketFactory protocol fees** (treasury, reserveFeePercent, router fee overrides)
6. Fee auto-compounding into LP reserves
7. Multi-reward YT support

### Phase 3: Medium Priority (Feature Completeness)
1. ApproxParams (caller-provided binary search hints)
2. LimitOrderData integration
3. multicall batching
4. Permit signature support
5. redeemDueInterestAndRewards (combined redemption)
6. Single-sided liquidity remove functions
7. Factory expiryDivisor (standardized expiry dates)
8. MarketFactory yieldContractFactory reference (cross-factory queries)

### Phase 4: Future (Ecosystem)
1. veHorizon token design
2. Gauge contract implementation (RewardManager/PendleGauge equivalent)
3. Voting and emission controllers
4. Fee distribution mechanism
5. MarketFactory vePendle/gaugeController integration
6. Cross-chain messaging (if expanding beyond Starknet)

---

*Document generated from deep code analysis of Horizon Protocol codebase*
*Comparison baseline: Pendle V2 on Ethereum mainnet*
