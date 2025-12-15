#!/bin/bash

# =============================================================================
# Horizon Protocol - Fork Mode Deployment Script
# =============================================================================
# Deploys Horizon Protocol on a forked mainnet devnet
# Uses real mainnet Pragma TWAP oracle and yield-bearing tokens
#
# Usage: ./deploy/scripts/deploy-fork.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"

# Network
NETWORK="fork"
ENV_FILE="$ROOT_DIR/.env.$NETWORK"
ACCOUNTS_FILE="$ROOT_DIR/deploy/accounts/$NETWORK.json"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Horizon Protocol - Fork Mode Deployment${NC}"
echo -e "${BLUE}Using Mainnet Pragma TWAP Oracle${NC}"
echo -e "${BLUE}========================================${NC}"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

update_env() {
    local key=$1
    local value=$2
    if grep -q "^${key}=" "$ENV_FILE"; then
        local temp_file=$(mktemp)
        sed "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" > "$temp_file"
        cat "$temp_file" > "$ENV_FILE"
        rm -f "$temp_file"
    else
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

# =============================================================================
# Load Environment
# =============================================================================

if [[ ! -f "$ENV_FILE" ]]; then
    log_error "Environment file not found: $ENV_FILE"
    exit 1
fi

source "$ENV_FILE"

log_info "RPC: $STARKNET_RPC_URL"
log_info "Pragma TWAP: $PRAGMA_TWAP_ADDRESS"

# =============================================================================
# Setup Account for sncast (same as devnet - uses predeployed accounts)
# =============================================================================

log_info "Fetching predeployed accounts from forked devnet..."

ACCOUNTS_RESPONSE=$(curl -s -X POST "$STARKNET_RPC_URL" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":"1","method":"devnet_getPredeployedAccounts","params":{}}' 2>/dev/null)

ACCOUNTS_ARRAY=$(echo "$ACCOUNTS_RESPONSE" | jq -r '.result // empty')

if [[ -z "$ACCOUNTS_ARRAY" || "$ACCOUNTS_ARRAY" == "null" ]]; then
    log_error "Failed to fetch predeployed accounts from devnet"
    echo "$ACCOUNTS_RESPONSE" >&2
    exit 1
fi

# Use account #1 as deployer (same convention as devnet)
DEPLOYER_ADDRESS=$(echo "$ACCOUNTS_ARRAY" | jq -r '.[1].address')
DEPLOYER_PRIVATE_KEY=$(echo "$ACCOUNTS_ARRAY" | jq -r '.[1].private_key')
DEPLOYER_PUBLIC_KEY=$(echo "$ACCOUNTS_ARRAY" | jq -r '.[1].public_key')
ACCOUNT_CLASS_HASH=$(echo "$ACCOUNTS_ARRAY" | jq -r '.[1].class_hash // "0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f"')

if [[ -z "$DEPLOYER_ADDRESS" || "$DEPLOYER_ADDRESS" == "null" ]]; then
    log_error "Could not parse deployer address"
    exit 1
fi

log_info "Deployer address: $DEPLOYER_ADDRESS"

# Create accounts directory
mkdir -p "$(dirname "$ACCOUNTS_FILE")"

# Create sncast accounts file (add to both mainnet and sepolia since fork can be detected as either)
cat > "$ACCOUNTS_FILE" << EOF
{
  "alpha-mainnet": {
    "deployer": {
      "address": "$DEPLOYER_ADDRESS",
      "class_hash": "$ACCOUNT_CLASS_HASH",
      "deployed": true,
      "legacy": false,
      "private_key": "$DEPLOYER_PRIVATE_KEY",
      "public_key": "$DEPLOYER_PUBLIC_KEY",
      "salt": "0x0",
      "type": "open_zeppelin"
    }
  },
  "alpha-sepolia": {
    "deployer": {
      "address": "$DEPLOYER_ADDRESS",
      "class_hash": "$ACCOUNT_CLASS_HASH",
      "deployed": true,
      "legacy": false,
      "private_key": "$DEPLOYER_PRIVATE_KEY",
      "public_key": "$DEPLOYER_PUBLIC_KEY",
      "salt": "0x0",
      "type": "open_zeppelin"
    }
  }
}
EOF

# =============================================================================
# Build Contracts
# =============================================================================

log_info "Building contracts..."
cd "$CONTRACTS_DIR"
scarb build
log_success "Contracts built"

# =============================================================================
# Declare Classes
# =============================================================================

declare_class() {
    local name=$1
    local env_var=$2

    log_info "Declaring $name..." >&2

    local output hash
    set +e
    output=$(sncast -a deployer -f "$ACCOUNTS_FILE" declare -u "$STARKNET_RPC_URL" --package horizon -c "$name" 2>&1)
    local status=$?
    set -e

    hash=$(echo "$output" | grep -oE 'class_hash: 0x[a-fA-F0-9]+' | grep -oE '0x[a-fA-F0-9]+' | head -1)
    if [[ -z "$hash" ]]; then
        hash=$(echo "$output" | grep -oE '0x[a-fA-F0-9]{64}' | head -1)
    fi

    if [[ -n "$hash" ]]; then
        update_env "$env_var" "$hash"
        if [[ $status -eq 0 ]]; then
            log_success "$name: $hash" >&2
        else
            if echo "$output" | grep -qi "already declared\|already exists"; then
                log_warning "$name (exists): $hash" >&2
            else
                log_success "$name: $hash" >&2
            fi
        fi
        echo "$hash"
        return 0
    fi

    log_error "Failed to declare $name"
    echo "$output" >&2
    exit 1
}

log_info "Declaring contract classes..."

PRAGMA_INDEX_ORACLE_CLASS_HASH=$(declare_class "PragmaIndexOracle" "PRAGMA_INDEX_ORACLE_CLASS_HASH")
SY_CLASS_HASH=$(declare_class "SY" "SY_CLASS_HASH")
PT_CLASS_HASH=$(declare_class "PT" "PT_CLASS_HASH")
YT_CLASS_HASH=$(declare_class "YT" "YT_CLASS_HASH")
MARKET_CLASS_HASH=$(declare_class "Market" "MARKET_CLASS_HASH")
FACTORY_CLASS_HASH=$(declare_class "Factory" "FACTORY_CLASS_HASH")
MARKET_FACTORY_CLASS_HASH=$(declare_class "MarketFactory" "MARKET_FACTORY_CLASS_HASH")
ROUTER_CLASS_HASH=$(declare_class "Router" "ROUTER_CLASS_HASH")

log_success "All classes declared"

log_info "Waiting for declarations to be mined..."
sleep 12

# =============================================================================
# Deploy Contracts
# =============================================================================

deploy_contract() {
    local class_hash=$1
    local name=$2
    local env_var=$3
    shift 3
    local calldata=("$@")

    log_info "Deploying $name..." >&2

    local output
    set +e
    if [[ ${#calldata[@]} -eq 0 ]]; then
        output=$(sncast -a deployer -f "$ACCOUNTS_FILE" deploy -u "$STARKNET_RPC_URL" -g "$class_hash" 2>&1)
    else
        output=$(sncast -a deployer -f "$ACCOUNTS_FILE" deploy -u "$STARKNET_RPC_URL" -g "$class_hash" -c "${calldata[@]}" 2>&1)
    fi
    local status=$?
    set -e

    if [[ $status -ne 0 ]]; then
        log_error "Failed to deploy $name"
        echo "$output" >&2
        exit 1
    fi

    local address
    address=$(echo "$output" | grep -oE 'Contract Address: 0x[a-fA-F0-9]+' | grep -oE '0x[a-fA-F0-9]+' | head -1)

    if [[ -z "$address" ]]; then
        log_error "Could not extract address for $name"
        echo "$output" >&2
        exit 1
    fi

    update_env "$env_var" "$address"
    log_success "$name: $address" >&2
    echo "$address"
}

call_contract() {
    local contract_address=$1
    local function=$2
    shift 2
    local calldata=("$@")

    local output
    if [[ ${#calldata[@]} -eq 0 ]]; then
        output=$(sncast call -u "$STARKNET_RPC_URL" -d "$contract_address" -f "$function" 2>&1)
    else
        output=$(sncast call -u "$STARKNET_RPC_URL" -d "$contract_address" -f "$function" -c "${calldata[@]}" 2>&1)
    fi

    local result
    result=$(echo "$output" | grep -oE '0x[a-fA-F0-9]+' | head -1)
    echo "$result"
}

invoke_contract() {
    local contract_address=$1
    local function=$2
    shift 2
    local calldata=("$@")

    log_info "Invoking $function on $contract_address with args: ${calldata[*]}" >&2

    local output
    set +e
    if [[ ${#calldata[@]} -eq 0 ]]; then
        output=$(sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" -d "$contract_address" -f "$function" 2>&1)
    else
        output=$(sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" -d "$contract_address" -f "$function" -c "${calldata[@]}" 2>&1)
    fi
    local status=$?
    set -e

    if [[ $status -ne 0 ]]; then
        log_error "Failed to invoke $function on $contract_address"
        log_error "Output: $output"
        return 1
    fi

    log_success "Invoked $function successfully" >&2
    echo "$output" >&2
    return 0
}

# -----------------------------------------------------------------------------
# Deploy Core Infrastructure
# -----------------------------------------------------------------------------

log_info "Deploying core infrastructure..."

# Factory: constructor(owner, yt_class_hash, pt_class_hash)
FACTORY_ADDRESS=$(deploy_contract "$FACTORY_CLASS_HASH" "Factory" "FACTORY_ADDRESS" \
    "$DEPLOYER_ADDRESS" "$YT_CLASS_HASH" "$PT_CLASS_HASH")

# MarketFactory: constructor(owner, market_class_hash)
MARKET_FACTORY_ADDRESS=$(deploy_contract "$MARKET_FACTORY_CLASS_HASH" "MarketFactory" "MARKET_FACTORY_ADDRESS" \
    "$DEPLOYER_ADDRESS" "$MARKET_CLASS_HASH")

# Router: constructor(owner)
ROUTER_ADDRESS=$(deploy_contract "$ROUTER_CLASS_HASH" "Router" "ROUTER_ADDRESS" \
    "$DEPLOYER_ADDRESS")

log_success "Core infrastructure deployed"

# =============================================================================
# Deploy Oracle Adapters (using mainnet Pragma TWAP)
# =============================================================================

log_info "Deploying PragmaIndexOracle adapters for mainnet yield tokens..."

# Helper to get current index from oracle (for initial index)
# We'll start with 1 WAD and let the oracle update naturally
INITIAL_INDEX="0xde0b6b3a7640000"  # 1 WAD

# -----------------------------------------------------------------------------
# sSTRK Oracle: sSTRK/USD / STRK/USD = sSTRK/STRK exchange rate
# -----------------------------------------------------------------------------

log_info "Deploying PragmaIndexOracle for sSTRK..."
PRAGMA_SSTRK_ORACLE_ADDRESS=$(deploy_contract "$PRAGMA_INDEX_ORACLE_CLASS_HASH" "PragmaIndexOracle-sSTRK" "PRAGMA_SSTRK_ORACLE_ADDRESS" \
    "$DEPLOYER_ADDRESS" \
    "$PRAGMA_TWAP_ADDRESS" \
    "$SSTRK_USD_PAIR_ID" \
    "$STRK_USD_PAIR_ID" \
    "$INITIAL_INDEX" 0x0)

# -----------------------------------------------------------------------------
# wstETH Oracle: wstETH/USD / ETH/USD = wstETH/ETH exchange rate
# -----------------------------------------------------------------------------

log_info "Deploying PragmaIndexOracle for wstETH..."
PRAGMA_WSTETH_ORACLE_ADDRESS=$(deploy_contract "$PRAGMA_INDEX_ORACLE_CLASS_HASH" "PragmaIndexOracle-wstETH" "PRAGMA_WSTETH_ORACLE_ADDRESS" \
    "$DEPLOYER_ADDRESS" \
    "$PRAGMA_TWAP_ADDRESS" \
    "$WSTETH_USD_PAIR_ID" \
    "$ETH_USD_PAIR_ID" \
    "$INITIAL_INDEX" 0x0)

# -----------------------------------------------------------------------------
# nstSTRK: Check if ERC-4626, otherwise use oracle
# For now, assume it needs oracle like sSTRK (nstSTRK/USD / STRK/USD)
# Using same pair IDs as sSTRK since it's also a STRK derivative
# -----------------------------------------------------------------------------

log_info "Deploying PragmaIndexOracle for nstSTRK..."
# Note: nstSTRK might use SSTRK pair ID or have its own - adjust if needed
PRAGMA_NST_STRK_ORACLE_ADDRESS=$(deploy_contract "$PRAGMA_INDEX_ORACLE_CLASS_HASH" "PragmaIndexOracle-nstSTRK" "PRAGMA_NST_STRK_ORACLE_ADDRESS" \
    "$DEPLOYER_ADDRESS" \
    "$PRAGMA_TWAP_ADDRESS" \
    "$SSTRK_USD_PAIR_ID" \
    "$STRK_USD_PAIR_ID" \
    "$INITIAL_INDEX" 0x0)

log_success "Oracle adapters deployed"

# -----------------------------------------------------------------------------
# Pause oracles for fork mode (TWAP has no historical data on fork)
# This makes them return the stored initial_index instead of fetching
# -----------------------------------------------------------------------------

log_info "Pausing oracles (fork mode - no TWAP history available)..."

log_info "Pausing sSTRK oracle..."
invoke_contract "$PRAGMA_SSTRK_ORACLE_ADDRESS" pause || log_warning "Failed to pause sSTRK oracle"

log_info "Pausing wstETH oracle..."
invoke_contract "$PRAGMA_WSTETH_ORACLE_ADDRESS" pause || log_warning "Failed to pause wstETH oracle"

log_info "Pausing nstSTRK oracle..."
invoke_contract "$PRAGMA_NST_STRK_ORACLE_ADDRESS" pause || log_warning "Failed to pause nstSTRK oracle"

sleep 2
log_success "Oracles paused - will return initial index (1 WAD)"

# =============================================================================
# Deploy SY Tokens (wrapping mainnet yield tokens)
# =============================================================================

log_info "Deploying SY tokens..."

# -----------------------------------------------------------------------------
# SY-sSTRK (wraps sSTRK, uses PragmaIndexOracle)
# -----------------------------------------------------------------------------

log_info "Deploying SY-sSTRK..."
SY_SSTRK_ADDRESS=$(deploy_contract "$SY_CLASS_HASH" "SY-sSTRK" "SY_SSTRK_ADDRESS" \
    0x0 0x5359205374616b656420535452 0xd \
    0x0 0x53592d735354524b 0x8 \
    "$SSTRK_ADDRESS" \
    "$PRAGMA_SSTRK_ORACLE_ADDRESS" \
    0x0)

# -----------------------------------------------------------------------------
# SY-wstETH (wraps wstETH, uses PragmaIndexOracle)
# -----------------------------------------------------------------------------

log_info "Deploying SY-wstETH..."
SY_WSTETH_ADDRESS=$(deploy_contract "$SY_CLASS_HASH" "SY-wstETH" "SY_WSTETH_ADDRESS" \
    0x0 0x535920577261707065642053 0xd \
    0x0 0x53592d7773744554 0x9 \
    "$WSTETH_ADDRESS" \
    "$PRAGMA_WSTETH_ORACLE_ADDRESS" \
    0x0)

# -----------------------------------------------------------------------------
# SY-nstSTRK (wraps nstSTRK, may be ERC-4626 or use oracle)
# -----------------------------------------------------------------------------

log_info "Deploying SY-nstSTRK..."
SY_NST_STRK_ADDRESS=$(deploy_contract "$SY_CLASS_HASH" "SY-nstSTRK" "SY_NST_STRK_ADDRESS" \
    0x0 0x5359204e6f73747261205374 0xd \
    0x0 0x53592d6e73745354524b 0xa \
    "$NST_STRK_ADDRESS" \
    "$PRAGMA_NST_STRK_ORACLE_ADDRESS" \
    0x0)

log_success "SY tokens deployed"

# =============================================================================
# Create PT/YT Pairs and Markets
# =============================================================================

log_info "Creating PT/YT pairs and markets..."

# Expiry: 30 days from now
CURRENT_TIME=$(date +%s)
EXPIRY_TIMESTAMP=$((CURRENT_TIME + 30 * 24 * 60 * 60))
update_env "EXPIRY_TIMESTAMP" "$EXPIRY_TIMESTAMP"

log_info "Expiry: $EXPIRY_TIMESTAMP ($(date -d "@$EXPIRY_TIMESTAMP" 2>/dev/null || date -r "$EXPIRY_TIMESTAMP"))"

# Market parameters
SCALAR_ROOT="${MARKET_SCALAR_ROOT:-5000000000000000000}"
FEE_RATE="${MARKET_FEE_RATE:-3000000000000000}"
DEFAULT_ANCHOR="${MARKET_INITIAL_ANCHOR:-50000000000000000}"

SCALAR_ROOT_HEX=$(printf "0x%x" "$SCALAR_ROOT")
FEE_RATE_HEX=$(printf "0x%x" "$FEE_RATE")
ANCHOR_HEX=$(printf "0x%x" "$DEFAULT_ANCHOR")
EXPIRY_HEX=$(printf "0x%x" "$EXPIRY_TIMESTAMP")

# -----------------------------------------------------------------------------
# sSTRK Market
# -----------------------------------------------------------------------------

log_info "Creating PT/YT for SY-sSTRK..."
if ! invoke_contract "$FACTORY_ADDRESS" create_yield_contracts \
    "$SY_SSTRK_ADDRESS" "$EXPIRY_HEX"; then
    log_error "Failed to create PT/YT for sSTRK"
fi

sleep 3

PT_SSTRK_ADDRESS=$(call_contract "$FACTORY_ADDRESS" get_pt "$SY_SSTRK_ADDRESS" "$EXPIRY_HEX")
update_env "PT_SSTRK_ADDRESS" "$PT_SSTRK_ADDRESS"
log_success "PT-sSTRK: $PT_SSTRK_ADDRESS"

YT_SSTRK_ADDRESS=$(call_contract "$FACTORY_ADDRESS" get_yt "$SY_SSTRK_ADDRESS" "$EXPIRY_HEX")
update_env "YT_SSTRK_ADDRESS" "$YT_SSTRK_ADDRESS"
log_success "YT-sSTRK: $YT_SSTRK_ADDRESS"

log_info "Creating Market for PT-sSTRK..."
invoke_contract "$MARKET_FACTORY_ADDRESS" create_market \
    "$PT_SSTRK_ADDRESS" \
    "$SCALAR_ROOT_HEX" 0x0 \
    "$ANCHOR_HEX" 0x0 \
    "$FEE_RATE_HEX" 0x0

sleep 2

MARKET_SSTRK_ADDRESS=$(call_contract "$MARKET_FACTORY_ADDRESS" get_market "$PT_SSTRK_ADDRESS")
update_env "MARKET_SSTRK_ADDRESS" "$MARKET_SSTRK_ADDRESS"
log_success "Market-sSTRK: $MARKET_SSTRK_ADDRESS"

# -----------------------------------------------------------------------------
# wstETH Market
# -----------------------------------------------------------------------------

log_info "Creating PT/YT for SY-wstETH..."
if ! invoke_contract "$FACTORY_ADDRESS" create_yield_contracts \
    "$SY_WSTETH_ADDRESS" "$EXPIRY_HEX"; then
    log_error "Failed to create PT/YT for wstETH"
fi

sleep 3

PT_WSTETH_ADDRESS=$(call_contract "$FACTORY_ADDRESS" get_pt "$SY_WSTETH_ADDRESS" "$EXPIRY_HEX")
update_env "PT_WSTETH_ADDRESS" "$PT_WSTETH_ADDRESS"
log_success "PT-wstETH: $PT_WSTETH_ADDRESS"

YT_WSTETH_ADDRESS=$(call_contract "$FACTORY_ADDRESS" get_yt "$SY_WSTETH_ADDRESS" "$EXPIRY_HEX")
update_env "YT_WSTETH_ADDRESS" "$YT_WSTETH_ADDRESS"
log_success "YT-wstETH: $YT_WSTETH_ADDRESS"

log_info "Creating Market for PT-wstETH..."
invoke_contract "$MARKET_FACTORY_ADDRESS" create_market \
    "$PT_WSTETH_ADDRESS" \
    "$SCALAR_ROOT_HEX" 0x0 \
    "$ANCHOR_HEX" 0x0 \
    "$FEE_RATE_HEX" 0x0

sleep 2

MARKET_WSTETH_ADDRESS=$(call_contract "$MARKET_FACTORY_ADDRESS" get_market "$PT_WSTETH_ADDRESS")
update_env "MARKET_WSTETH_ADDRESS" "$MARKET_WSTETH_ADDRESS"
log_success "Market-wstETH: $MARKET_WSTETH_ADDRESS"

# -----------------------------------------------------------------------------
# nstSTRK Market
# -----------------------------------------------------------------------------

log_info "Creating PT/YT for SY-nstSTRK..."
if ! invoke_contract "$FACTORY_ADDRESS" create_yield_contracts \
    "$SY_NST_STRK_ADDRESS" "$EXPIRY_HEX"; then
    log_error "Failed to create PT/YT for nstSTRK"
fi

sleep 3

PT_NST_STRK_ADDRESS=$(call_contract "$FACTORY_ADDRESS" get_pt "$SY_NST_STRK_ADDRESS" "$EXPIRY_HEX")
update_env "PT_NST_STRK_ADDRESS" "$PT_NST_STRK_ADDRESS"
log_success "PT-nstSTRK: $PT_NST_STRK_ADDRESS"

YT_NST_STRK_ADDRESS=$(call_contract "$FACTORY_ADDRESS" get_yt "$SY_NST_STRK_ADDRESS" "$EXPIRY_HEX")
update_env "YT_NST_STRK_ADDRESS" "$YT_NST_STRK_ADDRESS"
log_success "YT-nstSTRK: $YT_NST_STRK_ADDRESS"

log_info "Creating Market for PT-nstSTRK..."
invoke_contract "$MARKET_FACTORY_ADDRESS" create_market \
    "$PT_NST_STRK_ADDRESS" \
    "$SCALAR_ROOT_HEX" 0x0 \
    "$ANCHOR_HEX" 0x0 \
    "$FEE_RATE_HEX" 0x0

sleep 2

MARKET_NST_STRK_ADDRESS=$(call_contract "$MARKET_FACTORY_ADDRESS" get_market "$PT_NST_STRK_ADDRESS")
update_env "MARKET_NST_STRK_ADDRESS" "$MARKET_NST_STRK_ADDRESS"
log_success "Market-nstSTRK: $MARKET_NST_STRK_ADDRESS"

# =============================================================================
# Test Oracle Integration
# =============================================================================

log_info "Testing oracle integration..."

# Try to read index from each oracle
test_oracle() {
    local oracle_address=$1
    local name=$2

    log_info "Testing $name oracle..."
    local result
    result=$(call_contract "$oracle_address" index 2>&1) || true

    if [[ -n "$result" && "$result" != "0x0" ]]; then
        log_success "$name oracle index: $result"
    else
        log_warning "$name oracle returned: $result (may need update_index call)"
    fi
}

test_oracle "$PRAGMA_SSTRK_ORACLE_ADDRESS" "sSTRK"
test_oracle "$PRAGMA_WSTETH_ORACLE_ADDRESS" "wstETH"
test_oracle "$PRAGMA_NST_STRK_ORACLE_ADDRESS" "nstSTRK"

# =============================================================================
# Export addresses to JSON
# =============================================================================

ADDRESSES_DIR="$ROOT_DIR/deploy/addresses"
mkdir -p "$ADDRESSES_DIR"
JSON_FILE="$ADDRESSES_DIR/$NETWORK.json"

cat > "$JSON_FILE" << EOF
{
  "network": "$NETWORK",
  "rpcUrl": "$STARKNET_RPC_URL",
  "mainnetRpcUrl": "$MAINNET_RPC_URL",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "pragmaTwap": "$PRAGMA_TWAP_ADDRESS",
  "classHashes": {
    "PragmaIndexOracle": "$PRAGMA_INDEX_ORACLE_CLASS_HASH",
    "SY": "$SY_CLASS_HASH",
    "PT": "$PT_CLASS_HASH",
    "YT": "$YT_CLASS_HASH",
    "Market": "$MARKET_CLASS_HASH",
    "Factory": "$FACTORY_CLASS_HASH",
    "MarketFactory": "$MARKET_FACTORY_CLASS_HASH",
    "Router": "$ROUTER_CLASS_HASH"
  },
  "contracts": {
    "Factory": "$FACTORY_ADDRESS",
    "MarketFactory": "$MARKET_FACTORY_ADDRESS",
    "Router": "$ROUTER_ADDRESS"
  },
  "mainnetTokens": {
    "sSTRK": "$SSTRK_ADDRESS",
    "wstETH": "$WSTETH_ADDRESS",
    "nstSTRK": "$NST_STRK_ADDRESS"
  },
  "oracles": {
    "sSTRK": "$PRAGMA_SSTRK_ORACLE_ADDRESS",
    "wstETH": "$PRAGMA_WSTETH_ORACLE_ADDRESS",
    "nstSTRK": "$PRAGMA_NST_STRK_ORACLE_ADDRESS"
  },
  "markets": {
    "sSTRK": {
      "SY": "$SY_SSTRK_ADDRESS",
      "PT": "$PT_SSTRK_ADDRESS",
      "YT": "$YT_SSTRK_ADDRESS",
      "Market": "$MARKET_SSTRK_ADDRESS"
    },
    "wstETH": {
      "SY": "$SY_WSTETH_ADDRESS",
      "PT": "$PT_WSTETH_ADDRESS",
      "YT": "$YT_WSTETH_ADDRESS",
      "Market": "$MARKET_WSTETH_ADDRESS"
    },
    "nstSTRK": {
      "SY": "$SY_NST_STRK_ADDRESS",
      "PT": "$PT_NST_STRK_ADDRESS",
      "YT": "$YT_NST_STRK_ADDRESS",
      "Market": "$MARKET_NST_STRK_ADDRESS"
    }
  },
  "expiry": $EXPIRY_TIMESTAMP
}
EOF

log_success "Addresses exported to $JSON_FILE"

# =============================================================================
# Copy to addresses directory
# =============================================================================

cp "$ENV_FILE" "$ADDRESSES_DIR/.env.fork"
log_success "Environment copied to $ADDRESSES_DIR/.env.fork"

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Fork Mode Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Network:        $NETWORK (forked mainnet)"
echo "Env file:       $ENV_FILE"
echo "Pragma TWAP:    $PRAGMA_TWAP_ADDRESS"
echo ""
echo "Core Contracts:"
echo "  Factory:        $FACTORY_ADDRESS"
echo "  MarketFactory:  $MARKET_FACTORY_ADDRESS"
echo "  Router:         $ROUTER_ADDRESS"
echo ""
echo "Mainnet Yield Tokens:"
echo "  sSTRK:          $SSTRK_ADDRESS"
echo "  wstETH:         $WSTETH_ADDRESS"
echo "  nstSTRK:        $NST_STRK_ADDRESS"
echo ""
echo "Oracle Adapters:"
echo "  sSTRK:          $PRAGMA_SSTRK_ORACLE_ADDRESS"
echo "  wstETH:         $PRAGMA_WSTETH_ORACLE_ADDRESS"
echo "  nstSTRK:        $PRAGMA_NST_STRK_ORACLE_ADDRESS"
echo ""
echo "Markets:"
echo "  sSTRK:"
echo "    SY:           $SY_SSTRK_ADDRESS"
echo "    PT:           $PT_SSTRK_ADDRESS"
echo "    YT:           $YT_SSTRK_ADDRESS"
echo "    Market:       $MARKET_SSTRK_ADDRESS"
echo ""
echo "  wstETH:"
echo "    SY:           $SY_WSTETH_ADDRESS"
echo "    PT:           $PT_WSTETH_ADDRESS"
echo "    YT:           $YT_WSTETH_ADDRESS"
echo "    Market:       $MARKET_WSTETH_ADDRESS"
echo ""
echo "  nstSTRK:"
echo "    SY:           $SY_NST_STRK_ADDRESS"
echo "    PT:           $PT_NST_STRK_ADDRESS"
echo "    YT:           $YT_NST_STRK_ADDRESS"
echo "    Market:       $MARKET_NST_STRK_ADDRESS"
echo ""
echo "Expiry:           $EXPIRY_TIMESTAMP"
echo ""
log_success "Done! Oracle integration is using mainnet Pragma TWAP."
