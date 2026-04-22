# 3. Router & Flash Swap Gaps

## 3.1 Router Architecture

**Implementation Status: 95%** (Core operations, single-sided liquidity, token aggregation, ApproxParams, and multicall implemented)

**Reference:** Pendle's Router contracts from [pendle-core-v2-public](https://github.com/pendle-finance/pendle-core-v2-public/tree/main/contracts/router)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Architecture | Selector-based proxy (PendleRouterV4) + action facets | Monolithic contract | ⚠️ Different |
| Contract count | Proxy + ActionStorageV4 + ~7 action modules + helpers | 1 router.cairo + 1 router_static.cairo | ⚠️ Simpler |
| Upgradeability | Selector → facet mapping (ActionStorageV4) | Single class upgrade | ⚠️ Less modular |
| ReentrancyGuard | ❌ None in router actions | ReentrancyGuardComponent | ✅ **Horizon exceeds** |
| Emergency pause | ❌ No pause | ✅ PAUSER_ROLE | ✅ **Horizon exceeds** |
| RBAC system | Ownable (selector admin only) | ✅ AccessControlComponent | ✅ **Horizon exceeds** |
| Deadline enforcement | ❌ No explicit deadline params | ✅ | ✅ **Horizon exceeds** |
| Slippage protection | ✅ min_out params | ✅ min_out params | ✅ |

**Pendle Router Contracts:**
- `PendleRouterV4.sol` - Proxy that dispatches by selector → facet mapping
- `RouterStorage.sol` - Core storage (owner + selectorToFacet)
- `ActionStorageV4.sol` - Owner admin to set selectors for facets
- `ActionSimple.sol` - Simplified swap/liquidity (no limit orders)
- `ActionSwapPTV3.sol` - PT swaps with ApproxParams + LimitOrderData
- `ActionSwapYTV3.sol` - YT swaps with flash mechanics
- `ActionAddRemoveLiqV3.sol` - Single-sided + multi-sided liquidity ops
- `ActionCallbackV3.sol` - Swap/limit-order callback handling
- `ActionMiscV3.sol` - multicall, reward redemption, misc utilities
- `ActionCrossChain.sol` - Cross-chain messaging
- `Reflector.sol` - helper for tokenized input scaling/dust sweep
- `router/base/*` + `router/swap-aggregator/*` - shared helpers and aggregator interfaces

---

## 3.2 Core Router Functions

**Implementation Status: 100%** (All basic operations implemented)

| Function | Pendle V2 | Horizon | Status |
|----------|-----------|---------|--------|
| `mintPyFromSy` | ✅ | `mint_py_from_sy` | ✅ |
| `redeemPyToSy` | ✅ | `redeem_py_to_sy` | ✅ |
| PT-only redeem post-expiry | ❌ Not in router (uses `redeemPyToSy` w/ PT+YT; `exitPostExpToSy` handles PT+LP) | `redeem_pt_post_expiry` | 🟡 Horizon-only |
| `addLiquidityDualSyAndPt` | ✅ | `add_liquidity` | ✅ |
| `removeLiquidityDualSyAndPt` | ✅ | `remove_liquidity` | ✅ |
| `swapExactPtForSy` | ✅ | `swap_exact_pt_for_sy` | ✅ |
| `swapExactSyForPt` | ✅ (ApproxParams + LimitOrderData) | `swap_exact_sy_for_pt` | ✅ |
| `swapSyForExactPt` | ❌ Not exposed (router uses exact-in + ApproxParams) | `swap_sy_for_exact_pt` | 🟡 Horizon-only |
| `swapPtForExactSy` | ❌ Not exposed (router uses exact-in) | `swap_pt_for_exact_sy` | 🟡 Horizon-only |
| `swapExactSyForYt` | ✅ | `swap_exact_sy_for_yt` | ✅ |
| `swapExactYtForSy` | ✅ | `swap_exact_yt_for_sy` | ✅ |
| Convenience wrappers | N/A | `buy_pt_from_sy`, `sell_pt_for_sy`, `mint_py_and_keep` | ✅ **Horizon exceeds** |

---

## 3.3 YT Flash Swap Pattern

**Implementation Status: Implemented (Different Approach)**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| YT swap via PT market | Flash callback | Mint → Sell PT pattern | ⚠️ Different |
| Buy YT | Flash borrow SY | `swap_exact_sy_for_yt` | ✅ Works |
| Sell YT | Flash mechanism | `swap_exact_yt_for_sy` | ✅ Works |

**Horizon's YT Swap Pattern:**
```
Buy YT (swap_exact_sy_for_yt):
1. Transfer SY from user → Router
2. Mint PT+YT from all SY
3. Sell all PT back to market for SY
4. User receives: YT + recovered SY

Sell YT (swap_exact_yt_for_sy):
1. Transfer YT from user → Router
2. Transfer SY collateral from user
3. Buy exact PT from market using SY
4. Redeem PT+YT for SY
5. User receives: net SY (redemption - collateral + refund)
```

This is functionally equivalent but uses different mechanics than Pendle's flash callback pattern.

---

## 3.4 Single-Sided Liquidity

**Implementation Status: 100%** (All single-sided operations implemented including token aggregation)

| Function | Pendle V2 | Horizon | Status |
|----------|-----------|---------|--------|
| `addLiquiditySinglePt` | ✅ | `add_liquidity_single_pt` | ✅ |
| `addLiquiditySingleSy` | ✅ | `add_liquidity_single_sy` | ✅ |
| `addLiquiditySingleToken` | ✅ | `add_liquidity_single_token` | ✅ |
| `addLiquiditySingleTokenKeepYt` | ✅ | `add_liquidity_single_token_keep_yt` | ✅ |
| `removeLiquiditySinglePt` | ✅ | `remove_liquidity_single_pt` | ✅ |
| `removeLiquiditySingleSy` | ✅ | `remove_liquidity_single_sy` | ✅ |
| `removeLiquiditySingleToken` | ✅ | `remove_liquidity_single_token` | ✅ |
| `addLiquidityDualTokenAndPt` | ✅ | ❌ None | 🟡 MEDIUM |
| `removeLiquidityDualTokenAndPt` | ✅ | ❌ None | 🟡 MEDIUM |

**Horizon Single-Sided Liquidity Implementation:**

Horizon implements all single-sided liquidity operations including token aggregation:

```cairo
// Add liquidity with only SY (auto-swaps optimal amount for PT)
fn add_liquidity_single_sy(
    market: ContractAddress,
    receiver: ContractAddress,
    amount_sy_in: u256,
    min_lp_out: u256,
    deadline: u64,
) -> (u256, u256, u256)

// Add liquidity with only SY and caller-provided binary search hints
fn add_liquidity_single_sy_with_approx(
    market: ContractAddress,
    receiver: ContractAddress,
    amount_sy_in: u256,
    min_lp_out: u256,
    approx: ApproxParams,
    deadline: u64,
) -> (u256, u256, u256)

// Add liquidity with only PT (auto-swaps optimal amount for SY)
fn add_liquidity_single_pt(
    market: ContractAddress,
    receiver: ContractAddress,
    amount_pt_in: u256,
    min_lp_out: u256,
    deadline: u64,
) -> (u256, u256, u256)

// Add liquidity using any token via external aggregator
fn add_liquidity_single_token(
    market: ContractAddress,
    receiver: ContractAddress,
    input: TokenInput,
    min_lp_out: u256,
    deadline: u64,
) -> (u256, u256, u256)

// Add liquidity using any token while keeping YT
fn add_liquidity_single_token_keep_yt(
    market: ContractAddress,
    receiver: ContractAddress,
    input: TokenInput,
    min_lp_out: u256,
    min_yt_out: u256,
    deadline: u64,
) -> (u256, u256)

// Remove liquidity to receive only SY (auto-swaps PT to SY)
fn remove_liquidity_single_sy(
    market: ContractAddress,
    receiver: ContractAddress,
    lp_to_burn: u256,
    min_sy_out: u256,
    deadline: u64,
) -> u256

// Remove liquidity to receive only PT (auto-swaps SY to PT)
fn remove_liquidity_single_pt(
    market: ContractAddress,
    receiver: ContractAddress,
    lp_to_burn: u256,
    min_pt_out: u256,
    deadline: u64,
) -> u256

// Remove liquidity and receive any token via external aggregator
fn remove_liquidity_single_token(
    market: ContractAddress,
    receiver: ContractAddress,
    lp_to_burn: u256,
    output: TokenOutput,
    deadline: u64,
) -> u256
```

**Remaining Gap - Dual Token+PT:**

Pendle's `addLiquidityDualTokenAndPt` and `removeLiquidityDualTokenAndPt` are not implemented. These allow providing both a token (converted to SY via aggregator) and PT simultaneously. Users can achieve similar results using `add_liquidity` after converting tokens manually.

**Impact:** Minor UX gap for advanced liquidity provision patterns.

---

## 3.5 Token Aggregation & Routing

**Implementation Status: 100%** (All token aggregation functions implemented)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| `TokenInput` struct | Token + aggregator swap data | `TokenInput` | ✅ |
| `TokenOutput` struct | Token + aggregator swap data | `TokenOutput` | ✅ |
| `SwapData` struct | Aggregator + calldata | `SwapData` | ✅ |
| `swapExactTokenForPt` | Any token → PT | `swap_exact_token_for_pt` | ✅ |
| `swapExactPtForToken` | PT → any token | `swap_exact_pt_for_token` | ✅ |
| `swapExactTokenForYt` | Any token → YT | `swap_exact_token_for_yt` | ✅ |
| `swapExactYtForToken` | YT → any token | `swap_exact_yt_for_token` | ✅ |
| `swapTokensToTokens` | General aggregator routing | ❌ None | 🟡 MEDIUM |
| Aggregator integration | Kyber, 1inch, etc. | Compatible (Fibrous, AVNU) | ✅ |

**Horizon Token Aggregation Implementation:**

Horizon's router supports arbitrary token swaps via external aggregators (e.g., Fibrous, AVNU):

```cairo
// Aggregator swap configuration
struct SwapData {
    aggregator: ContractAddress,  // DEX aggregator contract
    calldata: Span<felt252>,      // Encoded swap calldata
}

// Input token to swap via aggregator
struct TokenInput {
    token: ContractAddress,       // ERC20 token address
    amount: u256,                 // Amount to swap
    swap_data: SwapData,          // Aggregator routing data
}

// Output token to receive via aggregator
struct TokenOutput {
    token: ContractAddress,       // ERC20 token address
    min_amount: u256,             // Minimum to receive (slippage)
    swap_data: SwapData,          // Aggregator routing data
}
```

**Token → PT/YT Functions:**

```cairo
// token → aggregator → underlying → SY → market → PT
fn swap_exact_token_for_pt(
    market: ContractAddress,
    receiver: ContractAddress,
    input: TokenInput,
    min_pt_out: u256,
    deadline: u64,
) -> u256

// PT → market → SY → redeem → underlying → aggregator → token
fn swap_exact_pt_for_token(
    market: ContractAddress,
    receiver: ContractAddress,
    exact_pt_in: u256,
    output: TokenOutput,
    deadline: u64,
) -> u256

// token → aggregator → underlying → SY → mint PT+YT → sell PT → YT
fn swap_exact_token_for_yt(
    yt: ContractAddress,
    market: ContractAddress,
    receiver: ContractAddress,
    input: TokenInput,
    min_yt_out: u256,
    deadline: u64,
) -> u256

// YT + collateral → buy PT → redeem → SY → underlying → aggregator → token
fn swap_exact_yt_for_token(
    yt: ContractAddress,
    market: ContractAddress,
    receiver: ContractAddress,
    exact_yt_in: u256,
    max_sy_collateral: u256,
    output: TokenOutput,
    deadline: u64,
) -> u256
```

**Remaining Gap - Generic Token-to-Token:**

Pendle's `swapTokensToTokens` for general aggregator routing is not implemented. This is a convenience function that doesn't involve PT/YT - users can call aggregators directly.

**Impact:** Users can one-click into PT/YT/LP positions from any token. Full UX parity with Pendle for protocol operations.

---

## 3.6 ApproxParams (Binary Search Parameters)

**Implementation Status: 100%** (Caller-provided hints fully supported)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| ApproxParams struct | guessMin, guessMax, maxIteration, eps | `ApproxParams` | ✅ |
| Caller-provided hints | ✅ Frontend can optimize | ✅ `_with_approx` variants | ✅ |
| Binary search iterations | Configurable (5-20) | Configurable (default: 20) | ✅ |
| Epsilon tolerance | Configurable | Configurable (default: 1e15 = 0.1%) | ✅ |

**Horizon ApproxParams Implementation:**

Horizon provides the same caller-provided binary search hints as Pendle:

```cairo
/// Approximation parameters for binary search in swap/liquidity calculations
/// Matches Pendle's ApproxParams design for caller-provided search hints
struct ApproxParams {
    guess_min: u256,      // Lower bound for binary search (0 = use default)
    guess_max: u256,      // Upper bound for binary search (0 = use default)
    guess_offchain: u256, // Off-chain computed guess for faster convergence (0 = no hint)
    max_iteration: u256,  // Maximum binary search iterations (default: 20)
    eps: u256,            // Precision threshold in WAD (1e15 = 0.1% precision)
}
```

**Functions with ApproxParams Support:**

```cairo
// Optimized SY→PT swap with caller-provided hints
fn swap_exact_sy_for_pt_with_approx(
    market: ContractAddress,
    receiver: ContractAddress,
    exact_sy_in: u256,
    min_pt_out: u256,
    approx: ApproxParams,
    deadline: u64,
) -> u256

// Optimized single-sided LP add with caller-provided hints
fn add_liquidity_single_sy_with_approx(
    market: ContractAddress,
    receiver: ContractAddress,
    amount_sy_in: u256,
    min_lp_out: u256,
    approx: ApproxParams,
    deadline: u64,
) -> (u256, u256, u256)
```

**Usage Pattern:**

- Zero values in ApproxParams fall back to defaults (no hint = full binary search)
- Frontend can pre-compute `guess_offchain` using RouterStatic preview functions
- `eps` of `1e15` (0.1%) is typical; lower values need more iterations

**Impact:** Full parity with Pendle. Frontends can optimize gas costs by providing off-chain calculated hints.

---

## 3.7 Limit Order Integration

**Implementation Status: 0%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| `LimitOrderData` struct | On-chain limit orders | ❌ None | 🟡 MEDIUM |
| Maker order matching | In swap execution | ❌ None | 🟡 MEDIUM |
| Limit order router | Separate infrastructure | ❌ None | 🟡 MEDIUM |

**Gap Detail:**

Pendle swaps can fill against on-chain limit orders:
```solidity
// Pendle - limit order data in every swap
struct LimitOrderData {
    address limitRouter;
    uint256 epsSkipMarket;  // Skip market if limit price better
    FillOrderParams[] normalFills;
    FillOrderParams[] flashFills;
    bytes optData;
}

function swapExactSyForPt(
    ...,
    LimitOrderData calldata limit  // ← Optional limit order matching
) external returns (uint256 netPtOut, uint256 netSyFee);
```

**Impact:** Cannot implement advanced trading strategies like limit orders or maker-taker dynamics.

---

## 3.8 Batch Operations (multicall)

**Implementation Status: 80%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| `multicall(Call3[])` | Batched operations | `multicall(Span<Call>)` | ✅ |
| Atomic multi-action | Single tx for complex ops | ✅ (self-calls only) | ✅ |
| `boostMarkets()` | Gauge boost in batch | ❌ None | 🟡 MEDIUM |
| `redeemDueInterestAndRewards()` | Combined redemption | ✅ `redeem_due_interest_and_rewards` | ✅ |

**Horizon Multicall Implementation:**

```cairo
// Execute multiple calls to this router in a single transaction
// SECURITY: Only allows calls to self (this router) to prevent arbitrary external calls
fn multicall(ref self: ContractState, calls: Span<Call>) -> Array<Span<felt252>>
```

**Call Struct:**
```cairo
#[derive(Drop, Serde)]
pub struct Call {
    pub to: ContractAddress,
    pub selector: felt252,
    pub calldata: Span<felt252>,
}
```

**Combined Interest + Rewards Redemption:**
```cairo
fn redeem_due_interest_and_rewards(
    ref self: ContractState,
    user: ContractAddress,
    yts: Span<ContractAddress>,
    markets: Span<ContractAddress>,
) -> (u256, Array<Span<u256>>)
```

**Impact:** Core batch operations are supported. Missing gauge boost functionality (not applicable to current Horizon architecture).

---

## 3.9 RouterStatic (Preview Functions)

**Implementation Status: 100%** (All preview functions implemented including token aggregation)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| `getLpToSyRate` | View function | `get_lp_to_sy_rate` | ✅ |
| `getPtToSyRate` | View function | `get_pt_to_sy_rate` | ✅ |
| `getLpToPtRate` | View function | `get_lp_to_pt_rate` | ✅ |
| `addLiquiditySingleSyStatic` | Preview | `preview_add_liquidity_single_sy` | ✅ |
| `swapExactPtForSyStatic` | Preview | `preview_swap_exact_pt_for_sy` | ✅ |
| `swapExactSyForPtStatic` | Preview | `preview_swap_exact_sy_for_pt` | ✅ |
| `removeLiquiditySingleSyStatic` | Preview | `preview_remove_liquidity_single_sy` | ✅ |
| Token aggregation previews | Via aggregator simulation | `preview_swap_exact_token_for_pt`, `preview_add_liquidity_single_token` | ✅ |
| `getMarketInfo` | View function | `get_market_info` | ✅ |
| Gas-free quotes | Via static calls | ✅ Via view functions | ✅ |

**Horizon RouterStatic Implementation:**

Horizon provides a separate `RouterStatic` contract (`router_static.cairo`) with read-only preview functions:

```cairo
#[starknet::interface]
pub trait IRouterStatic<TContractState> {
    // Exchange rates
    fn get_pt_to_sy_rate(self: @TContractState, market: ContractAddress) -> u256;
    fn get_lp_to_sy_rate(self: @TContractState, market: ContractAddress) -> u256;
    fn get_lp_to_pt_rate(self: @TContractState, market: ContractAddress) -> u256;

    // Swap previews
    fn preview_swap_exact_sy_for_pt(self: @TContractState, market: ContractAddress, sy_in: u256) -> u256;
    fn preview_swap_exact_pt_for_sy(self: @TContractState, market: ContractAddress, pt_in: u256) -> u256;

    // Liquidity previews
    fn preview_add_liquidity_single_sy(self: @TContractState, market: ContractAddress, sy_in: u256) -> u256;
    fn preview_remove_liquidity_single_sy(self: @TContractState, market: ContractAddress, lp_in: u256) -> u256;

    // Token aggregation previews (frontend provides pre-calculated SY estimate)
    fn preview_swap_exact_token_for_pt(self: @TContractState, market: ContractAddress, estimate: TokenToSyEstimate) -> u256;
    fn preview_add_liquidity_single_token(self: @TContractState, market: ContractAddress, estimate: TokenToSyEstimate) -> u256;

    // Market info
    fn get_market_info(self: @TContractState, market: ContractAddress) -> MarketInfo;
}
```

**TokenToSyEstimate Struct (for aggregator previews):**
```cairo
/// Frontend-provided SY estimate for token aggregation previews
/// Since aggregators cannot be called in view context, frontend provides the estimate
pub struct TokenToSyEstimate {
    pub token: ContractAddress,
    pub amount: u256,
    pub estimated_sy_amount: u256,  // Pre-calculated by frontend from aggregator quote
}
```

**MarketInfo Struct:**
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

**Impact:** Frontend can use gas-efficient quote functions for previews, including token aggregation flows.

---

## 3.10 Cross-Chain Operations

**Implementation Status: 0%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| `ActionCrossChain.sol` | Cross-chain messaging | ❌ None | 🟢 LOW (Starknet-only) |
| LayerZero integration | Bridge support | ❌ None | 🟢 LOW |

**Impact:** Low priority since Horizon is Starknet-native. Cross-chain would enable bridging between Starknet and EVM chains.

---

## 3.11 Permit Signatures

**Implementation Status: 0%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| EIP-2612 Permit | Gasless approvals | ❌ None | 🟡 MEDIUM |
| `permit()` in swaps | Single-tx approve+swap | ❌ None | 🟡 MEDIUM |

**Impact:** Users must approve tokens in separate transaction before swapping.

---

## 3.12 LP Rollover Operations

**Implementation Status: 100%** (Horizon-only feature)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| LP rollover to new market | ❌ None | `rollover_lp` | 🟡 Horizon-only |

**Horizon Rollover Implementation:**

```cairo
/// Rollover LP position from one market to another with the same PT
/// Burns LP in old market, uses SY+PT to add liquidity in new market
/// Note: Both markets must share the same SY (underlying) and PT
fn rollover_lp(
    ref self: ContractState,
    market_old: ContractAddress,
    market_new: ContractAddress,
    lp_to_rollover: u256,
    min_lp_out: u256,
    deadline: u64,
) -> u256
```

**Impact:** Enables atomic LP migration between markets with identical PT.
