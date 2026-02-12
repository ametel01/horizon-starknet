# Consolidated Gap Analysis - Pending Items Only

> **Generated:** 2026-01-17
> **Last Verified:** 2026-02-13
> **Source:** All documents in `/docs/gap-analysis/`
> **Purpose:** Single view of what's still missing in Horizon vs Pendle V2

---

## Recently Completed (since 2026-01-17)

The following items were previously listed as gaps and have been **fully implemented**:

| ID | Item | Implementation |
|----|------|----------------|
| P0-1 | Multi-Reward YT | `yt.cairo` integrates `RewardManagerComponent` (line 43), `claim_rewards()` (line 1291), `get_reward_tokens()` (line 1384), `redeem_due_interest_and_rewards()` (line 1305). ERC20 transfer hooks update rewards (lines 67-92). Interface at `i_yt.cairo:93-111`. |
| P1-1/P1-2 | Factory rewardFeeRate | `factory.cairo:86` storage, `set_reward_fee_rate()` (line 533), `get_reward_fee_rate()` (line 527). Max 20% (0.2e18). |
| P1-3/P1-4 | Factory interestFeeRate | `factory.cairo:88` storage, `set_default_interest_fee_rate()` (line 550), `get_default_interest_fee_rate()` (line 544). Max 50% (0.5e18). |
| P2-R1 | addLiquidityDualTokenAndPt | `router.cairo` — `add_liquidity_dual_token_and_pt()` (line ~2316) |
| P2-R2 | removeLiquidityDualTokenAndPt | `router.cairo` — `remove_liquidity_dual_token_and_pt()` (line ~2417) |
| P2-R3 | swapTokensToTokens | `router.cairo` — `swap_tokens_to_tokens()` (line ~1982) |
| P2-F1/P2-F2 | expiryDivisor | `factory.cairo:90` storage, `set_expiry_divisor()` (line 569), validation in `create_yield_contracts()` (lines 231-235). |
| P2-MF1 | yieldContractFactory Reference | `market_factory.cairo:112` storage, PT validation in `create_market()` (lines 244-249). |
| P2-YT1 | YT Flash Mint | `yt.cairo` — `flash_mint_py()` (line 1476). `IFlashCallback` interface at `interfaces/i_flash_callback.cairo`. Error constants at `errors.cairo:38-39`. |
| P3 | PT VERSION constant | `pt.cairo:30` — `const VERSION: felt252 = 1;` |
| P3 | Factory VERSION constant | `factory.cairo:32` — `const VERSION: felt252 = 1;` |
| P3 | MarketFactory VERSION constant | `market_factory.cairo:52` — `const VERSION: felt252 = 1;` |
| P3 | `readState(router)` external view | `amm.cairo:1131` — `get_market_state() -> IMarketState` exposed in `IMarket` trait (`i_market.cairo:115`). |

**Additional feature not in original gap analysis:** Factory now supports `deploy_sy_with_rewards()` (line 419) for deploying `SYWithRewards` contracts with integrated reward tracking, using `sy_with_rewards_class_hash` (line 80).

---

## Priority 2 - Medium (Feature Completeness)

### Router Gaps

#### P2-R4: LimitOrderData Integration

| Attribute | Details |
|-----------|---------|
| **Description** | On-chain limit orders, maker order matching during swaps |
| **Impact** | Cannot implement advanced trading strategies |

**Pendle V2 Reference:**
- [`ActionSwapPTV3.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/router/ActionSwapPTV3.sol) - Limit order params in swaps
- [`IPLimitRouter.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/interfaces/IPLimitRouter.sol)

**Horizon Implementation:**
| File | Changes Required |
|------|------------------|
| `contracts/src/interfaces/i_router.cairo` | Add `LimitOrderData` struct |
| `contracts/src/router.cairo` | Add limit order matching logic to swap functions |
| New file: `contracts/src/limit_router.cairo` | Separate limit order infrastructure |

```cairo
struct LimitOrderData {
    limit_router: ContractAddress,
    eps_skip_market: u256,  // Skip market if limit price better
    normal_fills: Span<FillOrderParams>,
    flash_fills: Span<FillOrderParams>,
}

struct FillOrderParams {
    order: LimitOrder,
    signature: Span<felt252>,
    make_fill_amount: u256,
}
```

**Note:** This is a significant feature requiring separate limit order book infrastructure.

---

#### P2-R5: boostMarkets

| Attribute | Details |
|-----------|---------|
| **Description** | Gauge boost in batch |
| **Impact** | N/A without governance system (Phase 4 dependency) |

**Blocked by:** Governance system (P4)

---

#### P2-R6: Permit Signatures

| Attribute | Details |
|-----------|---------|
| **Description** | EIP-2612 gasless approvals |
| **Impact** | N/A for Starknet (different signature model) |

**Note:** Starknet uses account abstraction with native multicall. Users can batch approve + swap in single transaction via wallet. The Router already has `multicall()`. This is **not a gap** — it's a platform difference. Retained for documentation completeness.

---

### Market Gaps

#### P2-M1: Storage Packing

| Attribute | Details |
|-----------|---------|
| **Description** | Using u256 per field vs Pendle's int128/uint96/uint16 |
| **Impact** | Gas optimization - reduces storage reads/writes |

**Pendle V2 Reference:**
- [`PendleMarketV6.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/Market/PendleMarketV6.sol) - Packed MarketState

**Horizon Implementation:**
| File | Changes Required |
|------|------------------|
| `contracts/src/market/amm.cairo` | Analyze and pack related storage fields |

**Note:** Cairo storage model differs from EVM. Packing benefits depend on Starknet's storage pricing model. Consider packing after profiling actual gas costs.

---

#### P2-M2: Token Transfer Pattern

| Attribute | Details |
|-----------|---------|
| **Description** | Market uses `transfer_from` pulls vs Pendle's pre-transfer + balance checks |
| **Impact** | Different MEV characteristics, gas costs |

**Note:** YT contract already uses the "floating token" pattern (pre-transfer + balance delta) — see `mint_py`, `redeem_py` functions which consume "floating" SY/PT/YT. Market uses pull pattern for simpler UX via Router. This is an **intentional design choice**, not a gap.

**Decision:** Current pattern is acceptable. Documented difference only.

---

### Oracle Gaps (Optional)

#### P2-O1: Pragma-Compatible PT/YT/LP Price Wrapper

| Attribute | Details |
|-----------|---------|
| **Description** | Pragma-compatible interface wrapping `PyLpOracle` TWAP for DeFi integrations |
| **Impact** | Optional - enables integration with protocols expecting Pragma feed format |

**Current State:** Horizon has `PragmaIndexOracle` at `contracts/src/oracles/pragma_index_oracle.cairo` for exchange rate feeds, and `PyLpOracle` at `contracts/src/oracles/py_lp_oracle.cairo` for PT/YT/LP TWAP pricing.

**Pendle V2 Reference:**
- [`PendleChainlinkOracle.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracle.sol)

**Horizon Implementation:**
| File | Changes Required |
|------|------------------|
| New file: `contracts/src/oracles/pragma_pt_oracle.cairo` | Pragma-compatible wrapper for PT prices |

```cairo
#[starknet::interface]
trait IPragmaCompatibleOracle<TContractState> {
    fn get_data_median(self: @TContractState, data_type: DataType) -> PragmaPricesResponse;
}

#[starknet::contract]
mod PragmaPtOracle {
    // Wraps PyLpOracle TWAP in Pragma-compatible format
    fn get_data_median(...) {
        let pt_rate = py_lp_oracle.get_pt_to_sy_rate(market, duration);
        // Format as PragmaPricesResponse
    }
}
```

---

#### P2-O2: Oracle Factory

| Attribute | Details |
|-----------|---------|
| **Description** | Factory for deploying oracle instances per market |
| **Impact** | Optional - convenience for deploying many oracle wrappers |

**Pendle V2 Reference:**
- [`PendleChainlinkOracleFactory.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/oracles/PtYtLpOracle/chainlink/PendleChainlinkOracleFactory.sol)

**Horizon Implementation:**
| File | Changes Required |
|------|------------------|
| New file: `contracts/src/oracles/oracle_factory.cairo` | Deploy oracle instances |

---

## Priority 3 - Low

| Gap | Category | File | Notes |
|-----|----------|------|-------|
| ~~YT UserInterest struct packing~~ | Core Tokens | `contracts/src/tokens/yt.cairo` | ~~Combine `user_py_index` + `user_interest` Maps into single packed struct Map~~ **DONE** — `UserInterestState` struct with `StorePacking<UserInterestState, u256>` halves storage I/O on the hot path |
| Cross-chain operations | Router | N/A | LayerZero/bridge support (Starknet-only focus, not planned) |

---

## Priority 4 - Future (Phase 4 - Governance)

All governance features are intentionally deferred to Phase 4.

| Gap | Description | Pendle Reference |
|-----|-------------|------------------|
| **veToken system** | Vote-locked governance token | [`VotingEscrowPendle.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/LiquidityMining/VotingEscrow/VotingEscrowPendle.sol) |
| **Gauge contracts** | Embedded in markets for LP incentives | [`PendleGauge.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/LiquidityMining/PendleGauge.sol) |
| **VotingController** | Epoch-based voting for emission allocation | [`VotingController.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/LiquidityMining/VotingController/VotingController.sol) |
| **GaugeController** | Emission streaming to gauges | [`GaugeController.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/LiquidityMining/GaugeController.sol) |
| **LP boost formula** | `min(LP, 0.4*LP + 0.6*(totalLP*userVe/totalVe))` | Gauge contracts |
| **Fee distribution** | 80% voters / 20% LPs split | Voting controller |
| **vePendle integration** | MarketFactory governance integration | MarketFactory |
| **gaugeController integration** | MarketFactory emission distribution | MarketFactory |

**Horizon Implementation (Phase 4):**
```
contracts/src/governance/
├── ve_token.cairo           # Vote-locked token
├── voting_controller.cairo  # Epoch voting
├── gauge_controller.cairo   # Emission distribution
└── gauge.cairo              # Market gauge
```

---

## Summary

| Priority | Count | Key Items |
|----------|-------|-----------|
| **Completed** | 18 | All P0, P1, most P2 items, and YT struct packing (see table above) |
| **Medium (P2)** | 7 | Limit orders, storage packing, oracle wrappers |
| **Low (P3)** | 1 | Cross-chain |
| **Future (P4)** | 8 | Governance system |
| **Not a gap** | 2 | Permit signatures (N/A), token transfer pattern (intentional) |

**Total Remaining Gaps: 16** (down from 33, of which 2 are N/A and 8 are deferred to Phase 4)

**Actionable Remaining Gaps: 6** (P2 + P3, excluding N/A items and Phase 4)

---

## Implementation Order Recommendation

1. **P2-M1: Storage Packing** - Gas optimization (profile first)
2. **P2-O1: Pragma PT Oracle Wrapper** - Enables DeFi integrations
3. **P2-O2: Oracle Factory** - Convenience for deploying oracle wrappers
4. **P2-R4: Limit orders** - Advanced trading (larger scope)
5. **P4: Governance** - Phase 4 milestone
