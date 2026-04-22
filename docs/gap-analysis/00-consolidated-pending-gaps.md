# Consolidated Gap Analysis - Pending Items Only

> **Generated:** 2026-01-17
> **Last Verified:** 2026-02-13
> **Source:** All documents in `/docs/gap-analysis/`
> **Purpose:** Single view of what's still missing in Horizon vs Pendle V2

---

## Priority 2 — P2-R4: LimitOrderData Integration

| Attribute | Details |
|-----------|---------|
| **Description** | On-chain limit orders, maker order matching during swaps |
| **Impact** | Cannot implement advanced trading strategies |

**Pendle V2 Reference:**
- [`ActionSwapPTV3.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/router/ActionSwapPTV3.sol) — Limit order params in swaps
- [`IPLimitRouter.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/interfaces/IPLimitRouter.sol)

**Horizon Implementation:**
| File | Changes Required |
|------|------------------|
| `contracts/src/interfaces/i_router.cairo` | Add `LimitOrderData` struct |
| `contracts/src/router.cairo` | Add limit order matching logic to swap functions |
| New file: `contracts/src/limit_router.cairo` | Separate limit order infrastructure |

**Note:** Significant feature requiring separate limit order book infrastructure.

---

## Priority 2 — P2-R5: boostMarkets

| Attribute | Details |
|-----------|---------|
| **Description** | Gauge boost in batch |
| **Impact** | N/A without governance system |

**Blocked by:** Governance system (P4)

---

## Priority 3 — Cross-chain Operations

| Attribute | Details |
|-----------|---------|
| **Description** | LayerZero/bridge support |
| **Impact** | Low — Starknet-only focus, not planned |

---

## Priority 4 — Governance (Phase 4)

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
| **Pending (P2)** | 2 | Limit orders, boostMarkets (blocked by P4) |
| **Low (P3)** | 1 | Cross-chain (not planned) |
| **Future (P4)** | 8 | Governance system |

**Actionable Remaining Gaps: 1** (P2-R4 limit orders — P2-R5 is blocked, P3 is not planned, P4 is deferred)

---

## Implementation Order Recommendation

1. **P2-R4: Limit orders** — Advanced trading (larger scope, standalone feature)
2. **P4: Governance** — Phase 4 milestone
