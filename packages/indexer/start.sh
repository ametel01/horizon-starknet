#!/bin/sh
set -e

PRESET=${PRESET:-mainnet}

echo "Starting all indexers with preset: $PRESET"

# Start all indexers in background
bun run apibara start --indexer factory --preset $PRESET &
bun run apibara start --indexer market-factory --preset $PRESET &
bun run apibara start --indexer router --preset $PRESET &
bun run apibara start --indexer sy --preset $PRESET &
bun run apibara start --indexer yt --preset $PRESET &
bun run apibara start --indexer market --preset $PRESET &

# Wait for all background processes
wait
