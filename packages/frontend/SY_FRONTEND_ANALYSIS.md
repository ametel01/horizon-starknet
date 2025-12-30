# SY Frontend Impact Analysis

> **Date:** 2025-12-31
> **Status:** Updated for Phase 4 Completion (ALL PHASES COMPLETE)
> **Scope:** Frontend changes required after Phase 1, 2, 3 & 4 SY Contract Updates
> **Related:** `/contracts/SY_GAP_DEVELOPMENT_PLAN.md`

---

## Executive Summary

**All 4 phases of contract work are COMPLETE.** The SY contracts now support:
- Multi-token deposit/redeem with slippage protection
- SYWithRewards for reward-bearing tokens (GLP-style)
- Factory deployment of both SY and SYWithRewards
- Pausable transfers (deposits/transfers blocked, redemptions always allowed)
- Negative yield detection with watermark tracking

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
| `get_exchange_rate_watermark()` | **NEW** (Phase 4) | **Recommended** for monitoring | ⏳ Optional |
| `NegativeYieldDetected` event | **NEW** (Phase 4) | **Recommended** for indexer | ⏳ Optional |
| `is_paused()` + Pausable errors | **NEW** (Phase 4) | **REQUIRED** - error handling | ❌ Needs Update |
| Pausable transfers | Enhanced security | Transparent (see error handling) | ⏳ Partial |

---

## Phase 4 Changes Summary (NEW)

### Gap 4.1: Pausable Transfers

When an SY contract is paused:
- **Deposits (mints) are BLOCKED** - transaction will revert
- **Transfers are BLOCKED** - transaction will revert
- **Redemptions (burns) are ALLOWED** - users can always exit their positions

**New Functions:**
```typescript
// Check pause state (both SY and SYWithRewards)
is_paused(): bool

// Admin functions (PAUSER_ROLE required)
pause(): void
unpause(): void
```

**New Events:**
```typescript
// Emitted when contract is paused
Paused { account: ContractAddress }

// Emitted when contract is unpaused
Unpaused { account: ContractAddress }
```

**Frontend Impact:** Transactions will fail with `Pausable: paused` error when contract is paused. Must add error handling.

### Gap 4.2: Negative Yield Watermark

The SY contract now tracks a "watermark" - the highest exchange rate ever seen. When the current rate drops below this watermark, it indicates negative yield (the underlying asset lost value).

**New View Function:**
```typescript
// Get the watermark (highest rate ever seen)
get_exchange_rate_watermark(): u256
```

**New Event:**
```typescript
// Emitted when rate drops below watermark
NegativeYieldDetected {
  sy: ContractAddress,           // key - SY contract address
  underlying: ContractAddress,   // key - underlying asset address
  watermark_rate: u256,          // The previous high water mark
  current_rate: u256,            // The current (lower) rate
  rate_drop_bps: u256,           // Rate drop in basis points
  timestamp: u64,
}
```

**Use Cases:**
- Display warning in UI when SY is experiencing negative yield
- Indexer can track and alert on `NegativeYieldDetected` events
- PT holders may want to monitor positions with negative yield exposure

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

### `src/features/yield/model/useSyWatermark.ts` (Phase 4)

Monitor negative yield and watermark status:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { getSYContract } from '@shared/starknet/contracts';
import { useStarknet } from '@features/wallet';
import { WAD } from '@shared/math';

interface SyWatermarkInfo {
  watermark: bigint;           // Highest rate ever seen
  currentRate: bigint;         // Current exchange rate
  hasNegativeYield: boolean;   // Is current rate below watermark?
  rateDropBps: bigint;         // Drop in basis points (0 if no drop)
}

/**
 * Hook to monitor SY exchange rate watermark for negative yield detection
 */
export function useSyWatermark(syAddress: string | undefined) {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['sy', 'watermark', syAddress],
    queryFn: async (): Promise<SyWatermarkInfo> => {
      if (!syAddress) throw new Error('SY address required');

      const sy = getSYContract(syAddress, provider);
      const [watermark, currentRate] = await Promise.all([
        sy.get_exchange_rate_watermark(),
        sy.exchange_rate(),
      ]);

      const hasNegativeYield = currentRate < watermark;
      let rateDropBps = 0n;

      if (hasNegativeYield && watermark > 0n) {
        // Calculate drop in basis points: (watermark - current) * 10000 / watermark
        rateDropBps = ((watermark - currentRate) * 10000n) / watermark;
      }

      return {
        watermark,
        currentRate,
        hasNegativeYield,
        rateDropBps,
      };
    },
    enabled: !!syAddress,
    staleTime: 60_000, // 1 minute - rates change slowly
  });
}
```

---

## Error Handling Updates

### `src/shared/lib/errors.ts` - Add SY Errors

```typescript
// Add to CONTRACT_ERROR_MESSAGES:
'HZN: insufficient shares out': 'Slippage exceeded on wrap. Try increasing slippage tolerance.',
'HZN: insufficient token out': 'Slippage exceeded on unwrap. Try increasing slippage tolerance.',
'Pausable: paused': 'This token is temporarily paused. Withdrawals are still available.',

// Add to CONTRACT_ERROR_SIMPLE:
'HZN: insufficient shares out': 'Price changed too much during wrap. Please try again.',
'HZN: insufficient token out': 'Price changed too much during unwrap. Please try again.',
'Pausable: paused': 'This token is temporarily paused.',

// Add to CONTRACT_ERROR_HELP:
'HZN: insufficient shares out': {
  simple: 'The exchange rate changed while wrapping. Try again.',
  advanced: 'Increase slippage tolerance in settings or try a smaller amount.',
},
'HZN: insufficient token out': {
  simple: 'The exchange rate changed while unwrapping. Try again.',
  advanced: 'Increase slippage tolerance in settings or try a smaller amount.',
},
'Pausable: paused': {
  simple: 'This token is temporarily paused for safety. You can still withdraw.',
  advanced: 'Deposits and transfers are blocked. Redemptions remain available.',
},
```

### Pause State Checking (Optional but Recommended)

To provide a better UX, check pause state before allowing deposits/transfers:

```typescript
// src/features/yield/model/useSyPauseState.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { getSYContract } from '@shared/starknet/contracts';
import { useStarknet } from '@features/wallet';

/**
 * Hook to check if an SY contract is paused
 */
export function useSyPauseState(syAddress: string | undefined) {
  const { provider } = useStarknet();

  return useQuery({
    queryKey: ['sy', 'paused', syAddress],
    queryFn: async (): Promise<boolean> => {
      if (!syAddress) return false;

      const sy = getSYContract(syAddress, provider);
      return await sy.is_paused();
    },
    enabled: !!syAddress,
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: true, // Important for pause state
  });
}
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
- [ ] Add `Pausable: paused` error handling to `errors.ts` **(Phase 4)**

### P1: SYWithRewards Support

- [ ] Add `getSYWithRewardsContract()` to `contracts.ts`
- [ ] Export `SYWITHREWARDS_ABI` from generated types (already done)
- [ ] Create `features/rewards/` module with hooks
- [ ] Add rewards error messages to `errors.ts`

### P2: Enhanced Features

- [ ] Add `useSyPreview` hook for accurate slippage
- [ ] Add `useSyTokenValidation` hook for input validation
- [ ] Add `useSyAssetInfo` hook for asset metadata
- [ ] Add `useSyPauseState` hook for pause state checking **(Phase 4)**
- [ ] Add `useSyWatermark` hook for negative yield monitoring **(Phase 4)**

### P3: UI Features (Future)

- [ ] Rewards claiming UI component
- [ ] Accrued rewards display in portfolio
- [ ] Asset type badge (Token vs Liquidity) in market cards
- [ ] "Min received" display in wrap/unwrap forms
- [ ] Paused state warning banner **(Phase 4)**
- [ ] Negative yield warning indicator **(Phase 4)**

### P4: Indexer Updates (Phase 4)

- [ ] Index `NegativeYieldDetected` events for monitoring
- [ ] Index `Paused`/`Unpaused` events for pause state tracking
- [ ] Index `RewardsClaimed` events for reward history
- [ ] Index `RewardIndexUpdated` events for APY calculation

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
- Line ~237: `deposit(receiver, amount_shares_to_deposit, min_shares_out)` ✓
- Line ~261: `redeem(receiver, amount_sy_to_redeem, min_token_out, burn_from_internal_balance)` ✓
- Line ~311: `get_tokens_in()` ✓
- Line ~321: `get_tokens_out()` ✓
- Line ~333: `is_valid_token_in(token)` ✓
- Line ~348: `is_valid_token_out(token)` ✓
- Line ~363: `asset_info()` ✓
- Line ~374: `preview_deposit(amount_to_deposit)` ✓
- Line ~388: `preview_redeem(amount_sy)` ✓
- Line ~398: `get_exchange_rate_watermark()` ✓ **(Phase 4)**
- Line ~64: `AssetType` enum (Token, Liquidity) ✓
- Line ~1099: `NegativeYieldDetected` event ✓ **(Phase 4)**

**SYWITHREWARDS_ABI (`src/types/generated/SYWithRewards.ts`):**
- Line ~237: `deposit(receiver, amount_shares_to_deposit, min_shares_out)` ✓
- Line ~261: `redeem(receiver, amount_sy_to_redeem, min_token_out, burn_from_internal_balance)` ✓
- Line ~408: `get_exchange_rate_watermark()` ✓ **(Phase 4)**
- Line ~419: `get_reward_tokens()` ✓
- Line ~430: `claim_rewards(user)` ✓
- Line ~446: `accrued_rewards(user)` ✓
- Line ~462: `reward_index(token)` ✓
- Line ~478: `user_reward_index(user, token)` ✓
- Line ~498: `is_reward_token(token)` ✓
- Line ~514: `reward_tokens_count()` ✓
- Line ~679: `is_paused()` ✓ **(Phase 4)**
- Line ~536: `pause()` / `unpause()` (admin) ✓ **(Phase 4)**
- Line ~1219: `NegativeYieldDetected` event ✓ **(Phase 4)**
- Line ~1283: `RewardsClaimed` event ✓
- Line ~1310: `RewardIndexUpdated` event ✓
- Line ~1347: `RewardTokenAdded` event ✓
- Line ~966: `Paused` / `Unpaused` events ✓ **(Phase 4)**

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
| 2025-12-31 | Phase 4 complete | Pausable transfers and negative yield watermark |
| 2025-12-31 | Add `Pausable: paused` error handling | Required for graceful UX when SY is paused |
| 2025-12-31 | Watermark hook is optional | Useful for monitoring but not critical path |
| 2025-12-31 | Redemptions always work when paused | Critical safety feature - users can always exit |
| 2025-12-31 | NegativeYieldDetected for indexer | Off-chain monitoring capability for unhealthy assets |

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

// Phase 4: Watermark & Pausable
get_exchange_rate_watermark() → u256  // Highest rate ever seen
is_paused() → bool                     // Check if contract is paused
pause()                                // Admin: pause deposits/transfers
unpause()                              // Admin: unpause contract
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

---

## Appendix B: Phase 4 Events

### NegativeYieldDetected Event

Emitted when the exchange rate drops below the watermark (highest rate ever seen):

```typescript
interface NegativeYieldDetected {
  sy: ContractAddress;         // SY contract address (indexed)
  underlying: ContractAddress; // Underlying asset address (indexed)
  watermark_rate: u256;        // Previous high water mark
  current_rate: u256;          // Current (lower) rate
  rate_drop_bps: u256;         // Drop in basis points
  timestamp: u64;
}
```

### Pause Events

```typescript
interface Paused {
  account: ContractAddress;    // Who paused the contract
}

interface Unpaused {
  account: ContractAddress;    // Who unpaused the contract
}
```

### Reward Events (SYWithRewards only)

```typescript
interface RewardsClaimed {
  user: ContractAddress;       // User who claimed (indexed)
  reward_token: ContractAddress; // Reward token (indexed)
  amount: u256;
  timestamp: u64;
}

interface RewardIndexUpdated {
  reward_token: ContractAddress; // Reward token (indexed)
  old_index: u256;
  new_index: u256;
  rewards_added: u256;
  total_supply: u256;
  timestamp: u64;
}

interface RewardTokenAdded {
  reward_token: ContractAddress; // Reward token (indexed)
  index: u32;
  timestamp: u64;
}
```
