# Horizon Protocol - Event Enrichment Specification

This document specifies enhanced events to maximize frontend indexing capabilities. Each enriched event includes additional contextual data that eliminates the need for secondary RPC calls.

## Design Principles

1. **Self-Contained Events**: Each event should contain all data needed to understand the operation without additional RPC calls
2. **Denormalized Data**: Include related entity data (addresses, names, rates) even if technically redundant
3. **Temporal Context**: Include timestamps, rates, and state snapshots for time-series analysis
4. **Indexer-Friendly**: All indexed (`#[key]`) fields should be useful for filtering

---

## Factory Events

### `YieldContractsCreated` (Enriched)

**Current Fields:**
```cairo
sy: ContractAddress (indexed)
expiry: u64 (indexed)
pt: ContractAddress
yt: ContractAddress
creator: ContractAddress
```

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `underlying` | `ContractAddress` | `sy.underlying_asset()` | Direct link to underlying token |
| `underlying_symbol` | `ByteArray` | `underlying.symbol()` | Display name without RPC |
| `sy_symbol` | `ByteArray` | `sy.symbol()` | e.g., "SY-nstSTRK" |
| `initial_exchange_rate` | `u256` | `sy.exchange_rate()` | Rate at creation for baseline |
| `timestamp` | `u64` | `get_block_timestamp()` | Block time for historical ordering |

**Enriched Event:**
```cairo
#[derive(Drop, starknet::Event)]
pub struct YieldContractsCreated {
    #[key]
    pub sy: ContractAddress,
    #[key]
    pub expiry: u64,
    pub pt: ContractAddress,
    pub yt: ContractAddress,
    pub creator: ContractAddress,
    // NEW FIELDS
    pub underlying: ContractAddress,
    pub underlying_symbol: ByteArray,  // Full symbol for display
    pub initial_exchange_rate: u256,
    pub timestamp: u64,
    pub market_index: u32,
}
```

**Frontend Features Enabled:**
- Auto-populate market discovery page with full token info
- Show "Created X hours ago" without timestamp queries
- Display initial rate for "rate since inception" calculations
- Filter by underlying asset type

---

## MarketFactory Events

### `MarketCreated` (Enriched)

**Current Fields:**
```cairo
pt: ContractAddress (indexed)
market: ContractAddress
creator: ContractAddress
scalar_root: u256
initial_anchor: u256
fee_rate: u256
```

**CRITICAL MISSING: `expiry`** - Without this, frontend cannot:
- Show time remaining
- Filter active vs expired markets
- Sort by expiry date
- Display maturity calendars

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `expiry` | `u64` | `pt.expiry()` | **Critical** - market maturity date |
| `sy` | `ContractAddress` | `pt.sy()` | Direct SY reference |
| `yt` | `ContractAddress` | `pt.yt()` | Direct YT reference |
| `underlying` | `ContractAddress` | `sy.underlying_asset()` | Underlying token |
| `underlying_symbol` | `ByteArray` | `underlying.symbol()` | Display without RPC |
| `initial_exchange_rate` | `u256` | `sy.exchange_rate()` | Rate at market creation |
| `timestamp` | `u64` | Block timestamp | Creation time |
| `market_index` | `u32` | Factory counter | Sequential market ID |

**Enriched Event:**
```cairo
#[derive(Drop, starknet::Event)]
pub struct MarketCreated {
    #[key]
    pub pt: ContractAddress,
    #[key]
    pub expiry: u64,           // NEW: Critical for filtering
    pub market: ContractAddress,
    pub creator: ContractAddress,
    pub scalar_root: u256,
    pub initial_anchor: u256,
    pub fee_rate: u256,
    // NEW FIELDS
    pub sy: ContractAddress,
    pub yt: ContractAddress,
    pub underlying: ContractAddress,
    pub underlying_symbol: ByteArray,
    pub initial_exchange_rate: u256,
    pub timestamp: u64,
    pub market_index: u32,
}
```

**Frontend Features Enabled:**
- Market listing page with full details in single query
- "Expires in X days" countdown without RPC
- Filter markets by: expiry range, underlying asset, fee tier
- Maturity calendar view
- Sort by: newest, soonest expiry, fee rate

---

## SY (Standardized Yield) Events

### `Deposit` (Enriched)

**Current Fields:**
```cairo
caller: ContractAddress (indexed)
receiver: ContractAddress (indexed)
amount_deposited: u256
amount_sy_minted: u256
```

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `underlying` | `ContractAddress` | Storage | Underlying token address |
| `exchange_rate` | `u256` | `self.exchange_rate()` | Rate snapshot for APY calc |
| `total_supply_after` | `u256` | Post-mint supply | TVL tracking |
| `timestamp` | `u64` | Block timestamp | Time-series data |

**Enriched Event:**
```cairo
#[derive(Drop, starknet::Event)]
pub struct Deposit {
    #[key]
    pub caller: ContractAddress,
    #[key]
    pub receiver: ContractAddress,
    #[key]
    pub underlying: ContractAddress,    // NEW: enables filtering by asset
    pub amount_deposited: u256,
    pub amount_sy_minted: u256,
    // NEW FIELDS
    pub exchange_rate: u256,
    pub total_supply_after: u256,
    pub timestamp: u64,
}
```

### `Redeem` (Enriched)

**Current Fields:**
```cairo
caller: ContractAddress (indexed)
receiver: ContractAddress (indexed)
amount_sy_burned: u256
amount_redeemed: u256
```

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `underlying` | `ContractAddress` | Storage | Underlying token |
| `exchange_rate` | `u256` | Current rate | Rate at redemption |
| `total_supply_after` | `u256` | Post-burn supply | TVL tracking |
| `timestamp` | `u64` | Block timestamp | Time-series |

**Enriched Event:**
```cairo
#[derive(Drop, starknet::Event)]
pub struct Redeem {
    #[key]
    pub caller: ContractAddress,
    #[key]
    pub receiver: ContractAddress,
    #[key]
    pub underlying: ContractAddress,
    pub amount_sy_burned: u256,
    pub amount_redeemed: u256,
    // NEW FIELDS
    pub exchange_rate: u256,
    pub total_supply_after: u256,
    pub timestamp: u64,
}
```

**Frontend Features Enabled:**
- SY TVL chart over time (no state queries needed)
- Exchange rate history chart
- Deposit/withdrawal volume analytics
- User deposit history with rates at each action
- Calculate realized yield: (exit_rate - entry_rate) / entry_rate

---

## YT (Yield Token) Events

### `MintPY` (Enriched)

**Current Fields:**
```cairo
caller: ContractAddress (indexed)
receiver: ContractAddress (indexed)
amount_sy_deposited: u256
amount_py_minted: u256
```

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `pt` | `ContractAddress` | Storage | PT address reference |
| `sy` | `ContractAddress` | Storage | SY address reference |
| `expiry` | `u64` | Storage | Expiry for time context |
| `py_index` | `u256` | `py_index_stored` | Index snapshot for yield calc |
| `exchange_rate` | `u256` | `sy.exchange_rate()` | Rate snapshot |
| `total_pt_supply_after` | `u256` | PT supply | Supply tracking |
| `total_yt_supply_after` | `u256` | YT supply | Supply tracking |
| `timestamp` | `u64` | Block timestamp | Time-series |

**Enriched Event:**
```cairo
#[derive(Drop, starknet::Event)]
pub struct MintPY {
    #[key]
    pub caller: ContractAddress,
    #[key]
    pub receiver: ContractAddress,
    #[key]
    pub expiry: u64,                    // NEW: enables time-based filtering
    pub amount_sy_deposited: u256,
    pub amount_py_minted: u256,
    // NEW FIELDS
    pub pt: ContractAddress,
    pub sy: ContractAddress,
    pub py_index: u256,
    pub exchange_rate: u256,
    pub total_pt_supply_after: u256,
    pub total_yt_supply_after: u256,
    pub timestamp: u64,
}
```

### `RedeemPY` (Enriched)

**Current Fields:**
```cairo
caller: ContractAddress (indexed)
receiver: ContractAddress (indexed)
amount_py_redeemed: u256
amount_sy_returned: u256
```

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `pt` | `ContractAddress` | Storage | PT reference |
| `sy` | `ContractAddress` | Storage | SY reference |
| `expiry` | `u64` | Storage | Expiry context |
| `py_index` | `u256` | Current index | Index at redemption |
| `exchange_rate` | `u256` | SY rate | Rate snapshot |
| `timestamp` | `u64` | Block timestamp | Time-series |

**Enriched Event:**
```cairo
#[derive(Drop, starknet::Event)]
pub struct RedeemPY {
    #[key]
    pub caller: ContractAddress,
    #[key]
    pub receiver: ContractAddress,
    #[key]
    pub expiry: u64,
    pub amount_py_redeemed: u256,
    pub amount_sy_returned: u256,
    // NEW FIELDS
    pub pt: ContractAddress,
    pub sy: ContractAddress,
    pub py_index: u256,
    pub exchange_rate: u256,
    pub timestamp: u64,
}
```

### `RedeemPYPostExpiry` (Enriched)

**Current Fields:**
```cairo
caller: ContractAddress (indexed)
receiver: ContractAddress (indexed)
amount_pt_redeemed: u256
amount_sy_returned: u256
```

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `pt` | `ContractAddress` | Storage | PT reference |
| `sy` | `ContractAddress` | Storage | SY reference |
| `expiry` | `u64` | Storage | When it expired |
| `final_py_index` | `u256` | Stored index | Final yield index |
| `final_exchange_rate` | `u256` | SY rate | Final rate |
| `timestamp` | `u64` | Block timestamp | Redemption time |
| `time_since_expiry` | `u64` | Calculated | Delay in redemption |

**Enriched Event:**
```cairo
#[derive(Drop, starknet::Event)]
pub struct RedeemPYPostExpiry {
    #[key]
    pub caller: ContractAddress,
    #[key]
    pub receiver: ContractAddress,
    #[key]
    pub expiry: u64,
    pub amount_pt_redeemed: u256,
    pub amount_sy_returned: u256,
    // NEW FIELDS
    pub pt: ContractAddress,
    pub sy: ContractAddress,
    pub final_py_index: u256,
    pub final_exchange_rate: u256,
    pub timestamp: u64,
}
```

### `InterestClaimed` (Enriched)

**Current Fields:**
```cairo
user: ContractAddress (indexed)
amount_sy: u256
```

**CRITICAL MISSING**: No context about the claim - makes yield analytics impossible.

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `yt` | `ContractAddress` | `get_contract_address()` | YT contract reference |
| `sy` | `ContractAddress` | Storage | SY reference |
| `expiry` | `u64` | Storage | Expiry context |
| `yt_balance` | `u256` | User's YT balance | Position size at claim |
| `py_index_at_claim` | `u256` | Current index | Index snapshot |
| `exchange_rate` | `u256` | SY rate | Rate at claim |
| `timestamp` | `u64` | Block timestamp | Claim time |

**Enriched Event:**
```cairo
#[derive(Drop, starknet::Event)]
pub struct InterestClaimed {
    #[key]
    pub user: ContractAddress,
    #[key]
    pub yt: ContractAddress,            // NEW: enables filtering by YT
    #[key]
    pub expiry: u64,                    // NEW: enables time-based filtering
    pub amount_sy: u256,
    // NEW FIELDS
    pub sy: ContractAddress,
    pub yt_balance: u256,
    pub py_index_at_claim: u256,
    pub exchange_rate: u256,
    pub timestamp: u64,
}
```

**Frontend Features Enabled:**
- Complete yield tracking per position
- "You've earned X in yield from this YT" calculations
- Yield rate analytics (amount_sy / yt_balance / time_held)
- Claim history with context
- Leaderboard of top yield earners

---

## Market (AMM) Events

### `Mint` (Enriched)

**Current Fields:**
```cairo
sender: ContractAddress (indexed)
receiver: ContractAddress (indexed)
sy_amount: u256
pt_amount: u256
lp_amount: u256
```

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `expiry` | `u64` | Storage | Market expiry |
| `sy` | `ContractAddress` | Storage | SY reference |
| `pt` | `ContractAddress` | Storage | PT reference |
| `total_lp_after` | `u256` | Post-mint supply | TVL tracking |
| `sy_reserve_after` | `u256` | Post-mint reserve | Reserve tracking |
| `pt_reserve_after` | `u256` | Post-mint reserve | Reserve tracking |
| `implied_rate` | `u256` | `get_ln_implied_rate()` | Rate at mint |
| `exchange_rate` | `u256` | `sy.exchange_rate()` | SY rate snapshot |
| `timestamp` | `u64` | Block timestamp | Time-series |

**Enriched Event:**
```cairo
#[derive(Drop, starknet::Event)]
pub struct Mint {
    #[key]
    pub sender: ContractAddress,
    #[key]
    pub receiver: ContractAddress,
    #[key]
    pub expiry: u64,                    // NEW: time-based filtering
    pub sy_amount: u256,
    pub pt_amount: u256,
    pub lp_amount: u256,
    // NEW FIELDS
    pub sy: ContractAddress,
    pub pt: ContractAddress,
    pub total_lp_after: u256,
    pub sy_reserve_after: u256,
    pub pt_reserve_after: u256,
    pub implied_rate: u256,
    pub exchange_rate: u256,
    pub timestamp: u64,
}
```

### `Burn` (Enriched)

**Current Fields:**
```cairo
sender: ContractAddress (indexed)
receiver: ContractAddress (indexed)
lp_amount: u256
sy_amount: u256
pt_amount: u256
```

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `expiry` | `u64` | Storage | Market expiry |
| `sy` | `ContractAddress` | Storage | SY reference |
| `pt` | `ContractAddress` | Storage | PT reference |
| `total_lp_after` | `u256` | Post-burn supply | TVL tracking |
| `sy_reserve_after` | `u256` | Post-burn reserve | Reserve tracking |
| `pt_reserve_after` | `u256` | Post-burn reserve | Reserve tracking |
| `implied_rate` | `u256` | Current rate | Rate at burn |
| `exchange_rate` | `u256` | SY rate | Rate snapshot |
| `timestamp` | `u64` | Block timestamp | Time-series |

**Enriched Event:**
```cairo
#[derive(Drop, starknet::Event)]
pub struct Burn {
    #[key]
    pub sender: ContractAddress,
    #[key]
    pub receiver: ContractAddress,
    #[key]
    pub expiry: u64,
    pub lp_amount: u256,
    pub sy_amount: u256,
    pub pt_amount: u256,
    // NEW FIELDS
    pub sy: ContractAddress,
    pub pt: ContractAddress,
    pub total_lp_after: u256,
    pub sy_reserve_after: u256,
    pub pt_reserve_after: u256,
    pub implied_rate: u256,
    pub exchange_rate: u256,
    pub timestamp: u64,
}
```

### `Swap` (Enriched)

**Current Fields:**
```cairo
sender: ContractAddress (indexed)
receiver: ContractAddress (indexed)
pt_in: u256
sy_in: u256
pt_out: u256
sy_out: u256
fee: u256
```

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `expiry` | `u64` | Storage | Market expiry |
| `sy` | `ContractAddress` | Storage | SY reference |
| `pt` | `ContractAddress` | Storage | PT reference |
| `implied_rate_before` | `u256` | Pre-swap rate | Rate impact analysis |
| `implied_rate_after` | `u256` | Post-swap rate | Rate impact analysis |
| `exchange_rate` | `u256` | SY rate | For USD value calc |
| `sy_reserve_after` | `u256` | Post-swap reserve | Reserve tracking |
| `pt_reserve_after` | `u256` | Post-swap reserve | Reserve tracking |
| `timestamp` | `u64` | Block timestamp | Time-series |

**Enriched Event:**
```cairo
#[derive(Drop, starknet::Event)]
pub struct Swap {
    #[key]
    pub sender: ContractAddress,
    #[key]
    pub receiver: ContractAddress,
    #[key]
    pub expiry: u64,                    // NEW: time-based filtering
    pub pt_in: u256,
    pub sy_in: u256,
    pub pt_out: u256,
    pub sy_out: u256,
    pub fee: u256,
    // NEW FIELDS
    pub sy: ContractAddress,
    pub pt: ContractAddress,
    pub implied_rate_before: u256,
    pub implied_rate_after: u256,
    pub exchange_rate: u256,
    pub sy_reserve_after: u256,
    pub pt_reserve_after: u256,
    pub timestamp: u64,
}
```

### `ImpliedRateUpdated` (Enriched)

**Current Fields:**
```cairo
old_rate: u256
new_rate: u256
timestamp: u64
```

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `market` | `ContractAddress` | `get_contract_address()` | Market reference |
| `expiry` | `u64` | Storage | Time context |
| `time_to_expiry` | `u64` | Calculated | Remaining time |
| `exchange_rate` | `u256` | SY rate | For correlation analysis |
| `sy_reserve` | `u256` | Current reserve | Context |
| `pt_reserve` | `u256` | Current reserve | Context |
| `total_lp` | `u256` | LP supply | Context |

**Enriched Event:**
```cairo
#[derive(Drop, starknet::Event)]
pub struct ImpliedRateUpdated {
    #[key]
    pub market: ContractAddress,        // NEW: enables market filtering
    #[key]
    pub expiry: u64,                    // NEW: time-based filtering
    pub old_rate: u256,
    pub new_rate: u256,
    pub timestamp: u64,
    // NEW FIELDS
    pub time_to_expiry: u64,
    pub exchange_rate: u256,
    pub sy_reserve: u256,
    pub pt_reserve: u256,
    pub total_lp: u256,
}
```

### `FeesCollected` (Enriched)

**Current Fields:**
```cairo
collector: ContractAddress (indexed)
receiver: ContractAddress (indexed)
amount: u256
```

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `market` | `ContractAddress` | `get_contract_address()` | Market reference |
| `expiry` | `u64` | Storage | Market expiry |
| `fee_rate` | `u256` | Storage | Current fee rate |
| `cumulative_volume` | `u256` | Derived | Total volume (fees / rate) |
| `timestamp` | `u64` | Block timestamp | Time-series |

**Enriched Event:**
```cairo
#[derive(Drop, starknet::Event)]
pub struct FeesCollected {
    #[key]
    pub collector: ContractAddress,
    #[key]
    pub receiver: ContractAddress,
    #[key]
    pub market: ContractAddress,        // NEW: enables market filtering
    pub amount: u256,
    // NEW FIELDS
    pub expiry: u64,
    pub fee_rate: u256,
    pub timestamp: u64,
}
```

**Frontend Features Enabled:**
- Complete swap history with rate impact
- Implied rate charts over time (candlestick style)
- Price impact analytics
- Reserve ratio tracking
- LP position P&L calculations
- Volume and fee revenue tracking
- Market depth visualization

---

## Router Events

### `MintPY` (Enriched)

**Current Fields:**
```cairo
sender: ContractAddress (indexed)
receiver: ContractAddress (indexed)
yt: ContractAddress
sy_in: u256
pt_out: u256
yt_out: u256
```

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `pt` | `ContractAddress` | `yt.pt()` | PT reference |
| `sy` | `ContractAddress` | `yt.sy()` | SY reference |
| `expiry` | `u64` | `yt.expiry()` | Expiry context |
| `exchange_rate` | `u256` | `sy.exchange_rate()` | Rate snapshot |
| `timestamp` | `u64` | Block timestamp | Time-series |

### `RedeemPY` (Enriched)

**Current Fields:**
```cairo
sender: ContractAddress (indexed)
receiver: ContractAddress (indexed)
yt: ContractAddress
py_in: u256
sy_out: u256
```

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `pt` | `ContractAddress` | `yt.pt()` | PT reference |
| `sy` | `ContractAddress` | `yt.sy()` | SY reference |
| `expiry` | `u64` | `yt.expiry()` | Expiry context |
| `is_post_expiry` | `bool` | `yt.is_expired()` | Redemption type |
| `exchange_rate` | `u256` | SY rate | Rate snapshot |
| `timestamp` | `u64` | Block timestamp | Time-series |

### `AddLiquidity` / `RemoveLiquidity` (Enriched)

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `expiry` | `u64` | `market.expiry()` | Market expiry |
| `sy` | `ContractAddress` | `market.sy()` | SY reference |
| `pt` | `ContractAddress` | `market.pt()` | PT reference |
| `implied_rate` | `u256` | Market rate | Rate at action |
| `exchange_rate` | `u256` | SY rate | For USD value |
| `total_lp_after` | `u256` | LP supply | TVL tracking |
| `timestamp` | `u64` | Block timestamp | Time-series |

### `Swap` (Enriched)

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `expiry` | `u64` | `market.expiry()` | Market expiry |
| `sy` | `ContractAddress` | `market.sy()` | SY reference |
| `pt` | `ContractAddress` | `market.pt()` | PT reference |
| `implied_rate_after` | `u256` | Post-swap rate | Rate tracking |
| `exchange_rate` | `u256` | SY rate | For USD value |
| `fee` | `u256` | From market | Fee paid |
| `timestamp` | `u64` | Block timestamp | Time-series |

### `SwapYT` (Enriched)

**Current Fields:**
```cairo
sender: ContractAddress (indexed)
receiver: ContractAddress (indexed)
yt: ContractAddress
market: ContractAddress
sy_in: u256
yt_in: u256
sy_out: u256
yt_out: u256
```

**Proposed Additions:**
| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `pt` | `ContractAddress` | `yt.pt()` | PT reference |
| `sy` | `ContractAddress` | `yt.sy()` | SY reference |
| `expiry` | `u64` | `yt.expiry()` | Expiry context |
| `implied_rate` | `u256` | Market rate | Rate at swap |
| `exchange_rate` | `u256` | SY rate | For USD value |
| `timestamp` | `u64` | Block timestamp | Time-series |

---

## New Events to Add

### `ExpiryReached` (New)

Should be emitted when a market/YT reaches expiry.

```cairo
#[derive(Drop, starknet::Event)]
pub struct ExpiryReached {
    #[key]
    pub market: ContractAddress,
    #[key]
    pub yt: ContractAddress,
    #[key]
    pub pt: ContractAddress,
    pub sy: ContractAddress,
    pub expiry: u64,
    pub final_exchange_rate: u256,
    pub final_py_index: u256,
    pub total_pt_supply: u256,
    pub total_yt_supply: u256,
    pub sy_reserve: u256,
    pub pt_reserve: u256,
    pub timestamp: u64,
}
```

**Frontend Features Enabled:**
- Expiry notifications
- Final rate snapshot for yield calculations
- Expiry history page

### `OracleRateUpdated` (New)

For SY contracts, emit when exchange rate changes significantly.

```cairo
#[derive(Drop, starknet::Event)]
pub struct OracleRateUpdated {
    #[key]
    pub sy: ContractAddress,
    #[key]
    pub underlying: ContractAddress,
    pub old_rate: u256,
    pub new_rate: u256,
    pub rate_change_bps: u256,      // Basis points change
    pub timestamp: u64,
}
```

**Frontend Features Enabled:**
- Real-time yield rate tracking
- APY calculation without polling
- Rate change alerts

---

## Summary: Frontend Features Unlocked

### With Current Events
| Feature | Possible? | Notes |
|---------|-----------|-------|
| Transaction history | Partial | Missing context, needs RPC calls |
| Portfolio value | No | No rate snapshots |
| Yield earned | No | Missing index/rate data |
| Market analytics | No | No TVL/volume without state queries |
| Expiry tracking | Partial | Missing from MarketCreated |

### With Enriched Events
| Feature | Possible? | Notes |
|---------|-----------|-------|
| Transaction history | Yes | Full context in events |
| Portfolio value over time | Yes | Rate snapshots enable calculations |
| Yield earned per position | Yes | py_index + exchange_rate |
| Real-time APY | Yes | Rate change events |
| TVL charts | Yes | Supply/reserve snapshots |
| Volume analytics | Yes | All trades with values |
| Price impact analysis | Yes | Rate before/after |
| LP P&L tracking | Yes | Entry/exit rates stored |
| Maturity calendar | Yes | Expiry in all events |
| Leaderboards | Yes | Full trade context |
| Rate correlation | Yes | Exchange rate + implied rate |
| Fee revenue tracking | Yes | Fee field on swaps |

---

## Implementation Priority

### Phase 1 - Critical (Blocking Issues)
1. Add `expiry` to `MarketCreated`
2. Add `expiry` to all Market events (Mint, Burn, Swap)
3. Add `timestamp` to all events missing it

### Phase 2 - High Value
4. Add `exchange_rate` to all events
5. Add token references (sy, pt, yt) where missing
6. Add reserve/supply snapshots to Market events

### Phase 3 - Analytics Enhancement
7. Add `implied_rate_before`/`after` to Swap
8. Add `py_index` to YT events
9. Enrich `InterestClaimed` with full context

### Phase 4 - Advanced Features
10. Add new `ExpiryReached` event
11. Add new `OracleRateUpdated` event
12. Add cumulative/lifetime metrics

---

## Gas Considerations

Each additional field adds ~100-200 gas per event emission. For a typical enriched event adding 8 fields:
- Additional cost: ~800-1600 gas per event
- Relative to transaction cost: <1% overhead
- Trade-off: Eliminates 5-10 RPC calls per indexed event

**Recommendation**: The gas overhead is negligible compared to the indexing benefits. Users save more in avoided RPC costs than they spend in extra event gas.
