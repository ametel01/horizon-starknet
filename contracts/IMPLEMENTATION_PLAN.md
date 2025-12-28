# Horizon Protocol: Implementation Plan for Spec Gaps

> Generated from SPEC.md analysis against current contracts and tests
> Date: 2025-12-29

## Executive Summary

This plan addresses gaps between the specification (SPEC.md) and current implementation. Gaps are categorized by priority and organized into actionable implementation steps with validation criteria.

---

## Priority Classification

| Priority | Description | Criteria |
|----------|-------------|----------|
| **P0** | Critical Security | Must fix before mainnet scale - potential fund loss |
| **P1** | High Security | Should fix before mainnet scale - attack vectors |
| **P2** | Spec Compliance | Features/tests explicitly called out in spec |
| **P3** | Hardening | Additional robustness improvements |

---

## Gap 1: AMM Math Fuzz Testing (P0)

**Source**: SPEC.md Section 15.1 - "AMM math fuzz testing: Not started"

**Current State**: Only happy-path unit tests exist in `tests/test_market_math_fp.cairo`

**Risk**: Math edge cases could cause panics, incorrect pricing, or fund extraction

### Implementation Steps

#### Step 1.1: Create fuzz test infrastructure **COMPLETE**
**File**: `tests/fuzz/fuzz_market_math.cairo`

```cairo
// Fuzz test targets:
// - calc_swap_exact_pt_for_sy with random inputs
// - calc_swap_exact_sy_for_pt with random inputs
// - calc_swap_sy_for_exact_pt with random inputs
// - calc_swap_pt_for_exact_sy with random inputs
// - get_exchange_rate with edge case proportions
// - binary search convergence with adversarial inputs
```

**Validation**:
- Run `snforge test test_fuzz --fuzzer-runs 10000`
- All tests pass without panics
- Output values within expected bounds (no negative amounts, no amounts > input)

#### Step 1.2: Add boundary condition tests **COMPLETE**
**File**: `tests/test_market_math_fp.cairo` (add new tests)

```cairo
// Add tests for:
#[test] fn test_exchange_rate_at_min_proportion() { ... }  // 0.1% PT
#[test] fn test_exchange_rate_at_max_proportion() { ... }  // 96% PT
#[test] fn test_binary_search_max_iterations() { ... }
#[test] fn test_binary_search_tolerance_edge() { ... }
#[test] fn test_swap_drains_entire_reserve() { ... }
#[test] fn test_swap_amount_equals_reserve() { ... }
```

**Validation**:
- Tests pass or fail with expected errors
- No panics from math overflow/underflow

#### Step 1.3: Add invariant tests **COMPLETE**
**File**: `tests/test_market_invariants.cairo`

```cairo
// Invariants to verify:
// 1. sy_reserve + pt_reserve > 0 after any operation (pool never empty)
// 2. total_lp >= MINIMUM_LIQUIDITY always
// 3. proportion always in [MIN_PROPORTION, MAX_PROPORTION] post-trade
// 4. exchange_rate >= WAD always (PT never worth more than SY)
// 5. fees never negative
// 6. output_amount <= input_amount (no free value)
```

**Validation**: Invariant assertions never fail across test suite

---

## Gap 2: Reentrancy Analysis on PT/YT/SY (P0)

**Source**: SPEC.md Section 10.3 - "Reentrancy on token contracts (PT/YT/SY don't have ReentrancyGuard)"

**Current State**:
- Router has `ReentrancyGuardComponent` ✓
- SY, PT, YT lack reentrancy protection ✗

**Risk**: Callback attacks during token transfers could manipulate state

### Implementation Steps

#### Step 2.1: Analyze attack vectors **COMPLETE**
**Task**: Document all external calls in token contracts

| Contract | Function | External Call | Verdict |
|----------|----------|---------------|---------|
| SY | deposit | `underlying.transfer_from` | `LOW RISK` - CEI violation; relies on trusted underlying |
| SY | redeem | `underlying.transfer` | `SAFE` - Burns before transfer |
| PT | mint/burn | None | `SAFE` - No external calls |
| YT | mint_py | `sy.transfer_from`, `pt.mint` | `SAFE` - State updated first |
| YT | redeem_py | `pt.burn`, `sy.transfer` | `SAFE` - Burns before transfer |
| YT | redeem_py_post_expiry | `pt.burn`, `sy.transfer` | `SAFE` - Burns before transfer |
| YT | redeem_due_interest | `sy.transfer` | `SAFE` - Interest cleared first |
| YT | transfer/transfer_from | None (oracle read only) | `SAFE` - Read-only external call |

**Validation**: Documented in `SECURITY.md` ✓

**Key Findings:**
1. SY.deposit has CEI violation but practical exploit requires malicious underlying token
2. YT operations follow CEI pattern correctly
3. PT has no external calls in state-changing functions
4. Router provides additional reentrancy protection for all user-facing operations

#### Step 2.2: Add reentrancy tests **COMPLETE**
**File**: `tests/test_reentrancy.cairo`

Created comprehensive test suite with 16 tests:
- `test_sy_deposit_normal_operation` - Basic deposit works
- `test_sy_deposit_reentrancy_safe` - CEI violation is safe with trusted underlying
- `test_sy_redeem_reentrancy_safe` - Burns before transfer (CEI pattern)
- `test_sy_redeem_insufficient_balance` - Reverts on insufficient balance
- `test_yt_mint_py_normal_operation` - Basic mint works
- `test_yt_mint_py_reentrancy_protected` - ReentrancyGuard active
- `test_yt_redeem_py_reentrancy_protected` - Burns before transfer
- `test_yt_redeem_due_interest_reentrancy_protected` - Interest cleared before transfer
- `test_yt_transfer_interest_update_order` - Interest snapshots before balance changes
- `test_pt_mint_no_external_calls` - No reentrancy vectors
- `test_pt_burn_no_external_calls` - No reentrancy vectors
- `test_pt_transfer_no_external_calls` - Standard ERC20, no reentrancy
- `test_sy_multiple_deposits_no_gaming` - Attack doesn't affect other users
- `test_sy_deposit_zero_reverts` - Zero amount reverts
- `test_sy_redeem_zero_reverts` - Zero amount reverts
- `test_yt_mint_py_zero_reverts` - Zero amount reverts

**Mock**: `src/mocks/mock_reentrant_token.cairo`
- ERC20 token with attack modes
- Attempts to call back during transfers
- Tracks attack callback count

**Validation**: All 16 tests pass ✓

#### Step 2.3: Add ReentrancyGuard to YT contract **COMPLETE**
**File**: `src/tokens/yt.cairo`

Added `ReentrancyGuardComponent` for defense-in-depth (analysis showed no critical vulnerability, but added for future-proofing):

```cairo
component!(path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent);

// Protected functions:
// - mint_py
// - redeem_py
// - redeem_py_post_expiry
// - redeem_due_interest
```

**Validation**: All 28 YT tests pass ✓, all 17 SY tests pass ✓

---

## Gap 3: Binary Search Large Trade Analysis (P1)

**Source**: SPEC.md Section 15.1 - "Binary search large trade analysis: Not started"

**Current State**: Binary search in `market_math_fp.cairo`:
- `BINARY_SEARCH_TOLERANCE = 1000` wei
- `BINARY_SEARCH_MAX_ITERATIONS = 64`
- No tests for edge cases

**Risk**: Very large trades might not converge or give poor prices

### Implementation Steps

#### Step 3.1: Add large trade tests
**File**: `tests/test_market_large_trades.cairo`

```cairo
#[test]
fn test_swap_10_percent_of_reserve() {
    // Swap amount = 10% of reserve
    // Verify: converges, reasonable price, no panic
}

#[test]
fn test_swap_50_percent_of_reserve() {
    // Swap amount = 50% of reserve
    // Verify: converges, high slippage warning implied
}

#[test]
fn test_swap_90_percent_of_reserve() {
    // Should fail or produce extreme slippage
}

#[test]
fn test_swap_exceeds_reserve() {
    // Must revert with MARKET_INSUFFICIENT_LIQUIDITY
}

#[test]
fn test_binary_search_convergence_time() {
    // Verify iteration count < MAX for normal trades
}
```

**Validation**:
- Large trades either succeed with correct math or fail gracefully
- No infinite loops or panics
- Gas costs remain reasonable

#### Step 3.2: Consider tolerance adjustment for large trades
**File**: `src/market/market_math_fp.cairo`

Evaluate if `BINARY_SEARCH_TOLERANCE` should scale with trade size:
```cairo
// Current: fixed 1000 wei tolerance
// Consider: tolerance = max(1000, amount / 10_000_000)
```

**Validation**: Document decision in code comments with rationale

---

## Gap 4: MINIMUM_LIQUIDITY Attack Vector Analysis (P1)

**Source**: SPEC.md Section 15.1 - "MINIMUM_LIQUIDITY attack vector analysis: Not started"

**Current State**:
- `MINIMUM_LIQUIDITY = 1000` wei locked on first deposit
- Lock sent to address(1) (dead address)

**Risk**: First depositor manipulation, LP token inflation attacks

### Implementation Steps

#### Step 4.1: Add first depositor attack tests
**File**: `tests/test_market_first_depositor.cairo`

```cairo
#[test]
fn test_first_deposit_minimum_liquidity_locked() {
    // Verify exactly MINIMUM_LIQUIDITY goes to dead address
}

#[test]
fn test_first_deposit_attack_mitigated() {
    // Attacker deposits 1 wei SY + 1 wei PT
    // Then "donates" to inflate share price
    // Second depositor should not lose funds
}

#[test]
fn test_minimum_liquidity_sufficient() {
    // With 1000 wei locked, verify max inflation attack damage
    // Document: if 1000 wei represents $X, attack profit bounded by $Y
}

#[test]
fn test_pool_cannot_be_drained_to_zero() {
    // After all LPs withdraw, MINIMUM_LIQUIDITY remains
    // Reserves remain proportionally
}
```

**Validation**:
- First depositor cannot steal from second depositor
- Documented maximum loss from inflation attack

#### Step 4.2: Document economic analysis
**File**: Update SPEC.md Section 10.3

Add analysis showing:
- With WAD-normalized LP tokens and 1000 wei minimum
- Maximum inflation attack profit
- Recommendation for MINIMUM_LIQUIDITY value

---

## Gap 5: YT Interest Calculation Tests (P2)

**Source**: SPEC.md Section 10.4 describes intentional design, but limited test coverage

**Current State**:
- `test_yt.cairo` has basic tests but lacks multi-user scenarios
- Interest formula: `interest = yt_balance * (current_index - user_index) / user_index`

### Implementation Steps

#### Step 5.1: Add comprehensive interest tests
**File**: `tests/test_yt_interest.cairo`

```cairo
#[test]
fn test_interest_accrual_single_user() {
    // Mint YT, increase index, verify interest calculation
}

#[test]
fn test_interest_accrual_multiple_users() {
    // User A mints at index 1.0
    // Index goes to 1.1
    // User B mints at index 1.1
    // Index goes to 1.2
    // User A should earn more than User B (by design per SPEC 10.4)
}

#[test]
fn test_interest_preserved_on_transfer() {
    // User A accrues interest
    // User A transfers YT to User B
    // User A's accrued interest should still be claimable
    // User B starts fresh from current index
}

#[test]
fn test_interest_after_partial_transfer() {
    // User has 100 YT, accrues 5 SY interest
    // User transfers 50 YT
    // User should still have 5 SY claimable (interest on original balance)
}

#[test]
fn test_interest_claim_at_expiry() {
    // Can claim interest right before expiry
    // Cannot claim more after expiry (YT worthless)
}

#[test]
fn test_zero_balance_no_interest() {
    // User with 0 YT cannot claim interest
}

#[test]
fn test_watermark_pattern_index_never_decreases() {
    // Even if oracle returns lower value, py_index_stored doesn't decrease
}
```

**Validation**: All interest calculations match SPEC.md Section 10.4 formula

---

## Gap 6: Oracle Edge Cases (P2)

**Source**: SPEC.md Section 5 describes PragmaIndexOracle behavior

**Current State**: `test_pragma_index_oracle.cairo` exists but limited edge case coverage

### Implementation Steps

#### Step 6.1: Add oracle edge case tests
**File**: `tests/test_pragma_index_oracle_edge.cairo`

```cairo
#[test]
fn test_staleness_check() {
    // Advance time past max_staleness
    // Oracle should revert or use stored index
}

#[test]
fn test_emergency_set_index_only_increases() {
    // Admin sets index to higher value: OK
    // Admin tries to decrease: should revert
}

#[test]
fn test_pause_returns_stored_index() {
    // Pause oracle
    // Call index() - should return stored value, not fetch
}

#[test]
fn test_dual_feed_mode() {
    // Set denominator_pair_id != 0
    // Verify ratio calculation
}

#[test]
fn test_zero_denominator_price() {
    // If denominator price is 0, should revert 'HZN: zero denom price'
}

#[test]
fn test_twap_window_minimum() {
    // set_config with window < MIN_TWAP_WINDOW (300s) should revert
}
```

**Validation**: Oracle behaves per SPEC.md Section 5.1

---

## Gap 7: Router YT Flash Swap Tests (P2)

**Source**: SPEC.md Section 4.1 describes YT trading patterns

**Current State**: `test_router.cairo` has basic tests but YT swaps need more coverage

### Implementation Steps

#### Step 7.1: Add YT swap tests
**File**: `tests/test_router_yt_swaps.cairo`

```cairo
#[test]
fn test_swap_exact_sy_for_yt_basic() {
    // Deposit SY, mint PT+YT, sell PT for SY, receive YT
}

#[test]
fn test_swap_exact_yt_for_sy_basic() {
    // Provide YT + SY collateral, buy PT, redeem PT+YT, receive SY
}

#[test]
fn test_swap_exact_sy_for_yt_slippage() {
    // Set min_yt_out too high, should revert
}

#[test]
fn test_swap_exact_yt_for_sy_insufficient_collateral() {
    // max_sy_collateral insufficient to buy PT, should revert
}

#[test]
fn test_yt_swap_near_expiry() {
    // Flash swap pattern should still work (or fail gracefully)
}

#[test]
fn test_yt_swap_after_expiry() {
    // Should revert - can't mint new PY after expiry
}
```

**Validation**: Flash swap patterns work per SPEC.md Section 4.1

---

## Gap 8: Time Decay Fee Tests (P2)

**Source**: SPEC.md Section 14.1 - "Zero fees at expiry"

**Current State**: Limited testing of fee decay

### Implementation Steps

#### Step 8.1: Add fee decay tests
**File**: `tests/test_market_fees.cairo`

```cairo
#[test]
fn test_full_fee_at_one_year() {
    // time_to_expiry >= SECONDS_PER_YEAR
    // adjusted_fee_rate == fee_rate
}

#[test]
fn test_half_fee_at_six_months() {
    // time_to_expiry = 6 months
    // adjusted_fee_rate ≈ fee_rate / 2
}

#[test]
fn test_zero_fee_at_expiry() {
    // time_to_expiry = 0
    // adjusted_fee_rate = 0
}

#[test]
fn test_fee_collection_by_owner() {
    // Owner can call collect_fees()
    // Non-owner cannot
}

#[test]
fn test_fee_accumulation_across_swaps() {
    // Multiple swaps accumulate fees
    // total_fees_collected increases
}
```

**Validation**: Fee math matches SPEC.md Section 14.1

---

## Gap 9: PT/YT Upgradeability Removal (P3)

**Source**: SPEC.md Section 10.2 - "Planned Change: Remove upgradeability from PT and YT"

**Current State**: PT and YT have `UpgradeableComponent` and `IUpgradeable` impl

**Note**: This is a planned future change, not an immediate gap

### Implementation Steps (Deferred)

When ready to make PT/YT non-upgradeable:

#### Step 9.1: Remove upgrade capability
**Files**: `src/tokens/pt.cairo`, `src/tokens/yt.cairo`

```cairo
// Remove:
component!(path: UpgradeableComponent, ...);
impl UpgradeableImpl of IUpgradeable { ... }
```

#### Step 9.2: Update documentation
**Files**: SPEC.md, CLAUDE.md

Document that PT/YT are now immutable for third-party integration safety.

**Validation**:
- `upgrade()` function no longer exists on PT/YT
- Existing PT/YT contracts can still be upgraded (before new class hash deployed)
- New PT/YT have no upgrade path

---

## Gap 10: Missing Error Handling Tests (P3)

**Current State**: Some error paths not tested

### Implementation Steps

#### Step 10.1: Add comprehensive error tests
**File**: `tests/test_errors.cairo`

```cairo
// Market errors
#[test] #[should_panic(expected: 'HZN: insufficient liquidity')]
fn test_swap_exceeds_liquidity() { ... }

#[test] #[should_panic(expected: 'HZN: transfer failed')]
fn test_swap_transfer_failure() { ... }

// Factory errors
#[test] #[should_panic(expected: 'HZN: invalid scalar')]
fn test_market_factory_invalid_scalar_root() { ... }

#[test] #[should_panic(expected: 'HZN: invalid anchor')]
fn test_market_factory_invalid_anchor() { ... }

#[test] #[should_panic(expected: 'HZN: invalid fee')]
fn test_market_factory_invalid_fee() { ... }

// PT errors
#[test] #[should_panic(expected: 'HZN: only deployer')]
fn test_pt_initialize_yt_not_deployer() { ... }

#[test] #[should_panic(expected: 'HZN: YT already set')]
fn test_pt_double_initialize() { ... }
```

**Validation**: All error messages in `libraries/errors.cairo` have test coverage

---

## Implementation Order

### Phase 1: Critical Security (P0) - Immediate
1. Gap 1: AMM Math Fuzz Testing
2. Gap 2: Reentrancy Analysis

### Phase 2: High Security (P1) - Before Beta
3. Gap 3: Binary Search Large Trade Analysis
4. Gap 4: MINIMUM_LIQUIDITY Attack Analysis

### Phase 3: Spec Compliance (P2) - Before Audit
5. Gap 5: YT Interest Calculation Tests
6. Gap 6: Oracle Edge Cases
7. Gap 7: Router YT Flash Swap Tests
8. Gap 8: Time Decay Fee Tests

### Phase 4: Hardening (P3) - Post-Audit
9. Gap 9: PT/YT Upgradeability Removal
10. Gap 10: Missing Error Handling Tests

---

## Validation Summary

After implementing all gaps, verify:

| Metric | Target |
|--------|--------|
| Unit test coverage | All public functions tested |
| Fuzz test runs | 10,000+ runs without panic |
| Invariant tests | All pass |
| Reentrancy tests | All attack vectors blocked |
| Error message coverage | 100% of defined errors |
| Gas benchmarks | Documented for all operations |

Run full validation:
```bash
cd contracts
snforge test                           # All unit tests
snforge test test_fuzz --fuzzer-runs 10000  # Fuzz tests
scarb fmt --check                      # Code style
```

---

## Files to Create/Modify

### New Files
- `tests/fuzz/fuzz_market_math.cairo`
- `tests/test_market_invariants.cairo`
- `tests/test_reentrancy.cairo`
- `tests/test_market_first_depositor.cairo`
- `tests/test_market_large_trades.cairo`
- `tests/test_yt_interest.cairo`
- `tests/test_pragma_index_oracle_edge.cairo`
- `tests/test_router_yt_swaps.cairo`
- `tests/test_market_fees.cairo`
- `tests/test_errors.cairo`
- `SECURITY.md` (reentrancy analysis documentation)

### Modified Files
- `tests/test_market_math_fp.cairo` (add boundary tests)
- `src/tokens/yt.cairo` (potential ReentrancyGuard addition)
- `SPEC.md` (update with analysis results)

### Mocks to Create
- `mocks/mock_reentrancy_attacker.cairo`
- `mocks/mock_failing_token.cairo` (for transfer failure tests)

---

## Success Criteria

This plan is complete when:

1. All P0 gaps have passing tests
2. Reentrancy analysis documented with verdicts
3. MINIMUM_LIQUIDITY attack analysis documented with max loss calculation
4. All P1/P2 gaps have passing tests
5. No panics in 10,000 fuzz test runs
6. External auditor can reference these tests for coverage assessment
