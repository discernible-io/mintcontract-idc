#!/bin/bash

# monitor_contract.sh - Monitor contract status and configuration
# Usage: ./monitor_contract.sh [account_id] [network]

set -e

# Default values
ACCOUNT_ID=${1:-"2026v1-identyclaw-com.near"}
NETWORK=${2:-"mainnet"}

NEAR_CLI=$(which near 2>/dev/null || echo "")
if [ -z "$NEAR_CLI" ]; then
  echo "Error: NEAR CLI not found in PATH"
  echo "Please install NEAR CLI: cargo install near-cli-rs"
  exit 1
fi

echo "=== Contract Security Monitor ==="
echo "Account: $ACCOUNT_ID"
echo "Network: $NETWORK"
echo "Time: $(date)"
echo ""

# Function to call view method and handle errors
call_view() {
    local method=$1
    local args=${2:-"{}"}
    $NEAR_CLI view "$ACCOUNT_ID" "$method" --args "$args" network-config "$NETWORK" now 2>/dev/null || echo "ERROR"
}

# 1. Contract Status
echo "1. Contract Status"
echo "==================="
STATUS=$(call_view "get_contract_status")
if [ "$STATUS" != "ERROR" ]; then
    echo "$STATUS"
    if [[ "$STATUS" != *"Active"* ]]; then
        echo "⚠️  WARNING: Contract is not active!"
    fi
else
    echo "❌ Failed to get contract status"
fi
echo ""

# 2. Contract Configuration
echo "2. Contract Configuration"
echo "========================="
CONFIG=$(call_view "get_config")
if [ "$CONFIG" != "ERROR" ]; then
    echo "$CONFIG" | jq '.' 2>/dev/null || echo "$CONFIG"
else
    echo "❌ Failed to get contract configuration"
fi
echo ""

# 3. Fee Configuration
echo "3. Fee Configuration"
echo "===================="
FEES=$(call_view "get_fees")
if [ "$FEES" != "ERROR" ]; then
    echo "$FEES" | jq '.' 2>/dev/null || echo "$FEES"
else
    echo "❌ Failed to get fee configuration"
fi
echo ""

# 4. Authorized Signers Count
echo "4. Authorized Signers"
echo "====================="
SIGNERS=$(call_view "view_authorized_signers")
if [ "$SIGNERS" != "ERROR" ]; then
    SIGNER_COUNT=$(echo "$SIGNERS" | jq '. | length' 2>/dev/null || echo "unknown")
    echo "Total authorized signers: $SIGNER_COUNT"
    echo ""
    echo "Signer public keys:"
    echo "$SIGNERS" | jq -r '.[]' 2>/dev/null || echo "$SIGNERS"
else
    echo "❌ Failed to get authorized signers"
fi
echo ""

# 5. Upgrade Status
echo "5. Upgrade Status"
echo "================="
UPGRADE_STATUS=$(call_view "get_upgrade_status")
if [ "$UPGRADE_STATUS" != "ERROR" ]; then
    if [ "$UPGRADE_STATUS" = "null" ] || [ -z "$UPGRADE_STATUS" ]; then
        echo "✓ No pending upgrade"
    else
        echo "⚠️  Upgrade in progress!"
        echo "Remaining time: $UPGRADE_STATUS seconds"
    fi
else
    echo "❌ Failed to get upgrade status"
fi
echo ""

# 6. Contract Stats
echo "6. Contract Statistics"
echo "======================"
STATS=$(call_view "get_contract_stats")
if [ "$STATS" != "ERROR" ]; then
    echo "$STATS" | jq '.' 2>/dev/null || echo "$STATS"
else
    echo "❌ Failed to get contract stats"
fi
echo ""

# 7. Total Supply
echo "7. Token Supply"
echo "==============="
SUPPLY=$(call_view "rodit_total_supply")
if [ "$SUPPLY" != "ERROR" ]; then
    echo "Total tokens minted: $SUPPLY"
else
    echo "❌ Failed to get total supply"
fi
echo ""

# Security Recommendations
echo "=== Security Recommendations ==="
echo ""

# Check if contract is active
if [[ "$STATUS" == *"Active"* ]]; then
    echo "✓ Contract is active"
else
    echo "⚠️  Review contract status - should be 'Active' for normal operations"
fi

# Check signer count
if [ "$SIGNER_COUNT" != "unknown" ] && [ "$SIGNER_COUNT" -gt 0 ]; then
    echo "✓ Authorized signers configured ($SIGNER_COUNT)"
    if [ "$SIGNER_COUNT" -gt 5 ]; then
        echo "  ⚠️  Consider reviewing: $SIGNER_COUNT signers may be excessive"
    fi
else
    echo "⚠️  No authorized signers found - minting will fail"
fi

# Check for pending upgrade
if [ "$UPGRADE_STATUS" != "null" ] && [ -n "$UPGRADE_STATUS" ] && [ "$UPGRADE_STATUS" != "ERROR" ]; then
    echo "⚠️  Pending upgrade detected - review upgrade proposal"
fi

echo ""
echo "=== Monitor Complete ==="
echo ""
echo "To run this monitor periodically:"
echo "  watch -n 60 ./monitor_contract.sh $ACCOUNT_ID $NETWORK"
echo ""
