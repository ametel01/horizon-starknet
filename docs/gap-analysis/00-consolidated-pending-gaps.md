# Consolidated Gap Analysis - Pending Items Only

> **Generated:** 2026-01-17
> **Source:** All documents in `/docs/gap-analysis/`
> **Purpose:** Single view of what's still missing in Horizon vs Pendle V2

---

## Priority 0 - Critical (Blocks Integrations)

| Gap | Category | Impact | Notes |
|-----|----------|--------|-------|
| **Multi-Reward YT** | Core Tokens | HIGH | Cannot support GLP-style tokens with rewards (ETH, esGMX), Pendle pools with emissions, or assets with native staking rewards beyond yield. Missing: `redeemDueInterestAndRewards()`, `getRewardTokens()` in YT |

---

## Priority 1 - High (User Experience)

| Gap | Category | Impact | Notes |
|-----|----------|--------|-------|
| **Factory rewardFeeRate** | Factory | HIGH | No protocol fee capture on external reward distributions |
| **Factory setRewardFeeRate()** | Factory | HIGH | No admin function to configure reward fees |
| **Factory interestFeeRate** | Factory | MEDIUM | Per-YT exists but no centralized factory-level fee schedule |
| **Factory setInterestFeeRate()** | Factory | MEDIUM | Missing at factory level (exists per-YT) |

---

## Priority 2 - Medium (Feature Completeness)

### Router Gaps

| Gap | Notes |
|-----|-------|
| `addLiquidityDualTokenAndPt` | Mixed deposits (token via aggregator + PT simultaneously) |
| `removeLiquidityDualTokenAndPt` | Mixed withdrawals |
| `swapTokensToTokens` | General aggregator routing not involving PT/YT |
| `LimitOrderData` integration | On-chain limit orders, maker order matching |
| `boostMarkets` | Gauge boost in batch (N/A without governance) |
| Permit signatures | EIP-2612 gasless approvals (N/A for Starknet) |

### Factory Gaps

| Gap | Notes |
|-----|-------|
| `expiryDivisor` | Without divisor, markets may be created with arbitrary expiries, fragmenting liquidity |
| `setExpiryDivisor()` | Admin function to configure standardized expiry intervals |

### MarketFactory Gaps

| Gap | Notes |
|-----|-------|
| `yieldContractFactory` reference | Cross-factory queries |

### YT Gaps

| Gap | Notes |
|-----|-------|
| YT flash mint | Flash mint pattern for atomic operations |

### Market Gaps

| Gap | Notes |
|-----|-------|
| Storage packing | Using u256 per field vs Pendle's int128/uint96/uint16 (gas optimization) |
| Token transfer pattern | Uses `transfer_from` pulls vs Pendle's pre-transfer + balance checks |

### Oracle Gaps (Optional)

| Gap | Notes |
|-----|-------|
| Chainlink/Pragma wrapper | `latestRoundData()` compatibility for DeFi integrations expecting Chainlink interface |
| Oracle Factory | Factory for deploying oracle instances |

---

## Priority 3 - Low

| Gap | Category | Notes |
|-----|----------|-------|
| PT VERSION constant | Core Tokens | Contract versioning |
| PT reentrancy guard exposure | Core Tokens | `reentrancyGuardEntered()` exposure |
| YT UserInterest struct packing | Core Tokens | Two Maps vs packed struct |
| Factory VERSION constant | Factory | Contract versioning |
| MarketFactory VERSION constant | MarketFactory | Contract versioning |
| `readState(router)` external view | Market | Not exposed (internal only) |
| Cross-chain operations | Router | LayerZero/bridge support (Starknet-only focus) |

---

## Priority 4 - Future (Phase 4 - Governance)

| Gap | Notes |
|-----|-------|
| **veToken system** | Vote-locked governance token |
| **Gauge contracts** | Embedded in markets for LP incentives |
| **VotingController** | Epoch-based voting |
| **GaugeController** | Emission streaming |
| **LP boost formula** | `min(LP, 0.4*LP + 0.6*(totalLP*userVe/totalVe))` |
| **Fee distribution** | 80% voters / 20% LPs (currently 100% treasury + LP auto-compound) |
| **vePendle integration** | MarketFactory governance integration |
| **gaugeController integration** | MarketFactory emission distribution |

---

## Summary

| Priority | Count | Impact |
|----------|-------|--------|
| **Critical (P0)** | 1 | Multi-reward YT blocks reward token integrations |
| **High (P1)** | 4 | Factory reward/interest fee infrastructure |
| **Medium (P2)** | 14 | Router features, factory expiry, storage optimization |
| **Low (P3)** | 7 | Versioning, minor compatibility |
| **Future (P4)** | 8 | Governance system (intentionally deferred) |

**Total Remaining Gaps: 34** (excluding N/A items like Starknet-specific differences)

---

## Quick Reference by Component

### What's Blocking Integrations
- Multi-reward YT (P0)

### What Affects Protocol Revenue
- Factory rewardFeeRate (P1)
- Factory interestFeeRate at factory level (P1)

### What Affects User Experience
- Router: Dual token+PT liquidity operations (P2)
- Router: Limit orders (P2)
- Factory: Expiry divisor for standardized dates (P2)

### What's Intentionally Deferred
- All governance (P4) - Phase 4 on roadmap

### What's N/A for Starknet
- EIP-2612 Permit signatures
- Native ETH support
- Cross-chain (LayerZero)
