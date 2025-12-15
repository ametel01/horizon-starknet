# Horizon Protocol vs Pendle V2: Analysis & Recommendations

This document compares Horizon Protocol (Starknet implementation) with Pendle V2 (Ethereum), identifying gaps, differences, and potential improvements.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Comparison](#2-architecture-comparison)
3. [Smart Contract Gaps](#3-smart-contract-gaps)
4. [Frontend Gaps](#4-frontend-gaps)
5. [Math & Pricing Differences](#5-math--pricing-differences)
6. [Feature Gaps](#6-feature-gaps)
7. [Recommended Improvements](#7-recommended-improvements)
8. [Priority Roadmap](#8-priority-roadmap)

---

## 1. Executive Summary

### What Horizon Has (Parity with Pendle)
- Core yield tokenization (SY, PT, YT)
- Time-aware AMM with implied rate pricing
- Factory pattern for contract deployment
- Router for aggregated operations
- Flash swap YT trading
- Basic oracle integration (Pragma)

### Critical Gaps
| Feature | Pendle | Horizon | Priority |
|---------|--------|---------|----------|
| TWAP Oracle for PT/LP | Yes | No | **HIGH** |
| Limit Orders | Yes | No | HIGH |
| Rewards Distribution (Gauge) | Yes | No | HIGH |
| SDK/API Backend | Yes | No | HIGH |
| Multiple Reward Tokens | Yes | No | MEDIUM |
| RouterStatic (Off-chain) | Yes | No | MEDIUM |
| Negative Yield Handling | Yes | Partial | MEDIUM |
| Fee Distribution | Yes | No | LOW |
| veToken System | Yes | No | LOW |

---

## 2. Architecture Comparison

### 2.1 Contract Structure

| Component | Pendle | Horizon | Notes |
|-----------|--------|---------|-------|
| SY (Standardized Yield) | EIP-5115 compliant | Custom implementation | Horizon uses simpler 1:1 share mapping |
| PT (Principal Token) | Standard ERC20 | Standard ERC20 | Equivalent |
| YT (Yield Token) | Complex reward tracking | Basic interest tracking | Missing multi-reward support |
| Market/AMM | PT/SY pool + Flash swaps | PT/SY pool + Flash swaps | Core mechanics similar |
| Router | Complex with aggregator | Basic operations | Missing zap functionality |
| Factory | Single factory | Separate PT/YT + Market factories | Horizon more modular |
| Oracle | Custom TWAP + Chainlink | Pragma integration | Different oracle architecture |

### 2.2 Pendle Components Missing in Horizon

```
Pendle Architecture:
├── Core (SY, PT, YT, Market) ✓ Horizon has
├── PendleRouter ✓ Horizon has (basic)
├── RouterStatic (off-chain) ✗ MISSING
├── PendleGauge ✗ MISSING
├── VotingController ✗ MISSING
├── GaugeController ✗ MISSING
├── vePENDLE ✗ MISSING
├── LimitOrderContract ✗ MISSING
├── PT/LP Oracle (TWAP) ✗ MISSING
└── Hosted SDK ✗ MISSING
```

---

## 3. Smart Contract Gaps

### 3.1 HIGH Priority: PT/LP TWAP Oracle

**Pendle Has:**
```solidity
// UniswapV3-style TWAP oracle
lnImpliedRateCumulative accumulator
getPtToSyRate(twapDuration) → rate
getLpToSyRate(twapDuration) → rate
```

**Horizon Missing:**
- No on-chain TWAP for PT prices
- No LP token pricing oracle
- Critical for lending protocol integrations (Aave, Compound forks)

**Recommended Implementation:**
```cairo
// In Market contract
struct Observation {
    timestamp: u64,
    ln_implied_rate_cumulative: u256,
}

observations: Vec<Observation>
observations_cardinality: u32

fn increase_observations_cardinality(cardinality: u32)
fn observe(seconds_agos: Array<u32>) -> Array<u256>
fn get_pt_to_sy_rate(twap_duration: u32) -> u256
fn get_lp_to_sy_rate(twap_duration: u32) -> u256
```

### 3.2 HIGH Priority: Limit Order System

**Pendle Has:**
```solidity
struct Order {
    salt, expiry, nonce,
    orderType: SY_FOR_PT | PT_FOR_SY | SY_FOR_YT | YT_FOR_SY,
    token, YT, maker, receiver,
    makingAmount, lnImpliedRate, failSafeRate
}

// Orders execute when market rate reaches order rate
// Fill before AMM for better price impact
```

**Horizon Missing:**
- No limit order infrastructure
- Users must execute at current market rate only
- Missing passive yield strategy capability

**Impact:**
- Lower capital efficiency
- Worse user experience for large trades
- Missing arbitrage opportunities

### 3.3 HIGH Priority: Gauge/Rewards System

**Pendle Has:**
```solidity
// Embedded in each Market
PendleGauge:
    - Distributes PENDLE rewards
    - Distributes SY rewards (from underlying)
    - activeBalance = min(userLp, boostedBalance)
    - Boosting via vePENDLE
```

**Horizon Missing:**
- No native token incentives
- No LP rewards distribution
- No boosting mechanism

**Recommended Implementation:**
```cairo
// Option 1: Embedded Gauge (like Pendle)
component!(GaugeComponent)
fn claim_rewards(user) -> Array<(ContractAddress, u256)>
fn notify_reward_amount(token, amount)

// Option 2: Separate Staking Contract
@contract
mod LPStaking {
    fn stake(market, amount)
    fn unstake(market, amount)
    fn claim(market) -> Array<(ContractAddress, u256)>
}
```

### 3.4 MEDIUM Priority: Multiple Reward Token Support

**Pendle YT Has:**
```solidity
// Tracks both interest AND rewards
redeemDueInterestAndRewards(user, doRedeemInterest, doRedeemRewards)
    → (interestOut: uint256, rewardsOut: uint256[])

// Example: YT-GLP generates:
// - Interest: none (no appreciation)
// - Rewards: ETH, esGMX
```

**Horizon YT:**
```cairo
// Only tracks interest (SY appreciation)
redeem_due_interest(user) → u256

// Missing:
// - Multiple reward token tracking
// - Reward token registry
// - Separate reward claim
```

**Gap Impact:**
- Cannot support tokens with multiple reward streams
- Missing ~5% of yield token types

### 3.5 MEDIUM Priority: RouterStatic (Off-chain Calculations)

**Pendle Has:**
```solidity
// Stateless preview functions (NOT audited, off-chain only)
RouterStatic:
    getLpToSyRate(market)
    getPtToSyRate(market)
    getLpToAssetRate(market)
    getPtToAssetRate(market)
    addLiquiditySingleSyStatic(...)
    swapExactPtForSyStatic(...)
    // ... many preview functions
```

**Horizon Missing:**
- No dedicated preview contract
- Frontend must simulate transactions
- Higher frontend complexity

### 3.6 MEDIUM Priority: Negative Yield Handling

**Pendle Has:**
```
Watermark mechanism:
- If exchange rate drops below watermark → PT redeems for less
- YT earns 0 yield until rate recovers
- Prevents arbitrage in depegging scenarios
```

**Horizon Has:**
```cairo
// Basic watermark in YT
py_index_stored = max(current_rate, stored_index)
```

**Gap:**
- Horizon watermark only affects YT yield
- Missing explicit PT redemption penalty in negative yield
- Should document expected behavior clearly

### 3.7 LOW Priority: Fee Distribution

**Pendle Has:**
```
Fee breakdown:
- 80% swap fees → vePENDLE voters (as USDT)
- 20% swap fees → LPs
- 5% YT yield → 80% vePENDLE, 10% treasury, 10% ops
```

**Horizon Has:**
```cairo
total_fees_collected: u256  // Just accumulates, no distribution
```

**Missing:**
- Fee distribution mechanism
- Protocol revenue collection
- LP fee share

### 3.8 LOW Priority: veToken System

**Pendle Has:**
```
vePENDLE:
- Lock PENDLE → get vePENDLE
- Vote for gauge weights
- Boost LP rewards
- Receive fee share
```

**Horizon:**
- No native token planned currently
- veToken system not priority for MVP

---

## 4. Frontend Gaps

### 4.1 HIGH Priority: SDK/API Backend

**Pendle Has:**
```typescript
// Hosted SDK at api-v2.pendle.finance/core
POST /v2/sdk/{chainId}/convert
{
    tokensIn: "0x...",
    amountsIn: "1000000",
    tokensOut: "0x...",
    slippage: 0.01,
    enableAggregator: true
}

// Returns ready-to-sign transaction
{
    tx: { data, to, value },
    outputs: [...],
    priceImpact: 0.001,
    impliedApy: { before, after }
}
```

**Horizon Missing:**
- No backend SDK
- No aggregator routing
- Frontend must build all transactions locally

**Recommended:**
1. Create `/packages/sdk` for TypeScript SDK
2. Implement quote/preview functions
3. Add transaction builders
4. Optional: Host API for complex routing

### 4.2 HIGH Priority: Zap Functionality

**Pendle Router:**
```solidity
// Single transaction: Any token → PT
swapExactTokenForPt(
    receiver, market, minPtOut, approx,
    input: TokenInput { tokenIn, amount, pendleSwap }  // pendleSwap = aggregator route
)
```

**Horizon Router:**
```cairo
// Must first convert to SY manually
swap_exact_sy_for_pt(market, receiver, exact_sy_in, min_pt_out)
```

**Missing:**
- No direct "token → PT" path
- No aggregator integration (KyberSwap, Odos, etc.)
- User must do SY wrapping separately

### 4.3 MEDIUM Priority: Price Impact Calculation

**Pendle Frontend:**
```typescript
// From SDK response
{
    priceImpact: 0.001,  // 0.1%
    impliedApy: {
        before: 0.05,    // 5% before trade
        after: 0.051     // 5.1% after trade
    },
    effectiveApy: 0.048  // What user actually gets
}
```

**Horizon Frontend:**
```typescript
// Simplified constant product estimate
pt_out = (pt_reserve * sy_in) / (sy_reserve + sy_in)
// Missing: actual AMM curve calculation
```

**Gap:**
- Frontend preview != actual AMM output
- Missing implied APY impact
- No effective APY calculation

### 4.4 MEDIUM Priority: APY Components Breakdown

**Pendle Shows:**
```
Market APY breakdown:
├── PT Fixed APY: 5.2%
├── Underlying APY: 3.1%
│   ├── Interest APY: 2.8%
│   └── Rewards APR: 0.3%
├── Swap Fee APY: 0.5%
├── PENDLE APR: 2.1%
└── Total LP APY: 10.9%
```

**Horizon Shows:**
```
Market display:
├── Implied APY: 5.2%
└── TVL: $1.2M
```

**Missing:**
- Underlying yield breakdown
- Swap fee APY
- Rewards APR (when implemented)
- Combined LP returns estimate

### 4.5 LOW Priority: Position Management

**Pendle Dashboard:**
```
My Positions:
├── Market positions with:
│   ├── LP value in USD
│   ├── Unclaimed rewards
│   ├── Accrued fees
│   └── Position P&L
├── YT positions with:
│   ├── Claimable interest
│   ├── Claimable rewards
│   └── Time to expiry
└── PT positions with:
    ├── Fixed yield locked
    └── Maturity value
```

**Horizon Dashboard:**
```
// Basic position tracking
{
    syBalance, ptBalance, ytBalance, lpBalance,
    claimableYield
}
```

**Missing:**
- USD value calculation
- P&L tracking
- Historical yield tracking
- Batch operations

---

## 5. Math & Pricing Differences

### 5.1 AMM Curve Comparison

**Both Use Similar Core:**
```
// Logit-based pricing
proportion = pt / (pt + sy)
ln_odds = ln(proportion / (1 - proportion))
ln_implied_rate = anchor - rate_scalar * ln_odds

// Time scaling
rate_scalar = scalar_root / time_in_years
pt_price = e^(-ln_implied_rate * time_in_years)
```

**Pendle Additions:**
- Fee rate root (dynamic fees based on rate impact)
- Last ln implied rate caching for oracle
- Gas-optimized swap previews

**Horizon Simplifications:**
- Fixed fee rate
- Basic rate caching
- Simpler swap calculations

### 5.2 Decimal Handling

**Pendle:**
```
- PT/YT decimals = underlying asset decimals
- SY decimals = yield token decimals
- LP decimals = always 18
- Uses "Scaled18" wrapper for <18 decimal assets
```

**Horizon:**
```cairo
// Assumes 18 decimals throughout
// May need adjustment for tokens with different decimals
```

**Gap:** Need decimal normalization for real-world tokens

### 5.3 Implied APY Calculation

**Both:**
```
implied_apy = e^(ln_implied_rate) - 1
```

**Difference:**
- Pendle stores `lnImpliedRate` with TWAP accumulator
- Horizon stores `last_ln_implied_rate` without TWAP

---

## 6. Feature Gaps

### 6.1 Trading Features

| Feature | Pendle | Horizon |
|---------|--------|---------|
| PT/SY Swaps | Yes | Yes |
| YT Flash Swaps | Yes | Yes |
| Limit Orders | Yes | No |
| Aggregator Integration | Yes | No |
| Zap (any token) | Yes | No |
| Cross-chain | Partial | No |

### 6.2 Liquidity Features

| Feature | Pendle | Horizon |
|---------|--------|---------|
| Add/Remove Liquidity | Yes | Yes |
| Single-sided Add | Yes | No |
| ZPI (Zero Price Impact) | Yes | No |
| Transfer Liquidity | Yes | No |
| Rollover PT | Yes | No |

### 6.3 Yield Features

| Feature | Pendle | Horizon |
|---------|--------|---------|
| Mint PT+YT | Yes | Yes |
| Redeem PT+YT | Yes | Yes |
| Claim Interest | Yes | Yes |
| Claim Rewards | Yes | No |
| Multiple Reward Tokens | Yes | No |
| Points Tracking | Yes | No |

### 6.4 Oracle Features

| Feature | Pendle | Horizon |
|---------|--------|---------|
| PT Price Oracle | TWAP | No |
| LP Price Oracle | TWAP | No |
| Chainlink Integration | Yes | No |
| Custom Oracle Library | Yes | Pragma only |

### 6.5 Governance Features

| Feature | Pendle | Horizon |
|---------|--------|---------|
| veToken | Yes | No |
| Gauge Voting | Yes | No |
| Fee Distribution | Yes | No |
| Boosted Rewards | Yes | No |

---

## 7. Recommended Improvements

### 7.1 Immediate (Phase 1)

**A. TWAP Oracle for Markets**
```cairo
// Add to Market contract
observations: LegacyMap<u32, Observation>
observations_cardinality: u32
observations_index: u32

fn _write_observation(ln_implied_rate: u256)
fn observe(seconds_agos: Span<u32>) -> Span<u256>
fn get_twap_ln_implied_rate(duration: u32) -> u256
fn get_pt_to_sy_rate(duration: u32) -> u256
```

**B. RouterStatic for Previews**
```cairo
@contract
mod RouterStatic {
    fn preview_swap_exact_sy_for_pt(market, amount) -> u256
    fn preview_swap_exact_pt_for_sy(market, amount) -> u256
    fn preview_add_liquidity(market, sy, pt) -> (u256, u256, u256)
    fn get_market_state(market) -> MarketState
    fn get_implied_apy(market) -> u256
}
```

**C. Frontend SDK**
```typescript
// packages/sdk/src/index.ts
export class HorizonSDK {
    // Quote functions
    quoteSwapSyForPt(market, amountIn): Promise<SwapQuote>
    quoteSwapPtForSy(market, amountIn): Promise<SwapQuote>
    quoteAddLiquidity(market, sy, pt): Promise<LiquidityQuote>

    // Transaction builders
    buildSwapTransaction(quote, slippage): TransactionRequest
    buildMintTransaction(yt, amount, slippage): TransactionRequest

    // Market data
    getMarketData(market): Promise<MarketData>
    getAllMarkets(): Promise<MarketData[]>
}
```

### 7.2 Short-term (Phase 2)

**A. Multi-Reward YT**
```cairo
// Enhanced YT with reward tracking
reward_tokens: Vec<ContractAddress>
user_reward_index: Map<(user, token), u256>
user_accrued_rewards: Map<(user, token), u256>

fn redeem_due_interest_and_rewards(user) -> (u256, Array<(ContractAddress, u256)>)
fn get_reward_tokens() -> Array<ContractAddress>
```

**B. Gauge System**
```cairo
@contract
mod Gauge {
    reward_rate: Map<ContractAddress, u256>
    period_finish: u64

    fn notify_reward_amount(token, amount)
    fn claim_rewards(user) -> Array<(ContractAddress, u256)>
    fn reward_per_token(token) -> u256
    fn earned(user, token) -> u256
}
```

**C. Single-Sided Liquidity**
```cairo
// Router enhancement
fn add_liquidity_single_sy(market, sy_amount, min_lp) -> u256
fn add_liquidity_single_pt(market, pt_amount, min_lp) -> u256
fn remove_liquidity_single_sy(market, lp_amount, min_sy) -> u256
fn remove_liquidity_single_pt(market, lp_amount, min_pt) -> u256
```

### 7.3 Medium-term (Phase 3)

**A. Limit Orders**
```cairo
@contract
mod LimitOrder {
    struct Order {
        maker: ContractAddress,
        order_type: OrderType,
        making_amount: u256,
        ln_implied_rate: u256,
        expiry: u64,
        salt: felt252,
    }

    fn create_order(order: Order) -> felt252
    fn fill_order(order_hash: felt252, amount: u256)
    fn cancel_order(order_hash: felt252)
}
```

**B. Zap Integration**
```cairo
// Router with external DEX integration
fn zap_in_pt(
    market: ContractAddress,
    token_in: ContractAddress,
    amount_in: u256,
    swap_data: Array<felt252>,  // Encoded swap route
    min_pt_out: u256
) -> u256
```

**C. Fee Distribution**
```cairo
@contract
mod FeeDistributor {
    fn distribute_fees(market: ContractAddress)
    fn claim_protocol_fees() -> u256
    fn set_fee_split(lp_share: u256, protocol_share: u256)
}
```

### 7.4 Long-term (Phase 4)

**A. veToken System**
```cairo
@contract
mod VeHorizon {
    fn lock(amount: u256, duration: u64) -> u256
    fn increase_amount(amount: u256)
    fn increase_duration(new_expiry: u64)
    fn withdraw()
    fn balance_of(user: ContractAddress) -> u256
}

@contract
mod GaugeController {
    fn vote(markets: Array<ContractAddress>, weights: Array<u256>)
    fn get_gauge_weight(market: ContractAddress) -> u256
}
```

**B. Cross-Market Operations**
```cairo
fn transfer_liquidity(
    from_market: ContractAddress,
    to_market: ContractAddress,
    lp_amount: u256
) -> u256

fn rollover_pt(
    old_market: ContractAddress,
    new_market: ContractAddress,
    pt_amount: u256
) -> u256
```

---

## 8. Priority Roadmap

### Phase 1: Foundation (Weeks 1-4)
**Goal:** Enable lending protocol integrations and improve UX

| Task | Impact | Effort | Priority |
|------|--------|--------|----------|
| TWAP Oracle for PT/LP | Critical for lending integrations | Medium | P0 |
| RouterStatic | Better frontend UX | Low | P0 |
| Frontend SDK package | Developer experience | Medium | P1 |
| Price impact display | User experience | Low | P1 |

### Phase 2: Core Features (Weeks 5-8)
**Goal:** Feature parity for basic yield operations

| Task | Impact | Effort | Priority |
|------|--------|--------|----------|
| Multi-reward YT | Support more yield tokens | Medium | P1 |
| Single-sided liquidity | Better UX for LPs | Medium | P1 |
| APY breakdown display | User trust | Low | P2 |
| Position value tracking | Portfolio management | Low | P2 |

### Phase 3: Advanced Trading (Weeks 9-12)
**Goal:** Competitive trading features

| Task | Impact | Effort | Priority |
|------|--------|--------|----------|
| Limit order system | Advanced trading | High | P1 |
| Fee distribution | Protocol revenue | Medium | P2 |
| Gauge/rewards | LP incentives | Medium | P2 |

### Phase 4: Ecosystem (Weeks 13+)
**Goal:** Full protocol ecosystem

| Task | Impact | Effort | Priority |
|------|--------|--------|----------|
| veToken system | Governance | High | P3 |
| Zap integration | UX | High | P3 |
| Cross-market ops | Advanced LP | Medium | P3 |

---

## Appendix A: Code Comparison

### SY Interface

**Pendle (Solidity):**
```solidity
interface IStandardizedYield {
    function deposit(address receiver, address tokenIn, uint256 amountTokenToDeposit, uint256 minSharesOut)
        external payable returns (uint256 amountSharesOut);
    function redeem(address receiver, uint256 amountSharesToRedeem, address tokenOut, uint256 minTokenOut, bool burnFromInternalBalance)
        external returns (uint256 amountTokenOut);
    function exchangeRate() external view returns (uint256);
    function getTokensIn() external view returns (address[] memory);
    function getTokensOut() external view returns (address[] memory);
    function yieldToken() external view returns (address);
    function assetInfo() external view returns (AssetType, address, uint8);
    function claimRewards(address user) external returns (uint256[] memory);
    function getRewardTokens() external view returns (address[] memory);
}
```

**Horizon (Cairo):**
```cairo
#[starknet::interface]
pub trait ISY<TContractState> {
    fn deposit(ref self: TContractState, receiver: ContractAddress, amount_shares_to_deposit: u256) -> u256;
    fn redeem(ref self: TContractState, receiver: ContractAddress, amount_sy_to_redeem: u256) -> u256;
    fn exchange_rate(self: @TContractState) -> u256;
    fn underlying_asset(self: @TContractState) -> ContractAddress;
    // Missing: getTokensIn, getTokensOut, assetInfo, claimRewards, getRewardTokens
}
```

### Market Interface

**Pendle (Solidity):**
```solidity
interface IPMarket {
    function mint(address receiver, uint256 netSyDesired, uint256 netPtDesired)
        external returns (uint256 netLpOut, uint256 netSyUsed, uint256 netPtUsed);
    function burn(address receiverSy, address receiverPt, uint256 netLpToBurn)
        external returns (uint256 netSyOut, uint256 netPtOut);
    function swapExactPtForSy(address receiver, uint256 exactPtIn, bytes calldata data)
        external returns (uint256 netSyOut, uint256 netSyFee);
    function swapSyForExactPt(address receiver, uint256 exactPtOut, bytes calldata data)
        external returns (uint256 netSyIn, uint256 netSyFee);
    function readState(address router) external view returns (MarketState memory);
    function observe(uint32[] memory secondsAgos) external view returns (uint216[] memory);
    function increaseObservationsCardinalityNext(uint16 cardinalityNext) external;
    function redeemRewards(address user) external returns (uint256[] memory);
}
```

**Horizon (Cairo):**
```cairo
#[starknet::interface]
pub trait IMarket<TContractState> {
    fn mint(ref self: TContractState, receiver: ContractAddress, sy_desired: u256, pt_desired: u256)
        -> (u256, u256, u256);
    fn burn(ref self: TContractState, receiver: ContractAddress, lp_to_burn: u256)
        -> (u256, u256);
    fn swap_exact_pt_for_sy(ref self: TContractState, receiver: ContractAddress, exact_pt_in: u256, min_sy_out: u256)
        -> u256;
    fn swap_exact_sy_for_pt(ref self: TContractState, receiver: ContractAddress, exact_sy_in: u256, min_pt_out: u256)
        -> u256;
    fn get_reserves(self: @TContractState) -> (u256, u256);
    fn get_ln_implied_rate(self: @TContractState) -> u256;
    // Missing: observe, increaseObservationsCardinalityNext, redeemRewards
}
```

---

## Appendix B: Pendle SDK Endpoints

```
GET  /v2/{chainId}/markets                    → List all markets
GET  /v2/{chainId}/markets/{market}/data      → Market details + APY
GET  /v2/{chainId}/assets/all                 → All supported tokens

POST /v2/sdk/{chainId}/convert                → Universal action endpoint
     Actions: swap, add-liquidity, add-liquidity-zpi, remove-liquidity,
              mint-py, redeem-py, transfer-liquidity, roll-over-pt
```

---

## Appendix C: Horizon Current API Surface

```typescript
// Frontend hooks (no backend API)
useMarket(address)           → { reserves, impliedApy, tvl, expiry }
useMarkets()                 → MarketData[]
useMint(yt)                  → { mint, isLoading }
useSwap(market)              → { buyPt, sellPt, buyYt, sellYt }
useLiquidity(market)         → { addLiquidity, removeLiquidity }
useRedeem(yt)                → { redeemPy, redeemPostExpiry }
useYield(yt)                 → { claimYield }
usePositions()               → MarketPosition[]
```

---

*Document generated: December 2024*
*Comparison based on: Pendle V2 (Ethereum mainnet), Horizon (Starknet)*
