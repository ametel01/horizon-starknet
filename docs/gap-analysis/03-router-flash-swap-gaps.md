# 3. Router & Flash Swap Gaps

## 3.1 Router Architecture

**Implementation Status: 55%** (Core operations work; missing advanced features)

**Reference:** Pendle's Router contracts from [pendle-core-v2-public](https://github.com/pendle-finance/pendle-core-v2-public/tree/main/contracts/router)

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| Architecture | Selector-based proxy (PendleRouterV4) + action facets | Monolithic contract | ⚠️ Different |
| Contract count | Proxy + ActionStorageV4 + ~7 action modules + helpers | 1 router.cairo | ⚠️ Simpler |
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

**Implementation Status: 85%** (All basic operations implemented)

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

## 3.4 Single-Sided Liquidity (Major Gap)

**Implementation Status: 0%**

Pendle's `ActionAddRemoveLiqV3.sol` provides extensive single-sided liquidity operations:

| Function | Pendle V2 | Horizon | Status |
|----------|-----------|---------|--------|
| `addLiquiditySinglePt` | ✅ | ❌ None | 🔴 HIGH |
| `addLiquiditySingleSy` | ✅ | ❌ None | 🔴 HIGH |
| `addLiquiditySingleToken` | ✅ | ❌ None | 🔴 HIGH |
| `addLiquiditySingleTokenKeepYt` | ✅ | ❌ None | 🟡 MEDIUM |
| `removeLiquiditySinglePt` | ✅ | ❌ None | 🔴 HIGH |
| `removeLiquiditySingleSy` | ✅ | ❌ None | 🔴 HIGH |
| `removeLiquiditySingleToken` | ✅ | ❌ None | 🔴 HIGH |
| `addLiquidityDualTokenAndPt` | ✅ | ❌ None | 🟡 MEDIUM |
| `removeLiquidityDualTokenAndPt` | ✅ | ❌ None | 🟡 MEDIUM |

**Gap Detail - Single-Sided Liquidity:**

Pendle allows adding liquidity with just PT or SY (the other side is synthesized internally):
```solidity
// Pendle - add liquidity with only PT
function addLiquiditySinglePt(
    address receiver,
    address market,
    uint256 netPtIn,
    uint256 minLpOut,
    ApproxParams calldata guessPtSwapToSy,  // Binary search params
    LimitOrderData calldata limit
) external returns (uint256 netLpOut, uint256 netSyFee);

// Pendle - add with arbitrary token via aggregator
function addLiquiditySingleToken(
    address receiver,
    address market,
    uint256 minLpOut,
    ApproxParams calldata guessPtReceivedFromSy,
    TokenInput calldata input,  // Aggregator routing data
    LimitOrderData calldata limit
) external payable returns (uint256 netLpOut, uint256 netSyFee, uint256 netSyInterm);
```

Horizon requires both SY and PT:
```cairo
// Horizon - requires both tokens
fn add_liquidity(
    market: ContractAddress,
    receiver: ContractAddress,
    sy_desired: u256,
    pt_desired: u256,
    min_lp_out: u256,
    deadline: u64,
) -> (u256, u256, u256)
```

**Impact:** Users must hold both SY and PT to provide liquidity. Cannot one-click LP from any token. Major UX barrier for new users.

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
| Binary search iterations | Configurable (5-20) | Fixed (100) | 🟡 MEDIUM |
| Epsilon tolerance | Configurable | Fixed 0.01% | 🟡 MEDIUM |

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

Horizon uses fixed internal binary search:
```cairo
// Horizon - fixed parameters
const MAX_ITERATIONS: u32 = 100;
const CONVERGENCE_THRESHOLD: u256 = 100_000_000_000_000; // 0.01%
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

**Implementation Status: 0%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| `multicall(Call3[])` | Batched operations | ❌ None | 🟡 MEDIUM |
| Atomic multi-action | Single tx for complex ops | ❌ None | 🟡 MEDIUM |
| `boostMarkets()` | Gauge boost in batch | ❌ None | 🟡 MEDIUM |
| `redeemDueInterestAndRewards()` | Combined redemption | ❌ None | 🟡 MEDIUM |

**Gap Detail:**

Pendle supports batched operations:
```solidity
// Pendle - execute multiple calls atomically
function multicall(Call3[] calldata calls)
    external payable returns (Result[] memory res);

// Combined interest + rewards redemption
function redeemDueInterestAndRewards(
    address user,
    address[] calldata sys,     // SY contracts
    address[] calldata yts,     // YT contracts
    address[] calldata markets  // Market contracts
) external;
```

**Impact:** Users must submit separate transactions for each operation. Higher gas costs and worse UX.

---

## 3.9 RouterStatic (Preview Functions)

**Implementation Status: 0%**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| `getLpToSyRate` | View function | ❌ None | 🟡 MEDIUM |
| `getPtToSyRate` | View function | ❌ None | 🟡 MEDIUM |
| `addLiquiditySingleSyStatic` | Preview | ❌ None | 🟡 MEDIUM |
| `swapExactPtForSyStatic` | Preview | ❌ None | 🟡 MEDIUM |
| Gas-free quotes | Via static calls | ❌ Must simulate | 🟡 MEDIUM |

**Impact:** Frontend must simulate transactions; no gas-efficient quote functions.

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
