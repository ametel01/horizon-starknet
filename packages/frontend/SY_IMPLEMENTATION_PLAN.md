# SY Frontend Implementation Plan

> **Created:** 2025-12-31
> **Source:** `SY_FRONTEND_ANALYSIS.md`
> **Status:** Ready for implementation

---

## Overview

The SY contracts have breaking changes. Frontend calls will fail until these fixes are applied.

**Blockers:** Tasks 1-6 must complete before any SY deposit/redeem works.

---

## Phase 1: Breaking Changes (Required)

### Task 1: Update `buildDepositToSyCall()` **COMPLETE**

**File:** `src/shared/starknet/transaction-builder.ts:86-93`
**Source:** Lines 136-174

**Change:**
```typescript
// FROM: 3 params (receiver, amount.low, amount.high)
// TO: 5 params (receiver, amount.low, amount.high, minOut.low, minOut.high)
```

**Steps:**
1. Add `minSharesOut: bigint` parameter to function signature
2. Convert to uint256: `uint256.bnToUint256(minSharesOut)`
3. Append `.low` and `.high` to calldata array

**Validation:** Unit test generates 5-element calldata array

---

### Task 2: Update `buildUnwrapSyCall()` **COMPLETE**

**File:** `src/shared/starknet/transaction-builder.ts:189-196`
**Source:** Lines 176-216

**Change:**
```typescript
// FROM: 3 params (receiver, amount.low, amount.high)
// TO: 6 params (receiver, amount.low, amount.high, minOut.low, minOut.high, burnFromInternal)
```

**Steps:**
1. Add `minTokenOut: bigint` parameter
2. Add `burnFromInternalBalance = false` parameter
3. Convert minTokenOut to uint256
4. Append minOut `.low`, `.high`, and bool as `'0x0'` or `'0x1'`

**Validation:** Unit test generates 6-element calldata array

---

### Task 3: Update `useWrapToSy` hook **COMPLETE**

**File:** `src/features/earn/model/useWrapToSy.ts:91-102`
**Source:** Lines 218-259

**Steps:**
1. Import `useTransactionSettings` from `@features/tx-settings`
2. Extract `slippageBps` from settings
3. Calculate `minSharesOut = calculateMinOutput(amountWad, slippageBps)`
4. Update calldata to include minOut uint256

**Validation:** Wrap transaction succeeds on devnet

---

### Task 4: Update `useUnwrapSy` hook **COMPLETE**

**File:** `src/features/redeem/model/useUnwrapSy.ts:63-73`
**Source:** Lines 261-303

**Steps:**
1. Import `useTransactionSettings` from `@features/tx-settings`
2. Extract `slippageBps` from settings
3. Calculate `minTokenOut = calculateMinOutput(amountWad, slippageBps)`
4. Update calldata with minOut uint256 + `'0x0'` for burnFromInternal

**Validation:** Unwrap transaction succeeds on devnet

---

### Task 5: Update `buildDepositAndEarnCalls()` **COMPLETE**

**File:** `src/shared/starknet/transaction-builder.ts:228-229`
**Source:** Lines 305-318

**Steps:**
1. Calculate `minSyOut = calculateMinOutput(amount, slippageBps)`
2. Pass `minSyOut` to `buildDepositToSyCall()`

**Validation:** Full deposit+earn flow succeeds

---

### Task 6: Update `buildWithdrawCalls()` **COMPLETE**

**File:** `src/shared/starknet/transaction-builder.ts:303-304`
**Source:** Lines 320-333

**Steps:**
1. Calculate `minUnderlyingOut = calculateMinOutput(minSyOut, slippageBps)`
2. Pass `minUnderlyingOut` and `false` to `buildUnwrapSyCall()`

**Validation:** Full withdraw flow succeeds

---

### Task 7: Add error messages **COMPLETE**

**File:** `src/shared/lib/errors.ts`
**Source:** Lines 673-699

**Add to `CONTRACT_ERROR_MESSAGES`:**
```typescript
'HZN: insufficient shares out': 'Slippage exceeded on wrap. Try increasing slippage tolerance.',
'HZN: insufficient token out': 'Slippage exceeded on unwrap. Try increasing slippage tolerance.',
'Pausable: paused': 'This token is temporarily paused. Withdrawals are still available.',
```

**Validation:** Slippage error shows user-friendly message

---

## Phase 2: SYWithRewards Support

### Task 8: Add contract helper

**File:** `src/shared/starknet/contracts.ts` (create type + function)
**Source:** Lines 341-355

**Steps:**
1. Import `SYWITHREWARDS_ABI` from `@/types/generated`
2. Add `TypedSYWithRewards` type alias
3. Add `getSYWithRewardsContract()` function

---

### Task 9: Create rewards feature module

**Directory:** `src/features/rewards/`
**Source:** Lines 357-475

**Files to create:**
1. `model/useRewardTokens.ts` - Fetch reward token addresses (source lines 357-389)
2. `model/useAccruedRewards.ts` - Fetch pending rewards (source lines 391-421)
3. `model/useClaimRewards.ts` - Claim mutation (source lines 423-466)
4. `index.ts` - Public exports (source lines 469-474)

**Validation:** `useRewardTokens` returns array on SYWithRewards contract

---

## Phase 3: Enhanced Features (Optional)

### Task 10: Add preview hooks

**Source:** Lines 480-518

**Files:**
- `src/features/yield/model/useSyPreview.ts` - Preview deposit/redeem outputs

**Use case:** More accurate slippage calculation

---

### Task 11: Add validation hooks

**Source:** Lines 520-557

**Files:**
- `src/features/yield/model/useSyTokenValidation.ts` - Token validity check

**Use case:** Pre-flight validation before transactions

---

### Task 12: Add asset info hook

**Source:** Lines 559-609

**Files:**
- `src/features/yield/model/useSyAssetInfo.ts` - Asset type and metadata

**Use case:** Display Token vs Liquidity badge in UI

---

### Task 13: Add pause state hook

**Source:** Lines 701-732

**Files:**
- `src/features/yield/model/useSyPauseState.ts` - Check if contract paused

**Use case:** Disable deposit buttons when paused

---

### Task 14: Add watermark hook

**Source:** Lines 612-667

**Files:**
- `src/features/yield/model/useSyWatermark.ts` - Negative yield detection

**Use case:** Warning indicator when underlying asset lost value

---

## Validation Checklist

After Phase 1 complete:
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun run test` passes
- [ ] Wrap transaction succeeds on devnet
- [ ] Unwrap transaction succeeds on devnet
- [ ] Slippage error shows friendly message

After Phase 2 complete:
- [ ] `useRewardTokens` fetches reward tokens
- [ ] `useAccruedRewards` returns amounts
- [ ] Claim transaction succeeds

---

## ABI Reference

Verified method signatures in generated types:

| Method | Location | Params |
|--------|----------|--------|
| `deposit` | SY.ts:237 | receiver, amount, **min_shares_out** |
| `redeem` | SY.ts:261 | receiver, amount, **min_token_out**, **burn_from_internal** |
| `is_paused` | SYWithRewards.ts:679 | none |
| `get_reward_tokens` | SYWithRewards.ts:419 | none |
| `claim_rewards` | SYWithRewards.ts:430 | user |
| `accrued_rewards` | SYWithRewards.ts:446 | user |

---

## Decision Context

- `burn_from_internal_balance = false` for all direct user calls (only Router uses `true`)
- Slippage comes from existing `useTransactionSettings` hook
- Phase 3 tasks are optional enhancements, not blockers
