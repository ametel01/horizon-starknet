## Phase 1: RouterStatic Contract Integration **COMPLETE**

Deploy RouterStatic contract and integrate it into the frontend for preview functions.

**[BLOCKED]**: RouterStatic contract exists in the contracts layer (`contracts/src/router_static.cairo`) and frontend TypeScript integration is complete, but RouterStatic is NOT deployed on any network (all address files show `"0x0"`).

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 1: Generate RouterStatic TypeScript ABI **COMPLETE**

#### Goal
Create TypeScript ABI types for RouterStatic contract to enable type-safe preview function calls.

#### Files
- `packages/frontend/src/types/generated/RouterStatic.ts` - ABI export file (312 lines)
- `packages/frontend/src/types/generated/index.ts` - Exports `ROUTERSTATIC_ABI` (line 23)

#### Prerequisites
- RouterStatic contract must be built so ABI exists in `contracts/target/dev/horizon_RouterStatic.contract_class.json`
- Run `bun run codegen` in packages/frontend to auto-generate from ABI

#### Validation
```bash
grep -q "ROUTERSTATIC_ABI" packages/frontend/src/types/generated/index.ts && echo "OK"
```

#### Failure modes
- ABI JSON not available in contracts build output
- Type generation mismatch with actual contract interface

---

### Step 2: Add RouterStatic address to network config **COMPLETE**

#### Goal
Add routerStatic contract address field to all network address configurations.

#### Files
- `packages/frontend/src/shared/config/addresses.ts` - `routerStatic` field in `ContractAddresses` interface (line 246) and all network configs (lines 274, 281, 288, 295)
- `deploy/addresses/devnet.json` - RouterStatic in contracts object (line 22, currently `"0x0"`)
- `deploy/addresses/sepolia.json` - RouterStatic contract address (currently `"0x0"`)
- `deploy/addresses/mainnet.json` - RouterStatic contract address (currently `"0x0"`)
- `deploy/addresses/fork.json` - RouterStatic contract address (currently `"0x0"`)

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
- `packages/frontend/src/shared/starknet/contracts.ts` - `getRouterStaticContract()` function (lines 90-104) and `TypedRouterStatic` type alias (line 26)

#### Validation
```bash
grep -q "getRouterStaticContract" packages/frontend/src/shared/starknet/contracts.ts && echo "OK"
```

#### Failure modes
- Null address check missing for networks without RouterStatic deployed (already handled - returns null if address is `0x0`)
- Type import path incorrect for ROUTERSTATIC_ABI

---

## Phase 2: Single-Sided Liquidity Removal Hooks **COMPLETE**

Add missing removal hooks to complete the single-sided liquidity feature set.

**Current state**: `useSingleSidedLiquidity.ts` (390 lines) has `useAddLiquiditySingleSy`, `useAddLiquiditySinglePt`, `buildAddLiquiditySingleSyCalls`, and `buildAddLiquiditySinglePtCalls`. Removal hooks are NOT implemented (only `UseRemoveLiquiditySingleSyReturn` interface type exists but no hook implementation).

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test
```

### Step 4: Add useRemoveLiquiditySingleSy hook **COMPLETE**

#### Goal
Create hook for removing liquidity and receiving only SY tokens (no PT).

#### Files
- `packages/frontend/src/features/liquidity/model/useSingleSidedLiquidity.ts` - Add useRemoveLiquiditySingleSy hook following useAddLiquiditySingleSy pattern

#### Router function
`remove_liquidity_single_sy` (line 234 in i_router.cairo)

```cairo
fn remove_liquidity_single_sy(
    ref self: TContractState,
    market: ContractAddress,
    receiver: ContractAddress,
    lp_to_burn: u256,
    min_sy_out: u256,
    deadline: u64,
) -> u256;
```

#### Validation
```bash
grep -q "useRemoveLiquiditySingleSy" packages/frontend/src/features/liquidity/model/useSingleSidedLiquidity.ts && echo "OK"
```

#### Failure modes
- Router function signature mismatch (params: market, receiver, lp_to_burn, min_sy_out, deadline)
- Optimistic update incorrectly increases LP balance instead of decreasing
- Missing LP token approval before burn

---

### Step 5: Add useRemoveLiquiditySinglePt hook **COMPLETE**

#### Goal
Create hook for removing liquidity and receiving only PT tokens (no SY).

#### Files
- `packages/frontend/src/features/liquidity/model/useSingleSidedLiquidity.ts` - Add useRemoveLiquiditySinglePt hook

#### Router function
`remove_liquidity_single_pt` (line 250 in i_router.cairo)

```cairo
fn remove_liquidity_single_pt(
    ref self: TContractState,
    market: ContractAddress,
    receiver: ContractAddress,
    lp_to_burn: u256,
    min_pt_out: u256,
    deadline: u64,
) -> u256;
```

#### Validation
```bash
grep -q "useRemoveLiquiditySinglePt" packages/frontend/src/features/liquidity/model/useSingleSidedLiquidity.ts && echo "OK"
```

#### Failure modes
- Query key inconsistency with existing hooks
- Missing LP token approval before burn

---

### Step 6: Add build helper functions for single-sided removal **COMPLETE**

#### Goal
Create buildRemoveLiquiditySingleSyCalls and buildRemoveLiquiditySinglePtCalls for gas estimation.

#### Files
- `packages/frontend/src/features/liquidity/model/useSingleSidedLiquidity.ts` - Add buildRemoveLiquiditySingle* helper functions following existing buildAddLiquiditySingle* pattern (lines 320-389)

#### Validation
```bash
grep -q "buildRemoveLiquiditySingleSyCalls" packages/frontend/src/features/liquidity/model/useSingleSidedLiquidity.ts && echo "OK"
```

#### Failure modes
- Calldata encoding differs from add operations
- Missing LP approval call in build helper

---

### Step 7: Export new hooks from liquidity feature **COMPLETE**

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

## Phase 3: Token Aggregation Types and Infrastructure **COMPLETE**

Define TypeScript types and infrastructure for token aggregation operations.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 8: Create token aggregation types **COMPLETE**

#### Goal
Define TypeScript interfaces for TokenInput, TokenOutput, SwapData, and ApproxParams matching Cairo structs from i_router.cairo.

#### Files
- `packages/frontend/src/features/swap/model/types.ts` - Create new file with TokenInput, TokenOutput, SwapData, ApproxParams interfaces

#### Cairo struct reference (from i_router.cairo lines 7-59):
```cairo
struct SwapData { aggregator: ContractAddress, calldata: Span<felt252> }  // lines 7-10
struct TokenInput { token: ContractAddress, amount: u256, swap_data: SwapData }  // lines 17-21
struct TokenOutput { token: ContractAddress, min_amount: u256, swap_data: SwapData }  // lines 28-32
struct ApproxParams { guess_min: u256, guess_max: u256, guess_offchain: u256, max_iteration: u256, eps: u256 }  // lines 53-59
```

#### Validation
```bash
test -f packages/frontend/src/features/swap/model/types.ts && echo "OK"
```

#### Failure modes
- Field order differs from Cairo Serde encoding
- BigInt vs string representation mismatch

---

### Step 9: Create calldata serialization utilities **COMPLETE**

#### Goal
Add utility functions to serialize TokenInput/TokenOutput/ApproxParams to Starknet calldata format.

#### Files
- `packages/frontend/src/features/swap/lib/calldata.ts` - Create serialization functions: serializeTokenInput, serializeTokenOutput, serializeSwapData, serializeApproxParams

#### Note
`packages/frontend/src/features/swap/lib/` exists with `swapFormLogic.ts` (657 lines)

#### Validation
```bash
test -f packages/frontend/src/features/swap/lib/calldata.ts && echo "OK"
```

#### Failure modes
- U256 serialization order (low, high) incorrect
- Span<felt252> encoding for calldata field

---

### Step 10: Export types from swap feature **COMPLETE**

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

## Phase 4: Token-to-PT/YT Swap Hooks **COMPLETE**

Implement hooks for swapping arbitrary tokens to PT/YT via external aggregators.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 11: Create useSwapTokenForPt hook **COMPLETE**

#### Goal
Implement hook for swapping any token to PT via aggregator (token -> underlying -> SY -> PT).

#### Files
- `packages/frontend/src/features/swap/model/useTokenSwap.ts` - Create useSwapTokenForPt hook using `swap_exact_token_for_pt` router function

#### Router function
`swap_exact_token_for_pt` (line 488 in i_router.cairo)

#### Validation
```bash
grep -q "useSwapTokenForPt" packages/frontend/src/features/swap/model/useTokenSwap.ts && echo "OK"
```

#### Failure modes
- TokenInput serialization incorrect for router call
- Missing approval for input token to aggregator

---

### Step 12: Create useSwapPtForToken hook **COMPLETE**

#### Goal
Implement hook for swapping PT to any token via aggregator (PT -> SY -> underlying -> token).

#### Files
- `packages/frontend/src/features/swap/model/useTokenSwap.ts` - Add useSwapPtForToken hook using `swap_exact_pt_for_token` router function

#### Router function
`swap_exact_pt_for_token` (line 505 in i_router.cairo)

#### Validation
```bash
grep -q "useSwapPtForToken" packages/frontend/src/features/swap/model/useTokenSwap.ts && echo "OK"
```

#### Failure modes
- TokenOutput min_amount not enforced correctly
- PT approval missing before swap

---

### Step 13: Create useSwapTokenForYt hook **COMPLETE**

#### Goal
Implement hook for swapping any token to YT via aggregator.

#### Files
- `packages/frontend/src/features/swap/model/useTokenYtSwap.ts` - Create useSwapTokenForYt hook using `swap_exact_token_for_yt` router function

#### Router function
`swap_exact_token_for_yt` (line 523 in i_router.cairo)

#### Validation
```bash
grep -q "useSwapTokenForYt" packages/frontend/src/features/swap/model/useTokenYtSwap.ts && echo "OK"
```

#### Failure modes
- YT address parameter required (differs from PT swap signature)
- Flash swap mechanism not accounted for in optimistic updates

---

### Step 14: Create useSwapYtForToken hook **COMPLETE**

#### Goal
Implement hook for swapping YT to any token via aggregator.

#### Files
- `packages/frontend/src/features/swap/model/useTokenYtSwap.ts` - Add useSwapYtForToken hook using `swap_exact_yt_for_token` router function

#### Router function
`swap_exact_yt_for_token` (line 544 in i_router.cairo)

#### Validation
```bash
grep -q "useSwapYtForToken" packages/frontend/src/features/swap/model/useTokenYtSwap.ts && echo "OK"
```

#### Failure modes
- max_sy_collateral calculation incorrect
- SY collateral approval missing

---

### Step 15: Export token swap hooks **COMPLETE**

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

## Phase 5: Token Aggregation Liquidity Hooks **COMPLETE**

Implement hooks for adding/removing liquidity with arbitrary tokens.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 16: Create useAddLiquiditySingleToken hook **COMPLETE**

#### Goal
Implement hook for adding liquidity with any token via aggregator.

#### Files
- `packages/frontend/src/features/liquidity/model/useTokenLiquidity.ts` - Create useAddLiquiditySingleToken hook using `add_liquidity_single_token` router function

#### Router function
`add_liquidity_single_token` (line 565 in i_router.cairo)

#### Validation
```bash
grep -q "useAddLiquiditySingleToken" packages/frontend/src/features/liquidity/model/useTokenLiquidity.ts && echo "OK"
```

#### Failure modes
- Return type differs from standard add liquidity (returns tuple)
- TokenInput serialization mismatch

---

### Step 17: Create useAddLiquiditySingleTokenKeepYt hook **COMPLETE**

#### Goal
Implement hook for adding liquidity while keeping minted YT tokens.

#### Files
- `packages/frontend/src/features/liquidity/model/useTokenLiquidity.ts` - Add useAddLiquiditySingleTokenKeepYt hook using `add_liquidity_single_token_keep_yt` router function

#### Router function
`add_liquidity_single_token_keep_yt` (line 584 in i_router.cairo)

#### Validation
```bash
grep -q "useAddLiquiditySingleTokenKeepYt" packages/frontend/src/features/liquidity/model/useTokenLiquidity.ts && echo "OK"
```

#### Failure modes
- min_yt_out parameter missing
- YT balance not updated in optimistic update

---

### Step 18: Create useRemoveLiquiditySingleToken hook **COMPLETE**

#### Goal
Implement hook for removing liquidity and receiving any token via aggregator.

#### Files
- `packages/frontend/src/features/liquidity/model/useTokenLiquidity.ts` - Add useRemoveLiquiditySingleToken hook using `remove_liquidity_single_token` router function

#### Router function
`remove_liquidity_single_token` (line 603 in i_router.cairo)

#### Validation
```bash
grep -q "useRemoveLiquiditySingleToken" packages/frontend/src/features/liquidity/model/useTokenLiquidity.ts && echo "OK"
```

#### Failure modes
- TokenOutput serialization for output token
- LP approval before burn missing

---

### Step 19: Export token liquidity hooks **COMPLETE**

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

## Phase 6: ApproxParams Support for Existing Hooks **COMPLETE**

Add optional ApproxParams support to existing swap and liquidity hooks.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 20: Add ApproxParams to swap_exact_sy_for_pt **COMPLETE**

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

### Step 21: Add ApproxParams to add_liquidity_single_sy **COMPLETE**

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

### Step 22: Export ApproxParams hooks **COMPLETE**

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

## Phase 7: RouterStatic Preview Hooks **COMPLETE**

Create query hooks using RouterStatic for preview functions.

**[BLOCKED]**: Requires RouterStatic deployment. TypeScript infrastructure is complete (Phase 1), but contract not deployed on any network.

### Phase Validation
```bash
cd packages/frontend && bun run check
```

### Step 23: Create useMarketExchangeRates hook **COMPLETE**

#### Goal
Create query hook for fetching PT/SY, LP/SY, and LP/PT exchange rates from RouterStatic.

**Note**: `useMarketRates` already exists in `packages/frontend/src/features/markets/model/useMarketRates.ts` but fetches historical rate data from the indexer API (`/api/markets/{marketAddress}/rates`), not live exchange rates from RouterStatic.

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

### Step 24: Create useSwapPreview hook **COMPLETE**

#### Goal
Create query hook for previewing swap outputs using RouterStatic.

#### Files
- `packages/frontend/src/features/swap/model/useSwapPreview.ts` - Create useSwapPreview hook calling `preview_swap_exact_sy_for_pt` and `preview_swap_exact_pt_for_sy`

#### RouterStatic functions (from i_router_static.cairo)
- `preview_swap_exact_sy_for_pt(market, sy_in)` - lines 62-64
- `preview_swap_exact_pt_for_sy(market, pt_in)` - lines 70-72

#### Validation
```bash
grep -q "preview_swap_exact" packages/frontend/src/features/swap/model/useSwapPreview.ts && echo "OK"
```

#### Failure modes
- Network without RouterStatic returns undefined
- Stale data not invalidated on market state change

---

### Step 25: Create useLiquidityPreview hook **COMPLETE**

#### Goal
Create query hook for previewing liquidity add/remove outputs.

#### Files
- `packages/frontend/src/features/liquidity/model/useLiquidityPreview.ts` - Create useLiquidityPreview hook calling `preview_add_liquidity_single_sy` and `preview_remove_liquidity_single_sy`

#### RouterStatic functions (from i_router_static.cairo)
- `preview_add_liquidity_single_sy(market, sy_in)` - lines 81-83
- `preview_remove_liquidity_single_sy(market, lp_in)` - lines 92-94

#### Validation
```bash
grep -q "preview_add_liquidity_single_sy\|preview_remove_liquidity_single_sy" packages/frontend/src/features/liquidity/model/useLiquidityPreview.ts && echo "OK"
```

#### Failure modes
- LP amount units inconsistent with UI display
- Preview stale after market trade

---

### Step 26: Create useMarketInfo hook **COMPLETE**

#### Goal
Create query hook for fetching comprehensive market state from RouterStatic.

**Note**: A `useMarketInfo()` function already exists in `packages/frontend/src/features/markets/model/useMarket.ts` (not a separate file) but fetches basic market info from contract calls, not the full `MarketInfo` struct from RouterStatic.

#### Files
- `packages/frontend/src/features/markets/model/useMarketInfoStatic.ts` - Create hook calling `get_market_info` (use different name to avoid conflict with existing `useMarketInfo`)

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
grep -q "get_market_info" packages/frontend/src/features/markets/model/useMarketInfoStatic.ts && echo "OK"
```

#### Failure modes
- MarketInfo struct fields not matching TypeScript interface
- Expiry timestamp format mismatch

---

### Step 27: Export preview hooks **COMPLETE**

#### Goal
Export all new preview hooks from their respective features.

#### Files
- `packages/frontend/src/features/swap/model/index.ts` - Add export for useSwapPreview
- `packages/frontend/src/features/liquidity/model/index.ts` - Add export for useLiquidityPreview
- `packages/frontend/src/features/markets/model/index.ts` - Add exports for useMarketExchangeRates and useMarketInfoStatic (currently exports useMarket, useMarketRates, useMarkets)

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Missing re-export from feature index

---

## Phase 8: Final Validation and Type Safety **COMPLETE**

Run comprehensive type checking and ensure all exports are correct.

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test
```

### Step 28: Verify all new hooks export correctly **COMPLETE**

#### Goal
Ensure all new hooks are accessible from feature public APIs.

#### Files
- `packages/frontend/src/features/swap/index.ts` - Verify model exports (currently: `export * from './model'` and `export * from './ui'`)
- `packages/frontend/src/features/liquidity/index.ts` - Verify model exports (currently: `export * from './model'` and `export * from './ui'`)
- `packages/frontend/src/features/markets/index.ts` - Verify model exports (currently: `export * from './api'`, `export * from './model'`, `export * from './ui'`)

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Missing barrel export
- Circular dependency introduced

---

### Step 29: Run full type check and lint **COMPLETE**

#### Goal
Verify no TypeScript errors or lint warnings in new code.

#### Files
- All new files created in phases 2-7

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Unused imports
- Type narrowing issues with optional parameters
- ESLint rule violations

---

## Phase 9: UI Integration

Wire up the new hooks to UI components. Without this phase, all hooks from Phases 2-7 are unused.

**[BLOCKED]**: Requires Phase 7 completion (RouterStatic preview hooks for live rate display).

### Phase Validation
```bash
cd packages/frontend && bun run check && bun run test && bun run test:e2e
```

### Step 30: Add single-sided removal output type selector to RemoveLiquidityForm **COMPLETE**

#### Goal
Allow users to choose between receiving SY+PT (current), SY-only, or PT-only when removing liquidity.

#### Files
- `packages/frontend/src/features/liquidity/ui/RemoveLiquidityForm.tsx` - Add output type toggle (dual/sy-only/pt-only), wire to `useRemoveLiquiditySingleSy` and `useRemoveLiquiditySinglePt` hooks from Phase 2

#### UI Changes
- Add ToggleGroup with options: "SY + PT" (default), "SY Only", "PT Only"
- Update output preview to show single token when single-sided selected
- Update button text to reflect selected mode

#### Validation
```bash
grep -q "useRemoveLiquiditySingleSy\|useRemoveLiquiditySinglePt" packages/frontend/src/features/liquidity/ui/RemoveLiquidityForm.tsx && echo "OK"
```

#### Failure modes
- Output preview not updating when toggle changes
- Wrong hook called for selected output type
- Slippage applied incorrectly for single-sided removal

---

### Step 31: Add swap preview display to SwapDetails **COMPLETE**

#### Goal
Show live swap output preview from RouterStatic before user submits transaction.

#### Files
- `packages/frontend/src/features/swap/ui/SwapDetails.tsx` - Add preview output from `useSwapPreview` hook (Phase 7), show alongside calculated output

#### UI Changes
- Add "Expected output (on-chain)" row showing RouterStatic preview
- Show loading state while preview is fetching
- Highlight discrepancy if calculated vs preview differs significantly

#### Validation
```bash
grep -q "useSwapPreview\|preview_swap" packages/frontend/src/features/swap/ui/SwapDetails.tsx && echo "OK"
```

#### Failure modes
- Preview stale after market state changes
- Loading state causes layout shift
- Preview unavailable when RouterStatic not deployed (need graceful fallback)

---

### Step 32: Add liquidity preview display to AddLiquidityForm **COMPLETE**

#### Goal
Show live LP output preview from RouterStatic for single-SY liquidity adds.

#### Files
- `packages/frontend/src/features/liquidity/ui/AddLiquidityForm.tsx` - Add preview output from `useLiquidityPreview` hook (Phase 7)

#### UI Changes
- Add "Expected LP (on-chain)" row for single-SY mode
- Show loading state while preview is fetching
- Graceful fallback when RouterStatic unavailable

#### Validation
```bash
grep -q "useLiquidityPreview\|preview_add_liquidity" packages/frontend/src/features/liquidity/ui/AddLiquidityForm.tsx && echo "OK"
```

#### Failure modes
- Preview only shown for single-SY mode (not dual-asset)
- Query key doesn't invalidate on reserve changes

---

### Step 33: Add live exchange rates to market display **COMPLETE**

#### Goal
Display live PT/SY, LP/SY, and LP/PT rates from RouterStatic in market cards and detail views.

#### Files
- `packages/frontend/src/entities/market/ui/MarketCard.tsx` - Add live rate display from `useMarketExchangeRates` hook (Phase 7)
- `packages/frontend/src/features/markets/ui/MarketRates.tsx` - Create new component for rate display grid

#### UI Changes
- Show PT/SY rate (how much SY per PT)
- Show LP/SY rate (LP value in SY terms)
- Show LP/PT rate (LP value in PT terms)
- Update rates on configurable interval (e.g., every 30s)

#### Validation
```bash
grep -q "useMarketExchangeRates\|get_pt_to_sy_rate" packages/frontend/src/entities/market/ui/MarketCard.tsx && echo "OK"
```

#### Failure modes
- Rate display flickers on refetch
- Rates show stale data after swap
- RouterStatic unavailable fallback not implemented

---

### Step 34: Create TokenAggregatorSwapForm component **COMPLETE**

#### Goal
Create new swap form variant for swapping arbitrary tokens to/from PT/YT via DEX aggregators.

#### Files
- `packages/frontend/src/features/swap/ui/TokenAggregatorSwapForm.tsx` - New form component using token aggregation hooks from Phase 4

#### UI Changes
- Token selector dropdown for input token (not just SY)
- Aggregator selection or auto-routing display
- Shows aggregator quote + market swap in combined flow
- Two-step approval flow (approve aggregator, then execute)

#### Dependencies
- `useSwapTokenForPt`, `useSwapPtForToken`, `useSwapTokenForYt`, `useSwapYtForToken` from Phase 4
- Token list from shared config

#### Validation
```bash
test -f packages/frontend/src/features/swap/ui/TokenAggregatorSwapForm.tsx && echo "OK"
```

#### Failure modes
- Token approval to wrong address (aggregator vs router)
- Aggregator calldata not properly encoded
- Slippage applied twice (aggregator + market)

---

### Step 35: Create TokenAggregatorLiquidityForm component **COMPLETE**

#### Goal
Create liquidity form variant for adding/removing liquidity with arbitrary tokens.

#### Files
- `packages/frontend/src/features/liquidity/ui/TokenAggregatorLiquidityForm.tsx` - New form component using token aggregation hooks from Phase 5

#### UI Changes
- Token selector for input token (add liquidity)
- Token selector for output token (remove liquidity)
- Option to keep YT when adding liquidity (`add_liquidity_single_token_keep_yt`)
- Shows aggregator routing + liquidity operation flow

#### Dependencies
- `useAddLiquiditySingleToken`, `useAddLiquiditySingleTokenKeepYt`, `useRemoveLiquiditySingleToken` from Phase 5

#### Validation
```bash
test -f packages/frontend/src/features/liquidity/ui/TokenAggregatorLiquidityForm.tsx && echo "OK"
```

#### Failure modes
- Keep YT option not updating expected outputs
- Wrong token approved for aggregator
- Output token not received due to aggregator routing failure

---

### Step 36: Add form mode switcher to trade page

#### Goal
Allow users to switch between standard forms and token aggregator forms.

#### Files
- `packages/frontend/src/app/trade/page.tsx` - Add tabs or toggle to switch form modes
- `packages/frontend/src/features/swap/ui/index.ts` - Export TokenAggregatorSwapForm
- `packages/frontend/src/features/liquidity/ui/index.ts` - Export TokenAggregatorLiquidityForm

#### UI Changes
- Tab group: "Standard" | "Any Token"
- Standard tab shows existing SwapForm/AddLiquidityForm/RemoveLiquidityForm
- "Any Token" tab shows TokenAggregatorSwapForm/TokenAggregatorLiquidityForm
- Persist user preference in localStorage

#### Validation
```bash
grep -q "TokenAggregatorSwapForm\|TokenAggregatorLiquidityForm" packages/frontend/src/app/trade/page.tsx && echo "OK"
```

#### Failure modes
- Form state not reset when switching tabs
- localStorage key collision with other preferences

---

### Step 37: Export new UI components from features

#### Goal
Ensure all new UI components are properly exported.

#### Files
- `packages/frontend/src/features/swap/ui/index.ts` - Add export for TokenAggregatorSwapForm (currently only exports `SwapForm`)
- `packages/frontend/src/features/liquidity/ui/index.ts` - Add export for TokenAggregatorLiquidityForm (currently exports `AddLiquidityForm`, `RemoveLiquidityForm`)
- `packages/frontend/src/features/markets/ui/index.ts` - Add export for MarketRates (currently exports `FeeStructure`)

#### Validation
```bash
cd packages/frontend && bun run check
```

#### Failure modes
- Missing re-export from feature index
- Circular dependency between ui and model

---

### Step 38: Add E2E tests for new UI flows

#### Goal
Add Playwright E2E tests for token aggregation and single-sided removal flows.

#### Files
- `packages/frontend/e2e/token-aggregator-swap.spec.ts` - Test swap with arbitrary token input
- `packages/frontend/e2e/single-sided-liquidity.spec.ts` - Test single-sided add/remove flows

#### Note
Current E2E tests in `packages/frontend/e2e/`: `fixtures.ts`, `navigation.spec.ts`, `markets.spec.ts`

#### Test Cases
- Swap ETH → PT via aggregator
- Swap PT → USDC via aggregator
- Add liquidity with ETH (not SY)
- Remove liquidity to single SY
- Remove liquidity to single PT

#### Validation
```bash
cd packages/frontend && bun run test:e2e
```

#### Failure modes
- Tests flaky due to aggregator quote timing
- Mock aggregator not returning expected calldata
