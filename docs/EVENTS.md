# Horizon Protocol - Smart Contract Events

This document lists all events emitted by Horizon Protocol smart contracts.

## Summary

| Contract | Event Count |
|----------|-------------|
| Router | 6 |
| Factory | 2 |
| SY | 2 |
| PT | 0 |
| YT | 4 |
| MarketFactory | 2 |
| Market (AMM) | 5 |
| **Total** | **21** |

---

## Router Events

**File:** `contracts/src/router.cairo`

| Event | Fields | Trigger Action | Description |
|-------|--------|----------------|-------------|
| `MintPY` | `sender` (indexed), `receiver` (indexed), `yt`, `sy_in`, `pt_out`, `yt_out` | `mint_py_from_sy()` | Emitted when SY tokens are converted to PT + YT tokens |
| `RedeemPY` | `sender` (indexed), `receiver` (indexed), `yt`, `py_in`, `sy_out` | `redeem_py_to_sy()`, `redeem_pt_post_expiry()` | Emitted when PT+YT are redeemed for SY (pre-expiry) or PT redeemed post-expiry |
| `AddLiquidity` | `sender` (indexed), `receiver` (indexed), `market`, `sy_used`, `pt_used`, `lp_out` | `add_liquidity()` | Emitted when liquidity is added to a PT/SY market |
| `RemoveLiquidity` | `sender` (indexed), `receiver` (indexed), `market`, `lp_in`, `sy_out`, `pt_out` | `remove_liquidity()` | Emitted when liquidity is removed from a PT/SY market |
| `Swap` | `sender` (indexed), `receiver` (indexed), `market`, `sy_in`, `pt_in`, `sy_out`, `pt_out` | `swap_exact_sy_for_pt()`, `swap_exact_pt_for_sy()`, `swap_sy_for_exact_pt()`, `swap_pt_for_exact_sy()` | Emitted for all PT/SY swap operations through the router |
| `SwapYT` | `sender` (indexed), `receiver` (indexed), `yt`, `market`, `sy_in`, `yt_in`, `sy_out`, `yt_out` | `swap_exact_sy_for_yt()`, `swap_exact_yt_for_sy()` | Emitted for YT trading operations via flash swaps |

---

## Factory Events

**File:** `contracts/src/factory.cairo`

| Event | Fields | Trigger Action | Description |
|-------|--------|----------------|-------------|
| `YieldContractsCreated` | `sy` (indexed), `expiry` (indexed), `pt`, `yt`, `creator` | `create_yield_contracts()` | Emitted when a new PT/YT token pair is deployed for a specific SY and expiry |
| `ClassHashesUpdated` | `yt_class_hash`, `pt_class_hash` | `set_class_hashes()` | Emitted when the PT/YT contract class hashes are updated (admin) |

---

## SY (Standardized Yield) Events

**File:** `contracts/src/tokens/sy.cairo`

| Event | Fields | Trigger Action | Description |
|-------|--------|----------------|-------------|
| `Deposit` | `caller` (indexed), `receiver` (indexed), `amount_deposited`, `amount_sy_minted` | `deposit()` | Emitted when underlying yield-bearing tokens are deposited for SY tokens |
| `Redeem` | `caller` (indexed), `receiver` (indexed), `amount_sy_burned`, `amount_redeemed` | `redeem()` | Emitted when SY tokens are redeemed for underlying yield-bearing tokens |

---

## PT (Principal Token) Events

**File:** `contracts/src/tokens/pt.cairo`

| Event | Fields | Trigger Action | Description |
|-------|--------|----------------|-------------|
| *(No custom events)* | - | - | PT contract only uses inherited OpenZeppelin ERC20 events |

---

## YT (Yield Token) Events

**File:** `contracts/src/tokens/yt.cairo`

| Event | Fields | Trigger Action | Description |
|-------|--------|----------------|-------------|
| `MintPY` | `caller` (indexed), `receiver` (indexed), `amount_sy_deposited`, `amount_py_minted` | `mint_py()` | Emitted when SY is deposited to mint PT + YT tokens |
| `RedeemPY` | `caller` (indexed), `receiver` (indexed), `amount_py_redeemed`, `amount_sy_returned` | `redeem_py()` | Emitted when PT + YT are redeemed together for SY (before expiry) |
| `RedeemPYPostExpiry` | `caller` (indexed), `receiver` (indexed), `amount_pt_redeemed`, `amount_sy_returned` | `redeem_py_post_expiry()` | Emitted when PT is redeemed for SY after expiry (YT becomes worthless) |
| `InterestClaimed` | `user` (indexed), `amount_sy` | `redeem_due_interest()` | Emitted when a YT holder claims their accrued yield interest |

---

## MarketFactory Events

**File:** `contracts/src/market/market_factory.cairo`

| Event | Fields | Trigger Action | Description |
|-------|--------|----------------|-------------|
| `MarketCreated` | `pt` (indexed), `market`, `creator`, `scalar_root`, `initial_anchor`, `fee_rate` | `create_market()` | Emitted when a new PT/SY AMM market is deployed |
| `MarketClassHashUpdated` | `old_class_hash`, `new_class_hash` | `set_market_class_hash()` | Emitted when the market contract class hash is updated (admin) |

---

## Market (AMM) Events

**File:** `contracts/src/market/amm.cairo`

| Event | Fields | Trigger Action | Description |
|-------|--------|----------------|-------------|
| `Mint` | `sender` (indexed), `receiver` (indexed), `sy_amount`, `pt_amount`, `lp_amount` | `mint()` | Emitted when liquidity is added to the PT/SY pool |
| `Burn` | `sender` (indexed), `receiver` (indexed), `lp_amount`, `sy_amount`, `pt_amount` | `burn()` | Emitted when LP tokens are burned to remove liquidity |
| `Swap` | `sender` (indexed), `receiver` (indexed), `pt_in`, `sy_in`, `pt_out`, `sy_out`, `fee` | `swap_exact_pt_for_sy()`, `swap_sy_for_exact_pt()`, `swap_exact_sy_for_pt()`, `swap_pt_for_exact_sy()` | Emitted for all swap operations in the AMM with fee tracking |
| `ImpliedRateUpdated` | `old_rate`, `new_rate`, `timestamp` | `_update_implied_rate()` (internal) | Emitted when the market's ln(implied rate) changes after swaps |
| `FeesCollected` | `collector` (indexed), `receiver` (indexed), `amount` | `collect_fees()` | Emitted when accumulated trading fees are collected (admin) |

---

## Notes

- All `(indexed)` fields can be used for efficient event filtering
- Router events provide a high-level view of user operations
- Direct contract events (YT, Market) provide lower-level details
- OpenZeppelin component events (ERC20 Transfer, Approval, etc.) are inherited but not listed here
