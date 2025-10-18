#!/bin/bash

# update_contract.sh - Automates the NEAR contract upgrade process
# Usage: ./update_contract.sh <account_id> [network]
# Example: ./update_contract.sh 20251001-rodit-org.testnet testnet

set -e  # Exit on any error

# Detect NEAR CLI location
NEAR_CLI=$(which near 2>/dev/null || echo "")
if [ -z "$NEAR_CLI" ]; then
  echo "Error: NEAR CLI not found in PATH"
  echo "Please install NEAR CLI: cargo install near-cli-rs"
  exit 1
fi

# Default values
NETWORK="testnet"
UPGRADE_DELAY_SECONDS=30  # 1/2 minutes
POLLING_INTERVAL=10  # Check status every 10 seconds
BUFFER_SECONDS=10  # Add a small buffer to the delay time
# Initial storage deposit for fresh accounts (can override via INIT_DEPOSIT env)
INIT_DEPOSIT=${INIT_DEPOSIT:-"1 NEAR"}

# Parse arguments
if [ -z "$1" ]; then
  echo "Error: Account ID is required"
  echo "Usage: ./update_contract.sh <account_id> [network]"
  exit 1
fi

ACCOUNT_ID=$1

if [ ! -z "$2" ]; then
  NETWORK=$2
fi

echo "=== Contract Update Process ==="
echo "Account ID: $ACCOUNT_ID"
echo "Network: $NETWORK"
echo

# Step 0: Check and ensure wasm32-unknown-unknown target is installed
echo "Step 0: Checking Rust environment..."
if ! rustup target list --installed | grep -q "wasm32-unknown-unknown"; then
  echo "wasm32-unknown-unknown target not found. Installing..."
  rustup target add wasm32-unknown-unknown
  if [ $? -ne 0 ]; then
    echo "Error: Failed to install wasm32-unknown-unknown target"
    exit 1
  fi
  echo "wasm32-unknown-unknown target installed successfully!"
else
  echo "wasm32-unknown-unknown target is already installed."
fi
echo

# Step 1: Build the contract
echo "Step 1: Building contract..."
cargo near build non-reproducible-wasm --no-abi
if [ $? -ne 0 ]; then
  echo "Error: Failed to build contract"
  exit 1
fi
echo "Contract built successfully!"
echo

# Initial deployment detection and flow
echo "Checking if contract is already initialized on $ACCOUNT_ID ..."
if ! $NEAR_CLI view "$ACCOUNT_ID" get_contract_status --network-id "$NETWORK" >/dev/null 2>&1; then
  echo "No initialized contract detected. Performing initial deploy + init."

  # Step A: Upload code (this requires the account to have enough balance to cover code storage)
  echo "Initial deploy: uploading wasm ..."
  if ! $NEAR_CLI contract deploy "$ACCOUNT_ID" use-file ./target/near/rodit_near.wasm without-init-call network-config "$NETWORK" sign-with-keychain send; then
    echo "Error: Failed to deploy code."
    echo "Hint: Ensure the account $ACCOUNT_ID has enough NEAR to cover code storage (typically ~1 NEAR on testnet)."
    exit 1
  fi

  # Step B: Initialize (init is not payable; attach 0 NEAR)
  echo "Calling init ..."
  if ! $NEAR_CLI call "$ACCOUNT_ID" init '{"owner_id":"'$ACCOUNT_ID'","metadata":null}' --account-id "$ACCOUNT_ID" --network-id "$NETWORK"; then
    echo "Error: init call failed"
    exit 1
  fi

  echo "Initial deployment completed successfully!"
  echo "Contract is initialized and active."
  exit 0
fi

# Step 2: Propose the upgrade
echo "Step 2: Proposing upgrade..."
$NEAR_CLI call $ACCOUNT_ID propose_upgrade '{}' --account-id $ACCOUNT_ID --network-id $NETWORK
if [ $? -ne 0 ]; then
  echo "Error: Failed to propose upgrade"
  exit 1
fi
echo "Upgrade proposed successfully!"
echo

# Step 3: Wait for the upgrade delay period
echo "Step 3: Waiting for upgrade delay period..."
echo "Upgrade delay is set to $UPGRADE_DELAY_SECONDS seconds"
echo "Checking status every $POLLING_INTERVAL seconds..."

# Add a small buffer to ensure the delay has fully passed
TOTAL_WAIT_TIME=$((UPGRADE_DELAY_SECONDS + BUFFER_SECONDS))
ELAPSED_TIME=0

while [ $ELAPSED_TIME -lt $TOTAL_WAIT_TIME ]; do
  REMAINING=$($NEAR_CLI view $ACCOUNT_ID get_upgrade_status --network-id $NETWORK | tail -n 1 | tr -d ' ')
  
  # Check if the result is a number
  if [[ $REMAINING =~ ^[0-9]+$ ]]; then
    echo "Remaining time: $REMAINING seconds"
    
    # If remaining time is 0, we can proceed
    if [ "$REMAINING" -eq "0" ]; then
      echo "Upgrade delay period has completed!"
      break
    fi
  else
    echo "Warning: Unexpected response from get_upgrade_status: $REMAINING"
  fi
  
  # Sleep for the polling interval
  sleep $POLLING_INTERVAL
  ELAPSED_TIME=$((ELAPSED_TIME + POLLING_INTERVAL))
  
  # If we've waited longer than expected, check if we can proceed anyway
  if [ $ELAPSED_TIME -ge $TOTAL_WAIT_TIME ]; then
    FINAL_CHECK=$($NEAR_CLI view $ACCOUNT_ID get_upgrade_status --network-id $NETWORK | tail -n 1 | tr -d ' ')
    if [ "$FINAL_CHECK" -eq "0" ]; then
      echo "Upgrade delay period has completed!"
      break
    else
      echo "Warning: Upgrade delay period hasn't completed after waiting $ELAPSED_TIME seconds"
      echo "Current status: $FINAL_CHECK seconds remaining"
      echo "Do you want to continue waiting? (y/n)"
      read -r CONTINUE
      if [[ "$CONTINUE" =~ ^[Yy]$ ]]; then
        TOTAL_WAIT_TIME=$((TOTAL_WAIT_TIME + 60))  # Add another minute
        echo "Continuing to wait..."
      else
        echo "Aborting upgrade process"
        exit 1
      fi
    fi
  fi
done

echo "Upgrade delay period completed!"
echo

# Step 4: Finalize the upgrade
echo "Step 4: Finalizing upgrade..."
$NEAR_CLI call $ACCOUNT_ID finalize_upgrade '{}' --account-id $ACCOUNT_ID --network-id $NETWORK
if [ $? -ne 0 ]; then
  echo "Error: Failed to finalize upgrade"
  exit 1
fi
echo "Upgrade finalized successfully!"
echo

# Step 5: Deploy the updated contract
echo "Step 5: Deploying updated contract..."
$NEAR_CLI contract deploy $ACCOUNT_ID use-file ./target/near/rodit_near.wasm with-init-call upgrade json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' network-config $NETWORK sign-with-keychain send
if [ $? -ne 0 ]; then
  echo "Error: Failed to deploy contract"
  exit 1
fi
echo "Contract deployed successfully!"
echo

# Step 6: Resume the contract
echo "Step 6: Resuming contract..."
$NEAR_CLI call $ACCOUNT_ID resume_contract '{}' --account-id $ACCOUNT_ID --network-id $NETWORK
if [ $? -ne 0 ]; then
  echo "Error: Failed to resume contract"
  exit 1
fi
echo "Contract resumed successfully!"
echo

echo "=== Contract Update Process Completed Successfully ==="
echo "The contract has been updated and is now active."
echo "You can now interact with the updated contract."
