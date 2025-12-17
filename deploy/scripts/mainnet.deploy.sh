#!/bin/bash

# =============================================================================
# Horizon Protocol - Mainnet Deployment Script
# =============================================================================
# Usage: ./deploy/scripts/mainnet.deploy.sh
#
# This script:
# 1. Declares all contract classes
# 2. Deploys:
#    - Mock yield token (hrzSTRK) with STRK as underlying
#    - Faucet for hrzSTRK (100 tokens/day limit)
#    - Core protocol contracts (Factory, MarketFactory, Router)
#    - SY, PT, YT, and Market for hrzSTRK
# 3. Seeds 50M liquidity to market
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"

NETWORK="mainnet"
ENV_FILE="$ROOT_DIR/.env.$NETWORK"
ACCOUNTS_FILE="$ROOT_DIR/deploy/accounts/$NETWORK.json"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Horizon Protocol - Mainnet Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

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

if [[ -z "$DEPLOYER_ADDRESS" || -z "$DEPLOYER_PRIVATE_KEY" ]]; then
    log_error "DEPLOYER_ADDRESS and DEPLOYER_PRIVATE_KEY must be set in $ENV_FILE"
    exit 1
fi

log_info "RPC: $STARKNET_RPC_URL"
log_info "Deployer: $DEPLOYER_ADDRESS"
log_info "Test Recipient: $TEST_RECIPIENT"

# =============================================================================
# Setup Account for sncast
# =============================================================================

mkdir -p "$(dirname "$ACCOUNTS_FILE")"

DEPLOYER_PUBLIC_KEY="0x0"
ACCOUNT_CLASS_HASH="0x03957f9f5a1cbfe918cedc2015c85200ca51a5f7506ecb6de98a5207b759bf8a"

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
      "type": "braavos"
    }
  },
  "alpha-sepolia": {}
}
EOF

log_success "Account file created: $ACCOUNTS_FILE"

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

# Delay between transactions to avoid nonce errors
TX_DELAY="${TX_DELAY:-15}"

declare_class() {
    local name=$1
    local env_var=$2
    local max_retries=3
    local retry_delay=15

    log_info "Declaring $name..." >&2

    local output hash
    set +e
    output=$(sncast -a deployer -f "$ACCOUNTS_FILE" declare -u "$STARKNET_RPC_URL" --package horizon -c "$name" 2>&1)
    local status=$?
    set -e

    # Extract class hash from output
    hash=$(echo "$output" | grep -oE 'class_hash: 0x[a-fA-F0-9]+' | grep -oE '0x[a-fA-F0-9]+' | head -1)

    if [[ -z "$hash" ]]; then
        hash=$(echo "$output" | grep -oE '0x[a-fA-F0-9]{64}' | head -1)
    fi

    if [[ -n "$hash" ]]; then
        update_env "$env_var" "$hash"
        if echo "$output" | grep -qi "already declared\|already exists"; then
            log_warning "$name (exists): $hash" >&2
        else
            log_success "$name: $hash" >&2
        fi
        echo "$hash"
        return 0
    fi

    log_error "Failed to declare $name" >&2
    echo "$output" >&2
    exit 1
}

# =============================================================================
# Declare Classes (skip if already declared)
# =============================================================================

# Check if all required class hashes are already set
if [[ -n "$MOCK_YIELD_TOKEN_CLASS_HASH" && -n "$FAUCET_CLASS_HASH" && \
      -n "$SY_CLASS_HASH" && -n "$PT_CLASS_HASH" && -n "$YT_CLASS_HASH" && \
      -n "$MARKET_CLASS_HASH" && -n "$FACTORY_CLASS_HASH" && \
      -n "$MARKET_FACTORY_CLASS_HASH" && -n "$ROUTER_CLASS_HASH" ]]; then
    log_info "All class hashes found in env, skipping declarations"
    log_info "  MockYieldToken: $MOCK_YIELD_TOKEN_CLASS_HASH"
    log_info "  Faucet: $FAUCET_CLASS_HASH"
    log_info "  SY: $SY_CLASS_HASH"
    log_info "  PT: $PT_CLASS_HASH"
    log_info "  YT: $YT_CLASS_HASH"
    log_info "  Market: $MARKET_CLASS_HASH"
    log_info "  Factory: $FACTORY_CLASS_HASH"
    log_info "  MarketFactory: $MARKET_FACTORY_CLASS_HASH"
    log_info "  Router: $ROUTER_CLASS_HASH"
else
    log_info "Declaring contract classes..."

    MOCK_YIELD_TOKEN_CLASS_HASH=$(declare_class "MockYieldToken" "MOCK_YIELD_TOKEN_CLASS_HASH")
    sleep "$TX_DELAY"
    FAUCET_CLASS_HASH=$(declare_class "Faucet" "FAUCET_CLASS_HASH")
    sleep "$TX_DELAY"
    SY_CLASS_HASH=$(declare_class "SY" "SY_CLASS_HASH")
    sleep "$TX_DELAY"
    PT_CLASS_HASH=$(declare_class "PT" "PT_CLASS_HASH")
    sleep "$TX_DELAY"
    YT_CLASS_HASH=$(declare_class "YT" "YT_CLASS_HASH")
    sleep "$TX_DELAY"
    MARKET_CLASS_HASH=$(declare_class "Market" "MARKET_CLASS_HASH")
    sleep "$TX_DELAY"
    FACTORY_CLASS_HASH=$(declare_class "Factory" "FACTORY_CLASS_HASH")
    sleep "$TX_DELAY"
    MARKET_FACTORY_CLASS_HASH=$(declare_class "MarketFactory" "MARKET_FACTORY_CLASS_HASH")
    sleep "$TX_DELAY"
    ROUTER_CLASS_HASH=$(declare_class "Router" "ROUTER_CLASS_HASH")

    log_success "All classes declared"

    # Wait for declarations to be confirmed
    log_info "Waiting 20 seconds for declarations to be confirmed..."
    sleep 20
fi

# =============================================================================
# Deploy Contracts
# =============================================================================

deploy_contract() {
    local class_hash=$1
    local name=$2
    local env_var=$3
    shift 3
    local calldata=("$@")

    # Check if already deployed
    local existing_address
    existing_address=$(eval echo "\$$env_var")
    if [[ -n "$existing_address" && "$existing_address" != "" && "$existing_address" != "0x0" ]]; then
        log_warning "$name (already deployed): $existing_address" >&2
        echo "$existing_address"
        return 0
    fi

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
        log_error "Failed to deploy $name" >&2
        echo "$output" >&2
        exit 1
    fi

    local address
    address=$(echo "$output" | grep -oE 'contract_address: 0x[a-fA-F0-9]+' | grep -oE '0x[a-fA-F0-9]+' | head -1)

    if [[ -z "$address" ]]; then
        address=$(echo "$output" | grep -oE '0x[a-fA-F0-9]{64}' | head -1)
    fi

    if [[ -z "$address" ]]; then
        log_error "Could not extract address for $name" >&2
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
        echo "$output" >&2
        return 1
    fi
    return 0
}

# -----------------------------------------------------------------------------
# Deploy Core Infrastructure
# -----------------------------------------------------------------------------

log_info "Deploying core infrastructure..."

# Factory: constructor(owner, yt_class_hash, pt_class_hash)
FACTORY_ADDRESS=$(deploy_contract "$FACTORY_CLASS_HASH" "Factory" "FACTORY_ADDRESS" \
    "$DEPLOYER_ADDRESS" "$YT_CLASS_HASH" "$PT_CLASS_HASH")
sleep "$TX_DELAY"

# MarketFactory: constructor(owner, market_class_hash)
MARKET_FACTORY_ADDRESS=$(deploy_contract "$MARKET_FACTORY_CLASS_HASH" "MarketFactory" "MARKET_FACTORY_ADDRESS" \
    "$DEPLOYER_ADDRESS" "$MARKET_CLASS_HASH")
sleep "$TX_DELAY"

# Router: constructor(owner)
ROUTER_ADDRESS=$(deploy_contract "$ROUTER_CLASS_HASH" "Router" "ROUTER_ADDRESS" \
    "$DEPLOYER_ADDRESS")
sleep "$TX_DELAY"

log_success "Core infrastructure deployed"

# -----------------------------------------------------------------------------
# Deploy hrzSTRK Mock Yield Token
# -----------------------------------------------------------------------------

log_info "Deploying hrzSTRK mock yield token..."

# Use mainnet STRK address
STRK_ADDRESS="0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
update_env "STRK_ADDRESS" "$STRK_ADDRESS"
log_info "Using STRK at: $STRK_ADDRESS"

# MockYieldToken: constructor(name: ByteArray, symbol: ByteArray, underlying: ContractAddress, owner: ContractAddress)
# "Horizon Mock Staked STRK" = 24 chars = 0x18
# "hrzSTRK" = 7 chars = 0x7
HRZ_STRK_ADDRESS=$(deploy_contract "$MOCK_YIELD_TOKEN_CLASS_HASH" "hrzSTRK" "HRZ_STRK_ADDRESS" \
    0x0 0x486f72697a6f6e204d6f636b205374616b6564205354524b 0x18 \
    0x0 0x68727a5354524b 0x7 \
    "$STRK_ADDRESS" \
    "$DEPLOYER_ADDRESS")
sleep "$TX_DELAY"

log_success "hrzSTRK deployed: $HRZ_STRK_ADDRESS"

# -----------------------------------------------------------------------------
# Deploy Faucet for hrzSTRK
# -----------------------------------------------------------------------------

log_info "Deploying Faucet for hrzSTRK..."

# Faucet: constructor(token: ContractAddress, owner: ContractAddress)
FAUCET_ADDRESS=$(deploy_contract "$FAUCET_CLASS_HASH" "Faucet" "FAUCET_ADDRESS" \
    "$HRZ_STRK_ADDRESS" \
    "$DEPLOYER_ADDRESS")
sleep "$TX_DELAY"

log_success "Faucet deployed: $FAUCET_ADDRESS"

# Add Faucet as authorized minter for hrzSTRK
# Owner (deployer) keeps full control, Faucet can only mint
log_info "Adding Faucet as authorized minter for hrzSTRK..."
invoke_contract "$HRZ_STRK_ADDRESS" add_minter "$FAUCET_ADDRESS"
sleep "$TX_DELAY"
log_success "Faucet added as authorized minter"

# -----------------------------------------------------------------------------
# Mint 1M hrzSTRK to TEST_RECIPIENT
# -----------------------------------------------------------------------------

if [[ -n "$TEST_RECIPIENT" && "$TEST_RECIPIENT" != "" ]]; then
    log_info "Minting 1,000,000 hrzSTRK to TEST_RECIPIENT..."
    # 1M tokens = 1000000 * 10^18 = 0xd3c21bcecceda1000000
    MINT_AMOUNT_1M="0xd3c21bcecceda1000000"
    invoke_contract "$HRZ_STRK_ADDRESS" mint_shares "$TEST_RECIPIENT" "$MINT_AMOUNT_1M" 0x0
    sleep "$TX_DELAY"
    log_success "Minted 1M hrzSTRK to $TEST_RECIPIENT"
fi

# -----------------------------------------------------------------------------
# Deploy SY-hrzSTRK
# -----------------------------------------------------------------------------

log_info "Deploying SY-hrzSTRK..."

# SY: constructor(name, symbol, underlying, index_oracle, is_erc4626)
# "SY Horizon Mock Staked STRK" = 27 chars = 0x1b
# "SY-hrzSTRK" = 10 chars = 0xa
SY_HRZ_STRK_ADDRESS=$(deploy_contract "$SY_CLASS_HASH" "SY-hrzSTRK" "SY_HRZ_STRK_ADDRESS" \
    0x0 0x535920486f72697a6f6e204d6f636b205374616b6564205354524b 0x1b \
    0x0 0x53592d68727a5354524b 0xa \
    "$HRZ_STRK_ADDRESS" \
    "$HRZ_STRK_ADDRESS" \
    0x1)
sleep "$TX_DELAY"

log_success "SY-hrzSTRK deployed: $SY_HRZ_STRK_ADDRESS"

# -----------------------------------------------------------------------------
# Create PT/YT for hrzSTRK
# -----------------------------------------------------------------------------

log_info "Creating PT/YT for hrzSTRK..."

# Use expiry from env or default to 6 months from now
if [[ -z "$EXPIRY_TIMESTAMP" || "$EXPIRY_TIMESTAMP" == "0" ]]; then
    CURRENT_TIME=$(date +%s)
    EXPIRY_TIMESTAMP=$((CURRENT_TIME + 180 * 24 * 60 * 60))
    update_env "EXPIRY_TIMESTAMP" "$EXPIRY_TIMESTAMP"
fi

log_info "Expiry: $EXPIRY_TIMESTAMP"

# Create PT/YT (skip if already exists)
if [[ -n "$PT_HRZ_STRK_ADDRESS" && "$PT_HRZ_STRK_ADDRESS" != "" && "$PT_HRZ_STRK_ADDRESS" != "0x0" ]]; then
    log_warning "PT/YT for hrzSTRK already exists"
else
    invoke_contract "$FACTORY_ADDRESS" create_yield_contracts \
        "$SY_HRZ_STRK_ADDRESS" "$EXPIRY_TIMESTAMP"

    sleep "$TX_DELAY"

    PT_HRZ_STRK_ADDRESS=$(call_contract "$FACTORY_ADDRESS" get_pt \
        "$SY_HRZ_STRK_ADDRESS" "$EXPIRY_TIMESTAMP")
    update_env "PT_HRZ_STRK_ADDRESS" "$PT_HRZ_STRK_ADDRESS"
    log_success "PT-hrzSTRK: $PT_HRZ_STRK_ADDRESS"

    YT_HRZ_STRK_ADDRESS=$(call_contract "$FACTORY_ADDRESS" get_yt \
        "$SY_HRZ_STRK_ADDRESS" "$EXPIRY_TIMESTAMP")
    update_env "YT_HRZ_STRK_ADDRESS" "$YT_HRZ_STRK_ADDRESS"
    log_success "YT-hrzSTRK: $YT_HRZ_STRK_ADDRESS"
fi

# -----------------------------------------------------------------------------
# Create Market for PT-hrzSTRK
# -----------------------------------------------------------------------------

log_info "Creating Market for PT-hrzSTRK..."

# Market parameters
SCALAR_ROOT="${MARKET_SCALAR_ROOT:-5000000000000000000}"
FEE_RATE="${MARKET_FEE_RATE:-3000000000000000}"
DEFAULT_ANCHOR="${MARKET_INITIAL_ANCHOR:-76961041136128000}"  # ~8% APY

ANCHOR_HRZ_STRK="${MARKET_INITIAL_ANCHOR_HRZ_STRK:-$DEFAULT_ANCHOR}"

SCALAR_ROOT_HEX=$(printf "0x%x" "$SCALAR_ROOT")
FEE_RATE_HEX=$(printf "0x%x" "$FEE_RATE")
ANCHOR_HEX=$(printf "0x%x" "$ANCHOR_HRZ_STRK")

if [[ -n "$MARKET_HRZ_STRK_ADDRESS" && "$MARKET_HRZ_STRK_ADDRESS" != "" && "$MARKET_HRZ_STRK_ADDRESS" != "0x0" ]]; then
    log_warning "Market for hrzSTRK already exists: $MARKET_HRZ_STRK_ADDRESS"
else
    log_info "Creating Market (anchor: $ANCHOR_HRZ_STRK)..."
    invoke_contract "$MARKET_FACTORY_ADDRESS" create_market \
        "$PT_HRZ_STRK_ADDRESS" \
        "$SCALAR_ROOT_HEX" 0x0 \
        "$ANCHOR_HEX" 0x0 \
        "$FEE_RATE_HEX" 0x0

    sleep "$TX_DELAY"

    MARKET_HRZ_STRK_ADDRESS=$(call_contract "$MARKET_FACTORY_ADDRESS" get_market \
        "$PT_HRZ_STRK_ADDRESS")

    if [[ -n "$MARKET_HRZ_STRK_ADDRESS" && "$MARKET_HRZ_STRK_ADDRESS" != "0x0" ]]; then
        update_env "MARKET_HRZ_STRK_ADDRESS" "$MARKET_HRZ_STRK_ADDRESS"
        log_success "Market-hrzSTRK: $MARKET_HRZ_STRK_ADDRESS"
    else
        log_warning "Market for hrzSTRK not created"
    fi
fi

# -----------------------------------------------------------------------------
# Seed 50M Liquidity to Market
# -----------------------------------------------------------------------------

log_info "Seeding 50M liquidity to market..."

# Helper: Convert decimal string to hex (handles large numbers)
to_hex() {
    python3 -c "print(hex(int('$1')))" 2>/dev/null || \
    printf "0x%x" "$1" 2>/dev/null || \
    echo "0x0"
}

# Helper: Divide large number by 2
half_of() {
    python3 -c "print(int('$1') // 2)" 2>/dev/null || \
    echo $(($1 / 2))
}

# 50M tokens = 50,000,000 * 10^18
LIQUIDITY_AMOUNT="50000000000000000000000000"
LIQUIDITY_HEX=$(to_hex "$LIQUIDITY_AMOUNT")
HALF_AMOUNT=$(half_of "$LIQUIDITY_AMOUNT")
HALF_HEX=$(to_hex "$HALF_AMOUNT")

log_info "Liquidity amount: $LIQUIDITY_AMOUNT ($LIQUIDITY_HEX)"
log_info "Half amount: $HALF_AMOUNT ($HALF_HEX)"

# Step 1: Mint 50M hrzSTRK to deployer
log_info "Step 1: Minting 50M hrzSTRK to deployer..."
invoke_contract "$HRZ_STRK_ADDRESS" mint_shares "$DEPLOYER_ADDRESS" "$LIQUIDITY_HEX" 0x0
sleep "$TX_DELAY"

# Step 2: Approve SY to spend hrzSTRK
log_info "Step 2: Approving SY to spend hrzSTRK..."
invoke_contract "$HRZ_STRK_ADDRESS" approve "$SY_HRZ_STRK_ADDRESS" "$LIQUIDITY_HEX" 0x0
sleep "$TX_DELAY"

# Step 3: Deposit hrzSTRK to get SY
log_info "Step 3: Depositing hrzSTRK to get SY..."
invoke_contract "$SY_HRZ_STRK_ADDRESS" deposit "$DEPLOYER_ADDRESS" "$LIQUIDITY_HEX" 0x0
sleep "$TX_DELAY"

# Step 4: Approve YT to spend SY (for minting PT+YT)
log_info "Step 4: Approving YT to spend SY..."
invoke_contract "$SY_HRZ_STRK_ADDRESS" approve "$YT_HRZ_STRK_ADDRESS" "$HALF_HEX" 0x0
sleep "$TX_DELAY"

# Step 5: Mint PT+YT from SY (use half for PT+YT)
log_info "Step 5: Minting PT+YT from SY..."
invoke_contract "$YT_HRZ_STRK_ADDRESS" mint_py "$DEPLOYER_ADDRESS" "$HALF_HEX" 0x0
sleep "$TX_DELAY"

# Step 6: Approve Market to spend SY
log_info "Step 6: Approving Market to spend SY..."
invoke_contract "$SY_HRZ_STRK_ADDRESS" approve "$MARKET_HRZ_STRK_ADDRESS" "$HALF_HEX" 0x0
sleep "$TX_DELAY"

# Step 7: Approve Market to spend PT
log_info "Step 7: Approving Market to spend PT..."
invoke_contract "$PT_HRZ_STRK_ADDRESS" approve "$MARKET_HRZ_STRK_ADDRESS" "$HALF_HEX" 0x0
sleep "$TX_DELAY"

# Step 8: Add liquidity to market (SY + PT -> LP)
log_info "Step 8: Adding liquidity to market..."
invoke_contract "$MARKET_HRZ_STRK_ADDRESS" mint \
    "$DEPLOYER_ADDRESS" "$HALF_HEX" 0x0 "$HALF_HEX" 0x0
sleep "$TX_DELAY"

log_success "50M liquidity seeded to market"

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
    "Faucet": "$FAUCET_CLASS_HASH",
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
    "Router": "$ROUTER_ADDRESS",
    "Faucet": "$FAUCET_ADDRESS"
  },
  "tokens": {
    "STRK": "$STRK_ADDRESS",
    "hrzSTRK": {
      "name": "Horizon Mock Staked STRK",
      "symbol": "hrzSTRK",
      "address": "$HRZ_STRK_ADDRESS",
      "isERC4626": true,
      "faucet": "$FAUCET_ADDRESS",
      "faucetDailyLimit": "100000000000000000000"
    }
  },
  "syTokens": {
    "SY-hrzSTRK": {
      "address": "$SY_HRZ_STRK_ADDRESS",
      "underlying": "$HRZ_STRK_ADDRESS",
      "isERC4626": true
    }
  },
  "markets": {
    "hrzSTRK": {
      "PT": "$PT_HRZ_STRK_ADDRESS",
      "YT": "$YT_HRZ_STRK_ADDRESS",
      "Market": "$MARKET_HRZ_STRK_ADDRESS",
      "initialAnchor": "$ANCHOR_HRZ_STRK"
    }
  },
  "marketParams": {
    "scalarRoot": "$SCALAR_ROOT",
    "feeRate": "$FEE_RATE"
  },
  "liquidity": {
    "seeded": true,
    "seedAmount": "$LIQUIDITY_AMOUNT"
  },
  "testRecipient": "$TEST_RECIPIENT",
  "expiry": $EXPIRY_TIMESTAMP
}
EOF

log_success "Addresses exported to $JSON_FILE"

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Mainnet Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Network:          $NETWORK"
echo "Env file:         $ENV_FILE"
echo ""
echo "Core Contracts:"
echo "  Factory:        $FACTORY_ADDRESS"
echo "  MarketFactory:  $MARKET_FACTORY_ADDRESS"
echo "  Router:         $ROUTER_ADDRESS"
echo ""
echo "Mock Token Setup:"
echo "  STRK:           $STRK_ADDRESS"
echo "  hrzSTRK:        $HRZ_STRK_ADDRESS"
echo "  Faucet:         $FAUCET_ADDRESS"
echo "  SY-hrzSTRK:     $SY_HRZ_STRK_ADDRESS"
echo "  PT-hrzSTRK:     $PT_HRZ_STRK_ADDRESS"
echo "  YT-hrzSTRK:     $YT_HRZ_STRK_ADDRESS"
echo "  Market:         $MARKET_HRZ_STRK_ADDRESS"
echo ""
echo "Market Parameters:"
echo "  Scalar Root:    $SCALAR_ROOT"
echo "  Fee Rate:       $FEE_RATE"
echo "  Initial Anchor: $ANCHOR_HRZ_STRK"
echo ""
echo "Expiry:           $EXPIRY_TIMESTAMP"
echo ""
echo "Initial Setup:"
echo "  TEST_RECIPIENT: $TEST_RECIPIENT"
echo "  Minted to TEST_RECIPIENT: 1,000,000 hrzSTRK"
echo "  Market Liquidity: 50,000,000 (25M SY + 25M PT)"
echo ""
echo -e "${YELLOW}Note:${NC} Faucet allows 100 tokens/day per address"
echo ""
log_success "Done!"
