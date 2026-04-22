# Horizon Protocol vs Pendle V2: Comprehensive Gap Analysis Report

> **Date:** 2025-12-31 (Updated)
> **Scope:** Deep code analysis of Horizon Protocol implementation against Pendle V2 specifications
> **Status:** Horizon Alpha on Starknet Mainnet
>
> **Change Log:**
> - 2025-01-07: ✅ **Section 2.3 Fee System corrected to 85%** - Code review revealed LP fee auto-compounding
>   was already working at `amm.cairo:560`. `collect_fees()` is analytics-only; LP fees stay in `sy_reserve` automatically.
>   Rate-impact fees deferred to Phase 2, governance split to Phase 4.
> - 2025-12-31: ✅ **Section 1.1 SY (Standardized Yield) Wrapper marked COMPLETE (95%)** - All major gaps implemented: slippage protection, burnFromInternalBalance, reentrancy guard, multi-token support (getTokensIn/Out, isValidToken), assetInfo, previewDeposit/Redeem, pausable transfers, negative yield watermark, SYWithRewards with RewardManagerComponent

---

## Executive Summary

Horizon Protocol implements **~65% of Pendle V2's core functionality**, focusing on yield tokenization primitives while omitting advanced governance and composability features. The protocol is production-ready for its stated alpha scope. **The SY (Standardized Yield) wrapper is now at 95% parity** with Pendle's SYBase, including full reward distribution via SYWithRewards.

### Key Findings

| Category | Parity Level | Critical Gaps |
|----------|--------------|---------------|
| **Core Tokenization (SY/PT/YT)** | 90% | ✅ SY: 95% complete (multi-token, rewards, slippage, assetInfo all implemented); Remaining: multi-reward YT + YT flash mint (minor: packing) |
| **AMM/Market** | ~85% | ✅ 0 CRITICAL (PYIndex, reserve fees, TWAP all implemented); 8 remaining gaps: RewardManager/PendleGauge, flash callbacks |
| **Router** | 55% | Single-sided liquidity (7 functions), token aggregation (8 functions), batch operations |
| **Factory** | 70% | Protocol fee infrastructure (interestFeeRate, rewardFeeRate), expiryDivisor |
| **MarketFactory** | 95% | ✅ Treasury/fee infrastructure implemented; governance integration (vePendle, gaugeController) |
| **Oracle System** | 95% | ✅ Market TWAP + PT/YT/LP oracles implemented; Remaining: Chainlink/Pragma wrapper (optional) |
| **Governance/Rewards** | 0% | Complete absence |

**Oracle/TWAP references (Pendle V2 code):** [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol), [PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol), [PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol), [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol), [PendleChainlinkOracleFactory.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleFactory.sol), [PendleChainlinkOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracle.sol), [PendleChainlinkOracleWithQuote.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleWithQuote.sol). Horizon: [contracts/src/market/amm.cairo](../contracts/src/market/amm.cairo), [contracts/src/oracles/pragma_index_oracle.cairo](../contracts/src/oracles/pragma_index_oracle.cairo).

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

**Reference (Pendle V2 code):** [SYBase.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/core/StandardizedYield/SYBase.sol), [IIndexOracle.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/interfaces/IIndexOracle.sol)

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

**Implementation Status: 90%** (Pendle-style interest math + reserve/treasury/fee plumbing implemented; remaining: multi-reward support, flash mint, minor packing)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| PY Index watermark | Monotonic | Monotonic | ✅ |
| Per-user interest tracking | ✅ | ✅ | ✅ |
| Transfer hooks | Update both parties | Update both parties | ✅ |
| Post-expiry index freeze | `postExpiry.firstPYIndex` | `py_index_at_expiry` | ✅ |
| Interest claim | `redeemDueInterest()` | `redeem_due_interest()` | ✅ |
| Interest formula | `bal × Δidx / (prev × curr)` | `bal × Δidx / (prev × curr)` | ✅ |
| UserInterest struct packing | `{uint128 idx, uint128 accrued}` | Two separate Maps | 🟢 LOW |
| Two-user distribution | `_distributeInterestForTwo()` | Separate calls | ✅ Equivalent |
| Multi-reward claiming | `redeemDueInterestAndRewards()` | ❌ Missing | 🔴 HIGH | **NOT PART OF THE REQUIREMENTS**
| Reward token registry | `getRewardTokens()` | ❌ Missing | 🔴 HIGH | **NOT PART OF THE REQUIREMENTS**
| syReserve tracking | `syReserve` + floating SY | `sy_reserve` + `get_floating_sy()` | ✅ |
| Post-expiry treasury | `totalSyInterestForTreasury` | `post_expiry_sy_for_treasury` + treasury redeem | ✅ |
| Protocol fee on interest | Factory-managed | Per-YT `interest_fee_rate` | ✅ (per-YT admin) |
| Same-block index caching | `doCacheIndexSameBlock` | Always-on cache | ✅ (no toggle) |
| Batch mint/redeem | `mintPYMulti()`, `redeemPYMulti()` | `mint_py_multi()`, `redeem_py_multi()` | ✅ |
| Claim interest on redeem | `redeemPY(redeemInterest=true)` | `redeem_py_with_interest()` | ✅ |
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

Horizon only tracks interest from SY appreciation (no reward registry/claim path in YT):
```cairo
// Horizon - interest only
fn redeem_due_interest(user: ContractAddress) -> u256
// Storage: single u256 per user
user_interest: Map<ContractAddress, u256>
```

**Impact:** Cannot support GLP-style tokens (rewards: ETH, esGMX), Pendle pools with PENDLE emissions, or any asset with native staking rewards beyond yield.

---

**Resolved - syReserve Tracking:**

Horizon now tracks expected SY balance via `sy_reserve` and exposes `get_floating_sy()` to detect
unexpected transfers. Mint/redeem paths update the reserve to match the actual SY balance,
mirroring Pendle's accounting model.

---

**Resolved - Post-Expiry Treasury:**

Horizon implements `post_expiry_sy_for_treasury` plus `redeem_post_expiry_interest_for_treasury()`,
and `redeem_py_post_expiry()` carves out post-expiry yield per redemption. Post-expiry interest is
redirected to treasury rather than being locked in the contract.

---

**Resolved - Interest Calculation Formula (matches Pendle):**

Horizon now uses the normalized formula from Pendle's `InterestManagerYT`:
```text
interest = balance × (currentIndex - prevIndex) / (prevIndex × currentIndex)
```
This preserves Pendle's invariant that total redeemable SY remains stable as the index grows.

---

### 1.3 PT (Principal Token)

**Implementation Status: 95%** (PT contract is minimal; differences are mostly init/immutables and metadata/versioning)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Only YT can mint/burn | ✅ `mintByYT/burnByYT` | ✅ `mint/burn` + `assert_only_yt()` | ✅ |
| YT set once after deploy | `initialize()` onlyYieldFactory | `initialize_yt()` only deployer (YT) | ⚠️ Different |
| SY/expiry recorded | Immutable `SY`, `expiry` | Stored on deploy (no setters) | ⚠️ Different |
| isExpired() | ✅ `isExpired()` | ✅ `is_expired()` | ✅ |
| Standard ERC20 | ✅ `PendleERC20` | ✅ `ERC20Component` | ✅ |
| Emergency pause | ❌ Not pausable | ✅ PAUSER_ROLE | ✅ **Horizon exceeds** |
| VERSION constant | `VERSION = 6` | ❌ None | 🟢 LOW |
| Reentrancy guard exposure | `reentrancyGuardEntered()` | ❌ None | 🟢 LOW |

**Note:** Pendle's PT contract is intentionally minimal; it does **not** implement redemption logic. Redemption at expiry is handled by YT/router flows, not PT itself. Horizon follows the same pattern.

**Horizon exceeds Pendle in emergency controls** - PT mint can be paused in emergencies via `PAUSER_ROLE`.

**Minor gaps:** VERSION constant and reentrancy guard exposure are useful for integrations and on-chain versioning but not critical for core functionality. The `factory` immutability difference (Pendle stores `factory` immutable; Horizon uses `deployer`/storage) is a trust-boundary nuance rather than a functional gap.

---

## 2. AMM/Market System Gaps

### 2.1 Core AMM Curve (MarketMathCore)

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

Pendle’s hard bounds and rounding behavior are now enforced in both FP and WAD paths.

Code-verified:
- `contracts/src/market/market_math_fp.cairo` + `contracts/src/market/market_math.cairo`:
  `MAX_PROPORTION` hard-asserted in `get_rate_anchor`, `get_exchange_rate`, and
  `get_ln_implied_rate`; exchange rate reverts if `< 1`.
- Signed anchor handling via `(rate_anchor, rate_anchor_is_negative)` aligns with Pendle’s signed
  arithmetic in logit/anchor composition.
- `asset_to_sy_up()` is used when net asset to account is negative (rounding against the trader).
- Exact-output paths assert infeasible trades via `MARKET_INFEASIBLE_TRADE`.

**Result:** Horizon now rejects out-of-bounds trades and matches Pendle’s rounding bias.

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

### 2.2 TWAP Oracle (Implemented)

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

### 2.3 Fee System

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

#### IMarketOracle Interface

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

## 3. Router & Flash Swap Gaps

### 3.1 Router Architecture

**Implementation Status: 55%** (Core operations work; missing advanced features)

**Reference:** Pendle's Router contracts from [pendle-core-v2-public](https://github.com/pendle-finance/pendle-core-v2-public/tree/main/contracts/router)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Architecture | Selector-based proxy (PendleRouterV4) + action facets | Monolithic contract | ⚠️ Different |
| Contract count | Proxy + ActionStorageV4 + ~7 action modules + helpers | 1 router.cairo | ⚠️ Simpler |
| Upgradeability | Selector → facet mapping (ActionStorageV4) | Single class upgrade | ⚠️ Less modular |
| ReentrancyGuard | ❌ None in router actions | ReentrancyGuardComponent | ✅ **Horizon exceeds** |
| Emergency pause | ❌ No pause | ✅ PAUSER_ROLE | ✅ **Horizon exceeds** |
| RBAC system | Ownable (selector admin only) | ✅ AccessControlComponent | ✅ **Horizon exceeds** |
| Deadline enforcement | ❌ No explicit deadline params | ✅ | ✅ **Horizon exceeds** |
| Slippage protection | ✅ min_out params | ✅ min_out params | ✅ |

**Pendle Router Contracts:**
- `PendleRouterV4.sol` - Proxy that dispatches by selector → facet mapping
- `RouterStorage.sol` - Core storage (owner + selectorToFacet)
- `ActionStorageV4.sol` - Owner admin to set selectors for facets
- `ActionSimple.sol` - Simplified swap/liquidity (no limit orders)
- `ActionSwapPTV3.sol` - PT swaps with ApproxParams + LimitOrderData
- `ActionSwapYTV3.sol` - YT swaps with flash mechanics
- `ActionAddRemoveLiqV3.sol` - Single-sided + multi-sided liquidity ops
- `ActionCallbackV3.sol` - Swap/limit-order callback handling
- `ActionMiscV3.sol` - multicall, reward redemption, misc utilities
- `ActionCrossChain.sol` - Cross-chain messaging
- `Reflector.sol` - helper for tokenized input scaling/dust sweep
- `router/base/*` + `router/swap-aggregator/*` - shared helpers and aggregator interfaces

---

### 3.2 Core Router Functions

**Implementation Status: 85%** (All basic operations implemented)

| Function | Pendle V2 | Horizon | Status |
|----------|-----------|---------|--------|
| `mintPyFromSy` | ✅ | `mint_py_from_sy` | ✅ |
| `redeemPyToSy` | ✅ | `redeem_py_to_sy` | ✅ |
| PT-only redeem post-expiry | ❌ Not in router (uses `redeemPyToSy` w/ PT+YT; `exitPostExpToSy` handles PT+LP) | `redeem_pt_post_expiry` | 🟡 Horizon-only |
| `addLiquidityDualSyAndPt` | ✅ | `add_liquidity` | ✅ |
| `removeLiquidityDualSyAndPt` | ✅ | `remove_liquidity` | ✅ |
| `swapExactPtForSy` | ✅ | `swap_exact_pt_for_sy` | ✅ |
| `swapExactSyForPt` | ✅ (ApproxParams + LimitOrderData) | `swap_exact_sy_for_pt` | ✅ |
| `swapSyForExactPt` | ❌ Not exposed (router uses exact-in + ApproxParams) | `swap_sy_for_exact_pt` | 🟡 Horizon-only |
| `swapPtForExactSy` | ❌ Not exposed (router uses exact-in) | `swap_pt_for_exact_sy` | 🟡 Horizon-only |
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

**Reference (Pendle V2 code):** [SYBase.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/core/StandardizedYield/SYBase.sol), [IIndexOracle.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/interfaces/IIndexOracle.sol), [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol), [PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol), [PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol), [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol)

| Oracle Type | Purpose | Pendle V2 | Horizon | Status |
|-------------|---------|-----------|---------|--------|
| **Yield Index Oracle** | SY exchange rate (asset → shares) | `SYBase` + `IIndexOracle` ([SYBase.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/core/StandardizedYield/SYBase.sol), [IIndexOracle.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/interfaces/IIndexOracle.sol)) | `PragmaIndexOracle` ([contracts/src/oracles/pragma_index_oracle.cairo](../contracts/src/oracles/pragma_index_oracle.cairo)) | ✅ 75% |
| **Market TWAP Oracle** | PT/YT/LP token pricing | Market + oracle libs ([PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol), [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol), [PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol), [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol)) | ✅ `oracle_lib.cairo` + `py_lp_oracle.cairo` ([contracts/src/libraries/oracle_lib.cairo](../contracts/src/libraries/oracle_lib.cairo), [contracts/src/oracles/py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo)) | ✅ ~95% |

**Key Insight:** These are complementary systems, not alternatives. Pendle has BOTH and Horizon now has BOTH.

---

### 6.2 Yield Index Oracle (Horizon: 75% Implemented)

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

### 6.3 Market TWAP Oracle (Horizon: ~95% Implemented)

**What it does:** Provides manipulation-resistant TWAP prices for PT, YT, and LP tokens themselves.

**Horizon Implementation:** The TWAP oracle system is now fully implemented across three key files:

| File | Purpose | Size |
|------|---------|------|
| [`libraries/oracle_lib.cairo`](../contracts/src/libraries/oracle_lib.cairo) | Core TWAP library with ring buffer, binary search | ~670 lines |
| [`market/amm.cairo`](../contracts/src/market/amm.cairo) (IMarketOracle) | Oracle storage and interface | ~110 lines |
| [`oracles/py_lp_oracle.cairo`](../contracts/src/oracles/py_lp_oracle.cairo) | PT/YT/LP price helpers | ~320 lines |

---

#### 6.3.1 oracle_lib.cairo - TWAP Library

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

**Tests:** Comprehensive coverage in [`contracts/tests/market/test_market_oracle.cairo`](../contracts/tests/market/test_market_oracle.cairo) (~860 lines)

---

#### 6.3.2 py_lp_oracle.cairo - PT/YT/LP Oracle Helper

Pre-deployed oracle contract providing Pendle-style TWAP queries for token pricing.
Stateless contract that queries Market's observation buffer.

**Reference (Pendle V2):** [PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol), [PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol), [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol)

**Horizon Implementation:** [`contracts/src/oracles/py_lp_oracle.cairo`](../contracts/src/oracles/py_lp_oracle.cairo) (~320 lines)

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
1. Calculates required cardinality: `(duration / MIN_BLOCK_TIME) + 1`
2. Checks if `observation_cardinality_next >= cardinality_required`
3. Verifies oldest observation is at least `duration` seconds old

**Tests:** Comprehensive coverage in [`contracts/tests/oracles/test_py_lp_oracle.cairo`](../contracts/tests/oracles/test_py_lp_oracle.cairo) (~842 lines)

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
| `observe(uint32[] secondsAgos)` | Market TWAP via `observations.observe` | `IMarketOracle::observe()` at `amm.cairo:1003-1062` | ✅ Implemented |
| `increaseObservationsCardinalityNext(uint16)` | Buffer expansion via `observations.grow` | `IMarketOracle::increase_observations_cardinality_next()` at `amm.cairo:1066-1083` | ✅ Implemented |
| `getOracleState(market, duration)` | Readiness check in PendlePYLpOracle | `PyLpOracle::get_oracle_state()` at `py_lp_oracle.cairo:262-290` | ✅ Implemented |
| `getPtToSyRate(duration)` | PendlePYOracleLib.getPtToSyRate | `PyLpOracle::get_pt_to_sy_rate()` at `py_lp_oracle.cairo:47-75` | ✅ Implemented |
| `getPtToAssetRate(duration)` | PendlePYOracleLib.getPtToAssetRate | `PyLpOracle::get_pt_to_asset_rate()` at `py_lp_oracle.cairo:142-175` | ✅ Implemented |
| `getYtToSyRate(duration)` | PendlePYOracleLib.getYtToSyRate | `PyLpOracle::get_yt_to_sy_rate()` at `py_lp_oracle.cairo:77-100` | ✅ Implemented |
| `getYtToAssetRate(duration)` | PendlePYOracleLib.getYtToAssetRate | `PyLpOracle::get_yt_to_asset_rate()` at `py_lp_oracle.cairo:177-210` | ✅ Implemented |
| `getLpToSyRate(duration)` | PendleLpOracleLib.getLpToSyRate | `PyLpOracle::get_lp_to_sy_rate()` at `py_lp_oracle.cairo:102-140` | ✅ Implemented |
| `getLpToAssetRate(duration)` | PendleLpOracleLib.getLpToAssetRate | `PyLpOracle::get_lp_to_asset_rate()` at `py_lp_oracle.cairo:212-260` | ✅ Implemented |
| Pre-deployed oracle contract | `PendlePYLpOracle` | `PyLpOracle` contract at `py_lp_oracle.cairo` | ✅ Implemented |
| MAX_CARDINALITY | 65,535 | 8,760 (1 year of hourly observations) at `amm.cairo:38` | ✅ Implemented |
| Test coverage | Various test files | 860 lines in `tests/market/test_market_oracle.cairo` | ✅ Implemented |
| Chainlink wrapper | `PendleChainlinkOracle` / `PendleChainlinkOracleWithQuote` | ❌ None | 🟡 Optional |
| `latestRoundData()` compatibility | Chainlink-style interface | ❌ None | 🟡 Optional |
| Reentrancy guard check | `_checkMarketReentrancy` in PendleLpOracleLib | ❌ None (Cairo's execution model provides inherent protection) | 🟢 N/A |

**Horizon now has full Market TWAP Oracle functionality**, enabling PT/YT/LP tokens to be used as collateral in lending protocols and other DeFi integrations.

---

**Gap Detail - Pendle's TWAP Oracle Architecture:**

Pendle's Market TWAP is built into the market itself via [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol) using [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol). It stores a ring buffer of cumulative ln(implied rate) and updates it on every state write.

```solidity
// Pendle - Market stores observations (MarketStorage + OracleLib)
struct MarketStorage {
    int128 totalPt;
    int128 totalSy;
    uint96 lastLnImpliedRate;
    uint16 observationIndex;
    uint16 observationCardinality;
    uint16 observationCardinalityNext;
}

struct Observation {
    uint32 blockTimestamp;
    uint216 lnImpliedRateCumulative;
    bool initialized;
}

OracleLib.Observation[65_535] public observations;
```

**TWAP Calculation Flow:**

```
1. getMarketLnImpliedRate: observe([duration, 0]) and compute
   lnImpliedRate = (cumulative_now - cumulative_then) / duration
2. assetToPtRate = MarketMathCore._getExchangeRateFromImpliedRate(lnImpliedRate, timeToExpiry)
3. ptToAssetRate = 1 / assetToPtRate
4. ytToAssetRate = 1 - ptToAssetRate
5. pt/yt to SY rates adjust by syIndex vs pyIndex (solvency handling)
```

Reference flow lives in [PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol) and [MarketMathCore.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/MarketMathCore.sol).

---

**Gap Detail - Oracle Initialization Requirements:**

Pendle’s pre-deployed oracle checks TWAP readiness with `getOracleState` in [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol). Cardinality required is computed from the on-chain formula:

```
cardinalityRequired =
  (duration * BLOCK_CYCLE_DENOMINATOR + blockCycleNumerator - 1) / blockCycleNumerator + 1
```

```solidity
// Pendle - initialize oracle before use
IPMarket(market).increaseObservationsCardinalityNext(cardinalityRequired);
// Then wait `duration` seconds for data accumulation
```

---

**Gap Detail - PT as Collateral Requirements:**

From Pendle documentation (not on-chain code), using PT as lending collateral requires:

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

LP pricing requires additional calculations beyond PT (see [PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol)):

```solidity
if (state.expiry <= block.timestamp) {
    totalHypotheticalAsset = state.totalPt + PYIndexLib.syToAsset(pyIndex, state.totalSy);
} else {
    MarketPreCompute memory comp = state.getMarketPreCompute(pyIndex, block.timestamp);
    (int256 rateOracle, int256 rateHypTrade) = _getPtRatesRaw(market, state, duration);
    // ... trade-size simulation using rateOracle and rateHypTrade ...
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

| Oracle Component | Pendle V2 (reference) | Horizon (contracts/src) | Implementation Priority |
|-----------------|-----------|---------|------------------------|
| Yield Index Oracle | `SYBase` + `IIndexOracle` ([SYBase.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/core/StandardizedYield/SYBase.sol), [IIndexOracle.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/interfaces/IIndexOracle.sol)) | ✅ `PragmaIndexOracle` ([contracts/src/oracles/pragma_index_oracle.cairo](../contracts/src/oracles/pragma_index_oracle.cairo)) | Done |
| Market Observation Buffer | `OracleLib.Observation[65_535]` ([OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol)) | ✅ `oracle_lib::Observation` + `Map<u16, Observation>` in [amm.cairo](../contracts/src/market/amm.cairo) | Done |
| PT TWAP Functions | `PendlePYOracleLib.getPtToSyRate/getPtToAssetRate` ([PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol)) | ✅ `get_pt_to_sy_rate()`, `get_pt_to_asset_rate()` in [py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo) | Done |
| YT TWAP Functions | `PendlePYOracleLib.getYtToSyRate/getYtToAssetRate` ([PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol)) | ✅ `get_yt_to_sy_rate()`, `get_yt_to_asset_rate()` in [py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo) | Done |
| LP TWAP Functions | `PendleLpOracleLib.getLpToSyRate/getLpToAssetRate` ([PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol)) | ✅ `get_lp_to_sy_rate()`, `get_lp_to_asset_rate()` in [py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo) | Done |
| Oracle State Check | `getOracleState` in [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol) | ✅ `get_oracle_state()`, `check_oracle_state()` in [py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo) | Done |
| Pre-deployed Oracle | [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol) | ✅ `PyLpOracle` contract in [py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo) | Done |
| getLnImpliedRateTwap | `getOracleState` return in [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol) | ✅ `get_ln_implied_rate_twap()` in [py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo) | Done |
| Chainlink/Pragma Wrapper | [PendleChainlinkOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracle.sol) / [PendleChainlinkOracleWithQuote.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleWithQuote.sol) | ❌ None | 🟡 Optional |
| Oracle Factory | [PendleChainlinkOracleFactory.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleFactory.sol) | ❌ None | 🟡 Optional |

**Implementation:** [`contracts/src/oracles/py_lp_oracle.cairo`](../contracts/src/oracles/py_lp_oracle.cairo)
**Tests:** [`contracts/tests/oracles/test_py_lp_oracle.cairo`](../contracts/tests/oracles/test_py_lp_oracle.cairo) (842 lines)

**Total Oracle Gaps: 2** (0 CRITICAL, 0 HIGH, 2 OPTIONAL)

**Oracle Capabilities:**
- ✅ PT can be used as collateral in lending protocols
- ✅ LP can be used as collateral in lending protocols
- ✅ Manipulation-resistant TWAP price feeds for external integrations
- ✅ Ready for Aave, Compound, and fork integrations
- ✅ Can build derivatives or structured products on Horizon tokens

---

### 6.6 Using the Market TWAP Oracle

This section documents the workflow for using the Market TWAP oracle for integrations.

#### Initialization (happens at market creation)

When a market is created, the TWAP oracle is automatically initialized:

```cairo
let result = oracle_lib::initialize(timestamp);
self.observations.write(0_u16, result.observation);
self.observation_index.write(0_u16);
self.observation_cardinality.write(result.cardinality);
self.observation_cardinality_next.write(result.cardinality_next);
```

This sets up the ring buffer with an initial observation and cardinality of 1.

#### Expanding Cardinality (optional, for longer TWAP windows)

The default cardinality is 1, which only supports very short TWAP windows. To enable longer TWAP durations (e.g., 30 minutes, 1 hour), expand the observation buffer:

```cairo
let oracle = IMarketOracleDispatcher { contract_address: market };
oracle.increase_observations_cardinality_next(desired_cardinality);
```

**Note:** Cardinality expansion takes effect after the next trade/liquidity operation that writes a new observation.

#### Querying TWAP

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

#### Checking Oracle Readiness

Before querying TWAP, verify the oracle has sufficient historical data:

```cairo
let state = py_lp_oracle.check_oracle_state(market, duration);
assert(state == OracleReadinessState::Ready, 'Oracle not ready');
```

**Oracle States:**
- `Ready`: Sufficient observations exist for the requested duration
- `NotReady`: More time/observations needed before TWAP is reliable
- `NotInitialized`: Market oracle not yet initialized

#### Integration Example (Lending Protocol)

```cairo
// In a lending protocol's price oracle
fn get_pt_collateral_value(market: ContractAddress, pt_amount: u256) -> u256 {
    let oracle = IPyLpOracleDispatcher { contract_address: self.py_lp_oracle.read() };

    // Check oracle is ready for 30-minute TWAP
    let state = oracle.check_oracle_state(market, 1800);
    assert(state == OracleReadinessState::Ready, 'Oracle not ready');

    // Get manipulation-resistant PT price
    let pt_to_asset_rate = oracle.get_pt_to_asset_rate(market, 1800);

    // Calculate collateral value
    math::wmul(pt_amount, pt_to_asset_rate)
}
```

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

> **✅ TWAP Oracle System - IMPLEMENTED**
>
> The following items have been fully implemented and are no longer blockers:
> - Market Observation Buffer (ring buffer in `oracle_lib.cairo`)
> - lnImpliedRateCumulative tracking
> - observe(secondsAgos[]) for historical queries
> - increaseObservationsCardinalityNext() for buffer expansion
> - getOracleState(market, duration) readiness check
> - getPtToSyRate/getPtToAssetRate for PT TWAP prices
> - getLpToSyRate/getLpToAssetRate for LP TWAP prices
> - getYtToSyRate/getYtToAssetRate for YT TWAP prices
> - Pre-deployed Oracle Contract (PendlePtLpOracle)
> - Pragma integration via PragmaIndexOracle
>
> See: `contracts/src/oracles/oracle_lib.cairo`, `contracts/src/oracles/pendle_pt_lp_oracle.cairo`

| Gap | Impact | Effort | Blocking |
|-----|--------|--------|----------|
| **Multi-Reward YT** | Reward distribution for multi-reward assets | High | Reward token integrations |
| **Single-sided liquidity Router** | One-click LP from PT or SY only | Medium | Convenience for LPs |
| **Token aggregation** | Trade from any token via DEX | High | DEX aggregator integration |

### 8.2 Priority 1 - High (User Experience)

> **✅ Reserve Fee & Treasury System - IMPLEMENTED**
>
> The following items have been implemented:
> - MarketFactory treasury address and reserve_fee_percent
> - set_treasury() and set_default_reserve_fee_percent() admin functions
> - Router fee overrides (overridden_fee, set_override_fee(), get_market_config())
>
> See: `contracts/src/market/market_factory.cairo`

| Gap | Impact | Effort | Affected Users |
|-----|--------|--------|----------------|
| **Aggregator Integration (AVNU, etc)** | Volume, discovery | High | All users |
| **addLiquiditySingleToken** | LP from any token | High | New users |
| **swapExactTokenForPt/Yt** | Buy PT/YT from any token | High | All traders |
| **PYIndex Integration** | AMM prices underlying, not raw SY | High | All traders, LPs |
| **RewardManager/PendleGauge** | LP incentive programs, yield farming | High | All LPs |
| **Factory Protocol Fees** | interestFeeRate, rewardFeeRate (factory-level) | Medium | Protocol treasury |
| **SY Multi-Token Support** | Curve LP, Yearn vaults | Medium | Yield seekers |
| **SY assetInfo()** | Risk assessment, integrations | Low | Integrators |
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
| Factory expiryDivisor | Standardized expiry dates | Low |
| Factory cache toggle | Optional parity vs Pendle | Low |
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

**Oracle/TWAP references for this matrix:** [SYBase.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/core/StandardizedYield/SYBase.sol), [IIndexOracle.sol](https://github.com/pendle-finance/Pendle-SY-Public/blob/main/contracts/interfaces/IIndexOracle.sol), [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol), [PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol), [PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol), [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol), [PendleChainlinkOracleFactory.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleFactory.sol), [PendleChainlinkOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracle.sol), [PendleChainlinkOracleWithQuote.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleWithQuote.sol). Horizon: [contracts/src/market/amm.cairo](../contracts/src/market/amm.cairo), [contracts/src/oracles/pragma_index_oracle.cairo](../contracts/src/oracles/pragma_index_oracle.cairo).

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
  YT interest formula                   normalized   normalized  None
  YT UserInterest struct packing        ✓            ✗         LOW
  YT multi-reward                       ✓            ✗         HIGH
  YT syReserve tracking                 ✓            ✓         None
  YT post-expiry treasury               ✓            ✓         None
  YT protocol fee on interest           ✓            ✓         None
  YT same-block index caching           ✓            ✓         None
  YT batch mint/redeem                  ✓            ✓         None
  YT claim interest on redeem           ✓            ✓         None
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
  PYIndex integration                   ✓            ✓         None
  Reserve fee splitting                 ✓            ✓         None
  Fee collection                        Auto-compound Manual   HIGH
  Treasury address                      ✓            ✓         None
  LP fee on add liquidity               ✓            ✗         MEDIUM
  Fee formula (exponential)             ✓            ✓         None
  Signed integer arithmetic             ✓            ✓         None
  Rounding protection (rawDivUp)        ✓            ✓         None
  setInitialLnImpliedRate()             ✓            ✓         None
  TWAP oracle                           ✓            ✓         None
  Observation buffer                    ✓            ✓         None
  PT/LP price oracle                    ✓            ✓         None

MARKET CONTRACT (PendleMarketV6)
  mint() add liquidity                  ✓            ✓         None
  burn() remove liquidity               ✓            ✓         None
  swap functions                        ✓            ✓         None
  Emergency pause                       ✗            ✓         None (EXCEEDS)
  Admin scalar adjustment               ✗            ✓         None (EXCEEDS)
  Rich event emissions                  Basic        Detailed  None (EXCEEDS)
  TWAP observation buffer (65k)         ✓            ✓         None
  observe(secondsAgos[])                ✓            ✓         None
  increaseObservationsCardinality       ✓            ✓         None
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
  treasury address                      ✓            ✓         None
  setInterestFeeRate()                  ✓            ✗         HIGH
  setRewardFeeRate()                    ✓            ✗         HIGH
  setTreasury()                         ✓            ✓         None
  expiryDivisor                         ✓            ✗         MEDIUM
  setExpiryDivisor()                    ✓            ✗         MEDIUM
  doCacheIndexSameBlock                 ✓            ✓         LOW (always-on)
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
  treasury address                       ✓            ✓         None (line 95)
  default_reserve_fee_percent            ✓            ✓         None (line 97)
  set_treasury()                         ✓            ✓         None (line 507)
  set_default_reserve_fee_percent()      ✓            ✓         None (line 517)
  get_market_config(market, router)      ✓            ✓         None (lines 484-493)
  Router fee overrides                   ✓            ✓         None (line 100)
  set_override_fee()                     ✓            ✓         None (lines 531-556)
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

MARKET TWAP ORACLE (PT/YT/LP Pricing) - ~95% Implemented
  Observation buffer (8.7k slots)       ✓            ✓         None (oracle_lib.cairo)
  lnImpliedRateCumulative               ✓            ✓         None (oracle_lib.cairo)
  observe(secondsAgos[])                ✓            ✓         None (amm.cairo:1003-1062)
  increaseObservationsCardinalityNext   ✓            ✓         None (amm.cairo:1066-1083)
  getOracleState(market, duration)      ✓            ✓         None (py_lp_oracle.cairo:262-290)
  getPtToSyRate(duration)               ✓            ✓         None (py_lp_oracle.cairo:47-75)
  getPtToAssetRate(duration)            ✓            ✓         None (py_lp_oracle.cairo:142-175)
  getYtToSyRate(duration)               ✓            ✓         None (py_lp_oracle.cairo:77-100)
  getYtToAssetRate(duration)            ✓            ✓         None (py_lp_oracle.cairo:177-210)
  getLpToSyRate(duration)               ✓            ✓         None (py_lp_oracle.cairo:102-140)
  getLpToAssetRate(duration)            ✓            ✓         None (py_lp_oracle.cairo:212-260)
  Pre-deployed oracle contract          ✓            ✓         None (PyLpOracle)
  getLnImpliedRateTwap                  ✓            ✓         None (py_lp_oracle.cairo)
  checkOracleState                      ✓            ✓         None (py_lp_oracle.cairo)
  Chainlink wrapper (latestRoundData)   ✓            ✗         OPTIONAL
  Reentrancy guard check                ✓            N/A       N/A (Cairo inherent)
  SY/PY index adjustment                ✓            ✓         None (py_lp_oracle.cairo)
  Oracle factory                        ✓            ✗         OPTIONAL

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
| Core Tokens | 90% | 8 | 2 (multi-reward YT) | ✅ **SY: 95% complete** (2 gaps: EIP-2612 Permit N/A, native ETH N/A); YT: 4 gaps (multi-reward, reward registry, flash mint, packing); PT: 2 gaps; Horizon exceeds in 7 areas |
| AMM/Market | 85% | 6 | 0 | ✅ **Core math: 100%** (PYIndex, reserve fees, TWAP oracle, **fee auto-compounding all implemented**); Remaining: RewardManager/PendleGauge, flash callbacks, rate-impact fees (Phase 2); Horizon exceeds in 5 areas |
| Router | 55% | 29 | 14 (single-sided×7, token aggregation×8) | Core ops: 85%; Missing: single-sided liquidity, token aggregation, batch ops; Horizon exceeds in 3 areas (pause, RBAC, wrappers) |
| Factory | 70% | 8 | 4 (interestFeeRate, rewardFeeRate, setters) | Core deployment: 100%; Missing: factory-level fee schedule; Horizon exceeds in 3 areas (enriched events, RBAC, class hash updates) |
| MarketFactory | 95% | 5 | 0 | ✅ **Treasury/fee infrastructure: 100%** (treasury, reserve_fee_percent, router overrides, get_market_config); Remaining: governance integration (vePendle, gaugeController); Horizon exceeds in 6 areas (pagination, active filter, events, RBAC) |
| Oracle | 95% | 2 | 0 | ✅ **Yield Index Oracle: 75%** with 5 areas Horizon EXCEEDS; ✅ **Market TWAP Oracle: 95%** - full PT/YT/LP price functions in `py_lp_oracle.cairo`; 2 optional gaps (Chainlink wrapper, Oracle factory) |
| Governance | 0% | 7 | All (by design) | |

**Oracle/TWAP references (Pendle V2 code):** [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol), [PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol), [PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol), [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol). Horizon: [contracts/src/market/amm.cairo](../contracts/src/market/amm.cairo), [contracts/src/libraries/oracle_lib.cairo](../contracts/src/libraries/oracle_lib.cairo), [contracts/src/oracles/py_lp_oracle.cairo](../contracts/src/oracles/py_lp_oracle.cairo), [contracts/src/oracles/pragma_index_oracle.cairo](../contracts/src/oracles/pragma_index_oracle.cairo).

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
| Market AMM | `contracts/src/market/amm.cairo` | ~1400 |
| Market Math | `contracts/src/market/market_math.cairo` | ~752 |
| Market Math FP | `contracts/src/market/market_math_fp.cairo` | ~647 |
| Market Factory | `contracts/src/market/market_factory.cairo` | ~429 |
| Factory | `contracts/src/factory.cairo` | ~308 |
| Router | `contracts/src/router.cairo` | ~900 |
| Oracle Library | `contracts/src/libraries/oracle_lib.cairo` | ~672 |
| PT/YT/LP Oracle | `contracts/src/oracles/py_lp_oracle.cairo` | ~319 |
| Pragma Index Oracle | `contracts/src/oracles/pragma_index_oracle.cairo` | ~448 |

### 10.2 Key Code Locations for Gap Implementation

**Reference (Pendle V2 code):** [OracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/OracleLib.sol), [PendleMarketV6.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol), [PendlePYOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYOracleLib.sol), [PendleLpOracleLib.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendleLpOracleLib.sol), [PendlePYLpOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/PendlePYLpOracle.sol), [PendleChainlinkOracleFactory.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleFactory.sol), [PendleChainlinkOracle.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracle.sol), [PendleChainlinkOracleWithQuote.sol](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleWithQuote.sol)

| Gap | Target File | Suggested Location |
|-----|-------------|-------------------|
| **Oracle Gaps (✅ IMPLEMENTED)** | | |
| Observation Buffer | ✅ `libraries/oracle_lib.cairo` | `Observation` struct + `Map<u16, Observation>` ring buffer (~670 lines) |
| lnImpliedRateCumulative | ✅ `libraries/oracle_lib.cairo` | `Observation.ln_implied_rate_cumulative` updated on each swap |
| observe(secondsAgos[]) | ✅ `market/amm.cairo:1003-1062` | `IMarketOracle::observe()` returns historical cumulative rates |
| increaseObservationsCardinalityNext | ✅ `market/amm.cairo:1066-1083` | `IMarketOracle::increase_observations_cardinality_next()` |
| getOracleState | ✅ `oracles/py_lp_oracle.cairo:262-290` | `PyLpOracle::get_oracle_state()` checks readiness |
| PT Rate Functions | ✅ `oracles/py_lp_oracle.cairo:47-175` | `get_pt_to_sy_rate()`, `get_pt_to_asset_rate()` |
| YT Rate Functions | ✅ `oracles/py_lp_oracle.cairo:77-210` | `get_yt_to_sy_rate()`, `get_yt_to_asset_rate()` |
| LP Rate Functions | ✅ `oracles/py_lp_oracle.cairo:102-260` | `get_lp_to_sy_rate()`, `get_lp_to_asset_rate()` |
| Pre-deployed Oracle | ✅ `oracles/py_lp_oracle.cairo` | `PyLpOracle` contract (~320 lines) |
| getLnImpliedRateTwap | ✅ `oracles/py_lp_oracle.cairo` | `get_ln_implied_rate_twap()` |
| checkOracleState | ✅ `oracles/py_lp_oracle.cairo` | `check_oracle_state()` |
| Pragma Wrapper | ❌ Optional | `oracles/pragma_pt_oracle.cairo`: Pragma-compatible interface for PT prices |
| Oracle Factory | ❌ Optional | `oracles/oracle_factory.cairo`: Factory for deploying oracle instances |
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
| Protocol fee infrastructure | `factory.cairo` | Add `interest_fee_rate`, `reward_fee_rate` storage (treasury already present) |
| setInterestFeeRate | `factory.cairo` | New admin function with MAX_FEE_RATE validation |
| setRewardFeeRate | `factory.cairo` | New admin function with MAX_FEE_RATE validation |
| setTreasury | `factory.cairo` | New admin function |
| expiryDivisor | `factory.cairo` | Add `expiry_divisor` storage + validation in `create_yield_contracts()` |
| doCacheIndexSameBlock | `factory.cairo` + `yt.cairo` | Optional parity: add factory flag to disable cache (currently always-on) |
| **MarketFactory Gaps** | | |
| Protocol fee infrastructure | `market/market_factory.cairo` | ✅ **Implemented**: `treasury`, `default_reserve_fee_percent` storage |
| setTreasuryAndFeeReserve | `market/market_factory.cairo` | ✅ **Implemented**: `set_treasury()`, `set_default_reserve_fee_percent()` |
| Router fee overrides | `market/market_factory.cairo` | ✅ **Implemented**: `overridden_fee` mapping |
| setOverriddenFee | `market/market_factory.cairo` | ✅ **Implemented**: `set_override_fee()` with validation |
| getMarketConfig | `market/market_factory.cairo` | ✅ **Implemented**: Returns `{ treasury, ln_fee_rate_root, reserve_fee_percent }` |
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

**Total: 878 test functions across 39 test files** (as of January 2025)

Notable test coverage:
- `test_market_oracle.cairo` - 860 lines, comprehensive TWAP testing
- `test_py_lp_oracle.cairo` - 842 lines, PT/YT/LP oracle testing

### Oracle Test Coverage

| Test File | Lines | Tests | Coverage Focus |
|-----------|-------|-------|----------------|
| `test_market_oracle.cairo` | 860 | ~40 | TWAP observation, binary search, cardinality growth |
| `test_py_lp_oracle.cairo` | 842 | ~35 | PT/YT/LP rate calculations, oracle state checks |

**Key Test Scenarios:**
- Observation accumulation over time
- Binary search edge cases (before/after buffer)
- Cardinality expansion
- Rate calculations at/after expiry
- Oracle readiness state transitions

---

## Appendix B: Implementation Roadmap Suggestion

### Phase 1: Critical (DeFi Composability - Oracle Focus) ✅ COMPLETE
**Horizon's Market TWAP Oracle is now fully implemented**

**Implementation files:**
- [`contracts/src/libraries/oracle_lib.cairo`](../contracts/src/libraries/oracle_lib.cairo) - Core TWAP library (~670 lines)
- [`contracts/src/market/amm.cairo`](../contracts/src/market/amm.cairo) - Oracle storage and interface (IMarketOracle)
- [`contracts/src/oracles/py_lp_oracle.cairo`](../contracts/src/oracles/py_lp_oracle.cairo) - PT/YT/LP price helpers (~320 lines)
- [`contracts/tests/oracles/test_py_lp_oracle.cairo`](../contracts/tests/oracles/test_py_lp_oracle.cairo) - Tests (842 lines)

| Item | Status | Implementation |
|------|--------|----------------|
| Market Observation Buffer | ✅ Done | `oracle_lib.cairo` - 8,760 slot ring buffer (1 year hourly) |
| lnImpliedRateCumulative | ✅ Done | `oracle_lib.cairo` - `Observation.ln_implied_rate_cumulative` |
| observe(secondsAgos[]) | ✅ Done | `amm.cairo:1003-1062` - `IMarketOracle::observe()` |
| increaseObservationsCardinalityNext() | ✅ Done | `amm.cairo:1066-1083` |
| getOracleState(market, duration) | ✅ Done | `py_lp_oracle.cairo:262-290` |
| getPtToSyRate/getPtToAssetRate | ✅ Done | `py_lp_oracle.cairo:47-175` |
| getLpToSyRate/getLpToAssetRate | ✅ Done | `py_lp_oracle.cairo:102-260` |
| getYtToSyRate/getYtToAssetRate | ✅ Done | `py_lp_oracle.cairo:77-210` |
| Pre-deployed PyLpOracle | ✅ Done | `py_lp_oracle.cairo` |
| getLnImpliedRateTwap | ✅ Done | `py_lp_oracle.cairo` |
| checkOracleState | ✅ Done | `py_lp_oracle.cairo` |
| Pragma/Chainlink Wrapper | 🟡 Optional | Not yet implemented |
| RouterStatic for frontend quotes | 🟡 Optional | Not yet implemented |

### Phase 2: High Priority (User Experience)
1. **Single-sided liquidity operations** (addLiquiditySinglePt/Sy/Token)
2. **Token aggregation** (TokenInput/Output + AVNU/Fibrous integration)
3. **swapExactTokenForPt/Yt** functions
4. **Factory protocol fees** (interestFeeRate, rewardFeeRate)
5. ~~**MarketFactory protocol fees** (treasury, reserveFeePercent, router fee overrides)~~ ✅ IMPLEMENTED
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

## Appendix C: Verification Commands

Verify the implementation claims in this document by running these commands from the repository root:

```bash
# TWAP Oracle implementation (expected: ~670 lines, ~320 lines)
wc -l contracts/src/libraries/oracle_lib.cairo
wc -l contracts/src/oracles/py_lp_oracle.cairo

# MarketFactory treasury/fee infrastructure
grep -n "treasury\|reserve_fee_percent" contracts/src/market/market_factory.cairo

# IMarketOracle interface in Market contract
grep -n "fn observe\|fn increase_observations" contracts/src/market/amm.cairo

# Total test count (expected: 878)
grep -r '#\[test\]' contracts/tests/ | wc -l

# Oracle test coverage (expected: 860 + 842 = 1,702 lines)
wc -l contracts/tests/market/test_market_oracle.cairo
wc -l contracts/tests/oracles/test_py_lp_oracle.cairo

# Verify Observation struct exists
grep -n "struct Observation" contracts/src/libraries/oracle_lib.cairo

# Verify get_market_config returns full MarketConfig
grep -n "fn get_market_config\|MarketConfig {" contracts/src/market/market_factory.cairo
```

**Expected Output Summary:**
| Verification | Command | Expected Result |
|--------------|---------|-----------------|
| oracle_lib.cairo | `wc -l` | ~670 lines |
| py_lp_oracle.cairo | `wc -l` | ~320 lines |
| Treasury storage | `grep treasury` | Lines 95, 150-151, 487-497 |
| Reserve fee storage | `grep reserve_fee_percent` | Lines 97, 132, 228, 488 |
| IMarketOracle::observe | `grep "fn observe"` | Line 1003 |
| IMarketOracle::increase_observations | `grep "fn increase"` | Line 1066 |
| Test count | `grep -r '#[test]'` | 878 tests |
| Oracle test lines | `wc -l` | 860 + 842 = 1,702 lines |

> **Note:** Line numbers may shift as the codebase evolves. The commands remain valid but specific line references should be re-verified.

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-07 | 2.0 | Major corrections: TWAP Oracle status updated from 0% to ~95%, MarketFactory treasury/fees confirmed implemented, Oracle System parity updated from 35% to ~90%, test count corrected to 878 |
| 2025-12-31 | 1.1 | Section 1.1 SY marked COMPLETE (95%) - slippage protection, rewards, multi-token implemented |

---

*Document generated from deep code analysis of Horizon Protocol codebase*
*Comparison baseline: Pendle V2 on Ethereum mainnet*
