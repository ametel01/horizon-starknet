# RBAC Upgrade Guide

This guide walks you through upgrading your deployed contracts to add Role-Based Access Control (RBAC).

## Prerequisites

- You are the owner of the deployed contracts
- You have `sncast` (Starknet Foundry) installed
- Contracts are already deployed on mainnet (addresses in `.env.mainnet`)

## Overview

The upgrade adds:
- **AccessControl** from OpenZeppelin 3.0.0
- **Pausable** component to Router (emergency pause capability)
- 3 roles: `DEFAULT_ADMIN_ROLE`, `PAUSER_ROLE`, `OPERATOR_ROLE`

All existing functionality is preserved. User flows remain permissionless.

---

## Step 1: Setup Environment

```bash
cd /path/to/horizon-starknet

# Source your mainnet environment
source .env.mainnet

# Verify variables are set
echo "RPC: $STARKNET_RPC_URL"
echo "Deployer: $DEPLOYER_ADDRESS"
```

---

## Step 2: Setup Account File

Create the sncast accounts file (if not already present):

```bash
ACCOUNTS_FILE="deploy/accounts/mainnet.json"
mkdir -p deploy/accounts

cat > "$ACCOUNTS_FILE" << EOF
{
  "alpha-mainnet": {
    "deployer": {
      "address": "$DEPLOYER_ADDRESS",
      "class_hash": "0x03957f9f5a1cbfe918cedc2015c85200ca51a5f7506ecb6de98a5207b759bf8a",
      "deployed": true,
      "legacy": false,
      "private_key": "$DEPLOYER_PRIVATE_KEY",
      "public_key": "0x0",
      "salt": "0x0",
      "type": "braavos"
    }
  },
  "alpha-sepolia": {}
}
EOF

echo "Account file created: $ACCOUNTS_FILE"
```

---

## Step 3: Build New Contract Artifacts

```bash
cd contracts
scarb build
```

This generates new Sierra files with RBAC in `target/dev/`.

---

## Step 4: Declare New Class Hashes

Declare each upgraded contract:

```bash
ACCOUNTS_FILE="../deploy/accounts/mainnet.json"

# Factory
sncast -a deployer -f "$ACCOUNTS_FILE" declare -u "$STARKNET_RPC_URL" \
  --package horizon -c Factory

# MarketFactory
sncast -a deployer -f "$ACCOUNTS_FILE" declare -u "$STARKNET_RPC_URL" \
  --package horizon -c MarketFactory

# Router
sncast -a deployer -f "$ACCOUNTS_FILE" declare -u "$STARKNET_RPC_URL" \
  --package horizon -c Router
```

Save the returned class hashes:

```bash
export NEW_FACTORY_CLASS_HASH=0x7d5345e2319f3915af98f8a3e3409cd5b065932a38bf9ae4fce808af4c25d8b
export NEW_MARKET_FACTORY_CLASS_HASH=0x750353fd99d07d5f7dfd2ee3eb0152493d27bbf786fcc4764884db18fe3c038
export NEW_ROUTER_CLASS_HASH=0x60314fa614cc0a13de2d283d4f5e79d21e6ab59b44f98ccc07b4b0f03ceea8a
```

---

## Step 5: Upgrade Contracts

Call `upgrade()` on each contract (you must be the owner):

```bash
ACCOUNTS_FILE="../deploy/accounts/mainnet.json"

# Upgrade Factory
sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" \
  -d "$FACTORY_ADDRESS" -f upgrade -c "$NEW_FACTORY_CLASS_HASH"

# Upgrade MarketFactory
sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" \
  -d "$MARKET_FACTORY_ADDRESS" -f upgrade -c "$NEW_MARKET_FACTORY_CLASS_HASH"

# Upgrade Router
sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" \
  -d "$ROUTER_ADDRESS" -f upgrade -c "$NEW_ROUTER_CLASS_HASH"
```

---

## Step 6: Initialize RBAC

After upgrade, call `initialize_rbac()` on each contract to bootstrap roles:

```bash
ACCOUNTS_FILE="../deploy/accounts/mainnet.json"

# Initialize RBAC on Factory
sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" \
  -d "$FACTORY_ADDRESS" -f initialize_rbac

# Initialize RBAC on MarketFactory
sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" \
  -d "$MARKET_FACTORY_ADDRESS" -f initialize_rbac

# Initialize RBAC on Router
sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" \
  -d "$ROUTER_ADDRESS" -f initialize_rbac
```

**Roles granted per contract:**
- Factory: `DEFAULT_ADMIN_ROLE`
- MarketFactory: `DEFAULT_ADMIN_ROLE`
- Router: `DEFAULT_ADMIN_ROLE` + `PAUSER_ROLE`

---

## Step 7: Verify Upgrade

Check that roles are properly set:

```bash
# Check if deployer has admin role on Router (role 0x0 = DEFAULT_ADMIN_ROLE)
sncast call -u "$STARKNET_RPC_URL" \
  -d "$ROUTER_ADDRESS" -f has_role -c 0x0 "$DEPLOYER_ADDRESS"
# Expected output contains: 0x1 (true)

# Check paused state (should be false)
sncast call -u "$STARKNET_RPC_URL" \
  -d "$ROUTER_ADDRESS" -f is_paused
# Expected output contains: 0x0 (false)
```

---

## Step 8: Grant Additional Roles (Optional)

If you want to grant roles to other addresses:

### Role Constants

```
DEFAULT_ADMIN_ROLE = 0x0
PAUSER_ROLE = selector!("PAUSER_ROLE")
OPERATOR_ROLE = selector!("OPERATOR_ROLE")
```

To get the actual selector values, you can compute them or use the values from contracts.

### Grant Role Commands

```bash
ACCOUNTS_FILE="../deploy/accounts/mainnet.json"

# Grant PAUSER_ROLE to a security address
# First, get PAUSER_ROLE selector (you can compute this from selector!("PAUSER_ROLE"))
PAUSER_ROLE="0x..." # Compute from Cairo selector

sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" \
  -d "$ROUTER_ADDRESS" -f grant_role -c "$PAUSER_ROLE" "$SECURITY_ADDRESS"

# Grant OPERATOR_ROLE to ops team (for PragmaIndexOracle)
OPERATOR_ROLE="0x..." # Compute from Cairo selector

sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" \
  -d "$ORACLE_ADDRESS" -f grant_role -c "$OPERATOR_ROLE" "$OPS_ADDRESS"
```

---

## Testing Emergency Pause

To test the pause functionality:

```bash
ACCOUNTS_FILE="../deploy/accounts/mainnet.json"

# Pause the router (only PAUSER_ROLE can do this)
sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" \
  -d "$ROUTER_ADDRESS" -f pause

# Verify paused
sncast call -u "$STARKNET_RPC_URL" -d "$ROUTER_ADDRESS" -f is_paused
# Expected output contains: 0x1 (true)

# Unpause
sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" \
  -d "$ROUTER_ADDRESS" -f unpause
```

---

## Role Reference

| Role | Contracts | Purpose |
|------|-----------|------------|
| `DEFAULT_ADMIN_ROLE` | All | Grant/revoke roles, ultimate authority |
| `PAUSER_ROLE` | Router, Oracle | Emergency pause/unpause |
| `OPERATOR_ROLE` | Oracle | Update oracle config (TWAP, staleness) |

---

## Rollback

If needed, you can upgrade back to the previous class hash (stored in `.env.mainnet`):

```bash
ACCOUNTS_FILE="../deploy/accounts/mainnet.json"

sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" \
  -d "$ROUTER_ADDRESS" -f upgrade -c "$ROUTER_CLASS_HASH"
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
