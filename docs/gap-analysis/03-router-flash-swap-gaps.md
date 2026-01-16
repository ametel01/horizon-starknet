# 3. Router & Flash Swap Gaps

## 3.1 Router Architecture

**Implementation Status: 85%** (Core operations, single-sided liquidity, and multicall implemented)

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

**Implementation Status: 80%** (Core single-sided operations implemented)

| Function | Pendle V2 | Horizon | Status |
|----------|-----------|---------|--------|
| `addLiquiditySinglePt` | ✅ | `add_liquidity_single_pt` | ✅ |
| `addLiquiditySingleSy` | ✅ | `add_liquidity_single_sy` | ✅ |
| `addLiquiditySingleToken` | ✅ | ❌ None | 🔴 HIGH |
| `addLiquiditySingleTokenKeepYt` | ✅ | ❌ None | 🟡 MEDIUM |
| `removeLiquiditySinglePt` | ✅ | `remove_liquidity_single_pt` | ✅ |
| `removeLiquiditySingleSy` | ✅ | `remove_liquidity_single_sy` | ✅ |
| `removeLiquiditySingleToken` | ✅ | ❌ None | 🔴 HIGH |
| `addLiquidityDualTokenAndPt` | ✅ | ❌ None | 🟡 MEDIUM |
| `removeLiquidityDualTokenAndPt` | ✅ | ❌ None | 🟡 MEDIUM |

**Horizon Single-Sided Liquidity Implementation:**

Horizon implements core single-sided liquidity operations:

```cairo
// Add liquidity with only SY (auto-swaps optimal amount for PT)
fn add_liquidity_single_sy(
    market: ContractAddress,
    receiver: ContractAddress,
    amount_sy_in: u256,
    min_lp_out: u256,
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
```

**Remaining Gap - Token Aggregation:**

Pendle's `addLiquiditySingleToken` and `removeLiquiditySingleToken` allow arbitrary tokens via aggregator routing, which Horizon does not support (see Section 3.5).

**Impact:** Users can provide single-sided liquidity with SY or PT, but cannot one-click LP from arbitrary tokens.

---

## 3.5 Token Aggregation & Routing (Major Gap)

**Implementation Status: 0%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| `TokenInput` struct | Token + aggregator swap data | ❌ None | 🔴 HIGH |
| `TokenOutput` struct | Token + aggregator swap data | ❌ None | 🔴 HIGH |
| `swapExactTokenForPt` | Any token → PT | ❌ None | 🔴 HIGH |
| `swapExactPtForToken` | PT → any token | ❌ None | 🔴 HIGH |
| `swapExactTokenForYt` | Any token → YT | ❌ None | 🔴 HIGH |
| `swapExactYtForToken` | YT → any token | ❌ None | 🔴 HIGH |
| `swapTokensToTokens` | General aggregator routing | ❌ None | 🔴 HIGH |
| Aggregator integration | Kyber, 1inch, etc. | ❌ None | 🔴 HIGH |

**Gap Detail - TokenInput/TokenOutput:**

Pendle's router accepts arbitrary tokens and routes through aggregators:
```solidity
// Pendle - TokenInput allows any input token
struct TokenInput {
    address tokenIn;           // Any ERC20
    uint256 netTokenIn;        // Amount
    address tokenMintSy;       // Intermediate token for SY
    address pendleSwap;        // Aggregator address
    SwapData swapData;         // Aggregator calldata
}

function swapExactTokenForPt(
    address receiver,
    address market,
    uint256 minPtOut,
    ApproxParams calldata guessPtOut,
    TokenInput calldata input,  // ← Flexible input
    LimitOrderData calldata limit
) external payable returns (uint256 netPtOut, uint256 netSyFee, uint256 netSyInterm);
```

Horizon only accepts SY or PT directly:
```cairo
// Horizon - SY or PT only
fn swap_exact_sy_for_pt(market, receiver, exact_sy_in, min_pt_out, deadline) -> u256
fn swap_exact_pt_for_sy(market, receiver, exact_pt_in, min_sy_out, deadline) -> u256
```

**Impact:** Users must convert tokens to SY/PT manually before using Horizon. Critical UX gap for mainstream adoption.

---

## 3.6 ApproxParams (Binary Search Parameters)

**Implementation Status: Partial**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| ApproxParams struct | guessMin, guessMax, maxIteration, eps | Internal only | ⚠️ Hidden |
| Caller-provided hints | ✅ Frontend can optimize | ❌ Fixed internal | 🟡 MEDIUM |
| Binary search iterations | Configurable (5-20) | Fixed (64 for swaps, 20 for LP) | 🟡 MEDIUM |
| Epsilon tolerance | Configurable | Fixed 1000 wei (swaps) | 🟡 MEDIUM |

**Gap Detail:**

Pendle allows callers to provide binary search hints:
```solidity
// Pendle - caller can guide binary search
struct ApproxParams {
    uint256 guessMin;       // Lower bound hint
    uint256 guessMax;       // Upper bound hint
    uint256 guessOffchain;  // Offchain calculation
    uint256 maxIteration;   // Max search iterations
    uint256 eps;            // Tolerance (1e15 = 0.1%)
}
```

Horizon uses fixed internal binary search parameters:
```cairo
// Horizon - fixed parameters for market swaps (market_math_fp.cairo)
pub const BINARY_SEARCH_TOLERANCE: u256 = 1000;
pub const BINARY_SEARCH_MAX_ITERATIONS: u32 = 64;

// Horizon - fixed parameters for LP calculations (router.cairo)
let max_iterations: u32 = 20; // ~1e-6 precision
```

**Impact:** Pendle frontends can provide optimized guesses from off-chain calculations, reducing gas costs. Horizon always runs full binary search.

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

**Implementation Status: 80%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| `getLpToSyRate` | View function | `get_lp_to_sy_rate` | ✅ |
| `getPtToSyRate` | View function | `get_pt_to_sy_rate` | ✅ |
| `getLpToPtRate` | View function | `get_lp_to_pt_rate` | ✅ |
| `addLiquiditySingleSyStatic` | Preview | `preview_add_liquidity_single_sy` | ✅ |
| `swapExactPtForSyStatic` | Preview | `preview_swap_exact_pt_for_sy` | ✅ |
| `swapExactSyForPtStatic` | Preview | `preview_swap_exact_sy_for_pt` | ✅ |
| `removeLiquiditySingleSyStatic` | Preview | `preview_remove_liquidity_single_sy` | ✅ |
| `getMarketInfo` | View function | `get_market_info` | ✅ |
| Gas-free quotes | Via static calls | ✅ Via view functions | ✅ |

**Horizon RouterStatic Implementation:**

Horizon provides a separate `RouterStatic` contract (`router_static.cairo`) with read-only preview functions:

```cairo
#[starknet::interface]
pub trait IRouterStatic<TContractState> {
    fn get_pt_to_sy_rate(self: @TContractState, market: ContractAddress) -> u256;
    fn get_lp_to_sy_rate(self: @TContractState, market: ContractAddress) -> u256;
    fn get_lp_to_pt_rate(self: @TContractState, market: ContractAddress) -> u256;
    fn preview_swap_exact_sy_for_pt(self: @TContractState, market: ContractAddress, sy_in: u256) -> u256;
    fn preview_swap_exact_pt_for_sy(self: @TContractState, market: ContractAddress, pt_in: u256) -> u256;
    fn preview_add_liquidity_single_sy(self: @TContractState, market: ContractAddress, sy_in: u256) -> u256;
    fn preview_remove_liquidity_single_sy(self: @TContractState, market: ContractAddress, lp_in: u256) -> u256;
    fn get_market_info(self: @TContractState, market: ContractAddress) -> MarketInfo;
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

**Impact:** Frontend can use gas-efficient quote functions for previews.

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
