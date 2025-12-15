#!/bin/bash

# =============================================================================
# Docker Deployment Script
# =============================================================================
# Waits for Devnet to be ready, then deploys all contracts
# Supports both regular devnet and fork mode
# =============================================================================

set -e

DEVNET_URL="${DEVNET_URL:-http://devnet:5050}"
MAX_RETRIES="${MAX_RETRIES:-60}"
RETRY_INTERVAL="${RETRY_INTERVAL:-3}"
DEPLOY_SCRIPT="${DEPLOY_SCRIPT:-deploy.sh}"  # Can be deploy.sh or deploy-fork.sh

echo "=========================================="
echo "Horizon Protocol - Docker Deployment"
echo "=========================================="
echo "Devnet URL: $DEVNET_URL"
echo "Deploy Script: $DEPLOY_SCRIPT"

# =============================================================================
# Wait for Devnet
# =============================================================================

echo "Waiting for Starknet Devnet to be ready..."

for i in $(seq 1 $MAX_RETRIES); do
    if curl -s "$DEVNET_URL/is_alive" > /dev/null 2>&1; then
        echo "Starknet Devnet is ready!"
        break
    fi

    if [ $i -eq $MAX_RETRIES ]; then
        echo "Error: Devnet not available after $MAX_RETRIES attempts"
        exit 1
    fi

    echo "  Attempt $i/$MAX_RETRIES - waiting ${RETRY_INTERVAL}s..."
    sleep $RETRY_INTERVAL
done

# =============================================================================
# Update .env with Docker Devnet URL
# =============================================================================

ENV_FILE="${ENV_FILE:-.env.devnet}"

# Reset addresses first
./deploy/scripts/reset-env.sh "$ENV_FILE"

# Update RPC URL for Docker network (use temp file for bind mount compatibility)
TEMP_FILE=$(mktemp)
cp "$ENV_FILE" "$TEMP_FILE"
sed "s|^STARKNET_RPC_URL=.*|STARKNET_RPC_URL=$DEVNET_URL|" "$TEMP_FILE" > "${TEMP_FILE}.new"
cat "${TEMP_FILE}.new" > "$ENV_FILE"
rm -f "$TEMP_FILE" "${TEMP_FILE}.new"

echo "Updated RPC URL to: $DEVNET_URL"

# =============================================================================
# Deploy Contracts
# =============================================================================

echo ""
echo "Starting deployment with $DEPLOY_SCRIPT..."
echo ""

# Determine network name from env file
if [[ "$ENV_FILE" == *"fork"* ]]; then
    NETWORK="fork"
else
    NETWORK="devnet"
fi

./deploy/scripts/$DEPLOY_SCRIPT $NETWORK

# =============================================================================
# Copy output to mounted volume if exists
# =============================================================================

if [ -d "/output" ]; then
    echo ""
    echo "Copying addresses to /output..."
    cp "$ENV_FILE" /output/
    cp deploy/addresses/$NETWORK.json /output/ 2>/dev/null || true
    echo "Files copied to /output/"
fi

echo ""
echo "=========================================="
echo "Docker Deployment Complete!"
echo "=========================================="
