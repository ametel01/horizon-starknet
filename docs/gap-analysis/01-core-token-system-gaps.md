# 1. Core Token System Gaps

## 1.1 SY (Standardized Yield) Wrapper

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

## 1.2 YT (Yield Token) Interest System

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
| Multi-reward claiming | `redeemDueInterestAndRewards()` | ❌ Missing | 🔴 HIGH | 
| Reward token registry | `getRewardTokens()` | ❌ Missing | 🔴 HIGH | 
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

## 1.3 PT (Principal Token)

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
