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

### Gap 2.3: Reentrancy Guard **COMPLETE**

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

### Gap 2.4: Preview Functions (External) **COMPLETE**

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

### Architecture: Component-Based Composition

Cairo doesn't have inheritance like Solidity. Instead, we use **composition via components** - a more flexible pattern that avoids code duplication and the diamond problem.

```
┌─────────────────────────────────────────────────────────────────┐
│  Solidity (Pendle)           │  Cairo (Horizon)                │
│  ─────────────────           │  ──────────────────             │
│  SYBaseWithRewards           │  SYWithRewards contract         │
│    is SYBase                 │    component!(SYComponent)      │
│    is RewardManager          │    component!(RewardManager)    │
│                              │    component!(ERC20Component)   │
│  (tight coupling)            │  (loose coupling via hooks)     │
└─────────────────────────────────────────────────────────────────┘
```

**New File Structure:**
```
src/
├── components/
│   ├── sy_component.cairo              # Core SY logic (extracted from sy.cairo)
│   └── reward_manager_component.cairo  # Reward tracking component
├── tokens/
│   ├── sy.cairo                   # Refactored to use SYComponent
│   └── sy_with_rewards.cairo      # SYComponent + RewardManager
└── interfaces/
    ├── i_sy.cairo                 # Unchanged
    └── i_sy_with_rewards.cairo    # Extended interface
```

---

### Gap 3.1: Extract SYComponent

**Current State:** Monolithic `sy.cairo` with all logic inline

**Target State:** Reusable `SYComponent` with hooks for extensibility

**Component Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                        SY Contract                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ ERC20Comp    │  │ SYComponent  │  │ Pausable/Ownable/etc │  │
│  │              │  │              │  │                      │  │
│  │ - balances   │  │ - underlying │  │ - paused             │  │
│  │ - supply     │  │ - oracle     │  │ - owner              │  │
│  │ - mint()     │◄─┤ - tokens_in  │  │                      │  │
│  │ - burn()     │  │ - deposit()  │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         ▲                  │                                     │
│         │    SYHooksTrait  │                                     │
│         └──────────────────┘                                     │
│                                                                  │
│  impl SYHooksImpl: mint_sy() → self.erc20.mint()                │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Steps:**

1. **Create SYComponent** with hooks pattern:
   ```cairo
   // src/components/sy_component.cairo
   #[starknet::component]
   pub mod SYComponent {
       #[storage]
       pub struct Storage {
           // Core SY state (NOT ERC20 - that's a separate component)
           pub underlying: ContractAddress,
           pub index_oracle: ContractAddress,
           pub is_erc4626: bool,
           pub last_exchange_rate: u256,
           pub asset_type: AssetType,
           // Multi-token support
           pub tokens_in: Map<u32, ContractAddress>,
           pub tokens_in_count: u32,
           pub tokens_out: Map<u32, ContractAddress>,
           pub tokens_out_count: u32,
           pub valid_tokens_in: Map<ContractAddress, bool>,
           pub valid_tokens_out: Map<ContractAddress, bool>,
       }

       #[event]
       #[derive(Drop, starknet::Event)]
       pub enum Event {
           Deposit: Deposit,
           Redeem: Redeem,
           OracleRateUpdated: OracleRateUpdated,
       }

       /// Hooks trait - contracts MUST implement to bridge with ERC20
       pub trait SYHooksTrait<TContractState> {
           /// Mint SY tokens (contract calls erc20.mint internally)
           fn mint_sy(ref self: TContractState, to: ContractAddress, amount: u256);
           /// Burn SY tokens (contract calls erc20.burn internally)
           fn burn_sy(ref self: TContractState, from: ContractAddress, amount: u256);
           /// Get total SY supply (contract reads from erc20)
           fn total_sy_supply(self: @TContractState) -> u256;
           /// Called before deposit - for pausable, reentrancy guard
           fn before_deposit(ref self: TContractState, receiver: ContractAddress, amount: u256);
           /// Called after deposit - for rewards tracking
           fn after_deposit(ref self: TContractState, receiver: ContractAddress, amount: u256);
           /// Called before redeem
           fn before_redeem(ref self: TContractState, receiver: ContractAddress, amount: u256);
           /// Called after redeem
           fn after_redeem(ref self: TContractState, receiver: ContractAddress, amount: u256);
       }
   }
   ```
   - File: NEW `src/components/sy_component.cairo`

2. **Add embeddable view implementation**:
   ```cairo
   /// Embeddable external implementation for ISY view functions
   #[embeddable_as(SYViewImpl)]
   pub impl SYView<
       TContractState, +HasComponent<TContractState>
   > of ISYView<ComponentState<TContractState>> {
       fn exchange_rate(self: @ComponentState<TContractState>) -> u256 { ... }
       fn underlying_asset(self: @ComponentState<TContractState>) -> ContractAddress { ... }
       fn get_tokens_in(self: @ComponentState<TContractState>) -> Span<ContractAddress> { ... }
       fn get_tokens_out(self: @ComponentState<TContractState>) -> Span<ContractAddress> { ... }
       fn is_valid_token_in(self: @ComponentState<TContractState>, token: ContractAddress) -> bool { ... }
       fn is_valid_token_out(self: @ComponentState<TContractState>, token: ContractAddress) -> bool { ... }
       fn asset_info(self: @ComponentState<TContractState>) -> (AssetType, ContractAddress, u8) { ... }
       fn preview_deposit(self: @ComponentState<TContractState>, amount: u256) -> u256 { amount }
       fn preview_redeem(self: @ComponentState<TContractState>, amount: u256) -> u256 { amount }
   }
   ```

3. **Add internal implementation with hooks**:
   ```cairo
   #[generate_trait]
   pub impl InternalImpl<
       TContractState,
       +HasComponent<TContractState>,
       +Drop<TContractState>,
       impl Hooks: SYHooksTrait<TContractState>,
   > of InternalTrait<TContractState> {

       fn deposit(
           ref self: ComponentState<TContractState>,
           receiver: ContractAddress,
           amount: u256,
           min_shares_out: u256,
       ) -> u256 {
           let mut contract = self.get_contract_mut();

           // Hook: before_deposit (pausable check, reentrancy start)
           Hooks::before_deposit(ref contract, receiver, amount);

           // Check oracle rate update
           self._check_and_emit_rate_update();

           // Transfer underlying from caller
           let underlying_token = IERC20Dispatcher { contract_address: self.underlying.read() };
           underlying_token.transfer_from(get_caller_address(), get_contract_address(), amount);

           // 1:1 SY minting
           let sy_to_mint = amount;
           assert(sy_to_mint >= min_shares_out, Errors::SY_INSUFFICIENT_SHARES_OUT);

           // Hook: mint SY tokens (delegates to contract's ERC20)
           Hooks::mint_sy(ref contract, receiver, sy_to_mint);

           // Emit SY event
           self.emit(Deposit { ... });

           // Hook: after_deposit (rewards update, reentrancy end)
           Hooks::after_deposit(ref contract, receiver, sy_to_mint);

           sy_to_mint
       }

       fn redeem(...) -> u256 { /* Similar pattern with hooks */ }
   }
   ```

4. **Refactor sy.cairo to use SYComponent**:
   ```cairo
   // src/tokens/sy.cairo
   #[starknet::contract]
   pub mod SY {
       use horizon::components::sy_component::SYComponent;

       component!(path: ERC20Component, storage: erc20, event: ERC20Event);
       component!(path: SYComponent, storage: sy, event: SYEvent);
       component!(path: PausableComponent, storage: pausable, event: PausableEvent);
       component!(path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent);

       // Use empty ERC20 hooks (no special transfer behavior for base SY)
       impl ERC20HooksImpl = ERC20Component::ERC20HooksEmptyImpl<ContractState>;

       #[storage]
       struct Storage {
           #[substorage(v0)]
           erc20: ERC20Component::Storage,
           #[substorage(v0)]
           sy: SYComponent::Storage,
           #[substorage(v0)]
           pausable: PausableComponent::Storage,
           #[substorage(v0)]
           reentrancy_guard: ReentrancyGuardComponent::Storage,
       }

       /// Implement SY hooks - bridge to ERC20 and other components
       impl SYHooksImpl of SYComponent::SYHooksTrait<ContractState> {
           fn mint_sy(ref self: ContractState, to: ContractAddress, amount: u256) {
               self.erc20.mint(to, amount);
           }

           fn burn_sy(ref self: ContractState, from: ContractAddress, amount: u256) {
               self.erc20.burn(from, amount);
           }

           fn total_sy_supply(self: @ContractState) -> u256 {
               self.erc20.ERC20_total_supply.read()
           }

           fn before_deposit(ref self: ContractState, receiver: ContractAddress, amount: u256) {
               self.pausable.assert_not_paused();
               self.reentrancy_guard.start();
           }

           fn after_deposit(ref self: ContractState, receiver: ContractAddress, amount: u256) {
               self.reentrancy_guard.end();
               // Base SY: no additional logic
           }

           fn before_redeem(ref self: ContractState, receiver: ContractAddress, amount: u256) {
               self.reentrancy_guard.start();
           }

           fn after_redeem(ref self: ContractState, receiver: ContractAddress, amount: u256) {
               self.reentrancy_guard.end();
           }
       }

       #[abi(embed_v0)]
       impl SYImpl of ISY<ContractState> {
           // ERC20 methods delegate to erc20 component
           fn name(self: @ContractState) -> ByteArray { self.erc20.ERC20_name.read() }
           // ...

           // SY-specific methods delegate to SY component
           fn deposit(ref self: ContractState, receiver: ContractAddress, amount: u256, min_out: u256) -> u256 {
               self.sy.deposit(receiver, amount, min_out)
           }

           fn exchange_rate(self: @ContractState) -> u256 { self.sy.exchange_rate() }
           // ...
       }
   }
   ```

**Validation:**
```bash
# All existing SY tests must pass unchanged
snforge test test_sy
```

---

### Gap 3.2: Create RewardManagerComponent

**Current State:** No reward tracking

**Target State:** Reusable component for reward index accounting

**Implementation Steps:**

1. **Create RewardManagerComponent**:
   ```cairo
   // src/components/reward_manager.cairo
   #[starknet::component]
   pub mod RewardManagerComponent {
       #[storage]
       pub struct Storage {
           // Reward tokens list
           pub reward_tokens: Map<u32, ContractAddress>,
           pub reward_tokens_count: u32,
           // Global reward state per token: token -> RewardState
           pub reward_index: Map<ContractAddress, u256>,
           pub reward_last_balance: Map<ContractAddress, u256>,
           // User reward state: (user, token) -> UserReward
           pub user_reward_index: Map<(ContractAddress, ContractAddress), u256>,
           pub user_accrued: Map<(ContractAddress, ContractAddress), u256>,
       }

       #[event]
       #[derive(Drop, starknet::Event)]
       pub enum Event {
           RewardsClaimed: RewardsClaimed,
           RewardIndexUpdated: RewardIndexUpdated,
       }

       #[derive(Drop, starknet::Event)]
       pub struct RewardsClaimed {
           #[key]
           pub user: ContractAddress,
           #[key]
           pub reward_token: ContractAddress,
           pub amount: u256,
       }

       #[derive(Drop, starknet::Event)]
       pub struct RewardIndexUpdated {
           #[key]
           pub reward_token: ContractAddress,
           pub old_index: u256,
           pub new_index: u256,
           pub rewards_added: u256,
       }

       /// Hooks for reward calculations - contract provides balance info
       pub trait RewardHooksTrait<TContractState> {
           /// Get user's SY balance (for reward calculation)
           fn user_sy_balance(self: @TContractState, user: ContractAddress) -> u256;
           /// Get total SY supply
           fn total_sy_supply(self: @TContractState) -> u256;
       }
   }
   ```
   - File: NEW `src/components/reward_manager.cairo`

2. **Add internal implementation**:
   ```cairo
   #[generate_trait]
   pub impl InternalImpl<
       TContractState,
       +HasComponent<TContractState>,
       impl Hooks: RewardHooksTrait<TContractState>,
   > of InternalTrait<TContractState> {

       /// Update rewards for two users (called on transfer)
       fn _update_rewards_for_two(
           ref self: ComponentState<TContractState>,
           user1: ContractAddress,
           user2: ContractAddress,
       ) {
           self._update_global_reward_index();
           if !user1.is_zero() {
               self._update_user_rewards(user1);
           }
           if !user2.is_zero() && user1 != user2 {
               self._update_user_rewards(user2);
           }
       }

       /// Check for new rewards and update global index
       fn _update_global_reward_index(ref self: ComponentState<TContractState>) {
           let contract = self.get_contract();
           let total_supply = Hooks::total_sy_supply(@contract);
           if total_supply == 0 { return; }

           let count = self.reward_tokens_count.read();
           let mut i: u32 = 0;
           while i < count {
               let token = self.reward_tokens.read(i);
               let token_dispatcher = IERC20Dispatcher { contract_address: token };
               let current_balance = token_dispatcher.balance_of(get_contract_address());
               let last_balance = self.reward_last_balance.read(token);

               if current_balance > last_balance {
                   let new_rewards = current_balance - last_balance;
                   let old_index = self.reward_index.read(token);
                   // index += new_rewards * WAD / total_supply
                   let index_delta = (new_rewards * WAD) / total_supply;
                   let new_index = old_index + index_delta;

                   self.reward_index.write(token, new_index);
                   self.reward_last_balance.write(token, current_balance);

                   self.emit(RewardIndexUpdated {
                       reward_token: token,
                       old_index,
                       new_index,
                       rewards_added: new_rewards,
                   });
               }
               i += 1;
           }
       }

       /// Update user's accrued rewards based on current index
       fn _update_user_rewards(
           ref self: ComponentState<TContractState>,
           user: ContractAddress,
       ) {
           let contract = self.get_contract();
           let user_balance = Hooks::user_sy_balance(@contract, user);

           let count = self.reward_tokens_count.read();
           let mut i: u32 = 0;
           while i < count {
               let token = self.reward_tokens.read(i);
               let global_index = self.reward_index.read(token);
               let user_index = self.user_reward_index.read((user, token));

               if global_index > user_index {
                   // accrued += user_balance * (global_index - user_index) / WAD
                   let index_delta = global_index - user_index;
                   let new_accrued = (user_balance * index_delta) / WAD;
                   let current_accrued = self.user_accrued.read((user, token));
                   self.user_accrued.write((user, token), current_accrued + new_accrued);
               }
               self.user_reward_index.write((user, token), global_index);
               i += 1;
           }
       }

       /// Claim all accrued rewards for user
       fn claim_rewards(
           ref self: ComponentState<TContractState>,
           user: ContractAddress,
       ) -> Span<u256> {
           self._update_global_reward_index();
           self._update_user_rewards(user);

           let count = self.reward_tokens_count.read();
           let mut amounts: Array<u256> = array![];
           let mut i: u32 = 0;
           while i < count {
               let token = self.reward_tokens.read(i);
               let accrued = self.user_accrued.read((user, token));

               if accrued > 0 {
                   self.user_accrued.write((user, token), 0);
                   // Update last_balance to reflect outgoing transfer
                   let last_balance = self.reward_last_balance.read(token);
                   self.reward_last_balance.write(token, last_balance - accrued);
                   // Transfer rewards to user
                   let token_dispatcher = IERC20Dispatcher { contract_address: token };
                   token_dispatcher.transfer(user, accrued);

                   self.emit(RewardsClaimed {
                       user,
                       reward_token: token,
                       amount: accrued,
                   });
               }
               amounts.append(accrued);
               i += 1;
           }
           amounts.span()
       }
   }
   ```

3. **Add embeddable view implementation**:
   ```cairo
   #[embeddable_as(RewardViewImpl)]
   pub impl RewardView<
       TContractState, +HasComponent<TContractState>
   > of IRewardView<ComponentState<TContractState>> {
       fn get_reward_tokens(self: @ComponentState<TContractState>) -> Span<ContractAddress> {
           let count = self.reward_tokens_count.read();
           let mut tokens: Array<ContractAddress> = array![];
           let mut i: u32 = 0;
           while i < count {
               tokens.append(self.reward_tokens.read(i));
               i += 1;
           }
           tokens.span()
       }

       fn accrued_rewards(
           self: @ComponentState<TContractState>,
           user: ContractAddress,
       ) -> Span<u256> {
           let count = self.reward_tokens_count.read();
           let mut amounts: Array<u256> = array![];
           let mut i: u32 = 0;
           while i < count {
               let token = self.reward_tokens.read(i);
               amounts.append(self.user_accrued.read((user, token)));
               i += 1;
           }
           amounts.span()
       }
   }
   ```

**Validation:**
```bash
snforge test test_reward_manager::test_index_calculation
snforge test test_reward_manager::test_user_accrual
```

---

### Gap 3.3: Create SYWithRewards Contract

**Current State:** No reward-enabled SY variant

**Target State:** SYWithRewards that composes SYComponent + RewardManagerComponent

**Implementation Steps:**

1. **Create ISYWithRewards interface**:
   ```cairo
   // src/interfaces/i_sy_with_rewards.cairo
   #[starknet::interface]
   pub trait ISYWithRewards<TContractState> {
       // All ISY methods (deposit, redeem, exchange_rate, etc.)
       // ... same as ISY ...

       // Reward-specific methods
       fn get_reward_tokens(self: @TContractState) -> Span<ContractAddress>;
       fn claim_rewards(ref self: TContractState, user: ContractAddress) -> Span<u256>;
       fn accrued_rewards(self: @TContractState, user: ContractAddress) -> Span<u256>;
   }
   ```
   - File: NEW `src/interfaces/i_sy_with_rewards.cairo`

2. **Create SYWithRewards contract**:
   ```cairo
   // src/tokens/sy_with_rewards.cairo
   #[starknet::contract]
   pub mod SYWithRewards {
       use horizon::components::sy_component::SYComponent;
       use horizon::components::reward_manager::RewardManagerComponent;

       component!(path: ERC20Component, storage: erc20, event: ERC20Event);
       component!(path: SYComponent, storage: sy, event: SYEvent);
       component!(path: RewardManagerComponent, storage: rewards, event: RewardsEvent);
       component!(path: PausableComponent, storage: pausable, event: PausableEvent);
       component!(path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent);

       #[storage]
       struct Storage {
           #[substorage(v0)]
           erc20: ERC20Component::Storage,
           #[substorage(v0)]
           sy: SYComponent::Storage,
           #[substorage(v0)]
           rewards: RewardManagerComponent::Storage,
           #[substorage(v0)]
           pausable: PausableComponent::Storage,
           #[substorage(v0)]
           reentrancy_guard: ReentrancyGuardComponent::Storage,
       }

       // Custom ERC20 hooks - update rewards on every transfer
       impl ERC20HooksImpl of ERC20Component::ERC20HooksTrait<ContractState> {
           fn before_update(
               ref self: ContractState,
               from: ContractAddress,
               to: ContractAddress,
               amount: u256,
           ) {
               // Update rewards for both parties BEFORE balance changes
               self.rewards._update_rewards_for_two(from, to);
           }

           fn after_update(
               ref self: ContractState,
               from: ContractAddress,
               to: ContractAddress,
               amount: u256,
           ) {
               // No-op
           }
       }

       /// SY hooks with reward tracking
       impl SYHooksImpl of SYComponent::SYHooksTrait<ContractState> {
           fn mint_sy(ref self: ContractState, to: ContractAddress, amount: u256) {
               self.erc20.mint(to, amount);
           }

           fn burn_sy(ref self: ContractState, from: ContractAddress, amount: u256) {
               self.erc20.burn(from, amount);
           }

           fn total_sy_supply(self: @ContractState) -> u256 {
               self.erc20.ERC20_total_supply.read()
           }

           fn before_deposit(ref self: ContractState, receiver: ContractAddress, amount: u256) {
               self.pausable.assert_not_paused();
               self.reentrancy_guard.start();
           }

           fn after_deposit(ref self: ContractState, receiver: ContractAddress, amount: u256) {
               self.reentrancy_guard.end();
               // ★ Update rewards after deposit (balance changed)
               self.rewards._update_user_rewards(receiver);
           }

           fn before_redeem(ref self: ContractState, receiver: ContractAddress, amount: u256) {
               self.reentrancy_guard.start();
           }

           fn after_redeem(ref self: ContractState, receiver: ContractAddress, amount: u256) {
               self.reentrancy_guard.end();
               // ★ Update rewards after redeem (balance changed)
               self.rewards._update_user_rewards(receiver);
           }
       }

       /// Reward hooks - provide balance info to RewardManager
       impl RewardHooksImpl of RewardManagerComponent::RewardHooksTrait<ContractState> {
           fn user_sy_balance(self: @ContractState, user: ContractAddress) -> u256 {
               self.erc20.ERC20_balances.read(user)
           }

           fn total_sy_supply(self: @ContractState) -> u256 {
               self.erc20.ERC20_total_supply.read()
           }
       }

       #[abi(embed_v0)]
       impl SYWithRewardsImpl of ISYWithRewards<ContractState> {
           // ... all ISY methods delegating to sy component ...

           fn get_reward_tokens(self: @ContractState) -> Span<ContractAddress> {
               self.rewards.get_reward_tokens()
           }

           fn claim_rewards(ref self: ContractState, user: ContractAddress) -> Span<u256> {
               self.rewards.claim_rewards(user)
           }

           fn accrued_rewards(self: @ContractState, user: ContractAddress) -> Span<u256> {
               self.rewards.accrued_rewards(user)
           }
       }
   }
   ```
   - File: NEW `src/tokens/sy_with_rewards.cairo`

**Validation:**
```bash
snforge test test_sy_with_rewards::test_claim_rewards
snforge test test_sy_with_rewards::test_rewards_update_on_transfer
snforge test test_sy_with_rewards::test_rewards_update_on_deposit
snforge test test_sy_with_rewards::test_multi_reward_tokens
```

---

### Gap 3.4: Update Factory for SY Variants

**Current State:** Factory only deploys standard SY

**Target State:** Factory can deploy SY or SYWithRewards

**Implementation Steps:**

1. **Add SYWithRewards class hash storage**:
   ```cairo
   // In Factory storage
   sy_with_rewards_class_hash: ClassHash,
   ```

2. **Add setter for SYWithRewards class hash**:
   ```cairo
   fn set_sy_with_rewards_class_hash(ref self: ContractState, class_hash: ClassHash) {
       self.ownable.assert_only_owner();
       self.sy_with_rewards_class_hash.write(class_hash);
   }
   ```

3. **Add deploy function for SYWithRewards**:
   ```cairo
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
       reward_tokens: Span<ContractAddress>,  // NEW: initial reward tokens
       salt: felt252,
   ) -> ContractAddress {
       // Similar to deploy_sy but uses sy_with_rewards_class_hash
       // and passes reward_tokens to constructor
   }
   ```

4. **Update IFactory interface**:
   ```cairo
   fn set_sy_with_rewards_class_hash(ref self: TContractState, class_hash: ClassHash);
   fn deploy_sy_with_rewards(
       ref self: TContractState,
       // ... params including reward_tokens ...
   ) -> ContractAddress;
   ```
   - File: `src/interfaces/i_factory.cairo`

**Validation:**
```bash
snforge test test_factory::test_deploy_sy_with_rewards
snforge test test_factory::test_set_sy_with_rewards_class_hash
```

---

### Phase 3 Summary

| Gap | Description | New Files | Modified Files |
|-----|-------------|-----------|----------------|
| 3.1 | SYComponent extraction | `src/components/sy_component.cairo` | `src/tokens/sy.cairo` |
| 3.2 | RewardManagerComponent | `src/components/reward_manager.cairo` | - |
| 3.3 | SYWithRewards contract | `src/tokens/sy_with_rewards.cairo`, `src/interfaces/i_sy_with_rewards.cairo` | - |
| 3.4 | Factory updates | - | `src/factory.cairo`, `src/interfaces/i_factory.cairo` |

**Key Benefits of Component Architecture:**

| Aspect | Before (Copy-paste) | After (Components) |
|--------|---------------------|-------------------|
| Code Reuse | Duplicate all SY logic | Compose SYComponent |
| Bug Fixes | Fix in multiple places | Fix once in component |
| Testing | Test entire contracts | Test components in isolation |
| Extensibility | Modify base code | Implement hooks |
| New Variants | Copy + modify | Compose + customize hooks |

**Validation (All Phase 3):**
```bash
# Existing tests must pass unchanged
snforge test test_sy

# New component tests
snforge test test_sy_component
snforge test test_reward_manager

# Integration tests
snforge test test_sy_with_rewards
snforge test test_factory::test_deploy_sy_with_rewards
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
Phase 1 (Multi-Token) ─┬─► Gap 1.1 (getTokensIn/Out) ✓ COMPLETE
                       ├─► Gap 1.2 (isValidToken) ✓ COMPLETE
                       └─► Gap 1.3 (assetInfo) ✓ COMPLETE

Phase 2 (Security) ────┬─► Gap 2.1 (Slippage) ✓ COMPLETE
                       ├─► Gap 2.2 (burnFromInternalBalance) ✓ COMPLETE
                       ├─► Gap 2.3 (Reentrancy) ✓ COMPLETE
                       └─► Gap 2.4 (Preview external) ✓ COMPLETE

Phase 3 (Rewards) ─────┬─► Gap 3.1 (SYComponent extraction)
                       │       ├─► Create src/components/sy_component.cairo
                       │       └─► Refactor src/tokens/sy.cairo to use component
                       │
                       ├─► Gap 3.2 (RewardManagerComponent)
                       │       └─► Create src/components/reward_manager.cairo
                       │
                       ├─► Gap 3.3 (SYWithRewards contract) ◄─ depends on 3.1, 3.2
                       │       ├─► Create src/interfaces/i_sy_with_rewards.cairo
                       │       └─► Create src/tokens/sy_with_rewards.cairo
                       │
                       └─► Gap 3.4 (Factory updates) ◄─ depends on 3.3
                               └─► Update src/factory.cairo

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

- `tests/test_sy.cairo` - **Keep unchanged** (validates component refactor is backward compatible)
- `tests/test_sy_component.cairo` - NEW: Component-level unit tests
- `tests/test_reward_manager.cairo` - NEW: RewardManager component tests
- `tests/test_sy_with_rewards.cairo` - NEW: Integration tests for SYWithRewards
- `tests/test_factory.cairo` - Extend with `test_deploy_sy_with_rewards`

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
