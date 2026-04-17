#!/bin/bash

# deploy.sh - Automates the NEAR contract deployment, upgrade, and signer management
# Version: 1.0.0
# Usage: ./deploy.sh <command> [arguments]
#
# Commands:
#   deploy <account_id> [network] [rpc_url]
#       Builds the contract and performs deploy/upgrade workflow for the specified account
#
#   add-signers <account_id> [network] [rpc_url] <signer1> [signer2] ...
#       Adds one or more authorized signer public keys to the contract
#
#   help | --help | -h
#       Displays detailed usage information

set -e  # Exit on any error

VERSION="1.0.0"

add_custom_network_connection() {
  local connection_name="$NETWORK"
  local rpc_url="$CUSTOM_RPC_URL"

  if [ -z "$rpc_url" ]; then
    return
  fi

  local base_network
  if [[ "$connection_name" == mainnet* ]]; then
    base_network="mainnet"
  elif [[ "$connection_name" == testnet* ]]; then
    base_network="testnet"
  else
    base_network="$connection_name"
  fi

  echo "Checking network connection: $connection_name"
  echo "RPC URL: $rpc_url"
  echo "Base network: $base_network"

  # Check if connection already exists in the config file
  local config_file="$HOME/.config/near-cli/config.toml"
  if [ -f "$config_file" ] && grep -q "\[network_connection\.$connection_name\]" "$config_file"; then
    echo "Network connection '$connection_name' already exists. Skipping configuration."
    echo ""
    return
  fi

  echo "Adding custom network connection: $connection_name"

  # Use printf with down arrow and enter to select "No" (second option)
  printf "\033[B\n" | $NEAR_CLI config add-connection \
    --network-name "$base_network" \
    --connection-name "$connection_name" \
    --rpc-url "$rpc_url" \
    --wallet-url "https://app.mynearwallet.com/" \
    --explorer-transaction-url "https://explorer.near.org/transactions/" 2>/dev/null

  if [ $? -ne 0 ]; then
    echo "Warning: Failed to add custom network connection. Proceeding with existing configuration."
  fi
  echo ""
}

add_signers_to_contract() {
  if [ ${#AUTHORIZED_SIGNERS[@]} -eq 0 ]; then
    echo "No authorized signers provided. Nothing to add."
    return 0
  fi

  echo "Adding authorized signers to $ACCOUNT_ID on $NETWORK ..."
  for signer in "${AUTHORIZED_SIGNERS[@]}"; do
    if [[ ! $signer =~ ^[0-9a-f]{64}$ ]]; then
      echo "Warning: Invalid signer format '$signer' (must be 64 lowercase hex characters), skipping..."
      continue
    fi

    echo "Adding authorized signer: $signer"
    $NEAR_CLI call $ACCOUNT_ID add_authorized_signer '{"public_key_hex":"'$signer'"}' --use-account $ACCOUNT_ID --network-id $NETWORK --gas 100000000000000 --depositYocto 1
    if [ $? -ne 0 ]; then
      echo "Warning: Failed to add signer $signer (may already exist or invalid)"
    else
      echo "✓ Signer added successfully"
    fi
  done
  echo "Authorized signer processing completed!"
  echo ""
}

print_help() {
  cat <<EOF
RODIT Contract Deployment & Signer Management Script v${VERSION}
================================================================

USAGE:
  ./deploy.sh help|--help|-h
  ./deploy.sh deploy <account_id> [network] [rpc_url]
  ./deploy.sh add-signers <account_id> [network] [rpc_url] <signer1> [signer2] ...

COMMANDS:
  deploy       Build and deploy/upgrade the contract code for the specified account.
               - Performs initial deployment if the contract is not initialized.
               - Performs upgrade workflow if a contract already exists.
               - Does not modify authorized signers.

  add-signers  Adds one or more authorized Ed25519 signer public keys (64-char hex).
               - Use implicit account IDs (the lowercase hex public key).
               - Can be called at any time after deployment.

ARGUMENTS:
  account_id   NEAR account ID that owns the contract (e.g., 2026v1-identyclaw-com.near)
  network      Optional network connection name (default: testnet)
  rpc_url      Optional custom RPC endpoint URL (pass "" to skip)
  signerN      Authorized signer public keys to add (64 lowercase hex characters)

NOTES:
  • Authorized signers can also be added manually:
      near call <account_id> add_authorized_signer '{"public_key_hex":"<64-char-hex>"}' \
        --accountId <account_id> --networkId <network> --depositYocto 1
  • Use 'near config show-connections' to list configured network connections.
  • Provide a custom RPC URL to temporarily register a bespoke connection.

EXAMPLES:
  1. Initial deployment to testnet (no custom RPC):
       ./deploy.sh deploy 2026v1-identyclaw-com.near

  2. Upgrade existing contract on mainnet:
       ./deploy.sh deploy 2026v1-identyclaw-com.near mainnet

  3. Deploy using a custom RPC endpoint:
       ./deploy.sh deploy 2026v1-identyclaw-com.near mainnet-custom https://rpc.mainnet.near.org

  4. Add authorized signers on testnet (no custom RPC):
       ./deploy.sh add-signers 2026v1-identyclaw-com.near testnet "" \
         76177d5ebd89f329945ab8991357018f44ab0fe12f7a8216c6054e565e80a7aa \
         43d3c5b5e77a46b52933bc7a8b79b06f16dd4ca3cfbacd0e6fede0e7e01782ac \
         3467c4e8f5b0445d474742f976d24ca1991d843f58d8b9aaf45e6b6b8ff6603a

  5. Add signers using default network (testnet) — network argument omitted:
       ./deploy.sh add-signers 2026v1-identyclaw-com.near \
         76177d5ebd89f329945ab8991357018f44ab0fe12f7a8216c6054e565e80a7aa

EOF
}

# Detect NEAR CLI location
NEAR_CLI=$(which near 2>/dev/null || echo "")
if [ -z "$NEAR_CLI" ]; then
  echo "Error: NEAR CLI not found in PATH"
  echo "Please install NEAR CLI: cargo install near-cli-rs"
  exit 1
fi

# Default values
NETWORK="testnet"
CUSTOM_RPC_URL=""
UPGRADE_DELAY_SECONDS=30  # 1/2 minutes
POLLING_INTERVAL=10  # Check status every 10 seconds
BUFFER_SECONDS=10  # Add a small buffer to the delay time
# Initial storage deposit for fresh accounts (can override via INIT_DEPOSIT env)
INIT_DEPOSIT=${INIT_DEPOSIT:-"1 NEAR"}
# FastNEAR RPC endpoints (recommended)
FASTNEAR_MAINNET_RPC="https://free.rpc.fastnear.com/"
FASTNEAR_TESTNET_RPC="https://free.rpc.fastnear.com/"

AUTHORIZED_SIGNERS=()

COMMAND=$1
shift || true

case "$COMMAND" in
  ""|"help"|"--help"|"-h")
    print_help
    exit 0
    ;;
  "deploy")
    if [ -z "$1" ]; then
      echo "Error: account_id is required for deploy command"
      echo "Run './deploy.sh help' for usage information."
      exit 1
    fi
    ACCOUNT_ID=$1
    shift

    if [ -n "$1" ]; then
      NETWORK=$1
      shift
    fi

    if [ -n "$1" ]; then
      CUSTOM_RPC_URL=$1
      shift
    fi

    if [ $# -gt 0 ]; then
      echo "Warning: Extra arguments ignored for deploy command: $@"
    fi
    ;;
  "add-signers")
    if [ -z "$1" ]; then
      echo "Error: account_id is required for add-signers command"
      echo "Run './deploy.sh help' for usage information."
      exit 1
    fi
    ACCOUNT_ID=$1
    shift

    if [ -n "$1" ] && [[ ! $1 =~ ^[0-9a-f]{64}$ ]]; then
      NETWORK=$1
      shift
    fi

    if [ -n "$1" ] && [[ ! $1 =~ ^[0-9a-f]{64}$ ]]; then
      CUSTOM_RPC_URL=$1
      shift
    fi

    AUTHORIZED_SIGNERS=("$@")
    if [ ${#AUTHORIZED_SIGNERS[@]} -eq 0 ]; then
      echo "Error: At least one signer public key must be provided for add-signers command"
      exit 1
    fi
    ;;
  *)
    echo "Error: Unknown command '$COMMAND'"
    echo "Run './deploy.sh help' for usage information."
    exit 1
    ;;
esac

# Configure custom RPC connection if provided, otherwise use FastNEAR by default
if [ -z "$CUSTOM_RPC_URL" ]; then
  # Use FastNEAR RPC by default
  if [[ "$NETWORK" == "mainnet"* ]]; then
    CUSTOM_RPC_URL="$FASTNEAR_MAINNET_RPC"
    NETWORK="mainnet-fastnear"
  elif [[ "$NETWORK" == "testnet"* ]]; then
    CUSTOM_RPC_URL="$FASTNEAR_TESTNET_RPC"
    NETWORK="testnet-fastnear"
  fi
fi

if [ -n "$CUSTOM_RPC_URL" ]; then
  add_custom_network_connection
fi

if [ "$COMMAND" = "add-signers" ]; then
  add_signers_to_contract
  exit 0
fi

echo "=== Contract Update Process ==="
echo "Account ID: $ACCOUNT_ID"
echo "Network Connection: $NETWORK"
echo ""

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

# Step 0.5: Pin dependencies to versions compatible with Rust 1.86.0
# This is needed because newer versions of darling (0.23+) and serde_with (3.18+)
# require Rust 1.88.0, but near-sdk uses loose version constraints (e.g., "3" for serde_with)
# which causes Cargo to resolve to the latest incompatible versions.
echo "Step 0.5: Pinning dependencies to Rust 1.86.0-compatible versions..."
cargo update --package serde_with --precise 3.17.0 2>/dev/null || true
cargo update --package serde_with_macros --precise 3.17.0 2>/dev/null || true
cargo update --package darling --precise 0.20.10 2>/dev/null || true
cargo update --package darling_core --precise 0.20.10 2>/dev/null || true
cargo update --package darling_macro --precise 0.20.10 2>/dev/null || true
echo "Dependencies pinned successfully."
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
  if ! $NEAR_CLI contract deploy "$ACCOUNT_ID" use-file ./target/near/contract_2026v1_identyclaw_com_near.wasm without-init-call network-config "$NETWORK" sign-with-legacy-keychain send; then
    echo "Error: Failed to deploy code."
    echo "Hint: Ensure the account $ACCOUNT_ID has enough NEAR to cover code storage (typically ~1 NEAR on testnet)."
    exit 1
  fi

  # Step B: Initialize (init is not payable; attach 0 NEAR)
  echo "Calling init ..."
  if ! $NEAR_CLI call "$ACCOUNT_ID" init '{"owner_id":"'$ACCOUNT_ID'","metadata":null}' --use-account "$ACCOUNT_ID" --network-id "$NETWORK" --gas 100000000000000 --deposit 0; then
    echo "Error: init call failed"
    exit 1
  fi

  echo "Initial deployment completed successfully!"
  echo "Contract is initialized and active."
  echo
  
  echo "Authorized signers were not modified." 
  echo "To add or update signers, run:"
  echo "  ./deploy.sh add-signers $ACCOUNT_ID $NETWORK $CUSTOM_RPC_URL <signer1> [signer2] ..."
  echo

  exit 0
fi

# Step 2: Propose the upgrade
echo "Step 2: Proposing upgrade..."
$NEAR_CLI call $ACCOUNT_ID propose_upgrade '{}' --use-account $ACCOUNT_ID --network-id $NETWORK --gas 100000000000000 --deposit 0
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
  REMAINING=$($NEAR_CLI view $ACCOUNT_ID get_upgrade_status --network-id $NETWORK 2>/dev/null | tail -n 1 | tr -d ' ')
  
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
    FINAL_CHECK=$($NEAR_CLI view $ACCOUNT_ID get_upgrade_status --network-id $NETWORK 2>/dev/null | tail -n 1 | tr -d ' ')
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
$NEAR_CLI call $ACCOUNT_ID finalize_upgrade '{}' --use-account $ACCOUNT_ID --network-id $NETWORK --gas 100000000000000 --deposit 0
if [ $? -ne 0 ]; then
  echo "Error: Failed to finalize upgrade"
  exit 1
fi
echo "Upgrade finalized successfully!"
echo

# Step 5: Deploy the updated contract
echo "Step 5: Deploying updated contract..."
$NEAR_CLI contract deploy $ACCOUNT_ID use-file ./target/near/contract_2026v1_identyclaw_com_near.wasm with-init-call upgrade json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' network-config $NETWORK sign-with-legacy-keychain send
if [ $? -ne 0 ]; then
  echo "Error: Failed to deploy contract"
  exit 1
fi
echo "Contract deployed successfully!"
echo

# Step 6: Resume the contract
echo "Step 6: Resuming contract..."
$NEAR_CLI call $ACCOUNT_ID resume_contract '{}' --use-account $ACCOUNT_ID --network-id $NETWORK --gas 100000000000000 --depositYocto 1
if [ $? -ne 0 ]; then
  echo "Error: Failed to resume contract"
  exit 1
fi
echo "Contract resumed successfully!"
echo

echo "=== Contract Update Process Completed Successfully ==="
echo "The contract has been updated and is now active."
echo

# Step 7: Add authorized signers (if provided)
if [ ${#AUTHORIZED_SIGNERS[@]} -gt 0 ]; then
  echo "Step 7: Adding authorized signers..."
  for signer in "${AUTHORIZED_SIGNERS[@]}"; do
    # Validate signer format (64 hex characters)
    if [[ ! $signer =~ ^[0-9a-f]{64}$ ]]; then
      echo "Warning: Invalid signer format '$signer' (must be 64 lowercase hex characters), skipping..."
      continue
    fi
    
    echo "Adding authorized signer: $signer"
    $NEAR_CLI call $ACCOUNT_ID add_authorized_signer '{"public_key_hex":"'$signer'"}' --use-account $ACCOUNT_ID --network-id $NETWORK --gas 100000000000000 --depositYocto 1
    if [ $? -ne 0 ]; then
      echo "Warning: Failed to add signer $signer (may already exist or invalid)"
    else
      echo "✓ Signer added successfully"
    fi
  done
  echo "Authorized signers processing completed!"
  echo
else
  echo "No authorized signers provided, skipping Step 7."
  echo "You can add signers later with: near call $ACCOUNT_ID add_authorized_signer '{\"public_key_hex\":\"<64-char-hex>\"}'"
  echo
fi

echo "You can now interact with the updated contract."
