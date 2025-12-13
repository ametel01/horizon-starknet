#!/bin/bash

# =============================================================================
# Export deployed addresses to JSON format
# =============================================================================
# Usage: ./deploy/scripts/export-addresses.sh [network]
#
# Outputs a JSON file with all deployed addresses for frontend consumption.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

NETWORK="${1:-katana}"
ENV_FILE="$ROOT_DIR/.env.$NETWORK"
OUTPUT_FILE="$ROOT_DIR/deploy/addresses/$NETWORK.json"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: Environment file not found: $ENV_FILE"
    exit 1
fi

source "$ENV_FILE"

mkdir -p "$(dirname "$OUTPUT_FILE")"

cat > "$OUTPUT_FILE" << EOF
{
  "network": "$NETWORK",
  "rpcUrl": "$STARKNET_RPC_URL",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "classHashes": {
    "MockYieldToken": "$MOCK_YIELD_TOKEN_CLASS_HASH",
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
    "MockYieldToken": "$MOCK_YIELD_TOKEN_ADDRESS",
    "SY": "$SY_ADDRESS",
    "PT": "$PT_ADDRESS",
    "YT": "$YT_ADDRESS",
    "Market": "$MARKET_ADDRESS",
    "expiry": $EXPIRY_TIMESTAMP
  },
  "marketParams": {
    "scalarRoot": "$MARKET_SCALAR_ROOT",
    "initialAnchor": "$MARKET_INITIAL_ANCHOR",
    "feeRate": "$MARKET_FEE_RATE"
  }
}
EOF

echo "Addresses exported to: $OUTPUT_FILE"
cat "$OUTPUT_FILE"
