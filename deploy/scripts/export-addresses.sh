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

NETWORK="${1:-devnet}"
ENV_FILE="$ROOT_DIR/.env.$NETWORK"
OUTPUT_FILE="$ROOT_DIR/deploy/addresses/$NETWORK.json"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: Environment file not found: $ENV_FILE"
    exit 1
fi

source "$ENV_FILE"

mkdir -p "$(dirname "$OUTPUT_FILE")"

# Test recipient address
TEST_RECIPIENT="0x0715140EF3b872C34c0E82CB2650c4bEB0E9F60d5a157414af6913E9326cd691"

cat > "$OUTPUT_FILE" << EOF
{
  "network": "$NETWORK",
  "rpcUrl": "$STARKNET_RPC_URL",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "classHashes": {
    "MockERC20": "${MOCK_ERC20_CLASS_HASH:-}",
    "MockYieldToken": "${MOCK_YIELD_TOKEN_CLASS_HASH:-}",
    "SY": "${SY_CLASS_HASH:-}",
    "PT": "${PT_CLASS_HASH:-}",
    "YT": "${YT_CLASS_HASH:-}",
    "Market": "${MARKET_CLASS_HASH:-}",
    "Factory": "${FACTORY_CLASS_HASH:-}",
    "MarketFactory": "${MARKET_FACTORY_CLASS_HASH:-}",
    "Router": "${ROUTER_CLASS_HASH:-}"
  },
  "contracts": {
    "Factory": "${FACTORY_ADDRESS:-}",
    "MarketFactory": "${MARKET_FACTORY_ADDRESS:-}",
    "Router": "${ROUTER_ADDRESS:-}"
  },
  "testSetup": {
    "testRecipient": "$TEST_RECIPIENT",
    "baseToken": {
      "STRK": "${STRK_ADDRESS:-}"
    },
    "yieldTokens": {
      "nstSTRK": {
        "name": "Nostra Staked STRK",
        "symbol": "nstSTRK",
        "address": "${NST_STRK_ADDRESS:-}",
        "isERC4626": true
      },
      "sSTRK": {
        "name": "Staked Starknet Token",
        "symbol": "sSTRK",
        "address": "${SSTRK_ADDRESS:-}",
        "isERC4626": false
      }
    },
    "syTokens": {
      "SY-nstSTRK": {
        "address": "${SY_NST_STRK_ADDRESS:-}",
        "underlying": "${NST_STRK_ADDRESS:-}"
      },
      "SY-sSTRK": {
        "address": "${SY_SSTRK_ADDRESS:-}",
        "underlying": "${SSTRK_ADDRESS:-}"
      }
    },
    "markets": {
      "nstSTRK": {
        "PT": "${PT_NST_STRK_ADDRESS:-}",
        "YT": "${YT_NST_STRK_ADDRESS:-}",
        "Market": "${MARKET_NST_STRK_ADDRESS:-}"
      },
      "sSTRK": {
        "PT": "${PT_SSTRK_ADDRESS:-}",
        "YT": "${YT_SSTRK_ADDRESS:-}",
        "Market": "${MARKET_SSTRK_ADDRESS:-}"
      }
    },
    "expiry": ${EXPIRY_TIMESTAMP:-0}
  },
  "marketParams": {
    "scalarRoot": "${MARKET_SCALAR_ROOT:-}",
    "initialAnchor": "${MARKET_INITIAL_ANCHOR:-}",
    "feeRate": "${MARKET_FEE_RATE:-}"
  }
}
EOF

echo "Addresses exported to: $OUTPUT_FILE"
cat "$OUTPUT_FILE"
