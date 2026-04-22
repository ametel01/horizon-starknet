# Frontend Integration Gaps - Research Findings

**Date:** 2025-01-18
**Status:** Implementation Complete - Documentation Updates Pending
**Scope:** Analyze frontend changes required after indexer event integration

## Executive Summary

The frontend implementation plan (`frontend-integration-gaps_plan.md`) has been **fully completed** with all 8 phases marked as done. This document now tracks **documentation updates** required to reflect the newly implemented features.

### Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Shared Utility Foundation | ✅ COMPLETE |
| Phase 2 | YT Reward Infrastructure | ✅ COMPLETE |
| Phase 3 | Combined Interest and Rewards Claim | ✅ COMPLETE |
| Phase 4 | Portfolio UI Integration | ✅ COMPLETE |
| Phase 5 | Market State Consolidation | ✅ COMPLETE |
| Phase 6 | Code Quality Improvements | ✅ COMPLETE |
| Phase 7 | APY and Portfolio Data Integration | ✅ COMPLETE |
| Phase 8 | Final Verification | ✅ COMPLETE |

### Remaining Work

| Category | Count | Description |
|----------|-------|-------------|
| Documentation Updates | 6 | User-facing docs need updates for new features |
| Missing Features | 2 | Optional advanced features not yet implemented |

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

## Part 1: Implemented Features (COMPLETE)

The following features have been implemented as part of the implementation plan.

### Feature 1: YT Reward Claiming ✅ COMPLETE

**Contract Method:** `YT.claim_rewards(user: ContractAddress) -> Span<u256>`
**Location in ABI:** `packages/frontend/src/types/generated/YT.ts:502`

**Current State:**
- SY rewards: Fully implemented (`useAccruedRewards`, `useClaimRewards`)
- Market LP rewards: Fully implemented (`useMarketAccruedRewards`, `useMarketClaimRewards`)
- **YT rewards: Fully implemented** (`useYTAccruedRewards`, `useYTClaimRewards`, `useYTRewardTokens`)

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

### Feature 2: Combined Interest + Rewards Claim ✅ COMPLETE

**Contract Method:** `YT.redeem_due_interest_and_rewards(user, do_interest, do_rewards) -> (u256, Span<u256>)`
**Location in ABI:** `packages/frontend/src/types/generated/YT.ts:518`

**Current State:**
- Interest claiming: Implemented via `useClaimYield()` in `src/features/yield/model/useYield.ts` using `redeem_due_interest()`
- Rewards claiming: Fully implemented (see Feature 1)
- Combined: Fully implemented via `useClaimInterestAndRewards()`

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

### Feature 3: Dual Token + PT Liquidity (OPTIONAL - NOT IMPLEMENTED)

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

### Feature 4: Token-to-Token Swap (OPTIONAL - NOT IMPLEMENTED)

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

## Part 2: Improvements (COMPLETE)

All improvements have been implemented.

### Improvement 1: Consolidate SLIPPAGE_OPTIONS Constant ✅ COMPLETE

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

### Improvement 2: Unified Rewards Dashboard ✅ COMPLETE

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

### Improvement 3: Type-Safe ABI Response Helper ✅ COMPLETE

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

### Improvement 4: Consolidated toBigInt Helper ✅ COMPLETE

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

### Improvement 5: Market State Consolidation ✅ COMPLETE

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

## Part 3: Fixes (COMPLETE)

All fixes have been implemented.

### Fix 1: Complete TODO Items in APY Breakdown ✅ COMPLETE

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

### Fix 2: Portfolio Position TODOs ✅ COMPLETE

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

### Fix 3: Regenerate Types After Contract Changes ✅ COMPLETE

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

## Part 4: Documentation Updates (PENDING)

The following user-facing documentation pages need updates to reflect the newly implemented features.

### Doc Update 1: guides/manage-positions/page.mdx

**File:** `packages/frontend/src/app/docs/guides/manage-positions/page.mdx`

**Current State:**
- Documents "Claiming Yield" section (lines 48-61) - only mentions interest claiming
- No mention of external rewards from YT tokens

**Required Updates:**
1. Add "Claiming YT Rewards" subsection explaining:
   - YT tokens can accumulate external reward tokens (governance tokens, incentives)
   - Rewards are separate from interest (yield from underlying)
   - How to view and claim rewards in Portfolio
2. Add "Combined Claim" subsection explaining:
   - Single-transaction claiming of both interest AND rewards
   - Gas savings benefit
3. Update Portfolio Overview table to include "Claimable Rewards" row

**Suggested Content:**
```mdx
### Claiming YT Rewards

In addition to yield from the underlying asset, YT tokens may accumulate **external rewards** such as governance tokens or protocol incentives.

#### To View Rewards
1. Go to **Portfolio**
2. Look for the **YT Rewards** section
3. View claimable amounts per reward token

#### To Claim Rewards
1. Click **Claim Rewards** in the YT Rewards section
2. Confirm transaction

<Callout type="tip">
Use **Claim All** to claim both interest and rewards in a single transaction, saving gas.
</Callout>
```

---

### Doc Update 2: mechanics/redemption/page.mdx

**File:** `packages/frontend/src/app/docs/mechanics/redemption/page.mdx`

**Current State:**
- Documents "YT Yield Collection" (lines 148-156)
- Only mentions yield (interest), not external rewards

**Required Updates:**
1. Add note that YT may also accumulate external rewards
2. Link to rewards documentation

**Suggested Addition (after line 156):**
```mdx
<Callout type="info">
YT tokens may also accumulate **external rewards** (governance tokens, incentives) separate from yield. See [Manage Positions](/docs/guides/manage-positions) for claiming rewards.
</Callout>
```

---

### Doc Update 3: how-it-works/yield-tokens/page.mdx

**File:** `packages/frontend/src/app/docs/how-it-works/yield-tokens/page.mdx`

**Current State:**
- YT section (lines 48-79) mentions collecting "ongoing yield"
- No mention of potential external rewards

**Required Updates:**
1. Add row to YT properties table for "External Rewards"
2. Add note about reward capability

**Suggested Addition to YT table:**
```mdx
<TableRow>
  <TableCell>External Rewards</TableCell>
  <TableCell>May receive protocol incentives</TableCell>
</TableRow>
```

---

### Doc Update 4: faq/page.mdx

**File:** `packages/frontend/src/app/docs/faq/page.mdx`

**Current State:**
- No FAQ about YT rewards

**Required Updates:**
Add new FAQ entry in "Tokens" section:

```mdx
### Can YT earn rewards besides yield?

Yes. Some YT tokens may accumulate **external rewards** such as governance tokens or protocol incentives. These are separate from the yield generated by the underlying asset. Check the Portfolio page for claimable rewards.
```

---

### Doc Update 5: glossary/page.mdx

**File:** `packages/frontend/src/app/docs/glossary/page.mdx`

**Current State:**
- No entry for "External Rewards" or "Reward Tokens"

**Required Updates:**
Add glossary entry in "E" section:

```mdx
### External Rewards
Additional token rewards (governance tokens, incentives) that accrue to SY, YT, or LP position holders. These are separate from yield generated by the underlying asset and must be claimed separately.
```

---

### Doc Update 6: guides/provide-liquidity/page.mdx

**File:** `packages/frontend/src/app/docs/guides/provide-liquidity/page.mdx`

**Current State:**
- "Your Returns" section (lines 59-83) lists swap fees, underlying yield, PT appreciation
- No mention of LP reward tokens

**Required Updates:**
1. Add row to returns table for "External Rewards"
2. Note that rewards are claimed separately

**Suggested Addition to table:**
```mdx
<TableRow>
  <TableCell>External rewards</TableCell>
  <TableCell>Protocol incentives (if available)</TableCell>
</TableRow>
```

**Add note after table:**
```mdx
<Callout type="info">
External rewards (if any) must be claimed separately from the Portfolio page.
</Callout>
```

---

## Documentation Priority Matrix

| Doc Update | File | Priority | Complexity |
|------------|------|----------|------------|
| Manage Positions | guides/manage-positions/page.mdx | HIGH | Medium |
| FAQ | faq/page.mdx | HIGH | Low |
| Glossary | glossary/page.mdx | MEDIUM | Low |
| Redemption | mechanics/redemption/page.mdx | MEDIUM | Low |
| Yield Tokens | how-it-works/yield-tokens/page.mdx | MEDIUM | Low |
| Provide Liquidity | guides/provide-liquidity/page.mdx | LOW | Low |

---

## Implementation Priority Matrix (ARCHIVED)

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

### Current Status

| Category | Status | Count |
|----------|--------|-------|
| Core Features | ✅ COMPLETE | 2 implemented |
| Improvements | ✅ COMPLETE | 5 implemented |
| Fixes | ✅ COMPLETE | 3 implemented |
| Documentation Updates | ⏳ PENDING | 6 pages to update |
| Optional Features | ⏸️ DEFERRED | 2 not implemented |

### What Was Implemented

1. **YT Reward Claiming** - Users can now view and claim external rewards from YT tokens
2. **Combined Interest + Rewards Claim** - Single-transaction claiming saves gas
3. **Market State Consolidation** - Reduced RPC calls from 11 to 4-5 per market
4. **Shared Utilities** - `toBigInt`, `parseReserves` helpers consolidated
5. **SLIPPAGE_OPTIONS** - Removed duplicate constant definitions
6. **APY Breakdown** - Wired up real reward data
7. **Portfolio Positions** - Connected historical claim data from indexer

### What Remains

**Documentation (6 files):**
- `guides/manage-positions/page.mdx` - Add YT rewards and combined claim docs
- `faq/page.mdx` - Add YT rewards FAQ
- `glossary/page.mdx` - Add "External Rewards" entry
- `mechanics/redemption/page.mdx` - Note about external rewards
- `how-it-works/yield-tokens/page.mdx` - Add rewards to YT properties
- `guides/provide-liquidity/page.mdx` - Add LP rewards row

**Optional Features (deferred):**
- Dual Token + PT Liquidity (`add_liquidity_dual_token_and_pt`)
- Token-to-Token Swap (`swap_tokens_to_tokens`)

### Next Steps

1. Update documentation pages with suggested content in Part 4
2. Run `bun run check` to verify no regressions
3. Optionally implement deferred features if needed
