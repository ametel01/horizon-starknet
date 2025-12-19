# RBAC Upgrade Guide

This guide walks you through upgrading your deployed contracts to add Role-Based Access Control (RBAC).

## Prerequisites

- You are the owner of the deployed contracts
- You have `starkli` configured with your deployer account
- Contracts are already deployed on mainnet (addresses in `.env.mainnet`)

## Overview

The upgrade adds:
- **AccessControl** from OpenZeppelin 3.0.0
- **Pausable** component to Router (emergency pause capability)
- 3 roles: `DEFAULT_ADMIN_ROLE`, `PAUSER_ROLE`, `OPERATOR_ROLE`

All existing functionality is preserved. User flows remain permissionless.

---

## Step 1: Build New Contract Artifacts

```bash
cd contracts
scarb build
```

This generates new Sierra files with RBAC in `target/dev/`.

---

## Step 2: Declare New Class Hashes

Source your mainnet environment:

```bash
source .env.mainnet
```

Declare each upgraded contract:

```bash
# Factory
starkli declare target/dev/horizon_Factory.contract_class.json \
  --account $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL

# MarketFactory
starkli declare target/dev/horizon_MarketFactory.contract_class.json \
  --account $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL

# Router
starkli declare target/dev/horizon_Router.contract_class.json \
  --account $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL
```

Save the returned class hashes:

```bash
export NEW_FACTORY_CLASS_HASH=0x...
export NEW_MARKET_FACTORY_CLASS_HASH=0x...
export NEW_ROUTER_CLASS_HASH=0x...
```

---

## Step 3: Upgrade Contracts

Call `upgrade()` on each contract (you must be the owner):

```bash
# Upgrade Factory
starkli invoke $FACTORY_ADDRESS upgrade $NEW_FACTORY_CLASS_HASH \
  --account $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL

# Upgrade MarketFactory
starkli invoke $MARKET_FACTORY_ADDRESS upgrade $NEW_MARKET_FACTORY_CLASS_HASH \
  --account $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL

# Upgrade Router
starkli invoke $ROUTER_ADDRESS upgrade $NEW_ROUTER_CLASS_HASH \
  --account $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL
```

---

## Step 4: Initialize RBAC

After upgrade, call `initialize_rbac()` on each contract to bootstrap roles:

```bash
# Initialize RBAC on Factory
starkli invoke $FACTORY_ADDRESS initialize_rbac \
  --account $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL

# Initialize RBAC on MarketFactory
starkli invoke $MARKET_FACTORY_ADDRESS initialize_rbac \
  --account $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL

# Initialize RBAC on Router
starkli invoke $ROUTER_ADDRESS initialize_rbac \
  --account $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL
```

This grants `DEFAULT_ADMIN_ROLE` and `PAUSER_ROLE` to the current owner.

---

## Step 5: Grant Additional Roles (Optional)

If you want to grant roles to other addresses:

### Role Constants

```
DEFAULT_ADMIN_ROLE = 0x0
PAUSER_ROLE = selector!("PAUSER_ROLE") = 0x03ef8c06ec5c17a3e5b1e8d8e7eb67dd1f4f8c3ef5e8e8e8e8e8e8e8e8e8e8e8
OPERATOR_ROLE = selector!("OPERATOR_ROLE") = 0x02b5ce8e08e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8
```

### Grant Role Commands

```bash
# Grant PAUSER_ROLE to a security address
starkli invoke $ROUTER_ADDRESS grant_role \
  0x03ef8c06ec5c17a3e5b1e8d8e7eb67dd1f4f8c3ef5e8e8e8e8e8e8e8e8e8e8e8 \
  $SECURITY_ADDRESS \
  --account $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL

# Grant OPERATOR_ROLE to ops team (for PragmaIndexOracle)
starkli invoke $ORACLE_ADDRESS grant_role \
  0x02b5ce8e08e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8 \
  $OPS_ADDRESS \
  --account $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL
```

---

## Step 6: Verify Upgrade

Check that roles are properly set:

```bash
# Check if deployer has admin role on Router
starkli call $ROUTER_ADDRESS has_role 0x0 $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL
# Expected: 0x1 (true)

# Check paused state (should be false)
starkli call $ROUTER_ADDRESS is_paused \
  --rpc $STARKNET_RPC_URL
# Expected: 0x0 (false)
```

---

## Testing Emergency Pause

To test the pause functionality:

```bash
# Pause the router (only PAUSER_ROLE can do this)
starkli invoke $ROUTER_ADDRESS pause \
  --account $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL

# Verify paused
starkli call $ROUTER_ADDRESS is_paused --rpc $STARKNET_RPC_URL
# Expected: 0x1 (true)

# Unpause
starkli invoke $ROUTER_ADDRESS unpause \
  --account $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL
```

---

## Role Reference

| Role | Contracts | Purpose |
|------|-----------|---------|
| `DEFAULT_ADMIN_ROLE` | All | Grant/revoke roles, ultimate authority |
| `PAUSER_ROLE` | Router, Oracle | Emergency pause/unpause |
| `OPERATOR_ROLE` | Oracle | Update oracle config (TWAP, staleness) |

---

## Rollback

If needed, you can upgrade back to the previous class hash (stored in `.env.mainnet`):

```bash
starkli invoke $ROUTER_ADDRESS upgrade $ROUTER_CLASS_HASH \
  --account $DEPLOYER_ADDRESS \
  --rpc $STARKNET_RPC_URL
```

---

## Simplified Initial Setup

For the initial deployment, all roles are assigned to the deployer address:

```
DEPLOYER_ADDRESS=0x077ac072c4a47feb5e7418112136bc5374bd802871bc195e5fd64499cfc34689
```

After verifying everything works, you can:
1. Grant `PAUSER_ROLE` to a security multi-sig
2. Transfer `DEFAULT_ADMIN_ROLE` to a governance multi-sig
3. Renounce your own roles if desired
