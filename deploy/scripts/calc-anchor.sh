#!/bin/bash

# =============================================================================
# Horizon Protocol - Initial Anchor Calculator
# =============================================================================
# Calculates the initial_anchor value for AMM markets from target APY.
#
# Usage:
#   ./deploy/scripts/calc-anchor.sh <apy_percent>           # Calculate only
#   ./deploy/scripts/calc-anchor.sh <apy_percent> --update  # Update .env.devnet
#   ./deploy/scripts/calc-anchor.sh <apy_percent> --update --network sepolia
#
# Examples:
#   ./deploy/scripts/calc-anchor.sh 8          # Calculate anchor for 8% APY
#   ./deploy/scripts/calc-anchor.sh 5 --update # Calculate and update env
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

# Defaults
NETWORK="devnet"
UPDATE_ENV=false
MARKET_NAME=""

# =============================================================================
# Usage
# =============================================================================

usage() {
    echo -e "${CYAN}Horizon Protocol - Initial Anchor Calculator${NC}"
    echo ""
    echo "Calculates initial_anchor = ln(1 + APY) in WAD format (18 decimals)"
    echo ""
    echo -e "${YELLOW}Usage:${NC}"
    echo "  $0 <apy_percent> [options]"
    echo ""
    echo -e "${YELLOW}Arguments:${NC}"
    echo "  apy_percent    Target APY as percentage (e.g., 8 for 8%)"
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo "  --update       Update the .env file with calculated value"
    echo "  --network      Network to update (default: devnet)"
    echo "  --market       Market name suffix for env var (e.g., NST_STRK, SSTRK)"
    echo "  --help         Show this help message"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  $0 8                              # Calculate anchor for 8% APY"
    echo "  $0 5 --update                     # Update MARKET_INITIAL_ANCHOR in .env.devnet"
    echo "  $0 8 --update --market NST_STRK   # Update MARKET_INITIAL_ANCHOR_NST_STRK"
    echo "  $0 10 --update --network sepolia  # Update .env.sepolia"
    echo ""
    echo -e "${YELLOW}Reference table:${NC}"
    echo "  APY    | initial_anchor (WAD)"
    echo "  -------|----------------------"
    echo "  3%     | 29558802241544320"
    echo "  5%     | 48790164169432000"
    echo "  8%     | 76961041136128000"
    echo "  10%    | 95310179804324800"
    echo "  15%    | 139761942375159040"
    echo "  20%    | 182321556793954560"
    echo ""
}

# =============================================================================
# Parse Arguments
# =============================================================================

if [[ $# -eq 0 ]]; then
    usage
    exit 1
fi

APY_PERCENT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            usage
            exit 0
            ;;
        --update)
            UPDATE_ENV=true
            shift
            ;;
        --network)
            NETWORK="$2"
            shift 2
            ;;
        --market)
            MARKET_NAME="$2"
            shift 2
            ;;
        -*)
            echo -e "${RED}Error: Unknown option $1${NC}"
            usage
            exit 1
            ;;
        *)
            if [[ -z "$APY_PERCENT" ]]; then
                APY_PERCENT="$1"
            else
                echo -e "${RED}Error: Unexpected argument $1${NC}"
                usage
                exit 1
            fi
            shift
            ;;
    esac
done

if [[ -z "$APY_PERCENT" ]]; then
    echo -e "${RED}Error: APY percentage is required${NC}"
    usage
    exit 1
fi

# Validate APY is a number
if ! [[ "$APY_PERCENT" =~ ^[0-9]+\.?[0-9]*$ ]]; then
    echo -e "${RED}Error: APY must be a positive number${NC}"
    exit 1
fi

# =============================================================================
# Calculate Initial Anchor
# =============================================================================

# Calculate using awk for floating point math
# initial_anchor = ln(1 + apy) * 10^18
calculate_anchor() {
    local apy_percent=$1

    # Use awk for precise calculation
    awk -v apy="$apy_percent" 'BEGIN {
        # Convert percentage to decimal
        rate = apy / 100

        # Calculate ln(1 + rate)
        ln_rate = log(1 + rate)

        # Convert to WAD (18 decimals)
        wad = ln_rate * 1000000000000000000

        # Print as integer (floor)
        printf "%.0f\n", wad
    }'
}

# Calculate the reverse: APY from anchor
calculate_apy_from_anchor() {
    local anchor=$1

    awk -v anchor="$anchor" 'BEGIN {
        # Convert from WAD
        ln_rate = anchor / 1000000000000000000

        # Calculate APY = e^ln_rate - 1
        apy = (exp(ln_rate) - 1) * 100

        printf "%.4f\n", apy
    }'
}

INITIAL_ANCHOR=$(calculate_anchor "$APY_PERCENT")
VERIFY_APY=$(calculate_apy_from_anchor "$INITIAL_ANCHOR")

# Convert to hex
ANCHOR_HEX=$(printf "0x%x" "$INITIAL_ANCHOR")

# =============================================================================
# Output Results
# =============================================================================

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Initial Anchor Calculation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${CYAN}Input:${NC}"
echo -e "  Target APY:        ${GREEN}${APY_PERCENT}%${NC}"
echo ""
echo -e "${CYAN}Output:${NC}"
echo -e "  initial_anchor:    ${GREEN}${INITIAL_ANCHOR}${NC} (decimal)"
echo -e "  initial_anchor:    ${GREEN}${ANCHOR_HEX}${NC} (hex)"
echo -e "  Verification APY:  ${GREEN}${VERIFY_APY}%${NC}"
echo ""
echo -e "${CYAN}Formula:${NC}"
echo -e "  initial_anchor = ln(1 + ${APY_PERCENT}/100) × 10^18"
echo -e "  initial_anchor = ln($(awk -v a="$APY_PERCENT" 'BEGIN{printf "%.4f", 1+a/100}')) × 10^18"
echo ""

# =============================================================================
# Update Environment File
# =============================================================================

if [[ "$UPDATE_ENV" == true ]]; then
    ENV_FILE="$ROOT_DIR/.env.$NETWORK"

    if [[ ! -f "$ENV_FILE" ]]; then
        echo -e "${RED}Error: Environment file not found: $ENV_FILE${NC}"
        exit 1
    fi

    # Determine env var name
    if [[ -n "$MARKET_NAME" ]]; then
        ENV_VAR="MARKET_INITIAL_ANCHOR_${MARKET_NAME}"
    else
        ENV_VAR="MARKET_INITIAL_ANCHOR"
    fi

    # Update or add the env var
    if grep -q "^${ENV_VAR}=" "$ENV_FILE"; then
        # Update existing
        temp_file=$(mktemp)
        sed "s|^${ENV_VAR}=.*|${ENV_VAR}=${INITIAL_ANCHOR}|" "$ENV_FILE" > "$temp_file"
        cat "$temp_file" > "$ENV_FILE"
        rm -f "$temp_file"
        echo -e "${GREEN}Updated${NC} ${ENV_VAR} in $ENV_FILE"
    else
        # Add new
        echo "${ENV_VAR}=${INITIAL_ANCHOR}" >> "$ENV_FILE"
        echo -e "${GREEN}Added${NC} ${ENV_VAR} to $ENV_FILE"
    fi

    echo ""
    echo -e "${CYAN}Environment variable:${NC}"
    echo -e "  ${ENV_VAR}=${INITIAL_ANCHOR}"
    echo ""
fi

# =============================================================================
# Show deploy.sh usage hint
# =============================================================================

echo -e "${YELLOW}To use in deploy.sh:${NC}"
if [[ -n "$MARKET_NAME" ]]; then
    echo -e "  export MARKET_INITIAL_ANCHOR_${MARKET_NAME}=${INITIAL_ANCHOR}"
else
    echo -e "  export MARKET_INITIAL_ANCHOR=${INITIAL_ANCHOR}"
fi
echo ""
echo -e "${YELLOW}Or add to .env.$NETWORK:${NC}"
if [[ -n "$MARKET_NAME" ]]; then
    echo -e "  MARKET_INITIAL_ANCHOR_${MARKET_NAME}=${INITIAL_ANCHOR}"
else
    echo -e "  MARKET_INITIAL_ANCHOR=${INITIAL_ANCHOR}"
fi
echo ""
