#!/bin/bash

# =============================================================================
# Horizon Protocol - Sepolia Full Deployment Script
# =============================================================================
# Usage: ./deploy/scripts/deploy-sepolia.sh
#
# This script:
# 1. Declares all contract classes using declare.sh
# 2. Deploys all contracts using deploy.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Horizon Protocol - Sepolia Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check .env.sepolia exists
if [[ ! -f "$ROOT_DIR/.env.sepolia" ]]; then
    echo -e "${RED}[ERROR]${NC} .env.sepolia not found!"
    exit 1
fi

# Source environment to verify deployer is set
source "$ROOT_DIR/.env.sepolia"

if [[ -z "$DEPLOYER_ADDRESS" || -z "$DEPLOYER_PRIVATE_KEY" ]]; then
    echo -e "${RED}[ERROR]${NC} DEPLOYER_ADDRESS and DEPLOYER_PRIVATE_KEY must be set in .env.sepolia"
    exit 1
fi

echo -e "${BLUE}[INFO]${NC} Deployer: $DEPLOYER_ADDRESS"
echo -e "${BLUE}[INFO]${NC} Test Recipient: $TEST_RECIPIENT"
echo ""

# Step 1: Declare all contract classes
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Step 1: Declaring Contract Classes${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

"$SCRIPT_DIR/declare.sh" sepolia

echo ""
echo -e "${GREEN}[SUCCESS]${NC} All classes declared"
echo ""

# Wait for declarations to be confirmed before deploying
echo -e "${BLUE}[INFO]${NC} Waiting 15 seconds for declarations to be confirmed..."
sleep 15

# Step 2: Deploy contracts
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Step 2: Deploying Contracts${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

"$SCRIPT_DIR/deploy.sh" sepolia

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Sepolia Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
