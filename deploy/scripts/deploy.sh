#!/bin/bash

# =============================================================================
# Yield Tokenization Protocol - Deployment Script
# =============================================================================
# Usage: ./deploy/scripts/deploy.sh [network]
#   network: katana (default) | sepolia | mainnet
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
BUILD_DIR="$CONTRACTS_DIR/target/dev"

# Network
NETWORK="${1:-katana}"
ENV_FILE="$ROOT_DIR/.env.$NETWORK"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Yield Tokenization Protocol Deployment${NC}"
echo -e "${BLUE}Network: $NETWORK${NC}"
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
        # Use temp file approach for Docker bind mount compatibility
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
log_info "Account: $DEPLOYER_ACCOUNT"

# Build starkli common args
STARKLI_COMMON="--rpc $STARKNET_RPC_URL --account $DEPLOYER_ACCOUNT"

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
    local file="$BUILD_DIR/yield_tokenization_${name}.contract_class.json"

    if [[ ! -f "$file" ]]; then
        log_error "File not found: $file"
        exit 1
    fi

    log_info "Declaring $name..." >&2

    local output hash

    set +e
    output=$(starkli declare "$file" $STARKLI_COMMON 2>&1)
    local status=$?
    set -e

    hash=$(echo "$output" | grep -oE '0x[a-fA-F0-9]{64}' | head -1)

    if [[ -n "$hash" ]]; then
        update_env "$env_var" "$hash"
        if [[ $status -eq 0 ]]; then
            log_success "$name: $hash" >&2
        else
            log_warning "$name (exists): $hash" >&2
        fi
        echo "$hash"
        return 0
    fi

    log_error "Failed to declare $name"
    echo "$output" >&2
    exit 1
}

log_info "Declaring contract classes..."

MOCK_YIELD_TOKEN_CLASS_HASH=$(declare_class "MockYieldToken" "MOCK_YIELD_TOKEN_CLASS_HASH")
SY_CLASS_HASH=$(declare_class "SY" "SY_CLASS_HASH")
PT_CLASS_HASH=$(declare_class "PT" "PT_CLASS_HASH")
YT_CLASS_HASH=$(declare_class "YT" "YT_CLASS_HASH")
MARKET_CLASS_HASH=$(declare_class "Market" "MARKET_CLASS_HASH")
FACTORY_CLASS_HASH=$(declare_class "Factory" "FACTORY_CLASS_HASH")
MARKET_FACTORY_CLASS_HASH=$(declare_class "MarketFactory" "MARKET_FACTORY_CLASS_HASH")
ROUTER_CLASS_HASH=$(declare_class "Router" "ROUTER_CLASS_HASH")

log_success "All classes declared"

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
    output=$(starkli deploy "$class_hash" "${calldata[@]}" $STARKLI_COMMON 2>&1)
    local status=$?
    set -e

    if [[ $status -ne 0 ]]; then
        log_error "Failed to deploy $name"
        echo "$output" >&2
        exit 1
    fi

    local address
    address=$(echo "$output" | grep -oE '0x[a-fA-F0-9]{64}' | tail -1)

    if [[ -z "$address" ]]; then
        log_error "Could not extract address for $name"
        echo "$output" >&2
        exit 1
    fi

    update_env "$env_var" "$address"
    log_success "$name: $address" >&2
    echo "$address"
}

# -----------------------------------------------------------------------------
# Deploy Core Infrastructure
# -----------------------------------------------------------------------------

log_info "Deploying core infrastructure..."

# Factory: constructor(yt_class_hash, pt_class_hash)
FACTORY_ADDRESS=$(deploy_contract "$FACTORY_CLASS_HASH" "Factory" "FACTORY_ADDRESS" \
    "$YT_CLASS_HASH" "$PT_CLASS_HASH")

# MarketFactory: constructor(market_class_hash)
MARKET_FACTORY_ADDRESS=$(deploy_contract "$MARKET_FACTORY_CLASS_HASH" "MarketFactory" "MARKET_FACTORY_ADDRESS" \
    "$MARKET_CLASS_HASH")

# Router: constructor() - no args
ROUTER_ADDRESS=$(deploy_contract "$ROUTER_CLASS_HASH" "Router" "ROUTER_ADDRESS")

log_success "Core infrastructure deployed"

# =============================================================================
# Deploy Test Setup (non-mainnet)
# =============================================================================

if [[ "$NETWORK" != "mainnet" ]]; then
    log_info "Deploying test setup..."

    # MockYieldToken: constructor(name: ByteArray, symbol: ByteArray)
    # ByteArray: data_len (0), pending_word (hex string), pending_word_len
    MOCK_YIELD_TOKEN_ADDRESS=$(deploy_contract "$MOCK_YIELD_TOKEN_CLASS_HASH" "MockYieldToken" "MOCK_YIELD_TOKEN_ADDRESS" \
        0x0 0x4d6f636b5969656c64 0x9 \
        0x0 0x6d594c44 0x4)

    # SY: constructor(name, symbol, underlying, initial_exchange_rate)
    # WAD = 10^18 = 1000000000000000000
    SY_ADDRESS=$(deploy_contract "$SY_CLASS_HASH" "SY" "SY_ADDRESS" \
        0x0 0x53592d6d594c44 0x7 \
        0x0 0x53596d594c44 0x6 \
        "$MOCK_YIELD_TOKEN_ADDRESS" \
        "u256:1000000000000000000")

    log_success "Test setup deployed"

    # -------------------------------------------------------------------------
    # Create PT/YT Pair
    # -------------------------------------------------------------------------

    log_info "Creating PT/YT pair..."

    # Expiry: 30 days from now
    CURRENT_TIME=$(date +%s)
    EXPIRY_TIMESTAMP=$((CURRENT_TIME + 30 * 24 * 60 * 60))
    update_env "EXPIRY_TIMESTAMP" "$EXPIRY_TIMESTAMP"

    log_info "Expiry: $EXPIRY_TIMESTAMP"

    # Invoke Factory.create_yield_contracts(sy, expiry)
    log_info "Calling Factory.create_yield_contracts..."

    starkli invoke "$FACTORY_ADDRESS" create_yield_contracts \
        "$SY_ADDRESS" "$EXPIRY_TIMESTAMP" \
        $STARKLI_COMMON

    # Get PT address
    sleep 1
    log_info "Fetching PT address..."
    PT_ADDRESS=$(starkli call "$FACTORY_ADDRESS" get_pt \
        "$SY_ADDRESS" "$EXPIRY_TIMESTAMP" \
        --rpc "$STARKNET_RPC_URL" | grep -oE '0x[a-fA-F0-9]+' | head -1)
    update_env "PT_ADDRESS" "$PT_ADDRESS"
    log_success "PT: $PT_ADDRESS"

    # Get YT address
    log_info "Fetching YT address..."
    YT_ADDRESS=$(starkli call "$FACTORY_ADDRESS" get_yt \
        "$SY_ADDRESS" "$EXPIRY_TIMESTAMP" \
        --rpc "$STARKNET_RPC_URL" | grep -oE '0x[a-fA-F0-9]+' | head -1)
    update_env "YT_ADDRESS" "$YT_ADDRESS"
    log_success "YT: $YT_ADDRESS"

    # -------------------------------------------------------------------------
    # Create Market
    # -------------------------------------------------------------------------

    if [[ -n "$PT_ADDRESS" && "$PT_ADDRESS" != "0x0" ]]; then
        log_info "Creating Market..."

        SCALAR_ROOT="${MARKET_SCALAR_ROOT:-5000000000000000000}"
        INITIAL_ANCHOR="${MARKET_INITIAL_ANCHOR:-50000000000000000}"
        FEE_RATE="${MARKET_FEE_RATE:-3000000000000000}"

        starkli invoke "$MARKET_FACTORY_ADDRESS" create_market \
            "$PT_ADDRESS" \
            "u256:$SCALAR_ROOT" \
            "u256:$INITIAL_ANCHOR" \
            "u256:$FEE_RATE" \
            $STARKLI_COMMON

        sleep 1
        log_info "Fetching Market address..."
        MARKET_ADDRESS=$(starkli call "$MARKET_FACTORY_ADDRESS" get_market \
            "$PT_ADDRESS" \
            --rpc "$STARKNET_RPC_URL" | grep -oE '0x[a-fA-F0-9]+' | head -1)

        if [[ -n "$MARKET_ADDRESS" && "$MARKET_ADDRESS" != "0x0" ]]; then
            update_env "MARKET_ADDRESS" "$MARKET_ADDRESS"
            log_success "Market: $MARKET_ADDRESS"
        else
            log_warning "Market not created"
        fi
    fi
fi

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
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "classHashes": {
    "MockYieldToken": "$MOCK_YIELD_TOKEN_CLASS_HASH",
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
  "testSetup": {
    "MockYieldToken": "${MOCK_YIELD_TOKEN_ADDRESS:-}",
    "SY": "${SY_ADDRESS:-}",
    "PT": "${PT_ADDRESS:-}",
    "YT": "${YT_ADDRESS:-}",
    "Market": "${MARKET_ADDRESS:-}",
    "expiry": ${EXPIRY_TIMESTAMP:-0}
  }
}
EOF

log_success "Addresses exported to $JSON_FILE"

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Network:        $NETWORK"
echo "Env file:       $ENV_FILE"
echo ""
echo "Core Contracts:"
echo "  Factory:        $FACTORY_ADDRESS"
echo "  MarketFactory:  $MARKET_FACTORY_ADDRESS"
echo "  Router:         $ROUTER_ADDRESS"

if [[ "$NETWORK" != "mainnet" ]]; then
    echo ""
    echo "Test Setup:"
    echo "  MockYieldToken: $MOCK_YIELD_TOKEN_ADDRESS"
    echo "  SY:             $SY_ADDRESS"
    echo "  PT:             $PT_ADDRESS"
    echo "  YT:             $YT_ADDRESS"
    echo "  Market:         $MARKET_ADDRESS"
    echo "  Expiry:         $EXPIRY_TIMESTAMP"
fi

echo ""
log_success "Done!"
