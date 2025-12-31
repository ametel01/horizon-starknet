# YT Interest System Implementation Plan

**Source:** `docs/PENDLE_GAP_ANALYSIS_REPORT.md` Section 1.2
**Scope:** Close gaps between Horizon YT and Pendle `InterestManagerYT`

---

## Current State

| Component | Location | Lines |
|-----------|----------|-------|
| YT Contract | `src/tokens/yt.cairo` | 1-722 |
| YT Interface | `src/interfaces/i_yt.cairo` | 1-52 |
| Interest calc | `yt.cairo:_update_user_interest()` | 696-720 |
| Interest claim | `yt.cairo:redeem_due_interest()` | 586-629 |

**Existing formula:** `interest = yt_balance × (curr_idx - user_idx) / user_idx`

---

## Phase 1: syReserve Tracking (MEDIUM)

**Goal:** Track expected SY balance for accurate accounting, detect floating SY.

### Step 1.1: Add Storage
```cairo
// yt.cairo:54 - add to Storage struct
sy_reserve: u256,  // Expected SY balance held by contract
```

### Step 1.2: Update on Mint
```cairo
// yt.cairo:mint_py() after line 368 (after transfer_from)
self.sy_reserve.write(self.sy_reserve.read() + amount_sy_to_mint);
```

### Step 1.3: Update on Redeem
```cairo
// yt.cairo:redeem_py() after line 445 (after transfer)
self.sy_reserve.write(self.sy_reserve.read() - amount_sy);

// yt.cairo:redeem_py_post_expiry() after line 527
self.sy_reserve.write(self.sy_reserve.read() - amount_sy);

// yt.cairo:redeem_due_interest() after line 609
self.sy_reserve.write(self.sy_reserve.read() - interest);
```

### Step 1.4: Add View Function
```cairo
// Add to IYT interface and YTImpl
fn sy_reserve(self: @ContractState) -> u256 {
    self.sy_reserve.read()
}

fn get_floating_sy(self: @ContractState) -> u256 {
    let sy = ISYDispatcher { contract_address: self.sy.read() };
    let actual = sy.balance_of(get_contract_address());
    let reserved = self.sy_reserve.read();
    if actual > reserved { actual - reserved } else { 0 }
}
```

### Validation
```bash
snforge test test_sy_reserve_tracking
```
- Mint 100 SY → syReserve = 100
- Redeem 50 PY → syReserve = 50
- Direct SY transfer → get_floating_sy() returns donation amount

---

## Phase 2: Interest Formula Parity (MEDIUM) **COMPLETE**

**Goal:** Match Pendle's normalized interest formula from `InterestManagerYT`.

### Current vs Target

```
Current:  interest = yt_balance × (curr_idx - user_idx) / user_idx
Pendle:   interest = yt_balance × (curr_idx - user_idx) / (user_idx × curr_idx)
```

**Why Pendle normalizes:** Division by `curr_idx` accounts for SY's increased value. The invariant is "totalSyRedeemable will not change over time" - you get fewer SY tokens, but each is worth more.

**Example** (100 YT, index 1.0 → 1.1 = 10% yield):
- Current: `100 × 0.1 / 1.0 = 10.0 SY`
- Pendle:  `100 × 0.1 / 1.1 = ~9.09 SY`

### Step 2.1: Update `_update_user_interest()`
```cairo
// yt.cairo:696-720 - replace interest calculation
fn _update_user_interest(ref self: ContractState, user: ContractAddress) {
    if user.is_zero() {
        return;
    }

    let current_index = self.py_index_stored.read();
    let user_index = self.user_py_index.read(user);
    let yt_balance = self.erc20.ERC20_balances.read(user);

    if user_index > 0 && yt_balance > 0 && current_index > user_index {
        // Pendle formula: interest = balance × (curr - prev) / (prev × curr)
        let index_diff = current_index - user_index;
        let denominator = wad_mul(user_index, current_index);
        let new_interest = wad_div(wad_mul(yt_balance, index_diff), denominator);

        let accrued = self.user_interest.read(user);
        self.user_interest.write(user, accrued + new_interest);
    }

    if current_index > 0 {
        self.user_py_index.write(user, current_index);
    }
}
```

### Step 2.2: Update `get_user_interest()` (view function)
```cairo
// yt.cairo:632-652 - same formula change
fn get_user_interest(self: @ContractState, user: ContractAddress) -> u256 {
    let current_index = self.py_index_current();
    let user_index = self.user_py_index.read(user);
    let yt_balance = self.erc20.ERC20_balances.read(user);
    let accrued = self.user_interest.read(user);

    if user_index == 0 || yt_balance == 0 {
        return accrued;
    }

    if current_index > user_index {
        // Pendle formula: interest = balance × (curr - prev) / (prev × curr)
        let index_diff = current_index - user_index;
        let denominator = wad_mul(user_index, current_index);
        let new_interest = wad_div(wad_mul(yt_balance, index_diff), denominator);
        accrued + new_interest
    } else {
        accrued
    }
}
```

### Validation
```bash
snforge test test_interest_formula_parity
```
Test case:
- Mint 100 YT at index 1.0e18
- Index rises to 1.1e18 (10% yield)
- Expected interest: `100e18 × 0.1e18 / 1.1e18 = ~9.09e18 SY`
- NOT `10e18 SY` (old formula)

### Migration Note
Existing users with accrued interest calculated under old formula retain that balance. New accruals use Pendle formula. No migration needed - slightly favorable to existing users.

---

## Phase 3: Post-Expiry Treasury (MEDIUM)

**Goal:** Redirect post-expiry yield to protocol treasury instead of locking it.

### Step 3.1: Add Storage
```cairo
// yt.cairo:54 - add to Storage struct
treasury: ContractAddress,
post_expiry_sy_for_treasury: u256,
```

### Step 3.2: Add Constructor Param
```cairo
// yt.cairo:constructor - add treasury param
treasury: ContractAddress,
// Store it
self.treasury.write(treasury);
```

### Step 3.3: Track Post-Expiry Interest
```cairo
// yt.cairo:_update_py_index() - replace current expiry handling
if self.is_expired() {
    let expiry_index = self.py_index_at_expiry.read();
    if expiry_index == 0 {
        self.py_index_at_expiry.write(current_index);
        self.py_index_stored.write(current_index);
    } else {
        // Calculate post-expiry yield accrual for treasury
        if current_index > expiry_index {
            let total_yt = self.erc20.ERC20_total_supply.read();
            let index_diff = current_index - expiry_index;
            let treasury_interest = wad_div(wad_mul(total_yt, index_diff), expiry_index);
            let current = self.post_expiry_sy_for_treasury.read();
            self.post_expiry_sy_for_treasury.write(current + treasury_interest);
        }
    }
    return;
}
```

### Step 3.4: Add Treasury Claim Function
```cairo
// New function in YTAdminImpl
fn redeem_post_expiry_interest_for_treasury(ref self: ContractState) -> u256 {
    self.access_control.assert_only_role(DEFAULT_ADMIN_ROLE);
    assert(self.is_expired(), Errors::YT_NOT_EXPIRED);

    let amount = self.post_expiry_sy_for_treasury.read();
    if amount == 0 { return 0; }

    self.post_expiry_sy_for_treasury.write(0);
    let sy = ISYDispatcher { contract_address: self.sy.read() };
    let treasury = self.treasury.read();
    assert(sy.transfer(treasury, amount), Errors::YT_INSUFFICIENT_SY);

    amount
}
```

### Validation
```bash
snforge test test_post_expiry_treasury
```
- Warp past expiry → yield continues accruing
- Call treasury claim → funds reach treasury address
- User claims zero post-expiry yield

---

## Phase 4: Protocol Fee on Interest (MEDIUM)

**Goal:** Deduct protocol fee from interest claims.

### Step 4.1: Add Storage
```cairo
// yt.cairo:54 - add to Storage struct
interest_fee_rate: u256,  // WAD-scaled (e.g., 0.03e18 = 3%)
```

### Step 4.2: Add Setter (Admin Only)
```cairo
// In YTAdminImpl
fn set_interest_fee_rate(ref self: ContractState, rate: u256) {
    self.access_control.assert_only_role(DEFAULT_ADMIN_ROLE);
    assert(rate <= 500000000000000000, Errors::INVALID_FEE_RATE); // max 50%
    self.interest_fee_rate.write(rate);
}
```

### Step 4.3: Modify Interest Claim
```cairo
// yt.cairo:redeem_due_interest() - replace lines 598-609
let interest = self.user_interest.read(user);
if interest == 0 {
    self.reentrancy_guard.end();
    return 0;
}
self.user_interest.write(user, 0);

// Apply fee
let fee_rate = self.interest_fee_rate.read();
let fee = wad_mul(interest, fee_rate);
let user_interest = interest - fee;

// Transfer to user
let sy = ISYDispatcher { contract_address: sy_addr };
assert(sy.transfer(user, user_interest), Errors::YT_INSUFFICIENT_SY);

// Transfer fee to treasury
if fee > 0 {
    let treasury = self.treasury.read();
    if !treasury.is_zero() {
        assert(sy.transfer(treasury, fee), Errors::YT_INSUFFICIENT_SY);
    }
}

// Update syReserve
self.sy_reserve.write(self.sy_reserve.read() - interest);
```

### Validation
```bash
snforge test test_interest_fee
```
- Set 3% fee, accrue 100 SY interest → user gets 97, treasury gets 3

---

## Phase 5: Optional Enhancements (LOW)

### 5.1: Same-Block Index Caching
```cairo
// Storage
last_index_block: u64,
cached_index: u256,

// In py_index_current()
let block = get_block_number();
if block == self.last_index_block.read() {
    return self.cached_index.read();
}
// ... compute index ...
self.last_index_block.write(block);
self.cached_index.write(computed_index);
```

### 5.2: Batch Operations
```cairo
fn mint_py_multi(
    ref self: ContractState,
    receivers: Array<ContractAddress>,
    amounts: Array<u256>,
) -> (Array<u256>, Array<u256>)

fn redeem_py_multi(
    ref self: ContractState,
    receivers: Array<ContractAddress>,
    amounts: Array<u256>,
) -> Array<u256>
```

### 5.3: Claim-on-Redeem Flag
```cairo
fn redeem_py_with_interest(
    ref self: ContractState,
    receiver: ContractAddress,
    amount_py: u256,
    redeem_interest: bool,
) -> (u256, u256)  // (sy_returned, interest_claimed)
```

---

## Interface Updates

Add to `src/interfaces/i_yt.cairo`:

```cairo
// Phase 1
fn sy_reserve(self: @TContractState) -> u256;
fn get_floating_sy(self: @TContractState) -> u256;

// Admin additions (Phases 2-3)
fn set_interest_fee_rate(ref self: TContractState, rate: u256);
fn redeem_post_expiry_interest_for_treasury(ref self: TContractState) -> u256;
```

---

## Factory Updates Required

The Factory (`src/factory.cairo`) must be updated to pass `treasury` to YT constructor:

```cairo
// In deploy_sy_pt_yt() - add treasury parameter or read from factory storage
```

---

## Error Codes to Add

```cairo
// src/libraries/errors.cairo
pub const INVALID_FEE_RATE: felt252 = 'Invalid fee rate';
```

---

## Test Files Required

| Test File | Covers |
|-----------|--------|
| `tests/test_yt_reserve.cairo` | Phase 1 - syReserve |
| `tests/test_yt_interest_formula.cairo` | Phase 2 - Formula parity |
| `tests/test_yt_treasury.cairo` | Phase 3 - Post-expiry treasury |
| `tests/test_yt_fees.cairo` | Phase 4 - Protocol fees |

---

## Implementation Order

1. **Phase 2** (formula parity) - pure logic change, no storage deps
2. **Phase 1** (syReserve) - foundational accounting
3. **Phase 3** (treasury) - depends on Phase 1 for accurate reserve
4. **Phase 4** (fees) - depends on treasury address from Phase 3
5. **Phase 5** (optimizations) - optional, after core is stable

---

## Non-Goals (Documented Divergence)

**Multi-Reward System:** Pendle supports GLP-style tokens with multiple reward tokens (ETH + esGMX, PENDLE emissions). Horizon tracks only SY appreciation as interest. This limits supported asset types but significantly reduces contract complexity and storage costs. If multi-reward is needed later, implement as a separate wrapper contract.
