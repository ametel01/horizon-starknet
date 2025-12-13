#!/bin/bash

# =============================================================================
# Reset all addresses in an .env file and corresponding addresses JSON
# =============================================================================
# Usage: ./deploy/scripts/reset-env.sh <env-file>
#   e.g.: ./deploy/scripts/reset-env.sh .env.katana
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADDRESSES_DIR="$SCRIPT_DIR/../addresses"

ENV_FILE="${1:-.env.katana}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: File not found: $ENV_FILE"
    exit 1
fi

echo "Resetting addresses in $ENV_FILE..."

# List of keys to reset
KEYS=(
    "MOCK_YIELD_TOKEN_CLASS_HASH"
    "SY_CLASS_HASH"
    "PT_CLASS_HASH"
    "YT_CLASS_HASH"
    "MARKET_CLASS_HASH"
    "FACTORY_CLASS_HASH"
    "MARKET_FACTORY_CLASS_HASH"
    "ROUTER_CLASS_HASH"
    "FACTORY_ADDRESS"
    "MARKET_FACTORY_ADDRESS"
    "ROUTER_ADDRESS"
    "MOCK_YIELD_TOKEN_ADDRESS"
    "SY_ADDRESS"
    "PT_ADDRESS"
    "YT_ADDRESS"
    "MARKET_ADDRESS"
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
# Extract network name from env file (e.g., .env.katana -> katana)
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
