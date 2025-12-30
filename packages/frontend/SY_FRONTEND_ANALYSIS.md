# SY Frontend Impact Analysis

> **Date:** 2025-12-31
> **Status:** Updated for Phase 3 Completion
> **Scope:** Frontend changes required after Phase 1, 2 & 3 SY Contract Updates
> **Related:** `/contracts/SY_GAP_DEVELOPMENT_PLAN.md`

---

## Executive Summary

Phase 3 contract work is **COMPLETE**. The SY contracts now support:
- Multi-token deposit/redeem with slippage protection
- SYWithRewards for reward-bearing tokens (GLP-style)
- Factory deployment of both SY and SYWithRewards
- Pausable transfers across all operations

**Frontend Status:** The TypeScript ABIs are regenerated and correct. The frontend code is **out of sync** with the contract ABIs.

### Impact Matrix

| Contract Change | Frontend Impact | Action Required | Status |
|-----------------|-----------------|-----------------|--------|
| `deposit()` signature (3 params) | **BREAKING** | **REQUIRED** - add `min_shares_out` | ❌ Needs Update |
| `redeem()` signature (4 params) | **BREAKING** | **REQUIRED** - add `min_token_out`, `burn_from_internal_balance` | ❌ Needs Update |
| `preview_deposit()` added | New capability | **Recommended** for accurate slippage | ⏳ Optional |
| `preview_redeem()` added | New capability | **Recommended** for accurate slippage | ⏳ Optional |
| `get_tokens_in()` added | New capability | Optional enhancement | ⏳ Optional |
| `get_tokens_out()` added | New capability | Optional enhancement | ⏳ Optional |
| `is_valid_token_in(token)` added | New capability | **Recommended** for validation | ⏳ Optional |
| `is_valid_token_out(token)` added | New capability | **Recommended** for validation | ⏳ Optional |
| `asset_info()` added | New capability | Optional for UI | ⏳ Optional |
| `SYWithRewards` contract | **NEW** | **REQUIRED** - new contract helpers | ❌ Needs Implementation |
| Factory `deploy_sy_with_rewards()` | **NEW** | Optional (admin only) | ⏳ Optional |
| Pausable transfers | Enhanced security | No frontend changes needed | ✅ Transparent |

---

## Phase 3 Changes Summary

### New SYWithRewards Contract

A new contract type that extends SY with reward token distribution:

```typescript
// New ABI functions in SYWITHREWARDS_ABI:
get_reward_tokens(): Span<ContractAddress>       // List of reward token addresses
claim_rewards(user: ContractAddress): Span<u256> // Claim accrued rewards
accrued_rewards(user: ContractAddress): Span<u256> // View pending rewards
reward_index(token: ContractAddress): u256       // Global reward index
user_reward_index(user, token): u256             // User's last claimed index
is_reward_token(token: ContractAddress): bool    // Check if token is a reward
reward_tokens_count(): u32                       // Number of reward tokens
```

### Factory Updates

The Factory can now deploy SYWithRewards:

```typescript
// New Factory functions:
sy_with_rewards_class_hash(): ClassHash
set_sy_with_rewards_class_hash(class_hash: ClassHash)
deploy_sy_with_rewards(name, symbol, underlying, ..., reward_tokens: Span<ContractAddress>)
is_valid_sy(sy: ContractAddress): bool
```

---

## Breaking Changes: Required Updates

### 1. `transaction-builder.ts` - `buildDepositToSyCall()`

**Location:** `src/shared/starknet/transaction-builder.ts:86-93`

**Current (BROKEN):**
```typescript
export function buildDepositToSyCall(syAddress: string, receiver: string, amount: bigint): Call {
  const u256Amount = uint256.bnToUint256(amount);
  return {
    contractAddress: syAddress,
    entrypoint: 'deposit',
    calldata: [receiver, u256Amount.low, u256Amount.high],  // ❌ Missing min_shares_out
  };
}
```

**Required:**
```typescript
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
```

### 2. `transaction-builder.ts` - `buildUnwrapSyCall()`

**Location:** `src/shared/starknet/transaction-builder.ts:189-196`

**Current (BROKEN):**
```typescript
export function buildUnwrapSyCall(syAddress: string, receiver: string, amount: bigint): Call {
  const u256Amount = uint256.bnToUint256(amount);
  return {
    contractAddress: syAddress,
    entrypoint: 'redeem',
    calldata: [receiver, u256Amount.low, u256Amount.high],  // ❌ Missing min_token_out, burn_from_internal_balance
  };
}
```

**Required:**
```typescript
export function buildUnwrapSyCall(
  syAddress: string,
  receiver: string,
  amount: bigint,
  minTokenOut: bigint,              // NEW: slippage protection
  burnFromInternalBalance = false   // NEW: Router pattern support
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

### 3. `useWrapToSy.ts` - Add Slippage

**Location:** `src/features/earn/model/useWrapToSy.ts:91-102`

**Current (BROKEN):**
```typescript
const u256Amount = uint256.bnToUint256(amountWad);
calls.push({
  contractAddress: syAddress,
  entrypoint: 'deposit',
  calldata: [
    userAddress,
    u256Amount.low,
    u256Amount.high,  // ❌ Missing min_shares_out
  ],
});
```

**Required:**
```typescript
import { useTransactionSettings } from '@features/tx-settings';
import { calculateMinOutput } from '@shared/starknet/transaction-builder';

// In hook:
const { slippageBps } = useTransactionSettings();

// In buildWrapCalls:
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
```

### 4. `useUnwrapSy.ts` - Add Slippage + Internal Balance

**Location:** `src/features/redeem/model/useUnwrapSy.ts:63-73`

**Current (BROKEN):**
```typescript
const u256Amount = uint256.bnToUint256(amountWad);
calls.push({
  contractAddress: syAddress,
  entrypoint: 'redeem',
  calldata: [
    userAddress,
    u256Amount.low,
    u256Amount.high,  // ❌ Missing min_token_out, burn_from_internal_balance
  ],
});
```

**Required:**
```typescript
import { useTransactionSettings } from '@features/tx-settings';
import { calculateMinOutput } from '@shared/starknet/transaction-builder';

// In hook:
const { slippageBps } = useTransactionSettings();

// In buildUnwrapCalls:
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
```

### 5. `buildDepositAndEarnCalls()` - Fix SY Deposit

**Location:** `src/shared/starknet/transaction-builder.ts:228-229`

**Current (BROKEN):**
```typescript
calls.push(buildDepositToSyCall(syAddress, userAddress, amount));
```

**Required:**
```typescript
const minSyOut = calculateMinOutput(amount, slippageBps);
calls.push(buildDepositToSyCall(syAddress, userAddress, amount, minSyOut));
```

### 6. `buildWithdrawCalls()` - Fix SY Redeem

**Location:** `src/shared/starknet/transaction-builder.ts:303-304`

**Current (BROKEN):**
```typescript
calls.push(buildUnwrapSyCall(syAddress, userAddress, minSyOut));
```

**Required:**
```typescript
const minUnderlyingOut = calculateMinOutput(minSyOut, slippageBps);
calls.push(buildUnwrapSyCall(syAddress, userAddress, minSyOut, minUnderlyingOut, false));
```

---

## New Functionality: SYWithRewards Support

### New Files to Create

#### 1. `src/shared/starknet/contracts.ts` - Add SYWithRewards Helper

```typescript
import { SYWITHREWARDS_ABI } from '@/types/generated';

export type TypedSYWithRewards = TypedContractV2<typeof SYWITHREWARDS_ABI>;

export function getSYWithRewardsContract(
  address: string,
  providerOrAccount: ProviderOrAccount
): TypedSYWithRewards {
  return new Contract({ abi: SYWITHREWARDS_ABI, address, providerOrAccount })
    .typedv2(SYWITHREWARDS_ABI);
}
```

#### 2. `src/features/rewards/model/useRewardTokens.ts` - Fetch Reward Tokens

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { getSYWithRewardsContract } from '@shared/starknet/contracts';
import { useStarknet } from '@features/wallet';

/**
 * Hook to fetch reward tokens for an SYWithRewards contract
 */
export function useRewardTokens(syAddress: string | undefined) {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['sy-rewards', 'tokens', syAddress],
    queryFn: async () => {
      if (!syAddress) return [];

      const sy = getSYWithRewardsContract(syAddress, provider);
      const tokens = await sy.get_reward_tokens();

      // Convert bigint addresses to hex strings
      return (tokens as bigint[]).map(
        (addr) => '0x' + addr.toString(16).padStart(64, '0')
      );
    },
    enabled: !!syAddress,
    staleTime: 600_000, // 10 min - reward tokens rarely change
  });
}
```

#### 3. `src/features/rewards/model/useAccruedRewards.ts` - Pending Rewards

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { getSYWithRewardsContract } from '@shared/starknet/contracts';
import { useStarknet, useAccount } from '@features/wallet';

/**
 * Hook to fetch accrued (pending) rewards for the connected user
 */
export function useAccruedRewards(syAddress: string | undefined) {
  const { provider } = useStarknet();
  const { address: userAddress } = useAccount();

  return useQuery({
    queryKey: ['sy-rewards', 'accrued', syAddress, userAddress],
    queryFn: async () => {
      if (!syAddress || !userAddress) return [];

      const sy = getSYWithRewardsContract(syAddress, provider);
      const rewards = await sy.accrued_rewards(userAddress);

      return (rewards as bigint[]).map((amount) => amount);
    },
    enabled: !!syAddress && !!userAddress,
    staleTime: 30_000, // 30 seconds - rewards accrue over time
  });
}
```

#### 4. `src/features/rewards/model/useClaimRewards.ts` - Claim Mutation

```typescript
'use client';

import { useCallback } from 'react';
import { type Call } from 'starknet';
import { useAccount } from '@features/wallet';
import { useTransaction } from '@shared/hooks/useTransaction';

/**
 * Hook to claim accrued rewards from SYWithRewards
 */
export function useClaimRewards(syAddress: string | undefined) {
  const { address: userAddress } = useAccount();
  const { execute, status, txHash, error, isLoading, reset } = useTransaction();

  const buildClaimCall = useCallback((): Call | null => {
    if (!syAddress || !userAddress) return null;

    return {
      contractAddress: syAddress,
      entrypoint: 'claim_rewards',
      calldata: [userAddress],
    };
  }, [syAddress, userAddress]);

  const claim = useCallback(async () => {
    const call = buildClaimCall();
    if (!call) return;

    await execute([call]);
  }, [buildClaimCall, execute]);

  return {
    claim,
    status,
    txHash,
    error,
    isLoading,
    reset,
  };
}
```

#### 5. `src/features/rewards/index.ts` - Public API

```typescript
export { useRewardTokens } from './model/useRewardTokens';
export { useAccruedRewards } from './model/useAccruedRewards';
export { useClaimRewards } from './model/useClaimRewards';
```

---

## Enhanced Hooks: Preview-Based Slippage

### `src/features/yield/model/useSyPreview.ts`

For more accurate slippage calculation using on-chain preview:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { getSYContract } from '@shared/starknet/contracts';
import { useStarknet } from '@features/wallet';

/**
 * Hook to preview deposit/redeem outputs for accurate slippage calculation
 */
export function useSyPreview(
  syAddress: string | undefined,
  amount: bigint | undefined,
  direction: 'deposit' | 'redeem'
) {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['sy', 'preview', syAddress, direction, amount?.toString()],
    queryFn: async (): Promise<bigint> => {
      if (!syAddress || !amount || amount === 0n) return 0n;

      const sy = getSYContract(syAddress, provider);

      if (direction === 'deposit') {
        return await sy.preview_deposit(amount);
      } else {
        return await sy.preview_redeem(amount);
      }
    },
    enabled: !!syAddress && !!amount && amount > 0n,
    staleTime: 30_000, // 30 seconds
  });
}
```

### `src/features/yield/model/useSyTokenValidation.ts`

Client-side validation before transactions:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { getSYContract } from '@shared/starknet/contracts';
import { useStarknet } from '@features/wallet';

/**
 * Hook to validate if a token is supported for deposit/redeem
 */
export function useSyTokenValidation(
  syAddress: string | undefined,
  tokenAddress: string | undefined
) {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['sy', 'token-validation', syAddress, tokenAddress],
    queryFn: async () => {
      if (!syAddress || !tokenAddress) return null;

      const sy = getSYContract(syAddress, provider);
      const [validIn, validOut] = await Promise.all([
        sy.is_valid_token_in(tokenAddress),
        sy.is_valid_token_out(tokenAddress),
      ]);

      return { isValidTokenIn: validIn, isValidTokenOut: validOut };
    },
    enabled: !!syAddress && !!tokenAddress,
    staleTime: 300_000, // 5 min - token lists don't change often
  });
}
```

### `src/features/yield/model/useSyAssetInfo.ts`

Asset type and metadata display:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { getSYContract } from '@shared/starknet/contracts';
import { useStarknet } from '@features/wallet';

export type AssetType = 'Token' | 'Liquidity';

interface SyAssetInfo {
  assetType: AssetType;
  underlyingAddress: string;
  decimals: number;
}

/**
 * Hook to fetch SY asset info (type, underlying, decimals)
 */
export function useSyAssetInfo(syAddress: string | undefined) {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['sy', 'asset-info', syAddress],
    queryFn: async (): Promise<SyAssetInfo> => {
      if (!syAddress) throw new Error('SY address required');

      const sy = getSYContract(syAddress, provider);
      const info = await sy.asset_info();

      // info is tuple: [AssetType, ContractAddress, u8]
      const [assetTypeVariant, underlying, decimals] = info;

      // AssetType is an object with either Token or Liquidity key
      const assetType: AssetType = 'Token' in (assetTypeVariant as object)
        ? 'Token'
        : 'Liquidity';

      return {
        assetType,
        underlyingAddress: '0x' + (underlying as bigint).toString(16).padStart(64, '0'),
        decimals: Number(decimals),
      };
    },
    enabled: !!syAddress,
    staleTime: Infinity, // Asset info never changes
  });
}
```

---

## Error Handling Updates

### `src/shared/lib/errors.ts` - Add SY Slippage Errors

```typescript
// Add to CONTRACT_ERROR_MESSAGES:
'HZN: insufficient shares out': 'Slippage exceeded on wrap. Try increasing slippage tolerance.',
'HZN: insufficient token out': 'Slippage exceeded on unwrap. Try increasing slippage tolerance.',

// Add to CONTRACT_ERROR_SIMPLE:
'HZN: insufficient shares out': 'Price changed too much during wrap. Please try again.',
'HZN: insufficient token out': 'Price changed too much during unwrap. Please try again.',

// Add to CONTRACT_ERROR_HELP:
'HZN: insufficient shares out': {
  simple: 'The exchange rate changed while wrapping. Try again.',
  advanced: 'Increase slippage tolerance in settings or try a smaller amount.',
},
'HZN: insufficient token out': {
  simple: 'The exchange rate changed while unwrapping. Try again.',
  advanced: 'Increase slippage tolerance in settings or try a smaller amount.',
},
```

---

## Implementation Checklist

### P0: Breaking Changes (Required for Contract Compatibility)

- [ ] Update `buildDepositToSyCall()` to accept `minSharesOut` parameter
- [ ] Update `buildUnwrapSyCall()` to accept `minTokenOut` and `burnFromInternalBalance` parameters
- [ ] Update `buildDepositAndEarnCalls()` to pass slippage to SY deposit
- [ ] Update `buildWithdrawCalls()` to pass slippage to SY redeem
- [ ] Update `useWrapToSy` to use `useTransactionSettings` for slippage
- [ ] Update `useUnwrapSy` to use `useTransactionSettings` for slippage

### P1: SYWithRewards Support

- [ ] Add `getSYWithRewardsContract()` to `contracts.ts`
- [ ] Export `SYWITHREWARDS_ABI` from generated types (already done)
- [ ] Create `features/rewards/` module with hooks
- [ ] Add rewards error messages to `errors.ts`

### P2: Enhanced Features

- [ ] Add `useSyPreview` hook for accurate slippage
- [ ] Add `useSyTokenValidation` hook for input validation
- [ ] Add `useSyAssetInfo` hook for asset metadata

### P3: UI Features (Future)

- [ ] Rewards claiming UI component
- [ ] Accrued rewards display in portfolio
- [ ] Asset type badge (Token vs Liquidity) in market cards
- [ ] "Min received" display in wrap/unwrap forms

---

## Testing Checklist

### Contract Compatibility Tests

- [ ] `buildDepositToSyCall()` generates correct calldata with `min_shares_out`
- [ ] `buildUnwrapSyCall()` generates correct calldata with `min_token_out` and `burn_from_internal_balance`
- [ ] Wrap transactions succeed on devnet with slippage protection
- [ ] Unwrap transactions succeed on devnet with slippage protection
- [ ] Slippage revert is handled gracefully with user-friendly error

### SYWithRewards Tests

- [ ] `useRewardTokens` correctly parses reward token addresses
- [ ] `useAccruedRewards` returns pending rewards for user
- [ ] `useClaimRewards` successfully claims rewards
- [ ] RewardsClaimed event is indexed correctly

### E2E Tests

- [ ] Full deposit flow works with new SY signatures
- [ ] Full withdrawal flow works with new SY signatures
- [ ] Settings panel slippage affects wrap/unwrap operations

---

## ABI Verification

The following methods now exist in generated types:

**SY_ABI (`src/types/generated/SY.ts`):**
- Line ~227: `deposit(receiver, amount_shares_to_deposit, min_shares_out)` ✓
- Line ~249: `redeem(receiver, amount_sy_to_redeem, min_token_out, burn_from_internal_balance)` ✓
- Line ~301: `get_tokens_in()` ✓
- Line ~311: `get_tokens_out()` ✓
- Line ~322: `is_valid_token_in(token)` ✓
- Line ~337: `is_valid_token_out(token)` ✓
- Line ~353: `asset_info()` ✓
- Line ~366: `preview_deposit(amount_to_deposit)` ✓
- Line ~380: `preview_redeem(amount_sy)` ✓
- Line ~64: `AssetType` enum (Token, Liquidity) ✓

**SYWITHREWARDS_ABI (`src/types/generated/SYWithRewards.ts`):**
- Line ~408: `get_reward_tokens()` ✓
- Line ~419: `claim_rewards(user)` ✓
- Line ~435: `accrued_rewards(user)` ✓
- Line ~451: `reward_index(token)` ✓
- Line ~466: `user_reward_index(user, token)` ✓
- Line ~487: `is_reward_token(token)` ✓
- Line ~502: `reward_tokens_count()` ✓

**FACTORY_ABI (`src/types/generated/Factory.ts`):**
- Line ~229: `sy_with_rewards_class_hash()` ✓
- Line ~240: `set_sy_with_rewards_class_hash(class_hash)` ✓
- Line ~252: `deploy_sy_with_rewards(...)` ✓

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-30 | Phase 1 non-breaking | New methods added, signatures unchanged |
| 2025-12-30 | Phase 2 BREAKING | `deposit()` and `redeem()` signatures changed |
| 2025-12-30 | Use existing slippage infrastructure | `useTransactionSettings` + `calculateMinOutput` already exist |
| 2025-12-30 | `burn_from_internal_balance = false` for direct calls | Only Router uses internal balance pattern |
| 2025-12-31 | Phase 3 complete | SYWithRewards, RewardManager, Factory updates all done |
| 2025-12-31 | Create `features/rewards/` module | Follows FSD architecture for new functionality |
| 2025-12-31 | Pausable transfers are transparent | No frontend changes needed - contract handles it |

---

## Appendix A: Full Updated Contract Signatures

### SY Contract

```typescript
// Deposit underlying → SY
deposit(
  receiver: ContractAddress,
  amount_shares_to_deposit: u256,
  min_shares_out: u256,
) → u256

// Redeem SY → underlying
redeem(
  receiver: ContractAddress,
  amount_sy_to_redeem: u256,
  min_token_out: u256,
  burn_from_internal_balance: bool,
) → u256

// Preview functions
preview_deposit(amount_to_deposit: u256) → u256
preview_redeem(amount_sy: u256) → u256

// Token validation
get_tokens_in() → Span<ContractAddress>
get_tokens_out() → Span<ContractAddress>
is_valid_token_in(token: ContractAddress) → bool
is_valid_token_out(token: ContractAddress) → bool

// Asset info
asset_info() → (AssetType, ContractAddress, u8)
```

### SYWithRewards Contract

```typescript
// All SY methods above, plus:

// Reward management
get_reward_tokens() → Span<ContractAddress>
claim_rewards(user: ContractAddress) → Span<u256>
accrued_rewards(user: ContractAddress) → Span<u256>
reward_index(token: ContractAddress) → u256
user_reward_index(user: ContractAddress, token: ContractAddress) → u256
is_reward_token(token: ContractAddress) → bool
reward_tokens_count() → u32
```
