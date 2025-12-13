#!/bin/bash

# =============================================================================
# Horizon Protocol - Deployment Script
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

# Test recipient address for minting tokens
TEST_RECIPIENT="0x0715140EF3b872C34c0E82CB2650c4bEB0E9F60d5a157414af6913E9326cd691"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Horizon Protocol Deployment${NC}"
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

# Convert string to hex for ByteArray pending_word
string_to_hex() {
    echo -n "$1" | xxd -p | tr -d '\n'
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

# Get deployer address for admin purposes
# For katana, use the well-known account addresses
if [[ "$NETWORK" == "katana" ]]; then
    # Katana default accounts (deterministic)
    case "$DEPLOYER_ACCOUNT" in
        "katana-0")
            DEPLOYER_ADDRESS="0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec"
            ;;
        "katana-1")
            DEPLOYER_ADDRESS="0x13d9ee239f33fea4f8785b9e3870ade909e20a9599ae7cd62c1c292b73af1b7"
            ;;
        *)
            # Try starkli for other accounts
            DEPLOYER_ADDRESS=$(starkli account address "$DEPLOYER_ACCOUNT" 2>/dev/null || echo "")
            ;;
    esac
else
    # For other networks, fetch from starkli
    DEPLOYER_ADDRESS=$(starkli account address "$DEPLOYER_ACCOUNT" 2>/dev/null || echo "")
fi

if [[ -z "$DEPLOYER_ADDRESS" ]]; then
    log_error "Could not get deployer address for account: $DEPLOYER_ACCOUNT"
    exit 1
fi
log_info "Deployer address: $DEPLOYER_ADDRESS"

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
    local file="$BUILD_DIR/horizon_${name}.contract_class.json"

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

MOCK_ERC20_CLASS_HASH=$(declare_class "MockERC20" "MOCK_ERC20_CLASS_HASH")
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
    log_info "Deploying test setup with 2 yield tokens and 2 markets..."

    # -------------------------------------------------------------------------
    # Deploy Base Token (STRK mock)
    # -------------------------------------------------------------------------

    # MockERC20: constructor(name: ByteArray, symbol: ByteArray)
    # ByteArray format: data_len (0 for short strings), pending_word (hex), pending_word_len
    log_info "Deploying base token (STRK)..."
    STRK_ADDRESS=$(deploy_contract "$MOCK_ERC20_CLASS_HASH" "STRK" "STRK_ADDRESS" \
        0x0 0x537461726b6e6574 0x8 \
        0x0 0x5354524b 0x4)

    # -------------------------------------------------------------------------
    # Deploy Yield Token 1: nstSTRK (ERC-4626 - Nostra style)
    # -------------------------------------------------------------------------

    # MockYieldToken: constructor(name: ByteArray, symbol: ByteArray, underlying: ContractAddress, admin: ContractAddress)
    # "Nostra Staked STRK" = 0x4e6f7374726120537461 6b6564205354524b (18 chars)
    # "nstSTRK" = 0x6e73745354524b (7 chars)
    # Admin is the deployer so we can mint shares
    log_info "Deploying nstSTRK (ERC-4626 yield token)..."
    NST_STRK_ADDRESS=$(deploy_contract "$MOCK_YIELD_TOKEN_CLASS_HASH" "nstSTRK" "NST_STRK_ADDRESS" \
        0x0 0x4e6f73747261205374616b6564205354524b 0x12 \
        0x0 0x6e73745354524b 0x7 \
        "$STRK_ADDRESS" \
        "$DEPLOYER_ADDRESS")

    # -------------------------------------------------------------------------
    # Deploy Yield Token 2: sSTRK (Regular yield token with index())
    # -------------------------------------------------------------------------

    # "Staked Starknet Token" = 21 chars, need to split
    # "sSTRK" = 0x735354524b (5 chars)
    # Admin is the deployer so we can mint shares
    log_info "Deploying sSTRK (regular yield token)..."
    SSTRK_ADDRESS=$(deploy_contract "$MOCK_YIELD_TOKEN_CLASS_HASH" "sSTRK" "SSTRK_ADDRESS" \
        0x0 0x5374616b656420537461726b6e657420546f6b656e 0x15 \
        0x0 0x735354524b 0x5 \
        "$STRK_ADDRESS" \
        "$DEPLOYER_ADDRESS")

    # -------------------------------------------------------------------------
    # Deploy SY 1: SY-nstSTRK (wraps nstSTRK, ERC-4626 mode)
    # -------------------------------------------------------------------------

    # SY: constructor(name, symbol, underlying, index_oracle, is_erc4626)
    # "SY Nostra Staked STRK" = 21 chars
    # "SY-nstSTRK" = 10 chars
    log_info "Deploying SY-nstSTRK..."
    SY_NST_STRK_ADDRESS=$(deploy_contract "$SY_CLASS_HASH" "SY-nstSTRK" "SY_NST_STRK_ADDRESS" \
        0x0 0x5359204e6f73747261205374616b6564205354524b 0x15 \
        0x0 0x53592d6e73745354524b 0xa \
        "$NST_STRK_ADDRESS" \
        "$NST_STRK_ADDRESS" \
        0x1)

    # -------------------------------------------------------------------------
    # Deploy SY 2: SY-sSTRK (wraps sSTRK, uses index() oracle mode)
    # -------------------------------------------------------------------------

    # "SY Staked Starknet Token" = 24 chars
    # "SY-sSTRK" = 8 chars
    log_info "Deploying SY-sSTRK..."
    SY_SSTRK_ADDRESS=$(deploy_contract "$SY_CLASS_HASH" "SY-sSTRK" "SY_SSTRK_ADDRESS" \
        0x0 0x5359205374616b656420537461726b6e657420546f6b656e 0x18 \
        0x0 0x53592d735354524b 0x8 \
        "$SSTRK_ADDRESS" \
        "$SSTRK_ADDRESS" \
        0x0)

    log_success "Yield tokens and SY tokens deployed"

    # -------------------------------------------------------------------------
    # Mint tokens to test recipient
    # -------------------------------------------------------------------------

    log_info "Minting tokens to test recipient: $TEST_RECIPIENT"

    # Mint 1,000,000 STRK (base token)
    MINT_AMOUNT="u256:1000000000000000000000000"

    starkli invoke "$STRK_ADDRESS" mint \
        "$TEST_RECIPIENT" "$MINT_AMOUNT" \
        $STARKLI_COMMON
    log_success "Minted 1,000,000 STRK"

    # Mint 100,000 nstSTRK shares
    starkli invoke "$NST_STRK_ADDRESS" mint_shares \
        "$TEST_RECIPIENT" "u256:100000000000000000000000" \
        $STARKLI_COMMON
    log_success "Minted 100,000 nstSTRK"

    # Mint 100,000 sSTRK shares
    starkli invoke "$SSTRK_ADDRESS" mint_shares \
        "$TEST_RECIPIENT" "u256:100000000000000000000000" \
        $STARKLI_COMMON
    log_success "Minted 100,000 sSTRK"

    # -------------------------------------------------------------------------
    # Create PT/YT Pairs for both SY tokens
    # -------------------------------------------------------------------------

    log_info "Creating PT/YT pairs..."

    # Expiry: 30 days from now
    CURRENT_TIME=$(date +%s)
    EXPIRY_TIMESTAMP=$((CURRENT_TIME + 30 * 24 * 60 * 60))
    update_env "EXPIRY_TIMESTAMP" "$EXPIRY_TIMESTAMP"

    log_info "Expiry: $EXPIRY_TIMESTAMP ($(date -d "@$EXPIRY_TIMESTAMP" 2>/dev/null || date -r "$EXPIRY_TIMESTAMP"))"

    # Create PT/YT for SY-nstSTRK
    log_info "Creating PT/YT for SY-nstSTRK..."
    starkli invoke "$FACTORY_ADDRESS" create_yield_contracts \
        "$SY_NST_STRK_ADDRESS" "$EXPIRY_TIMESTAMP" \
        $STARKLI_COMMON

    sleep 1
    PT_NST_STRK_ADDRESS=$(starkli call "$FACTORY_ADDRESS" get_pt \
        "$SY_NST_STRK_ADDRESS" "$EXPIRY_TIMESTAMP" \
        --rpc "$STARKNET_RPC_URL" | grep -oE '0x[a-fA-F0-9]+' | head -1)
    update_env "PT_NST_STRK_ADDRESS" "$PT_NST_STRK_ADDRESS"
    log_success "PT-nstSTRK: $PT_NST_STRK_ADDRESS"

    YT_NST_STRK_ADDRESS=$(starkli call "$FACTORY_ADDRESS" get_yt \
        "$SY_NST_STRK_ADDRESS" "$EXPIRY_TIMESTAMP" \
        --rpc "$STARKNET_RPC_URL" | grep -oE '0x[a-fA-F0-9]+' | head -1)
    update_env "YT_NST_STRK_ADDRESS" "$YT_NST_STRK_ADDRESS"
    log_success "YT-nstSTRK: $YT_NST_STRK_ADDRESS"

    # Create PT/YT for SY-sSTRK
    log_info "Creating PT/YT for SY-sSTRK..."
    starkli invoke "$FACTORY_ADDRESS" create_yield_contracts \
        "$SY_SSTRK_ADDRESS" "$EXPIRY_TIMESTAMP" \
        $STARKLI_COMMON

    sleep 1
    PT_SSTRK_ADDRESS=$(starkli call "$FACTORY_ADDRESS" get_pt \
        "$SY_SSTRK_ADDRESS" "$EXPIRY_TIMESTAMP" \
        --rpc "$STARKNET_RPC_URL" | grep -oE '0x[a-fA-F0-9]+' | head -1)
    update_env "PT_SSTRK_ADDRESS" "$PT_SSTRK_ADDRESS"
    log_success "PT-sSTRK: $PT_SSTRK_ADDRESS"

    YT_SSTRK_ADDRESS=$(starkli call "$FACTORY_ADDRESS" get_yt \
        "$SY_SSTRK_ADDRESS" "$EXPIRY_TIMESTAMP" \
        --rpc "$STARKNET_RPC_URL" | grep -oE '0x[a-fA-F0-9]+' | head -1)
    update_env "YT_SSTRK_ADDRESS" "$YT_SSTRK_ADDRESS"
    log_success "YT-sSTRK: $YT_SSTRK_ADDRESS"

    # -------------------------------------------------------------------------
    # Create Markets for both PT tokens
    # -------------------------------------------------------------------------

    log_info "Creating Markets..."

    SCALAR_ROOT="${MARKET_SCALAR_ROOT:-5000000000000000000}"
    INITIAL_ANCHOR="${MARKET_INITIAL_ANCHOR:-50000000000000000}"
    FEE_RATE="${MARKET_FEE_RATE:-3000000000000000}"

    # Market for PT-nstSTRK
    if [[ -n "$PT_NST_STRK_ADDRESS" && "$PT_NST_STRK_ADDRESS" != "0x0" ]]; then
        log_info "Creating Market for PT-nstSTRK..."
        starkli invoke "$MARKET_FACTORY_ADDRESS" create_market \
            "$PT_NST_STRK_ADDRESS" \
            "u256:$SCALAR_ROOT" \
            "u256:$INITIAL_ANCHOR" \
            "u256:$FEE_RATE" \
            $STARKLI_COMMON

        sleep 1
        MARKET_NST_STRK_ADDRESS=$(starkli call "$MARKET_FACTORY_ADDRESS" get_market \
            "$PT_NST_STRK_ADDRESS" \
            --rpc "$STARKNET_RPC_URL" | grep -oE '0x[a-fA-F0-9]+' | head -1)

        if [[ -n "$MARKET_NST_STRK_ADDRESS" && "$MARKET_NST_STRK_ADDRESS" != "0x0" ]]; then
            update_env "MARKET_NST_STRK_ADDRESS" "$MARKET_NST_STRK_ADDRESS"
            log_success "Market-nstSTRK: $MARKET_NST_STRK_ADDRESS"
        else
            log_warning "Market for nstSTRK not created"
        fi
    fi

    # Market for PT-sSTRK
    if [[ -n "$PT_SSTRK_ADDRESS" && "$PT_SSTRK_ADDRESS" != "0x0" ]]; then
        log_info "Creating Market for PT-sSTRK..."
        starkli invoke "$MARKET_FACTORY_ADDRESS" create_market \
            "$PT_SSTRK_ADDRESS" \
            "u256:$SCALAR_ROOT" \
            "u256:$INITIAL_ANCHOR" \
            "u256:$FEE_RATE" \
            $STARKLI_COMMON

        sleep 1
        MARKET_SSTRK_ADDRESS=$(starkli call "$MARKET_FACTORY_ADDRESS" get_market \
            "$PT_SSTRK_ADDRESS" \
            --rpc "$STARKNET_RPC_URL" | grep -oE '0x[a-fA-F0-9]+' | head -1)

        if [[ -n "$MARKET_SSTRK_ADDRESS" && "$MARKET_SSTRK_ADDRESS" != "0x0" ]]; then
            update_env "MARKET_SSTRK_ADDRESS" "$MARKET_SSTRK_ADDRESS"
            log_success "Market-sSTRK: $MARKET_SSTRK_ADDRESS"
        else
            log_warning "Market for sSTRK not created"
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
    "MockERC20": "$MOCK_ERC20_CLASS_HASH",
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
    "testRecipient": "$TEST_RECIPIENT",
    "baseToken": {
      "STRK": "${STRK_ADDRESS:-}"
    },
    "yieldTokens": {
      "nstSTRK": {
        "name": "Nostra Staked STRK",
        "symbol": "nstSTRK",
        "address": "${NST_STRK_ADDRESS:-}",
        "isERC4626": true
      },
      "sSTRK": {
        "name": "Staked Starknet Token",
        "symbol": "sSTRK",
        "address": "${SSTRK_ADDRESS:-}",
        "isERC4626": false
      }
    },
    "syTokens": {
      "SY-nstSTRK": {
        "address": "${SY_NST_STRK_ADDRESS:-}",
        "underlying": "${NST_STRK_ADDRESS:-}"
      },
      "SY-sSTRK": {
        "address": "${SY_SSTRK_ADDRESS:-}",
        "underlying": "${SSTRK_ADDRESS:-}"
      }
    },
    "markets": {
      "nstSTRK": {
        "PT": "${PT_NST_STRK_ADDRESS:-}",
        "YT": "${YT_NST_STRK_ADDRESS:-}",
        "Market": "${MARKET_NST_STRK_ADDRESS:-}"
      },
      "sSTRK": {
        "PT": "${PT_SSTRK_ADDRESS:-}",
        "YT": "${YT_SSTRK_ADDRESS:-}",
        "Market": "${MARKET_SSTRK_ADDRESS:-}"
      }
    },
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
    echo "Test Recipient:   $TEST_RECIPIENT"
    echo ""
    echo "Base Token:"
    echo "  STRK:           $STRK_ADDRESS"
    echo ""
    echo "Yield Token 1 (ERC-4626):"
    echo "  nstSTRK:        $NST_STRK_ADDRESS"
    echo "  SY-nstSTRK:     $SY_NST_STRK_ADDRESS"
    echo "  PT-nstSTRK:     $PT_NST_STRK_ADDRESS"
    echo "  YT-nstSTRK:     $YT_NST_STRK_ADDRESS"
    echo "  Market:         $MARKET_NST_STRK_ADDRESS"
    echo ""
    echo "Yield Token 2 (Index Oracle):"
    echo "  sSTRK:          $SSTRK_ADDRESS"
    echo "  SY-sSTRK:       $SY_SSTRK_ADDRESS"
    echo "  PT-sSTRK:       $PT_SSTRK_ADDRESS"
    echo "  YT-sSTRK:       $YT_SSTRK_ADDRESS"
    echo "  Market:         $MARKET_SSTRK_ADDRESS"
    echo ""
    echo "Expiry:           $EXPIRY_TIMESTAMP"
fi

echo ""
log_success "Done!"
