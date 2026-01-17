## Phase 1: RouterStatic Contract Integration

Deploy RouterStatic contract and integrate it into the frontend for preview functions.

**[BLOCKED]**: RouterStatic contract exists in the contracts layer (`contracts/src/router_static.cairo`) but is NOT deployed on any network and NOT included in deploy scripts.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 1: Generate RouterStatic TypeScript ABI **COMPLETE**

#### Goal
Create TypeScript ABI types for RouterStatic contract to enable type-safe preview function calls.

#### Files
- `packages/frontend/src/types/generated/RouterStatic.ts` - Create new ABI export file following existing pattern from `Router.ts`
- `packages/frontend/src/types/generated/index.ts` - Add export for ROUTERSTATIC_ABI

#### Prerequisites
- RouterStatic must be deployed so ABI exists in `contracts/target/dev/horizon_RouterStatic.contract_class.json`
- Run `bun run codegen` in packages/frontend to auto-generate from ABI

#### Validation
```bash
grep -q "ROUTERSTATIC_ABI" packages/frontend/src/types/generated/index.ts && echo "OK"
```

#### Failure modes
- RouterStatic not deployed (blocked until deployment)
- ABI JSON not available in contracts build output
- Type generation mismatch with actual contract interface

---

### Step 2: Add RouterStatic address to network config **COMPLETE**

#### Goal
Add routerStatic contract address field to all network address configurations.

#### Files
- `packages/frontend/src/shared/config/addresses.ts` - Add routerStatic field to ContractAddresses interface and all network configs (currently lines 238-243)
- `deploy/addresses/devnet.json` - Add RouterStatic to contracts object (currently has Factory, MarketFactory, Router, PyLpOracle)
- `deploy/addresses/sepolia.json` - Add RouterStatic contract address
- `deploy/addresses/mainnet.json` - Add RouterStatic contract address
- `deploy/addresses/fork.json` - Add RouterStatic contract address

#### Validation
```bash
grep -q "routerStatic" packages/frontend/src/shared/config/addresses.ts && echo "OK"
```

#### Failure modes
- Address format mismatch between networks
- Missing address field in one network config
- ContractAddresses interface not updated

---

### Step 3: Add RouterStatic contract wrapper **COMPLETE**

#### Goal
Create typed contract wrapper for RouterStatic following existing pattern from Router/Factory wrappers in `contracts.ts`.

#### Files
- `packages/frontend/src/shared/starknet/contracts.ts` - Add `getRouterStaticContract()` function and `TypedRouterStatic` type alias following the existing pattern (e.g., `getRouterContract()` at lines 69-79)

#### Validation
```bash
grep -q "getRouterStaticContract" packages/frontend/src/shared/starknet/contracts.ts && echo "OK"
```

#### Failure modes
- Null address check missing for networks without RouterStatic deployed
- Type import path incorrect for ROUTERSTATIC_ABI

---

## Phase 2: Single-Sided Liquidity Removal Hooks

Add missing removal hooks to complete the single-sided liquidity feature set.

**Current state**: `useSingleSidedLiquidity.ts` has `useAddLiquiditySingleSy`, `useAddLiquiditySinglePt`, `buildAddLiquiditySingleSyCalls`, and `buildAddLiquiditySinglePtCalls`. Removal hooks are NOT implemented.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test
```

### Step 4: Add useRemoveLiquiditySingleSy hook

#### Goal
Create hook for removing liquidity and receiving only SY tokens (no PT).

#### Files
- `packages/frontend/src/features/liquidity/model/useSingleSidedLiquidity.ts` - Add useRemoveLiquiditySingleSy hook following useAddLiquiditySingleSy pattern (existing file, 372 lines)

#### Router function
`remove_liquidity_single_sy` (line 234 in i_router.cairo)

#### Validation
```bash
grep -q "useRemoveLiquiditySingleSy" packages/frontend/src/features/liquidity/model/useSingleSidedLiquidity.ts && echo "OK"
```

#### Failure modes
- Router function signature mismatch (remove_liquidity_single_sy params: market, receiver, lp_in, min_sy_out, deadline)
- Optimistic update incorrectly increases LP balance instead of decreasing
- Missing LP token approval before burn

---

### Step 5: Add useRemoveLiquiditySinglePt hook

#### Goal
Create hook for removing liquidity and receiving only PT tokens (no SY).

#### Files
- `packages/frontend/src/features/liquidity/model/useSingleSidedLiquidity.ts` - Add useRemoveLiquiditySinglePt hook

#### Router function
`remove_liquidity_single_pt` (line 250 in i_router.cairo)

#### Validation
```bash
grep -q "useRemoveLiquiditySinglePt" packages/frontend/src/features/liquidity/model/useSingleSidedLiquidity.ts && echo "OK"
```

#### Failure modes
- Query key inconsistency with existing hooks
- Missing LP token approval before burn

---

### Step 6: Add build helper functions for single-sided removal

#### Goal
Create buildRemoveLiquiditySingleSyCalls and buildRemoveLiquiditySinglePtCalls for gas estimation.

#### Files
- `packages/frontend/src/features/liquidity/model/useSingleSidedLiquidity.ts` - Add buildRemoveLiquiditySingle* helper functions following existing buildAddLiquiditySingle* pattern (lines 302-371)

#### Validation
```bash
grep -q "buildRemoveLiquiditySingleSyCalls" packages/frontend/src/features/liquidity/model/useSingleSidedLiquidity.ts && echo "OK"
```

#### Failure modes
- Calldata encoding differs from add operations
- Missing LP approval call in build helper

---

### Step 7: Export new hooks from liquidity feature

#### Goal
Verify new removal hooks are exported correctly.

#### Files
- `packages/frontend/src/features/liquidity/model/index.ts` - Uses wildcard export (`export * from './useSingleSidedLiquidity'`), so new hooks auto-export

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Circular import if hooks reference each other
- TypeScript export issues

---

## Phase 3: Token Aggregation Types and Infrastructure

Define TypeScript types and infrastructure for token aggregation operations.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 8: Create token aggregation types

#### Goal
Define TypeScript interfaces for TokenInput, TokenOutput, SwapData, and ApproxParams matching Cairo structs from i_router.cairo.

#### Files
- `packages/frontend/src/features/swap/model/types.ts` - Create new file with TokenInput, TokenOutput, SwapData, ApproxParams interfaces

#### Cairo struct reference (from i_router.cairo lines 6-59):
```cairo
struct SwapData { aggregator: ContractAddress, calldata: Span<felt252> }
struct TokenInput { token: ContractAddress, amount: u256, swap_data: SwapData }
struct TokenOutput { token: ContractAddress, min_amount: u256, swap_data: SwapData }
struct ApproxParams { guess_min: u256, guess_max: u256, guess_offchain: u256, max_iteration: u256, eps: u256 }
```

#### Validation
```bash
test -f packages/frontend/src/features/swap/model/types.ts && echo "OK"
```

#### Failure modes
- Field order differs from Cairo Serde encoding
- BigInt vs string representation mismatch

---

### Step 9: Create calldata serialization utilities

#### Goal
Add utility functions to serialize TokenInput/TokenOutput/ApproxParams to Starknet calldata format.

#### Files
- `packages/frontend/src/features/swap/lib/calldata.ts` - Create serialization functions: serializeTokenInput, serializeTokenOutput, serializeSwapData, serializeApproxParams

#### Note
`packages/frontend/src/features/swap/lib/` already exists with `swapFormLogic.ts`

#### Validation
```bash
test -f packages/frontend/src/features/swap/lib/calldata.ts && echo "OK"
```

#### Failure modes
- U256 serialization order (low, high) incorrect
- Span<felt252> encoding for calldata field

---

### Step 10: Export types from swap feature

#### Goal
Export new types and utilities from swap feature index.

#### Files
- `packages/frontend/src/features/swap/model/index.ts` - Add export for types (currently only exports `export * from './useSwap'`)
- `packages/frontend/src/features/swap/lib/index.ts` - Create file, export calldata utilities (does not exist)
- `packages/frontend/src/features/swap/index.ts` - Add lib export (currently exports model and ui only)

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Missing export path in tsconfig paths
- Circular dependency between model and lib

---

## Phase 4: Token-to-PT/YT Swap Hooks

Implement hooks for swapping arbitrary tokens to PT/YT via external aggregators.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 11: Create useSwapTokenForPt hook

#### Goal
Implement hook for swapping any token to PT via aggregator (token -> underlying -> SY -> PT).

#### Files
- `packages/frontend/src/features/swap/model/useTokenSwap.ts` - Create useSwapTokenForPt hook using `swap_exact_token_for_pt` router function

#### Router function
`swap_exact_token_for_pt` (exists in router interface)

#### Validation
```bash
grep -q "useSwapTokenForPt" packages/frontend/src/features/swap/model/useTokenSwap.ts && echo "OK"
```

#### Failure modes
- TokenInput serialization incorrect for router call
- Missing approval for input token to aggregator

---

### Step 12: Create useSwapPtForToken hook

#### Goal
Implement hook for swapping PT to any token via aggregator (PT -> SY -> underlying -> token).

#### Files
- `packages/frontend/src/features/swap/model/useTokenSwap.ts` - Add useSwapPtForToken hook using `swap_exact_pt_for_token` router function

#### Router function
`swap_exact_pt_for_token` (exists in router interface)

#### Validation
```bash
grep -q "useSwapPtForToken" packages/frontend/src/features/swap/model/useTokenSwap.ts && echo "OK"
```

#### Failure modes
- TokenOutput min_amount not enforced correctly
- PT approval missing before swap

---

### Step 13: Create useSwapTokenForYt hook

#### Goal
Implement hook for swapping any token to YT via aggregator.

#### Files
- `packages/frontend/src/features/swap/model/useTokenYtSwap.ts` - Create useSwapTokenForYt hook using `swap_exact_token_for_yt` router function

#### Router function
`swap_exact_token_for_yt` (exists in router interface)

#### Validation
```bash
grep -q "useSwapTokenForYt" packages/frontend/src/features/swap/model/useTokenYtSwap.ts && echo "OK"
```

#### Failure modes
- YT address parameter required (differs from PT swap signature)
- Flash swap mechanism not accounted for in optimistic updates

---

### Step 14: Create useSwapYtForToken hook

#### Goal
Implement hook for swapping YT to any token via aggregator.

#### Files
- `packages/frontend/src/features/swap/model/useTokenYtSwap.ts` - Add useSwapYtForToken hook using `swap_exact_yt_for_token` router function

#### Router function
`swap_exact_yt_for_token` (exists in router interface)

#### Validation
```bash
grep -q "useSwapYtForToken" packages/frontend/src/features/swap/model/useTokenYtSwap.ts && echo "OK"
```

#### Failure modes
- max_sy_collateral calculation incorrect
- SY collateral approval missing

---

### Step 15: Export token swap hooks

#### Goal
Export new token swap hooks from swap feature.

#### Files
- `packages/frontend/src/features/swap/model/index.ts` - Add exports for useTokenSwap and useTokenYtSwap

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Export naming collision with existing hooks

---

## Phase 5: Token Aggregation Liquidity Hooks

Implement hooks for adding/removing liquidity with arbitrary tokens.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 16: Create useAddLiquiditySingleToken hook

#### Goal
Implement hook for adding liquidity with any token via aggregator.

#### Files
- `packages/frontend/src/features/liquidity/model/useTokenLiquidity.ts` - Create useAddLiquiditySingleToken hook using `add_liquidity_single_token` router function

#### Router function
`add_liquidity_single_token` (exists in router interface)

#### Validation
```bash
grep -q "useAddLiquiditySingleToken" packages/frontend/src/features/liquidity/model/useTokenLiquidity.ts && echo "OK"
```

#### Failure modes
- Return type differs from standard add liquidity (returns tuple)
- TokenInput serialization mismatch

---

### Step 17: Create useAddLiquiditySingleTokenKeepYt hook

#### Goal
Implement hook for adding liquidity while keeping minted YT tokens.

#### Files
- `packages/frontend/src/features/liquidity/model/useTokenLiquidity.ts` - Add useAddLiquiditySingleTokenKeepYt hook using `add_liquidity_single_token_keep_yt` router function

#### Router function
`add_liquidity_single_token_keep_yt` (exists in router interface)

#### Validation
```bash
grep -q "useAddLiquiditySingleTokenKeepYt" packages/frontend/src/features/liquidity/model/useTokenLiquidity.ts && echo "OK"
```

#### Failure modes
- min_yt_out parameter missing
- YT balance not updated in optimistic update

---

### Step 18: Create useRemoveLiquiditySingleToken hook

#### Goal
Implement hook for removing liquidity and receiving any token via aggregator.

#### Files
- `packages/frontend/src/features/liquidity/model/useTokenLiquidity.ts` - Add useRemoveLiquiditySingleToken hook using `remove_liquidity_single_token` router function

#### Router function
`remove_liquidity_single_token` (exists in router interface)

#### Validation
```bash
grep -q "useRemoveLiquiditySingleToken" packages/frontend/src/features/liquidity/model/useTokenLiquidity.ts && echo "OK"
```

#### Failure modes
- TokenOutput serialization for output token
- LP approval before burn missing

---

### Step 19: Export token liquidity hooks

#### Goal
Export new token liquidity hooks from liquidity feature.

#### Files
- `packages/frontend/src/features/liquidity/model/index.ts` - Add export for useTokenLiquidity

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Type export conflicts

---

## Phase 6: ApproxParams Support for Existing Hooks

Add optional ApproxParams support to existing swap and liquidity hooks.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 20: Add ApproxParams to swap_exact_sy_for_pt

#### Goal
Create useSwapSyForPtWithApprox hook variant that accepts ApproxParams for optimized binary search.

#### Files
- `packages/frontend/src/features/swap/model/useSwapWithApprox.ts` - Create useSwapSyForPtWithApprox hook using `swap_exact_sy_for_pt_with_approx` router function

#### Router function
`swap_exact_sy_for_pt_with_approx` (line 287 in i_router.cairo)

#### Validation
```bash
grep -q "useSwapSyForPtWithApprox" packages/frontend/src/features/swap/model/useSwapWithApprox.ts && echo "OK"
```

#### Failure modes
- ApproxParams defaults (zeros) not handled correctly
- eps precision mismatch (should be WAD scaled)

---

### Step 21: Add ApproxParams to add_liquidity_single_sy

#### Goal
Create useAddLiquiditySingleSyWithApprox hook variant that accepts ApproxParams.

#### Files
- `packages/frontend/src/features/liquidity/model/useSingleSidedLiquidityWithApprox.ts` - Create useAddLiquiditySingleSyWithApprox hook using `add_liquidity_single_sy_with_approx` router function

#### Router function
`add_liquidity_single_sy_with_approx` (line 201 in i_router.cairo)

#### Validation
```bash
grep -q "useAddLiquiditySingleSyWithApprox" packages/frontend/src/features/liquidity/model/useSingleSidedLiquidityWithApprox.ts && echo "OK"
```

#### Failure modes
- Return type tuple not destructured correctly
- ApproxParams serialization order

---

### Step 22: Export ApproxParams hooks

#### Goal
Export new ApproxParams-enabled hooks from features.

#### Files
- `packages/frontend/src/features/swap/model/index.ts` - Add export for useSwapWithApprox
- `packages/frontend/src/features/liquidity/model/index.ts` - Add export for useSingleSidedLiquidityWithApprox

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Naming conflicts with base hooks

---

## Phase 7: RouterStatic Preview Hooks

Create query hooks using RouterStatic for preview functions.

**[BLOCKED]**: Requires Phase 1 completion (RouterStatic deployment and TypeScript integration).

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 23: Create useMarketExchangeRates hook

#### Goal
Create query hook for fetching PT/SY, LP/SY, and LP/PT exchange rates from RouterStatic.

**Note**: `useMarketRates` already exists in `packages/frontend/src/features/markets/model/useMarketRates.ts` but fetches historical rate data from the indexer API, not live exchange rates from RouterStatic.

#### Files
- `packages/frontend/src/features/markets/model/useMarketExchangeRates.ts` - Create hook calling RouterStatic `get_pt_to_sy_rate`, `get_lp_to_sy_rate`, `get_lp_to_pt_rate` functions

#### RouterStatic functions (from i_router_static.cairo)
- `get_pt_to_sy_rate(market)` - line 44
- `get_lp_to_sy_rate(market)` - line 50
- `get_lp_to_pt_rate(market)` - line 56

#### Validation
```bash
grep -q "get_pt_to_sy_rate\|get_lp_to_sy_rate" packages/frontend/src/features/markets/model/useMarketExchangeRates.ts && echo "OK"
```

#### Failure modes
- RouterStatic not deployed on network (need null check)
- Rate precision loss during BigInt conversion

---

### Step 24: Create useSwapPreview hook

#### Goal
Create query hook for previewing swap outputs using RouterStatic.

#### Files
- `packages/frontend/src/features/swap/model/useSwapPreview.ts` - Create useSwapPreview hook calling `preview_swap_exact_sy_for_pt` and `preview_swap_exact_pt_for_sy`

#### RouterStatic functions (from i_router_static.cairo)
- `preview_swap_exact_sy_for_pt(market, sy_in)` - line 62
- `preview_swap_exact_pt_for_sy(market, pt_in)` - line 70

#### Validation
```bash
grep -q "preview_swap_exact" packages/frontend/src/features/swap/model/useSwapPreview.ts && echo "OK"
```

#### Failure modes
- Network without RouterStatic returns undefined
- Stale data not invalidated on market state change

---

### Step 25: Create useLiquidityPreview hook

#### Goal
Create query hook for previewing liquidity add/remove outputs.

#### Files
- `packages/frontend/src/features/liquidity/model/useLiquidityPreview.ts` - Create useLiquidityPreview hook calling `preview_add_liquidity_single_sy` and `preview_remove_liquidity_single_sy`

#### RouterStatic functions (from i_router_static.cairo)
- `preview_add_liquidity_single_sy(market, sy_in)` - line 81
- `preview_remove_liquidity_single_sy(market, lp_in)` - line 92

#### Validation
```bash
grep -q "preview_add_liquidity_single_sy\|preview_remove_liquidity_single_sy" packages/frontend/src/features/liquidity/model/useLiquidityPreview.ts && echo "OK"
```

#### Failure modes
- LP amount units inconsistent with UI display
- Preview stale after market trade

---

### Step 26: Create useMarketInfo hook

#### Goal
Create query hook for fetching comprehensive market state from RouterStatic.

#### Files
- `packages/frontend/src/features/markets/model/useMarketInfo.ts` - Create useMarketInfo hook calling `get_market_info`

#### RouterStatic function (from i_router_static.cairo)
- `get_market_info(market)` - line 99, returns MarketInfo struct

#### MarketInfo struct fields (from i_router_static.cairo lines 19-34)
```cairo
pub struct MarketInfo {
    pub sy: ContractAddress,
    pub pt: ContractAddress,
    pub yt: ContractAddress,
    pub expiry: u64,
    pub is_expired: bool,
    pub sy_reserve: u256,
    pub pt_reserve: u256,
    pub total_lp: u256,
    pub ln_implied_rate: u256,
    pub pt_to_sy_rate: u256,
    pub lp_to_sy_rate: u256,
    pub scalar_root: u256,
    pub ln_fee_rate_root: u256,
}
```

#### Validation
```bash
grep -q "get_market_info" packages/frontend/src/features/markets/model/useMarketInfo.ts && echo "OK"
```

#### Failure modes
- MarketInfo struct fields not matching TypeScript interface
- Expiry timestamp format mismatch

---

### Step 27: Export preview hooks

#### Goal
Export all new preview hooks from their respective features.

#### Files
- `packages/frontend/src/features/swap/model/index.ts` - Add export for useSwapPreview
- `packages/frontend/src/features/liquidity/model/index.ts` - Add export for useLiquidityPreview
- `packages/frontend/src/features/markets/model/index.ts` - Add exports for useMarketExchangeRates and useMarketInfo (currently exports useMarket, useMarketRates, useMarkets)

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Missing re-export from feature index

---

## Phase 8: Final Validation and Type Safety

Run comprehensive type checking and ensure all exports are correct.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test
```

### Step 28: Verify all new hooks export correctly

#### Goal
Ensure all new hooks are accessible from feature public APIs.

#### Files
- `packages/frontend/src/features/swap/index.ts` - Verify model exports (currently: `export * from './model'` and `export * from './ui'`)
- `packages/frontend/src/features/liquidity/index.ts` - Verify model exports (currently: `export * from './model'` and `export * from './ui'`)
- `packages/frontend/src/features/markets/index.ts` - Verify model exports

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Missing barrel export
- Circular dependency introduced

---

### Step 29: Run full type check and lint

#### Goal
Verify no TypeScript errors or lint warnings in new code.

#### Files
- All new files created in phases 1-7

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Unused imports
- Type narrowing issues with optional parameters
- ESLint rule violations

---
