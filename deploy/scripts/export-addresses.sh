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
TEST_RECIPIENT="${TEST_RECIPIENT:-0x064b48806902a367c8598f4F95C305e8c1a1aCbA5f082D294a43793113115691}"

cat > "$OUTPUT_FILE" << EOF
{
  "network": "$NETWORK",
  "rpcUrl": "$STARKNET_RPC_URL",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "classHashes": {
    "MockERC20": "${MOCK_ERC20_CLASS_HASH:-}",
    "MockYieldToken": "${MOCK_YIELD_TOKEN_CLASS_HASH:-}",
    "MockPragmaSummaryStats": "${MOCK_PRAGMA_CLASS_HASH:-}",
    "MockAggregator": "${MOCK_AGGREGATOR_CLASS_HASH:-}",
    "MockSwapCallback": "${MOCK_SWAP_CALLBACK_CLASS_HASH:-}",
    "MockFlashCallback": "${MOCK_FLASH_CALLBACK_CLASS_HASH:-}",
    "MockReentrantToken": "${MOCK_REENTRANT_TOKEN_CLASS_HASH:-}",
    "Faucet": "${FAUCET_CLASS_HASH:-}",
    "PragmaIndexOracle": "${PRAGMA_INDEX_ORACLE_CLASS_HASH:-}",
    "PyLpOracle": "${PY_LP_ORACLE_CLASS_HASH:-}",
    "RouterStatic": "${ROUTER_STATIC_CLASS_HASH:-}",
    "SY": "${SY_CLASS_HASH:-}",
    "SYWithRewards": "${SY_WITH_REWARDS_CLASS_HASH:-}",
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
    "Router": "${ROUTER_ADDRESS:-}",
    "RouterStatic": "${ROUTER_STATIC_ADDRESS:-}",
    "PyLpOracle": "${PY_LP_ORACLE_ADDRESS:-}"
  },
  "testSetup": {
    "testRecipient": "$TEST_RECIPIENT",
    "baseToken": {
      "STRK": "${STRK_ADDRESS:-}",
      "ETH": "${ETH_ADDRESS:-}"
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
        "isERC4626": true
      },
      "wstETH": {
        "name": "Starknet Wrapped Staked Ether",
        "symbol": "wstETH",
        "address": "${WSTETH_ADDRESS:-}",
        "isERC4626": true
      }
    },
    "syTokens": {
      "SY-nstSTRK": {
        "address": "${SY_NST_STRK_ADDRESS:-}",
        "underlying": "${NST_STRK_ADDRESS:-}",
        "isERC4626": true
      },
      "SY-sSTRK": {
        "address": "${SY_SSTRK_ADDRESS:-}",
        "underlying": "${SSTRK_ADDRESS:-}",
        "isERC4626": true
      },
      "SY-wstETH": {
        "address": "${SY_WSTETH_ADDRESS:-}",
        "underlying": "${WSTETH_ADDRESS:-}",
        "isERC4626": true
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
      },
      "wstETH": {
        "PT": "${PT_WSTETH_ADDRESS:-}",
        "YT": "${YT_WSTETH_ADDRESS:-}",
        "Market": "${MARKET_WSTETH_ADDRESS:-}",
        "initialAnchor": "${ANCHOR_WSTETH:-}"
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

echo "Addresses exported to: $OUTPUT_FILE"
cat "$OUTPUT_FILE"
