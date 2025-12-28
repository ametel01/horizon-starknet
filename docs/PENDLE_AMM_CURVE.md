# Pendle AMM Curve Analysis

**Date:** December 2024
**Source:** [pendle-core-v2-public](https://github.com/pendle-finance/pendle-core-v2-public)
**Files Analyzed:**
- `contracts/core/Market/MarketMathCore.sol`
- `contracts/core/libraries/math/LogExpMath.sol`
- `contracts/core/libraries/math/PMath.sol`
- `contracts/core/StandardizedYield/PYIndex.sol`
- `contracts/core/StandardizedYield/SYUtils.sol`

---

## Executive Summary

Pendle V2 uses a **logit-based AMM curve** that is specifically designed for trading PT (Principal Token) against the underlying asset value. The curve accounts for time decay and ensures PT naturally converges to 1:1 with the underlying asset at expiry.

The key insight is that Pendle does NOT use a simple constant product (x*y=k) AMM. Instead, it uses a **Notional-style exchange rate curve** based on the logit function.

---

## Core Data Structures

### MarketState (Solidity)

```solidity
struct MarketState {
    int256 totalPt;           // Total PT in the pool
    int256 totalSy;           // Total SY in the pool
    int256 totalLp;           // Total LP tokens
    address treasury;         // Treasury address for fees
    int256 scalarRoot;        // Controls rate sensitivity
    uint256 expiry;           // Expiry timestamp
    uint256 lnFeeRateRoot;    // ln(fee rate) root
    uint256 reserveFeePercent; // % of fees to reserve (base 100)
    uint256 lastLnImpliedRate; // Cached ln(implied rate)
}

struct MarketPreCompute {
    int256 rateScalar;    // Time-adjusted scalar
    int256 totalAsset;    // SY converted to asset value
    int256 rateAnchor;    // Anchor for exchange rate
    int256 feeRate;       // Time-adjusted fee rate
}
```

---

## Core Equations

### 1. Asset Conversion

SY tokens are converted to "Asset" value using the PY index (exchange rate):

```
Asset = SY * index / WAD    (syToAsset)
SY = Asset * WAD / index    (assetToSy)
```

### 2. Rate Scalar

The rate scalar controls sensitivity to proportion changes and increases as expiry approaches:

```
rateScalar = scalarRoot * IMPLIED_RATE_TIME / timeToExpiry

Where:
- IMPLIED_RATE_TIME = 365 * 86400 (seconds per year)
- timeToExpiry = expiry - blockTime
```

As `timeToExpiry → 0`, `rateScalar → ∞`, making the curve very flat near expiry.

### 3. Proportion Calculation

```
proportion = PT / (PT + Asset)

Where:
- Asset = syToAsset(totalSy)
- This represents the fraction of PT in the pool
```

### 4. Exchange Rate Formula (THE CORE CURVE)

The exchange rate (price of 1 PT in terms of Asset) is:

```
exchangeRate = ln(proportion / (1 - proportion)) / rateScalar + rateAnchor

Or equivalently:
exchangeRate = logit(proportion) / rateScalar + rateAnchor

Where:
- logit(p) = ln(p / (1 - p))
- rateAnchor is computed to maintain rate continuity
```

This is the **logit-based curve** that gives Pendle its unique pricing characteristics.

### 5. Rate Anchor Calculation

The rate anchor is recalculated after each trade to maintain the cached implied rate:

```
newExchangeRate = e^(lastLnImpliedRate * timeToExpiry / IMPLIED_RATE_TIME)

rateAnchor = newExchangeRate - logit(proportion) / rateScalar
```

### 6. Implied Rate Calculation

After a trade, the new implied rate is calculated from the exchange rate:

```
lnRate = ln(exchangeRate)
lnImpliedRate = lnRate * IMPLIED_RATE_TIME / timeToExpiry
```

### 7. Fee Rate

Fees decrease as expiry approaches (compound decay):

```
feeRate = e^(lnFeeRateRoot * timeToExpiry / IMPLIED_RATE_TIME)
```

---

## Trade Execution Flow

### swapExactPtForSy (Sell PT for SY)

```
1. Convert to signed: netPtToAccount = -exactPtIn (negative = PT going out)

2. Compute precomputed values:
   - rateScalar = scalarRoot * 365 days / timeToExpiry
   - totalAsset = syToAsset(totalSy)
   - rateAnchor = computeAnchor(lastLnImpliedRate, proportion, rateScalar)
   - feeRate = e^(lnFeeRateRoot * timeToExpiry / 365 days)

3. Calculate new proportion:
   newProportion = (totalPt - netPtToAccount) / (totalPt + totalAsset)

4. Calculate exchange rate at new proportion:
   exchangeRate = logit(newProportion) / rateScalar + rateAnchor

5. Calculate asset amount:
   preFeeAssetToAccount = -netPtToAccount / exchangeRate

6. Apply fee:
   if netPtToAccount > 0 (buying PT):
     fee = preFeeAssetToAccount * (1 - feeRate)
   else (selling PT):
     fee = (preFeeAssetToAccount * (1 - feeRate)) / feeRate * -1

   netAssetToAccount = preFeeAssetToAccount - fee

7. Convert back to SY:
   netSyToAccount = assetToSy(netAssetToAccount)

8. Update state:
   totalPt -= netPtToAccount
   totalSy -= (netSyToAccount + netSyToReserve)
   lastLnImpliedRate = computeNewImpliedRate()
```

---

## Key Mathematical Properties

### 1. Convergence at Expiry

As `timeToExpiry → 0`:
- `rateScalar → ∞`
- `exchangeRate → rateAnchor → 1.0`
- PT trades 1:1 with Asset (and thus SY if index = WAD)

### 2. Bounded Proportion

```
MAX_MARKET_PROPORTION = 96%
```

Trades that would push proportion above 96% are rejected.

### 3. Minimum Implied Rate

The exchange rate must always be >= 1.0 WAD, ensuring implied rates are non-negative.

### 4. Fee Decay

Fees approach zero at expiry since:
```
e^(lnFeeRateRoot * 0 / 365 days) = e^0 = 1
```
But `1 - feeRate` = 0 at expiry, so no fees are charged.

---

## Comparison: Pendle vs Horizon Implementation

| Aspect | Pendle V2 | Horizon (Implemented) |
|--------|-----------|----------------------|
| **Core Curve** | Logit-based: `ln(p/(1-p))/scalar + anchor` | ✅ Logit-based: same formula |
| **Price Calculation** | Single unified formula | ✅ Single unified formula |
| **Math Precision** | Solidity's LogExpMath (~18 decimals) | ✅ cubit 64.64 fixed-point (~19 decimals) |
| **Asset Conversion** | SY → Asset via index | ⚠️ SY only (intentional simplification) |
| **Rate Scalar** | `scalarRoot * 365d / timeToExpiry` | ✅ `scalarRoot * SECONDS_PER_YEAR / timeToExpiry` |
| **Anchor Update** | Recalculated each trade | ✅ Recalculated via `get_rate_anchor` |
| **Fee Application** | On Asset amount, exponential decay | ✅ On SY amount, exponential decay |
| **Implied Rate Update** | After each trade | ✅ After each trade via `get_ln_implied_rate` |
| **Exponential Decay** | `e^(-rate * time)` for PT pricing | ✅ `exp_neg_wad` via cubit |

### Implementation Status

1. ✅ **Logit-based AMM curve** - Fully implemented with proper `logit(proportion) / rateScalar + rateAnchor` formula.

2. ✅ **Dynamic anchor updates** - Anchor is recalculated from `last_ln_implied_rate` to maintain rate continuity.

3. ✅ **Fee decay** - Implemented with exponential decay towards expiry matching Pendle's approach.

4. ✅ **High-precision math** - Uses cubit 64.64 fixed-point library (`math_fp.cairo`, `market_math_fp.cairo`) providing ~19 decimal digits of precision for transcendental functions (exp, ln, pow, sqrt).

5. ⚠️ **Asset conversion** - Horizon treats SY = Asset (no PY index conversion). This is an intentional simplification since Horizon SY tokens always have a 1:1 relationship with the underlying asset at the protocol level.

### Math Library Architecture

Horizon uses a hybrid approach for optimal precision and compatibility:

| Layer | Library | Purpose |
|-------|---------|---------|
| **Internal** | cubit 64.64 | High-precision transcendental functions |
| **Interface** | WAD (10^18) | ERC20-compatible token amounts |
| **Conversion** | `wad_to_fp` / `fp_to_wad` | Seamless bridging between formats |

**Key functions in `math_fp.cairo`:**
- `exp_wad(x)` - e^x with WAD scaling
- `exp_neg_wad(x)` - e^(-x) for decay calculations
- `ln_wad(x)` - Natural logarithm
- `pow_wad(base, exp)` - Power function for compound interest
- `sqrt_wad(x)` - Square root (WAD-normalized)

**Key functions in `market_math_fp.cairo`:**
- `logit(proportion)` - ln(p/(1-p)) for AMM curve
- `get_exchange_rate_from_implied_rate()` - PT pricing via exponential decay
- `calc_trade()` - Full trade calculation with fees
- `get_ln_implied_rate()` - Extract implied rate from market state

---

## Implementation Recommendation

To properly implement Pendle's AMM curve in Cairo:

### Step 1: Implement Core Functions

```cairo
// Calculate exchange rate from proportion
fn get_exchange_rate(
    total_pt: u256,
    total_asset: u256,
    rate_scalar: u256,
    rate_anchor: u256,
    net_pt_to_account: i256,  // signed
) -> u256 {
    let numerator = total_pt - net_pt_to_account;
    let proportion = wad_div(numerator, total_pt + total_asset);

    // Check proportion bounds
    assert(proportion <= MAX_MARKET_PROPORTION);

    let ln_proportion = logit(proportion);  // ln(p / (1-p))

    // exchangeRate = ln_proportion / rate_scalar + rate_anchor
    wad_div(ln_proportion, rate_scalar) + rate_anchor
}

// Calculate anchor to maintain implied rate
fn get_rate_anchor(
    total_pt: u256,
    last_ln_implied_rate: u256,
    total_asset: u256,
    rate_scalar: u256,
    time_to_expiry: u64,
) -> u256 {
    let new_exchange_rate = get_exchange_rate_from_implied_rate(
        last_ln_implied_rate,
        time_to_expiry
    );

    let proportion = wad_div(total_pt, total_pt + total_asset);
    let ln_proportion = logit(proportion);

    new_exchange_rate - wad_div(ln_proportion, rate_scalar)
}

// The logit function: ln(p / (1-p))
fn logit(proportion: u256) -> (u256, bool) {
    assert(proportion != WAD);  // Can't be exactly 1

    let odds = wad_div(proportion, WAD - proportion);
    ln_wad(odds)  // Returns (value, is_negative)
}
```

### Step 2: Trade Calculation

```cairo
fn calc_trade(
    state: @MarketState,
    total_asset: u256,
    rate_scalar: u256,
    rate_anchor: u256,
    fee_rate: u256,
    net_pt_to_account: i256,  // negative = selling PT
) -> (i256, u256) {  // (net_sy_to_account, fee)
    // Get exchange rate at new PT level
    let exchange_rate = get_exchange_rate(
        state.pt_reserve,
        total_asset,
        rate_scalar,
        rate_anchor,
        net_pt_to_account
    );

    // Calculate pre-fee asset amount
    let pre_fee_asset = wad_div(-net_pt_to_account, exchange_rate);

    // Apply fee based on direction
    let fee = if net_pt_to_account > 0 {
        // Buying PT: fee from asset going out
        wad_mul(pre_fee_asset, WAD - fee_rate)
    } else {
        // Selling PT: fee from asset coming in
        wad_div(wad_mul(-pre_fee_asset, WAD - fee_rate), fee_rate)
    };

    let net_asset = pre_fee_asset - fee;

    // Convert asset to SY (if using index, otherwise asset = sy)
    let net_sy = asset_to_sy(net_asset);

    (net_sy, fee)
}
```

### Step 3: Update State After Trade

```cairo
fn update_market_state_after_trade(
    ref state: MarketState,
    rate_scalar: u256,
    rate_anchor: u256,
    net_pt_to_account: i256,
    net_sy_to_account: i256,
    net_sy_to_reserve: u256,
    time_to_expiry: u64,
) {
    state.pt_reserve = state.pt_reserve - net_pt_to_account;
    state.sy_reserve = state.sy_reserve - net_sy_to_account - net_sy_to_reserve;

    // Recalculate implied rate from new state
    let new_total_asset = sy_to_asset(state.sy_reserve);
    state.last_ln_implied_rate = get_ln_implied_rate(
        state.pt_reserve,
        new_total_asset,
        rate_scalar,
        rate_anchor,
        time_to_expiry
    );
}
```

---

## Constants

```cairo
const IMPLIED_RATE_TIME: u256 = 31_536_000;  // 365 * 86400 seconds
const MINIMUM_LIQUIDITY: u256 = 1000;
const MAX_MARKET_PROPORTION: u256 = 960_000_000_000_000_000;  // 0.96 WAD (96%)
const PERCENTAGE_DECIMALS: u256 = 100;
```

---

## Conclusion

Horizon now implements **Pendle's logit-based AMM curve** with the following features:

1. ✅ **Logit-based exchange rate**: `exchangeRate = logit(proportion) / rateScalar + rateAnchor`
2. ✅ **Dynamic anchor updates**: Anchor recalculated from `last_ln_implied_rate` after each trade
3. ✅ **Fee decay**: Exponential decay towards expiry matching Pendle's approach
4. ✅ **Implied rate tracking**: Updated after each trade via `get_ln_implied_rate`
5. ✅ **Overflow protection**: Capped at `MAX_LN_IMPLIED_RATE` (4.6 WAD) to prevent math errors
6. ✅ **High-precision math**: cubit 64.64 fixed-point (~19 decimal digits) for all transcendental functions

### Intentional Simplification

Horizon treats SY = Asset (no PY index conversion). This is acceptable because Horizon SY tokens always have a 1:1 relationship with the underlying asset at the protocol level. If this changes in the future, asset conversion can be added.

### Implementation Timeline

| Date | Milestone |
|------|-----------|
| December 2024 | Core logit-based AMM curve |
| December 2024 | Fee decay implementation |
| December 2024 | cubit 64.64 fixed-point integration (`math_fp.cairo`, `market_math_fp.cairo`) |

### Test Coverage

- 38+ dedicated Pendle AMM math tests (`test_pendle_amm_math.cairo`)
- 30+ fixed-point math precision tests (`test_math_fp.cairo`)
- Full market integration tests (`test_market.cairo`)
