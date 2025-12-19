# Simplified RBAC Implementation

## Status: IMPLEMENTED

All contracts have been updated with RBAC. Tests pass (276/276).

---

## Roles

| Role | Purpose | Who |
|------|---------|-----|
| `DEFAULT_ADMIN_ROLE` | Grant/revoke roles, upgrades, class hash updates | Multi-sig |
| `PAUSER_ROLE` | Emergency pause/unpause | Security EOA (fast response) |
| `OPERATOR_ROLE` | Oracle config updates | Ops team |

```cairo
// contracts/src/libraries/roles.cairo
pub const DEFAULT_ADMIN_ROLE: felt252 = 0;
pub const PAUSER_ROLE: felt252 = selector!("PAUSER_ROLE");
pub const OPERATOR_ROLE: felt252 = selector!("OPERATOR_ROLE");
```

---

## Changes Per Contract

### Factory & MarketFactory

- Added `AccessControlComponent` + `SRC5Component`
- Added `initialize_rbac()` for post-upgrade role setup
- `create_yield_contracts()` and `create_market()` stay **permissionless**

### Router

- Added `AccessControlComponent` + `SRC5Component` + `PausableComponent`
- Added `pause()` and `unpause()` functions (require PAUSER_ROLE)
- All user functions check `assert_not_paused()` before executing
- User functions stay **permissionless** but respect pause state

### PragmaIndexOracle

- Added `AccessControlComponent` + `SRC5Component`
- Role-based access control:

| Function | Role |
|----------|------|
| `upgrade()` | Owner (unchanged) |
| `set_config()` | OPERATOR_ROLE |
| `pause()` / `unpause()` | PAUSER_ROLE |
| `emergency_set_index()` | DEFAULT_ADMIN_ROLE |

---

## Storage Layout

New storage appended at end (preserves existing layout):

```cairo
// === NEW STORAGE - ADDED AT END ===
#[substorage(v0)]
src5: SRC5Component::Storage,
#[substorage(v0)]
access_control: AccessControlComponent::Storage,
```

---

## Upgrade Guide

See `docs/UPGRADE_RBAC.md` for detailed instructions.

Quick summary:
1. `scarb build`
2. Declare new class hashes
3. `upgrade(new_class_hash)` on each contract
4. `initialize_rbac()` to grant roles to owner
5. (Optional) `grant_role()` to other addresses

Initial role assignment to:
```
DEPLOYER_ADDRESS=0x077ac072c4a47feb5e7418112136bc5374bd802871bc195e5fd64499cfc34689
```

---

## User Flow Impact

**Zero impact.** All permissionless functions unchanged:
- `create_yield_contracts()`, `create_market()`
- All Router swaps, mints, redeems
- All Market operations
- All YT/PT operations

**Only change:** Router operations revert when paused.
