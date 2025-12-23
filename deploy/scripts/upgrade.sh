#!/bin/bash

# =============================================================================
# Horizon Protocol - Contract Upgrade Script
# =============================================================================
# Usage: ./deploy/scripts/upgrade.sh [network] [options]
#   network: devnet (default) | sepolia | mainnet
#
# Options:
#   --dry-run     Show what would be upgraded without executing
#   --contract    Upgrade only a specific contract type (e.g., --contract Router)
#   --help        Show this help message
#
# This script:
#   1. Builds contracts with scarb build
#   2. Calculates new class hashes for compiled contracts
#   3. Compares with existing class hashes in .env.<network>
#   4. If different, declares the new class and upgrades all deployed instances
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"

# Defaults
NETWORK="devnet"
DRY_RUN=false
SKIP_CONFIRM=false
SPECIFIC_CONTRACT=""
TX_DELAY=8

# =============================================================================
# Usage
# =============================================================================

usage() {
    echo -e "${CYAN}Horizon Protocol - Contract Upgrade Script${NC}"
    echo ""
    echo -e "${YELLOW}Description:${NC}"
    echo "  Upgrades deployed contracts to new implementations."
    echo "  Compares compiled class hashes with deployed ones and upgrades if different."
    echo ""
    echo -e "${YELLOW}Usage:${NC}"
    echo "  $0 [network] [options]"
    echo ""
    echo -e "${YELLOW}Networks:${NC}"
    echo "  devnet      Local development network (default)"
    echo "  sepolia     Starknet Sepolia testnet"
    echo "  mainnet     Starknet mainnet"
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo "  --dry-run         Show what would be upgraded without executing"
    echo "  --contract NAME   Upgrade only a specific contract type"
    echo "  --yes, -y         Skip confirmation prompts (use with caution!)"
    echo "  --help, -h        Show this help message"
    echo ""
    echo -e "${YELLOW}Upgradeable Contracts:${NC}"
    echo "  Factory, MarketFactory, Router, SY, PT, YT, Market"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  $0 devnet                        # Upgrade all contracts on devnet (interactive)"
    echo "  $0 sepolia --dry-run             # Preview what would be upgraded on sepolia"
    echo "  $0 mainnet --contract Router     # Upgrade only Router on mainnet"
    echo "  $0 devnet --yes                  # Upgrade all on devnet, skip confirmations"
    echo "  $0 sepolia --contract SY         # Upgrade all SY instances on sepolia"
    echo ""
    echo -e "${YELLOW}Workflow:${NC}"
    echo "  1. Builds contracts with 'scarb build'"
    echo "  2. Calculates new class hash using 'sncast utils class-hash'"
    echo "  3. Compares with existing class hash in .env.<network>"
    echo "  4. If different, declares new class and calls upgrade() on each instance"
    echo "  5. Updates .env.<network> with new class hash"
    echo ""
    echo -e "${YELLOW}Safety:${NC}"
    echo "  - Each upgrade requires confirmation (unless --yes is used)"
    echo "  - On mainnet with --yes, you must type 'MAINNET' to proceed"
    echo "  - Use --dry-run first to preview changes"
    echo ""
    echo -e "${YELLOW}Account Configuration:${NC}"
    echo "  devnet:   Uses sncast's built-in devnet-2 predeployed account"
    echo "  sepolia:  Uses deploy/accounts/sepolia.json"
    echo "  mainnet:  Uses deploy/accounts/mainnet.json"
    echo ""
}

# =============================================================================
# Parse Arguments
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            usage
            exit 0
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --yes|-y)
            SKIP_CONFIRM=true
            shift
            ;;
        --contract)
            SPECIFIC_CONTRACT="$2"
            shift 2
            ;;
        devnet|sepolia|mainnet)
            NETWORK="$1"
            shift
            ;;
        -*)
            echo -e "${RED}Error: Unknown option $1${NC}"
            usage
            exit 1
            ;;
        *)
            echo -e "${RED}Error: Unknown argument $1${NC}"
            usage
            exit 1
            ;;
    esac
done

# =============================================================================
# Helper Functions
# =============================================================================

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_dry() { echo -e "${CYAN}[DRY-RUN]${NC} $1"; }

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

# Normalize class hash to lowercase for comparison
normalize_hash() {
    echo "$1" | tr '[:upper:]' '[:lower:]'
}

# =============================================================================
# Load Environment
# =============================================================================

ENV_FILE="$ROOT_DIR/.env.$NETWORK"

if [[ ! -f "$ENV_FILE" ]]; then
    log_error "Environment file not found: $ENV_FILE"
    exit 1
fi

source "$ENV_FILE"

# Set ACCOUNTS_FILE after sourcing env (env might have relative path that would override)
ACCOUNTS_FILE="$ROOT_DIR/deploy/accounts/$NETWORK.json"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Horizon Protocol Contract Upgrade${NC}"
echo -e "${BLUE}Network: $NETWORK${NC}"
if [[ "$DRY_RUN" == true ]]; then
    echo -e "${CYAN}Mode: DRY RUN${NC}"
fi
if [[ -n "$SPECIFIC_CONTRACT" ]]; then
    echo -e "${CYAN}Contract: $SPECIFIC_CONTRACT only${NC}"
fi
if [[ "$SKIP_CONFIRM" == true ]]; then
    echo -e "${RED}Mode: AUTO-CONFIRM (--yes)${NC}"
    if [[ "$NETWORK" == "mainnet" ]]; then
        echo ""
        echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ⚠️  WARNING: Running with --yes on MAINNET is dangerous!       ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        read -p "Are you absolutely sure you want to proceed? Type 'MAINNET' to confirm: " mainnet_confirm
        if [[ "$mainnet_confirm" != "MAINNET" ]]; then
            log_error "Aborted. Did not confirm mainnet auto-upgrade."
            exit 1
        fi
    fi
fi
echo -e "${BLUE}========================================${NC}"

log_info "RPC: $STARKNET_RPC_URL"

# =============================================================================
# Setup Account for sncast
# =============================================================================

# Build sncast common arguments based on network
if [[ "$NETWORK" == "devnet" ]]; then
    # For devnet, use sncast's built-in devnet detection and predeployed accounts
    # --network devnet auto-detects running devnet (including Docker)
    # --account devnet-2 uses predeployed account #2 (index 1, as #1 is reserved for test user)
    log_info "Using sncast devnet auto-detection with predeployed account devnet-2"
    SNCAST_ACCOUNT_ARGS="--account devnet-2 --network devnet"
    SNCAST_URL_ARGS=""  # Not needed for devnet, --network devnet handles it

elif [[ "$NETWORK" == "sepolia" || "$NETWORK" == "mainnet" ]]; then
    # For sepolia/mainnet, use existing account files
    if [[ ! -f "$ACCOUNTS_FILE" ]]; then
        log_error "Account file not found: $ACCOUNTS_FILE"
        log_error "Please ensure deploy/accounts/$NETWORK.json exists with deployer credentials"
        exit 1
    fi

    log_info "Using existing account file: $ACCOUNTS_FILE"

    # Extract deployer address from the account file for logging
    if [[ "$NETWORK" == "mainnet" ]]; then
        DEPLOYER_ADDRESS=$(jq -r '.["alpha-mainnet"].deployer.address // empty' "$ACCOUNTS_FILE")
    else
        DEPLOYER_ADDRESS=$(jq -r '.["alpha-sepolia"].deployer.address // empty' "$ACCOUNTS_FILE")
    fi

    if [[ -z "$DEPLOYER_ADDRESS" || "$DEPLOYER_ADDRESS" == "null" ]]; then
        log_error "No deployer account found in $ACCOUNTS_FILE"
        exit 1
    fi

    log_info "Deployer address: $DEPLOYER_ADDRESS"
    # Account args go before subcommand, URL goes after subcommand
    # Use absolute path for accounts file
    SNCAST_ACCOUNT_ARGS="-a deployer -f $ACCOUNTS_FILE"
    SNCAST_URL_ARGS="--url $STARKNET_RPC_URL"
else
    log_error "Network '$NETWORK' not supported"
    exit 1
fi

# =============================================================================
# Build Contracts
# =============================================================================

log_info "Building contracts..."
cd "$CONTRACTS_DIR"
scarb build
log_success "Contracts built"

# =============================================================================
# Calculate New Class Hashes
# =============================================================================

get_new_class_hash() {
    local contract_name=$1
    local output

    output=$(sncast utils class-hash --contract-name "$contract_name" 2>&1)

    # Extract class hash from output
    local hash
    hash=$(echo "$output" | grep -oE '0x[a-fA-F0-9]+' | head -1)

    if [[ -z "$hash" ]]; then
        log_error "Failed to calculate class hash for $contract_name"
        echo "$output" >&2
        return 1
    fi

    echo "$hash"
}

# =============================================================================
# Declare New Class (if needed)
# =============================================================================

declare_class() {
    local name=$1
    local new_hash=$2

    if [[ "$DRY_RUN" == true ]]; then
        log_dry "Would declare $name with class hash: $new_hash"
        return 0
    fi

    log_info "Declaring $name..."

    local output
    set +e
    output=$(sncast $SNCAST_ACCOUNT_ARGS declare $SNCAST_URL_ARGS --package horizon -c "$name" 2>&1)
    local status=$?
    set -e

    # Check if already declared
    if echo "$output" | grep -qi "already declared\|same class hash"; then
        log_warning "$name already declared"
        return 0
    fi

    if [[ $status -ne 0 ]]; then
        log_error "Failed to declare $name"
        echo "$output" >&2
        return 1
    fi

    log_success "$name declared: $new_hash"
    sleep "$TX_DELAY"
}

# =============================================================================
# Upgrade Contract Instance
# =============================================================================

upgrade_contract() {
    local contract_address=$1
    local new_class_hash=$2
    local contract_name=$3
    local declared_contract_name=$4  # Contract type name for declaration (e.g., "SY", "Market")

    if [[ -z "$contract_address" || "$contract_address" == "" || "$contract_address" == "0x0" ]]; then
        log_warning "Skipping $contract_name - no address found"
        return 1  # Return failure so env isn't updated
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_dry "Would upgrade $contract_name at $contract_address to $new_class_hash"
        return 0
    fi

    # Confirmation prompt before upgrade (unless --yes flag is set)
    if [[ "$SKIP_CONFIRM" != true ]]; then
        echo ""
        echo -e "${YELLOW}┌─────────────────────────────────────────────────────────────────────────────┐${NC}"
        echo -e "${YELLOW}│                         ⚠️  UPGRADE CONFIRMATION                            │${NC}"
        echo -e "${YELLOW}├─────────────────────────────────────────────────────────────────────────────┘${NC}"
        echo -e "${YELLOW}│${NC} Network:    ${CYAN}$NETWORK${NC}"
        echo -e "${YELLOW}│${NC} Contract:   ${CYAN}$contract_name${NC}"
        echo -e "${YELLOW}│${NC} Address:    ${CYAN}$contract_address${NC}"
        echo -e "${YELLOW}│${NC} New Class:  ${CYAN}$new_class_hash${NC}"
        echo -e "${YELLOW}└──${NC}"
        echo ""
        echo -e "This action will ${RED}permanently upgrade${NC} the contract implementation."
        echo ""
        read -p "Proceed with upgrade? [y/N/a(bort all)]: " confirm

        case "$confirm" in
            [yY]|[yY][eE][sS])
                ;;
            [aA]|[aA][bB][oO][rR][tT])
                log_error "Upgrade aborted by user"
                exit 1
                ;;
            *)
                log_warning "Skipped upgrade of $contract_name at $contract_address"
                return 0
                ;;
        esac
    fi

    # Declare the new class AFTER confirmation to avoid unnecessary declaration costs
    if ! declare_class "$declared_contract_name" "$new_class_hash"; then
        log_error "Failed to declare new class, cannot upgrade"
        return 1
    fi

    log_info "Upgrading $contract_name at $contract_address..."

    local output
    set +e
    output=$(sncast $SNCAST_ACCOUNT_ARGS invoke $SNCAST_URL_ARGS \
        -d "$contract_address" \
        -f "upgrade" \
        -c "$new_class_hash" 2>&1)
    local status=$?
    set -e

    if [[ $status -ne 0 ]]; then
        log_error "Failed to upgrade $contract_name at $contract_address"
        echo "$output" >&2
        return 1
    fi

    # Show full invoke response for verification
    echo ""
    echo -e "${CYAN}Invoke response:${NC}"
    echo "$output"
    echo ""

    # Extract and display transaction hash if present
    local tx_hash
    tx_hash=$(echo "$output" | grep -oE 'transaction_hash: 0x[a-fA-F0-9]+' | grep -oE '0x[a-fA-F0-9]+' || true)
    if [[ -n "$tx_hash" ]]; then
        log_success "Upgraded $contract_name at $contract_address"
        log_info "Transaction hash: $tx_hash"
    else
        log_success "Upgraded $contract_name at $contract_address"
    fi

    sleep "$TX_DELAY"
}

# =============================================================================
# Process Upgradeable Contracts
# =============================================================================

# Define upgradeable contracts with their env var patterns
# Format: "ContractName:ENV_CLASS_HASH_VAR:INSTANCE_ADDRESSES..."
# Note: Include all possible addresses across networks (missing ones will be skipped)
declare -a UPGRADEABLE_CONTRACTS=(
    "Factory:FACTORY_CLASS_HASH:FACTORY_ADDRESS"
    "MarketFactory:MARKET_FACTORY_CLASS_HASH:MARKET_FACTORY_ADDRESS"
    "Router:ROUTER_CLASS_HASH:ROUTER_ADDRESS"
    "SY:SY_CLASS_HASH:SY_NST_STRK_ADDRESS,SY_SSTRK_ADDRESS,SY_WSTETH_ADDRESS,SY_HRZ_STRK_ADDRESS"
    "PT:PT_CLASS_HASH:PT_NST_STRK_ADDRESS,PT_SSTRK_ADDRESS,PT_WSTETH_ADDRESS,PT_HRZ_STRK_ADDRESS"
    "YT:YT_CLASS_HASH:YT_NST_STRK_ADDRESS,YT_SSTRK_ADDRESS,YT_WSTETH_ADDRESS,YT_HRZ_STRK_ADDRESS"
    "Market:MARKET_CLASS_HASH:MARKET_NST_STRK_ADDRESS,MARKET_SSTRK_ADDRESS,MARKET_WSTETH_ADDRESS,MARKET_HRZ_STRK_ADDRESS"
)

UPGRADES_NEEDED=0
UPGRADES_PERFORMED=0
UPGRADES_SKIPPED=0

echo ""
log_info "Checking for upgrades..."
echo ""

for contract_def in "${UPGRADEABLE_CONTRACTS[@]}"; do
    # Parse contract definition
    IFS=':' read -r contract_name class_hash_var instance_addresses <<< "$contract_def"

    # Skip if specific contract requested and this isn't it
    if [[ -n "$SPECIFIC_CONTRACT" && "$contract_name" != "$SPECIFIC_CONTRACT" ]]; then
        continue
    fi

    # Get current class hash from env
    current_hash=$(eval echo "\$$class_hash_var")

    if [[ -z "$current_hash" || "$current_hash" == "" ]]; then
        log_warning "No current class hash for $contract_name ($class_hash_var), skipping"
        continue
    fi

    # Calculate new class hash
    log_info "Checking $contract_name..."
    new_hash=$(get_new_class_hash "$contract_name")

    if [[ $? -ne 0 ]]; then
        log_error "Failed to get new class hash for $contract_name"
        continue
    fi

    # Normalize hashes for comparison
    current_normalized=$(normalize_hash "$current_hash")
    new_normalized=$(normalize_hash "$new_hash")

    # Compare hashes
    if [[ "$current_normalized" == "$new_normalized" ]]; then
        log_success "$contract_name is up to date (class hash: $new_hash)"
        ((UPGRADES_SKIPPED++))
        continue
    fi

    ((UPGRADES_NEEDED++))

    echo ""
    echo -e "${YELLOW}$contract_name needs upgrade:${NC}"
    echo -e "  Current: ${RED}$current_hash${NC}"
    echo -e "  New:     ${GREEN}$new_hash${NC}"
    echo ""

    # Upgrade all instances (declaration happens after confirmation, inside upgrade_contract)
    env_updated=false
    IFS=',' read -ra addresses <<< "$instance_addresses"
    for addr_var in "${addresses[@]}"; do
        addr=$(eval echo "\$$addr_var")

        if upgrade_contract "$addr" "$new_hash" "$contract_name ($addr_var)" "$contract_name"; then
            ((UPGRADES_PERFORMED++))

            # Update env file immediately after each successful upgrade
            # This ensures progress is saved even if script is interrupted
            if [[ "$env_updated" != true && "$DRY_RUN" != true ]]; then
                update_env "$class_hash_var" "$new_hash"
                log_success "Updated $class_hash_var in $ENV_FILE"
                env_updated=true
            fi
        fi
    done

    echo ""
done

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Upgrade Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Network:                      $NETWORK"
echo "Classes checked:              ${#UPGRADEABLE_CONTRACTS[@]}"
echo "Already up to date:           $UPGRADES_SKIPPED"
echo "Classes needing upgrade:      $UPGRADES_NEEDED"

if [[ "$DRY_RUN" == true ]]; then
    echo -e "Contract upgrades performed:  ${CYAN}0 (dry run)${NC}"
else
    echo "Contract upgrades performed:  $UPGRADES_PERFORMED"
fi

echo ""

if [[ "$UPGRADES_NEEDED" -eq 0 ]]; then
    log_success "All contracts are up to date!"
elif [[ "$DRY_RUN" == true ]]; then
    log_info "Run without --dry-run to perform upgrades"
else
    log_success "Upgrade complete!"
fi

echo ""
