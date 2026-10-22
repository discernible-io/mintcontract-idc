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
#   verify|status <account_id> [network] [rpc_url]
#       Calls read-only contract methods to verify deployed contract state
#
#   burn-tokens <account_id> [network] [rpc_url] [keep_count]
#       Burns all rodit tokens except the last N minted (default: 2).
#       Requires contract owner credentials (rodit_burn is owner-only).
#
#   help | --help | -h
#       Displays detailed usage information

set -euo pipefail

VERSION="1.0.0"

# Derive contract name and wasm path from project files so there is only
# one place to update (local account.env / Cargo.toml).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "$SCRIPT_DIR/account.env" ]]; then
  # Load only CONTRACT_NAME=value (do not eval arbitrary shell).
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      ''|\#*) continue ;;
      CONTRACT_NAME=*)
        CONTRACT_NAME="${line#CONTRACT_NAME=}"
        CONTRACT_NAME="${CONTRACT_NAME%\"}"
        CONTRACT_NAME="${CONTRACT_NAME#\"}"
        ;;
    esac
  done < "$SCRIPT_DIR/account.env"
fi
DEFAULT_ACCOUNT="${CONTRACT_NAME:-}"

# Wasm artifact name: Cargo turns hyphens into underscores.
CARGO_PKG_NAME=$(grep '^name' "$SCRIPT_DIR/Cargo.toml" | head -1 | sed 's/.*= *"//;s/"//')
WASM_FILE="./target/near/${CARGO_PKG_NAME//-/_}.wasm"

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

view_contract_method() {
  local method=$1
  local output

  echo "--- $method ---"
  if ! output=$($NEAR_CLI view "$ACCOUNT_ID" "$method" --network-id "$NETWORK" 2>&1); then
    echo "ERROR: Failed to call $method"
    echo "$output"
    echo ""
    return 1
  fi

  echo "$output"
  echo ""
}

verify_contract() {
  local failed=0
  local methods=(
    "rodit_metadata"
    "get_contract_status"
    "get_config"
    "get_fees"
    "get_contract_stats"
    "rodit_total_supply"
    "view_authorized_signers"
  )

  echo "=== Contract Verification ==="
  echo "Account ID: $ACCOUNT_ID"
  echo "Network Connection: $NETWORK"
  echo ""

  for method in "${methods[@]}"; do
    if ! view_contract_method "$method"; then
      failed=1
    fi
  done

  if [ "$failed" -ne 0 ]; then
    echo "Contract verification completed with errors."
    return 1
  fi

  echo "Contract verification completed successfully."
}

extract_near_json() {
  sed -n '/^Function execution return value/,$p' | tail -n +2 | sed '/^Here is your console command/,$d' | sed 's/\x1b\[[0-9;]*m//g'
}

fetch_all_token_ids() {
  local from_index=0
  local page_size=50
  local token_ids=()
  local raw_output page_json token_count i token_id

  while true; do
    if ! raw_output=$($NEAR_CLI view "$ACCOUNT_ID" rodit_tokens \
      "{\"from_index\":\"$from_index\",\"limit\":$page_size}" \
      --network-id "$NETWORK" 2>&1); then
      echo "ERROR: Failed to fetch tokens at index $from_index" >&2
      echo "$raw_output" >&2
      return 1
    fi

    page_json=$(echo "$raw_output" | extract_near_json)

    token_count=$(echo "$page_json" | jq 'length' 2>/dev/null || echo "0")
    if [ "$token_count" -eq 0 ]; then
      break
    fi

    for ((i = 0; i < token_count; i++)); do
      token_id=$(echo "$page_json" | jq -r ".[$i].token_id")
      token_ids+=("$token_id")
    done

    if [ "$token_count" -lt "$page_size" ]; then
      break
    fi
    from_index=$((from_index + page_size))
  done

  printf '%s\n' "${token_ids[@]}"
}

burn_tokens_except_last() {
  local keep_count="${1:-2}"

  if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required for burn-tokens command"
    exit 1
  fi

  if ! [[ "$keep_count" =~ ^[0-9]+$ ]]; then
    echo "Error: keep_count must be a non-negative integer (got '$keep_count')"
    exit 1
  fi

  echo "=== Burn RODIT Tokens ==="
  echo "Account ID: $ACCOUNT_ID"
  echo "Network Connection: $NETWORK"
  echo "Keeping last $keep_count token(s)"
  echo ""

  local all_tokens=()
  while IFS= read -r line; do
    [ -n "$line" ] && all_tokens+=("$line")
  done < <(fetch_all_token_ids)

  local total=${#all_tokens[@]}
  echo "Total tokens on contract: $total"

  if [ "$total" -le "$keep_count" ]; then
    echo "Nothing to burn (total <= keep_count)."
    return 0
  fi

  local burn_count=$((total - keep_count))
  local tokens_to_burn=("${all_tokens[@]:0:burn_count}")
  local tokens_to_keep=("${all_tokens[@]: -keep_count}")

  echo "Tokens to keep:"
  for token_id in "${tokens_to_keep[@]}"; do
    echo "  ✓ $token_id"
  done
  echo ""
  echo "Tokens to burn ($burn_count):"
  for token_id in "${tokens_to_burn[@]}"; do
    echo "  ✗ $token_id"
  done
  echo ""

  local burned=0 failed=0
  for token_id in "${tokens_to_burn[@]}"; do
    echo "Burning: $token_id"
    local args
    args=$(jq -nc --arg token_id "$token_id" '{token_id: $token_id}')
    if $NEAR_CLI call "$ACCOUNT_ID" rodit_burn "$args" \
      --use-account "$ACCOUNT_ID" \
      --network-id "$NETWORK" \
      --gas 100000000000000 \
      --depositYocto 1; then
      echo "✓ Burned successfully"
      burned=$((burned + 1))
    else
      echo "✗ Failed to burn $token_id"
      failed=$((failed + 1))
    fi
    echo ""
  done

  echo "=== Burn Summary ==="
  echo "Burned: $burned"
  echo "Failed: $failed"
  echo "Kept:   $keep_count"

  if [ "$failed" -gt 0 ]; then
    return 1
  fi
}

print_help() {
  local acct="${DEFAULT_ACCOUNT:-<account_id>.near}"
  cat <<EOF
RODIT Contract Deployment & Signer Management Script v${VERSION}
================================================================

USAGE:
  ./deploy.sh help|--help|-h
  ./deploy.sh deploy <account_id> [network] [rpc_url]
  ./deploy.sh add-signers <account_id> [network] [rpc_url] <signer1> [signer2] ...
  ./deploy.sh verify|status <account_id> [network] [rpc_url]
  ./deploy.sh burn-tokens <account_id> [network] [rpc_url] [keep_count]

COMMANDS:
  deploy       Build and deploy/upgrade the contract code for the specified account.
               - Performs initial deployment if the contract is not initialized.
               - Performs upgrade workflow if a contract already exists.
               - Does not modify authorized signers.

  add-signers  Adds one or more authorized Ed25519 signer public keys (64-char hex).
               - Use implicit account IDs (the lowercase hex public key).
               - Can be called at any time after deployment.

  verify       Calls read-only contract methods to verify deployed contract state.
  status       Alias for verify.

  burn-tokens  Burns all rodit tokens except the last N minted (default: 2).
               Uses rodit_tokens pagination and rodit_burn (contract owner only).

ARGUMENTS:
  account_id   NEAR account ID that owns the contract (e.g., ${acct})
  network      Optional network connection name (default: testnet)
  rpc_url      Optional custom RPC endpoint URL (pass "" to skip)
  signerN      Authorized signer public keys to add (64 lowercase hex characters)
  keep_count   Number of most recently minted tokens to retain (default: 2)

NOTES:
  • The default account comes from account.env (CONTRACT_NAME).
  • Authorized signers can also be added manually:
      near call <account_id> add_authorized_signer '{"public_key_hex":"<64-char-hex>"}' \
        --accountId <account_id> --networkId <network> --depositYocto 1
  • Use 'near config show-connections' to list configured network connections.
  • Provide a custom RPC URL to temporarily register a bespoke connection.

EXAMPLES:
  1. Initial deployment to testnet (no custom RPC):
       ./deploy.sh deploy ${acct}

  2. Upgrade existing contract on mainnet:
       ./deploy.sh deploy ${acct} mainnet

  3. Deploy using a custom RPC endpoint:
       ./deploy.sh deploy ${acct} mainnet-custom https://rpc.mainnet.near.org

  4. Add authorized signers on testnet (no custom RPC):
       ./deploy.sh add-signers ${acct} testnet "" \\
         76177d5ebd89f329945ab8991357018f44ab0fe12f7a8216c6054e565e80a7aa \\
         43d3c5b5e77a46b52933bc7a8b79b06f16dd4ca3cfbacd0e6fede0e7e01782ac \\
         3467c4e8f5b0445d474742f976d24ca1991d843f58d8b9aaf45e6b6b8ff6603a

  5. Add signers using default network (testnet) — network argument omitted:
       ./deploy.sh add-signers ${acct} \\
         76177d5ebd89f329945ab8991357018f44ab0fe12f7a8216c6054e565e80a7aa

  6. Verify deployed contract state:
       ./deploy.sh verify ${acct} mainnet

  7. Burn all tokens except the last two minted:
       ./deploy.sh burn-tokens ${acct} mainnet

EOF
}

KEEP_COUNT=2

# Detect NEAR CLI command
NEAR_CLI="near"
if ! command -v "$NEAR_CLI" >/dev/null 2>&1; then
  echo "Error: NEAR CLI not found in PATH"
  echo "Please install NEAR CLI and ensure it is available as 'near'."
  exit 1
fi

# Default values
NETWORK="testnet"
CUSTOM_RPC_URL=""
UPGRADE_DELAY_SECONDS=86400  # 24 hours
POLLING_INTERVAL=300  # Check status every 5 minutes
BUFFER_SECONDS=30  # Add a small buffer to the delay time
# Initial storage deposit for fresh accounts (can override via INIT_DEPOSIT env)
INIT_DEPOSIT=${INIT_DEPOSIT:-"1 NEAR"}

AUTHORIZED_SIGNERS=()

COMMAND="${1:-}"
shift || true

case "$COMMAND" in
  ""|"help"|"--help"|"-h")
    print_help
    exit 0
    ;;
  "deploy")
    if [ -z "${1:-}" ]; then
      echo "Error: account_id is required for deploy command"
      echo "Run './deploy.sh help' for usage information."
      exit 1
    fi
    ACCOUNT_ID=$1
    shift

    if [ -n "${1:-}" ]; then
      NETWORK=$1
      shift
    fi

    if [ -n "${1:-}" ]; then
      CUSTOM_RPC_URL=$1
      shift
    fi

    if [ $# -gt 0 ]; then
      echo "Warning: Extra arguments ignored for deploy command: $@"
    fi
    ;;
  "add-signers")
    if [ -z "${1:-}" ]; then
      echo "Error: account_id is required for add-signers command"
      echo "Run './deploy.sh help' for usage information."
      exit 1
    fi
    ACCOUNT_ID=$1
    shift

    if [ -n "${1:-}" ] && [[ ! ${1:-} =~ ^[0-9a-f]{64}$ ]]; then
      NETWORK=$1
      shift
    fi

    if [ -n "${1:-}" ] && [[ ! ${1:-} =~ ^[0-9a-f]{64}$ ]]; then
      CUSTOM_RPC_URL=$1
      shift
    fi

    AUTHORIZED_SIGNERS=("$@")
    if [ ${#AUTHORIZED_SIGNERS[@]} -eq 0 ]; then
      echo "Error: At least one signer public key must be provided for add-signers command"
      exit 1
    fi
    ;;
  "verify"|"status")
    if [ -z "${1:-}" ]; then
      echo "Error: account_id is required for $COMMAND command"
      echo "Run './deploy.sh help' for usage information."
      exit 1
    fi
    ACCOUNT_ID=$1
    shift

    if [ -n "${1:-}" ]; then
      NETWORK=$1
      shift
    fi

    if [ -n "${1:-}" ]; then
      CUSTOM_RPC_URL=$1
      shift
    fi

    if [ $# -gt 0 ]; then
      echo "Warning: Extra arguments ignored for $COMMAND command: $@"
    fi
    ;;
  "burn-tokens")
    if [ -z "${1:-}" ]; then
      echo "Error: account_id is required for burn-tokens command"
      echo "Run './deploy.sh help' for usage information."
      exit 1
    fi
    ACCOUNT_ID=$1
    shift

    if [ -n "${1:-}" ] && [[ ! ${1:-} =~ ^[0-9]+$ ]]; then
      NETWORK=$1
      shift
    fi

    if [ -n "${1:-}" ] && [[ ! ${1:-} =~ ^[0-9]+$ ]]; then
      CUSTOM_RPC_URL=$1
      shift
    fi

    if [ -n "${1:-}" ] && [[ ${1:-} =~ ^[0-9]+$ ]]; then
      KEEP_COUNT=$1
      shift
    fi

    if [ $# -gt 0 ]; then
      echo "Warning: Extra arguments ignored for burn-tokens command: $@"
    fi
    ;;
  *)
    echo "Error: Unknown command '$COMMAND'"
    echo "Run './deploy.sh help' for usage information."
    exit 1
    ;;
esac

# RPC selection must be auditable (allowed-fallback / rpc-configuration standards).
# Prefer an explicit rpc_url argument, else NEAR_NETWORK_CONFIG, else the named
# connection as given. Do not silently rewrite mainnet/testnet to FastNEAR.
RPC_SELECTION_SOURCE="named-connection"
if [[ -n "$CUSTOM_RPC_URL" ]]; then
  RPC_SELECTION_SOURCE="cli-rpc-url"
elif [[ -n "${NEAR_NETWORK_CONFIG:-}" ]]; then
  NETWORK="$NEAR_NETWORK_CONFIG"
  RPC_SELECTION_SOURCE="NEAR_NETWORK_CONFIG"
elif [[ "$NETWORK" == "mainnet" || "$NETWORK" == "testnet" ]]; then
  echo "RPC selection: using NEAR CLI connection '${NETWORK}' without rewriting to FastNEAR."
  echo "Set NEAR_NETWORK_CONFIG=mainnet-fastnear|mainnet-lava|... or pass rpc_url to register a custom endpoint."
fi

echo "RPC selection: source=${RPC_SELECTION_SOURCE} network=${NETWORK} custom_rpc=${CUSTOM_RPC_URL:-"(none)"}"

if [[ -n "$CUSTOM_RPC_URL" ]]; then
  add_custom_network_connection
fi

if [ "$COMMAND" = "add-signers" ]; then
  add_signers_to_contract
  exit 0
fi

if [ "$COMMAND" = "verify" ] || [ "$COMMAND" = "status" ]; then
  verify_contract
  exit 0
fi

if [ "$COMMAND" = "burn-tokens" ]; then
  burn_tokens_except_last "$KEEP_COUNT"
  exit $?
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
  if ! $NEAR_CLI contract deploy "$ACCOUNT_ID" use-file "$WASM_FILE" without-init-call network-config "$NETWORK" sign-with-legacy-keychain send; then
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
$NEAR_CLI contract deploy $ACCOUNT_ID use-file "$WASM_FILE" with-init-call upgrade json-args '{}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' network-config $NETWORK sign-with-legacy-keychain send
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
