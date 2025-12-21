#!/bin/bash

# =============================================================================
# Horizon Protocol - Declare Classes Script (sncast version)
# =============================================================================
# Usage: ./deploy/scripts/declare.sh [network]
#
# This script only declares contract classes without deploying.
# Useful for preparing deployments or when contracts are already deployed.
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

NETWORK="${1:-devnet}"
ENV_FILE="$ROOT_DIR/.env.$NETWORK"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Declaring Contract Classes${NC}"
echo -e "${BLUE}Network: $NETWORK${NC}"
echo -e "${BLUE}========================================${NC}"

# Helper functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
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

# Load environment
if [[ ! -f "$ENV_FILE" ]]; then
    log_error "Environment file not found: $ENV_FILE"
    exit 1
fi

source "$ENV_FILE"

# Override ACCOUNTS_FILE with absolute path (env file may have relative path)
ACCOUNTS_FILE="$ROOT_DIR/deploy/accounts/$NETWORK.json"

log_info "RPC: $STARKNET_RPC_URL"

# =============================================================================
# Setup Account for sncast
# =============================================================================

if [[ "$NETWORK" == "devnet" ]]; then
    # Fetch predeployed accounts from devnet via JSON-RPC
    log_info "Fetching predeployed accounts from devnet..."

    ACCOUNTS_RESPONSE=$(curl -s -X POST "$STARKNET_RPC_URL" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","id":"1","method":"devnet_getPredeployedAccounts","params":{}}' 2>/dev/null)

    ACCOUNTS_ARRAY=$(echo "$ACCOUNTS_RESPONSE" | jq -r '.result // empty')

    if [[ -z "$ACCOUNTS_ARRAY" || "$ACCOUNTS_ARRAY" == "null" ]]; then
        log_error "Failed to fetch predeployed accounts from devnet"
        echo "$ACCOUNTS_RESPONSE" >&2
        exit 1
    fi

    DEPLOYER_ADDRESS=$(echo "$ACCOUNTS_ARRAY" | jq -r '.[1].address')
    DEPLOYER_PRIVATE_KEY=$(echo "$ACCOUNTS_ARRAY" | jq -r '.[1].private_key')
    DEPLOYER_PUBLIC_KEY=$(echo "$ACCOUNTS_ARRAY" | jq -r '.[1].public_key')
    ACCOUNT_CLASS_HASH=$(echo "$ACCOUNTS_ARRAY" | jq -r '.[1].class_hash // "0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f"')

    if [[ -z "$DEPLOYER_ADDRESS" || "$DEPLOYER_ADDRESS" == "null" ]]; then
        log_error "Could not parse deployer address from devnet response"
        exit 1
    fi
elif [[ "$NETWORK" == "sepolia" ]]; then
    # Use deployer credentials from environment file
    log_info "Using deployer credentials from $ENV_FILE..."

    if [[ -z "$DEPLOYER_ADDRESS" || -z "$DEPLOYER_PRIVATE_KEY" ]]; then
        log_error "DEPLOYER_ADDRESS and DEPLOYER_PRIVATE_KEY must be set in $ENV_FILE for Sepolia"
        exit 1
    fi

    DEPLOYER_PUBLIC_KEY="0x0"
    ACCOUNT_CLASS_HASH="0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f"
elif [[ "$NETWORK" == "mainnet" ]]; then
    # Use deployer credentials from environment file
    log_info "Using deployer credentials from $ENV_FILE..."

    if [[ -z "$DEPLOYER_ADDRESS" || -z "$DEPLOYER_PRIVATE_KEY" ]]; then
        log_error "DEPLOYER_ADDRESS and DEPLOYER_PRIVATE_KEY must be set in $ENV_FILE for Mainnet"
        exit 1
    fi

    DEPLOYER_PUBLIC_KEY="0x0"
    # Braavos account class hash for mainnet
    ACCOUNT_CLASS_HASH="0x03957f9f5a1cbfe918cedc2015c85200ca51a5f7506ecb6de98a5207b759bf8a"
else
    log_error "Network '$NETWORK' not yet configured"
    exit 1
fi

log_info "Deployer address: $DEPLOYER_ADDRESS"

# Create accounts directory if not exists
mkdir -p "$(dirname "$ACCOUNTS_FILE")"

# Create sncast accounts file based on network
if [[ "$NETWORK" == "mainnet" ]]; then
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
else
    cat > "$ACCOUNTS_FILE" << EOF
{
  "alpha-mainnet": {},
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
fi

# Build contracts
log_info "Building contracts..."
cd "$CONTRACTS_DIR"
scarb build
log_success "Contracts built"

# Declare each contract with retry logic for nonce errors
declare_class() {
    local name=$1
    local env_var=$2
    local max_retries=3
    local retry_delay=10

    # Check if already declared (env var is set)
    local existing_hash
    existing_hash=$(eval echo "\$$env_var")
    if [[ -n "$existing_hash" && "$existing_hash" != "" ]]; then
        log_warning "$name (already in env): $existing_hash"
        return 0
    fi

    log_info "Declaring $name..."

    for attempt in $(seq 1 $max_retries); do
        local output hash
        set +e
        output=$(sncast -a deployer -f "$ACCOUNTS_FILE" declare -u "$STARKNET_RPC_URL" --package horizon -c "$name" 2>&1)
        local status=$?
        set -e

        # Check if already declared - this is not an error, just skip
        if echo "$output" | grep -qi "already declared\|same class hash"; then
            # Try to get existing class hash from env
            hash=$(eval echo "\$$env_var")
            if [[ -n "$hash" && "$hash" != "" ]]; then
                log_warning "$name (already declared): $hash"
            else
                # Extract class hash from error message if possible
                hash=$(echo "$output" | grep -oE '0x[a-fA-F0-9]{64}' | head -1)
                if [[ -n "$hash" ]]; then
                    update_env "$env_var" "$hash"
                    log_warning "$name (already declared): $hash"
                else
                    log_warning "$name already declared (hash in env)"
                fi
            fi
            return 0
        fi

        # Check for nonce error - retry after delay
        if echo "$output" | grep -qi "invalid transaction nonce\|nonce"; then
            if [[ $attempt -lt $max_retries ]]; then
                log_warning "$name nonce error, retrying in ${retry_delay}s... (attempt $attempt/$max_retries)"
                sleep "$retry_delay"
                continue
            fi
        fi

        # Extract class hash from output
        hash=$(echo "$output" | grep -oE 'class_hash: 0x[a-fA-F0-9]+' | grep -oE '0x[a-fA-F0-9]+' | head -1)

        if [[ -z "$hash" ]]; then
            hash=$(echo "$output" | grep -oE '0x[a-fA-F0-9]{64}' | head -1)
        fi

        if [[ -n "$hash" ]]; then
            update_env "$env_var" "$hash"
            log_success "$name: $hash"
            return 0
        fi

        # If we get here on last attempt, it's a real error
        if [[ $attempt -eq $max_retries ]]; then
            log_error "Failed to declare $name after $max_retries attempts"
            echo "$output" >&2
            return 1
        fi

        # Unknown error, retry
        log_warning "$name failed, retrying in ${retry_delay}s... (attempt $attempt/$max_retries)"
        sleep "$retry_delay"
    done
}

# Delay between transactions (seconds) - needed to avoid nonce errors on Sepolia
TX_DELAY="${TX_DELAY:-10}"

# Declare all contracts with delays between each
declare_class "MockERC20" "MOCK_ERC20_CLASS_HASH"
sleep "$TX_DELAY"
declare_class "MockYieldToken" "MOCK_YIELD_TOKEN_CLASS_HASH"
sleep "$TX_DELAY"
declare_class "Faucet" "FAUCET_CLASS_HASH"
sleep "$TX_DELAY"
declare_class "SY" "SY_CLASS_HASH"
sleep "$TX_DELAY"
declare_class "PT" "PT_CLASS_HASH"
sleep "$TX_DELAY"
declare_class "YT" "YT_CLASS_HASH"
sleep "$TX_DELAY"
declare_class "Market" "MARKET_CLASS_HASH"
sleep "$TX_DELAY"
declare_class "Factory" "FACTORY_CLASS_HASH"
sleep "$TX_DELAY"
declare_class "MarketFactory" "MARKET_FACTORY_CLASS_HASH"
sleep "$TX_DELAY"
declare_class "Router" "ROUTER_CLASS_HASH"

echo ""
log_success "All classes declared. Class hashes saved to $ENV_FILE"
