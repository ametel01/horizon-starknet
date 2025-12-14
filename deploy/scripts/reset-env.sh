#!/bin/bash

# =============================================================================
# Reset all addresses in an .env file and corresponding addresses JSON
# =============================================================================
# Usage: ./deploy/scripts/reset-env.sh <env-file>
#   e.g.: ./deploy/scripts/reset-env.sh .env.devnet
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADDRESSES_DIR="$SCRIPT_DIR/../addresses"

ENV_FILE="${1:-.env.devnet}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: File not found: $ENV_FILE"
    exit 1
fi

echo "Resetting addresses in $ENV_FILE..."

# List of keys to reset
KEYS=(
    # Class hashes
    "MOCK_ERC20_CLASS_HASH"
    "MOCK_YIELD_TOKEN_CLASS_HASH"
    "MOCK_PRAGMA_CLASS_HASH"
    "PRAGMA_INDEX_ORACLE_CLASS_HASH"
    "SY_CLASS_HASH"
    "PT_CLASS_HASH"
    "YT_CLASS_HASH"
    "MARKET_CLASS_HASH"
    "FACTORY_CLASS_HASH"
    "MARKET_FACTORY_CLASS_HASH"
    "ROUTER_CLASS_HASH"
    # Core contract addresses
    "FACTORY_ADDRESS"
    "MARKET_FACTORY_ADDRESS"
    "ROUTER_ADDRESS"
    # Oracle addresses
    "MOCK_PRAGMA_ADDRESS"
    "PRAGMA_SSTRK_ORACLE_ADDRESS"
    # Base token
    "STRK_ADDRESS"
    # Yield Token 1: nstSTRK (ERC-4626 style)
    "NST_STRK_ADDRESS"
    "SY_NST_STRK_ADDRESS"
    "PT_NST_STRK_ADDRESS"
    "YT_NST_STRK_ADDRESS"
    "MARKET_NST_STRK_ADDRESS"
    # Yield Token 2: sSTRK (PragmaIndexOracle style)
    "SSTRK_ADDRESS"
    "SY_SSTRK_ADDRESS"
    "PT_SSTRK_ADDRESS"
    "YT_SSTRK_ADDRESS"
    "MARKET_SSTRK_ADDRESS"
    # Expiry timestamp
    "EXPIRY_TIMESTAMP"
)

# Create temp file for modifications (works with Docker bind mounts)
TEMP_FILE=$(mktemp)
cp "$ENV_FILE" "$TEMP_FILE"

for key in "${KEYS[@]}"; do
    if grep -q "^${key}=" "$TEMP_FILE"; then
        sed "s|^${key}=.*|${key}=|" "$TEMP_FILE" > "${TEMP_FILE}.new"
        mv "${TEMP_FILE}.new" "$TEMP_FILE"
        echo "  Reset: $key"
    fi
done

# Copy back to original file (works with bind mounts)
cat "$TEMP_FILE" > "$ENV_FILE"
rm -f "$TEMP_FILE"

echo "Done resetting $ENV_FILE!"

# Reset corresponding addresses JSON file
# Extract network name from env file (e.g., .env.devnet -> devnet)
NETWORK=$(basename "$ENV_FILE" | sed 's/^\.env\.//')
ADDRESSES_FILE="$ADDRESSES_DIR/${NETWORK}.json"

if [[ -f "$ADDRESSES_FILE" ]]; then
    echo "Resetting addresses file: $ADDRESSES_FILE..."
    cat > "$ADDRESSES_FILE" << 'EOF'
{
  "network": "",
  "rpcUrl": "",
  "deployedAt": "",
  "classHashes": {},
  "contracts": {},
  "testSetup": {}
}
EOF
    echo "Done resetting $ADDRESSES_FILE!"
else
    echo "No addresses file found at $ADDRESSES_FILE (skipping)"
fi

echo "Reset complete!"
