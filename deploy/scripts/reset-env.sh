#!/bin/bash

# =============================================================================
# Reset all addresses in an .env file
# =============================================================================
# Usage: ./deploy/scripts/reset-env.sh <env-file>
#   e.g.: ./deploy/scripts/reset-env.sh .env.katana
# =============================================================================

set -e

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

for key in "${KEYS[@]}"; do
    if grep -q "^${key}=" "$ENV_FILE"; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^${key}=.*|${key}=|" "$ENV_FILE"
        else
            sed -i "s|^${key}=.*|${key}=|" "$ENV_FILE"
        fi
        echo "  Reset: $key"
    fi
done

echo "Done!"
