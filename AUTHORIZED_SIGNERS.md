# Authorized Signers for RODiT Contract

**Contract**: `identyclaw-com.near`  
**Network**: NEAR Mainnet  
**Last Updated**: November 5, 2026

---

## Current Authorized Signers

The following Ed25519 public keys are authorized to sign fee data for minting operations:

### 1. Primary Signer
```
76177d5ebd89f329945ab8991357018f44ab0fe12f7a8216c6054e565e80a7aa
```

### 2. Secondary Signer
```
43d3c5b5e77a46b52933bc7a8b79b06f16dd4ca3cfbacd0e6fede0e7e01782ac
```

---

## Contract Configuration

- **Owner**: `identyclaw-com.near`
- **Status**: Active
- **Version**: Discernible-near.org-20260404
- **Total Authorized Signers**: 2

### Fee Configuration
- **Initialize Fee**: 0.0001 NEAR (100000000000000000000 yoctoNEAR)
- **Contract Fee Percentage**: 1%
- **Storage Cost Per Byte**: 0.00001 NEAR (10000000000000000000 yoctoNEAR)

---

## How Signature Verification Works

1. **Fee Data Signing**: When minting a token, the fee data (including token_id, mintingfee, and account information) must be signed by one of the authorized signers.

2. **Signature Format**: The signature must be:
   - Ed25519 signature
   - Base64URL encoded
   - Signed over the SHA-512 hash of the canonicalized JSON fee data

3. **Verification Process**: The contract's `verify_fee_signature()` function:
   - Decodes the base64url signature
   - Parses and canonicalizes the fee data JSON
   - Calculates SHA-512 hash of the canonical JSON
   - Attempts verification with each authorized public key
   - Succeeds if any authorized key validates the signature

---

## Managing Authorized Signers

### View Current Signers

```bash
near view identyclaw-com.near view_authorized_signers --network-id mainnet
```

Or use the provided script:
```bash
./list_authorized_signers.sh
```

### Add a New Signer

```bash
near call identyclaw-com.near add_authorized_signer \
  '{"public_key_hex": "YOUR_64_CHAR_HEX_PUBLIC_KEY"}' \
  --accountId identyclaw-com.near \
  --depositYocto 1 \
  --gas 300000000000000 \
  --network-id mainnet
```

**Requirements**:
- Must be called by contract owner
- Public key must be 64-character lowercase hexadecimal string
- Requires exactly 1 yoctoNEAR deposit (security measure)

### Remove a Signer

```bash
near call identyclaw-com.near remove_authorized_signer \
  '{"public_key_hex": "YOUR_64_CHAR_HEX_PUBLIC_KEY"}' \
  --accountId identyclaw-com.near \
  --depositYocto 1 \
  --gas 300000000000000 \
  --network-id mainnet
```

**Requirements**:
- Must be called by contract owner
- Requires exactly 1 yoctoNEAR deposit (security measure)

---

## Security Notes

1. **Key Format**: Public keys are stored as raw 32-byte Ed25519 public keys in hexadecimal format (64 characters).

2. **Signature Binding**: Signatures are bound to specific function parameters (token_id, mintingfeeaccount, owneraccount_id) to prevent replay attacks.

3. **Multiple Signers**: The contract supports multiple authorized signers. Any one of them can sign valid fee data.

4. **Owner Control**: Only the contract owner can add or remove authorized signers.

5. **1 Yocto Protection**: All state-changing signer management functions require exactly 1 yoctoNEAR deposit to prevent misuse with function-call access keys.

---

## Related Functions

### Contract Configuration
```bash
# View complete contract configuration
near view identyclaw-com.near get_config --network-id mainnet

# View contract status
near view identyclaw-com.near get_contract_status --network-id mainnet

# View fee configuration
near view identyclaw-com.near get_fees --network-id mainnet
```

---

## References

- **Contract Source**: `/home/icarus39/mintidclawcontractapi-rodit/src/lib.rs`
- **Signature Verification**: Lines 1167-1388 in `src/lib.rs`
- **Signer Management**: Lines 904-1121 in `src/lib.rs`
- **Add Signers Script**: `./add_signers.sh`
- **List Signers Script**: `./list_authorized_signers.sh`
