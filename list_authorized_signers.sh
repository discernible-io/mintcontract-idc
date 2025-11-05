#!/bin/bash

# Load contract name from account.env
source account.env

echo "=========================================="
echo "RODiT Contract Authorized Signers"
echo "=========================================="
echo ""
echo "Contract: $CONTRACT_NAME"
echo ""

# Get contract configuration
echo "📋 Contract Configuration:"
echo "----------------------------------------"
CONFIG_OUTPUT=$(near view $CONTRACT_NAME get_config --network-id mainnet 2>&1)
echo "$CONFIG_OUTPUT" | sed -n '/Function execution/,/Here is your console/p' | sed '$d'
echo ""

# Get authorized signers
echo "🔑 Authorized Signers (Public Keys):"
echo "----------------------------------------"
SIGNERS_OUTPUT=$(near view $CONTRACT_NAME view_authorized_signers --network-id mainnet 2>&1)

# Extract just the hex keys from the output
SIGNERS=$(echo "$SIGNERS_OUTPUT" | grep -o '"[0-9a-f]\{64\}"' | tr -d '"')

if [ -z "$SIGNERS" ]; then
    echo "❌ No authorized signers found or error querying contract"
    echo ""
    echo "Debug output:"
    echo "$SIGNERS_OUTPUT"
    exit 1
fi

# Count and display signers
COUNT=0
while IFS= read -r signer; do
    if [ ! -z "$signer" ]; then
        COUNT=$((COUNT + 1))
        echo "$COUNT. $signer"
    fi
done <<< "$SIGNERS"

echo ""
echo "Total authorized signers: $COUNT"
echo ""
echo "=========================================="
echo ""
echo "💡 To add a new signer:"
echo "   near call $CONTRACT_NAME add_authorized_signer \\"
echo "     '{\"public_key_hex\": \"YOUR_64_CHAR_HEX_KEY\"}' \\"
echo "     --accountId $CONTRACT_NAME \\"
echo "     --depositYocto 1 \\"
echo "     --gas 300000000000000"
echo ""
echo "💡 To remove a signer:"
echo "   near call $CONTRACT_NAME remove_authorized_signer \\"
echo "     '{\"public_key_hex\": \"YOUR_64_CHAR_HEX_KEY\"}' \\"
echo "     --accountId $CONTRACT_NAME \\"
echo "     --depositYocto 1 \\"
echo "     --gas 300000000000000"
echo ""
