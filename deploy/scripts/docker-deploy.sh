#!/bin/bash

# =============================================================================
# Docker Deployment Script
# =============================================================================
# Waits for Devnet to be ready, then deploys all contracts
# =============================================================================

set -e

DEVNET_URL="${DEVNET_URL:-http://devnet:5050}"
MAX_RETRIES="${MAX_RETRIES:-30}"
RETRY_INTERVAL="${RETRY_INTERVAL:-2}"

echo "=========================================="
echo "Horizon Protocol - Docker Deployment"
echo "=========================================="
echo "Devnet URL: $DEVNET_URL"

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
echo "Starting deployment..."
echo ""

./deploy/scripts/deploy.sh devnet

# =============================================================================
# Copy output to mounted volume if exists
# =============================================================================

if [ -d "/output" ]; then
    echo ""
    echo "Copying addresses to /output..."
    cp "$ENV_FILE" /output/
    cp deploy/addresses/devnet.json /output/ 2>/dev/null || true
    echo "Files copied to /output/"
fi

echo ""
echo "=========================================="
echo "Docker Deployment Complete!"
echo "=========================================="
