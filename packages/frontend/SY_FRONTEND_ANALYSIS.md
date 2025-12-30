# SY Frontend Impact Analysis

> **Date:** 2025-12-30
> **Status:** Living Document
> **Scope:** Frontend changes required after Phase 1 Multi-Token Support
> **Related:** `/contracts/SY_GAP_DEVELOPMENT_PLAN.md`

---

## Executive Summary

**Phase 1 (Multi-Token Support) does NOT break the frontend.** The `deposit` and `redeem` method signatures are **unchanged**. All existing code continues to work.

However, Phase 1 adds **new capabilities** the frontend can optionally leverage for improved UX. Phase 2 (Slippage & Security) **WILL** introduce breaking changes to these signatures.

### Impact Matrix

| Contract Change | Frontend Impact | Action Required |
|----------------|-----------------|-----------------|
| `get_tokens_in()` added | None (new capability) | Optional enhancement |
| `get_tokens_out()` added | None (new capability) | Optional enhancement |
| `is_valid_token_in(token)` added | None (new capability) | **Recommended** for validation |
| `is_valid_token_out(token)` added | None (new capability) | **Recommended** for validation |
| `asset_info()` added | None (new capability) | Optional for UI |
| `AssetType` enum added | Type generation updated | Already done via codegen |
| Constructor changed | N/A (deployment only) | No frontend impact |
| `deposit()` signature | **UNCHANGED** | No changes needed |
| `redeem()` signature | **UNCHANGED** | No changes needed |

---

## Phase 1 Contract Changes

### New ISY Methods

```typescript
// New methods available in SY_ABI
interface ISY {
  // Existing - UNCHANGED
  deposit(receiver: ContractAddress, amount_shares_to_deposit: u256): u256;
  redeem(receiver: ContractAddress, amount_sy_to_redeem: u256): u256;
  exchange_rate(): u256;
  underlying_asset(): ContractAddress;

  // NEW in Phase 1
  get_tokens_in(): Span<ContractAddress>;      // List of valid deposit tokens
  get_tokens_out(): Span<ContractAddress>;     // List of valid redeem tokens
  is_valid_token_in(token: ContractAddress): bool;   // Validate deposit token
  is_valid_token_out(token: ContractAddress): bool;  // Validate redeem token
  asset_info(): (AssetType, ContractAddress, u8);    // Type, underlying, decimals
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

### Current Call Signatures (Frontend)

**Wrap (Deposit):** `src/features/earn/model/useWrapToSy.ts:91-102`
```typescript
// SY.deposit(receiver, amount_shares_to_deposit) -> amount_sy_minted
calls.push({
  contractAddress: syAddress,
  entrypoint: 'deposit',
  calldata: [userAddress, u256Amount.low, u256Amount.high],
});
```

**Unwrap (Redeem):** `src/features/redeem/model/useUnwrapSy.ts:63-73`
```typescript
// SY.redeem(receiver, amount_sy_to_redeem) -> amount_redeemed
calls.push({
  contractAddress: syAddress,
  entrypoint: 'redeem',
  calldata: [userAddress, u256Amount.low, u256Amount.high],
});
```

**Transaction Builder:** `src/shared/starknet/transaction-builder.ts:86-93, 189-196`
```typescript
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

## Phase 2 Breaking Changes (Upcoming)

**When Phase 2 lands, these signatures WILL change:**

### deposit() - New Signature

```cairo
// OLD (current)
fn deposit(receiver, amount_shares_to_deposit) -> u256

// NEW (Phase 2)
fn deposit(
  receiver: ContractAddress,
  token_in: ContractAddress,      // NEW: which token to deposit
  amount_to_deposit: u256,
  min_shares_out: u256,           // NEW: slippage protection
) -> u256
```

### redeem() - New Signature

```cairo
// OLD (current)
fn redeem(receiver, amount_sy_to_redeem) -> u256

// NEW (Phase 2)
fn redeem(
  receiver: ContractAddress,
  amount_sy_to_redeem: u256,
  min_token_out: u256,            // NEW: slippage protection
  burn_from_internal_balance: bool, // NEW: Router pattern support
) -> u256
```

### Required Frontend Changes for Phase 2

1. **Transaction Builder Updates:**
   - `buildDepositToSyCall()` - Add `token_in` and `min_shares_out` params
   - `buildUnwrapSyCall()` - Add `min_token_out` and `burn_from_internal_balance` params

2. **Hook Updates:**
   - `useWrapToSy` - Calculate slippage, pass token address
   - `useUnwrapSy` - Calculate slippage

3. **UI Updates:**
   - Add slippage settings (already exists for Router operations)
   - Token selector UI for multi-token SY wrappers

---

## Files to Modify (When Ready)

### Immediate (Phase 1 Enhancements)

| File | Change | Priority |
|------|--------|----------|
| `src/features/yield/model/useSyTokenValidation.ts` | NEW file | P1 |
| `src/features/yield/model/useSyTokens.ts` | NEW file | P2 |
| `src/features/yield/model/useSyAssetInfo.ts` | NEW file | P3 |
| `src/features/yield/model/index.ts` | Export new hooks | P1-P3 |
| `src/features/earn/model/useWrapToSy.ts` | Add validation | P1 |
| `src/features/redeem/model/useUnwrapSy.ts` | Add validation | P1 |

### Future (Phase 2 - Breaking Changes)

| File | Change |
|------|--------|
| `src/shared/starknet/transaction-builder.ts` | Update signatures |
| `src/features/earn/model/useWrapToSy.ts` | Add slippage + token params |
| `src/features/redeem/model/useUnwrapSy.ts` | Add slippage params |
| `src/features/earn/ui/WrapToSyForm.tsx` | Token selector (if multi-token) |
| `src/features/redeem/ui/UnwrapSyForm.tsx` | Slippage display |

---

## Testing Checklist

### Phase 1 Enhancements

- [ ] `useSyTokenValidation` returns correct validation results
- [ ] Validation prevents invalid token transactions
- [ ] `useSyTokens` correctly parses Span<ContractAddress>
- [ ] `useSyAssetInfo` correctly parses AssetType enum
- [ ] Existing wrap/unwrap flows continue to work
- [ ] E2E tests pass

### ABI Type Verification

```typescript
// The codegen has already been run, verify these types exist:
import { SY_ABI } from '@/types/generated';

// New method signatures should be present:
// - get_tokens_in
// - get_tokens_out
// - is_valid_token_in
// - is_valid_token_out
// - asset_info

// New type should be present:
// - AssetType enum with Token and Liquidity variants
```

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-30 | No immediate frontend changes required | Phase 1 doesn't break existing signatures |
| 2025-12-30 | Recommend adding token validation | Prevents failed transactions, improves UX |
| 2025-12-30 | Defer multi-token UI to Phase 2 | Current SY deployments are single-token |

---

## Open Questions

1. **Multi-token UI timing:** When will multi-token SY wrappers (e.g., Curve LP) be deployed?
2. **Slippage defaults:** What should be the default `min_shares_out` in Phase 2? (Currently Router uses 0.5%)
3. **Migration strategy:** Will Phase 2 use new contract addresses or upgrade existing?

---

## Appendix: Type Generation Verification

Run codegen after any contract ABI changes:

```bash
cd packages/frontend
bun run codegen
```

Verify the new methods exist in `src/types/generated/SY.ts`:
- Line ~289: `get_tokens_in` function
- Line ~300: `get_tokens_out` function
- Line ~310: `is_valid_token_in` function
- Line ~325: `is_valid_token_out` function
- Line ~341: `asset_info` function
- Line ~64: `AssetType` enum definition
