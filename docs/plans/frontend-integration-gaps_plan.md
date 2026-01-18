## Phase 1: Shared Utility Foundation

Create shared utilities that will be used by all new hooks, reducing code duplication across the codebase.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 1: Create shared uint256 conversion utility **COMPLETE**

#### Goal
Create a centralized `toBigInt` helper in shared lib to replace 21 duplicate definitions across feature files.

#### Files
- `packages/frontend/src/shared/lib/uint256.ts` - Create new file with toBigInt function and Uint256 type
- `packages/frontend/src/shared/lib/index.ts` - Add export for new uint256 module

#### Validation
```bash
grep -q "export.*toBigInt" packages/frontend/src/shared/lib/index.ts && echo "OK"
```

#### Failure modes
- Import path conflicts with existing local definitions during migration
- Type incompatibility with starknet.js Uint256 struct

---

### Step 2: Create shared ABI response helpers **COMPLETE**

#### Goal
Create type-safe helpers for parsing common ABI response patterns like reserves and amounts.

#### Files
- `packages/frontend/src/shared/lib/abi-helpers.ts` - Create parseReserves, parseUint256Array helpers
- `packages/frontend/src/shared/lib/index.ts` - Add export for abi-helpers module

#### Validation
```bash
grep -q "parseReserves" packages/frontend/src/shared/lib/abi-helpers.ts && echo "OK"
```

#### Failure modes
- Helper functions may not cover all existing usage patterns
- Type inference issues with unknown return types

---

## Phase 2: YT Reward Infrastructure

Implement YT reward hooks following the established SY rewards pattern.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test
```

### Step 3: Create useYTRewardTokens hook

#### Goal
Fetch reward token addresses from YT contract, following useRewardTokens pattern.

#### Files
- `packages/frontend/src/features/rewards/model/useYTRewardTokens.ts` - Create hook using YT.get_reward_tokens()
- `packages/frontend/src/features/rewards/model/index.ts` - Export new hook

#### Validation
```bash
grep -q "useYTRewardTokens" packages/frontend/src/features/rewards/model/index.ts && echo "OK"
```

#### Failure modes
- YT contract may not have reward tokens configured
- Address normalization issues with bigint to hex conversion

---

### Step 4: Create useYTAccruedRewards hook

#### Goal
Fetch accrued YT rewards for connected user, following useMarketAccruedRewards pattern.

#### Files
- `packages/frontend/src/features/rewards/model/useYTAccruedRewards.ts` - Create hook with query key ['yt-rewards', 'accrued', ytAddress, userAddress]
- `packages/frontend/src/features/rewards/model/index.ts` - Export new hook and YTAccruedReward type

#### Validation
```bash
grep -q "useYTAccruedRewards" packages/frontend/src/features/rewards/model/index.ts && echo "OK"
```

#### Failure modes
- Contract may return empty arrays for non-reward YTs
- Amount array ordering may not match token array ordering

---

### Step 5: Create useYTClaimRewards hook

#### Goal
Create mutation hook to claim YT rewards, following useClaimRewards pattern.

#### Files
- `packages/frontend/src/features/rewards/model/useYTClaimRewards.ts` - Create hook with claim_rewards entrypoint
- `packages/frontend/src/features/rewards/model/index.ts` - Export new hook

#### Validation
```bash
grep -q "useYTClaimRewards" packages/frontend/src/features/rewards/model/index.ts && echo "OK"
```

#### Failure modes
- Transaction may fail if no rewards to claim
- Query invalidation may not trigger refetch

---

### Step 6: Create useClaimAllYTRewards multicall hook

#### Goal
Create batch claim hook for claiming rewards from multiple YT positions in single transaction.

#### Files
- `packages/frontend/src/features/rewards/model/useYTClaimRewards.ts` - Add useClaimAllYTRewards function
- `packages/frontend/src/features/rewards/model/index.ts` - Export multicall variant

#### Validation
```bash
grep -q "useClaimAllYTRewards" packages/frontend/src/features/rewards/model/index.ts && echo "OK"
```

#### Failure modes
- Empty ytAddresses array should be handled gracefully
- Gas estimation may fail for large batches

---

## Phase 3: Combined Interest and Rewards Claim

Implement the combined claim feature using YT.redeem_due_interest_and_rewards.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test
```

### Step 7: Create useClaimInterestAndRewards hook

#### Goal
Create mutation hook for combined interest + rewards claim in single transaction.

#### Files
- `packages/frontend/src/features/yield/model/useClaimInterestAndRewards.ts` - Create hook using redeem_due_interest_and_rewards entrypoint
- `packages/frontend/src/features/yield/model/index.ts` - Export new hook

#### Validation
```bash
grep -q "useClaimInterestAndRewards" packages/frontend/src/features/yield/model/index.ts && echo "OK"
```

#### Failure modes
- Combined call may fail if either interest or rewards are zero
- Return value parsing for (u256, Span<u256>) tuple

---

### Step 8: Create useCombinedClaimPreview hook

#### Goal
Create preview hook showing combined interest + rewards with gas estimate.

#### Files
- `packages/frontend/src/features/yield/model/useCombinedClaimPreview.ts` - Create query hook aggregating interest and rewards data
- `packages/frontend/src/features/yield/model/index.ts` - Export new hook

#### Validation
```bash
grep -q "useCombinedClaimPreview" packages/frontend/src/features/yield/model/index.ts && echo "OK"
```

#### Failure modes
- Parallel fetches of interest and rewards may have timing issues
- Fee calculation needs both YT interest fee and reward values

---

## Phase 4: Portfolio UI Integration

Integrate YT rewards into the portfolio rewards display.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 9: Create usePortfolioYTRewards aggregation hook

#### Goal
Aggregate YT rewards across all user YT positions, following usePortfolioRewards pattern.

#### Files
- `packages/frontend/src/features/rewards/model/usePortfolioYTRewards.ts` - Create hook using useQueries for parallel fetching
- `packages/frontend/src/features/rewards/model/index.ts` - Export new hook and PortfolioYTRewards type

#### Validation
```bash
grep -q "usePortfolioYTRewards" packages/frontend/src/features/rewards/model/index.ts && echo "OK"
```

#### Failure modes
- Large number of YT positions may cause rate limiting
- Empty positions should not break aggregation

---

### Step 10: Add YT rewards section to PortfolioRewardsCard

#### Goal
Display YT rewards alongside existing SY rewards in portfolio view.

#### Files
- `packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx` - Add YT rewards section with separate claim button

#### Validation
```bash
grep -q "YT.*Rewards" packages/frontend/src/widgets/portfolio/PortfolioRewardsCard.tsx && echo "OK"
```

#### Failure modes
- Layout may break with multiple reward sections
- Claim buttons need distinct handlers for SY vs YT

---

## Phase 5: Market State Consolidation

Optimize RPC calls by using the consolidated get_market_state() method.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test
```

### Step 11: Refactor useMarketState to use get_market_state

#### Goal
Replace 6 individual RPC calls with single get_market_state() call.

#### Files
- `packages/frontend/src/features/markets/model/useMarket.ts` - Refactor useMarketState hook at lines 164-209

#### Validation
```bash
grep -q "get_market_state" packages/frontend/src/features/markets/model/useMarket.ts && echo "OK"
```

#### Failure modes
- MarketState struct field names may not match expected property names
- Existing consumers may expect different data shape

---

### Step 12: Refactor useMarket to use get_market_state

#### Goal
Replace 11 individual RPC calls with get_market_state() + 4 address calls (sy, pt, yt, is_expired).

#### Files
- `packages/frontend/src/features/markets/model/useMarket.ts` - Refactor main useMarket hook at lines 34-128

#### Validation
```bash
cd packages/frontend && bun run test -- --grep "useMarket"
```

#### Failure modes
- Derived values (APY, TVL) may need recalculation from new data shape
- TWAP handling may need adjustment

---

### Step 13: Refactor useMarkets batch fetching

#### Goal
Apply same optimization to batch market fetching in useMarkets hook.

#### Files
- `packages/frontend/src/features/markets/model/useMarkets.ts` - Refactor fetchMarketData function at lines 53-77

#### Validation
```bash
cd packages/frontend && bun run test -- --grep "useMarkets"
```

#### Failure modes
- Paginated fetching logic may need adjustment
- TWAP oracle fallback logic must be preserved

---

## Phase 6: Code Quality Improvements

Consolidate duplicate code and complete remaining TODO items.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 14: Migrate features/markets to shared toBigInt

#### Goal
Replace local toBigInt in market hooks with shared utility.

#### Files
- `packages/frontend/src/features/markets/model/useMarket.ts` - Import from @shared/lib
- `packages/frontend/src/features/markets/model/useMarkets.ts` - Import from @shared/lib
- `packages/frontend/src/features/markets/model/useMarketInfoStatic.ts` - Import from @shared/lib
- `packages/frontend/src/features/markets/model/useMarketExchangeRates.ts` - Import from @shared/lib

#### Validation
```bash
! grep -q "function toBigInt" packages/frontend/src/features/markets/model/useMarket.ts && echo "OK"
```

#### Failure modes
- Import path resolution issues
- Type inference may differ slightly

---

### Step 15: Migrate features/rewards to shared toBigInt

#### Goal
Replace local toBigInt in reward hooks with shared utility.

#### Files
- `packages/frontend/src/features/rewards/model/useAccruedRewards.ts` - Import from @shared/lib
- `packages/frontend/src/features/rewards/model/useMarketAccruedRewards.ts` - Import from @shared/lib
- `packages/frontend/src/features/rewards/model/usePortfolioRewards.ts` - Import from @shared/lib

#### Validation
```bash
! grep -q "function toBigInt" packages/frontend/src/features/rewards/model/useAccruedRewards.ts && echo "OK"
```

#### Failure modes
- Existing tests may depend on local function
- Edge case handling may differ between implementations

---

### Step 16: Migrate features/yield to shared toBigInt

#### Goal
Replace local toBigInt in yield hooks with shared utility.

#### Files
- `packages/frontend/src/features/yield/model/useApyBreakdown.ts` - Import from @shared/lib
- `packages/frontend/src/features/yield/model/useInterestFee.ts` - Import from @shared/lib
- `packages/frontend/src/features/yield/model/usePostExpiryStatus.ts` - Import from @shared/lib
- `packages/frontend/src/features/yield/model/useSyPreview.ts` - Import from @shared/lib
- `packages/frontend/src/features/yield/model/useSyWatermark.ts` - Import from @shared/lib
- `packages/frontend/src/features/yield/model/useTreasuryYield.ts` - Import from @shared/lib
- `packages/frontend/src/features/yield/model/useUserYield.ts` - Import from @shared/lib

#### Validation
```bash
! grep -q "function toBigInt" packages/frontend/src/features/yield/model/useUserYield.ts && echo "OK"
```

#### Failure modes
- Lenient type variant in some files may need shared utility to support all input types

---

### Step 17: Migrate remaining features to shared toBigInt

#### Goal
Replace local toBigInt in portfolio, liquidity, swap, and oracle hooks.

#### Files
- `packages/frontend/src/features/portfolio/model/useEnhancedPositions.ts` - Import from @shared/lib
- `packages/frontend/src/features/portfolio/model/usePositions.ts` - Import from @shared/lib
- `packages/frontend/src/features/portfolio/model/useTokenBalance.ts` - Import from @shared/lib
- `packages/frontend/src/features/liquidity/model/useLiquidityPreview.ts` - Import from @shared/lib
- `packages/frontend/src/features/swap/model/useSwapPreview.ts` - Import from @shared/lib
- `packages/frontend/src/features/oracle/model/useOracleStatus.ts` - Import from @shared/lib

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Test file useTokenBalance.test.ts may need its own import
- Different toBigInt variations need unified handling

---

### Step 18: Remove duplicate SLIPPAGE_OPTIONS from liquidity forms

#### Goal
Use existing SLIPPAGE_OPTIONS from tx-settings context in liquidity forms.

#### Files
- `packages/frontend/src/features/liquidity/ui/AddLiquidityForm.tsx` - Import SLIPPAGE_OPTIONS from @features/tx-settings, remove local definition
- `packages/frontend/src/features/liquidity/ui/RemoveLiquidityForm.tsx` - Import SLIPPAGE_OPTIONS from @features/tx-settings, remove local definition

#### Validation
```bash
! grep -q "const SLIPPAGE_OPTIONS" packages/frontend/src/features/liquidity/ui/AddLiquidityForm.tsx && echo "OK"
```

#### Failure modes
- tx-settings SLIPPAGE_OPTIONS has different structure (includes description)
- Simple forms may only need label/value, not full options

---

### Step 19: Remove duplicate SLIPPAGE_OPTIONS from swap form

#### Goal
Use existing SLIPPAGE_OPTIONS from tx-settings context in swap form.

#### Files
- `packages/frontend/src/features/swap/ui/SwapForm.tsx` - Import SLIPPAGE_OPTIONS from @features/tx-settings, remove local definition

#### Validation
```bash
! grep -q "const SLIPPAGE_OPTIONS" packages/frontend/src/features/swap/ui/SwapForm.tsx && echo "OK"
```

#### Failure modes
- Same structure mismatch as Step 18

---

## Phase 7: APY and Portfolio Data Integration

Wire up real data for TODO placeholders in APY and portfolio calculations.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test
```

### Step 20: Wire reward APR in apy-breakdown.ts

#### Goal
Replace hardcoded lpRewards = 0 with actual reward data from useYTAccruedRewards.

#### Files
- `packages/frontend/src/shared/math/apy-breakdown.ts` - Update calculateApyBreakdown to accept reward APR parameter

#### Validation
```bash
! grep -q "lpRewards = 0.*TODO" packages/frontend/src/shared/math/apy-breakdown.ts && echo "OK"
```

#### Failure modes
- Reward APR calculation depends on price data availability
- May need fallback to 0 if prices unavailable

---

### Step 21: Wire historical claim data in useEnhancedPositions

#### Goal
Replace TODO placeholders for claimed, fees, and realizedSy with indexed data.

#### Files
- `packages/frontend/src/features/portfolio/model/useEnhancedPositions.ts` - Add API call to fetch historical data

#### Validation
```bash
! grep -q "claimed: 0n.*TODO" packages/frontend/src/features/portfolio/model/useEnhancedPositions.ts && echo "OK"
```

#### Failure modes
- Indexer API endpoint may not exist yet
- Historical data may be incomplete for older positions

---

## Phase 8: Final Verification

Run full test suite and verify all features work correctly.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test && bun run test:e2e --project=chromium
```

### Step 22: Run type checking and linting

#### Goal
Ensure all changes pass TypeScript type checking and ESLint rules.

#### Files
- All modified files from previous phases

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Unused imports after migration
- Type errors from refactored hooks

---

### Step 23: Run unit tests

#### Goal
Ensure all existing tests pass after refactoring.

#### Files
- All test files in packages/frontend

#### Validation
```bash
cd packages/frontend && bun run test
```

#### Failure modes
- Tests may mock local toBigInt functions
- Market hook tests may expect specific RPC call counts

---

### Step 24: Run E2E tests for reward claiming

#### Goal
Verify end-to-end reward claiming flow works correctly.

#### Files
- E2E test files related to portfolio and rewards

#### Validation
```bash
cd packages/frontend && bun run test:e2e --project=chromium --grep "reward"
```

#### Failure modes
- Devnet may not have reward-bearing positions
- Transaction timing issues in E2E tests

---
