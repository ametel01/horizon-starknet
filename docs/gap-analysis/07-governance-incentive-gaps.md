# 7. Governance & Incentive Gaps

## 7.1 Overall Status: 0% Implemented

**No governance or incentive infrastructure exists in Horizon v1.**

| Feature | Pendle V2 | Horizon | Status |
|---------|-----------|---------|--------|
| vePENDLE token | Vote-locked governance | ❌ None | 🔴 Future |
| Gauge contracts | Embedded in markets | ❌ None | 🔴 Future |
| VotingController | Epoch-based voting | ❌ None | 🔴 Future |
| GaugeController | Emission streaming | ❌ None | 🔴 Future |
| LP boost formula | `min(LP, 0.4*LP + 0.6*(totalLP*userVe/totalVe))` | ❌ None | 🔴 Future |
| Fee distribution | 80% voters / 20% LPs | ❌ 100% treasury (reserve fee) + LP fees auto-compound | 🔴 Future |
| Multi-reward tokens | Per gauge | ✅ RewardManagerComponent (SYWithRewards + Market LP) | ✅ Partial |

## 7.2 Current Admin Structure

Horizon uses centralized admin control:

| Control | Mechanism | Risk Level |
|---------|-----------|------------|
| Fee collection | Owner-only `collect_fees()` (analytics only; LP fees auto-compound in pool) | Centralized |
| Parameter changes | Owner-only `set_scalar_root()` | Centralized |
| Emergency pause | PAUSER_ROLE on SY, Router, Market, PragmaIndexOracle | Acceptable |
| Contract upgrades | Owner-only (SY, Router, Factory, MarketFactory, PragmaIndexOracle) | Centralized |
| Oracle config | OPERATOR_ROLE `set_config()` on PragmaIndexOracle | Centralized |

**Roles Defined (contracts/src/libraries/roles.cairo):**
- `DEFAULT_ADMIN_ROLE`: Full administrative control (value: 0)
- `PAUSER_ROLE`: Emergency pause/unpause
- `OPERATOR_ROLE`: Operational parameter updates (oracle config)

**Upgradeability Model (from HORIZON-SPEC-COMPRESSED.md):**
- **Upgradeable (owner-controlled):** SY, SYWithRewards, Router, Factory, MarketFactory, PragmaIndexOracle
- **Non-upgradeable:** PT, YT, Market (per-deployment trust anchor)

## 7.3 Intentional Design Decision

From HORIZON-SPEC-COMPRESSED.md:
> **design_philosophy: correctness_over_features: "v1 minimal; expand later"**

Governance is explicitly **Phase 4** on the roadmap:
- Phase 1: Core tokenization (current)
- Phase 2: Advanced trading features
- Phase 3: Limit orders, fee distribution
- Phase 4: veToken system, gauge voting

---
