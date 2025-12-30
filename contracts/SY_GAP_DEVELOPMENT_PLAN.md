# SY (Standardized Yield) Gap Development Plan

> **Date:** 2025-12-30
> **Scope:** Fill gaps between Horizon SY and Pendle SYBase
> **Current Implementation:** `contracts/src/tokens/sy.cairo` (~472 lines)
> **Reference:** Pendle's `SYBase.sol` from [Pendle-SY-Public](https://github.com/pendle-finance/Pendle-SY-Public)

---

## Executive Summary

Horizon's SY implementation is at **70% parity** with Pendle's SYBase. The core deposit/redeem mechanics work correctly, and Horizon exceeds Pendle in dual oracle support, OracleRateUpdated events, and built-in upgradeability. However, 13 gaps remain across 3 priority tiers.

### Gap Inventory

| Priority | Gap Count | Blocking Factor |
|----------|-----------|-----------------|
| HIGH     | 3         | Multi-token SY wrappers, integrations |
| MEDIUM   | 7         | Router patterns, rewards, security |
| LOW      | 3         | UX polish, edge cases |

---

## Phase 1: Multi-Token Support (HIGH Priority)

**Impact:** Cannot wrap Curve LP, Yearn vaults, or aggregated yield sources
**Effort:** 3-4 days
**Files:** `src/tokens/sy.cairo`, `src/interfaces/i_sy.cairo`

### Gap 1.1: `getTokensIn()` / `getTokensOut()` **COMPLETE**

**Current State:**
```cairo
// Horizon - single token only
underlying: ContractAddress  // One asset per SY
```

**Target State:**
```cairo
// Storage additions
tokens_in: Map<u32, ContractAddress>    // Index → token address
tokens_in_count: u32
tokens_out: Map<u32, ContractAddress>
tokens_out_count: u32

// ISY additions
fn get_tokens_in(self: @TContractState) -> Span<ContractAddress>;
fn get_tokens_out(self: @TContractState) -> Span<ContractAddress>;
```

**Implementation Steps:**

1. **Add storage fields** in `sy.cairo` Storage struct:
   - `tokens_in: Map<u32, ContractAddress>`
   - `tokens_in_count: u32`
   - `tokens_out: Map<u32, ContractAddress>`
   - `tokens_out_count: u32`
   - File: `src/tokens/sy.cairo:60-86`

2. **Extend constructor** to accept arrays:
   ```cairo
   #[constructor]
   fn constructor(
       // ... existing params ...
       tokens_in: Span<ContractAddress>,
       tokens_out: Span<ContractAddress>,
   )
   ```
   - Populate storage maps in a loop
   - Validate no zero addresses
   - File: `src/tokens/sy.cairo:157-194`

3. **Add interface methods** to ISY:
   ```cairo
   fn get_tokens_in(self: @TContractState) -> Span<ContractAddress>;
   fn get_tokens_out(self: @TContractState) -> Span<ContractAddress>;
   ```
   - File: `src/interfaces/i_sy.cairo:4-27`

4. **Implement getters** in SYImpl:
   - Loop through `tokens_in` map up to `tokens_in_count`
   - Return collected array as Span
   - File: `src/tokens/sy.cairo:196-366`

**Validation:**
```bash
snforge test test_sy::test_get_tokens_in_out
```

---

### Gap 1.2: `isValidTokenIn()` / `isValidTokenOut()` **COMPLETE**

**Current State:** No token validation

**Target State:**
```cairo
fn is_valid_token_in(self: @TContractState, token: ContractAddress) -> bool;
fn is_valid_token_out(self: @TContractState, token: ContractAddress) -> bool;
```

**Implementation Steps:**

1. **Add interface methods** to ISY:
   - File: `src/interfaces/i_sy.cairo`

2. **Add storage for fast lookup**:
   ```cairo
   valid_tokens_in: Map<ContractAddress, bool>
   valid_tokens_out: Map<ContractAddress, bool>
   ```
   - File: `src/tokens/sy.cairo` Storage struct

3. **Populate during constructor**:
   - Set `valid_tokens_in.write(token, true)` for each token
   - File: `src/tokens/sy.cairo` constructor

4. **Implement validation** in SYImpl:
   ```cairo
   fn is_valid_token_in(self: @ContractState, token: ContractAddress) -> bool {
       self.valid_tokens_in.read(token)
   }
   ```

5. **Modify deposit()** to accept `token_in` parameter:
   ```cairo
   fn deposit(
       ref self: ContractState,
       receiver: ContractAddress,
       token_in: ContractAddress,      // NEW: which token to deposit
       amount_token_to_deposit: u256,
       min_shares_out: u256,           // Gap 2.1: slippage protection
   ) -> u256
   ```
   - Assert `is_valid_token_in(token_in)`
   - File: `src/tokens/sy.cairo:250-299`

**Validation:**
```bash
snforge test test_sy::test_is_valid_token
snforge test test_sy::test_deposit_invalid_token_reverts
```

---

### Gap 1.3: `assetInfo()` **COMPLETE**

**Current State:** No asset classification

**Target State:**
```cairo
#[derive(Drop, Serde, Copy)]
enum AssetType {
    Token,      // Regular ERC20
    Liquidity,  // LP tokens (Curve, Uniswap)
}

fn asset_info(self: @TContractState) -> (AssetType, ContractAddress, u8);
```

**Implementation Steps:**

1. **Define AssetType enum** in interfaces:
   ```cairo
   #[derive(Drop, Serde, Copy, starknet::Store)]
   pub enum AssetType {
       Token: (),
       Liquidity: (),
   }
   ```
   - File: `src/interfaces/i_sy.cairo`

2. **Add storage field**:
   ```cairo
   asset_type: AssetType
   ```
   - File: `src/tokens/sy.cairo` Storage struct

3. **Add constructor parameter**:
   ```cairo
   asset_type: AssetType,
   ```
   - File: `src/tokens/sy.cairo:157`

4. **Implement in SYImpl**:
   ```cairo
   fn asset_info(self: @ContractState) -> (AssetType, ContractAddress, u8) {
       (
           self.asset_type.read(),
           self.underlying.read(),
           self.decimals(),
       )
   }
   ```

**Validation:**
```bash
snforge test test_sy::test_asset_info_token
snforge test test_sy::test_asset_info_liquidity
```

---

## Phase 2: Slippage & Security (MEDIUM Priority)

**Impact:** Direct SY call safety, Router efficiency
**Effort:** 2-3 days
**Files:** `src/tokens/sy.cairo`, `src/interfaces/i_sy.cairo`

### Gap 2.1: Slippage Protection **COMPLETE**

**Current State:**
```cairo
fn deposit(receiver, amount_shares_to_deposit) -> u256  // No min_out
```

**Target State:**
```cairo
fn deposit(receiver, token_in, amount_to_deposit, min_shares_out) -> u256
fn redeem(receiver, amount_sy, min_token_out) -> u256
```

**Implementation Steps:**

1. **Modify ISY interface** to add slippage params:
   - File: `src/interfaces/i_sy.cairo:19-24`

2. **Update deposit() implementation**:
   ```cairo
   fn deposit(
       ref self: ContractState,
       receiver: ContractAddress,
       token_in: ContractAddress,
       amount_token_to_deposit: u256,
       min_shares_out: u256,
   ) -> u256 {
       // ... existing logic ...

       let sy_to_mint = self._deposit_internal(token_in, amount_token_to_deposit);
       assert(sy_to_mint >= min_shares_out, Errors::SY_INSUFFICIENT_SHARES_OUT);

       // ... mint and emit ...
   }
   ```
   - File: `src/tokens/sy.cairo:255-299`

3. **Add new error constant**:
   ```cairo
   pub const SY_INSUFFICIENT_SHARES_OUT: felt252 = 'SY: insufficient shares out';
   pub const SY_INSUFFICIENT_TOKEN_OUT: felt252 = 'SY: insufficient token out';
   ```
   - File: `src/libraries/errors.cairo`

4. **Update redeem()** similarly:
   ```cairo
   fn redeem(
       receiver: ContractAddress,
       amount_sy_to_redeem: u256,
       min_token_out: u256,
   ) -> u256
   ```
   - File: `src/tokens/sy.cairo:301-343`

5. **Update all Router calls** that use SY:
   - Pass `0` for min_out when Router handles slippage
   - File: `src/router.cairo`

**Validation:**
```bash
snforge test test_sy::test_deposit_slippage_reverts
snforge test test_sy::test_redeem_slippage_reverts
```

---

### Gap 2.2: `burnFromInternalBalance` **COMPLETE**

**Current State:**
```cairo
// Only burns from msg.sender
self.erc20.burn(caller, amount_sy_to_redeem);
```

**Target State:**
```cairo
fn redeem(
    receiver: ContractAddress,
    amount_sy_to_redeem: u256,
    min_token_out: u256,
    burn_from_internal_balance: bool,  // NEW
) -> u256
```

**Implementation Steps:**

1. **Modify ISY interface**:
   - Add `burn_from_internal_balance: bool` parameter
   - File: `src/interfaces/i_sy.cairo:22-24`

2. **Update redeem() logic**:
   ```cairo
   if burn_from_internal_balance {
       // Burn from contract's own balance (Router pattern)
       self.erc20.burn(get_contract_address(), amount_sy_to_redeem);
   } else {
       // Burn from caller
       self.erc20.burn(caller, amount_sy_to_redeem);
   }
   ```
   - File: `src/tokens/sy.cairo:305-320`

3. **Update Router** to use new pattern:
   - Transfer SY to SY contract, then call redeem with `burn_from_internal_balance=true`
   - More gas efficient for aggregator integrations
   - File: `src/router.cairo`

**Validation:**
```bash
snforge test test_sy::test_redeem_from_internal_balance
snforge test test_router::test_router_uses_internal_balance
```

---

### Gap 2.3: Reentrancy Guard

**Current State:** CEI pattern only (no explicit guard)

**Target State:** Explicit `ReentrancyGuardComponent`

**Implementation Steps:**

1. **Add ReentrancyGuard component**:
   ```cairo
   use openzeppelin_security::reentrancyguard::ReentrancyGuardComponent;

   component!(path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent);

   impl ReentrancyGuardInternalImpl = ReentrancyGuardComponent::InternalImpl<ContractState>;
   ```
   - File: `src/tokens/sy.cairo:38-50`

2. **Add to Storage struct**:
   ```cairo
   #[substorage(v0)]
   reentrancy_guard: ReentrancyGuardComponent::Storage,
   ```
   - File: `src/tokens/sy.cairo:60-86`

3. **Wrap deposit/redeem**:
   ```cairo
   fn deposit(...) -> u256 {
       self.reentrancy_guard.start();
       // ... existing logic ...
       self.reentrancy_guard.end();
       sy_to_mint
   }
   ```
   - File: `src/tokens/sy.cairo:255-343`

4. **Add event to enum**:
   ```cairo
   #[flat]
   ReentrancyGuardEvent: ReentrancyGuardComponent::Event,
   ```
   - File: `src/tokens/sy.cairo:87-105`

**Validation:**
```bash
snforge test test_sy::test_reentrancy_blocked
```

---

### Gap 2.4: Preview Functions (External)

**Current State:** `preview_deposit/redeem` are internal only

**Target State:** Expose as external view functions

**Implementation Steps:**

1. **Add to ISY interface**:
   ```cairo
   fn preview_deposit(self: @TContractState, token_in: ContractAddress, amount_to_deposit: u256) -> u256;
   fn preview_redeem(self: @TContractState, amount_sy: u256) -> u256;
   ```
   - File: `src/interfaces/i_sy.cairo`

2. **Move implementations** from InternalImpl to SYImpl:
   - Make public with `#[abi(embed_v0)]`
   - File: `src/tokens/sy.cairo:392-407`

**Validation:**
```bash
snforge test test_sy::test_preview_deposit_matches_deposit
snforge test test_sy::test_preview_redeem_matches_redeem
```

---

## Phase 3: Reward System (MEDIUM-HIGH Priority)

**Impact:** Cannot wrap GLP-style tokens, staked tokens with emissions
**Effort:** 5-7 days
**Files:** New `src/tokens/sy_with_rewards.cairo`, `src/libraries/reward_manager.cairo`

### Gap 3.1: SYBaseWithRewards Foundation

**Current State:** No reward system

**Target State:**
```cairo
#[starknet::contract]
pub mod SYWithRewards {
    // Inherits all SY functionality
    // Adds RewardManager integration
}
```

**Implementation Steps:**

1. **Create RewardManager library**:
   ```cairo
   // src/libraries/reward_manager.cairo
   pub mod RewardManager {
       struct UserReward {
           index: u256,           // User's last claimed index
           accrued: u256,         // Unclaimed rewards
       }

       struct RewardState {
           index: u256,           // Global reward index
           last_balance: u256,    // Last known reward token balance
       }

       fn _update_reward_index(reward_token: ContractAddress) -> u256;
       fn _distribute_rewards(user: ContractAddress);
       fn _claim_rewards(user: ContractAddress) -> Span<u256>;
   }
   ```
   - File: NEW `src/libraries/reward_manager.cairo`

2. **Create SYWithRewards contract**:
   - Copy SY base implementation
   - Add RewardManager integration
   - Override `_beforeTokenTransfer` equivalent
   - File: NEW `src/tokens/sy_with_rewards.cairo`

3. **Add storage for rewards**:
   ```cairo
   reward_tokens: Map<u32, ContractAddress>
   reward_tokens_count: u32
   reward_state: Map<ContractAddress, RewardState>
   user_reward: Map<(ContractAddress, ContractAddress), UserReward>  // (user, reward_token)
   ```

4. **Implement getRewardTokens()**:
   ```cairo
   fn get_reward_tokens(self: @ContractState) -> Span<ContractAddress> {
       let mut tokens = ArrayTrait::new();
       let count = self.reward_tokens_count.read();
       let mut i: u32 = 0;
       loop {
           if i >= count { break; }
           tokens.append(self.reward_tokens.read(i));
           i += 1;
       };
       tokens.span()
   }
   ```

5. **Implement claimRewards()**:
   ```cairo
   fn claim_rewards(ref self: ContractState, user: ContractAddress) -> Span<u256> {
       self._update_and_distribute_rewards(user);
       self._do_transfer_out_rewards(user, user)
   }
   ```

6. **Hook into transfer**:
   ```cairo
   // Override in ERC20 hooks
   fn before_update(
       ref self: ContractState,
       from: ContractAddress,
       to: ContractAddress,
       amount: u256,
   ) {
       self._update_and_distribute_rewards_for_two(from, to);
   }
   ```

7. **Add interface**:
   ```cairo
   // src/interfaces/i_sy_with_rewards.cairo
   #[starknet::interface]
   pub trait ISYWithRewards<TContractState> {
       // All ISY methods
       fn get_reward_tokens(self: @TContractState) -> Span<ContractAddress>;
       fn claim_rewards(ref self: TContractState, user: ContractAddress) -> Span<u256>;
       fn accrued_rewards(self: @TContractState, user: ContractAddress) -> Span<u256>;
   }
   ```
   - File: NEW `src/interfaces/i_sy_with_rewards.cairo`

8. **Update Factory** to deploy either SY or SYWithRewards:
   - Add parameter to choose variant
   - File: `src/factory.cairo`

**Validation:**
```bash
snforge test test_sy_with_rewards::test_claim_rewards
snforge test test_sy_with_rewards::test_rewards_update_on_transfer
snforge test test_sy_with_rewards::test_multi_reward_tokens
```

---

## Phase 4: Polish & Edge Cases (LOW Priority)

**Impact:** UX improvements, edge case handling
**Effort:** 1-2 days

### Gap 4.1: Pausable Transfers

**Current State:** Only deposit is pausable

**Target State:** All transfers pausable via hook

**Implementation Steps:**

1. **Enable ERC20 hooks** in SY:
   ```cairo
   impl ERC20HooksImpl of ERC20Component::ERC20HooksTrait<ContractState> {
       fn before_update(
           ref self: ContractState,
           from: ContractAddress,
           recipient: ContractAddress,
           amount: u256,
       ) {
           self.pausable.assert_not_paused();
       }

       fn after_update(
           ref self: ContractState,
           from: ContractAddress,
           recipient: ContractAddress,
           amount: u256,
       ) {}
   }
   ```
   - File: `src/tokens/sy.cairo`

2. **Replace ERC20HooksEmptyImpl** with custom implementation

**Validation:**
```bash
snforge test test_sy::test_transfer_blocked_when_paused
```

---

### Gap 4.2: Negative Yield Watermark

**Current State:** Watermark only in YT

**Target State:** SY tracks minimum exchange rate

**Implementation Steps:**

1. **Add storage**:
   ```cairo
   min_exchange_rate: u256  // Watermark for negative yield detection
   ```

2. **Update in deposit/redeem**:
   ```cairo
   let current_rate = self.exchange_rate();
   let min_rate = self.min_exchange_rate.read();
   if current_rate < min_rate {
       // Negative yield detected
       self.emit(NegativeYieldDetected { ... });
   } else if current_rate > min_rate {
       self.min_exchange_rate.write(current_rate);
   }
   ```

3. **Add event**:
   ```cairo
   #[derive(Drop, starknet::Event)]
   pub struct NegativeYieldDetected {
       pub sy: ContractAddress,
       pub previous_rate: u256,
       pub current_rate: u256,
       pub timestamp: u64,
   }
   ```

**Validation:**
```bash
snforge test test_sy::test_negative_yield_watermark
```

---

## Implementation Order & Dependencies

```
Phase 1 (Multi-Token) ─┬─► Gap 1.1 (getTokensIn/Out)
                       ├─► Gap 1.2 (isValidToken) ◄─ depends on 1.1
                       └─► Gap 1.3 (assetInfo)

Phase 2 (Security) ────┬─► Gap 2.1 (Slippage) ◄─ can modify signature from Phase 1
                       ├─► Gap 2.2 (burnFromInternalBalance)
                       ├─► Gap 2.3 (Reentrancy)
                       └─► Gap 2.4 (Preview external)

Phase 3 (Rewards) ─────┬─► RewardManager library (new file)
                       ├─► SYWithRewards contract (new file)
                       └─► Factory updates

Phase 4 (Polish) ──────┬─► Gap 4.1 (Pausable transfers)
                       └─► Gap 4.2 (Negative yield watermark)
```

---

## Breaking Changes

### Interface Changes

The following ISY changes are **breaking**:

1. `deposit()` signature change:
   - Old: `deposit(receiver, amount_shares_to_deposit)`
   - New: `deposit(receiver, token_in, amount_to_deposit, min_shares_out)`

2. `redeem()` signature change:
   - Old: `redeem(receiver, amount_sy_to_redeem)`
   - New: `redeem(receiver, amount_sy_to_redeem, min_token_out, burn_from_internal_balance)`

### Migration Strategy

1. **Deploy new SY class hash** with updated interface
2. **Update Router** to use new signatures before upgrading SY
3. **Upgrade existing SY contracts** via `upgrade()` call
4. **Update frontend** to pass new parameters

### Backward Compatibility Option

Add wrapper functions with old signatures that call new functions with defaults:

```cairo
// Deprecated - use deposit_with_slippage instead
fn deposit(receiver, amount) -> u256 {
    self.deposit_with_slippage(
        receiver,
        self.underlying.read(),  // default token
        amount,
        0,  // no slippage check
    )
}
```

---

## Test Coverage Requirements

Each phase must have:

| Test Category | Coverage Target |
|---------------|-----------------|
| Happy path | 100% |
| Edge cases (zero amounts, max values) | 100% |
| Revert conditions | 100% |
| Event emissions | 100% |
| Integration with Router | 100% |

### Test Files to Create/Modify

- `tests/test_sy.cairo` - Extend existing tests
- `tests/test_sy_multi_token.cairo` - NEW: Multi-token scenarios
- `tests/test_sy_with_rewards.cairo` - NEW: Reward system tests
- `tests/test_sy_slippage.cairo` - NEW: Slippage edge cases

---

## Non-Goals (Excluded from this plan)

| Gap | Reason for Exclusion |
|-----|---------------------|
| EIP-2612 Permit | Starknet uses native account abstraction |
| Native ETH support | Starknet doesn't have native ETH (uses WETH) |
| Cross-chain operations | Future phase, requires bridge integration |

---

## Success Criteria

After completing all phases:

1. ✅ `scarb build` succeeds
2. ✅ `snforge test` all pass (0 failures)
3. ✅ `scarb fmt` no changes needed
4. ✅ SY can wrap multi-token yield sources (Curve LP simulation)
5. ✅ Slippage protection works at SY level
6. ✅ Router can use `burnFromInternalBalance` pattern
7. ✅ SYWithRewards can track and distribute multiple reward tokens
8. ✅ All existing Router/Factory integration tests pass

---

## Appendix: Pendle Reference Code

### SYBase.sol Key Excerpts

```solidity
// Multi-token support
function getTokensIn() external view virtual returns (address[] memory);
function getTokensOut() external view virtual returns (address[] memory);
function isValidTokenIn(address token) public view virtual returns (bool);
function isValidTokenOut(address token) public view virtual returns (bool);

// Asset info
function assetInfo() external view returns (AssetType, address, uint8);

// Slippage protection
function deposit(
    address receiver,
    address tokenIn,
    uint256 amountTokenToDeposit,
    uint256 minSharesOut
) external nonReentrant returns (uint256 amountSharesOut);

// Internal balance burn
function redeem(
    address receiver,
    uint256 amountSharesToRedeem,
    address tokenOut,
    uint256 minTokenOut,
    bool burnFromInternalBalance
) external nonReentrant returns (uint256 amountTokenOut);
```

### SYBaseWithRewards.sol Key Excerpts

```solidity
abstract contract SYBaseWithRewards is SYBase, RewardManager {
    function claimRewards(address user)
        external returns (uint256[] memory rewardAmounts);

    function getRewardTokens()
        external view returns (address[] memory);

    function _beforeTokenTransfer(address from, address to, uint256) internal {
        _updateAndDistributeRewardsForTwo(from, to);
    }
}
```
