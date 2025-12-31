# SY Frontend Impact Analysis

> **Date:** 2025-12-31
> **Status:** P0 COMPLETE | P1-P4 Optional features pending
> **Scope:** Frontend changes required after Phase 1, 2, 3 & 4 SY Contract Updates
> **Related:** `/contracts/SY_GAP_DEVELOPMENT_PLAN.md`

---

## Completion Summary

| Priority | Category | Status | Notes |
|----------|----------|--------|-------|
| **P0** | Breaking Changes | ✅ **COMPLETE** | All slippage protection and error handling implemented |
| **P1** | SYWithRewards Support | ✅ **COMPLETE** | ABI, contract helper, and hooks implemented |
| **P2** | Enhanced Features | ⏳ Pending | Optional preview/validation hooks |
| **P3** | UI Features | ⏳ Pending | Rewards UI, warnings, badges |
| **P4** | Indexer Updates | ⏳ Pending | Event indexing for monitoring |

---

## Executive Summary

**All 4 phases of contract work are COMPLETE.** The SY contracts now support:
- Multi-token deposit/redeem with slippage protection
- SYWithRewards for reward-bearing tokens (GLP-style)
- Factory deployment of both SY and SYWithRewards
- Pausable transfers (deposits/transfers blocked, redemptions always allowed)
- Negative yield detection with watermark tracking

**Frontend Status:** The TypeScript ABIs are regenerated and correct. The frontend code is **in sync** with contract ABIs for P0 critical items.

### Impact Matrix

| Contract Change | Frontend Impact | Action Required | Status |
|-----------------|-----------------|-----------------|--------|
| `deposit()` signature (3 params) | **BREAKING** | **REQUIRED** - add `min_shares_out` | ✅ Done |
| `redeem()` signature (4 params) | **BREAKING** | **REQUIRED** - add `min_token_out`, `burn_from_internal_balance` | ✅ Done |
| `preview_deposit()` added | New capability | **Recommended** for accurate slippage | ⏳ Optional |
| `preview_redeem()` added | New capability | **Recommended** for accurate slippage | ⏳ Optional |
| `get_tokens_in()` added | New capability | Optional enhancement | ⏳ Optional |
| `get_tokens_out()` added | New capability | Optional enhancement | ⏳ Optional |
| `is_valid_token_in(token)` added | New capability | **Recommended** for validation | ⏳ Optional |
| `is_valid_token_out(token)` added | New capability | **Recommended** for validation | ⏳ Optional |
| `asset_info()` added | New capability | Optional for UI | ⏳ Optional |
| `SYWithRewards` contract | **NEW** | **REQUIRED** - new contract helpers | ✅ **COMPLETE** |
| Factory `deploy_sy_with_rewards()` | **NEW** | Optional (admin only) | ⏳ Optional |
| `get_exchange_rate_watermark()` | **NEW** (Phase 4) | **Recommended** for monitoring | ⏳ Optional |
| `NegativeYieldDetected` event | **NEW** (Phase 4) | **Recommended** for indexer | ⏳ Optional |
| `is_paused()` + Pausable errors | **NEW** (Phase 4) | **REQUIRED** - error handling | ✅ Done |
| Pausable transfers | Enhanced security | Transparent (see error handling) | ✅ Done |

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

> ✅ **All P0 Breaking Changes have been implemented** (as of 2025-12-31)

### 1. `transaction-builder.ts` - `buildDepositToSyCall()` ✅

**Location:** `src/shared/starknet/transaction-builder.ts:86-105`

**Status:** ✅ IMPLEMENTED - Now accepts `minSharesOut` parameter for slippage protection.

### 2. `transaction-builder.ts` - `buildUnwrapSyCall()` ✅

**Location:** `src/shared/starknet/transaction-builder.ts:201-222`

**Status:** ✅ IMPLEMENTED - Now accepts `minTokenOut` and `burnFromInternalBalance` parameters.

### 3. `useWrapToSy.ts` - Add Slippage ✅

**Location:** `src/features/earn/model/useWrapToSy.ts`

**Status:** ✅ IMPLEMENTED - Uses `useTransactionSettings` for slippage and `calculateMinOutput` for min shares.

### 4. `useUnwrapSy.ts` - Add Slippage + Internal Balance ✅

**Location:** `src/features/redeem/model/useUnwrapSy.ts`

**Status:** ✅ IMPLEMENTED - Uses `useTransactionSettings` for slippage with `burn_from_internal_balance = false`.

### 5. `buildDepositAndEarnCalls()` - Fix SY Deposit ✅

**Location:** `src/shared/starknet/transaction-builder.ts:233-268`

**Status:** ✅ IMPLEMENTED - Passes slippage-protected min output to `buildDepositToSyCall`.

### 6. `buildWithdrawCalls()` - Fix SY Redeem ✅

**Location:** `src/shared/starknet/transaction-builder.ts:284-335`

**Status:** ✅ IMPLEMENTED - Calculates `minUnderlyingOut` with slippage and passes to `buildUnwrapSyCall`.

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

> ✅ **All error handling has been implemented** (as of 2025-12-31)

### `src/shared/lib/errors.ts` - SY Errors ✅

**Status:** ✅ IMPLEMENTED - All SY slippage and pausable errors are handled:

- `HZN: insufficient shares out` - Slippage on wrap (lines 29, 107, 473-477)
- `HZN: insufficient token out` - Slippage on unwrap (lines 30, 108, 478-482)
- `Pausable: paused` - Pause state (lines 33, 109, 188-195, 483-486)
- Helper functions: `isSlippageError()`, `isPauseError()` (lines 266-282)

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

- [x] Update `buildDepositToSyCall()` to accept `minSharesOut` parameter
- [x] Update `buildUnwrapSyCall()` to accept `minTokenOut` and `burnFromInternalBalance` parameters
- [x] Update `buildDepositAndEarnCalls()` to pass slippage to SY deposit
- [x] Update `buildWithdrawCalls()` to pass slippage to SY redeem
- [x] Update `useWrapToSy` to use `useTransactionSettings` for slippage
- [x] Update `useUnwrapSy` to use `useTransactionSettings` for slippage
- [x] Add `Pausable: paused` error handling to `errors.ts` **(Phase 4)**

### P1: SYWithRewards Support

- [x] Add `getSYWithRewardsContract()` to `contracts.ts`
- [x] Export `SYWITHREWARDS_ABI` from generated types
- [x] Create `features/rewards/` module with hooks
  - [x] `useRewardTokens` - fetch reward token addresses
  - [x] `useAccruedRewards` - fetch pending rewards for user
  - [x] `useHasClaimableRewards` - check if user has claimable rewards
  - [x] `useTotalAccruedRewards` - sum all accrued rewards
  - [x] `useClaimRewards` - claim rewards mutation
  - [x] `useClaimAllRewards` - multicall claim from multiple SY contracts
- [x] Add rewards error messages to `errors.ts` (added `isRewardError()` helper + 3 error mappings)

### P2: Enhanced Features

- [x] Add `useSyPreview` hook for accurate slippage
- [x] Add `useSyTokenValidation` hook for input validation
- [x] Add `useSyAssetInfo` hook for asset metadata
- [x] Add `useSyPauseState` hook for pause state checking **(Phase 4)**
- [x] Add `useSyWatermark` hook for negative yield monitoring **(Phase 4)**

### P3: UI Features (Future)

- [x] Rewards claiming UI component
- [x] Accrued rewards display in portfolio
- [x] Asset type badge (Token vs Liquidity) in market cards
- [x] "Min received" display in wrap/unwrap forms
- [x] Paused state warning banner **(Phase 4)**
- [x] Negative yield warning indicator **(Phase 4)**

### P4: Indexer Updates (Phase 4)

**Implementation Plan:** See `packages/indexer/P4_INDEXER_IMPLEMENTATION_PLAN.md`

#### New Database Tables

| Table | Event Source | Purpose |
|-------|--------------|---------|
| `sy_negative_yield_detected` | SYComponent | Monitor assets with negative yield |
| `sy_pause_state` | PausableComponent | Track pause/unpause history |
| `sy_rewards_claimed` | RewardManagerComponent | User reward claim history |
| `sy_reward_index_updated` | RewardManagerComponent | APY calculation data |
| `sy_reward_token_added` | RewardManagerComponent | Reward token registry |

#### New Views for Frontend

| View | Purpose |
|------|---------|
| `user_reward_history` | Aggregated reward claims per user |
| `sy_current_pause_state` | Latest pause state per SY |
| `negative_yield_alerts` | Aggregated negative yield events |
| `sy_reward_apy` | Rolling 7-day reward APY |

#### Event Structures (from contracts)

**NegativeYieldDetected** (`sy_component.cairo:143-158`):
```typescript
{
  sy: ContractAddress,           // key
  underlying: ContractAddress,   // key
  watermark_rate: u256,          // data
  current_rate: u256,            // data
  rate_drop_bps: u256,           // data
  timestamp: u64,                // data
}
```

**Paused/Unpaused** (OpenZeppelin PausableComponent):
```typescript
{
  account: ContractAddress,      // data - who triggered
}
```

**RewardsClaimed** (`reward_manager_component.cairo:85-94`):
```typescript
{
  user: ContractAddress,         // key
  reward_token: ContractAddress, // key
  amount: u256,                  // data
  timestamp: u64,                // data
}
```

**RewardIndexUpdated** (`reward_manager_component.cairo:96-106`):
```typescript
{
  reward_token: ContractAddress, // key
  old_index: u256,               // data
  new_index: u256,               // data
  rewards_added: u256,           // data
  total_supply: u256,            // data
  timestamp: u64,                // data
}
```

#### Checklist

- [ ] Add 5 new tables to indexer schema
- [ ] Add 4 new views for aggregations
- [ ] Add event selectors to constants
- [ ] Add Zod validation schemas
- [ ] Update `sy.indexer.ts` with new handlers
- [ ] Create frontend API routes (`/api/sy/[address]/pause-state`, etc.)
- [ ] Create React Query hooks (`useRewardHistory`, `useRewardApy`, etc.)
- [ ] Test with devnet and verify data flow

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
