#!/bin/bash

# =============================================================================
# Docker Deployment Script
# =============================================================================
# Waits for Katana to be ready, then deploys all contracts
# =============================================================================

set -e

KATANA_URL="${KATANA_URL:-http://katana:5050}"
MAX_RETRIES="${MAX_RETRIES:-30}"
RETRY_INTERVAL="${RETRY_INTERVAL:-2}"

echo "=========================================="
echo "Yield Tokenization - Docker Deployment"
echo "=========================================="
echo "Katana URL: $KATANA_URL"

# =============================================================================
# Wait for Katana
# =============================================================================

echo "Waiting for Katana to be ready..."

for i in $(seq 1 $MAX_RETRIES); do
    if curl -s "$KATANA_URL" > /dev/null 2>&1; then
        echo "Katana is ready!"
        break
    fi

    if [ $i -eq $MAX_RETRIES ]; then
        echo "Error: Katana not available after $MAX_RETRIES attempts"
        exit 1
    fi

    echo "  Attempt $i/$MAX_RETRIES - waiting ${RETRY_INTERVAL}s..."
    sleep $RETRY_INTERVAL
done

# =============================================================================
# Update .env with Docker Katana URL
# =============================================================================

ENV_FILE="${ENV_FILE:-.env.katana}"

# Reset addresses first
./deploy/scripts/reset-env.sh "$ENV_FILE"

# Update RPC URL for Docker network (use temp file for bind mount compatibility)
TEMP_FILE=$(mktemp)
cp "$ENV_FILE" "$TEMP_FILE"
sed "s|^STARKNET_RPC_URL=.*|STARKNET_RPC_URL=$KATANA_URL|" "$TEMP_FILE" > "${TEMP_FILE}.new"
cat "${TEMP_FILE}.new" > "$ENV_FILE"
rm -f "$TEMP_FILE" "${TEMP_FILE}.new"

echo "Updated RPC URL to: $KATANA_URL"

# =============================================================================
# Deploy Contracts
# =============================================================================

echo ""
echo "Starting deployment..."
echo ""

./deploy/scripts/deploy.sh katana

# =============================================================================
# Copy output to mounted volume if exists
# =============================================================================

if [ -d "/output" ]; then
    echo ""
    echo "Copying addresses to /output..."
    cp "$ENV_FILE" /output/
    cp deploy/addresses/katana.json /output/ 2>/dev/null || true
    echo "Files copied to /output/"
fi

echo ""
echo "=========================================="
echo "Docker Deployment Complete!"
echo "=========================================="
