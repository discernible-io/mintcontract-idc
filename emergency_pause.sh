#!/bin/bash

# emergency_pause.sh - Emergency contract pause script
# Usage: ./emergency_pause.sh [account_id] [network] [action]
# Actions: pause, resume, status

set -e

ACCOUNT_ID=${1:-"2026v1-identyclaw-com.near"}
NETWORK=${2:-"mainnet"}
ACTION=${3:-"status"}

NEAR_CLI=$(which near 2>/dev/null || echo "")
if [ -z "$NEAR_CLI" ]; then
  echo "Error: NEAR CLI not found in PATH"
  exit 1
fi

echo "=== Emergency Contract Control ==="
echo "Account: $ACCOUNT_ID"
echo "Network: $NETWORK"
echo "Action: $ACTION"
echo ""

case "$ACTION" in
  "status")
    echo "Checking contract status..."
    $NEAR_CLI view "$ACCOUNT_ID" get_contract_status network-config "$NETWORK" now
    echo ""
    echo "To pause: ./emergency_pause.sh $ACCOUNT_ID $NETWORK pause"
    echo "To resume: ./emergency_pause.sh $ACCOUNT_ID $NETWORK resume"
    ;;
    
  "pause")
    echo "⚠️  WARNING: This will PAUSE the contract!"
    echo "All minting, transfers, and burns will be disabled."
    echo ""
    read -p "Are you sure you want to pause? (type 'YES' to confirm): " CONFIRM
    
    if [ "$CONFIRM" != "YES" ]; then
      echo "Pause cancelled."
      exit 0
    fi
    
    echo ""
    echo "Pausing contract..."
    $NEAR_CLI call "$ACCOUNT_ID" pause_contract '{}' \
      --use-account "$ACCOUNT_ID" \
      --network-id "$NETWORK" \
      --gas 100000000000000 \
      --depositYocto 1
    
    echo ""
    echo "✓ Contract paused successfully"
    echo "To resume: ./emergency_pause.sh $ACCOUNT_ID $NETWORK resume"
    ;;
    
  "resume")
    echo "Resuming contract operations..."
    echo ""
    read -p "Confirm resume? (type 'YES' to confirm): " CONFIRM
    
    if [ "$CONFIRM" != "YES" ]; then
      echo "Resume cancelled."
      exit 0
    fi
    
    echo ""
    echo "Resuming contract..."
    $NEAR_CLI call "$ACCOUNT_ID" resume_contract '{}' \
      --use-account "$ACCOUNT_ID" \
      --network-id "$NETWORK" \
      --gas 100000000000000 \
      --depositYocto 1
    
    echo ""
    echo "✓ Contract resumed successfully"
    ;;
    
  *)
    echo "Error: Unknown action '$ACTION'"
    echo "Valid actions: status, pause, resume"
    exit 1
    ;;
esac

echo ""
