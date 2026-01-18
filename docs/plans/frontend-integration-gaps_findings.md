# Frontend Integration Gaps - Research Findings

**Date:** 2025-01-18
**Status:** Research Complete
**Scope:** Analyze frontend changes required after indexer event integration

## Executive Summary

The frontend at `packages/frontend` has not been updated to leverage some contract capabilities. This document identifies **4 missing features**, **5 improvements**, and **3 fixes** required to fully integrate with the contracts.

---

## Authoritative Files

### Contract ABIs (Generated Types)
- `packages/frontend/src/types/generated/Router.ts` - Router with liquidity functions
- `packages/frontend/src/types/generated/YT.ts` - YT with reward claiming, combined interest+rewards, and flash mint
- `packages/frontend/src/types/generated/Market.ts` - Market with get_market_state()

### Existing Feature Implementations
- `packages/frontend/src/features/rewards/model/` - SY and Market reward claiming
- `packages/frontend/src/features/yield/model/` - YT interest claiming (useClaimYield, useYieldClaimPreview)
- `packages/frontend/src/features/liquidity/model/` - Liquidity provision hooks
- `packages/frontend/src/features/swap/model/` - Token swap hooks
- `packages/frontend/src/shared/starknet/contracts.ts` - Contract factory functions

---

## Part 1: Missing New Features

### Feature 1: YT Reward Claiming (HIGH PRIORITY)

**Contract Method:** `YT.claim_rewards(user: ContractAddress) -> Span<u256>`
**Location in ABI:** `packages/frontend/src/types/generated/YT.ts:502`

**Current State:**
- SY rewards: Fully implemented (`useAccruedRewards`, `useClaimRewards`)
- Market LP rewards: Fully implemented (`useMarketAccruedRewards`, `useMarketClaimRewards`)
- **YT rewards: NOT IMPLEMENTED**

**Evidence:**
```
src/features/rewards/model/
├── useAccruedRewards.ts        # SY only
├── useClaimRewards.ts          # SY only
├── useMarketAccruedRewards.ts  # Market LP only
├── useMarketClaimRewards.ts    # Market LP only
├── useMarketRewardTokens.ts    # Market only
├── usePortfolioRewards.ts      # Aggregates SY rewards
├── useRewardApy.ts
├── useRewardHistory.ts
├── useRewardTokens.ts          # SY only
└── index.ts
```

**Implementation Required:**

1. **Create model hooks:**
   - `src/features/rewards/model/useYTAccruedRewards.ts`
   - `src/features/rewards/model/useYTClaimRewards.ts`
   - `src/features/rewards/model/useYTRewardTokens.ts`

2. **Pattern to follow:** `useMarketAccruedRewards.ts:32-72`
   ```typescript
   export function useYTAccruedRewards(ytAddress: string | undefined): UseQueryResult<AccruedReward[]> {
     const { provider } = useStarknet();
     const { address: userAddress } = useAccount();

     return useQuery({
       queryKey: ['yt-rewards', 'accrued', ytAddress, userAddress],
       queryFn: async (): Promise<AccruedReward[]> => {
         const yt = getYTContract(ytAddress, provider);
         const [tokens, amounts] = await Promise.all([
           yt.get_reward_tokens(),
           yt.accrued_rewards(userAddress),
         ]);
         // Map tokens to amounts...
       },
       enabled: !!ytAddress && !!userAddress,
     });
   }
   ```

3. **UI integration:**
   - Add to `PortfolioRewardsCard.tsx` alongside SY rewards

**Files to Create:**
- `src/features/rewards/model/useYTAccruedRewards.ts`
- `src/features/rewards/model/useYTClaimRewards.ts`
- `src/features/rewards/model/useYTRewardTokens.ts`

**Files to Modify:**
- `src/features/rewards/model/index.ts` - Export new hooks
- `src/widgets/portfolio/PortfolioRewardsCard.tsx` - Add YT rewards section

---

### Feature 2: Combined Interest + Rewards Claim (HIGH PRIORITY)

**Contract Method:** `YT.redeem_due_interest_and_rewards(user, do_interest, do_rewards) -> (u256, Span<u256>)`
**Location in ABI:** `packages/frontend/src/types/generated/YT.ts:518`

**Current State:**
- Interest claiming: Implemented via `useClaimYield()` in `src/features/yield/model/useYield.ts` using `redeem_due_interest()`
- Rewards claiming: NOT IMPLEMENTED (see Feature 1)
- Combined: NOT IMPLEMENTED

**Business Value:**
Users currently need separate transactions to claim interest and rewards. A single call:
- Reduces gas costs (1 tx vs 2)
- Improves UX
- Matches other protocols (Pendle)

**Implementation Required:**

1. **Create combined hook:**
   ```typescript
   // src/features/yield/model/useClaimInterestAndRewards.ts
   export function useClaimInterestAndRewards(ytAddress: string | undefined) {
     const buildCall = useCallback((): Call | null => {
       return {
         contractAddress: ytAddress,
         entrypoint: 'redeem_due_interest_and_rewards',
         calldata: [userAddress, true, true], // do_interest, do_rewards
       };
     }, [ytAddress, userAddress]);
     // ... execute pattern
   }
   ```

2. **UI component:**
   - Unified claim card showing both interest + rewards
   - Single "Claim All" button

**Files to Create:**
- `src/features/yield/model/useClaimInterestAndRewards.ts`

**Files to Modify:**
- `src/features/yield/model/index.ts`

---

### Feature 3: Dual Token + PT Liquidity (MEDIUM PRIORITY)

**Contract Methods:**
- `Router.add_liquidity_dual_token_and_pt(market, receiver, input, pt_amount, min_lp_out, deadline)`
- `Router.remove_liquidity_dual_token_and_pt(market, receiver, lp_to_burn, output, min_pt_out, deadline)`

**Location in ABI:** `packages/frontend/src/types/generated/Router.ts:1185, 1221`

**Current State:**
Existing liquidity options in `src/features/liquidity/model/`:
- `useLiquidity.ts` - SY + PT
- `useSingleSidedLiquidity.ts` - SY only or PT only
- `useTokenLiquidity.ts` - Any token via aggregator (token → underlying → SY → LP)
- **Missing: Dual token + PT**

**Use Case:**
Users who hold both an arbitrary token AND PT tokens can add liquidity more efficiently by:
1. Swapping token → SY (via aggregator)
2. Adding SY + PT in single transaction

**Implementation Required:**

1. **Create model hooks:**
   ```typescript
   // src/features/liquidity/model/useDualTokenPtLiquidity.ts
   export function useAddDualTokenPtLiquidity() {
     return useMutation({
       mutationFn: async (params: DualTokenPtLiquidityParams) => {
         const calls: Call[] = [];

         // Approve input token
         calls.push(approveCall);
         // Approve PT
         calls.push(ptApproveCall);
         // Add liquidity
         calls.push({
           contractAddress: routerAddress,
           entrypoint: 'add_liquidity_dual_token_and_pt',
           calldata: [...],
         });

         return account.execute(calls);
       },
     });
   }
   ```

2. **UI enhancement:**
   - Add "Advanced" tab in liquidity form
   - Allow selecting input token + PT amount

**Files to Create:**
- `src/features/liquidity/model/useDualTokenPtLiquidity.ts`
- `src/features/liquidity/model/useRemoveDualTokenPtLiquidity.ts`

**Files to Modify:**
- `src/features/liquidity/model/index.ts`

---

### Feature 4: Token-to-Token Swap (LOW PRIORITY)

**Contract Method:** `Router.swap_tokens_to_tokens(input, output, receiver, deadline) -> u256`
**Location in ABI:** `packages/frontend/src/types/generated/Router.ts:1089`

**Current State:** 
- `useSwapTokenForPt()` exists in `src/features/swap/model/useTokenSwap.ts` - swaps any token → PT
- `useSwapPtForToken()` exists in `src/features/swap/model/useTokenSwap.ts` - swaps PT → any token
- Generic token-to-token swap: NOT IMPLEMENTED

**Use Case:**
Swap any token to any other token without going through protocol tokens. Example: USDC → USDT directly.

**Note:** This is a convenience feature for aggregator integrations, not core protocol functionality. Lower priority unless aggregator partnerships are planned.

**Files to Create:**
- `src/features/swap/model/useTokenToTokenSwap.ts`

---

## Part 2: Improvements

### Improvement 1: Consolidate SLIPPAGE_OPTIONS Constant

**Issue:** Duplicate constant definition

**Locations:**
- `src/features/swap/ui/SwapForm.tsx:65-69`
- `src/features/liquidity/ui/AddLiquidityForm.tsx:43-47`

```typescript
// Both files have identical:
const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
];
```

**Fix:**
```typescript
// src/shared/config/constants.ts
export const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
] as const;
```

**Files to Create:**
- `src/shared/config/constants.ts`

**Files to Modify:**
- `src/features/swap/ui/SwapForm.tsx`
- `src/features/liquidity/ui/AddLiquidityForm.tsx`

---

### Improvement 2: Unified Rewards Dashboard

**Issue:** Rewards are fragmented across different sources without unified view

**Current State:**
- SY rewards → `PortfolioRewardsCard` (fully implemented)
- Market LP rewards → Hooks implemented (`useMarketAccruedRewards`, `useMarketClaimRewards`)
- YT rewards → Not implemented
- YT interest → Separate component (`InterestClaimPreview`)

**Improvement:**
Create unified rewards view showing:
- SY external rewards
- Market LP rewards
- YT external rewards (after Feature 1)
- YT accrued interest
- "Claim All" single transaction

**Files to Create:**
- `src/features/rewards/model/useAllRewards.ts` - Aggregate all reward sources
- `src/widgets/portfolio/AllRewardsCard.tsx` - Unified display

---

### Improvement 3: Type-Safe ABI Response Helper

**Issue:** Repeated `as unknown[]` assertions for ABI responses

**Locations (7 instances):**
- `src/features/yield/model/useTreasuryYield.ts:224`
- `src/features/yield/model/usePostExpiryStatus.ts:116`
- `src/features/markets/model/useMarket.ts:88`
- `src/features/markets/model/useMarket.ts:188`
- `src/features/markets/model/useMarkets.ts:89`
- `src/features/markets/model/useMarkets.ts:295`

**Current Pattern:**
```typescript
const reservesArr = reserves as unknown[];
const syReserve = toBigInt(reservesArr[0] as bigint | { low: bigint; high: bigint });
```

**Improvement:**
```typescript
// src/shared/lib/abi-helpers.ts
export function parseReserves(reserves: unknown): [bigint, bigint] {
  const arr = reserves as unknown[];
  return [toBigInt(arr[0]), toBigInt(arr[1])];
}

export function parseUint256Array(data: unknown): bigint[] {
  return (data as unknown[]).map(toBigInt);
}
```

**Files to Create:**
- `src/shared/lib/abi-helpers.ts`

---

### Improvement 4: Consolidated toBigInt Helper

**Issue:** `toBigInt()` helper duplicated across 21 files

**Sample Locations (non-exhaustive):**
- `src/features/markets/model/useMarket.ts:18-24`
- `src/features/markets/model/useMarkets.ts:27-33`
- `src/features/liquidity/model/useLiquidityPreview.ts:15-21`
- `src/features/rewards/model/useMarketAccruedRewards.ts:14-20`
- `src/features/portfolio/model/useTokenBalance.ts:15-21`
- `src/features/portfolio/model/useEnhancedPositions.ts:23-28`
- `src/features/yield/model/useUserYield.ts:165-174`

**Fix:**
```typescript
// src/shared/lib/uint256.ts
import { uint256 } from 'starknet';

export function toBigInt(value: bigint | { low: bigint; high: bigint }): bigint {
  if (typeof value === 'bigint') return value;
  return uint256.uint256ToBN(value);
}
```

**Files to Create:**
- `src/shared/lib/uint256.ts`

**Files to Modify:**
- All files with local `toBigInt` definitions (21 files)

---

### Improvement 5: Market State Consolidation (MEDIUM PRIORITY)

**Contract Method:** `Market.get_market_state() -> MarketState`
**Location in ABI:** `packages/frontend/src/types/generated/Market.ts:365`

**Current State:**
The `useMarket` hook at `src/features/markets/model/useMarket.ts:51-75` makes **11 separate RPC calls**:
```typescript
const [
  syAddress,       // 1. market.sy()
  ptAddress,       // 2. market.pt()
  ytAddress,       // 3. market.yt()
  expiry,          // 4. market.expiry()
  isExpiredVal,    // 5. market.is_expired()
  reserves,        // 6. market.get_reserves()
  totalLpSupply,   // 7. market.total_lp_supply()
  lnRate,          // 8. market.get_ln_implied_rate()
  feesCollected,   // 9. market.get_total_fees_collected()
  lnFeeRateRoot,   // 10. market.get_ln_fee_rate_root()
  reserveFeePercent, // 11. market.get_reserve_fee_percent()
] = await Promise.all([...]);
```

The `useMarketState` hook at lines 164-209 makes **6 separate RPC calls**.

**New Contract Method Returns:**
`MarketState` struct includes: `sy_reserve`, `pt_reserve`, `total_lp`, `scalar_root`, `initial_anchor`, `ln_fee_rate_root`, `reserve_fee_percent`, `expiry`, `last_ln_implied_rate`, `py_index`

**Implementation Required:**

1. **Refactor existing hooks:**
   - Update `useMarket` to use `get_market_state()` + minimal additional calls for addresses
   - Update `useMarketState` to use single `get_market_state()` call

**Files to Modify:**
- `src/features/markets/model/useMarket.ts` - Refactor to use single call
- `src/features/markets/model/useMarkets.ts` - Similar optimization

**Performance Impact:**
- Before: 11 RPC calls per market in `useMarket`
- After: 4-5 RPC calls per market (state + sy/pt/yt addresses)
- ~50-60% reduction in RPC calls for market data

---

## Part 3: Fixes

### Fix 1: Complete TODO Items in APY Breakdown

**Location:** `src/shared/math/apy-breakdown.ts:50,60`
```typescript
const lpRewards = 0; // TODO: Add when gauge/rewards implemented
...
rewardsApr: 0, // TODO: Add reward tracking
```

**Status:** Depends on implementing YT reward tracking (Feature 1). Once reward tracking is implemented in frontend, wire up actual reward APR calculations.

**Files to Modify:**
- `src/shared/math/apy-breakdown.ts`
- Add dependency on reward data

---

### Fix 2: Portfolio Position TODOs

**Location:** `src/features/portfolio/model/useEnhancedPositions.ts:115,122,127`
```typescript
claimed: 0n, // TODO: Track historical claims
...
fees: 0n, // TODO: Track accrued fees
...
realizedSy: 0n, // TODO: Track realized P&L
```

**Status:** Depends on indexer providing historical claim data. New indexed events make this possible.

**Files to Modify:**
- `src/features/portfolio/model/useEnhancedPositions.ts`
- Add API calls to fetch historical data from indexer

---

### Fix 3: Regenerate Types After Contract Changes

**Issue:** Types may be stale if contracts were rebuilt

**Command:**
```bash
cd packages/frontend && bun run codegen
```

**Verification:**
```bash
grep -q "get_market_state" src/types/generated/Market.ts && echo "Types up to date"
grep -q "flash_mint_py" src/types/generated/YT.ts && echo "Types up to date"
grep -q "add_liquidity_dual_token_and_pt" src/types/generated/Router.ts && echo "Types up to date"
```

**Current Status:** All types verified as up to date based on grep results.

---

## Implementation Priority Matrix

| Feature/Fix | Priority | Complexity | Dependencies | User Impact |
|-------------|----------|------------|--------------|-------------|
| YT Reward Claiming | HIGH | Medium | None | High - Users can't claim YT rewards |
| Combined Interest+Rewards | HIGH | Low | Feature 1 | High - Gas savings |
| Market State Consolidation | MEDIUM | Low | None | Medium - Performance |
| Unified Rewards Dashboard | MEDIUM | Medium | Feature 1 | Medium - UX improvement |
| Dual Token + PT Liquidity | MEDIUM | Medium | None | Low - Edge case |
| Token-to-Token Swap | LOW | Low | None | Low - Convenience |
| SLIPPAGE_OPTIONS Consolidation | LOW | Low | None | None - Code quality |
| toBigInt Consolidation | LOW | Low | None | None - Code quality |
| ABI Response Helpers | LOW | Low | None | None - Code quality |

---

## Recommended Implementation Order

### Phase 1: Core Reward Features (HIGH PRIORITY)
1. Create `useYTAccruedRewards.ts`
2. Create `useYTClaimRewards.ts`
3. Create `useYTRewardTokens.ts`
4. Add YT rewards to `PortfolioRewardsCard`
5. Create `useClaimInterestAndRewards.ts`

### Phase 2: Performance & UX (MEDIUM PRIORITY)
6. Refactor `useMarket.ts` to use `get_market_state()`
7. Create unified rewards view
8. Run `bun run codegen` to verify types

### Phase 3: Code Quality (LOW PRIORITY)
9. Create `src/shared/lib/uint256.ts` with shared `toBigInt`
10. Create `src/shared/lib/abi-helpers.ts`
11. Extract SLIPPAGE_OPTIONS to shared config
12. Clean up TODO items with real data

### Phase 4: Advanced Features (OPTIONAL)
13. Dual token + PT liquidity
14. Token-to-token swap

---

## Verification Checklist

After implementation, verify:

```bash
# Type check
cd packages/frontend && bun run check

# Tests pass
bun run test

# E2E tests
bun run test:e2e --project=chromium

# Manual verification
# 1. Connect wallet with YT position
# 2. Navigate to portfolio
# 3. Verify YT rewards displayed
# 4. Click claim and verify transaction
```

---

## Summary

| Category | Count | Description |
|----------|-------|-------------|
| Missing Features | 4 | New contract capabilities not exposed in UI |
| Improvements | 5 | UX, performance, and code quality enhancements |
| Fixes | 3 | TODOs and maintenance items |
| **Total Items** | **12** | |

**Key Insight:** The most impactful changes are enabling YT reward claiming and the combined interest+rewards claim - these directly affect user revenue collection.

**Notes on Corrections:**
- Removed "Flash Mint Integration" as a missing feature - this is an advanced/internal feature not typically exposed in user-facing UI
- Corrected line numbers to match actual codebase
- Removed incorrect reference to `InterestClaimPreview.tsx` missing a claim button - it's a display-only preview component, and `useClaimYield` is already integrated in `PortfolioPage.tsx` and `SimplePortfolio.tsx`
- Corrected the rewards model directory listing to match actual files
- Updated the count from 14 to 12 items after removing duplicates and correcting scope
- Corrected `useMarketAccruedRewards` line reference from 19-77 to 32-72
- Corrected the number of RPC calls: `useMarket` makes 11 calls, `useMarketState` makes 6 calls (not identical patterns)
- Removed estimated effort as per project guidelines
- Updated `as unknown[]` instance count from 11 to 7 based on actual grep results
