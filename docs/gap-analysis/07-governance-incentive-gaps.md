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
| Fee distribution | 80% voters / 20% LPs | ❌ Owner-only | 🔴 Future |
| Multi-reward tokens | Per gauge | ❌ None | 🔴 Future |

## 7.2 Current Admin Structure

Horizon uses centralized admin control:

| Control | Mechanism | Risk Level |
|---------|-----------|------------|
| Fee collection | Owner-only `collect_fees()` | Centralized |
| Parameter changes | Owner-only `set_scalar_root()` | Centralized |
| Emergency pause | PAUSER_ROLE | Acceptable |
| Contract upgrades | Owner-only | Centralized |

**Roles Defined:**
- `DEFAULT_ADMIN_ROLE`: Full administrative control
- `PAUSER_ROLE`: Emergency pause only
- `OPERATOR_ROLE`: Defined but unused

## 7.3 Intentional Design Decision

From SPEC.md:
> **"Simplicity is intentional."** v1 is deliberately minimal and expandable.

Governance is explicitly **Phase 4** on the roadmap:
- Phase 1: Core tokenization (current)
- Phase 2: Advanced trading features
- Phase 3: Limit orders, fee distribution
- Phase 4: veToken system, gauge voting

---
