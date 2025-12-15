#!/bin/bash

# =============================================================================
# Horizon Protocol - Deployment Script (sncast version)
# =============================================================================
# Usage: ./deploy/scripts/deploy.sh [network]
#   network: devnet (default) | sepolia | mainnet
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
NETWORK="${1:-devnet}"
ENV_FILE="$ROOT_DIR/.env.$NETWORK"
ACCOUNTS_FILE="$ROOT_DIR/deploy/accounts/$NETWORK.json"

# Test recipient address for minting tokens (predeployed devnet account #0)
# This represents a user account for testing, separate from the deployer
TEST_RECIPIENT="0x064b48806902a367c8598f4F95C305e8c1a1aCbA5f082D294a43793113115691"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Horizon Protocol Deployment (sncast)${NC}"
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

# =============================================================================
# Setup Account for sncast
# =============================================================================

if [[ "$NETWORK" == "devnet" ]]; then
    # Fetch predeployed accounts from devnet via JSON-RPC
    log_info "Fetching predeployed accounts from devnet..."

    ACCOUNTS_RESPONSE=$(curl -s -X POST "$STARKNET_RPC_URL" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","id":"1","method":"devnet_getPredeployedAccounts","params":{}}' 2>/dev/null)

    # Extract result array from JSON-RPC response
    ACCOUNTS_ARRAY=$(echo "$ACCOUNTS_RESPONSE" | jq -r '.result // empty')

    if [[ -z "$ACCOUNTS_ARRAY" || "$ACCOUNTS_ARRAY" == "null" ]]; then
        log_error "Failed to fetch predeployed accounts from devnet"
        echo "$ACCOUNTS_RESPONSE" >&2
        exit 1
    fi

    # Extract second account as deployer (account #1) - used for deployments and seed liquidity
    # Account #0 is reserved as the test user
    DEPLOYER_ADDRESS=$(echo "$ACCOUNTS_ARRAY" | jq -r '.[1].address')
    DEPLOYER_PRIVATE_KEY=$(echo "$ACCOUNTS_ARRAY" | jq -r '.[1].private_key')
    DEPLOYER_PUBLIC_KEY=$(echo "$ACCOUNTS_ARRAY" | jq -r '.[1].public_key')
    ACCOUNT_CLASS_HASH=$(echo "$ACCOUNTS_ARRAY" | jq -r '.[1].class_hash // "0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f"')

    if [[ -z "$DEPLOYER_ADDRESS" || "$DEPLOYER_ADDRESS" == "null" ]]; then
        log_error "Could not parse deployer address from devnet response (need at least 2 predeployed accounts)"
        echo "$ACCOUNTS_RESPONSE" >&2
        exit 1
    fi
else
    log_error "Non-devnet networks not yet configured for sncast"
    exit 1
fi

log_info "Deployer address: $DEPLOYER_ADDRESS"
log_info "Test recipient:   $TEST_RECIPIENT"

# Create accounts directory if not exists
mkdir -p "$(dirname "$ACCOUNTS_FILE")"

# Create sncast accounts file
# Note: starknet-devnet-rs uses chain ID SN_SEPOLIA, so sncast detects as alpha-sepolia
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

# sncast will use these via command line

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

    # Extract class hash from output (sncast outputs JSON-like format)
    hash=$(echo "$output" | grep -oE 'class_hash: 0x[a-fA-F0-9]+' | grep -oE '0x[a-fA-F0-9]+' | head -1)

    # If not found in that format, try alternative patterns
    if [[ -z "$hash" ]]; then
        hash=$(echo "$output" | grep -oE '0x[a-fA-F0-9]{64}' | head -1)
    fi

    if [[ -n "$hash" ]]; then
        update_env "$env_var" "$hash"
        if [[ $status -eq 0 ]]; then
            log_success "$name: $hash" >&2
        else
            # Check if it's already declared
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

MOCK_ERC20_CLASS_HASH=$(declare_class "MockERC20" "MOCK_ERC20_CLASS_HASH")
MOCK_YIELD_TOKEN_CLASS_HASH=$(declare_class "MockYieldToken" "MOCK_YIELD_TOKEN_CLASS_HASH")
MOCK_PRAGMA_CLASS_HASH=$(declare_class "MockPragmaSummaryStats" "MOCK_PRAGMA_CLASS_HASH")
PRAGMA_INDEX_ORACLE_CLASS_HASH=$(declare_class "PragmaIndexOracle" "PRAGMA_INDEX_ORACLE_CLASS_HASH")
SY_CLASS_HASH=$(declare_class "SY" "SY_CLASS_HASH")
PT_CLASS_HASH=$(declare_class "PT" "PT_CLASS_HASH")
YT_CLASS_HASH=$(declare_class "YT" "YT_CLASS_HASH")
MARKET_CLASS_HASH=$(declare_class "Market" "MARKET_CLASS_HASH")
FACTORY_CLASS_HASH=$(declare_class "Factory" "FACTORY_CLASS_HASH")
MARKET_FACTORY_CLASS_HASH=$(declare_class "MarketFactory" "MARKET_FACTORY_CLASS_HASH")
ROUTER_CLASS_HASH=$(declare_class "Router" "ROUTER_CLASS_HASH")

log_success "All classes declared"

# Wait for block to be mined (devnet mines every 10 seconds)
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
    # Extract contract address from sncast output
    # sncast outputs: "Contract Address: 0x..."
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

# Helper to call a contract and extract result
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

    # Extract the response value (format: "response: [0x...]")
    local result
    result=$(echo "$output" | grep -oE '0x[a-fA-F0-9]+' | head -1)
    echo "$result"
}

# Helper to invoke a contract
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
    # Use Predeployed STRK Token
    # -------------------------------------------------------------------------

    # starknet-devnet-rs has predeployed STRK at this address
    STRK_ADDRESS="0x4718F5A0FC34CC1AF16A1CDEE98FFB20C31F5CD61D6AB07201858F4287C938D"
    update_env "STRK_ADDRESS" "$STRK_ADDRESS"
    log_info "Using predeployed STRK at: $STRK_ADDRESS"

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
    # Deploy Mock Pragma Oracle (for devnet testing)
    # -------------------------------------------------------------------------

    # MockPragmaSummaryStats: constructor(admin, wsteth_base_price, sstrk_base_price, strk_base_price, wsteth_yield_bps, sstrk_yield_bps)
    # WSTETH: $4000 = 400000000000 (8 decimals), 4% APR = 400 bps
    # SSTRK: $0.50 = 50000000 (8 decimals), 8% APR = 800 bps
    # STRK: $0.50 = 50000000 (8 decimals), 0% APR (base token)
    log_info "Deploying MockPragmaSummaryStats..."
    MOCK_PRAGMA_ADDRESS=$(deploy_contract "$MOCK_PRAGMA_CLASS_HASH" "MockPragmaSummaryStats" "MOCK_PRAGMA_ADDRESS" \
        "$DEPLOYER_ADDRESS" \
        0x5d21dba000 \
        0x2faf080 \
        0x2faf080 \
        0x190 \
        0x320)

    # -------------------------------------------------------------------------
    # Deploy PragmaIndexOracle for sSTRK
    # -------------------------------------------------------------------------

    # PragmaIndexOracle: constructor(admin, pragma_oracle, numerator_pair_id, denominator_pair_id, initial_index)
    # For sSTRK: dual-feed mode to calculate sSTRK/STRK exchange rate
    # index = SSTRK/USD price / STRK/USD price = sSTRK/STRK exchange rate
    # SSTRK_USD_PAIR_ID = 1537084272803954643780
    # STRK_USD_PAIR_ID = 6004514686061859652
    # Initial index = 1 WAD = 1000000000000000000 = 0xde0b6b3a7640000
    log_info "Deploying PragmaIndexOracle for sSTRK..."
    PRAGMA_SSTRK_ORACLE_ADDRESS=$(deploy_contract "$PRAGMA_INDEX_ORACLE_CLASS_HASH" "PragmaIndexOracle-sSTRK" "PRAGMA_SSTRK_ORACLE_ADDRESS" \
        "$DEPLOYER_ADDRESS" \
        "$MOCK_PRAGMA_ADDRESS" \
        1537084272803954643780 \
        6004514686061859652 \
        0xde0b6b3a7640000 0x0)

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
    # Deploy SY 2: SY-sSTRK (wraps sSTRK, uses PragmaIndexOracle)
    # -------------------------------------------------------------------------

    # "SY Staked Starknet Token" = 24 chars
    # "SY-sSTRK" = 8 chars
    # Uses PragmaIndexOracle for exchange rate (is_erc4626 = false)
    log_info "Deploying SY-sSTRK..."
    SY_SSTRK_ADDRESS=$(deploy_contract "$SY_CLASS_HASH" "SY-sSTRK" "SY_SSTRK_ADDRESS" \
        0x0 0x5359205374616b656420537461726b6e657420546f6b656e 0x18 \
        0x0 0x53592d735354524b 0x8 \
        "$SSTRK_ADDRESS" \
        "$PRAGMA_SSTRK_ORACLE_ADDRESS" \
        0x0)

    log_success "Yield tokens and SY tokens deployed"

    # -------------------------------------------------------------------------
    # Mint tokens to test recipient
    # -------------------------------------------------------------------------

    log_info "Minting tokens to test recipient: $TEST_RECIPIENT"

    # Note: STRK is predeployed and we can't mint it
    # Predeployed accounts already have STRK balance

    # Mint 100,000 nstSTRK shares
    invoke_contract "$NST_STRK_ADDRESS" mint_shares \
        "$TEST_RECIPIENT" 0x152d02c7e14af6800000 0x0
    log_success "Minted 100,000 nstSTRK"

    # Mint 100,000 sSTRK shares
    invoke_contract "$SSTRK_ADDRESS" mint_shares \
        "$TEST_RECIPIENT" 0x152d02c7e14af6800000 0x0
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
    invoke_contract "$FACTORY_ADDRESS" create_yield_contracts \
        "$SY_NST_STRK_ADDRESS" "$EXPIRY_TIMESTAMP"

    sleep 1
    PT_NST_STRK_ADDRESS=$(call_contract "$FACTORY_ADDRESS" get_pt \
        "$SY_NST_STRK_ADDRESS" "$EXPIRY_TIMESTAMP")
    update_env "PT_NST_STRK_ADDRESS" "$PT_NST_STRK_ADDRESS"
    log_success "PT-nstSTRK: $PT_NST_STRK_ADDRESS"

    YT_NST_STRK_ADDRESS=$(call_contract "$FACTORY_ADDRESS" get_yt \
        "$SY_NST_STRK_ADDRESS" "$EXPIRY_TIMESTAMP")
    update_env "YT_NST_STRK_ADDRESS" "$YT_NST_STRK_ADDRESS"
    log_success "YT-nstSTRK: $YT_NST_STRK_ADDRESS"

    # Create PT/YT for SY-sSTRK
    log_info "Creating PT/YT for SY-sSTRK..."
    invoke_contract "$FACTORY_ADDRESS" create_yield_contracts \
        "$SY_SSTRK_ADDRESS" "$EXPIRY_TIMESTAMP"

    sleep 1
    PT_SSTRK_ADDRESS=$(call_contract "$FACTORY_ADDRESS" get_pt \
        "$SY_SSTRK_ADDRESS" "$EXPIRY_TIMESTAMP")
    update_env "PT_SSTRK_ADDRESS" "$PT_SSTRK_ADDRESS"
    log_success "PT-sSTRK: $PT_SSTRK_ADDRESS"

    YT_SSTRK_ADDRESS=$(call_contract "$FACTORY_ADDRESS" get_yt \
        "$SY_SSTRK_ADDRESS" "$EXPIRY_TIMESTAMP")
    update_env "YT_SSTRK_ADDRESS" "$YT_SSTRK_ADDRESS"
    log_success "YT-sSTRK: $YT_SSTRK_ADDRESS"

    # -------------------------------------------------------------------------
    # Create Markets for both PT tokens
    # -------------------------------------------------------------------------

    log_info "Creating Markets..."

    # Common market parameters
    SCALAR_ROOT="${MARKET_SCALAR_ROOT:-5000000000000000000}"
    FEE_RATE="${MARKET_FEE_RATE:-3000000000000000}"
    DEFAULT_ANCHOR="${MARKET_INITIAL_ANCHOR:-76961041136128000}"  # ~8% APY default

    # Per-market initial anchors (override with MARKET_INITIAL_ANCHOR_<NAME>)
    # Use calc-anchor.sh to calculate: ./deploy/scripts/calc-anchor.sh <apy%>
    ANCHOR_NST_STRK="${MARKET_INITIAL_ANCHOR_NST_STRK:-$DEFAULT_ANCHOR}"
    ANCHOR_SSTRK="${MARKET_INITIAL_ANCHOR_SSTRK:-$DEFAULT_ANCHOR}"

    # Convert common params to hex
    SCALAR_ROOT_HEX=$(printf "0x%x" "$SCALAR_ROOT")
    FEE_RATE_HEX=$(printf "0x%x" "$FEE_RATE")

    # Market for PT-nstSTRK
    if [[ -n "$PT_NST_STRK_ADDRESS" && "$PT_NST_STRK_ADDRESS" != "0x0" ]]; then
        ANCHOR_HEX=$(printf "0x%x" "$ANCHOR_NST_STRK")
        log_info "Creating Market for PT-nstSTRK (anchor: $ANCHOR_NST_STRK)..."
        invoke_contract "$MARKET_FACTORY_ADDRESS" create_market \
            "$PT_NST_STRK_ADDRESS" \
            "$SCALAR_ROOT_HEX" 0x0 \
            "$ANCHOR_HEX" 0x0 \
            "$FEE_RATE_HEX" 0x0

        sleep 1
        MARKET_NST_STRK_ADDRESS=$(call_contract "$MARKET_FACTORY_ADDRESS" get_market \
            "$PT_NST_STRK_ADDRESS")

        if [[ -n "$MARKET_NST_STRK_ADDRESS" && "$MARKET_NST_STRK_ADDRESS" != "0x0" ]]; then
            update_env "MARKET_NST_STRK_ADDRESS" "$MARKET_NST_STRK_ADDRESS"
            log_success "Market-nstSTRK: $MARKET_NST_STRK_ADDRESS"
        else
            log_warning "Market for nstSTRK not created"
        fi
    fi

    # Market for PT-sSTRK
    if [[ -n "$PT_SSTRK_ADDRESS" && "$PT_SSTRK_ADDRESS" != "0x0" ]]; then
        ANCHOR_HEX=$(printf "0x%x" "$ANCHOR_SSTRK")
        log_info "Creating Market for PT-sSTRK (anchor: $ANCHOR_SSTRK)..."
        invoke_contract "$MARKET_FACTORY_ADDRESS" create_market \
            "$PT_SSTRK_ADDRESS" \
            "$SCALAR_ROOT_HEX" 0x0 \
            "$ANCHOR_HEX" 0x0 \
            "$FEE_RATE_HEX" 0x0

        sleep 1
        MARKET_SSTRK_ADDRESS=$(call_contract "$MARKET_FACTORY_ADDRESS" get_market \
            "$PT_SSTRK_ADDRESS")

        if [[ -n "$MARKET_SSTRK_ADDRESS" && "$MARKET_SSTRK_ADDRESS" != "0x0" ]]; then
            update_env "MARKET_SSTRK_ADDRESS" "$MARKET_SSTRK_ADDRESS"
            log_success "Market-sSTRK: $MARKET_SSTRK_ADDRESS"
        else
            log_warning "Market for sSTRK not created"
        fi
    fi

    # -------------------------------------------------------------------------
    # Seed Initial Liquidity (optional, controlled by SEED_LIQUIDITY env var)
    # -------------------------------------------------------------------------

    SEED_LIQUIDITY="${SEED_LIQUIDITY:-true}"
    SEED_AMOUNT="${SEED_LIQUIDITY_AMOUNT:-10000000000000000000000}"  # 10,000 tokens default (18 decimals)

    if [[ "$SEED_LIQUIDITY" == "true" ]]; then
        log_info "Seeding initial liquidity to markets..."

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

        # Calculate hex values for large numbers
        SEED_HEX=$(to_hex "$SEED_AMOUNT")
        HALF_AMOUNT=$(half_of "$SEED_AMOUNT")
        HALF_HEX=$(to_hex "$HALF_AMOUNT")

        log_info "Seed amount: $SEED_AMOUNT ($SEED_HEX)"
        log_info "Half amount: $HALF_AMOUNT ($HALF_HEX)"

        # Helper: Seed liquidity to a single market
        # Flow: YieldToken -> SY -> PT+YT -> Market LP
        seed_market_liquidity() {
            local yield_token=$1
            local sy_token=$2
            local yt_token=$3
            local pt_token=$4
            local market=$5
            local market_name=$6

            log_info "Seeding $market_name market..."

            # Step 1: Mint yield tokens to deployer
            log_info "  Minting yield tokens to deployer..."
            if ! invoke_contract "$yield_token" mint_shares \
                "$DEPLOYER_ADDRESS" "$SEED_HEX" 0x0; then
                log_error "  Failed to mint yield tokens"
                return 1
            fi

            # Step 2: Approve SY to spend yield tokens
            log_info "  Approving SY to spend yield tokens..."
            if ! invoke_contract "$yield_token" approve \
                "$sy_token" "$SEED_HEX" 0x0; then
                log_error "  Failed to approve SY"
                return 1
            fi

            # Step 3: Deposit yield tokens to get SY
            log_info "  Depositing to SY..."
            if ! invoke_contract "$sy_token" deposit \
                "$DEPLOYER_ADDRESS" "$SEED_HEX" 0x0; then
                log_error "  Failed to deposit to SY"
                return 1
            fi

            # Step 4: Approve YT to spend SY (for minting PT+YT)
            log_info "  Approving YT to spend SY..."
            if ! invoke_contract "$sy_token" approve \
                "$yt_token" "$HALF_HEX" 0x0; then
                log_error "  Failed to approve YT"
                return 1
            fi

            # Step 5: Mint PT+YT from SY
            log_info "  Minting PT+YT..."
            if ! invoke_contract "$yt_token" mint_py \
                "$DEPLOYER_ADDRESS" "$HALF_HEX" 0x0; then
                log_error "  Failed to mint PT+YT"
                return 1
            fi

            # Step 6: Approve Market to spend SY and PT
            log_info "  Approving Market to spend SY and PT..."
            if ! invoke_contract "$sy_token" approve \
                "$market" "$HALF_HEX" 0x0; then
                log_error "  Failed to approve Market for SY"
                return 1
            fi
            if ! invoke_contract "$pt_token" approve \
                "$market" "$HALF_HEX" 0x0; then
                log_error "  Failed to approve Market for PT"
                return 1
            fi

            # Step 7: Add liquidity to market (SY + PT -> LP)
            # Market.mint(receiver, sy_desired, pt_desired) returns (lp_minted, sy_used, pt_used)
            log_info "  Adding liquidity to market..."
            if ! invoke_contract "$market" mint \
                "$DEPLOYER_ADDRESS" "$HALF_HEX" 0x0 "$HALF_HEX" 0x0; then
                log_error "  Failed to add liquidity"
                return 1
            fi

            log_success "  $market_name market seeded with liquidity"
        }

        # Seed nstSTRK market
        if [[ -n "$MARKET_NST_STRK_ADDRESS" && "$MARKET_NST_STRK_ADDRESS" != "0x0" ]]; then
            seed_market_liquidity \
                "$NST_STRK_ADDRESS" \
                "$SY_NST_STRK_ADDRESS" \
                "$YT_NST_STRK_ADDRESS" \
                "$PT_NST_STRK_ADDRESS" \
                "$MARKET_NST_STRK_ADDRESS" \
                "nstSTRK"
        fi

        # Seed sSTRK market
        if [[ -n "$MARKET_SSTRK_ADDRESS" && "$MARKET_SSTRK_ADDRESS" != "0x0" ]]; then
            seed_market_liquidity \
                "$SSTRK_ADDRESS" \
                "$SY_SSTRK_ADDRESS" \
                "$YT_SSTRK_ADDRESS" \
                "$PT_SSTRK_ADDRESS" \
                "$MARKET_SSTRK_ADDRESS" \
                "sSTRK"
        fi

        log_success "Initial liquidity seeded"
    else
        log_info "Skipping liquidity seeding (SEED_LIQUIDITY=false)"
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
    "MockPragmaSummaryStats": "$MOCK_PRAGMA_CLASS_HASH",
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
  "testSetup": {
    "testRecipient": "$TEST_RECIPIENT",
    "baseToken": {
      "STRK": "${STRK_ADDRESS:-}"
    },
    "oracles": {
      "MockPragma": "${MOCK_PRAGMA_ADDRESS:-}",
      "sSTRK": "${PRAGMA_SSTRK_ORACLE_ADDRESS:-}"
    },
    "yieldTokens": {
      "nstSTRK": {
        "name": "Nostra Staked STRK",
        "symbol": "nstSTRK",
        "address": "${NST_STRK_ADDRESS:-}",
        "isERC4626": true,
        "oracle": null
      },
      "sSTRK": {
        "name": "Staked Starknet Token",
        "symbol": "sSTRK",
        "address": "${SSTRK_ADDRESS:-}",
        "isERC4626": false,
        "oracle": "${PRAGMA_SSTRK_ORACLE_ADDRESS:-}"
      }
    },
    "syTokens": {
      "SY-nstSTRK": {
        "address": "${SY_NST_STRK_ADDRESS:-}",
        "underlying": "${NST_STRK_ADDRESS:-}",
        "indexOracle": "${NST_STRK_ADDRESS:-}",
        "isERC4626": true
      },
      "SY-sSTRK": {
        "address": "${SY_SSTRK_ADDRESS:-}",
        "underlying": "${SSTRK_ADDRESS:-}",
        "indexOracle": "${PRAGMA_SSTRK_ORACLE_ADDRESS:-}",
        "isERC4626": false
      }
    },
    "markets": {
      "nstSTRK": {
        "PT": "${PT_NST_STRK_ADDRESS:-}",
        "YT": "${YT_NST_STRK_ADDRESS:-}",
        "Market": "${MARKET_NST_STRK_ADDRESS:-}",
        "initialAnchor": "${ANCHOR_NST_STRK:-}"
      },
      "sSTRK": {
        "PT": "${PT_SSTRK_ADDRESS:-}",
        "YT": "${YT_SSTRK_ADDRESS:-}",
        "Market": "${MARKET_SSTRK_ADDRESS:-}",
        "initialAnchor": "${ANCHOR_SSTRK:-}"
      }
    },
    "marketParams": {
      "scalarRoot": "${SCALAR_ROOT:-}",
      "feeRate": "${FEE_RATE:-}"
    },
    "liquidity": {
      "seeded": ${SEED_LIQUIDITY:-false},
      "seedAmount": "${SEED_AMOUNT:-0}"
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
    echo "Oracles:"
    echo "  MockPragma:     $MOCK_PRAGMA_ADDRESS"
    echo "  sSTRK Oracle:   $PRAGMA_SSTRK_ORACLE_ADDRESS"
    echo ""
    echo "Yield Token 1 (ERC-4626):"
    echo "  nstSTRK:        $NST_STRK_ADDRESS"
    echo "  SY-nstSTRK:     $SY_NST_STRK_ADDRESS"
    echo "  PT-nstSTRK:     $PT_NST_STRK_ADDRESS"
    echo "  YT-nstSTRK:     $YT_NST_STRK_ADDRESS"
    echo "  Market:         $MARKET_NST_STRK_ADDRESS"
    echo ""
    echo "Yield Token 2 (PragmaIndexOracle):"
    echo "  sSTRK:          $SSTRK_ADDRESS"
    echo "  Oracle:         $PRAGMA_SSTRK_ORACLE_ADDRESS"
    echo "  SY-sSTRK:       $SY_SSTRK_ADDRESS"
    echo "  PT-sSTRK:       $PT_SSTRK_ADDRESS"
    echo "  YT-sSTRK:       $YT_SSTRK_ADDRESS"
    echo "  Market:         $MARKET_SSTRK_ADDRESS"
    echo ""
    echo "Market Parameters:"
    echo "  Scalar Root:    $SCALAR_ROOT"
    echo "  Fee Rate:       $FEE_RATE"
    echo "  nstSTRK Anchor: $ANCHOR_NST_STRK"
    echo "  sSTRK Anchor:   $ANCHOR_SSTRK"
    echo ""
    echo "Expiry:           $EXPIRY_TIMESTAMP"
    echo ""
    if [[ "$SEED_LIQUIDITY" == "true" ]]; then
        echo "Initial Liquidity:"
        echo "  Seed Amount:    $SEED_AMOUNT (per market)"
        echo "  Status:         Seeded"
    else
        echo "Initial Liquidity: Not seeded (SEED_LIQUIDITY=false)"
    fi
fi

echo ""
log_success "Done!"
