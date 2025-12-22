#!/bin/sh

PRESET=${PRESET:-mainnet}

echo "Starting all indexers with preset: $PRESET"

# Run indexer with auto-restart on failure
run_indexer() {
  while true; do
    bun run apibara start --indexer $1 --preset $PRESET || true
    echo "[$1] Restarting in 5s..."
    sleep 5
  done
}

run_indexer factory &
run_indexer market-factory &
run_indexer router &
run_indexer sy &
run_indexer yt &
run_indexer market &

wait
