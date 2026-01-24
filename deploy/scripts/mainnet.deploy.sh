#!/bin/bash

# =============================================================================
# Horizon Protocol - Mainnet Deployment Script
# =============================================================================
# Usage: ./deploy/scripts/mainnet.deploy.sh
#
# This script:
# 1. Declares all contract classes (via declare.sh)
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

# Override ACCOUNTS_FILE with absolute path (env file may have relative path)
ACCOUNTS_FILE="$ROOT_DIR/deploy/accounts/$NETWORK.json"

if [[ -z "$DEPLOYER_ADDRESS" || -z "$DEPLOYER_PRIVATE_KEY" ]]; then
    log_error "DEPLOYER_ADDRESS and DEPLOYER_PRIVATE_KEY must be set in $ENV_FILE"
    exit 1
fi

log_info "RPC: $STARKNET_RPC_URL"
log_info "Deployer: $DEPLOYER_ADDRESS"
log_info "Test Recipient: $TEST_RECIPIENT"
TREASURY_ADDRESS="${TREASURY_ADDRESS:-$DEPLOYER_ADDRESS}"
update_env "TREASURY_ADDRESS" "$TREASURY_ADDRESS"
log_info "Treasury: $TREASURY_ADDRESS"

# =============================================================================
# Step 1: Declare Classes (using declare.sh)
# =============================================================================

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Step 1: Declaring Contract Classes${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

"$SCRIPT_DIR/declare.sh" mainnet

# Re-source env to get class hashes
source "$ENV_FILE"

echo ""
log_success "All classes declared"
echo ""

# Wait for declarations to be confirmed
log_info "Waiting 15 seconds for declarations to be confirmed..."
sleep 15

# =============================================================================
# Step 2: Deploy Contracts
# =============================================================================

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Step 2: Deploying Contracts${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Delay between transactions
TX_DELAY="${TX_DELAY:-8}"

deploy_contract() {
    local class_hash=$1
    local name=$2
    local env_var=$3
    shift 3
    local calldata=("$@")
    local max_retries=3
    local retry_delay=10

    # Check if already deployed
    local existing_address
    existing_address=$(eval echo "\$$env_var")
    if [[ -n "$existing_address" && "$existing_address" != "" && "$existing_address" != "0x0" ]]; then
        log_warning "$name (already deployed): $existing_address" >&2
        echo "$existing_address"
        return 0
    fi

    log_info "Deploying $name..." >&2

    for attempt in $(seq 1 $max_retries); do
        local output
        set +e
        if [[ ${#calldata[@]} -eq 0 ]]; then
            output=$(sncast -a deployer -f "$ACCOUNTS_FILE" deploy -u "$STARKNET_RPC_URL" -g "$class_hash" 2>&1)
        else
            output=$(sncast -a deployer -f "$ACCOUNTS_FILE" deploy -u "$STARKNET_RPC_URL" -g "$class_hash" -c "${calldata[@]}" 2>&1)
        fi
        local status=$?
        set -e

        # Check for nonce error - retry after delay
        if echo "$output" | grep -qi "invalid transaction nonce\|nonce"; then
            if [[ $attempt -lt $max_retries ]]; then
                log_warning "$name nonce error, retrying in ${retry_delay}s... (attempt $attempt/$max_retries)" >&2
                sleep "$retry_delay"
                continue
            fi
        fi

        local address
        address=$(echo "$output" | grep -oE 'contract_address: 0x[a-fA-F0-9]+' | grep -oE '0x[a-fA-F0-9]+' | head -1)

        if [[ -z "$address" ]]; then
            address=$(echo "$output" | grep -oE '0x[a-fA-F0-9]{64}' | head -1)
        fi

        if [[ -n "$address" ]]; then
            update_env "$env_var" "$address"
            log_success "$name: $address" >&2
            # Wait for transaction to be confirmed
            sleep "$TX_DELAY"
            echo "$address"
            return 0
        fi

        # If we get here on last attempt, it's a real error
        if [[ $attempt -eq $max_retries ]]; then
            log_error "Failed to deploy $name after $max_retries attempts" >&2
            echo "$output" >&2
            exit 1
        fi

        # Unknown error, retry
        log_warning "$name failed, retrying in ${retry_delay}s... (attempt $attempt/$max_retries)" >&2
        sleep "$retry_delay"
    done
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
    local max_retries=3
    local retry_delay=10

    for attempt in $(seq 1 $max_retries); do
        local output
        set +e
        if [[ ${#calldata[@]} -eq 0 ]]; then
            output=$(sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" -d "$contract_address" -f "$function" 2>&1)
        else
            output=$(sncast -a deployer -f "$ACCOUNTS_FILE" invoke -u "$STARKNET_RPC_URL" -d "$contract_address" -f "$function" -c "${calldata[@]}" 2>&1)
        fi
        local status=$?
        set -e

        # Check for nonce error - retry after delay
        if echo "$output" | grep -qi "invalid transaction nonce\|nonce"; then
            if [[ $attempt -lt $max_retries ]]; then
                log_warning "$function nonce error, retrying in ${retry_delay}s... (attempt $attempt/$max_retries)"
                sleep "$retry_delay"
                continue
            fi
        fi

        if [[ $status -eq 0 ]]; then
            # Wait for transaction to be confirmed
            sleep "$TX_DELAY"
            return 0
        fi

        # If we get here on last attempt, it's a real error
        if [[ $attempt -eq $max_retries ]]; then
            log_error "Failed to invoke $function after $max_retries attempts"
            echo "$output" >&2
            return 1
        fi

        # Unknown error, retry
        log_warning "$function failed, retrying in ${retry_delay}s... (attempt $attempt/$max_retries)"
        sleep "$retry_delay"
    done
}

# -----------------------------------------------------------------------------
# Deploy Core Infrastructure
# -----------------------------------------------------------------------------

log_info "Deploying core infrastructure..."

# Factory: constructor(owner, yt_class_hash, pt_class_hash, treasury)
FACTORY_ADDRESS=$(deploy_contract "$FACTORY_CLASS_HASH" "Factory" "FACTORY_ADDRESS" \
    "$DEPLOYER_ADDRESS" "$YT_CLASS_HASH" "$PT_CLASS_HASH" "$TREASURY_ADDRESS")

# MarketFactory: constructor(owner, market_class_hash, yield_contract_factory)
MARKET_FACTORY_ADDRESS=$(deploy_contract "$MARKET_FACTORY_CLASS_HASH" "MarketFactory" "MARKET_FACTORY_ADDRESS" \
    "$DEPLOYER_ADDRESS" "$MARKET_CLASS_HASH" "$FACTORY_ADDRESS")

# Router: constructor(owner)
ROUTER_ADDRESS=$(deploy_contract "$ROUTER_CLASS_HASH" "Router" "ROUTER_ADDRESS" \
    "$DEPLOYER_ADDRESS")

# RouterStatic: constructor()
ROUTER_STATIC_ADDRESS=$(deploy_contract "$ROUTER_STATIC_CLASS_HASH" "RouterStatic" "ROUTER_STATIC_ADDRESS")

# PyLpOracle: constructor()
PY_LP_ORACLE_ADDRESS=$(deploy_contract "$PY_LP_ORACLE_CLASS_HASH" "PyLpOracle" "PY_LP_ORACLE_ADDRESS")

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

log_success "hrzSTRK deployed: $HRZ_STRK_ADDRESS"

# -----------------------------------------------------------------------------
# Deploy Faucet for hrzSTRK
# -----------------------------------------------------------------------------

log_info "Deploying Faucet for hrzSTRK..."

# Faucet: constructor(token: ContractAddress, owner: ContractAddress)
FAUCET_ADDRESS=$(deploy_contract "$FAUCET_CLASS_HASH" "Faucet" "FAUCET_ADDRESS" \
    "$HRZ_STRK_ADDRESS" \
    "$DEPLOYER_ADDRESS")

log_success "Faucet deployed: $FAUCET_ADDRESS"

# Add Faucet as authorized minter for hrzSTRK
log_info "Adding Faucet as authorized minter for hrzSTRK..."
invoke_contract "$HRZ_STRK_ADDRESS" add_minter "$FAUCET_ADDRESS"
log_success "Faucet added as authorized minter"

# -----------------------------------------------------------------------------
# Mint 1M hrzSTRK to TEST_RECIPIENT
# -----------------------------------------------------------------------------

if [[ -n "$TEST_RECIPIENT" && "$TEST_RECIPIENT" != "" ]]; then
    log_info "Minting 1,000,000 hrzSTRK to TEST_RECIPIENT..."
    # 1M tokens = 1000000 * 10^18 = 0xd3c21bcecceda1000000
    MINT_AMOUNT_1M="0xd3c21bcecceda1000000"
    invoke_contract "$HRZ_STRK_ADDRESS" mint_shares "$TEST_RECIPIENT" "$MINT_AMOUNT_1M" 0x0
    log_success "Minted 1M hrzSTRK to $TEST_RECIPIENT"
fi

# -----------------------------------------------------------------------------
# Deploy SY-hrzSTRK
# -----------------------------------------------------------------------------

log_info "Deploying SY-hrzSTRK..."

# SY: constructor(name, symbol, underlying, index_oracle, is_erc4626, asset_type, pauser, tokens_in, tokens_out)
# "SY Horizon Mock Staked STRK" = 27 chars = 0x1b
# "SY-hrzSTRK" = 10 chars = 0xa
SY_HRZ_STRK_ADDRESS=$(deploy_contract "$SY_CLASS_HASH" "SY-hrzSTRK" "SY_HRZ_STRK_ADDRESS" \
    0x0 0x535920486f72697a6f6e204d6f636b205374616b6564205354524b 0x1b \
    0x0 0x53592d68727a5354524b 0xa \
    "$HRZ_STRK_ADDRESS" \
    "$HRZ_STRK_ADDRESS" \
    0x1 \
    0x0 \
    "$DEPLOYER_ADDRESS" \
    0x1 "$HRZ_STRK_ADDRESS" \
    0x1 "$HRZ_STRK_ADDRESS")

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
RESERVE_FEE_PERCENT="${MARKET_RESERVE_FEE_PERCENT:-0}"

if [[ -n "$MARKET_HRZ_STRK_ADDRESS" && "$MARKET_HRZ_STRK_ADDRESS" != "" && "$MARKET_HRZ_STRK_ADDRESS" != "0x0" ]]; then
    log_warning "Market for hrzSTRK already exists: $MARKET_HRZ_STRK_ADDRESS"
else
    log_info "Creating Market (anchor: $ANCHOR_HRZ_STRK)..."
    invoke_contract "$MARKET_FACTORY_ADDRESS" create_market \
        "$PT_HRZ_STRK_ADDRESS" \
        "$SCALAR_ROOT_HEX" 0x0 \
        "$ANCHOR_HEX" 0x0 \
        "$FEE_RATE_HEX" 0x0 \
        "$RESERVE_FEE_PERCENT" \
        0x0

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

# Step 2: Approve SY to spend hrzSTRK
log_info "Step 2: Approving SY to spend hrzSTRK..."
invoke_contract "$HRZ_STRK_ADDRESS" approve "$SY_HRZ_STRK_ADDRESS" "$LIQUIDITY_HEX" 0x0

# Step 3: Deposit hrzSTRK to get SY
log_info "Step 3: Depositing hrzSTRK to get SY..."
invoke_contract "$SY_HRZ_STRK_ADDRESS" deposit "$DEPLOYER_ADDRESS" "$HRZ_STRK_ADDRESS" "$LIQUIDITY_HEX" 0x0

# Step 4: Transfer floating SY to YT
log_info "Step 4: Transferring SY to YT..."
invoke_contract "$SY_HRZ_STRK_ADDRESS" transfer "$YT_HRZ_STRK_ADDRESS" "$HALF_HEX" 0x0

# Step 5: Mint PT+YT from floating SY (use half for PT+YT)
log_info "Step 5: Minting PT+YT from floating SY..."
invoke_contract "$YT_HRZ_STRK_ADDRESS" mint_py "$DEPLOYER_ADDRESS" "$DEPLOYER_ADDRESS"

# Step 6: Approve Market to spend SY
log_info "Step 6: Approving Market to spend SY..."
invoke_contract "$SY_HRZ_STRK_ADDRESS" approve "$MARKET_HRZ_STRK_ADDRESS" "$HALF_HEX" 0x0

# Step 7: Approve Market to spend PT
log_info "Step 7: Approving Market to spend PT..."
invoke_contract "$PT_HRZ_STRK_ADDRESS" approve "$MARKET_HRZ_STRK_ADDRESS" "$HALF_HEX" 0x0

# Step 8: Add liquidity to market (SY + PT -> LP)
log_info "Step 8: Adding liquidity to market..."
invoke_contract "$MARKET_HRZ_STRK_ADDRESS" mint \
    "$DEPLOYER_ADDRESS" "$HALF_HEX" 0x0 "$HALF_HEX" 0x0

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
    "PyLpOracle": "$PY_LP_ORACLE_CLASS_HASH",
    "RouterStatic": "$ROUTER_STATIC_CLASS_HASH",
    "SY": "$SY_CLASS_HASH",
    "SYWithRewards": "$SY_WITH_REWARDS_CLASS_HASH",
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
    "RouterStatic": "$ROUTER_STATIC_ADDRESS",
    "PyLpOracle": "$PY_LP_ORACLE_ADDRESS",
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
echo "  RouterStatic:   $ROUTER_STATIC_ADDRESS"
echo "  PyLpOracle:     $PY_LP_ORACLE_ADDRESS"
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
