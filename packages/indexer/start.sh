#!/bin/sh

PRESET=${PRESET:-mainnet}

# Whitelist environment variables for the sandboxed Apibara indexers
# Without this, indexers cannot access DNA_TOKEN for authentication
export ALLOW_ENV_FROM_ENV="DNA_TOKEN,AUTH_TOKEN"

echo "Starting all indexers with preset: $PRESET"
echo "DNA_TOKEN: ${DNA_TOKEN:+set (hidden)}"
echo "AUTH_TOKEN: ${AUTH_TOKEN:+set (hidden)}"
echo "DATABASE_URL: ${DATABASE_URL:+set}"
echo "POSTGRES_CONNECTION_STRING: ${POSTGRES_CONNECTION_STRING:+set}"
echo "RESET_CHECKPOINTS: $RESET_CHECKPOINTS"
echo "ALLOW_ENV_FROM_ENV: $ALLOW_ENV_FROM_ENV"

# Reset checkpoints if RESET_CHECKPOINTS=true
# This forces all indexers to restart from their configured startingBlock
if [ "$RESET_CHECKPOINTS" = "true" ]; then
  echo "RESET_CHECKPOINTS=true - Resetting all indexer checkpoints..."
  sleep 3  # Wait for database to be ready
  bun run scripts/reset-checkpoints.ts || echo "Warning: Could not reset checkpoints, continuing anyway..."
fi

# Create materialized views if they don't exist
echo "Ensuring materialized views exist..."
bun run scripts/create-views.ts || echo "Warning: Could not create views, continuing anyway..."

# Clean up stale reorg triggers from previous failed deployments
# The Apibara drizzle plugin creates constraint triggers for reorg handling.
# If a deployment fails mid-startup, triggers can be left behind causing
# "trigger already exists" errors on subsequent starts.
echo "Cleaning up stale triggers..."
bun run scripts/cleanup-triggers.ts || echo "Warning: Could not cleanup triggers, continuing anyway..."

# Background job to refresh materialized views every 30 minutes
refresh_views() {
  while true; do
    sleep 1800  # 30 minutes
    echo "[views] Refreshing materialized views..."
    bun run scripts/refresh-views.ts || echo "[views] Warning: Could not refresh views"
  done
}
refresh_views &

# Run indexer with auto-restart on failure
# Uses exponential backoff with jitter to avoid thundering herd on DNA server recovery
run_indexer() {
  local name=$1
  local retry_count=0
  local max_delay=30

  while true; do
    bun run apibara start --indexer $name --preset $PRESET || true

    # Exponential backoff: 2^retry_count seconds, capped at max_delay
    local delay=$((2 ** retry_count))
    if [ $delay -gt $max_delay ]; then
      delay=$max_delay
    fi

    # Add jitter (0-2 seconds) to prevent all indexers restarting simultaneously
    local jitter=$((RANDOM % 3))
    delay=$((delay + jitter))

    echo "[$name] Restarting in ${delay}s (attempt $((retry_count + 1)))..."
    sleep $delay

    # Increase retry count, but reset after successful long run
    retry_count=$((retry_count + 1))
    if [ $retry_count -gt 5 ]; then
      retry_count=5  # Cap at ~30s delay
    fi
  done
}

# Stagger startup to avoid database deadlocks on DDL operations
# The Apibara drizzle plugin creates reorg triggers at startup.
# If multiple indexers run DROP TRIGGER / CREATE TRIGGER concurrently,
# PostgreSQL can deadlock. 8s delay ensures each indexer completes
# its DDL operations before the next one starts.
run_indexer factory &
sleep 8
run_indexer market-factory &
sleep 8
run_indexer router &
sleep 8
run_indexer sy &
sleep 8
run_indexer yt &
sleep 8
run_indexer market &

wait
