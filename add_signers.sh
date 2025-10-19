#!/bin/bash

# Load contract name from account.env
source account.env

# Authorized signers to add
SIGNER_1="07b9a85559d60428b52d0eb4cad37447eca3c19a3feeaf14696b2ce2f11f3ae0"
SIGNER_2="16a4b17da4acfbca0035106b1215c2933ac2fc713a13fa86a600b7935f99256f"

echo "Adding authorized signers to contract: $CONTRACT_NAME"
echo ""

# Add first signer
echo "Adding signer 1: $SIGNER_1"
near call $CONTRACT_NAME add_authorized_signer \
  '{"public_key_hex": "'"$SIGNER_1"'"}' \
  --accountId $CONTRACT_NAME \
  --depositYocto 1 \
  --gas 300000000000000

echo ""
echo "Waiting 2 seconds..."
sleep 2
echo ""

# Add second signer
echo "Adding signer 2: $SIGNER_2"
near call $CONTRACT_NAME add_authorized_signer \
  '{"public_key_hex": "'"$SIGNER_2"'"}' \
  --accountId $CONTRACT_NAME \
  --depositYocto 1 \
  --gas 300000000000000

echo ""
echo "Done! Verifying authorized signers..."
echo ""

# View all authorized signers
near view $CONTRACT_NAME view_authorized_signers
