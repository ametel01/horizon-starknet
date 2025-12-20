# Frontend Update Plan

**Date:** December 2024
**Related Changes:** Security Audit Remediations, AMM Curve Implementation, Fixed-Point Library Integration
**Last Updated:** December 2024

---

## Implementation Progress

### Completed
| Item | File(s) | Description |
|------|---------|-------------|
| Deadline utility | `src/lib/deadline.ts` | Created `getDeadline()`, `isDeadlineExpired()`, `getDeadlineRemainingSeconds()` |
| Swap hooks | `src/hooks/useSwap.ts` | Added deadline to all 4 swap functions + `max_sy_collateral` to YT swap |
| Liquidity hooks | `src/hooks/useLiquidity.ts` | Added deadline to `add_liquidity`, `remove_liquidity` |
| Mint hook | `src/hooks/useMint.ts` | Added deadline to `mint_py_from_sy` |
| Redeem hook | `src/hooks/useRedeem.ts` | Added deadline to `redeem_py_to_sy`, `redeem_pt_post_expiry` |
| Transaction builder | `src/lib/transaction-builder.ts` | Added optional deadline param with auto-default to all builder functions |
| cairo-fp integration | `src/lib/math/fp.ts` | Created wrapper module for cairo-fp with WAD conversion utilities |
| AMM math update | `src/lib/math/amm.ts` | Updated to use cairo-fp for exp/ln calculations instead of BigNumber.js Taylor series |
| Paginated markets | `src/hooks/useMarkets.ts` | Added `fetchActiveMarketsPaginated()`, `fetchAllMarketsPaginated()`, `useAllMarketAddresses()` hooks |

### Remaining
- Phase 2: Math Precision (cairo-fp integration) - ✅ COMPLETED
- Phase 3: Production Readiness (pagination, pause status, error handling)
- Phase 4: UX Enhancements (deadline UI, fees display, events monitoring)

---

## Executive Summary

The security audit remediations and fixed-point library integration introduced several changes to the contract ABIs and math precision. The most impactful changes are:

1. **`deadline`** parameter added to all Router functions (breaking change)
2. **`max_sy_collateral`** parameter added to `swap_exact_yt_for_sy` (breaking change)
3. **Cubit 64.64 fixed-point library** integrated for high-precision math (I-08 now FIXED)

| Priority | Count | Status | Description |
|----------|-------|--------|-------------|
| Critical | 4 | ✅ 4/4 DONE | Breaking ABI changes requiring immediate fixes |
| High | 3 | ✅ 2/3 DONE | Math precision and functionality improvements |
| Medium | 3 | ⏳ 0/3 | UX enhancements and safety features |
| Low | 2 | ⏳ 0/2 | Optional improvements |

---

## Critical Updates (Breaking Changes)

### 1. Add Deadline Parameter to All Router Calls

**Status:** ✅ IMPLEMENTED
**Audit Reference:** M-06 - Router Deadline Protection

All 14 Router functions now require a `deadline: u64` parameter. The frontend must pass this parameter or transactions will fail.

**Files to Update:**

| File | Functions Affected |
|------|-------------------|
| `src/hooks/useSwap.ts` | `swap_exact_sy_for_pt`, `swap_exact_pt_for_sy`, `swap_exact_sy_for_yt`, `swap_exact_yt_for_sy` |
| `src/hooks/useLiquidity.ts` | `add_liquidity`, `remove_liquidity` |
| `src/hooks/useMint.ts` | `mint_py_from_sy` |
| `src/hooks/useRedeem.ts` | `redeem_py_to_sy`, `redeem_pt_post_expiry` |
| `src/lib/transaction-builder.ts` | `buildMintPyCall`, `buildRedeemPyToSyCall`, `buildRedeemPtPostExpiryCall` |

**Implementation:**

```typescript
// Add utility function in lib/constants/index.ts or new file lib/deadline.ts
export const DEFAULT_DEADLINE_SECONDS = 20 * 60; // 20 minutes

export function getDeadline(customSeconds?: number): bigint {
  const seconds = customSeconds ?? DEFAULT_DEADLINE_SECONDS;
  return BigInt(Math.floor(Date.now() / 1000) + seconds);
}
```

**Example Hook Update (useSwap.ts):**

```typescript
// Before
const swapCall = router.populate('swap_exact_sy_for_pt', [
  params.marketAddress,
  address,
  uint256.bnToUint256(params.amountIn),
  uint256.bnToUint256(params.minAmountOut),
]);

// After
import { getDeadline } from '@/lib/deadline';

const swapCall = router.populate('swap_exact_sy_for_pt', [
  params.marketAddress,
  address,
  uint256.bnToUint256(params.amountIn),
  uint256.bnToUint256(params.minAmountOut),
  getDeadline(), // deadline: u64
]);
```

---

### 2. Update swap_exact_yt_for_sy Call Signature

**Status:** ✅ IMPLEMENTED
**Audit Reference:** H-01 - YT Swap Collateral Parameter

The `swap_exact_yt_for_sy` function now requires a `max_sy_collateral` parameter.

**File:** `src/hooks/useSwap.ts` (lines 116-145)

**Current (Broken):**
```typescript
const swapCall = router.populate('swap_exact_yt_for_sy', [
  params.ytAddress,
  params.marketAddress,
  address,
  uint256.bnToUint256(params.amountIn),
  uint256.bnToUint256(params.minAmountOut),
]);
```

**Updated:**
```typescript
// Calculate max collateral - use 4x multiplier for safety margin
const maxSyCollateral = params.amountIn * BigInt(4);

const swapCall = router.populate('swap_exact_yt_for_sy', [
  params.ytAddress,           // yt
  params.marketAddress,       // market
  address,                    // receiver
  uint256.bnToUint256(params.amountIn),          // exact_yt_in
  uint256.bnToUint256(maxSyCollateral),          // max_sy_collateral (NEW)
  uint256.bnToUint256(params.minAmountOut),      // min_sy_out
  getDeadline(),              // deadline (NEW)
]);
```

**Note:** Consider adding `maxSyCollateral` to the `SwapParams` interface for user control.

---

### 3. Update transaction-builder.ts for Deadline Parameter

**Status:** ✅ IMPLEMENTED

**File:** `src/lib/transaction-builder.ts`

Update these functions to include deadline:

```typescript
// buildMintPyCall - lines 97-118
export function buildMintPyCall(
  routerAddress: string,
  ytAddress: string,
  receiver: string,
  amountSy: bigint,
  minPyOut: bigint,
  deadline: bigint  // NEW PARAMETER
): Call {
  const u256AmountSy = uint256.bnToUint256(amountSy);
  const u256MinPy = uint256.bnToUint256(minPyOut);
  return {
    contractAddress: routerAddress,
    entrypoint: 'mint_py_from_sy',
    calldata: [
      ytAddress,
      receiver,
      u256AmountSy.low,
      u256AmountSy.high,
      u256MinPy.low,
      u256MinPy.high,
      deadline.toString(),  // NEW - deadline: u64
    ],
  };
}

// buildRedeemPyToSyCall - lines 124-138
export function buildRedeemPyToSyCall(
  routerAddress: string,
  ytAddress: string,
  receiver: string,
  amount: bigint,
  minSyOut: bigint,
  deadline: bigint  // NEW PARAMETER
): Call

// buildRedeemPtPostExpiryCall - lines 144-158
export function buildRedeemPtPostExpiryCall(
  routerAddress: string,
  ytAddress: string,
  receiver: string,
  amount: bigint,
  minSyOut: bigint,
  deadline: bigint  // NEW PARAMETER
): Call
```

---

### 4. Update Hook Interfaces for Deadline

**Status:** ✅ IMPLEMENTED

**Files:**
- `src/hooks/useMint.ts`: Add deadline to `buildMintCalls`
- `src/hooks/useSimpleDeposit.ts`: Pass deadline through builder (auto via transaction-builder)
- `src/hooks/useSimpleWithdraw.ts`: Pass deadline through builder (auto via transaction-builder)

---

## High Priority Updates

### 5. Integrate cairo-fp JavaScript Utilities for Math Precision

**Status:** ✅ IMPLEMENTED
**Audit Reference:** I-08 - Fixed-Point Library (NOW FIXED)

The contracts now use **cubit 64.64 fixed-point format** internally (via `cairo-fp`) with WAD (10^18) external interfaces. The frontend should use the matching JS utilities for maximum precision.

**Current Frontend Math:** Uses BigNumber.js with Taylor series approximations for `exp`/`ln`.

**Recommended:** Use `cairo-fp` JS utilities which match the on-chain calculations exactly.

**Implementation:**

```bash
# Install cairo-fp JS utilities
bun add cairo-fp
# OR copy from /Users/ametel/source/cairo-fp/src/f128/utils.js
```

```typescript
// New: src/lib/math/fp.ts
import f128 from 'cairo-fp/src/f128/utils.js';

/**
 * Convert WAD (10^18) to cubit Fixed (64.64) format
 * This matches the on-chain wad_to_fp() function in math_fp.cairo
 */
export function wadToFixed(wadValue: bigint): { mag: bigint; sign: boolean } {
  if (wadValue === 0n) {
    return { mag: 0n, sign: false };
  }
  // cubit ONE = 2^64 = 18446744073709551616
  const CUBIT_ONE = 18446744073709551616n;
  const WAD = 1000000000000000000n;
  const result = (wadValue * CUBIT_ONE) / WAD;
  return { mag: result, sign: false };
}

/**
 * Convert cubit Fixed (64.64) to WAD (10^18)
 * This matches the on-chain fp_to_wad() function in math_fp.cairo
 */
export function fixedToWad(fixed: { mag: bigint; sign: boolean }): bigint {
  if (fixed.mag === 0n) {
    return 0n;
  }
  const CUBIT_ONE = 18446744073709551616n;
  const WAD = 1000000000000000000n;
  return (fixed.mag * WAD) / CUBIT_ONE;
}

// Use cairo-fp for exp/ln calculations
export function expWad(x: bigint): bigint {
  const xFloat = Number(x) / 1e18;
  const result = f128.exp(xFloat);
  return BigInt(Math.floor(f128.fromFixed(result) * 1e18));
}

export function lnWad(x: bigint): { value: bigint; isNegative: boolean } {
  const xFloat = Number(x) / 1e18;
  const result = f128.ln(xFloat);
  return {
    value: BigInt(Math.floor(Math.abs(f128.fromFixed(result)) * 1e18)),
    isNegative: result.sign,
  };
}
```

**Update `src/lib/math/amm.ts`:** Replace BigNumber.js Taylor series with cairo-fp utilities:

```typescript
// Before (current implementation)
export function lnBigNumber(x: BigNumber): BigNumber {
  // ~100 line Taylor series implementation
}

// After (using cairo-fp)
import f128 from 'cairo-fp/src/f128/utils.js';

export function lnBigNumber(x: BigNumber): BigNumber {
  const result = f128.ln(x.toNumber());
  return new BigNumber(f128.fromFixed(result));
}

export function expBigNumber(x: BigNumber): BigNumber {
  const result = f128.exp(x.toNumber());
  return new BigNumber(f128.fromFixed(result));
}
```

---

### 6. Use Paginated Market Fetching

**Status:** ✅ IMPLEMENTED
**Audit Reference:** L-04 - Gas Exhaustion Prevention

**File:** `src/hooks/useMarkets.ts` (lines 175-246)

Replace `get_all_markets()` with `get_active_markets_paginated()` for production:

```typescript
// Current (will exhaust gas with many markets)
const result = await marketFactory.get_all_markets();

// Recommended
const PAGE_SIZE = 20;
let allAddresses: string[] = [];
let offset = 0;
let hasMore = true;

while (hasMore) {
  const [addresses, more] = await marketFactory.get_active_markets_paginated(offset, PAGE_SIZE);
  allAddresses = [...allAddresses, ...addresses];
  hasMore = more;
  offset += PAGE_SIZE;
}
```

---

### 7. Add Pause Status Checking

**Status:** Recommended for Production
**Audit Reference:** M-03 - Pausability Implementation

All core contracts now implement `IPausable` with `is_paused()`. The frontend should check pause status.

**Implementation:**

```typescript
// New hook: src/hooks/usePauseStatus.ts
export function usePauseStatus(contractAddress: string) {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['pauseStatus', contractAddress],
    queryFn: async () => {
      const contract = new Contract(PAUSABLE_ABI, contractAddress, provider);
      return contract.is_paused();
    },
    staleTime: 10000,
  });
}

// Usage in forms
const { data: isPaused } = usePauseStatus(routerAddress);

if (isPaused) {
  return <Alert variant="warning">Protocol is currently paused for maintenance</Alert>;
}
```

---

## Medium Priority Updates

### 8. Add Deadline Settings to UI

**Status:** UX Enhancement

Add user-configurable deadline settings:

```typescript
// New: src/contexts/settings-context.tsx
interface TransactionSettings {
  slippageBps: number;      // Default: 50 (0.5%)
  deadlineMinutes: number;  // Default: 20
}

// UI in settings or swap form
<DeadlineSelector
  value={settings.deadlineMinutes}
  onChange={(minutes) => updateSettings({ deadlineMinutes: minutes })}
  options={[5, 10, 20, 30, 60]}
/>
```

---

### 9. Display Fees Information

**Status:** UX Enhancement
**Audit Reference:** I-07 - Fee Collection Mechanism

New Market ABI includes `get_total_fees_collected()`. Display this in market stats.

**File:** `src/hooks/useMarket.ts` or `src/components/markets/MarketCard.tsx`

```typescript
// Fetch fees collected
const feesCollected = await market.get_total_fees_collected();

// Display in UI
<StatItem label="Fees Collected" value={formatSy(feesCollected)} />
```

---

### 10. Handle Improved Error Messages

**Status:** UX Enhancement
**Audit Reference:** I-01 - Standardized Error Prefixes

All errors now use "HZN:" prefix. Update error parsing:

```typescript
// src/lib/errors.ts
export function parseContractError(error: unknown): string {
  const message = String(error);

  // Match HZN: prefixed errors
  const hznMatch = message.match(/HZN:[\w_]+/);
  if (hznMatch) {
    return formatErrorCode(hznMatch[0]);
  }

  return 'An unexpected error occurred';
}

const ERROR_MESSAGES: Record<string, string> = {
  'HZN:DEADLINE_EXCEEDED': 'Transaction deadline exceeded. Please try again.',
  'HZN:SLIPPAGE_EXCEEDED': 'Price moved beyond slippage tolerance.',
  'HZN:PAUSED': 'This operation is currently paused.',
  'HZN:MATH_OVERFLOW': 'Calculation overflow - try a smaller amount.',
  'HZN:MATH_DIVISION_BY_ZERO': 'Invalid calculation - division by zero.',
  // ... add more as needed
};
```

---

## Low Priority Updates

### 11. Add Market Events Monitoring

**Status:** Optional Enhancement
**Audit Reference:** L-02 - ImpliedRateUpdated Event

New events available for monitoring:
- `ImpliedRateUpdated(old_rate, new_rate, timestamp)`
- `FeesCollected(collector, receiver, amount)`

Could be used for:
- Real-time rate change notifications
- Transaction history display
- Analytics dashboards

---

### 12. PT/YT Token Naming

**Status:** Informational
**Audit Reference:** I-06 - Token Name Derivation

PT and YT tokens now derive names from SY symbol (e.g., "PT-nstSTRK", "YT-nstSTRK"). The frontend already fetches token metadata, no changes needed unless hardcoded names exist.

---

## Fixed-Point Library Technical Details

### On-Chain Implementation (math_fp.cairo)

The contracts now use **cubit 64.64 fixed-point format** internally:

```
Internal: Fixed { mag: u128, sign: bool } where value = mag / 2^64
External: WAD (u256) where value = amount / 10^18
```

**Key Functions:**
- `wad_to_fp(wad_value)` - Converts WAD to Fixed: `wad_value * 2^64 / 10^18`
- `fp_to_wad(fp_value)` - Converts Fixed to WAD: `fp_value.mag * 10^18 / 2^64`
- `exp_wad(x)` - Calculates e^x using cubit's exp
- `ln_wad(x)` - Calculates ln(x) using cubit's ln
- `pow_wad(base, exp)` - Calculates base^exp using cubit's pow
- `sqrt_wad(x)` - Calculates sqrt(x) using cubit's sqrt

**Precision:** ~19 decimal digits via 64-bit fractional part.

### Frontend Matching (cairo-fp JS utilities)

The `cairo-fp` package provides JS utilities that match the Cairo implementation:

```javascript
import f128 from 'cairo-fp/src/f128/utils.js';

// Convert JS number to Fixed { mag, sign }
f128.toFixed(3.14159)  // { mag: 57952155664616982739n, sign: false }

// Convert Fixed back to JS number
f128.fromFixed({ mag: 57952155664616982739n, sign: false })  // 3.14159

// Math functions matching on-chain
f128.exp(0.1)   // e^0.1
f128.ln(2.0)    // ln(2)
f128.pow(2, 10) // 2^10
f128.sqrt(2)    // sqrt(2)
```

### AMM Math Constants (market_math_fp.cairo)

| Constant | Value | Description |
|----------|-------|-------------|
| `SECONDS_PER_YEAR` | 31,536,000 | 365 * 24 * 60 * 60 |
| `MAX_LN_IMPLIED_RATE` | 4.6 WAD | ~10000% APY cap |
| `MIN_PROPORTION` | 0.001 WAD | 0.1% minimum |
| `MAX_PROPORTION` | 0.96 WAD | 96% maximum (Pendle limit) |
| `MINIMUM_LIQUIDITY` | 1000 | First LP attack protection |
| `BINARY_SEARCH_TOLERANCE` | 1000 wei | Swap calculation precision |
| `BINARY_SEARCH_MAX_ITERATIONS` | 64 | Convergence limit |

---

## Implementation Checklist

### Phase 1: Critical Fixes (Must Do)
- [x] Create `lib/deadline.ts` utility
- [x] Update `useSwap.ts` - add deadline to all swap calls
- [x] Update `useSwap.ts` - add `max_sy_collateral` to `swap_exact_yt_for_sy`
- [x] Update `useLiquidity.ts` - add deadline to liquidity calls
- [x] Update `useMint.ts` - add deadline to mint call
- [x] Update `useRedeem.ts` - add deadline to redeem calls
- [x] Update `transaction-builder.ts` - add deadline to all builder functions
- [x] Update `useSimpleDeposit.ts` - pass deadline through builder
- [x] Update `useSimpleWithdraw.ts` - pass deadline through builder
- [x] Run `bun run check` to verify type safety
- [ ] Test all transaction flows on devnet

### Phase 2: Math Precision (Recommended)
- [x] Install/integrate `cairo-fp` JS utilities
- [x] Create `lib/math/fp.ts` wrapper module
- [x] Update `lib/math/amm.ts` to use cairo-fp for exp/ln
- [ ] Verify swap quote calculations match on-chain
- [ ] Test precision with edge cases

### Phase 3: Production Readiness
- [x] Implement paginated market fetching
- [ ] Add pause status checking
- [ ] Update error message parsing

### Phase 4: UX Enhancements
- [ ] Add deadline settings UI
- [ ] Display fees information
- [ ] Add market events monitoring (optional)

---

## Testing Requirements

1. **Unit Tests:** Update any existing tests for hooks
2. **Integration Tests:** Verify all Router calls work with new parameters
3. **Precision Tests:** Compare frontend swap quotes with on-chain results
4. **E2E Tests:** Test complete flows (deposit, swap, withdraw)
5. **Error Cases:** Test deadline exceeded, pause status, slippage errors

---

## ABI Reference

The new generated ABIs are in `src/types/generated/`. Key changes:

| Contract | New Functions/Parameters |
|----------|-------------------------|
| Router | All functions have `deadline: u64` parameter |
| Router | `swap_exact_yt_for_sy` has `max_sy_collateral: u256` |
| MarketFactory | `get_markets_paginated(offset, limit)` |
| MarketFactory | `get_active_markets_paginated(offset, limit)` |
| Market | `get_total_fees_collected()` |
| Market | `collect_fees(receiver)` (admin only) |
| Market | `ImpliedRateUpdated` event |
| Market | `FeesCollected` event |
| All | `is_paused()` via IPausable |

---

## Security Audit Status Update

| ID | Status | Notes |
|----|--------|-------|
| I-08 | **NOW FIXED** | Cubit 64.64 fixed-point library integrated via cairo-fp |

The protocol now uses a production-ready fixed-point math library with ~19 decimal digits of precision, matching Pendle's LogExpMath.sol precision requirements.
