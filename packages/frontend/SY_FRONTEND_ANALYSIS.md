# SY Frontend Impact Analysis

> **Date:** 2025-12-30
> **Status:** Living Document
> **Scope:** Frontend changes required after Phase 1 & 2 SY Contract Updates
> **Related:** `/contracts/SY_GAP_DEVELOPMENT_PLAN.md`

---

## Executive Summary

⚠️ **BREAKING CHANGE: Phase 2 is now implemented.** The `deposit` and `redeem` method signatures have **changed**. The frontend is currently **out of sync** with the contract ABI.

**Immediate action required:**
1. Update `buildDepositToSyCall()` to pass `min_shares_out`
2. Update `buildUnwrapSyCall()` to pass `min_token_out` and `burn_from_internal_balance`
3. Wire slippage settings from `useTransactionSettings` into wrap/unwrap flows

**Good news:** The slippage infrastructure already exists (`calculateMinOutput`, `slippageBps` context).

### Impact Matrix

| Contract Change | Frontend Impact | Action Required | Status |
|----------------|-----------------|-----------------|--------|
| `get_tokens_in()` added | None (new capability) | Optional enhancement | ⏳ Optional |
| `get_tokens_out()` added | None (new capability) | Optional enhancement | ⏳ Optional |
| `is_valid_token_in(token)` added | None (new capability) | **Recommended** for validation | ⏳ Optional |
| `is_valid_token_out(token)` added | None (new capability) | **Recommended** for validation | ⏳ Optional |
| `asset_info()` added | None (new capability) | Optional for UI | ⏳ Optional |
| `AssetType` enum added | Type generation updated | Already done via codegen | ✅ Done |
| `preview_deposit()` added | None (new capability) | **Recommended** for accurate slippage | ⏳ Optional |
| `preview_redeem()` added | None (new capability) | **Recommended** for accurate slippage | ⏳ Optional |
| **`deposit()` signature** | **BREAKING** | **REQUIRED** - add `min_shares_out` | ❌ Needs Update |
| **`redeem()` signature** | **BREAKING** | **REQUIRED** - add `min_token_out`, `burn_from_internal_balance` | ❌ Needs Update |

---

## Phase 2 Breaking Changes (ACTIVE)

Phase 2 has been implemented. The following signature changes **break the current frontend**.

### New `deposit()` Signature

```cairo
// OLD (frontend currently uses)
fn deposit(receiver, amount_shares_to_deposit) -> u256

// NEW (contract now requires)
fn deposit(
  receiver: ContractAddress,
  amount_shares_to_deposit: u256,
  min_shares_out: u256,           // NEW: slippage protection
) -> u256
```

### New `redeem()` Signature

```cairo
// OLD (frontend currently uses)
fn redeem(receiver, amount_sy_to_redeem) -> u256

// NEW (contract now requires)
fn redeem(
  receiver: ContractAddress,
  amount_sy_to_redeem: u256,
  min_token_out: u256,            // NEW: slippage protection
  burn_from_internal_balance: bool, // NEW: Router pattern support
) -> u256
```

### New Preview Functions (for accurate slippage calculation)

```typescript
// View functions to preview output before executing
preview_deposit(amount_to_deposit: u256) -> u256;  // Returns expected SY shares
preview_redeem(amount_sy: u256) -> u256;           // Returns expected underlying
```

---

## Phase 1 Contract Changes (Non-Breaking)

### New ISY Methods

```typescript
// New methods available in SY_ABI
interface ISY {
  // CHANGED in Phase 2
  deposit(receiver, amount_shares_to_deposit, min_shares_out): u256;
  redeem(receiver, amount_sy_to_redeem, min_token_out, burn_from_internal_balance): u256;

  // Unchanged
  exchange_rate(): u256;
  underlying_asset(): ContractAddress;

  // NEW in Phase 1
  get_tokens_in(): Span<ContractAddress>;      // List of valid deposit tokens
  get_tokens_out(): Span<ContractAddress>;     // List of valid redeem tokens
  is_valid_token_in(token: ContractAddress): bool;   // Validate deposit token
  is_valid_token_out(token: ContractAddress): bool;  // Validate redeem token
  asset_info(): (AssetType, ContractAddress, u8);    // Type, underlying, decimals

  // NEW in Phase 2
  preview_deposit(amount_to_deposit: u256): u256;
  preview_redeem(amount_sy: u256): u256;
}
```

### New Type: AssetType

```typescript
// From SY_ABI
enum AssetType {
  Token,     // Regular ERC20 (e.g., wstETH, sSTRK)
  Liquidity, // LP tokens (e.g., Curve LP, Ekubo LP)
}
```

---

## Current Frontend SY Usage

### Files Using SY Contract

| File | SY Methods Used | Purpose |
|------|-----------------|---------|
| `src/features/earn/model/useWrapToSy.ts` | `deposit()` | Wrap underlying → SY |
| `src/features/redeem/model/useUnwrapSy.ts` | `redeem()` | Unwrap SY → underlying |
| `src/features/yield/model/useUnderlying.ts` | `underlying_asset()` | Fetch underlying address |
| `src/features/yield/model/useApyBreakdown.ts` | `exchange_rate()` | APY calculations |
| `src/shared/starknet/transaction-builder.ts` | `deposit()`, `redeem()` | Build multicalls |
| `src/features/protocol-status/model/usePauseStatus.ts` | `is_paused()` | Pause monitoring |
| `src/shared/starknet/contracts.ts` | Factory function | `getSYContract()` |

### Current Call Signatures (Frontend) ❌ BROKEN

**Wrap (Deposit):** `src/features/earn/model/useWrapToSy.ts:91-102`
```typescript
// ❌ OLD: SY.deposit(receiver, amount) - MISSING min_shares_out
calls.push({
  contractAddress: syAddress,
  entrypoint: 'deposit',
  calldata: [userAddress, u256Amount.low, u256Amount.high],
});
```

**Unwrap (Redeem):** `src/features/redeem/model/useUnwrapSy.ts:63-73`
```typescript
// ❌ OLD: SY.redeem(receiver, amount) - MISSING min_token_out, burn_from_internal_balance
calls.push({
  contractAddress: syAddress,
  entrypoint: 'redeem',
  calldata: [userAddress, u256Amount.low, u256Amount.high],
});
```

**Transaction Builder:** `src/shared/starknet/transaction-builder.ts:86-93, 189-196`
```typescript
// ❌ OLD: Missing slippage parameters
export function buildDepositToSyCall(syAddress: string, receiver: string, amount: bigint): Call {
  const u256Amount = uint256.bnToUint256(amount);
  return {
    contractAddress: syAddress,
    entrypoint: 'deposit',
    calldata: [receiver, u256Amount.low, u256Amount.high],
  };
}

export function buildUnwrapSyCall(syAddress: string, receiver: string, amount: bigint): Call {
  const u256Amount = uint256.bnToUint256(amount);
  return {
    contractAddress: syAddress,
    entrypoint: 'redeem',
    calldata: [receiver, u256Amount.low, u256Amount.high],
  };
}
```

---

## Required Code Changes (Phase 2)

### 1. Update `transaction-builder.ts`

**File:** `src/shared/starknet/transaction-builder.ts`

```typescript
/**
 * Build a deposit (wrap) call to SY contract
 * SY.deposit(receiver, amount, min_shares_out) -> amount_sy_minted
 */
export function buildDepositToSyCall(
  syAddress: string,
  receiver: string,
  amount: bigint,
  minSharesOut: bigint  // NEW: slippage protection
): Call {
  const u256Amount = uint256.bnToUint256(amount);
  const u256MinOut = uint256.bnToUint256(minSharesOut);
  return {
    contractAddress: syAddress,
    entrypoint: 'deposit',
    calldata: [
      receiver,
      u256Amount.low,
      u256Amount.high,
      u256MinOut.low,
      u256MinOut.high,
    ],
  };
}

/**
 * Build an unwrap (redeem) call from SY contract
 * SY.redeem(receiver, amount, min_token_out, burn_from_internal_balance) -> amount_redeemed
 */
export function buildUnwrapSyCall(
  syAddress: string,
  receiver: string,
  amount: bigint,
  minTokenOut: bigint,              // NEW: slippage protection
  burnFromInternalBalance = false   // NEW: Router pattern (false for direct user calls)
): Call {
  const u256Amount = uint256.bnToUint256(amount);
  const u256MinOut = uint256.bnToUint256(minTokenOut);
  return {
    contractAddress: syAddress,
    entrypoint: 'redeem',
    calldata: [
      receiver,
      u256Amount.low,
      u256Amount.high,
      u256MinOut.low,
      u256MinOut.high,
      burnFromInternalBalance ? '0x1' : '0x0',  // bool as felt
    ],
  };
}
```

### 2. Update `buildDepositAndEarnCalls()`

**File:** `src/shared/starknet/transaction-builder.ts:207-241`

```typescript
export function buildDepositAndEarnCalls(params: DepositAndEarnParams): Call[] {
  const {
    userAddress,
    underlyingAddress,
    syAddress,
    ytAddress,
    routerAddress,
    amount,
    underlyingAllowance,
    syAllowance,
    slippageBps = 50,
  } = params;

  const calls: Call[] = [];
  const minPyOut = calculateMinOutput(amount, slippageBps);

  // Step 1: Approve underlying → SY (if needed)
  if (needsApproval(underlyingAllowance, amount)) {
    calls.push(buildApprovalCall(underlyingAddress, syAddress, amount));
  }

  // Step 2: Wrap underlying → SY (with slippage protection)
  const minSyOut = calculateMinOutput(amount, slippageBps);  // SY is 1:1 but add protection
  calls.push(buildDepositToSyCall(syAddress, userAddress, amount, minSyOut));

  // ... rest unchanged
}
```

### 3. Update `buildWithdrawCalls()`

**File:** `src/shared/starknet/transaction-builder.ts:257-307`

```typescript
// In the final step:
// Final step: Unwrap SY → underlying (with slippage protection)
const minUnderlyingOut = calculateMinOutput(minSyOut, slippageBps);
calls.push(buildUnwrapSyCall(syAddress, userAddress, minSyOut, minUnderlyingOut, false));
```

### 4. Update `useWrapToSy.ts`

**File:** `src/features/earn/model/useWrapToSy.ts`

```typescript
import { useTransactionSettings } from '@features/tx-settings';
import { calculateMinOutput } from '@shared/starknet/transaction-builder';

export function useWrapToSy({ underlyingAddress, syAddress }: UseWrapToSyParams) {
  const { slippageBps } = useTransactionSettings();
  // ...

  const buildWrapCalls = useCallback(
    (amountWad: bigint): Call[] => {
      // ...existing approval logic...

      // Add deposit call to SY contract with slippage
      const minSharesOut = calculateMinOutput(amountWad, slippageBps);
      const u256Amount = uint256.bnToUint256(amountWad);
      const u256MinOut = uint256.bnToUint256(minSharesOut);
      calls.push({
        contractAddress: syAddress,
        entrypoint: 'deposit',
        calldata: [
          userAddress,
          u256Amount.low,
          u256Amount.high,
          u256MinOut.low,
          u256MinOut.high,
        ],
      });

      return calls;
    },
    [userAddress, underlyingAddress, syAddress, needsApproval, slippageBps]
  );
}
```

### 5. Update `useUnwrapSy.ts`

**File:** `src/features/redeem/model/useUnwrapSy.ts`

```typescript
import { useTransactionSettings } from '@features/tx-settings';
import { calculateMinOutput } from '@shared/starknet/transaction-builder';

export function useUnwrapSy({ underlyingAddress, syAddress }: UseUnwrapSyParams) {
  const { slippageBps } = useTransactionSettings();
  // ...

  const buildUnwrapCalls = useCallback(
    (amountWad: bigint): Call[] => {
      // ...

      // SY.redeem(receiver, amount_sy, min_token_out, burn_from_internal_balance)
      const minTokenOut = calculateMinOutput(amountWad, slippageBps);
      const u256Amount = uint256.bnToUint256(amountWad);
      const u256MinOut = uint256.bnToUint256(minTokenOut);
      calls.push({
        contractAddress: syAddress,
        entrypoint: 'redeem',
        calldata: [
          userAddress,
          u256Amount.low,
          u256Amount.high,
          u256MinOut.low,
          u256MinOut.high,
          '0x0',  // burn_from_internal_balance = false (direct user call)
        ],
      });

      return calls;
    },
    [userAddress, syAddress, slippageBps]
  );
}
```

---

## Recommended Frontend Enhancements

### Priority 1: Token Validation (Low Effort, High Value)

Add client-side validation before transactions to prevent reverts.

**New hook:** `src/features/yield/model/useSyTokenValidation.ts`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useStarknet } from '@features/wallet';
import { getSYContract } from '@shared/starknet/contracts';

/**
 * Hook to validate if a token is supported for deposit/redeem
 * Uses the new is_valid_token_in/out methods from Phase 1
 */
export function useSyTokenValidation(
  syAddress: string | undefined,
  tokenAddress: string | undefined
): {
  isValidTokenIn: boolean | undefined;
  isValidTokenOut: boolean | undefined;
  isLoading: boolean;
} {
  const { provider } = useStarknet();

  const { data, isLoading } = useQuery({
    queryKey: ['sy', 'token-validation', syAddress, tokenAddress],
    queryFn: async () => {
      if (!syAddress || !tokenAddress) return null;

      const sy = getSYContract(syAddress, provider);
      const [validIn, validOut] = await Promise.all([
        sy.is_valid_token_in(tokenAddress),
        sy.is_valid_token_out(tokenAddress),
      ]);

      return { validIn, validOut };
    },
    enabled: !!syAddress && !!tokenAddress,
    staleTime: 300000, // 5 min - token lists don't change often
  });

  return {
    isValidTokenIn: data?.validIn,
    isValidTokenOut: data?.validOut,
    isLoading,
  };
}
```

**Integration in useWrapToSy:** Add validation before executing

```typescript
// In useWrapToSy.ts
const { isValidTokenIn } = useSyTokenValidation(syAddress, underlyingAddress);

const wrap = useCallback(async (amount: string) => {
  if (isValidTokenIn === false) {
    throw new Error('Token not supported for deposit');
  }
  // ... existing logic
}, [isValidTokenIn, ...]);
```

### Priority 2: Supported Tokens Query (Medium Effort)

Fetch all supported tokens for future multi-token UI.

**New hook:** `src/features/yield/model/useSyTokens.ts`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useStarknet } from '@features/wallet';
import { getSYContract } from '@shared/starknet/contracts';

/**
 * Hook to fetch supported deposit/redeem tokens
 */
export function useSyTokens(syAddress: string | undefined): {
  tokensIn: string[];
  tokensOut: string[];
  isLoading: boolean;
} {
  const { provider } = useStarknet();

  const { data, isLoading } = useQuery({
    queryKey: ['sy', 'tokens', syAddress],
    queryFn: async () => {
      if (!syAddress) return { tokensIn: [], tokensOut: [] };

      const sy = getSYContract(syAddress, provider);
      const [tokensIn, tokensOut] = await Promise.all([
        sy.get_tokens_in(),
        sy.get_tokens_out(),
      ]);

      // Convert bigint addresses to hex strings
      const formatAddresses = (addrs: bigint[]): string[] =>
        addrs.map(a => '0x' + a.toString(16).padStart(64, '0'));

      return {
        tokensIn: formatAddresses(tokensIn as bigint[]),
        tokensOut: formatAddresses(tokensOut as bigint[]),
      };
    },
    enabled: !!syAddress,
    staleTime: 600000, // 10 min - token lists are static
  });

  return {
    tokensIn: data?.tokensIn ?? [],
    tokensOut: data?.tokensOut ?? [],
    isLoading,
  };
}
```

### Priority 3: Asset Info Display (Low Effort)

Show asset type in market cards.

**New hook:** `src/features/yield/model/useSyAssetInfo.ts`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useStarknet } from '@features/wallet';
import { getSYContract } from '@shared/starknet/contracts';

export type AssetType = 'Token' | 'Liquidity';

interface SyAssetInfo {
  assetType: AssetType;
  underlyingAddress: string;
  decimals: number;
}

/**
 * Hook to fetch SY asset info (type, underlying, decimals)
 */
export function useSyAssetInfo(syAddress: string | undefined): {
  assetInfo: SyAssetInfo | undefined;
  isLoading: boolean;
} {
  const { provider } = useStarknet();

  const { data, isLoading } = useQuery({
    queryKey: ['sy', 'asset-info', syAddress],
    queryFn: async (): Promise<SyAssetInfo> => {
      if (!syAddress) throw new Error('SY address required');

      const sy = getSYContract(syAddress, provider);
      const info = await sy.asset_info();

      // info is tuple: [AssetType, ContractAddress, u8]
      const [assetTypeVariant, underlying, decimals] = info;

      // AssetType is an object with either Token or Liquidity key
      const assetType: AssetType = 'Token' in assetTypeVariant ? 'Token' : 'Liquidity';

      return {
        assetType,
        underlyingAddress: '0x' + (underlying as bigint).toString(16).padStart(64, '0'),
        decimals: Number(decimals),
      };
    },
    enabled: !!syAddress,
    staleTime: Infinity, // Asset info never changes
  });

  return {
    assetInfo: data,
    isLoading,
  };
}
```

---

## Files to Modify

### Immediate (Phase 2 - REQUIRED)

| File | Change | Priority | Status |
|------|--------|----------|--------|
| `src/shared/starknet/transaction-builder.ts` | Update `buildDepositToSyCall()` signature | **P0** | ❌ |
| `src/shared/starknet/transaction-builder.ts` | Update `buildUnwrapSyCall()` signature | **P0** | ❌ |
| `src/shared/starknet/transaction-builder.ts` | Update `buildDepositAndEarnCalls()` | **P0** | ❌ |
| `src/shared/starknet/transaction-builder.ts` | Update `buildWithdrawCalls()` | **P0** | ❌ |
| `src/features/earn/model/useWrapToSy.ts` | Add slippage from `useTransactionSettings` | **P0** | ❌ |
| `src/features/redeem/model/useUnwrapSy.ts` | Add slippage + `burn_from_internal_balance` | **P0** | ❌ |

### Recommended (Phase 1 Enhancements)

| File | Change | Priority |
|------|--------|----------|
| `src/features/yield/model/useSyTokenValidation.ts` | NEW file | P1 |
| `src/features/yield/model/useSyTokens.ts` | NEW file | P2 |
| `src/features/yield/model/useSyAssetInfo.ts` | NEW file | P3 |
| `src/features/yield/model/useSyPreview.ts` | NEW file - accurate slippage | P1 |
| `src/features/yield/model/index.ts` | Export new hooks | P1-P3 |
| `src/features/earn/model/useWrapToSy.ts` | Add token validation | P1 |
| `src/features/redeem/model/useUnwrapSy.ts` | Add token validation | P1 |

---

## Testing Checklist

### Phase 2 (REQUIRED - Breaking Changes)

- [ ] `buildDepositToSyCall()` passes correct calldata with `min_shares_out`
- [ ] `buildUnwrapSyCall()` passes correct calldata with `min_token_out` and `burn_from_internal_balance`
- [ ] `buildDepositAndEarnCalls()` wraps SY with slippage protection
- [ ] `buildWithdrawCalls()` unwraps SY with slippage protection
- [ ] `useWrapToSy` uses slippage from `useTransactionSettings`
- [ ] `useUnwrapSy` uses slippage from `useTransactionSettings`
- [ ] Wrap transactions succeed on devnet/mainnet
- [ ] Unwrap transactions succeed on devnet/mainnet
- [ ] E2E tests pass with new signatures

### Phase 1 Enhancements (Optional)

- [ ] `useSyTokenValidation` returns correct validation results
- [ ] Validation prevents invalid token transactions
- [ ] `useSyTokens` correctly parses Span<ContractAddress>
- [ ] `useSyAssetInfo` correctly parses AssetType enum
- [ ] `useSyPreview` provides accurate output predictions

### ABI Type Verification

```typescript
// The codegen has already been run, verify these signatures:
import { SY_ABI } from '@/types/generated';

// Phase 2 signatures (BREAKING):
// - deposit(receiver, amount_shares_to_deposit, min_shares_out) → u256
// - redeem(receiver, amount_sy_to_redeem, min_token_out, burn_from_internal_balance) → u256
// - preview_deposit(amount_to_deposit) → u256
// - preview_redeem(amount_sy) → u256

// Phase 1 methods:
// - get_tokens_in() → Span<ContractAddress>
// - get_tokens_out() → Span<ContractAddress>
// - is_valid_token_in(token) → bool
// - is_valid_token_out(token) → bool
// - asset_info() → (AssetType, ContractAddress, u8)

// New type:
// - AssetType enum with Token and Liquidity variants
```

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-30 | Phase 1 non-breaking | New methods added, signatures unchanged |
| 2025-12-30 | Recommend token validation hooks | Prevents failed transactions, improves UX |
| 2025-12-30 | Defer multi-token UI | Current SY deployments are single-token |
| 2025-12-30 | **Phase 2 BREAKING** - frontend update required | `deposit()` and `redeem()` signatures changed |
| 2025-12-30 | Use existing slippage infrastructure | `useTransactionSettings` + `calculateMinOutput` already exist |
| 2025-12-30 | `burn_from_internal_balance = false` for direct calls | Only Router uses internal balance pattern |

---

## UI Impact Analysis

### No New Components Required

The Phase 2 changes **do not require new UI components**:

1. **Slippage settings already exist** - `TransactionSettingsPanel` in `src/features/tx-settings/ui/`
2. **Slippage is already displayed** - Used in swap, mint, add/remove liquidity flows
3. **Settings are persisted** - Via localStorage in `useTransactionSettings`

### Behavioral Changes

| UI Element | Before | After |
|------------|--------|-------|
| Wrap (underlying → SY) | No slippage protection | Uses user's slippage setting |
| Unwrap (SY → underlying) | No slippage protection | Uses user's slippage setting |
| Transaction failure | Could fail silently | Clear "slippage exceeded" error |

### Optional UX Enhancements

If desired, consider adding:

1. **Slippage indicator on wrap/unwrap forms** - Show "Min received: X"
2. **Preview hook integration** - Use `preview_deposit()` for more accurate estimates than simple calculation

```typescript
// Optional: More accurate slippage using preview functions
const expectedOut = await sy.preview_deposit(amount);
const minOut = calculateMinOutput(expectedOut, slippageBps);
```

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| ~~Slippage defaults?~~ | Use existing 0.5% default from `useTransactionSettings` |
| ~~New UI components?~~ | No - reuse existing slippage infrastructure |
| ~~Migration strategy?~~ | Contract upgraded in place, frontend must update signatures |
| Multi-token UI timing? | Deferred - no LP-backed SY wrappers deployed yet |

---

## Appendix A: Preview Hook Implementation

For more accurate slippage calculations, use the preview functions:

**New hook:** `src/features/yield/model/useSyPreview.ts`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useStarknet } from '@features/wallet';
import { getSYContract } from '@shared/starknet/contracts';

/**
 * Hook to preview deposit/redeem outputs for accurate slippage calculation.
 * Uses the new preview_deposit/preview_redeem view functions.
 */
export function useSyPreview(
  syAddress: string | undefined,
  amount: bigint | undefined,
  direction: 'deposit' | 'redeem'
): {
  expectedOutput: bigint | undefined;
  isLoading: boolean;
} {
  const { provider } = useStarknet();

  const { data, isLoading } = useQuery({
    queryKey: ['sy', 'preview', syAddress, direction, amount?.toString()],
    queryFn: async (): Promise<bigint> => {
      if (!syAddress || !amount || amount === 0n) {
        return 0n;
      }

      const sy = getSYContract(syAddress, provider);

      if (direction === 'deposit') {
        return await sy.preview_deposit(amount);
      } else {
        return await sy.preview_redeem(amount);
      }
    },
    enabled: !!syAddress && !!amount && amount > 0n,
    staleTime: 30000, // 30 seconds - exchange rates can change
  });

  return {
    expectedOutput: data,
    isLoading,
  };
}

/**
 * Calculate min output using preview function for accurate slippage.
 * Falls back to simple calculation if preview fails.
 */
export function useMinOutputWithPreview(
  syAddress: string | undefined,
  amount: bigint | undefined,
  direction: 'deposit' | 'redeem',
  slippageBps: number
): bigint | undefined {
  const { expectedOutput } = useSyPreview(syAddress, amount, direction);

  if (!expectedOutput) {
    // Fallback: use input amount (assumes 1:1 ratio)
    if (!amount) return undefined;
    return (amount * BigInt(10000 - slippageBps)) / 10000n;
  }

  // Apply slippage to actual expected output
  return (expectedOutput * BigInt(10000 - slippageBps)) / 10000n;
}
```

---

## Appendix B: Type Generation Verification

Run codegen after any contract ABI changes:

```bash
cd packages/frontend
bun run codegen
```

Verify these methods exist in `src/types/generated/SY.ts`:

**Phase 2 (Breaking):**
- Line ~227: `deposit` function with 3 params (receiver, amount, min_shares_out)
- Line ~251: `redeem` function with 4 params (receiver, amount, min_token_out, burn_from_internal_balance)
- Line ~366: `preview_deposit` function
- Line ~380: `preview_redeem` function

**Phase 1 (Non-breaking):**
- Line ~301: `get_tokens_in` function
- Line ~311: `get_tokens_out` function
- Line ~322: `is_valid_token_in` function
- Line ~337: `is_valid_token_out` function
- Line ~353: `asset_info` function
- Line ~64: `AssetType` enum definition

---

## Appendix C: Error Messages

The contract may emit these new errors:

```typescript
const SY_ERROR_MESSAGES = {
  'SY: insufficient shares out': 'Slippage exceeded on deposit. Try increasing slippage tolerance.',
  'SY: insufficient token out': 'Slippage exceeded on redeem. Try increasing slippage tolerance.',
};

// Add to src/shared/lib/errors.ts CONTRACT_ERROR_MESSAGES
```
