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

# Stagger startup to avoid database connection storms
# Railway PostgreSQL has limited connections, starting all at once causes failures
run_indexer factory &
sleep 3
run_indexer market-factory &
sleep 3
run_indexer router &
sleep 3
run_indexer sy &
sleep 3
run_indexer yt &
sleep 3
run_indexer market &

wait
