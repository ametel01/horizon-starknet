#!/bin/bash

# =============================================================================
# Horizon Protocol - Declare Classes Script
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
BUILD_DIR="$CONTRACTS_DIR/target/dev"

NETWORK="${1:-katana}"
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
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
        else
            sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
        fi
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

# Build contracts
log_info "Building contracts..."
cd "$CONTRACTS_DIR"
scarb build
log_success "Contracts built"

# Declare each contract
declare_class() {
    local name=$1
    local env_var=$2
    local file="$BUILD_DIR/yield_tokenization_${name}.contract_class.json"

    if [[ ! -f "$file" ]]; then
        log_error "Contract file not found: $file"
        return 1
    fi

    log_info "Declaring $name..."

    local output
    output=$(starkli declare "$file" \
        --rpc "$STARKNET_RPC_URL" \
        --account "$DEPLOYER_ADDRESS" \
        --private-key "$DEPLOYER_PRIVATE_KEY" \
        2>&1) || {
            if echo "$output" | grep -q "already declared"; then
                log_warning "$name already declared"
                # Extract class hash from error or env
                local hash
                hash=$(echo "$output" | grep -oE '0x[a-fA-F0-9]{64}' | head -1)
                if [[ -z "$hash" ]]; then
                    hash=$(eval echo "\$$env_var")
                fi
                if [[ -n "$hash" ]]; then
                    log_success "$name: $hash"
                    return 0
                fi
            fi
            log_error "Failed: $output"
            return 1
        }

    local hash
    hash=$(echo "$output" | grep -oE '0x[a-fA-F0-9]{64}' | head -1)
    update_env "$env_var" "$hash"
    log_success "$name: $hash"
}

# Declare all contracts
declare_class "MockYieldToken" "MOCK_YIELD_TOKEN_CLASS_HASH"
declare_class "SY" "SY_CLASS_HASH"
declare_class "PT" "PT_CLASS_HASH"
declare_class "YT" "YT_CLASS_HASH"
declare_class "Market" "MARKET_CLASS_HASH"
declare_class "Factory" "FACTORY_CLASS_HASH"
declare_class "MarketFactory" "MARKET_FACTORY_CLASS_HASH"
declare_class "Router" "ROUTER_CLASS_HASH"

echo ""
log_success "All classes declared. Class hashes saved to $ENV_FILE"
