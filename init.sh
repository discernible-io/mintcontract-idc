#!/bin/bash

# init.sh - Initialize the RODiT contract using a custom RPC endpoint
# Usage: ./init.sh

set -e  # Exit on any error

# Load account from environment file
if [ -f "account.env" ]; then
  source account.env
else
  echo "Error: account.env file not found"
  exit 1
fi

# Configuration
ACCOUNT_ID="${CONTRACT_NAME}"
NETWORK="mainnet"
# Using standard mainnet RPC instead of Lava gateway to avoid 413 errors with large WASM files
RPC_URL="https://near-mainnet.api.pagoda.co/rpc/v1"

# Detect NEAR CLI location
NEAR_CLI=$(which near 2>/dev/null || echo "")
if [ -z "$NEAR_CLI" ]; then
  echo "Error: NEAR CLI not found in PATH"
  echo "Please install NEAR CLI: cargo install near-cli-rs"
  exit 1
fi

echo "=== RODiT Contract Initialization ==="
echo "Account ID: $ACCOUNT_ID"
echo "Network: $NETWORK"
echo "RPC URL: $RPC_URL"
echo ""

# Check if contract is already initialized
echo "Checking if contract is already initialized on $ACCOUNT_ID ..."
if $NEAR_CLI view "$ACCOUNT_ID" get_contract_status --node-url "$RPC_URL" now >/dev/null 2>&1; then
  echo "Contract is already initialized!"
  echo "Current status:"
  $NEAR_CLI view "$ACCOUNT_ID" get_contract_status --node-url "$RPC_URL" now
  exit 0
fi

echo "No initialized contract detected. Performing initialization."
echo ""

# Step 1: Initialize the contract
echo "Step 1: Calling init function..."
$NEAR_CLI call "$ACCOUNT_ID" init \
  '{"owner_id":"'$ACCOUNT_ID'","metadata":null}' \
  --use-account "$ACCOUNT_ID" \
  --network-id "$NETWORK" \
  --gas 100000000000000 \
  --deposit 0

if [ $? -ne 0 ]; then
  echo "Error: init call failed"
  exit 1
fi

echo ""
echo "=== Initialization Completed Successfully ==="
echo "Contract is initialized and active."
echo ""

# Verify initialization
echo "Verifying contract status..."
$NEAR_CLI view "$ACCOUNT_ID" get_contract_status now

echo ""
echo "Next steps:"
echo "  1. Add authorized signers with: ./add_signers.sh"
echo "  2. Configure fees if needed"
echo "  3. Start minting tokens"
echo ""
