# Horizon Protocol - Smart Contract Events

This document lists all events emitted by Horizon Protocol smart contracts.

## Summary

| Contract | Event Count |
|----------|-------------|
| Router | 6 |
| Factory | 2 |
| SY | 3 |
| PT | 0 |
| YT | 5 |
| MarketFactory | 2 |
| Market (AMM) | 6 |
| **Total** | **24** |

---

## Router Events

**File:** `contracts/src/router.cairo`

### MintPY

Emitted when SY tokens are converted to PT + YT tokens.

**Trigger:** `mint_py_from_sy()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `sender` | `ContractAddress` | Yes | Address initiating the mint |
| `receiver` | `ContractAddress` | Yes | Address receiving the PT and YT |
| `yt` | `ContractAddress` | No | YT contract address |
| `sy_in` | `u256` | No | Amount of SY deposited |
| `pt_out` | `u256` | No | Amount of PT minted |
| `yt_out` | `u256` | No | Amount of YT minted |

### RedeemPY

Emitted when PT+YT are redeemed for SY (pre-expiry) or PT redeemed post-expiry.

**Trigger:** `redeem_py_to_sy()`, `redeem_pt_post_expiry()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `sender` | `ContractAddress` | Yes | Address initiating the redemption |
| `receiver` | `ContractAddress` | Yes | Address receiving the SY |
| `yt` | `ContractAddress` | No | YT contract address |
| `py_in` | `u256` | No | Amount of PT+YT redeemed |
| `sy_out` | `u256` | No | Amount of SY received |

### AddLiquidity

Emitted when liquidity is added to a PT/SY market.

**Trigger:** `add_liquidity()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `sender` | `ContractAddress` | Yes | Address adding liquidity |
| `receiver` | `ContractAddress` | Yes | Address receiving LP tokens |
| `market` | `ContractAddress` | No | Market contract address |
| `sy_used` | `u256` | No | Amount of SY added |
| `pt_used` | `u256` | No | Amount of PT added |
| `lp_out` | `u256` | No | Amount of LP tokens minted |

### RemoveLiquidity

Emitted when liquidity is removed from a PT/SY market.

**Trigger:** `remove_liquidity()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `sender` | `ContractAddress` | Yes | Address removing liquidity |
| `receiver` | `ContractAddress` | Yes | Address receiving tokens |
| `market` | `ContractAddress` | No | Market contract address |
| `lp_in` | `u256` | No | Amount of LP tokens burned |
| `sy_out` | `u256` | No | Amount of SY received |
| `pt_out` | `u256` | No | Amount of PT received |

### Swap

Emitted for all PT/SY swap operations through the router.

**Trigger:** `swap_exact_sy_for_pt()`, `swap_exact_pt_for_sy()`, `swap_sy_for_exact_pt()`, `swap_pt_for_exact_sy()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `sender` | `ContractAddress` | Yes | Address initiating the swap |
| `receiver` | `ContractAddress` | Yes | Address receiving output tokens |
| `market` | `ContractAddress` | No | Market contract address |
| `sy_in` | `u256` | No | Amount of SY input (0 if swapping PT) |
| `pt_in` | `u256` | No | Amount of PT input (0 if swapping SY) |
| `sy_out` | `u256` | No | Amount of SY output (0 if receiving PT) |
| `pt_out` | `u256` | No | Amount of PT output (0 if receiving SY) |

### SwapYT

Emitted for YT trading operations via flash swaps.

**Trigger:** `swap_exact_sy_for_yt()`, `swap_exact_yt_for_sy()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `sender` | `ContractAddress` | Yes | Address initiating the swap |
| `receiver` | `ContractAddress` | Yes | Address receiving output tokens |
| `yt` | `ContractAddress` | No | YT contract address |
| `market` | `ContractAddress` | No | Market contract address |
| `sy_in` | `u256` | No | Amount of SY input |
| `yt_in` | `u256` | No | Amount of YT input |
| `sy_out` | `u256` | No | Amount of SY output |
| `yt_out` | `u256` | No | Amount of YT output |

---

## Factory Events

**File:** `contracts/src/factory.cairo`

### YieldContractsCreated

Emitted when a new PT/YT token pair is deployed for a specific SY and expiry.

**Trigger:** `create_yield_contracts()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `sy` | `ContractAddress` | Yes | SY token address |
| `expiry` | `u64` | Yes | Expiry timestamp |
| `pt` | `ContractAddress` | No | Deployed PT contract address |
| `yt` | `ContractAddress` | No | Deployed YT contract address |
| `creator` | `ContractAddress` | No | Address that created the contracts |
| `underlying` | `ContractAddress` | No | Underlying yield-bearing asset address |
| `underlying_symbol` | `ByteArray` | No | Symbol of the underlying asset |
| `initial_exchange_rate` | `u256` | No | SY exchange rate at creation time |
| `timestamp` | `u64` | No | Block timestamp of creation |
| `market_index` | `u32` | No | Index of this market in the factory |

### ClassHashesUpdated

Emitted when the PT/YT contract class hashes are updated (admin).

**Trigger:** `set_class_hashes()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `yt_class_hash` | `ClassHash` | No | New YT contract class hash |
| `pt_class_hash` | `ClassHash` | No | New PT contract class hash |

---

## SY (Standardized Yield) Events

**File:** `contracts/src/tokens/sy.cairo`

### Deposit

Emitted when underlying yield-bearing tokens are deposited for SY tokens.

**Trigger:** `deposit()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `caller` | `ContractAddress` | Yes | Address initiating the deposit |
| `receiver` | `ContractAddress` | Yes | Address receiving the SY tokens |
| `underlying` | `ContractAddress` | Yes | Underlying yield-bearing token address |
| `amount_deposited` | `u256` | No | Amount of underlying deposited |
| `amount_sy_minted` | `u256` | No | Amount of SY minted |
| `exchange_rate` | `u256` | No | Current exchange rate at deposit time |
| `total_supply_after` | `u256` | No | Total SY supply after deposit |
| `timestamp` | `u64` | No | Block timestamp |

### Redeem

Emitted when SY tokens are redeemed for underlying yield-bearing tokens.

**Trigger:** `redeem()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `caller` | `ContractAddress` | Yes | Address initiating the redemption |
| `receiver` | `ContractAddress` | Yes | Address receiving the underlying |
| `underlying` | `ContractAddress` | Yes | Underlying yield-bearing token address |
| `amount_sy_burned` | `u256` | No | Amount of SY burned |
| `amount_redeemed` | `u256` | No | Amount of underlying redeemed |
| `exchange_rate` | `u256` | No | Current exchange rate at redemption time |
| `total_supply_after` | `u256` | No | Total SY supply after redemption |
| `timestamp` | `u64` | No | Block timestamp |

### OracleRateUpdated

Emitted when the oracle exchange rate changes during a state-changing operation.

**Trigger:** `deposit()`, `redeem()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `sy` | `ContractAddress` | Yes | SY contract address |
| `underlying` | `ContractAddress` | Yes | Underlying token address |
| `old_rate` | `u256` | No | Previous exchange rate |
| `new_rate` | `u256` | No | New exchange rate |
| `rate_change_bps` | `u256` | No | Rate change in basis points (10000 = 100%) |
| `timestamp` | `u64` | No | Block timestamp |

---

## PT (Principal Token) Events

**File:** `contracts/src/tokens/pt.cairo`

*(No custom events)* - PT contract only uses inherited OpenZeppelin ERC20 events.

---

## YT (Yield Token) Events

**File:** `contracts/src/tokens/yt.cairo`

### MintPY

Emitted when SY is deposited to mint PT + YT tokens.

**Trigger:** `mint_py()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `caller` | `ContractAddress` | Yes | Address initiating the mint |
| `receiver` | `ContractAddress` | Yes | Address receiving PT and YT |
| `expiry` | `u64` | Yes | Expiry timestamp |
| `amount_sy_deposited` | `u256` | No | Amount of SY deposited |
| `amount_py_minted` | `u256` | No | Amount of PT/YT minted |
| `pt` | `ContractAddress` | No | PT contract address |
| `sy` | `ContractAddress` | No | SY contract address |
| `py_index` | `u256` | No | Current PY index |
| `exchange_rate` | `u256` | No | Current SY exchange rate |
| `total_pt_supply_after` | `u256` | No | Total PT supply after mint |
| `total_yt_supply_after` | `u256` | No | Total YT supply after mint |
| `timestamp` | `u64` | No | Block timestamp |

### RedeemPY

Emitted when PT + YT are redeemed together for SY (before expiry).

**Trigger:** `redeem_py()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `caller` | `ContractAddress` | Yes | Address initiating the redemption |
| `receiver` | `ContractAddress` | Yes | Address receiving SY |
| `expiry` | `u64` | Yes | Expiry timestamp |
| `sy` | `ContractAddress` | No | SY contract address |
| `pt` | `ContractAddress` | No | PT contract address |
| `amount_py_redeemed` | `u256` | No | Amount of PT/YT redeemed |
| `amount_sy_returned` | `u256` | No | Amount of SY returned |
| `py_index` | `u256` | No | Current PY index |
| `exchange_rate` | `u256` | No | Current SY exchange rate |
| `timestamp` | `u64` | No | Block timestamp |

### RedeemPYPostExpiry

Emitted when PT is redeemed for SY after expiry (YT becomes worthless).

**Trigger:** `redeem_py_post_expiry()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `caller` | `ContractAddress` | Yes | Address initiating the redemption |
| `receiver` | `ContractAddress` | Yes | Address receiving SY |
| `expiry` | `u64` | Yes | Expiry timestamp |
| `amount_pt_redeemed` | `u256` | No | Amount of PT redeemed |
| `amount_sy_returned` | `u256` | No | Amount of SY returned |
| `pt` | `ContractAddress` | No | PT contract address |
| `sy` | `ContractAddress` | No | SY contract address |
| `final_py_index` | `u256` | No | Final PY index at expiry |
| `final_exchange_rate` | `u256` | No | Final SY exchange rate |
| `timestamp` | `u64` | No | Block timestamp |

### InterestClaimed

Emitted when a YT holder claims their accrued yield interest.

**Trigger:** `redeem_due_interest()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `user` | `ContractAddress` | Yes | User claiming interest |
| `yt` | `ContractAddress` | Yes | YT contract address |
| `expiry` | `u64` | Yes | Expiry timestamp |
| `amount_sy` | `u256` | No | Amount of SY interest claimed |
| `sy` | `ContractAddress` | No | SY contract address |
| `yt_balance` | `u256` | No | User's YT balance at claim time |
| `py_index_at_claim` | `u256` | No | PY index at time of claim |
| `exchange_rate` | `u256` | No | Current SY exchange rate |
| `timestamp` | `u64` | No | Block timestamp |

### ExpiryReached

Emitted once when the first post-expiry redemption occurs, capturing final state.

**Trigger:** `redeem_py_post_expiry()` (first call)

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `market` | `ContractAddress` | Yes | Market contract address (zero if none) |
| `yt` | `ContractAddress` | Yes | YT contract address |
| `pt` | `ContractAddress` | Yes | PT contract address |
| `sy` | `ContractAddress` | No | SY contract address |
| `expiry` | `u64` | No | Expiry timestamp |
| `final_exchange_rate` | `u256` | No | Final SY exchange rate at expiry |
| `final_py_index` | `u256` | No | Final PY index at expiry |
| `total_pt_supply` | `u256` | No | Total PT supply at expiry |
| `total_yt_supply` | `u256` | No | Total YT supply at expiry |
| `sy_reserve` | `u256` | No | SY reserve (0 if no market reference) |
| `pt_reserve` | `u256` | No | PT reserve (0 if no market reference) |
| `timestamp` | `u64` | No | Block timestamp |

---

## MarketFactory Events

**File:** `contracts/src/market/market_factory.cairo`

### MarketCreated

Emitted when a new PT/SY AMM market is deployed.

**Trigger:** `create_market()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `pt` | `ContractAddress` | Yes | PT token address |
| `expiry` | `u64` | Yes | Market expiry timestamp |
| `market` | `ContractAddress` | No | Deployed market contract address |
| `creator` | `ContractAddress` | No | Address that created the market |
| `scalar_root` | `u256` | No | Rate sensitivity parameter |
| `initial_anchor` | `u256` | No | Initial ln(implied rate) |
| `fee_rate` | `u256` | No | Trading fee rate in WAD |
| `sy` | `ContractAddress` | No | SY token address |
| `yt` | `ContractAddress` | No | YT token address |
| `underlying` | `ContractAddress` | No | Underlying asset address |
| `underlying_symbol` | `ByteArray` | No | Symbol of the underlying asset |
| `initial_exchange_rate` | `u256` | No | SY exchange rate at creation |
| `timestamp` | `u64` | No | Block timestamp of creation |
| `market_index` | `u32` | No | Index of this market in the factory |

### MarketClassHashUpdated

Emitted when the market contract class hash is updated (admin).

**Trigger:** `set_market_class_hash()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `old_class_hash` | `ClassHash` | No | Previous market class hash |
| `new_class_hash` | `ClassHash` | No | New market class hash |

---

## Market (AMM) Events

**File:** `contracts/src/market/amm.cairo`

### Mint

Emitted when liquidity is added to the PT/SY pool.

**Trigger:** `mint()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `sender` | `ContractAddress` | Yes | Address adding liquidity |
| `receiver` | `ContractAddress` | Yes | Address receiving LP tokens |
| `expiry` | `u64` | Yes | Market expiry timestamp |
| `sy` | `ContractAddress` | No | SY token address |
| `pt` | `ContractAddress` | No | PT token address |
| `sy_amount` | `u256` | No | Amount of SY added |
| `pt_amount` | `u256` | No | Amount of PT added |
| `lp_amount` | `u256` | No | Amount of LP tokens minted |
| `exchange_rate` | `u256` | No | Current SY exchange rate |
| `implied_rate` | `u256` | No | Current ln(implied rate) |
| `sy_reserve_after` | `u256` | No | SY reserve after operation |
| `pt_reserve_after` | `u256` | No | PT reserve after operation |
| `total_lp_after` | `u256` | No | Total LP supply after operation |
| `timestamp` | `u64` | No | Block timestamp |

### Burn

Emitted when LP tokens are burned to remove liquidity.

**Trigger:** `burn()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `sender` | `ContractAddress` | Yes | Address removing liquidity |
| `receiver` | `ContractAddress` | Yes | Address receiving tokens |
| `expiry` | `u64` | Yes | Market expiry timestamp |
| `sy` | `ContractAddress` | No | SY token address |
| `pt` | `ContractAddress` | No | PT token address |
| `lp_amount` | `u256` | No | Amount of LP tokens burned |
| `sy_amount` | `u256` | No | Amount of SY received |
| `pt_amount` | `u256` | No | Amount of PT received |
| `exchange_rate` | `u256` | No | Current SY exchange rate |
| `implied_rate` | `u256` | No | Current ln(implied rate) |
| `sy_reserve_after` | `u256` | No | SY reserve after operation |
| `pt_reserve_after` | `u256` | No | PT reserve after operation |
| `total_lp_after` | `u256` | No | Total LP supply after operation |
| `timestamp` | `u64` | No | Block timestamp |

### Swap

Emitted for all swap operations in the AMM with fee and rate tracking.

**Trigger:** `swap_exact_pt_for_sy()`, `swap_sy_for_exact_pt()`, `swap_exact_sy_for_pt()`, `swap_pt_for_exact_sy()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `sender` | `ContractAddress` | Yes | Address initiating the swap |
| `receiver` | `ContractAddress` | Yes | Address receiving output tokens |
| `expiry` | `u64` | Yes | Market expiry timestamp |
| `sy` | `ContractAddress` | No | SY token address |
| `pt` | `ContractAddress` | No | PT token address |
| `pt_in` | `u256` | No | Amount of PT input (0 if swapping SY) |
| `sy_in` | `u256` | No | Amount of SY input (0 if swapping PT) |
| `pt_out` | `u256` | No | Amount of PT output (0 if receiving SY) |
| `sy_out` | `u256` | No | Amount of SY output (0 if receiving PT) |
| `fee` | `u256` | No | Fee amount charged |
| `implied_rate_before` | `u256` | No | ln(implied rate) before swap |
| `implied_rate_after` | `u256` | No | ln(implied rate) after swap |
| `exchange_rate` | `u256` | No | Current SY exchange rate |
| `sy_reserve_after` | `u256` | No | SY reserve after operation |
| `pt_reserve_after` | `u256` | No | PT reserve after operation |
| `timestamp` | `u64` | No | Block timestamp |

### ImpliedRateUpdated

Emitted when the market's ln(implied rate) changes after swaps.

**Trigger:** `_update_implied_rate()` (internal)

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `market` | `ContractAddress` | Yes | Market contract address |
| `expiry` | `u64` | Yes | Market expiry timestamp |
| `old_rate` | `u256` | No | Previous ln(implied rate) |
| `new_rate` | `u256` | No | New ln(implied rate) |
| `timestamp` | `u64` | No | Block timestamp |
| `time_to_expiry` | `u64` | No | Seconds remaining until expiry |
| `exchange_rate` | `u256` | No | Current SY exchange rate |
| `sy_reserve` | `u256` | No | Current SY reserve |
| `pt_reserve` | `u256` | No | Current PT reserve |
| `total_lp` | `u256` | No | Total LP token supply |

### FeesCollected

Emitted when accumulated trading fees are collected (admin).

**Trigger:** `collect_fees()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `collector` | `ContractAddress` | Yes | Address collecting fees (admin) |
| `receiver` | `ContractAddress` | Yes | Address receiving the fees |
| `market` | `ContractAddress` | Yes | Market contract address |
| `amount` | `u256` | No | Amount of SY fees collected |
| `expiry` | `u64` | No | Market expiry timestamp |
| `fee_rate` | `u256` | No | Current fee rate in WAD |
| `timestamp` | `u64` | No | Block timestamp |

### ScalarRootUpdated

Emitted when the scalar root parameter is updated (admin).

**Trigger:** `set_scalar_root()`

| Field | Type | Indexed | Description |
|-------|------|---------|-------------|
| `market` | `ContractAddress` | Yes | Market contract address |
| `old_value` | `u256` | No | Previous scalar root value |
| `new_value` | `u256` | No | New scalar root value |
| `timestamp` | `u64` | No | Block timestamp |

---

## Notes

- All indexed fields can be used for efficient event filtering by indexers
- Router events provide a high-level view of user operations
- Direct contract events (YT, Market) provide lower-level details with rich context
- Events are enriched with contextual data to enable indexer-only analytics without RPC calls
- OpenZeppelin component events (ERC20 Transfer, Approval, etc.) are inherited but not listed here

## Enrichment Design Principles

All events follow these design principles for maximum indexer utility:

1. **Self-Contained**: Each event contains all data needed to understand the operation without additional RPC calls
2. **Denormalized**: Related entity data (addresses, rates) included even if technically redundant
3. **Temporal Context**: Timestamps and rate snapshots for time-series analysis
4. **Indexer-Friendly**: Key fields indexed for efficient filtering by address, expiry, etc.
