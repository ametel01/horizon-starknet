# Horizon Protocol vs Pendle V2: Gap Analysis Documentation

> **Date:** 2025-12-31 (Updated)
> **Scope:** Deep code analysis of Horizon Protocol implementation against Pendle V2 specifications
> **Status:** Horizon Alpha on Starknet Mainnet

## Overview

This directory contains a comprehensive breakdown of the Horizon Protocol vs Pendle V2 gap analysis report. The original monolithic report has been split into focused, navigable sections for easier reference.

## Executive Summary

Horizon Protocol implements **~65% of Pendle V2's core functionality**, focusing on yield tokenization primitives while omitting advanced governance and composability features. The protocol is production-ready for its stated alpha scope. **The SY (Standardized Yield) wrapper is now at 95% parity** with Pendle's SYBase, including full reward distribution via SYWithRewards.

### Key Findings

| Category | Parity Level | Critical Gaps |
|----------|--------------|---------------|
| **Core Tokenization (SY/PT/YT)** | 90% | ✅ SY: 95% complete (multi-token, rewards, slippage, assetInfo all implemented); Remaining: multi-reward YT + YT flash mint (minor: packing) |
| **AMM/Market** | ~85% | ✅ 0 CRITICAL (PYIndex, reserve fees, TWAP all implemented); 8 remaining gaps: RewardManager/PendleGauge, flash callbacks |
| **Router** | 55% | Single-sided liquidity (7 functions), token aggregation (8 functions), batch operations |
| **Factory** | 70% | Protocol fee infrastructure (interestFeeRate, rewardFeeRate), expiryDivisor |
| **MarketFactory** | 95% | ✅ Treasury/fee infrastructure implemented; governance integration (vePendle, gaugeController) |
| **Oracle System** | 95% | ✅ Market TWAP + PT/YT/LP oracles implemented; Remaining: Chainlink/Pragma wrapper (optional) |
| **Governance/Rewards** | 0% | Complete absence |

## Documentation Structure

### Core Analysis Sections

1. **[Core Token System Gaps](./01-core-token-system-gaps.md)**
   - SY (Standardized Yield) Wrapper - 95% complete
   - YT (Yield Token) Interest System - 90% complete
   - PT (Principal Token) - 95% complete

2. **[AMM/Market System Gaps](./02-amm-market-system-gaps.md)**
   - Core AMM Curve (MarketMathCore) - 100% complete
   - TWAP Oracle - 95% implemented
   - Fee System - 85% complete
   - LP Token & Liquidity Operations
   - Market Contract (PendleMarketV6)

3. **[Router & Flash Swap Gaps](./03-router-flash-swap-gaps.md)**
   - Router Architecture
   - Core Router Functions - 85% complete
   - YT Flash Swap Pattern
   - Single-Sided Liquidity - Missing
   - Token Aggregation & Routing - Missing
   - ApproxParams, Limit Orders, Batch Operations

4. **[Factory System Gaps](./04-factory-system-gaps.md)**
   - YieldContractFactory Comparison - 70% complete
   - Protocol Fee Infrastructure gaps
   - Horizon Factory Advantages

5. **[MarketFactory System Gaps](./05-marketfactory-system-gaps.md)**
   - PendleMarketFactoryV6Upg Comparison - 95% complete
   - Protocol Fee Infrastructure - Fully implemented
   - Router Fee Overrides - Fully implemented
   - Horizon MarketFactory Advantages

6. **[Oracle System Gaps](./06-oracle-system-gaps.md)**
   - Oracle Architecture: Two Different Systems
   - Yield Index Oracle - 75% implemented
   - Market TWAP Oracle - 95% implemented
   - Using the Market TWAP Oracle
   - Oracle System Summary

7. **[Governance & Incentive Gaps](./07-governance-incentive-gaps.md)**
   - Overall Status: 0% Implemented
   - Current Admin Structure
   - Intentional Design Decision (Phase 4)

### Implementation Guidance

8. **[Implementation Priority Matrix](./08-implementation-priority-matrix.md)**
   - Priority 0 - Critical (Blocks Integrations)
   - Priority 1 - High (User Experience)
   - Priority 2 - Medium (Feature Completeness)
   - Priority 3 - Future (Ecosystem)

9. **[Detailed Feature Comparison](./09-detailed-feature-comparison.md)**
   - Complete Feature Matrix (200+ features)
   - Parity Summary by Category

10. **[Code Location Reference](./10-code-location-reference.md)**
    - Horizon Contract Files
    - Key Code Locations for Gap Implementation

## Change Log

- **2025-01-07:** ✅ **Section 2.3 Fee System corrected to 85%** - Code review revealed LP fee auto-compounding was already working at `amm.cairo:560`. `collect_fees()` is analytics-only; LP fees stay in `sy_reserve` automatically. Rate-impact fees deferred to Phase 2, governance split to Phase 4.

- **2025-12-31:** ✅ **Section 1.1 SY (Standardized Yield) Wrapper marked COMPLETE (95%)** - All major gaps implemented: slippage protection, burnFromInternalBalance, reentrancy guard, multi-token support (getTokensIn/Out, isValidToken), assetInfo, previewDeposit/Redeem, pausable transfers, negative yield watermark, SYWithRewards with RewardManagerComponent

## Quick Navigation

### By Priority

- **Critical Gaps (Blocking Integrations):**
  - [Single-Sided Liquidity](./03-router-flash-swap-gaps.md#34-single-sided-liquidity-major-gap) (Router)
  - [Token Aggregation](./03-router-flash-swap-gaps.md#35-token-aggregation--routing-major-gap) (Router)

- **High Priority (User Experience):**
  - [Multi-Reward YT](./01-core-token-system-gaps.md#12-yt-yield-token-interest-system)
  - [Factory Protocol Fees](./04-factory-system-gaps.md#41-yieldcontractfactory-comparison)
  - [RewardManager/PendleGauge](./02-amm-market-system-gaps.md#25-market-contract-pendlemarketv6)

- **Future (Phase 4):**
  - [Governance System](./07-governance-incentive-gaps.md)

### By Component

- **Tokens:** [Section 1](./01-core-token-system-gaps.md) - SY, PT, YT
- **Trading:** [Section 2](./02-amm-market-system-gaps.md), [Section 3](./03-router-flash-swap-gaps.md) - AMM, Market, Router
- **Deployment:** [Section 4](./04-factory-system-gaps.md), [Section 5](./05-marketfactory-system-gaps.md) - Factories
- **Oracles:** [Section 6](./06-oracle-system-gaps.md) - Yield Index, Market TWAP
- **Governance:** [Section 7](./07-governance-incentive-gaps.md) - veToken, Gauges

## Key Achievements

### ✅ Implemented Features

1. **Market TWAP Oracle System** - Full implementation in `oracle_lib.cairo` and `py_lp_oracle.cairo`
   - PT/YT/LP price oracles for collateral use in lending protocols
   - 8,760-slot observation buffer for 1-year TWAP history
   - Comprehensive test coverage (1,702 lines of tests)

2. **Protocol Fee Infrastructure** - Complete implementation in MarketFactory
   - Treasury address and reserve fee percent
   - Router-specific fee overrides for partner integrations
   - Dynamic fee configuration via `get_market_config()`

3. **SY Wrapper System** - 95% Pendle parity achieved
   - Multi-token support, reward distribution, slippage protection
   - SYWithRewards contract with RewardManagerComponent
   - Pausable transfers, negative yield watermark

4. **Core AMM** - 100% of MarketMathCore implemented
   - Logit-based curve with time decay
   - PYIndex integration for asset-based pricing
   - Reserve fee splitting and treasury wiring

## Repository Structure

```
docs/gap-analysis/
├── README.md (this file)
├── 01-core-token-system-gaps.md
├── 02-amm-market-system-gaps.md
├── 03-router-flash-swap-gaps.md
├── 04-factory-system-gaps.md
├── 05-marketfactory-system-gaps.md
├── 06-oracle-system-gaps.md
├── 07-governance-incentive-gaps.md
├── 08-implementation-priority-matrix.md
├── 09-detailed-feature-comparison.md
└── 10-code-location-reference.md
```

## References

### Pendle V2 Code References

All sections include references to the original Pendle V2 implementations:
- [pendle-core-v2-public](https://github.com/pendle-finance/pendle-core-v2-public) - Core market contracts
- [Pendle-SY-Public](https://github.com/pendle-finance/Pendle-SY-Public) - Standardized Yield contracts

### Horizon Implementation

Contract files are located in:
- `contracts/src/` - Core implementation
- `contracts/tests/` - Test suite (878 tests total)

See [Section 10: Code Location Reference](./10-code-location-reference.md) for detailed file mapping.

---

*Document generated from deep code analysis of Horizon Protocol codebase*
*Comparison baseline: Pendle V2 on Ethereum mainnet*
*Last updated: January 2025*
